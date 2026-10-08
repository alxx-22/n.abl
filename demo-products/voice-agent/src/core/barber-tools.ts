// A barber's deposit and notice on a call (presets/barber.md §4.4, rule 3):
// cancelling or moving inside the notice period keeps the deposit under the
// shop's policy, said once before it happens and never more than the
// deposit, never "by law" (barber-use-cases.md, "Checked for gaps"). Only a
// profile with `barber` gets any of this.

import { pounds, type Booking } from '../domain/types.ts';
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
