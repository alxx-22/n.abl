// The team's side: the console for our own demo businesses, and issuing and
// revoking prospects' keys. Everything under /demo/api/admin, behind
// CONSOLE_PASSWORD (open when it is unset, for local development).

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Ctx } from './context.ts';
import { BASE, HttpError, cookie, eventStream, json, readJson, setCookie, SECURITY_HEADERS } from './http.ts';
import { tenantState } from './state.ts';
import { seedDiary } from '../db/seed.ts';
import { applySettings } from '../domain/settings.ts';
import { LIVE_MODELS, REPLY_SPEEDS, VOICES, VOICE_NAMES } from '../domain/voices.ts';
import { previewVoice } from '../core/preview.ts';
import { ingestWebsite } from '../ingest/ingest.ts';
import type { TenantProfile } from '../domain/types.ts';
import { DEFAULT_LIMITS, generateKey, hashKey, limitsFor, normaliseKey, prefixOf, type KeyKind, type Limits } from '../demo/access.ts';
import { ScoutError, scanProgress, startScan } from '../scout/scan.ts';
import { scanView } from '../scout/map.ts';

export const ADMIN = `${BASE}/api/admin`;

function adminToken(secret: string): string {
  return createHmac('sha256', secret).update('console').digest('base64url');
}

export function isAdmin(req: IncomingMessage, ctx: Ctx): boolean {
  if (!ctx.config.consolePassword) return true;
  const got = Buffer.from(cookie(req, 'va_session') ?? '');
  const want = Buffer.from(adminToken(ctx.config.sessionSecret));
  return got.length === want.length && timingSafeEqual(got, want);
}

function validProfile(p: any): p is TenantProfile {
  return (
    p && typeof p === 'object' && typeof p.slug === 'string' && /^[a-z0-9-]{2,40}$/.test(p.slug) &&
    typeof p.name === 'string' && typeof p.greeting === 'string' && Array.isArray(p.core_facts) &&
    Array.isArray(p.opening_hours) && Array.isArray(p.knowledge) && typeof p.timezone === 'string'
  );
}

export function publicConfig(ctx: Ctx) {
  const c = ctx.config;
  return {
    models: c.liveModels,
    demo_cards: c.demoCards.map((d) => ({ ...d, spoken: d.number.replace(/(\d{4})(?=\d)/g, '$1 ') })),
    telephony: Boolean(c.twilio),
    sms: Boolean(c.twilio?.smsFrom),
    active_calls: ctx.bus.activeCalls(),
    max_calls: ctx.maxCalls,
    gemini_key: ctx.keyStatus(),
  };
}

export async function voicePreview(ctx: Ctx, res: ServerResponse, profile: TenantProfile, body: any): Promise<void> {
  const { voice, greeting, language_code } = body ?? {};
  if (typeof voice !== 'string' || !VOICE_NAMES.has(voice)) throw new HttpError(400, 'Unknown voice.');
  const text = typeof greeting === 'string' && greeting.trim() ? greeting.trim().slice(0, 300) : profile.greeting;
  const lang = language_code === null || language_code === '' ? undefined : typeof language_code === 'string' ? language_code : profile.language_code ?? 'en-GB';
  const wav = await previewVoice(voice, text, ctx.config, lang ?? undefined);
  res.writeHead(200, { 'content-type': 'audio/wav', 'cache-control': 'no-store', ...SECURITY_HEADERS });
  res.end(wav);
}

export const voiceMeta = (ctx: Ctx) => ({ voices: VOICES, reply_speeds: REPLY_SPEEDS, models: LIVE_MODELS, default_models: ctx.config.liveModels });

/** Returns false if the path is not an admin route. */
export async function handleAdmin(ctx: Ctx, req: IncomingMessage, res: ServerResponse, path: string, url: URL): Promise<boolean> {
  if (!path.startsWith(ADMIN)) return false;
  const p = path.slice(ADMIN.length) || '/';
  const { repo, demo, bus, config } = ctx;

  if (p === '/login' && req.method === 'POST') {
    const { password } = await readJson(req);
    const want = Buffer.from(config.consolePassword ?? '');
    const got = Buffer.from(String(password ?? ''));
    if (config.consolePassword && (want.length !== got.length || !timingSafeEqual(want, got))) throw new HttpError(401, 'That password did not work.');
    setCookie(res, 'va_session', adminToken(config.sessionSecret), { maxAge: 30 * 86400, secure: Boolean(config.publicBaseUrl?.startsWith('https')) });
    json(res, 200, { ok: true });
    return true;
  }
  if (!isAdmin(req, ctx)) throw new HttpError(401, 'Sign in to the team console.');

  if (p === '/config') return json(res, 200, { ...publicConfig(ctx), numbers: await repo.listNumbers() }), true;
  if (p === '/voices') return json(res, 200, voiceMeta(ctx)), true;
  if (p === '/ingest' && req.method === 'POST') {
    const { url: site } = await readJson(req);
    return json(res, 200, { profile: await ingestWebsite(String(site ?? ''), config) }), true;
  }
  // Read a prospect's website before issuing their key, so their builder opens instantly (the result is cached).
  if (p === '/scout' && req.method === 'POST') {
    const { url: site } = await readJson(req);
    try {
      const id = await startScan({ demo, config }, String(site ?? ''), null);
      return json(res, 200, { scan: scanView((await demo.getScan(id))!, scanProgress(id)) }), true;
    } catch (err) {
      if (err instanceof ScoutError) throw new HttpError(400, err.message);
      throw err;
    }
  }
  const scoutView = /^\/scout\/([0-9a-f-]{36})$/.exec(p);
  if (scoutView) {
    const scan = await demo.getScan(scoutView[1]);
    if (!scan) throw new HttpError(404, 'No such scan.');
    return json(res, 200, { scan: scanView(scan, scanProgress(scan.id)), result: scan.result }), true;
  }
  const call = /^\/calls\/([0-9a-f-]{36})\/events$/.exec(p);
  if (call) return json(res, 200, { events: await repo.listEvents(call[1]) }), true;

  // ── Keys for prospects ──────────────────────────────────────────────
  if (p === '/keys' && req.method === 'GET') {
    const keys = await demo.listKeys();
    return json(res, 200, { keys: keys.map((k) => ({ ...k, key_hash: undefined })) }), true;
  }
  if (p === '/keys' && req.method === 'POST') {
    const b = await readJson(req);
    const person = String(b.person_name ?? '').trim().slice(0, 80);
    if (!person) throw new HttpError(400, b.kind === 'shared' ? 'Name the shared key (who or what it is for, e.g. "Hospitality expo, October").' : 'Who is the key for? Give a name.');
    const kind: KeyKind = b.kind === 'shared' ? 'shared' : 'private';
    const days = Math.min(90, Math.max(1, Number(b.days ?? DEFAULT_LIMITS[kind].days)));
    const limits: Partial<Limits> = {};
    for (const k of ['call_minutes_per_day', 'total_call_minutes_per_day', 'workspaces', 'drafts_per_day', 'scans_per_day'] as const) {
      if (b.limits?.[k] !== undefined) limits[k] = Math.min(1000, Math.max(0, Number(b.limits[k])));
    }
    const raw = generateKey();
    const n = normaliseKey(raw)!;
    const key = await demo.createKey({
      hash: hashKey(n), prefix: prefixOf(n), person_name: person, kind,
      company: String(b.company ?? '').trim().slice(0, 80) || null, email: String(b.email ?? '').trim().slice(0, 120) || null,
      crm_lead_id: String(b.crm_lead_id ?? '').trim().slice(0, 80) || null, issued_by: String(b.issued_by ?? 'console').slice(0, 60),
      notes: String(b.notes ?? '').trim().slice(0, 500) || null, limits, expires_at: new Date(Date.now() + days * 86400000),
    });
    const origin = config.publicBaseUrl ?? `http://${req.headers.host}`;
    // The key rides after the #, which never reaches a server log or another site.
    return json(res, 201, { key: raw, link: `${origin}${BASE}/reception`, magic_link: `${origin}${BASE}/reception#key=${raw}`, record: { ...key, limits: limitsFor(key.limits, key.kind) } }), true;
  }
  const keyAction = /^\/keys\/([0-9a-f-]{36})(?:\/(revoke|extend|usage))?$/.exec(p);
  if (keyAction) {
    const k = await demo.keyById(keyAction[1]);
    if (!k) throw new HttpError(404, 'No such key.');
    if (keyAction[2] === 'revoke' && req.method === 'POST') return await demo.revokeKey(k.id), json(res, 200, { ok: true }), true;
    if (keyAction[2] === 'extend' && req.method === 'POST') {
      const { days } = await readJson(req);
      await demo.extendKey(k.id, Math.min(90, Math.max(1, Number(days ?? 7))));
      return json(res, 200, { ok: true, key: await demo.keyById(k.id) }), true;
    }
    if (keyAction[2] === 'usage') {
      const ws = await demo.listWorkspaces(k.id);
      return json(res, 200, {
        key: k, usage: await demo.listUsage(k.id),
        workspaces: ws.map((w) => ({ id: w.tenant.id, slug: w.tenant.slug, name: w.tenant.profile.name, preset: w.preset, started_at: w.started_at })),
      }), true;
    }
  }

  // ── Our own demo businesses (and, for support, any workspace) ───────
  const m = /^\/tenants(?:\/([a-z0-9-]+))?(?:\/(state|reset|events|settings|voice-preview))?$/.exec(p);
  if (m && !m[1] && req.method === 'GET') {
    const all = await repo.listTenants();
    const owned = new Set((await demo.db.query<{ slug: string }>('select slug from public.voice_tenants where owner_key_id is not null')).map((r) => r.slug));
    return json(res, 200, { tenants: all.filter((t) => url.searchParams.get('all') === '1' || !owned.has(t.slug)) }), true;
  }
  if (m && m[1]) {
    const t = await repo.getTenant(m[1]);
    if (!t) throw new HttpError(404, 'No such business.');
    if (!m[2] && req.method === 'GET') return json(res, 200, { profile: t.profile }), true;
    if (!m[2] && req.method === 'PUT') {
      const profile = await readJson(req);
      if (!validProfile(profile) || profile.slug !== m[1]) throw new HttpError(400, 'That is not a valid profile.');
      await repo.upsertTenant(profile);
      return json(res, 200, { ok: true }), true;
    }
    if (m[2] === 'state') return json(res, 200, await tenantState(repo, t, bus)), true;
    if (m[2] === 'events') return eventStream(req, res, bus, t.id), true;
    if (m[2] === 'reset' && req.method === 'POST') {
      await repo.resetTenantData(t.id);
      const made = await seedDiary(repo, t, new Date());
      bus.publish({ type: 'refresh', tenant_id: t.id, call_id: '', at: new Date().toISOString() });
      return json(res, 200, { ok: true, bookings: made }), true;
    }
    if (m[2] === 'settings' && req.method === 'PATCH') {
      const r = applySettings(t.profile, await readJson(req));
      if (!r.ok) throw new HttpError(400, r.error);
      await repo.upsertTenant(r.profile);
      return json(res, 200, { ok: true, profile: r.profile }), true;
    }
    if (m[2] === 'voice-preview' && req.method === 'POST') return await voicePreview(ctx, res, t.profile, await readJson(req)), true;
  }
  throw new HttpError(404, 'Not found.');
}
