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
import type { DemoKey, Workspace } from '../db/demo-repo.ts';
import { SHARED_DEMO_MINUTES, SHARED_DRAFT_MINUTES, THROTTLE, hashKey, ipHash, newVisitor, normaliseKey, prefixOf, readSession, signSession, withFreePin } from '../demo/access.ts';
import { PRESETS, answersOf, builtPreset, getPreset, type BaseAnswers, type Preset } from '../presets/index.ts';
import { draftFaqs } from '../presets/common/drafts.ts';
import { PresetError } from '../presets/common/errors.ts';
import { seedFrom } from '../presets/common/random.ts';
import { applySettings, type SettingsPatch } from '../domain/settings.ts';
import type { TenantProfile } from '../domain/types.ts';
import { spokenDate, spokenTime, toLocal } from '../domain/time.ts';
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

  const m = /^\/workspaces\/([0-9a-f-]{36})(?:\/([a-z-]+)(?:\/([A-Za-z0-9+]{1,12}|[0-9a-f-]{36}))?)?$/.exec(p);
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
    const { workspace: saved } = await rebuild(ctx, w, preset, answers);
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
    return json(res, 200, { scan: scan ? scanView(scan, scanProgress(scan.id)) : null }), true;
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
    return json(res, 200, { scan: scanView(scan, scanProgress(id)) }), true;
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

/** A text to the customer from the back office: stored, shown on the phone mockup, never sent. */
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
