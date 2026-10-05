// The prospect's side: everything under /demo/api that a key opens. A key
// becomes a signed session cookie; every route below resolves that cookie to
// a key and only ever touches workspaces the key owns. The team (signed in to
// the console) can open any workspace, for support.
//
// Routes are listed in DEMO-SERVICE-PLAN.md §6.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import type { Ctx } from './context.ts';
import { BASE, HttpError, clientIp, cookie, eventStream, json, overHttps, readJson, sameOrigin, setCookie } from './http.ts';
import { isAdmin, voiceMeta, voicePreview } from './admin.ts';
import { tenantState } from './state.ts';
import { jobAction } from './maintenance.ts';
import type { DemoKey, Workspace } from '../db/demo-repo.ts';
import { SHARED_DEMO_MINUTES, SHARED_DRAFT_MINUTES, THROTTLE, hashKey, ipHash, newVisitor, normaliseKey, prefixOf, readSession, signSession, withFreePin } from '../demo/access.ts';
import { PRESETS, answersOf, builtPreset, getPreset, type BaseAnswers, type Preset } from '../presets/index.ts';
import { draftFaqs } from '../presets/common/drafts.ts';
import { PresetError } from '../presets/common/errors.ts';
import { seedFrom } from '../presets/common/random.ts';
import { applySettings, type SettingsPatch } from '../domain/settings.ts';
import { CHECK_KEYS, SALE_MILESTONES, type ListingStatus, type OfferStatus, type Tenant, type TenantProfile } from '../domain/types.ts';
import { matches, priceWords, shortAddress } from '../domain/listings.ts';
import { addDays, isIsoDate, spokenDate, spokenTime, toLocal, zonedToUtc } from '../domain/time.ts';
import { displayUkPhone, normaliseUkPhone } from '../domain/phone.ts';
import { SimulatedSms } from '../channels/sms.ts';
import { ScoutError, scanProgress, startScan, type ScanResult } from '../scout/scan.ts';
import { scanView, type ScanPart } from '../scout/map.ts';

export const API = `${BASE}/api`;
export const SESSION_COOKIE = 'demo_s';
/** A session lasts a week at most, and never beyond the key. */
const SESSION_DAYS = 7;
/** Concurrent demo calls on the whole server, and per key (plan §3.4). */
export const DEMO_CALLS_TOTAL = Number(process.env.DEMO_MAX_CALLS ?? 4);
export const DEMO_CALLS_PER_KEY = 1;

/** Prospects' calls never text a real phone: the demo's phone mockup shows them instead. */
export const demoSms = new SimulatedSms();

// ── What a workspace stores ───────────────────────────────────────────────

/** voice_tenants.config for a workspace. */
export interface WorkspaceConfig {
  preset: string;
  /** Always 1, and not read: the answers carry their own version (answersOf). */
  version: 1;
  answers: unknown;
  /** Call settings the builder does not ask about: language, reply speed, model, turn-taking. */
  settings?: SettingsPatch;
  /** The website read for this workspace, if the prospect gave one. */
  scan?: { id: string; url: string };
}

function configOf(w: Workspace): WorkspaceConfig {
  const c = (w.config ?? {}) as Partial<WorkspaceConfig>;
  return { preset: c.preset ?? w.preset ?? 'restaurant', version: 1, answers: c.answers ?? {}, settings: c.settings, scan: c.scan };
}

/** The profile the receptionist runs on: the preset's compile, then the call settings. */
export function buildProfile(preset: Preset, answers: BaseAnswers, slug: string, settings?: SettingsPatch): TenantProfile {
  const profile = preset.compile(answers, { slug });
  if (!settings) return profile;
  const r = applySettings(profile, settings);
  return r.ok ? r.profile : profile;
}

const slugPart = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);

/**
 * Recompiles a workspace from its answers and saves both. The demo line's
 * PIN and the call settings are never the builder's to change, so they are
 * always kept; Start passes a PIN when the workspace has none yet.
 */
async function rebuild(ctx: Ctx, w: Workspace, preset: Preset, answers: BaseAnswers, settings = configOf(w).settings, pin = w.tenant.profile.demo_pin): Promise<{ workspace: Workspace; profile: TenantProfile }> {
  const profile = buildProfile(preset, answers, w.tenant.slug, settings);
  if (pin) profile.demo_pin = pin;
  const workspace = await ctx.demo.saveWorkspace(w.tenant.id, profile, { ...configOf(w), answers, settings } satisfies WorkspaceConfig);
  return { workspace, profile };
}

/**
 * Start's rebuild: a workspace keeps its PIN; the first Start draws one no
 * other business holds.
 */
async function startProfile(ctx: Ctx, w: Workspace, preset: Preset, answers: BaseAnswers, settings: SettingsPatch | undefined) {
  if (w.tenant.profile.demo_pin) return rebuild(ctx, w, preset, answers, settings);
  return withFreePin((pin) => ctx.demo.pinTaken(pin), (pin) => rebuild(ctx, w, preset, answers, settings, pin));
}

// ── Sessions ──────────────────────────────────────────────────────────────

const usable = (k: DemoKey | null, now = Date.now()): k is DemoKey => Boolean(k && !k.revoked_at && k.expires_at.getTime() > now);

/** Who is asking: the key, and on a shared key which person (browser) it is. */
export interface Who {
  key: DemoKey;
  visitor: string | null;
}

/** The key (and visitor) behind this request's session cookie, if it is still good. */
export async function sessionWho(ctx: Ctx, req: IncomingMessage): Promise<Who | null> {
  const s = readSession(cookie(req, SESSION_COOKIE), ctx.config.sessionSecret);
  if (!s) return null;
  const k = await ctx.demo.keyById(s.keyId);
  if (!usable(k)) return null;
  // A shared key's session always names its person; without one it opens nothing.
  if (k.kind === 'shared' && !s.visitor) return null;
  return { key: k, visitor: k.kind === 'shared' ? s.visitor! : null };
}

/** A workspace belongs to its key, and on a shared key to the one person who made it. */
export const owns = (w: Workspace, who: Who) =>
  w.owner_key_id === who.key.id && (who.key.kind !== 'shared' || w.owner_visitor === who.visitor);

/** A shared demo past its hour is gone, even before the sweeper has deleted it. */
export const ended = (w: Workspace, now = Date.now()) => Boolean(w.expires_at && w.expires_at.getTime() <= now);

const secureCookies = (ctx: Ctx, req: IncomingMessage) => overHttps(ctx.config, req);

// ── Limits ────────────────────────────────────────────────────────────────

async function usedToday(ctx: Ctx, who: Who) {
  const { key, visitor } = who;
  const [callSeconds, drafts, scans, workspaces] = await Promise.all([
    ctx.demo.callSeconds24h(key.id, visitor),
    ctx.demo.countUsage(key.id, ['menu_draft', 'faq_draft'], 24, visitor),
    ctx.demo.countUsage(key.id, ['scouted'], 24, visitor),
    ctx.demo.listWorkspaces(key.id, visitor),
  ]);
  return { call_seconds: callSeconds, drafts, scans, workspaces: workspaces.length };
}

/** Seconds of calling left today: per person, and on a shared key within everyone's total too. */
/** Call seconds left today, and whose allowance runs out first: this person's, or (shared keys) the whole link's. */
export async function callSecondsLeft(ctx: Ctx, who: Who): Promise<{ seconds: number; by: 'person' | 'link' }> {
  const mine = who.key.limits.call_minutes_per_day * 60 - (await ctx.demo.callSeconds24h(who.key.id, who.visitor));
  if (who.key.kind !== 'shared') return { seconds: Math.max(0, mine), by: 'person' };
  const all = who.key.limits.total_call_minutes_per_day * 60 - (await ctx.demo.callSeconds24h(who.key.id));
  return { seconds: Math.max(0, Math.min(mine, all)), by: all < mine ? 'link' : 'person' };
}

/** Live demo calls per person (key, and visitor on a shared key), held while the socket is open. */
export const callsByKey = new Map<string, number>();
export const callerId = (who: Who) => `${who.key.id}:${who.visitor ?? ''}`;

// Per-workspace pacing for saves (plan: one a second) and for usage rows.
const lastSave = new Map<string, number>();
const lastSaveLogged = new Map<string, number>();
const lastPreview = new Map<string, number>();

// ── Helpers ───────────────────────────────────────────────────────────────

function mePayload(k: DemoKey, used: Awaited<ReturnType<typeof usedToday>>) {
  return {
    kind: k.kind,
    person_name: k.person_name,
    company: k.company,
    products: k.products,
    expires_at: k.expires_at.toISOString(),
    limits: k.limits,
    // How long a shared demo lives: after Start, and as a draft before it.
    shared: k.kind === 'shared' ? { demo_minutes: SHARED_DEMO_MINUTES, draft_minutes: SHARED_DRAFT_MINUTES } : null,
    used: { call_minutes: Math.ceil(used.call_seconds / 60), drafts: used.drafts, scans: used.scans, workspaces: used.workspaces },
  };
}

function workspaceSummary(w: Workspace) {
  const p = w.tenant.profile;
  return {
    id: w.tenant.id, slug: w.tenant.slug, preset: w.preset, name: p.name, accent: p.brand?.accent ?? null,
    started_at: w.started_at?.toISOString() ?? null, updated_at: w.updated_at.toISOString(),
    expires_at: w.expires_at?.toISOString() ?? null,
  };
}

/** What the builder's preview pane shows, from the workspace's preset. Exported for the restaurant goldens. */
export function preview(w: Pick<Workspace, 'preset'>, profile: TenantProfile, answers: BaseAnswers) {
  const preset = builtPreset(w.preset ?? '');
  return preset ? preset.preview(answers, profile) : null;
}

function workspacePayload(w: Workspace) {
  const cfg = configOf(w);
  const preset = getPreset(cfg.preset);
  const answers = preset ? answersOf(preset, cfg.answers) : null;
  return {
    ...workspaceSummary(w),
    answers: answers ?? cfg.answers,
    settings: cfg.settings ?? {},
    issues: preset && answers ? preset.validate(answers) : [],
    preview: preset && answers ? preset.preview(answers, w.tenant.profile) : null,
    profile: {
      voice: w.tenant.profile.voice, greeting: w.tenant.profile.greeting, language_code: w.tenant.profile.language_code,
      reply_speed: w.tenant.profile.reply_speed, live_model: w.tenant.profile.live_model, turn_taking: w.tenant.profile.turn_taking,
      demo_pin: w.tenant.profile.demo_pin, phone_display: w.tenant.profile.phone_display,
    },
  };
}

// ── The routes ────────────────────────────────────────────────────────────

/** Returns false if the path is not a prospect route. */
export async function handleDemo(ctx: Ctx, req: IncomingMessage, res: ServerResponse, path: string, url: URL): Promise<boolean> {
  if (!path.startsWith(`${API}/`) || path.startsWith(`${API}/admin`)) return false;
  const p = path.slice(API.length);
  const { demo, repo, config, bus } = ctx;
  if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) throw new HttpError(403, 'Cross-site request refused.');

  // ── Entering with a key (the only open route) ─────────────────────────
  if (p === '/session' && req.method === 'POST') {
    const { key: raw } = await readJson(req, 10_000);
    const ip = ipHash(clientIp(req, config.demoProxySecret, config.clientIpHeader), config.sessionSecret);
    const n = normaliseKey(String(raw ?? ''));
    const prefix = n ? prefixOf(n) : '----';
    const misses = await demo.recentMisses(ip, prefix, THROTTLE.windowMinutes);
    // Too many wrong keys from one address: stop checking altogether for a while.
    if (misses.ip >= THROTTLE.perIp) throw new HttpError(429, 'Too many tries. Wait fifteen minutes, or ask us for a fresh link.');
    const k = n ? await demo.keyByHash(hashKey(n)) : null;
    if (!k || k.revoked_at || k.expires_at.getTime() <= Date.now()) {
      await demo.recordAttempt(ip, prefix, false);
      if (k?.revoked_at) throw new HttpError(401, 'That key has been switched off. Ask us for a new one.');
      if (k) throw new HttpError(401, `That key expired on ${k.expires_at.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}. Ask us to extend it.`);
      if (misses.prefix + 1 >= THROTTLE.perPrefix) throw new HttpError(429, 'Too many tries. Wait fifteen minutes, or ask us for a fresh link.');
      throw new HttpError(401, 'That key did not work. Check it against the email, or ask us for a fresh link.');
    }
    await demo.recordAttempt(ip, prefix, true);
    await demo.touchKey(k.id);
    // A shared key: each browser is its own person. Entering the key again keeps the same one.
    let visitor: string | null = null;
    if (k.kind === 'shared') {
      const prev = readSession(cookie(req, SESSION_COOKIE), config.sessionSecret);
      visitor = prev && prev.keyId === k.id && prev.visitor ? prev.visitor : newVisitor();
    }
    await demo.recordUsage(k.id, null, 'opened', {}, visitor);
    if (Math.random() < 0.05) void demo.pruneAttempts().catch(() => {});
    const exp = Math.min(k.expires_at.getTime(), Date.now() + SESSION_DAYS * 86400000);
    setCookie(res, SESSION_COOKIE, signSession({ keyId: k.id, exp, visitor }, config.sessionSecret), { maxAge: (exp - Date.now()) / 1000, secure: secureCookies(ctx, req) });
    return json(res, 200, mePayload(k, await usedToday(ctx, { key: k, visitor }))), true;
  }
  if (p === '/session' && req.method === 'DELETE') {
    setCookie(res, SESSION_COOKIE, '', { maxAge: 0, secure: secureCookies(ctx, req) });
    return json(res, 200, { ok: true }), true;
  }

  // ── Everything else needs a session (or the team) ─────────────────────
  const who = await sessionWho(ctx, req);
  const key = who?.key ?? null;
  const admin = !who && isAdmin(req, ctx);
  if (!who && !admin) throw new HttpError(401, 'Your session has ended. Enter your key again.');

  if (p === '/me') {
    if (!who) throw new HttpError(401, 'Enter your key.');
    const ws = await demo.listWorkspaces(who.key.id, who.visitor);
    return json(res, 200, { ...mePayload(who.key, await usedToday(ctx, who)), workspaces: ws.map(workspaceSummary) }), true;
  }
  if (p === '/presets') return json(res, 200, { presets: PRESETS }), true;
  if (p === '/voices') return json(res, 200, voiceMeta(ctx)), true;
  if (p === '/config') {
    return json(res, 200, {
      demo_cards: config.demoCards.map((d) => ({ ...d, spoken: d.number.replace(/(\d{4})(?=\d)/g, '$1 ') })),
      gemini_key: ctx.keyStatus(),
      lines_busy: bus.activeCalls() >= ctx.maxCalls,
    }), true;
  }

  if (p === '/workspaces' && req.method === 'GET') {
    if (!who) throw new HttpError(400, 'The team opens workspaces from the console.');
    return json(res, 200, { workspaces: (await demo.listWorkspaces(who.key.id, who.visitor)).map(workspaceSummary) }), true;
  }
  if (p === '/workspaces' && req.method === 'POST') {
    if (!who || !key) throw new HttpError(400, 'Workspaces belong to a key.');
    const b = await readJson(req, 10_000);
    const preset = getPreset(String(b.preset ?? ''));
    if (!preset) throw new HttpError(400, 'That kind of business is not ready yet.');
    const existing = await demo.listWorkspaces(key.id, who.visitor);
    if (existing.length >= key.limits.workspaces) {
      // Trying a different demo is a reset: the one it replaces goes, with everything it made.
      const replace = typeof b.replace === 'string' ? existing.find((x) => x.tenant.id === b.replace) : undefined;
      if (!replace) {
        return json(res, 409, {
          error: `Starting another demo replaces ${existing.length === 1 ? 'your current one' : 'one of yours'}, with its bookings, orders and calls.`,
          code: 'replace',
          workspaces: existing.map(workspaceSummary),
        }), true;
      }
      if (bus.activeFor(replace.tenant.id).length) throw new HttpError(409, 'Hang up the call first.');
      await demo.deleteWorkspace(replace.tenant.id);
      bus.publish({ type: 'refresh', tenant_id: replace.tenant.id, call_id: '', at: new Date().toISOString(), reason: 'deleted' });
      await demo.recordUsage(key.id, null, 'reset', { replaced: replace.tenant.id }, who.visitor);
    }
    const answers = preset.defaults();
    answers.basics.name = String(b.name ?? key.company ?? '').trim().slice(0, 60);
    if (typeof b.website === 'string' && b.website.trim()) answers.basics.website = b.website.trim().slice(0, 200);
    const clean = answersOf(preset, answers);
    // A key such as estate_agent is not a slug: the database allows only letters, digits and hyphens.
    const slug = `demo-${key.key_prefix.toLowerCase()}-${slugPart(answers.basics.name) || slugPart(preset.info.key)}-${randomBytes(2).toString('hex')}`;
    const profile = buildProfile(preset, clean, slug);
    const w = await demo.createWorkspace(key.id, preset.info.key, profile, { preset: preset.info.key, version: 1, answers: clean } satisfies WorkspaceConfig, {
      visitor: who.visitor,
      // A shared demo's draft is kept a while; pressing Start sets its hour.
      expiresAt: key.kind === 'shared' ? new Date(Date.now() + SHARED_DRAFT_MINUTES * 60000) : null,
    });
    await demo.recordUsage(key.id, w.tenant.id, 'workspace_created', { preset: preset.info.key, website: Boolean(answers.basics.website) }, who.visitor);
    return json(res, 201, workspacePayload(w)), true;
  }

  // The last part: a booking or offer reference, a message's id, or a home's key ("albion_41_flat_2").
  const m = /^\/workspaces\/([0-9a-f-]{36})(?:\/([a-z-]+)(?:\/([A-Za-z0-9+_]{1,48}|[0-9a-f-]{36}))?)?$/.exec(p);
  if (!m) throw new HttpError(404, 'Not found.');
  const w = await demo.getWorkspace(m[1]);
  // Someone else's workspace looks exactly like a missing one.
  if (!w || (!admin && !owns(w, who!))) throw new HttpError(404, 'No such demo business.');
  if (ended(w)) throw new HttpError(410, 'This demo has ended: shared demos are deleted an hour after Start. You can build another.');
  const t = w.tenant;
  const cfg = configOf(w);
  const preset = getPreset(cfg.preset);
  if (!preset) throw new HttpError(409, 'This demo was made with a preset that is no longer available.');
  const ownerId = w.owner_key_id ?? key?.id ?? null;
  const usage = (kind: Parameters<typeof demo.recordUsage>[2], data: Record<string, unknown> = {}) =>
    ownerId && !admin ? demo.recordUsage(ownerId, t.id, kind, data, w.owner_visitor).catch(() => {}) : Promise.resolve();
  const refresh = (data: Record<string, unknown> = {}) => bus.publish({ type: 'refresh', tenant_id: t.id, call_id: '', at: new Date().toISOString(), ...data });
  const [, , sub, ref] = m;

  if (!sub && req.method === 'GET') return json(res, 200, workspacePayload(w)), true;
  if (!sub && req.method === 'DELETE') {
    if (bus.activeFor(t.id).length) throw new HttpError(409, 'Hang up the call first.');
    await demo.deleteWorkspace(t.id);
    return json(res, 200, { ok: true }), true;
  }

  // ── The builder ───────────────────────────────────────────────────────
  // A fresh set of the preset's answers: the estate agent's "Start from the sample" takes its homes from these.
  if (sub === 'defaults' && req.method === 'GET') return json(res, 200, { answers: answersOf(preset, preset.defaults()) }), true;
  if (sub === 'answers' && req.method === 'PUT') {
    const now = Date.now();
    if (now - (lastSave.get(t.id) ?? 0) < 800) throw new HttpError(429, 'Saving too fast; try again in a moment.');
    lastSave.set(t.id, now);
    const answers = answersOf(preset, await readJson(req, 1_500_000));
    const { workspace: saved, profile } = await rebuild(ctx, w, preset, answers);
    // A running estate demo: homes added, removed, or repriced in the builder reach the back office and the calls.
    if (w.started_at && profile.listings) await repo.syncListings(t.id, profile, new Date());
    if (now - (lastSaveLogged.get(t.id) ?? 0) > 10 * 60000) {
      lastSaveLogged.set(t.id, now);
      void usage('config_saved');
    }
    if (w.started_at) refresh({ reason: 'config' });
    return json(res, 200, workspacePayload(saved)), true;
  }
  if (sub === 'menu-draft' && req.method === 'POST') {
    const draft = preset.draft;
    if (!draft) throw new HttpError(404, 'There is nothing to draft for this kind of business.');
    await spendDraft(ctx, who, admin);
    const current = answersOf(preset, cfg.answers);
    const brief = await readJson(req, 20_000);
    let section: unknown;
    try {
      section = await draft.run(brief, current, config);
    } catch (err) {
      if (err instanceof PresetError) throw new HttpError(err.status, err.message);
      throw new HttpError(502, draftError(err));
    }
    void usage('menu_draft', { catalogue: draft.label, ...draft.counts(section) });
    return json(res, 200, { [draft.label]: section }), true;
  }
  if (sub === 'faq-draft' && req.method === 'POST') {
    await spendDraft(ctx, who, admin);
    const body = await readJson(req, 1_500_000);
    const answers = answersOf(preset, body?.answers ?? cfg.answers);
    try {
      const faqs = await draftFaqs(preset.factSheet(answers), preset.info.noun, preset.handles, config);
      void usage('faq_draft', { faqs: faqs.length });
      return json(res, 200, { faqs }), true;
    } catch (err) {
      throw new HttpError(502, draftError(err));
    }
  }

  // ── Build from the website: the scout ─────────────────────────────────
  if (sub === 'scout' && !ref && req.method === 'GET') {
    const scan = cfg.scan ? await demo.getScan(cfg.scan.id) : null;
    return json(res, 200, { scan: scan ? scanView(scan, scanProgress(scan.id), preset.scan.parts.includes('menu')) : null }), true;
  }
  if (sub === 'scout' && !ref && req.method === 'POST') {
    const { url: site } = await readJson(req, 10_000);
    if (typeof site !== 'string' || !site.trim()) throw new HttpError(400, 'Which website?');
    if (!admin && key) {
      const n = await demo.countUsage(key.id, ['scouted'], 24, who?.visitor ?? null);
      if (n >= key.limits.scans_per_day) throw new HttpError(429, `That's the ${key.limits.scans_per_day} website reads this key has for today. Fill in the steps by hand, or try tomorrow.`);
    }
    let id: string;
    try {
      id = await startScan({ demo, config, ...ctx.scoutTest }, site, ownerId);
    } catch (err) {
      if (err instanceof ScoutError) throw new HttpError(400, err.message);
      throw err;
    }
    await demo.saveWorkspace(t.id, t.profile, { ...cfg, scan: { id, url: site.trim().slice(0, 200) } } satisfies WorkspaceConfig);
    void usage('scouted', { site: site.trim().slice(0, 200) });
    const scan = (await demo.getScan(id))!;
    return json(res, 200, { scan: scanView(scan, scanProgress(id), preset.scan.parts.includes('menu')) }), true;
  }
  if (sub === 'scout' && ref === 'apply' && req.method === 'POST') {
    const body = await readJson(req, 10_000);
    const scan = cfg.scan && cfg.scan.id === body.scan ? await demo.getScan(cfg.scan.id) : null;
    if (!scan || scan.status !== 'done') throw new HttpError(409, 'That website read has not finished.');
    const use = Object.fromEntries(preset.scan.parts.map((k) => [k, body.use?.[k] === true])) as Record<ScanPart, boolean>;
    const answers = answersOf(preset, preset.scan.apply(answersOf(preset, cfg.answers), scan.result as ScanResult, use));
    const { workspace: saved } = await rebuild(ctx, w, preset, answers);
    if (w.started_at) refresh({ reason: 'config' });
    return json(res, 200, workspacePayload(saved)), true;
  }

  // ── Start and reset: compile, then fill the diary ─────────────────────
  if ((sub === 'start' || sub === 'reset') && req.method === 'POST') {
    if (bus.activeFor(t.id).length) throw new HttpError(409, 'Hang up the call first.');
    const answers = answersOf(preset, cfg.answers);
    const errors = preset.validate(answers).filter((i) => i.level === 'error');
    if (errors.length) return json(res, 400, { error: errors[0].message, issues: errors }), true;
    const { profile } = await startProfile(ctx, w, preset, answers, cfg.settings);
    await repo.resetTenantData(t.id);
    // A fresh seed each time: Reset shows a different week, still believable.
    const plan = preset.seed(profile, new Date(), seedFrom(`${t.id}:${Date.now()}`));
    await repo.insertSeed(t.id, plan);
    await demo.markStarted(t.id);
    // A shared demo's hour starts the first time its data is made; Reset does not extend it.
    if (w.owner_visitor && !w.started_at) await demo.setExpiry(t.id, new Date(Date.now() + SHARED_DEMO_MINUTES * 60000));
    void usage(sub === 'start' ? 'started' : 'reset', { bookings: plan.bookings.length, orders: plan.orders.length });
    refresh({ reason: sub });
    return json(res, 200, { ok: true, bookings: plan.bookings.length, orders: plan.orders.length, workspace: workspacePayload((await demo.getWorkspace(t.id))!) }), true;
  }

  // ── The live workspace ────────────────────────────────────────────────
  if (sub === 'state' && req.method === 'GET') {
    const state = await tenantState(repo, t, bus, preset.workspace(t.profile));
    return json(res, 200, { ...state, started_at: w.started_at?.toISOString() ?? null, expires_at: w.expires_at?.toISOString() ?? null }), true;
  }
  if (sub === 'events' && req.method === 'GET') return eventStream(req, res, bus, t.id), true;
  if (sub === 'settings' && req.method === 'PATCH') {
    const patch = (await readJson(req, 10_000)) as SettingsPatch;
    const r = applySettings(t.profile, patch);
    if (!r.ok) throw new HttpError(400, r.error);
    // Voice and greeting are builder answers too; the rest are call settings.
    const answers = answersOf(preset, cfg.answers);
    if (patch.voice !== undefined) answers.basics.voice = r.profile.voice;
    if (patch.greeting !== undefined) answers.basics.greeting = r.profile.greeting;
    const { voice: _v, greeting: _g, ...rest } = patch;
    const settings = { ...(cfg.settings ?? {}), ...rest };
    const { workspace: saved } = await rebuild(ctx, w, preset, answers, settings);
    return json(res, 200, workspacePayload(saved)), true;
  }
  if (sub === 'voice-preview' && req.method === 'POST') {
    const now = Date.now();
    if (now - (lastPreview.get(t.id) ?? 0) < 2500) throw new HttpError(429, 'One preview at a time.');
    lastPreview.set(t.id, now);
    return await voicePreview(ctx, res, t.profile, await readJson(req, 10_000)), true;
  }
  if (sub === 'phone' && req.method === 'GET') {
    const number = normaliseUkPhone(url.searchParams.get('number') ?? '');
    if (!number) return json(res, 200, { number: null, messages: [] }), true;
    const msgs = await repo.listTexts(t.id, number);
    return json(res, 200, { number: displayUkPhone(number), sender: t.profile.name, messages: msgs }), true;
  }

  // ── Staff actions from the back office ────────────────────────────────
  if (sub === 'bookings' && ref && req.method === 'PATCH') {
    const b = await readJson(req, 20_000);
    const booking = await repo.getBookingByReference(t.id, ref);
    if (!booking) throw new HttpError(404, 'That booking is not in the diary.');
    let message = '';
    if (b.action === 'move') {
      const r = await repo.moveBookingToTable(t, ref, String(b.table ?? ''));
      if (!r.ok) throw new HttpError(409, r.message);
      message = `Moved to ${t.profile.booking?.resources.find((x) => x.key === r.booking.resource_key)?.label ?? r.booking.resource_key}.`;
    } else if (b.action === 'combine') {
      if (!preset.combineTables) throw new HttpError(400, 'Nothing here can be pushed together.');
      // Push two tables together for this booking: the pair if it exists, or
      // join them in the setup (same area, both real) and then use the pair.
      const pair = await combineTables(ctx, w, preset, String(b.tables?.[0] ?? ''), String(b.tables?.[1] ?? ''));
      const fresh = (await demo.getWorkspace(t.id))!.tenant;
      const r = await repo.moveBookingToTable(fresh, ref, pair);
      if (!r.ok) throw new HttpError(409, r.message);
      message = `Now on ${fresh.profile.booking?.resources.find((x) => x.key === pair)?.label ?? pair}.`;
    } else if (b.action === 'visit') {
      const status = String(b.status ?? '');
      if (!['expected', 'arrived', 'seated', 'finished', 'no_show'].includes(status)) throw new HttpError(400, 'Unknown visit state.');
      if (booking.status !== 'confirmed') throw new HttpError(409, 'That booking was cancelled.');
      await repo.setVisitStatus(t.id, ref, status as 'expected');
      message = `Marked ${status.replace('_', '-')}.`;
    } else if (b.action === 'details') {
      const d: { notes?: string | null; allergies?: string | null; tags?: string[] } = {};
      if (b.notes !== undefined) d.notes = String(b.notes ?? '').trim().slice(0, 500) || null;
      if (b.allergies !== undefined) d.allergies = String(b.allergies ?? '').trim().slice(0, 200) || null;
      if (Array.isArray(b.tags)) d.tags = b.tags.filter((x: unknown) => typeof x === 'string').map((x: string) => x.trim().slice(0, 30)).filter(Boolean).slice(0, 8);
      await repo.updateBookingDetails(t.id, ref, d);
      message = 'Saved.';
    } else if (b.action === 'feedback') {
      // A viewing's feedback, from the agent who showed it: only an estate agency's viewings have a home.
      if (!booking.listing_key) throw new HttpError(400, 'Unknown action.');
      if (booking.status !== 'confirmed') throw new HttpError(409, 'That viewing was cancelled.');
      const category = String(b.category ?? '');
      if (!FEEDBACK.includes(category)) throw new HttpError(400, 'Unknown feedback.');
      const words = String(b.words ?? '').trim().slice(0, 300);
      await repo.mergeBookingDetails(t.id, ref, { feedback: { category, words, source: 'staff', at: new Date().toISOString() }, awaiting_feedback: false }, `feedback: ${category.replace(/_/g, ' ')}`);
      message = 'Feedback saved.';
    } else if (b.action === 'outcome') {
      // A valuation won, being thought about (with a day to follow up) or lost (and to whom): the Valuations view's columns.
      if (booking.service_key !== 'valuation') throw new HttpError(400, 'Only a valuation has an outcome.');
      if (booking.status !== 'confirmed') throw new HttpError(409, 'That valuation was cancelled.');
      const outcome = String(b.outcome ?? '');
      if (!['instructed', 'thinking', 'lost'].includes(outcome)) throw new HttpError(400, 'Unknown outcome.');
      const followUp = outcome === 'thinking' ? (isIsoDate(String(b.follow_up ?? '')) ? String(b.follow_up) : addDays(toLocal(new Date(), t.profile.timezone).date, 14)) : null;
      const lostTo = outcome === 'lost' ? String(b.lost_to ?? '').trim().slice(0, 80) || null : null;
      await repo.mergeBookingDetails(t.id, ref, { outcome, follow_up: followUp, lost_to: lostTo }, `valuation outcome: ${outcome}`);
      message = outcome === 'instructed' ? 'Instructed: well done.' : outcome === 'thinking' ? `Thinking: follow up on ${followUp}.` : `Lost${lostTo ? ` to ${lostTo}` : ''}.`;
    } else if (b.action === 'cancel') {
      const c = await repo.cancelBooking(t.id, ref, 'staff');
      if (!c) throw new HttpError(409, 'That booking is already cancelled.');
      const l = toLocal(c.starts_at, t.profile.timezone);
      if (b.notify !== false) await textCustomer(ctx, t.id, c.phone, `${t.profile.name}: we've had to cancel your booking ${c.reference} for ${spokenDate(l.date)} at ${spokenTime(l.time)}. Sorry for the trouble; call us to rebook. (Demo)`);
      message = 'Cancelled.';
    } else {
      throw new HttpError(400, 'Unknown action.');
    }
    void usage('staff_action', { action: b.action });
    refresh({ reason: 'staff', reference: booking.reference, what: message });
    return json(res, 200, { ok: true, message }), true;
  }
  if (sub === 'orders' && ref && req.method === 'PATCH') {
    const { status } = await readJson(req, 10_000);
    if (!['confirmed', 'in_kitchen', 'ready', 'completed', 'cancelled'].includes(status)) throw new HttpError(400, 'Unknown order state.');
    const o = await repo.getOrder(t.id, ref);
    if (!o) throw new HttpError(404, 'No such order.');
    await repo.setOrderStatus(t.id, o.reference, status);
    if (status === 'ready' && o.status !== 'ready') {
      await textCustomer(ctx, t.id, o.phone, o.fulfilment === 'delivery'
        ? `${t.profile.name}: order ${o.reference} is on its way. (Demo)`
        : `${t.profile.name}: order ${o.reference} is ready to collect. See you soon! (Demo)`);
    }
    void usage('staff_action', { action: `order_${status}` });
    refresh({ reason: 'staff', reference: o.reference, what: `Order ${o.reference}: ${status.replace('_', ' ')}` });
    return json(res, 200, { ok: true }), true;
  }
  if (sub === 'offers' && ref && req.method === 'PATCH') {
    const message = await offerAction(ctx, t, ref, await readJson(req, 10_000));
    void usage('staff_action', { action: 'offer' });
    refresh({ reason: 'staff', reference: ref.toUpperCase(), what: message });
    return json(res, 200, { ok: true, message }), true;
  }
  if (sub === 'sales' && ref && req.method === 'PATCH') {
    const message = await saleAction(ctx, t, ref, await readJson(req, 10_000));
    void usage('staff_action', { action: 'sale' });
    refresh({ reason: 'staff', what: message });
    return json(res, 200, { ok: true, message }), true;
  }
  if (sub === 'buyers' && ref && req.method === 'PATCH') {
    const message = await buyerAction(ctx, t, ref, await readJson(req, 10_000));
    void usage('staff_action', { action: 'buyer' });
    refresh({ reason: 'staff', what: message });
    return json(res, 200, { ok: true, message }), true;
  }
  if (sub === 'listings' && ref && req.method === 'PATCH') {
    const { message, affected } = await listingAction(ctx, t, ref, await readJson(req, 10_000));
    void usage('staff_action', { action: 'listing' });
    refresh({ reason: 'staff', what: message });
    return json(res, 200, { ok: true, message, ...(affected ? { affected } : {}) }), true;
  }
  if (sub === 'jobs' && ref && req.method === 'PATCH') {
    const message = await jobAction(repo, t, ref, await readJson(req, 10_000), (to, body) => textCustomer(ctx, t.id, to, body));
    void usage('staff_action', { action: 'job' });
    refresh({ reason: 'staff', reference: ref.toUpperCase(), what: message });
    return json(res, 200, { ok: true, message }), true;
  }
  if (sub === 'messages' && ref && req.method === 'PATCH') {
    const { status } = await readJson(req, 1000);
    if (status !== 'read' && status !== 'new') throw new HttpError(400, 'Unknown state.');
    await repo.setMessageStatus(t.id, ref, status);
    refresh({ reason: 'staff' });
    return json(res, 200, { ok: true }), true;
  }
  throw new HttpError(404, 'Not found.');
}

async function spendDraft(ctx: Ctx, who: Who | null, admin: boolean): Promise<void> {
  if (admin || !who) return;
  const n = await ctx.demo.countUsage(who.key.id, ['menu_draft', 'faq_draft'], 24, who.visitor);
  if (n >= who.key.limits.drafts_per_day) throw new HttpError(429, `That's the ${who.key.limits.drafts_per_day} AI drafts you have for today. Edit by hand, or try again tomorrow.`);
}

function draftError(err: unknown): string {
  const m = (err as Error).message ?? '';
  if (/429|quota|exhausted/i.test(m)) return 'The drafting model is busy (free-tier limit). Try again in a minute, or edit by hand.';
  if (/503|overloaded|high demand/i.test(m)) return 'The drafting model is overloaded right now. Try again in a minute.';
  return m.startsWith('The draft') ? m : 'The draft did not work this time. Try again, or edit by hand.';
}

// ── An estate agency's staff actions (presets/estate-agent.md §6) ─────────

const FEEDBACK = ['keen', 'second_viewing', 'likely_offer', 'not_for_me'];
const STATUSES: ListingStatus[] = ['coming_soon', 'available', 'under_offer', 'sale_agreed', 'exchanged', 'completed', 'withdrawn'];
/** What a home's facts can be marked as being checked: a checklist item, or one of these. */
const CHECKABLE: string[] = [...CHECK_KEYS, 'price', 'rooms', 'tenure', 'lease', 'local_tax', 'epc'];
/** "£320,000": what a buyer reads in a text. */
const figure = (pence: number) => `£${Math.round(pence / 100).toLocaleString('en-GB')}`;
/** A real calendar day as YYYY-MM-DD, or null: "2026-13-01" is not one. */
const isoDay = (v: unknown) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
};

/**
 * An offer moves on, and the buyer hears each step by text: sent to the
 * seller; accepted (the home turns sale agreed, a sale opens, and anyone
 * else with an offer on it is told, TPO 9h); declined; countered; withdrawn.
 */
async function offerAction(ctx: Ctx, t: Tenant, ref: string, b: any): Promise<string> {
  const { repo } = ctx;
  if (!t.profile.listings) throw new HttpError(400, 'This business takes no offers.');
  const offer = (await repo.findOffer(t.id, { reference: ref }))[0];
  if (!offer) throw new HttpError(404, 'No such offer.');
  const home = t.profile.listings.find((l) => l.key === offer.listing_key);
  const live = home ? await repo.listingState(t.id, home.key) : null;
  // A home taken out in the builder keeps its offers on record, but nothing more can happen to them.
  if (!home || !live) throw new HttpError(409, 'That home is no longer in your list.');
  const where = shortAddress(home);
  const agent = t.profile.team?.find((s) => s.key === home.negotiator)?.first_name ?? 'We';
  const name = t.profile.name;
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 300) || null : null;
  const OPEN: OfferStatus[] = ['received', 'sent'];
  const yours = `your offer of ${figure(offer.amount_pence)} for ${where}`;
  const text = (body: string) => textCustomer(ctx, t.id, offer.phone, `${name}: ${body} (Demo)`);
  /** Moves the offer on only from an open status, in one statement: a second click finds it decided. */
  const decide = async (status: OfferStatus, from: OfferStatus[] = OPEN) => {
    if (!(await repo.setOfferStatus(t.id, offer.reference, status, { note, from }))) {
      throw new HttpError(409, status === 'sent' ? 'That offer has already gone to the seller.' : 'That offer has already been decided.');
    }
  };
  switch (b.action) {
    case 'sent': {
      await decide('sent', ['received']);
      await text(`${yours[0].toUpperCase()}${yours.slice(1)} was put to the seller at ${spokenTime(toLocal(new Date(), t.profile.timezone).time)} today. We'll let you know their answer.`);
      return 'Sent to the seller; the buyer has been told.';
    }
    case 'accept': {
      // One sale at a time: a home already sale agreed (or sold, or withdrawn) needs that settled first.
      if (live.status === 'exchanged' || live.status === 'completed') throw new HttpError(409, `${where} is already sold.`);
      if (live.status === 'withdrawn') throw new HttpError(409, `${where} is withdrawn: put it back on the market first.`);
      const sales = (await repo.listSales(t.id)).filter((x) => x.listing_key === home.key && x.status === 'progressing');
      if (live.status === 'sale_agreed' || sales.length) {
        throw new HttpError(409, `${where} already has a sale agreed. If it has fallen through, put the home back on the market first.`);
      }
      await decide('accepted');
      await repo.setListing(t.id, home.key, { status: 'sale_agreed', marketing_continues: b.viewings_continue !== false }, 'staff', `sale agreed: offer ${offer.reference} accepted`);
      await repo.createSale(t.id, {
        listing_key: home.key, offer_ref: offer.reference, buyer_name: offer.buyer_names.join(' and ') || 'The buyer', buyer_phone: offer.phone,
        agreed_pence: offer.amount_pence, milestones: SALE_MILESTONES.map((key) => ({ key, done_at: null })), exchange_target: null, completion_date: null,
        parties: offer.solicitor ? [{ role: 'buyer_solicitor', name: offer.solicitor }] : [], chain: null,
      });
      await text(`the seller has accepted ${yours}, subject to contract. ${agent} will confirm it in writing and explain the ID checks.`);
      const all = await repo.listOffers(t.id, home.key);
      // The buyer's own earlier offers, which this one raised, are replaced by it: closed, and never told "another offer" was accepted.
      // Only the same phone's: the reference a raise names is the caller's word, and another buyer's offer must stay open and be told.
      const replaced = new Set<string>();
      const mine = (ref: string) => all.find((o) => o.reference === ref && offer.phone && o.phone === offer.phone);
      for (let r = offer.revises; r && !replaced.has(r) && mine(r); r = mine(r)!.revises) replaced.add(r);
      for (const r of replaced) {
        const o = all.find((x) => x.reference === r);
        if (o && OPEN.includes(o.status)) await repo.setOfferStatus(t.id, r, 'withdrawn', { note: `Replaced by ${offer.reference}`, from: OPEN });
      }
      const told = new Set<string>(offer.phone ? [offer.phone] : []);
      let others = 0;
      for (const o of all) {
        if (o.reference === offer.reference || replaced.has(o.reference) || !OPEN.includes(o.status) || !o.phone || told.has(o.phone)) continue;
        told.add(o.phone);
        others++;
        await textCustomer(ctx, t.id, o.phone, `${name}: the seller of ${where} has accepted another offer, subject to contract. Thank you for yours; we'll let you know if anything changes. (Demo)`);
      }
      return `Accepted: ${where} is sale agreed${others ? `, and ${others} other buyer${others === 1 ? ' has' : 's have'} been told` : ''}.`;
    }
    case 'decline': {
      await decide('declined');
      await text(`the seller has decided not to accept ${yours}. ${agent} will call you to talk it through.`);
      return 'Declined; the buyer has been told.';
    }
    case 'counter': {
      await decide('countered');
      await text(`the seller has come back to you about ${yours}. ${agent} will call you to talk it through.`);
      return 'Countered; the buyer has been told.';
    }
    case 'withdraw': {
      await decide('withdrawn');
      await text(`we've noted that ${yours} is withdrawn. Thank you for letting us know.`);
      return 'Withdrawn.';
    }
    default:
      throw new HttpError(400, 'Unknown action.');
  }
}

/**
 * A staff change to a home: its status, its price, dates with no viewings
 * (and the viewings already booked in them), a fact being checked, a best
 * and final deadline, and whether viewings go on after a sale is agreed.
 */
async function listingAction(ctx: Ctx, t: Tenant, key: string, b: any): Promise<{ message: string; affected?: string[] }> {
  const { repo } = ctx;
  const home = t.profile.listings?.find((l) => l.key === key);
  if (!home) throw new HttpError(404, 'No such home.');
  const live = await repo.listingState(t.id, key);
  if (!live) throw new HttpError(409, 'Press Start first.');
  const where = shortAddress(home);
  switch (b.action) {
    case 'status': {
      const status = String(b.status ?? '') as ListingStatus;
      if (!STATUSES.includes(status)) throw new HttpError(400, 'Unknown status.');
      // Back on the market after an offer or a sale: callers hear it is back, with the reason the seller agreed to share.
      const back = status === 'available' && (live.status === 'under_offer' || live.status === 'sale_agreed');
      await repo.setListing(t.id, key, { status, ...(back ? { back_on_market_at: new Date() } : {}) });
      // Back on the market or withdrawn: a sale in progress on it has fallen through, so another offer can be accepted.
      let fell = 0;
      if (status === 'available' || status === 'coming_soon' || status === 'withdrawn') {
        for (const sale of (await repo.listSales(t.id)).filter((x) => x.listing_key === key && x.status === 'progressing' && x.id)) {
          await repo.updateSale(t.id, sale.id!, { status: 'fell_through' }, { by: 'staff', what: `fell through: the home is ${status.replace(/_/g, ' ')} again` });
          fell++;
        }
      }
      // Back on the market: the back-up buyers and the consenting buyers it fits hear, as from Sales progress.
      const told = back ? await alertBuyers(ctx, t, key, 'back') : 0;
      return { message: `${where}: ${status.replace(/_/g, ' ')}.${fell ? ' Its sale in progress is marked fallen through.' : ''}${told ? ` ${told} buyer${told === 1 ? ' has' : 's have'} been texted.` : ''}` };
    }
    case 'price': {
      const pence = Math.round(Number(b.price_pence));
      if (!Number.isFinite(pence) || pence < 100_000 || pence > 2_000_000_000) throw new HttpError(400, 'Give a price in pounds.');
      const lower = pence < live.price_pence;
      await repo.setListing(t.id, key, { price_pence: pence }, 'staff', `price ${lower ? 'reduced' : 'changed'} from ${figure(live.price_pence)} to ${figure(pence)}`);
      // A reduction on a home still for sale reaches the buyers who said yes to alerts and whose search it now fits.
      const told = lower && (live.status === 'available' || live.status === 'under_offer') ? await alertBuyers(ctx, t, key, 'reduced') : 0;
      return { message: `${where}: ${lower ? 'reduced' : 'now'} to ${figure(pence)}.${told ? ` ${told} buyer${told === 1 ? ' has' : 's have'} been texted.` : ''}` };
    }
    case 'block': {
      const from = isoDay(b.from);
      const to = isoDay(b.to) ?? from;
      if (!from || !to || to < from) throw new HttpError(400, 'Choose the first and last dates.');
      const note = String(b.note ?? '').trim().slice(0, 80);
      await repo.setListing(t.id, key, { blocked: [...live.blocked, { from, to, ...(note ? { note } : {}) }].slice(-12) }, 'staff', `no viewings ${from} to ${to}`);
      const tz = t.profile.timezone;
      const inside = (await repo.listBookings(t.id, zonedToUtc(from, '00:00', tz), zonedToUtc(addDays(to, 1), '00:00', tz)))
        .filter((x) => x.listing_key === key && x.status === 'confirmed');
      const affected = inside.map((x) => {
        const l = toLocal(x.starts_at, tz);
        return `${spokenDate(l.date)} at ${spokenTime(l.time)}: ${x.name} (${x.reference})`;
      });
      return {
        message: `${where}: no viewings from ${spokenDate(from)}${to !== from ? ` to ${spokenDate(to)}` : ''}. ${affected.length ? `${affected.length} viewing${affected.length === 1 ? ' is' : 's are'} already booked then.` : 'No viewings are booked then.'}`,
        affected,
      };
    }
    case 'unblock': {
      const i = Number(b.index);
      if (!Number.isInteger(i) || !live.blocked[i]) throw new HttpError(400, 'No such dates.');
      await repo.setListing(t.id, key, { blocked: live.blocked.filter((_, j) => j !== i) }, 'staff', 'blocked dates cleared');
      return { message: `${where}: viewings open again on those dates.` };
    }
    case 'checking': {
      const fact = String(b.fact ?? '');
      if (!CHECKABLE.includes(fact)) throw new HttpError(400, 'Unknown fact.');
      const checking = b.on === false ? live.checking.filter((x) => x !== fact) : [...new Set([...live.checking, fact])];
      await repo.setListing(t.id, key, { checking }, 'staff', `${fact.replace(/_/g, ' ')} ${b.on === false ? 'checked' : 'being checked'}`);
      return { message: `${where}: ${fact.replace(/_/g, ' ')} ${b.on === false ? 'cleared' : 'marked as being checked'}.` };
    }
    case 'best_final': {
      // The deadline is typed in the agency's own time, wherever the browser is.
      const day = isoDay(b.date);
      const time = typeof b.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(b.time) ? b.time : null;
      if (b.at !== null && (!day || !time)) throw new HttpError(400, 'Choose a date and time.');
      const at = b.at === null ? null : zonedToUtc(day!, time!, t.profile.timezone);
      await repo.setListing(t.id, key, { best_final_at: at });
      return { message: at ? `${where}: best and final by ${spokenDate(toLocal(at, t.profile.timezone).date)} at ${spokenTime(toLocal(at, t.profile.timezone).time)}.` : `${where}: best and final cleared.` };
    }
    case 'viewings_continue': {
      await repo.setListing(t.id, key, { marketing_continues: b.on !== false });
      return { message: `${where}: ${b.on !== false ? 'viewings continue' : 'no more viewings'}.` };
    }
    default:
      throw new HttpError(400, 'Unknown action.');
  }
}

/** A text to the customer from the back office: stored, shown on the phone mockup, never sent. */
/**
 * Staff and a buyer in Applicants, by the buyer's number: mark them hot,
 * text them the homes that fit now (only with their yes to alerts), or stop
 * the alerts, with one text to say so.
 */
async function buyerAction(ctx: Ctx, t: Tenant, ref: string, b: any): Promise<string> {
  const { repo } = ctx;
  if (!t.profile.listings) throw new HttpError(400, 'This business has no buyers.');
  const phone = normaliseUkPhone(ref);
  const buyer = phone ? await repo.findBuyer(t.id, phone) : null;
  if (!phone || !buyer) throw new HttpError(404, 'No such buyer.');
  const who = buyer.name ?? displayUkPhone(phone);
  switch (b.action) {
    case 'hot': {
      const hot = !buyer.details.hot;
      await repo.upsertBuyer(t.id, phone, null, { hot });
      return hot ? `${who} marked hot.` : `${who} no longer marked hot.`;
    }
    case 'send_matches': {
      if (!buyer.marketing_consent) throw new HttpError(409, `${who} hasn't said yes to texts about new homes.`);
      const r = buyer.details.requirements;
      const live = new Map((await repo.listingStates(t.id)).map((x) => [x.listing_key, x]));
      const homes = (t.profile.listings ?? []).filter((l) => live.has(l.key)).map((l) => ({ listing: l, price_pence: live.get(l.key)!.price_pence, status: live.get(l.key)!.status }));
      const fit = r ? matches(r, homes).slice(0, 3) : [];
      if (!fit.length) throw new HttpError(409, `Nothing on the market fits ${who} right now.`);
      const lines = fit.map((l) => { const h = homes.find((x) => x.listing.key === l.key)!; return `${shortAddress(l)}, ${priceWords(h.price_pence, live.get(l.key)!.qualifier, l.lease?.shared?.share_percent)}`; });
      await textCustomer(ctx, t.id, phone, `${t.profile.name}: homes that fit what you asked for: ${lines.join('; ')}. Call us to book a viewing. To stop these texts, call us. (Demo)`);
      return `${who}: ${fit.length} home${fit.length === 1 ? '' : 's'} texted.`;
    }
    case 'unsubscribe': {
      if (!buyer.marketing_consent) throw new HttpError(409, `${who} isn't getting texts about new homes.`);
      await repo.upsertBuyer(t.id, phone, null, {}, false);
      await textCustomer(ctx, t.id, phone, `${t.profile.name}: we've stopped texting you about new homes, as you asked. (Demo)`);
      return `${who} won't get texts about new homes any more.`;
    }
    default:
      throw new HttpError(400, 'Unknown action.');
  }
}

/**
 * A home back on the market (or reduced): the buyers who asked to hear. Its
 * back-up buyers always; anyone else only with a yes to alerts and a search
 * it fits. Each number once. Returns how many were texted.
 */
async function alertBuyers(ctx: Ctx, t: Tenant, key: string, why: 'back' | 'reduced'): Promise<number> {
  const { repo } = ctx;
  const home = t.profile.listings!.find((l) => l.key === key)!;
  const live = (await repo.listingState(t.id, key))!;
  const findable = [{ listing: home, price_pence: live.price_pence, status: live.status }];
  const told = new Set<string>();
  for (const b of await repo.listBuyers(t.id)) {
    // A back-up buyer asked to hear if the sale falls through, not about a reduction.
    const backup = why === 'back' && (b.details.backup_for ?? []).includes(key);
    const fits = b.marketing_consent && b.details.requirements && matches(b.details.requirements, findable).length > 0;
    if ((!backup && !fits) || told.has(b.phone)) continue;
    told.add(b.phone);
    const price = priceWords(live.price_pence, live.qualifier, home.lease?.shared?.share_percent);
    const news = why === 'back' ? `${shortAddress(home)} is back on the market, ${price}.` : `${shortAddress(home)} has been reduced: now ${price}.`;
    await textCustomer(ctx, t.id, b.phone, `${t.profile.name}: ${news} Call us if you'd like to view it.${fits ? ' To stop these texts, call us.' : ''} (Demo)`);
  }
  return told.size;
}

/**
 * Staff moving a sale on in Sales progress: tick a milestone, set the dates,
 * log an update from a solicitor or an agent in the chain, release the keys
 * on completion day, or record that it fell through (and, if the seller
 * wants, put the home back on the market and tell the buyers waiting for it).
 */
async function saleAction(ctx: Ctx, t: Tenant, id: string, b: any): Promise<string> {
  const { repo } = ctx;
  if (!t.profile.listings) throw new HttpError(400, 'This business has no sales.');
  const sale = (await repo.listSales(t.id)).find((x) => x.id === id);
  if (!sale) throw new HttpError(404, 'No such sale.');
  const home = t.profile.listings.find((l) => l.key === sale.listing_key);
  if (!home) throw new HttpError(409, 'That home is no longer in your list.');
  const where = shortAddress(home);
  const today = toLocal(new Date(), t.profile.timezone).date;
  if (sale.status === 'fell_through' || sale.status === 'completed') throw new HttpError(409, `The sale of ${where} has ${sale.status === 'completed' ? 'completed' : 'fallen through'}.`);
  switch (b.action) {
    case 'milestone': {
      const key = String(b.key ?? '');
      if (!(SALE_MILESTONES as readonly string[]).includes(key)) throw new HttpError(400, 'Unknown milestone.');
      if (key === 'completion') throw new HttpError(400, 'Completion is recorded with "Completed: release keys".');
      const done = b.done !== false;
      const milestones = sale.milestones.map((m) => (m.key === key ? { key, done_at: done ? new Date().toISOString() : null } : m));
      // Exchanged is a status for the home and the sale too: callers then hear it is sold.
      const status = key === 'exchange' ? (done ? 'exchanged' : 'progressing') : undefined;
      await repo.updateSale(t.id, id, { milestones, ...(status ? { status } : {}) }, { by: 'staff', what: `${key.replace(/_/g, ' ')} ${done ? 'done' : 'not done'}` });
      if (status) await repo.setListing(t.id, sale.listing_key, { status: done ? 'exchanged' : 'sale_agreed' }, 'staff', done ? 'contracts exchanged' : 'exchange undone');
      return `${where}: ${key.replace(/_/g, ' ')} ${done ? 'ticked' : 'unticked'}.`;
    }
    case 'dates': {
      const exchange = b.exchange_target === null ? null : isoDay(b.exchange_target);
      const completion = b.completion_date === null ? null : isoDay(b.completion_date);
      if ((b.exchange_target && !exchange) || (b.completion_date && !completion)) throw new HttpError(400, 'Choose real dates.');
      if (exchange && completion && completion < exchange) throw new HttpError(400, 'Completion comes on or after exchange.');
      const patch = { ...('exchange_target' in b ? { exchange_target: exchange } : {}), ...('completion_date' in b ? { completion_date: completion } : {}) };
      await repo.updateSale(t.id, id, patch, { by: 'staff', what: `dates: exchange ${exchange ?? 'none'}, completion ${completion ?? 'none'}` });
      return `${where}: dates saved.`;
    }
    case 'update': {
      const what = String(b.what ?? '').trim().slice(0, 300);
      if (!what) throw new HttpError(400, 'Say what the update is.');
      const from = ['buyer_solicitor', 'seller_solicitor', 'chain_agent', 'buyer', 'seller', 'staff'].includes(b.from) ? b.from : 'staff';
      await repo.updateSale(t.id, id, {}, { by: from, what });
      return `${where}: update logged.`;
    }
    case 'release_keys': {
      // Only once completion is due: the seller's solicitor confirms on the day, and staff release the keys.
      if (!sale.completion_date || sale.completion_date > today) throw new HttpError(409, `Keys are released on completion day${sale.completion_date ? `, ${sale.completion_date}` : ': set the completion date first'}.`);
      const milestones = sale.milestones.map((m) => (m.key === 'completion' || m.key === 'exchange') && !m.done_at ? { ...m, done_at: new Date().toISOString() } : m);
      await repo.updateSale(t.id, id, { milestones, status: 'completed', keys_released_at: new Date() }, { by: 'staff', what: 'completed: keys released' });
      await repo.setListing(t.id, sale.listing_key, { status: 'completed' }, 'staff', 'completed: keys released');
      const negotiator = t.profile.team?.find((s) => s.key === home.negotiator)?.first_name;
      await textCustomer(ctx, t.id, sale.buyer_phone, `${t.profile.name}: completion has gone through on ${where}. Your keys are ready to collect from our office${negotiator ? `; ${negotiator} has them` : ''}. Congratulations! (Demo)`);
      return `${where}: completed; the buyer has been texted that the keys are ready.`;
    }
    case 'fell_through': {
      if (sale.status !== 'progressing') throw new HttpError(409, `${where} has exchanged: a sale that falls through after exchange is one for the solicitors.`);
      const reason = String(b.reason ?? '').trim().slice(0, 200);
      if (!reason) throw new HttpError(400, 'Say why it fell through.');
      await repo.updateSale(t.id, id, { status: 'fell_through' }, { by: 'staff', what: `fell through: ${reason}` });
      if (!b.back_on_market) {
        await repo.setListing(t.id, sale.listing_key, { status: 'withdrawn' }, 'staff', `sale fell through (${reason}); not back on the market yet`);
        return `${where}: the sale fell through. The home is withdrawn until the seller decides.`;
      }
      await repo.setListing(t.id, sale.listing_key, { status: 'available', back_on_market_at: new Date() }, 'staff', `back on the market: sale fell through (${reason})`);
      const told = await alertBuyers(ctx, t, sale.listing_key, 'back');
      return `${where}: back on the market${told ? `, and ${told} buyer${told === 1 ? ' has' : 's have'} been texted` : ''}.`;
    }
    default:
      throw new HttpError(400, 'Unknown action.');
  }
}

async function textCustomer(ctx: Ctx, tenantId: string, to: string | null, body: string): Promise<void> {
  if (!to) return;
  await ctx.repo.addMessage({ tenant_id: tenantId, kind: 'sms', to_number: to, body, status: await demoSms.send() });
}

/** The key of the pushed-together pair for two tables, joining them in the setup if need be. */
async function combineTables(ctx: Ctx, w: Workspace, preset: Preset, a: string, b: string): Promise<string> {
  const resources = w.tenant.profile.booking?.resources ?? [];
  const existing = resources.find((r) => r.combines && r.combines.length === 2 && r.combines.includes(a) && r.combines.includes(b));
  if (existing) {
    if (!existing.services.length) throw new HttpError(409, `${existing.label} is not bookable.`);
    return existing.key;
  }
  let joined: BaseAnswers;
  try {
    joined = preset.combineTables!(answersOf(preset, configOf(w).answers), a, b);
  } catch (err) {
    if (err instanceof PresetError) throw new HttpError(err.status, err.message);
    throw err;
  }
  const { profile } = await rebuild(ctx, w, preset, answersOf(preset, joined));
  const pair = profile.booking?.resources.find((r) => r.combines?.includes(a) && r.combines.includes(b));
  if (!pair) throw new HttpError(409, 'Those tables cannot be pushed together.');
  return pair.key;
}
