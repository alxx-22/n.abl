import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import {
  connectTwiml, dialTwiml, handleTwilioStream, pinTwiml, sayTwiml, signatureValid, streamToken, streamTokenValid, twilioSignature,
} from '../src/channels/twilio.ts';
import { openPglite, migrate, type Db } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { seedAll } from '../src/db/seed.ts';
import { loadConfig } from '../src/config.ts';
import { Bus } from '../src/server/bus.ts';
import { SimulatedSms } from '../src/channels/sms.ts';
import { mulawDecode, mulawEncode } from '../src/core/audio.ts';
import type { CallOptions, CallSession } from '../src/core/call.ts';

test('signature: Twilio’s own documented example', () => {
  const params = { CallSid: 'CA1234567890ABCDE', Caller: '+12349013030', Digits: '1234', From: '+12349013030', To: '+18005551212' };
  const url = 'https://mycompany.com/myapp.php?foo=1&bar=2';
  assert.equal(twilioSignature('12345', url, params), '0/KCTR6DLpKmkAf8muzZqo1nDgQ=');
  assert.ok(signatureValid('12345', url, params, '0/KCTR6DLpKmkAf8muzZqo1nDgQ='));
  assert.ok(!signatureValid('12345', url, { ...params, Digits: '9999' }, '0/KCTR6DLpKmkAf8muzZqo1nDgQ='));
  assert.ok(!signatureValid('12345', url, params, undefined));
});

test('stream tokens: valid, expired, tampered, wrong call', () => {
  const now = Date.now();
  const t = streamToken('secret', 'CA1', 'tenant-1', 120, now);
  assert.ok(streamTokenValid('secret', 'CA1', 'tenant-1', t, now));
  assert.ok(!streamTokenValid('secret', 'CA1', 'tenant-1', t, now + 121000));
  assert.ok(!streamTokenValid('secret', 'CA2', 'tenant-1', t, now));
  assert.ok(!streamTokenValid('other', 'CA1', 'tenant-1', t, now));
  assert.ok(!streamTokenValid('secret', 'CA1', 'tenant-1', t.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), now));
});

test('TwiML is escaped and well formed', () => {
  const x = connectTwiml('wss://example.com/twilio/stream', { tenant_id: 'a&b', cue: '[say "hi"]' });
  assert.match(x, /<Connect><Stream url="wss:\/\/example.com\/twilio\/stream"><Parameter name="tenant_id" value="a&amp;b"\/><Parameter name="cue" value="\[say &quot;hi&quot;\]"\/><\/Stream><\/Connect>/);
  assert.match(sayTwiml('Fish & chips'), /<Say voice="Polly.Amy" language="en-GB">Fish &amp; chips<\/Say><Hangup\/>/);
  assert.match(pinTwiml('https://x/twilio/pin'), /<Gather input="dtmf" numDigits="4"/);
  assert.match(dialTwiml('+447700900999', 'https://x/w?text=a', 'https://x/after'), /<Dial timeout="20" action="https:\/\/x\/after"><Number url="https:\/\/x\/w\?text=a">\+447700900999<\/Number><\/Dial>/);
});

// ── The media bridge, with a fake call in place of Gemini ────────────────

class FakeCall extends EventEmitter {
  opts: CallOptions;
  received: Int16Array[] = [];
  ended = false;
  constructor(opts: CallOptions) {
    super();
    this.opts = opts;
  }
  async start() {}
  sendAudio(pcm: Int16Array) {
    this.received.push(pcm);
  }
  async end() {
    this.ended = true;
    return null;
  }
}

let db: Db;
let repo: Repo;
let tenantId: string;
let server: ReturnType<typeof createServer>;
let port = 0;
let lastCall: FakeCall | null = null;
const hangups: string[] = [];
const config = { ...loadConfig({}), sessionSecret: 'test-secret' };

before(async () => {
  db = await openPglite();
  await migrate(db);
  repo = new Repo(db);
  const tenants = await seedAll(repo, new Date(), { diary: false });
  tenantId = tenants.find((t) => t.slug === 'lucas-trattoria')!.id;
  server = createServer();
  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws) =>
    handleTwilioStream(ws, {
      repo, config, bus: new Bus(), sms: new SimulatedSms(),
      hangup: async (sid) => void hangups.push(sid),
      createCall: (o) => (lastCall = new FakeCall(o)) as unknown as CallSession,
    }),
  );
  await new Promise<void>((r) => server.listen(0, r));
  port = (server.address() as { port: number }).port;
});

after(async () => {
  server.close();
  await db.close();
});

function twilioClient(): Promise<{ ws: WebSocket; messages: any[]; closed: Promise<number> }> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    const messages: any[] = [];
    const closed = new Promise<number>((r) => ws.on('close', (code) => r(code)));
    ws.on('message', (m) => messages.push(JSON.parse(m.toString())));
    ws.on('open', () => resolve({ ws, messages, closed }));
  });
}

const until = async (cond: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!cond() && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
  assert.ok(cond(), 'timed out');
};

test('a stream with a bad token is refused', async () => {
  const { ws, closed } = await twilioClient();
  ws.send(JSON.stringify({ event: 'start', start: { streamSid: 'MZ1', callSid: 'CA1', customParameters: { tenant_id: tenantId, token: 'nope' } } }));
  assert.equal(await closed, 1008);
});

test('caller audio in, agent audio out, barge-in and hang-up', async () => {
  lastCall = null;
  const { ws, messages } = await twilioClient();
  const token = streamToken(config.sessionSecret, 'CA42', tenantId);
  ws.send(JSON.stringify({ event: 'connected' }));
  ws.send(JSON.stringify({ event: 'start', start: { streamSid: 'MZ42', callSid: 'CA42', customParameters: { tenant_id: tenantId, token, from: '+447700900123', to: '+441154960321' } } }));
  await until(() => lastCall !== null);
  const call = lastCall!;
  assert.equal(call.opts.channel, 'phone');
  assert.equal(call.opts.callerPhone, '+447700900123');
  assert.equal(call.opts.providerCallId, 'CA42');

  // 20 ms of caller audio: 160 μ-law bytes at 8 kHz, upsampled to 16 kHz.
  const tone = Int16Array.from({ length: 160 }, (_, i) => Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / 8000)));
  ws.send(JSON.stringify({ event: 'media', streamSid: 'MZ42', media: { track: 'inbound', payload: Buffer.from(mulawEncode(tone)).toString('base64') } }));
  await until(() => call.received.length > 0);
  assert.ok(Math.abs(call.received[0].length - 320) <= 32, `upsampled to ${call.received[0].length}`);

  // 100 ms of agent audio at 24 kHz goes out as 20 ms μ-law frames.
  call.emit('audio', Int16Array.from({ length: 2400 }, (_, i) => Math.round(8000 * Math.sin((2 * Math.PI * 300 * i) / 24000))));
  await until(() => messages.filter((m) => m.event === 'media').length >= 4);
  const media = messages.filter((m) => m.event === 'media');
  for (const m of media) {
    assert.equal(m.streamSid, 'MZ42');
    assert.equal(Buffer.from(m.media.payload, 'base64').length, 160);
  }
  const decoded = mulawDecode(Buffer.from(media[1].media.payload, 'base64'));
  assert.ok(Math.max(...decoded) > 4000, 'the tone survives the trip');

  call.emit('clear');
  await until(() => messages.some((m) => m.event === 'clear'));

  call.emit('hangup', 'agent said goodbye');
  await until(() => messages.some((m) => m.event === 'mark' && m.mark.name === 'hangup'));
  assert.equal(hangups.length, 0, 'waits for playback before hanging up');
  ws.send(JSON.stringify({ event: 'mark', streamSid: 'MZ42', mark: { name: 'hangup' } }));
  await until(() => hangups.includes('CA42'));

  ws.send(JSON.stringify({ event: 'stop', streamSid: 'MZ42' }));
  await until(() => call.ended);
  ws.close();
});
