// A repairs contractor's receptionist (presets/property-maintenance.md
// §4.3): safety advice first, then the property, the fault, and a job in a
// real window with the right engineer; job updates only for someone who
// gave the reference or rings from the number on the job; and the landlord's
// safety certificates.
//
// Everything here is switched on by profile.maintenance, which only the
// property maintenance compile writes, so every other business never
// reaches it. While a caller's emergency is armed and its advice unsaid,
// every tool but safety_advice refuses (core/safety.ts). The tools hold
// nothing that must not be said: no key safe code, no occupant's number,
// no staff-only marker, and no engineer's name or time the board hasn't got.

import { spokenReference, type NewJob } from '../db/repo.ts';
import { addWorkingDays, numberWords } from '../domain/listings.ts';
import { displayUkPhone, normaliseUkPhone, spokenNumber } from '../domain/phone.ts';
import { addDays, isIsoDate, minutesOf, spokenDate, spokenTime, toLocal, weekdayOf } from '../domain/time.ts';
import type { Job, JobKind, JobPriority, MaintenanceSettings, MtClient, MtProperty, MtWindow, ReporterRole, Tenant } from '../domain/types.ts';
import { checkWindow, freeWindows, isGasTrade, onCallAt, unable, windowAt, windowOf, windowsOn } from '../domain/windows.ts';
import { inSentence } from '../presets/maintenance/answers.ts';
import { SAFETY_KINDS, SAFETY_VERSION, safetyScript, type SafetyKind } from '../presets/maintenance/nations.ts';
import { fullAddress, shortAddress } from '../presets/maintenance/properties.ts';
import type { FunctionDeclaration } from './live.ts';
import { BANK_TALK } from './guardrails.ts';
import { GATED, safetyFirst } from './safety.ts';
import { ASK_NAME, B, I, S, bool, int, obj, postcodeOf, realName, record, smsTo, str } from './tool-kit.ts';
import type { Args, Tool, ToolContext } from './tools.ts';

const hasMt = (t: Tenant) => Boolean(t.profile.maintenance);
const mt = (ctx: ToolContext): MaintenanceSettings => ctx.tenant.profile.maintenance!;
const local = (ctx: ToolContext) => toLocal(ctx.now(), ctx.tenant.profile.timezone);
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const source = (ctx: ToolContext) => (ctx.channel === 'phone' ? 'phone' : ctx.channel);
const money = (pence: number) => `£${Math.floor(pence / 100).toLocaleString('en-GB')}${pence % 100 ? `.${String(pence % 100).padStart(2, '0')}` : ''}`;
const incVat = (m: MaintenanceSettings) => (m.prices.vat_registered ? ' including VAT' : '');
const tradeLabel = (m: MaintenanceSettings, key: string) => inSentence(m.trades.find((t) => t.key === key)?.label ?? key.replace(/_/g, ' '));
const firstName = (m: MaintenanceSettings, key: string | null) => m.engineers.find((e) => e.key === key)?.first_name ?? '';
/** Bank holidays are kept for three nations; Scotland's are not yet, so it counts England's (presets/property-maintenance.md §4.2). */
const nationForDays = (m: MaintenanceSettings) => (m.nation === 'scotland' ? 'england' : m.nation);

/** The refusal while an emergency's advice is unsaid; null when the tool may go on. */
export function safetyGate(ctx: ToolContext): Record<string, unknown> | null {
  const s = ctx.state.safety;
  return s && !s.spoken ? safetyFirst(s.kind, mt(ctx).nation) : null;
}

/** "today", "tomorrow", "Thursday 8 October". */
function dayWords(date: string, today: string): string {
  if (date === today) return 'today';
  if (date === addDays(today, 1)) return 'tomorrow';
  return spokenDate(date);
}

/** "Thursday 8 October, in the morning window, 8am to 12 noon". */
export function windowWords(w: MtWindow, date: string, today: string): string {
  return `${dayWords(date, today)}, ${inSentence(w.label).replace(/^(?=[a-z])/, 'the ')} window, ${spokenTime(w.from)} to ${spokenTime(w.to)}${w.premium_pence ? ` (${money(w.premium_pence)} extra)` : ''}`;
}

const WINDOW_WORDS: Record<string, RegExp> = { am: /\b(?:am|morning)\b/i, pm: /\b(?:pm|afternoon)\b/i, evening: /\bevening\b/i, all_day: /\ball day\b/i };

/** A window the model named: its key, its label, or "morning". */
function windowNamed(m: MaintenanceSettings, words: unknown, date?: string): MtWindow | undefined {
  const w = str(words)?.toLowerCase();
  if (!w) return undefined;
  const offered = date ? windowsOn(m, date) : m.windows;
  return offered.find((x) => x.key === w || x.label.toLowerCase() === w)
    ?? offered.find((x) => WINDOW_WORDS[x.key]?.test(w))
    ?? offered.find((x) => w.includes(x.label.toLowerCase()) || x.label.toLowerCase().includes(w));
}

// ── Properties ────────────────────────────────────────────────────────────

/** Letters that sound alike on a phone line: M and N; B, D, P and V; S and F. */
const SOUNDS = ['MN', 'BDPV', 'SF'];
const soundKey = (s: string) => s.toUpperCase().replace(/[A-Z]/g, (c) => SOUNDS.find((g) => g.includes(c))?.[0] ?? c);
/** House numbers easily misheard: 14 or 40, 15 or 50. */
function numbersLike(n: string): string[] {
  const m = /^1([3-9])$/.exec(n) ?? /^([3-9])0$/.exec(n);
  if (!m) return [n];
  return n.startsWith('1') ? [n, `${m[1]}0`] : [n, `1${m[1]}`];
}
const houseNumber = (p: Pick<MtProperty, 'number'>) => /(\d+)\s*$/.exec(p.number)?.[1] ?? '';
const STREET_TYPES = /\b(?:road|rd|street|st|lane|ln|avenue|ave|close|way|drive|dr|court|ct|gardens|gdns|mews|rise|walk|vale|crescent|grove|place|terrace)\b\.?/gi;
const streetCore = (s: string) => s.toLowerCase().replace(/\(example\)/g, '').replace(STREET_TYPES, '').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

type Role = 'occupant' | 'authoriser' | 'homeowner' | 'stranger';

/** Who the caller is to a property, by the number they ring from. */
function roleAt(ctx: ToolContext, p: MtProperty): Role {
  const phone = ctx.callerPhone;
  if (!phone) return 'stranger';
  if (p.occupant.phone === phone) return p.client ? 'occupant' : 'homeowner';
  const client = p.client ? mt(ctx).clients.find((c) => c.key === p.client) : undefined;
  return client?.contact.phone === phone ? 'authoriser' : 'stranger';
}

const KIND_WORDS: Record<string, string> = { agent: 'a letting agent', landlord: 'a landlord', block: 'a block manager', social: 'a housing association', commercial: 'a business', insurer: 'an insurer' };

/** A property as a caller may hear it: who looks after it only to someone on file, and never a code or a staff marker. */
function propertyBrief(ctx: ToolContext, p: MtProperty, role: Role) {
  const client = p.client ? mt(ctx).clients.find((c) => c.key === p.client) : undefined;
  const known = role !== 'stranger';
  return {
    property: p.key,
    says: shortAddress(p),
    looked_after_by: client ? (known ? client.name : `${KIND_WORDS[client.kind] ?? 'a client'} we work for`) : 'the homeowner',
    caller_is: role === 'stranger' ? 'not on file for this property' : role,
    notes: {
      stopcock: p.notes.stopcock,
      ...(known ? { boiler: p.notes.boiler, parking: p.notes.parking, pets: p.notes.pets || undefined } : {}),
      access: p.access.method === 'key_safe' ? 'key safe: the office has the code; never read it out' : p.access.method === 'keys_held' ? 'keys held at the office' : 'the occupant lets the engineer in',
    },
    ...(known && p.vulnerable.length ? { vulnerable: p.vulnerable } : {}),
    gas_supply: p.gas,
  };
}

async function findProperty(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const gate = safetyGate(ctx);
  if (gate) return gate;
  const m = mt(ctx);
  const all = await ctx.repo.listMtProperties(ctx.tenant.id);
  const pc = postcodeOf(args.postcode);
  const number = str(args.number)?.replace(/^(?:number|no\.?)\s*/i, '');
  const street = str(args.street);
  if (pc && !m.districts.some((d) => soundKey(d) === soundKey(pc.district))) {
    return { found: 0, outside: true, message: `We don't cover ${pc.district}: say so kindly, and suggest they look for someone local.` };
  }
  if (!pc && !street) {
    // Only the number they ring from: never read out an address for it, so a stranger learns nothing.
    const phone = normaliseUkPhone(str(args.phone)) ?? ctx.callerPhone;
    if (!phone || phone !== ctx.callerPhone) return { found: 0, message: 'Ask for the postcode and the house number or name.' };
    const mine = all.filter((p) => p.occupant.phone === phone);
    const client = m.clients.find((c) => c.contact.phone === phone);
    if (client) return { found: 0, caller_is: `the contact at ${client.name}`, message: 'Ask which property, by postcode and house number.' };
    if (!mine.length) return { found: 0, message: 'No property on file for this number. Ask for the postcode and the house number or name.' };
    return { found: mine.length, message: "We have this number on file. Ask them to say the address; don't read it out. Then call this again with the postcode and number." };
  }
  const nums = number ? numbersLike(/(\d+)\s*$/.exec(number)?.[1] ?? number) : [];
  const flat = number && /flat|apartment/i.test(number) ? /(?:flat|apartment)\s*(\w+)/i.exec(number)?.[1] : undefined;
  const scored = all.map((p) => {
    let score = 0;
    if (pc && soundKey(p.district) === soundKey(pc.district)) score += 2;
    if (street && (streetCore(p.street) === streetCore(street) || streetCore(p.street).startsWith(streetCore(street)) || streetCore(street).startsWith(streetCore(p.street)))) score += 3;
    if (nums.length) score += nums[0] === houseNumber(p) ? 3 : nums.includes(houseNumber(p)) ? 1 : -5;
    if (flat && !new RegExp(`flat\\s*${flat}\\b`, 'i').test(p.number)) score -= 2;
    return { p, score };
  }).filter((x) => x.score >= (street && nums.length ? 6 : 4)).sort((a, b) => b.score - a.score);
  if (!scored.length) {
    return {
      found: 0,
      message: m.customers.homeowners
        ? "Not on our books. If it's their own home, carry on as a new customer: take the address and postcode for the job. If they rent, ask who their landlord or agent is."
        : 'Not on our books. Ask who their landlord or agent is, and take a message.',
    };
  }
  const best = scored.filter((x) => x.score === scored[0].score).slice(0, 3);
  const props = best.map((x) => x.p);
  if (props.length === 1) {
    ctx.state.property = props[0].key;
    ctx.state.role = roleAt(ctx, props[0]);
  }
  return {
    found: props.length,
    properties: props.map((p) => propertyBrief(ctx, p, roleAt(ctx, p))),
    ...(props.length > 1 ? { ask: 'More than one fits: ask which, by the house number or flat.' } : {}),
    ...(nums.length > 1 && props.length === 1 && houseNumber(props[0]) !== nums[0] ? { check: `Check the number: we have ${houseNumber(props[0])}, they said ${nums[0]}.` } : {}),
  };
}

// ── The fault ─────────────────────────────────────────────────────────────

/** Words that point at a trade, in the order they win: a leaking boiler is the boiler's. */
const TRADE_WORDS: [string, RegExp][] = [
  ['locksmith', /\block(?:ed)? out\b|\block(?:s)?\b|\bkeys?\b/i],
  ['gas_heating', /\bboiler\b|\bheating\b|\bradiators?\b|\bhot water\b|\bthermostat\b|\bpilot\b|\bgas (?:fire|hob|cooker)\b/i],
  ['damp_mould', /\bdamp\b|\bmould\b|\bmold\b|\bcondensation\b|\bblack spots?\b/i],
  ['drainage', /\bdrains?\b|\bblock(?:ed|age)\b|\bsewage\b|\bgully\b|\boverflowing\b|\bslow(?:-| )draining\b/i],
  ['electrical', /\bsockets?\b|\blights?\b|\bfuse\b|\btrip(?:s|ped|ping)?\b|\belectric(?:s|ity|al)?\b|\bpower\b|\bswitch\b|\bextractor\b|\bconsumer unit\b/i],
  ['plumbing', /\bleak\w*\b|\btaps?\b|\btoilet\b|\bpipes?\b|\bwater\b|\bshower\b|\bsink\b|\bcistern\b|\bburst\b|\bdrip\w*\b|\bflush\w*\b/i],
  ['roofing', /\broof\b|\btiles?\b|\bgutters?\b|\bchimney\b|\bslates?\b|\bflashing\b/i],
  ['glazing', /\bwindows?\b|\bglass\b|\bpanes?\b|\bglazing\b|\bboard(?:ed|ing)? up\b|\bdouble glaz/i],
  ['carpentry', /\bdoors?\b|\bcupboards?\b|\bhandrail\b|\bbanister\b|\bfloorboards?\b|\bhinges?\b|\bshel(?:f|ves)\b|\bstairs?\b/i],
  ['decorating', /\bpaint\w*\b|\bdecorat\w*\b|\bplaster\w*\b|\bwallpaper\b/i],
];

const EMERGENCY = /\bburst\b|\buncontroll\w+|\bpouring\b|\bwon'?t stop\b|\bflood\w*\b|\bthrough the ceiling\b|\bceiling (?:is )?(?:coming down|collaps\w+)|\bno (?:power|electric\w*) at all\b|\bwhole house\b[^.?!]{0,30}\bno power\b|\b(?:won'?t|can'?t|doesn'?t|will not) (?:lock|shut|close)\b|\bnot secure\b|\bbroken in\b|\bsewage\b[^.?!]{0,30}\b(?:inside|coming up|in the house)\b/i;
const URGENT = /\bno (?:heating|hot water)\b|\b(?:heating|boiler) (?:isn'?t|not|has stopped|stopped) working\b|\bonly (?:toilet|loo)\b|\bpartial\b|\bsome of the (?:sockets|lights)\b|\broof leak\w*\b|\bleak\w* (?:from|through) the roof\b|\bleak\w*\b/i;
const VULNERABLE = /\b(?:over (?:7[5-9]|[89]\d)|(?:is|she'?s|he'?s|they'?re|aged) (?:7[5-9]|[89]\d)\b|(?:7[5-9]|[89]\d) years? old|elderly|pensioner|bab(?:y|ies)|newborn|toddler|under (?:five|5)|disab\w+|wheelchair|pregnan\w+|medical|asthma|oxygen|dialysis|chemo\w*|terminal\w*|vulnerable)\b/i;
const WINTER = (date: string) => date.slice(5) >= '10-31' || date.slice(5) <= '05-01';
const NO_HEAT = /\bno (?:heating|hot water)\b|\b(?:heating|boiler)\b[^.?!]{0,20}\b(?:not working|broken|stopped|isn'?t working)\b/i;

/** The checks the owner allows, as the receptionist may say them: nothing inside a boiler or a fuse box. */
const CHECKS: Record<keyof MaintenanceSettings['checks'], { trades: string[]; say: string }> = {
  prepayment: { trades: ['gas_heating', 'electrical'], say: 'If you have a prepayment meter, check it has credit.' },
  thermostat: { trades: ['gas_heating'], say: 'Check the thermostat is set above room temperature, and the timer or programmer is on.' },
  trip_reset: { trades: ['electrical'], say: "Look at the fuse box: if one switch is down, push it back up once. If it trips again, leave it off and don't touch anything else." },
  boiler_pressure: {
    trades: ['gas_heating'],
    say: "Look at the pressure gauge on the front of the boiler: about 1 to 1.5 bar is normal. If it's below 1 and you've been shown how to top it up with the filling loop, you can; if not, leave it for the engineer.",
  },
};

const ASK_NEXT: Record<string, string[]> = {
  plumbing: ['Can you turn the water off at the stopcock?', 'Is any water near the electrics?'],
  gas_heating: ['Is it the heating, the hot water, or both?', 'Is anyone in the home over 75, under 5, unwell or disabled?'],
  electrical: ['Is it one socket or light, or the whole home?', 'Is there any burning smell or scorching?'],
  drainage: ['Is it one sink or toilet, or everything?', 'Is anything coming back up inside?'],
  roofing: ['Is water coming in now?', 'Is anything loose that could fall?'],
  locksmith: ['Is anyone vulnerable inside, or anything left on?', 'Can you show proof that you live there?'],
  glazing: ['Is the window secure, or does it need boarding up tonight?'],
  damp_mould: ['Which rooms, and how big an area?', 'Does anyone in the home have asthma or another breathing problem?'],
};

export interface Triage {
  trade: string | null;
  priority: JobPriority;
  reason: string;
  gas: boolean;
  dont_do: { what: string; suggest: string } | null;
}

/** The trade and how soon, from the owner's rules and examples, the vulnerable uplift and the winter rule. Never a diagnosis. */
export function triage(m: MaintenanceSettings, words: string, opts: { vulnerable?: string[]; date: string }): Triage {
  const dontDo = m.dont_do.find((d) => new RegExp(`\\b${d.what.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(words) || d.what.split(/\s+/).some((w) => w.length > 4 && new RegExp(`\\b${w}`, 'i').test(words)));
  const on = new Set(m.trades.map((t) => t.key));
  const trade = TRADE_WORDS.find(([k, re]) => on.has(k) && re.test(words))?.[0] ?? null;
  const example = (xs: string[]) => xs.some((x) => {
    const sig = x.toLowerCase().split(/[^a-z']+/).filter((w) => w.length > 3);
    return sig.length > 0 && sig.filter((w) => words.toLowerCase().includes(w)).length >= Math.min(2, sig.length);
  });
  let level: JobPriority = EMERGENCY.test(words) || example(m.priorities.emergency.examples) ? 'emergency' : URGENT.test(words) || example(m.priorities.urgent.examples) ? 'urgent' : 'routine';
  const why = [level === 'emergency' ? 'Emergency' : level === 'urgent' ? 'Urgent' : 'Routine'];
  const vulnerable = [...(opts.vulnerable ?? []), ...(VULNERABLE.exec(words)?.[0] ? [VULNERABLE.exec(words)![0]] : [])];
  if (m.priorities.winter_heating && WINTER(opts.date) && NO_HEAT.test(words) && vulnerable.length && level === 'routine') {
    level = 'urgent';
    why.push('no heating in winter for a vulnerable household');
  }
  if (m.priorities.vulnerable_uplift && vulnerable.length && level !== 'emergency') {
    level = level === 'routine' ? 'urgent' : 'emergency';
    why.push(`vulnerable occupant (${vulnerable[0]}) +1`);
  }
  return { trade, priority: level, reason: why.join('; '), gas: trade ? isGasTrade(m, trade) : false, dont_do: dontDo ?? null };
}

function targetWords(m: MaintenanceSettings, p: JobPriority): string {
  const pr = m.priorities;
  return p === 'emergency' ? `we aim to attend within ${pr.emergency.attend_hours} hours` : p === 'urgent' ? `within ${pr.urgent.working_days} working days` : `within ${pr.routine.working_days} working days`;
}

/** Out of the office's hours: nights, Sundays and bank holidays. */
function outOfHours(ctx: ToolContext): boolean {
  const l = local(ctx);
  const wd = weekdayOf(l.date);
  if (ctx.tenant.profile.closures?.some((c) => c.date === l.date)) return true;
  return !ctx.tenant.profile.opening_hours.some((h) => h.days.includes(wd) && minutesOf(h.open) <= minutesOf(l.time) && minutesOf(l.time) < minutesOf(h.close));
}

async function triageFault(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const gate = safetyGate(ctx);
  if (gate) return gate;
  const m = mt(ctx);
  const words = [str(args.description), str(args.answers)].filter(Boolean).join('. ');
  if (!words) return { done: false, message: 'Ask what the problem is, in their words.' };
  const key = str(args.property) ?? ctx.state.property;
  const p = key ? await ctx.repo.getMtProperty(ctx.tenant.id, key) : null;
  const t = triage(m, words, { vulnerable: p?.vulnerable, date: local(ctx).date });
  if (t.dont_do) return { trade: null, dont_do: t.dont_do, say: `We don't do ${t.dont_do.what}. Suggest ${t.dont_do.suggest}.` };
  const checks = t.trade
    ? (Object.keys(CHECKS) as (keyof typeof CHECKS)[]).filter((k) => m.checks[k] && CHECKS[k].trades.includes(t.trade!)).map((k) => CHECKS[k].say)
    : [];
  const homeowner = !p || p.client === null;
  const ooh = outOfHours(ctx);
  return {
    trade: t.trade ?? 'investigate',
    trade_words: t.trade ? tradeLabel(m, t.trade) : 'an engineer to take a look',
    priority: t.priority,
    reason: t.reason,
    target: targetWords(m, t.priority),
    gas: t.gas,
    ask_next: t.trade ? (ASK_NEXT[t.trade] ?? []).slice(0, 2) : ['Can you describe where it is and what you can see?'],
    checks_allowed: checks,
    ...(checks.length ? {} : { no_checks: 'Suggest nothing for them to try: no checks are allowed for this.' }),
    ...(homeowner ? { price: ooh && t.priority === 'emergency' ? `Out of hours: ${money(m.prices.ooh_first_hour_pence)}${incVat(m)} for the first hour.` : `Call-out ${money(m.prices.callout_pence)}${incVat(m)}, with the first hour; then ${money(m.prices.half_hour_pence)} a half hour.` } : {}),
    note: "Say the trade and how soon. Never say what's wrong, that it's safe, or what it will cost beyond the price above.",
  };
}

// ── Jobs ──────────────────────────────────────────────────────────────────

const STATUS: Record<Job['status'], string> = {
  new: 'raised, waiting for the engineer to accept', awaiting_approval: 'waiting for approval from the landlord or agent; not booked yet', scheduled: 'booked',
  on_the_way: 'on the way', on_site: 'there now', waiting: 'waiting', done: 'done', invoiced: 'done', cancelled: 'cancelled',
};

/** A job as its reporter or occupant may hear it: first names only, and a time only when the board has one. */
function jobWords(ctx: ToolContext, j: Job, p: MtProperty | null): Record<string, unknown> {
  const m = mt(ctx);
  const l = local(ctx);
  const who = firstName(m, j.engineer_key);
  const w = windowOf(m, j.window_key);
  let status = STATUS[j.status];
  if (j.status === 'scheduled' && w && j.visit_date) status = `booked for ${windowWords(w, j.visit_date, l.date)}${who ? `, with ${who}` : ''}`;
  if (j.status === 'on_the_way' && who) {
    const gone = j.on_the_way_at ? Math.round((ctx.now().getTime() - j.on_the_way_at.getTime()) / 60_000) : 0;
    const left = (j.eta_minutes ?? 30) - gone;
    status = left > 3 ? `${who} is on the way, about ${left} minutes` : `${who} is on the way and should be with them any minute`;
  }
  if (j.status === 'on_site' && who) status = `${who} is there now`;
  if (j.status === 'waiting' && j.waiting_for) status = `waiting for ${j.waiting_for}`;
  if (j.status === 'new' && j.priority === 'emergency' && j.attend_by) status = `raised as an emergency; the engineer has been paged and we aim to be there by ${spokenTime(toLocal(j.attend_by, ctx.tenant.profile.timezone).time)}`;
  if ((j.status === 'done' || j.status === 'invoiced') && j.done_at) status = `done ${dayWords(toLocal(j.done_at, ctx.tenant.profile.timezone).date, l.date)}`;
  const due = j.priority === 'emergency' ? null : addWorkingDays(toLocal(j.created_at, ctx.tenant.profile.timezone).date, j.priority === 'urgent' ? m.priorities.urgent.working_days : m.priorities.routine.working_days, nationForDays(m));
  const late = due && !['done', 'invoiced', 'cancelled'].includes(j.status) && (j.visit_date ?? '9999') > due && l.date > due;
  return {
    reference: j.reference,
    reference_spoken: spokenReference(j.reference),
    about: `${tradeLabel(m, j.trade)}: ${j.description}`,
    at: p ? shortAddress(p) : undefined,
    status,
    ...(late ? { overdue: 'Past our target: say sorry, and take a message for the office (category job, urgency today).' } : {}),
  };
}

/** The text a booked job sends: the window, the first name, the access reminder; a homeowner's carries the cancellation terms. */
function bookedText(ctx: ToolContext, j: Job, homeowner: boolean): string {
  const m = mt(ctx);
  const w = windowOf(m, j.window_key);
  const who = firstName(m, j.engineer_key);
  const when = w && j.visit_date ? `${spokenDate(j.visit_date)}, ${inSentence(w.label)} (${spokenTime(w.from)} to ${spokenTime(w.to)})` : 'as soon as we can';
  return [
    `${ctx.tenant.profile.name}: ${cap(tradeLabel(m, j.trade))} booked for ${when}${who ? ` with ${who}` : ''}. Ref ${j.reference}.`,
    m.visits.adult_present ? 'Someone over 18 needs to be in.' : '',
    m.visits.call_ahead && who ? `${who} will text when on the way.` : '',
    homeowner ? `Call-out ${money(m.prices.callout_pence)}${incVat(m)} with the first hour. ${m.prices.cancellation} Our terms are sent on request.` : '',
    '(Demo)',
  ].filter(Boolean).join(' ');
}

/** The job's client's contact hears of it as their notice setting says, on their own phone. */
async function noticeToClient(ctx: ToolContext, client: MtClient | undefined, j: Job, p: MtProperty): Promise<void> {
  if (!client?.contact.phone) return;
  const send = client.notice === 'every_job' || (client.notice === 'emergencies' && j.priority === 'emergency');
  if (!send) return;
  await smsTo(ctx, client.contact.phone, `${ctx.tenant.profile.name}: new ${j.priority} job ${j.reference} at ${shortAddress(p)}: ${j.description}. (Demo)`);
}

const ROLES: ReporterRole[] = ['occupant', 'agent', 'landlord', 'homeowner', 'other'];
const roleOf = (v: unknown): ReporterRole | null => (ROLES.includes(str(v)?.toLowerCase() as ReporterRole) ? (str(v)!.toLowerCase() as ReporterRole) : /tenant|live/i.test(str(v) ?? '') ? 'occupant' : null);

/** The property a job is for: the one found this call, one named, or a new homeowner's from the address given. */
async function propertyFor(args: Args, ctx: ToolContext): Promise<MtProperty | { reply: Record<string, unknown> }> {
  const m = mt(ctx);
  const key = str(args.property) ?? ctx.state.property;
  if (key) {
    const p = await ctx.repo.getMtProperty(ctx.tenant.id, key);
    if (p) return p;
  }
  const pc = postcodeOf(args.postcode);
  const address = str(args.address);
  if (!pc || !address) return { reply: { done: false, message: 'Find the property first with find_property, or for a new customer give address and postcode.' } };
  if (!m.districts.includes(pc.district)) return { reply: { done: false, outside: true, message: `We don't cover ${pc.district}: say so kindly.` } };
  const role = roleOf(args.role);
  if (role === 'occupant' && m.customers.tenant_no_client === 'contact_landlord') {
    return { reply: { done: false, message: "They rent from a landlord who isn't one of our clients, so we need the landlord's go-ahead first. Take a message (category job) with the landlord's name and number, the address and the repair." } };
  }
  if (!m.customers.homeowners) return { reply: { done: false, message: 'We only work for landlords and agents: take a message.' } };
  const [, number = '', street = address] = /^\s*((?:flat\s*\w+,?\s*)?\d+\w?)?\s*,?\s*(.*)$/i.exec(address) ?? [];
  const phone = normaliseUkPhone(str(args.phone)) ?? ctx.callerPhone;
  const p: MtProperty = {
    key: `new_${(number + street).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)}`,
    number: number.trim(), street: street.trim(), district: pc.district, town: m.towns[0] ?? '', kind: 'house', client: null,
    occupant: { name: realName(args.name) ?? null, phone, texts_ok: true }, notes: {}, access: { method: 'occupant', note: '' },
    vulnerable: [], vulnerable_consent_at: null, markers: [], gas: false, gas_appliances: 0, example: false,
  };
  const saved = await ctx.repo.addMtProperty(ctx.tenant.id, p);
  ctx.state.property = saved.key;
  ctx.state.role = 'homeowner';
  return saved;
}

/** A price said aloud: "£95", "95 pounds", "ninety-five pounds". */
function priceSaid(said: string[], pence: number): boolean {
  const n = Math.round(pence / 100);
  const text = said.join(' ').toLowerCase();
  return text.includes(`£${n}`) || new RegExp(`\\b${n} pounds\\b`).test(text) || text.includes(`${numberWords(n)} pounds`);
}

/** Who gets the page for an emergency: on call out of hours, or whoever is working today, able for the trade. */
function pageFor(ctx: ToolContext, trade: string, gas: boolean, district: string): { key: string; first_name: string } | null {
  const m = mt(ctx);
  const l = local(ctx);
  const pool = outOfHours(ctx) ? onCallAt(m, l.date, l.time) : m.engineers.filter((e) => e.days.includes(weekdayOf(l.date)));
  const able = pool.filter((e) => !unable(m, e, { trade, gas, district }));
  // Out of hours, whoever is on call makes it safe even outside their trade; gas still needs Gas Safe.
  return able[0] ?? (outOfHours(ctx) ? pool.find((e) => !gas || e.gas_safe) ?? null : null);
}

async function createJob(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const m = mt(ctx);
  const found = await propertyFor(args, ctx);
  if ('reply' in found) return found.reply;
  const p = found;
  const client = p.client ? m.clients.find((c) => c.key === p.client) : undefined;
  if (client?.status === 'on_stop') return { booked: false, message: `We can't book work for ${client.name} at the moment. Take a message for the office (category client).` };
  const description = str(args.description);
  if (!description) return { booked: false, message: 'Say what the problem is in a few words (description), then call again.' };
  const l = local(ctx);
  const t = triage(m, description, { vulnerable: p.vulnerable, date: l.date });
  const trade = str(args.trade) && m.trades.some((x) => x.key === str(args.trade)) ? str(args.trade)! : t.trade;
  if (!trade) return { booked: false, message: `Use triage_fault first to find the trade. Trades: ${m.trades.map((x) => x.key).join(', ')}.` };
  const asked = str(args.priority) as JobPriority | undefined;
  // The tool's priority stands unless the model asks for a higher one: a caller's say-so never lowers an emergency.
  const order: JobPriority[] = ['routine', 'urgent', 'emergency'];
  const priority = asked && order.includes(asked) && order.indexOf(asked) > order.indexOf(t.priority) ? asked : t.priority;
  const name = realName(args.name) ?? (ctx.callerPhone === p.occupant.phone ? p.occupant.name ?? undefined : undefined);
  if (!name) return { booked: false, message: ASK_NAME };
  const homeowner = p.client === null;
  if (homeowner && !priceSaid(ctx.state.said, m.prices.callout_pence) && !ctx.state.priceAsked) {
    ctx.state.priceAsked = true;
    return { booked: false, message: `Not booked yet. Tell them the price first: call-out ${money(m.prices.callout_pence)}${incVat(m)}, with the first hour, then ${money(m.prices.half_hour_pence)} a half hour. If they're happy, call this again.` };
  }
  const gas = isGasTrade(m, trade) || t.gas;
  const phone = normaliseUkPhone(str(args.phone)) ?? ctx.callerPhone;
  const role = roleOf(args.role) ?? (ctx.state.role === 'authoriser' ? (client?.kind === 'agent' ? 'agent' : 'landlord') : homeowner ? 'homeowner' : 'occupant');
  if (str(args.vulnerable) && bool(args.consent)) await ctx.repo.setVulnerable(ctx.tenant.id, p.key, [...new Set([...p.vulnerable, str(args.vulnerable)!])], ctx.now());
  const flags = [...(gas ? ['gas'] : []), ...(p.vulnerable.length || str(args.vulnerable) ? ['vulnerable'] : []), ...(p.notes.pets ? ['pets'] : []), ...(p.access.method === 'key_safe' || p.access.method === 'keys_held' ? ['key_collection'] : [])];
  const base: NewJob = {
    property_key: p.key, client_key: p.client, reporter: { name, phone, role }, trade, priority, reason: t.reason, description, kind: 'repair',
    po: str(args.po) ?? null, notes: str(args.access) ?? null, source: source(ctx), call_id: ctx.callId || null, flags,
  };

  if (priority === 'emergency') {
    const e = pageFor(ctx, trade, gas, p.district);
    const ooh = outOfHours(ctx);
    const attendBy = new Date(ctx.now().getTime() + m.priorities.emergency.attend_hours * 3_600_000);
    const job = await ctx.repo.createJob(ctx.tenant, { ...base, status: 'new', attend_by: attendBy, engineer_key: e?.key ?? null, flags: [...flags, 'paged', ...(ooh ? ['out_of_hours'] : [])] });
    record(ctx, job.reference, 'job', 'committed');
    ctx.state.jobsVerified.push(job.reference);
    const mobile = normaliseUkPhone(ctx.tenant.profile.team?.find((x) => x.key === e?.key)?.mobile);
    if (mobile) await smsTo(ctx, mobile, `${ctx.tenant.profile.name} URGENT: ${tradeLabel(m, trade)} at ${fullAddress(p)}: ${description}. Job ${job.reference}. Accept on the job sheet.`);
    await smsTo(ctx, phone, `${ctx.tenant.profile.name}: emergency job ${job.reference} raised. Our ${ooh ? 'on-call ' : ''}engineer has been paged; we'll text you when they're on the way. (Demo)`);
    if (client) await noticeToClient(ctx, client, job, p);
    ctx.action({ kind: 'job_created', title: `Emergency · ${cap(tradeLabel(m, trade))}`, detail: `${shortAddress(p)} · paged ${e?.first_name ?? 'nobody free'} · ref ${job.reference}`, data: { reference: job.reference } });
    return {
      booked: true, reference: job.reference, reference_spoken: spokenReference(job.reference), priority,
      say: `Our ${ooh ? 'on-call ' : ''}engineer has been paged. We aim to be with them within ${m.priorities.emergency.attend_hours} hours, and they'll get a text as soon as the engineer accepts.`,
      never: "Don't give the engineer's name or an arrival time: nobody has accepted yet.",
    };
  }

  // Over the client's limit: their contact approves, on their own phone, before anything is booked.
  const estimate = int(args.estimate_pounds);
  if (client && estimate && estimate * 100 > client.works_limit_pence) {
    const job = await ctx.repo.createJob(ctx.tenant, { ...base, status: 'awaiting_approval', price_pence: estimate * 100 });
    record(ctx, job.reference, 'job', 'committed');
    ctx.state.jobsVerified.push(job.reference);
    if (client.contact.phone) await smsTo(ctx, client.contact.phone, `${ctx.tenant.profile.name}: job ${job.reference} at ${shortAddress(p)} needs your approval (about ${money(estimate * 100)}, over your ${money(client.works_limit_pence)} limit). (Demo)`);
    ctx.action({ kind: 'job_created', title: `Awaiting approval · ${cap(tradeLabel(m, trade))}`, detail: `${shortAddress(p)} · ${client.name} · ref ${job.reference}`, data: { reference: job.reference } });
    return { booked: false, awaiting_approval: true, reference: job.reference, reference_spoken: spokenReference(job.reference), say: `This needs ${client.name}'s approval first. We've asked them, and we'll call back with a time once they say yes. It isn't booked yet.` };
  }

  const date = str(args.date);
  const w = date && isIsoDate(date) ? windowNamed(m, args.window, date) : undefined;
  if (!date || !isIsoDate(date) || !w) {
    const free = freeWindows(m, await ctx.repo.listJobs(ctx.tenant.id), { trade, gas, district: p.district, from: l.date, now: l });
    return { booked: false, message: 'Offer these windows and call again with the date and window they choose.', windows: free.map((f) => ({ date: f.date, window: f.window.key, say: windowWords(f.window, f.date, l.date) })) };
  }
  const jobs = await ctx.repo.listJobs(ctx.tenant.id);
  const tooSoon = date < l.date || (date === l.date && minutesOf(w.from) < minutesOf(l.time) + m.visits.notice_hours * 60);
  const c = tooSoon ? null : checkWindow(m, jobs, { date, window: w.key, trade, gas, district: p.district });
  if (!c || !c.ok) {
    const free = freeWindows(m, jobs, { trade, gas, district: p.district, from: l.date, now: l });
    return { booked: false, message: `That window isn't free${tooSoon ? ' (too soon)' : ''}. Offer these instead.`, windows: free.map((f) => ({ date: f.date, window: f.window.key, say: windowWords(f.window, f.date, l.date) })) };
  }
  const e = c.engineers[0];
  const price = homeowner ? m.prices.callout_pence + w.premium_pence : null;
  const job = await ctx.repo.createJob(ctx.tenant, { ...base, status: 'scheduled', visit_date: date, window_key: w.key, engineer_key: e.key, price_pence: price });
  record(ctx, job.reference, 'job', 'committed');
  ctx.state.jobsVerified.push(job.reference);
  await smsTo(ctx, phone, bookedText(ctx, job, homeowner));
  if (client) await noticeToClient(ctx, client, job, p);
  ctx.action({ kind: 'job_created', title: `${cap(priority)} · ${cap(tradeLabel(m, trade))}`, detail: `${shortAddress(p)} · ${windowWords(w, date, l.date)} · ${e.first_name} · ref ${job.reference}`, data: { reference: job.reference } });
  return {
    booked: true, reference: job.reference, reference_spoken: spokenReference(job.reference), priority,
    when: windowWords(w, date, l.date), engineer: e.first_name,
    ...(price ? { price: `${money(price)}${incVat(m)} call-out, with the first hour` } : {}),
    text_sent: Boolean(phone),
    remind: m.visits.adult_present ? 'Someone over 18 needs to be in.' : undefined,
  };
}

async function findJobs(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const ref = str(args.reference)?.replace(/[^a-z0-9]/gi, '').toUpperCase();
  let jobs: Job[] = [];
  if (ref) {
    jobs = await ctx.repo.listJobs(ctx.tenant.id, { reference: ref });
    if (!jobs.length) return { found: 0, message: `No job ${spokenReference(ref)}. Ask them to read it from their text again, one character at a time.` };
  } else if (ctx.callerPhone) {
    // Only the number they ring from counts: a number they say could be anyone's.
    jobs = (await ctx.repo.listJobs(ctx.tenant.id, { phone: ctx.callerPhone })).filter((j) => !['cancelled'].includes(j.status)).slice(0, 3);
  }
  if (!jobs.length) {
    return { found: 0, message: "Nothing found. Ask for the job reference from their text. Never look a job up by address alone: say you can't give job details without the reference or a call from the number on the job." };
  }
  const props = new Map((await ctx.repo.listMtProperties(ctx.tenant.id)).map((p) => [p.key, p]));
  for (const j of jobs) {
    record(ctx, j.reference, 'job', 'found');
    if (!ctx.state.jobsVerified.includes(j.reference)) ctx.state.jobsVerified.push(j.reference);
  }
  return { found: jobs.length, jobs: jobs.map((j) => jobWords(ctx, j, j.property_key ? props.get(j.property_key) ?? null : null)) };
}

async function verifiedJob(args: Args, ctx: ToolContext): Promise<{ job: Job } | { reply: Record<string, unknown> }> {
  const ref = str(args.reference)?.replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (!ref) return { reply: { done: false, message: 'Ask for the job reference from their text.' } };
  const [job] = await ctx.repo.listJobs(ctx.tenant.id, { reference: ref });
  if (!job) return { reply: { done: false, message: `No job ${spokenReference(ref)}. Ask them to read it again.` } };
  if (!ctx.state.jobsVerified.includes(job.reference)) ctx.state.jobsVerified.push(job.reference);
  return { job };
}

async function moveJob(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const m = mt(ctx);
  const v = await verifiedJob(args, ctx);
  if ('reply' in v) return v.reply;
  const j = v.job;
  if (!['new', 'scheduled'].includes(j.status) || j.priority === 'emergency') return { moved: false, message: `It can't be moved now (${STATUS[j.status]}). Take a message for the office.` };
  const l = local(ctx);
  const date = str(args.date);
  const w = date && isIsoDate(date) ? windowNamed(m, args.window, date) : undefined;
  const p = j.property_key ? await ctx.repo.getMtProperty(ctx.tenant.id, j.property_key) : null;
  const jobs = await ctx.repo.listJobs(ctx.tenant.id);
  const q = { trade: j.trade, gas: j.flags.includes('gas'), district: p?.district, exclude: j.reference };
  const tooSoon = !date || !w || date < l.date || (date === l.date && minutesOf(w.from) < minutesOf(l.time) + m.visits.notice_hours * 60);
  const c = tooSoon ? null : checkWindow(m, jobs, { ...q, date: date!, window: w!.key });
  if (!c || !c.ok) {
    const free = freeWindows(m, jobs, { ...q, from: l.date, now: l });
    return { moved: false, message: 'Offer these windows, then call again with the one they choose.', windows: free.map((f) => ({ date: f.date, window: f.window.key, say: windowWords(f.window, f.date, l.date) })) };
  }
  const e = c.engineers.find((x) => x.key === j.engineer_key) ?? c.engineers[0];
  const moved = await ctx.repo.updateJob(ctx.tenant.id, j.reference, { visit_date: date!, window_key: w!.key, engineer_key: e.key, status: 'scheduled' }, `moved to ${windowWords(w!, date!, l.date)}`, { by: 'receptionist', from: ['new', 'scheduled'] });
  if (!moved) return { moved: false, message: 'It changed while we were talking: take a message for the office.' };
  record(ctx, moved.reference, 'change', 'committed');
  const to = j.reporter.phone ?? ctx.callerPhone;
  await smsTo(ctx, to, bookedText(ctx, moved, j.client_key === null).replace(' booked for ', ' moved to '));
  const client = j.client_key ? m.clients.find((c2) => c2.key === j.client_key) : undefined;
  if (client?.contact.phone && client.notice === 'every_job') await smsTo(ctx, client.contact.phone, `${ctx.tenant.profile.name}: job ${j.reference} moved to ${windowWords(w!, date!, l.date)}. (Demo)`);
  ctx.action({ kind: 'job_changed', title: `Job moved · ${j.reference}`, detail: `${windowWords(w!, date!, l.date)} · ${e.first_name}`, data: { reference: j.reference } });
  return { moved: true, reference: j.reference, when: windowWords(w!, date!, l.date), engineer: e.first_name };
}

async function cancelJob(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const m = mt(ctx);
  const v = await verifiedJob(args, ctx);
  if ('reply' in v) return v.reply;
  const j = v.job;
  const p = j.property_key ? await ctx.repo.getMtProperty(ctx.tenant.id, j.property_key) : null;
  const client = j.client_key ? m.clients.find((c) => c.key === j.client_key) : undefined;
  // A tenant can't cancel their landlord's job: it becomes a request to the client.
  if (client && (!p || roleAt(ctx, p) !== 'authoriser')) {
    await ctx.repo.addMessage({
      tenant_id: ctx.tenant.id, call_id: ctx.callId, kind: 'message', from_name: j.reporter.name ?? 'Caller', from_phone: ctx.callerPhone,
      body: `Asked to cancel job ${j.reference} (${j.description}). Check with ${client.name} first.`, status: 'new', for_staff: 'duty_manager', category: 'job', urgency: 'today', details: { job: j.reference },
    });
    ctx.state.messageTaken = true;
    return { cancelled: false, message: `Only ${client.name} can cancel this job, so tell them it isn't cancelled: the office will check with ${client.name} and call back.` };
  }
  const done = await ctx.repo.updateJob(ctx.tenant.id, j.reference, { status: 'cancelled' }, 'cancelled by the caller', { by: 'receptionist', from: ['new', 'scheduled', 'awaiting_approval', 'waiting'] });
  if (!done) return { cancelled: false, message: `It can't be cancelled now (${STATUS[j.status]}): take a message for the office.` };
  record(ctx, j.reference, 'cancellation', 'committed');
  await smsTo(ctx, j.reporter.phone ?? ctx.callerPhone, `${ctx.tenant.profile.name}: job ${j.reference} is cancelled. To book again, just call us. (Demo)`);
  ctx.action({ kind: 'job_changed', title: `Job cancelled · ${j.reference}`, detail: p ? shortAddress(p) : undefined, data: { reference: j.reference } });
  return { cancelled: true, reference: j.reference };
}

async function jobTool(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const action = str(args.action)?.toLowerCase();
  if (action === 'find') return findJobs(args, ctx);
  const gate = safetyGate(ctx);
  if (gate) return gate;
  switch (action) {
    case 'create': return createJob(args, ctx);
    case 'move': return moveJob(args, ctx);
    case 'cancel': return cancelJob(args, ctx);
    case 'approve':
    case 'decline':
      return { done: false, message: "Approvals are given on the authoriser's own phone, never on a call. Tell them the request is waiting there." };
    default:
      return { error: 'action must be create, find, move or cancel.' };
  }
}

async function checkWindowsTool(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const gate = safetyGate(ctx);
  if (gate) return gate;
  const m = mt(ctx);
  const trade = str(args.trade);
  if (!trade || !m.trades.some((t) => t.key === trade)) return { error: `trade must be one of: ${m.trades.map((t) => t.key).join(', ')}` };
  const key = str(args.property) ?? ctx.state.property;
  const p = key ? await ctx.repo.getMtProperty(ctx.tenant.id, key) : null;
  const l = local(ctx);
  const from = str(args.date) && isIsoDate(str(args.date)!) && str(args.date)! > l.date ? str(args.date)! : l.date;
  const free = freeWindows(m, await ctx.repo.listJobs(ctx.tenant.id), { trade, gas: bool(args.gas) ?? false, district: p?.district, from, now: l });
  if (!free.length) return { windows: [], message: 'Nothing free in the next three weeks: take a message for the office.' };
  return { windows: free.map((f) => ({ date: f.date, window: f.window.key, say: windowWords(f.window, f.date, l.date) })), note: 'Offer two or three; never an exact time.' };
}

// ── Safety certificates ───────────────────────────────────────────────────

const CERT_WORDS: Record<string, string> = { gas_record: 'gas safety record', eicr: 'electrical installation condition report', boiler_service: 'boiler service', alarms: 'alarm check', pat: 'PAT test' };
const minusMonths = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
};

async function compliance(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const gate = safetyGate(ctx);
  if (gate) return gate;
  const m = mt(ctx);
  const key = str(args.property) ?? ctx.state.property;
  const p = key ? await ctx.repo.getMtProperty(ctx.tenant.id, key) : null;
  if (!p) return { done: false, message: 'Find the property first with find_property.' };
  const role = roleAt(ctx, p);
  const l = local(ctx);
  const certs = await ctx.repo.listCertificates(ctx.tenant.id, p.key);
  const action = str(args.action)?.toLowerCase() ?? 'status';
  if (role === 'stranger' || role === 'occupant') {
    return { done: false, message: "Safety records are for the landlord or agent on file, from their own number. Offer to take a message for the office, or to ask the landlord to call." };
  }
  if (action === 'status') {
    return {
      property: shortAddress(p),
      certificates: certs.map((c) => {
        const days = c.expires ? Math.round((Date.parse(c.expires) - Date.parse(l.date)) / 86_400_000) : null;
        const state = c.booked_job ? 'booked' : days === null ? 'unknown' : days < 0 ? 'overdue' : days <= m.planned.reminder_weeks * 7 ? 'due soon' : 'in date';
        const keeps = c.kind === 'gas_record' && c.expires && !c.booked_job ? minusMonths(c.expires, 2) : null;
        return {
          what: CERT_WORDS[c.kind] ?? c.kind,
          runs_to: c.expires ? spokenDate(c.expires) : undefined,
          state,
          ...(keeps ? { book_from: `Booking from ${spokenDate(keeps > l.date ? keeps : l.date)} keeps the ${spokenDate(c.expires!).split(' ').slice(1).join(' ')} date.` } : {}),
          ...(c.remedials.some((r) => !r.done) ? { remedials: c.remedials.filter((r) => !r.done).map((r) => `${r.what}, to be done by ${spokenDate(r.due)}`) } : {}),
        };
      }),
      note: 'Documents go only to the email on file, never read out.',
    };
  }
  if (action !== 'book') return { error: 'action must be status or book.' };
  const what = str(args.services)?.toLowerCase() ?? '';
  const both = /both|and/.test(what) && /gas/.test(what) && /service/.test(what);
  const kind: JobKind = both ? 'gas_record_and_service' : /eicr|electric/.test(what) ? 'eicr' : /service/.test(what) ? 'boiler_service' : 'gas_record';
  const trade = kind === 'eicr' ? 'electrical' : 'boiler_servicing';
  if (!m.trades.some((t) => t.key === trade)) return { done: false, message: "We don't do that: take a message." };
  const extra = Math.max(0, (int(args.appliances) ?? p.gas_appliances ?? 1) - 1);
  const price = kind === 'eicr' ? m.planned.eicr_from_pence : kind === 'boiler_service' ? m.planned.boiler_service_pence
    : (kind === 'gas_record_and_service' ? m.planned.combined_pence : m.planned.gas_record_pence) + extra * m.planned.extra_appliance_pence;
  const date = str(args.date);
  const w = date && isIsoDate(date) ? windowNamed(m, args.window, date) : undefined;
  const gasCert = certs.find((c) => c.kind === 'gas_record');
  const keeps = gasCert?.expires && kind !== 'eicr' && kind !== 'boiler_service' ? minusMonths(gasCert.expires, 2) : null;
  const jobs = await ctx.repo.listJobs(ctx.tenant.id);
  const offer = () => freeWindows(m, jobs, { trade, gas: kind !== 'eicr', district: p.district, from: keeps && keeps > l.date ? keeps : l.date, now: l })
    .map((f) => ({ date: f.date, window: f.window.key, say: windowWords(f.window, f.date, l.date) }));
  if (!date || !w) return { booked: false, price: `${money(price)}${incVat(m)}`, message: 'Say the price, offer these windows, and call again with the one they choose.', windows: offer() };
  if (keeps && date < keeps && !bool(args.early)) {
    return { booked: false, message: `Booking before ${spokenDate(keeps)} loses the current record's date: the new one would run 12 months from the visit. Offer ${spokenDate(keeps)} or later, or call again with early true if they still want it.`, windows: offer() };
  }
  const tooSoon = date < l.date || (date === l.date && minutesOf(w.from) < minutesOf(l.time) + m.visits.notice_hours * 60);
  const c = tooSoon ? null : checkWindow(m, jobs, { date, window: w.key, trade, gas: kind !== 'eicr', district: p.district });
  if (!c || !c.ok) return { booked: false, message: "That window isn't free. Offer these instead.", windows: offer() };
  const e = c.engineers[0];
  const name = realName(args.name) ?? m.clients.find((x) => x.key === p.client)?.contact.name ?? p.occupant.name ?? undefined;
  if (!name) return { booked: false, message: ASK_NAME };
  const description = kind === 'eicr' ? 'Electrical installation condition report' : kind === 'boiler_service' ? 'Boiler service' : kind === 'gas_record_and_service' ? 'Gas safety record and boiler service' : 'Gas safety record';
  const job = await ctx.repo.createJob(ctx.tenant, {
    property_key: p.key, client_key: p.client, reporter: { name, phone: ctx.callerPhone, role: role === 'authoriser' ? 'landlord' : 'homeowner' }, trade, priority: 'routine',
    reason: 'Planned: safety check', description, kind, status: 'scheduled', visit_date: date, window_key: w.key, engineer_key: e.key, price_pence: price,
    flags: kind === 'eicr' ? [] : ['gas'], source: source(ctx), call_id: ctx.callId || null,
  });
  for (const k of kind === 'gas_record_and_service' ? ['gas_record', 'boiler_service'] as const : [kind === 'eicr' ? 'eicr' as const : kind === 'boiler_service' ? 'boiler_service' as const : 'gas_record' as const]) {
    await ctx.repo.setCertificateBooked(ctx.tenant.id, p.key, k, job.reference);
  }
  record(ctx, job.reference, 'job', 'committed');
  ctx.state.jobsVerified.push(job.reference);
  await smsTo(ctx, ctx.callerPhone, `${ctx.tenant.profile.name}: ${description.toLowerCase()} at ${shortAddress(p)} booked for ${windowWords(w, date, l.date)} with ${e.first_name}, ${money(price)}${incVat(m)}. Ref ${job.reference}. (Demo)`);
  if (p.occupant.phone && p.occupant.texts_ok && p.occupant.phone !== ctx.callerPhone) {
    await smsTo(ctx, p.occupant.phone, `${ctx.tenant.profile.name}: your landlord has booked a ${description.toLowerCase()} for ${windowWords(w, date, l.date)}. Someone over 18 needs to be in. Ref ${job.reference}. (Demo)`);
  }
  ctx.action({ kind: 'job_created', title: `${description} booked`, detail: `${shortAddress(p)} · ${windowWords(w, date, l.date)} · ${e.first_name} · ref ${job.reference}`, data: { reference: job.reference } });
  return { booked: true, reference: job.reference, reference_spoken: spokenReference(job.reference), when: windowWords(w, date, l.date), engineer: e.first_name, price: `${money(price)}${incVat(m)}`, ...(keeps && date >= keeps ? { keeps_date: true } : {}) };
}

// ── Safety advice ─────────────────────────────────────────────────────────

async function safetyAdvice(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const m = mt(ctx);
  const kind = str(args.kind)?.toLowerCase().replace(/[\s-]+/g, '_') as SafetyKind | undefined;
  if (!kind || !SAFETY_KINDS.includes(kind)) return { error: `kind must be one of: ${SAFETY_KINDS.join(', ')}` };
  const s = safetyScript(kind, m.nation);
  const st = ctx.state;
  // The model may spot an emergency the words didn't: it arms the gate too.
  if (GATED.includes(kind) && (!st.safety || st.safety.kind !== kind) && !st.safetyDone.includes(kind)) {
    st.safety = { kind, armed_at: st.heard.length, said_from: st.said.length, spoken: false, incident: null };
  }
  const incident = await ctx.repo.logIncident(ctx.tenant.id, {
    property_key: st.property, kind, advice_version: SAFETY_VERSION, advised_at: st.safety?.kind === kind && st.safety.spoken ? ctx.now() : null,
    caller_phone: ctx.callerPhone, follow_up_job: null, notes: str(args.where) ?? null, source: source(ctx), call_id: ctx.callId || null,
  });
  if (st.safety?.kind === kind) st.safety.incident = incident.id;
  const textSent = s.text ? await smsTo(ctx, ctx.callerPhone, `${s.text} (Demo)`) : null;
  ctx.action({ kind: 'safety_advice', title: `Safety advice · ${s.title}`, detail: s.number ? `Number given: ${s.number}${textSent ? ' (texted)' : ''}` : undefined });
  return {
    say: s.steps,
    ...(s.number ? { number: s.number, number_spoken: spokenNumber(s.number), say_number: 'twice, in groups' } : {}),
    text_sent: Boolean(textSent),
    next: s.next,
    ...(st.safety?.kind === kind && !st.safety.spoken ? { first: 'Say this now, in your own words, before anything else.' } : {}),
  };
}

// ── Messages and hours ────────────────────────────────────────────────────

const CATEGORIES = ['job', 'complaint', 'quote', 'invoice', 'compliance', 'client', 'careers', 'damp', 'safety', 'fraud', 'data', 'general'] as const;
type Category = (typeof CATEGORIES)[number];

/** A message for the office or one engineer, with what it's about and how soon; urgent ones reach a phone at once. */
export async function maintenanceMessage(args: Args, ctx: ToolContext): Promise<Record<string, unknown> | null> {
  const p = ctx.tenant.profile;
  if (!p.maintenance) return null;
  const phone = normaliseUkPhone(str(args.phone)) ?? ctx.callerPhone;
  const body = str(args.message) ?? '';
  const name = str(args.name) ?? 'Unknown';
  const money = BANK_TALK.test(ctx.state.heard.join(' '));
  const chosen = (CATEGORIES as readonly string[]).includes(str(args.category) ?? '') ? (str(args.category) as Category) : 'general';
  const category: Category = money && !['complaint', 'data'].includes(chosen) ? 'fraud' : chosen;
  const asked = str(args.urgency)?.toLowerCase().replace(/\s+/g, '_');
  const urgency = category === 'fraud' ? 'urgent' : asked === 'urgent' || asked === 'today' || asked === 'this_week' ? asked : category === 'complaint' || category === 'safety' || category === 'damp' ? 'today' : 'this_week';
  const forWords = str(args.for)?.toLowerCase() ?? '';
  const engineer = p.maintenance.engineers.find((e) => forWords.includes(e.first_name.toLowerCase()));
  const staff = engineer?.key ?? 'duty_manager';
  await ctx.repo.addMessage({
    tenant_id: ctx.tenant.id, call_id: ctx.callId, kind: 'message', from_name: name, from_phone: phone, body, status: 'new',
    for_staff: staff, category, urgency, details: ctx.state.property ? { property: ctx.state.property } : {},
  });
  ctx.state.messageTaken = true;
  if (category === 'fraud') ctx.state.fraudReported = true;
  const member = p.team?.find((t) => t.key === staff);
  const mobile = normaliseUkPhone(member?.mobile);
  if (urgency === 'urgent' && mobile) await smsTo(ctx, mobile, `${p.name} URGENT message from ${name} (${displayUkPhone(phone)}): ${body}`);
  ctx.action({ kind: 'message_taken', title: `Message for ${member?.first_name ?? 'the office'} · ${category}`, detail: `${name}: ${body}${phone ? ` · ${displayUkPhone(phone)}` : ''}` });
  return { taken: true, for: member?.first_name ?? 'the office', urgency, note: urgency === 'urgent' ? 'Tell them it has gone to the team straight away.' : 'Tell them the office will call back.' };
}

/** The office hours, the visit windows and tonight's cover by trade: never a name. */
export function maintenanceHours(t: Tenant, date: string): Record<string, unknown> {
  const m = t.profile.maintenance!;
  const night = onCallAt(m, date, '20:00');
  const trades = [...new Set(night.flatMap((e) => e.trades))].map((k) => tradeLabel(m, k));
  return {
    visit_windows: windowsOn(m, date).map((w) => `${inSentence(w.label)} ${spokenTime(w.from)} to ${spokenTime(w.to)}${w.premium_pence ? ` (${money(w.premium_pence)} extra)` : ''}`),
    on_call: night.length ? `Out of hours, an engineer is on call for emergencies (${trades.join('; ')})` : 'Nobody on call: take a message for the morning',
  };
}

export function maintenanceParams(decl: FunctionDeclaration, t: Tenant, tool: 'message' | 'hours'): FunctionDeclaration {
  if (!t.profile.maintenance) return decl;
  const params = decl.parameters as { properties: Record<string, unknown>; required?: string[] };
  if (tool === 'hours') return { ...decl, description: 'Office hours, visit windows and out-of-hours cover for a date, or the next 7 days.' };
  return {
    ...decl,
    description: 'A message for the office or one engineer, with what it is about and how soon. Urgent ones reach a phone at once.',
    parameters: {
      ...params,
      properties: { ...params.properties, for: S('An engineer\'s first name, or office'), category: S(`One of: ${CATEGORIES.join(', ')}`), urgency: S('urgent, today or this week') },
    },
  } as FunctionDeclaration;
}

// ── The tools ─────────────────────────────────────────────────────────────

export const MAINTENANCE_TOOLS: Record<string, Tool> = {
  safety_advice: {
    when: hasMt,
    decl: {
      name: 'safety_advice',
      description: 'The fixed safety script for an emergency: what to say, the number (also texted), and what to do next. Say its first lines before anything else.',
      parameters: obj({ kind: S(`One of: ${SAFETY_KINDS.join(', ')}`), where: S('In the property, or outside it') }, ['kind']),
    },
    handler: safetyAdvice,
  },
  find_property: {
    when: hasMt,
    decl: {
      name: 'find_property',
      description: "Find the property by postcode and house number or name (and street). Without them, checks the calling number but never reads an address out. Let the caller say the address.",
      parameters: obj({ postcode: S('The postcode, or its first half'), number: S('House number or name, and flat'), street: S('The street') }),
    },
    handler: findProperty,
  },
  triage_fault: {
    when: hasMt,
    decl: {
      name: 'triage_fault',
      description: "The trade and how soon from what's wrong, the checks the caller may try, and what to ask next. Never a diagnosis.",
      parameters: obj({ description: S("What's wrong, in the caller's words"), answers: S('Their answers so far: vulnerable people, water near electrics...'), property: S('From find_property') }, ['description']),
    },
    handler: triageFault,
  },
  job: {
    when: hasMt,
    decl: {
      name: 'job',
      description: 'Repair jobs. create: after the property, the trade and a window (or for an emergency, none); a homeowner hears the price first. find: by reference, or the calling number. move or cancel: by reference. The only way a job exists.',
      parameters: obj(
        {
          action: S('create, find, move or cancel'), reference: S('For find, move or cancel'), property: S('From find_property'), trade: S('From triage_fault'),
          priority: S('From triage_fault'), description: S('The fault, in a few words'), date: S('YYYY-MM-DD'), window: S('The window key, e.g. am or pm'),
          name: S("The caller's name"), phone: S('Only if not the calling number'), role: S('occupant, agent, landlord, homeowner or other'),
          access: S('How the engineer gets in, or a time to avoid'), vulnerable: S('Anyone vulnerable, as the caller said'), consent: B('They agreed to us noting it'),
          po: S("The agent's purchase order number"), estimate_pounds: I('A quoted price, if there is one'),
          address: S('A new customer: number and street'), postcode: S('A new customer: postcode'),
        },
        ['action'],
      ),
    },
    handler: jobTool,
  },
  check_windows: {
    when: hasMt,
    decl: {
      name: 'check_windows',
      description: 'Free visit windows for a trade over the next few days, in words.',
      parameters: obj({ trade: S('From triage_fault'), date: S('From, YYYY-MM-DD'), property: S('From find_property'), gas: B('Gas work') }, ['trade']),
    },
    handler: checkWindowsTool,
  },
  compliance: {
    when: hasMt,
    decl: {
      name: 'compliance',
      description: "A rented home's safety certificates, for the landlord or agent on file: status (what's due, and the date that keeps a gas record's date), or book a gas safety record, boiler service, both, or an EICR.",
      parameters: obj(
        { property: S('From find_property'), action: S('status or book'), services: S('gas safety record, boiler service, both, or EICR'), date: S('YYYY-MM-DD'), window: S('The window key'), appliances: I('Gas appliances, if more than one'), name: S("The caller's name"), early: B('Book before the date that keeps the record, knowingly') },
        ['property', 'action'],
      ),
    },
    handler: compliance,
  },
};
