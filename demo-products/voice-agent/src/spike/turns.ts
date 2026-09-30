// Spike: turn-taking under our control, not Google's.
//
//   node --env-file-if-exists=.env.local src/spike/turns.ts [model]
//
// With automatic activity detection off, the client marks each caller turn
// with activityStart and activityEnd. That would let the server wait through
// a thinking pause or a side conversation, and choose which sounds interrupt
// the agent. What this checks, per model:
//
//   Q1  Does the caller's speech get transcribed while the turn is still open?
//   Q2  Is audio sent outside a turn heard, transcribed or ignored?
//   Q3  Does activityStart while the agent talks interrupt it, and how fast?
//   Q4  How quickly does the reply start after activityEnd?
//   Q5  One long turn holding a pause, a side conversation and the real
//       request: does the reply make sense?
//   Q6  A backchannel ("mm-hm") sent outside a turn while the agent talks:
//       ignored?
//
// Writes spike-output/turns-<model>.json.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resampler, rms } from '../core/audio.ts';
import { speak } from '../core/gemini.ts';
import { LiveSession } from '../core/live.ts';
import { previewVoice } from '../core/preview.ts';
import { loadConfig } from '../config.ts';

const KEY = process.env.GEMINI_API_KEY ?? '';
if (!KEY) throw new Error('GEMINI_API_KEY is not set');
const MODEL = process.argv[2] ?? 'gemini-3.1-flash-live-preview';
const OUT = 'spike-output';
mkdirSync(`${OUT}/tts`, { recursive: true });

const SYSTEM = `You answer the phone for Luca's Trattoria, an Italian restaurant in Nottingham. You are an AI assistant on a demo line.
British English, warm and brisk, one or two short sentences at a time. You are taking a takeaway order: repeat back what the caller asks for.
Menu: Margherita £9.50, Diavola £11, Spaghetti Carbonara £12, Garlic bread £4.50.
If the caller is talking to someone else in the room, wait; answer only what they say to you.`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function line(text: string, voice: string): Promise<Int16Array> {
  const path = `${OUT}/tts/${createHash('sha1').update(`v3:${voice}:${text}`).digest('hex').slice(0, 12)}.pcm`;
  let pcm24: Int16Array;
  if (existsSync(path)) {
    const b = readFileSync(path);
    pcm24 = new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2).slice();
  } else {
    try {
      pcm24 = await speak('gemini-2.5-flash-preview-tts', `Say naturally, like a caller on the phone: ${text}`, voice, KEY);
    } catch {
      // TTS quota spent: a Live voice reads the line instead.
      const wav = await previewVoice(voice, text, loadConfig(), 'en-GB');
      pcm24 = new Int16Array(wav.buffer.slice(wav.byteOffset + 44, wav.byteOffset + wav.byteLength));
    }
    writeFileSync(path, Buffer.from(pcm24.buffer));
  }
  // Trim the silence TTS leaves at each end, then 24 kHz → 16 kHz.
  const win = 240;
  let a = 0;
  let b = pcm24.length;
  while (a < b && rms(pcm24.subarray(a, a + win)) < 300) a += win;
  while (b > a && rms(pcm24.subarray(b - win, b)) < 300) b -= win;
  return new Resampler(24000, 16000).process(pcm24.slice(a, b));
}

const t0 = performance.now();
const now = () => Math.round(performance.now() - t0);
const log: { t: number; ev: string; detail?: unknown }[] = [];
const mark = (ev: string, detail?: unknown) => {
  log.push({ t: now(), ev, detail });
  console.log(String(now()).padStart(6), ev, detail === undefined ? '' : typeof detail === 'string' ? detail : JSON.stringify(detail));
};

/** Stream 16 kHz audio in 20 ms frames at real-time pace. */
async function stream(s: LiveSession, pcm: Int16Array): Promise<void> {
  const frame = 320;
  const start = performance.now();
  for (let i = 0, n = 0; i < pcm.length; i += frame, n++) {
    s.sendAudio(pcm.subarray(i, Math.min(i + frame, pcm.length)), 16000);
    const due = start + (n + 1) * 20;
    const wait = due - performance.now();
    if (wait > 0) await sleep(wait);
  }
}
const silence = (ms: number) => new Int16Array(16 * ms);

async function main() {
  console.log(`model ${MODEL}`);
  const L = {
    open: await line('Hiya, are you open on Sunday evening?', 'Puck'),
    order1: await line('Can I get a margherita, and, um...', 'Puck'),
    order2: await line('a garlic bread, please.', 'Puck'),
    hold: await line('Hang on, let me ask what the kids want.', 'Puck'),
    side1: await line('Jack, do you want pizza or pasta?', 'Puck'),
    side2: await line('Pasta! The carbonara one!', 'Leda'),
    back: await line('Sorry about that. And a spaghetti carbonara as well, please.', 'Puck'),
    wait: await line('No, wait, sorry, make that two margheritas.', 'Puck'),
    mhm: await line('Mm-hm.', 'Puck'),
  };
  mark('audio ready', Object.fromEntries(Object.entries(L).map(([k, v]) => [k, `${(v.length / 16000).toFixed(1)} s`])));

  const s = await LiveSession.connect(
    {
      model: MODEL,
      systemInstruction: SYSTEM,
      voiceName: 'Kore',
      languageCode: 'en-GB',
      transcribeInput: true,
      transcribeOutput: true,
      vad: { disabled: true },
    },
    KEY,
  );
  mark('connected (manual activity detection)');

  let agentText = '';
  let firstAudio: number | null = null;
  let turnDone: (() => void) | null = null;
  s.on('inputTranscript', (t) => mark('caller transcript', t));
  s.on('outputTranscript', (t) => (agentText += t));
  s.on('audio', () => {
    if (firstAudio === null) {
      firstAudio = now();
      mark('agent audio starts');
    }
  });
  s.on('interrupted', () => mark('INTERRUPTED'));
  s.on('usage', (u) => mark('usage', { total: u.totalTokenCount, prompt: u.promptTokenCount }));
  s.on('turnComplete', () => {
    mark('turnComplete', agentText.trim());
    agentText = '';
    firstAudio = null;
    turnDone?.();
  });
  s.on('close', (c, r) => mark('closed', `${c} ${r}`));
  const turn = (ms = 15000) =>
    new Promise<boolean>((resolve) => {
      const t = setTimeout(() => resolve(false), ms);
      turnDone = () => {
        clearTimeout(t);
        turnDone = null;
        resolve(true);
      };
    });
  const firstAudioAfter = async (ms = 8000) => {
    const end = performance.now() + ms;
    while (firstAudio === null && performance.now() < end) await sleep(10);
    return firstAudio;
  };

  // E0: the greeting, from a text cue, in manual mode.
  mark('E0 greeting cue (text)');
  s.sendText('[The call has just connected. Greet the caller now.]');
  mark('E0 result', (await turn()) ? 'greeted' : 'no reply to a text cue');

  // E1 (Q2): speech with no activityStart.
  mark('E1 speech outside any turn');
  await stream(s, L.open);
  await stream(s, silence(2500));
  mark('E1 done');

  // E2 (Q1, Q4): one turn with a 1.5 s thinking pause inside it.
  mark('E2 activityStart');
  s.sendActivityStart();
  await stream(s, L.order1);
  mark('E2 pause begins (turn still open)');
  await stream(s, silence(1500));
  await stream(s, L.order2);
  await stream(s, silence(300));
  const endAt = now();
  mark('E2 activityEnd');
  s.sendActivityEnd();
  const fa = await firstAudioAfter();
  mark('E2 reply latency', fa === null ? 'no audio' : `${fa - endAt} ms`);

  // E3 (Q3): interrupt the reply 0.7 s in.
  if (fa !== null) {
    await sleep(700);
    const at = now();
    mark('E3 activityStart during agent speech');
    s.sendActivityStart();
    await stream(s, L.wait);
    await stream(s, silence(300));
    s.sendActivityEnd();
    mark('E3 activityEnd', `${now() - at} ms after start`);
  }
  await turn();
  await sleep(500);

  // E4 (Q5): hold, side conversation and the real request in one turn.
  mark('E4 activityStart: hold, side talk, request');
  s.sendActivityStart();
  await stream(s, L.hold);
  await stream(s, silence(1200));
  await stream(s, L.side1);
  await stream(s, silence(700));
  await stream(s, L.side2);
  await stream(s, silence(900));
  await stream(s, L.back);
  await stream(s, silence(300));
  const e4End = now();
  s.sendActivityEnd();
  mark('E4 activityEnd');
  const fa4 = await firstAudioAfter();
  mark('E4 reply latency', fa4 === null ? 'no audio' : `${fa4 - e4End} ms`);

  // E5 (Q6): "mm-hm" outside a turn while the agent is talking.
  if (fa4 !== null) {
    await sleep(500);
    mark('E5 backchannel outside a turn');
    await stream(s, L.mhm);
  }
  await turn();
  await sleep(500);
  s.close();
  writeFileSync(`${OUT}/turns-${MODEL}.json`, JSON.stringify({ model: MODEL, at: new Date().toISOString(), log }, null, 2));
  mark('written');
}

main().catch((e) => {
  console.error('spike failed:', e);
  process.exit(1);
});
