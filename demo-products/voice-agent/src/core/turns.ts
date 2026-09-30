// Contextual turn-taking: this server, not Google, decides when the caller
// has finished, and which sounds may interrupt the receptionist.
//
// Google's detection ends a turn after a fixed silence, so a caller who
// pauses to think ("a margherita and, um...") gets answered mid-sentence,
// and one who asks the family what they want gets a reply to that too. With
// Google's detection switched off, the Live model waits until we send
// activityEnd. The spike (src/spike/turns.ts) showed one turn held open
// through a pause, a side conversation and the real request gets a sensible
// reply, and that an "mm-hm" sent outside a turn does not interrupt.
//
// How long to wait depends on:
//   - what the receptionist just asked: a yes-or-no answer ends quickly; a
//     list of dishes, a name or a phone number gets more room;
//   - the caller's words so far, from a parallel transcriber (about a second
//     behind): trailing off ("and, um"), half a phone number, "hang on",
//     "Jack, what do you want?", "sorry about that", "that's everything".
//
// And who may interrupt: while the receptionist talks, a short burst
// ("mm-hm", "yeah", a cough) is dropped; speech that keeps going interrupts.
// While it reads back an order, a reference or the demo card, it takes
// longer speech to cut in.
//
// Pure logic: audio in, decisions out through TurnIO, time from io.now(),
// so the tests can drive it frame by frame.

import { rms } from './audio.ts';
import { expectFromAgent, readWords, type Expectation, type WordSigns } from './turn-words.ts';

export interface TurnTimings {
  /** Silence that ends a turn, by what the receptionist asked. */
  endAfter: Record<Expectation['expect'], number>;
  /** The caller trailed off ("and, um"): wait this long for them to go on. */
  unfinishedMs: number;
  /** Part of a number so far: wait this long for the rest. */
  digitsMs: number;
  /** In the patient contexts, how much longer to wait for the transcriber's words. */
  wordsGraceMs: number;
  /** "That's everything": end this quickly. */
  doneMs: number;
  /** On hold: silence after the last speech that ends the turn anyway. */
  holdQuietMs: number;
  /** On hold: silence after "sorry about that" that ends it. */
  holdBackMs: number;
  holdMaxMs: number;
  maxTurnMs: number;
  /** Voiced audio that opens a turn while the receptionist is quiet (a cough is shorter). */
  onsetMs: number;
  /** Voiced audio that interrupts the receptionist. */
  bargeInMs: number;
  /** ...while it reads back something that matters. */
  protectedBargeInMs: number;
  /** A gap this long ends an attempt to interrupt: it was a backchannel. */
  gapMs: number;
  /** Audio kept from before a turn opens, so the model hears the first syllable. */
  preRollMs: number;
  /** Reply speed: snappy 0.75, normal 1, patient 1.4. */
  scale: number;
}

export const DEFAULT_TIMINGS: TurnTimings = {
  endAfter: { yes_no: 500, open: 700, name: 900, list: 1300, digits: 1300 },
  unfinishedMs: 2600,
  digitsMs: 3000,
  wordsGraceMs: 900,
  doneMs: 350,
  holdQuietMs: 3500,
  holdBackMs: 700,
  holdMaxMs: 60000,
  maxTurnMs: 45000,
  onsetMs: 140,
  bargeInMs: 450,
  protectedBargeInMs: 900,
  gapMs: 250,
  preRollMs: 300,
  scale: 1,
};

export const SPEED_SCALE = { snappy: 0.75, normal: 1, patient: 1.4 } as const;

/** Frame energy against a running noise floor: steady background noise raises the bar. */
export class EnergyVad {
  private floor = 150;
  private readonly minRms: number;
  private readonly ratio: number;
  constructor(minRms = 450, ratio = 3) {
    this.minRms = minRms;
    this.ratio = ratio;
  }

  voiced(pcm: Int16Array): boolean {
    const r = rms(pcm);
    const speech = r > Math.max(this.minRms, this.floor * this.ratio);
    // Follows quiet frames quickly and loud ones slowly, so speech never becomes the floor.
    if (r < this.floor) this.floor += (r - this.floor) * 0.2;
    else this.floor += (r - this.floor) * (speech ? 0.002 : 0.02);
    return speech;
  }
}

export type TurnState = 'listening' | 'hearing' | 'waiting' | 'hold' | 'replying' | 'interrupted' | 'backchannel';

export interface TurnStatus {
  state: TurnState;
  /** Why we are waiting: thinking, number, words, hold, back. */
  reason?: string;
  expect: Expectation['expect'];
}

export interface TurnEnd {
  reason: string;
  /** When the caller last made a sound: replies are timed from here. */
  lastVoiceAt: number;
  /** How much longer than the plain wait for this question we held on. */
  extraMs: number;
}

export interface TurnIO {
  now(): number;
  startTurn(interrupting: boolean): void;
  sendAudio(pcm: Int16Array, rate: number): void;
  endTurn(end: TurnEnd): void;
  agentSpeaking(): boolean;
  onStatus?(s: TurnStatus): void;
  onVoice?(): void;
}

interface Frame {
  pcm: Int16Array;
  rate: number;
  ms: number;
}

export class TurnManager {
  private readonly io: TurnIO;
  private readonly t: TurnTimings;
  private readonly vad = new EnergyVad();
  private expect: Expectation = { expect: 'open' };
  private preRoll: Frame[] = [];
  private cand: { voicedMs: number; lastVoice: number; frames: Frame[] } | null = null;
  private open = false;
  private hold = false;
  private holdNext = false;
  private backAt = 0;
  private turnStart = 0;
  private lastVoiceAt = 0;
  private voicedRun = 0;
  private words = '';
  private signs: WordSigns = readWords('');
  private lastWordsAt = 0;
  private lastEndAt = 0;
  private awaitingAgent = false;
  private awaitingSince = 0;
  private protectedReply = false;
  private status: TurnStatus = { state: 'listening', expect: 'open' };
  /** Set by the call when the parallel transcriber is connected. */
  wordsAvailable = false;

  constructor(io: TurnIO, timings: Partial<TurnTimings> = {}) {
    this.io = io;
    this.t = { ...DEFAULT_TIMINGS, ...timings, endAfter: { ...DEFAULT_TIMINGS.endAfter, ...(timings.endAfter ?? {}) } };
  }

  get isOpen(): boolean {
    return this.open;
  }

  get onHold(): boolean {
    return this.open && this.hold;
  }

  get expecting(): Expectation {
    return this.expect;
  }

  /** Every caller frame, whatever the rate. */
  push(pcm: Int16Array, rate: number): void {
    const now = this.io.now();
    const frame: Frame = { pcm, rate, ms: (pcm.length / rate) * 1000 };
    const voiced = this.vad.voiced(pcm);
    this.voicedRun = voiced ? this.voicedRun + 1 : 0;
    if (this.awaitingAgent && now - this.awaitingSince > 12000) this.awaitingAgent = false;

    if (!this.open) {
      this.preRoll.push(frame);
      let kept = 0;
      for (let i = this.preRoll.length - 1; i >= 0; i--) {
        kept += this.preRoll[i].ms;
        if (kept > this.t.preRollMs) {
          this.preRoll = this.preRoll.slice(i + 1);
          break;
        }
      }
      const busy = this.awaitingAgent || this.io.agentSpeaking();
      if (voiced) {
        if (!this.cand) this.cand = { voicedMs: 0, lastVoice: now, frames: [...this.preRoll] };
        else this.cand.frames.push(frame);
        this.cand.voicedMs += frame.ms;
        this.cand.lastVoice = now;
      } else if (this.cand) {
        this.cand.frames.push(frame);
        if (now - this.cand.lastVoice > this.t.gapMs) {
          // Speech that stopped before it could interrupt: "mm-hm", "yeah", a cough.
          if (busy && this.cand.voicedMs >= 120) this.setStatus({ state: 'backchannel' });
          this.cand = null;
        }
      }
      const need = busy ? (this.protectedReply ? this.t.protectedBargeInMs : this.t.bargeInMs) : this.t.onsetMs;
      if (this.cand && this.cand.voicedMs >= need) this.openTurn(now, busy);
      return;
    }

    this.io.sendAudio(pcm, rate);
    if (voiced && this.voicedRun >= 2) {
      this.lastVoiceAt = now;
      this.io.onVoice?.();
    }
    this.decide(now);
  }

  /** Called on a timer too, so a turn ends on time even if no audio arrives. */
  tick(): void {
    const now = this.io.now();
    if (this.open) this.decide(now);
    else if (this.cand && now - this.cand.lastVoice > this.t.gapMs) this.cand = null;
  }

  private openTurn(now: number, interrupting: boolean): void {
    const frames = this.cand?.frames ?? [];
    this.cand = null;
    this.preRoll = [];
    this.open = true;
    this.hold = this.holdNext;
    this.holdNext = false;
    this.backAt = 0;
    this.turnStart = now;
    this.lastVoiceAt = now;
    this.words = '';
    this.signs = readWords('');
    this.lastWordsAt = 0;
    this.awaitingAgent = false;
    this.protectedReply = false;
    this.io.startTurn(interrupting);
    for (const f of frames) this.io.sendAudio(f.pcm, f.rate);
    this.io.onVoice?.();
    this.setStatus({ state: interrupting ? 'interrupted' : this.hold ? 'hold' : 'hearing', reason: this.hold ? 'hold' : undefined });
  }

  /** How long a silence ends the turn now, and why. */
  private waitFor(now: number): { ms: number; reason: string } {
    const t = this.t;
    const base = t.endAfter[this.expect.expect] * t.scale;
    if (this.hold) {
      if (this.backAt && this.backAt >= this.turnStart) return { ms: t.holdBackMs, reason: 'back' };
      return { ms: t.holdQuietMs, reason: 'hold' };
    }
    const stale = this.lastVoiceAt > this.lastWordsAt;
    const patient = this.expect.expect === 'list' || this.expect.expect === 'digits' || this.expect.expect === 'name';
    if (stale) {
      // Words for the latest speech are still on their way from the transcriber.
      if (patient && this.wordsAvailable) return { ms: base + t.wordsGraceMs * t.scale, reason: 'words' };
      return { ms: base, reason: 'normal' };
    }
    const s = this.signs;
    if (s.done) return { ms: Math.min(base, t.doneMs), reason: 'done' };
    if (this.expect.expect === 'digits' && (this.expect.digits ?? 0) > 0 && s.digits > 0 && s.digits < this.expect.digits!) {
      return { ms: t.digitsMs * t.scale, reason: 'number' };
    }
    if (s.unfinished) return { ms: t.unfinishedMs * t.scale, reason: 'thinking' };
    return { ms: base, reason: 'normal' };
  }

  private decide(now: number): void {
    const silentFor = now - this.lastVoiceAt;
    const age = now - this.turnStart;
    if (age > (this.hold ? this.t.holdMaxMs : this.t.maxTurnMs)) return this.close(now, this.hold ? 'hold_limit' : 'long_turn');
    const { ms, reason } = this.waitFor(now);
    if (silentFor >= ms) return this.close(now, reason);
    if (silentFor < 60) {
      if (this.status.state !== 'hearing' && !this.hold) this.setStatus({ state: 'hearing' });
    } else if (this.hold) {
      this.setStatus({ state: 'hold', reason: 'hold' });
    } else if (reason !== 'normal' && reason !== 'done' && silentFor > this.t.endAfter[this.expect.expect] * this.t.scale * 0.6) {
      this.setStatus({ state: 'waiting', reason });
    }
  }

  private close(now: number, reason: string): void {
    if (!this.open) return;
    this.open = false;
    this.hold = false;
    this.lastEndAt = now;
    this.awaitingAgent = true;
    this.awaitingSince = now;
    const base = this.t.endAfter[this.expect.expect] * this.t.scale;
    const extraMs = Math.max(0, Math.round(now - this.lastVoiceAt - base));
    this.io.endTurn({ reason, lastVoiceAt: this.lastVoiceAt, extraMs });
    this.setStatus({ state: 'replying', reason });
  }

  /** A phrase from the parallel transcriber (about a second behind the audio). */
  callerWords(text: string): void {
    const now = this.io.now();
    const seg = readWords(text);
    if (this.open) {
      this.words = `${this.words} ${text}`.trim();
      this.signs = readWords(this.words);
      this.lastWordsAt = now;
      if (this.hold) {
        if (seg.back || seg.done) this.backAt = now;
      } else if (seg.sideTalk) {
        // Talking to someone in the room: keep the turn open until they come back.
        this.hold = true;
        this.setStatus({ state: 'hold', reason: 'side_talk' });
      } else if (seg.hold) {
        // "Hang on": let the receptionist say "take your time" now, and hold the next turn.
        this.holdNext = true;
        if (now - this.lastVoiceAt >= 300) this.close(now, 'hold_ack');
      }
      if (this.open) this.decide(now);
      return;
    }
    // Words for a turn that has just closed: a hold or side talk carries over.
    if (now - this.lastEndAt < 3000 && (seg.hold || seg.sideTalk)) this.holdNext = true;
  }

  /** The receptionist's words, each time it finishes saying something. */
  agentSaid(text: string): void {
    this.expect = expectFromAgent(text);
  }

  /** The next thing the receptionist says matters (a read-back, a reference): harder to interrupt. */
  protect(): void {
    this.protectedReply = true;
  }

  /** The receptionist's turn is over. */
  agentTurnDone(): void {
    this.awaitingAgent = false;
    this.protectedReply = false;
    if (!this.open) this.setStatus({ state: this.holdNext ? 'hold' : 'listening', reason: this.holdNext ? 'hold' : undefined });
  }

  private setStatus(s: Omit<TurnStatus, 'expect'>): void {
    const next = { ...s, expect: this.expect.expect };
    if (next.state === this.status.state && next.reason === this.status.reason) return;
    this.status = next;
    this.io.onStatus?.(next);
  }
}
