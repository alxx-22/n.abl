// The estate agent's receptionist (presets/estate-agent.md §4.3): finding
// homes, saying what is true of them, viewings under each home's own
// rules, valuations, and offers passed on in writing.
//
// Everything here is switched on by profile fields only the estate agent's
// compile writes (listings, team, estate); every other business never
// reaches it. The tools hold nothing that must not be said: no seller's
// details, no word that a home is empty, no other buyer's offer, and no
// figure for anyone's home. What the receptionist must say first is built
// in code, and a viewing or an offer waits until it has been said.

import type { FunctionDeclaration } from './live.ts';
import type { Args, Tool, ToolContext } from './tools.ts';
import { BANK_TALK } from './guardrails.ts';
import { ASK_NAME, B, I, S, bool, int, obj, postcodeOf, realName, record, smsTo, str, strList } from './tool-kit.ts';
import { newBookingReference, spokenReference } from '../db/repo.ts';
import { candidateTimes, checkAvailability, checkSlot, durationFor, findService, type AvailabilityResult, type SlotRequest } from '../domain/availability.ts';
import {
  STATUS_WORDS, UNSAYABLE, addWorkingDays, clause, districtsIn, facts, findListings, firstViewingDate, homeKind, initialLive, insideRule, describeLine, matches,
  offerReceivedText, poundsWhole, priceWords, requirementsIn, requirementsWords, sayFirst, shortAddress, similar, positionBadges, unsaid, viewingRules, viewingText,
  type ListingLive, type Requirements,
} from '../domain/listings.ts';
import { displayUkPhone, normaliseUkPhone } from '../domain/phone.ts';
import { addDays, dayName, isIsoDate, minutesOf, spokenDate, spokenTime, toLocal, weekdayOf } from '../domain/time.ts';
import type { BookableService, Booking, BuyerDetails, BuyerPosition, Funding, Listing, Selling, StaffMember, Tenant } from '../domain/types.ts';

const DAY = 86400000;

/** A home and how it stands now: the profile's facts with its live row (voice_listings). */
interface Home {
  listing: Listing;
  live: ListingLive;
}

const teamOf = (t: Tenant): StaffMember[] => t.profile.team ?? [];

/** Callers hear first names only. */
export function firstNameOf(t: Tenant, key: string | null | undefined): string {
  return teamOf(t).find((m) => m.key === key)?.first_name ?? t.profile.booking?.resources.find((r) => r.key === key)?.label.split(' ')[0] ?? '';
}

const today = (ctx: ToolContext) => toLocal(ctx.now(), ctx.tenant.profile.timezone).date;
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const source = (ctx: ToolContext) => (ctx.channel === 'phone' ? 'phone' : ctx.channel);

async function homesOf(ctx: ToolContext): Promise<Home[]> {
  const rows = new Map((await ctx.repo.listingStates(ctx.tenant.id)).map((r) => [r.listing_key, r]));
  return (ctx.tenant.profile.listings ?? []).map((l) => ({ listing: l, live: rows.get(l.key) ?? initialLive(l, ctx.now()) }));
}

const findable = (hs: Home[]) => hs.map((h) => ({ listing: h.listing, price_pence: h.live.price_pence, status: h.live.status }));
const byKey = (hs: Home[], key: string) => hs.find((h) => h.listing.key === key)!;

/** When the demo began: Start writes each home's market date that many days back, and a coming-soon home's first viewings count from it. */
function startOf(h: Home, now: Date): Date {
  const back = h.listing.initial.status === 'coming_soon' ? 0 : h.listing.marketed_days_ago;
  return new Date(Math.min(h.live.marketed_at.getTime() + back * DAY, now.getTime()));
}

const priceOf = (h: Home) => priceWords(h.live.price_pence, h.live.qualifier, h.listing.lease?.shared?.share_percent);

/**
 * A home in one line, as a list of matches gives it: never its seller, whether anyone lives there, or keys; nor a price staff are checking.
 * A home the caller named comes without its price, so the receptionist opens with get_property's describe line: on 4 October it read the
 * price from the search and never said the council tax band or the EPC.
 */
const brief = (h: Home, priced = true) => {
  const checked = h.live.checking.includes('price');
  return { property: h.listing.key, says: `${shortAddress(h.listing)}: ${homeKind(h.listing)}`, price: checked || !priced ? undefined : priceOf(h), being_checked: checked && priced ? ['the price'] : undefined, status: STATUS_WORDS[h.live.status] };
};

/** An accepted offer the tools reported is news the receptionist may pass on; one it made up is not (guardrails). */
function noteSeen(ctx: ToolContext, hs: Home[]): void {
  for (const h of hs) if (h.live.status === 'sale_agreed' && !ctx.state.seen.accepted.includes(h.listing.key)) ctx.state.seen.accepted.push(h.listing.key);
}

/** The home a tool was asked about: by its key or reference, or by what the caller said. Two that fit as well: ask which. */
async function resolveHome(ctx: ToolContext, words: unknown): Promise<{ home: Home; all: Home[] } | { reply: Record<string, unknown> }> {
  const all = await homesOf(ctx);
  const w = str(words);
  if (!w) return { reply: { message: 'Which home? Ask the caller, then find it with search_properties.' } };
  const exact = all.find((h) => h.listing.key === w || h.listing.ref.toLowerCase() === w.toLowerCase());
  if (exact) return { home: exact, all };
  const found = findListings(findable(all), w);
  if (found.length === 1) return { home: byKey(all, found[0].key), all };
  if (found.length > 1) return { reply: { more_than_one: found.slice(0, 3).map((l) => brief(byKey(all, l.key), false)), next: 'More than one: ask which.' } };
  return { reply: { message: 'None of our homes matches that. Check the street and number with the caller, or use search_properties.' } };
}

/** Homes that can't be viewed as asked: sold, withdrawn, viewings stopped after a sale was agreed, or coming soon before its first day. */
function stopFor(ctx: ToolContext, h: Home, all: Home[], date?: string): Record<string, unknown> | null {
  const s = h.live.status;
  const instead = () => similar(h.listing, findable(all)).map((l) => brief(byKey(all, l.key)));
  if (s === 'withdrawn' || s === 'exchanged' || s === 'completed') {
    return { message: s === 'withdrawn' ? "It's no longer on the market." : "It's sold.", similar: instead(), next: 'Say so, and offer these instead.' };
  }
  if (s === 'sale_agreed' && !h.live.marketing_continues) {
    return {
      message: "An offer has been accepted on it, subject to contract, and the seller isn't taking more viewings.",
      similar: instead(),
      next: 'Say so. Offer to take their details in a message, so the team can call if it comes back on the market, and offer these.',
    };
  }
  if (s === 'coming_soon' && h.listing.viewings_from_days !== null) {
    const first = firstViewingDate(h.listing, startOf(h, ctx.now()), ctx.tenant.profile.timezone);
    if (!date || date < first) return { message: `It's coming soon: first viewings from ${spokenDate(first)}.`, first_date: first, next: 'Offer times from then.' };
  }
  return null;
}

/**
 * The disclosure gate (§4.4). Deciding to view is a decision a buyer makes
 * on what they have been told, so a viewing (or an offer) waits until the
 * receptionist has said each line it must say first about the home, since
 * it was briefed on it in this call. It stops once per home, never in a
 * loop: the second time it goes ahead, and the call is flagged.
 *
 * A home asked about before get_property is briefed here and now, with
 * the lines in the answer. In a live test, refusing with "use get_property
 * first" had the receptionist tell the caller the time was taken, and
 * describe the home in words no tool gave it.
 */
function gate(ctx: ToolContext, h: Home, kind: 'viewing' | 'offer'): Record<string, unknown> | null {
  const s = ctx.state;
  const l = h.listing;
  if (!(l.key in s.briefed)) s.briefed[l.key] = s.said.length;
  const at = s.briefed[l.key];
  const items = kind === 'offer' ? l.before_offer : sayFirst(l, h.live, today(ctx), startOf(h, ctx.now()), ctx.tenant.profile.timezone);
  const missing = unsaid(items, s.said.slice(at));
  if (!missing.length) return null;
  const key = kind === 'offer' ? `offer:${l.key}` : l.key;
  if (!s.gateAsked.includes(key)) {
    s.gateAsked.push(key);
    return {
      not_yet: `Not ${kind === 'offer' ? 'recorded' : 'checked'} yet. Before ${kind === 'offer' ? 'taking the offer' : 'any times'}, tell the caller: ${missing.map((i) => `"${i.say}"`).join(' ')} Then call this again. Add nothing about the home that a tool didn't give you.`,
    };
  }
  if (!s.gateAsked.includes(`missed:${key}`)) {
    s.gateAsked.push(`missed:${key}`);
    // Re-checked once the turn's words are in: a tool call can arrive before the transcript of the line said just before it.
    s.toolFlags.push({ rule: 'disclosure_missed', text: `${shortAddress(l)}: ${missing.map((i) => i.say).join(' ')}`, recheck: { items: missing, at } });
  }
  return null;
}

/** The member of the team a caller asked for by name, if any. */
function staffNamed(t: Tenant, words: string | undefined): StaffMember | undefined {
  const s = words?.trim().toLowerCase();
  return s ? teamOf(t).find((m) => s === m.key || s === m.first_name.toLowerCase() || m.name.toLowerCase().startsWith(s)) : undefined;
}

/** A named member of the team on a day they don't work: say so, rather than "fully booked". */
function notWorking(ctx: ToolContext, staff: string | undefined, date: string): string | null {
  const who = staffNamed(ctx.tenant, staff);
  if (!who || !isIsoDate(date) || who.days.includes(weekdayOf(date))) return null;
  return `${who.first_name} doesn't work on ${dayName(weekdayOf(date))}s. Offer another day, or someone else.`;
}

/** A member of the team with a personal interest in a home never shows it; the caller hears only who can. */
function excludedStaff(ctx: ToolContext, h: Home, staff: string | undefined): string | null {
  const pi = h.listing.personal_interest;
  if (!staff || !pi) return null;
  const who = staffNamed(ctx.tenant, staff);
  if (!who || who.key !== pi.staff) return null;
  const instead = [h.listing.negotiator, ...teamOf(ctx.tenant).filter((m) => m.does.includes('viewings')).map((m) => m.key)].find((k) => k !== who.key);
  return `${who.first_name} can't show this home; offer ${firstNameOf(ctx.tenant, instead) || 'another member of the team'}.`;
}

/** An availability answer with first names: who would meet the caller at the time asked, and at each alternative. */
function withNames(ctx: ToolContext, r: AvailabilityResult, req: SlotRequest, service: BookableService): Record<string, unknown> {
  const out: Record<string, unknown> = { ...r, service: service.label };
  if (r.slot) {
    out.with = firstNameOf(ctx.tenant, r.slot.resource_key);
    const { resource_key: _, ...slot } = r.slot;
    out.slot = { ...slot, resource_label: out.with };
  }
  if (r.alternatives.length) {
    out.alternatives = r.alternatives.map((a) => {
      const s = checkSlot(req, service, a.time);
      return { ...a, with: s ? firstNameOf(ctx.tenant, s.resource_key) : undefined };
    });
  }
  return out;
}

/** "nothing", "not on the market yet", "under offer": what a buyer has to sell first. */
export function sellingOf(v: unknown): Selling | undefined {
  const s = str(v)?.toLowerCase().replace(/_/g, ' ');
  if (!s) return undefined;
  if (/\bnot (yet )?(on|listed|marketed|put)|haven'?t (put|listed|marketed)|isn'?t on/.test(s)) return 'not_on_market';
  if (/under offer|sold subject|\bsstc\b|sale agreed|accepted/.test(s)) return 'under_offer';
  if (/on (the )?market|\blisted\b|marketed|for sale/.test(s)) return 'on_market';
  if (/nothing|^no(ne)?\b|renting|first[- ]time|living with|don'?t own/.test(s)) return 'nothing';
  return undefined;
}

/** "agreed in principle", "cash", "not sorted yet": how a buyer is paying. */
export function fundingOf(v: unknown): Funding | undefined {
  const s = str(v)?.toLowerCase().replace(/_/g, ' ');
  if (!s) return undefined;
  if (/in principle|\baip\b|\bdip\b|mortgage (is |has been )?(agreed|approved|offer)/.test(s)) return 'mortgage_aip';
  if (/cash|outright|no mortgage|without a mortgage/.test(s)) return 'cash';
  if (/mortgage|not yet|need/.test(s)) return 'mortgage_not_yet';
  return undefined;
}

/** A buyer's position from the tool's arguments. A first-time buyer has nothing to sell. */
function positionOf(args: Args): BuyerPosition {
  const ftb = bool(args.first_time_buyer);
  const selling = sellingOf(args.selling) ?? (ftb ? 'nothing' : undefined);
  const aip = int(args.aip_amount);
  const p: BuyerPosition = { first_time_buyer: ftb, selling, funding: fundingOf(args.funding), aip_amount_pence: aip ? (aip < 10000 ? aip * 1000 : aip) * 100 : undefined };
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) as BuyerPosition;
}

/** "First-time buyers, mortgage agreed in principle." */
function positionWords(p: BuyerPosition, people: number): string {
  const parts = [
    p.first_time_buyer ? `first-time buyer${people > 1 ? 's' : ''}` : '',
    p.selling === 'not_on_market' ? 'a home to sell, not yet on the market' : p.selling === 'on_market' ? 'a home on the market' : p.selling === 'under_offer' ? 'their own sale under offer' : p.selling === 'nothing' && !p.first_time_buyer ? 'nothing to sell' : '',
    p.funding === 'mortgage_aip' ? `mortgage agreed in principle${p.aip_amount_pence ? ` for ${poundsWhole(p.aip_amount_pence)}` : ''}` : p.funding === 'mortgage_not_yet' ? 'mortgage not arranged yet' : p.funding === 'cash' ? 'cash' : '',
  ].filter(Boolean);
  return parts.length ? `${cap(parts.join(', '))}.` : '';
}

/** "Sam and Alex Price" for two people with one surname, else "Sam Price and Alex Jones". */
function namesWords(names: string[]): string {
  const last = names.map((n) => n.trim().split(/\s+/));
  if (names.length > 1 && last.every((p) => p.length > 1 && p.at(-1) === last[0].at(-1))) {
    const firsts = last.map((p) => p.slice(0, -1).join(' '));
    return `${firsts.slice(0, -1).join(', ')} and ${firsts.at(-1)} ${last[0].at(-1)}`;
  }
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0] ?? '';
}

/** Pounds as callers and the model say them: 320000, "£320,000", "320k", or 320 meaning thousands. */
function poundsOf(v: unknown): number | undefined {
  const s = typeof v === 'number' ? String(v) : str(v)?.toLowerCase().replace(/[£,\s]/g, '');
  if (!s) return undefined;
  const m = /^(\d+(?:\.\d+)?)(k|m)?$/.exec(s);
  if (!m) return undefined;
  const n = Number(m[1]) * (m[2] === 'k' ? 1000 : m[2] === 'm' ? 1_000_000 : 1);
  return Math.round(n < 10000 ? n * 1000 : n);
}

const noneToNull = (v: string | undefined) => (v && /^(none|no|nobody|n\/a|nothing|not)\.?$/i.test(v.trim()) ? undefined : v);

// ── Bookings in an estate agency's words ──────────────────────────────────

/** A booking as the caller hears it: the home, and who will meet them by first name. */
export function estateSummary(t: Tenant, b: Pick<Booking, 'reference' | 'starts_at' | 'name' | 'service_key' | 'resource_key' | 'party_size'> & Partial<Pick<Booking, 'listing_key' | 'details' | 'notes'>>) {
  const local = toLocal(b.starts_at, t.profile.timezone);
  const service = findService(t.profile, b.service_key);
  const l = t.profile.listings?.find((x) => x.key === b.listing_key);
  const address = l ? shortAddress(l) : typeof b.details?.address === 'string' ? b.details.address : undefined;
  return {
    reference: b.reference, spoken_reference: spokenReference(b.reference), service: service?.label ?? b.service_key,
    date: local.date, spoken_date: spokenDate(local.date), time: local.time, spoken_time: spokenTime(local.time), party_size: undefined as number | undefined, name: b.name,
    with: firstNameOf(t, b.resource_key), property: address, area: undefined, table: undefined, allergies: undefined, notes: b.notes ?? undefined,
  };
}

/** The text after a viewing or valuation is booked, changed or cancelled: the day, the home, who, and the reference. */
export function estateText(t: Tenant, b: Booking, change: 'booked' | 'changed' | 'cancelled'): string {
  const local = toLocal(b.starts_at, t.profile.timezone);
  const service = findService(t.profile, b.service_key);
  const l = t.profile.listings?.find((x) => x.key === b.listing_key);
  const valuation = service?.key === 'valuation';
  const address = l ? shortAddress(l) : typeof b.details?.address === 'string' ? b.details.address : t.profile.address;
  const extra = change === 'cancelled' ? '' : l?.personal_interest?.wording ?? (valuation ? t.profile.estate?.valuations.say ?? '' : '');
  return viewingText(t.profile.name, valuation ? 'valuation' : service?.label ?? 'appointment', change, local, address, firstNameOf(t, b.resource_key), b.reference, extra);
}

/** A move of a viewing keeps to its home's rules (windows, notice, blocked dates, who may not show it). */
export async function moveRule(ctx: ToolContext, reference: string) {
  const b = await ctx.repo.getBookingByReference(ctx.tenant.id, reference.replace(/[^a-z0-9]/gi, '').toUpperCase());
  const l = b?.listing_key ? ctx.tenant.profile.listings?.find((x) => x.key === b.listing_key) : undefined;
  if (!b || !l) return undefined;
  const live = (await ctx.repo.listingState(ctx.tenant.id, l.key)) ?? initialLive(l, ctx.now());
  return viewingRules(l, ctx.tenant.profile, b.service_key, live);
}

/** An estate agency's viewing and valuation hours for a day, next to the office's. */
export function estateHours(t: Tenant, date: string): Record<string, unknown> {
  const e = t.profile.estate;
  if (!e) return {};
  const wd = weekdayOf(date);
  const spans = (hs: typeof e.viewing_hours) => {
    const day = hs.filter((h) => h.days.includes(wd)).map((h) => `${spokenTime(h.open)} to ${spokenTime(h.close)}`);
    return day.length ? day : ['none'];
  };
  return { viewings: spans(e.viewing_hours), valuations: spans(e.valuation_hours) };
}

// ── The shared booking tools, for a viewing ───────────────────────────────

/**
 * check_availability at an estate agency. A viewing needs a home and keeps
 * to its rules, after the status rules and the disclosure gate; a
 * valuation's postcode must be one the agency covers. Null for any other
 * business, which takes the shared path.
 */
export async function estateAvailability(args: Args, ctx: ToolContext, service: BookableService): Promise<Record<string, unknown> | null> {
  const p = ctx.tenant.profile;
  if (!p.estate) return null;
  const date = str(args.date) ?? '';
  const staff = str(args.staff);
  const existing = async () => (isIsoDate(date) ? ctx.repo.busyForDate(ctx.tenant, date) : []);
  if (!service.needs_listing) {
    if (service.key === 'valuation' && str(args.postcode)) {
      const pc = postcodeOf(args.postcode);
      if (pc && !p.estate.districts.includes(pc.district)) return { available: false, message: "That's outside the area we cover: say so kindly. No booking." };
    }
    const off = notWorking(ctx, staff, date);
    if (off) return { available: false, message: off };
    const req: SlotRequest = { profile: p, serviceKey: service.key, date, time: str(args.time), partySize: 1, staff, now: ctx.now(), existing: await existing() };
    return withNames(ctx, checkAvailability(req), req, service);
  }
  const r = await resolveHome(ctx, args.property);
  if ('reply' in r) return { checked: false, ...r.reply };
  const { home: h, all } = r;
  noteSeen(ctx, [h]);
  const stop = stopFor(ctx, h, all, date);
  if (stop) return { available: false, ...stop };
  const held = gate(ctx, h, 'viewing');
  if (held) return { checked: false, ...held };
  const no = excludedStaff(ctx, h, staff) ?? notWorking(ctx, staff, date);
  if (no) return { available: false, message: no };
  const rule = viewingRules(h.listing, p, service.key, h.live);
  const req: SlotRequest = { profile: p, serviceKey: service.key, date, time: str(args.time), partySize: 1, staff, now: ctx.now(), existing: await existing(), listing: rule };
  const res = checkAvailability(req);
  const out = withNames(ctx, res, req, service);
  out.where = shortAddress(h.listing);
  if (isIsoDate(date) && !res.available) {
    const minutes = durationFor(service, 1);
    const times = candidateTimes(service, date);
    const t = res.requested_time;
    // A time the seller doesn't allow is not "taken": say when they do.
    if (times.length && times.every((x) => !insideRule(rule, date, minutesOf(x), minutesOf(x) + minutes))) {
      out.message = `No viewings at this home on ${spokenDate(date)}. ${h.listing.viewing.rule}`;
    } else if (t && !insideRule(rule, date, minutesOf(t), minutesOf(t) + minutes)) {
      out.message = `${spokenTime(t)} isn't a viewing time for this home. ${h.listing.viewing.rule}`;
    } else if (t && date === today(ctx) && minutesOf(t) < minutesOf(toLocal(ctx.now(), p.timezone).time) + rule.notice_minutes) {
      out.message = `That's too soon: viewings need ${Math.round(rule.notice_minutes / 60)} hours' notice.`;
    }
  }
  return out;
}

/**
 * create_booking at an estate agency: a viewing, under the same checks as
 * check_availability, with the buyer's position on it and the buyer kept
 * on file. A valuation goes through book_valuation. Null for anything the
 * shared path books (a mortgage appointment, or any other business).
 */
export async function estateBooking(args: Args, ctx: ToolContext, service: BookableService): Promise<Record<string, unknown> | null> {
  const p = ctx.tenant.profile;
  if (!p.estate) return null;
  if (service.key === 'valuation') return { booked: false, message: 'Use book_valuation for a valuation: it takes the address and what they are planning.' };
  if (!service.needs_listing) return null;
  const name = realName(args.name);
  if (!name) return { booked: false, message: ASK_NAME };
  const r = await resolveHome(ctx, args.property);
  if ('reply' in r) return { booked: false, ...r.reply };
  const { home: h, all } = r;
  const l = h.listing;
  const date = str(args.date) ?? '';
  const time = str(args.time) ?? '';
  noteSeen(ctx, [h]);
  const stop = stopFor(ctx, h, all, date);
  if (stop) return { booked: false, ...stop };
  const held = gate(ctx, h, 'viewing');
  if (held) return { booked: false, ...held };
  const no = excludedStaff(ctx, h, str(args.staff)) ?? notWorking(ctx, str(args.staff), date);
  if (no) return { booked: false, message: no };
  const negotiator = firstNameOf(ctx.tenant, l.negotiator) || 'the negotiator';
  // Nobody is let into an empty home on an unknown number: the safety rule, said as a rule and never as why.
  if (l.viewing.occupied === 'vacant' && !ctx.callerPhone) {
    return { booked: false, message: `Not booked: this home is only booked for a caller whose number we can see. Offer a call back from ${negotiator} instead, with take_message.` };
  }
  const postcode = postcodeOf(args.postcode);
  if (p.estate.safety.take_postcode && !postcode && !ctx.state.gateAsked.includes('postcode')) {
    ctx.state.gateAsked.push('postcode');
    return { booked: false, message: "Not booked yet: we take every viewer's own home postcode. Ask for it, then call create_booking again with postcode. If they'd rather not say, call again without it." };
  }
  const phone = normaliseUkPhone(str(args.phone)) ?? ctx.callerPhone;
  const email = str(args.email);
  const position = positionOf(args);
  const badges = [...positionBadges(position), ...(l.viewing.occupied === 'vacant' ? ['ID check'] : [])];
  const details = {
    kind: service.key, position, badges, ...(postcode ? { postcode: postcode.full } : {}), ...(email ? { email } : {}), source: 'AI receptionist',
  };
  const rule = viewingRules(l, p, service.key, h.live);
  const made = await ctx.repo.createBooking(
    ctx.tenant,
    { service: service.key, date, time, party_size: 1, name, phone, notes: str(args.notes) ?? null, staff: str(args.staff), source: source(ctx), call_id: ctx.callId, listing: rule, details },
    ctx.now(),
  );
  if (!made.ok) {
    const req: SlotRequest = { profile: p, serviceKey: service.key, date, time, partySize: 1, staff: str(args.staff), now: ctx.now(), existing: isIsoDate(date) ? await ctx.repo.busyForDate(ctx.tenant, date) : [], listing: rule };
    const alt = withNames(ctx, checkAvailability(req), req, service);
    const alternatives = (alt.alternatives as unknown[] | undefined) ?? [];
    return { booked: false, reason: made.reason, message: (alt.message as string | undefined) ?? made.message, alternatives, next: alternatives.length ? 'Offer these, then book the one they choose.' : 'Offer another day with check_availability.' };
  }
  const b = made.booking;
  record(ctx, b.reference, 'booking', 'committed');
  if (phone) await ctx.repo.upsertBuyer(ctx.tenant.id, phone, name, { roles: ['buyer'], position, ...(email ? { email } : {}), last_contact: ctx.now().toISOString(), source: 'phone' });
  // Booked from a portal enquiry about this home: it is answered, and leaves the team's list of leads waiting.
  if (phone) await ctx.repo.markEnquiriesAnswered(ctx.tenant.id, phone, l.key);
  const local = toLocal(b.starts_at, p.timezone);
  const who = firstNameOf(ctx.tenant, b.resource_key);
  ctx.action({
    kind: 'booking_created', title: `${cap(service.label)} booked`,
    detail: `${spokenDate(local.date)}, ${spokenTime(local.time)} · ${shortAddress(l)} · ${name} with ${who}${badges.length ? ` · ${badges.join(', ')}` : ''} · ref ${b.reference}`,
    data: { reference: b.reference },
  });
  const sent = await smsTo(ctx, phone, estateText(ctx.tenant, b, 'booked'));
  let next: string | undefined;
  if (position.selling === 'not_on_market' && !ctx.state.valuationOffered) {
    ctx.state.valuationOffered = true;
    next = 'Offer a free valuation of their own home, once, without pressure.';
  }
  return {
    booked: true, ...estateSummary(ctx.tenant, b), where: shortAddress(l),
    confirmation_text: sent ? 'sent by text, with the reference' : 'no number to text', next,
  };
}

// ── Messages, for the right person ────────────────────────────────────────

const CATEGORIES = ['viewing', 'offer', 'valuation', 'seller', 'progression', 'complaint', 'fraud', 'access', 'tenant', 'data', 'conduct', 'compliance', 'safeguarding', 'press', 'supplier', 'job', 'lettings', 'general'] as const;
type Category = (typeof CATEGORIES)[number];

/** Who a message is for: a first name, a role ("the negotiator" of the home it is about), or by what it is about. */
function messageFor(t: Tenant, words: string | undefined, category: Category, home: Listing | null): StaffMember | undefined {
  const team = teamOf(t);
  const e = t.profile.estate;
  const byKey = (k: string | null | undefined) => team.find((m) => m.key === k);
  const role = (r: StaffMember['role']) => team.find((m) => m.role === r);
  const does = (d: StaffMember['does'][number]) => team.find((m) => m.does.includes(d));
  const w = words?.toLowerCase().trim() ?? '';
  const named = w ? team.find((m) => w === m.key || w.includes(m.first_name.toLowerCase()) || w === m.name.toLowerCase()) : undefined;
  if (named) return named;
  if (/negotiator|agent|sales/.test(w)) return byKey(home?.negotiator) ?? role('negotiator');
  if (/manager|boss|owner|director/.test(w)) return role('manager');
  if (/valu|apprais|surveyor/.test(w)) return does('valuations');
  if (/progress|conveyanc|sales progress/.test(w)) return role('progressor') ?? does('progression');
  if (/on.?call|emergenc/.test(w)) return byKey(e?.on_call);
  if (/mortgage|adviser|advisor/.test(w)) return does('mortgage');
  if (/letting/.test(w)) return byKey(e?.lettings_contact);
  switch (category) {
    case 'complaint': return byKey(e?.complaints_handler) ?? role('manager');
    case 'data': return byKey(e?.data_lead) ?? role('manager');
    case 'viewing': case 'offer': case 'seller': case 'access': case 'tenant': return byKey(home?.negotiator) ?? role('negotiator') ?? role('manager');
    case 'valuation': return does('valuations') ?? role('manager');
    case 'progression': return role('progressor') ?? does('progression') ?? role('manager');
    case 'lettings': return byKey(e?.lettings_contact) ?? role('manager');
    default: return role('manager') ?? team[0];
  }
}

function categoryOf(v: unknown): Category {
  const s = str(v)?.toLowerCase() ?? '';
  return CATEGORIES.find((c) => s === c) ?? CATEGORIES.find((c) => s.includes(c)) ?? (/scam|bank/.test(s) ? 'fraud' : /complain/.test(s) ? 'complaint' : 'general');
}

function urgencyOf(v: unknown, category: Category): 'urgent' | 'today' | 'this_week' {
  const s = str(v)?.toLowerCase() ?? '';
  if (/urgent|asap|emergenc|now/.test(s)) return 'urgent';
  if (/week|whenever|no rush/.test(s)) return 'this_week';
  if (/today/.test(s)) return 'today';
  return category === 'fraud' || category === 'safeguarding' ? 'urgent' : 'today';
}

/**
 * take_message at an agency with a team: the message goes to one person,
 * with what it is about and how soon. Urgent ones text that person. A
 * complaint gets a reference, an acknowledgement and the process; a
 * compliance note is private, never texted or read back.
 */
const PULLING_OUT = /\bpull(?:ing)? out\b|\bwithdraw|mortgage (?:has been |was |'s been )?(?:refused|declined|turned down)|can'?t (?:go ahead|proceed)|fall(?:en|ing)? through/i;

/** The sale under way this caller is the buyer or a seller in, when their message is about it: not a complaint, fraud or data, and not for someone they named. */
async function saleParty(ctx: ToolContext, phone: string | null, forWords: string | undefined, category: Category): Promise<{ home: Listing } | null> {
  if (!phone || ['complaint', 'fraud', 'data', 'compliance', 'safeguarding'].includes(category)) return null;
  const w = forWords?.toLowerCase() ?? '';
  // Someone named ("Rachel") is respected; "the manager" or "the team" is the model's guess.
  if (w && teamOf(ctx.tenant).some((m) => w.includes(m.first_name.toLowerCase()) && m.role !== 'progressor')) return null;
  for (const sale of (await ctx.repo.listSales(ctx.tenant.id)).filter((x) => x.status === 'progressing' || x.status === 'exchanged')) {
    const mine = sale.buyer_phone === phone || (await ctx.repo.sellersOf(ctx.tenant.id, sale.listing_key)).some((x) => x.phone === phone);
    const home = ctx.tenant.profile.listings?.find((l) => l.key === sale.listing_key);
    if (mine && home) return { home };
  }
  return null;
}

export async function estateMessage(args: Args, ctx: ToolContext): Promise<Record<string, unknown> | null> {
  const t = ctx.tenant;
  const p = t.profile;
  if (!p.team) return null;
  const phone = normaliseUkPhone(str(args.phone)) ?? ctx.callerPhone;
  const body = str(args.message) ?? '';
  const name = str(args.name) ?? 'Unknown';
  // A caller who talked about bank or account details is a possible payment scam, whatever the model filed it as (ea-bank-details-change).
  const money = BANK_TALK.test(ctx.state.heard.join(' '));
  const chosen = categoryOf(args.category);
  let category: Category = money && !['complaint', 'data', 'compliance', 'safeguarding'].includes(chosen) ? 'fraud' : chosen;
  let urgency = category === 'fraud' && chosen !== 'fraud' ? 'urgent' : urgencyOf(args.urgency, category);
  let home: Listing | null = null;
  if (str(args.property)) {
    const r = await resolveHome(ctx, args.property);
    if ('home' in r) home = r.home.listing;
  }
  // The buyer or seller in a sale under way: theirs is the progressor's, unless they asked for someone by name, and pulling out
  // is urgent. A live call on 5 October filed "our mortgage has been refused, we'll have to pull out" for the manager.
  const routed = await saleParty(ctx, phone, str(args.for), category);
  if (routed) {
    category = 'progression';
    home ??= routed.home;
    if (PULLING_OUT.test(`${body} ${ctx.state.heard.join(' ')}`)) urgency = 'urgent';
  }
  // The home's own seller answering an offer by phone: urgent, and shown on its offers as "Seller replied by phone"; staff confirm before any buyer hears.
  const sellerReply = Boolean(home && phone && (category === 'offer' || category === 'seller') && (await ctx.repo.sellersOf(t.id, home.key)).some((x) => x.phone === phone));
  const to = messageFor(t, routed ? undefined : str(args.for), category, home);
  const first = to?.first_name ?? 'the team';
  const complaint = category === 'complaint';
  const quiet = category === 'compliance';
  const reference = complaint ? newBookingReference() : null;
  const nation = p.estate?.nation ?? 'england';
  const day = today(ctx);
  await ctx.repo.addMessage({
    tenant_id: t.id, call_id: ctx.callId, kind: 'message', from_name: name, from_phone: phone, body, status: 'new',
    for_staff: to?.key ?? null, category, urgency: sellerReply ? 'urgent' : urgency, reference,
    details: {
      ...(home ? { listing: home.key } : {}),
      ...(sellerReply ? { seller_reply: true } : {}),
      ...(complaint ? { acknowledge_by: addWorkingDays(day, 3, nation), final_by: addWorkingDays(day, 15, nation) } : {}),
      ...(quiet ? { private: true } : {}),
    },
  });
  ctx.state.messageTaken = true;
  if (category === 'fraud') ctx.state.fraudReported = true;
  ctx.action({
    kind: 'message_taken', title: quiet ? 'Private note' : `Message for ${first} from ${name}`,
    detail: quiet ? 'Private: in Messages' : `${body}${phone ? ` · ${displayUkPhone(phone)}` : ''}`,
  });
  if (quiet) return { taken: true, note: "Say only that you've noted it. Never repeat it, and never say who it is for." };
  if ((urgency === 'urgent' || sellerReply) && to?.mobile) {
    await smsTo(ctx, normaliseUkPhone(to.mobile), `URGENT from the AI receptionist: ${name}${phone ? ` (${displayUkPhone(phone)})` : ''}: ${body} (Demo)`);
  }
  const owner = p.owner_sms_number;
  if (owner) await smsTo(ctx, owner, `Message from ${name} (${displayUkPhone(phone)}): ${body}`);
  if (complaint && reference) {
    await smsTo(ctx, phone, `${p.name}: we've received your complaint, ref ${reference}. We'll acknowledge it within 3 working days and send a written answer within 15. (Demo)`);
    const redress = p.estate?.redress === 'prs' ? 'the Property Redress Scheme' : 'The Property Ombudsman';
    return {
      taken: true, for: first, reference, spoken_reference: spokenReference(reference),
      process: `We acknowledge a complaint within 3 working days and send a written answer within 15. If they're still unhappy after our final answer, or after 8 weeks, they can go to ${redress}.`,
      note: 'Read the reference one character at a time and explain the process. Never admit fault or offer money.',
    };
  }
  if (category === 'data') return { taken: true, for: first, note: `Tell them ${first} will reply within a month.` };
  // When they will hear back: on 5 October Ben, pulling out, was told the message was sent and nothing more.
  if (urgency === 'urgent') return { taken: true, for: first, note: `Tell them you've sent ${first} an urgent message and ${first} will call them today. Never say where ${first} is.` };
  return { taken: true, for: first, note: `Tell them ${first} will get back to them${urgency === 'today' ? ' today' : ''}.` };
}

// ── Valuations ────────────────────────────────────────────────────────────

const RICS_PURPOSES: Record<string, string> = {
  probate: 'probate', help_to_buy: 'Help to Buy', staircasing: 'staircasing', divorce: 'a divorce or separation', remortgage: 'a remortgage',
};

function purposeOf(v: unknown): string {
  const s = str(v)?.toLowerCase() ?? '';
  if (/probate|inheritance|estate of|died|death/.test(s)) return 'probate';
  if (/help.?to.?buy|equity loan/.test(s)) return 'help_to_buy';
  if (/staircas|buy (more|the rest)|bigger share/.test(s)) return 'staircasing';
  if (/divorc|separat|matrimonial/.test(s)) return 'divorce';
  if (/remortgag|re-mortgag|lender'?s? valuation/.test(s)) return 'remortgage';
  if (/curious|wonder|just (want|like) to know/.test(s)) return 'curious';
  return 'sale';
}

/** Why a valuation for something other than a sale is not ours to do, and what to offer instead. */
function ricsAnswer(purpose: string, t: Tenant): string {
  const e = t.profile.estate!;
  const also = 'If they might sell, offer a free sale appraisal too (book_valuation with also_selling).';
  if (purpose === 'remortgage') return `Not booked: a remortgage valuation is arranged by the lender, not by us. Say so kindly. ${also}`;
  const rics = e.valuations.rics;
  const ours = rics.offered
    ? ` We do RICS valuations${rics.staff ? ` with ${firstNameOf(t, rics.staff)}` : ''}${rics.fee_pence ? ` for ${poundsWhole(rics.fee_pence)}` : ''}: offer a message so the team can arrange one${purpose === 'help_to_buy' ? ', unless we are selling the home' : ''}.`
    : ' We don\'t do RICS valuations: suggest a RICS Registered Valuer.';
  return `Not booked: our free appraisal is a marketing opinion, and ${RICS_PURPOSES[purpose]} needs a valuation by a RICS Registered Valuer${purpose === 'help_to_buy' ? ' who is independent of any agent selling the home' : ''}.${ours} ${also}`;
}

/** Within about three months, or already with another agent: worth a call back soon. */
const HOT = /\b(asap|as soon|straight away|immediately|right away|this month|next month|weeks?|(?:within |in )?(?:a|one|two|three|1|2|3|a couple of|a few) months?)\b/i;

async function bookValuation(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const t = ctx.tenant;
  const p = t.profile;
  const e = p.estate!;
  const service = p.booking?.services.find((s) => s.key === 'valuation');
  if (!service) return { booked: false, message: "Valuations aren't booked by phone here: take a message for the team." };
  const pc = postcodeOf(args.postcode);
  if (!pc) return { booked: false, message: 'Ask for the postcode of the home, read it back, then call this again.' };
  if (!e.districts.includes(pc.district)) return { booked: false, message: "That's outside the area we cover: say so kindly. No booking." };
  const capacity = str(args.capacity)?.toLowerCase() ?? 'owner';
  if (/lend|bank|mortgagee|receiver|building society/.test(capacity)) {
    const manager = teamOf(t).find((m) => m.role === 'manager');
    const phone = normaliseUkPhone(str(args.phone)) ?? ctx.callerPhone;
    const caller = str(args.name) ?? 'A lender';
    const body = `A lender asking for a valuation of ${str(args.address) ?? 'a home'}, ${pc.full}.`;
    await ctx.repo.addMessage({ tenant_id: t.id, call_id: ctx.callId, kind: 'message', from_name: caller, from_phone: phone, body, status: 'new', for_staff: manager?.key ?? null, category: 'valuation', urgency: 'urgent' });
    ctx.state.messageTaken = true;
    if (manager?.mobile) await smsTo(ctx, normaliseUkPhone(manager.mobile), `URGENT from the AI receptionist: ${caller}${phone ? ` (${displayUkPhone(phone)})` : ''}: ${body} (Demo)`);
    return { booked: false, message: `A lender's valuation isn't booked by phone. I've sent ${manager?.first_name ?? 'the manager'} an urgent message: say they will call back.` };
  }
  const purpose = purposeOf(args.purpose);
  if (RICS_PURPOSES[purpose] && !bool(args.also_selling)) return { booked: false, message: ricsAnswer(purpose, t) };
  const name = realName(args.name);
  if (!name) return { booked: false, message: ASK_NAME };
  const address = str(args.address);
  if (!address) return { booked: false, message: 'Ask for the first line of the address, read it back, then call this again.' };
  const phone = normaliseUkPhone(str(args.phone)) ?? ctx.callerPhone;
  const otherAgent = noneToNull(str(args.other_agent));
  const timescale = str(args.timescale);
  const executor = /executor|attorney|deputy/.test(capacity);
  const needsToBuy = bool(args.needs_to_buy);
  const details = {
    kind: 'valuation', address, postcode: pc.full, purpose: purpose === 'curious' ? 'curious' : 'sale', also_for: RICS_PURPOSES[purpose] ? purpose : undefined,
    capacity, owners_agree: bool(args.owners_agree), property_type: str(args.property_type), bedrooms: int(args.bedrooms), reason: str(args.reason),
    timescale, other_agent: otherAgent ?? null, needs_to_buy: needsToBuy ?? false, heard_from: str(args.heard_from),
    dual_fee: Boolean(otherAgent), hot: Boolean(otherAgent) || HOT.test(timescale ?? ''), ...(executor ? { tone: 'Go gently. No rush.' } : {}), source: 'AI receptionist',
  };
  const date = str(args.date) ?? '';
  const time = str(args.time) ?? '';
  const staff = str(args.staff);
  const off = notWorking(ctx, staff, date);
  if (off) return { booked: false, message: off };
  const made = await ctx.repo.createBooking(
    t, { service: 'valuation', date, time, party_size: 1, name, phone, notes: null, staff, source: source(ctx), call_id: ctx.callId, details: JSON.parse(JSON.stringify(details)) }, ctx.now(),
  );
  if (!made.ok) {
    const req: SlotRequest = { profile: p, serviceKey: 'valuation', date, time, partySize: 1, staff, now: ctx.now(), existing: isIsoDate(date) ? await ctx.repo.busyForDate(t, date) : [] };
    const alt = withNames(ctx, checkAvailability(req), req, service);
    const alternatives = (alt.alternatives as unknown[] | undefined) ?? [];
    return { booked: false, message: (alt.message as string | undefined) ?? made.message, alternatives, available_ranges: alt.available_ranges, next: alternatives.length ? 'Offer these, then book the one they choose.' : 'Offer another day with check_availability.' };
  }
  const b = made.booking;
  record(ctx, b.reference, 'booking', 'committed');
  ctx.state.valuationOffered = true;
  if (phone) await ctx.repo.upsertBuyer(t.id, phone, name, { roles: needsToBuy ? ['seller', 'buyer'] : ['seller'], last_contact: ctx.now().toISOString(), source: 'valuation' });
  const s = estateSummary(t, b);
  ctx.action({
    kind: 'booking_created', title: 'Valuation booked',
    detail: `${s.spoken_date}, ${s.spoken_time} · ${address}, ${pc.full} · ${name} with ${s.with}${details.hot ? ' · Hot' : ''}${details.dual_fee ? ' · Possible double fee' : ''} · ref ${b.reference}`,
    data: { reference: b.reference },
  });
  const sent = await smsTo(ctx, phone, estateText(t, b, 'booked'));
  const next = [
    needsToBuy ? 'Offer to note what they want to buy: take it in a message for the team.' : null,
    otherAgent ? 'They may owe two fees if they instruct us while tied to another agent: suggest they check their agreement. Say nothing about the other agent.' : null,
    details.owners_agree === false ? 'Suggest every owner knows about the appraisal.' : null,
  ].filter(Boolean).join(' ') || undefined;
  return {
    booked: true, ...s, property: address, say: e.valuations.say, tone: executor ? 'Go gently. No rush.' : undefined,
    confirmation_text: sent ? 'sent by text, with the reference' : 'no number to text', next,
  };
}

// ── Offers ────────────────────────────────────────────────────────────────

/**
 * Every offer is recorded and passed on, whatever the amount, the buyer's
 * position or the home's status, until contracts are exchanged (Estate
 * Agents Act 1979): timestamped, confirmed to the buyer in writing at once,
 * and an urgent alert for the negotiator. Nothing here accepts, declines or
 * hints at either, and no other buyer's offer is ever in the answer.
 */
async function recordOffer(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const t = ctx.tenant;
  const p = t.profile;
  const e = p.estate!;
  const r = await resolveHome(ctx, args.property);
  if ('reply' in r) return { recorded: false, ...r.reply };
  const { home: h, all } = r;
  const l = h.listing;
  const negotiator = teamOf(t).find((m) => m.key === l.negotiator);
  const first = negotiator?.first_name ?? 'the negotiator';
  noteSeen(ctx, [h]);
  if (e.offers.take === 'message') {
    return { recorded: false, message: `Offers here go straight to a person: take an urgent message for ${first} (category offer) with the amount, everyone buying, and their position, and say ${first} will call back today.` };
  }
  const status = h.live.status;
  const instead = () => similar(l, findable(all)).map((x) => brief(byKey(all, x.key)));
  if (status === 'exchanged' || status === 'completed') return { recorded: false, message: "Contracts have been exchanged, so it's sold: no offer can be put to the seller now. Say so kindly.", similar: instead() };
  if (status === 'withdrawn') return { recorded: false, message: `It's no longer on the market. If they'd still like the seller to hear it, take a message for ${first} (category offer).`, similar: instead() };
  const held = gate(ctx, h, 'offer');
  if (held) return { recorded: false, ...held };
  const amount = poundsOf(args.amount);
  if (!amount) return { recorded: false, message: 'Ask how much they are offering, in pounds, then call this again.' };
  const names = strList(args.buyer_names).map(realName).filter((n): n is string => Boolean(n));
  if (!names.length) return { recorded: false, message: 'Ask for the full name of everyone who will buy, then call this again.' };
  const phone = normaliseUkPhone(str(args.phone)) ?? ctx.callerPhone;
  const email = str(args.email);
  const position = positionOf(args);
  const conditions = noneToNull(str(args.conditions)) ?? null;
  const viewedWith = noneToNull(str(args.viewed_with));
  const flags = [
    l.personal_interest ? 'connected' : null, bool(args.company_or_trust) ? 'company' : null, bool(args.gifted_deposit) ? 'gifted_deposit' : null,
    viewedWith ? 'viewed_elsewhere' : null,
  ].filter((x): x is string => Boolean(x));
  const offer = await ctx.repo.createOffer(t, {
    listing_key: l.key, amount_pence: amount * 100, buyer_names: names, phone, email: email ?? null, position, conditions,
    solicitor: str(args.solicitor) ?? null, flags, revises: str(args.revises)?.replace(/[^a-z0-9]/gi, '').toUpperCase() ?? null,
    note: [status === 'sale_agreed' ? 'Made after a sale was agreed: still goes to the seller.' : null, viewedWith ? `Viewed with ${viewedWith}.` : null].filter(Boolean).join(' ') || null,
    source: source(ctx), call_id: ctx.callId, received_at: ctx.now(),
  });
  record(ctx, offer.reference, 'offer', 'committed');
  if (phone) await ctx.repo.upsertBuyer(t.id, phone, names[0], { roles: ['buyer'], position, ...(email ? { email } : {}), last_contact: ctx.now().toISOString(), source: 'offer' });
  const who = namesWords(names);
  const terms = conditions ? `, ${clause(conditions)}` : '';
  const pos = positionWords(position, names.length);
  const readBack = `An offer of ${poundsWhole(offer.amount_pence)} for ${shortAddress(l)} from ${who}${terms}.${pos ? ` ${pos}` : ''}`;
  const alert = `Offer of ${poundsWhole(offer.amount_pence)} on ${shortAddress(l)} from ${who}${terms}.${pos ? ` ${pos}` : ''} Ref ${offer.reference}.`;
  await ctx.repo.addMessage({
    tenant_id: t.id, call_id: ctx.callId, kind: 'message', from_name: who, from_phone: phone, body: alert, status: 'new',
    for_staff: l.negotiator || null, category: 'offer', urgency: 'urgent', reference: offer.reference, details: { offer: offer.reference, listing: l.key },
  });
  if (negotiator?.mobile) {
    await smsTo(ctx, normaliseUkPhone(negotiator.mobile), `URGENT from the AI receptionist: ${alert}${phone ? ` Caller: ${displayUkPhone(phone)}.` : ''} (Demo)`);
  }
  const sent = await smsTo(ctx, phone, offerReceivedText(p.name, offer.amount_pence, shortAddress(l), toLocal(offer.received_at, p.timezone), conditions, offer.reference));
  ctx.action({ kind: 'offer_recorded', title: `Offer ${poundsWhole(offer.amount_pence)} · ${shortAddress(l)}`, detail: `${who}${terms}${pos ? ` · ${pos}` : ''} · ref ${offer.reference}`, data: { reference: offer.reference } });
  return {
    recorded: true, reference: offer.reference, spoken_reference: spokenReference(offer.reference), read_back: readBack,
    say: "It goes to the seller promptly, and we'll confirm it in writing. If it's accepted, there are standard ID and proof-of-funds checks.",
    note: status === 'sale_agreed' ? 'A sale is agreed on this home, but every offer still goes to the seller until contracts are exchanged: say so.' : undefined,
    confirmation_text: sent ? 'sent by text, with the reference' : email ? 'the team will email it' : 'Ask for a mobile or email so we can confirm it in writing, and take it in a message.',
    // That other offers exist may be said (TPO 9f); who made them and how much, never.
    other_offers: (await othersOn(ctx, l.key, phone)) ? OTHER_OFFERS : undefined,
    next: 'Read back read_back and the reference one character at a time, then say. Never hint at the answer or comment on the amount; of other offers, say only other_offers.',
  };
}

// ── Homes ─────────────────────────────────────────────────────────────────

/** Anything an owner typed that tells a stranger a home is empty or how to get in is dropped, whichever field it is in. */
function scrub<T>(v: T): T {
  if (typeof v === 'string') return (UNSAYABLE.test(v) ? undefined : v) as T;
  if (Array.isArray(v)) return v.map(scrub).filter((x) => x !== undefined) as T;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrub(x)]).filter(([, x]) => x !== undefined)) as T;
  }
  return v;
}

const dayMonth = (d: string) => spokenDate(d).split(' ').slice(1).join(' ');

async function getProperty(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const p = ctx.tenant.profile;
  const e = p.estate;
  const nation = e?.nation ?? 'england';
  const r = await resolveHome(ctx, args.property);
  if ('reply' in r) return { found: false, ...r.reply };
  const { home: h, all } = r;
  const l = h.listing;
  const live = h.live;
  const day = today(ctx);
  // Briefed once: a second look at the same home must not hide a line already said.
  if (!(l.key in ctx.state.briefed)) ctx.state.briefed[l.key] = ctx.state.said.length;
  noteSeen(ctx, [h]);
  if (live.status === 'withdrawn' || live.status === 'exchanged' || live.status === 'completed') {
    const alt = similar(l, findable(all)).map((x) => brief(byKey(all, x.key)));
    return { property: l.key, address: l.address, status: STATUS_WORDS[live.status], say: live.status === 'withdrawn' ? "It's no longer on the market." : "It's sold.", similar: alt, next: alt.length ? 'Say so, and offer these instead.' : undefined };
  }
  const tz = p.timezone;
  const start = startOf(h, ctx.now());
  const f = facts(l, live, day, nation);
  let priceNote: string | undefined;
  if (live.price_pence !== l.initial.price_pence) priceNote = live.price_pence < l.initial.price_pence ? `reduced from ${poundsWhole(l.initial.price_pence)}` : undefined;
  else if (l.reduced) priceNote = `reduced on ${dayMonth(toLocal(new Date(start.getTime() - l.reduced.days_ago * DAY), tz).date)} from ${poundsWhole(l.reduced.from_pence)}`;
  const marketed = toLocal(live.marketed_at, tz).date;
  const onMarket = live.status === 'coming_soon'
    ? 'coming soon'
    : live.back_on_market_at ? `back on the market since ${dayMonth(toLocal(live.back_on_market_at, tz).date)}`
    : marketed === day ? 'new to the market today' : `since ${dayMonth(marketed)}`;
  const official = Object.fromEntries(
    ([['flooded', 'flooding'], ['broadband', 'broadband'], ['mobile', 'mobile']] as const)
      .filter(([k]) => l.checks[k].v === 'unknown' && e?.official)
      .map(([, w]) => [w, e!.official![w]]),
  );
  if (!l.local_tax.trim() && e?.official) official.local_tax = e.official.local_tax;
  const negotiator = firstNameOf(ctx.tenant, l.negotiator);
  // The facts every advert must state (price, tenure, council tax, EPC), said up front; left out while staff check any of them.
  const describe = live.checking.some((c) => ['price', 'tenure', 'lease', 'local_tax', 'epc'].includes(c)) ? undefined : describeLine(l, live, day, nation);
  return scrub({
    property: l.key, address: l.address, status: STATUS_WORDS[live.status], describe,
    price: live.checking.includes('price') ? undefined : priceOf(h), price_note: live.checking.includes('price') ? undefined : priceNote, on_market: onMarket,
    facts: f.facts,
    unknown: f.unknown.length ? f.unknown : undefined,
    being_checked: f.being_checked.length ? f.being_checked : undefined,
    say_first: sayFirst(l, live, day, start, tz).map((i) => i.say),
    before_offer: l.before_offer.map((i) => i.say),
    viewing: l.viewing.rule,
    seller_position: l.seller_position || undefined,
    fell_through: l.fall_through || undefined,
    official: Object.keys(official).length ? official : undefined,
    // On 4 October "Will I get a mortgage on that?" about a short lease was answered with no one to ask. Leasehold only: the answer is kept small.
    mortgage_question: l.lease
      ? `Can't advise: ${e?.mortgage ? `offer ${firstNameOf(ctx.tenant, e.mortgage.staff) || 'someone'}, our mortgage adviser` : 'suggest an independent mortgage broker'}, and their solicitor for the lease.`
      : undefined,
    negotiator,
    links: l.links,
    note: [
      describe ? 'Say describe first, as it is, even if they asked something narrower; then answer from facts.' : '',
      f.unknown.length ? `Unknown: say it isn't in the details (never "no"), name any official service, and offer to ask ${negotiator}.` : '',
      f.being_checked.length ? 'Being checked: say so, and state nothing about them.' : '',
    ].filter(Boolean).join(' ') || undefined,
  });
}

// ── The people we know ────────────────────────────────────────────────────

/** "today", "yesterday", "on Tuesday", "Saturday", "3 October": a day as a caller would say it, from the agency's today. */
function dayWords(date: string, day: string): string {
  if (date === day) return 'today';
  if (date === addDays(day, -1)) return 'yesterday';
  if (date === addDays(day, 1)) return 'tomorrow';
  const [name, d, month] = spokenDate(date).split(' ');
  if (date < day && date >= addDays(day, -6)) return `on ${name}`;
  if (date > day && date <= addDays(day, 6)) return name;
  return `${d} ${month}`;
}
const partOfDay = (time: string) => (time < '12:00' ? 'morning' : time < '17:00' ? 'afternoon' : 'evening');

/**
 * Who the calling number is to us, from their own records only: viewings
 * and valuations, portal enquiries, being registered, selling with us, and
 * a missed call from the team (who, never why). Never a seller's address:
 * get_marketing_update checks the home they name.
 */
async function findParty(_args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const t = ctx.tenant;
  const phone = ctx.callerPhone;
  if (!phone) return { known: false, note: 'No calling number to look up: ask how you can help.' };
  const tz = t.profile.timezone;
  const day = today(ctx);
  const now = ctx.now();
  const [buyer, bookings, enquiries, states, offers] = await Promise.all([
    ctx.repo.findBuyer(t.id, phone),
    ctx.repo.listBookings(t.id, new Date(now.getTime() - 14 * DAY), new Date(now.getTime() + 30 * DAY)),
    ctx.repo.messagesFrom(t.id, phone),
    ctx.repo.listingStates(t.id),
    ctx.repo.findOffer(t.id, { phone }),
  ]);
  const home = (key: unknown) => t.profile.listings?.find((l) => l.key === key);
  const is: string[] = [];
  if (buyer?.details.requirements) is.push(`a registered buyer${buyer.marketing_consent ? ', with alerts on' : ''}`);
  for (const k of buyer?.details.backup_for ?? []) if (home(k)) is.push(`a back-up buyer for ${shortAddress(home(k)!)}`);
  for (const b of bookings.filter((x) => x.phone === phone).sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime())) {
    const local = toLocal(b.starts_at, tz);
    const l = home(b.listing_key);
    const what = findService(t.profile, b.service_key)?.label ?? b.service_key;
    const where = l ? `, ${shortAddress(l)}` : '';
    if (b.ends_at <= now) {
      if (l) is.push(`viewed ${shortAddress(l)} ${dayWords(local.date, day)}, ref ${b.reference}`);
    } else {
      is.push(`${what}: ${dayWords(local.date, day)} ${spokenTime(local.time)}${where}, ref ${b.reference}`);
    }
    record(ctx, b.reference, 'booking', 'found');
  }
  for (const m of enquiries) {
    const portal = typeof m.details?.portal === 'string' ? m.details.portal : null;
    const l = home(m.details?.listing);
    if (!portal || !l) continue;
    const local = toLocal(new Date(m.created_at), tz);
    const asked = /"([^"]+)"/.exec(m.body)?.[1];
    is.push(`enquired on ${portal} ${dayWords(local.date, day)} about ${shortAddress(l)}${asked ? `: "${asked}"` : ''}${m.details.answered ? '' : ' (not answered yet)'}`);
  }
  // Their own offers, latest on each home: where each stands is get_offer_status's to say.
  for (const o of offers.filter((x, i) => offers.findIndex((y) => y.listing_key === x.listing_key) === i)) {
    if (home(o.listing_key)) is.push(`made an offer on ${shortAddress(home(o.listing_key)!)}, ref ${o.reference}: get_offer_status says where it stands`);
  }
  const sells = states.some((x) => x.sellers?.some((p) => p.phone === phone));
  const tried = buyer?.details.tried_to_call;
  const triedAt = tried ? toLocal(new Date(tried.at), tz) : null;
  const known = Boolean(is.length || sells || tried || buyer);
  if (!known) return { known: false, note: 'Nothing on this number. Ask how you can help.' };
  return {
    known: true,
    first_name: (buyer?.name ?? bookings.find((b) => b.phone === phone)?.name ?? '').split(' ')[0] || undefined,
    is: is.length ? is : undefined,
    seller: sells ? 'sells a home with us: use get_marketing_update once they say which' : undefined,
    tried_to_call: tried && triedAt ? `${firstNameOf(t, tried.by) || 'Someone in the team'} tried to call ${dayWords(triedAt.date, day)} ${partOfDay(triedAt.time)}` : undefined,
    note: [
      tried ? 'Say who tried to call, never why: offer a message for them.' : '',
      is.some((x) => x.endsWith('(not answered yet)')) ? 'An enquiry not answered yet: say sorry nobody got back to them, and help now.' : '',
    ].filter(Boolean).join(' ') || undefined,
  };
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const NOT_VERIFIED = "I can't go through a sale without checking who's calling. I can take a message for the negotiator.";
const FEEDBACK_WORDS: Record<string, string> = { keen: 'keen', second_viewing: 'would like a second viewing', likely_offer: 'likely to make an offer', not_for_me: 'not for them' };

/**
 * A home's seller, checked in code: the calling number must be one of the
 * home's sellers. The model never holds the answer it checks, and three
 * misses end the tries for the call.
 */
async function verifySeller(args: Args, ctx: ToolContext): Promise<{ home: Home; all: Home[] } | { reply: Record<string, unknown> }> {
  const refuse = (next = 'Offer a message for the negotiator. Never say whether the home or the person is ours.') => ({ reply: { verified: false, say: NOT_VERIFIED, next } });
  if (ctx.state.verifyMisses >= 3) return refuse('No more tries this call: offer a message.');
  const r = await resolveHome(ctx, args.property);
  // Two public homes that fit: asking which gives nothing away.
  if ('reply' in r && r.reply.more_than_one) return { reply: { verified: false, ...r.reply } };
  const phone = ctx.callerPhone;
  const key = 'reply' in r ? null : r.home.listing.key;
  const ok = key && phone && (ctx.state.verified.some((v) => v.listing === key && v.role === 'seller') || (await ctx.repo.sellersOf(ctx.tenant.id, key)).some((x) => x.phone === phone));
  if (!ok || 'reply' in r) {
    ctx.state.verifyMisses++;
    return refuse();
  }
  if (!ctx.state.verified.some((v) => v.listing === key && v.role === 'seller')) ctx.state.verified.push({ listing: key!, role: 'seller' });
  return r;
}

/** "How's my sale going?": the week's viewings, feedback as recorded, and offers by the buyer's position, for a verified seller only. */
async function getMarketingUpdate(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const r = await verifySeller(args, ctx);
  if ('reply' in r) return r.reply;
  const t = ctx.tenant;
  const tz = t.profile.timezone;
  const { listing: l, live } = r.home;
  const now = ctx.now();
  const day = today(ctx);
  const [bookings, offers] = await Promise.all([
    ctx.repo.listBookings(t.id, new Date(Math.min(live.marketed_at.getTime(), now.getTime() - 30 * DAY)), new Date(now.getTime() + 14 * DAY)),
    ctx.repo.listOffers(t.id, l.key),
  ]);
  const views = bookings.filter((b) => b.listing_key === l.key && (b.service_key === 'viewing' || b.service_key === 'second_viewing'));
  const past = views.filter((b) => b.ends_at <= now);
  const when = (d: Date) => toLocal(d, tz);
  const fb = (b: Booking) => b.details?.feedback as { category?: string; words?: string } | undefined;
  const negotiator = firstNameOf(t, l.negotiator) || 'the negotiator';
  const week = past.filter((b) => b.starts_at.getTime() > now.getTime() - 7 * DAY);
  const launched = past.filter((b) => b.starts_at >= live.marketed_at).length;
  const ahead = views.filter((b) => b.starts_at > now && b.starts_at.getTime() < now.getTime() + 7 * DAY);
  const open = offers.filter((o) => ['received', 'sent', 'countered'].includes(o.status));
  const count = (n: number, one: string, many = `${one}s`) => `${n < NUMBER_WORDS.length ? NUMBER_WORDS[n] : n} ${n === 1 ? one : many}`;
  const heard = week.filter((b) => fb(b)?.words).slice(-3).map((b) => cap(`${dayWords(when(b.starts_at).date, day)} a buyer said "${fb(b)!.words!.trim().replace(/[.!?]?$/, '.')}"`));
  // A sentence to open with, as get_property's describe: on 5 October a live call summed the week up as "gone well" and left out the counts, the kitchen and the offer.
  const say = [
    `${cap(count(week.length, 'viewing'))} in the last seven days, ${count(launched, 'viewing')} since it went on the market${ahead.length ? `, and ${count(ahead.length, 'more', 'more')} booked: ${[...new Set(ahead.map((b) => dayWords(when(b.starts_at).date, day)))].join(' and ')}` : ''}.`,
    heard.join(' '),
    open.length
      ? open.map((o) => `An offer of ${poundsWhole(o.amount_pence)} from ${positionWords(o.position ?? {}, o.buyer_names.length).replace(/\.$/, '').replace(/^([A-Z])/, (c) => `a ${c.toLowerCase()}`) || 'a buyer'}, ${o.status === 'sent' ? 'with you to consider' : 'about to be put to you'}.`).join(' ')
      : 'No offers at the moment.',
  ].filter(Boolean).join(' ');
  return {
    verified: true,
    say,
    property: shortAddress(l),
    status: STATUS_WORDS[live.status],
    price: live.checking.includes('price') ? undefined : priceOf(r.home),
    viewings: {
      last_7_days: past.filter((b) => b.starts_at.getTime() > now.getTime() - 7 * DAY).length,
      since_launch: past.filter((b) => b.starts_at >= live.marketed_at).length,
      upcoming: views.filter((b) => b.starts_at > now && b.starts_at.getTime() < now.getTime() + 7 * DAY).map((b) => `${dayWords(when(b.starts_at).date, day)} ${spokenTime(when(b.starts_at).time)}`),
      second_viewings: views.filter((b) => b.service_key === 'second_viewing').length,
    },
    feedback: past.filter((b) => fb(b)?.words).slice(-5).map((b) => {
      const pos = b.details?.position as BuyerPosition | undefined;
      return { when: dayWords(when(b.starts_at).date, day), from: pos?.first_time_buyer ? 'a first-time buyer' : 'a buyer', said: fb(b)!.words, so: FEEDBACK_WORDS[fb(b)!.category ?? ''] };
    }),
    feedback_awaited: past.filter((b) => !fb(b) && b.starts_at.getTime() > now.getTime() - 14 * DAY).length || undefined,
    offers: offers.filter((o) => ['received', 'sent', 'countered'].includes(o.status)).map((o) => ({
      reference: o.reference,
      amount: poundsWhole(o.amount_pence),
      status: o.status === 'sent' ? `with you to consider since ${dayWords(when(o.sent_at ?? o.received_at).date, day)}`
        : o.status === 'countered' ? 'you came back to them; waiting for their answer' : `received ${dayWords(when(o.received_at).date, day)}; ${negotiator} will put it to you`,
      buyer: positionWords(o.position ?? {}, o.buyer_names.length).replace(/\.$/, '') || 'position not given',
    })),
    best_and_final: live.best_final_at ? `best and final offers by ${dayWords(when(live.best_final_at).date, day)} ${spokenTime(when(live.best_final_at).time)}` : undefined,
    next: `Say say first, as it is; then answer from the rest. Buyers by position only, never names or numbers. A price change, or an answer to an offer, is an urgent message for ${negotiator} (category seller, or offer), never done on the call.`,
  };
}

const OTHER_OFFERS = 'There are other offers on this home; we never share amounts.';

/** Open offers on a home from anyone but this number: that they exist may be said (TPO 9f), never who or how much. */
async function othersOn(ctx: ToolContext, key: string, phone: string | null): Promise<boolean> {
  return (await ctx.repo.listOffers(ctx.tenant.id, key)).some((o) => ['received', 'sent', 'countered'].includes(o.status) && o.phone !== phone);
}

/** Where a buyer's own offer stands, as recorded: only for the number that made it. */
async function getOfferStatus(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const t = ctx.tenant;
  const phone = ctx.callerPhone;
  const refuse = (next = 'Offer a message for the negotiator. Never say whether that offer exists.') => ({ verified: false, say: "I can only talk about an offer with the number it was made from. I can take a message for the negotiator.", next });
  if (ctx.state.verifyMisses >= 3) return refuse('No more tries this call: offer a message.');
  const ref = str(args.reference)?.replace(/[^a-z0-9]/gi, '').toUpperCase();
  const mine = phone ? await ctx.repo.findOffer(t.id, { phone }) : [];
  let picked = ref ? mine.filter((o) => o.reference === ref) : mine;
  if (!ref && str(args.property)) {
    const r = await resolveHome(ctx, args.property);
    if ('reply' in r && r.reply.more_than_one) return { verified: false, ...r.reply };
    picked = 'reply' in r ? [] : mine.filter((o) => o.listing_key === r.home.listing.key);
  }
  // Their latest offer on each home: a raise replaces what it raised.
  picked = picked.filter((o, i) => picked.findIndex((x) => x.listing_key === o.listing_key) === i);
  if (!picked.length) {
    ctx.state.verifyMisses++;
    return refuse();
  }
  if (picked.length > 1) return { verified: true, more_than_one: picked.map((o) => shortAddress(t.profile.listings!.find((l) => l.key === o.listing_key)!)), next: 'Ask which home.' };
  const o = picked[0];
  const l = t.profile.listings!.find((x) => x.key === o.listing_key)!;
  const live = (await ctx.repo.listingState(t.id, l.key))!;
  const tz = t.profile.timezone;
  const day = today(ctx);
  const at = (d: Date) => `${dayWords(toLocal(d, tz).date, day)} at ${spokenTime(toLocal(d, tz).time)}`;
  const negotiator = firstNameOf(t, l.negotiator) || 'the negotiator';
  const decided = o.decided_at ?? o.received_at;
  const status: Record<string, string> = {
    received: `received ${at(o.received_at)}; ${negotiator} will put it to the seller`,
    sent: `put to the seller ${at(o.sent_at ?? o.received_at)}; waiting for their decision`,
    accepted: `accepted ${at(decided)}, subject to contract`,
    declined: `the seller decided not to accept it (${at(decided)})`,
    countered: `the seller came back about it ${at(decided)}; ${negotiator} will call you to talk it through`,
    withdrawn: `withdrawn ${at(decided)}`,
  };
  // An acceptance the tool reported is news the receptionist may pass on (guardrails).
  if (o.status === 'accepted' && !ctx.state.seen.accepted.includes(l.key)) ctx.state.seen.accepted.push(l.key);
  const open = ['received', 'sent', 'countered'].includes(o.status);
  return {
    verified: true,
    property: shortAddress(l),
    reference: o.reference,
    amount: poundsWhole(o.amount_pence),
    status: status[o.status],
    best_and_final: open && live.best_final_at ? `best and final offers by ${at(live.best_final_at)}` : undefined,
    other_offers: open && (await othersOn(ctx, l.key, phone)) ? OTHER_OFFERS : undefined,
    say: `${negotiator} will confirm any decision in writing.`,
    next: 'Say only this. Never guess what the seller will decide, or when.',
  };
}

/** "keen", "second viewing", "likely to offer", "not for me", as a caller or the model says them. */
function feedbackCategory(v: unknown): string | null {
  const w = (str(v) ?? '').toLowerCase();
  if (/second|again|another look/.test(w)) return 'second_viewing';
  if (/offer/.test(w)) return 'likely_offer';
  if (/not for|didn'?t|\bpass\b|\bno\b/.test(w)) return 'not_for_me';
  if (/keen|interest|lik|love/.test(w)) return 'keen';
  return null;
}

/** A buyer's own feedback on a viewing they've had: it goes on the viewing, and into the seller's update. */
async function recordViewingFeedback(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const t = ctx.tenant;
  const phone = ctx.callerPhone;
  const words = str(args.words);
  const category = feedbackCategory(args.category);
  if (!words || !category) return { recorded: false, message: 'Ask what they thought, in their words, and whether they are keen, would like a second viewing, may offer, or it is not for them; then call this again.' };
  const now = ctx.now();
  const ref = str(args.reference)?.replace(/[^a-z0-9]/gi, '').toUpperCase();
  const theirs = phone
    ? (await ctx.repo.listBookings(t.id, new Date(now.getTime() - 30 * DAY), now)).filter((b) => b.phone === phone && b.listing_key && b.ends_at <= now && (!ref || b.reference === ref))
    : [];
  const b = theirs.sort((x, y) => y.starts_at.getTime() - x.starts_at.getTime())[0];
  // Only their own viewing: anyone else's feedback, or a reference not on this number, is a message.
  if (!b) return { recorded: false, message: 'There is no past viewing on this number. Take their feedback as a message for the negotiator (category viewing).' };
  const l = t.profile.listings!.find((x) => x.key === b.listing_key)!;
  await ctx.repo.mergeBookingDetails(t.id, b.reference, { feedback: { category, words, source: 'caller', at: now.toISOString() }, awaiting_feedback: false }, `feedback from the buyer: ${category.replace(/_/g, ' ')}`, 'receptionist');
  ctx.action({ kind: 'booking_changed', title: `Feedback · ${shortAddress(l)}`, detail: `${FEEDBACK_WORDS[category]}: "${words}" · ref ${b.reference}`, data: { reference: b.reference } });
  return {
    recorded: true,
    property: shortAddress(l),
    next: category === 'not_for_me'
      ? "Thank them. Offer once to note what they're looking for, so we can tell them about other homes."
      : 'Offer a second viewing or to take an offer, once, without pressure.',
  };
}

/**
 * A buyer joins the agency's list: what they want, their position, and
 * alerts only if they said yes (asked, never assumed; the time is kept).
 * Their own other roles (a seller too) are kept.
 */
async function registerBuyer(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const t = ctx.tenant;
  const name = realName(args.name);
  if (!name) return { registered: false, message: ASK_NAME };
  // On 5 October a live call registered "cash buyers" on their name alone, before asking what they wanted or whether they had a home to sell.
  const searched = [args.areas, args.max_price, args.min_beds, args.types].some((v) => str(v) || int(v));
  if (!searched) return { registered: false, message: 'Not registered yet. Ask what they are looking for: where, their budget, bedrooms, anything they must have. Then call this again.' };
  if (!sellingOf(args.selling) && !bool(args.first_time_buyer)) return { registered: false, message: 'Not registered yet. Ask whether they have a home to sell (and if so whether it is on the market), and how they are paying. "Cash" with a home to sell is a chain. Then call this again.' };
  const alerts = bool(args.alerts);
  if (alerts === undefined) return { registered: false, message: 'Ask whether they would like a text when a home that matches comes on (never assume), then call this again with alerts.' };
  const phone = normaliseUkPhone(str(args.phone)) ?? ctx.callerPhone;
  if (!phone) return { registered: false, message: 'Ask for a mobile number, read it back, then call this again with phone.' };
  const places = { districts: t.profile.estate?.districts ?? [], towns: t.profile.estate?.towns ?? [] };
  const areaWords = strList(args.areas);
  // Districts as the agency writes them ("bk2" is BK2), towns by their own name, anything else as said.
  const areas = areaWords.flatMap((a) => {
    const d = districtsIn(a, places.districts);
    return d.length ? d : [places.towns.find((x) => x.toLowerCase() === a.trim().toLowerCase()) ?? a.trim()];
  });
  const max = poundsOf(args.max_price);
  const requirements = Object.fromEntries(Object.entries({
    areas: areas.length ? [...new Set(areas)] : undefined,
    max_price_pence: max ? max * 100 : undefined,
    min_beds: int(args.min_beds),
    types: strList(args.types).length ? strList(args.types) : undefined,
    must_haves: strList(args.must_haves).length ? strList(args.must_haves) : undefined,
    timescale: str(args.timescale),
  }).filter(([, v]) => v !== undefined)) as NonNullable<BuyerDetails['requirements']>;
  const all = await homesOf(ctx);
  const existing = await ctx.repo.findBuyer(t.id, phone);
  let backup: string[] | undefined;
  if (str(args.backup_for)) {
    const r = await resolveHome(ctx, args.backup_for);
    if ('reply' in r) return { registered: false, ...r.reply };
    backup = [...new Set([...(existing?.details.backup_for ?? []), r.home.listing.key])];
  }
  const position = positionOf(args);
  const email = str(args.email);
  await ctx.repo.upsertBuyer(t.id, phone, name, {
    roles: [...new Set([...(existing?.details.roles ?? []), 'buyer' as const])],
    position: { ...(existing?.details.position ?? {}), ...position },
    requirements,
    ...(backup ? { backup_for: backup } : {}),
    ...(bool(args.investor) ? { investor: true } : {}),
    ...(email ? { email } : {}),
    last_contact: ctx.now().toISOString(),
    source: existing?.details.source ?? 'phone',
  }, alerts);
  const wants = requirementsWords(requirements);
  const sent = await smsTo(ctx, phone, `${t.profile.name}: you're registered with us as a buyer, looking for ${wants}. ${alerts ? "We'll text you when a home that matches comes on. To stop these texts, call us." : 'We won\'t text you about new homes unless you ask us to.'} (Demo)`);
  ctx.action({ kind: 'buyer_registered', title: `Buyer registered · ${name}`, detail: `${wants}${alerts ? ' · alerts on' : ''}${backup ? ` · back-up buyer for ${backup.map((k) => shortAddress(byKey(all, k).listing)).join(', ')}` : ''}` });
  const found = matches({ ...requirements, types: requirements.types }, findable(all)).slice(0, 3).map((l) => brief(byKey(all, l.key)));
  const selling = position.selling ?? existing?.details.position?.selling;
  let next = found.length ? 'Offer these, or a viewing of one.' : 'Nothing matches now: say we will be in touch when something does.';
  if (selling === 'not_on_market' && !ctx.state.valuationOffered) {
    ctx.state.valuationOffered = true;
    next += ' Offer a free valuation of their own home, once, without pressure.';
  }
  return {
    registered: true, looking_for: wants, alerts: alerts ? 'on' : 'off', summary_text: sent ? 'sent by text' : undefined,
    backup_for: backup ? backup.map((k) => shortAddress(byKey(all, k).listing)) : undefined,
    matches: found, next: `${next} Never promise a first look for using our other services.`,
  };
}

/** Alerts off at once for the calling number, with one text to say so. */
async function stopAlerts(_args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const phone = ctx.callerPhone;
  if (!phone) return { stopped: false, message: 'There is no calling number: take a message (category data) with the number they want taken off.' };
  const existing = await ctx.repo.findBuyer(ctx.tenant.id, phone);
  if (!existing?.marketing_consent) return { stopped: true, say: "That number isn't getting alerts from us." };
  await ctx.repo.upsertBuyer(ctx.tenant.id, phone, null, { last_contact: ctx.now().toISOString() }, false);
  await smsTo(ctx, phone, `${ctx.tenant.profile.name}: we've stopped texting you about new homes, as you asked. (Demo)`);
  ctx.action({ kind: 'buyer_registered', title: 'Alerts stopped', detail: displayUkPhone(phone) });
  return { stopped: true, say: "Done: we've stopped the texts about new homes, and sent one text to confirm." };
}

const MILESTONE_WORDS: Record<string, string> = {
  memorandum_sent: 'memorandum of sale sent', solicitors_instructed: 'solicitors instructed', searches: 'searches back', survey: 'survey done',
  mortgage_offer: 'mortgage offer issued', enquiries_answered: 'enquiries answered', exchange: 'contracts exchanged', completion: 'completed',
};
const ROLE_WORDS: Record<string, string> = { buyer: 'the buyer', seller: 'the seller', buyer_solicitor: "the buyer's solicitor", seller_solicitor: "the seller's solicitor", chain_agent: 'an agent in the chain', broker: "the buyer's broker" };

/**
 * Where a sale has got to, told by who is calling (presets/estate-agent.md §4.3, M3): the
 * buyer or seller hears the milestones, the dates recorded and the keys; a solicitor on the
 * file the milestones, with requests going to the progressor; an agent in the chain the chain
 * line; a broker the agreed price and the memorandum date. Anyone else hears nothing.
 */
async function getSaleProgress(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const t = ctx.tenant;
  const refuse = (next = 'Offer a message for the team. Never say whether there is a sale, or who is in it.') => ({ verified: false, say: NOT_VERIFIED, next });
  if (ctx.state.verifyMisses >= 3) return refuse('No more tries this call: offer a message.');
  const r = await resolveHome(ctx, args.property);
  if ('reply' in r && r.reply.more_than_one) return { verified: false, ...r.reply };
  const phone = ctx.callerPhone;
  const key = 'reply' in r ? null : r.home.listing.key;
  const sale = key ? (await ctx.repo.listSales(t.id)).filter((x) => x.listing_key === key && x.status !== 'fell_through').at(-1) : undefined;
  let role: string | null = null;
  if (sale && phone) {
    if (sale.buyer_phone === phone) role = 'buyer';
    else if ((await ctx.repo.sellersOf(t.id, sale.listing_key)).some((x) => x.phone === phone)) role = 'seller';
    else role = sale.parties.find((p) => p.phone && normaliseUkPhone(p.phone) === phone)?.role ?? null;
  }
  if (!sale || !role || 'reply' in r) {
    ctx.state.verifyMisses++;
    return refuse();
  }
  if (!ctx.state.verified.some((v) => v.listing === sale.listing_key && v.role === role)) ctx.state.verified.push({ listing: sale.listing_key, role });
  const l = r.home.listing;
  const progressor = teamOf(t).find((m) => m.role === 'progressor') ?? teamOf(t).find((m) => m.does.includes('progression'));
  const dan = progressor?.first_name ?? 'the team';
  const done = sale.milestones.filter((m) => m.done_at).map((m) => MILESTONE_WORDS[m.key] ?? m.key);
  const toCome = sale.milestones.filter((m) => !m.done_at).map((m) => MILESTONE_WORDS[m.key] ?? m.key);
  const completionDone = sale.milestones.some((m) => m.key === 'completion' && m.done_at);
  const keys = sale.keys_released_at ? 'released'
    : sale.completion_date && sale.completion_date <= today(ctx) ? "waiting for the seller's solicitor to confirm completion"
    : 'released on completion day, once the seller\'s solicitor confirms completion';
  const base = { verified: true, role: ROLE_WORDS[role] ?? role, property: shortAddress(l) };
  const never = 'Never predict a date or outcome that isn\'t recorded.';
  if (role === 'buyer' || role === 'seller') {
    return {
      ...base, done, still_to_come: toCome,
      exchange: sale.status === 'exchanged' || done.includes(MILESTONE_WORDS.exchange) ? 'contracts have been exchanged'
        : sale.exchange_target ? `aiming to exchange on ${spokenDate(sale.exchange_target)}` : 'no exchange date recorded yet',
      completion: completionDone ? 'completed' : sale.completion_date ? `completion is set for ${spokenDate(sale.completion_date)}` : 'no completion date recorded yet',
      chain: sale.chain ?? undefined,
      keys,
      next: `${never} Anything they want chased is a message for ${dan} (category progression).`,
    };
  }
  if (role === 'buyer_solicitor' || role === 'seller_solicitor') {
    return { ...base, done, still_to_come: toCome, next: `Requests and paperwork go to ${dan}: take a message (category progression). ${never}` };
  }
  if (role === 'chain_agent') {
    return { ...base, chain: sale.chain ?? 'Nothing recorded about the chain.', next: `Their news is a message for ${dan} (category progression). ${never}` };
  }
  const memo = sale.milestones.find((m) => m.key === 'memorandum_sent' && m.done_at)?.done_at;
  return { ...base, agreed_price: poundsWhole(sale.agreed_pence), memorandum: memo ? `sent ${spokenDate(toLocal(new Date(memo), t.profile.timezone).date)}` : 'not sent yet', next: never };
}

const LINK_WORDS: [RegExp, Listing['links'][number]][] = [[/brochure|details|particular/, 'brochure'], [/floor/, 'floorplan'], [/video|tour/, 'video'], [/epc|energy/, 'epc']];
const LINK_LABEL: Record<Listing['links'][number], string> = { brochure: 'Brochure', floorplan: 'Floorplan', video: 'Video tour', epc: 'EPC' };

async function sendDetails(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const p = ctx.tenant.profile;
  const r = await resolveHome(ctx, args.property);
  if ('reply' in r) return { sent: false, ...r.reply };
  const l = r.home.listing;
  const asked = str(args.what)?.toLowerCase() ?? 'brochure';
  const wanted = /all|everything/.test(asked) ? l.links : LINK_WORDS.filter(([re]) => re.test(asked)).map(([, k]) => k);
  const want = wanted.length ? wanted : (['brochure'] as const).slice();
  const have = want.filter((k) => l.links.includes(k));
  const missing = want.filter((k) => !l.links.includes(k)).map((k) => LINK_LABEL[k].toLowerCase());
  if (!have.length) {
    return { sent: false, message: `There's no ${missing.join(' or ')} for this home yet.${l.links.length ? ` Offer the ${l.links.map((k) => LINK_LABEL[k].toLowerCase()).join(' or ')} instead.` : ''}` };
  }
  const phone = normaliseUkPhone(str(args.phone)) ?? ctx.callerPhone;
  if (!phone) return { sent: false, message: 'Ask for a mobile number to text it to, read it back, then call this again with phone.' };
  const site = (p.website ?? 'https://www.your-estate-agency.co.uk').replace(/\/+$/, '');
  const links = have.map((k) => `${LINK_LABEL[k]}: ${site}/property/${l.ref.toLowerCase()}/${k} (demo link)`).join(' ');
  const price = r.home.live.checking.includes('price') ? '' : `, ${priceOf(r.home)}`;
  await smsTo(ctx, phone, `${p.name}: ${l.address}${price}. ${links} (Demo)`);
  return { sent: true, to: displayUkPhone(phone), what: have, missing: missing.length ? `No ${missing.join(' or ')} for this home.` : undefined };
}

async function searchProperties(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const e = ctx.tenant.profile.estate;
  const all = await homesOf(ctx);
  const q = str(args.query);
  if (q) {
    const found = findListings(findable(all), q).map((l) => byKey(all, l.key));
    if (found.length) {
      noteSeen(ctx, found);
      // The one home asked for is gone: say so, and offer the closest homes still for sale, as get_property does.
      const gone = found.length === 1 && ['withdrawn', 'exchanged', 'completed'].includes(found[0].live.status);
      const alt = gone ? similar(found[0].listing, findable(all)).map((x) => brief(byKey(all, x.key))) : [];
      return {
        matches: found.slice(0, 3).map((h) => brief(h, false)),
        ...(alt.length ? { similar: alt } : {}),
        note: found.length > 1 ? 'More than one: ask which, then get_property.' : gone ? `Say it's ${STATUS_WORDS[found[0].live.status]}${alt.length ? ', and offer these instead' : ''}.` : 'Now get_property, and say its describe line first.',
      };
    }
  }
  const places = { districts: e?.districts ?? [], towns: e?.towns ?? [] };
  const said = q ? requirementsIn(q, places) : {};
  const max = poundsOf(args.max_price);
  const area = str(args.area);
  const areas = area ? [...districtsIn(area, places.districts), ...places.towns.filter((t) => area.toLowerCase().includes(t.toLowerCase()))] : [];
  const req: Requirements = {
    max_price_pence: max ? max * 100 : said.max_price_pence,
    min_beds: int(args.min_beds) ?? said.min_beds,
    types: str(args.type) ? [str(args.type)!] : said.types,
    areas: areas.length ? areas : area ? [area] : said.areas,
    must_haves: strList(args.must_have).length ? strList(args.must_have) : said.must_haves,
  };
  const asked = Object.values(req).some((v) => v !== undefined && (!Array.isArray(v) || v.length));
  if (!asked) {
    return {
      matches: [],
      note: q
        ? "None of our homes matches that. Check the street and number with the caller. If they say it's advertised as ours and it isn't one of these, it may be a scam: tell them not to send any money, and take an urgent message (category fraud)."
        : 'Ask which home, or what they are looking for.',
    };
  }
  const list = matches(req, findable(all)).map((l) => byKey(all, l.key));
  if (!list.length) return { matches: [], note: 'Nothing matches. Offer to take their details in a message, so the team can call when something comes in.' };
  noteSeen(ctx, list);
  return { matches: list.slice(0, 3).map((h) => brief(h)), note: list.length > 3 ? 'There are more: ask what matters most, to narrow it down.' : undefined };
}

// ── Declarations ──────────────────────────────────────────────────────────

const hasHomes = (t: Tenant) => Boolean(t.profile.listings && t.profile.estate);

export const ESTATE_TOOLS: Record<string, Tool> = {
  search_properties: {
    when: hasHomes,
    decl: {
      name: 'search_properties',
      description: 'Find our homes for sale, by what the caller said or by what they want. At most three. If more than one matches, ask which.',
      parameters: obj({
        query: S('A street, area, postcode district, reference or description, as the caller said it ("the one on Albion Road", "the three-bed on Mill Lane", "the one at 325")'),
        max_price: I('Budget in pounds'), min_beds: I('Fewest bedrooms'), type: S('house, flat, bungalow, semi, detached, terraced or cottage'),
        area: S('A town or postcode district'), must_have: S('garden, parking, no chain or step-free'),
      }),
    },
    handler: searchProperties,
  },
  find_party: {
    when: hasHomes,
    decl: {
      name: 'find_party',
      description: "Who the caller is to us, from their number: their viewings and valuations, portal enquiries, whether they're registered or sell with us, and a missed call from the team. Use it when they mention something they've booked or asked about before, or a missed call from us.",
      parameters: obj({}),
    },
    handler: findParty,
  },
  get_marketing_update: {
    when: hasHomes,
    decl: {
      name: 'get_marketing_update',
      description: "A seller's update on their own home: viewings, feedback and offers. It checks the calling number is the seller; if not, share nothing and offer a message.",
      parameters: obj({ property: S('The home, as the caller said it') }, ['property']),
    },
    handler: getMarketingUpdate,
  },
  get_offer_status: {
    when: hasHomes,
    decl: {
      name: 'get_offer_status',
      description: "Where the caller's own offer stands, as recorded. Only for the number it was made from.",
      parameters: obj({ property: S('The home, as the caller said it'), reference: S("The offer's reference, if they have it") }),
    },
    handler: getOfferStatus,
  },
  record_viewing_feedback: {
    when: hasHomes,
    decl: {
      name: 'record_viewing_feedback',
      description: "Note the caller's own feedback on a viewing they've had. It goes to the seller.",
      parameters: obj(
        { reference: S("The viewing's reference, if they have it; else their most recent"), category: S('keen, second viewing, likely offer, or not for me'), words: S('What they thought, in their words') },
        ['category', 'words'],
      ),
    },
    handler: recordViewingFeedback,
  },
  register_buyer: {
    when: hasHomes,
    decl: {
      name: 'register_buyer',
      description: "Put a buyer on our list once you know what they want (where, budget, bedrooms) and their position (anything to sell, how they're paying): texts about new homes only if they said yes. Returns up to three homes that match.",
      parameters: obj(
        {
          name: S("The buyer's name"), phone: S('Only if not the calling number'), email: S('If they give one'),
          areas: S('Towns or postcode districts, comma separated'), max_price: I('Budget in pounds'), min_beds: I('Fewest bedrooms'),
          types: S('house, flat, bungalow, semi, detached, terraced or cottage'), must_haves: S('garden, parking, no chain or step-free'), timescale: S('When they hope to move'),
          first_time_buyer: B('First-time buyer'), selling: S('nothing, not on the market, on the market, or under offer'), funding: S('mortgage agreed in principle, mortgage not yet, or cash'),
          aip_amount: I('Mortgage agreed in principle, in pounds'), alerts: B('They said yes to texts about new homes. Ask; never assume.'),
          backup_for: S('A home they would buy if its sale falls through'), investor: B('Buying to let or invest'),
        },
        ['name', 'alerts'],
      ),
    },
    handler: registerBuyer,
  },
  stop_alerts: {
    when: hasHomes,
    decl: { name: 'stop_alerts', description: 'Stop our texts about new homes to the calling number, at once.', parameters: obj({}) },
    handler: stopAlerts,
  },
  get_sale_progress: {
    when: hasHomes,
    decl: {
      name: 'get_sale_progress',
      description: "Where a sale has got to, for someone in it: the buyer, the seller, a solicitor on the file, an agent in the chain or the buyer's broker, checked by their number. Anyone else: share nothing.",
      parameters: obj({ property: S('The home, as the caller said it') }, ['property']),
    },
    handler: getSaleProgress,
  },
  get_property: {
    when: hasHomes,
    decl: {
      name: 'get_property',
      description: "Everything we can tell a caller about one of our homes: price, facts, what to say first, and what isn't in the details. Say only what it returns.",
      parameters: obj({ property: S('The home: its key from search_properties, or what the caller said') }, ['property']),
    },
    handler: getProperty,
  },
  send_property_details: {
    when: hasHomes,
    decl: {
      name: 'send_property_details',
      description: "Text the caller a home's brochure, floorplan, video tour or EPC.",
      parameters: obj({ property: S('The home'), what: S('brochure, floorplan, video, epc or all'), phone: S('Only if not the calling number') }, ['property']),
    },
    handler: sendDetails,
  },
  book_valuation: {
    when: (t) => Boolean(t.profile.estate && t.profile.booking?.services.some((s) => s.key === 'valuation')),
    decl: {
      name: 'book_valuation',
      description: "Book a free valuation of the caller's home, after reading back the day, time and address and hearing yes. Returns the reference. Never give a figure, nor repeat one the caller gives.",
      parameters: obj(
        {
          date: S('YYYY-MM-DD'), time: S('HH:MM'), name: S("The owner's name"), phone: S('Only if not the calling number'),
          address: S('First line of the address'), postcode: S("The home's postcode"),
          purpose: S('sale, probate, help to buy, staircasing, divorce, remortgage or curious'), also_selling: B('Another purpose, but they may sell too'),
          capacity: S('owner, executor, attorney, co-owner or lender'), owners_agree: B('Every owner knows'), property_type: S('e.g. semi, flat'),
          bedrooms: I('Bedrooms'), reason: S('Why they are thinking of moving'), timescale: S('When they hope to move'),
          other_agent: S('An agent they are with now, and for how long, or none'), needs_to_buy: B('They need to buy a home too'),
          heard_from: S('How they heard of us'), staff: S('A named valuer, if asked for'),
        },
        ['date', 'time', 'name', 'address', 'postcode'],
      ),
    },
    tailor: (d, t) => ({ ...d, description: d.description.replace('a free valuation', `a ${t.profile.estate?.valuations.name ?? 'free valuation'}`) }),
    handler: bookValuation,
  },
  record_offer: {
    when: hasHomes,
    decl: {
      name: 'record_offer',
      description: 'Record an offer on one of our homes, whatever the amount, position or status: the only way an offer reaches the seller. Then read back what it returns.',
      parameters: obj(
        {
          property: S('The home'), amount: I('The offer, in pounds'), buyer_names: S('Full names of everyone who will buy'),
          conditions: S('e.g. subject to survey, mortgage, selling their home, timing, fittings'), first_time_buyer: B('First-time buyer'),
          selling: S('nothing, not on the market, on the market, or under offer'), funding: S('mortgage agreed in principle, mortgage not yet, or cash'),
          aip_amount: I('Mortgage agreed in principle, in pounds'), solicitor: S('Their solicitor, if they have one'),
          company_or_trust: B('Buying through a company or trust'), gifted_deposit: B('Part of the deposit is a gift'),
          viewed_with: S('Another agent they viewed it with, or no'), revises: S("An earlier offer's reference, when this raises or changes it"),
          email: S('For the written confirmation'), phone: S('Only if not the calling number'),
        },
        ['property', 'amount', 'buyer_names'],
      ),
    },
    handler: recordOffer,
  },
};

/** The shared tools' extra parameters at an estate agency: a viewing names its home, and a booking takes the buyer's position. */
export function estateParams(decl: FunctionDeclaration, t: Tenant, tool: 'check' | 'book' | 'message' | 'hours'): FunctionDeclaration {
  if (!t.profile.estate) return decl;
  const params = decl.parameters as { properties: Record<string, unknown>; required?: string[] };
  const p = { ...params.properties };
  let description = decl.description;
  if (tool === 'check' || tool === 'book') {
    delete p.party_size;
    p.service = S(`${(t.profile.booking?.services ?? []).map((s) => s.label).join(', ')}; default viewing`);
    p.staff = S('A member of the team, if the caller asks for one');
    p.property = S('The home to view: its key from search_properties, or what the caller said. Needed for a viewing.');
  }
  if (tool === 'check') {
    p.postcode = S("A valuation: the home's postcode");
    description = 'Free times for a viewing (with the property), a valuation or a mortgage appointment. Without a time, the whole day. If taken, the nearest alternatives.';
  }
  if (tool === 'book') {
    Object.assign(p, {
      email: S('Their email, if they give one'), postcode: S('Their own home postcode'), first_time_buyer: B('First-time buyer'),
      selling: S('nothing, not on the market, on the market, or under offer'), funding: S('mortgage agreed in principle, mortgage not yet, or cash'),
    });
    description = 'Book a viewing (or a mortgage appointment), after reading it back and hearing yes. The only way a booking exists. Returns the reference. Valuations: book_valuation.';
  }
  if (tool === 'message') {
    Object.assign(p, {
      for: S('A first name, or manager, negotiator, valuer, progressor or on call'),
      category: S(`One of: ${CATEGORIES.join(', ')}`), urgency: S('urgent, today or this week'), property: S('The home it is about, if any'),
    });
    description = 'A message for one person in the team, with what it is about and how soon. Urgent ones reach them by text.';
  }
  if (tool === 'hours') description = 'Office, viewing and valuation hours for a date, or the next 7 days.';
  const required = tool === 'book' ? ['date', 'time', 'name'] : params.required;
  return { ...decl, description, parameters: { ...params, properties: p, ...(required ? { required } : {}) } } as FunctionDeclaration;
}
