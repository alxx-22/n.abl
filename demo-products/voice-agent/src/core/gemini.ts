// Non-live Gemini calls: text generation (summaries, extraction, judging) and
// text-to-speech (evaluation fixtures). Plain fetch, no SDK.
//
// In the build sandbox, Node's fetch only uses the egress proxy when started
// with NODE_USE_ENV_PROXY=1. Production has no proxy and needs nothing.

import { base64ToPcm16 } from './audio.ts';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function post(model: string, body: unknown, apiKey: string, timeoutMs = 60000): Promise<any> {
  const res = await fetch(`${BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) throw new GeminiHttpError(res.status, `${model} ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

export interface GenerateOptions {
  system?: string;
  /** A JSON schema (OpenAPI subset) for structured output. */
  schema?: Record<string, unknown>;
  temperature?: number;
  thinkingLevel?: string;
}

export async function generateText(
  model: string,
  prompt: string | { text?: string; inlineData?: { mimeType: string; data: string } }[],
  apiKey: string,
  opts: GenerateOptions = {},
): Promise<string> {
  const parts = typeof prompt === 'string' ? [{ text: prompt }] : prompt;
  const generationConfig: Record<string, unknown> = {};
  if (opts.temperature !== undefined) generationConfig.temperature = opts.temperature;
  if (opts.schema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = opts.schema;
  }
  if (opts.thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel: opts.thinkingLevel };
  const body: Record<string, unknown> = { contents: [{ role: 'user', parts }], generationConfig };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
  const json = await post(model, body, apiKey, 120000);
  const out = (json.candidates?.[0]?.content?.parts ?? [])
    .filter((p: any) => typeof p.text === 'string' && !p.thought)
    .map((p: any) => p.text)
    .join('');
  if (!out) throw new Error(`${model} returned no text: ${JSON.stringify(json).slice(0, 300)}`);
  return out;
}

export async function generateJson<T>(
  model: string,
  prompt: Parameters<typeof generateText>[1],
  apiKey: string,
  schema: Record<string, unknown>,
  opts: Omit<GenerateOptions, 'schema'> = {},
): Promise<T> {
  const text = await generateText(model, prompt, apiKey, { ...opts, schema });
  return JSON.parse(text) as T;
}

/** Text to speech. Returns PCM16 at 24 kHz. */
export async function speak(model: string, text: string, voice: string, apiKey: string): Promise<Int16Array> {
  const json = await post(
    model,
    {
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    },
    apiKey,
  );
  const data = json.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data)?.inlineData?.data;
  if (!data) throw new Error(`${model} returned no audio: ${JSON.stringify(json).slice(0, 300)}`);
  return base64ToPcm16(data);
}
