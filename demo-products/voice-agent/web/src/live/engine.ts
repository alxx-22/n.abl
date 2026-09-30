// The live call in the browser: microphone to the server, the receptionist's
// voice back, both streaming in 20 ms pieces, so it is a conversation and not
// a recording.
//
// Full duplex, so the caller can interrupt. On laptop speakers the agent can
// hear itself; a simple echo gate mutes quiet microphone frames while the
// agent is talking, and loud speech still barges in. Headphones are better.

import type { Action } from '../types.ts';

export type LiveMessage =
  | { type: 'ready'; call_id: string; model: string }
  | { type: 'latency'; ms: number; waited_ms?: number }
  | { type: 'turn'; state: TurnState; reason?: string; expect: string }
  | { type: 'hangup'; reason: string }
  | { type: 'error'; message: string }
  | { type: 'clear' }
  | { type: 'transcript'; role: 'caller' | 'agent'; text: string; final: boolean }
  | { type: 'action'; action: Action }
  | { type: 'flag'; flag: { rule: string; text: string } };

export type TurnState = 'listening' | 'hearing' | 'waiting' | 'hold' | 'replying' | 'interrupted' | 'backchannel';

export interface LiveCall {
  hangup(): void;
  /** 0 to 1, for the level meters. */
  levels(): { mic: number; agent: number };
  agentSpeaking(): boolean;
}

const ECHO_GATE_RMS = 2000;

export async function startLiveCall(opts: {
  slug: string;
  phone?: string | null;
  onMessage: (m: LiveMessage) => void;
  onEnd: () => void;
}): Promise<LiveCall> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });

  const ctx = new AudioContext();
  let ws: WebSocket | null = null;
  try {
    await ctx.audioWorklet.addModule('/mic-worklet.js');
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
    throw err;
  }
  const src = ctx.createMediaStreamSource(stream);
  const mic = new AudioWorkletNode(ctx, 'mic-capture', { processorOptions: { targetRate: 16000 } });
  const sink = ctx.createGain();
  sink.gain.value = 0;
  src.connect(mic).connect(sink).connect(ctx.destination);
  const out = ctx.createGain();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  out.connect(analyser);
  out.connect(ctx.destination);
  const scratch = new Float32Array(analyser.fftSize);

  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const q = new URLSearchParams({ tenant: opts.slug });
  if (opts.phone) q.set('phone', opts.phone);
  ws = new WebSocket(`${proto}://${location.host}/ws/talk?${q}`);
  ws.binaryType = 'arraybuffer';

  let playhead = 0;
  let micLevel = 0;
  const playing = new Set<AudioBufferSourceNode>();
  const agentSpeaking = () => playhead > ctx.currentTime;

  mic.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
    let frame = new Int16Array(e.data);
    let sum = 0;
    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
    const rms = Math.sqrt(sum / frame.length);
    micLevel = Math.max(micLevel * 0.85, Math.min(1, rms / 8000));
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (agentSpeaking() && rms < ECHO_GATE_RMS) frame = new Int16Array(frame.length);
    ws.send(frame.buffer);
  };

  let ready = false;
  let reported = false;
  let ending = false;
  const finish = () => {
    if (ending) return;
    ending = true;
    const wait = Math.max(0, (playhead - ctx.currentTime) * 1000) + 200;
    setTimeout(() => {
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
      opts.onEnd();
    }, wait);
  };

  ws.onmessage = (e) => {
    if (typeof e.data === 'string') {
      const m = JSON.parse(e.data) as LiveMessage;
      if (m.type === 'ready') ready = true;
      if (m.type === 'error') reported = true;
      if (m.type === 'clear') {
        // The caller talked over the agent: stop its voice at once.
        for (const s of playing) s.stop();
        playing.clear();
        playhead = 0;
      }
      if (m.type === 'hangup') finish();
      opts.onMessage(m);
      return;
    }
    const pcm = new Int16Array(e.data as ArrayBuffer);
    const f = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) f[i] = pcm[i] / 32768;
    // A 24 kHz buffer plays correctly in a context at any rate.
    const buf = ctx.createBuffer(1, f.length, 24000);
    buf.copyToChannel(f, 0);
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.connect(out);
    const at = Math.max(ctx.currentTime + 0.04, playhead);
    s.start(at);
    playhead = at + buf.duration;
    playing.add(s);
    s.onended = () => playing.delete(s);
  };
  ws.onclose = (e) => {
    if (!ending && !reported) {
      if (!ready) opts.onMessage({ type: 'error', message: 'The call could not start. Every demo line may be busy, or the server has stopped.' });
      else if (e.code !== 1000 && e.code !== 1005) opts.onMessage({ type: 'error', message: e.reason || 'The line dropped.' });
    }
    finish();
  };

  return {
    hangup() {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'hangup' }));
      for (const s of playing) s.stop();
      playing.clear();
      playhead = 0;
      finish();
    },
    levels() {
      analyser.getFloatTimeDomainData(scratch);
      let sum = 0;
      for (let i = 0; i < scratch.length; i++) sum += scratch[i] * scratch[i];
      micLevel *= 0.92;
      return { mic: micLevel, agent: Math.min(1, Math.sqrt(sum / scratch.length) * 4) };
    },
    agentSpeaking,
  };
}
