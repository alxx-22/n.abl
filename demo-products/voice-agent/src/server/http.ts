// Small HTTP helpers shared by the server's route files.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import type { Bus } from './bus.ts';

export const BASE = '/demo';

export const SECURITY_HEADERS: Record<string, string> = {
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'microphone=(self), camera=(), geolocation=()',
  // Private demos: never in a search index, whatever links to them.
  'x-robots-tag': 'noindex, nofollow',
};

// Vite's development server injects inline scripts and styles for hot reload.
export const DEV_HEADERS: Record<string, string> = {
  ...SECURITY_HEADERS,
  'content-security-policy': SECURITY_HEADERS['content-security-policy'].replace(
    "script-src 'self'; style-src 'self'",
    "script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  ),
};

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function readBody(req: IncomingMessage, limit = 2_000_000): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > limit) throw new HttpError(413, 'That is too large.');
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function readJson<T = any>(req: IncomingMessage, limit?: number): Promise<T> {
  const raw = await readBody(req, limit);
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(400, 'The request was not valid JSON.');
  }
}

export function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...SECURITY_HEADERS });
  res.end(JSON.stringify(data));
}

export function xmlReply(res: ServerResponse, twiml: string): void {
  res.writeHead(200, { 'content-type': 'text/xml' });
  res.end(twiml);
}

export function cookie(req: IncomingMessage, name: string): string | undefined {
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(req.headers.cookie ?? '');
  return m?.[1];
}

export function setCookie(res: ServerResponse, name: string, value: string, opts: { maxAge: number; secure: boolean; path?: string }): void {
  const parts = [`${name}=${value}`, 'HttpOnly', 'SameSite=Strict', `Path=${opts.path ?? BASE}`, `Max-Age=${Math.max(0, Math.floor(opts.maxAge))}`];
  if (opts.secure) parts.push('Secure');
  const prev = res.getHeader('set-cookie');
  res.setHeader('set-cookie', [...(Array.isArray(prev) ? prev : prev ? [String(prev)] : []), parts.join('; ')]);
}

/**
 * The visitor's address, for the key throttle. Behind the site's Worker it is
 * the X-Nabl-Client-Ip header, believed only when the shared secret comes
 * with it; otherwise the header named by CLIENT_IP_HEADER, which the server's
 * own front proxy overwrites on every request (X-Real-IP from the Oracle
 * deploy's Caddy), or the socket. Nothing else a client sends is trusted:
 * anyone reaching the server directly could write it.
 */
export function clientIp(req: IncomingMessage, proxySecret?: string, trustedHeader?: string): string {
  const h = (n: string) => String(req.headers[n] ?? '').split(',')[0].trim();
  if (proxySecret) {
    const given = Buffer.from(h('x-nabl-proxy'));
    const want = Buffer.from(proxySecret);
    if (given.length === want.length && timingSafeEqual(given, want) && h('x-nabl-client-ip')) return h('x-nabl-client-ip');
  }
  return (trustedHeader && h(trustedHeader)) || req.socket.remoteAddress || 'unknown';
}

/** Whether the visitor reached us over HTTPS (directly, or through the Worker or the front proxy), so cookies can be Secure. */
export function overHttps(config: { publicBaseUrl?: string }, req: IncomingMessage): boolean {
  return Boolean(config.publicBaseUrl?.startsWith('https')) || String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https';
}

/** Same-origin check for WebSocket upgrades and state-changing requests. */
export function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  const hosts = [req.headers.host, req.headers['x-forwarded-host']].flat().filter(Boolean) as string[];
  try {
    return hosts.includes(new URL(origin).host);
  } catch {
    return false;
  }
}

/** A server-sent event stream of one tenant's board events. */
export function eventStream(req: IncomingMessage, res: ServerResponse, bus: Bus, tenantId: string): void {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no', ...SECURITY_HEADERS });
  res.write(': hello\n\n');
  const off = bus.subscribe(tenantId, (e) => res.write(`data: ${JSON.stringify(e)}\n\n`));
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => {
    off();
    clearInterval(ping);
  });
}
