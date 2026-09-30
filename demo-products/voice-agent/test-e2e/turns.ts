// Contextual turn-taking, end to end against live Gemini: the real call
// session (prompt, tools, database), a scripted caller streamed in real time,
// and a clock on every sound the receptionist makes.
//
//   npm run e2e:turns
//
// The caller orders a takeaway and, on the way:
//   A. pauses to think mid-order ("a margherita and, um..." 2.2 s ...)
//   B. interrupts a reply to correct it ("no, wait, make that two")
//   C. says "hang on, let me ask the kids", then talks to the family
//   D. says "mm-hm" while the order is read back
//   E. reads the phone number out in two chunks
// and checks the receptionist stayed quiet through A, C and E, was cut off
// by B, carried on through D, and placed the right order.
//
// Caller lines are spoken by a Live voice (the TTS quota runs out) and
// cached in spike-output/tts/. Writes eval-results/turns/report.json.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.ts';
import { openPglite, migrate } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { seedAll } from '../src/db/seed.ts';
import { CallSession } from '../src/core/call.ts';
import { Resampler, rms } from '../src/core/audio.ts';
import { previewVoice } from '../src/core/preview.ts';
import { SimulatedSms } from '../src/channels/sms.ts';
import { FRIDAY_EVENING } from '../src/eval/scenarios.ts';

const config = loadConfig();
const OUT = 'eval-results/turns';
mkdirSync(OUT, { recursive: true });
mkdirSync('spike-output/tts', { recursive: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function line(text: string, voice = 'Puck'): Promise<Int16Array> {
  const path = `spike-output/tts/${createHash('sha1').update(`v3:${voice}:${text}`).digest('hex').slice(0, 12)}.pcm`;
  let pcm24: Int16Array;
  if (existsSync(path)) {
    const b = readFileSync(path);
    pcm24 = new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2).slice();
  } else {
    const wav = await previewVoice(voice, text, config, 'en-GB');
    pcm24 = new Int16Array(wav.buffer.slice(wav.byteOffset + 44, wav.byteOffset + wav.byteLength));
    writeFileSync(path, Buffer.from(pcm24.buffer));
  }
  let a = 0;
  let b = pcm24.length;
  while (a < b && rms(pcm24.subarray(a, a + 240)) < 300) a += 240;
  while (b > a && rms(pcm24.subarray(b - 240, b)) < 300) b -= 240;
  return new Resampler(24000, 16000).process(pcm24.slice(a, b));
}

const L = {
  takeaway: await line("Hiya, I'd like to order a takeaway for collection, please."),
  order1: await line('Can I get a margherita, and, um...'),
  order2: await line('a garlic bread, please.'),
  wait: await line('No, wait, sorry, make that two margheritas.'),
  hold: await line('Hang on, let me ask what the kids want.'),
  side1: await line('Jack, do you want pizza or pasta?'),
  side2: await line('Pasta! The carbonara one!', 'Leda'),
  back: await line('Sorry about that. And a spaghetti carbonara as well, please.'),
  mhm: await line('Mm-hm.'),
  done: await line("No, that's everything, thanks."),
  name: await line("It's Sam Taylor."),
  allergy: await line('No allergies, thanks.'),
  yes: await line("Yes, that's right."),
  asap: await line('As soon as possible, please.'),
  pay: await line("No, I'll pay when I collect, thanks."),
  num1: await line("It's oh seven seven double oh,"),
  num2: await line('nine double oh, one two three.'),
  collection: await line('Collection, please.'),
  bye: await line('Lovely, thanks. Bye!'),
};
console.log('caller lines ready');

const dir = join(tmpdir(), `va-turns-${Date.now()}`);
const db = await openPglite(dir);
await migrate(db);
const repo = new Repo(db);
await seedAll(repo, FRIDAY_EVENING, { diary: false });
const tenant = (await repo.getTenant('lucas-trattoria'))!;
tenant.profile.turn_taking = 'contextual';
const t0 = Date.now();
const clock = () => new Date(FRIDAY_EVENING.getTime() + (Date.now() - t0));
const call = new CallSession({ tenant, repo, config, channel: 'eval', callerPhone: null, sms: new SimulatedSms(), telephony: null, now: clock });

const now = () => Date.now() - t0;
const log: { t: number; ev: string; text?: string }[] = [];
const mark = (ev: string, text?: string) => {
  log.push({ t: now(), ev, text });
  console.log(String(now()).padStart(6), ev, text ?? '');
};
const agentAudio: number[] = [];
const clears: number[] = [];
let speakingUntil = 0;
let lastAgentLine = '';
let hungUp = false;
call.on('audio', (pcm) => {
  const t = now();
  agentAudio.push(t);
  speakingUntil = Math.max(speakingUntil, t) + (pcm.length / 24000) * 1000;
});
call.on('clear', () => {
  clears.push(now());
  speakingUntil = now();
  mark('receptionist interrupted');
});
call.on('transcript', (l) => {
  if (!l.final) return;
  if (l.role === 'agent') lastAgentLine = l.text;
  mark(l.role === 'agent' ? 'RECEPTIONIST' : 'caller (as heard)', l.text);
});
call.on('turn', (s) => mark(`  turn: ${s.state}${s.reason ? ` (${s.reason})` : ''}`, `expecting ${s.expect}`));
call.on('latency', (ms, extra) => mark(`  reply after ${ms} ms${extra ? `, ${extra} ms of it waiting on purpose` : ''}`));
call.on('action', (a) => mark('  action', `${a.title}${a.detail ? `: ${a.detail}` : ''}`));
call.on('hangup', (r) => {
  hungUp = true;
  mark('hangup', r);
});

// The caller's microphone: a 20 ms frame every 20 ms, silence unless a line is playing.
const SILENCE = new Int16Array(320);
const queue: Int16Array[] = [];
let running = true;
let sentFrames = 0;
void (async () => {
  const start = performance.now();
  for (let n = 1; running; n++) {
    call.sendAudio(queue.shift() ?? SILENCE, 16000);
    sentFrames++;
    const wait = start + n * 20 - performance.now();
    if (wait > 0) await sleep(wait);
  }
})();
async function say(pcm: Int16Array, label: string): Promise<void> {
  mark(`caller says: ${label}`);
  for (let i = 0; i < pcm.length; i += 320) {
    const f = new Int16Array(320);
    f.set(pcm.subarray(i, Math.min(i + 320, pcm.length)));
    queue.push(f);
  }
  while (queue.length) await sleep(10);
}
const pause = (ms: number) => sleep(ms);
const agentSoundsBetween = (a: number, b: number) => agentAudio.filter((t) => t >= a && t <= b).length;
async function agentStarts(since: number, max = 15000): Promise<number | null> {
  const end = Date.now() + max;
  while (Date.now() < end) {
    const t = agentAudio.find((x) => x > since);
    if (t !== undefined) return t;
    await sleep(20);
  }
  return null;
}
async function agentQuiet(max = 20000): Promise<void> {
  const start = now();
  const end = Date.now() + max;
  while (Date.now() < end && !hungUp) {
    const heard = agentAudio.some((t) => t > start);
    const last = agentAudio[agentAudio.length - 1] ?? 0;
    if (heard && now() > speakingUntil + 400 && now() - last > 900) {
      // "Let me review the order with you." is not the end of its turn: a
      // caller would wait for the question.
      if (lastAgentLine.includes('?') || /bye|take your time/i.test(lastAgentLine)) return;
      const more = Date.now() + 5000;
      while (Date.now() < more && agentAudio[agentAudio.length - 1] === last) await sleep(50);
      if (agentAudio[agentAudio.length - 1] === last) return;
    }
    await sleep(50);
  }
}

const checks: { name: string; pass: boolean; detail: string }[] = [];
const check = (name: string, pass: boolean, detail: string) => {
  checks.push({ name, pass, detail });
  mark(`${pass ? 'PASS' : 'FAIL'} ${name}`, detail);
};

try {
  await call.start();
  mark('call started', call.model);
  await agentQuiet();
  await say(L.takeaway, 'takeaway for collection');
  await agentQuiet();

  // A. A thinking pause mid-order.
  await say(L.order1, '"Can I get a margherita, and, um..."');
  const pauseFrom = now();
  await pause(2200);
  const pauseTo = now();
  await say(L.order2, '"...a garlic bread, please."');
  check('A. waits through a thinking pause', agentSoundsBetween(pauseFrom, pauseTo + 300) === 0, `${agentSoundsBetween(pauseFrom, pauseTo + 300)} receptionist audio chunks during the 2.2 s pause`);

  // B. Interrupt the reply to correct the order.
  const replyAt = await agentStarts(pauseTo);
  if (replyAt !== null) {
    await sleep(Math.max(0, replyAt + 500 - now()));
    const cutAt = now();
    const saying = say(L.wait, '"No, wait, sorry, make that two margheritas." (over the receptionist)');
    await sleep(1500);
    const cut = clears.find((t) => t >= cutAt && t <= cutAt + 1500);
    // If its reply ended before 0.6 s of the correction, there was nothing to interrupt: fine.
    const finished = !agentAudio.some((t) => t > cutAt + 700) && speakingUntil < cutAt + 700;
    check('B. a real correction interrupts', cut !== undefined || finished, cut !== undefined ? `cut off ${cut - cutAt} ms after the caller started` : finished ? 'its reply had already finished; the correction was heard as the next turn' : 'talked over the caller');
    await saying;
  } else check('B. a real correction interrupts', false, 'no reply to interrupt');
  await agentQuiet();

  // C. Hold, and the family chat.
  await say(L.hold, '"Hang on, let me ask what the kids want."');
  await agentQuiet(8000);
  const ack = lastAgentLine;
  const sideFrom = now();
  await say(L.side1, '(to Jack) "Jack, do you want pizza or pasta?"');
  await pause(700);
  await say(L.side2, '(Jack, off the phone) "Pasta! The carbonara one!"');
  await pause(1000);
  await say(L.back, '"Sorry about that. And a spaghetti carbonara as well, please."');
  const sideTo = now();
  check('C. says "take your time", then stays quiet through the family chat', agentSoundsBetween(sideFrom, sideTo) === 0, `acknowledged with "${ack}"; ${agentSoundsBetween(sideFrom, sideTo)} receptionist audio chunks during the side conversation`);

  // D. "Mm-hm" during the reply (the order read back).
  const readAt = await agentStarts(sideTo);
  if (readAt !== null) {
    await sleep(Math.max(0, readAt + 1500 - now()));
    const at = now();
    await say(L.mhm, '"Mm-hm." (over the receptionist)');
    await sleep(1200);
    check('D. "mm-hm" does not interrupt', !clears.some((t) => t >= at), clears.some((t) => t >= at) ? 'it was cut off' : 'kept talking');
  }
  await agentQuiet();

  // The rest of the order, answering whatever it asks.
  let numberChecked = false;
  for (let turn = 0; turn < 12 && !hungUp; turn++) {
    const q = lastAgentLine.toLowerCase();
    if (/order number|reference|is (now )?placed|all sorted|order's in|order is in|ready (for|at|in)|see you/.test(q)) {
      await say(L.bye, 'bye');
      await agentQuiet(8000);
      break;
    }
    if (/\b(number|phone|mobile)\b/.test(q) && !numberChecked) {
      await say(L.num1, '"It\'s oh seven seven double oh,"');
      const a = now();
      await pause(1600);
      const b = now();
      await say(L.num2, '"nine double oh, one two three."');
      check('E. waits for the rest of a phone number', agentSoundsBetween(a, b + 300) === 0, `${agentSoundsBetween(a, b + 300)} receptionist audio chunks in the 1.6 s gap`);
      numberChecked = true;
    } else if (/allerg/.test(q)) await say(L.allergy, 'no allergies');
    else if (/\bname\b/.test(q)) await say(L.name, 'name');
    else if (/\bcorrect\b|sound right|is that right|all good/.test(q)) await say(L.yes, "yes, that's right");
    else if (/anything else|what else|something else|anything more|add to (your|the) order|finished with (your|the) order|is that all|is that everything/.test(q)) await say(L.done, "that's everything");
    else if (/collection|collect|deliver/.test(q)) await say(L.collection, 'collection');
    else if (/\b(when|what time)\b/.test(q)) await say(L.asap, 'as soon as possible');
    else if (/\bpay\b/.test(q)) await say(L.pay, 'pay on collection');
    else await say(L.yes, "yes, that's right");
    await agentQuiet();
  }
} catch (err) {
  mark('ERROR', (err as Error).message);
} finally {
  running = false;
  const summary = await call.end('completed');
  const orders = await db.query<any>('select * from public.voice_orders where tenant_id = $1', [tenant.id]);
  const o = orders[0];
  const lines = (o?.lines ?? []).map((l: any) => `${l.quantity} × ${l.name}`).join(', ');
  // Two margheritas may be one line of two or two lines of one.
  const count = (re: RegExp) => (o?.lines ?? []).filter((l: any) => re.test(l.name)).reduce((n: number, l: any) => n + l.quantity, 0);
  const has = (re: RegExp, qty?: number) => (qty === undefined ? count(re) > 0 : count(re) === qty);
  check('F. the order is right', Boolean(o) && has(/margherita/i, 2) && has(/garlic/i) && has(/carbonara/i), o ? `#${o.reference}: ${lines}` : 'no order placed');
  const turnEvents = await repo.listEvents(summary?.call_id ?? call.callId);
  const turns = turnEvents.filter((e: any) => e.kind === 'system' && (e.data?.event === 'turn_end' || e.data?.event === 'turn_reopened' || e.data?.event === 'watchdog' || e.data?.event === 'handed_over')).map((e: any) => e.data);
  writeFileSync(join(OUT, 'report.json'), JSON.stringify({ at: new Date().toISOString(), model: call.model, checks, turns, latency_ms: summary?.latency_ms, log }, null, 2));
  console.log('\nturns:', turns.map((t: any) => (t.event === 'turn_end' ? `${t.reason}${t.extra_ms ? `(+${t.extra_ms})` : ''}` : t.event === 'turn_reopened' ? `REOPENED(${t.reason})` : t.event.toUpperCase())).join(' '));
  console.log(`\n${checks.filter((c) => c.pass).length} of ${checks.length} checks passed`);
  for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}: ${c.detail}`);
  await db.close();
  rmSync(dir, { recursive: true, force: true });
  process.exit(checks.every((c) => c.pass) ? 0 : 1);
}
