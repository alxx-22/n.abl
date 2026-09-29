// "Hear this voice": the business's greeting spoken by the Live model itself,
// in the chosen voice, so the preview is exactly what a caller would hear.
// One at a time, cached, because each preview is a Live session on the
// free-tier quota.

import type { Config } from '../config.ts';
import { connectWithFallback } from './live.ts';
import { concatPcm16, wavFromPcm16 } from './audio.ts';

const cache = new Map<string, Buffer>();
let queue: Promise<unknown> = Promise.resolve();

export function previewVoice(voice: string, text: string, config: Config, languageCode = 'en-GB'): Promise<Buffer> {
  const key = `${voice}|${languageCode}|${text}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const job = queue.then(async () => {
    const again = cache.get(key);
    if (again) return again;
    const s = await connectWithFallback(
      config.liveModels,
      (model) => ({
        model,
        voiceName: voice,
        languageCode,
        systemInstruction: 'You are a warm, natural receptionist answering the phone. When asked, say the given line exactly, with nothing added.',
      }),
      config.geminiApiKey,
    );
    const chunks: Int16Array[] = [];
    try {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => (chunks.length ? resolve() : reject(new Error('The voice model did not answer.'))), 20000);
        s.on('audio', (p) => chunks.push(p));
        s.on('turnComplete', () => {
          clearTimeout(t);
          resolve();
        });
        s.sendText(`Say exactly: "${text}"`);
      });
    } finally {
      s.close();
    }
    const wav = wavFromPcm16(concatPcm16(chunks), 24000);
    if (cache.size > 60) cache.delete(cache.keys().next().value as string);
    cache.set(key, wav);
    return wav;
  });
  queue = job.catch(() => {});
  return job;
}
