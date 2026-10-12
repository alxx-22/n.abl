// The café golden corpus (PRESETS.md §4), recorded when it went live: what
// the preset does with a fixed set of answers, so a later change to shared
// code (or to this preset) cannot alter it unseen.
// test/cafe-golden.test.ts recomputes every value and compares it.
//
//   node scripts/cafe-goldens.ts            rewrite test/fixtures/cafe/golden/
//   node scripts/cafe-goldens.ts --corpus   rebuild the corpus inputs too
//
// As with the others: the corpus inputs are written once and left alone, so
// a change to the defaults or a cap shows as a changed golden; a golden
// changes only in a commit that names the change and says why.

import { existsSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultAnswers } from '../src/presets/cafe/answers.ts';
import { compileCafe } from '../src/presets/cafe/compile.ts';
import { CF_PEOPLE } from '../src/presets/cafe/personas.ts';
import { CAFE_HANDLES, cafePreview, cafeWorkspace, factSheet } from '../src/presets/cafe/preset.ts';
import { planCafeSeed } from '../src/presets/cafe/seed.ts';
import { sanitiseCafe, validateCafe } from '../src/presets/cafe/validate.ts';
import { draftFaqs } from '../src/presets/common/drafts.ts';
import { compilePrompt, type PromptContext } from '../src/core/prompt.ts';
import { toolDeclarations } from '../src/core/tools.ts';
import { DEFAULT_DEMO_CARDS } from '../src/domain/payments.ts';
import { BUILDER_TENANTS, builderTenant } from '../src/eval/scenarios.ts';
import type { TenantProfile } from '../src/domain/types.ts';
import type { Config } from '../src/config.ts';
import { goldenFilesIn, lines, readJson, stored, withoutClock, write } from './goldens.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures', 'cafe');
const CORPUS_DIR = join(ROOT, 'corpus');
export const GOLDEN_DIR = join(ROOT, 'golden');

// ── Fixed time ───────────────────────────────────────────────────────────

// Europe/London is on summer time until 25 October 2026, so these are UTC+1:
// a Thursday morning, a Saturday at opening, and a Sunday after closing.
const NOWS = {
  'thursday-1100': new Date('2026-10-15T10:00:00Z'),
  'saturday-0900': new Date('2026-10-17T08:00:00Z'),
  'sunday-1600': new Date('2026-10-18T15:00:00Z'),
} as const;
const SEEDS = [1, 42] as const;
const SEEDED = ['as-created', 'full'];

const PROMPTS: Record<string, PromptContext> = {
  phone: {
    now: NOWS['thursday-1100'], callerPhone: CF_PEOPLE.regular.phone, knownCustomer: { name: CF_PEOPLE.regular.name },
    demoCards: DEFAULT_DEMO_CARDS, canTransfer: true, channel: 'phone',
  },
  browser: { now: NOWS['thursday-1100'], callerPhone: null, knownCustomer: null, demoCards: DEFAULT_DEMO_CARDS, canTransfer: false, channel: 'browser' },
};

const DRAFT_CONFIG = { textModel: 'text-model', keys: { text: 'golden-key' } } as unknown as Config;

// ── The corpus ───────────────────────────────────────────────────────────

export const CORPUS = ['as-created', 'full', 'max', 'every-issue', 'empty', 'null', 'junk'] as const;

/** As POST /workspaces makes one: the defaults with the café's name. */
function asCreated(): unknown {
  const a = defaultAnswers();
  a.basics.name = 'Wren Street Café';
  return a;
}

/** Every setting away from its default: bookings from six, a simpler afternoon tea with a deposit, dogs outside, card only. */
function full(): unknown {
  const a = defaultAnswers();
  a.basics = { ...a.basics, name: 'The Old Bakehouse', style: 'Sourdough, soups and cream teas', town: 'Kirkhill', address: '2 Market Steps (example), Kirkhill', voice: 'Puck', greeting: "The Old Bakehouse, you're through to the AI assistant on this demo line. How can I help?" };
  a.hours.days = a.hours.days.map((d, i) => (i === 1 ? { open: false, services: [] } : { open: true, services: [{ label: 'Open', open: '09:00', close: i === 0 ? '14:00' : '17:00' }] }));
  a.hours.closures = [{ date: '2026-12-25', note: 'Christmas Day' }];
  a.hours.breakfast_until = null;
  a.hours.kitchen_closes_before = 60;
  a.booking = { min_party: 6, busy_times: 'Saturdays are busiest.' };
  a.afternoon_tea = { ...a.afternoon_tea, adult_pence: 2200, child_pence: 0, notice_days: 2, diet_notice_days: 3, diets: ['gluten-free'], sittings: ['13:00', '15:00'], max_party: 6, deposit_pence: 500 };
  a.money = { cash: false, tips: 'Tips go in the jar, shared by everyone.' };
  a.policies = { ...a.policies, dogs: 'outside_only', baby_changing: false, tap_water: false, hygiene_rating: null, faqs: [{ q: 'Do you sell bread to take home?', a: 'Yes, sourdough loaves from 9am until they run out.' }] };
  a.theme = { ...a.theme, accent: '#8a5a2b' };
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
  a.booking.busy_times = text(200, 'busy');
  a.afternoon_tea = { ...a.afternoon_tea, description: text(300, 'tea'), diets: ['gluten-free', 'vegan', 'dairy-free', 'nut-free'], sittings: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00'] };
  a.policies.faqs = Array.from({ length: 25 }, (_, i) => ({ q: `Question ${i} ${text(150, 'q')}`, a: text(550, 'answer') }));
  for (const k of ['accessibility', 'parking', 'careers', 'hire'] as const) a.policies[k] = text(300, k);
  for (const k of ['children', 'wifi', 'laptops', 'reusable_cups'] as const) a.policies[k] = text(200, k);
  a.money.tips = text(200, 'tips');
  return a;
}

/** One of everything validation names, errors and warnings. */
function everyIssue(): unknown {
  const a = defaultAnswers();
  a.basics.name = 'Every Issue Café';
  a.basics.greeting = 'Hello, Every Issue Café.';
  a.hours.days[2] = { open: true, services: [{ label: 'Open', open: '18:00', close: '09:00' }] };
  a.booking.min_party = 12;
  a.afternoon_tea = { ...a.afternoon_tea, adult_pence: 0, sittings: ['16:30'] };
  a.policies.faqs.push({ q: 'Half a question', a: '' });
  return a;
}

function junk(): unknown {
  return {
    version: 'nine', basics: { name: 42, voice: 'Nobody', greeting: ['hi'] }, hours: { days: 'every day', closures: [{ date: 'soon' }], breakfast_until: 'late', kitchen_closes_before: -5 },
    seating: { tables: 'lots', areas: [{ key: 7 }] },
    booking: { min_party: 0, busy_times: 9 },
    afternoon_tea: { offered: 'yes', adult_pence: -1, notice_days: 99, diet_notice_days: 'x', diets: 'all', sittings: ['noon', 25], minutes: 9999, max_party: -2, deposit_pence: 'free' },
    menu: { categories: 'cakes' }, money: { cash: 'yes', tips: ['jar'] },
    policies: { dogs: 'cats', hygiene_rating: 9, tap_water: 'yes', faqs: { q: 1 } }, theme: { accent: 'blue' }, sources: 'web',
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
      const a = sanitiseCafe(structuredClone(input));
      const profile = compileCafe(structuredClone(a), { slug: 'golden' });
      put(`${name}/sanitised.json`, a);
      put(`${name}/issues.json`, validateCafe(structuredClone(a)));
      put(`${name}/profile.json`, profile);
      put(`${name}/preview.json`, cafePreview(structuredClone(a), structuredClone(profile)));
      put(`${name}/fact-sheet.json`, lines(factSheet(structuredClone(a))));
      put(`${name}/prompt.json`, prompts(profile));
      put(`${name}/tools.json`, tools(profile));
      put(`${name}/workspace.json`, cafeWorkspace(structuredClone(profile)));
      if (SEEDED.includes(name)) {
        for (const [when, now] of Object.entries(NOWS)) {
          for (const seed of SEEDS) put(`${name}/seed/${when}-seed-${seed}.json`, planCafeSeed(structuredClone(profile), now, seed));
        }
      }
    }

    for (const name of ['as-created', 'full']) {
      put(`drafts/faq-${name}.json`, requestOf(() => draftFaqs(factSheet(sanitiseCafe(structuredClone(corpus[name]))), 'café', CAFE_HANDLES, DRAFT_CONFIG)));
    }

    for (const b of BUILDER_TENANTS.filter((x) => x.preset === 'cafe')) {
      const p = builderTenant(b).profile;
      put(`tenants/${b.slug}/profile.json`, p);
      put(`tenants/${b.slug}/prompt.json`, prompts(p));
      put(`tenants/${b.slug}/tools.json`, tools(p));
    }
    return out;
  }, { name: 'café', script: 'scripts/cafe-goldens.ts' });
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
