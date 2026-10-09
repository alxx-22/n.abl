// A barber's deposit and notice on a call (presets/barber.md §4.4, rule 3):
// cancelling or moving inside the notice period keeps the deposit under the
// shop's policy, said once before it happens and never more than the
// deposit, never "by law" (barber-use-cases.md, "Checked for gaps"). Only a
// profile with `barber` gets any of this.

import type { FunctionDeclaration } from './live.ts';
import { findService } from '../domain/availability.ts';
import { addDays, isIsoDate, minutesOf, spokenDate, spokenTime, toLocal, zonedToUtc } from '../domain/time.ts';
import { SKIN_TEST_KEY, SKIN_TEST_HOURS, profileOn, skinTestFor, waitNow, type ShopToday, type WaitlistEntry } from '../domain/shop-floor.ts';
import { normaliseUkPhone } from '../domain/phone.ts';
import { pounds, type BookableService, type Booking, type Tenant } from '../domain/types.ts';
import type { Repo } from '../db/repo.ts';
import { ASK_NAME, I, S, int, obj, realName, smsTo, str } from './tool-kit.ts';
import type { Args, Tool, ToolContext } from './tools.ts';

/** "£5", as said: no pence when there are none. */
const spokenPounds = (pence: number) => pounds(pence).replace(/\.00$/, '');
const insideNotice = (ctx: ToolContext, b: Booking) =>
  (b.starts_at.getTime() - ctx.now().getTime()) / 3600000 < (ctx.tenant.profile.barber?.notice_hours ?? 0);

/**
 * Before cancelling or moving a booking whose deposit is paid, inside the
 * notice period: not done yet, once, so the caller hears the deposit is kept
 * before deciding. Null when there is nothing to say.
 */
export async function noticeFirst(ctx: ToolContext, reference: string, action: 'cancel' | 'move'): Promise<Record<string, unknown> | null> {
  const bb = ctx.tenant.profile.barber;
  if (!bb || !reference) return null;
  const b = await ctx.repo.getBookingByReference(ctx.tenant.id, reference);
  if (!b || b.status !== 'confirmed' || !b.deposit_paid || !b.deposit_pence || !insideNotice(ctx, b)) return null;
  const gate = `notice:${b.reference}:${action}`;
  if (ctx.state.gateAsked.includes(gate)) return null;
  ctx.state.gateAsked.push(gate);
  const doing = action === 'cancel' ? 'cancel' : 'move it';
  // Words to say as they are: a live call turned "the deposit is kept" into "you'll keep the deposit", the opposite.
  return {
    [action === 'cancel' ? 'cancelled' : 'changed']: false,
    say: `As it's less than ${bb.notice_hours} hours away, your ${spokenPounds(b.deposit_pence)} deposit is kept by the shop if you ${doing}. Do you still want to ${doing}?`,
    message: `Not done yet. Say "say" once, as it is: the shop's policy, never more than the deposit, never "by law". If they still want to, call ${action === 'cancel' ? 'cancel_booking' : 'modify_booking'} again.`,
  };
}

/** What happens to a paid deposit when a booking is cancelled: kept inside the notice, refunded outside it. */
export function depositOnCancel(ctx: ToolContext, b: Booking): string | undefined {
  if (!ctx.tenant.profile.barber || !b.deposit_paid || !b.deposit_pence) return undefined;
  return insideNotice(ctx, b)
    ? `Your ${spokenPounds(b.deposit_pence)} deposit is kept by the shop, under its policy.`
    : `Your ${spokenPounds(b.deposit_pence)} deposit is refunded (in the demo, no money moves).`;
}

/** A service's price as said: "from £25.00" when that is where it starts. */
export const servicePrice = (s: BookableService) => (s.price_pence ? `${s.price_from ? 'from ' : ''}${pounds(s.price_pence)}` : undefined);

/**
 * One person, one service, one chair. In a live test three haircuts went in
 * as one classic cut for three, and a call that named no service took the
 * first on the price list. Null when the request is fine.
 */
export function oneEach(ctx: ToolContext, service: string | undefined, party: number, key: 'available' | 'booked'): Record<string, unknown> | null {
  const p = ctx.tenant.profile;
  if (!p.barber) return null;
  if (party > 1) {
    return { [key]: false, message: 'Each person is their own booking with a barber, with their own service: check and book them one at a time (one after another with one barber, create_booking with after set to the booking before; or at the same time with two). Ask what each person is having if they have not said.' };
  }
  const services = p.booking?.services ?? [];
  if (!service && services.length > 1) return { [key]: false, message: `Which service? Ask what they are having: ${services.map((s) => s.label).join(', ')}.` };
  return null;
}

/** After the times: read back the service, the barber, when and the price, then book. A live test said the price nowhere; another said "booked" with no booking. */
export function readBackFirst(ctx: ToolContext, service: BookableService, barber?: string): string | undefined {
  if (!ctx.tenant.profile.barber) return undefined;
  const price = servicePrice(service);
  // A live test moving a booking took "book with create_booking" at its word and left the old one standing.
  const moving = ctx.state.found.length ? ' To move a booking they already have, use modify_booking with its reference instead, never a new booking.' : '';
  return `Read back the ${service.label.toLowerCase()}${barber ? ` with ${barber}` : ''}, the day, the time${price ? ` and the price (${price})` : ''}, and book with create_booking when they say yes.${moving} Nothing is booked and there is no reference until create_booking returns one.`;
}

/** After booking: the deposit by the demo card, or in the shop when the shop does not insist. */
export function depositNext(ctx: ToolContext, b: Booking): string | undefined {
  const bb = ctx.tenant.profile.barber;
  if (!bb || !b.deposit_pence || b.deposit_paid) return undefined;
  return bb.deposit_required
    ? `The ${pounds(b.deposit_pence)} deposit is needed to hold it: take it now with take_demo_payment (for "deposit").`
    : `Offer the ${pounds(b.deposit_pence)} deposit now by card with take_demo_payment (for "deposit"). If they would rather pay in the shop, that is fine: the booking stands.`;
}

/** create_booking's `after`, for a barber: the next person straight after, with the same barber. */
export function barberParams(decl: FunctionDeclaration, t: Tenant): FunctionDeclaration {
  if (!t.profile.barber) return decl;
  const p = { ...(decl.parameters as { properties: Record<string, unknown> }).properties };
  p.after = S('Reference of a booking made in this call: book straight after it, with the same barber (date, time and barber come from it)');
  return { ...decl, parameters: { ...(decl.parameters as object), properties: p } } as FunctionDeclaration;
}

/**
 * Booking straight after another (presets/barber.md §4.2): the date, time
 * and barber from the booking it follows, so two kids go back to back.
 */
export async function followOn(ctx: ToolContext, args: Args): Promise<{ args?: Args; refusal?: Record<string, unknown> } | null> {
  const ref = str(args.after);
  if (!ctx.tenant.profile.barber || !ref) return null;
  const b = await ctx.repo.getBookingByReference(ctx.tenant.id, ref.replace(/[^a-z0-9]/gi, '').toUpperCase());
  if (!b || b.status !== 'confirmed') return { refusal: { booked: false, message: `No booking ${ref} to follow. Book a time from check_availability instead.` } };
  const end = toLocal(b.ends_at, ctx.tenant.profile.timezone);
  return { args: { date: end.date, time: end.time, staff: b.resource_key } };
}

/** The confirmation for a call's bookings to one number, in one text (presets/barber.md §4.5). */
export function barberText(t: Tenant, bookings: Booking[]): string {
  const p = t.profile;
  const line = (b: Booking) => {
    const local = toLocal(b.starts_at, p.timezone);
    const s = findService(p, b.service_key);
    const price = s ? servicePrice(s) : undefined;
    const r = p.booking?.resources.find((x) => x.key === b.resource_key);
    return `${spokenDate(local.date)} ${spokenTime(local.time)}, ${s?.label ?? b.service_key}${price ? ` (${price})` : ''}${r ? ` with ${r.label}` : ''}, ref ${b.reference}`;
  };
  const due = bookings.filter((b) => b.deposit_pence && !b.deposit_paid);
  const deposit = !due.length ? ''
    : !p.barber?.deposit_required ? ` The ${pounds(due[0].deposit_pence!)} deposit${due.length > 1 ? 's are' : ' is'} optional: pay ${due.length > 1 ? 'them' : 'it'} by card ahead, or all in the shop.`
    : due.length === bookings.length ? ` Deposit ${pounds(due[0].deposit_pence!)}${due.length > 1 ? ' each' : ''} due.`
    : ` Deposit due on ${due.map((b) => b.reference).join(' and ')}.`;
  const notice = p.barber?.notice_hours ? ` Free to cancel or move with ${p.barber.notice_hours} hours' notice.` : '';
  const one = bookings.length === 1;
  return `${p.name}: Booked: ${bookings.map(line).join('; ')}.${deposit}${notice} To change ${one ? 'it' : 'one'}, call us and quote ${one ? 'your' : 'its'} reference. (Demo)`;
}

/** A barber's booking text waits for the call to end, so a family's three cuts come in one text. */
export function holdText(ctx: ToolContext, b: Booking, phone: string | null): 'held' | null {
  if (!phone) return null;
  if (!ctx.state.textsHeld.includes(b.reference)) ctx.state.textsHeld.push(b.reference);
  return 'held';
}

/** At the end of the call (end_call, or the caller hanging up): one text to each number for its bookings still standing. */
export async function sendHeldTexts(ctx: ToolContext): Promise<void> {
  const refs = ctx.state.textsHeld.splice(0);
  if (!refs.length) return;
  const byPhone = new Map<string, Booking[]>();
  for (const ref of refs) {
    const b = await ctx.repo.getBookingByReference(ctx.tenant.id, ref);
    if (!b || b.status !== 'confirmed' || !b.phone) continue;
    byPhone.set(b.phone, [...(byPhone.get(b.phone) ?? []), b]);
  }
  for (const [phone, list] of byPhone) {
    list.sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime());
    await smsTo(ctx, phone, barberText(ctx.tenant, list));
  }
}

/**
 * A new booking beside one found in this call: a move, most likely, not a
 * second cut. A live test booked Saturday for a caller moving Wednesday's and
 * left Wednesday's standing. Asked once for each booking found.
 */
export async function secondBooking(ctx: ToolContext): Promise<Record<string, unknown> | null> {
  const p = ctx.tenant.profile;
  if (!p.barber) return null;
  for (const ref of ctx.state.found) {
    const gate = `second:${ref}`;
    if (ctx.state.gateAsked.includes(gate)) continue;
    const b = await ctx.repo.getBookingByReference(ctx.tenant.id, ref);
    if (!b || b.status !== 'confirmed' || b.starts_at <= ctx.now()) continue;
    ctx.state.gateAsked.push(gate);
    const local = toLocal(b.starts_at, p.timezone);
    const what = findService(p, b.service_key)?.label.toLowerCase() ?? 'booking';
    return {
      booked: false,
      message: `Not booked yet: they already have ${b.reference}, a ${what} on ${spokenDate(local.date)} at ${spokenTime(local.time)}. To move it, use modify_booking with ${b.reference} and the new date and time, never a new booking. Only if they want another appointment as well, call create_booking again.`,
    };
  }
  return null;
}

/** A question asking leave to do it ("Shall I change that for you?"), at the end of what was just said. */
const ASKED = /(?:\b(?:shall|should|can) i (?:go ahead|book|change|move|cancel|do|make|put)\b|\b(?:do you want|would you like) me to (?:book|change|move|cancel)\b|\bis that (?:all )?(?:right|correct|ok(?:ay)?)\b|\bdoes that (?:all )?(?:sound|look) (?:right|good)\b)[^?]*\?\s*$/i;

/**
 * Asked and done in the same breath, before the answer: not yet. A live
 * test (9 October) asked "Shall I change that for you?" and moved the
 * booking without waiting for the yes.
 */
export function waitForYes(ctx: ToolContext, key: 'booked' | 'changed' | 'cancelled'): Record<string, unknown> | null {
  if (!ctx.tenant.profile.barber || !ASKED.test(ctx.state.turnSaid.trim())) return null;
  return { [key]: false, message: 'Not done yet: you have just asked them, and they have not answered. Stop and wait for their answer; on yes, call this again.' };
}

/** The deposit on a barber's booking, as the tools say it: optional unless the shop insists (a live test called an optional one "due now"). */
export function depositFields(ctx: ToolContext, b: Booking): Record<string, string> {
  const bb = ctx.tenant.profile.barber;
  if (!bb || !b.deposit_pence || b.deposit_paid) return {};
  return bb.deposit_required ? { deposit_due: pounds(b.deposit_pence) } : { deposit_optional: `${pounds(b.deposit_pence)}: by card now if they like, or nothing until the shop` };
}

/**
 * A cancellation frees a slot: the first on that day's waiting list it fits
 * (their service, with their barber or any) is texted, once (presets/barber.md
 * §4.2). From a call's cancel_booking and from the back office alike.
 */
export async function offerFreedSlot(repo: Repo, t: Tenant, b: Booking, text: (to: string, body: string) => Promise<unknown>, now: Date): Promise<WaitlistEntry | null> {
  const p = t.profile;
  if (!p.barber || b.starts_at <= now) return null;
  const local = toLocal(b.starts_at, p.timezone);
  const freed = (b.ends_at.getTime() - b.starts_at.getTime()) / 60000;
  const chair = p.booking?.resources.find((x) => x.key === b.resource_key);
  const fits = (e: WaitlistEntry) => {
    if (e.date !== local.date || e.notified_at || !e.phone || (e.resource_key && e.resource_key !== b.resource_key)) return false;
    const s = findService(p, e.service_key);
    return Boolean(s && (s.duration_minutes ?? 0) <= freed && (!chair || chair.services.includes(s.key)));
  };
  const first = (await repo.listWaitlist(t.id, local.date)).find(fits);
  if (!first) return null;
  const what = findService(p, first.service_key)?.label.toLowerCase() ?? 'appointment';
  await text(first.phone!, `${p.name}: a slot's come up on ${spokenDate(local.date)} at ${spokenTime(local.time)}${chair ? ` with ${chair.label}` : ''}, for your ${what}. Call us to book it: the first to call gets it. (Demo)`);
  await repo.markWaitlistNotified(t.id, first.id, now);
  return first;
}

/** Today in the shop, read on every tool call so a switch in the back office takes effect at once. Null for anyone but a barber. */
export async function shopToday(ctx: ToolContext): Promise<ShopToday | null> {
  if (!ctx.tenant.profile.barber) return null;
  return ctx.repo.getToday(ctx.tenant.id, toLocal(ctx.now(), ctx.tenant.profile.timezone).date);
}

/** The tenant as it stands on a date: a barber off today isn't booked today. */
export function tenantOn(ctx: ToolContext, shop: ShopToday | null, date: string): Tenant {
  if (!shop) return ctx.tenant;
  const profile = profileOn(ctx.tenant.profile, date, shop);
  return profile === ctx.tenant.profile ? ctx.tenant : { ...ctx.tenant, profile };
}

/** The barber a caller named, by name or nickname. */
function barberNamed(t: Tenant, name: string | undefined) {
  const n = name?.trim().toLowerCase();
  if (!n) return undefined;
  return t.profile.booking?.resources.find((r) => r.kind === 'staff' && (r.key === n || r.label.toLowerCase() === n || (r.aliases ?? []).some((a) => a.toLowerCase() === n)));
}

/**
 * A named barber off today, asked for today: say they're off today, never
 * why, and offer who is in (presets/barber-use-cases.md, "A barber who
 * doesn't work there, or is off"). Null otherwise.
 */
export function offToday(ctx: ToolContext, shop: ShopToday | null, staff: string | undefined, date: string, key: 'available' | 'booked' | 'changed'): Record<string, unknown> | null {
  const r = barberNamed(ctx.tenant, staff);
  if (!shop || !r || date !== shop.date || !shop.off.includes(r.key)) return null;
  const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
  const inToday = (ctx.tenant.profile.booking?.resources ?? []).filter((x) => x.kind === 'staff' && !shop.off.includes(x.key) && (!x.days || x.days.includes(wd))).map((x) => x.label);
  return {
    [key]: false, reason: 'off_today',
    message: `${r.label}'s off today. Say just that, never why. ${inToday.length ? `In today: ${inToday.join(', ')}; offer them, or ${r.label} on another day.` : `Offer ${r.label} on another day.`}`,
  };
}

/**
 * Colour needs a skin test here 48 hours or more before (presets/barber.md
 * §4.2): one taken or booked, and for `every_time`, since the last colour.
 * Without one, the test is booked first. Null when the colour can go ahead
 * (or the time isn't known yet and a test is in hand).
 */
export async function skinTestFirst(
  ctx: ToolContext, service: BookableService, date: string, time: string | undefined, phone: string | null, key: 'available' | 'booked' | 'changed', moving?: string,
): Promise<Record<string, unknown> | null> {
  const bb = ctx.tenant.profile.barber;
  if (!bb || !service.colour) return null;
  const tz = ctx.tenant.profile.timezone;
  // A colour being moved isn't the last colour before itself.
  const mine = phone ? (await ctx.repo.listBookingsByPhone(ctx.tenant.id, phone)).filter((b) => b.reference !== moving) : [];
  const taken = phone ? await ctx.repo.getSkinTest(ctx.tenant.id, phone) : null;
  const tests = [...(taken ? [taken] : []), ...mine.filter((b) => b.service_key === SKIN_TEST_KEY && b.visit_status !== 'no_show').map((b) => b.starts_at)];
  const start = time ? zonedToUtc(date, time, tz) : zonedToUtc(date, '23:59', tz);
  const lastColour = mine.filter((b) => b.starts_at < start && b.visit_status !== 'no_show' && findService(ctx.tenant.profile, b.service_key)?.colour).at(-1)?.starts_at ?? null;
  const r = skinTestFor(bb.skin_test, start, tests, lastColour);
  if (r.ok) return null;
  const say = 'The dye maker says a skin test 48 hours before colour; say that as the reason, and never that colour is safe. One done elsewhere does not count.';
  if (r.earliest) {
    const e = toLocal(r.earliest, tz);
    return { [key]: false, reason: 'skin_test_too_close', message: `Not then: their skin test is less than ${SKIN_TEST_HOURS} hours before. The colour can be from ${spokenDate(e.date)} at ${spokenTime(e.time)}; offer a time from then with check_availability. ${say}` };
  }
  return {
    [key]: false, reason: 'skin_test_needed',
    message: `Colour needs a skin test here first, at least ${SKIN_TEST_HOURS} hours before${bb.skin_test === 'every_time' ? ', every time' : ''}. Book the skin test now (service "Skin test": 10 minutes, free), then the colour at least ${SKIN_TEST_HOURS} hours after it. ${say}`,
  };
}

/** Their barber off today, on a booking they asked about: another barber today or another day, never why. */
export async function offTodayNote(ctx: ToolContext, found: Booking[]): Promise<string | undefined> {
  const shop = await shopToday(ctx);
  if (!shop?.off.length) return undefined;
  const tz = ctx.tenant.profile.timezone;
  const hit = found.find((b) => toLocal(b.starts_at, tz).date === shop.date && shop.off.includes(b.resource_key));
  if (!hit) return undefined;
  const who = ctx.tenant.profile.booking?.resources.find((r) => r.key === hit.resource_key)?.label ?? 'Their barber';
  return `${who} is off today, so ${hit.reference} needs a new time. Say ${who}'s off today, never why, and offer another barber today (check_availability) or ${who} another day; change it with modify_booking on yes.`;
}

const servicesSaid = (t: Tenant) => (t.profile.booking?.services ?? []).map((s) => s.label).join(', ');
const barbersSaid = (t: Tenant) => (t.profile.booking?.resources ?? []).filter((r) => r.kind === 'staff').map((r) => r.label).join(', ');

/** A barber's tools for the shop floor (presets/barber.md §4.3, M2): the wait now, the waiting list, running late. */
export const BARBER_TOOLS: Record<string, Tool> = {
  get_wait_now: {
    when: (t) => Boolean(t.profile.barber?.walk_ins),
    decl: {
      name: 'get_wait_now',
      description: "The walk-in wait right now, by barber, for a service: who could start it soonest, after whoever is in the chair and the walk-ins already waiting. Today only. An estimate: only a booking holds a chair.",
      parameters: obj({ service: S('e.g. "skin fade"; leave out for a classic cut'), staff: S('A barber, if they asked for one') }),
    },
    async handler(args, ctx) {
      const p = ctx.tenant.profile;
      const now = ctx.now();
      const local = toLocal(now, p.timezone);
      const shop = (await shopToday(ctx))!;
      const service = str(args.service) ? findService(p, str(args.service)) : p.booking?.services.find((s) => s.key !== SKIN_TEST_KEY);
      if (!service) return { message: `Not on our price list. Services: ${servicesSaid(ctx.tenant)}.` };
      const named = barberNamed(ctx.tenant, str(args.staff));
      if (str(args.staff) && !named) return { reason: 'unknown_staff', message: `There's no ${str(args.staff)} here. Barbers: ${barbersSaid(ctx.tenant)}.` };
      const off = offToday(ctx, shop, named?.label, local.date, 'available');
      if (off) return off;
      const queue = await ctx.repo.listWaitingWalkIns(ctx.tenant.id);
      const all = waitNow({ profile: p, now, date: local.date, nowMinutes: minutesOf(local.time), serviceKey: service.key, existing: await ctx.repo.busyForDate(ctx.tenant, local.date), queue, today: shop });
      const mine = named ? all.filter((x) => x.resource_key === named.key) : all;
      if (!mine.length) {
        return { service: service.label, free_today: false, message: `${named ? `${named.label} has` : 'There is'} no chair free for a walk-in for the rest of today.`, next: 'Offer to book another day with check_availability.' };
      }
      const first = mine[0];
      return {
        service: service.label, waiting_now: queue.length,
        soonest: mine.slice(0, 3).map((x) => ({ with: x.with, from: spokenTime(x.free_at), minutes: x.minutes })),
        ...(shop.notice ? { notice: shop.notice } : {}),
        next: `Say ${first.minutes ? `it's about ${first.minutes} minutes, with ${first.with}` : `${first.with} is free now`}, as an estimate, and that only a booking holds a chair. Offer to book that time (check_availability, then create_booking).`,
      };
    },
  },

  join_waiting_list: {
    when: (t) => Boolean(t.profile.barber),
    decl: {
      name: 'join_waiting_list',
      description: "Put the caller on a day's waiting list for a cancellation, when no time that day suits them (after check_availability). Not a booking: if a slot comes up they get a text, and the first to call gets it.",
      parameters: obj(
        { date: S('YYYY-MM-DD'), service: S('The service they want'), staff: S('A barber, or leave out for any'), name: S("Caller's name"), phone: S('Only if not the calling number') },
        ['date', 'service', 'name'],
      ),
    },
    async handler(args, ctx) {
      const p = ctx.tenant.profile;
      const today = toLocal(ctx.now(), p.timezone).date;
      const date = str(args.date) ?? '';
      const horizon = p.booking?.services[0]?.horizon_days ?? 28;
      if (!isIsoDate(date) || date < today || date > addDays(today, horizon)) return { added: false, message: `A day from today to ${horizon} days ahead, as YYYY-MM-DD.` };
      const service = findService(p, str(args.service));
      if (!service) return { added: false, message: `Not on our price list. Services: ${servicesSaid(ctx.tenant)}.` };
      const named = barberNamed(ctx.tenant, str(args.staff));
      if (str(args.staff) && !named && !/^any/i.test(str(args.staff)!)) return { added: false, message: `There's no ${str(args.staff)} here. Barbers: ${barbersSaid(ctx.tenant)}.` };
      const name = realName(args.name);
      if (!name) return { added: false, message: ASK_NAME };
      const phone = normaliseUkPhone(str(args.phone)) ?? ctx.callerPhone;
      if (!phone) return { added: false, message: 'A mobile number is needed, for the text if a slot comes up. Ask for it, digit by digit.' };
      const already = (await ctx.repo.listWaitlist(ctx.tenant.id, date)).find((e) => e.date === date && e.phone === phone && e.service_key === service.key);
      const who = named ? ` with ${named.label}` : ', any barber';
      if (!already) {
        await ctx.repo.addToWaitlist(ctx.tenant.id, { date, service_key: service.key, resource_key: named?.key ?? null, name, phone, source: ctx.channel, call_id: ctx.callId });
        ctx.action({ kind: 'note', title: 'Waiting list', detail: `${name} · ${service.label} · ${spokenDate(date)}${who}` });
      }
      return {
        added: true, spoken_date: spokenDate(date),
        message: `On the waiting list for ${spokenDate(date)}, ${service.label.toLowerCase()}${who}. Tell them it isn't a booking: if a slot comes up they'll get a text, and the first to call gets it.`,
      };
    },
  },

  running_late: {
    when: (t) => Boolean(t.profile.barber),
    decl: {
      name: 'running_late',
      description: "A caller running late for today's booking: notes it for the barber and says whether the booking is kept. Find the booking first (find_bookings).",
      parameters: obj({ reference: S('Booking reference'), minutes: I('How many minutes late'), note: S('Anything for the barber') }, ['reference', 'minutes']),
    },
    async handler(args, ctx) {
      const p = ctx.tenant.profile;
      const now = ctx.now();
      const b = await ctx.repo.getBookingByReference(ctx.tenant.id, (str(args.reference) ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase());
      const date = b ? toLocal(b.starts_at, p.timezone).date : '';
      if (!b || b.status !== 'confirmed' || date !== toLocal(now, p.timezone).date || b.ends_at <= now) {
        return { noted: false, message: "No booking today with that reference. Find theirs with find_bookings; if it's another day, they aren't late." };
      }
      const minutes = Math.min(180, Math.max(0, int(args.minutes) ?? 0));
      if (!minutes) return { noted: false, message: 'Ask how many minutes late they think they will be.' };
      const grace = p.barber!.late_grace_minutes;
      const barber = p.booking?.resources.find((r) => r.key === b.resource_key)?.label ?? 'the barber';
      const what = findService(p, b.service_key)?.label.toLowerCase() ?? 'appointment';
      const length = b.ends_at.getTime() - b.starts_at.getTime();
      const next = (await ctx.repo.busyForDate(ctx.tenant, date))
        .filter((x) => x.resource_key === b.resource_key && x.id !== b.id && x.starts_at >= b.ends_at)
        .sort((x, y) => x.starts_at.getTime() - y.starts_at.getTime())[0];
      const fits = !next || b.starts_at.getTime() + minutes * 60000 + length <= next.starts_at.getTime();
      await ctx.repo.mergeBookingDetails(ctx.tenant.id, b.reference, { late: { minutes, note: str(args.note) ?? '', at: now.toISOString() } }, `Running ${minutes} minutes late`, 'receptionist', now);
      ctx.action({ kind: 'booking_changed', title: 'Running late', detail: `${b.name} · ${minutes} minutes late · ${barber} · ref ${b.reference}` });
      const message = minutes <= grace
        ? `Kept: within the shop's ${grace} minutes. Tell them that's fine, and ${barber} knows.`
        : fits
          ? `Kept: later than the shop's ${grace} minutes, but ${barber} has no one straight after, so the full ${what} still fits. Tell them ${barber} knows.`
          : `Later than the shop's ${grace} minutes, and ${barber} has someone at ${spokenTime(toLocal(next!.starts_at, p.timezone).time)}, so ${barber} may only fit a shorter ${what}. Say so plainly and offer the next free time today instead (check_availability; modify_booking on yes). Never cancel it or charge them on the phone.`;
      return { noted: true, kept: minutes <= grace || fits, minutes, message };
    },
  },
};
