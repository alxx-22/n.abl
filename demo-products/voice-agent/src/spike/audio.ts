// Phase 0 spike: the Live models with real, phone-quality audio.
//
//   npm run spike:audio                      all conversational models
//   npm run spike:audio -- gemini-3.8-live   one model
//
// 1. Which setup fields each model accepts (resumption, compression, VAD
//    tuning, a named voice, en-GB, transcription).
// 2. A five-turn call: caller lines are spoken by the TTS model, squeezed
//    through 8 kHz μ-law like a real phone line, and streamed in real time.
//    Measured per turn: end of caller speech → first agent audio, tool calls,
//    what the model heard (input transcription) and tokens used.
//
// Results are written to spike-output/ as JSON, and summarised by hand in
// docs/spike-results.md.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { throughPhoneLine, wavFromPcm16, concatPcm16 } from '../core/audio.ts';
import { speak } from '../core/gemini.ts';
import { LiveSession, type LiveSetup, type FunctionDeclaration } from '../core/live.ts';

const KEY = process.env.GEMINI_API_KEY ?? '';
if (!KEY) throw new Error('GEMINI_API_KEY is not set');
const OUT = 'spike-output';
mkdirSync(`${OUT}/tts`, { recursive: true });

const TTS_MODELS = ['gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts'];

const CALLER_LINES = [
  'Hiya, are you open on Sunday evening?',
  'Oh lovely. Could I book a table for four on Sunday at seven, please?',
  "It's Sarah Collins. My number is oh seven seven double oh, nine double oh, one two three.",
  "Yes, that's perfect, thank you.",
  "No, that's everything. Thanks, bye!",
];

// A representative prompt: about the size the compiled tenant prompt will be,
// so the token counts mean something.
const SYSTEM = `You are the phone receptionist for Luca's Trattoria, an Italian restaurant in Nottingham.
You are an AI assistant and this is a demo line; say so in your first sentence.
Today is Tuesday 29 September 2026. The next seven days: Wed 30 Sep, Thu 1 Oct, Fri 2 Oct, Sat 3 Oct, Sun 4 Oct, Mon 5 Oct, Tue 6 Oct.
Speak British English. Keep every reply to one or two short sentences and ask one question at a time.
Say times the way people say them ("half seven"), never "nineteen thirty".
Hard rules: never say a booking is confirmed unless create_booking returned a reference. Never invent prices,
times or dishes: use the tools. If you need to look something up, say a very short holding phrase first.
Read back the date, time, party size and name before booking.
Core facts: 18 Bridlesmith Walk, Nottingham NG1. Open Tuesday to Sunday, closed Mondays.
Lunch 12 till half two, dinner half five till ten (Sunday dinner 5 till 9). Parking at Broad Marsh car park, 4 minutes' walk.
Step-free access and an accessible toilet. Dogs welcome in the bar area. Children welcome, high chairs available.`;

const TOOLS: FunctionDeclaration[] = [
  {
    name: 'get_opening_hours',
    description: 'Opening hours for a date (YYYY-MM-DD), or the whole week if no date.',
    parameters: { type: 'OBJECT', properties: { date: { type: 'STRING' } } },
  },
  {
    name: 'check_availability',
    description: 'Check whether a table is free. Returns alternatives if not.',
    parameters: {
      type: 'OBJECT',
      properties: { date: { type: 'STRING' }, time: { type: 'STRING' }, party_size: { type: 'INTEGER' } },
      required: ['date', 'party_size'],
    },
  },
  {
    name: 'create_booking',
    description: 'Book a table. Only after reading the details back and the caller agreeing. Returns a reference.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date: { type: 'STRING' }, time: { type: 'STRING' }, party_size: { type: 'INTEGER' },
        name: { type: 'STRING' }, phone: { type: 'STRING' }, notes: { type: 'STRING' },
      },
      required: ['date', 'time', 'party_size', 'name'],
    },
  },
  {
    name: 'end_call',
    description: 'Hang up after saying goodbye.',
    parameters: { type: 'OBJECT', properties: { outcome: { type: 'STRING' } } },
  },
];

function toolAnswer(name: string, args: Record<string, unknown>): Record<string, unknown> {
  switch (name) {
    case 'get_opening_hours':
      return { date: args.date ?? 'week', hours: 'Sunday 4 October: lunch 12:00-14:30, dinner 17:00-21:00' };
    case 'check_availability':
      return { available: true, date: args.date, time: args.time ?? '19:00', party_size: args.party_size, table: 'Table 4' };
    case 'create_booking':
      return { booked: true, reference: 'HK482', spoken_reference: 'H K four eight two', ...args };
    default:
      return { ok: true };
  }
}

async function callerAudio(line: string, i: number): Promise<Int16Array> {
  const path = `${OUT}/tts/${createHash('sha1').update(`v2:${line}`).digest('hex').slice(0, 12)}.pcm`;
  if (existsSync(path)) {
    const b = readFileSync(path);
    return new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2).slice();
  }
  let last: Error | undefined;
  for (const model of TTS_MODELS) {
    try {
      const voice = i % 2 ? 'Leda' : 'Puck';
      const pcm = await speak(model, line, voice, KEY);
      writeFileSync(path, Buffer.from(pcm.buffer));
      return pcm;
    } catch (e) {
      last = e as Error;
      console.error(`tts ${model}: ${last.message.slice(0, 160)}`);
    }
  }
  throw last!;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** TTS clips carry up to a second of silence at each end; measured latency must start when speech stops. */
function trimSilence(pcm: Int16Array, rate: number): Int16Array {
  const win = Math.round(rate / 100);
  const loud = (i: number) => {
    let sum = 0;
    for (let k = i; k < Math.min(i + win, pcm.length); k++) sum += pcm[k] * pcm[k];
    return Math.sqrt(sum / win) > 300;
  };
  let a = 0;
  while (a < pcm.length && !loud(a)) a += win;
  let b = pcm.length - win;
  while (b > a && !loud(b)) b -= win;
  return pcm.slice(Math.max(0, a - win * 5), Math.min(pcm.length, b + win * 3));
}

async function fieldCheck(model: string): Promise<Record<string, string>> {
  const base: LiveSetup = { model, systemInstruction: 'Say hello.', thinkingLevel: model.includes('extended') ? 'low' : undefined };
  const variants: Record<string, Partial<LiveSetup>> = {
    transcription: { transcribeInput: true, transcribeOutput: true },
    voice_Kore: { voiceName: 'Kore' },
    language_en_GB: { languageCode: 'en-GB' },
    vad_tuning: { vad: { silenceDurationMs: 600, prefixPaddingMs: 200, endSensitivity: 'END_SENSITIVITY_LOW' } },
    resumption: { resumption: {} },
    compression: { compression: true },
  };
  const out: Record<string, string> = {};
  for (const [name, extra] of Object.entries(variants)) {
    try {
      const s = await LiveSession.connect({ ...base, ...extra }, KEY);
      s.close();
      out[name] = 'accepted';
    } catch (e) {
      out[name] = `rejected: ${(e as Error).message.slice(0, 160)}`;
    }
  }
  return out;
}

interface TurnResult {
  caller: string;
  heard: string;
  agent: string;
  speech_ms: number;
  first_audio_after_speech_end_ms: number | null;
  tool_calls: { name: string; args: unknown; at_ms: number }[];
  usage: unknown[];
}

async function conversation(model: string, lines: Int16Array[]): Promise<Record<string, unknown>> {
  const setup: LiveSetup = {
    model,
    systemInstruction: SYSTEM,
    tools: TOOLS,
    voiceName: 'Kore',
    transcribeInput: true,
    transcribeOutput: true,
    thinkingLevel: model.includes('extended') ? 'low' : undefined,
  };
  const t0 = Date.now();
  const s = await LiveSession.connect(setup, KEY);
  const setupMs = Date.now() - t0;
  const incidents: string[] = [];
  s.on('close', (code, reason) => incidents.push(`close ${code} ${reason} at ${Date.now() - t0} ms`));
  s.on('error', (err) => incidents.push(`error ${err.message} at ${Date.now() - t0} ms`));
  s.on('goAway', (left) => incidents.push(`goAway ${left} at ${Date.now() - t0} ms`));

  let agentText = '';
  let heard = '';
  let firstAudioAt: number | null = null;
  let turnDone = false;
  let completeAt = 0;
  let lastAudioAt = 0;
  let lastToolAt = 0;
  let calls: TurnResult['tool_calls'] = [];
  let usage: unknown[] = [];
  const agentAudio: Int16Array[] = [];
  let turnStart = Date.now();

  s.on('audio', (pcm) => {
    agentAudio.push(pcm);
    lastAudioAt = Date.now();
    if (firstAudioAt === null) firstAudioAt = lastAudioAt;
  });
  s.on('outputTranscript', (t) => (agentText += t));
  s.on('inputTranscript', (t) => (heard += t));
  s.on('usage', (u) => usage.push(u));
  // A turn is over when turnComplete has arrived, nothing has happened for
  // 1.2 s since, and no tool answer is still waiting to be spoken. (A tool
  // call ends a turn of its own, and the spoken answer follows in the next.)
  s.on('turnComplete', () => (completeAt = Date.now()));
  const poll = setInterval(() => {
    const now = Date.now();
    if (completeAt && completeAt >= Math.max(lastAudioAt, lastToolAt) && now - completeAt > 1200 && lastToolAt <= lastAudioAt) {
      turnDone = true;
    }
  }, 50);
  s.on('toolCall', (cs) => {
    lastToolAt = Date.now();
    for (const c of cs) calls.push({ name: c.name, args: c.args, at_ms: Date.now() - turnStart });
    s.sendToolResponses(cs.map((c) => ({ id: c.id, name: c.name, response: toolAnswer(c.name, c.args) })));
  });

  // Greeting
  const g0 = Date.now();
  s.sendText('[The phone has just been answered. Greet the caller.]');
  while (!turnDone && Date.now() - g0 < 20000) await sleep(20);
  const greeting = {
    first_audio_ms: firstAudioAt ? firstAudioAt - g0 : null,
    said: agentText.trim(),
    usage,
  };

  const turns: TurnResult[] = [];
  const FRAME = 320; // 20 ms at 16 kHz
  const silence = new Int16Array(FRAME);
  for (let i = 0; i < lines.length; i++) {
    agentText = '';
    heard = '';
    firstAudioAt = null;
    turnDone = false;
    completeAt = 0;
    calls = [];
    usage = [];
    const pcm = lines[i];
    turnStart = Date.now();
    // Stream the caller in real time, as a phone line would.
    let sent = 0;
    const start = Date.now();
    for (let off = 0; off < pcm.length; off += FRAME) {
      s.sendAudio(pcm.subarray(off, Math.min(off + FRAME, pcm.length)), 16000);
      sent++;
      const due = start + sent * 20;
      const wait = due - Date.now();
      if (wait > 0) await sleep(wait);
    }
    const speechEnd = Date.now();
    firstAudioAt = null; // anything before the caller finished is barge-over, not a reply
    // Keep the line open with silence until the agent finishes its turn.
    let n = 0;
    while (!turnDone && Date.now() - speechEnd < 25000) {
      s.sendAudio(silence, 16000);
      n++;
      const due = speechEnd + n * 20;
      const wait = due - Date.now();
      if (wait > 0) await sleep(wait);
    }
    // A little more silence so the next line does not collide with trailing audio.
    for (let k = 0; k < 25; k++) {
      s.sendAudio(silence, 16000);
      await sleep(20);
    }
    turns.push({
      caller: CALLER_LINES[i],
      heard: heard.trim(),
      agent: agentText.trim(),
      speech_ms: Math.round((pcm.length / 16000) * 1000),
      first_audio_after_speech_end_ms: firstAudioAt ? (firstAudioAt as number) - speechEnd : null,
      tool_calls: calls,
      usage,
    });
    console.log(`  ${model} turn ${i + 1}: ${turns[i].first_audio_after_speech_end_ms} ms | heard "${turns[i].heard}" | said "${turns[i].agent.slice(0, 80)}"`);
  }
  clearInterval(poll);
  s.close();
  const total = Date.now() - t0;
  writeFileSync(`${OUT}/agent-${model}.wav`, wavFromPcm16(concatPcm16(agentAudio), 24000));
  if (incidents.length) console.log('  incidents:', incidents);
  return { model, setup_ms: setupMs, call_ms: total, greeting, turns, incidents };
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const skipFields = process.argv.includes('--no-fields');
  const models = args.length
    ? args
    : ['gemini-3.8-live', 'gemini-3.1-flash-live-preview', 'gemini-3.8-live-extended-thinking', 'gemini-2.5-flash-native-audio-latest'];

  console.log('Generating caller audio…');
  const lines: Int16Array[] = [];
  for (let i = 0; i < CALLER_LINES.length; i++) lines.push(trimSilence(throughPhoneLine(await callerAudio(CALLER_LINES[i], i), 24000), 16000));

  const results: Record<string, unknown>[] = [];
  for (const model of models) {
    console.log(`\n${model}`);
    const fields = skipFields ? {} : await fieldCheck(model);
    if (!skipFields) console.log('  fields', fields);
    let convo: Record<string, unknown> | { error: string };
    try {
      convo = await conversation(model, lines);
    } catch (e) {
      convo = { error: (e as Error).message };
      console.log('  conversation failed:', (e as Error).message);
    }
    results.push({ model, fields, ...convo });
    writeFileSync(`${OUT}/spike-audio${process.env.SPIKE_TAG ? `-${process.env.SPIKE_TAG}` : ''}.json`, JSON.stringify(results, null, 1));
  }
  console.log(`\nWritten ${OUT}/spike-audio.json`);
}

await main();
