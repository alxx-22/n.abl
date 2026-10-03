// The estate agent's golden corpus (PRESETS.md §4), recorded when it went
// live: what the preset does with a fixed set of answers, so a later change
// to shared code (or to the estate agent) cannot alter it unseen.
// test/estate-golden.test.ts recomputes every value and compares it.
//
//   node scripts/estate-goldens.ts            rewrite test/fixtures/estate_agent/golden/
//   node scripts/estate-goldens.ts --corpus   rebuild the corpus inputs too
//
// As with the restaurant's: the corpus inputs are written once and left
// alone, so a change to the defaults or a cap shows as a changed golden; a
// golden changes only in a commit that names the change and says why.

import { existsSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultAnswers } from '../src/presets/estate/answers.ts';
import { compileEstate } from '../src/presets/estate/compile.ts';
import { ESTATE_HANDLES, estatePreview, estateWorkspace, factSheet } from '../src/presets/estate/preset.ts';
import { sanitiseEstate } from '../src/presets/estate/sanitise.ts';
import { validateEstate } from '../src/presets/estate/validate.ts';
import { planEstateSeed } from '../src/presets/estate/seed.ts';
import { draftFaqs } from '../src/presets/common/drafts.ts';
import { compilePrompt, type PromptContext } from '../src/core/prompt.ts';
import { toolDeclarations } from '../src/core/tools.ts';
import { DEFAULT_DEMO_CARDS } from '../src/domain/payments.ts';
import { BUILDER_TENANTS, builderTenant } from '../src/eval/scenarios.ts';
import type { TenantProfile } from '../src/domain/types.ts';
import type { Config } from '../src/config.ts';
import { goldenFilesIn, lines, readJson, stored, withoutClock, write } from './goldens.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures', 'estate_agent');
const CORPUS_DIR = join(ROOT, 'corpus');
export const GOLDEN_DIR = join(ROOT, 'golden');

// ── Fixed time ───────────────────────────────────────────────────────────

// Europe/London is on summer time until 25 October 2026, so these are UTC+1:
// a Tuesday afternoon, a Saturday morning (the busiest viewing day), and a
// Sunday with the office shut.
const NOWS = {
  'tuesday-1400': new Date('2026-10-06T13:00:00Z'),
  'saturday-1030': new Date('2026-10-10T09:30:00Z'),
  'sunday-0900': new Date('2026-10-11T08:00:00Z'),
} as const;
const SEEDS = [1, 42] as const;
const SEEDED = ['as-created', 'full'];

const PROMPTS: Record<string, PromptContext> = {
  phone: {
    now: NOWS['tuesday-1400'], callerPhone: '+447700900123', knownCustomer: { name: 'Sam Price' },
    demoCards: DEFAULT_DEMO_CARDS, canTransfer: true, channel: 'phone',
  },
  browser: { now: NOWS['tuesday-1400'], callerPhone: null, knownCustomer: null, demoCards: DEFAULT_DEMO_CARDS, canTransfer: false, channel: 'browser' },
};

const DRAFT_CONFIG = { textModel: 'text-model', keys: { text: 'golden-key' } } as unknown as Config;

// ── The corpus ───────────────────────────────────────────────────────────

export const CORPUS = ['as-created', 'full', 'max', 'every-issue', 'empty', 'null', 'junk'] as const;

/** As POST /workspaces makes one: the defaults with the company's name. */
function asCreated(): unknown {
  const a = defaultAnswers();
  a.basics.name = 'Hartwell & Green';
  return a;
}

/** Every setting away from its default: Wales, lettings as a message, fees quoted, every partner on, the other redress scheme. */
function full(): unknown {
  const a = defaultAnswers();
  a.basics = { ...a.basics, name: 'Morgan & Price', style: 'Family-run estate agency, sales and lettings messages', town: 'Aberllyn', address: '3 Bridge Street, Aberllyn BK1 4CD', website: 'https://www.morganprice.example', voice: 'Puck', greeting: "Good afternoon, Morgan & Price. I'm the AI assistant on this demo line; how can I help?" };
  a.patch = { nation: 'wales', districts: ['BK1', 'BK2', 'BK7'], towns: ['Aberllyn', 'Pentre'], lettings: 'message', lettings_contact: 'rachel' };
  a.hours.closures = [{ date: '2026-12-25', note: 'Christmas Day' }];
  a.diary.out_of_hours_booking = false;
  a.diary.on_call = null;
  a.team[1].days = [1, 2, 3, 4, 5];
  a.team.push({ key: 'ffion', name: 'Ffion Hughes', role: 'other', does: ['viewings', 'valuations'], days: [6], mobile: '07700 900026' });
  a.viewings = { minutes: 45, second_minutes: 60, travel_minutes: 20, notice_hours: 4, horizon_days: 28, safety: { take_postcode: false, empty_office_hours_only: false } };
  a.offers = { take: 'message', buyer_fee_pence: 0, buyer_fee_when: '', id_provider: '', best_final: 'Best and final offers are made in writing by noon on the day we set.' };
  a.valuations = { name: 'valuation', minutes: 45, rics: { offered: true, fee_pence: 45000, staff: 'priya' } };
  a.fees = { ...a.fees, quote: true, kind: 'fixed', fixed_pence: 199500, min_weeks: 8, contract: 'multi_agency', extras: 'An energy certificate at £85 including VAT.' };
  a.partners.conveyancing = { on: true, statement: 'We can recommend local solicitors; we receive £150 for each referral, and you are free to choose your own.' };
  a.compliance = { redress: 'prs', complaints_handler: 'tom', data_lead: 'dan', recording: 'Calls on this line are transcribed for the team.' };
  a.policies = { faqs: [{ q: 'Do you do lettings?', a: 'We take lettings enquiries as a message for Rachel.' }], parking: 'Park on Bridge Street; the first hour is free.', at_viewings: 'Please take your shoes off at viewings.' };
  a.theme = { ...a.theme, accent: '#3a7d5c' };
  return a;
}

const text = (n: number, tag: string) => `${tag} `.repeat(Math.ceil(n / (tag.length + 1))).slice(0, n);

/** Everything at its cap, or past it: the most the prompt and the tools can be asked to carry. */
function max(): unknown {
  const a = defaultAnswers();
  a.basics.name = text(70, 'Name');
  a.basics.style = text(200, 'Style');
  a.patch.districts = Array.from({ length: 35 }, (_, i) => `BK${i + 1}`);
  a.patch.towns = Array.from({ length: 25 }, (_, i) => `Town ${i + 1} ${text(50, 'long')}`);
  a.team = Array.from({ length: 14 }, (_, i) => ({
    key: `person_${i + 1}`, name: `Person ${i + 1} ${text(60, 'Surname')}`, role: 'negotiator' as const,
    does: ['viewings', 'valuations', 'progression', 'mortgage'] as ('viewings' | 'valuations' | 'progression' | 'mortgage')[], days: [0, 1, 2, 3, 4, 5, 6], mobile: '07700 900099',
  }));
  const sample = a.listings;
  a.listings = Array.from({ length: 34 }, (_, i) => {
    const l = structuredClone(sample[i % sample.length]);
    return {
      ...l, key: `home_${i + 1}`, ref: `HG${200 + i}`, number: `${i + 1}`, street: `${text(70, 'Street')} ${i}`,
      negotiator: `person_${(i % 14) + 1}`, summary: text(250, 'Summary'), features: Array.from({ length: 15 }, (_, j) => `feature ${j} ${text(30, 'x')}`),
      say_up_front: Array.from({ length: 6 }, (_, j) => `Must say ${j}: ${text(220, 'fact')}`), personal_interest: null,
    };
  });
  a.partners.mortgage.staff = 'person_1';
  a.compliance = { ...a.compliance, complaints_handler: 'person_1', data_lead: 'person_1' };
  a.diary.on_call = 'person_1';
  a.area.faqs = Array.from({ length: 25 }, (_, i) => ({ q: `Area question ${i} ${text(150, 'q')}`, a: text(550, 'answer') }));
  a.policies.faqs = Array.from({ length: 25 }, (_, i) => ({ q: `Question ${i} ${text(150, 'q')}`, a: text(550, 'answer') }));
  a.fees.marketing = Array.from({ length: 15 }, (_, i) => `Channel ${i} ${text(60, 'c')}`);
  return a;
}

/** One of everything validation names, errors and warnings. */
function everyIssue(): unknown {
  const a = defaultAnswers();
  a.basics.name = 'Every Issue Estates';
  a.patch.districts = [];
  a.patch.lettings = 'message';
  a.patch.lettings_contact = 'nobody';
  a.team = [
    { key: 'ann', name: 'Ann Price', role: 'manager', does: ['progression'], days: [1, 2, 3, 4, 5], mobile: '' },
    { key: 'ben', name: 'Ben Shaw', role: 'negotiator', does: ['viewings', 'valuations'], days: [], mobile: '' },
    { key: 'cara', name: '', role: 'other', does: [], days: [1], mobile: '' },
  ];
  a.diary.on_call = 'ghost';
  a.compliance.complaints_handler = 'ghost';
  a.compliance.data_lead = 'ghost';
  a.partners.mortgage = { on: true, staff: 'ghost', firm: 'Clearwater Mortgages', statement: '' };
  a.valuations.rics = { offered: true, fee_pence: 30000, staff: 'ghost' };
  a.fees.quote = true;
  a.fees.min_weeks = 0;
  const [l1, l2, l3] = a.listings;
  a.listings = [
    { ...l1, street: '' },
    { ...structuredClone(l2), negotiator: 'ghost', personal_interest: { staff: 'ghost', wording: '' } },
    { ...structuredClone(l2), key: 'duplicate' },
    { ...structuredClone(l3), key: 'leasehold_no_lease', number: '7', street: 'Lease Lane', tenure: 'leasehold', lease: null },
    { ...structuredClone(l3), key: 'no_part_a', number: '8', street: 'Bare Street', status: 'available', price_pence: 0, tenure: 'unknown', local_tax: '', epc: '',
      checks: Object.fromEntries(Object.keys(l3.checks).map((k) => [k, { v: 'unknown', note: '' }])) as typeof l3.checks },
  ];
  return a;
}

function junk(): unknown {
  return {
    version: 'nine', basics: { name: 42, voice: 'Nobody', greeting: ['hi'] }, hours: { days: 'every day', closures: [{ date: 'soon' }] },
    patch: { nation: 'scotland', districts: ['not a district', 'bk 2', 7], towns: 'Brackenford', lettings: 'always' },
    diary: { viewing_days: [null], on_call: { who: 'me' } }, team: [{ name: 'Junk', role: 'king', does: ['everything'], days: [9, 'Monday'] }, 'nobody'],
    listings: [{ status: 'sold', price_pence: -5, type: 'castle', tenure: 'forever', checks: { mining: { v: 'maybe' } }, viewing: { windows: [{ days: [8] }] } }, null],
    viewings: { minutes: 1000, safety: 'yes' }, offers: { take: 'shout', buyer_fee_pence: -1 }, fees: { quote: 'yes', percent_hundredths: 99999 },
    partners: { mortgage: 'on' }, compliance: { redress: 'none' }, area: { faqs: [{ q: '' }] }, policies: null, theme: { accent: 'blue' }, sources: 'web',
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

/** The request the FAQ draft sends the text model, caught as it is sent (see scripts/restaurant-goldens.ts, requestOf). */
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
      const a = sanitiseEstate(structuredClone(input));
      const profile = compileEstate(structuredClone(a), { slug: 'golden' });
      put(`${name}/sanitised.json`, a);
      put(`${name}/issues.json`, validateEstate(structuredClone(a)));
      put(`${name}/profile.json`, profile);
      put(`${name}/preview.json`, estatePreview(structuredClone(a), structuredClone(profile), NOWS['tuesday-1400']));
      put(`${name}/fact-sheet.json`, lines(factSheet(structuredClone(a))));
      put(`${name}/prompt.json`, prompts(profile));
      put(`${name}/tools.json`, tools(profile));
      put(`${name}/workspace.json`, estateWorkspace(structuredClone(profile)));
      if (SEEDED.includes(name)) {
        for (const [when, now] of Object.entries(NOWS)) {
          for (const seed of SEEDS) put(`${name}/seed/${when}-seed-${seed}.json`, planEstateSeed(structuredClone(profile), now, seed));
        }
      }
    }

    for (const name of ['as-created', 'full']) {
      put(`drafts/faq-${name}.json`, requestOf(() => draftFaqs(factSheet(sanitiseEstate(structuredClone(corpus[name]))), 'estate agency', ESTATE_HANDLES, DRAFT_CONFIG)));
    }

    for (const b of BUILDER_TENANTS.filter((x) => x.preset === 'estate_agent')) {
      const p = builderTenant(b).profile;
      put(`tenants/${b.slug}/profile.json`, p);
      put(`tenants/${b.slug}/prompt.json`, prompts(p));
      put(`tenants/${b.slug}/tools.json`, tools(p));
    }
    return out;
  }, { name: 'estate agent', script: 'scripts/estate-goldens.ts' });
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
