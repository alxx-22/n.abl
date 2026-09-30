// Every setting, read once from the environment. See .env.example.

import { randomBytes } from 'node:crypto';
import { parseDemoCards, type DemoCard } from './domain/payments.ts';

/** The jobs that call Gemini. Each can have its own key (and so its own project and quota). */
export type GeminiJob = 'calls' | 'scout' | 'text';

export interface Config {
  /** The main key: every job uses it unless it has its own. */
  geminiApiKey: string;
  /**
   * A key per job: GEMINI_API_KEY_CALLS (live calls, voice previews, the
   * turn-taking listener), GEMINI_API_KEY_SCOUT (reading prospects' websites),
   * GEMINI_API_KEY_TEXT (summaries, menu and FAQ drafts). Each falls back to
   * GEMINI_API_KEY, so one key is enough until a job needs its own quota.
   */
  keys: Record<GeminiJob, string>;
  /** Primary first; the rest are fallbacks, tried in order if a session will not open. */
  liveModels: string[];
  /** Tried in order; see generateText(). */
  textModel: string[];
  callerModel: string;
  ttsModel: string;
  /** The parallel listener that gives the turn manager the caller's words; '' turns it off. */
  transcribeModel: string;
  databaseUrl: string | undefined;
  pgliteDir: string;
  port: number;
  publicBaseUrl: string | undefined;
  consolePassword: string | undefined;
  sessionSecret: string;
  /** Shared with the site's Worker: its X-Nabl-Client-Ip header is believed only with this beside it. */
  demoProxySecret: string | undefined;
  demoCards: DemoCard[];
  maxCallSeconds: number;
  vadSilenceMs: number;
  compressAt: number;
  compressTo: number;
  summaries: boolean;
  twilio:
    | { accountSid: string; authToken: string; apiKey?: string; apiSecret?: string; smsFrom?: string }
    | undefined;
}

function list(v: string | undefined, fallback: string[]): string[] {
  const out = (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return out.length ? out : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // 3 Flash Live first: it behaved identically in every spike run, where 3.8
  // Live was faster at its best but went silent once. docs/spike-results.md.
  const primary = env.LIVE_MODEL_PRIMARY?.trim() || 'gemini-3.1-flash-live-preview';
  const fallbacks = list(env.LIVE_MODEL_FALLBACKS, ['gemini-3.8-live']);
  const sid = env.TWILIO_ACCOUNT_SID?.trim();
  const token = env.TWILIO_AUTH_TOKEN?.trim();
  return {
    geminiApiKey: env.GEMINI_API_KEY ?? '',
    keys: {
      calls: env.GEMINI_API_KEY_CALLS?.trim() || env.GEMINI_API_KEY || '',
      scout: env.GEMINI_API_KEY_SCOUT?.trim() || env.GEMINI_API_KEY || '',
      text: env.GEMINI_API_KEY_TEXT?.trim() || env.GEMINI_API_KEY || '',
    },
    liveModels: [primary, ...fallbacks.filter((m) => m !== primary)],
    textModel: list(env.TEXT_MODELS ?? env.TEXT_MODEL, ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash']),
    // The simulated caller in evaluation runs on the other model's quota, so test
    // calls never use up the receptionist's 65K tokens a minute.
    callerModel: env.CALLER_MODEL?.trim() || 'gemini-3.8-live',
    ttsModel: env.TTS_MODEL?.trim() || 'gemini-2.5-flash-preview-tts',
    transcribeModel: env.TRANSCRIBE_MODEL === undefined ? 'gemini-3.5-transcribe-live' : env.TRANSCRIBE_MODEL.trim() === 'off' ? '' : env.TRANSCRIBE_MODEL.trim(),
    databaseUrl: env.DATABASE_URL?.trim() || undefined,
    pgliteDir: env.PGLITE_DIR?.trim() || '.data/pglite',
    port: Number(env.PORT ?? 8787),
    publicBaseUrl: env.PUBLIC_BASE_URL?.trim().replace(/\/$/, '') || undefined,
    consolePassword: env.CONSOLE_PASSWORD?.trim() || undefined,
    sessionSecret: env.SESSION_SECRET?.trim() || randomBytes(32).toString('hex'),
    demoProxySecret: env.DEMO_PROXY_SECRET?.trim() || undefined,
    demoCards: parseDemoCards(env.DEMO_CARDS),
    maxCallSeconds: Number(env.MAX_CALL_SECONDS ?? 720),
    vadSilenceMs: Number(env.VAD_SILENCE_MS ?? 600),
    compressAt: Number(env.COMPRESS_AT_TOKENS ?? 12000),
    compressTo: Number(env.COMPRESS_TO_TOKENS ?? 7000),
    summaries: env.CALL_SUMMARIES !== 'off',
    twilio: sid && token
      ? {
          accountSid: sid,
          authToken: token,
          apiKey: env.TWILIO_API_KEY?.trim() || undefined,
          apiSecret: env.TWILIO_API_SECRET?.trim() || undefined,
          smsFrom: env.TWILIO_SMS_FROM?.trim() || undefined,
        }
      : undefined,
  };
}
