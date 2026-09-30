// A thin client for the Gemini Live API (BidiGenerateContent over WebSocket).
//
// Deliberately not the @google/genai SDK. The SDK lags new Live models by
// weeks (3.8 Live Extended Thinking refuses to open without a thinking level
// the SDK did not yet expose on 29 September), and the protocol is small: one
// setup message, a stream of realtimeInput, tool responses back, and a stream
// of serverContent out. Owning it keeps every field visible.

import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { base64ToPcm16, pcm16ToBase64 } from './audio.ts';

const ENDPOINT =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface LiveSetup {
  model: string;
  systemInstruction?: string;
  tools?: FunctionDeclaration[];
  voiceName?: string;
  languageCode?: string;
  thinkingLevel?: string;
  responseModality?: 'AUDIO' | 'TEXT';
  transcribeInput?: boolean;
  transcribeOutput?: boolean;
  /** Voice activity detection tuning; omitted fields keep Google's defaults. */
  vad?: {
    /** Turn Google's detection off: the client marks each turn with activityStart and activityEnd. */
    disabled?: boolean;
    silenceDurationMs?: number;
    prefixPaddingMs?: number;
    startSensitivity?: 'START_SENSITIVITY_HIGH' | 'START_SENSITIVITY_LOW';
    endSensitivity?: 'END_SENSITIVITY_HIGH' | 'END_SENSITIVITY_LOW';
  };
  /** Ask for resumption handles (and resume from one, if given). */
  resumption?: { handle?: string } | false;
  /**
   * Sliding-window context compression. Every turn re-counts the whole
   * context against the tokens-per-minute quota, so a trigger well below the
   * model's context limit keeps long calls cheap.
   */
  compression?: boolean | { triggerTokens: number; targetTokens: number };
}

export interface FunctionCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface FunctionResponse {
  id: string;
  name: string;
  response: Record<string, unknown>;
}

export interface UsageMetadata {
  promptTokenCount?: number;
  responseTokenCount?: number;
  totalTokenCount?: number;
  thoughtsTokenCount?: number;
  [k: string]: unknown;
}

export interface LiveEvents {
  audio: [pcm24k: Int16Array];
  text: [text: string];
  inputTranscript: [text: string];
  outputTranscript: [text: string];
  interrupted: [];
  turnComplete: [];
  generationComplete: [];
  toolCall: [calls: FunctionCall[]];
  toolCallCancellation: [ids: string[]];
  usage: [usage: UsageMetadata];
  goAway: [timeLeft: string | undefined];
  resumption: [handle: string];
  close: [code: number, reason: string];
  error: [err: Error];
}

export class LiveError extends Error {
  readonly code: number | undefined;
  readonly model: string;
  constructor(message: string, model: string, code?: number) {
    super(message);
    this.model = model;
    this.code = code;
  }
}

function proxyAgent(): unknown {
  // Only this build sandbox needs a proxy. Production connects directly.
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxy) return undefined;
  return import('https-proxy-agent').then((m) => new m.HttpsProxyAgent(proxy));
}

export function buildSetupMessage(setup: LiveSetup): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = {
    responseModalities: [setup.responseModality ?? 'AUDIO'],
  };
  if (setup.voiceName || setup.languageCode) {
    const speechConfig: Record<string, unknown> = {};
    if (setup.voiceName) speechConfig.voiceConfig = { prebuiltVoiceConfig: { voiceName: setup.voiceName } };
    if (setup.languageCode) speechConfig.languageCode = setup.languageCode;
    generationConfig.speechConfig = speechConfig;
  }
  if (setup.thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel: setup.thinkingLevel };

  const msg: Record<string, unknown> = { model: `models/${setup.model}`, generationConfig };
  if (setup.systemInstruction) msg.systemInstruction = { parts: [{ text: setup.systemInstruction }] };
  if (setup.tools && setup.tools.length) msg.tools = [{ functionDeclarations: setup.tools }];
  if (setup.transcribeInput) msg.inputAudioTranscription = {};
  if (setup.transcribeOutput) msg.outputAudioTranscription = {};
  if (setup.vad) {
    const aad: Record<string, unknown> = {};
    if (setup.vad.silenceDurationMs !== undefined) aad.silenceDurationMs = setup.vad.silenceDurationMs;
    if (setup.vad.prefixPaddingMs !== undefined) aad.prefixPaddingMs = setup.vad.prefixPaddingMs;
    if (setup.vad.startSensitivity) aad.startOfSpeechSensitivity = setup.vad.startSensitivity;
    if (setup.vad.endSensitivity) aad.endOfSpeechSensitivity = setup.vad.endSensitivity;
    if (setup.vad.disabled) aad.disabled = true;
    msg.realtimeInputConfig = { automaticActivityDetection: aad };
  }
  if (setup.resumption) msg.sessionResumption = setup.resumption.handle ? { handle: setup.resumption.handle } : {};
  if (setup.compression === true) msg.contextWindowCompression = { slidingWindow: {} };
  else if (setup.compression) {
    msg.contextWindowCompression = {
      triggerTokens: String(setup.compression.triggerTokens),
      slidingWindow: { targetTokens: String(setup.compression.targetTokens) },
    };
  }
  return { setup: msg };
}

export class LiveSession extends EventEmitter<LiveEvents> {
  readonly model: string;
  private ws: WebSocket;
  private closed = false;

  private constructor(ws: WebSocket, model: string) {
    super();
    this.ws = ws;
    this.model = model;
    ws.on('message', (raw) => this.onMessage(raw as Buffer));
    ws.on('close', (code, reason) => {
      this.closed = true;
      this.emit('close', code, reason.toString());
    });
    ws.on('error', (err) => this.emit('error', err));
  }

  /** Open a session and resolve once the server has accepted the setup. */
  static async connect(setup: LiveSetup, apiKey: string, timeoutMs = 15000): Promise<LiveSession> {
    const agent = await proxyAgent();
    const ws = new WebSocket(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      agent: agent as never,
      handshakeTimeout: timeoutMs,
      maxPayload: 64 * 1024 * 1024,
    });
    return await new Promise<LiveSession>((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new LiveError(`setup timed out after ${timeoutMs} ms`, setup.model));
      }, timeoutMs);
      const fail = (err: Error) => {
        clearTimeout(timer);
        reject(err instanceof LiveError ? err : new LiveError(err.message, setup.model));
      };
      ws.once('error', fail);
      ws.once('close', (code, reason) => fail(new LiveError(`closed before setup: ${code} ${reason}`, setup.model, code)));
      ws.once('open', () => ws.send(JSON.stringify(buildSetupMessage(setup))));
      ws.once('message', (raw) => {
        clearTimeout(timer);
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          ws.terminate();
          return reject(new LiveError('unparseable setup reply', setup.model));
        }
        if (!('setupComplete' in msg)) {
          ws.terminate();
          return reject(new LiveError(`unexpected setup reply: ${JSON.stringify(msg).slice(0, 200)}`, setup.model));
        }
        ws.removeAllListeners('error');
        ws.removeAllListeners('close');
        resolve(new LiveSession(ws, setup.model));
      });
    });
  }

  get isOpen(): boolean {
    return !this.closed && this.ws.readyState === WebSocket.OPEN;
  }

  private send(obj: unknown): void {
    if (this.isOpen) this.ws.send(JSON.stringify(obj));
  }

  sendAudio(pcm: Int16Array, rate = 16000): void {
    this.send({ realtimeInput: { audio: { data: pcm16ToBase64(pcm), mimeType: `audio/pcm;rate=${rate}` } } });
  }

  /** Manual turn-taking: the caller has started speaking (interrupts the model if it is talking). */
  sendActivityStart(): void {
    this.send({ realtimeInput: { activityStart: {} } });
  }

  /** Manual turn-taking: the caller's turn is over; the model replies. */
  sendActivityEnd(): void {
    this.send({ realtimeInput: { activityEnd: {} } });
  }

  /** Tell the server the audio stream has paused (flushes any cached audio). */
  sendAudioStreamEnd(): void {
    this.send({ realtimeInput: { audioStreamEnd: true } });
  }

  sendText(text: string): void {
    this.send({ realtimeInput: { text } });
  }

  sendToolResponses(responses: FunctionResponse[]): void {
    this.send({ toolResponse: { functionResponses: responses } });
  }

  close(): void {
    if (!this.closed) {
      this.closed = true;
      try {
        this.ws.close(1000, 'done');
      } catch {
        this.ws.terminate();
      }
    }
  }

  private onMessage(raw: Buffer): void {
    let msg: Record<string, any>;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const sc = msg.serverContent;
    if (sc) {
      if (sc.interrupted) this.emit('interrupted');
      const parts = sc.modelTurn?.parts ?? [];
      for (const p of parts) {
        if (p.inlineData?.data && String(p.inlineData.mimeType ?? '').startsWith('audio/')) {
          this.emit('audio', base64ToPcm16(p.inlineData.data));
        } else if (typeof p.text === 'string' && !p.thought) {
          this.emit('text', p.text);
        }
      }
      if (sc.inputTranscription?.text) this.emit('inputTranscript', sc.inputTranscription.text);
      if (sc.outputTranscription?.text) this.emit('outputTranscript', sc.outputTranscription.text);
      if (sc.generationComplete) this.emit('generationComplete');
      if (sc.turnComplete) this.emit('turnComplete');
    }
    if (msg.toolCall?.functionCalls) {
      const calls: FunctionCall[] = msg.toolCall.functionCalls.map((c: any) => ({
        id: c.id,
        name: c.name,
        args: c.args ?? {},
      }));
      this.emit('toolCall', calls);
    }
    if (msg.toolCallCancellation?.ids) this.emit('toolCallCancellation', msg.toolCallCancellation.ids);
    if (msg.usageMetadata) this.emit('usage', msg.usageMetadata);
    if (msg.goAway) this.emit('goAway', msg.goAway.timeLeft);
    if (msg.sessionResumptionUpdate?.resumable && msg.sessionResumptionUpdate.newHandle) {
      this.emit('resumption', msg.sessionResumptionUpdate.newHandle);
    }
  }
}

/**
 * Try each model in turn until one opens. Quota and availability errors on the
 * primary fall through to the next model before the caller hears anything.
 */
export async function connectWithFallback(
  models: string[],
  setupFor: (model: string) => LiveSetup,
  apiKey: string,
  onFallback?: (model: string, err: Error) => void,
): Promise<LiveSession> {
  let last: Error | undefined;
  for (const model of models) {
    try {
      return await LiveSession.connect(setupFor(model), apiKey);
    } catch (err) {
      last = err as Error;
      onFallback?.(model, last);
    }
  }
  throw last ?? new Error('no Live models configured');
}
