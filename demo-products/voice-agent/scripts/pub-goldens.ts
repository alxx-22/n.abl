// The pub golden corpus (PRESETS.md §4), recorded when it went live: what
// the preset does with a fixed set of answers, so a later change to shared
// code (or to this preset) cannot alter it unseen.
// test/pub-golden.test.ts recomputes every value and compares it.
//
//   node scripts/pub-goldens.ts            rewrite test/fixtures/pub/golden/
//   node scripts/pub-goldens.ts --corpus   rebuild the corpus inputs too
//
// As with the others: the corpus inputs are written once and left alone, so
// a change to the defaults or a cap shows as a changed golden; a golden
// changes only in a commit that names the change and says why.

import { existsSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultAnswers } from '../src/presets/pub/answers.ts';
import { compilePub } from '../src/presets/pub/compile.ts';
import { PB_PEOPLE } from '../src/presets/pub/personas.ts';
import { PUB_HANDLES, factSheet, pubPreview, pubWorkspace } from '../src/presets/pub/preset.ts';
import { planPubSeed } from '../src/presets/pub/seed.ts';
import { sanitisePub, validatePub } from '../src/presets/pub/validate.ts';
import { draftFaqs } from '../src/presets/common/drafts.ts';
import { compilePrompt, type PromptContext } from '../src/core/prompt.ts';
import { toolDeclarations } from '../src/core/tools.ts';
import { DEFAULT_DEMO_CARDS } from '../src/domain/payments.ts';
import { BUILDER_TENANTS, builderTenant } from '../src/eval/scenarios.ts';
import type { TenantProfile } from '../src/domain/types.ts';
import type { Config } from '../src/config.ts';
import { goldenFilesIn, lines, readJson, stored, withoutClock, write } from './goldens.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures', 'pub');
const CORPUS_DIR = join(ROOT, 'corpus');
export const GOLDEN_DIR = join(ROOT, 'golden');

// ── Fixed time ───────────────────────────────────────────────────────────

// Europe/London is on summer time until 25 October 2026, so these are UTC+1:
// a Thursday afternoon, a Friday evening in full swing, and Sunday before lunch.
const NOWS = {
  'thursday-1500': new Date('2026-10-15T14:00:00Z'),
  'friday-1900': new Date('2026-10-16T18:00:00Z'),
  'sunday-1130': new Date('2026-10-18T10:30:00Z'),
} as const;
const SEEDS = [1, 42] as const;
const SEEDED = ['as-created', 'full'];

const PROMPTS: Record<string, PromptContext> = {
  phone: {
    now: NOWS['thursday-1500'], callerPhone: PB_PEOPLE.regular.phone, knownCustomer: { name: PB_PEOPLE.regular.name },
    demoCards: DEFAULT_DEMO_CARDS, canTransfer: true, channel: 'phone',
  },
  browser: { now: NOWS['thursday-1500'], callerPhone: null, knownCustomer: null, demoCards: DEFAULT_DEMO_CARDS, canTransfer: false, channel: 'browser' },
};

const DRAFT_CONFIG = { textModel: 'text-model', keys: { text: 'golden-key' } } as unknown as Config;

// ── The corpus ───────────────────────────────────────────────────────────

export const CORPUS = ['as-created', 'full', 'max', 'every-issue', 'empty', 'null', 'junk'] as const;

/** As POST /workspaces makes one: the defaults with the pub's name. */
function asCreated(): unknown {
  const a = defaultAnswers();
  a.basics.name = 'The Weaver’s Arms';
  return a;
}

/** Every setting away from its default: food later and no Sunday change, children any time, a short grace, no quiz, card only. */
function full(): unknown {
  const a = defaultAnswers();
  a.basics = { ...a.basics, name: 'The Old Ferry', style: 'Real ale and river views', town: 'Newark', address: '1 Ferry Lane (example), Newark', voice: 'Puck', greeting: "The Old Ferry, you're through to the AI assistant on this demo line. How can I help?" };
  a.hours.days = a.hours.days.map((d, i) => (i === 1 ? { open: false, services: [] } : { open: true, services: [{ label: 'Open', open: '11:00', close: i === 0 ? '20:00' : '23:30' }] }));
  a.hours.closures = [{ date: '2026-12-25', note: 'Christmas Day' }];
  a.hours.food = { from: '12:30', until: '20:30', sunday_until: null };
  a.booking = { late_grace_minutes: 10, no_bar_bookings_for_matches: false };
  a.children = { until: null };
  a.quiz = { ...a.quiz, offered: false };
  a.events = [];
  a.drinks = { on_tap: ['Ferryman’s Bitter (example)'] };
  a.money = { payment: 'phone', cash: false, tips: 'Tips go in the jar, shared by everyone.' };
  a.policies = { ...a.policies, baby_changing: false, hygiene_rating: null, faqs: [{ q: 'Can we moor a boat?', a: 'Yes, at our jetty, for customers.' }] };
  a.theme = { ...a.theme, accent: '#2e5a8a' };
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
  a.events = Array.from({ length: 10 }, (_, i) => ({ day: i % 7, time: '20:00', title: text(60, 'event'), place: text(40, 'place'), free: true }));
  a.drinks.on_tap = Array.from({ length: 14 }, (_, i) => text(40, `ale${i}`));
  a.policies.faqs = Array.from({ length: 25 }, (_, i) => ({ q: `Question ${i} ${text(150, 'q')}`, a: text(550, 'answer') }));
  for (const k of ['accessibility', 'parking', 'id', 'hire', 'christmas', 'careers'] as const) a.policies[k] = text(300, k);
  for (const k of ['children', 'smoking', 'vaping', 'own_cake', 'own_drink'] as const) a.policies[k] = text(200, k);
  a.policies.taxi = text(120, 'taxi');
  a.money.tips = text(200, 'tips');
  return a;
}

/** One of everything validation names, errors and warnings. */
function everyIssue(): unknown {
  const a = defaultAnswers();
  a.basics.name = 'Every Issue Inn';
  a.basics.greeting = 'Hello, Every Issue Inn.';
  a.hours.days[2] = { open: true, services: [{ label: 'Open', open: '18:00', close: '09:00' }] };
  a.hours.food = { from: '21:00', until: '12:00', sunday_until: '18:00' };
  a.children = { until: '12:30' };
  a.ordering.delivery.enabled = true;
  a.policies.faqs.push({ q: 'Half a question', a: '' });
  return a;
}

function junk(): unknown {
  return {
    version: 'nine', basics: { name: 42, voice: 'Nobody', greeting: ['hi'] }, hours: { days: 'every day', closures: [{ date: 'soon' }], food: { from: 'noon', until: 25, sunday_until: 'later' } },
    seating: { tables: 'lots', areas: [{ key: 7 }] },
    booking: { late_grace_minutes: -5, no_bar_bookings_for_matches: 'yes' },
    children: { until: 'bedtime' },
    quiz: { offered: 'yes', day: 9, time: 'late', team_max: 99, entry_pence: -1, minutes: 9999 },
    events: [{ day: 'friday', time: 7, title: ['x'] }, 'a gig'],
    drinks: { on_tap: 'everything' },
    menu: { categories: 'ales' }, money: { cash: 'yes', tips: ['jar'] },
    policies: { hygiene_rating: 9, baby_changing: 'yes', faqs: { q: 1 } }, theme: { accent: 'blue' }, sources: 'web',
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
      const a = sanitisePub(structuredClone(input));
      const profile = compilePub(structuredClone(a), { slug: 'golden' });
      put(`${name}/sanitised.json`, a);
      put(`${name}/issues.json`, validatePub(structuredClone(a)));
      put(`${name}/profile.json`, profile);
      put(`${name}/preview.json`, pubPreview(structuredClone(a), structuredClone(profile)));
      put(`${name}/fact-sheet.json`, lines(factSheet(structuredClone(a))));
      put(`${name}/prompt.json`, prompts(profile));
      put(`${name}/tools.json`, tools(profile));
      put(`${name}/workspace.json`, pubWorkspace(structuredClone(profile)));
      if (SEEDED.includes(name)) {
        for (const [when, now] of Object.entries(NOWS)) {
          for (const seed of SEEDS) put(`${name}/seed/${when}-seed-${seed}.json`, planPubSeed(structuredClone(profile), now, seed));
        }
      }
    }

    for (const name of ['as-created', 'full']) {
      put(`drafts/faq-${name}.json`, requestOf(() => draftFaqs(factSheet(sanitisePub(structuredClone(corpus[name]))), 'pub', PUB_HANDLES, DRAFT_CONFIG)));
    }

    for (const b of BUILDER_TENANTS.filter((x) => x.preset === 'pub')) {
      const p = builderTenant(b).profile;
      put(`tenants/${b.slug}/profile.json`, p);
      put(`tenants/${b.slug}/prompt.json`, prompts(p));
      put(`tenants/${b.slug}/tools.json`, tools(p));
    }
    return out;
  }, { name: 'pub', script: 'scripts/pub-goldens.ts' });
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
