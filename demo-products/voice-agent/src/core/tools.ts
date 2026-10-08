// The receptionist's tools. The model can only act through these.
//
// Every argument is validated here and anything unexpected is ignored. The
// database is the truth for every slot, price and reference; the model's job
// is the conversation. Each tool can also raise an "action" — the friendly
// card the live board shows ("Table booked, Fri 19:30, 4 people").

import type { FunctionDeclaration } from './live.ts';
import type { Repo } from '../db/repo.ts';
import { spokenReference } from '../db/repo.ts';
import type { Booking, OrderLine, SayItem, Tenant } from '../domain/types.ts';
import { pounds } from '../domain/types.ts';
import { checkAvailability, findService } from '../domain/availability.ts';
import {
  addDays, closeMinutes, isIsoDate, minutesOf, normaliseTime, spokenDate, spokenTime, toLocal, weekdayOf, zonedToUtc,
} from '../domain/time.ts';
import { searchKnowledge } from '../domain/knowledge.ts';
import {
  allergenAnswer, allergensNamed, allergensOf, choicesIn, countInName, describeLine, lineTotal, optionsFor, resolveItem, resolveModifiers, score,
} from '../domain/menu.ts';
import { amountsIn } from '../domain/amounts.ts';
import { knownTimes, rangesIn } from '../domain/clock-times.ts';
import { referencesIn } from './guardrails.ts';
import { processDemoPayment, type DemoCard } from '../domain/payments.ts';
import { displayUkPhone, normaliseUkPhone } from '../domain/phone.ts';
import { capabilities } from './prompt.ts';
import {
  PHONE_ONLY, cateringOrder, feeFor, findOrder, heardNotOrdered, impliedCollection, isBig, kitchenFulfilment, menuTonight, readBackNext, shortOfMinimum,
  soldOutWords, waitTimes,
} from './kitchen.ts';
import { DECLINED, dealAllergenAnswer, dealByChoice, dealExtra, dealForOptions, dealHint, dealOf, mealHint } from '../domain/deals.ts';
import { ASK_NAME, B, I, S, bool, int, obj, realName, record, smsTo, postcodeOf, str, strList } from './tool-kit.ts';
import { ESTATE_TOOLS, estateAvailability, estateBooking, estateHours, estateMessage, estateParams, estateSummary, estateText, moveRule } from './estate-tools.ts';
import type { SafetyState } from './safety.ts';
import { reactionFirst, type ReactionState } from './reaction.ts';
import { MAINTENANCE_TOOLS, maintenanceHours, maintenanceMessage, maintenanceParams, maintenancePayment, maintenancePaymentParams } from './maintenance-tools.ts';

export { record, type RecordKind } from './tool-kit.ts';

export interface Action {
  kind:
    | 'booking_created' | 'booking_changed' | 'booking_cancelled' | 'order_updated' | 'order_placed'
    | 'payment' | 'message_taken' | 'sms' | 'transfer' | 'call_ending' | 'offer_recorded' | 'buyer_registered'
    | 'job_created' | 'job_changed' | 'safety_advice' | 'approval_requested' | 'note';
  title: string;
  detail?: string;
  data?: Record<string, unknown>;
}

export interface SmsSender {
  send(to: string, body: string): Promise<'sent' | 'simulated' | 'failed'>;
}

export interface Telephony {
  transfer(to: string, whisper: string): Promise<boolean>;
}

export interface CallState {
  lines: OrderLine[];
  nextLine: number;
  basketVersion: number;
  /** What the caller agreed to at the last read-back; confirm_order compares content, not a counter. */
  reviewedKey: string | null;
  /** For a takeaway's delivery, the postcode's own fee and minimum (core/kitchen.ts); otherwise the delivery-wide ones apply. */
  fulfilment: { type: 'collection' | 'delivery'; requested: string; due_at: Date; postcode: string | null; address: string | null; fee_pence?: number; min_order_pence?: number } | null;
  /** References created or changed by this call: the guardrail's evidence. Written only by record(). */
  committed: string[];
  /** Existing bookings looked up in this call (talking about them is not a false claim). Written only by record(). */
  found: string[];
  /** The order this call placed, and the booking it made or changed: what a payment is for, and the call's outcome. */
  lastOrderRef: string | null;
  lastBookingRef: string | null;
  paid: string[];
  ending: boolean;
  transferRequested: boolean;
  /** What the caller has said so far, line by line (card numbers already redacted). */
  heard: string[];
  /** The allergy check below asks once per call, never in a loop. */
  allergyAsked: boolean;
  /**
   * A takeaway's meal-deal offers (domain/deals.ts): each kind at most once a
   * call, none after the caller says no, and none once a deal is in the order.
   * `dealHeard` is how many caller lines had been heard when the last was made.
   */
  dealOffers: ('meal' | 'deal')[];
  dealHeard: number | null;
  /** The reference or order number just made, until the call has checked the caller heard it (see unsaidReference). */
  owed: string | null;
  messageTaken: boolean;
  /** end_call refuses once to end a "message" call with no message taken, never in a loop. */
  messageChecked: boolean;
  /** A message promised to the caller and reminded once (call.ts), still owed when end_call comes; refused once more there. */
  messageOwed: boolean;
  // The estate agent's (presets/estate-agent.md §4.4). Empty for every
  // other business, and read only by the estate tools and guardrails.
  /** Set at the start of an estate agency's call: its guardrails apply. */
  estate: boolean;
  /** Set at the start of a takeaway's call (a kitchen in its ordering): its guardrails apply (presets/takeaway.md §8). */
  takeaway: boolean;
  /** The receptionist's own lines, as the caller heard them: what the disclosure check listens to. */
  said: string[];
  /** Homes described by get_property in this call, and how many lines had been said by then. */
  briefed: Record<string, number>;
  /** Homes (and offers on them, as "offer:<home>") the disclosure check has stopped once: never twice. */
  gateAsked: string[];
  /** Who a caller was checked to be, and how many checks failed (milestone 2). */
  verified: { listing: string; role: string }[];
  verifyMisses: number;
  /** A free valuation is offered to a buyer with a home to sell once a call, never pressed. */
  valuationOffered: boolean;
  /** record_offer asks once whether an offer is subject to anything, never in a loop. */
  conditionsAsked: boolean;
  /** What the tools told this call, so a guardrail knows an accepted offer was real news. */
  seen: { accepted: string[]; interest: boolean };
  /** The offer this call recorded. */
  lastOfferRef: string | null;
  /** Something a tool noticed went wrong (a must-say line skipped), for the call to flag. */
  toolFlags: { rule: 'disclosure_missed'; text: string; recheck?: { items: SayItem[]; at: number; ifTimes?: boolean } }[];
  /** A booking, valuation or offer read back for a yes: records made, and booking tools tried, when it was asked or answered. */
  readBack: { committed: number; tries: number } | null;
  saidYes: { committed: number; tries: number } | null;
  /** How many times this call has tried create_booking, book_valuation or record_offer, whatever came back. */
  commitTries: number;
  /** The reminder to book what the caller said yes to is given once a call, never in a loop. */
  bookNudged: boolean;
  /** A booking tool said "not done yet" and what it needs (a name, a postcode), and the caller lines heard by then. */
  outstanding: { tool: string; heard: number } | null;
  retryNudged: boolean;
  /** end_call refuses once to end a "booked" call with nothing booked. */
  bookedChecked: boolean;
  /** The reminder to report bank-details talk as an urgent fraud message is given once a call. */
  fraudNudged: boolean;
  /** A fraud message has been taken: an earlier, unrelated message does not count. */
  fraudReported: boolean;
  // A repairs contractor's (presets/property-maintenance.md §4.4). Empty for
  // every other business, and read only by the maintenance tools and guardrails.
  /** Set at the start of a property maintenance contractor's call. */
  maintenance: boolean;
  /** An emergency the caller described, until the advice has been said. */
  safety: SafetyState | null;
  /** Emergencies already advised on this call: each arms once. */
  safetyDone: string[];
  /** The property this call is about, once find_property has found it. */
  property: string | null;
  /** Who the caller is to that property: what they may hear and do. */
  role: 'occupant' | 'authoriser' | 'homeowner' | 'stranger' | null;
  /** Jobs this caller may hear about: they gave the reference, or rang from the number on the job. */
  jobsVerified: string[];
  /** A homeowner heard the price before a job was booked: asked for once. */
  priceAsked: boolean;
  /** A job this call raised is waiting for the client's approval: nothing is booked or coming yet. */
  awaitingApproval: boolean;
  /** An emergency this call raised has paged an engineer who hasn't accepted: no name, no time. */
  paged: boolean;
  /** The invoice this call found or raised: what take_demo_payment pays by default. */
  invoice: string | null;
  /** The trade triage_fault called an emergency on this call: no visit window is offered for it. */
  emergencyTrade: string | null;
  /** Sums, in pence, the receptionist may say: from its instructions and what its tools returned. */
  amounts: number[];
  /** A Relay UK call: an assistant reads the caller's typed words, so gaps are long and silence is no goodbye. */
  relay: boolean;
  /** Every reference the tools returned in this call, letters and digits only: one said that isn't here was made up. */
  references: string[];
  /** A takeaway's fee and minimum for the postcode get_wait_times was given, before collection or delivery is set. */
  deliveryTerms: { fee_pence: number; min_order_pence: number } | null;
  /** A takeaway caller describing a severe allergic reaction: every tool waits until 999 has been said (core/reaction.ts). */
  reaction: ReactionState | null;
  /** The streets on orders find_order looked up: never said to the caller unless they said it first. */
  privateAddresses: string[];
  /** An estate agency's times of day the receptionist may say (minutes after midnight), and the ranges its tools gave. */
  times: number[];
  timeRanges: [number, number][];
}

export function newCallState(): CallState {
  return {
    lines: [], nextLine: 1, basketVersion: 0, reviewedKey: null, fulfilment: null,
    committed: [], found: [], lastOrderRef: null, lastBookingRef: null, paid: [], ending: false, transferRequested: false,
    heard: [], allergyAsked: false, dealOffers: [], dealHeard: null, owed: null, messageTaken: false, messageChecked: false, messageOwed: false,
    estate: false, takeaway: false, said: [], briefed: {}, gateAsked: [], verified: [], verifyMisses: 0, valuationOffered: false, conditionsAsked: false,
    seen: { accepted: [], interest: false }, lastOfferRef: null, toolFlags: [],
    readBack: null, saidYes: null, commitTries: 0, bookNudged: false, outstanding: null, retryNudged: false, bookedChecked: false, fraudNudged: false, fraudReported: false,
    maintenance: false, safety: null, safetyDone: [], property: null, role: null, jobsVerified: [], priceAsked: false, awaitingApproval: false, paged: false,
    invoice: null, emergencyTrade: null, amounts: [], relay: false, references: [], deliveryTerms: null, privateAddresses: [], reaction: null, times: [], timeRanges: [],
  };
}

/**
 * The reference the caller has not yet heard, if the call is about to end
 * without it. In a live test the receptionist booked and hung up in one go,
 * so the caller heard nothing. Asked once per reference, never in a loop.
 */
export function unsaidReference(state: CallState, agentWords: string): string | null {
  const owed = state.owed;
  state.owed = null;
  if (!owed) return null;
  const digits = agentWords.replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/gi, (w) => String(DIGIT_WORDS.indexOf(w.toLowerCase()) % 10));
  return digits.replace(/[^a-z0-9]/gi, '').toUpperCase().includes(owed) ? null : owed;
}
// "oh" is how people say 0 in a reference; it sits at 10 so % 10 gives 0.
const DIGIT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'oh'];

const ALLERGY_WORDS = /\b(allerg\w*|coeliac|celiac|intoleran\w*|anaphyla\w*|epi-?pen|nuts?|peanuts?|tree nuts?|shellfish|gluten|dairy|lactose|sesame)\b/i;
// "We don't have any allergies" was read as an allergy, and held a booking back.
const NO_ALLERGY = /\b(no|not any|none|without|nothing|(?:do|does|have|has|are|is)(?:n['’]t| not))\b[^.?!]{0,20}\b(allerg|dietary|intoleran)|\bno,? (?:that's|thats) (?:all|fine)|^no\.?$/i;
/** Named allergens: "no allergies, but my son is coeliac" still mentions one. */
const NAMED_ALLERGEN = /\b(coeliac|celiac|anaphyla\w*|epi-?pen|nuts?|peanuts?|shellfish|gluten|dairy|lactose|sesame)\b/i;

/** The caller's own words about an allergy, if they mentioned one (and did not just say they have none). */
export function mentionedAllergy(heard: string[]): string | null {
  for (const line of [...heard].reverse()) {
    if (NO_ALLERGY.test(line) && !NAMED_ALLERGEN.test(line)) continue;
    const m = ALLERGY_WORDS.exec(line);
    if (!m) continue;
    const sentence = line.split(/(?<=[.!?])\s+/).find((x) => ALLERGY_WORDS.test(x)) ?? line;
    return sentence.trim().slice(0, 160);
  }
  return null;
}

/**
 * A safety net for the kitchen: the caller mentioned an allergy but the
 * booking or order is about to go through without one. Asked once per call.
 */
function allergyCheck(ctx: ToolContext, given: string | undefined, tool: string, field: string): Record<string, unknown> | null {
  if (given || ctx.state.allergyAsked) return null;
  const said = mentionedAllergy(ctx.state.heard);
  if (!said) return null;
  ctx.state.allergyAsked = true;
  return {
    done: false,
    message: `Not done yet. Earlier the caller said: "${said}". If that is an allergy or dietary need for this ${tool === 'create_booking' ? 'booking' : 'order'}, call ${tool} again with it as ${field}; if not, call it again with ${field} "none". Do not mention this check to the caller.`,
  };
}

const noneToNull = (v: string | undefined) => (v && /^(none|no|n\/a|nothing)\.?$/i.test(v.trim()) ? undefined : v);

const DIET_WORDS = /\b(vegan|vegetarian|coeliac|celiac|halal|kosher|pescatarian)\b/i;

/**
 * The allergy as the kitchen needs it: what it is, then how bad. On 1 October
 * the receptionist said "dairy intolerance" aloud but saved "Intolerance, not
 * anaphylactic". When the saved words name nothing, the caller's own word is
 * put in front ("Dairy: intolerance, not anaphylactic").
 */
export function namedAllergy(given: string | undefined, heard: string[]): string | undefined {
  if (!given || allergensNamed(given).length || DIET_WORDS.test(given)) return given;
  for (const line of [...heard].reverse()) {
    const m = /\b(dairy|lactose|milk|gluten|wheat|coeliac|celiac|peanuts?|tree nuts?|nuts?|shellfish|prawns?|crab|fish|eggs?|soya?|sesame|celery|mustard|lupin|sulphites?|vegan|vegetarian)\b/i.exec(line);
    if (m) return `${m[1].charAt(0).toUpperCase()}${m[1].slice(1).toLowerCase()}: ${given.charAt(0).toLowerCase()}${given.slice(1)}`;
  }
  return given;
}

export interface ToolContext {
  tenant: Tenant;
  repo: Repo;
  now: () => Date;
  callId: string;
  channel: 'phone' | 'browser' | 'eval';
  callerPhone: string | null;
  state: CallState;
  demoCards: DemoCard[];
  sms: SmsSender;
  telephony: Telephony | null;
  action: (a: Action) => void;
}

export type Args = Record<string, unknown>;
export type Handler = (args: Args, ctx: ToolContext) => Promise<Record<string, unknown>>;

export interface ToolOptions {
  canTransfer: boolean;
}

export interface Tool {
  decl: FunctionDeclaration;
  handler: Handler;
  when?: (t: Tenant, o: ToolOptions) => boolean;
  /** Adds the parameters only some businesses need (seating areas, access, allergies). */
  tailor?: (decl: FunctionDeclaration, t: Tenant) => FunctionDeclaration;
}

// ── Tables: areas, access, features, allergies ────────────────────────────

const isTables = (t: Tenant) => t.profile.booking?.services.some((s) => s.kind === 'table') ?? false;
const bookableAreas = (t: Tenant) => (t.profile.booking?.areas ?? []).filter((a) => a.reservable && !a.enquiry_only);
const FEATURE_WORDS: [RegExp, string][] = [
  [/window/, 'window'], [/booth/, 'booth'], [/quiet|private|romantic|corner/, 'quiet'], [/heat/, 'heated'], [/cover|shelter|shade/, 'covered'],
  [/dog/, 'dog_friendly'], [/high/, 'high_table'], [/sofa|couch/, 'sofa'], [/view/, 'view'],
];

function preferences(v: unknown): string[] {
  return [...new Set(strList(v).flatMap((w) => FEATURE_WORDS.filter(([re]) => re.test(w.toLowerCase())).map(([, f]) => f)))];
}

/** "outside", "the terrace", "in the garden" to an area key; or why it cannot be booked. */
function resolveArea(t: Tenant, input: string | undefined): { key?: string; enquiry?: string; walkIn?: string; unknown?: string } {
  const areas = t.profile.booking?.areas ?? [];
  const s = input?.toLowerCase().trim();
  if (!s || areas.length < 2 || /^(any|either|anywhere|no preference|don'?t mind|whatever)/.test(s)) return {};
  let a = areas.find((x) => x.key === s || x.label.toLowerCase() === s) ?? areas.find((x) => s.includes(x.label.toLowerCase()) || x.label.toLowerCase().includes(s));
  if (!a && /out|terrace|garden|patio|fresco|courtyard|decking/.test(s)) a = areas.find((x) => x.kind === 'outdoor');
  if (!a && /\bin(side|doors)?\b|restaurant|dining room|main room/.test(s)) a = areas.find((x) => x.kind === 'indoor');
  if (!a && /bar|counter/.test(s)) a = areas.find((x) => x.kind === 'bar');
  if (!a && /private|function|upstairs|room for/.test(s)) a = areas.find((x) => x.kind === 'private');
  if (!a) return { unknown: `There is no area called "${input}". Areas: ${areas.map((x) => x.label).join(', ')}.` };
  if (a.enquiry_only) return { enquiry: `The ${a.label.toLowerCase()} is booked by enquiry. Take their name, number, date, party size and what they have in mind with take_message, and say the team will call back.` };
  if (!a.reservable) return { walkIn: `The ${a.label.toLowerCase()} is first come, first served; it cannot be booked. Offer ${bookableAreas(t).map((x) => x.label.toLowerCase()).join(' or ')} instead.` };
  return { key: a.key };
}

/** "4", "table four", "T4" to a table; or why it cannot be booked. */
function resolveTable(t: Tenant, input: string | undefined): { key?: string; label?: string; seats?: number; walkIn?: string; unknown?: string } {
  if (!input) return {};
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  const s = input.toLowerCase().replace(/\btable\b|\bnumber\b|\bt(?=\d)|[^a-z0-9 ]/g, ' ').trim();
  const n = /\d+/.exec(s)?.[0] ?? String(words.indexOf(s.split(/\s+/).pop() ?? ''));
  const r = (t.profile.booking?.resources ?? []).find((x) => !x.combines && (x.key.toLowerCase() === `t${n}` || x.label.toLowerCase() === `table ${n}`));
  if (!r || n === '-1') return { unknown: `There is no table "${input}".` };
  if (!r.services.length) return { walkIn: `${r.label} is kept for walk-ins: it cannot be booked. Say so kindly, and offer another table.` };
  return { key: r.key, label: r.label, seats: r.capacity };
}

/** The table parameters, only for businesses that book tables. */
function tableParams(decl: FunctionDeclaration, t: Tenant, extra: 'check' | 'book' | 'change'): FunctionDeclaration {
  if (!isTables(t)) return decl;
  const p = { ...(decl.parameters as { properties: Record<string, unknown> }).properties };
  const areas = bookableAreas(t);
  if (areas.length > 1) p.area = S(`Seating area if the caller has a preference: ${areas.map((a) => a.label).join(' or ')}`);
  if (t.profile.booking?.resources.some((r) => r.accessible)) p.accessible = B('Wheelchair, step-free or pram access needed');
  const features = [...new Set(t.profile.booking?.resources.flatMap((r) => r.features ?? []) ?? [])];
  if (features.length && extra !== 'change') p.prefer = S(`Table wishes, e.g. ${features.slice(0, 4).map((f) => f.replace('_', ' ')).join(', ')}`);
  if (extra !== 'change') p.table = S('A particular table, only if the caller asks for one by number ("table 4")');
  if (extra !== 'check') {
    p.allergies = S('Allergies or dietary needs, with how severe');
    if (extra === 'book') {
      p.occasion = S('Birthday, anniversary or other celebration');
      if (t.profile.booking?.highchairs) p.highchairs = I('Highchairs needed');
    }
  }
  return { ...decl, parameters: { ...(decl.parameters as object), properties: p } } as FunctionDeclaration;
}

/** The text a caller gets: what, when, where, the reference, and how to change it. */
function bookingText(t: Tenant, b: Booking, verb: string): string {
  if (t.profile.estate) return estateText(t, b, verb === 'Changed:' ? 'changed' : 'booked');
  const local = toLocal(b.starts_at, t.profile.timezone);
  const r = t.profile.booking?.resources.find((x) => x.key === b.resource_key);
  const area = b.area_key ? t.profile.booking?.areas?.find((a) => a.key === b.area_key) : undefined;
  const service = findService(t.profile, b.service_key);
  const where = service?.kind === 'table' ? ((t.profile.booking?.areas?.length ?? 0) > 1 && area ? `, ${area.label.toLowerCase()}` : '') : r ? ` with ${r.label}` : '';
  const who = service?.kind === 'table' ? `${b.party_size} ${b.party_size === 1 ? 'person' : 'people'}` : service?.label ?? '';
  const deposit = b.deposit_pence && !b.deposit_paid ? ` Deposit ${pounds(b.deposit_pence)} due.` : '';
  return `${t.profile.name}: ${verb} ${spokenDate(local.date)} ${spokenTime(local.time)}, ${who}${where}. Ref ${b.reference}.${deposit} To change it, call us and quote your reference. (Demo)`;
}

function hoursFor(t: Tenant, date: string): string[] {
  const p = t.profile;
  const wd = weekdayOf(date);
  const closure = p.closures?.find((c) => c.date === date);
  if (closure) return [`closed${closure.note ? ` (${closure.note})` : ''}`];
  const open = p.opening_hours.filter((h) => h.days.includes(wd));
  if (!open.length) return ['closed'];
  return open.map((h) => `${h.label ? `${h.label} ` : ''}${spokenTime(h.open)} to ${spokenTime(h.close)}`);
}

function bookingSummary(t: Tenant, b: { reference: string; starts_at: Date; party_size: number; name: string; service_key: string; resource_key: string; area_key?: string | null; allergies?: string | null; notes?: string | null; listing_key?: string | null; details?: Record<string, unknown> }) {
  if (t.profile.estate) return estateSummary(t, b);
  const local = toLocal(b.starts_at, t.profile.timezone);
  const service = findService(t.profile, b.service_key);
  const resource = t.profile.booking?.resources.find((r) => r.key === b.resource_key);
  const area = b.area_key ? t.profile.booking?.areas?.find((a) => a.key === b.area_key) : undefined;
  return {
    reference: b.reference,
    spoken_reference: spokenReference(b.reference),
    service: service?.label ?? b.service_key,
    date: local.date,
    spoken_date: spokenDate(local.date),
    time: local.time,
    spoken_time: spokenTime(local.time),
    party_size: b.party_size,
    name: b.name,
    with: service?.kind === 'appointment' ? resource?.label : undefined,
    area: area && (t.profile.booking?.areas?.length ?? 0) > 1 ? area.label : undefined,
    table: service?.kind === 'table' ? resource?.label : undefined,
    allergies: b.allergies ?? undefined,
    notes: b.notes ?? undefined,
  };
}

function basketSummary(ctx: ToolContext) {
  const subtotal = ctx.state.lines.reduce((s, l) => s + lineTotal(l), 0);
  return {
    lines: ctx.state.lines.map((l) => ({ line: l.line, text: describeLine(l) })),
    subtotal: pounds(subtotal),
    subtotal_pence: subtotal,
  };
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** "one Margherita with no basil": the words the agent reads back. */
function spokenLine(l: OrderLine): string {
  const n = NUMBER_WORDS[l.quantity] ?? String(l.quantity);
  const mods = l.modifiers.map((m) => m.name);
  if (l.notes) mods.push(l.notes);
  return `${n} ${l.name}${mods.length ? ` with ${mods.join(' and ')}` : ''}`;
}

// Live, 8 October: "ask collection or delivery first" had the receptionist ask
// again what the caller had just said, and "nothing to place yet" left an
// agreed collection unplaced.
/** A note said in words: "a twenty", "two twenties" is said as forty. */
const NOTES: Record<string, number> = { five: 5, ten: 10, twenty: 20, forty: 40, fifty: 50 };

const NO_FULFILMENT ="Collection or delivery isn't set yet. If the caller has already said which, call set_fulfilment now (delivery needs the postcode and first line of the address); only if not, ask.";

function orderAction(ctx: ToolContext, title: string) {
  const b = basketSummary(ctx);
  ctx.action({ kind: 'order_updated', title, detail: b.lines.map((l) => l.text).join('\n'), data: { lines: ctx.state.lines, subtotal: b.subtotal } });
}

function changed(ctx: ToolContext) {
  ctx.state.basketVersion++;
}

/**
 * A meal-deal offer after an item is added (domain/deals.ts): the cheaper-as-
 * a-deal one first, else "make it a meal"; each kind at most once a call,
 * none once a deal is in the order, and none at all after the caller says no.
 */
function dealOffer(ctx: ToolContext, added: OrderLine): Record<string, unknown> | null {
  const menu = ctx.tenant.profile.menu!;
  const s = ctx.state;
  if (!menu.deals?.length) return null;
  if (s.dealHeard !== null && s.heard.slice(s.dealHeard).some((l) => DECLINED.test(l))) s.dealOffers = ['meal', 'deal'];
  if (s.lines.some((l) => dealOf(menu, l.item_key))) return null;
  const offer = (!s.dealOffers.includes('deal') ? dealHint(menu, s.lines) : null) ?? (!s.dealOffers.includes('meal') ? mealHint(menu, s.lines, added) : null);
  if (!offer) return null;
  s.dealOffers.push(offer.kind);
  s.dealHeard = s.heard.length;
  const ask = offer.still_to_choose.map((x) => x.toLowerCase()).join(' and ');
  return {
    [offer.kind === 'meal' ? 'meal_hint' : 'deal_hint']: offer.say,
    swap: offer.swap,
    ...(ask ? { still_to_choose: offer.still_to_choose } : {}),
    offer_once: `Offer this once, in one sentence, once they've said what they're ordering. On yes, ${ask ? `ask for their ${ask}, then ` : ''}call add_to_order with the deal, ${ask ? 'every choice' : 'these choices'} as options, and replaces. On no, carry on: never offer a deal again this call.`,
  };
}

/**
 * The order's content: dishes, options, notes, and how and when it is
 * fulfilled as the caller asked for it. Calling set_fulfilment again with the
 * same answer, or "asap" a minute later, is not a change the caller must
 * re-approve. (A version counter treated it as one, and on 29 September sent
 * the agent round a read-back loop until the caller gave up.)
 */
export function basketKey(s: CallState): string {
  return JSON.stringify({
    lines: s.lines.map((l) => [l.item_key, l.quantity, l.modifiers.map((m) => m.key).sort(), l.notes ?? '']),
    f: s.fulfilment ? [s.fulfilment.type, s.fulfilment.requested, s.fulfilment.postcode, s.fulfilment.address] : null,
  });
}

function earliestDue(ctx: ToolContext, type: 'collection' | 'delivery'): Date {
  const o = ctx.tenant.profile.ordering!;
  const mins = o.prep_minutes + (type === 'delivery' ? o.delivery?.extra_minutes ?? 0 : 0);
  const t = ctx.now().getTime() + mins * 60000;
  return new Date(Math.ceil(t / 300000) * 300000);
}

function withinOrderingHours(ctx: ToolContext, due: Date): boolean {
  const o = ctx.tenant.profile.ordering!;
  const local = toLocal(due, ctx.tenant.profile.timezone);
  const m = minutesOf(local.time);
  return o.hours.some((h) => h.days.includes(local.weekday) && m >= minutesOf(h.open) && m <= closeMinutes(h.close));
}

/** What to tell the caller about paying for takeaway, by the business's rule. */
function paymentRule(rule: 'phone' | 'collection' | 'either', fulfilment: 'collection' | 'delivery'): string {
  if (rule === 'phone') return 'Payment is taken on the phone: take it now with take_demo_payment, reading out the demo card if they need it.';
  if (rule === 'collection') return `Payment is on ${fulfilment}: do not take a card. Tell them to pay when ${fulfilment === 'delivery' ? 'it arrives' : 'they collect'}.`;
  return `Unpaid. Ask if they would like to pay now with the demo card, or pay on ${fulfilment}.`;
}

const TOOLS: Record<string, Tool> = {
  get_opening_hours: {
    decl: {
      name: 'get_opening_hours',
      description: 'Opening, last-booking and takeaway times for a date, or the next 7 days.',
      parameters: obj({ date: S('YYYY-MM-DD') }),
    },
    tailor: (d, t) => maintenanceParams(estateParams(d, t, 'hours'), t, 'hours'),
    async handler(args, ctx) {
      const p = ctx.tenant.profile;
      const today = toLocal(ctx.now(), p.timezone).date;
      const date = str(args.date);
      const days = date && isIsoDate(date) ? [date] : Array.from({ length: 7 }, (_, i) => addDays(today, i));
      return {
        days: days.map((d) => {
          const out: Record<string, unknown> = { date: d, spoken_date: spokenDate(d), open: hoursFor(ctx.tenant, d) };
          const wd = weekdayOf(d);
          const svc = p.booking?.services[0];
          if (svc?.kind === 'table') {
            const ws = svc.windows.filter((w) => w.days.includes(wd));
            if (ws.length) out.last_booking_times = ws.map((w) => spokenTime(w.last));
          }
          const take = p.ordering?.hours.filter((h) => h.days.includes(wd));
          if (take?.length) out.orders = take.map((h) => `${spokenTime(h.open)} to ${spokenTime(h.close)}`);
          if (p.estate) Object.assign(out, estateHours(ctx.tenant, d));
          if (p.maintenance) Object.assign(out, maintenanceHours(ctx.tenant, d));
          return out;
        }),
      };
    },
  },

  search_knowledge: {
    decl: {
      name: 'search_knowledge',
      description: "The business's own answers to anything not in the facts: parking, access, dogs, children, diets, policies, events.",
      parameters: obj({ question: S("The caller's question, in a few words") }, ['question']),
    },
    async handler(args, ctx) {
      const q = str(args.question) ?? '';
      const p = ctx.tenant.profile;
      const entries = [
        ...p.knowledge,
        ...Object.entries(p.policies ?? {}).map(([k, v]) => ({ q: `${k.replace(/_/g, ' ')} policy`, a: v, tags: [k.replace(/_/g, ' ')] })),
      ];
      const hits = searchKnowledge(entries, q);
      if (!hits.length) {
        // A live call on 6 October asked here for a flat's service charge and ground rent, which get_property had all along.
        const home = p.estate ? ' If it is about one of our homes (its price, lease, service charge, ground rent, rooms or parking), call get_property for it instead.' : '';
        return { answers: [], note: `Nothing on file for that.${home} Otherwise say you're not sure, and offer to take a message so the team can call back.` };
      }
      return { answers: hits.map((h) => ({ about: h.q, answer: h.a })) };
    },
  },

  check_availability: {
    when: (t) => capabilities(t.profile).booking,
    decl: {
      name: 'check_availability',
      description: 'Free times for a table or appointment. Without a time, the whole day. If taken, the nearest alternatives.',
      parameters: obj(
        {
          service: S('e.g. "table" or a treatment; optional if only one'),
          date: S('YYYY-MM-DD'),
          time: S('HH:MM'),
          party_size: I('People; default 1'),
          staff: S('Named staff member, if asked for'),
        },
        ['date'],
      ),
    },
    tailor: (d, t) => estateParams(tableParams(d, t, 'check'), t, 'check'),
    async handler(args, ctx) {
      const p = ctx.tenant.profile;
      const service = findService(p, str(args.service));
      if (!service) {
        return { available: false, message: `Not a bookable service. Services: ${p.booking!.services.map((s) => s.label).join(', ')}.` };
      }
      const estate = await estateAvailability(args, ctx, service);
      if (estate) return estate;
      const area = resolveArea(ctx.tenant, str(args.area));
      if (area.enquiry || area.walkIn || area.unknown) return { available: false, message: area.enquiry ?? area.walkIn ?? area.unknown };
      const table = service.kind === 'table' ? resolveTable(ctx.tenant, str(args.table)) : {};
      if (table.walkIn || table.unknown) return { available: false, message: table.walkIn ?? table.unknown };
      const party = int(args.party_size) ?? 1;
      if (table.key && party > (table.seats ?? 0)) return { available: false, message: `${table.label} seats ${table.seats}, not ${party}.` };
      const date = str(args.date) ?? '';
      const existing = isIsoDate(date) ? await ctx.repo.busyForDate(ctx.tenant, date) : [];
      const r = checkAvailability({
        profile: p, serviceKey: service.key, date, time: str(args.time), partySize: party,
        staff: str(args.staff), now: ctx.now(), existing, area: area.key, accessible: bool(args.accessible), prefer: preferences(args.prefer), only: table.key,
      });
      const out: Record<string, unknown> = { ...r, service: service.label };
      if (table.key) out.table = table.label;
      if (r.fully_booked) out.fully_booked_note = `Fully booked, not closed: ${r.fully_booked.join(' and ')}. Say it is fully booked, never that you are closed.`;
      if (r.slot && service.kind === 'appointment') out.with = r.slot.resource_label;
      if (r.slot) {
        const slot = out.slot as Record<string, unknown>;
        delete slot.resource_key;
        // The table number is for staff; callers hear the area and what the table is like (unless they asked for that table).
        if (service.kind === 'table' && !table.key) delete slot.resource_label;
        // Step-free only when asked: unasked, it led the receptionist to mark a booking as needing step-free access.
        if (!bool(args.accessible)) delete slot.accessible;
        const wanted = preferences(args.prefer);
        const missing = wanted.filter((f) => !(r.slot!.features ?? []).includes(f));
        if (missing.length) out.note = `No ${missing.map((f) => f.replace('_', ' ')).join(' or ')} table free then; it can be noted as a request.`;
      }
      if (r.areas_free && !table.key) out.next = `Both are free: ask whether they would like ${r.areas_free.map((a) => a.toLowerCase()).join(' or ')}.`;
      if (r.other_areas_free) out.next = `The ${p.booking?.areas?.find((a) => a.key === area.key)?.label.toLowerCase()} is full then, but ${r.other_areas_free.map((a) => a.toLowerCase()).join(' and ')} ${r.other_areas_free.length > 1 ? 'are' : 'is'} free at that time. Offer that first, then other times.`;
      if (service.price_pence) out.price = pounds(service.price_pence);
      return out;
    },
  },

  create_booking: {
    when: (t) => capabilities(t.profile).booking,
    decl: {
      name: 'create_booking',
      description: 'Make the booking, after reading it back and hearing yes. The only way a booking exists. Returns the reference.',
      parameters: obj(
        {
          service: S('Optional if only one'),
          date: S('YYYY-MM-DD'),
          time: S('HH:MM'),
          party_size: I('People; 1 for an appointment'),
          name: S("Caller's name"),
          phone: S('Only if not the calling number'),
          staff: S('Named staff member, if asked for'),
          notes: S('Anything else the staff should know'),
        },
        ['date', 'time', 'name'],
      ),
    },
    tailor: (d, t) => estateParams(tableParams(d, t, 'book'), t, 'book'),
    async handler(args, ctx) {
      const p = ctx.tenant.profile;
      if (p.estate) {
        const service = findService(p, str(args.service));
        const estate = service ? await estateBooking(args, ctx, service) : null;
        if (estate) return estate;
      }
      const phone = normaliseUkPhone(str(args.phone)) ?? ctx.callerPhone;
      const area = resolveArea(ctx.tenant, str(args.area));
      if (area.enquiry || area.walkIn || area.unknown) return { booked: false, message: area.enquiry ?? area.walkIn ?? area.unknown };
      const table = isTables(ctx.tenant) ? resolveTable(ctx.tenant, str(args.table)) : {};
      if (table.walkIn || table.unknown) return { booked: false, message: table.walkIn ?? table.unknown };
      const name = realName(args.name);
      if (!name) return { booked: false, message: ASK_NAME };
      if (isTables(ctx.tenant) && !area.key && !table.key) {
        // In a live test the read-back said "on the terrace" but the booking named no area, so the table went inside.
        // When the caller has a choice, the area they chose must be passed.
        const service = findService(p, str(args.service));
        const date = str(args.date) ?? '';
        const time = str(args.time);
        if (service && isIsoDate(date) && time) {
          const { areas_free: free } = checkAvailability({
            profile: p, serviceKey: service.key, date, time, partySize: int(args.party_size) ?? 1, now: ctx.now(),
            existing: await ctx.repo.busyForDate(ctx.tenant, date), accessible: bool(args.accessible),
          });
          if (free && free.length > 1) {
            return { booked: false, message: `Not booked yet: ${free.join(' and ')} are both free then, and this booking named neither. Call create_booking again with area set to the one the caller chose. Only ask them if they have not said; if they do not mind, ${free[0].toLowerCase()}.` };
          }
        }
      }
      if (isTables(ctx.tenant)) {
        const nudge = allergyCheck(ctx, str(args.allergies), 'create_booking', 'allergies');
        if (nudge) return { booked: false, ...nudge };
      }
      const allergies = namedAllergy(noneToNull(str(args.allergies)), ctx.state.heard);
      const accessible = bool(args.accessible);
      const prefer = preferences(args.prefer);
      const highchairs = int(args.highchairs) ?? 0;
      const occasion = str(args.occasion);
      const tags: string[] = [];
      if (occasion) tags.push(/anniv/i.test(occasion) ? 'anniversary' : /birthday|bday/i.test(occasion) ? 'birthday' : 'celebration');
      if (accessible) tags.push('wheelchair');
      if (highchairs) tags.push('highchair');
      const notes = [
        str(args.notes),
        occasion ? occasion.charAt(0).toUpperCase() + occasion.slice(1) : null,
        highchairs ? `${highchairs} highchair${highchairs > 1 ? 's' : ''}` : null,
        accessible ? 'Step-free table needed' : null,
      ].filter(Boolean).join('. ') || null;
      const r = await ctx.repo.createBooking(
        ctx.tenant,
        {
          service: str(args.service), date: str(args.date) ?? '', time: str(args.time) ?? '',
          party_size: int(args.party_size) ?? 1, name, phone, notes,
          staff: str(args.staff), source: ctx.channel === 'phone' ? 'phone' : ctx.channel, call_id: ctx.callId,
          area: area.key, accessible, prefer, allergies: allergies ?? null, tags, table: table.key,
        },
        ctx.now(),
      );
      if (!r.ok) {
        // Say exactly why, with what is free instead, so the caller hears the real choice at once.
        if (r.reason !== 'fully_booked') return { booked: false, reason: r.reason, message: r.message, next: 'Offer another time (or area) with check_availability.' };
        const date = str(args.date) ?? '';
        const a2 = checkAvailability({
          profile: p, serviceKey: str(args.service), date, time: str(args.time), partySize: int(args.party_size) ?? 1, staff: str(args.staff),
          now: ctx.now(), existing: isIsoDate(date) ? await ctx.repo.busyForDate(ctx.tenant, date) : [], area: area.key, accessible, prefer, only: table.key,
        });
        return {
          booked: false, reason: 'fully_booked', message: a2.message ?? r.message, alternatives: a2.alternatives,
          other_areas_free: a2.other_areas_free,
          next: a2.alternatives.length || a2.other_areas_free ? 'Offer these, then book the one they choose.' : 'Nothing close is free: offer another day, or take a message for the team.',
        };
      }
      const b = r.booking;
      record(ctx, b.reference, 'booking', 'committed');
      const s = bookingSummary(ctx.tenant, b);
      const areaInfo = b.area_key ? p.booking?.areas?.find((a) => a.key === b.area_key) : undefined;
      ctx.action({
        kind: 'booking_created',
        title: `${s.service === 'table' ? 'Table' : s.service} booked`,
        detail: `${s.spoken_date}, ${s.spoken_time} · ${b.party_size} ${b.party_size === 1 ? 'person' : 'people'} · ${b.name}${s.table ? ` · ${s.table}${s.area ? `, ${s.area.toLowerCase()}` : ''}` : s.with ? ` with ${s.with}` : ''}${b.allergies ? ` · ALLERGY: ${b.allergies}` : ''} · ref ${b.reference}`,
        data: { reference: b.reference },
      });
      const smsStatus = await smsTo(ctx, phone, bookingText(ctx.tenant, b, 'Booked:'));
      const chairs = p.booking?.highchairs ?? 0;
      const got = ctx.tenant.profile.booking?.resources.find((x) => x.key === b.resource_key)?.features ?? [];
      const unmet = prefer.filter((f) => !got.includes(f));
      return {
        booked: true,
        ...s,
        weather_note: areaInfo?.kind === 'outdoor' ? areaInfo.weather_note : undefined,
        deposit_due: b.deposit_pence ? pounds(b.deposit_pence) : undefined,
        note: [
          highchairs > chairs ? `We only have ${chairs} highchair${chairs === 1 ? '' : 's'}; say so.` : null,
          unmet.length ? `No ${unmet.map((f) => f.replace('_', ' ')).join(' or ')} table was free; say it is noted as a request.` : null,
        ].filter(Boolean).join(' ') || undefined,
        next: b.deposit_pence
          ? `A ${pounds(b.deposit_pence)} deposit secures this booking. Offer to take it now with take_demo_payment (for "deposit"), or say a payment link will be texted.`
          : undefined,
        confirmation_text: smsStatus ? 'sent by text, with the reference' : 'no number to text',
      };
    },
  },

  find_bookings: {
    when: (t) => capabilities(t.profile).booking,
    decl: {
      name: 'find_bookings',
      description: "The caller's upcoming bookings, by reference, phone or name; by default the calling number.",
      parameters: obj({ reference: S('Booking reference'), phone: S('Phone number'), name: S('Name on the booking') }),
    },
    async handler(args, ctx) {
      const reference = str(args.reference);
      // Callers read references a character or two at a time. Every reference is five
      // characters, so a shorter one is unfinished: "not found" would have the receptionist apologise after each letter.
      if (reference && reference.replace(/[^a-z0-9]/gi, '').length < 5) {
        return { bookings: [], note: 'That is only part of a reference: they are five letters and numbers, like HK482. Let them finish, then search with all of it.' };
      }
      const phone = normaliseUkPhone(str(args.phone)) ?? (reference || str(args.name) ? undefined : ctx.callerPhone ?? undefined);
      const name = str(args.name);
      let found = await ctx.repo.findBookings(ctx.tenant.id, { reference, phone, name: reference || phone ? undefined : name }, ctx.now());
      // Callers quote a number other than the one they booked with: in a live test the right name was never searched.
      if (!found.length && !reference && phone && name) found = await ctx.repo.findBookings(ctx.tenant.id, { name }, ctx.now());
      for (const b of found) record(ctx, b.reference, 'booking', 'found');
      if (!found.length) return { bookings: [], note: 'No upcoming bookings found. Ask for the reference or the name it was booked under.' };
      return { bookings: found.map((b) => bookingSummary(ctx.tenant, b)) };
    },
  },

  modify_booking: {
    when: (t) => capabilities(t.profile).booking,
    decl: {
      name: 'modify_booking',
      description: 'Change a booking (date, time, party size, the name on it, the phone number, notes), after reading the change back and hearing yes. Keeps the same table when it still fits.',
      parameters: obj(
        {
          reference: S('Booking reference'), date: S('YYYY-MM-DD'), time: S('HH:MM'), party_size: I('People'),
          name: S('New name for the booking'), phone: S('New phone number for the booking'), notes: S('Notes'),
        },
        ['reference'],
      ),
    },
    tailor: (d, t) => tableParams(d, t, 'change'),
    async handler(args, ctx) {
      const ref = str(args.reference) ?? '';
      const area = resolveArea(ctx.tenant, str(args.area));
      if (area.enquiry || area.walkIn || area.unknown) return { changed: false, message: area.enquiry ?? area.walkIn ?? area.unknown };
      const phone = str(args.phone) ? normaliseUkPhone(str(args.phone)) : undefined;
      if (str(args.phone) && !phone) return { changed: false, message: 'That is not a UK phone number. Ask for it again, digit by digit.' };
      if (str(args.name) && !realName(args.name)) return { changed: false, message: ASK_NAME };
      // A viewing moves only within its home's rules.
      const listing = ctx.tenant.profile.listings ? await moveRule(ctx, ref) : undefined;
      const r = await ctx.repo.modifyBooking(
        ctx.tenant, ref,
        {
          date: str(args.date), time: str(args.time), party_size: int(args.party_size), notes: str(args.notes), area: area.key,
          accessible: bool(args.accessible), allergies: namedAllergy(noneToNull(str(args.allergies)), ctx.state.heard), name: realName(args.name), phone: phone ?? undefined,
          listing,
        },
        ctx.now(),
      );
      if (!r.ok) return { changed: false, message: r.message, next: 'Check other times with check_availability, then offer them.' };
      record(ctx, r.booking.reference, 'change', 'committed');
      const s = bookingSummary(ctx.tenant, r.booking);
      ctx.action({
        kind: 'booking_changed', title: 'Booking changed',
        detail: ctx.tenant.profile.estate
          ? `${s.spoken_date}, ${s.spoken_time}${'property' in s && s.property ? ` · ${s.property}` : ''} · with ${s.with} · ref ${r.booking.reference}`
          : `${s.spoken_date}, ${s.spoken_time} · ${r.booking.party_size} people${s.table ? ` · ${s.table}` : ''} · ref ${r.booking.reference}`,
        data: { reference: r.booking.reference },
      });
      await smsTo(ctx, r.booking.phone, bookingText(ctx.tenant, r.booking, 'Changed:'));
      return {
        changed: true, ...s,
        deposit_due: r.booking.deposit_pence && !r.booking.deposit_paid ? pounds(r.booking.deposit_pence) : undefined,
        confirmation_text: r.booking.phone ? 'a new text is on its way' : undefined,
      };
    },
  },

  cancel_booking: {
    when: (t) => capabilities(t.profile).booking,
    decl: {
      name: 'cancel_booking',
      description: 'Cancel a booking. Confirm with the caller first.',
      parameters: obj({ reference: S('Booking reference') }, ['reference']),
    },
    async handler(args, ctx) {
      const b = await ctx.repo.cancelBooking(ctx.tenant.id, str(args.reference) ?? '');
      if (!b) return { cancelled: false, message: 'No confirmed booking with that reference.' };
      record(ctx, b.reference, 'cancellation', 'committed');
      const s = bookingSummary(ctx.tenant, b);
      ctx.action({ kind: 'booking_cancelled', title: 'Booking cancelled', detail: `${s.spoken_date}, ${s.spoken_time} · ${b.name} · ref ${b.reference}` });
      await smsTo(ctx, b.phone, ctx.tenant.profile.estate ? estateText(ctx.tenant, b, 'cancelled') : `${ctx.tenant.profile.name}: booking ${b.reference} for ${s.spoken_date} is cancelled. To book again, just call us. (Demo)`);
      return { cancelled: true, ...s, policy: ctx.tenant.profile.policies?.cancellation };
    },
  },

  get_menu: {
    when: (t) => Boolean(t.profile.menu),
    decl: {
      name: 'get_menu',
      description: 'Menu categories and dish names; with a category, prices and descriptions; with free_from, the dishes without an allergen.',
      parameters: obj({ category: S('e.g. pizzas, desserts'), free_from: S('An allergy, e.g. dairy, gluten, nuts: lists the dishes made without it') }),
    },
    async handler(args, ctx) {
      const { menu, soldOut } = await menuTonight(ctx);
      const avoid = allergensNamed(str(args.free_from) ?? '');
      if (str(args.free_from) && !avoid.length) return { message: `"${str(args.free_from)}" is not one of the 14 allergens the menu records. Say you will note it for the kitchen.` };
      if (avoid.length) {
        const items = menu.categories.flatMap((x) => x.items.map((i) => ({ i, category: x.label })));
        return {
          free_from: avoid,
          dishes: items.filter(({ i }) => !i.allergens_unknown && !avoid.some((a) => i.allergens.includes(a))).map(({ i, category }) => ({
            name: i.name, category, may_contain: i.may_contain?.filter((a) => avoid.includes(a)).length ? `may contain traces of ${avoid.join(', ')}` : undefined,
          })),
          unknown: items.filter(({ i }) => i.allergens_unknown).map(({ i }) => i.name),
          say: `These are made without ${avoid.join(' or ')} as an ingredient. ${menu.allergen_statement} Never say a dish is safe.`,
        };
      }
      const c = str(args.category)?.toLowerCase();
      const cats = c
        ? menu.categories.filter((x) => x.label.toLowerCase().includes(c) || x.key.includes(c) || c.includes(x.key))
        : [];
      if (c && cats.length) {
        return {
          categories: cats.map((x) => ({
            category: x.label,
            items: x.items.map((i) => ({
              name: i.name, price: pounds(i.price_pence), description: i.description, dietary: i.dietary,
              available: i.available === false ? (soldOut.has(i.key) ? 'sold out tonight' : 'not today') : undefined,
            })),
          })),
        };
      }
      return { categories: menu.categories.map((x) => ({ category: x.label, items: x.items.map((i) => i.name) })) };
    },
  },

  get_item_details: {
    when: (t) => Boolean(t.profile.menu),
    decl: {
      name: 'get_item_details',
      description: 'Price, options and allergens for one dish on the menu. Use when the caller asks about a dish, including whether it suits an allergy, and repeat its allergen wording. Not for an allergy itself: a booking just records it.',
      parameters: obj({ item: S('The dish') }, ['item']),
    },
    async handler(args, ctx) {
      const { menu, soldOut } = await menuTonight(ctx);
      const byChoice = dealByChoice(menu, str(args.item) ?? '');
      const r = byChoice ? { ok: true as const, value: byChoice.item } : resolveItem(menu, str(args.item) ?? '');
      if (!r.ok) {
        const allergy = allergensNamed(str(args.item) ?? '');
        if (allergy.length) {
          return { found: false, message: `"${str(args.item)}" is an allergy (${allergy.join(', ')}), not a dish. For a booking or order, just record it as the allergy. To say which dishes are made without it, use get_menu with free_from.` };
        }
        return { found: false, question: r.question, options: 'options' in r ? r.options : undefined };
      }
      const item = r.value;
      // A meal deal is answered choice by choice, for the allergen the caller named (domain/deals.ts).
      const deal = dealOf(menu, item.key);
      const priced = (o: { name: string; price_pence: number }) => `${o.name}${o.price_pence ? ` (+${pounds(o.price_pence)})` : ''}`;
      return {
        found: true,
        name: item.name,
        price: pounds(item.price_pence),
        description: item.description,
        dietary: item.dietary,
        available: item.available === false ? (soldOut.has(item.key) ? 'sold out tonight' : 'not available today') : 'yes',
        options: optionsFor(menu, item).map((o) => priced(o.option)),
        ...(deal ? { choices: deal.parts.map((p) => `${p.label}: ${(menu.modifier_groups[p.group]?.options ?? []).map(priced).join(', ')}`) } : {}),
        allergens: allergensOf(menu, item),
        allergen_answer: deal ? dealAllergenAnswer(menu, deal, allergensNamed(`${str(args.item) ?? ''} ${ctx.state.heard.slice(-4).join(' ')}`)) : allergenAnswer(menu, item),
      };
    },
  },

  add_to_order: {
    when: (t) => capabilities(t.profile).ordering,
    decl: {
      name: 'add_to_order',
      description: 'Add a dish. Options such as "no basil" or "large". Returns the running total.',
      parameters: obj(
        {
          item: S('The dish'),
          quantity: I('Default 1'),
          options: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Options as the caller said them' },
          notes: S('Kitchen note that is not an option'),
        },
        ['item'],
      ),
    },
    // A takeaway's meal deals take the place of the lines they are made of (domain/deals.ts).
    tailor: (d, t) => {
      if (!t.profile.menu?.deals?.length) return d;
      const p = { ...(d.parameters as { properties: Record<string, unknown> }).properties };
      p.replaces = { type: 'ARRAY', items: { type: 'INTEGER' }, description: 'For a deal taken from a meal_hint or deal_hint: the line numbers it replaces, from its swap' };
      return { ...d, parameters: { ...(d.parameters as object), properties: p } };
    },
    async handler(args, ctx) {
      const { menu, soldOut } = await menuTonight(ctx);
      const words = str(args.item) ?? '';
      // "A cheeseburger meal" is the Burger meal with a cheeseburger (domain/deals.ts).
      const byChoice = dealByChoice(menu, words);
      const r = byChoice ? { ok: true as const, value: byChoice.item } : resolveItem(menu, words);
      if (!r.ok) return { added: false, question: r.question };
      const item = r.value;
      if (item.available === false) return { added: false, message: soldOut.has(item.key) ? soldOutWords(menu, item.key, soldOut) : `${item.name} is not available today.` };
      // A size or choice already in the item's words ("regular fries") counts as asked for.
      const given = strList(args.options);
      const requested = byChoice && !given.some((g) => score(g, byChoice.choice) >= 0.7) ? [byChoice.choice, ...given] : given;
      const mods = resolveModifiers(menu, item, [...requested, ...choicesIn(menu, item, words, requested)]);
      if (!mods.ok) {
        const meal = mods.unmatched.length ? dealForOptions(menu, item, mods.unmatched, requested) : null;
        // A deal missing a choice stays one deal. Live, 8 October: a Pizza night without its drinks became two pizzas and two cans.
        const deal = !mods.unmatched.length && dealOf(menu, item.key);
        return {
          added: false, question: mods.question,
          nothing_added: deal
            ? `Nothing was added yet. Ask the caller this, then call add_to_order again with item "${item.name}" and options ${JSON.stringify(requested)} plus their answer: it is all one ${item.name}, never separate items.`
            : 'Nothing was added yet. Ask the caller this, then call add_to_order again with their answer in options.',
          ...(meal ? { as_a_meal: `${mods.unmatched.join(' and ')} ${mods.unmatched.length > 1 ? 'come' : 'comes'} with the ${meal.deal}. Ask if they'd like it as a ${meal.deal}, or the items on their own. For the meal: add_to_order with item "${meal.deal}" and options ${JSON.stringify(meal.options)}.` } : {}),
        };
      }
      // A meal deal's choice sold out tonight (a cheeseburger in the Burger meal): another choice, never the deal without it.
      const gone = mods.value.filter((m) => soldOut.has(m.key));
      if (gone.length) {
        return { added: false, message: `${gone.map((m) => m.name).join(' and ')} ${gone.length > 1 ? 'are' : 'is'} sold out tonight. Say sorry, and ask them to choose another for their ${item.name}.`, nothing_added: 'Nothing was added yet.' };
      }
      let quantity = Math.min(Math.max(int(args.quantity) ?? 1, 1), 20);
      // "Six hot wings" passed as six of them: the six is the dish's own name.
      const inName = quantity > 1 && quantity === countInName(item.name);
      if (inName) quantity = 1;
      const line: OrderLine = {
        line: ctx.state.nextLine++,
        item_key: item.key,
        name: item.name,
        quantity,
        unit_pence: item.price_pence,
        modifiers: mods.value.map((m) => ({ key: m.key, name: m.name, price_pence: m.price_pence })),
        notes: str(args.notes),
      };
      // A deal taking the place of separate lines: their extras (extra cheese) and notes move onto it.
      const deal = dealOf(menu, item.key);
      const replaced = deal && Array.isArray(args.replaces)
        ? ctx.state.lines.filter((l) => (args.replaces as unknown[]).map(Number).includes(l.line) && !dealOf(menu, l.item_key))
        : [];
      for (const old of replaced) {
        for (const m of old.modifiers) if (dealExtra(menu, deal!, m.key) && !line.modifiers.some((x) => x.key === m.key)) line.modifiers.push(m);
      }
      const notes = [line.notes, ...replaced.map((l) => l.notes)].filter(Boolean).join('; ');
      if (notes) line.notes = notes;
      // Past the owner's limit it's catering: a message for the manager, nothing added.
      const catering = cateringOrder(ctx, [...ctx.state.lines.filter((l) => !replaced.includes(l)), line]);
      if (catering) return catering;
      ctx.state.lines = ctx.state.lines.filter((l) => !replaced.includes(l));
      ctx.state.lines.push(line);
      changed(ctx);
      orderAction(ctx, 'Order in progress');
      const offer = deal ? null : dealOffer(ctx, line);
      const b = basketSummary(ctx);
      return {
        added: describeLine(line), line: line.line, order_so_far: b.lines.map((l) => l.text), running_total: b.subtotal,
        ...(replaced.length ? { replaced: replaced.map((l) => l.line) } : {}),
        ...(inName ? { quantity_note: `Taken as one ${item.name}: the number is in its name. If they want more than one portion, change the line's quantity.` } : {}),
        ...shortOfMinimum(ctx),
        ...offer,
      };
    },
  },

  change_order_line: {
    when: (t) => capabilities(t.profile).ordering,
    decl: {
      name: 'change_order_line',
      description: 'Change a line already in the order. Quantity 0 removes it.',
      parameters: obj(
        {
          line: I('Line number'),
          quantity: I('New quantity; 0 removes the line'),
          options: { type: 'ARRAY', items: { type: 'STRING' }, description: 'The full new set of options' },
          notes: S('New kitchen note'),
        },
        ['line'],
      ),
    },
    async handler(args, ctx) {
      const menu = ctx.tenant.profile.menu!;
      const i = ctx.state.lines.findIndex((l) => l.line === int(args.line));
      if (i < 0) return { ok: false, message: 'No such line.', order: basketSummary(ctx).lines };
      const line = ctx.state.lines[i];
      const q = int(args.quantity);
      if (q === 0) {
        ctx.state.lines.splice(i, 1);
        changed(ctx);
        orderAction(ctx, 'Order in progress');
        const b = basketSummary(ctx);
        return { removed: describeLine(line), order_so_far: b.lines.map((l) => l.text), running_total: b.subtotal, ...shortOfMinimum(ctx) };
      }
      if (args.options !== undefined) {
        const item = menu.categories.flatMap((c) => c.items).find((x) => x.key === line.item_key)!;
        const mods = resolveModifiers(menu, item, strList(args.options));
        if (!mods.ok) return { ok: false, question: mods.question };
        line.modifiers = mods.value.map((m) => ({ key: m.key, name: m.name, price_pence: m.price_pence }));
      }
      if (q !== undefined) line.quantity = Math.min(Math.max(q, 1), 20);
      if (args.notes !== undefined) line.notes = str(args.notes);
      changed(ctx);
      orderAction(ctx, 'Order in progress');
      const b = basketSummary(ctx);
      return { updated: describeLine(line), order_so_far: b.lines.map((l) => l.text), running_total: b.subtotal, ...shortOfMinimum(ctx) };
    },
  },

  set_fulfilment: {
    when: (t) => capabilities(t.profile).ordering,
    decl: {
      name: 'set_fulfilment',
      description: 'Collection or delivery, and when. Delivery needs postcode and first line of address.',
      parameters: obj(
        {
          type: S('collection or delivery'),
          time: S('HH:MM today, or asap'),
          postcode: S('Delivery postcode'),
          address: S('First line of address'),
        },
        ['type'],
      ),
    },
    async handler(args, ctx) {
      const p = ctx.tenant.profile;
      const o = p.ordering!;
      // A takeaway's kitchen counts every order by when it must be ready, with zones and last orders (core/kitchen.ts).
      if (o.kitchen) return kitchenFulfilment(args, ctx);
      const type = str(args.type)?.toLowerCase().startsWith('deliv') ? 'delivery' : 'collection';
      if (type === 'delivery' && !o.delivery) return { ok: false, message: 'Delivery is not offered; collection only.' };
      if (type === 'collection' && !o.collection) return { ok: false, message: 'Collection is not offered.' };
      let postcode: string | null = null;
      let address: string | null = null;
      if (type === 'delivery') {
        const pc = postcodeOf(args.postcode);
        if (!pc) return { ok: false, message: 'Need a valid UK postcode for delivery.' };
        if (!o.delivery!.districts.includes(pc.district)) {
          return { ok: false, message: `Sorry, ${pc.district} is outside the delivery area (${o.delivery!.districts.join(', ')}). Collection is available.` };
        }
        address = str(args.address) ?? null;
        if (!address) return { ok: false, message: 'Need the first line of the address.' };
        postcode = pc.full;
      }
      const earliest = earliestDue(ctx, type);
      const t = str(args.time);
      const requested = t && !/asap|soon|now/i.test(t) ? normaliseTime(t) ?? t : 'asap';
      const prev = ctx.state.fulfilment;
      // The same answer again keeps the time already given to the caller.
      let due = prev && requested === 'asap' && prev.requested === 'asap' && prev.type === type ? prev.due_at : earliest;
      if (t && !/asap|soon|now/i.test(t)) {
        const hhmm = normaliseTime(t);
        if (!hhmm) return { ok: false, message: 'Time must be HH:MM, or "asap".' };
        const today = toLocal(ctx.now(), p.timezone).date;
        due = zonedToUtc(today, hhmm, p.timezone);
        if (due.getTime() < earliest.getTime()) {
          const e = toLocal(earliest, p.timezone).time;
          return { ok: false, message: `The earliest ${type} time is ${spokenTime(e)}.` };
        }
      }
      // Collection slots: times on the kitchen's grid, and only slots with room.
      if (type === 'collection' && o.slot_minutes) {
        const step = o.slot_minutes * 60000;
        due = new Date(Math.ceil(due.getTime() / step) * step);
        if (o.slot_capacity) {
          const asked = due;
          const free: Date[] = [];
          for (let i = 0, at = due; i < 24 && free.length < 3; i++, at = new Date(at.getTime() + step)) {
            if (!withinOrderingHours(ctx, at)) continue;
            if ((await ctx.repo.ordersDueBetween(ctx.tenant.id, at, new Date(at.getTime() + step))) < o.slot_capacity) free.push(at);
          }
          if (!free.length) return { ok: false, message: 'The kitchen is full for collection for the rest of today.' };
          if (free[0].getTime() !== asked.getTime()) {
            const spoken = free.map((d) => spokenTime(toLocal(d, p.timezone).time));
            if (requested !== 'asap') {
              return { ok: false, message: `The kitchen is full at ${spokenTime(toLocal(asked, p.timezone).time)}. ${spoken.join(', ')} ${spoken.length > 1 ? 'have' : 'has'} room.`, slots_with_room: spoken };
            }
            due = free[0];
          }
        }
      }
      if (!withinOrderingHours(ctx, due)) {
        const today = weekdayOf(toLocal(ctx.now(), p.timezone).date);
        const hours = o.hours.filter((h) => h.days.includes(today)).map((h) => `${spokenTime(h.open)} to ${spokenTime(h.close)}`);
        return { ok: false, message: `Orders are only taken for ${hours.length ? hours.join(' and ') : 'other days'} today.` };
      }
      ctx.state.fulfilment = { type, requested, due_at: due, postcode, address };
      changed(ctx);
      const local = toLocal(due, p.timezone);
      return {
        ok: true, type, time: local.time, spoken_time: spokenTime(local.time),
        address: address ? `${address}, ${postcode}` : undefined,
        delivery_fee: type === 'delivery' ? pounds(o.delivery!.fee_pence) : undefined,
      };
    },
  },

  get_wait_times: {
    when: (t) => capabilities(t.profile).ordering && Boolean(t.profile.ordering?.kitchen),
    decl: {
      name: 'get_wait_times',
      description: "How long collection and delivery take right now, from the kitchen's queue, and last orders; with a postcode, whether we deliver there and its fee and minimum. Use before saying any wait.",
      parameters: obj({ postcode: S('Delivery postcode, or just its first half, if they gave one') }),
    },
    handler: waitTimes,
  },

  find_order: {
    when: (t) => capabilities(t.profile).ordering && Boolean(t.profile.ordering?.kitchen),
    decl: {
      name: 'find_order',
      description: "Today's order, by its number or with none the number they're ringing from: where it is, and what they need after ordering. Never for a new order.",
      parameters: obj({
        order_number: S('The order number, if they have it (never a phone number)'),
        action: S('find (default), add_allergy, request_cancel, request_change or report_problem'),
        problem: S('report_problem: missing, wrong, cold, late, something_in_food or ill'),
        details: S('The allergy, the change, or what is wrong, in their words'),
      }),
    },
    handler: findOrder,
  },

  review_order: {
    when: (t) => capabilities(t.profile).ordering,
    decl: {
      name: 'review_order',
      description: 'The order and total, to read back word for word before confirm_order.',
      parameters: obj({}),
    },
    async handler(_args, ctx) {
      const o = ctx.tenant.profile.ordering!;
      if (!ctx.state.lines.length) return { ok: false, message: 'The order is empty.' };
      const refused = await impliedCollection(ctx);
      if (refused) return refused;
      if (!ctx.state.fulfilment) return { ok: false, message: NO_FULFILMENT };
      // A takeaway's: a dish the caller named that never reached the order, checked once before the read-back.
      const missing = o.kitchen && !ctx.state.gateAsked.includes('heard_items') ? heardNotOrdered(ctx) : [];
      if (missing.length) {
        ctx.state.gateAsked.push('heard_items');
        return {
          ok: false, not_on_order: missing,
          message: `Not read back yet: the caller mentioned ${missing.join(' and ')}, which ${missing.length > 1 ? "aren't" : "isn't"} on the order. If they asked for ${missing.length > 1 ? 'them' : 'it'}, add ${missing.length > 1 ? 'them' : 'it'} with add_to_order now (asking only what you must); if they only asked about ${missing.length > 1 ? 'them' : 'it'}, call review_order again.`,
        };
      }
      const b = basketSummary(ctx);
      const f = ctx.state.fulfilment;
      // A takeaway's postcode has its own fee and minimum, and delivery can be free over an amount (core/kitchen.ts).
      const min = f.min_order_pence ?? o.delivery?.min_order_pence ?? 0;
      const fee = f.type === 'delivery' ? feeFor(o, f.fee_pence ?? o.delivery!.fee_pence, b.subtotal_pence) : 0;
      if (f.type === 'delivery' && b.subtotal_pence < min) {
        return { ok: false, message: `Delivery needs a minimum order of ${pounds(min)}; it is ${b.subtotal} so far.`, ...(o.kitchen ? { short_by: pounds(min - b.subtotal_pence) } : {}) };
      }
      ctx.state.reviewedKey = basketKey(ctx.state);
      const local = toLocal(f.due_at, ctx.tenant.profile.timezone);
      const when = `${f.type} at ${spokenTime(local.time)}${f.address ? ` to ${f.address}, ${f.postcode}` : ''}`;
      const total = b.subtotal_pence + fee;
      const free = f.type === 'delivery' && !fee && Boolean(o.delivery?.free_over_pence);
      return {
        ok: true,
        read_back: `${ctx.state.lines.map(spokenLine).join(', ')}. ${fee ? `Delivery ${pounds(fee)}. ` : free ? 'Delivery is free. ' : ''}That's ${pounds(total)} altogether, for ${when}.`,
        item_count: ctx.state.lines.reduce((n, l) => n + l.quantity, 0),
        lines: b.lines,
        subtotal: b.subtotal,
        delivery_fee: fee ? pounds(fee) : undefined,
        total: pounds(total),
        fulfilment: when,
        payment: paymentRule(o.payment ?? 'either', f.type),
        next: o.kitchen ? readBackNext(ctx, f.type) : 'Read this back and ask if it is all correct. Then ask for the name (and number if unknown), and any allergies, before confirm_order.',
      };
    },
  },

  confirm_order: {
    when: (t) => capabilities(t.profile).ordering,
    decl: {
      name: 'confirm_order',
      description: 'Place the order, after review_order was read back and the caller said yes. The only way an order exists.',
      parameters: obj(
        { name: S("Caller's name"), phone: S('Only if not the calling number'), allergy_notes: S('Allergy the kitchen must know') },
        ['name'],
      ),
    },
    // A takeaway whose drivers take payment: how they'll pay, and the change needed for cash.
    tailor: (d, t) => {
      const pay = t.profile.ordering?.pay_driver;
      if (!t.profile.ordering?.kitchen || !pay || pay === 'no') return d;
      const p = { ...(d.parameters as { properties: Record<string, unknown> }).properties };
      p.pay_driver = S(`For a delivery: "phone" if paying now by card, or the driver: ${pay === 'cash' ? '"cash"' : '"cash" or "card"'}`);
      p.change_from = S('Paying the driver in cash: the note they will pay with, e.g. "£20"');
      return { ...d, parameters: { ...(d.parameters as object), properties: p } };
    },
    async handler(args, ctx) {
      const o = ctx.tenant.profile.ordering!;
      if (!ctx.state.lines.length) return { placed: false, message: 'Nothing to place yet: the order is empty.' };
      const refused = await impliedCollection(ctx);
      if (refused) return { placed: false, ...refused };
      if (!ctx.state.fulfilment) return { placed: false, message: `Not placed yet. ${NO_FULFILMENT} Then review_order, read it back, and on yes call confirm_order again.` };
      if (ctx.state.reviewedKey !== basketKey(ctx.state)) {
        // Hand back the new read-back directly, so there is no loop: read it,
        // hear yes, confirm. Whether it was ever read back is decided before
        // review_order marks it read: live on 8 October, a caller who had heard
        // nothing was told the order had "changed slightly".
        const never = ctx.state.reviewedKey === null;
        const again = await TOOLS.review_order.handler({}, ctx);
        if (!again.ok) return { placed: false, ...again };
        return {
          placed: false,
          // "Different" when nothing had been read back had the receptionist tell the caller the order had changed, then say it was placed.
          message: `Not placed yet: ${never ? 'the caller has not heard the order read back' : 'the order has changed since it was read back'}. Read this back word for word, ask if it is right, and on yes call confirm_order again. Until it returns an order number, do not say the order is placed.`,
          read_back: again.read_back,
        };
      }
      const name = str(args.name);
      if (!name) return { placed: false, message: 'Need a name for the order.' };
      const nudge = allergyCheck(ctx, str(args.allergy_notes), 'confirm_order', 'allergy_notes');
      if (nudge) return { placed: false, ...nudge };
      const phone = normaliseUkPhone(str(args.phone)) ?? ctx.callerPhone;
      if (!phone && ctx.channel === 'phone') return { placed: false, message: 'Need a contact number.' };
      const f = ctx.state.fulfilment;
      // A takeaway's delivery paid at the door: how, and for cash the change the driver needs (presets/takeaway.md §4.3). Asked once.
      let payNote: string | null = null;
      const subtotal = ctx.state.lines.reduce((s, l) => s + lineTotal(l), 0);
      const fee = f.type === 'delivery' ? feeFor(o, f.fee_pence ?? o.delivery!.fee_pence, subtotal) : 0;
      // A number on the pay-on-the-phone list (it refused a delivery): card on the phone now, never the driver.
      const phoneOnly = Boolean(o.kitchen && f.type === 'delivery' && [phone, ctx.callerPhone].some((n) => n && o.pay_on_phone?.includes(n)));
      if (phoneOnly) payNote = 'Pay on the phone only';
      else if (o.kitchen && f.type === 'delivery' && o.pay_driver && o.pay_driver !== 'no') {
        const how = str(args.pay_driver)?.toLowerCase() ?? '';
        if (!how && !ctx.state.gateAsked.includes('pay_driver')) {
          ctx.state.gateAsked.push('pay_driver');
          return { placed: false, message: `Before placing it, ask how they'll pay: now by card on the phone, or the driver ${o.pay_driver === 'cash' ? 'in cash' : 'in cash or by card'}. For cash, ask "Do you need change from anything?". Then call confirm_order again with pay_driver and change_from.` };
        }
        if (/cash/.test(how)) {
          // The note they'll hand over: whole pounds in fives that cover the total. Live, 8 October: never asked, the
          // total itself went in as the note, and the driver's ticket read "change from £32".
          const said = str(args.change_from) ?? '';
          const word = /\b(five|ten|twenty|forty|fifty)\b/i.exec(said)?.[1].toLowerCase();
          const n = /\d/.test(said) ? Number(said.replace(/[^\d.]/g, '')) : word ? NOTES[word] : 0;
          const none = /\b(?:no|none|exact|not needed|n\/?a)\b/i.test(said);
          const note = !none && Number.isInteger(n) && n > 0 && n % 5 === 0 && n * 100 >= subtotal + fee ? n : null;
          // A note given that can't be right is checked once, even after the read-back asked.
          if (note === null && !none && n > 0 && !ctx.state.gateAsked.includes('change_checked')) {
            ctx.state.gateAsked.push('change_checked');
            return {
              placed: false,
              message: n * 100 < subtotal + fee
                ? `£${n} won't cover the ${pounds(subtotal + fee)} total: check what they'll pay the driver with, then call confirm_order again with change_from.`
                : `£${n} isn't a note they'd hand over: check what they'll pay the driver with, for ${pounds(subtotal + fee)}, then call confirm_order again with change_from, or "none".`,
            };
          }
          if (note === null && !none && !ctx.state.gateAsked.includes('change_from')) {
            ctx.state.gateAsked.push('change_from');
            return { placed: false, message: `Ask "Do you need change from anything?": the note they'll pay the driver with, for ${pounds(subtotal + fee)}. Then call confirm_order again with change_from, or "none".` };
          }
          payNote = note ? `Cash: change from £${note}` : 'Cash: no change needed';
        } else if (/card/.test(how) && !/phone|now/.test(how) && o.pay_driver === 'cash_or_card') payNote = 'Card at the door';
      }
      const order = await ctx.repo.createOrder(ctx.tenant, {
        name, phone, fulfilment: f.type, due_at: f.due_at, address: f.address, postcode: f.postcode,
        lines: ctx.state.lines, subtotal_pence: subtotal, delivery_fee_pence: fee, total_pence: subtotal + fee,
        allergy_notes: namedAllergy(noneToNull(str(args.allergy_notes)), ctx.state.heard) ?? null, source: ctx.channel === 'phone' ? 'phone' : ctx.channel, call_id: ctx.callId,
        ...(payNote ? { pay_note: payNote } : {}),
        ...(isBig(ctx) ? { flags: ['big'] } : {}),
      });
      record(ctx, order.reference, 'order', 'committed');
      ctx.state.lines = [];
      ctx.state.fulfilment = null;
      changed(ctx);
      const local = toLocal(order.due_at, ctx.tenant.profile.timezone);
      ctx.action({
        kind: 'order_placed',
        title: `Order ${order.reference} · ${pounds(order.total_pence)}`,
        detail: `${order.fulfilment} ${spokenTime(local.time)} · ${order.name}${order.allergy_notes ? ` · ALLERGY: ${order.allergy_notes}` : ''}`,
        data: { reference: order.reference },
      });
      const rule = o.payment ?? 'either';
      const payLine = phoneOnly ? '' : payNote ? ` Paying the driver: ${payNote.replace(/^Cash: /, 'cash, ').toLowerCase()}.` : rule === 'collection' ? (order.fulfilment === 'delivery' ? ' Pay on delivery.' : ' Pay when you collect.') : '';
      await smsTo(ctx, phone, `${ctx.tenant.profile.name}: order ${order.reference}, ${pounds(order.total_pence)}, ${order.fulfilment} at ${spokenTime(local.time)}.${payLine} Quote ${order.reference} if you call us. (Demo order)`);
      return {
        placed: true,
        order_number: order.reference,
        spoken_order_number: order.reference.split('').join(' '),
        total: pounds(order.total_pence),
        ready: `${order.fulfilment} at ${spokenTime(local.time)}`,
        payment: phoneOnly ? PHONE_ONLY
          : payNote ? `They're paying the driver (${payNote.toLowerCase()}): don't take a card on the phone.` : paymentRule(rule, order.fulfilment),
      };
    },
  },

  take_demo_payment: {
    when: (t) => capabilities(t.profile).payments || Boolean(t.profile.maintenance),
    tailor: maintenancePaymentParams,
    decl: {
      name: 'take_demo_payment',
      description: 'DEMO card payment for the order or a deposit. Say the demo card first; only demo cards work.',
      parameters: obj(
        {
          for: S('order or deposit'),
          reference: S('Defaults to this call'),
          card_number: S('As the caller read it'),
          expiry: S('MM/YY'),
          security_code: S('3 digits'),
        },
        ['card_number'],
      ),
    },
    async handler(args, ctx) {
      if (ctx.tenant.profile.maintenance) return maintenancePayment(args, ctx);
      const kind = str(args.for)?.toLowerCase().startsWith('dep') ? 'deposit' : ctx.state.lastOrderRef || !ctx.state.lastBookingRef ? 'order' : 'deposit';
      let amount = 0;
      let orderId: string | null = null;
      let bookingId: string | null = null;
      let target = '';
      if (kind === 'order' && ctx.tenant.profile.ordering?.payment === 'collection') {
        return { result: 'not_needed', message: 'This restaurant takes payment on collection. No card is needed on the phone: tell them to pay when they collect.' };
      }
      if (kind === 'order') {
        // Read from the database: the call holds only the reference, and the order may have been paid since.
        const ref = str(args.reference) ?? ctx.state.lastOrderRef;
        const order = ref ? await ctx.repo.getOrder(ctx.tenant.id, ref) : null;
        if (!order) return { result: 'no_order', message: 'Place the order with confirm_order before taking payment.' };
        if (order.payment_status === 'paid') return { result: 'already_paid', message: 'That order is already paid.' };
        amount = order.total_pence;
        orderId = order.id;
        target = `order ${order.reference}`;
      } else {
        const ref = str(args.reference) ?? ctx.state.lastBookingRef;
        const b = ref ? await ctx.repo.getBookingByReference(ctx.tenant.id, ref) : null;
        if (!b) return { result: 'no_booking', message: 'No booking to take a deposit for.' };
        if (!b.deposit_pence) return { result: 'no_deposit_due', message: 'That booking does not need a deposit.' };
        if (b.deposit_paid) return { result: 'already_paid', message: 'The deposit is already paid.' };
        amount = b.deposit_pence;
        bookingId = b.id;
        target = `deposit for ${b.reference}`;
      }
      const outcome = processDemoPayment(args.card_number, ctx.demoCards);
      if (outcome.result === 'refused') return { result: 'refused', message: outcome.message };
      // A realistic pause, as a real card terminal would take.
      await new Promise((r) => setTimeout(r, ctx.channel === 'eval' ? 50 : 900));
      await ctx.repo.recordPayment({
        tenant_id: ctx.tenant.id, order_id: orderId, booking_id: bookingId, amount_pence: amount, card_last4: outcome.last4,
        auth_code: outcome.result === 'approved' ? outcome.auth_code : null, result: outcome.result, call_id: ctx.callId,
      });
      if (outcome.result === 'declined') {
        ctx.action({ kind: 'payment', title: `Declined (demo) · ${pounds(amount)}`, detail: `${target} · card ending ${outcome.last4}` });
        return { result: 'declined', amount: pounds(amount), message: 'Declined. Ask if they would like to try again with the demo card.' };
      }
      if (orderId) await ctx.repo.markOrderPaid(orderId);
      if (bookingId) await ctx.repo.markDepositPaid(bookingId);
      ctx.state.paid.push(target);
      ctx.action({ kind: 'payment', title: `Paid (demo) · ${pounds(amount)}`, detail: `${target} · card ending ${outcome.last4} · ${outcome.auth_code}` });
      await smsTo(ctx, ctx.callerPhone, `${ctx.tenant.profile.name}: ${pounds(amount)} received for ${target}. DEMO: no money has been taken.`);
      return { result: 'approved', amount: pounds(amount), for: target, card_ending: outcome.last4, auth_code: outcome.auth_code };
    },
  },

  ...ESTATE_TOOLS,
  ...MAINTENANCE_TOOLS,

  take_message: {
    decl: {
      name: 'take_message',
      description: 'A message for the team, with a name and call-back number.',
      parameters: obj({ name: S("Caller's name"), phone: S('Call-back number'), message: S('One or two sentences') }, ['name', 'message']),
    },
    tailor: (d, t) => maintenanceParams(estateParams(d, t, 'message'), t, 'message'),
    async handler(args, ctx) {
      const estate = (await estateMessage(args, ctx)) ?? (await maintenanceMessage(args, ctx));
      if (estate) return estate;
      const phone = normaliseUkPhone(str(args.phone)) ?? ctx.callerPhone;
      const body = str(args.message) ?? '';
      const name = str(args.name) ?? 'Unknown';
      await ctx.repo.addMessage({ tenant_id: ctx.tenant.id, call_id: ctx.callId, kind: 'message', from_name: name, from_phone: phone, body, status: 'new' });
      ctx.state.messageTaken = true;
      ctx.action({ kind: 'message_taken', title: `Message from ${name}`, detail: `${body}${phone ? ` · ${displayUkPhone(phone)}` : ''}` });
      const owner = ctx.tenant.profile.owner_sms_number;
      if (owner) await smsTo(ctx, owner, `Message from ${name} (${displayUkPhone(phone)}): ${body}`);
      return { taken: true, note: 'Tell them the team will call back.' };
    },
  },

  transfer_to_staff: {
    when: (t, o) => o.canTransfer && Boolean(t.profile.handoff_number),
    decl: {
      name: 'transfer_to_staff',
      description: 'Put the caller through to a member of the team.',
      parameters: obj({ reason: S('A one-line summary for the staff member') }, ['reason']),
    },
    async handler(args, ctx) {
      const to = ctx.tenant.profile.handoff_number;
      if (!to || !ctx.telephony) {
        return { transferred: false, message: 'Nobody can take the call right now. Offer to take a message instead.' };
      }
      ctx.state.transferRequested = true;
      ctx.action({ kind: 'transfer', title: 'Transferring to staff', detail: str(args.reason) });
      const ok = await ctx.telephony.transfer(to, str(args.reason) ?? 'A caller');
      return ok ? { transferred: true, note: 'Say you are putting them through now.' } : { transferred: false, message: 'Transfer failed. Offer to take a message.' };
    },
  },

  end_call: {
    decl: {
      name: 'end_call',
      description: 'Hang up, after saying goodbye.',
      parameters: obj({ outcome: S('booked, ordered, answered, message or other') }),
    },
    async handler(args, ctx) {
      // In a live test the receptionist said "I'll pass those details on" and hung up with no message taken: nobody would have called back.
      // A safety call ends fast: the caller must hang up and ring the emergency line (presets/property-maintenance.md §4.2).
      if (/message/i.test(str(args.outcome) ?? '') && !ctx.state.messageTaken && !ctx.state.messageChecked && !ctx.state.safetyDone.length && !ctx.state.safety) {
        ctx.state.messageChecked = true;
        return { ok: false, message: 'No message has been taken, so nobody would call them back. Take it now with take_message, using what they have already told you (name, number, what they want), without asking anything more. Then say goodbye and use end_call.' };
      }
      // A live estate call on 8 October: the reminder after "I'll pass that request on to Jess" went unheeded, and the
      // call ended "answered" with the promise still owed. Whatever the outcome says, the caller is waiting for that call.
      if (ctx.state.messageOwed && !ctx.state.messageTaken && !ctx.state.safetyDone.length && !ctx.state.safety) {
        ctx.state.messageOwed = false;
        return { ok: false, message: 'You promised to pass a message on, and none has been taken: nobody would get back to them. Take it now with take_message, using what they have already told you (name, number, what they want), without asking anything more. Then tell them it has been passed on, say goodbye and use end_call.' };
      }
      // An estate agency's call on 3 October ended "booked" after book_valuation had said "not done": nothing was in the diary.
      if (ctx.state.estate && /book/i.test(str(args.outcome) ?? '') && ctx.state.committed.length === 0 && !ctx.state.bookedChecked) {
        ctx.state.bookedChecked = true;
        return { ok: false, message: "Nothing has been booked in this call: no booking tool returned a reference. If they want it, call the tool now with what they've told you and give them the reference; if not, tell them it isn't booked. Then end_call." };
      }
      ctx.state.ending = true;
      ctx.action({ kind: 'call_ending', title: 'Call ending', detail: str(args.outcome) });
      return { ok: true };
    },
  },
};

export function toolDeclarations(t: Tenant, o: ToolOptions = { canTransfer: false }): FunctionDeclaration[] {
  return Object.values(TOOLS)
    .filter((x) => !x.when || x.when(t, o))
    .map((x) => (x.tailor ? x.tailor(x.decl, t) : x.decl));
}

export async function runTool(name: string, args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const tool = TOOLS[name];
  if (!tool || (tool.when && !tool.when(ctx.tenant, { canTransfer: Boolean(ctx.telephony) }))) return { error: `No tool called ${name}.` };
  // A severe allergic reaction: 999 comes before any tool (core/reaction.ts).
  if (ctx.state.reaction && !ctx.state.reaction.spoken && name !== 'end_call') return reactionFirst();
  try {
    const result = await tool.handler(args ?? {}, ctx);
    const json = JSON.stringify(result);
    ctx.state.references.push(...referencesIn(json));
    // A price a tool gave may be said; one nothing gave may not (a repairs call's invented_price).
    if (ctx.state.maintenance || ctx.state.takeaway) ctx.state.amounts.push(...amountsIn(json));
    // So too a time (an estate agency's and a takeaway's invented_time).
    if (ctx.state.estate || ctx.state.takeaway) {
      ctx.state.times.push(...knownTimes(json));
      ctx.state.timeRanges.push(...rangesIn(json));
    }
    return result;
  } catch (err) {
    return { error: 'That did not work. Apologise briefly and offer to take a message.', detail: (err as Error).message };
  }
}

/** Card numbers never reach the logs: only the last four of anything passed as a card. */
export function loggableArgs(name: string, args: Args): Args {
  if (name !== 'take_demo_payment') return args;
  const digits = String(args.card_number ?? '').replace(/\D/g, '');
  return { ...args, card_number: digits ? `…${digits.slice(-4)}` : undefined, security_code: args.security_code ? '•••' : undefined };
}

