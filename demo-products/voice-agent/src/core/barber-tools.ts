// A barber's deposit and notice on a call (presets/barber.md §4.4, rule 3):
// cancelling or moving inside the notice period keeps the deposit under the
// shop's policy, said once before it happens and never more than the
// deposit, never "by law" (barber-use-cases.md, "Checked for gaps"). Only a
// profile with `barber` gets any of this.

import { pounds, type BookableService, type Booking } from '../domain/types.ts';
import type { ToolContext } from './tools.ts';

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
  return {
    [action === 'cancel' ? 'cancelled' : 'changed']: false,
    message: `Not done yet: it's less than ${bb.notice_hours} hours away, so the ${pounds(b.deposit_pence)} deposit is kept under the shop's policy if they ${action === 'cancel' ? 'cancel' : 'move it'}. Tell them once, plainly: never more than the deposit, never "by law". If they still want to, call ${action === 'cancel' ? 'cancel_booking' : 'modify_booking'} again.`,
  };
}

/** What happens to a paid deposit when a booking is cancelled: kept inside the notice, refunded outside it. */
export function depositOnCancel(ctx: ToolContext, b: Booking): string | undefined {
  if (!ctx.tenant.profile.barber || !b.deposit_paid || !b.deposit_pence) return undefined;
  return insideNotice(ctx, b)
    ? `The ${pounds(b.deposit_pence)} deposit is kept under the shop's policy.`
    : `The ${pounds(b.deposit_pence)} deposit is refunded (in the demo, no money moves).`;
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
    return { [key]: false, message: 'Each person is their own booking with a barber, with their own service: check and book them one at a time (one after another with one barber, or at the same time with two). Ask what each person is having if they have not said.' };
  }
  const services = p.booking?.services ?? [];
  if (!service && services.length > 1) return { [key]: false, message: `Which service? Ask what they are having: ${services.map((s) => s.label).join(', ')}.` };
  return null;
}

/** After the times: read back the service, the barber, when and the price, then book. A live test said the price nowhere; another said "booked" with no booking. */
export function readBackFirst(ctx: ToolContext, service: BookableService, barber?: string): string | undefined {
  if (!ctx.tenant.profile.barber) return undefined;
  const price = servicePrice(service);
  return `Read back the ${service.label.toLowerCase()}${barber ? ` with ${barber}` : ''}, the day, the time${price ? ` and the price (${price})` : ''}, and book with create_booking when they say yes. Nothing is booked and there is no reference until create_booking returns one.`;
}

/** After booking: the deposit by the demo card, or in the shop when the shop does not insist. */
export function depositNext(ctx: ToolContext, b: Booking): string | undefined {
  const bb = ctx.tenant.profile.barber;
  if (!bb || !b.deposit_pence || b.deposit_paid) return undefined;
  return bb.deposit_required
    ? `The ${pounds(b.deposit_pence)} deposit is needed to hold it: take it now with take_demo_payment (for "deposit").`
    : `Offer the ${pounds(b.deposit_pence)} deposit now by card with take_demo_payment (for "deposit"). If they would rather pay in the shop, that is fine: the booking stands.`;
}
