// One phone call: a Gemini Live session, the tools, the transcript and the
// guardrails, independent of how the audio arrives.
//
// The phone (Twilio), the browser and the evaluation harness all drive this
// same class. They hand it caller audio (PCM16) and take back agent audio
// (PCM16, 24 kHz), a "clear" when the caller barges in, and a "hangup" when
// the agent has said goodbye.

import { EventEmitter } from 'node:events';
import type { Config } from '../config.ts';
import type { Repo } from '../db/repo.ts';
import type { Tenant } from '../domain/types.ts';
import { LiveSession, connectWithFallback, type FunctionCall, type LiveSetup, type UsageMetadata } from './live.ts';
import { compilePrompt } from './prompt.ts';
import {
  loggableArgs, newCallState, runTool, toolDeclarations, type Action, type CallState, type SmsSender, type Telephony,
  type ToolContext,
} from './tools.ts';
import { checkUtterance, type Flag } from './guardrails.ts';
import { redactCardNumbers } from './redact.ts';
import { rms } from './audio.ts';
import { generateText } from './gemini.ts';
import { REPLY_SPEEDS } from '../domain/voices.ts';
import { SPEED_SCALE, TurnManager, type TurnStatus } from './turns.ts';
import { CallerListener } from './listener.ts';

export type Channel = 'phone' | 'browser' | 'eval';

export interface TranscriptLine {
  role: 'caller' | 'agent';
  text: string;
  final: boolean;
}

export interface BoardEvent {
  type: 'call_started' | 'transcript' | 'action' | 'flag' | 'call_ended' | 'refresh' | 'turn';
  tenant_id: string;
  call_id: string;
  at: string;
  [k: string]: unknown;
}

export interface CallEvents {
  audio: [pcm24k: Int16Array];
  clear: [];
  transcript: [line: TranscriptLine];
  action: [action: Action];
  flag: [flag: Flag];
  agentTurn: [text: string];
  hangup: [reason: string];
  /** How long the caller waited for the start of a reply, from the end of their speech. */
  latency: [ms: number, extraMs: number];
  /** Contextual turn-taking: listening, waiting for the caller to go on, on hold... */
  turn: [status: TurnStatus];
  /** The agent finished a turn: channels flush any part-filled audio frame. */
  turnFlush: [];
  ended: [summary: CallSummary];
}

export interface CallSummary {
  call_id: string;
  outcome: string;
  model: string;
  duration_s: number;
  flags: Flag[];
  tokens: number;
  latency_ms: number[];
  transcript: { role: string; text: string }[];
  tools: { name: string; args: unknown; result: unknown }[];
}

export interface CallOptions {
  tenant: Tenant;
  repo: Repo;
  config: Config;
  channel: Channel;
  callerPhone?: string | null;
  providerCallId?: string | null;
  toNumber?: string | null;
  sms: SmsSender;
  telephony?: Telephony | null;
  now?: () => Date;
  models?: string[];
  publish?: (e: BoardEvent) => void;
  /** Eval text mode: no silence prompts, no audio-based timing. */
  textMode?: boolean;
  /** Instead of the greeting, e.g. after an unanswered transfer. */
  openingCue?: string;
}

const SPEECH_RMS = 700;

/**
 * If the caller has spoken and the model shows no sign of life (no
 * transcription, audio, tool call or turn) for this long, the session is
 * treated as dead and replaced. On the free tier a session occasionally stops
 * responding without closing: 3.8 Live did in the spike, and on 29 September
 * 3 Flash Live stopped hearing audio altogether (it still answered text)
 * after a day of heavy testing, while 3.8 Live heard the same audio at once.
 * Resuming the same model brings back the same problem, so recovery hands
 * the call to the next model, with the transcript so far.
 */
const WATCHDOG_MS = 7000;

/** After these, the receptionist reads back something that matters: harder to interrupt by accident. */
const READ_BACK_TOOLS = new Set(['review_order', 'confirm_order', 'create_booking', 'modify_booking', 'cancel_booking', 'take_demo_payment']);
const MAX_RECOVERIES = 2;
/**
 * With contextual turn-taking the server knows the moment a turn ended, and a
 * working model transcribes it within about 0.4 s (spike, 30 September), so
 * four seconds of nothing means it is not listening.
 */
const CONTEXTUAL_WATCHDOG_MS = 4000;

const CORRECTIONS: Record<Flag['rule'], string> = {
  unconfirmed_claim:
    '[Correction from the system: nothing has been booked or ordered yet. No create_booking, modify_booking or confirm_order has succeeded in this call. Tell the caller you just need to finalise it, read the details back, and call the tool now. Only then give the reference.]',
  unpaid_claim:
    '[Correction from the system: no payment has gone through in this call. Tell the caller, and take it with take_demo_payment if they want to pay.]',
  said_safe_for_allergy:
    '[Correction from the system: never say a dish is safe for an allergy. Correct yourself now, using the allergen wording from get_item_details, including its caveat.]',
};

export class CallSession extends EventEmitter<CallEvents> {
  readonly opts: CallOptions;
  readonly state: CallState = newCallState();
  callId = '';
  model = '';
  private session: LiveSession | null = null;
  private resumeHandle: string | undefined;
  private fallbacks: { model: string; error: string }[] = [];
  private callerBuf = '';
  private agentBuf = '';
  private transcript: { role: string; text: string }[] = [];
  private flags: Flag[] = [];
  private toolTrace: { name: string; args: unknown; result: unknown }[] = [];
  private usage = { total: 0, prompt_first: 0, prompt_max: 0, responses: 0 };
  private latencies: number[] = [];
  private startedAt = Date.now();
  private lastCallerSound = 0;
  private lastActivity = Date.now();
  private agentSpeakingUntil = 0;
  private awaitingReply = false;
  private lastModelSign = Date.now();
  private recoveries = 0;
  private recovering = false;
  private prompt = '';
  private silencePrompts = 0;
  private wrapUpSent = false;
  private timer: NodeJS.Timeout | null = null;
  private ended = false;
  private closing = false;
  private hangupTimer: NodeJS.Timeout | null = null;
  private toolQueue: Promise<void> = Promise.resolve();
  private turns: TurnManager | null = null;
  private listener: CallerListener | null = null;
  private turnTimer: NodeJS.Timeout | null = null;
  /** Contextual turn-taking: when the caller stopped talking, and how long past the usual pause we waited. */
  private replyFrom = 0;
  private replyExtra = 0;

  constructor(opts: CallOptions) {
    super();
    this.opts = opts;
  }

  private now(): Date {
    return this.opts.now ? this.opts.now() : new Date();
  }

  private publish(type: BoardEvent['type'], data: Record<string, unknown> = {}): void {
    this.opts.publish?.({ type, tenant_id: this.opts.tenant.id, call_id: this.callId, at: new Date().toISOString(), ...data });
  }

  private record(kind: string, data: unknown): void {
    this.opts.repo.addEvent(this.callId, this.opts.tenant.id, kind, data).catch(() => {});
  }

  /** Our server decides when the caller has finished (see turns.ts), unless the business chose Gemini's fixed pause. */
  private get contextual(): boolean {
    return !this.opts.textMode && this.opts.tenant.profile.turn_taking !== 'standard';
  }

  private setupFor(model: string, prompt: string): LiveSetup {
    const p = this.opts.tenant.profile;
    return {
      model,
      systemInstruction: prompt,
      tools: toolDeclarations(this.opts.tenant, { canTransfer: Boolean(this.opts.telephony) }),
      voiceName: p.voice || 'Kore',
      languageCode: p.language_code === null ? undefined : p.language_code || 'en-GB',
      transcribeInput: true,
      transcribeOutput: true,
      vad: this.contextual
        ? { disabled: true }
        : {
            silenceDurationMs: p.reply_speed && p.reply_speed !== 'normal' ? REPLY_SPEEDS[p.reply_speed].silence_ms : this.opts.config.vadSilenceMs,
            prefixPaddingMs: 200,
          },
      resumption: { handle: this.resumeHandle },
      compression: { triggerTokens: this.opts.config.compressAt, targetTokens: this.opts.config.compressTo },
    };
  }

  async start(): Promise<void> {
    const { tenant, repo, config } = this.opts;
    this.callId = await repo.createCall({
      tenant_id: tenant.id,
      channel: this.opts.channel,
      provider_call_id: this.opts.providerCallId ?? null,
      from_number: this.opts.callerPhone ?? null,
      to_number: this.opts.toNumber ?? null,
    });
    const known = this.opts.callerPhone ? await repo.findCustomer(tenant.id, this.opts.callerPhone) : null;
    const prompt = compilePrompt(tenant.profile, {
      now: this.now(),
      callerPhone: this.opts.callerPhone ?? null,
      knownCustomer: known,
      demoCards: config.demoCards,
      canTransfer: Boolean(this.opts.telephony && tenant.profile.handoff_number),
      channel: this.opts.channel,
    });
    this.prompt = prompt;
    if (this.contextual) this.startTurnTaking();
    const pinned = tenant.profile.live_model;
    const models = this.opts.models ?? (pinned ? [pinned, ...config.liveModels.filter((m) => m !== pinned)] : config.liveModels);
    this.session = await connectWithFallback(models, (m) => this.setupFor(m, prompt), config.keys.calls, (m, err) => {
      this.fallbacks.push({ model: m, error: err.message.slice(0, 200) });
    });
    this.model = this.session.model;
    if (this.ended) {
      // The caller hung up while the session was opening.
      this.session.close();
      return;
    }
    this.attach(this.session, prompt);
    await repo.updateCall(this.callId, { model: this.model, fallbacks: this.fallbacks });
    this.publish('call_started', { channel: this.opts.channel, model: this.model, caller: this.opts.callerPhone ? `…${this.opts.callerPhone.slice(-4)}` : null });
    this.record('system', { event: 'started', model: this.model, fallbacks: this.fallbacks });
    this.session.sendText(this.opts.openingCue ?? '[The call has just connected. Greet the caller now.]');
    this.awaitingReply = true;
    this.lastCallerSound = Date.now();
    if (!this.opts.textMode) this.timer = setInterval(() => this.tick(), 1000);
  }

  private startTurnTaking(): void {
    const p = this.opts.tenant.profile;
    const turns = new TurnManager(
      {
        now: () => Date.now(),
        startTurn: () => {
          this.awaitingReply = false;
          this.session?.sendActivityStart();
        },
        onReopen: (reason) => this.record('system', { event: 'turn_reopened', reason }),
        sendAudio: (pcm, rate) => this.session?.sendAudio(pcm, rate),
        endTurn: (e) => {
          this.session?.sendActivityEnd();
          // The watchdog times the model from here; the reply time runs from the caller's last sound.
          this.lastCallerSound = Date.now();
          this.replyFrom = e.lastVoiceAt;
          this.replyExtra = e.extraMs;
          this.awaitingReply = true;
          this.record('system', { event: 'turn_end', reason: e.reason, extra_ms: e.extraMs, expect: turns.expecting.expect });
        },
        agentSpeaking: () => Date.now() < this.agentSpeakingUntil,
        onStatus: (st) => {
          this.emit('turn', st);
          this.publish('turn', { ...st });
        },
        onVoice: () => {
          this.lastActivity = Date.now();
          this.silencePrompts = 0;
        },
      },
      { scale: SPEED_SCALE[p.reply_speed ?? 'normal'] },
    );
    this.turns = turns;
    this.turnTimer = setInterval(() => turns.tick(), 100);
    void CallerListener.open(this.opts.config, p.language_code ?? 'en-GB').then((l) => {
      if (!l) return this.record('system', { event: 'no_listener' });
      if (this.ended) return l.close();
      this.listener = l;
      turns.wordsAvailable = true;
      l.on('text', (t) => {
        this.record('system', { event: 'heard', text: redactCardNumbers(t, this.opts.config.demoCards).text });
        turns.callerWords(t);
      });
      l.on('closed', () => (turns.wordsAvailable = false));
    });
  }

  private attach(s: LiveSession, prompt: string): void {
    const sign = () => (this.lastModelSign = Date.now());
    for (const ev of ['audio', 'inputTranscript', 'outputTranscript', 'toolCall', 'turnComplete', 'usage'] as const) s.on(ev, sign);
    s.on('audio', (pcm) => {
      const now = Date.now();
      this.turns?.agentAudio();
      if (this.awaitingReply) {
        this.awaitingReply = false;
        const from = this.replyFrom || this.lastCallerSound;
        if (from) {
          this.latencies.push(now - from);
          this.emit('latency', now - from, this.replyFrom ? this.replyExtra : 0);
        }
        this.replyFrom = 0;
        this.replyExtra = 0;
      }
      this.lastActivity = now;
      this.agentSpeakingUntil = Math.max(this.agentSpeakingUntil, now) + (pcm.length / 24000) * 1000;
      this.emit('audio', pcm);
    });
    s.on('inputTranscript', (t) => {
      this.callerBuf += t;
      this.lastActivity = Date.now();
      this.emitLine('caller', this.callerBuf, false);
    });
    s.on('outputTranscript', (t) => {
      if (this.callerBuf.trim()) this.flushCaller();
      this.agentBuf += t;
      this.emitLine('agent', this.agentBuf, false);
    });
    s.on('interrupted', () => {
      this.agentSpeakingUntil = 0;
      this.emit('clear');
      if (this.agentBuf.trim()) this.flushAgent(true);
    });
    s.on('turnComplete', () => {
      if (this.callerBuf.trim() && !this.agentBuf.trim()) this.flushCaller();
      this.flushAgent(false);
      this.turns?.agentTurnDone();
      this.emit('turnFlush');
      if (this.state.ending) this.scheduleHangup('agent said goodbye', 900);
    });
    s.on('toolCall', (calls) => {
      this.turns?.agentToolCall();
      this.toolQueue = this.toolQueue.then(() => this.handleTools(s, calls));
    });
    s.on('usage', (u: UsageMetadata) => {
      this.usage.total += Number(u.totalTokenCount ?? 0);
      this.usage.prompt_max = Math.max(this.usage.prompt_max, Number(u.promptTokenCount ?? 0));
      if (!this.usage.prompt_first) this.usage.prompt_first = Number(u.promptTokenCount ?? 0);
      this.usage.responses++;
    });
    s.on('resumption', (h) => (this.resumeHandle = h));
    s.on('goAway', () => {
      this.record('system', { event: 'goAway' });
      this.reconnect(prompt).catch((err) => this.fail(err));
    });
    s.on('close', (code, reason) => {
      if (this.closing || this.ended || s !== this.session) return;
      this.record('system', { event: 'closed', code, reason });
      this.reconnect(prompt).catch((err) => this.fail(err));
    });
    s.on('error', (err) => this.record('error', { message: err.message }));
  }

  private async reconnect(prompt: string): Promise<void> {
    if (this.closing || this.ended) return;
    const old = this.session;
    const next = await LiveSession.connect(this.setupFor(this.model, prompt), this.opts.config.keys.calls);
    this.session = next;
    this.attach(next, prompt);
    if (this.turns?.isOpen) next.sendActivityStart();
    old?.removeAllListeners();
    old?.close();
    this.record('system', { event: 'resumed', with_handle: Boolean(this.resumeHandle) });
  }

  /** Replace a session that has stopped responding: hand the call to the next model, with the story so far. */
  private async recover(): Promise<void> {
    if (this.recovering || this.ended) return;
    this.recovering = true;
    this.recoveries++;
    this.record('system', { event: 'watchdog', model: this.model, recovery: this.recoveries });
    const sorry = '[There was a brief problem on the line and you may have missed what the caller just said. Apologise briefly and ask them to repeat it.]';
    try {
      const pinned = this.opts.tenant.profile.live_model;
      const models = this.opts.models ?? (pinned ? [pinned, ...this.opts.config.liveModels.filter((m) => m !== pinned)] : this.opts.config.liveModels);
      const next = models.find((m) => m !== this.model) ?? this.model;
      this.resumeHandle = undefined;
      const old = this.session;
      const fresh = await LiveSession.connect(this.setupFor(next, this.prompt), this.opts.config.keys.calls);
      this.session = fresh;
      const from = this.model;
      this.model = next;
      this.attach(fresh, this.prompt);
      if (this.turns?.isOpen) fresh.sendActivityStart();
      old?.removeAllListeners();
      old?.close();
      const story = this.transcript.slice(-8).map((l) => `${l.role === 'agent' ? 'You' : 'Caller'}: ${l.text}`).join(' / ');
      const missed = this.turns && !this.turns.isOpen ? this.turns.lastTurnAudio() : [];
      if (missed.length) {
        // We still have the turn it missed: play it to the new model, which
        // answers it. The caller hears a slower reply, not an apology.
        fresh.sendText(`[You are taking over this call part-way through. So far: ${story || 'you have greeted the caller.'} The caller's latest words follow as audio. Answer them naturally, without mentioning any problem.]`);
        fresh.sendActivityStart();
        for (const f of missed) fresh.sendAudio(f.pcm, f.rate);
        fresh.sendActivityEnd();
        this.awaitingReply = true;
        this.record('system', { event: 'replayed_turn', ms: Math.round(missed.reduce((n, f) => n + (f.pcm.length / f.rate) * 1000, 0)) });
      } else {
        fresh.sendText(`[You are taking over this call part-way through. So far: ${story || 'you have greeted the caller.'} ${sorry.slice(1)}`);
      }
      this.fallbacks.push({ model: from, error: 'stopped responding mid-call' });
      this.record('system', { event: 'handed_over', from, to: next });
      void this.opts.repo.updateCall(this.callId, { model: next, fallbacks: this.fallbacks }).catch(() => {});
    } catch (err) {
      this.fail(err as Error);
    } finally {
      this.lastModelSign = Date.now();
      this.lastCallerSound = Date.now();
      this.recovering = false;
    }
  }

  private fail(err: Error): void {
    this.record('error', { message: err.message });
    this.emit('hangup', `session lost: ${err.message}`);
    void this.end('error');
  }

  private emitLine(role: 'caller' | 'agent', text: string, final: boolean): void {
    const clean = redactCardNumbers(text, this.opts.config.demoCards).text;
    this.emit('transcript', { role, text: clean, final });
    this.publish('transcript', { role, text: clean, final });
  }

  private flushCaller(): void {
    const text = this.callerBuf.trim();
    this.callerBuf = '';
    if (!text) return;
    const clean = redactCardNumbers(text, this.opts.config.demoCards).text;
    this.transcript.push({ role: 'caller', text: clean });
    this.emitLine('caller', text, true);
    this.record('caller', { text: clean });
  }

  private flushAgent(interrupted: boolean): void {
    const text = this.agentBuf.trim();
    this.agentBuf = '';
    if (!text) return;
    const clean = redactCardNumbers(text, this.opts.config.demoCards).text;
    this.transcript.push({ role: 'agent', text: clean + (interrupted ? ' —' : '') });
    this.emitLine('agent', text, true);
    this.record('agent', { text: clean, interrupted });
    this.turns?.agentSaid(clean);
    for (const f of checkUtterance(text, this.state)) {
      this.flags.push(f);
      this.emit('flag', f);
      this.publish('flag', { rule: f.rule, text: f.text });
      this.record('guardrail', f);
      // Correct it on the call, not just in the log: the next thing the
      // agent does is put it right.
      this.session?.sendText(CORRECTIONS[f.rule]);
    }
    this.emit('agentTurn', clean);
  }

  private async handleTools(s: LiveSession, calls: FunctionCall[]): Promise<void> {
    const ctx: ToolContext = {
      tenant: this.opts.tenant,
      repo: this.opts.repo,
      now: () => this.now(),
      callId: this.callId,
      channel: this.opts.channel,
      callerPhone: this.opts.callerPhone ?? null,
      state: this.state,
      demoCards: this.opts.config.demoCards,
      sms: this.opts.sms,
      telephony: this.opts.telephony ?? null,
      action: (a) => {
        this.emit('action', a);
        this.publish('action', { action: a });
        this.record('action', a);
      },
    };
    const responses = [];
    for (const c of calls) {
      this.record('tool_call', { name: c.name, args: loggableArgs(c.name, c.args) });
      const t0 = Date.now();
      const result = await runTool(c.name, c.args, ctx);
      this.record('tool_result', { name: c.name, ms: Date.now() - t0, result });
      this.toolTrace.push({ name: c.name, args: loggableArgs(c.name, c.args), result });
      responses.push({ id: c.id, name: c.name, response: result });
    }
    this.lastActivity = Date.now();
    if (calls.some((c) => READ_BACK_TOOLS.has(c.name))) this.turns?.protect();
    // end_call gets no answer: the goodbye has been said, and an answer only
    // invites the model to carry on (on 30 September it recited a summary of
    // the whole call into the transcript after its goodbye).
    const answers = responses.filter((r) => r.name !== 'end_call');
    if (answers.length) this.turns?.agentWillSpeak();
    if (s.isOpen && answers.length) s.sendToolResponses(answers);
    if (this.state.ending) this.scheduleHangup('end_call', answers.length ? 4000 : 600);
    if (this.state.transferRequested) this.scheduleHangup('transferred', 100);
  }

  private scheduleHangup(reason: string, ms: number): void {
    if (this.hangupTimer) clearTimeout(this.hangupTimer);
    this.hangupTimer = setTimeout(() => {
      const wait = Math.max(0, this.agentSpeakingUntil - Date.now());
      setTimeout(() => {
        this.emit('hangup', reason);
        void this.end(this.state.transferRequested ? 'transferred' : 'completed');
      }, wait + 300);
    }, ms);
  }

  /** Caller audio, PCM16 mono. Browser: 16 kHz. Twilio: 8 kHz decoded μ-law. */
  sendAudio(pcm: Int16Array, rate = 16000): void {
    if (!this.session?.isOpen) return;
    this.listener?.send(pcm, rate);
    if (this.turns) {
      // The turn manager decides what reaches the model, and when the turn ends.
      this.turns.push(pcm, rate);
      return;
    }
    if (rms(pcm) > SPEECH_RMS) {
      this.lastCallerSound = Date.now();
      this.lastActivity = this.lastCallerSound;
      this.awaitingReply = true;
      this.silencePrompts = 0;
    }
    this.session.sendAudio(pcm, rate);
  }

  /** Text as the caller (evaluation text mode) or as a system cue in [brackets]. */
  sendText(text: string): void {
    if (!this.session?.isOpen) return;
    if (!text.startsWith('[')) {
      this.callerBuf = text;
      this.flushCaller();
      this.lastCallerSound = Date.now();
      this.awaitingReply = true;
    }
    this.session.sendText(text);
  }

  private tick(): void {
    if (this.ended || !this.session) return;
    const now = Date.now();
    const elapsed = (now - this.startedAt) / 1000;
    if (!this.wrapUpSent && elapsed > this.opts.config.maxCallSeconds) {
      this.wrapUpSent = true;
      this.session.sendText('[The call has reached its time limit. Politely wrap up: offer to take a message, then say goodbye and call end_call.]');
      setTimeout(() => {
        if (!this.ended) {
          this.emit('hangup', 'time limit');
          void this.end('time_limit');
        }
      }, 60000);
      return;
    }
    if (
      this.awaitingReply && !this.recovering && !this.state.ending && this.recoveries < MAX_RECOVERIES &&
      now - this.lastCallerSound > (this.turns ? CONTEXTUAL_WATCHDOG_MS : WATCHDOG_MS) && this.lastModelSign < this.lastCallerSound
    ) {
      void this.recover();
      return;
    }
    if (this.recovering) return;
    // Mid-turn (a thinking pause, or on hold while they ask the family): not silence.
    if (this.turns?.isOpen) return;
    const quietFor = now - Math.max(this.lastActivity, this.agentSpeakingUntil);
    if (quietFor > 10000 && !this.state.ending) {
      this.silencePrompts++;
      this.lastActivity = now;
      if (this.silencePrompts === 1) this.session.sendText('[The caller has said nothing for ten seconds. Check they are still there.]');
      else if (this.silencePrompts === 2) this.session.sendText('[Still no answer. Say a polite goodbye, then call end_call.]');
      else {
        this.emit('hangup', 'silence');
        void this.end('silence');
      }
    }
  }

  async end(outcome = 'completed'): Promise<CallSummary | null> {
    if (this.ended) return null;
    this.ended = true;
    this.closing = true;
    if (this.timer) clearInterval(this.timer);
    if (this.turnTimer) clearInterval(this.turnTimer);
    this.listener?.close();
    if (this.hangupTimer) clearTimeout(this.hangupTimer);
    await this.toolQueue.catch(() => {});
    this.flushCaller();
    this.flushAgent(false);
    this.session?.removeAllListeners();
    this.session?.close();
    const finalOutcome = this.deriveOutcome(outcome);
    const summary: CallSummary = {
      call_id: this.callId,
      outcome: finalOutcome,
      model: this.model,
      duration_s: Math.round((Date.now() - this.startedAt) / 1000),
      flags: this.flags,
      tokens: this.usage.total,
      latency_ms: this.latencies,
      transcript: this.transcript,
      tools: this.toolTrace,
    };
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const pct = (p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : null);
    await this.opts.repo.updateCall(this.callId, {
      ended_at: new Date(),
      outcome: finalOutcome,
      usage: { ...this.usage, per_minute: summary.duration_s ? Math.round((this.usage.total / summary.duration_s) * 60) : null },
      latency: { median_ms: pct(0.5), p95_ms: pct(0.95), samples: sorted.length },
      guardrail_flags: this.flags.length,
    }).catch(() => {});
    this.record('system', { event: 'ended', outcome: finalOutcome });
    this.publish('call_ended', { outcome: finalOutcome, flags: this.flags.length });
    this.emit('ended', summary);
    if (this.opts.config.summaries && this.opts.channel !== 'eval' && this.transcript.length > 1) {
      void this.summarise().catch(() => {});
    }
    return summary;
  }

  private deriveOutcome(fallback: string): string {
    const kinds = new Set<string>();
    if (this.state.lastOrder) kinds.add('ordered');
    if (this.state.lastBookingRef) kinds.add('booked');
    if (this.state.committed.length && !kinds.size) kinds.add('changed');
    if (this.state.paid.length) kinds.add('paid');
    if (this.state.transferRequested) kinds.add('transferred');
    return kinds.size ? [...kinds].join('+') : fallback;
  }

  private async summarise(): Promise<void> {
    const text = this.transcript.map((l) => `${l.role === 'agent' ? 'Agent' : 'Caller'}: ${l.text}`).join('\n');
    const summary = await generateText(
      this.opts.config.textModel,
      `Summarise this phone call to ${this.opts.tenant.profile.name} for the owner in one or two plain sentences: who called, what they wanted, and what happened.\n\n${text}`,
      this.opts.config.keys.text,
      { temperature: 0.2 },
    );
    await this.opts.repo.updateCall(this.callId, { summary: summary.trim() });
    this.publish('refresh');
  }
}
