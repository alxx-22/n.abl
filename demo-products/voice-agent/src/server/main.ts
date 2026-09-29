// n.abl Reception: the server. One process holds every call.
//
//   npm run dev      PGlite in .data/, seeded on first run, http://localhost:8787
//   npm start        production (DATABASE_URL, PUBLIC_BASE_URL, CONSOLE_PASSWORD)

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { loadConfig, type Config } from '../config.ts';
import { migrate, openDb } from '../db/db.ts';
import { Repo } from '../db/repo.ts';
import { seedAll, seedDiary } from '../db/seed.ts';
import { Bus } from './bus.ts';
import { smsSender } from '../channels/sms.ts';
import { handleBrowserCall } from '../channels/browser.ts';
import {
  connectTwiml, handleTwilioStream, pinTwiml, sayTwiml, signatureValid, streamToken,
} from '../channels/twilio.ts';
import { toLocal, spokenDate, spokenTime, addDays, zonedToUtc } from '../domain/time.ts';
import { pounds, type TenantProfile } from '../domain/types.ts';
import { displayUkPhone } from '../domain/phone.ts';
import { ingestWebsite } from '../ingest/ingest.ts';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.png': 'image/png',
};
const SECURITY_HEADERS = {
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' ws: wss:; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'microphone=(self), camera=(), geolocation=()',
};

export interface App {
  config: Config;
  repo: Repo;
  bus: Bus;
  close: () => Promise<void>;
  port: number;
}

function sessionCookie(config: Config): string {
  return createHmac('sha256', config.sessionSecret).update('console').digest('base64url');
}

function authed(req: IncomingMessage, config: Config): boolean {
  if (!config.consolePassword) return true;
  const cookie = /(?:^|;\s*)va_session=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
  if (!cookie) return false;
  const want = Buffer.from(sessionCookie(config));
  const got = Buffer.from(cookie);
  return want.length === got.length && timingSafeEqual(want, got);
}

async function body(req: IncomingMessage, limit = 2_000_000): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > limit) throw new Error('body too large');
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...SECURITY_HEADERS });
  res.end(JSON.stringify(data));
}

function xmlReply(res: ServerResponse, twiml: string): void {
  res.writeHead(200, { 'content-type': 'text/xml' });
  res.end(twiml);
}

function validProfile(p: any): p is TenantProfile {
  return (
    p && typeof p === 'object' && typeof p.slug === 'string' && /^[a-z0-9-]{2,40}$/.test(p.slug) &&
    typeof p.name === 'string' && typeof p.greeting === 'string' && Array.isArray(p.core_facts) &&
    Array.isArray(p.opening_hours) && Array.isArray(p.knowledge) && typeof p.timezone === 'string'
  );
}

async function tenantState(repo: Repo, slug: string, bus: Bus) {
  const t = await repo.getTenant(slug);
  if (!t) return null;
  const tz = t.profile.timezone;
  const now = new Date();
  const today = toLocal(now, tz).date;
  const from = zonedToUtc(today, '00:00', tz);
  const to = zonedToUtc(addDays(today, 14), '00:00', tz);
  const bookings = await repo.listBookings(t.id, from, to, true);
  const orders = await repo.listOrders(t.id, new Date(now.getTime() - 36 * 3600000));
  const resources = new Map((t.profile.booking?.resources ?? []).map((r) => [r.key, r.label]));
  const services = new Map((t.profile.booking?.services ?? []).map((s) => [s.key, s.label]));
  return {
    tenant: {
      id: t.id, slug: t.slug, name: t.profile.name, business_type: t.profile.business_type, status: t.profile.status,
      phone_display: t.profile.phone_display, demo_pin: t.profile.demo_pin, accent: t.profile.brand?.accent,
      summary: t.profile.summary, greeting: t.profile.greeting, voice: t.profile.voice,
      has_booking: Boolean(t.profile.booking?.services.length), has_ordering: Boolean(t.profile.ordering),
    },
    today,
    active_calls: bus.activeFor(t.id),
    bookings: bookings.map((b) => {
      const l = toLocal(b.starts_at, tz);
      return {
        reference: b.reference, date: l.date, day: spokenDate(l.date), time: l.time, spoken_time: spokenTime(l.time),
        party_size: b.party_size, name: b.name, phone: displayUkPhone(b.phone), notes: b.notes, status: b.status,
        source: b.source, with: resources.get(b.resource_key) ?? b.resource_key, service: services.get(b.service_key) ?? b.service_key,
        deposit: b.deposit_pence ? pounds(b.deposit_pence) : null, deposit_paid: b.deposit_paid,
      };
    }),
    orders: orders.map((o) => ({
      reference: o.reference, name: o.name, fulfilment: o.fulfilment, due: spokenTime(toLocal(o.due_at, tz).time),
      address: o.address ? `${o.address}, ${o.postcode}` : null, lines: o.lines, total: pounds(o.total_pence),
      allergy_notes: o.allergy_notes, status: o.status, payment_status: o.payment_status, created_at: o.created_at,
    })),
    messages: (await repo.listMessages(t.id)).map((m) => ({ ...m, to_number: displayUkPhone(m.to_number), from_phone: displayUkPhone(m.from_phone) })),
    calls: (await repo.listCalls(t.id, 12)).map((c) => ({
      id: c.id, channel: c.channel, started_at: c.started_at, ended_at: c.ended_at, outcome: c.outcome, summary: c.summary,
      model: c.model, guardrail_flags: c.guardrail_flags, latency: c.latency, usage: c.usage,
    })),
  };
}

export async function startServer(config: Config = loadConfig()): Promise<App> {
  const db = await openDb({ databaseUrl: config.databaseUrl, pgliteDir: config.pgliteDir });
  await migrate(db);
  const repo = new Repo(db);
  if (!(await repo.listTenants()).length) await seedAll(repo);
  const bus = new Bus();
  const sms = smsSender(config);
  const maxCalls = Number(process.env.MAX_CONCURRENT_CALLS ?? 6);

  const twilioOk = (req: IncomingMessage, path: string, params: Record<string, string>) => {
    if (!config.twilio) return false;
    const url = `${config.publicBaseUrl}${path}`;
    return signatureValid(config.twilio.authToken, url, params, req.headers['x-twilio-signature'] as string | undefined);
  };

  const connectCall = async (res: ServerResponse, tenantId: string, params: Record<string, string>, cue?: string) => {
    if (bus.activeCalls() >= maxCalls) return xmlReply(res, sayTwiml('Sorry, every line is busy on this demo right now. Please try again in a minute.'));
    const wsUrl = `${config.publicBaseUrl!.replace(/^http/, 'ws')}/twilio/stream`;
    const p: Record<string, string> = {
      tenant_id: tenantId, token: streamToken(config.sessionSecret, params.CallSid, tenantId),
      from: params.From ?? '', to: params.To ?? '',
    };
    if (cue) p.cue = cue;
    xmlReply(res, connectTwiml(wsUrl, p));
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://local');
    const path = url.pathname;
    try {
      // ── Health ──────────────────────────────────────────────────────
      if (path === '/healthz') return json(res, 200, { ok: await repo.ping(), calls: bus.activeCalls() });

      // ── Twilio webhooks ─────────────────────────────────────────────
      if (path.startsWith('/twilio/') && req.method === 'POST') {
        const params = Object.fromEntries(new URLSearchParams(await body(req)));
        const fullPath = `${path}${url.search}`;
        if (!twilioOk(req, fullPath, params)) return json(res, 403, { error: 'bad signature' });
        if (path === '/twilio/voice') {
          const route = await repo.routeNumber(params.To ?? '');
          if (route?.purpose === 'pin_router' || !route) {
            if (!route && !process.env.PIN_ROUTER_FALLBACK) return xmlReply(res, sayTwiml('This number is not set up for a demo yet.'));
            return xmlReply(res, pinTwiml(`${config.publicBaseUrl}/twilio/pin`));
          }
          return connectCall(res, route.tenant_id!, params);
        }
        if (path === '/twilio/pin') {
          const id = await repo.tenantForPin((params.Digits ?? '').trim());
          if (!id) return xmlReply(res, pinTwiml(`${config.publicBaseUrl}/twilio/pin`, true));
          return connectCall(res, id, params);
        }
        if (path === '/twilio/whisper') return xmlReply(res, sayTwiml(url.searchParams.get('text') ?? 'A caller from the AI assistant.', false));
        if (path === '/twilio/after-dial') {
          if (params.DialCallStatus === 'completed') return xmlReply(res, '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');
          const t = await repo.getTenant(url.searchParams.get('tenant') ?? '');
          if (!t) return xmlReply(res, sayTwiml('Sorry, nobody could take the call. Goodbye.'));
          return connectCall(res, t.id, params, '[You tried to transfer this caller but nobody answered. Apologise briefly and offer to take a message.]');
        }
        return json(res, 404, { error: 'not found' });
      }

      // ── Console API ─────────────────────────────────────────────────
      if (path === '/api/login' && req.method === 'POST') {
        const { password } = JSON.parse((await body(req)) || '{}');
        const want = Buffer.from(config.consolePassword ?? '');
        const got = Buffer.from(String(password ?? ''));
        if (config.consolePassword && (want.length !== got.length || !timingSafeEqual(want, got))) return json(res, 401, { error: 'wrong password' });
        res.setHeader('set-cookie', `va_session=${sessionCookie(config)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${config.publicBaseUrl?.startsWith('https') ? '; Secure' : ''}`);
        return json(res, 200, { ok: true });
      }
      if (path.startsWith('/api/')) {
        if (!authed(req, config)) return json(res, 401, { error: 'sign in' });
        const m = /^\/api\/tenants(?:\/([a-z0-9-]+))?(?:\/(state|reset|events))?$/.exec(path);
        if (path === '/api/config') {
          return json(res, 200, {
            models: config.liveModels, demo_cards: config.demoCards.map((c) => ({ ...c, spoken: c.number.replace(/(\d{4})(?=\d)/g, '$1 ') })),
            telephony: Boolean(config.twilio), sms: Boolean(config.twilio?.smsFrom), numbers: await repo.listNumbers(),
            active_calls: bus.activeCalls(), max_calls: maxCalls,
          });
        }
        if (path === '/api/ingest' && req.method === 'POST') {
          const { url: site } = JSON.parse((await body(req)) || '{}');
          const profile = await ingestWebsite(String(site ?? ''), config);
          return json(res, 200, { profile });
        }
        const call = /^\/api\/calls\/([0-9a-f-]{36})\/events$/.exec(path);
        if (call) return json(res, 200, { events: await repo.listEvents(call[1]) });
        if (m && !m[1] && req.method === 'GET') return json(res, 200, { tenants: await repo.listTenants() });
        if (m && m[1] && !m[2] && req.method === 'GET') {
          const t = await repo.getTenant(m[1]);
          return t ? json(res, 200, { profile: t.profile }) : json(res, 404, { error: 'no such tenant' });
        }
        if (m && m[1] && !m[2] && req.method === 'PUT') {
          const profile = JSON.parse(await body(req));
          if (!validProfile(profile) || profile.slug !== m[1]) return json(res, 400, { error: 'invalid profile' });
          const t = await repo.upsertTenant(profile);
          return json(res, 200, { ok: true, id: t.id });
        }
        if (m && m[1] && m[2] === 'state') {
          const s = await tenantState(repo, m[1], bus);
          return s ? json(res, 200, s) : json(res, 404, { error: 'no such tenant' });
        }
        if (m && m[1] && m[2] === 'reset' && req.method === 'POST') {
          const t = await repo.getTenant(m[1]);
          if (!t) return json(res, 404, { error: 'no such tenant' });
          await repo.resetTenantData(t.id);
          const made = await seedDiary(repo, t, new Date());
          bus.publish({ type: 'refresh', tenant_id: t.id, call_id: '', at: new Date().toISOString() });
          return json(res, 200, { ok: true, bookings: made });
        }
        if (m && m[1] && m[2] === 'events') {
          const t = await repo.getTenant(m[1]);
          if (!t) return json(res, 404, { error: 'no such tenant' });
          res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' });
          res.write(': hello\n\n');
          const off = bus.subscribe(t.id, (e) => res.write(`data: ${JSON.stringify(e)}\n\n`));
          const ping = setInterval(() => res.write(': ping\n\n'), 20000);
          req.on('close', () => {
            off();
            clearInterval(ping);
          });
          return;
        }
        return json(res, 404, { error: 'not found' });
      }

      // ── Static console and board ────────────────────────────────────
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'method not allowed' });
      let file = path === '/' ? '/index.html' : /^\/board\/[a-z0-9-]+\/?$/.test(path) ? '/board.html' : path;
      file = normalize(file).replace(/^(\.\.[/\\])+/, '');
      const full = join(PUBLIC, file);
      if (!full.startsWith(PUBLIC) || !existsSync(full)) return json(res, 404, { error: 'not found' });
      const data = await readFile(full);
      res.writeHead(200, { 'content-type': TYPES[extname(full)] ?? 'application/octet-stream', 'cache-control': 'no-cache', ...SECURITY_HEADERS });
      res.end(data);
    } catch (err) {
      console.error(`${req.method} ${path}: ${(err as Error).message}`);
      if (!res.headersSent) json(res, 500, { error: (err as Error).message.slice(0, 200) });
      else res.end();
    }
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://local');
    if (url.pathname === '/twilio/stream') {
      // Authorised by the token inside the stream's start message.
      wss.handleUpgrade(req, socket, head, (ws) => handleTwilioStream(ws, { repo, config, bus, sms }));
      return;
    }
    if (url.pathname === '/ws/talk') {
      const slug = url.searchParams.get('tenant') ?? '';
      const origin = req.headers.origin;
      const host = req.headers.host;
      const sameOrigin = !origin || new URL(origin).host === host;
      const tenant = await repo.getTenant(slug).catch(() => null);
      if (!authed(req, config) || !sameOrigin || !tenant || bus.activeCalls() >= maxCalls) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        void handleBrowserCall(ws, { tenant, repo, config, bus, sms, callerPhone: url.searchParams.get('phone') });
      });
      return;
    }
    socket.destroy();
  });

  // Free Supabase projects pause after a week idle; a query every six hours keeps it awake.
  const keepAlive = setInterval(() => void repo.ping().catch(() => {}), 6 * 3600000);

  await new Promise<void>((resolve) => server.listen(config.port, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : config.port;
  return {
    config, repo, bus, port,
    close: async () => {
      clearInterval(keepAlive);
      for (const c of wss.clients) c.terminate();
      await new Promise<void>((r) => server.close(() => r()));
      await db.close();
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  if (!config.geminiApiKey) console.warn('GEMINI_API_KEY is not set: calls will fail to connect.');
  if (!config.consolePassword) console.warn('CONSOLE_PASSWORD is not set: the console is open to anyone who can reach it.');
  const app = await startServer(config);
  console.log(`n.abl Reception on http://localhost:${app.port} · ${config.databaseUrl ? 'Supabase' : `PGlite (${config.pgliteDir})`} · models ${config.liveModels.join(' → ')}`);
  const stop = async () => {
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
