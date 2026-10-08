// The takeaway golden corpus (PRESETS.md §4), recorded when it went live:
// what the preset does with a fixed set of answers, so a later change to
// shared code (or to this preset) cannot alter it unseen.
// test/takeaway-golden.test.ts recomputes every value and compares it.
//
//   node scripts/takeaway-goldens.ts            rewrite test/fixtures/takeaway/golden/
//   node scripts/takeaway-goldens.ts --corpus   rebuild the corpus inputs too
//
// As with the others: the corpus inputs are written once and left alone, so
// a change to the defaults or a cap shows as a changed golden; a golden
// changes only in a commit that names the change and says why.

import { existsSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultAnswers } from '../src/presets/takeaway/answers.ts';
import { compileTakeaway } from '../src/presets/takeaway/compile.ts';
import { TAKEAWAY_HANDLES, factSheet, takeawayPreview, takeawayWorkspace } from '../src/presets/takeaway/preset.ts';
import { sanitiseTakeaway } from '../src/presets/takeaway/sanitise.ts';
import { validateTakeaway } from '../src/presets/takeaway/validate.ts';
import { planTakeawaySeed } from '../src/presets/takeaway/seed.ts';
import { draftFaqs } from '../src/presets/common/drafts.ts';
import { compilePrompt, type PromptContext } from '../src/core/prompt.ts';
import { toolDeclarations } from '../src/core/tools.ts';
import { DEFAULT_DEMO_CARDS } from '../src/domain/payments.ts';
import { BUILDER_TENANTS, builderTenant } from '../src/eval/scenarios.ts';
import type { TenantProfile } from '../src/domain/types.ts';
import type { Config } from '../src/config.ts';
import { goldenFilesIn, lines, readJson, stored, withoutClock, write } from './goldens.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures', 'takeaway');
const CORPUS_DIR = join(ROOT, 'corpus');
export const GOLDEN_DIR = join(ROOT, 'golden');

// ── Fixed time ───────────────────────────────────────────────────────────

// Europe/London is on summer time until 25 October 2026, so these are UTC+1:
// a Friday at 7pm in the rush, a Wednesday lunchtime, and a Saturday at
// 11:40pm, twenty minutes before a midnight close.
const NOWS = {
  'friday-1900': new Date('2026-10-09T18:00:00Z'),
  'wednesday-1240': new Date('2026-10-07T11:40:00Z'),
  'saturday-2340': new Date('2026-10-10T22:40:00Z'),
} as const;
const SEEDS = [1, 42] as const;
const SEEDED = ['as-created', 'full'];

const PROMPTS: Record<string, PromptContext> = {
  phone: {
    now: NOWS['friday-1900'], callerPhone: '+447700900801', knownCustomer: { name: 'Amy Clarke' },
    demoCards: DEFAULT_DEMO_CARDS, canTransfer: true, channel: 'phone',
  },
  browser: { now: NOWS['friday-1900'], callerPhone: null, knownCustomer: null, demoCards: DEFAULT_DEMO_CARDS, canTransfer: false, channel: 'browser' },
};

const DRAFT_CONFIG = { textModel: 'text-model', keys: { text: 'golden-key' } } as unknown as Config;

// ── The corpus ───────────────────────────────────────────────────────────

export const CORPUS = ['as-created', 'full', 'max', 'every-issue', 'empty', 'null', 'junk'] as const;

/** As POST /workspaces makes one: the defaults with the takeaway's name. */
function asCreated(): unknown {
  const a = defaultAnswers();
  a.basics.name = 'Firebird Chicken & Burgers';
  return a;
}

/** Every setting away from its default: phone payment only, one zone, no free delivery, no timed orders, a deal changed and one gone. */
function full(): unknown {
  const a = defaultAnswers();
  a.basics = { ...a.basics, name: 'Ember & Bun', style: 'Smash burgers, wings and loaded fries', town: 'Kirkhill', address: '9 Forge Street, Kirkhill NG1 (example)', website: 'https://www.emberandbun.example', voice: 'Puck', greeting: "Hiya, Ember & Bun. I'm the AI assistant on this demo line: what can I get you?" };
  a.hours.days = a.hours.days.map((d, i) => (i === 1 ? { open: false, services: [] } : { open: true, services: [{ label: 'Open', open: '16:00', close: i >= 5 ? '24:00' : '22:30' }] }));
  a.hours.closures = [{ date: '2026-12-25', note: 'Christmas Day' }];
  a.ordering.collection = { ...a.ordering.collection, prep_minutes: 20, slot_minutes: 10, per_slot: 6 };
  a.ordering.delivery = { ...a.ordering.delivery, districts: ['NG1', 'NG2', 'NG3'], fee_pence: 300, min_order_pence: 1500, extra_minutes: 30, zones: [{ code: 'NG3', fee_pence: 400, min_order_pence: 2000 }], free_over_pence: null, drivers: ['Ali', 'Bea'] };
  a.ordering.delivery_apps = ['Deliveroo', 'Uber Eats'];
  a.ordering.timed_orders = false;
  a.kitchen = { last_orders_minutes: 30, big_order_mains: 8, catering_over_mains: 20 };
  a.deals = a.deals.filter((d) => d.key !== 'pizza_night');
  a.deals[0].price_pence = 949;
  a.deals[0].description = 'Any burger, regular fries and a can.';
  a.money = { payment: 'phone', pay_driver: 'cash', card_minimum_pence: 500 };
  a.after = { late_after_minutes: 30, missing_items: 'send_out', pay_on_phone_numbers: [] };
  a.nation = 'wales';
  a.alcohol = { on: true, until: '22:00', items: [{ name: 'Craft lager', price_pence: 450, description: '440ml can.' }] };
  a.policies = { ...a.policies, halal: 'all', hygiene_rating: 4, offers: 'Tuesdays: two Burger meals for £16, collection only.', parking: 'Street parking only.', faqs: [{ q: 'Do you do vegan cheese?', a: 'Yes, on any burger for 80p.' }] };
  a.theme = { ...a.theme, accent: '#d94f30' };
  return a;
}

const text = (n: number, tag: string) => `${tag} `.repeat(Math.ceil(n / (tag.length + 1))).slice(0, n);

/** Everything at its cap, or past it: the most the prompt and the tools can be asked to carry. */
function max(): unknown {
  const a = defaultAnswers();
  a.basics.name = text(70, 'Name');
  a.basics.style = text(200, 'Style');
  a.basics.address = `${text(170, 'Address')} NG1`;
  a.basics.town = text(70, 'Town');
  a.basics.greeting = `Hello, you're through to the AI assistant on this demo line. ${text(300, 'Greeting')}`;
  const three = (d: number) => ({ open: true, services: [
    { label: 'Open', open: `0${7 + (d % 2)}:${d % 2 ? '15' : '45'}`, close: '10:30' },
    { label: 'Open', open: `11:${10 + d}`, close: `13:${20 + d}` },
    { label: 'Open', open: `14:${10 + d}`, close: `2${d % 3}:${30 + d}` },
  ] });
  a.hours.days = a.hours.days.map((_, d) => three(d));
  // Not in a run, so the facts cannot fold them; every one with its own price.
  const districts = Array.from({ length: 35 }, (_, i) => `NG${1 + i * 2}`);
  a.ordering.delivery = { ...a.ordering.delivery, districts, zones: districts.map((code, i) => ({ code, fee_pence: 100 + i * 10, min_order_pence: 1000 + i * 50 })), drivers: Array.from({ length: 14 }, (_, i) => `Driver ${i} ${text(40, 'name')}`) };
  a.ordering.delivery_apps = ['Deliveroo', 'Uber Eats', 'Just Eat', 'Another App', 'One More', 'Too Many'];
  a.deals = Array.from({ length: 15 }, (_, i) => ({ ...structuredClone(a.deals[0]), key: `deal_${i}`, name: `Deal ${i} ${text(50, 'name')}`, description: text(200, 'desc'), parts: Array.from({ length: 7 }, () => structuredClone(a.deals[0].parts[0])) }));
  a.policies.faqs = Array.from({ length: 25 }, (_, i) => ({ q: `Question ${i} ${text(150, 'q')}`, a: text(550, 'answer') }));
  for (const k of ['parking', 'offers', 'bags', 'careers', 'tips'] as const) a.policies[k] = text(320, k);
  a.nation = 'scotland';
  a.alcohol = { on: true, until: null, items: Array.from({ length: 15 }, (_, i) => ({ name: `Drink ${i} ${text(50, 'name')}`, price_pence: 19999, description: text(140, 'desc') })) };
  a.after = { late_after_minutes: 60, missing_items: 'send_out', pay_on_phone_numbers: Array.from({ length: 40 }, (_, i) => `07700 9${String(100000 + i).slice(1)}`) };
  return a;
}

/** One of everything validation names, errors and warnings. */
function everyIssue(): unknown {
  const a = defaultAnswers();
  a.basics.name = 'Every Issue Takeaway';
  a.basics.greeting = 'Hello, Every Issue Takeaway.';
  a.hours.days[1] = { open: true, services: [{ label: 'Open', open: '22:00', close: '12:00' }] };
  a.ordering.delivery = { ...a.ordering.delivery, districts: [], drivers: [], free_over_pence: 500 };
  a.money = { ...a.money, payment: 'collection', pay_driver: 'no' };
  a.menu.categories = a.menu.categories.filter((c) => c.key !== 'pizzas');
  a.deals[0].price_pence = 0;
  a.deals[1].parts = [];
  a.deals.push({ ...structuredClone(a.deals[0]), key: 'dear_meal', name: 'Dear meal', price_pence: 3000 });
  a.policies.faqs.push({ q: 'Half a question', a: '' });
  a.after.pay_on_phone_numbers = ['07700 9008', '07700 900804'];
  a.alcohol = { on: true, until: '23:00', items: [{ name: 'Free beer', price_pence: 0, description: '' }] };
  return a;
}

function junk(): unknown {
  return {
    version: 'nine', basics: { name: 42, voice: 'Nobody', greeting: ['hi'] }, hours: { days: 'every day', closures: [{ date: 'soon' }] },
    ordering: { collection: { prep_minutes: -5, slot_minutes: 7 }, delivery: { districts: ['not a district', 'ng 5', 7], zones: [{ code: 'NG99' }, 'x'], free_over_pence: 'free', drivers: 'Kai' }, timed_orders: 'yes' },
    kitchen: { last_orders_minutes: 999, big_order_mains: 'lots' }, menu: { categories: 'burgers' },
    deals: [{ name: 'Junk', price_pence: -1, parts: [{ label: 'Thing', category_key: 'nowhere', choose: 99, upcharge_pence: { x: 'free' } }] }, 'deal'],
    money: { payment: 'cheque', pay_driver: 'gold', card_minimum_pence: -3 }, nation: 'mars', alcohol: { on: 'yes', until: '25:99', items: 'beer' }, after: { late_after_minutes: 'soon', missing_items: 'refund', pay_on_phone_numbers: [7, 'x'.repeat(40)] }, policies: { halal: 'some', hygiene_rating: 'five', faqs: { q: 1 } }, theme: { accent: 'blue' }, sources: 'web',
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
      const a = sanitiseTakeaway(structuredClone(input));
      const profile = compileTakeaway(structuredClone(a), { slug: 'golden' });
      put(`${name}/sanitised.json`, a);
      put(`${name}/issues.json`, validateTakeaway(structuredClone(a)));
      put(`${name}/profile.json`, profile);
      put(`${name}/preview.json`, takeawayPreview(structuredClone(a), structuredClone(profile)));
      put(`${name}/fact-sheet.json`, lines(factSheet(structuredClone(a))));
      put(`${name}/prompt.json`, prompts(profile));
      put(`${name}/tools.json`, tools(profile));
      put(`${name}/workspace.json`, takeawayWorkspace(structuredClone(profile)));
      if (SEEDED.includes(name)) {
        for (const [when, now] of Object.entries(NOWS)) {
          for (const seed of SEEDS) put(`${name}/seed/${when}-seed-${seed}.json`, planTakeawaySeed(structuredClone(profile), now, seed));
        }
      }
    }

    for (const name of ['as-created', 'full']) {
      put(`drafts/faq-${name}.json`, requestOf(() => draftFaqs(factSheet(sanitiseTakeaway(structuredClone(corpus[name]))), 'takeaway', TAKEAWAY_HANDLES, DRAFT_CONFIG)));
    }

    for (const b of BUILDER_TENANTS.filter((x) => x.preset === 'takeaway')) {
      const p = builderTenant(b).profile;
      put(`tenants/${b.slug}/profile.json`, p);
      put(`tenants/${b.slug}/prompt.json`, prompts(p));
      put(`tenants/${b.slug}/tools.json`, tools(p));
    }
    return out;
  }, { name: 'takeaway', script: 'scripts/takeaway-goldens.ts' });
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
