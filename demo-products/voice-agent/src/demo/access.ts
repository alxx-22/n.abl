// Demo access: one key per person we invite, never stored, and a signed
// session cookie once they are in. See DEMO-SERVICE-PLAN.md §3.2.
//
// Keys use the portal's alphabet and length (src/lib/teamConfig.js in the
// site): 12 characters from 31 unambiguous glyphs, 59.5 bits. Shown as
// DEMO-XXXX-XXXX-XXXX. Only a SHA-256 hash and the first four characters are
// kept, because only this server ever checks them (the portal stores its
// keys in plaintext for RLS; we have no such need).

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no O 0 I 1 L
const LENGTH = 12;

export interface Limits {
  /** Days from issue. */
  days: number;
  /** Minutes of live calls in any 24 hours. */
  call_minutes_per_day: number;
  workspaces: number;
  /** Menu and FAQ drafts in any 24 hours. */
  drafts_per_day: number;
  /** Website scans in any 24 hours. */
  scans_per_day: number;
}

export const DEFAULT_LIMITS: Limits = { days: 14, call_minutes_per_day: 30, workspaces: 3, drafts_per_day: 20, scans_per_day: 5 };

export function limitsFor(stored: Partial<Limits> | null | undefined): Limits {
  return { ...DEFAULT_LIMITS, ...(stored ?? {}) };
}

function randomChars(n: number): string {
  // Rejection sampling, so every glyph is equally likely.
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let out = '';
  while (out.length < n) {
    for (const b of randomBytes(n * 2)) {
      if (b < limit && out.length < n) out += ALPHABET[b % ALPHABET.length];
    }
  }
  return out;
}

/** A new key, formatted for people: DEMO-K7QX-M3RD-9WTF. */
export function generateKey(): string {
  const r = randomChars(LENGTH);
  return `DEMO-${r.slice(0, 4)}-${r.slice(4, 8)}-${r.slice(8, 12)}`;
}

export const KEY_ENTROPY_BITS = Math.log2(ALPHABET.length ** LENGTH);

/**
 * The twelve random characters from whatever someone pasted: case, spaces,
 * dashes and the DEMO- prefix are forgiven; anything else fails.
 */
export function normaliseKey(input: string): string | null {
  let s = String(input ?? '').toUpperCase().replace(/[\s-]/g, '');
  if (s.startsWith('DEMO')) s = s.slice(4);
  if (s.length !== LENGTH) return null;
  for (const c of s) if (!ALPHABET.includes(c)) return null;
  return s;
}

export function hashKey(normalised: string): string {
  return createHash('sha256').update(`nabl-demo:${normalised}`).digest('hex');
}

export const prefixOf = (normalised: string) => normalised.slice(0, 4);

// ── Sessions ──────────────────────────────────────────────────────────────
// The cookie carries the key's id and an expiry, signed. The key itself is
// never in the browser after the first request.

export interface Session {
  keyId: string;
  exp: number;
}

export function signSession(s: Session, secret: string): string {
  const body = Buffer.from(JSON.stringify({ k: s.keyId, e: s.exp })).toString('base64url');
  const mac = createHmac('sha256', secret).update(`demo:${body}`).digest('base64url');
  return `${body}.${mac}`;
}

export function readSession(token: string | undefined, secret: string, now = Date.now()): Session | null {
  if (!token) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const want = Buffer.from(createHmac('sha256', secret).update(`demo:${body}`).digest('base64url'));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const j = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof j.k !== 'string' || typeof j.e !== 'number' || j.e < now) return null;
    return { keyId: j.k, exp: j.e };
  } catch {
    return null;
  }
}

/** Hashed so the throttle table never holds an address. */
export function ipHash(ip: string, secret: string): string {
  return createHmac('sha256', secret).update(`ip:${ip}`).digest('hex').slice(0, 24);
}

/** The throttle's rule: 10 misses per address, or 25 per key prefix, in 15 minutes. */
export const THROTTLE = { windowMinutes: 15, perIp: 10, perPrefix: 25 };
