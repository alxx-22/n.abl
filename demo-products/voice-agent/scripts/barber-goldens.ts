// The barber golden corpus (PRESETS.md §4), recorded when it went live: what
// the preset does with a fixed set of answers, so a later change to shared
// code (or to this preset) cannot alter it unseen.
// test/barber-golden.test.ts recomputes every value and compares it.
//
//   node scripts/barber-goldens.ts            rewrite test/fixtures/barber/golden/
//   node scripts/barber-goldens.ts --corpus   rebuild the corpus inputs too
//
// As with the others: the corpus inputs are written once and left alone, so
// a change to the defaults or a cap shows as a changed golden; a golden
// changes only in a commit that names the change and says why.

import { existsSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultAnswers } from '../src/presets/barber/answers.ts';
import { compileBarber } from '../src/presets/barber/compile.ts';
import { BARBER_HANDLES, barberPreview, barberWorkspace, factSheet } from '../src/presets/barber/preset.ts';
import { sanitiseBarber } from '../src/presets/barber/sanitise.ts';
import { validateBarber } from '../src/presets/barber/validate.ts';
import { planBarberSeed } from '../src/presets/barber/seed.ts';
import { draftFaqs } from '../src/presets/common/drafts.ts';
import { compilePrompt, type PromptContext } from '../src/core/prompt.ts';
import { toolDeclarations } from '../src/core/tools.ts';
import { DEFAULT_DEMO_CARDS } from '../src/domain/payments.ts';
import { BUILDER_TENANTS, builderTenant } from '../src/eval/scenarios.ts';
import type { TenantProfile } from '../src/domain/types.ts';
import type { Config } from '../src/config.ts';
import { goldenFilesIn, lines, readJson, stored, withoutClock, write } from './goldens.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures', 'barber');
const CORPUS_DIR = join(ROOT, 'corpus');
export const GOLDEN_DIR = join(ROOT, 'golden');

// ── Fixed time ───────────────────────────────────────────────────────────

// Europe/London is on summer time until 25 October 2026, so these are UTC+1:
// a Thursday morning, a Saturday at opening, and a Sunday evening after
// closing, with Monday closed.
const NOWS = {
  'thursday-1100': new Date('2026-10-15T10:00:00Z'),
  'saturday-0800': new Date('2026-10-17T07:00:00Z'),
  'sunday-1900': new Date('2026-10-18T18:00:00Z'),
} as const;
const SEEDS = [1, 42] as const;
const SEEDED = ['as-created', 'full'];

const PROMPTS: Record<string, PromptContext> = {
  phone: {
    now: NOWS['thursday-1100'], callerPhone: '+447700900901', knownCustomer: { name: 'Jay Morgan' },
    demoCards: DEFAULT_DEMO_CARDS, canTransfer: true, channel: 'phone',
  },
  browser: { now: NOWS['thursday-1100'], callerPhone: null, knownCustomer: null, demoCards: DEFAULT_DEMO_CARDS, canTransfer: false, channel: 'browser' },
};

const DRAFT_CONFIG = { textModel: 'text-model', keys: { text: 'golden-key' } } as unknown as Config;

// ── The corpus ───────────────────────────────────────────────────────────

export const CORPUS = ['as-created', 'full', 'max', 'every-issue', 'empty', 'null', 'junk'] as const;

/** As POST /workspaces makes one: the defaults with the shop's name. */
function asCreated(): unknown {
  const a = defaultAnswers();
  a.basics.name = "Kingsley's Barbers";
  return a;
}

/** Every setting away from its default: two barbers, a short price list, the deposit required, no walk-ins, no kids' price. */
function full(): unknown {
  const a = defaultAnswers();
  a.basics = { ...a.basics, name: 'Sharp & Son', style: 'Traditional barbering and wet shaves', town: 'Kirkhill', address: '3 Mill Yard (example), Kirkhill', voice: 'Puck', greeting: "Sharp & Son, you're through to the AI assistant on this demo line. Who are you booking with?" };
  a.hours.days = a.hours.days.map((d, i) => (i === 0 || i === 1 ? { open: false, services: [] } : { open: true, services: [{ label: 'Open', open: '08:30', close: i === 6 ? '14:00' : '17:30' }] }));
  a.hours.closures = [{ date: '2026-12-25', note: 'Christmas Day' }];
  a.services = a.services.filter((s) => ['classic_cut', 'beard_trim', 'hot_towel_shave'].includes(s.key));
  a.services[0].price_pence = 2000;
  a.team = [
    { key: 'ray', name: 'Ray', aliases: ['Raymond'], days: [2, 3, 4, 5, 6], hours: [{ day: 6, open: '08:30', close: '12:00' }], services: ['classic_cut', 'beard_trim', 'hot_towel_shave'], notes: 'Forty years with the razor.' },
    { key: 'tom', name: 'Tom', aliases: [], days: [3, 4, 5], hours: [], services: ['classic_cut', 'beard_trim'], notes: '' },
  ];
  a.booking = { slot_minutes: 30, lead_minutes: 60, horizon_days: 14, walk_ins: false, group_max: 2, late_grace_minutes: 5, kids_under: null, under_16_with_adult: false };
  a.money = { deposit_pence: 1000, deposit_required: true, notice_hours: 48, payment: 'phone' };
  a.policies = { ...a.policies, skin_test: 'six_months', fix_days: null, home_visits: 'Ray visits care homes on Mondays: leave a message to arrange.', faqs: [{ q: 'Do you do flat tops?', a: "Ray does, with a day's notice." }] };
  a.theme = { ...a.theme, accent: '#2f6f4f' };
  return a;
}

const text = (n: number, tag: string) => `${tag} `.repeat(Math.ceil(n / (tag.length + 1))).slice(0, n);

/** Everything at its cap, or past it: the most the prompt and the tools can be asked to carry. */
function max(): unknown {
  const a = defaultAnswers();
  a.basics.name = text(60, 'Name');
  a.basics.style = text(160, 'Style');
  a.basics.address = text(160, 'Address');
  a.basics.town = text(60, 'Town');
  a.basics.greeting = `Hello, you're through to the AI assistant on this demo line. ${text(220, 'Greeting')}`;
  a.services = Array.from({ length: 30 }, (_, i) => ({ key: `service_${i}`, name: `Service ${i} ${text(50, 'name')}`, minutes: 240, price_pence: 50000, from: true, description: text(200, 'desc'), colour: i % 2 === 0 }));
  a.team = Array.from({ length: 12 }, (_, i) => ({
    key: `barber_${i}`, name: `Barber ${i} ${text(20, 'n')}`, aliases: ['Alias one', 'Alias two', 'Alias three', 'Alias four'], days: [0, 1, 2, 3, 4, 5, 6],
    hours: [0, 2, 3, 4, 5, 6].map((day) => ({ day, open: '10:00', close: '16:00' })), services: a.services.map((s) => s.key), notes: text(160, 'notes'),
  }));
  a.policies.faqs = Array.from({ length: 25 }, (_, i) => ({ q: `Question ${i} ${text(150, 'q')}`, a: text(550, 'answer') }));
  for (const k of ['access', 'parking', 'careers'] as const) a.policies[k] = text(300, k);
  for (const k of ['products', 'tips', 'home_visits'] as const) a.policies[k] = text(200, k);
  return a;
}

/** One of everything validation names, errors and warnings. */
function everyIssue(): unknown {
  const a = defaultAnswers();
  a.basics.name = 'Every Issue Barbers';
  a.basics.greeting = 'Hello, Every Issue Barbers.';
  a.hours.days[2] = { open: true, services: [{ label: 'Open', open: '18:00', close: '09:00' }] };
  a.services.push({ key: 'nameless', name: '', minutes: 30, price_pence: 0, from: false, description: '', colour: false });
  a.services.push({ key: 'free_thing', name: 'Free thing', minutes: 10, price_pence: 0, from: false, description: '', colour: false });
  a.team.push({ key: 'nobody', name: '', aliases: [], days: [], hours: [], services: [], notes: '' });
  a.team.push({ key: 'lee', name: 'Lee', aliases: [], days: [1], hours: [{ day: 1, open: '18:00', close: '09:00' }], services: [], notes: '' });
  a.policies.faqs.push({ q: 'Half a question', a: '' });
  return a;
}

function junk(): unknown {
  return {
    version: 'nine', basics: { name: 42, voice: 'Nobody', greeting: ['hi'] }, hours: { days: 'every day', closures: [{ date: 'soon' }] },
    team: [{ name: 7, days: [9, 'x', -1], hours: 'late', services: 'all', aliases: 'Marc' }, 'barber'],
    services: [{ name: 'Junk', minutes: 999, price_pence: -1, from: 'yes', colour: 'no' }, 'cut'],
    booking: { slot_minutes: 7, lead_minutes: -5, horizon_days: 999, walk_ins: 'yes', group_max: 0, late_grace_minutes: 99, kids_under: 'kids', under_16_with_adult: 1 },
    money: { deposit_pence: -3, deposit_required: 'yes', notice_hours: 999, payment: 'cheque' },
    policies: { skin_test: 'never', fix_days: 'soon', faqs: { q: 1 } }, theme: { accent: 'blue' }, sources: 'web',
  };
}

function buildCorpus(): Record<(typeof CORPUS)[number], unknown> {
  return { 'as-created': asCreated(), full: full(), max: max(), 'every-issue': everyIssue(), empty: {}, null: null, junk: junk() };
}

export function readCorpus(): Record<string, unknown> {
  return Object.fromEntries(CORPUS.map((name) => [name, readJson(join(CORPUS_DIR, `${name}.json`))]));
}

export const goldenFiles = (): string[] => goldenFilesIn(GOLDEN_DIR);

// ── The goldens ──────────────────────────────────────────────────────────

const tenantOf = (profile: TenantProfile) => ({ id: 'golden', slug: profile.slug, profile });
const prompts = (profile: TenantProfile) => Object.fromEntries(Object.entries(PROMPTS).map(([k, ctx]) => [k, lines(compilePrompt(profile, ctx))]));
const tools = (profile: TenantProfile) => toolDeclarations(tenantOf(profile)).map((d) => d.name);

/** The request the FAQ draft sends the text model, caught as it is sent (see scripts/estate-goldens.ts). */
function requestOf(send: () => Promise<unknown>): unknown {
  const real = globalThis.fetch;
  let body: any = null;
  globalThis.fetch = ((_url: unknown, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Promise<Response>(() => {});
  }) as typeof fetch;
  try {
    send().catch(() => {});
  } finally {
    globalThis.fetch = real;
  }
  if (!body) throw new Error('The draft did not ask the model before its first await: requestOf cannot catch it.');
  return { ...body, contents: body.contents.map((c: any) => ({ ...c, parts: c.parts.map((p: any) => ({ ...p, text: lines(p.text) })) })) };
}

/** Every golden, by its path under golden/, in stored form. */
export function computeGoldens(corpus = readCorpus()): Map<string, unknown> {
  return withoutClock(() => {
    const out = new Map<string, unknown>();
    const put = (path: string, value: unknown) => out.set(path, stored(value));

    put('defaults.json', defaultAnswers());

    for (const [name, input] of Object.entries(corpus)) {
      // Each step gets its own copy, as each request does.
      const a = sanitiseBarber(structuredClone(input));
      const profile = compileBarber(structuredClone(a), { slug: 'golden' });
      put(`${name}/sanitised.json`, a);
      put(`${name}/issues.json`, validateBarber(structuredClone(a)));
      put(`${name}/profile.json`, profile);
      put(`${name}/preview.json`, barberPreview(structuredClone(a), structuredClone(profile)));
      put(`${name}/fact-sheet.json`, lines(factSheet(structuredClone(a))));
      put(`${name}/prompt.json`, prompts(profile));
      put(`${name}/tools.json`, tools(profile));
      put(`${name}/workspace.json`, barberWorkspace(structuredClone(profile)));
      if (SEEDED.includes(name)) {
        for (const [when, now] of Object.entries(NOWS)) {
          for (const seed of SEEDS) put(`${name}/seed/${when}-seed-${seed}.json`, planBarberSeed(structuredClone(profile), now, seed));
        }
      }
    }

    for (const name of ['as-created', 'full']) {
      put(`drafts/faq-${name}.json`, requestOf(() => draftFaqs(factSheet(sanitiseBarber(structuredClone(corpus[name]))), 'barber shop', BARBER_HANDLES, DRAFT_CONFIG)));
    }

    for (const b of BUILDER_TENANTS.filter((x) => x.preset === 'barber')) {
      const p = builderTenant(b).profile;
      put(`tenants/${b.slug}/profile.json`, p);
      put(`tenants/${b.slug}/prompt.json`, prompts(p));
      put(`tenants/${b.slug}/tools.json`, tools(p));
    }
    return out;
  }, { name: 'barber', script: 'scripts/barber-goldens.ts' });
}

// ── Run as a script ──────────────────────────────────────────────────────

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rebuild = process.argv.includes('--corpus');
  for (const [name, input] of Object.entries(buildCorpus())) {
    const file = join(CORPUS_DIR, `${name}.json`);
    if (rebuild || !existsSync(file)) write(file, input);
  }
  const goldens = computeGoldens();
  const keep = new Set(goldens.keys());
  for (const stale of goldenFiles().filter((f) => !keep.has(f))) rmSync(join(GOLDEN_DIR, stale));
  for (const [path, value] of goldens) write(join(GOLDEN_DIR, path), value);
  console.log(`${goldens.size} goldens written to ${relative(process.cwd(), GOLDEN_DIR)}/`);
}
