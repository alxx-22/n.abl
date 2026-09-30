import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EnergyVad, TurnManager, type TurnTimings } from '../src/core/turns.ts';
import { countDigits, expectFromAgent, readWords } from '../src/core/turn-words.ts';

// A caller on a fake clock: 20 ms frames of speech (a 200 Hz tone) or silence.
function caller(timings: Partial<TurnTimings> = {}, withWords = true) {
  let t = 0;
  let agentUntil = 0;
  const events: { at: number; ev: string }[] = [];
  const statuses: string[] = [];
  let sent = 0;
  let lastVoice = 0;
  const m = new TurnManager(
    {
      now: () => t,
      startTurn: (interrupting) => events.push({ at: t, ev: interrupting ? 'interrupt' : 'start' }),
      sendAudio: () => sent++,
      endTurn: (e) => events.push({ at: t, ev: `end:${e.reason}` }),
      agentSpeaking: () => t < agentUntil,
      onStatus: (s) => statuses.push(s.reason ? `${s.state}:${s.reason}` : s.state),
    },
    timings,
  );
  m.wordsAvailable = withWords;
  const tone = new Int16Array(320).map((_, i) => Math.round(3000 * Math.sin((2 * Math.PI * 200 * i) / 16000)));
  const quietFrame = new Int16Array(320);
  const at: [number, () => void][] = [];
  const step = (frame: Int16Array) => {
    m.push(frame, 16000);
    t += 20;
    for (const [when, fn] of at.filter(([w]) => w <= t)) {
      at.splice(at.findIndex(([w]) => w === when), 1);
      fn();
    }
  };
  return {
    m,
    events,
    statuses,
    sent: () => sent,
    now: () => t,
    lastVoice: () => lastVoice,
    speak(ms: number) {
      for (let i = 0; i < ms; i += 20) step(tone);
      lastVoice = t - 20;
    },
    quiet(ms: number) {
      for (let i = 0; i < ms; i += 20) step(quietFrame);
    },
    /** The transcriber's words, arriving `delay` ms from now (about a second behind, in real life). */
    words(text: string, delay = 1100) {
      at.push([t + delay, () => m.callerWords(text)]);
    },
    agentTalks(ms: number) {
      agentUntil = t + ms;
    },
    ends: () => events.filter((e) => e.ev.startsWith('end')),
    starts: () => events.filter((e) => e.ev === 'start' || e.ev === 'interrupt'),
  };
}

const near = (actual: number, expected: number, slack = 60) =>
  assert.ok(Math.abs(actual - expected) <= slack, `expected about ${expected} ms, got ${actual}`);

test('turns: an open question ends 0.7 s after the caller stops', () => {
  const c = caller();
  c.speak(1000);
  c.quiet(1500);
  assert.equal(c.starts().length, 1);
  assert.equal(c.ends().length, 1);
  near(c.ends()[0].at - c.lastVoice(), 700);
});

test('turns: a yes-or-no question ends quicker, and reply speed scales it', () => {
  const c = caller();
  c.m.agentSaid('Table for four on Sunday at seven. Shall I book that?');
  c.speak(400);
  c.quiet(1000);
  near(c.ends()[0].at - c.lastVoice(), 500);

  const snappy = caller({ scale: 0.75 });
  snappy.speak(800);
  snappy.quiet(1500);
  near(snappy.ends()[0].at - snappy.lastVoice(), 525);
});

test('turns: ordering, "a margherita and, um..." waits through the pause for the rest', () => {
  const c = caller();
  c.m.agentSaid('Lovely. What can I get for you?');
  c.speak(2000);
  c.words('Can I get a margherita and um');
  c.quiet(2000); // thinking
  assert.equal(c.ends().length, 0, 'no reply while they think');
  assert.ok(c.statuses.includes('waiting:thinking'));
  c.speak(1200); // "a garlic bread, please"
  c.words('A garlic bread, please.');
  c.quiet(2500);
  assert.equal(c.starts().length, 1, 'one turn, not two');
  assert.equal(c.ends().length, 1);
  assert.equal(c.ends()[0].ev, 'end:normal');
});

test('turns: without the transcriber, a list question still gives 1.3 s', () => {
  const c = caller({}, false);
  c.m.agentSaid('Anything else for you?');
  c.speak(800);
  c.quiet(2000);
  near(c.ends()[0].at - c.lastVoice(), 1300);
});

test('turns: a phone number read out in chunks waits for all eleven digits', () => {
  const c = caller();
  c.m.agentSaid("And what's the best number to reach you on?");
  c.speak(1500);
  c.words('oh seven seven double oh');
  c.quiet(2200);
  assert.equal(c.ends().length, 0, 'still waiting for the rest of the number');
  assert.ok(c.statuses.includes('waiting:number'));
  c.speak(1500);
  c.words('900 123');
  c.quiet(2500);
  assert.equal(c.ends().length, 1);
  assert.equal(c.starts().length, 1);
});

test('turns: "that\'s everything" ends as soon as the words arrive', () => {
  const c = caller();
  c.m.agentSaid('Anything else?');
  c.speak(1000);
  c.words("No, that's everything, thanks.");
  c.quiet(2500);
  assert.equal(c.ends()[0].ev, 'end:done');
  near(c.ends()[0].at - c.lastVoice(), 1100, 40);
});

test('turns: "hang on, let me ask the kids", then the family chat, then back to us', () => {
  const c = caller();
  c.m.agentSaid('What can I get for you?');
  c.speak(1700);
  c.words('Hang on, let me ask what the kids want.');
  c.quiet(1500);
  assert.equal(c.ends().length, 1, 'ends as the words arrive, so the receptionist can say "take your time"');
  assert.equal(c.ends()[0].ev, 'end:hold_ack');
  c.agentTalks(1200);
  c.quiet(1200);
  c.m.agentTurnDone();
  assert.ok(c.statuses.includes('hold:hold'));

  c.speak(2000); // "Jack, do you want pizza or pasta?"
  c.words('Jack, do you want pizza or pasta?');
  c.quiet(700);
  c.speak(1500); // "Pasta! The carbonara one!"
  c.words('Pasta, the carbonara one.');
  c.quiet(1200);
  assert.equal(c.ends().length, 1, 'no reply to the family chat');
  c.speak(3000); // "Sorry about that. And a spaghetti carbonara as well, please."
  c.words('Sorry about that, and a spaghetti carbonara as well, please.');
  c.quiet(2000);
  assert.equal(c.ends().length, 2);
  assert.equal(c.ends()[1].ev, 'end:back');
  near(c.ends()[1].at - c.lastVoice(), 1100, 40);
});

test('turns: side talk in the middle of an order holds the turn open', () => {
  const c = caller();
  c.m.agentSaid('Anything else?');
  c.speak(1500);
  c.words('Love, what are you having?');
  c.quiet(3000);
  assert.equal(c.ends().length, 0);
  assert.ok(c.statuses.includes('hold:side_talk'));
  c.speak(1500);
  c.words("Right, she'll have the Diavola.");
  c.quiet(2000);
  assert.equal(c.ends().length, 1);
  assert.equal(c.ends()[0].ev, 'end:back');
});

test('turns: on hold, a long silence ends the turn anyway', () => {
  const c = caller();
  c.speak(1000);
  c.words('One sec.');
  c.quiet(1500);
  c.m.agentTurnDone();
  c.speak(1000);
  c.quiet(5000);
  assert.equal(c.ends().length, 2);
  assert.equal(c.ends()[1].ev, 'end:hold');
  near(c.ends()[1].at - c.lastVoice(), 3500);
});

test('turns: "mm-hm" while the receptionist talks does not interrupt; real speech does', () => {
  const c = caller();
  c.agentTalks(10000);
  c.speak(500); // a long "mm-hm"
  c.quiet(400);
  assert.equal(c.starts().length, 0, 'a backchannel is dropped');
  assert.ok(c.statuses.includes('backchannel'));
  c.speak(700);
  assert.equal(c.starts().length, 1);
  assert.equal(c.starts()[0].ev, 'interrupt');
  assert.ok(c.sent() >= 600 / 20, 'the words before the interruption reach the model too');
});

test('turns: a read-back takes longer speech to interrupt', () => {
  const c = caller();
  c.agentTalks(10000);
  c.m.protect();
  c.speak(900);
  c.quiet(400);
  assert.equal(c.starts().length, 0);
  c.speak(1200);
  assert.equal(c.starts().length, 1);
});

test('turns: an open question closes at 0.7 s, then reopens when the words show they were still thinking', () => {
  const c = caller();
  c.speak(1500); // "Hi, can I get a margherita and, um..."
  c.words('Hi, can I get a margherita and um');
  c.quiet(1000);
  assert.deepEqual(c.events.map((e) => e.ev), ['start', 'end:normal'], 'closed on time, before the words came');
  c.quiet(400); // the words arrive; the receptionist has not made a sound
  assert.deepEqual(c.events.map((e) => e.ev), ['start', 'end:normal', 'start'], 'taken back');
  assert.ok(c.statuses.includes('waiting:thinking'));
  c.speak(1200); // "...and a garlic bread, please."
  c.words('And a garlic bread, please.');
  c.quiet(2000);
  assert.deepEqual(c.events.map((e) => e.ev), ['start', 'end:normal', 'start', 'end:normal']);
});

test('turns: no reopening once the receptionist has started talking or called a tool', () => {
  for (const acted of ['audio', 'tool'] as const) {
    const c = caller();
    c.speak(1500);
    c.words('Can I get a margherita and um');
    c.quiet(900);
    if (acted === 'audio') c.m.agentAudio();
    else c.m.agentToolCall();
    c.quiet(600);
    assert.equal(c.starts().length, 1, `${acted}: not reopened`);
  }
});

test('turns: right after a tool returns, the receptionist is about to talk, so a short sound does not cut in', () => {
  const c = caller();
  c.speak(800);
  c.quiet(1000);
  c.m.agentWillSpeak(); // e.g. review_order came back; the read-back is on its way
  c.speak(300);
  c.quiet(400);
  assert.equal(c.starts().length, 1, 'only the first turn');
});

test('turns: the latest turn\'s audio is kept, first syllable included, for a replacement model', () => {
  const c = caller();
  c.speak(1000);
  c.quiet(1000);
  const audio = c.m.lastTurnAudio();
  const ms = audio.reduce((n, f) => n + (f.pcm.length / f.rate) * 1000, 0);
  assert.ok(ms >= 1000 && ms <= 2400, `kept ${ms} ms: the speech, the pre-roll and the closing silence`);
  assert.equal(ms, c.sent() * 20, 'exactly what the model was sent');
  c.m.agentTurnDone();
  c.speak(500);
  assert.ok(c.m.lastTurnAudio().length < audio.length, 'a new turn starts a new recording');
});

test('turns: a click does not open a turn; a word does', () => {
  const c = caller();
  c.speak(80);
  c.quiet(600);
  assert.equal(c.starts().length, 0);
  c.speak(200);
  assert.equal(c.starts().length, 1);
  assert.equal(c.starts()[0].ev, 'start');
});

test('turns: a turn that never stops still ends', () => {
  const c = caller();
  // Syllables with short gaps, for 46 s (a steady tone would become the noise floor).
  for (let i = 0; i < 115; i++) {
    c.speak(300);
    c.quiet(100);
  }
  assert.equal(c.ends()[0].ev, 'end:long_turn');
});

test('vad: steady background noise stops counting as speech; speech over it still does', () => {
  const vad = new EnergyVad();
  const noise = () => new Int16Array(320).map(() => Math.round((Math.random() - 0.5) * 1800));
  let voiced = 0;
  for (let i = 0; i < 400; i++) if (vad.voiced(noise()) && i > 300) voiced++;
  assert.equal(voiced, 0, 'after eight seconds the noise is the floor');
  const loud = new Int16Array(320).map((_, i) => Math.round(6000 * Math.sin(i / 5)));
  assert.equal(vad.voiced(loud), true);
});

test('words: what the receptionist asked', () => {
  assert.equal(expectFromAgent("Hello, Luca's Trattoria. How can I help?").expect, 'open');
  assert.equal(expectFromAgent('Grand. What can I get for you?').expect, 'list');
  assert.equal(expectFromAgent('Anything else for you?').expect, 'list');
  assert.equal(expectFromAgent('Shall I book that?').expect, 'yes_no');
  assert.equal(expectFromAgent('Is that all correct?').expect, 'yes_no');
  assert.equal(expectFromAgent('Would you like collection or delivery?').expect, 'open');
  assert.equal(expectFromAgent("I'm so sorry, we had a brief issue on the line. Could you please repeat that?").expect, 'open', 'a request, not a yes or no');
  assert.equal(expectFromAgent('Can you spell the surname for me?').expect, 'name');
  assert.deepEqual(expectFromAgent("And what's the best number to reach you on?"), { expect: 'digits', digits: 11 });
  assert.deepEqual(expectFromAgent("What's the long number on the card?"), { expect: 'digits', digits: 16 });
  assert.equal(expectFromAgent('Could I take a name for the booking?').expect, 'name');
});

test('words: what the caller said so far', () => {
  assert.ok(readWords('Can I get a margarita and um').unfinished);
  assert.ok(readWords('It is Sarah Collins, my number is').unfinished);
  assert.ok(!readWords('A garlic bread, please.').unfinished);
  assert.ok(readWords('Hang on, let me ask what the kids want.').hold);
  assert.ok(readWords('Jack, do you want pizza or pasta?').sideTalk);
  assert.ok(readWords('Love, what are you having?').sideTalk);
  assert.ok(!readWords('Yes, do you have a table for two?').sideTalk, '"Yes," is not a name');
  assert.ok(readWords('Sorry about that, and a spaghetti carbonara as well, please.').back);
  assert.ok(readWords("No, that's everything, thanks.").done);
  assert.ok(readWords('Mm-hm.').backchannel);
  assert.equal(countDigits('oh seven seven double oh'), 5);
  assert.equal(countDigits('07700 900 123'), 11);
  assert.equal(countDigits('oh seven seven double oh, nine double oh, one two three'), 11);
});
