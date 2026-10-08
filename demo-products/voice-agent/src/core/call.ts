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
  loggableArgs, newCallState, runTool, toolDeclarations, unsaidReference, type Action, type CallState, type SmsSender, type Telephony,
  type ToolContext,
} from './tools.ts';
import { BANK_TALK, PROMISED_MESSAGE, READ_BACK, READ_BACK_AMOUNT, READ_BACK_DETAIL, checkUtterance, referencesIn, saidYes, type Flag } from './guardrails.ts';
import { redactLine } from './redact.ts';
import { record } from './tool-kit.ts';
import { amountsIn } from '../domain/amounts.ts';
import { knownTimes, timesIn } from '../domain/clock-times.ts';
import { tenantNow } from '../domain/time.ts';
import { armSafety, noteAdvice, safetyCorrection } from './safety.ts';
import { unsaid } from '../domain/listings.ts';
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

/**
 * Something that happened off the call that the caller may be waiting on:
 * the client pressed Approve or Decline on their own phone, or the paged
 * engineer accepted (presets/property-maintenance.md §6). Only a call that
 * has this job in hand hears it.
 */
export interface CallNote {
  kind: 'approved' | 'declined' | 'accepted' | 'repaged';
  job: string;
  /** For the receptionist, in the system's words. */
  text: string;
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
  /** Subscribes to notes from off the call; returns the unsubscribe. */
  notes?: (fn: (n: CallNote) => void) => () => void;
  /** Eval text mode: no silence prompts, no audio-based timing. */
  textMode?: boolean;
  /** Instead of the greeting, e.g. after an unanswered transfer. */
  openingCue?: string;
  /** Wrap up after this long instead of config.maxCallSeconds: a demo key's minutes left today. */
  maxSeconds?: number;
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
const READ_BACK_TOOLS = new Set(['review_order', 'confirm_order', 'create_booking', 'modify_booking', 'cancel_booking', 'take_demo_payment', 'record_offer', 'book_valuation']);
const MAX_RECOVERIES = 2;
/**
 * With contextual turn-taking the server knows the moment a turn ended, and a
 * working model transcribes it within about 0.4 s (spike, 30 September), so
 * four seconds of nothing means it is not listening.
 */
const CONTEXTUAL_WATCHDOG_MS = 4000;

/** A repairs contractor's: its jobs are booked with the job tool, not create_booking. */
// A takeaway's corrections, where the shared wording names another business's tools (presets/takeaway.md §8).
const TAKEAWAY_CORRECTIONS: Partial<Record<Flag['rule'], string>> = {
  invented_time:
    "[Correction from the system: no tool has given that time. Never say a wait or a time you haven't checked: say sorry, let me check, then call get_wait_times (or set_fulfilment for their order) and say only what it returns.]",
  invented_price:
    '[Correction from the system: no tool or fact gave that price. Correct yourself: prices, savings and totals come only from get_menu, get_item_details, add_to_order and review_order. Say only what they return.]',
};

const MT_UNCONFIRMED =
  '[Correction from the system: nothing has been booked yet: job create has not returned a reference in this call, so any reference you said is wrong. Tell the caller you just need to finalise it, then call job create now with the date and window they chose. Only then give the reference it returns.]';

const CORRECTIONS: Record<Flag['rule'], string> = {
  unconfirmed_claim:
    '[Correction from the system: nothing has been booked or ordered yet. No create_booking, modify_booking or confirm_order has succeeded in this call. Tell the caller you just need to finalise it, read the details back, and call the tool now. Only then give the reference.]',
  unpaid_claim:
    '[Correction from the system: no payment has gone through in this call. Tell the caller, and take it with take_demo_payment if they want to pay.]',
  said_safe_for_allergy:
    '[Correction from the system: never say a dish is safe for an allergy. Correct yourself now, using the allergen wording from get_item_details, including its caveat.]',
  untaken_message:
    '[Correction from the system: no message has been taken in this call, so the team has not been told. Take it now with take_message (their name, number and what they want), then tell them it has been passed on.]',
  invented_reference:
    "[Correction from the system: no tool gave that reference, so nothing is booked or recorded yet. Say sorry, it isn't done yet; call the right tool now, and give only the reference it returns.]",
  narrated:
    '[Correction from the system: you just read out a note about the caller instead of talking to them. Never describe what the caller or anyone in the room said. Say "Sorry, I misheard you there", ask them what they would like, and carry on talking to them directly.]',
  // An estate agency's (presets/estate-agent.md §8).
  valuation_figure:
    "[Correction from the system: never give a figure, a range or an opinion of what anyone's home is worth, and never repeat one the caller gave (ask \"when was that sale?\", without the amount). Say you can't value a home on the phone, and offer a free valuation instead.]",
  bank_details:
    '[Correction from the system: never say or take bank details. Tell the caller not to pay anything or act on changed bank details, to check with their own solicitor on a number they already have, and to report it to Report Fraud on 0300 123 2040. Then take an urgent message (category fraud).]',
  code_spoken: '[Correction from the system: never say a key-safe, door or alarm code. Say you can\'t share access details, and offer a message for the negotiator.]',
  vacancy_said: "[Correction from the system: never say whether a home is empty or lived in, or who holds keys. Say only when viewings can happen.]",
  staff_whereabouts: "[Correction from the system: never say where a member of the team is or what they are doing. Offer to send them a message instead.]",
  invented_interest: "[Correction from the system: never talk up interest or urgency in a home. Give only facts from your tools.]",
  unconfirmed_acceptance:
    "[Correction from the system: no tool has said any offer was accepted or any keys are ready. Correct yourself: only the seller decides, and the negotiator confirms any decision in writing.]",
  disclosure_missed: "[Correction from the system: you haven't yet told the caller something they must hear about this home. Say it now, from say_first in get_property, before going on.]",
  // A repairs contractor's (presets/property-maintenance.md §8).
  safety_delayed: '[Correction from the system: this is an emergency. Give the safety advice and the number now, before anything else, from safety_advice.]',
  approval_claim: "[Correction from the system: that job is waiting for the landlord's or agent's approval. Nothing is booked and nobody is coming yet: correct yourself, and say we'll call back once it's approved.]",
  invented_eta: "[Correction from the system: no tool has given that arrival time, and no engineer has accepted. Correct yourself: say only what the job tool returned (the window, or that the engineer has been paged and they'll get a text).]",
  said_safe_appliance: "[Correction from the system: never say an appliance is safe or that it's probably nothing. Only an engineer can say that. Correct yourself, and offer to book someone.]",
  unsafe_diy: '[Correction from the system: never give steps beyond the checks triage_fault allows: nothing inside a boiler or fuse box, no ladders, no chemicals. Tell them not to, and offer an engineer.]',
  liability_admitted: "[Correction from the system: never say who pays, admit fault or promise compensation. Correct yourself: the office will look into it, and take a message (category complaint).]",
  legal_deadline: "[Correction from the system: never state a legal deadline: no tool gave one. Correct yourself, and point them to Shelter or Citizens Advice for their rights.]",
  damp_blame: "[Correction from the system: never suggest the tenant caused damp or mould, or tell them how to live. Correct yourself kindly: it's for the landlord to look into, and it has been passed on.]",
  medical_advice: "[Correction from the system: never give health advice. Correct yourself: for anyone unwell, their GP or NHS 111, or 999 in an emergency.]",
  invented_time:
    "[Correction from the system: no tool has given that time. Never offer a time you haven't checked: say sorry, you haven't checked yet, then call check_availability and offer only the times it returns.]",
  cover_advice: "[Correction from the system: never say what a policy covers or whether a claim will be paid. Correct yourself: that is for their insurer to confirm.]",
  invented_price: "[Correction from the system: no tool or fact gave that price. Correct yourself: say you can't price that on the phone; the engineer prices it on the visit, or it is a free quote, and give only the prices your tools return.]",
  card_surcharge: "[Correction from the system: there is no extra charge for paying by card, and a shop may not add one. Correct yourself now.]",
  refund_claim: "[Correction from the system: nothing has been cancelled, changed or refunded: staff decide, and the team will text them. Correct yourself now: it's with the kitchen, and they'll hear by text.]",
  address_read_back: "[Correction from the system: never say the address on an order. If they need to check it, ask them to say it. Don't repeat it.]",
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
  /** Tool flags waiting for the turn's words (see raiseHeld). */
  private held: CallState['toolFlags'] = [];
  /**
   * A booking just found or changed, whose read-back is not one to book. Only the next read-back: a booking found
   * earlier in the call must not hide a later offer's (the second review, 4 October).
   */
  private lookedUp = false;
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
  private stopNotes: (() => void) | null = null;
  /** Contextual turn-taking: when the caller stopped talking, and how long past the usual pause we waited. */
  private replyFrom = 0;
  private replyExtra = 0;

  constructor(opts: CallOptions) {
    super();
    this.opts = opts;
    this.state.estate = Boolean(opts.tenant.profile.estate);
    this.state.maintenance = Boolean(opts.tenant.profile.maintenance);
    this.state.takeaway = Boolean(opts.tenant.profile.ordering?.kitchen);
  }

  private now(): Date {
    // A demo workspace's own clock, so its calls happen at the time the prospect set.
    return this.opts.now ? this.opts.now() : tenantNow(this.opts.tenant);
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
    // Every price in its instructions may be said (a repairs call's invented_price).
    if (this.state.maintenance || this.state.takeaway) this.state.amounts.push(...amountsIn(prompt));
    // And every time in them (an estate agency's and a takeaway's invented_time), but not their ranges: an
    // opening-hours range would let any time through.
    if (this.state.estate || this.state.takeaway) this.state.times.push(...knownTimes(prompt));
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
    this.stopNotes = this.opts.notes?.((n) => this.note(n)) ?? null;
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
        this.record('system', { event: 'heard', text: redactLine(t, this.opts.config.demoCards) });
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
    // A turn the old session never answered is still owed. On 2 October a session dropped six seconds after
    // the caller spoke, resumed, and said nothing: the watchdog had already counted the old session's last
    // message as an answer. Timing the turn afresh lets it hand the call over if the resumed one stays silent.
    if (this.awaitingReply) {
      this.lastCallerSound = Date.now();
      this.lastModelSign = 0;
    }
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
    const clean = redactLine(text, this.opts.config.demoCards);
    this.emit('transcript', { role, text: clean, final });
    this.publish('transcript', { role, text: clean, final });
  }

  private flushCaller(): void {
    const text = this.callerBuf.trim();
    this.callerBuf = '';
    if (!text) return;
    const clean = redactLine(text, this.opts.config.demoCards);
    this.transcript.push({ role: 'caller', text: clean });
    this.state.heard.push(clean);
    // An estate agency's read-back answered: a yes means book it now (see flushAgent).
    if (this.state.estate) {
      if (this.state.readBack && saidYes(clean)) this.state.saidYes = this.state.readBack;
      this.state.readBack = null;
    }
    this.emitLine('caller', text, true);
    this.record('caller', { text: clean });
    // A repairs contractor's caller describing an emergency: the advice comes before anything else (core/safety.ts).
    const m = this.opts.tenant.profile.maintenance;
    const kind = m ? armSafety(this.state, clean) : null;
    if (m && kind) {
      this.record('system', { event: 'safety_armed', kind });
      this.session?.sendText(safetyCorrection(kind, m.nation));
    }
  }

  private flushAgent(interrupted: boolean): void {
    const text = this.agentBuf.trim();
    this.agentBuf = '';
    if (!text) return;
    const clean = redactLine(text, this.opts.config.demoCards);
    this.transcript.push({ role: 'agent', text: clean + (interrupted ? ' —' : '') });
    this.emitLine('agent', text, true);
    this.record('agent', { text: clean, interrupted });
    this.turns?.agentSaid(clean);
    if (this.state.estate || this.state.maintenance) this.state.said.push(clean);
    this.noteSafetySaid();
    this.raiseHeld();
    for (const f of checkUtterance(text, this.state, this.staffNames, this.opts.tenant.profile.maintenance)) this.raise(f);
    if (!this.state.messageTaken && !this.state.messageChecked && PROMISED_MESSAGE.test(clean)) {
      // Once the turn's tool calls have run: the message may be on its way already.
      void this.toolQueue.then(() => {
        if (this.state.messageTaken || this.state.messageChecked || this.ended) return;
        this.state.messageChecked = true;
        this.session?.sendText('[From the system: you told the caller you would pass this on, but no message has been taken. Take it now with take_message, using what they have already told you (name, number, what they want), without asking anything more. Then tell them it has been passed on.]');
      });
    }
    if (this.state.estate) {
      this.remindToBook(clean);
      this.remindFraud();
    }
    this.emit('agentTurn', clean);
  }

  /**
   * An estate agency's call: the caller said yes to a viewing, valuation or
   * offer read back, and the next turn neither made it nor tried to (it
   * answered another question instead). Reminded once, after the turn's
   * tool calls have run.
   */
  /**
   * A booking tool that said "not done yet, ask for X and call again" leaves
   * the booking outstanding; any later answer from one of them (booked, or
   * refused for another reason such as the time going) replaces it. The
   * caller's words that led to the call may not be flushed yet, so they
   * count as heard.
   */
  private noteOutstanding(name: string, result: unknown): void {
    if (name !== 'create_booking' && name !== 'book_valuation' && name !== 'record_offer') return;
    const r = (result ?? {}) as { booked?: boolean; recorded?: boolean; message?: unknown };
    const again = (r.booked === false || r.recorded === false) && /call (?:this|it|create_booking|book_valuation|record_offer) again|call again/i.test(String(r.message ?? ''));
    this.state.outstanding = again ? { tool: name, heard: this.state.heard.length + (this.callerBuf.trim() ? 1 : 0) } : null;
  }

  /** The receptionist has now said the safety advice and the number: the tools open, and the safety log gets the time. */
  private noteSafetySaid(): void {
    const m = this.opts.tenant.profile.maintenance;
    const done = m ? noteAdvice(this.state, m.nation) : null;
    if (!done) return;
    this.record('system', { event: 'safety_advice_said', kind: done.kind });
    if (done.incident) void this.opts.repo.updateIncident(this.opts.tenant.id, done.incident, { advised_at: this.now() }).catch(() => {});
  }

  /**
   * An estate agency's call where the caller talked about bank or account
   * details and the receptionist answered without taking a message: on 3
   * October it refused rightly and took none, so the team never heard of a
   * likely payment scam. Reminded once, after the turn's tool calls.
   */
  private remindFraud(): void {
    if (this.state.fraudNudged || this.state.fraudReported || !BANK_TALK.test(this.state.heard.join(' '))) return;
    void this.toolQueue.then(() => {
      if (this.ended || this.state.fraudNudged || this.state.fraudReported) return;
      this.state.fraudNudged = true;
      this.session?.sendText('[From the system: the caller talked about bank or account details, which may be a payment scam. Take an urgent message now with take_message (category fraud, urgency urgent) with their name, number and what they asked, so the team can check it. Then carry on.]');
    });
  }

  private remindToBook(line: string): void {
    // The caller gave what the tool asked for, and the receptionist talked about the time or amount without trying again (ea-valuation-no-figure, 3 October).
    const owed = this.state.outstanding;
    if (owed && !this.state.retryNudged && this.state.heard.length > owed.heard && READ_BACK_DETAIL.test(line)) {
      void this.toolQueue.then(() => {
        if (this.ended || this.state.retryNudged || this.state.outstanding !== owed) return;
        this.state.retryNudged = true;
        this.session?.sendText(`[From the system: ${owed.tool} said it was not done yet, and nothing has been booked or recorded since. If you now have what it asked for, call it again now; if not, ask for just that. Never say it is booked until it returns a reference.]`);
      });
    }
    const yes = this.state.saidYes;
    if (yes && !this.state.bookNudged) {
      this.state.saidYes = null;
      void this.toolQueue.then(() => {
        if (this.ended || this.state.bookNudged || this.state.committed.length > yes.committed || this.state.commitTries > yes.tries) return;
        this.state.bookNudged = true;
        this.session?.sendText('[From the system: the caller said yes to what you read back, but nothing has been booked or recorded yet. Do it now with create_booking, book_valuation or record_offer (modify_booking or cancel_booking for a change to a booking they have), using what they already told you (if the tool asks for something first, ask for just that). Then answer anything else they asked.]');
      });
    }
    // A read-back of something to make, not of a booking just found ("I can see your viewing on Saturday at 10am. Is that right?").
    // An amount is an offer, and offers are never found.
    const readBack = READ_BACK.test(line) && READ_BACK_DETAIL.test(line);
    const found = readBack && this.lookedUp && !READ_BACK_AMOUNT.test(line);
    if (found) this.lookedUp = false;
    this.state.readBack = readBack && !found ? { committed: this.state.committed.length, tries: this.state.commitTries } : null;
  }

  private get staffNames(): string[] {
    return this.opts.tenant.profile.team?.map((t) => t.first_name) ?? [];
  }

  private raise(f: Flag, correct = true): void {
    this.flags.push(f);
    this.emit('flag', f);
    this.publish('flag', { rule: f.rule, text: f.text });
    this.record('guardrail', f);
    // Correct it on the call, not just in the log: the next thing the
    // agent does is put it right.
    if (correct) {
      const tk = this.state.takeaway ? TAKEAWAY_CORRECTIONS[f.rule] : undefined;
      this.session?.sendText(tk ?? (f.rule === 'unconfirmed_claim' && this.state.maintenance ? MT_UNCONFIRMED : CORRECTIONS[f.rule]));
    }
  }

  /** Tool flags held for the turn's words: raised only if, with them in, the line is still unsaid. */
  private raiseHeld(correct = true): void {
    const keep: CallState['toolFlags'] = [];
    for (const f of this.held.splice(0)) {
      const r = f.recheck;
      if (r && !unsaid(r.items, this.state.said.slice(r.at)).length) continue;
      // Owed before any time: only a time said without it is a slip. Until then it waits, turn after turn; at the end, it goes.
      if (r?.ifTimes && !this.state.said.slice(r.at).some((l) => timesIn(l).length)) {
        if (correct) keep.push(f);
        continue;
      }
      this.raise({ rule: f.rule, text: f.text }, correct);
    }
    this.held.push(...keep);
  }

  private async handleTools(s: LiveSession, calls: FunctionCall[]): Promise<void> {
    // What the receptionist has said so far this turn counts too: it often
    // says a home's must-say line and asks for times in one breath, before
    // the turn's words are final.
    const partial = this.agentBuf.trim();
    if (partial && (this.state.estate || this.state.maintenance)) this.state.said.push(redactLine(partial, this.opts.config.demoCards));
    this.noteSafetySaid();
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
      // A change or cancellation answers a yes too: only "book it now" is reminded (remindToBook).
      if (['create_booking', 'book_valuation', 'record_offer', 'modify_booking', 'cancel_booking'].includes(c.name)) this.state.commitTries++;
      this.record('tool_call', { name: c.name, args: loggableArgs(c.name, c.args) });
      const t0 = Date.now();
      const result = await runTool(c.name, c.args, ctx);
      if (this.state.estate) this.noteOutstanding(c.name, result);
      if (c.name === 'find_bookings') this.lookedUp = Boolean((result as { bookings?: unknown[] }).bookings?.length);
      else if (c.name === 'modify_booking') this.lookedUp = true;
      else if (['check_availability', 'create_booking', 'book_valuation', 'record_offer'].includes(c.name)) this.lookedUp = false;
      this.record('tool_result', { name: c.name, ms: Date.now() - t0, result });
      this.toolTrace.push({ name: c.name, args: loggableArgs(c.name, c.args), result });
      responses.push({ id: c.id, name: c.name, response: result });
      for (const f of this.state.toolFlags.splice(0)) {
        if (f.recheck) this.held.push(f);
        else this.raise(f);
      }
    }
    this.lastActivity = Date.now();
    if (calls.some((c) => READ_BACK_TOOLS.has(c.name))) this.turns?.protect();
    // end_call gets no answer: the goodbye has been said, and an answer only
    // invites the model to carry on (on 30 September it recited a summary of
    // the whole call into the transcript after its goodbye). A refusal is
    // answered, because then carrying on is the point.
    const answers = responses.filter((r) => r.name !== 'end_call' || r.response.ok === false);
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
        const said = [...this.transcript.filter((l) => l.role === 'agent').map((l) => l.text), this.agentBuf].join(' ');
        const owed = this.ended || this.state.transferRequested ? null : unsaidReference(this.state, said);
        if (owed) {
          // Not yet: the caller would hang up without their reference.
          this.state.ending = false;
          this.record('system', { event: 'reference_not_said', reference: owed });
          this.session?.sendText(`[From the system: the caller has not heard their reference yet. Tell them it is done, read ${owed.split('').join(', ')} one character at a time, then say goodbye and use end_call.]`);
          return;
        }
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

  /**
   * A note from off the call. The job must be one this call raised or looked
   * up; then what the caller may now hear changes (an approved job may be
   * called booked, an accepting engineer named) and the receptionist is told.
   */
  note(n: CallNote): void {
    if (this.ended || !this.state.jobsVerified.includes(n.job)) return;
    if (n.kind === 'approved' || n.kind === 'declined') this.state.awaitingApproval = false;
    if (n.kind === 'accepted') this.state.paged = false;
    if (n.kind === 'approved') record(this, n.job, 'job', 'committed');
    // Its references may be said, as a tool's may.
    this.state.references.push(...referencesIn(`${n.job} ${n.text}`));
    const a: Action = { kind: 'note', title: n.kind === 'approved' ? 'Approved by the client' : n.kind === 'declined' ? 'Declined by the client' : n.kind === 'accepted' ? 'Engineer accepted' : 'Paged again', detail: n.text, data: { reference: n.job } };
    this.emit('action', a);
    this.publish('action', { action: a });
    this.record('action', a);
    this.sendText(`[From the system: ${n.text}]`);
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
    if (!this.wrapUpSent && elapsed > Math.min(this.opts.maxSeconds ?? Infinity, this.opts.config.maxCallSeconds)) {
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
    this.stopNotes?.();
    if (this.timer) clearInterval(this.timer);
    if (this.turnTimer) clearInterval(this.turnTimer);
    this.listener?.close();
    if (this.hangupTimer) clearTimeout(this.hangupTimer);
    await this.toolQueue.catch(() => {});
    this.flushCaller();
    this.flushAgent(false);
    this.raiseHeld(false);
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
    if (this.state.lastOrderRef) kinds.add('ordered');
    if (this.state.lastBookingRef) kinds.add('booked');
    if (this.state.lastOfferRef) kinds.add('offered');
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
