// The phone line: Twilio Programmable Voice with bidirectional Media Streams.
//
//   POST /twilio/voice      a call arrives; answer with <Connect><Stream>
//   POST /twilio/pin        the shared demo number: four digits choose the tenant
//   WS   /twilio/stream     20 ms frames of 8 kHz μ-law each way
//   POST /twilio/after-dial a transfer ended; unanswered comes back to the agent
//   POST /twilio/whisper    the one line a staff member hears before connecting
//
// Every webhook is checked against Twilio's signature. The media socket is
// authorised by a short-lived HMAC token placed in the TwiML we returned.

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WebSocket } from 'ws';
import type { Config } from '../config.ts';
import type { Repo } from '../db/repo.ts';
import { CallSession, type CallOptions } from '../core/call.ts';
import { Resampler, mulawDecode, mulawEncode } from '../core/audio.ts';
import type { SmsSender, Telephony } from '../core/tools.ts';
import type { Bus } from '../server/bus.ts';
import { maskPhone } from '../domain/phone.ts';

// ── Signatures and tokens ────────────────────────────────────────────────

/** Twilio's X-Twilio-Signature: HMAC-SHA1 of the full URL plus sorted POST params. */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = Object.keys(params).sort().reduce((s, k) => s + k + params[k], url);
  return createHmac('sha1', authToken).update(data).digest('base64');
}

export function signatureValid(authToken: string, url: string, params: Record<string, string>, given: string | undefined): boolean {
  if (!given) return false;
  const want = Buffer.from(twilioSignature(authToken, url, params));
  const got = Buffer.from(given);
  return want.length === got.length && timingSafeEqual(want, got);
}

export function streamToken(secret: string, callSid: string, tenantId: string, ttlSeconds = 120, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  const mac = createHmac('sha256', secret).update(`${callSid}.${tenantId}.${exp}`).digest('base64url');
  return `${exp}.${mac}`;
}

export function streamTokenValid(secret: string, callSid: string, tenantId: string, token: string, now = Date.now()): boolean {
  const [expS, mac] = token.split('.');
  const exp = Number(expS);
  if (!exp || exp < Math.floor(now / 1000) || !mac) return false;
  const want = Buffer.from(createHmac('sha256', secret).update(`${callSid}.${tenantId}.${exp}`).digest('base64url'));
  const got = Buffer.from(mac);
  return want.length === got.length && timingSafeEqual(want, got);
}

// ── TwiML ────────────────────────────────────────────────────────────────

const xml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

export function connectTwiml(wsUrl: string, params: Record<string, string>): string {
  const p = Object.entries(params).map(([k, v]) => `<Parameter name="${xml(k)}" value="${xml(v)}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${xml(wsUrl)}">${p}</Stream></Connect></Response>`;
}

export function sayTwiml(text: string, hangup = true): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Amy" language="en-GB">${xml(text)}</Say>${hangup ? '<Hangup/>' : ''}</Response>`;
}

export function pinTwiml(actionUrl: string, retry = false): string {
  const prompt = retry ? "Sorry, that code didn't match. Please enter your four digit demo code." : 'Welcome to the n.abl demo line. Please enter your four digit demo code.';
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="dtmf" numDigits="4" timeout="8" action="${xml(actionUrl)}"><Say voice="Polly.Amy" language="en-GB">${prompt}</Say></Gather>${sayTwiml('No code received. Goodbye.').replace(/^.*<Response>|<\/Response>$/g, '')}</Response>`;
}

export function dialTwiml(to: string, whisperUrl: string, actionUrl: string, callerId?: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial timeout="20" action="${xml(actionUrl)}"${callerId ? ` callerId="${xml(callerId)}"` : ''}><Number url="${xml(whisperUrl)}">${xml(to)}</Number></Dial></Response>`;
}

// ── REST ─────────────────────────────────────────────────────────────────

async function updateCall(cfg: NonNullable<Config['twilio']>, callSid: string, params: Record<string, string>): Promise<boolean> {
  const user = cfg.apiKey ?? cfg.accountSid;
  const pass = cfg.apiSecret ?? cfg.authToken;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Calls/${callSid}.json`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function twilioTelephony(config: Config, callSid: string, tenantSlug: string, callerId?: string): Telephony {
  return {
    async transfer(to, whisper) {
      if (!config.twilio || !config.publicBaseUrl) return false;
      const base = config.publicBaseUrl;
      const twiml = dialTwiml(
        to,
        `${base}/twilio/whisper?text=${encodeURIComponent(whisper.slice(0, 200))}`,
        `${base}/twilio/after-dial?tenant=${encodeURIComponent(tenantSlug)}`,
        callerId,
      );
      return updateCall(config.twilio, callSid, { Twiml: twiml });
    },
  };
}

// ── The media stream ─────────────────────────────────────────────────────

const FRAME_BYTES = 160; // 20 ms of 8 kHz μ-law

export interface StreamDeps {
  repo: Repo;
  config: Config;
  bus: Bus;
  sms: SmsSender;
  /** Tests replace the REST hangup, and the call itself. */
  hangup?: (callSid: string) => Promise<void>;
  createCall?: (opts: CallOptions) => CallSession;
}

export function handleTwilioStream(ws: WebSocket, deps: StreamDeps): void {
  let streamSid = '';
  let callSid = '';
  let call: CallSession | null = null;
  const up = new Resampler(8000, 16000);
  let down = new Resampler(24000, 8000);
  let pending = Buffer.alloc(0);
  let hangupSent = false;

  const send = (m: unknown) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m));
  };

  const hangup = async () => {
    if (deps.hangup) return deps.hangup(callSid);
    if (deps.config.twilio && callSid) await updateCall(deps.config.twilio, callSid, { Status: 'completed' });
  };

  ws.on('message', async (raw) => {
    let m: any;
    try {
      m = JSON.parse(raw.toString());
    } catch {
      return;
    }
    switch (m.event) {
      case 'start': {
        streamSid = m.start.streamSid;
        callSid = m.start.callSid;
        const p = m.start.customParameters ?? {};
        const tenant = p.tenant_id ? await deps.repo.getTenantById(p.tenant_id) : null;
        if (!tenant || !streamTokenValid(deps.config.sessionSecret, callSid, tenant.id, p.token ?? '')) {
          ws.close(1008, 'unauthorised stream');
          return;
        }
        call = (deps.createCall ?? ((o: CallOptions) => new CallSession(o)))({
          tenant,
          repo: deps.repo,
          config: deps.config,
          channel: 'phone',
          callerPhone: p.from || null,
          providerCallId: callSid,
          toNumber: p.to || null,
          sms: deps.sms,
          telephony: twilioTelephony(deps.config, callSid, tenant.slug, p.to || undefined),
          publish: deps.bus.publish,
          openingCue: p.cue || undefined,
        });
        call.on('audio', (pcm24) => {
          const ulaw = mulawEncode(down.process(pcm24));
          pending = Buffer.concat([pending, Buffer.from(ulaw)]);
          while (pending.length >= FRAME_BYTES) {
            send({ event: 'media', streamSid, media: { payload: pending.subarray(0, FRAME_BYTES).toString('base64') } });
            pending = pending.subarray(FRAME_BYTES);
          }
        });
        call.on('turnFlush', () => {
          if (pending.length) {
            send({ event: 'media', streamSid, media: { payload: pending.toString('base64') } });
            pending = Buffer.alloc(0);
          }
        });
        call.on('clear', () => {
          pending = Buffer.alloc(0);
          down = new Resampler(24000, 8000);
          send({ event: 'clear', streamSid });
        });
        call.on('hangup', () => {
          if (hangupSent) return;
          hangupSent = true;
          if (pending.length) send({ event: 'media', streamSid, media: { payload: pending.toString('base64') } });
          pending = Buffer.alloc(0);
          // Hang up once Twilio has played everything queued before this mark.
          send({ event: 'mark', streamSid, mark: { name: 'hangup' } });
          setTimeout(() => void hangup(), 8000);
        });
        try {
          await call.start();
        } catch (err) {
          console.error(`call ${maskPhone(p.from)}: ${(err as Error).message}`);
          ws.close(1011, 'model unavailable');
        }
        break;
      }
      case 'media': {
        if (!call || m.media?.track === 'outbound') return;
        const ulaw = Buffer.from(m.media.payload, 'base64');
        call.sendAudio(up.process(mulawDecode(ulaw)), 16000);
        break;
      }
      case 'mark': {
        if (m.mark?.name === 'hangup') await hangup();
        break;
      }
      case 'stop': {
        await call?.end('caller hung up');
        break;
      }
    }
  });

  ws.on('close', () => void call?.end('caller hung up'));
}
