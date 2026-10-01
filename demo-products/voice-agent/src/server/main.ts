// n.abl Reception: the server. One process holds every call, the API and
// the React app, all under /demo so it can sit behind nabl.agency's Worker
// (nabl.agency/demo/*) or run on its own:
//
//   /demo/reception…        prospects: key entry, builder, live workspace
//   /demo/admin…            the team console (CONSOLE_PASSWORD)
//   /demo/api/…             the prospect API (demo.ts) and /demo/api/admin (admin.ts)
//   /demo/ws/talk           a call from the browser
//   /demo/twilio/…          the phone line
//
//   npm run dev      PGlite in .data/, seeded on first run, the React app with
//                    hot reload, all on http://localhost:8787/demo/
//   npm run build    builds the React app into web/dist
//   npm start        production: serves web/dist (DATABASE_URL, PUBLIC_BASE_URL, CONSOLE_PASSWORD)

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ViteDevServer } from 'vite';
import { loadConfig, type Config } from '../config.ts';
import { migrate, openDb } from '../db/db.ts';
import { Repo } from '../db/repo.ts';
import { DemoRepo } from '../db/demo-repo.ts';
import { seedAll } from '../db/seed.ts';
import { Bus } from './bus.ts';
import { smsSender } from '../channels/sms.ts';
import { handleBrowserCall } from '../channels/browser.ts';
import {
  TWILIO_BASE, connectTwiml, handleTwilioStream, pinTwiml, sayTwiml, signatureValid, streamToken,
} from '../channels/twilio.ts';
import { checkApiKey, type KeyStatus } from '../core/gemini.ts';
import type { Ctx } from './context.ts';
import { BASE, DEV_HEADERS, HttpError, SECURITY_HEADERS, json, readBody, sameOrigin, xmlReply } from './http.ts';
import { handleAdmin, isAdmin } from './admin.ts';
import { DEMO_CALLS_PER_KEY, DEMO_CALLS_TOTAL, callSecondsLeft, callerId, callsByKey, demoSms, ended, handleDemo, owns, sessionWho } from './demo.ts';
import { startSweeper } from '../demo/sweeper.ts';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'web');
const DIST = join(WEB, 'dist');
const HMR_PATH = `${BASE}/__vite_hmr`;
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.map': 'application/json', '.ico': 'image/x-icon', '.png': 'image/png',
  '.woff2': 'font/woff2', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8',
};

export interface ServerOptions {
  /** 'dev' runs Vite inside the server; 'dist' serves the built app. */
  web?: 'dev' | 'dist';
  /** Ask Google whether GEMINI_API_KEY works, and tell the console. */
  checkKey?: boolean;
  /** Tests only: the scout reads a local site with a stand-in model. */
  scoutTest?: Ctx['scoutTest'];
  /** Run the clean-up of expired demos every minute (default on). */
  sweep?: boolean;
}

export interface App {
  config: Config;
  repo: Repo;
  demo: DemoRepo;
  bus: Bus;
  /** Settles once Google has answered, when started with checkKey. */
  keyChecked: Promise<{ status: KeyStatus; detail?: string }>;
  close: () => Promise<void>;
  port: number;
}

/** A demo call refused after the handshake, so the page can say why. */
function refuseCall(ws: WebSocket, message: string): void {
  ws.send(JSON.stringify({ type: 'error', message }));
  ws.close(1008, 'refused');
}

export async function startServer(config: Config = loadConfig(), opts: ServerOptions = {}): Promise<App> {
  const db = await openDb({ databaseUrl: config.databaseUrl, pgliteDir: config.pgliteDir });
  await migrate(db);
  const repo = new Repo(db);
  const demo = new DemoRepo(db);
  await demo.failStaleScans();
  if (!(await repo.listTenants()).length) await seedAll(repo);
  const bus = new Bus();
  const sms = smsSender(config);
  const maxCalls = Number(process.env.MAX_CONCURRENT_CALLS ?? 6);
  let keyStatus: KeyStatus = opts.checkKey ? 'checking' : config.geminiApiKey ? 'ok' : 'missing';
  const keyChecked = opts.checkKey
    ? checkApiKey(config.geminiApiKey).then((r) => ((keyStatus = r.status), r))
    : Promise.resolve({ status: keyStatus });
  const ctx: Ctx = { config, repo, demo, bus, sms, maxCalls, keyStatus: () => keyStatus, scoutTest: opts.scoutTest };

  const twilioOk = (req: IncomingMessage, path: string, params: Record<string, string>) => {
    if (!config.twilio) return false;
    const url = `${config.publicBaseUrl}${path}`;
    return signatureValid(config.twilio.authToken, url, params, req.headers['x-twilio-signature'] as string | undefined);
  };

  const connectCall = async (res: ServerResponse, tenantId: string, params: Record<string, string>, cue?: string) => {
    if (bus.activeCalls() >= maxCalls) return xmlReply(res, sayTwiml('Sorry, every line is busy on this demo right now. Please try again in a minute.'));
    const wsUrl = `${config.publicBaseUrl!.replace(/^http/, 'ws')}${TWILIO_BASE}/stream`;
    const p: Record<string, string> = {
      tenant_id: tenantId, token: streamToken(config.sessionSecret, params.CallSid, tenantId),
      from: params.From ?? '', to: params.To ?? '',
    };
    if (cue) p.cue = cue;
    xmlReply(res, connectTwiml(wsUrl, p));
  };

  const twilio = async (req: IncomingMessage, res: ServerResponse, path: string, url: URL) => {
    const params = Object.fromEntries(new URLSearchParams(await readBody(req)));
    if (!twilioOk(req, `${path}${url.search}`, params)) return json(res, 403, { error: 'bad signature' });
    const hook = path.slice(TWILIO_BASE.length);
    if (hook === '/voice') {
      const route = await repo.routeNumber(params.To ?? '');
      if (route?.purpose === 'pin_router' || !route) {
        if (!route && !process.env.PIN_ROUTER_FALLBACK) return xmlReply(res, sayTwiml('This number is not set up for a demo yet.'));
        return xmlReply(res, pinTwiml(`${config.publicBaseUrl}${TWILIO_BASE}/pin`));
      }
      return connectCall(res, route.tenant_id!, params);
    }
    if (hook === '/pin') {
      const id = await repo.tenantForPin((params.Digits ?? '').trim());
      if (!id) return xmlReply(res, pinTwiml(`${config.publicBaseUrl}${TWILIO_BASE}/pin`, true));
      return connectCall(res, id, params);
    }
    if (hook === '/whisper') return xmlReply(res, sayTwiml(url.searchParams.get('text') ?? 'A caller from the AI assistant.', false));
    if (hook === '/after-dial') {
      if (params.DialCallStatus === 'completed') return xmlReply(res, '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');
      const t = await repo.getTenant(url.searchParams.get('tenant') ?? '');
      if (!t) return xmlReply(res, sayTwiml('Sorry, nobody could take the call. Goodbye.'));
      return connectCall(res, t.id, params, '[You tried to transfer this caller but nobody answered. Apologise briefly and offer to take a message.]');
    }
    return json(res, 404, { error: 'not found' });
  };

  const redirect = (res: ServerResponse, to: string) => {
    res.writeHead(302, { location: to, ...SECURITY_HEADERS });
    res.end();
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://local');
    const path = url.pathname;
    try {
      // ── Health ──────────────────────────────────────────────────────
      if (path === '/healthz' || path === `${BASE}/healthz`) return json(res, 200, { ok: await repo.ping(), calls: bus.activeCalls() });

      // ── Twilio webhooks ─────────────────────────────────────────────
      if (path.startsWith(`${TWILIO_BASE}/`) && req.method === 'POST') return await twilio(req, res, path, url);

      // ── The APIs ────────────────────────────────────────────────────
      if (await handleAdmin(ctx, req, res, path, url)) return;
      if (await handleDemo(ctx, req, res, path, url)) return;
      if (path.startsWith(`${BASE}/api/`)) return json(res, 404, { error: 'Not found.' });

      // ── The React app ───────────────────────────────────────────────
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'method not allowed' });
      // Behind the site's Worker only /demo/* arrives. Run directly (locally, a
      // Codespace, the Fly address), the root is the team's console.
      if (path === '/') return redirect(res, `${BASE}/admin`);
      if (path === BASE) return redirect(res, `${BASE}/`);
      if (!path.startsWith(`${BASE}/`)) return json(res, 404, { error: 'not found' });
      if (path === `${BASE}/robots.txt`) {
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
        return res.end('User-agent: *\nDisallow: /\n');
      }
      if (vite) {
        for (const [k, v] of Object.entries(DEV_HEADERS)) res.setHeader(k, v);
        return vite.middlewares(req, res, () => json(res, 404, { error: 'not found' }));
      }
      if (!existsSync(join(DIST, 'index.html'))) {
        res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
        return res.end('The web app has not been built. Run `npm run dev` to develop, or `npm run build` and then `npm start`.');
      }
      const rel = path.slice(BASE.length);
      const file = normalize(rel).replace(/^(\.\.[/\\])+/, '');
      let full = join(DIST, file);
      const isFile = full.startsWith(DIST) && (await stat(full).then((s) => s.isFile(), () => false));
      if (!isFile) {
        if (rel.startsWith('/assets/') || extname(rel)) return json(res, 404, { error: 'not found' });
        full = join(DIST, 'index.html'); // client-side routes: /demo/reception/live/<id>
      }
      const data = await readFile(full);
      res.writeHead(200, {
        'content-type': TYPES[extname(full)] ?? 'application/octet-stream',
        'cache-control': full.includes(`${join(DIST, 'assets')}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
        ...SECURITY_HEADERS,
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (err) {
      if (err instanceof HttpError) {
        if (!res.headersSent) json(res, err.status, { error: err.message });
        else res.end();
        return;
      }
      console.error(`${req.method} ${path}: ${(err as Error).message}`);
      if (!res.headersSent) json(res, 500, { error: 'Something went wrong on our side. Try again in a moment.' });
      else res.end();
    }
  });

  let vite: ViteDevServer | null = null;
  if (opts.web === 'dev') {
    const { createServer: createVite } = await import('vite');
    vite = await createVite({
      configFile: join(WEB, 'vite.config.ts'),
      // localhost is always allowed; GitHub Codespaces forwards the port under app.github.dev.
      server: { middlewareMode: true, hmr: { server, path: '/__vite_hmr' }, allowedHosts: ['.app.github.dev'] },
      appType: 'spa',
    });
  }

  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
  const reject = (socket: import('node:stream').Duplex, status = '403 Forbidden') => {
    socket.write(`HTTP/1.1 ${status}\r\n\r\n`);
    socket.destroy();
  };
  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://local');
    if (url.pathname === `${TWILIO_BASE}/stream`) {
      // Authorised by the token inside the stream's start message.
      wss.handleUpgrade(req, socket, head, (ws) => handleTwilioStream(ws, { repo, config, bus, sms }));
      return;
    }
    if (url.pathname === `${BASE}/ws/talk`) {
      try {
        if (!sameOrigin(req)) return reject(socket);
        const phone = url.searchParams.get('phone');
        const workspaceId = url.searchParams.get('workspace');
        if (workspaceId) return await talkToWorkspace(req, socket, head, workspaceId, phone);
        // Our own demo businesses, from the team console.
        const tenant = await repo.getTenant(url.searchParams.get('tenant') ?? '').catch(() => null);
        if (!isAdmin(req, ctx) || !tenant || bus.activeCalls() >= maxCalls) return reject(socket);
        wss.handleUpgrade(req, socket, head, (ws) => void handleBrowserCall(ws, { tenant, repo, config, bus, sms, callerPhone: phone }));
      } catch (err) {
        console.error(`upgrade ${url.pathname}: ${(err as Error).message}`);
        reject(socket, '500 Internal Server Error');
      }
      return;
    }
    if (vite && url.pathname === HMR_PATH) return; // Vite's own listener takes it
    socket.destroy();
  });

  /** A prospect ringing their own demo: their session, their workspace, their minutes. */
  async function talkToWorkspace(req: IncomingMessage, socket: import('node:stream').Duplex, head: Buffer, id: string, phone: string | null) {
    const who = await sessionWho(ctx, req);
    const w = await demo.getWorkspace(id);
    const team = !who && isAdmin(req, ctx);
    if (!w || (!team && (!who || !owns(w, who)))) return reject(socket);
    const caller = who ? callerId(who) : null;
    let refusal = '';
    let maxSeconds: number | undefined;
    if (ended(w)) refusal = 'This demo has ended: shared demos are deleted an hour after Start.';
    else if (!w.started_at) refusal = 'Press Start first, so the receptionist has your setup and a diary to work with.';
    else if (bus.activeCalls() >= maxCalls || [...callsByKey.values()].reduce((a, b) => a + b, 0) >= DEMO_CALLS_TOTAL) {
      refusal = 'Every demo line is busy right now. Try again in a minute.';
    } else if (who && caller) {
      if ((callsByKey.get(caller) ?? 0) >= DEMO_CALLS_PER_KEY) refusal = 'You already have a call open. Hang that one up first.';
      else {
        const left = await callSecondsLeft(ctx, who);
        maxSeconds = left.seconds;
        if (maxSeconds < 20) {
          refusal = left.by === 'link'
            ? 'This demo link has used all its call time for today. Come back tomorrow, or ask us for a link of your own.'
            : `That's the ${who.key.limits.call_minutes_per_day} minutes of calls you have for today. Come back tomorrow, or ask us for more.`;
        }
      }
    }
    // A shared demo's call ends in time for the demo's deletion.
    if (!refusal && w.expires_at) {
      const left = Math.floor((w.expires_at.getTime() - Date.now()) / 1000);
      if (left < 30) refusal = 'This demo is about to be deleted. Build another to keep trying.';
      maxSeconds = Math.min(maxSeconds ?? Infinity, Math.max(0, left - 75));
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      if (refusal) return refuseCall(ws, refusal);
      if (caller) {
        callsByKey.set(caller, (callsByKey.get(caller) ?? 0) + 1);
        ws.once('close', () => {
          const n = (callsByKey.get(caller) ?? 1) - 1;
          if (n > 0) callsByKey.set(caller, n);
          else callsByKey.delete(caller);
        });
      }
      void handleBrowserCall(ws, {
        tenant: w.tenant, repo, config, bus, sms: demoSms, callerPhone: phone, maxSeconds,
        onEnded: (s) => {
          if (!who) return;
          const made = (name: string) => s.tools.filter((t) => t.name === name && (t.result as any)?.ok !== false && !(t.result as any)?.error).length;
          void demo.recordUsage(who.key.id, w.tenant.id, 'call', {
            seconds: s.duration_s, outcome: s.outcome, model: s.model,
            bookings: made('create_booking'), changes: made('modify_booking'), orders: made('confirm_order'),
          }, who.visitor).catch(() => {});
        },
      });
    });
  }

  // Free Supabase projects pause after a week idle; a query every six hours keeps it awake.
  const keepAlive = setInterval(() => void repo.ping().catch(() => {}), 6 * 3600000);
  // Shared demos go an hour after Start; private ones 30 days after their key ends.
  const stopSweeper = opts.sweep === false ? () => {} : startSweeper({ demo, bus });

  await new Promise<void>((resolve, reject) => server.once('error', reject).listen(config.port, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : config.port;
  return {
    config, repo, demo, bus, port, keyChecked,
    close: async () => {
      clearInterval(keepAlive);
      stopSweeper();
      for (const c of wss.clients) c.terminate();
      await vite?.close();
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
      await db.close();
    },
  };
}

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createNetServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  // Checked before the database opens: two servers must never share one PGlite folder.
  if (!(await portFree(config.port))) {
    console.error(
      `Port ${config.port} is already in use, most likely by n.abl Reception running in another terminal ` +
        `(in a Codespace it starts by itself, in the "Codespaces" terminal tab).\n` +
        `Use that one, or stop it first: press Ctrl+C in its terminal, or run  pkill -f server/main.ts  and then start again.`,
    );
    process.exit(1);
  }
  const dev = process.argv.includes('--dev');
  if (!config.consolePassword) {
    // Public and open would hand the console, and every prospect's workspace, to anyone.
    if (!dev && config.publicBaseUrl?.startsWith('https')) {
      console.error('CONSOLE_PASSWORD must be set when the server is public (PUBLIC_BASE_URL is https).');
      process.exit(1);
    }
    console.warn('CONSOLE_PASSWORD is not set: the team console is open to anyone who can reach it.');
  }
  if (!config.demoProxySecret && config.publicBaseUrl?.startsWith('https://nabl.agency')) {
    console.warn('DEMO_PROXY_SECRET is not set: behind the site\'s Worker every visitor looks like one address to the key throttle.');
  }
  if (!process.env.SESSION_SECRET && !dev) console.warn('SESSION_SECRET is not set: sessions and demo keys\' cookies end whenever the server restarts.');
  const app = await startServer(config, { web: dev ? 'dev' : 'dist', checkKey: true });
  console.log(`n.abl Reception on http://localhost:${app.port}${BASE}/ · ${config.databaseUrl ? 'Supabase' : `PGlite (${config.pgliteDir})`} · models ${config.liveModels.join(' → ')}`);
  void app.keyChecked.then(({ status, detail }) => {
    if (status === 'ok') console.log(`Gemini API key: accepted by Google. Open http://localhost:${app.port}${BASE}/admin and press Start a live call.`);
    else if (status === 'missing') console.warn('GEMINI_API_KEY is not set, so calls cannot connect. Put GEMINI_API_KEY=<your key> in .env.local, then restart.');
    else if (status === 'rejected') console.warn(`Google rejected GEMINI_API_KEY (${detail}). Fix it in .env.local (a Codespaces secret of the same name takes priority), then restart.`);
    else console.warn(`Could not reach Google to check GEMINI_API_KEY (${detail}). Calls may fail.`);
  });
  const stop = async () => {
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
