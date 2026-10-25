// Spike: can a parallel listener give us the caller's words while they are
// still talking? With manual turn-taking the receptionist model only
// transcribes a turn after it closes, so the decision "wait, they said um"
// needs words from somewhere else.
//
//   node --env-file-if-exists=.env.local src/spike/transcriber.ts [model]
//
// Streams the cached caller lines from src/spike/turns.ts (run that first)
// in real time and logs when each piece of text arrives, relative to the
// end of the line it belongs to.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Resampler, rms } from '../core/audio.ts';
import { LiveSession } from '../core/live.ts';

const KEY = process.env.GEMINI_API_KEY ?? '';
const MODEL = process.argv[2] ?? 'gemini-3.5-transcribe-live';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function line(text: string, voice: string): Int16Array {
  const path = `spike-output/tts/${createHash('sha1').update(`v3:${voice}:${text}`).digest('hex').slice(0, 12)}.pcm`;
  const b = readFileSync(path);
  const pcm24 = new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2).slice();
  let a = 0;
  let e = pcm24.length;
  while (a < e && rms(pcm24.subarray(a, a + 240)) < 300) a += 240;
  while (e > a && rms(pcm24.subarray(e - 240, e)) < 300) e -= 240;
  return new Resampler(24000, 16000).process(pcm24.slice(a, e));
}

const t0 = performance.now();
const now = () => Math.round(performance.now() - t0);
const log: { t: number; ev: string; detail?: string }[] = [];
const mark = (ev: string, detail?: string) => {
  log.push({ t: now(), ev, detail });
  console.log(String(now()).padStart(6), ev, detail ?? '');
};

async function stream(s: LiveSession, pcm: Int16Array): Promise<void> {
  const start = performance.now();
  for (let i = 0, n = 0; i < pcm.length; i += 320, n++) {
    s.sendAudio(pcm.subarray(i, Math.min(i + 320, pcm.length)), 16000);
    const wait = start + (n + 1) * 20 - performance.now();
    if (wait > 0) await sleep(wait);
  }
}

async function main() {
  const script: [string, string, number][] = [
    ['Can I get a margherita, and, um...', 'Puck', 1500],
    ['a garlic bread, please.', 'Puck', 1200],
    ['Hang on, let me ask what the kids want.', 'Puck', 1200],
    ['Jack, do you want pizza or pasta?', 'Puck', 700],
    ['Pasta! The carbonara one!', 'Leda', 900],
    ['Sorry about that. And a spaghetti carbonara as well, please.', 'Puck', 1500],
  ];
  const variants: [string, Record<string, unknown>][] = [
    ['auto VAD, input transcription, TEXT out', { transcribeInput: true, responseModality: 'TEXT' }],
  ];
  for (const [label, extra] of variants) {
    mark(`== ${MODEL}: ${label}`);
    let s: LiveSession;
    try {
      s = await LiveSession.connect(
        {
          model: MODEL,
          systemInstruction: 'Transcribe the audio exactly, in English. Output only the words spoken.',
          vad: { silenceDurationMs: 300, prefixPaddingMs: 100 },
          ...extra,
        },
        KEY,
      );
    } catch (e) {
      mark('connect failed', (e as Error).message);
      continue;
    }
    s.on('inputTranscript', (t) => mark('  inputTranscript', JSON.stringify(t)));
    s.on('text', (t) => mark('  text', JSON.stringify(t)));
    s.on('turnComplete', () => mark('  turnComplete'));
    s.on('usage', (u) => mark('  usage', String(u.totalTokenCount)));
    s.on('close', (c, r) => mark('  closed', `${c} ${r}`));
    for (const [text, voice, gap] of script) {
      mark(`> speaking: ${text}`);
      await stream(s, line(text, voice));
      mark('> line ends');
      await stream(s, new Int16Array(16 * gap));
    }
    await sleep(1500);
    s.close();
  }
  writeFileSync(`spike-output/transcriber-${MODEL}.json`, JSON.stringify({ model: MODEL, at: new Date().toISOString(), log }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
