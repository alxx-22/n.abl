// "Talk to it" in a browser: the same call, with a microphone instead of a phone.
//
// The page streams PCM16 at 16 kHz as binary frames and plays back PCM16 at
// 24 kHz. Control and transcript messages travel as JSON text frames. The
// microphone goes to this server, never straight to Google, so the key and
// the tools stay server-side.

import type { WebSocket } from 'ws';
import type { Config } from '../config.ts';
import type { Repo } from '../db/repo.ts';
import type { Tenant } from '../domain/types.ts';
import { CallSession, type CallSummary } from '../core/call.ts';
import type { SmsSender } from '../core/tools.ts';
import type { Bus } from '../server/bus.ts';
import { normaliseUkPhone } from '../domain/phone.ts';

export async function handleBrowserCall(
  ws: WebSocket,
  deps: {
    tenant: Tenant; repo: Repo; config: Config; bus: Bus; sms: SmsSender; callerPhone?: string | null;
    /** Seconds before the receptionist wraps up (a demo key's minutes left). */
    maxSeconds?: number;
    /** Told when the call ends, e.g. to record a demo key's usage. */
    onEnded?: (summary: CallSummary) => void;
  },
): Promise<void> {
  const send = (m: Record<string, unknown>) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m));
  };

  const call = new CallSession({
    tenant: deps.tenant,
    repo: deps.repo,
    config: deps.config,
    channel: 'browser',
    callerPhone: normaliseUkPhone(deps.callerPhone ?? undefined),
    sms: deps.sms,
    telephony: null,
    publish: deps.bus.publish,
    maxSeconds: deps.maxSeconds,
  });
  if (deps.onEnded) call.once('ended', deps.onEnded);

  call.on('audio', (pcm) => {
    if (ws.readyState === ws.OPEN) ws.send(Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength), { binary: true });
  });
  call.on('clear', () => send({ type: 'clear' }));
  call.on('transcript', (l) => send({ type: 'transcript', ...l }));
  call.on('action', (a) => send({ type: 'action', action: a }));
  call.on('flag', (f) => send({ type: 'flag', flag: f }));
  call.on('hangup', (reason) => send({ type: 'hangup', reason }));
  call.on('latency', (ms, extraMs) => send({ type: 'latency', ms, waited_ms: extraMs }));
  call.on('turn', (st) => send({ type: 'turn', ...st }));

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      const b = data as Buffer;
      const pcm = new Int16Array(b.length >> 1);
      for (let i = 0; i < pcm.length; i++) pcm[i] = b.readInt16LE(i * 2);
      call.sendAudio(pcm, 16000);
      return;
    }
    try {
      const m = JSON.parse(data.toString());
      if (m.type === 'hangup') void call.end('caller hung up');
    } catch {
      /* ignore */
    }
  });
  ws.on('close', () => void call.end('caller hung up'));

  try {
    await call.start();
    send({ type: 'ready', call_id: call.callId, model: call.model });
  } catch (err) {
    send({ type: 'error', message: `Could not reach the voice model: ${(err as Error).message}` });
    ws.close(1011, 'model unavailable');
    await call.end('error');
  }
}
