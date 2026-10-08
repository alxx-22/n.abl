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
import { numberWords } from '../domain/listings.ts';
import { addWorkingDays } from '../domain/working-days.ts';
import { displayUkPhone, normaliseUkPhone, spokenNumber } from '../domain/phone.ts';
import { addDays, isIsoDate, minutesOf, spokenDate, spokenTime, toLocal, weekdayOf } from '../domain/time.ts';
import { poundsIn } from '../domain/amounts.ts';
import { processDemoPayment } from '../domain/payments.ts';
import type { Certificate, Invoice, Job, JobKind, JobPriority, MaintenanceSettings, MtClient, MtProperty, MtWindow, ReporterRole, Tenant } from '../domain/types.ts';
import { absentOn, checkWindow, freeWindows, isGasTrade, onCallAt, unable, windowAt, windowOf, windowsOn } from '../domain/windows.ts';
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
export function windowWords(w: MtWindow, date: string, today: string, premium = true): string {
  return `${dayWords(date, today)}, ${inSentence(w.label).replace(/^(?=[a-z])/, 'the ')} window, ${spokenTime(w.from)} to ${spokenTime(w.to)}${premium && w.premium_pence ? ` (${money(w.premium_pence)} extra)` : ''}`;
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
  // The client's contact first: at a business, the site contact who rings is also the one who approves.
  const client = p.client ? mt(ctx).clients.find((c) => c.key === p.client) : undefined;
  if (client?.contact.phone === phone) return 'authoriser';
  if (p.occupant.phone === phone) return p.client ? 'occupant' : 'homeowner';
  return 'stranger';
}

const KIND_WORDS: Record<string, string> = { agent: 'a letting agent', landlord: 'a landlord', block: 'a block manager', social: 'a housing association', commercial: 'a business', insurer: 'an insurer' };

/** A block's name, from its common parts' record: "Riverside Court, 2" is Riverside Court. */
export const blockName = (b: Pick<MtProperty, 'number'>) => b.number.replace(/,?\s*\d+\w?\s*$/, '').trim() || b.number;

/** What a caller in a block hears about it: the shared parts are its managing agent's, inside a flat is the leaseholder's own. */
function blockBrief(ctx: ToolContext, p: MtProperty, block: MtProperty | undefined, known: boolean) {
  if (!block) return {};
  const agent = block.client ? mt(ctx).clients.find((c) => c.key === block.client) : undefined;
  const who = agent ? (known ? agent.name : "the block's managing agent") : 'the freeholder';
  return {
    block: blockName(block),
    shared_parts: `Faults in the shared parts of ${blockName(block)} (the main door and door entry, stairs and landings, their lights, the roof) are for ${who} to instruct. Raise them with job create: they go on the block's own record, once however many residents ring.`,
    ...(p.kind === 'flat' ? { inside_the_flat: "Repairs inside the flat (its taps, boiler or electrics) are the leaseholder's own to arrange and pay for: book them privately at our normal prices. Give no view on what the lease says." } : {}),
  };
}

/** A property as a caller may hear it: who looks after it only to someone on file, and never a code or a staff marker. */
function propertyBrief(ctx: ToolContext, p: MtProperty, role: Role, block?: MtProperty) {
  const client = p.client ? mt(ctx).clients.find((c) => c.key === p.client) : undefined;
  const known = role !== 'stranger';
  return {
    property: p.key,
    says: shortAddress(p),
    looked_after_by: client ? (known ? client.name : `${KIND_WORDS[client.kind] ?? 'a client'} we work for`) : 'the homeowner',
    // "Not on file" read as "refuse" on a live call (6 October): it limits what they hear, not what they may report.
    caller_is: role === 'stranger' ? 'someone not on file: they may report a repair here, but hear no names, times or private details' : role,
    ...(client?.kind === 'social' ? { damp: `Damp or mould here is a job: raise it with job create, never only a message. That tells ${known ? client.name : 'the landlord'} today with the time, and starts their clock.` } : {}),
    ...(role === 'stranger' && client ? { reporting: `Raise their repair with job create, not a message: an agent's staff report jobs for their tenants. ${client.kind === 'agent' || client.kind === 'social' ? 'The client' : 'The landlord'} approves anything over their limit on their own phone.` } : {}),
    notes: {
      stopcock: p.notes.stopcock,
      ...(known ? { boiler: p.notes.boiler, parking: p.notes.parking, pets: p.notes.pets || undefined } : {}),
      access: p.access.method === 'key_safe' ? 'key safe: the office has the code; never read it out' : p.access.method === 'keys_held' ? 'keys held at the office' : 'the occupant lets the engineer in',
    },
    ...(known && p.vulnerable.length ? { vulnerable: p.vulnerable } : {}),
    gas_supply: p.gas,
    ...blockBrief(ctx, p, block, known),
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
  if (pc && !number && !street) return { found: 0, message: 'Ask for the house number or name and the street, then call this again with all three.' };
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
  // "Flat 9" alone has no building number; "Flat 2, 7" has 7.
  const building = number?.replace(/^\s*(?:flat|apartment)\s*\w+\s*,?\s*/i, '') ?? '';
  const nums = /\d/.test(building) ? numbersLike(/(\d+)\s*$/.exec(building)?.[1] ?? building) : [];
  const flat = number && /flat|apartment/i.test(number) ? /(?:flat|apartment)\s*(\w+)/i.exec(number)?.[1] : undefined;
  // A block or a business by its own name: "Flat 9, Riverside Court", "The Copper Kettle".
  const named = (p: MtProperty, q: string | undefined) => {
    const core = q ? streetCore(q) : '';
    return core.length > 2 && streetCore(`${p.number} ${p.site_name ?? ''}`).includes(core);
  };
  const scored = all.map((p) => {
    let score = 0;
    if (pc && soundKey(p.district) === soundKey(pc.district)) score += 2;
    if (street && (streetCore(p.street) === streetCore(street) || streetCore(p.street).startsWith(streetCore(street)) || streetCore(street).startsWith(streetCore(p.street)) || named(p, street))) score += 3;
    else if (!street && named(p, building)) score += 3;
    // "9, Riverside Court" with the block named: 9 is the flat (live, 8 October: read as the building's number, it found nothing).
    const flatHere = !flat && named(p, street ?? building) ? /(?:flat|apartment)\s*(\w+)/i.exec(p.number)?.[1] : undefined;
    if (nums.length) score += nums[0] === houseNumber(p) || (flatHere !== undefined && nums.includes(flatHere)) ? 3 : nums.includes(houseNumber(p)) ? 1 : -5;
    if (flat && !new RegExp(`flat\\s*${flat}\\b`, 'i').test(p.number)) score -= 2;
    // Rung from the occupant's own number: "Flat 4, NG7" is enough (live, 8 October: a leaseholder at Riverside Court
    // wasn't found from that, was taken as a new customer, and his block's door entry fault was priced to him).
    if (ctx.callerPhone && p.occupant.phone === ctx.callerPhone && (pc || flat || nums.length)) score += 3;
    return { p, score };
  }).filter((x) => x.score >= (street && nums.length ? 6 : 4)).sort((a, b) => b.score - a.score);
  if (!scored.length) {
    if (insurerCalling(ctx)) return { found: 0, message: "Not on our books: that's fine for a claim. Take the address and postcode, the claim number, and the policyholder's name and phone, then job create." };
    return {
      found: 0,
      message: m.customers.homeowners
        ? `Not on our books${street ? '' : ' from that'}. ${street ? '' : "Ask for the rest of the address (the street, or the building's name) and search again first. "}If it's their own home, carry on as a new customer: take the address and postcode for the job. If they rent, ask who their landlord or agent is.`
        : 'Not on our books. Ask who their landlord or agent is, and take a message.',
    };
  }
  const best = scored.filter((x) => x.score === scored[0].score).slice(0, 3);
  const props = best.map((x) => x.p);
  if (props.length === 1) {
    ctx.state.property = props[0].key;
    ctx.state.role = roleAt(ctx, props[0]);
  }
  // The authoriser ringing about their own home hears what waits on their yes or no, so a quote is answered, not raised again.
  const waiting = props.length === 1 && ctx.state.role === 'authoriser' ? await awaitingAt(ctx, props[0].key) : [];
  return {
    found: props.length,
    properties: props.map((p) => propertyBrief(ctx, p, roleAt(ctx, p), p.block ? all.find((x) => x.key === p.block) : undefined)),
    ...(waiting.length ? { waiting_for_their_approval: waiting, to_answer: 'For a yes or no to one of these, use job approve or decline with its reference; never raise it again.' } : {}),
    ...(props.length > 1 ? { ask: 'More than one fits: ask which, by the house number or flat.' } : {}),
    ...(nums.length > 1 && props.length === 1 && houseNumber(props[0]) !== nums[0] ? { check: `Check the number: we have ${houseNumber(props[0])}, they said ${nums[0]}.` } : {}),
  };
}

/** Jobs at a home waiting for the client's yes or no, with their quotes. */
async function awaitingAt(ctx: ToolContext, propertyKey: string): Promise<Record<string, unknown>[]> {
  const jobs = (await ctx.repo.listJobs(ctx.tenant.id, { property: propertyKey })).filter((j) => j.status === 'awaiting_approval');
  if (!jobs.length) return [];
  const quotes = await ctx.repo.listQuotes(ctx.tenant.id);
  return jobs.map((j) => {
    const q = quotes.find((x) => x.job_ref === j.reference && x.status === 'sent');
    if (!ctx.state.jobsVerified.includes(j.reference)) ctx.state.jobsVerified.push(j.reference);
    return { reference: q?.reference ?? j.reference, about: j.description.replace(/: quote Q-\d+$/, ''), amount: q || j.price_pence ? money(q?.amount_pence ?? j.price_pence!) : undefined };
  });
}

// ── The fault ─────────────────────────────────────────────────────────────

/** Words that point at a trade, in the order they win: a leaking boiler is the boiler's. */
const TRADE_WORDS: [string, RegExp][] = [
  ['locksmith', /\block(?:ed)? out\b|\block(?:s)?\b|\bkeys?\b/i],
  ['gas_heating', /\bboiler\b|\bheating\b|\bradiators?\b|\bhot water\b|\bthermostat\b|\bpilot\b|\bgas (?:fire|hob|cooker)\b/i],
  ['damp_mould', /\bdamp\b|\bmould\b|\bmold\b|\bcondensation\b|\bblack spots?\b/i],
  ['drainage', /\bdrains?\b|\bblock(?:ed|age)\b|\bsewage\b|\bgully\b|\boverflowing\b|\bslow(?:-| )draining\b/i],
  // The roof before a leak's water or the lights it is near: "leaking through the ceiling from the roof" is a roofer's (live, 8 October).
  ['roofing', /\broof\b|\bgutters?\b|\bchimney\b|\bslates?\b|\bflashing\b|\bceiling\b[^.?!]{0,60}\brain(?:s|ed|ing)?\b|\brain(?:s|ed|ing)?\b[^.?!]{0,60}\bceiling\b/i],
  // A door entry system before carpentry's "door" (live, 8 October: a buzzer that won't release the door went to a joiner).
  ['electrical', /\bdoor ?entry\b|\bentry ?(?:phone|system)\b|\bintercom\b|\bbuzzer\b|\b(?:smoke|heat|carbon monoxide|co|fire) alarms?\b|\bsockets?\b|\blights?\b|\bfuse\b|\btrip(?:s|ped|ping)?\b|\belectric(?:s|ity|al)?\b|\bpower\b|\bswitch\b|\bextractor\b|\bconsumer unit\b/i],
  ['plumbing', /\bleak\w*\b|\btaps?\b|\btoilet\b|\bpipes?\b|\bwater\b|\bshower\b|\bsink\b|\bcistern\b|\bburst\b|\bdrip\w*\b|\bflush\w*\b/i],
  // Tiles off a roof, not a bathroom's.
  ['roofing', /\broof tiles?\b|\btiles?\b[^.?!]{0,30}\b(?:slipp|slid|fall|fell|fallen|blown|missing|off the)\w*/i],
  ['glazing', /\bwindows?\b|\bglass\b|\bpanes?\b|\bglazing\b|\bboard(?:ed|ing)? up\b|\bdouble glaz/i],
  ['carpentry', /\bdoors?\b|\bcupboards?\b|\bhandrail\b|\bbanister\b|\bfloorboards?\b|\bhinges?\b|\bshel(?:f|ves)\b|\bstairs?\b/i],
  ['decorating', /\bpaint\w*\b|\bdecorat\w*\b|\bplaster\w*\b|\bwallpaper\b/i],
];

const EMERGENCY = /\bburst\b|\buncontroll\w+|\bpouring\b|\bwon'?t stop\b|\bflood\w*\b|\bthrough the ceiling\b|\bceiling (?:is )?(?:coming down|collaps\w+)|\bno (?:power|electric\w*) at all\b|\bwhole house\b[^.?!]{0,30}\bno power\b|\b(?:won'?t|can'?t|doesn'?t|will not) (?:lock|shut|close)\b|\bnot secure\b|\bbroken in\b|\bsewage\b[^.?!]{0,30}\b(?:inside|coming up|in the house)\b/i;
// A faulty smoke or carbon monoxide alarm leaves a home unprotected: urgent, whoever's it is.
const URGENT = /\b(?:smoke|heat|carbon monoxide|co) alarms?\b|\bno (?:heating|hot water)\b|\b(?:heating|boiler) (?:isn'?t|not|has stopped|stopped) working\b|\bonly (?:toilet|loo)\b|\bpartial\b|\bsome of the (?:sockets|lights)\b|\broof leak\w*\b|\bleak\w* (?:from|through) the roof\b|\bleak\w*\b/i;
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
/**
 * What the caller said is wrong, without what they said isn't: "no water
 * near electrics, no vulnerable people" named neither (live, 6 October: a
 * dripping tap triaged as an electrical emergency).
 */
export function withoutDenials(words: string): string {
  return words.split(/[,;.!?]|\b(?:and|but)\b/i)
    // "No heating" or "no power" is the fault itself, not a denial; "no water near the electrics" is.
    .filter((part) => FAULT_LACK.test(part) || !/^\s*(?:no|not|none|nothing|never|nobody|no ?one|nowhere|isn'?t|aren'?t|wasn'?t|there'?s no|there is no|without)\b/i.test(part))
    // Answers written as a form: "water near electrics: no" (live, 8 October: slipped slates went to an electrician).
    .filter((part) => !/[:=-]\s*(?:no|none|not|nope|n\/a)\s*$/i.test(part))
    .join(', ');
}
const FAULT_LACK = /^\s*(?:there'?s |there is |we'?ve got |we have )?no (?:heating|heat|hot water|power|electric(?:s|ity)?|water|gas|lights?|supply)\b(?!\s+(?:near|on|by|coming|getting|anywhere|around))/i;

export function triage(m: MaintenanceSettings, heard: string, opts: { vulnerable?: string[]; date: string }): Triage {
  const words = withoutDenials(heard);
  const dontDo = m.dont_do.find((d) => new RegExp(`\\b${d.what.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(words) || d.what.split(/\s+/).some((w) => w.length > 4 && new RegExp(`\\b${w}`, 'i').test(words)));
  const on = new Set(m.trades.map((t) => t.key));
  const trade = TRADE_WORDS.find(([k, re]) => on.has(k) && re.test(words))?.[0] ?? null;
  // An owner's example matches on its telling words, whole: "a door that won't lock" is not any sentence with "door" and "that".
  const said = new Set(words.toLowerCase().split(/[^a-z']+/));
  const example = (xs: string[]) => xs.some((x) => {
    // All its telling words (all but one in a long example), and at least two: "heating" and "water" alone are not
    // "no heating or hot water for a vulnerable household", and "power" alone is not "no power at all".
    const sig = x.toLowerCase().split(/[^a-z']+/).filter((w) => w.length > 3 && !FILLER.has(w));
    return sig.length >= 2 && sig.filter((w) => said.has(w)).length >= (sig.length <= 3 ? sig.length : sig.length - 1);
  });
  let level: JobPriority = EMERGENCY.test(words) || example(m.priorities.emergency.examples) ? 'emergency' : URGENT.test(words) || example(m.priorities.urgent.examples) ? 'urgent' : 'routine';
  const why = [level === 'emergency' ? 'Emergency' : level === 'urgent' ? 'Urgent' : 'Routine'];
  // "Nobody here is vulnerable" names nobody.
  const named = VULNERABLE.exec(words);
  const denied = named && /\b(?:no ?one|nobody|not|isn'?t|aren'?t|no)\b[^.?!]{0,25}$/i.test(words.slice(Math.max(0, named.index - 30), named.index));
  const vulnerable = [...(opts.vulnerable ?? []), ...(named && !denied ? [named[0]] : [])];
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

const FILLER = new Set(['that', 'this', 'with', 'from', 'have', 'there', 'their', 'they', 'when', 'what', 'your', 'been', 'into', 'only', 'some', 'more', 'very', 'will', 'just', 'over', 'which', 'where', 'about', 'after', 'than', 'then', 'them', 'were', 'would', 'could', 'should', 'all', 'whole', 'household']);

const WATER_EMERGENCY = /\bburst\b|\buncontroll\w+|\bpouring\b|\bwon'?t stop\b|\bflooding\b|\bthrough the ceiling\b|\bceiling (?:is )?(?:coming down|collaps\w+)/i;

/**
 * Triage on the receptionist's summary, raised to what the caller's own
 * words say for the same trade: "water leak from the ceiling" is urgent,
 * but the caller said it was pouring through (a live call, 6 October).
 */
function triageCall(m: MaintenanceSettings, words: string, heard: string[], opts: { vulnerable?: string[]; date: string }): Triage {
  const t = triage(m, words, opts);
  // Only water the summary played down: the caller's other words ("nobody here is vulnerable") are not raised on.
  const said = heard.slice(-6).join('. ');
  if (t.priority !== 'emergency' && WATER_EMERGENCY.test(said) && t.trade && triage(m, said, opts).trade === t.trade) {
    return { ...t, priority: 'emergency', reason: `Emergency: ${WATER_EMERGENCY.exec(said)![0].toLowerCase()}, in the caller's words` };
  }
  return t;
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

// Someone trapped in a lift: the lift company frees people, never us (LOLER 1998; presets/property-maintenance-use-cases.md).
const TRAPPED = /\b(?:stuck|trapped)\b[^.?!]{0,40}\blifts?\b|\blifts?\b[^.?!]{0,40}\b(?:stuck|trapped)\b/i;

/** The block a lift call is about: the property found on the call, or a block named in what the caller said. */
async function blockNamed(ctx: ToolContext, p: MtProperty | null, words: string): Promise<MtProperty | null> {
  if (p?.kind === 'communal') return p;
  if (p?.block) return ctx.repo.getMtProperty(ctx.tenant.id, p.block);
  const blocks = (await ctx.repo.listMtProperties(ctx.tenant.id)).filter((x) => x.kind === 'communal');
  return blocks.find((b) => new RegExp(`\\b${blockName(b).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(words)) ?? null;
}

async function liftTrapped(ctx: ToolContext, p: MtProperty | null, words: string): Promise<Record<string, unknown>> {
  const block = await blockNamed(ctx, p, `${words} ${ctx.state.heard.join(' ')}`);
  const agent = block?.client ? mt(ctx).clients.find((c) => c.key === block.client) : undefined;
  const where = block ? blockName(block) : 'the building';
  const contractor = block?.notes.lift;
  const at = spokenTime(local(ctx).time);
  if (agent?.contact.phone) await smsTo(ctx, agent.contact.phone, `${ctx.tenant.profile.name} URGENT: someone reported trapped in the lift at ${where}, ${at}. Caller told to use the lift alarm${contractor ? ' and given the lift company' : ''}, and 999 if anyone is unwell. (Demo)`);
  await ctx.repo.addMessage({
    tenant_id: ctx.tenant.id, call_id: ctx.callId, kind: 'message', from_name: 'A caller', from_phone: ctx.callerPhone, status: 'new',
    body: `Someone reported trapped in the lift at ${where}, ${at}.${agent ? ` ${agent.name} told by text.` : ''}`, for_staff: 'duty_manager', category: 'safety', urgency: 'urgent',
    details: block ? { property: block.key } : {},
  });
  ctx.state.messageTaken = true;
  ctx.action({ kind: 'safety_advice', title: 'Trapped in a lift', detail: `${where} · ${agent ? `${agent.name} told` : 'office told'}` });
  return {
    trade: null, trapped_in_lift: true,
    say: [
      'If anyone in the lift is unwell, distressed or hurt, call 999 now.',
      'Tell them to press the alarm button in the lift: it goes to the lift company, who will come and free them.',
      contractor ? `The lift company for ${where}: ${contractor.replace(/^Lift:\s*/i, '')}.` : "The lift company's number is usually on a notice in the lift.",
      agent ? `We've told ${agent.name}, who manage the building, just now.` : "We've told the office just now.",
    ],
    never: "We don't send our engineers to free anyone from a lift: only the lift company's trained engineers do that. Book nothing, and give no time.",
  };
}

async function triageFault(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const gate = safetyGate(ctx);
  if (gate) return gate;
  const m = mt(ctx);
  const words = [str(args.description), str(args.answers)].filter(Boolean).join('. ');
  if (!words) return { done: false, message: 'Ask what the problem is, in their words.' };
  const key = str(args.property) ?? ctx.state.property;
  const named = key ? await propertyNamed(ctx, key) : null;
  const p = named ? found(ctx, named) : null;
  if (TRAPPED.test(words)) return liftTrapped(ctx, p, words);
  const t = triageCall(m, words, ctx.state.heard, { vulnerable: p?.vulnerable, date: local(ctx).date });
  if (t.priority === 'emergency' && t.trade) ctx.state.emergencyTrade = t.trade;
  if (t.dont_do) return { trade: null, dont_do: t.dont_do, say: `We don't do ${t.dont_do.what}. Suggest ${t.dont_do.suggest}.` };
  const checks = t.trade
    ? (Object.keys(CHECKS) as (keyof typeof CHECKS)[]).filter((k) => m.checks[k] && CHECKS[k].trades.includes(t.trade!)).map((k) => CHECKS[k].say)
    : [];
  // A block's shared parts: the managing agent pays and instructs, so a resident hears no price and is offered no window.
  const part = p?.block ? sharedPart(words, p) : null;
  // Nor does an insurer's claims desk: the insurer pays.
  const homeowner = (!p || p.client === null) && !part && !insurerCalling(ctx);
  // A business's contract sets the least it gets.
  const site = p?.client ? m.clients.find((c) => c.key === p.client) : undefined;
  const order: JobPriority[] = ['routine', 'urgent', 'emergency'];
  if (site?.min_priority && order.indexOf(t.priority) < order.indexOf(site.min_priority)) {
    t.priority = site.min_priority;
    t.reason = `${site.name}'s contract: at least ${site.min_priority}`;
  }
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
    ...(part ? { shared_parts: `The ${part} is in the block's shared parts: no price and no window for them. Raise it with job create: it goes to the managing agent to instruct, or onto the job already open for it.` } : {}),
    ...noticeWords(m),
    note: "Say the trade and how soon. Never say what's wrong, that it's safe, or what it will cost beyond the price above.",
  };
}

/** "Texts only, please", "I'm deaf": contact by text, never a call. */
const TEXT_ONLY = /\b(?:text(?:s|ing)? only|only (?:by )?text|by text,? (?:not|never|rather than) (?:a )?(?:call|phone)|(?:i'?m|i am) (?:deaf|hard of hearing)|can'?t hear (?:on )?(?:the )?phone)\b/i;

// The office's notice for today (presets/property-maintenance-use-cases.md, surge day): every tool that books or
// triages says it, and on an emergencies-only day nothing else gets a time.
const emergenciesOnly = (m: MaintenanceSettings) => Boolean(m.notice?.emergencies_only);
function noticeWords(m: MaintenanceSettings): Record<string, string> {
  if (!m.notice) return {};
  return {
    office_notice: m.notice.text,
    ...(m.notice.emergencies_only ? { today: 'Only emergencies are being booked today. Anything else is logged with job create for the office to call back and book: promise no time, and never a same-day visit.' } : {}),
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
  if (j.status === 'new' && j.flags.includes('callback')) status = 'logged; the office will call to book a time';
  const off = j.status === 'scheduled' && j.engineer_key && j.visit_date ? absentOn(m, j.engineer_key, j.visit_date) : undefined;
  if (off) status = `booked for ${w && j.visit_date ? windowWords(w, j.visit_date, l.date) : 'a visit'}, but ${who} is off ${off.reason === 'sick' ? 'sick' : 'on holiday'} then, so it needs a new time`;
  if ((j.status === 'done' || j.status === 'invoiced') && j.done_at) status = `done ${dayWords(toLocal(j.done_at, ctx.tenant.profile.timezone).date, l.date)}`;
  const due = j.priority === 'emergency' ? null : addWorkingDays(toLocal(j.created_at, ctx.tenant.profile.timezone).date, j.priority === 'urgent' ? m.priorities.urgent.working_days : m.priorities.routine.working_days, m.nation);
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
  // Damp and mould at a social landlord's home is always told the same day: the clock is theirs.
  const damp = j.flags.includes('damp_mould') && client.kind === 'social';
  const send = damp || client.notice === 'every_job' || (client.notice === 'emergencies' && j.priority === 'emergency');
  if (!send) return;
  const clock = j.clocks.find((c) => c.kind === 'awaab_investigation');
  const extra = [
    damp ? `Reported ${spokenTime(toLocal(ctx.now(), ctx.tenant.profile.timezone).time)} today.` : '',
    clock ? `Investigation due by ${spokenDate(clock.due)} (10 working days, Awaab's Law; we act as your agent).` : '',
    j.flags.includes('possible_emergency_hazard') ? 'Possible emergency hazard: yours to decide. If it is one, it must be investigated and made safe within 24 hours.' : '',
  ].filter(Boolean).join(' ');
  await smsTo(ctx, client.contact.phone, `${ctx.tenant.profile.name}: new ${j.priority} job ${j.reference} at ${shortAddress(p)}: ${j.description}.${extra ? ` ${extra}` : ''} (Demo)`);
}

export { poundsIn };

/** Signs that damp and mould may be an emergency hazard: for the landlord to decide, never the receptionist. */
const HAZARD = /\b(?:asthma|breath\w*|respiratory|copd|lungs?|bab(?:y|ies)|newborn|pregnan\w+|immun\w+|chemo\w*|oxygen|water (?:coming )?(?:through|into|in) (?:the |a )?(?:lights?|light fittings?|sockets?|electrics?)|ceiling (?:is )?(?:sagging|bowing|coming down))\b/i;

/**
 * Awaab's Law (England, social housing): the landlord must investigate damp
 * and mould within 10 working days of being told. A contractor acting as
 * its agent being told counts, so the clock starts at the report, with the
 * time recorded. Not for a private landlord, another nation, or a
 * contractor that isn't the landlord's agent: their clocks are their own.
 */
export function dampClocks(m: MaintenanceSettings, client: MtClient | undefined, trade: string, words: string, vulnerable: string[], now: Date, today: string) {
  const damp = trade === 'damp_mould' || /\b(?:damp|mould|mold)\b/i.test(words);
  if (!damp || client?.kind !== 'social') return { damp, clocks: [], hazard: false };
  const hazard = HAZARD.test(words) || vulnerable.some((v) => HAZARD.test(v));
  const agent = m.customers.social.on && m.customers.social.agent_of_landlord && m.nation === 'england';
  const clocks = agent ? [{ kind: 'awaab_investigation', label: "Awaab's Law: investigate within 10 working days", start: now.toISOString(), due: addWorkingDays(today, 10, 'england') }] : [];
  return { damp, clocks, hazard };
}

const ROLES: ReporterRole[] = ['occupant', 'agent', 'landlord', 'homeowner', 'other'];
const roleOf = (v: unknown): ReporterRole | null => (ROLES.includes(str(v)?.toLowerCase() as ReporterRole) ? (str(v)!.toLowerCase() as ReporterRole) : /tenant|live/i.test(str(v) ?? '') ? 'occupant' : null);

/** An insurer's claims line ringing us: the insurer instructs and pays; the policyholder is the one we contact. */
const insurerCalling = (ctx: ToolContext): MtClient | undefined =>
  ctx.callerPhone ? mt(ctx).clients.find((c) => c.kind === 'insurer' && normaliseUkPhone(c.contact.phone) === ctx.callerPhone) : undefined;

/** "Claim 77-23019", "claim number 77 23019": the number as given, never made up. */
export function claimIn(words: string): string | null {
  const m = /\bclaim(?:\s+(?:number|no\.?|ref(?:erence)?))?\s*(?:is\s+)?:?\s*([A-Z]{0,3}-?\d[\dA-Z]*(?:[\s-]\d[\dA-Z]*)?)\b/i.exec(words);
  return m ? m[1].replace(/\s+/g, '-').toUpperCase() : null;
}

/** "Mr David Shaw, 07700 900590": the policyholder's name and phone, from what an insurer gave. */
function policyholderOf(v: unknown): { name: string; phone: string } | null {
  const s = str(v);
  const number = s ? /(?:\+44\s?|0)\d[\d\s]{8,12}\d/.exec(s) : null;
  const phone = number ? normaliseUkPhone(number[0]) : null;
  const name = s && number ? realName(s.replace(number[0], '').replace(/[,;:]+/g, ' ').replace(/\s+/g, ' ').trim()) : undefined;
  return phone && name ? { name, phone } : null;
}

function found(ctx: ToolContext, p: MtProperty): MtProperty {
  if (ctx.state.property !== p.key) {
    ctx.state.property = p.key;
    ctx.state.role = roleAt(ctx, p);
  }
  return p;
}

/**
 * A property on file at an address said in full ("Flat 4, Riverside Court, 2 Weaver Lane"): its street, its
 * number, and the same flat or none. Only one match counts, so a new home is never mistaken for another.
 */
function onFile(all: MtProperty[], address: string, district?: string): MtProperty | null {
  const said = ` ${streetCore(address)} `;
  const numbers: string[] = address.match(/\d+/g) ?? [];
  const flatOf = (s: string) => /(?:flat|apartment)\s*(\w+)/i.exec(s)?.[1]?.toLowerCase();
  const flat = flatOf(address);
  const hits = all.filter((p) => {
    if (district && soundKey(p.district) !== soundKey(district)) return false;
    const core = streetCore(p.street);
    return Boolean(core) && said.includes(` ${core} `) && numbers.includes(houseNumber(p)) && flatOf(p.number) === flat;
  });
  return hits.length === 1 ? hits[0] : null;
}

/** A property by its key, or by the address the model passed in its place. */
async function propertyNamed(ctx: ToolContext, key: string): Promise<MtProperty | null> {
  const p = await ctx.repo.getMtProperty(ctx.tenant.id, key);
  if (p || !/\d/.test(key) || !/[a-z]{3}/i.test(key)) return p;
  const district = /\b([A-Z]{1,2}\d[A-Z\d]?)(?:\s*\d[A-Z]{2})?\s*$/i.exec(key.trim())?.[1];
  return onFile(await ctx.repo.listMtProperties(ctx.tenant.id), key, district);
}

/** The property a job is for: the one found this call, one named, or a new homeowner's from the address given. */
async function propertyFor(args: Args, ctx: ToolContext): Promise<MtProperty | { reply: Record<string, unknown> }> {
  const m = mt(ctx);
  const key = str(args.property) ?? ctx.state.property;
  if (key) {
    const p = await propertyNamed(ctx, key);
    if (p) return found(ctx, p);
  }
  const pc = postcodeOf(args.postcode);
  const address = str(args.address);
  if (!pc || !address) return { reply: { done: false, message: 'Find the property first with find_property, or for a new customer give address and postcode.' } };
  if (!m.districts.includes(pc.district)) return { reply: { done: false, outside: true, message: `We don't cover ${pc.district}: say so kindly.` } };
  // Already on our books at that address: never added again as a new home (live, 8 October: a leaseholder at
  // Riverside Court was, so his block's door entry fault missed the job already open for it).
  const known = onFile(await ctx.repo.listMtProperties(ctx.tenant.id), address, pc.district);
  if (known) return found(ctx, known);
  const role = roleOf(args.role);
  if (role === 'occupant' && m.customers.tenant_no_client === 'contact_landlord') {
    return { reply: { done: false, message: "They rent from a landlord who isn't one of our clients, so we need the landlord's go-ahead first. Take a message (category job) with the landlord's name and number, the address and the repair." } };
  }
  const insurer = insurerCalling(ctx);
  if (!m.customers.homeowners && !insurer) return { reply: { done: false, message: 'We only work for landlords and agents: take a message.' } };
  // The policyholder as given, or the name and phone passed in its place (live, 8 October: an insurer was asked for them
  // three times, gave them each time, and the job was never raised).
  const given = normaliseUkPhone(str(args.phone));
  const holderName = realName(args.policyholder) ?? realName(args.name);
  const holder = !insurer ? null : policyholderOf(args.policyholder)
    ?? (holderName && given && given !== ctx.callerPhone ? { name: holderName, phone: given } : null);
  if (insurer && !holder) return { reply: { done: false, message: "Ask for the policyholder's name and phone number, so we can arrange access with them, then call again with policyholder (\"name, phone\")." } };
  const [, number = '', street = address] = /^\s*((?:flat\s*\w+,?\s*)?\d+\w?)?\s*,?\s*(.*)$/i.exec(address) ?? [];
  const phone = holder?.phone ?? normaliseUkPhone(str(args.phone)) ?? ctx.callerPhone;
  const p: MtProperty = {
    key: `new_${(number + street).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)}`,
    number: number.trim(), street: street.trim(), district: pc.district, town: m.towns[0] ?? '', kind: 'house', block: null, site_name: null, client: null,
    occupant: { name: holder?.name ?? realName(args.name) ?? null, phone, texts_ok: true }, notes: {}, access: { method: 'occupant', note: '' },
    vulnerable: [], vulnerable_consent_at: null, markers: [], gas: false, gas_appliances: 0, example: false,
  };
  const saved = await ctx.repo.addMtProperty(ctx.tenant.id, p);
  ctx.state.property = saved.key;
  ctx.state.role = insurer ? 'authoriser' : 'homeowner';
  return saved;
}

/** A price said aloud: "£95", "95 pounds", "ninety-five pounds" or, as transcripts write it, "ninety five pounds". */
function priceSaid(said: string[], pence: number): boolean {
  const n = Math.round(pence / 100);
  const text = said.join(' ').toLowerCase().replace(/-/g, ' ');
  return text.includes(`£${n}`) || new RegExp(`\\b${n} pounds\\b`).test(text) || text.includes(`${numberWords(n).replace(/-/g, ' ')} pounds`);
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

// The shared parts of a block, by what failed. Whoever rings, a fault there is the block's: one job on its own record,
// for its managing agent, however many residents report it (presets/property-maintenance-use-cases.md, communal faults).
const SHARED: [string, RegExp][] = [
  ['door entry', /\b(?:door ?entry|entry ?(?:phone|system)|intercom|buzzer|(?:main|communal|entrance) (?:front )?doors?|main entrance|front door (?:to|of) the (?:block|building|flats))\b/i],
  ['lights', /\b(?:communal|stair(?:well|case)?|landing|hall(?:way)?|corridor|entrance|emergency) light(?:s|ing)?\b|\blights? (?:on|in) the (?:stairs|stairwell|landings?|hall(?:way)?|corridors?|entrance)\b/i],
  // Rain through a ceiling comes from the roof, however it's put ("dripping through my ceiling since it rained").
  ['roof', /\broof\b|\bgutter\w*|\bdownpipes?\b|\bceiling\b[^.?!]{0,60}\brain(?:s|ed|ing)?\b|\brain(?:s|ed|ing)?\b[^.?!]{0,60}\bceiling\b/i],
  ['lift', /\blifts?\b/i],
  ['stairs', /\bstair(?:s|well|case|way)\b|\blandings?\b|\bcorridors?\b/i],
  ['bin store', /\bbin (?:store|room|area|shed)\b/i],
  ['fire doors', /\bfire doors?\b/i],
  ['communal heating', /\bcommunal (?:boiler|heating)\b|\bplant room\b/i],
  ['shared parts', /\bcommunal\b|\bcommon parts\b|\bshared (?:area|parts|hall)\b/i],
];

/** The shared part a fault is in, or null for one inside a flat. A flat heated by the block's boiler shares its heating faults. */
export function sharedPart(words: string, p?: Pick<MtProperty, 'notes'>): string | null {
  const hit = SHARED.find(([, re]) => re.test(words));
  if (hit) return hit[0];
  return p && /\bcommunal\b/i.test(p.notes.boiler ?? '') && NO_HEAT.test(words) ? 'communal heating' : null;
}

/** A repair in a block's shared parts, raised for its managing agent to instruct: their phone says yes, as for work over a limit. */
async function forInstruction(ctx: ToolContext, base: NewJob, client: MtClient, block: MtProperty, part: string): Promise<Job> {
  const m = mt(ctx);
  const job = await ctx.repo.createJob(ctx.tenant, { ...base, status: 'awaiting_approval', reason: `${base.reason ? `${base.reason}; ` : ''}for ${client.name} to instruct` });
  record(ctx, job.reference, 'job', 'committed');
  // Raised, not booked: the guardrail holds "booked" and "coming" back (§8, approval_claim).
  ctx.state.awaitingApproval = true;
  ctx.state.jobsVerified.push(job.reference);
  if (client.contact.phone) await smsTo(ctx, client.contact.phone, `${ctx.tenant.profile.name}: ${part} fault at ${blockName(block)}, reported by a resident: ${base.description}. Job ${job.reference} is waiting for you to instruct us. (Demo)`);
  if (base.reporter?.phone) await smsTo(ctx, base.reporter.phone, `${ctx.tenant.profile.name}: we've logged the ${part} fault at ${blockName(block)} for ${client.name} to instruct, ref ${job.reference}. We'll text you once a visit is booked. (Demo)`);
  ctx.action({ kind: 'job_created', title: `For ${client.name} to instruct · ${cap(tradeLabel(m, job.trade))}`, detail: `${blockName(block)} · ${part} · ref ${job.reference}`, data: { reference: job.reference } });
  return job;
}

/** An open job on the block for the same shared part: the caller is added to it, never told who else rang. */
async function sharedAlready(ctx: ToolContext, block: MtProperty, part: string, name: string, phone: string | null): Promise<Record<string, unknown> | null> {
  const open = (await ctx.repo.listJobs(ctx.tenant.id, { property: block.key }))
    .filter((j) => !['done', 'invoiced', 'cancelled'].includes(j.status) && sharedPart(j.description) === part);
  const j = open[0];
  if (!j) return null;
  const known = j.reporter.phone === phone || j.reporters.some((r) => r.phone === phone);
  if (!known) {
    await ctx.repo.updateJob(ctx.tenant.id, j.reference, { reporters: [...j.reporters, { name, phone, at: ctx.now().toISOString() }] }, 'also reported by a resident', { by: 'receptionist', at: ctx.now() });
  }
  ctx.state.found.push(j.reference);
  ctx.state.jobsVerified.push(j.reference);
  const words = jobWords(ctx, j, block);
  if (phone) await smsTo(ctx, phone, `${ctx.tenant.profile.name}: we already have the ${part} fault at ${blockName(block)} as job ${j.reference} (${words.status}). We've added you, so you'll hear when it's done. (Demo)`);
  ctx.action({ kind: 'job_changed', title: `Also reported · ${cap(part)}`, detail: `${blockName(block)} · ref ${j.reference}`, data: { reference: j.reference } });
  return {
    booked: false, already_reported: true, ...words,
    say: `We already have that one: it's ${words.status}. I've added them to it, so they'll hear when it's done.`,
    never: 'Never say who else reported it, or anything about the other residents.',
  };
}

async function createJob(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const m = mt(ctx);
  const found = await propertyFor(args, ctx);
  if ('reply' in found) return found.reply;
  /** Where the caller is; the job goes on p, which for a fault in a block's shared parts is the block itself. */
  const home = found;
  let p = found;
  const description = str(args.description);
  if (!description) return { booked: false, message: 'Say what the problem is in a few words (description), then call again.' };
  // From the job's own words only: "the stair lights too", said earlier, must not send a dripping tap to the block.
  const part = p.block ? sharedPart(description, p) : null;
  const block = part ? (p.kind === 'communal' ? p : await ctx.repo.getMtProperty(ctx.tenant.id, p.block!)) : null;
  if (part === 'lift' && block) {
    if (TRAPPED.test(`${description} ${ctx.state.heard.slice(-3).join(' ')}`)) return liftTrapped(ctx, home, description);
    return { booked: false, message: `We don't look after lifts: the building's lift contractor does.${block.notes.lift ? ` ${block.notes.lift}.` : ''} If someone is trapped, use triage_fault.` };
  }
  if (block) p = block;
  // An insurer's claim: the insurer instructs and pays, by its claim number (never made up); what a policy covers is never said.
  const insurer = insurerCalling(ctx);
  const claim = claimIn(`${str(args.claim) ? `claim ${str(args.claim)}` : ''} ${description} ${ctx.state.heard.join(' ')}`);
  if (insurer && !claim) return { booked: false, message: 'Ask for the claim number, read it back, then call again with claim.' };
  // A policyholder with a claim number: their insurer confirms it before anything is booked on its account.
  const claimFor = !insurer && claim && p.client === null ? m.clients.find((c) => c.kind === 'insurer' && m.customers.insurers) : undefined;
  const client = insurer ?? claimFor ?? (p.client ? m.clients.find((c) => c.key === p.client) : undefined);
  if (client?.status === 'on_stop') return { booked: false, message: `We can't book work for ${client.name} at the moment. Take a message for the office (category client).` };
  // Already reported by another resident: added to that job before anything else is asked.
  const reporterName = realName(args.name) ?? (ctx.callerPhone === home.occupant.phone ? home.occupant.name ?? undefined : undefined);
  if (block && part && reporterName) {
    const already = await sharedAlready(ctx, block, part, reporterName, normaliseUkPhone(str(args.phone)) ?? ctx.callerPhone);
    if (already) return already;
  }
  // A landlord's safety check is booked on the register, which keeps the record's date (live, 6 October: one went in as a repair).
  if (p.client && /\b(?:gas safety (?:record|check|certificate|inspection)|cp12|landlord'?s gas|eicr|electrical (?:installation )?condition report)\b/i.test(description)) {
    return { booked: false, message: 'That is a safety check: book it with compliance (action book, with the services), which keeps the record\'s date and marks the register.' };
  }
  const l = local(ctx);
  // Someone vulnerable, noted with consent, can raise the priority (the owner's uplift rule).
  const t = triageCall(m, description, ctx.state.heard, { vulnerable: str(args.vulnerable) && bool(args.consent) ? [...p.vulnerable, str(args.vulnerable)!] : p.vulnerable, date: l.date });
  // triage_fault decides the trade (rule 4): the model's own guess counts only where the words name none.
  const trade = t.trade ?? (str(args.trade) && m.trades.some((x) => x.key === str(args.trade)) ? str(args.trade)! : null);
  if (!trade) return { booked: false, message: `Use triage_fault first to find the trade. Trades: ${m.trades.map((x) => x.key).join(', ')}.` };
  const asked = str(args.priority) as JobPriority | undefined;
  // The tool's priority stands unless the model asks for a higher one: a caller's say-so never lowers an emergency.
  const order: JobPriority[] = ['routine', 'urgent', 'emergency'];
  let priority = asked && order.includes(asked) && order.indexOf(asked) > order.indexOf(t.priority) ? asked : t.priority;
  // A business's contract sets the least it gets: a dental surgery without hot water is urgent, whatever the fault looks like.
  if (client?.min_priority && order.indexOf(priority) < order.indexOf(client.min_priority)) {
    priority = client.min_priority;
    t.reason = `${client.name}'s contract: at least ${client.min_priority}`;
  }
  const name = reporterName ?? (insurer ? insurer.contact.name : undefined);
  if (!name) return { booked: false, message: ASK_NAME };
  const homeowner = !client;
  if (homeowner && !priceSaid(ctx.state.said, m.prices.callout_pence) && !ctx.state.priceAsked) {
    ctx.state.priceAsked = true;
    return { booked: false, message: `Not booked yet. Tell them the price first: call-out ${money(m.prices.callout_pence)}${incVat(m)}, with the first hour, then ${money(m.prices.half_hour_pence)} a half hour. If they're happy, call this again.` };
  }
  const gas = isGasTrade(m, trade) || t.gas;
  // An insurer's own confirmation goes to the claims desk that rang; the phone they gave is the policyholder's, who
  // hears from us about the claim (live, 8 October: it had the plain booking text, with no claim number).
  const phone = insurer ? ctx.callerPhone : normaliseUkPhone(str(args.phone)) ?? ctx.callerPhone;
  const role = roleOf(args.role) ?? (insurer ? 'other' : ctx.state.role === 'authoriser' ? (client?.kind === 'agent' ? 'agent' : 'landlord') : homeowner ? 'homeowner' : 'occupant');
  // Water coming in through a block's roof is made safe now, on the managing agent's emergency authority; the repair waits for them.
  if (block && client?.kind === 'block' && priority !== 'emergency' && /\b(?:leak\w*|drip\w*|water (?:is )?(?:coming|getting|pouring) (?:in|through))\b/i.test(`${description} ${ctx.state.heard.join(' ')}`) && ['roof', 'shared parts'].includes(part!)) {
    priority = 'emergency';
    t.reason = `Water coming in from the shared parts: made safe on ${client.name}'s emergency authority`;
  }
  // Noted only with their consent; without it, nothing about anyone's health is kept. Unsaid is asked, once.
  const vulnerableGate = `consent:${p.key}`;
  if (str(args.vulnerable) && !/^(?:none|no|n\/a)$/i.test(str(args.vulnerable)!) && bool(args.consent) === undefined && !ctx.state.gateAsked.includes(vulnerableGate)) {
    ctx.state.gateAsked.push(vulnerableGate);
    return { booked: false, message: 'Not booked yet. If they already said they are happy for us to note it, call again with consent true; if not, ask them first, then call again with consent true or false.' };
  }
  const consented = str(args.vulnerable) && bool(args.consent) ? str(args.vulnerable)! : null;
  if (consented) await ctx.repo.setVulnerable(ctx.tenant.id, p.key, [...new Set([...p.vulnerable, consented])], ctx.now());
  const d = dampClocks(m, client, trade, `${description}. ${str(args.vulnerable) ?? ''}`, consented ? [...p.vulnerable, consented] : p.vulnerable, ctx.now(), l.date);
  // How they want to hear from us (Equality Act 2010, reasonable adjustments): on the job for the engineer and the office.
  const textOnly = /text/i.test(str(args.contact) ?? '') || TEXT_ONLY.test(ctx.state.heard.join(' '));
  const flags = [
    ...(ctx.state.relay || /relay/i.test(str(args.contact) ?? '') ? ['relay'] : []), ...(textOnly ? ['text_only'] : []),
    ...(gas ? ['gas'] : []), ...(p.vulnerable.length || consented ? ['vulnerable'] : []), ...(p.notes.pets ? ['pets'] : []),
    ...(p.access.method === 'key_safe' || p.access.method === 'keys_held' ? ['key_collection'] : []),
    ...(d.damp && client?.kind === 'social' ? ['damp_mould'] : []), ...(d.hazard ? ['possible_emergency_hazard'] : []),
  ];
  const base: NewJob = {
    property_key: p.key, client_key: client?.key ?? null, reporter: { name, phone, role }, trade, priority, reason: t.reason, description, kind: 'repair',
    po: str(args.po) ?? null, notes: [claim ? `Insurance claim ${claim}.` : '', str(args.access) ?? ''].filter(Boolean).join(' ') || null,
    source: source(ctx), call_id: ctx.callId || null, flags, clocks: d.clocks, created_at: ctx.now(), claim_ref: claim,
  };
  // What a business or an insurer has told us to keep to, for the receptionist to follow (and say where it helps).
  const clientNotes = client && ['commercial', 'insurer'].includes(client.kind) && client.instructions ? { client_notes: client.instructions } : {};
  // For a social landlord's damp case: who is told, and what never to say.
  const dampWords = d.damp && client?.kind === 'social' ? {
    landlord_told: `${client.name} ${d.clocks.length ? 'has been told today, with the time it was reported' : 'has been told today'}.${d.hazard ? ' It is flagged for them to decide whether it is an emergency hazard.' : ''}`,
    never: "Never say what caused it or suggest it's anything the tenant did; never give health advice (for anyone unwell, their GP or NHS 111); never quote a legal deadline.",
  } : {};

  // Over the client's limit: their contact approves, on their own phone, before anything is booked.
  // A price already in the description or the caller's words ("£600", "six hundred pounds") counts, so it isn't asked for twice.
  const heardAll = ctx.state.heard.join(' ');
  const estimate = int(args.estimate_pounds) ?? poundsIn(description) ?? poundsIn(heardAll);
  // "Go ahead with quote Q-2291": that work is already raised, waiting on the client; it is answered, not raised again.
  const quoted = /\bQ[\s-]?(\d{4})\b/i.exec(`${description} ${str(args.reference) ?? ''} ${ctx.state.heard.slice(-4).join(' ')}`);
  if (quoted) {
    const [q] = await ctx.repo.listQuotes(ctx.tenant.id, { reference: `Q-${quoted[1]}` });
    // The yes is sent to the client's phone here and now, whichever action the model reached for.
    if (q?.status === 'sent' && q.job_ref) return { ...(await requestApproval({ reference: q.reference }, ctx)), raised_already: `Quote ${q.reference} was already raised: nothing new is booked.` };
  }
  // Work quoted last week is planned, however it is described ("doesn't lock properly"): it goes through the
  // client's limit, not the on-call pager. Never when water is pouring or a safety script was given.
  const quotedWork = estimate !== undefined && /\b(?:quoted?|priced|estimated?)\b/i.test(`${description} ${heardAll}`)
    && !WATER_EMERGENCY.test(heardAll) && !ctx.state.safetyDone.length;
  if (quotedWork && priority === 'emergency') {
    priority = 'urgent';
    Object.assign(base, { priority, reason: `Quoted work, about ${money(estimate! * 100)}: planned, not an emergency call-out` });
  }

  if (priority === 'emergency' && !quotedWork) {
    const e = pageFor(ctx, trade, gas, p.district);
    const ooh = outOfHours(ctx);
    const attendBy = new Date(ctx.now().getTime() + m.priorities.emergency.attend_hours * 3_600_000);
    const job = await ctx.repo.createJob(ctx.tenant, { ...base, status: 'new', attend_by: attendBy, engineer_key: e?.key ?? null, flags: [...flags, 'paged', ...(ooh ? ['out_of_hours'] : [])] });
    record(ctx, job.reference, 'job', 'committed');
    ctx.state.paged = true;
    ctx.state.jobsVerified.push(job.reference);
    const mobile = normaliseUkPhone(ctx.tenant.profile.team?.find((x) => x.key === e?.key)?.mobile);
    if (mobile) await smsTo(ctx, mobile, `${ctx.tenant.profile.name} URGENT: ${tradeLabel(m, trade)} at ${fullAddress(p)}: ${description}. Job ${job.reference}. Accept on the job sheet.`);
    await smsTo(ctx, phone, `${ctx.tenant.profile.name}: emergency job ${job.reference} raised. Our ${ooh ? 'on-call ' : ''}engineer has been paged; we'll text you when they're on the way. (Demo)`);
    if (client) await noticeToClient(ctx, client, job, p);
    ctx.action({ kind: 'job_created', title: `Emergency · ${cap(tradeLabel(m, trade))}`, detail: `${shortAddress(p)} · paged ${e?.first_name ?? 'nobody free'} · ref ${job.reference}`, data: { reference: job.reference } });
    const repair = block && client?.kind === 'block' ? await forInstruction(ctx, { ...base, description: `Repair after make-safe ${job.reference}: ${description}`, priority: 'urgent' }, client, block, part!) : null;
    // The make-safe's reference is the one they're given; the repair's comes by text once it's instructed.
    if (repair) ctx.state.owed = job.reference;
    return {
      booked: true, reference: job.reference, reference_spoken: spokenReference(job.reference), priority,
      say: `Our ${ooh ? 'on-call ' : ''}engineer has been paged${block ? ' to make it safe' : ''}. We aim to be with them within ${m.priorities.emergency.attend_hours} hours, and they'll get a text as soon as the engineer accepts.${repair ? ` The repair itself is for ${client!.name} to instruct: it's logged for them, with no date yet.` : ''}`,
      ...dampWords,
      never: `Don't give the engineer's name or an arrival time: nobody has accepted yet.${dampWords.never ? ` ${dampWords.never}` : ''}`,
    };
  }

  // An emergencies-only day: logged, with no time, for the office to call back once things calm down (surge day).
  if (emergenciesOnly(m) && !block) {
    const job = await ctx.repo.createJob(ctx.tenant, { ...base, status: 'new', flags: [...flags, 'callback'], reason: `${base.reason ? `${base.reason}; ` : ''}logged during: ${m.notice!.text}` });
    record(ctx, job.reference, 'job', 'committed');
    ctx.state.jobsVerified.push(job.reference);
    if (phone) await smsTo(ctx, phone, `${ctx.tenant.profile.name}: we've logged your ${tradeLabel(m, trade)} job, ref ${job.reference}. ${m.notice!.text}. We'll call you to book a time. (Demo)`);
    if (client) await noticeToClient(ctx, client, job, p);
    ctx.action({ kind: 'job_created', title: `Logged for a call back · ${cap(tradeLabel(m, trade))}`, detail: `${shortAddress(p)} · ref ${job.reference}`, data: { reference: job.reference } });
    return {
      booked: false, logged_for_call_back: true, reference: job.reference, reference_spoken: spokenReference(job.reference), office_notice: m.notice!.text,
      say: "Say the office's notice, then that it's logged and the office will call to book a time. No time, and no visit today.",
    };
  }
  // Work already priced ("as per the quote") is checked against the limit, so the amount is needed first;
  // a tenant asking what it will cost has no quote.
  if (client && !estimate && /\b(?:quoted?|priced|estimated?)\b/i.test(`${description} ${str(args.reference) ?? ''} ${ctx.state.heard.join(' ')}`)) {
    return { booked: false, message: `Ask what the quote or price came to, then call again with estimate_pounds: work over ${client.name}'s limit needs their approval before it is booked.` };
  }
  // A block's shared parts are its managing agent's to instruct: logged for them with no date, and never priced for them.
  if (block && client?.kind === 'block') {
    const job = await forInstruction(ctx, base, client, block, part!);
    return {
      booked: false, for_client_to_instruct: true, reference: job.reference, reference_spoken: spokenReference(job.reference),
      say: `That's in the shared parts of ${blockName(block)}, so it's for ${client.name} to instruct. I've logged it and sent it to them, and we'll text you once a visit is booked. It isn't booked yet.`,
      never: `Never agree a price or a date for ${client.name}, and never give a view on what the lease says.`,
    };
  }
  if (claimFor) {
    const job = await ctx.repo.createJob(ctx.tenant, { ...base, status: 'awaiting_approval', reason: `${base.reason ? `${base.reason}; ` : ''}for ${claimFor.name} to confirm claim ${claim}` });
    record(ctx, job.reference, 'job', 'committed');
    ctx.state.awaitingApproval = true;
    ctx.state.jobsVerified.push(job.reference);
    if (claimFor.contact.phone) await smsTo(ctx, claimFor.contact.phone, `${ctx.tenant.profile.name}: your policyholder at ${shortAddress(p)} gave claim ${claim}: ${description}. Job ${job.reference} is waiting for you to confirm. (Demo)`);
    if (phone) await smsTo(ctx, phone, `${ctx.tenant.profile.name}: we've sent job ${job.reference} (claim ${claim}) to ${claimFor.name} to confirm. We'll call to arrange a time once they do. (Demo)`);
    ctx.action({ kind: 'job_created', title: `For ${claimFor.name} to confirm · ${cap(tradeLabel(m, trade))}`, detail: `${shortAddress(p)} · claim ${claim} · ref ${job.reference}`, data: { reference: job.reference } });
    return {
      booked: false, for_insurer_to_confirm: true, reference: job.reference, reference_spoken: spokenReference(job.reference),
      say: `As it's an insurance claim, ${claimFor.name} confirm it first. We've sent it to them, and we'll call to arrange a time once they do. It isn't booked yet.`,
      never: 'Never say what their policy covers, whether the claim will be paid, or anything about the excess beyond the notes.', ...clientNotes,
    };
  }
  // A business: how it affects trading, when they're open and how to get in, and their order number, asked once before booking.
  const siteGate = `site:${p.key}`;
  // A missing order number asks too, whatever access says (live, 8 October: "the occupant lets the engineer in", copied
  // from the property's notes, booked a café's job with none of this asked).
  const po = client?.po_required && !str(args.po);
  if (client?.kind === 'commercial' && (!str(args.access) || po) && !ctx.state.gateAsked.includes(siteGate)) {
    ctx.state.gateAsked.push(siteGate);
    return {
      booked: false, ...clientNotes,
      message: `Not booked yet. Ask how it's affecting trading, their opening hours and any out-of-hours access, and who to ask for on site${po ? ', and their purchase order number' : ''}. Then call again with access${po ? ' and po' : ''}.`,
    };
  }
  if (client && estimate && estimate * 100 > client.works_limit_pence) {
    const job = await ctx.repo.createJob(ctx.tenant, { ...base, status: 'awaiting_approval', price_pence: estimate * 100 });
    record(ctx, job.reference, 'job', 'committed');
    // Raised, not booked: the guardrail holds "booked" and "coming" back (§8, approval_claim).
    ctx.state.awaitingApproval = true;
    ctx.state.jobsVerified.push(job.reference);
    if (client.contact.phone) await smsTo(ctx, client.contact.phone, `${ctx.tenant.profile.name}: job ${job.reference} at ${shortAddress(p)} needs your approval (about ${money(estimate * 100)}, over your ${money(client.works_limit_pence)} limit). (Demo)`);
    ctx.action({ kind: 'job_created', title: `Awaiting approval · ${cap(tradeLabel(m, trade))}`, detail: `${shortAddress(p)} · ${client.name} · ref ${job.reference}`, data: { reference: job.reference } });
    return { booked: false, awaiting_approval: true, reference: job.reference, reference_spoken: spokenReference(job.reference), say: `This needs ${client.name}'s approval first. We've asked them, and we'll call back with a time once they say yes. It isn't booked yet.`, ...dampWords };
  }

  // A social landlord's damp case: who lives there decides how soon, and Meadowbank must hear it, so ask once before booking.
  const dampGate = `damp:${p.key}`;
  if (d.damp && client?.kind === 'social' && !str(args.vulnerable) && !ctx.state.gateAsked.includes(dampGate)) {
    ctx.state.gateAsked.push(dampGate);
    return { booked: false, message: 'Not booked yet. Ask whether anyone at home has asthma or another breathing problem, or is very young, elderly or pregnant, and if they are happy for us to note it. Then call again with vulnerable (or "none") and consent.' };
  }
  let date = str(args.date);
  // "The morning one" picked from the windows just offered, with no date: the first free window of that kind.
  if ((!date || !isIsoDate(date)) && str(args.window)) {
    const picked = freeWindows(m, await ctx.repo.listJobs(ctx.tenant.id), { trade, gas, district: p.district, from: l.date, now: l }).find((f) => f.window.key === str(args.window)?.toLowerCase());
    if (picked) date = picked.date;
  }
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
  // Where the owner asks for it, a homeowner pays the call-out by card when booking: billed now, paid with the demo card.
  const deposit = homeowner && price && m.prices.card_on_booking
    ? await ctx.repo.createInvoice(ctx.tenant.id, {
      job_ref: job.reference, property_key: p.key, client_key: null, payer: { name, phone }, kind: 'callout', description: `Call-out for job ${job.reference} (${shortAddress(p)})`,
      amount_pence: price, status: 'due', issued: l.date, due: date, paid_at: null, paid_how: null, card_last4: null, auth_code: null,
    }, ctx.callId || null)
    : null;
  if (deposit) ctx.state.invoice = deposit.reference;
  if (client) await noticeToClient(ctx, client, job, p);
  // The insurer instructed it; the policyholder is the one who lets us in.
  if (insurer && p.occupant.phone && p.occupant.phone !== phone) {
    await smsTo(ctx, p.occupant.phone, `${ctx.tenant.profile.name}: ${insurer.name} has asked us to come about claim ${claim}: ${description}. ${cap(windowWords(w, date, l.date))}, with ${e.first_name}. Ref ${job.reference}. Call us if that doesn't suit. (Demo)`);
  }
  ctx.action({ kind: 'job_created', title: `${cap(priority)} · ${cap(tradeLabel(m, trade))}`, detail: `${shortAddress(p)} · ${windowWords(w, date, l.date)} · ${e.first_name} · ref ${job.reference}`, data: { reference: job.reference } });
  return {
    booked: true, reference: job.reference, reference_spoken: spokenReference(job.reference), priority,
    when: windowWords(w, date, l.date), engineer: e.first_name,
    ...(price ? { price: `${money(price)}${incVat(m)} call-out, with the first hour` } : {}),
    text_sent: Boolean(phone),
    remind: m.visits.adult_present ? 'Someone over 18 needs to be in.' : undefined,
    ...dampWords,
    ...(deposit ? { payment: `The ${money(deposit.amount_pence)} call-out is paid by card now: take it with take_demo_payment (for callout), giving the demo card first. If they'd rather not, the visit stays booked and the office will call.` } : {}),
    ...(insurer ? { claim, policyholder_told: Boolean(p.occupant.phone), never: 'Never say what the policy covers or whether the claim will be paid.' } : {}),
    // Control of Asbestos Regulations 2012, reg 4: the duty to manage it in a business's building.
    ...(client?.kind === 'commercial' ? { asbestos: 'Say: if the building is from before 2000, the engineer checks the asbestos register before any work that disturbs it.' } : {}),
    ...clientNotes,
  };
}

/** A job by its own reference, or by the quote it waits on ("Q-2291"). */
async function jobsByRef(ctx: ToolContext, ref: string): Promise<Job[]> {
  const quote = /^Q(\d{3,6})$/.exec(ref);
  if (!quote) return ctx.repo.listJobs(ctx.tenant.id, { reference: ref });
  const [q] = await ctx.repo.listQuotes(ctx.tenant.id, { reference: `Q-${quote[1]}` });
  return q?.job_ref ? ctx.repo.listJobs(ctx.tenant.id, { reference: q.job_ref }) : [];
}

async function findJobs(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const m = mt(ctx);
  const ref = str(args.reference)?.replace(/[^a-z0-9]/gi, '').toUpperCase();
  let jobs: Job[] = [];
  if (ref) {
    jobs = await jobsByRef(ctx, ref);
    if (!jobs.length) return { found: 0, message: `No job ${spokenReference(ref)}. Ask them to read it from their text again, one character at a time.` };
  } else if (ctx.callerPhone) {
    // Only the number they ring from counts: a number they say could be anyone's.
    jobs = (await ctx.repo.listJobs(ctx.tenant.id, { phone: ctx.callerPhone })).filter((j) => !['cancelled'].includes(j.status)).slice(0, 3);
  }
  // "Go ahead with your quote" with nothing on file: raise it, priced, rather than hunt (live, 6 October).
  const priced = /\b(?:quoted?|priced|estimated?)\b/i.test(ctx.state.heard.join(' '));
  if (!jobs.length && priced && !ref) {
    return { found: 0, message: 'No quote is on file for them. Raise the work now with job create, with estimate_pounds as the price they gave: over the client\'s limit, it goes to the client for approval.' };
  }
  if (!jobs.length) {
    return {
      found: 0,
      message: ref || !ctx.callerPhone
        ? "Nothing found. Ask for the job reference from their text. Never look a job up by address alone: say you can't give job details without the reference or a call from the number on the job."
        : "Nothing is booked for this number, so nobody from us is due today. If they have a reference, ask for it. Never look a job up by address alone.",
    };
  }
  const props = new Map((await ctx.repo.listMtProperties(ctx.tenant.id)).map((p) => [p.key, p]));
  const quotes = await ctx.repo.listQuotes(ctx.tenant.id);
  const today = local(ctx).date;
  // "Someone at my door says they're from you": only a visit on the board today means we sent someone.
  const visiting = jobs.some((j) => j.status === 'on_the_way' || j.status === 'on_site' || (j.status === 'scheduled' && j.visit_date === today) || (j.status === 'new' && j.priority === 'emergency'));
  for (const j of jobs) {
    record(ctx, j.reference, 'job', 'found');
    if (!ctx.state.jobsVerified.includes(j.reference)) ctx.state.jobsVerified.push(j.reference);
    if (j.status === 'awaiting_approval') ctx.state.awaitingApproval = true;
  }
  // The client ringing to say yes to their own quote: the request goes to their phone now, as job approve would
  // (live, 6 October: the receptionist looked Q-2291 up eight times and never sent it).
  const theirs = jobs.find((j) => j.status === 'awaiting_approval' && m.clients.find((c) => c.key === j.client_key)?.contact.phone === ctx.callerPhone);
  const yes = theirs && /\b(?:go(?:ing)? ahead|approve|accept|happy to proceed|proceed with|say yes|want it done)\b/i.test(ctx.state.heard.slice(-4).join(' '));
  const sent = yes ? await requestApproval({ reference: theirs!.reference }, ctx) : null;
  return {
    found: jobs.length,
    ...(sent?.request_sent ? { approval: sent } : {}),
    ...(visiting ? {} : { today: 'Nobody from us is booked to visit today.', ...(await atTheDoor(ctx, ctx.state.heard.slice(-4).join(' '))) }),
    jobs: await Promise.all(jobs.map(async (j) => {
      const q = j.status === 'awaiting_approval' ? quotes.find((x) => x.job_ref === j.reference && x.status === 'sent') : undefined;
      const p = j.property_key ? props.get(j.property_key) ?? null : null;
      // Its engineer is off that day: the caller is offered a new time now, rather than waiting for the office.
      const off = j.status === 'scheduled' && j.engineer_key && j.visit_date && absentOn(m, j.engineer_key, j.visit_date);
      const l = local(ctx);
      const instead = off
        ? freeWindows(m, await ctx.repo.listJobs(ctx.tenant.id), { trade: j.trade, gas: j.flags.includes('gas'), district: p?.district, from: l.date, now: l, exclude: j.reference })
          // Our engineer can't come, so a later or evening window costs them nothing more (live, 8 October: an evening
          // window was offered as "(£30 extra)" and taken, the extra never said).
          .map((f) => ({ date: f.date, window: f.window.key, say: windowWords(f.window, f.date, l.date, false) }))
        : [];
      return {
        ...jobWords(ctx, j, p), ...(q ? { quote: `${q.reference}, ${money(q.amount_pence)}${incVat(mt(ctx))}` } : {}),
        ...(off ? { new_time: instead.length ? { say: "Say sorry: the engineer can't make it. Offer these, then job move with the one they choose.", windows: instead } : { say: "Say sorry: the engineer can't make it, and the office will call with a new time." } } : {}),
      };
    })),
  };
}

async function verifiedJob(args: Args, ctx: ToolContext): Promise<{ job: Job } | { reply: Record<string, unknown> }> {
  const ref = str(args.reference)?.replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (!ref) return { reply: { done: false, message: 'Ask for the job reference from their text.' } };
  const [job] = await jobsByRef(ctx, ref);
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
  // Moved because its engineer is off: no extra for the window, as the offer said.
  const ours = Boolean(j.engineer_key && j.visit_date && absentOn(m, j.engineer_key, j.visit_date));
  const when = windowWords(w!, date!, l.date, !ours);
  const moved = await ctx.repo.updateJob(ctx.tenant.id, j.reference, { visit_date: date!, window_key: w!.key, engineer_key: e.key, status: 'scheduled' }, `moved to ${when}`, { by: 'receptionist', from: ['new', 'scheduled'] });
  if (!moved) return { moved: false, message: 'It changed while we were talking: take a message for the office.' };
  record(ctx, moved.reference, 'change', 'committed');
  const to = j.reporter.phone ?? ctx.callerPhone;
  await smsTo(ctx, to, bookedText(ctx, moved, j.client_key === null).replace(' booked for ', ' moved to '));
  const client = j.client_key ? m.clients.find((c2) => c2.key === j.client_key) : undefined;
  if (client?.contact.phone && client.notice === 'every_job') await smsTo(ctx, client.contact.phone, `${ctx.tenant.profile.name}: job ${j.reference} moved to ${when}. (Demo)`);
  ctx.action({ kind: 'job_changed', title: `Job moved · ${j.reference}`, detail: `${when} · ${e.first_name}`, data: { reference: j.reference } });
  return { moved: true, reference: j.reference, when, engineer: e.first_name, ...(ours && w!.premium_pence ? { no_extra: 'No extra charge for this window: the change is ours.' } : {}) };
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

/**
 * A yes or no to work awaiting approval is never taken by voice: anyone can
 * say a postcode (presets/property-maintenance.md, decision 4). The request
 * goes again to the client's phone on file, and the answer pressed there
 * reaches this call as a note from the system.
 */
async function requestApproval(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const m = mt(ctx);
  const v = await verifiedJob(args, ctx);
  if ('reply' in v) return v.reply;
  const j = v.job;
  if (j.status !== 'awaiting_approval') return { done: false, message: `It isn't waiting for approval: it's ${STATUS[j.status]}. Say so.` };
  const client = j.client_key ? m.clients.find((c) => c.key === j.client_key) : undefined;
  if (!client?.contact.phone) return { done: false, message: 'Take a message for the office (category job): they will contact the client.' };
  const p = j.property_key ? await ctx.repo.getMtProperty(ctx.tenant.id, j.property_key) : null;
  const [q] = (await ctx.repo.listQuotes(ctx.tenant.id, { job: j.reference })).filter((x) => x.status === 'sent');
  const amount = q?.amount_pence ?? j.price_pence;
  ctx.state.awaitingApproval = true;
  await smsTo(ctx, client.contact.phone, `${ctx.tenant.profile.name}: ${q ? `quote ${q.reference}` : `job ${j.reference}`}${p ? ` at ${shortAddress(p)}` : ''} is waiting for your approval${amount ? ` (${money(amount)}${incVat(m)})` : ''}. Open the request on this phone to approve or decline. (Demo)`);
  ctx.action({ kind: 'approval_requested', title: `Approval requested · ${q?.reference ?? j.reference}`, detail: `${client.name}${p ? ` · ${shortAddress(p)}` : ''}`, data: { reference: j.reference, quote: q?.reference ?? null } });
  const theirs = ctx.callerPhone === client.contact.phone;
  return {
    approved: false,
    request_sent: true,
    reference: j.reference,
    ...(q ? { quote: q.reference } : {}),
    say: theirs
      ? `For security, approvals are made on your phone, never by voice. The request${q ? ` for ${q.reference}` : ''} is on your phone now: press Approve or Decline there, and I'll tell you the moment it comes through.`
      : "Approvals can only come from the client, on the phone we hold for them, never on a call. We've sent the request there.",
    never: 'Never say it is approved, booked or declined until the system tells you it came through.',
  };
}

async function jobTool(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  // The first action named: the model has sent the parameter's whole list ("create, find, move...") as one.
  const action = /\b(create|find|move|cancel|approve|decline)\b/i.exec(str(args.action) ?? '')?.[1]?.toLowerCase();
  if (action === 'find') return findJobs(args, ctx);
  const gate = safetyGate(ctx);
  if (gate) return gate;
  switch (action) {
    case 'create': return createJob(args, ctx);
    case 'move': return moveJob(args, ctx);
    case 'cancel': return cancelJob(args, ctx);
    case 'approve':
    case 'decline':
      return requestApproval(args, ctx);
    default:
      return { error: 'action must be create, find, move, cancel, approve or decline.' };
  }
}

async function checkWindowsTool(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const gate = safetyGate(ctx);
  if (gate) return gate;
  const m = mt(ctx);
  const trade = str(args.trade);
  if (!trade || !m.trades.some((t) => t.key === trade)) return { error: `trade must be one of: ${m.trades.map((t) => t.key).join(', ')}` };
  // An emergency has no window: the engineer is paged (a live call offered tomorrow's slots for a burst pipe, 6 October).
  if (ctx.state.emergencyTrade === trade) return { windows: [], message: 'This is an emergency: no window. Raise it now with job create; the engineer is paged and we aim to attend within the target.' };
  if (emergenciesOnly(m)) return { windows: [], ...noticeWords(m) };
  const key = str(args.property) ?? ctx.state.property;
  const p = key ? await ctx.repo.getMtProperty(ctx.tenant.id, key) : null;
  const l = local(ctx);
  const from = str(args.date) && isIsoDate(str(args.date)!) && str(args.date)! > l.date ? str(args.date)! : l.date;
  const free = freeWindows(m, await ctx.repo.listJobs(ctx.tenant.id), { trade, gas: bool(args.gas) ?? false, district: p?.district, from, now: l });
  if (!free.length) return { windows: [], message: 'Nothing free in the next three weeks: take a message for the office.' };
  return { windows: free.map((f) => ({ date: f.date, window: f.window.key, say: windowWords(f.window, f.date, l.date) })), note: 'Offer two or three; never an exact time.' };
}

// ── Safety certificates ───────────────────────────────────────────────────

/** A certificate as the register shows it on a day: booked, overdue, due soon (inside the reminder lead time), or in date. */
export function certState(c: Pick<Certificate, 'expires' | 'booked_job'>, today: string, reminderWeeks: number): 'booked' | 'overdue' | 'due soon' | 'in date' | 'unknown' {
  if (c.booked_job) return 'booked';
  if (!c.expires) return 'unknown';
  const days = Math.round((Date.parse(c.expires) - Date.parse(today)) / 86_400_000);
  return days < 0 ? 'overdue' : days <= reminderWeeks * 7 ? 'due soon' : 'in date';
}

/** The planned work's prices, as a landlord asks them. */
function plannedWords(m: MaintenanceSettings): string {
  const pl = m.planned;
  return `Gas safety record ${money(pl.gas_record_pence)}${incVat(m)} for one appliance, plus ${money(pl.extra_appliance_pence)} each extra; boiler service ${money(pl.boiler_service_pence)}; both on one visit ${money(pl.combined_pence)}; EICR from ${money(pl.eicr_from_pence)}.`;
}

const CERT_WORDS: Record<string, string> = { gas_record: 'gas safety record', eicr: 'electrical installation condition report', boiler_service: 'boiler service', alarms: 'alarm check', pat: 'PAT test' };
const minusMonths = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
};

/** The planned job, its price and trade for one certificate, as book does it. */
function plannedFor(m: MaintenanceSettings, kind: 'gas_record' | 'eicr' | 'boiler_service', appliances: number): { trade: string; price: number; description: string } {
  if (kind === 'eicr') return { trade: 'electrical', price: m.planned.eicr_from_pence, description: 'Electrical installation condition report' };
  if (kind === 'boiler_service') return { trade: 'boiler_servicing', price: m.planned.boiler_service_pence, description: 'Boiler service' };
  return { trade: 'boiler_servicing', price: m.planned.gas_record_pence + Math.max(0, appliances - 1) * m.planned.extra_appliance_pence, description: 'Gas safety record' };
}

/**
 * "What have I got due across my properties?" (presets/property-maintenance-use-cases.md): a landlord's or
 * agent's register, only to the number on file. Overdue first, then the next two months; a summary goes to
 * the email on file; book_all books each in its first free window, keeping a gas record's date, with the tenant told.
 */
async function portfolio(args: Args, ctx: ToolContext, action: 'portfolio' | 'book_all'): Promise<Record<string, unknown>> {
  const m = mt(ctx);
  const client = ctx.callerPhone ? m.clients.find((c) => normaliseUkPhone(c.contact.phone) === ctx.callerPhone) : undefined;
  if (!client) return { done: false, message: "A landlord's or agent's certificates across their homes are only for them, from the number we have on file. Offer to take a message for the office." };
  const l = local(ctx);
  const homes = new Map((await ctx.repo.listMtProperties(ctx.tenant.id)).filter((p) => p.client === client.key).map((p) => [p.key, p]));
  const certs = (await ctx.repo.listCertificates(ctx.tenant.id)).filter((c) => homes.has(c.property_key) && c.expires && ['gas_record', 'eicr', 'boiler_service'].includes(c.kind));
  const horizon = addDays(l.date, 61);
  const due = certs.filter((c) => !c.booked_job && c.expires! <= horizon).sort((a, b) => a.expires!.localeCompare(b.expires!));
  const line = (c: Certificate) => `${cap(CERT_WORDS[c.kind])} at ${shortAddress(homes.get(c.property_key)!)}: ${c.expires! < l.date ? `ran out on ${spokenDate(c.expires!)}` : `runs to ${spokenDate(c.expires!)}`}`;
  if (action === 'portfolio') {
    const overdue = due.filter((c) => c.expires! < l.date).map(line);
    const soon = due.filter((c) => c.expires! >= l.date).map(line);
    const booked = certs.filter((c) => c.booked_job && c.expires! <= horizon).map((c) => `${cap(CERT_WORDS[c.kind])} at ${shortAddress(homes.get(c.property_key)!)}: booked, job ${c.booked_job}`);
    const remedials = certs.flatMap((c) => c.remedials.filter((r) => !r.done).map((r) => `At ${shortAddress(homes.get(c.property_key)!)}: ${r.what}, to be put right by ${spokenDate(r.due)}`));
    const email = client.contact.email;
    if (email) {
      ctx.action({ kind: 'note', title: 'Summary emailed (demo)', detail: `To ${email}: ${[...overdue, ...soon].join('; ') || 'nothing due in the next two months'}` });
    }
    return {
      client: client.name, homes: homes.size,
      overdue, due_in_the_next_two_months: soon, ...(booked.length ? { already_booked: booked } : {}), ...(remedials.length ? { remedials } : {}),
      prices: plannedWords(m),
      say: overdue.length ? 'Read what is overdue first and plainly, then what is due soon, home by home.' : 'Read what is due soon, home by home.',
      ...(due.length ? { offer: 'Offer to book them all: compliance with action book_all books each in its first free window (a gas record keeping its date), and texts each tenant.' } : {}),
      emailed: email ? 'A summary has gone to the email we have on file.' : 'There is no email on file: offer to text it instead, never to a new address.',
    };
  }
  // Book them all: each in its first free window from the day that keeps its date.
  const made: { what: string; when: string; engineer: string; price: string; reference: string }[] = [];
  const missed: string[] = [];
  let jobs = await ctx.repo.listJobs(ctx.tenant.id);
  for (const c of due) {
    const p = homes.get(c.property_key)!;
    const kind = c.kind as 'gas_record' | 'eicr' | 'boiler_service';
    const plan = plannedFor(m, kind, p.gas_appliances || 1);
    if (!m.trades.some((t) => t.key === plan.trade)) { missed.push(`${line(c)}: we don't do that`); continue; }
    const keeps = kind === 'gas_record' ? minusMonths(c.expires!, 2) : null;
    const from = keeps && keeps > l.date ? keeps : l.date;
    const slot = freeWindows(m, jobs, { trade: plan.trade, gas: kind !== 'eicr', district: p.district, from, now: l, limit: 1 })[0];
    if (!slot) { missed.push(`${line(c)}: no free window soon; the office will call`); continue; }
    const job = await ctx.repo.createJob(ctx.tenant, {
      property_key: p.key, client_key: client.key, reporter: { name: client.contact.name, phone: ctx.callerPhone, role: client.kind === 'agent' ? 'agent' : 'landlord' }, trade: plan.trade, priority: 'routine',
      reason: 'Planned: safety check', description: plan.description, kind, status: 'scheduled', visit_date: slot.date, window_key: slot.window.key, engineer_key: slot.engineers[0].key,
      price_pence: plan.price, flags: kind === 'eicr' ? [] : ['gas'], source: source(ctx), call_id: ctx.callId || null,
    });
    jobs = [...jobs, job];
    await ctx.repo.setCertificateBooked(ctx.tenant.id, p.key, kind, job.reference);
    record(ctx, job.reference, 'job', 'committed');
    ctx.state.jobsVerified.push(job.reference);
    const when = windowWords(slot.window, slot.date, l.date);
    if (p.occupant.phone && p.occupant.texts_ok) {
      await smsTo(ctx, p.occupant.phone, `${ctx.tenant.profile.name}: your landlord has booked a ${plan.description.toLowerCase()} for ${when}. Someone over 18 needs to be in. Ref ${job.reference}. (Demo)`);
    }
    made.push({ what: `${cap(CERT_WORDS[kind])} at ${shortAddress(p)}`, when, engineer: slot.engineers[0].first_name, price: `${money(plan.price)}${incVat(m)}`, reference: job.reference });
  }
  if (made.length) {
    await smsTo(ctx, ctx.callerPhone, `${ctx.tenant.profile.name}: booked ${made.map((x) => `${x.what.toLowerCase()}, ${x.when} (ref ${x.reference})`).join('; ')}. (Demo)`);
    ctx.action({ kind: 'job_created', title: `${made.length} safety check${made.length === 1 ? '' : 's'} booked`, detail: `${client.name} · ${made.map((x) => x.reference).join(', ')}` });
  }
  return {
    booked: made.length > 0, jobs: made, ...(missed.length ? { not_booked: missed } : {}),
    say: 'Say each one: what, where and when. The tenants have been texted, and the records go to the email on file once done.',
  };
}

async function compliance(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const gate = safetyGate(ctx);
  if (gate) return gate;
  const m = mt(ctx);
  const asked = str(args.action)?.toLowerCase().replace(/[\s-]+/g, '_') ?? '';
  if (asked === 'portfolio' || asked === 'book_all') return portfolio(args, ctx, asked);
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
      // On 5 October a landlord heard the call-out price for a gas safety record, guessed before booking: the prices come with the register.
      prices: `${plannedWords(m)}`,
      certificates: certs.map((c) => {
        const state = certState(c, l.date, m.planned.reminder_weeks);
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
  // "Both" on its own means the two together (a live call booked "both" as the gas record alone, 6 October).
  const both = /\bboth\b/.test(what) || (/gas/.test(what) && /service/.test(what));
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
  // The register's news a landlord came for: when the record runs out, and that booking now keeps that date (the signature moment, §1).
  const current = gasCert?.expires && keeps
    ? `The current gas safety record runs to ${spokenDate(gasCert.expires)}; a visit from ${spokenDate(keeps > l.date ? keeps : l.date)} keeps that date.`
    : undefined;
  if (!date || !w) {
    return {
      booked: false, price: `${money(price)}${incVat(m)}`, ...(current ? { current } : {}),
      message: `${current ? 'Say when the current record runs out, then the' : 'Say the'} price, offer these windows, and call again with the one they choose.`, windows: offer(),
    };
  }
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
    // Not yet translated by a person: the model may put the advice into the caller's language, never the number.
    other_language: "If the caller is speaking another language, give this advice in their language, but say the number as digits, twice; it's texted too.",
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
  return {
    taken: true, for: member?.first_name ?? 'the office', urgency, note: urgency === 'urgent' ? 'Tell them it has gone to the team straight away.' : 'Tell them the office will call back.',
    ...(await atTheDoor(ctx, `${body} ${ctx.state.heard.slice(-3).join(' ')}`)),
    ...(await dampByMessage(ctx, body)),
  };
}

const DOOR = /\b(?:at (?:my|the) (?:front )?door|on (?:my|the) doorstep|says? (?:he|she|they)(?:'s| is| are)? from|claim(?:s|ing) to be from|wasn'?t expecting (?:anyone|anybody|him|her|them))\b/i;

/**
 * "Someone at my door says they're from you": the board decides. A visit
 * on it today is ours (ask to see ID); none means we haven't sent anyone.
 */
async function atTheDoor(ctx: ToolContext, words: string): Promise<Record<string, unknown>> {
  if (!DOOR.test(words) || !ctx.callerPhone) return {};
  const today = local(ctx).date;
  const jobs = await ctx.repo.listJobs(ctx.tenant.id, { phone: ctx.callerPhone });
  const ours = jobs.find((j) => j.status === 'on_the_way' || j.status === 'on_site' || (j.status === 'scheduled' && j.visit_date === today));
  return ours
    ? { at_the_door: `${firstName(mt(ctx), ours.engineer_key) || 'Our engineer'} is booked with them today: they can ask to see photo ID before letting them in.` }
    : { at_the_door: "Nobody from us is booked to visit today: say we haven't sent anyone, not to let them in, and to ring 101, or 999 if they feel unsafe." };
}

/** Damp at a housing association's home is a job, not a message: the job tells them today and starts their clock. */
async function dampByMessage(ctx: ToolContext, body: string): Promise<Record<string, unknown>> {
  if (!ctx.state.property || !/\b(?:damp|mould|mold)\b/i.test(`${body} ${ctx.state.heard.join(' ')}`)) return {};
  const p = await ctx.repo.getMtProperty(ctx.tenant.id, ctx.state.property);
  const client = p?.client ? mt(ctx).clients.find((c) => c.key === p.client) : undefined;
  if (client?.kind !== 'social') return {};
  return { also: `Raise the repair too, with job create: that is what tells ${client.name} today, with the time, and starts their clock. A message alone does neither.` };
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

// ── Invoices and demo payments ────────────────────────────────────────────

const INVOICE_STATUS = (i: Invoice, today: string) => (i.status === 'paid' ? 'paid' : i.status === 'void' ? 'cancelled' : i.due < today ? 'overdue' : 'due');

/**
 * An invoice by its reference, or those billed to the calling number. Its
 * amount and state may be said; the home it was for only to the payer.
 * Bank details are never read out, and a dispute is a message for accounts.
 */
async function findInvoice(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const m = mt(ctx);
  const l = local(ctx);
  const raw = str(args.reference)?.replace(/[^a-z0-9]/gi, '').toUpperCase();
  const ref = raw ? `INV-${raw.replace(/^INV/, '')}` : null;
  const found = ref ? await ctx.repo.listInvoices(ctx.tenant.id, { reference: ref })
    : ctx.callerPhone ? (await ctx.repo.listInvoices(ctx.tenant.id, { phone: ctx.callerPhone })).slice(0, 3) : [];
  if (!found.length) return { found: 0, message: ref ? `No invoice ${spokenReference(ref)}. Ask them to read it from the invoice again.` : 'Nothing billed to this number. Ask for the invoice number (it starts INV).' };
  const open = found.find((i) => i.status === 'due');
  if (open) ctx.state.invoice = open.reference;
  return {
    found: found.length,
    invoices: found.map((i) => {
      const payer = Boolean(ctx.callerPhone && i.payer.phone === ctx.callerPhone);
      const state = INVOICE_STATUS(i, l.date);
      return {
        reference: i.reference, reference_spoken: spokenReference(i.reference),
        // The home is in brackets after the work: only the payer hears it.
        for: payer ? i.description : i.description.split(' (')[0],
        amount: `${money(i.amount_pence)}${incVat(m)}`,
        status: state === 'paid' ? `paid${i.paid_at ? ` ${dayWords(toLocal(i.paid_at, ctx.tenant.profile.timezone).date, l.date)}` : ''}` : state === 'overdue' ? `overdue: it was due ${dayWords(i.due, l.date)}` : state === 'due' ? `due by ${dayWords(i.due, l.date)}` : 'cancelled',
      };
    }),
    pay: open ? 'They can pay now by card with take_demo_payment (for invoice), or by bank transfer: the details are on the invoice; never read them out.' : undefined,
    dispute: 'A question about the amount or the work: take a message for accounts (category invoice). Never change or waive an amount.',
  };
}

/** take_demo_payment for a repairs contractor: an invoice, or a homeowner's call-out, with the demo card only. */
export async function maintenancePayment(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const gate = safetyGate(ctx);
  if (gate) return gate;
  const raw = str(args.reference)?.replace(/[^a-z0-9]/gi, '').toUpperCase();
  let inv: Invoice | undefined;
  if (raw && !/^INV/.test(raw)) inv = (await ctx.repo.listInvoices(ctx.tenant.id, { job: raw })).find((i) => i.status === 'due');
  else {
    const ref = raw ? `INV-${raw.replace(/^INV/, '')}` : ctx.state.invoice;
    inv = ref ? (await ctx.repo.listInvoices(ctx.tenant.id, { reference: ref }))[0] : undefined;
  }
  if (!inv) return { result: 'no_invoice', message: 'Find the invoice first with find_invoice, or ask for its number (it starts INV).' };
  if (inv.status === 'paid') return { result: 'already_paid', message: `${inv.reference} is already paid.` };
  if (inv.status !== 'due') return { result: 'not_due', message: 'Nothing is owed on that one.' };
  const outcome = processDemoPayment(args.card_number, ctx.demoCards);
  if (outcome.result === 'refused') return { result: 'refused', message: outcome.message };
  // A realistic pause, as a real card terminal would take.
  await new Promise((r) => setTimeout(r, ctx.channel === 'eval' ? 50 : 900));
  if (outcome.result === 'declined') {
    ctx.action({ kind: 'payment', title: `Declined (demo) · ${money(inv.amount_pence)}`, detail: `${inv.reference} · card ending ${outcome.last4}` });
    return { result: 'declined', amount: money(inv.amount_pence), message: 'Declined. Ask if they would like to try again with the demo card.' };
  }
  const paid = await ctx.repo.payInvoice(ctx.tenant.id, inv.reference, { last4: outcome.last4, auth_code: outcome.auth_code }, ctx.now());
  if (!paid) return { result: 'already_paid', message: `${inv.reference} has just been paid.` };
  ctx.state.paid.push(inv.reference);
  ctx.action({ kind: 'payment', title: `Paid (demo) · ${money(inv.amount_pence)}`, detail: `${inv.reference} · card ending ${outcome.last4} · ${outcome.auth_code}`, data: { reference: inv.reference } });
  await smsTo(ctx, ctx.callerPhone, `${ctx.tenant.profile.name}: ${money(inv.amount_pence)} received for ${inv.reference}. Thank you. DEMO: no money has been taken.`);
  return { result: 'approved', amount: money(inv.amount_pence), for: inv.kind === 'callout' ? `the call-out for job ${inv.job_ref}` : inv.reference, card_ending: outcome.last4, auth_code: outcome.auth_code };
}

/** The payment tool's words for a repairs contractor: an invoice or a call-out, not an order or a deposit. */
export function maintenancePaymentParams(decl: FunctionDeclaration, t: Tenant): FunctionDeclaration {
  if (!t.profile.maintenance) return decl;
  const params = decl.parameters as { properties: Record<string, unknown>; required?: string[] };
  return {
    ...decl,
    description: "DEMO card payment for an invoice or a homeowner's call-out. Say the demo card first; only demo cards work.",
    parameters: { ...params, properties: { ...params.properties, for: S('invoice or callout'), reference: S('The invoice (INV-1043) or the job; defaults to this call\'s') } },
  } as FunctionDeclaration;
}

// ── The tools ─────────────────────────────────────────────────────────────

export const MAINTENANCE_TOOLS: Record<string, Tool> = {
  safety_advice: {
    when: hasMt,
    decl: {
      name: 'safety_advice',
      description: 'The fixed safety script for an emergency: what to say, the number (also texted), and what to do next. Say its first lines before anything else.',
      // On 5 October a burst pipe inside got the flood script (street flooding, Floodline) instead of the stopcock.
      parameters: obj({
        kind: S('gas (a smell of gas), co (a carbon monoxide alarm sounding, or fumes making someone ill), co_chirp (an alarm chirping once a minute), fire, hurt (someone injured), electric (sparks, burning, or water on lights or sockets), water (a leak or burst pipe inside the home, water through a ceiling), flood (flood water from outside, or a burst main in the street), break_in, lockout, structural (a ceiling or wall that may fall)'),
        where: S('In the property, or outside it'),
      }, ['kind']),
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
      description: 'Repair jobs. create: after the property, the trade and a window (or for an emergency, none); a homeowner hears the price first. find: by reference, or the calling number. move or cancel: by reference. approve or decline: sends the request to the client\'s own phone; never approved by voice. The only way a job exists.',
      parameters: obj(
        {
          action: S('One word: create, find, move, cancel, approve or decline'), reference: S('Only one the caller has read out: a job reference, or a quote reference. Never make one up'), property: S('From find_property'), trade: S('From triage_fault'),
          priority: S('From triage_fault'), description: S('The fault, in a few words'), date: S('YYYY-MM-DD'), window: S('The window key, e.g. am or pm'),
          name: S("The caller's name"), phone: S('Only if not the calling number'), role: S('occupant, agent, landlord, homeowner or other'),
          access: S('How the engineer gets in, or a time to avoid'), vulnerable: S('Anyone vulnerable, as the caller said'), consent: B('They agreed to us noting it'),
          po: S("The client's purchase order number"), estimate_pounds: I('A quoted price, if there is one'),
          address: S('A new customer: number and street'), postcode: S('A new customer: postcode'),
          claim: S('An insurance claim number, as the caller said it'), policyholder: S("When an insurer rings: the policyholder's name and phone"),
          contact: S('How they want to hear from us, if they said: text only, or relay'),
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
  find_invoice: {
    when: hasMt,
    decl: {
      name: 'find_invoice',
      description: 'An invoice by its number (INV-1043), or those billed to the calling number: the amount, and whether it is paid, due or overdue.',
      parameters: obj({ reference: S('The invoice number, if they have it') }, []),
    },
    handler: findInvoice,
  },
  compliance: {
    when: hasMt,
    decl: {
      name: 'compliance',
      description: "A rented home's safety certificates, for the landlord or agent on file: status (what's due, and the date that keeps a gas record's date), or book a gas safety record, boiler service, both, or an EICR. portfolio: everything due across the caller's homes; book_all books it all.",
      parameters: obj(
        { property: S('From find_property; not for portfolio or book_all'), action: S('status, book, portfolio or book_all'), services: S('gas safety record, boiler service, both, or EICR'), date: S('YYYY-MM-DD'), window: S('The window key'), appliances: I('Gas appliances, if more than one'), name: S("The caller's name"), early: B('Book before the date that keeps the record, knowingly') },
        ['action'],
      ),
    },
    handler: compliance,
  },
};
