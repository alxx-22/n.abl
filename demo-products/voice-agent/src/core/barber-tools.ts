// A barber's deposit and notice on a call (presets/barber.md §4.4, rule 3):
// cancelling or moving inside the notice period keeps the deposit under the
// shop's policy, said once before it happens and never more than the
// deposit, never "by law" (barber-use-cases.md, "Checked for gaps"). Only a
// profile with `barber` gets any of this.

import type { FunctionDeclaration } from './live.ts';
import { findService } from '../domain/availability.ts';
import { spokenDate, spokenTime, toLocal } from '../domain/time.ts';
import type { WaitlistEntry } from '../domain/shop-floor.ts';
import { pounds, type BookableService, type Booking, type Tenant } from '../domain/types.ts';
import type { Repo } from '../db/repo.ts';
import { S, smsTo, str } from './tool-kit.ts';
import type { Args, ToolContext } from './tools.ts';

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
