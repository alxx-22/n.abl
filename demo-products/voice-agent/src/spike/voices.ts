// Voice samples for choosing each tenant's voice (decision D11).
//
//   npm run spike:voices
//
// Writes spike-output/voices/<voice>.wav: the Luca's greeting spoken by the
// Live model itself, so it is exactly what a caller would hear.

import { mkdirSync, writeFileSync } from 'node:fs';
import { LiveSession } from '../core/live.ts';
import { concatPcm16, wavFromPcm16 } from '../core/audio.ts';

const KEY = process.env.GEMINI_API_KEY ?? '';
const MODEL = process.env.LIVE_MODEL_PRIMARY || 'gemini-3.1-flash-live-preview';
const VOICES = (process.argv[2] ?? 'Kore,Leda,Aoede,Sulafat,Charon,Puck,Orus,Achird').split(',');
const LINE =
  "Hello, Luca's Trattoria. I'm the AI assistant, and this is a demo line. How can I help? " +
  "We've got a table for four at half seven on Friday, if that suits.";

mkdirSync('spike-output/voices', { recursive: true });
for (const voice of VOICES) {
  try {
    const s = await LiveSession.connect(
      {
        model: MODEL,
        voiceName: voice,
        languageCode: 'en-GB',
        systemInstruction: 'You are a warm, natural British restaurant receptionist. When asked, say the given line exactly, with no additions.',
      },
      KEY,
    );
    const chunks: Int16Array[] = [];
    await new Promise<void>((resolve) => {
      const done = setTimeout(resolve, 20000);
      s.on('audio', (p) => chunks.push(p));
      s.on('turnComplete', () => {
        clearTimeout(done);
        resolve();
      });
      s.sendText(`Say exactly: "${LINE}"`);
    });
    s.close();
    writeFileSync(`spike-output/voices/${voice}.wav`, wavFromPcm16(concatPcm16(chunks), 24000));
    console.log(`${voice}: ${(concatPcm16(chunks).length / 24000).toFixed(1)} s`);
  } catch (e) {
    console.log(`${voice}: ${(e as Error).message}`);
  }
}
