// End to end through a real browser: headless Chromium, a fake microphone
// playing a recorded caller, the React app (served by Vite inside the
// server, as `npm run dev` does), the server and a live Gemini session.
// Needs GEMINI_API_KEY and network; not part of `npm test`.
//
//   npm run e2e:browser
//
// Writes screenshots and the call transcript to eval-results/browser/.

import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { loadConfig } from '../src/config.ts';
import { startServer } from '../src/server/main.ts';
import { concatPcm16, wavFromPcm16 } from '../src/core/audio.ts';
import { speak } from '../src/core/gemini.ts';

const OUT = 'eval-results/browser';
mkdirSync(OUT, { recursive: true });
const config = loadConfig();
const LINES = [
  'Hiya, are you open on Sunday evening?',
  'Oh lovely. Could I book a table for four on Sunday at seven, please?',
  "It's Sarah Collins. My number is oh seven seven double oh, nine double oh, one two three.",
  "Yes, that's perfect, thank you.",
  "No, that's everything. Thanks, bye!",
];
const GAPS = [8, 11, 12, 12, 10, 8]; // seconds of silence before each line, and after the last

async function lineAudio(line: string, i: number): Promise<Int16Array> {
  const path = `spike-output/tts/${createHash('sha1').update(`v2:${line}`).digest('hex').slice(0, 12)}.pcm`;
  if (existsSync(path)) {
    const b = readFileSync(path);
    return new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2).slice();
  }
  return speak(config.ttsModel, line, i % 2 ? 'Leda' : 'Puck', config.geminiApiKey);
}

const parts: Int16Array[] = [];
for (let i = 0; i < LINES.length; i++) {
  parts.push(new Int16Array(24000 * GAPS[i]));
  parts.push(await lineAudio(LINES[i], i));
}
parts.push(new Int16Array(24000 * GAPS[LINES.length]));
const wav = join(OUT, 'caller.wav');
writeFileSync(wav, wavFromPcm16(concatPcm16(parts), 24000));

const dir = join(tmpdir(), `va-e2e-${Date.now()}`);
const app = await startServer({ ...config, port: 0, pgliteDir: dir, databaseUrl: undefined, consolePassword: undefined }, { web: 'dev' });
const base = `http://localhost:${app.port}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${wav}%noloop`,
    '--autoplay-policy=no-user-gesture-required',
  ],
});
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}/demo/admin`);
  await page.waitForSelector('.tenant-card');
  await page.screenshot({ path: join(OUT, '1-console.png') });
  await page.goto(`${base}/demo/admin/board/lucas-trattoria?phone=07700900123`);
  await page.waitForSelector('.slot');
  await page.screenshot({ path: join(OUT, '2-board-idle.png') });

  const started = Date.now();
  await page.click('#talk');
  await page.waitForSelector('.bubble.agent', { timeout: 20000 });
  console.log(`greeting on screen after ${Date.now() - started} ms`);
  await page.waitForFunction(() => [...document.querySelectorAll('.bubble.caller')].some((b) => /sunday/i.test(b.textContent ?? '')), null, { timeout: 40000 });
  await page.waitForSelector('.card', { timeout: 60000 });
  await page.screenshot({ path: join(OUT, '3-board-mid-call.png') });
  // Let the scripted caller finish (or the agent hang up).
  await page.waitForFunction(() => /Call ended/.test(document.getElementById('call-text')?.textContent ?? ''), null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1500);
  console.log('reply times on screen:', (await page.textContent('.replies'))?.replace(/\s+/g, ' '));
  await page.screenshot({ path: join(OUT, '4-board-after-call.png'), fullPage: true });
  const transcript = await page.$$eval('#stream > *', (els) => els.map((e) => e.textContent?.replace(/\s+/g, ' ').trim()));
  writeFileSync(join(OUT, 'transcript.txt'), transcript.join('\n'));
  console.log(transcript.join('\n'));
  if (errors.length) {
    console.log('page errors:', errors);
    failed = true;
  }
  const calls = await app.repo.listCalls((await app.repo.getTenant('lucas-trattoria'))!.id);
  console.log('call row:', JSON.stringify({ outcome: calls[0]?.outcome, model: calls[0]?.model, flags: calls[0]?.guardrail_flags, latency: calls[0]?.latency, usage: calls[0]?.usage }));
} catch (err) {
  failed = true;
  console.error('E2E failed:', (err as Error).message);
} finally {
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
