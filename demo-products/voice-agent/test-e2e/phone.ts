// The phone path without the phone: this script plays Twilio. It opens the
// server's /twilio/stream socket with a valid token, streams a recorded caller
// as 8 kHz μ-law in real time, plays back the agent's frames, echoes marks
// when they would have finished playing, and checks the booking landed.
//
//   npm run e2e:phone
//
// Everything a real call exercises except Twilio's own network: the μ-law
// bridge, barge-in, hang-up marks, the live model and the database.

import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { loadConfig } from '../src/config.ts';
import { startServer } from '../src/server/main.ts';
import { Resampler, concatPcm16, mulawDecode, mulawEncode, wavFromPcm16 } from '../src/core/audio.ts';
import { speak } from '../src/core/gemini.ts';
import { streamToken } from '../src/channels/twilio.ts';

const OUT = 'eval-results/phone';
mkdirSync(OUT, { recursive: true });
const config = loadConfig();
const LINES = [
  'Hello, could I book a table for two tomorrow evening at eight?',
  "It's Alex Turner. This number's fine.",
  'Yes please, go ahead.',
  "No, that's it. Thanks, bye.",
];

async function lineAudio(line: string): Promise<Int16Array> {
  const path = `spike-output/tts/${createHash('sha1').update(`v2:${line}`).digest('hex').slice(0, 12)}.pcm`;
  if (existsSync(path)) {
    const b = readFileSync(path);
    return new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2).slice();
  }
  mkdirSync('spike-output/tts', { recursive: true });
  const pcm = await speak(config.ttsModel, line, 'Puck', config.geminiApiKey);
  writeFileSync(path, Buffer.from(pcm.buffer));
  return pcm;
}

const ulawLines: Uint8Array[] = [];
for (const l of LINES) ulawLines.push(mulawEncode(new Resampler(24000, 8000).process(await lineAudio(l))));

const dir = join(tmpdir(), `va-phone-${Date.now()}`);
const app = await startServer({ ...config, port: 0, pgliteDir: dir, databaseUrl: undefined, consolePassword: undefined, sessionSecret: 'phone-e2e' });
const tenant = (await app.repo.getTenant('lucas-trattoria'))!;
const callSid = `CA${Date.now()}`;
const ws = new WebSocket(`ws://localhost:${app.port}/twilio/stream`);
await new Promise((r) => ws.on('open', r));

const agentFrames: Int16Array[] = [];
let lastAgentFrame = 0;
let playbackEndsAt = Date.now();
let hungUp = false;
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.event === 'media') {
    const pcm = mulawDecode(Buffer.from(m.media.payload, 'base64'));
    agentFrames.push(pcm);
    lastAgentFrame = Date.now();
    playbackEndsAt = Math.max(playbackEndsAt, Date.now()) + (pcm.length / 8000) * 1000;
  } else if (m.event === 'clear') {
    playbackEndsAt = Date.now();
  } else if (m.event === 'mark') {
    // Twilio echoes a mark once everything queued before it has played.
    setTimeout(() => ws.readyState === ws.OPEN && ws.send(JSON.stringify({ event: 'mark', streamSid: 'MZe2e', mark: m.mark })), Math.max(0, playbackEndsAt - Date.now()));
    if (m.mark.name === 'hangup') hungUp = true;
  }
});

ws.send(JSON.stringify({ event: 'connected' }));
ws.send(JSON.stringify({
  event: 'start',
  start: {
    streamSid: 'MZe2e', callSid,
    customParameters: { tenant_id: tenant.id, token: streamToken('phone-e2e', callSid, tenant.id), from: '+447700900321', to: '+441154960321' },
  },
}));

const silence: Uint8Array = new Uint8Array(160).fill(0xff);
let sending: Uint8Array | null = null;
let sendPos = 0;
const t0 = Date.now();
let frameNo = 0;
const latencies: number[] = [];
let lineEnd = 0;
const pump = setInterval(() => {
  // One 20 ms frame per tick, as Twilio sends them; silence between lines.
  frameNo++;
  let frame = silence;
  if (sending) {
    frame = sending.subarray(sendPos, sendPos + 160);
    sendPos += 160;
    if (sendPos >= sending.length) {
      sending = null;
      lineEnd = Date.now();
    }
  }
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ event: 'media', streamSid: 'MZe2e', media: { track: 'inbound', timestamp: String(frameNo * 20), payload: Buffer.from(frame).toString('base64') } }));
}, 20);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const quietFor = (ms: number) => Date.now() - lastAgentFrame > ms && Date.now() > playbackEndsAt;

// Wait for the greeting to finish, then say each line once the agent has finished speaking.
await sleep(1500);
while (!quietFor(1200) && Date.now() - t0 < 20000) await sleep(100);
for (const line of ulawLines) {
  sending = line;
  sendPos = 0;
  while (sending) await sleep(20);
  const before = agentFrames.length;
  while (agentFrames.length === before && Date.now() - lineEnd < 15000) await sleep(20);
  if (agentFrames.length > before) latencies.push(lastAgentFrame - lineEnd);
  while (!quietFor(1500) && Date.now() - lineEnd < 45000 && !hungUp) await sleep(100);
  if (hungUp) break;
}
const end = Date.now() + 15000;
while (!hungUp && Date.now() < end) await sleep(200);
ws.send(JSON.stringify({ event: 'stop', streamSid: 'MZe2e' }));
clearInterval(pump);
await sleep(1500);
ws.close();

writeFileSync(join(OUT, 'agent-8k.wav'), wavFromPcm16(concatPcm16(agentFrames), 8000));
const calls = await app.repo.listCalls(tenant.id);
const events = await app.repo.listEvents(calls[0].id);
const bookings = await app.repo.db.query<any>(`select reference, starts_at, party_size, name, phone from public.voice_bookings where tenant_id = $1 and call_id = $2`, [tenant.id, calls[0].id]);
const transcript = events.filter((e) => e.kind === 'caller' || e.kind === 'agent').map((e) => `${e.kind}: ${e.data.text}`);
console.log(transcript.join('\n'));
console.log('\nfirst agent frame after each caller line (ms):', latencies);
console.log('booking:', bookings);
console.log('hung up by the agent:', hungUp, '· call row:', JSON.stringify({ outcome: calls[0].outcome, flags: calls[0].guardrail_flags, usage: calls[0].usage }));
writeFileSync(join(OUT, 'transcript.txt'), `${transcript.join('\n')}\n\nlatencies ${JSON.stringify(latencies)}\nbooking ${JSON.stringify(bookings)}\n`);
await app.close();
rmSync(dir, { recursive: true, force: true });
process.exit(bookings.length === 1 ? 0 : 1);
