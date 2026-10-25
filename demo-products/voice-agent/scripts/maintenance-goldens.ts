// The property maintenance golden corpus (PRESETS.md §4), recorded when it
// went live: what the preset does with a fixed set of answers, so a later
// change to shared code (or to this preset) cannot alter it unseen.
// test/property-maintenance-golden.test.ts recomputes every value and
// compares it.
//
//   node scripts/maintenance-goldens.ts            rewrite test/fixtures/property_maintenance/golden/
//   node scripts/maintenance-goldens.ts --corpus   rebuild the corpus inputs too
//
// As with the others: the corpus inputs are written once and left alone, so
// a change to the defaults or a cap shows as a changed golden; a golden
// changes only in a commit that names the change and says why.

import { existsSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultAnswers } from '../src/presets/maintenance/answers.ts';
import { compileMaintenance } from '../src/presets/maintenance/compile.ts';
import { MAINTENANCE_HANDLES, factSheet, maintenancePreview, maintenanceWorkspace } from '../src/presets/maintenance/preset.ts';
import { sanitiseMaintenance } from '../src/presets/maintenance/sanitise.ts';
import { validateMaintenance } from '../src/presets/maintenance/validate.ts';
import { planMaintenanceSeed } from '../src/presets/maintenance/seed.ts';
import { draftFaqs } from '../src/presets/common/drafts.ts';
import { compilePrompt, type PromptContext } from '../src/core/prompt.ts';
import { toolDeclarations } from '../src/core/tools.ts';
import { DEFAULT_DEMO_CARDS } from '../src/domain/payments.ts';
import { BUILDER_TENANTS, builderTenant } from '../src/eval/scenarios.ts';
import type { TenantProfile } from '../src/domain/types.ts';
import type { Config } from '../src/config.ts';
import { goldenFilesIn, lines, readJson, stored, withoutClock, write } from './goldens.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures', 'property_maintenance');
const CORPUS_DIR = join(ROOT, 'corpus');
export const GOLDEN_DIR = join(ROOT, 'golden');

// ── Fixed time ───────────────────────────────────────────────────────────

// Europe/London is on summer time until 25 October 2026, so these are UTC+1:
// a Wednesday morning with an engineer on the way, a Friday evening in the
// evening window, and 2am on a Sunday with the office shut.
const NOWS = {
  'wednesday-1100': new Date('2026-10-07T10:00:00Z'),
  'friday-1900': new Date('2026-10-09T18:00:00Z'),
  'sunday-0200': new Date('2026-10-11T01:00:00Z'),
} as const;
const SEEDS = [1, 42] as const;
const SEEDED = ['as-created', 'full'];

const PROMPTS: Record<string, PromptContext> = {
  phone: {
    now: NOWS['wednesday-1100'], callerPhone: '+447700900501', knownCustomer: { name: 'Sam Ortiz' },
    demoCards: DEFAULT_DEMO_CARDS, canTransfer: true, channel: 'phone',
  },
  browser: { now: NOWS['wednesday-1100'], callerPhone: null, knownCustomer: null, demoCards: DEFAULT_DEMO_CARDS, canTransfer: false, channel: 'browser' },
};

const DRAFT_CONFIG = { textModel: 'text-model', keys: { text: 'golden-key' } } as unknown as Config;

// ── The corpus ───────────────────────────────────────────────────────────

export const CORPUS = ['as-created', 'full', 'max', 'every-issue', 'empty', 'null', 'junk'] as const;

/** As POST /workspaces makes one: the defaults with the company's name. */
function asCreated(): unknown {
  const a = defaultAnswers();
  a.basics.name = 'Fernhill Property Care';
  return a;
}

/** Every setting away from its default: Scotland, private tenants booked, no VAT, own trade, checks off, the windows changed. */
function full(): unknown {
  const a = defaultAnswers();
  a.basics = { ...a.basics, name: 'Glenburn Repairs', style: 'Repairs and safety checks for homes and landlords', town: 'Glenburn', address: '2 Mill Wynd, Glenburn NG1 (example)', website: 'https://www.glenburn.example', voice: 'Puck', greeting: "Morning, Glenburn Repairs. I'm the AI assistant on this demo line; how can I help?" };
  a.area = { nation: 'scotland', districts: ['NG1', 'NG2', 'NG3'], towns: ['Glenburn', 'Kirkhill'] };
  a.customers = { ...a.customers, agents: false, tenant_no_client: 'private', recharge_lockouts: false };
  a.clients = a.clients.filter((c) => c.kind === 'landlord');
  a.clients[0].status = 'on_stop';
  a.trades.find((t) => t.key === 'decorating')!.on = false;
  a.trades.push({ key: 'fencing', label: 'Fencing and gates', on: true });
  a.engineers.find((e) => e.key === 'shaz')!.trades.push('fencing');
  a.engineers.find((e) => e.key === 'marek')!.districts = ['NG1', 'NG2'];
  a.dont_do = [{ what: 'pest control', suggest: 'the council' }];
  a.priorities = { ...a.priorities, emergency: { ...a.priorities.emergency, attend_hours: 2 }, vulnerable_uplift: false, winter_heating: false };
  a.checks = { prepayment: false, thermostat: true, trip_reset: false, boiler_pressure: false };
  a.visits.windows = [
    { key: 'am', label: 'Morning', from: '08:00', to: '12:00', premium_pence: 0, days: [1, 2, 3, 4, 5, 6] },
    { key: 'pm', label: 'Afternoon', from: '12:00', to: '16:00', premium_pence: 0, days: [1, 2, 3, 4, 5] },
    { key: 'all_day', label: 'All day', from: '08:00', to: '16:00', premium_pence: 1500, days: [1, 2, 3, 4, 5] },
  ];
  a.visits = { ...a.visits, notice_hours: 4, horizon_days: 14, adult_present: false, call_ahead: false };
  a.prices = { ...a.prices, vat_registered: false, callout_pence: 7500, half_hour_pence: 3000, cancellation: 'Cancel any time before we set off.' };
  a.planned = { ...a.planned, gas_record_pence: 6500, reminder_weeks: 4 };
  a.compliance = { ...a.compliance, napit: true, niceic: false, complaints_handler: 'Iain Ross' };
  a.hours.closures = [{ date: '2026-12-25', note: 'Christmas Day' }];
  a.policies.faqs = [{ q: 'Do you clear gutters?', a: 'Yes, with a ladder inspection first.' }];
  a.theme = { ...a.theme, accent: '#3a7d5c' };
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
    { label: 'Open', open: `14:${10 + d}`, close: `1${7 + (d % 3)}:${30 + d}` },
  ] });
  a.hours.days = a.hours.days.map((_, d) => three(d));
  // Not in a run, so the prompt cannot fold them into "NG1 to NG30".
  a.area.districts = Array.from({ length: 35 }, (_, i) => `NG${1 + i * 2}`);
  a.area.towns = Array.from({ length: 25 }, (_, i) => `Town ${i + 1} ${text(50, 'long')}`);
  a.trades = [...a.trades, ...Array.from({ length: 8 }, (_, i) => ({ key: `own_${i}`, label: `Own trade ${i} ${text(40, 'label')}`, on: true }))];
  a.engineers = Array.from({ length: 14 }, (_, i) => ({
    key: `engineer_${i + 1}`, name: `Engineer ${i + 1} ${text(50, 'Surname')}`, trades: a.trades.map((t) => t.key), gas_safe: `9${String(i).padStart(5, '0')} (example)`,
    niceic: true, oftec: true, days: [0, 1, 2, 3, 4, 5, 6], districts: [], per_window: 6, mobile: '07700 900099',
  }));
  a.on_call.nights = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, engineers: ['engineer_1', 'engineer_2', 'engineer_3'] }));
  a.clients = Array.from({ length: 24 }, (_, i) => ({ ...structuredClone(a.clients[0]), key: `client_${i}`, name: `Client ${i} ${text(70, 'name')}`, instructions: text(300, 'note') }));
  a.dont_do = Array.from({ length: 10 }, (_, i) => ({ what: `thing ${i} ${text(50, 'x')}`, suggest: text(160, 'suggest') }));
  a.priorities.emergency.examples = Array.from({ length: 10 }, (_, i) => `example ${i} ${text(70, 'e')}`);
  a.visits.windows = Array.from({ length: 8 }, (_, i) => ({ key: `w${i}`, label: `Window ${i} ${text(25, 'w')}`, from: `${String(6 + i * 2).padStart(2, '0')}:00`, to: `${String(7 + i * 2).padStart(2, '0')}:00`, premium_pence: 5000, days: [0, 1, 2, 3, 4, 5, 6] }));
  a.policies.faqs = Array.from({ length: 25 }, (_, i) => ({ q: `Question ${i} ${text(150, 'q')}`, a: text(550, 'answer') }));
  for (const k of ['guarantee', 'asbestos', 'parking', 'payment', 'careers'] as const) a.policies[k] = text(320, k);
  return a;
}

/** One of everything validation names, errors and warnings. */
function everyIssue(): unknown {
  const a = defaultAnswers();
  a.basics.name = 'Every Issue Repairs';
  a.area.districts = [];
  a.customers = { ...a.customers, homeowners: false, landlords: false, agents: false, social: { on: true, agent_of_landlord: false } };
  a.clients[0].contact.phone = '';
  a.clients[1].status = 'on_stop';
  a.clients.push({ ...structuredClone(a.clients[0]), key: 'nameless', name: '' });
  a.trades.find((t) => t.key === 'roofing')!.on = true;
  a.engineers = a.engineers.filter((e) => e.key !== 'tom');
  a.engineers.find((e) => e.key === 'marek')!.trades.push('gas_heating');
  a.engineers.find((e) => e.key === 'grace')!.days = [];
  a.engineers.push({ ...structuredClone(a.engineers[0]), key: 'nobody', name: '', trades: [], gas_safe: '' });
  a.engineers.push({ ...structuredClone(a.engineers[0]), key: 'idle', name: 'Idle Ivy', trades: [], gas_safe: '' });
  a.on_call.nights[0].engineers = ['priya'];
  a.on_call.duty_manager.mobile = '';
  a.dont_do[0].suggest = '';
  a.priorities.routine.working_days = 2;
  a.visits.windows[0].to = '13:00';
  a.visits.windows[2].to = '16:00';
  a.visits.windows[3].days = [];
  a.prices.vat_registered = false;
  a.planned.reminder_weeks = 12;
  a.policies.faqs.push({ q: 'Half a question', a: '' });
  return a;
}

function junk(): unknown {
  return {
    version: 'nine', basics: { name: 42, voice: 'Nobody', greeting: ['hi'] }, hours: { days: 'every day', closures: [{ date: 'soon' }] },
    area: { nation: 'mars', districts: ['not a district', 'ng 5', 7], towns: 'Nottingham' }, customers: { homeowners: 'yes', social: 'on' },
    clients: [{ name: 'Junk', kind: 'king', works_limit_pence: -5, notice: 'always' }, 'nobody'], trades: [{ label: 'Ponds', gas: true }, null],
    engineers: [{ name: 'Junk', trades: ['everything'], days: [9, 'Monday'], per_window: 99 }], on_call: { nights: 'every', escalate_minutes: -1 },
    priorities: { emergency: { attend_hours: 999 } }, checks: 'all', visits: { windows: [{ from: '25:00', days: [8] }], notice_hours: -4 },
    prices: { callout_pence: 'cheap' }, planned: null, compliance: { niceic: 'maybe' }, policies: null, theme: { accent: 'blue' }, sources: 'web',
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
      const a = sanitiseMaintenance(structuredClone(input));
      const profile = compileMaintenance(structuredClone(a), { slug: 'golden' });
      put(`${name}/sanitised.json`, a);
      put(`${name}/issues.json`, validateMaintenance(structuredClone(a)));
      put(`${name}/profile.json`, profile);
      put(`${name}/preview.json`, maintenancePreview(structuredClone(a), structuredClone(profile), NOWS['wednesday-1100']));
      put(`${name}/fact-sheet.json`, lines(factSheet(structuredClone(a))));
      put(`${name}/prompt.json`, prompts(profile));
      put(`${name}/tools.json`, tools(profile));
      put(`${name}/workspace.json`, maintenanceWorkspace(structuredClone(profile)));
      if (SEEDED.includes(name)) {
        for (const [when, now] of Object.entries(NOWS)) {
          for (const seed of SEEDS) put(`${name}/seed/${when}-seed-${seed}.json`, planMaintenanceSeed(structuredClone(profile), now, seed));
        }
      }
    }

    for (const name of ['as-created', 'full']) {
      put(`drafts/faq-${name}.json`, requestOf(() => draftFaqs(factSheet(sanitiseMaintenance(structuredClone(corpus[name]))), 'property maintenance company', MAINTENANCE_HANDLES, DRAFT_CONFIG)));
    }

    for (const b of BUILDER_TENANTS.filter((x) => x.preset === 'property_maintenance')) {
      const p = builderTenant(b).profile;
      put(`tenants/${b.slug}/profile.json`, p);
      put(`tenants/${b.slug}/prompt.json`, prompts(p));
      put(`tenants/${b.slug}/tools.json`, tools(p));
    }
    return out;
  }, { name: 'property maintenance', script: 'scripts/maintenance-goldens.ts' });
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
