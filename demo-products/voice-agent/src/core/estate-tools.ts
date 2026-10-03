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
import { ASK_NAME, B, I, S, bool, int, obj, postcodeOf, realName, record, smsTo, str, strList } from './tool-kit.ts';
import { newBookingReference, spokenReference } from '../db/repo.ts';
import { candidateTimes, checkAvailability, checkSlot, durationFor, findService, type AvailabilityResult, type SlotRequest } from '../domain/availability.ts';
import {
  STATUS_WORDS, UNSAYABLE, addWorkingDays, clause, districtsIn, facts, findListings, firstViewingDate, homeKind, initialLive, insideRule, matches,
  offerReceivedText, poundsWhole, priceWords, requirementsIn, sayFirst, shortAddress, similar, positionBadges, unsaid, viewingRules, viewingText,
  type ListingLive, type Requirements,
} from '../domain/listings.ts';
import { displayUkPhone, normaliseUkPhone } from '../domain/phone.ts';
import { dayName, isIsoDate, minutesOf, spokenDate, spokenTime, toLocal, weekdayOf } from '../domain/time.ts';
import type { BookableService, Booking, BuyerPosition, Funding, Listing, Selling, StaffMember, Tenant } from '../domain/types.ts';

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

/** A home in one line, as a list of matches gives it: never its seller, whether anyone lives there, or keys. */
const brief = (h: Home) => ({ property: h.listing.key, says: `${shortAddress(h.listing)}: ${homeKind(h.listing)}`, price: priceOf(h), status: STATUS_WORDS[h.live.status] });

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
  if (found.length > 1) return { reply: { more_than_one: found.slice(0, 3).map((l) => brief(byKey(all, l.key))), next: 'More than one: ask which.' } };
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
    s.toolFlags.push({ rule: 'disclosure_missed', text: `${shortAddress(l)}: ${missing.map((i) => i.say).join(' ')}` });
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
  const no = excludedStaff(ctx, h, str(args.staff));
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
export async function estateMessage(args: Args, ctx: ToolContext): Promise<Record<string, unknown> | null> {
  const t = ctx.tenant;
  const p = t.profile;
  if (!p.team) return null;
  const phone = normaliseUkPhone(str(args.phone)) ?? ctx.callerPhone;
  const body = str(args.message) ?? '';
  const name = str(args.name) ?? 'Unknown';
  const category = categoryOf(args.category);
  const urgency = urgencyOf(args.urgency, category);
  let home: Listing | null = null;
  if (str(args.property)) {
    const r = await resolveHome(ctx, args.property);
    if ('home' in r) home = r.home.listing;
  }
  const to = messageFor(t, str(args.for), category, home);
  const first = to?.first_name ?? 'the team';
  const complaint = category === 'complaint';
  const quiet = category === 'compliance';
  const reference = complaint ? newBookingReference() : null;
  const nation = p.estate?.nation ?? 'england';
  const day = today(ctx);
  await ctx.repo.addMessage({
    tenant_id: t.id, call_id: ctx.callId, kind: 'message', from_name: name, from_phone: phone, body, status: 'new',
    for_staff: to?.key ?? null, category, urgency, reference,
    details: {
      ...(home ? { listing: home.key } : {}),
      ...(complaint ? { acknowledge_by: addWorkingDays(day, 3, nation), final_by: addWorkingDays(day, 15, nation) } : {}),
      ...(quiet ? { private: true } : {}),
    },
  });
  ctx.state.messageTaken = true;
  ctx.action({
    kind: 'message_taken', title: quiet ? 'Private note' : `Message for ${first} from ${name}`,
    detail: quiet ? 'Private: in Messages' : `${body}${phone ? ` · ${displayUkPhone(phone)}` : ''}`,
  });
  if (quiet) return { taken: true, note: "Say only that you've noted it. Never repeat it, and never say who it is for." };
  if (urgency === 'urgent' && to?.mobile) {
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
  if (urgency === 'urgent') return { taken: true, for: first, note: `Tell them you've sent ${first} an urgent message. Never say where ${first} is.` };
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
    next: 'Read back read_back and the reference one character at a time, then say. Never hint at the answer, comment on the amount, or mention any other offer.',
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
  return scrub({
    property: l.key, address: l.address, status: STATUS_WORDS[live.status], price: priceOf(h), price_note: priceNote, on_market: onMarket,
    facts: f.facts,
    unknown: f.unknown.length ? f.unknown : undefined,
    being_checked: f.being_checked.length ? f.being_checked : undefined,
    say_first: sayFirst(l, live, day, start, tz).map((i) => i.say),
    before_offer: l.before_offer.map((i) => i.say),
    viewing: l.viewing.rule,
    seller_position: l.seller_position || undefined,
    fell_through: l.fall_through || undefined,
    official: Object.keys(official).length ? official : undefined,
    negotiator,
    links: l.links,
    note: [
      f.unknown.length ? `Unknown: say it isn't in the details (never "no"), name any official service, and offer to ask ${negotiator}.` : '',
      f.being_checked.length ? 'Being checked: say so, and state nothing about them.' : '',
    ].filter(Boolean).join(' ') || undefined,
  });
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
  await smsTo(ctx, phone, `${p.name}: ${l.address}, ${priceOf(r.home)}. ${links} (Demo)`);
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
      return { matches: found.slice(0, 3).map(brief), note: found.length > 1 ? 'More than one: ask which.' : undefined };
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
  return { matches: list.slice(0, 3).map(brief), note: list.length > 3 ? 'There are more: ask what matters most, to narrow it down.' : undefined };
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
      description: "Book a free valuation of the caller's home, after reading back the day, time and address and hearing yes. Returns the reference. Never give a figure.",
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
