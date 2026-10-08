// The takeaway's kitchen (presets/takeaway.md §4.2). Every order, collection
// or delivery, is counted by the time the kitchen must have it ready, so
// "how long tonight?" gets the queue's real answer and the order then keeps
// it. Orders stop the owner's last-orders minutes before closing, and every
// order is handed over by closing: a hot meal handed over after the
// late-night licence ends is supplied then (Licensing Act 2003), so the last
// delivery is the one whose slot plus the drive still lands by closing.
//
// Switched on by profile.ordering.kitchen, which only the takeaway compile
// writes. The restaurant's collection slots (tools.ts set_fulfilment) are
// untouched; the zone and free-delivery helpers return the delivery-wide
// fee for a profile with neither.

import type { Order, OrderRequest, Ordering } from '../domain/types.ts';
import { pounds } from '../domain/types.ts';
import { lineTotal } from '../domain/menu.ts';
import { addDays, closeMinutes, dayName, normaliseTime, spokenTime, toLocal, weekdayOf, zonedToUtc } from '../domain/time.ts';
import { normaliseUkPhone } from '../domain/phone.ts';
import { postcodeOf, record, str } from './tool-kit.ts';
import type { Args, ToolContext } from './tools.ts';

type Kind = 'collection' | 'delivery';

/** A district's fee and minimum: its zone's where it has one, else the delivery-wide ones. */
export function deliveryTerms(o: Ordering, district: string | null): { fee_pence: number; min_order_pence: number } {
  const d = o.delivery!;
  const z = district ? d.zones?.find((x) => x.code === district) : undefined;
  return { fee_pence: z?.fee_pence ?? d.fee_pence, min_order_pence: z?.min_order_pence ?? d.min_order_pence };
}

/** What an order pays for delivery: nothing at or over the free-delivery amount. */
export function feeFor(o: Ordering, fee: number, subtotal: number): number {
  const free = o.delivery?.free_over_pence;
  return free && subtotal >= free ? 0 : fee;
}

interface Period { open: Date; close: Date }

/** A day's ordering periods as instants, soonest first; a close at midnight is the next day's start. */
function periodsOn(o: Ordering, tz: string, date: string): Period[] {
  const weekday = weekdayOf(date);
  return o.hours
    .filter((h) => h.days.includes(weekday))
    .map((h) => ({
      open: zonedToUtc(date, h.open, tz),
      close: closeMinutes(h.close) >= 24 * 60 ? zonedToUtc(addDays(date, 1), '00:00', tz) : zonedToUtc(date, h.close, tz),
    }))
    .sort((a, b) => a.open.getTime() - b.open.getTime());
}

const at = (d: Date, tz: string) => spokenTime(toLocal(d, tz).time);

/** A delivery to a number on the pay-on-the-phone list (it refused one before): card on the phone now, or collection. */
export const PHONE_ONLY = "Deliveries to this number are paid by card on the phone: take it now with take_demo_payment, reading out the demo card if they need it. If they'd rather pay at the door, it can only be collection. Never say why.";

/** When orders open next after today, within a week: "tomorrow at 12 noon". */
function nextOpening(o: Ordering, tz: string, today: string): string | null {
  for (let i = 1; i <= 7; i++) {
    const date = addDays(today, i);
    const first = periodsOn(o, tz, date)[0];
    if (first) return `${i === 1 ? 'tomorrow' : `on ${dayName(weekdayOf(date))}`} at ${at(first.open, tz)}`;
  }
  return null;
}

/** The ready times the kitchen can still make today for this kind of order, or why there are none. */
type Window = { ok: true; earliest: Date; latest: Date; close: Date } | { ok: false; message: string };

function readyWindow(ctx: ToolContext, kind: Kind): Window {
  const p = ctx.tenant.profile;
  const o = p.ordering!;
  const tz = p.timezone;
  const now = ctx.now().getTime();
  const today = toLocal(ctx.now(), tz).date;
  const step = (o.slot_minutes ?? 15) * 60000;
  const road = kind === 'delivery' ? (o.delivery?.extra_minutes ?? 0) * 60000 : 0;
  const stop = (o.kitchen?.last_orders_minutes ?? 0) * 60000;
  const periods = periodsOn(o, tz, today);
  for (const period of periods) {
    if (now > period.close.getTime() - stop) continue;
    const earliest = new Date(Math.ceil((Math.max(now, period.open.getTime()) + o.prep_minutes * 60000) / step) * step);
    // Ready in time to be handed over by closing.
    const latest = new Date(Math.floor((period.close.getTime() - road) / step) * step);
    if (earliest.getTime() <= latest.getTime()) return { ok: true, earliest, latest, close: period.close };
  }
  const next = nextOpening(o, tz, today);
  const again = next ? ` We open again ${next}.` : '';
  const last = periods.at(-1);
  if (last && now > last.close.getTime() - stop) {
    return { ok: false, message: `We've stopped taking orders for today: last orders were at ${at(new Date(last.close.getTime() - stop), tz)}.${again}` };
  }
  if (last && kind === 'delivery') {
    return { ok: false, message: `Delivery has finished for today: an order now couldn't reach them before we close at ${at(last.close, tz)}.` };
  }
  return { ok: false, message: `We're not taking ${kind} orders today.${again}` };
}

/** Up to `limit` ready times from `from` to `latest` with room in the kitchen, every order counted by when it must be ready. */
async function slotsWithRoom(ctx: ToolContext, from: Date, latest: Date, limit: number): Promise<Date[]> {
  const o = ctx.tenant.profile.ordering!;
  const step = (o.slot_minutes ?? 15) * 60000;
  const out: Date[] = [];
  for (let t = from.getTime(); t <= latest.getTime() && out.length < limit; t += step) {
    const full = o.slot_capacity ? (await ctx.repo.ordersReadyBetween(ctx.tenant.id, new Date(t), new Date(t + step))) >= o.slot_capacity : false;
    if (!full) out.push(new Date(t));
  }
  return out;
}

/** "About 50 minutes, so around 7:50pm": from now, to the nearest five minutes. */
function waitWords(ctx: ToolContext, due: Date): string {
  const mins = Math.max(5, Math.round((due.getTime() - ctx.now().getTime()) / 300000) * 5);
  return `about ${mins} minutes, so around ${at(due, ctx.tenant.profile.timezone)}`;
}

/** The first time this kind of order can be handed over, or why it can't today. */
async function firstDue(ctx: ToolContext, kind: Kind): Promise<{ due: Date } | { message: string }> {
  const o = ctx.tenant.profile.ordering!;
  const w = readyWindow(ctx, kind);
  if (!w.ok) return { message: w.message };
  const [ready] = await slotsWithRoom(ctx, w.earliest, w.latest, 1);
  if (!ready) return { message: `The kitchen is full for ${kind} for the rest of today.` };
  return { due: new Date(ready.getTime() + (kind === 'delivery' ? (o.delivery?.extra_minutes ?? 0) * 60000 : 0)) };
}

/** set_fulfilment for a takeaway: the kitchen's own queue, the postcode's zone, last orders. */
export async function kitchenFulfilment(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const p = ctx.tenant.profile;
  const o = p.ordering!;
  const tz = p.timezone;
  const type: Kind = str(args.type)?.toLowerCase().startsWith('deliv') ? 'delivery' : 'collection';
  if (type === 'delivery' && !o.delivery) return { ok: false, message: 'Delivery is not offered; collection only.' };
  if (type === 'collection' && !o.collection) return { ok: false, message: 'Collection is not offered.' };
  let postcode: string | null = null;
  let address: string | null = null;
  let terms: { fee_pence: number; min_order_pence: number } | null = null;
  if (type === 'delivery') {
    const pc = postcodeOf(args.postcode);
    if (!pc) return { ok: false, message: 'Need a valid UK postcode for delivery.' };
    if (!o.delivery!.districts.includes(pc.district)) {
      return { ok: false, outside: true, message: `Sorry, ${pc.district} is outside the delivery area. Offer collection.` };
    }
    address = str(args.address) ?? null;
    if (!address) return { ok: false, message: 'Need the first line of the address.' };
    postcode = pc.full;
    terms = deliveryTerms(o, pc.district);
  }
  const w = readyWindow(ctx, type);
  if (!w.ok) {
    const instead = type === 'delivery' && o.collection ? await firstDue(ctx, 'collection') : null;
    return { ok: false, message: w.message, ...(instead && 'due' in instead ? { collection_instead: `Collection is still possible: ${waitWords(ctx, instead.due)}.` } : {}) };
  }
  const step = (o.slot_minutes ?? 15) * 60000;
  const road = type === 'delivery' ? (o.delivery?.extra_minutes ?? 0) * 60000 : 0;
  const t = str(args.time);
  const asap = !t || /asap|soon|now/i.test(t);
  const prev = ctx.state.fulfilment;
  let ready: Date;
  if (asap && prev && prev.type === type && prev.requested === 'asap' && prev.postcode === postcode) {
    // The same answer again keeps the time already given to the caller.
    ready = new Date(prev.due_at.getTime() - road);
  } else if (asap) {
    const [first] = await slotsWithRoom(ctx, w.earliest, w.latest, 1);
    if (!first) return { ok: false, message: `The kitchen is full for ${type} for the rest of today.` };
    ready = first;
  } else {
    const hhmm = normaliseTime(t);
    if (!hhmm) return { ok: false, message: 'Time must be HH:MM, or "asap".' };
    if (o.timed_orders === false) return { ok: false, message: 'We only take orders for as soon as possible. Offer that time.' };
    const wanted = zonedToUtc(toLocal(ctx.now(), tz).date, hhmm, tz);
    // "For 8pm" by delivery is the slot that leaves the kitchen in time to arrive by 8.
    const slot = new Date(Math.floor((wanted.getTime() - road) / step) * step);
    if (slot.getTime() < w.earliest.getTime()) {
      const first = await firstDue(ctx, type);
      return { ok: false, message: 'due' in first ? `The earliest ${type} time is ${at(first.due, tz)}.` : first.message };
    }
    if (slot.getTime() > w.latest.getTime()) {
      return { ok: false, message: `We close at ${at(w.close, tz)}, so the latest ${type} time is ${at(new Date(w.latest.getTime() + road), tz)}.` };
    }
    const [free] = await slotsWithRoom(ctx, slot, slot, 1);
    if (!free) {
      const near = await slotsWithRoom(ctx, new Date(Math.max(w.earliest.getTime(), slot.getTime() - 2 * step)), w.latest, 3);
      const times = near.map((x) => at(new Date(x.getTime() + road), tz));
      return { ok: false, message: `The kitchen is full for ${at(wanted, tz)}.${times.length ? ` ${times.join(', ')} ${times.length > 1 ? 'have' : 'has'} room.` : ''}`, times_with_room: times };
    }
    ready = slot;
  }
  const due = new Date(ready.getTime() + road);
  ctx.state.fulfilment = { type, requested: asap ? 'asap' : normaliseTime(t)!, due_at: due, postcode, address, ...(terms ?? {}) };
  ctx.state.basketVersion++;
  const subtotal = ctx.state.lines.reduce((s, l) => s + lineTotal(l), 0);
  const short = terms && subtotal > 0 && subtotal < terms.min_order_pence ? terms.min_order_pence - subtotal : 0;
  // With the order in, what to do next and its total, so the total is never added up by the model.
  // Live, 8 October: "£30.98 with the delivery fee" was said from its own sum, before review_order.
  const fee = terms ? feeFor(o, terms.fee_pence, subtotal) : 0;
  const next = !subtotal ? {}
    : short ? { next: `They're ${pounds(short)} short of the ${pounds(terms!.min_order_pence)} minimum for delivery here. Tell them, and ask what they'd like to add.` }
    : { total_so_far: pounds(subtotal + fee), next: 'Now call review_order and read its read_back word for word.' };
  return {
    ok: true, type, time: toLocal(due, tz).time, spoken_time: at(due, tz), wait: waitWords(ctx, due),
    ...(address ? { address: `${address}, ${postcode}` } : {}),
    ...(terms ? {
      delivery_fee: pounds(terms.fee_pence), minimum_order: pounds(terms.min_order_pence),
      ...(o.delivery!.free_over_pence ? { free_delivery_from: pounds(o.delivery!.free_over_pence) } : {}),
      ...(short ? { short_by: pounds(short) } : {}),
    } : {}),
    note: "This is the kitchen's real time now. Say it as it is and never promise sooner; collection is quicker if they're in a hurry.",
    ...(type === 'delivery' && ctx.callerPhone && o.pay_on_phone?.includes(ctx.callerPhone) ? { pay: PHONE_ONLY } : {}),
    ...next,
  };
}

/** "I'm collecting, so I don't need delivery": the caller said collection last, and delivery only to say no to it. */
export function saidCollection(heard: string[]): boolean {
  const words = heard.join(' ').toLowerCase().replace(/\b(?:don'?t|do not|no|not)\s+(?:need|want)?\s*(?:a\s+|the\s+|it\s+)?deliver\w*/g, ' ');
  const last = (re: RegExp) => Math.max(-1, ...[...words.matchAll(re)].map((m) => m.index!));
  return last(/\b(?:collect\w*|pick(?:ing)?\s+(?:it\s+|them\s+)?up)\b/g) > last(/\bdeliver\w*/g);
}

/**
 * Collection or delivery not set, when the caller already said collection: set
 * it for as soon as possible, so the read-back carries the time. Live, 8
 * October: "I'm collecting" was said, the order was placed without it, and the
 * receptionist told the caller it couldn't find the order.
 */
export async function impliedCollection(ctx: ToolContext): Promise<Record<string, unknown> | null> {
  if (ctx.state.fulfilment || !ctx.tenant.profile.ordering?.kitchen || !saidCollection(ctx.state.heard)) return null;
  const set = await kitchenFulfilment({ type: 'collection' }, ctx);
  return set.ok ? null : set;
}

/**
 * A delivery's minimum, as the order grows: how far short it is, from the
 * postcode's own minimum once delivery or a postcode is known. Live, 8
 * October: "£2.03 short" was worked out by the receptionist, as no tool had
 * said it yet.
 */
export function shortOfMinimum(ctx: ToolContext): Record<string, unknown> {
  if (!ctx.tenant.profile.ordering?.kitchen) return {};
  const f = ctx.state.fulfilment;
  const min = f ? (f.type === 'delivery' ? f.min_order_pence : undefined) : ctx.state.deliveryTerms?.min_order_pence;
  const subtotal = ctx.state.lines.reduce((s, l) => s + lineTotal(l), 0);
  if (!min || subtotal >= min) return {};
  return { short_of_delivery_minimum: pounds(min - subtotal), minimum_note: `Delivery here needs ${pounds(min)}: ${pounds(min - subtotal)} short so far. Say so once they've finished ordering, and let them choose what to add.` };
}

/** get_wait_times: "how long tonight?" and "do you deliver to me?", before any order. */
export async function waitTimes(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const o = ctx.tenant.profile.ordering!;
  const tz = ctx.tenant.profile.timezone;
  const out: Record<string, unknown> = {};
  if (o.collection) {
    const c = await firstDue(ctx, 'collection');
    out.collection = 'due' in c ? waitWords(ctx, c.due) : c.message;
  }
  if (o.delivery) {
    // A district alone ("NG9") is enough to say yes or no.
    const pc = postcodeOf(args.postcode);
    if (pc && !o.delivery.districts.includes(pc.district)) {
      out.delivery = `${pc.district} is outside the delivery area: offer collection.`;
    } else {
      const d = await firstDue(ctx, 'delivery');
      out.delivery = 'due' in d ? waitWords(ctx, d.due) : d.message;
      if (pc) {
        const terms = deliveryTerms(o, pc.district);
        // Kept for the order that follows: add_to_order says how far short of this minimum it is.
        ctx.state.deliveryTerms = terms;
        out.delivery_fee = pounds(terms.fee_pence);
        out.minimum_order = pounds(terms.min_order_pence);
        if (o.delivery.free_over_pence) out.free_delivery_from = pounds(o.delivery.free_over_pence);
      } else {
        out.ask = 'For the fee and minimum, ask for their postcode.';
      }
    }
  }
  const today = periodsOn(o, tz, toLocal(ctx.now(), tz).date).at(-1);
  if (today) out.last_orders = at(new Date(today.close.getTime() - (o.kitchen?.last_orders_minutes ?? 0) * 60000), tz);
  out.note = "These are the kitchen's real times right now. Say them as they are; never promise sooner.";
  return out;
}

// ── Where's my order? ─────────────────────────────────────────────────────

/** An order's status in words, with its time: what a caller hears. */
export function orderStatusWords(ctx: ToolContext, o: Order): string {
  const tz = ctx.tenant.profile.timezone;
  const now = ctx.now().getTime();
  const due = o.due_at.getTime();
  const late = Math.round((now - due) / 300000) * 5;
  const lateWords = late >= 10 ? `, running about ${late} minutes late` : '';
  const delivery = o.fulfilment === 'delivery';
  switch (o.status) {
    case 'out_for_delivery': {
      const left = o.out_at ? `since ${at(o.out_at, tz)}` : '';
      const mins = Math.round((due - now) / 60000);
      return `out with ${o.driver ?? 'our driver'}${left ? ` ${left}` : ''}; ${mins > 3 ? `it should be with them in about ${Math.max(5, Math.round(mins / 5) * 5)} minutes` : 'it should be with them any minute'}`;
    }
    case 'ready':
      return delivery ? `ready, and waiting for a driver; due with them around ${at(o.due_at, tz)}${lateWords}` : `ready to collect now`;
    case 'completed':
      return delivery ? 'delivered' : 'collected';
    case 'cancelled':
      return 'cancelled';
    default:
      return `${o.status === 'in_kitchen' ? 'being made in the kitchen' : 'in the queue for the kitchen'}; ${delivery ? 'due with them' : 'ready to collect'} around ${at(o.due_at, tz)}${lateWords}`;
  }
}

/** find_order: today's order, by its number or the number the caller rings from. Never its address. */
export async function findOrder(args: Args, ctx: ToolContext): Promise<Record<string, unknown>> {
  const tz = ctx.tenant.profile.timezone;
  // Today's orders are the ones due today: every takeaway order is for the day it is taken.
  const date = toLocal(ctx.now(), tz).date;
  const today = zonedToUtc(date, '00:00', tz);
  const tomorrow = zonedToUtc(addDays(date, 1), '00:00', tz);
  const isToday = (o: Order) => o.due_at.getTime() >= today.getTime() && o.due_at.getTime() < tomorrow.getTime();
  // The seed's orders have moved on since Start: say where they are now.
  await ctx.repo.advanceSeedOrders(ctx.tenant.id, ctx.now(), ctx.tenant.profile.ordering!.prep_minutes);
  let number = str(args.order_number)?.replace(/[^0-9]/g, '');
  // A phone number passed as the order number: the calling number's own order, and no other.
  // Live, 8 October: "07700 900801" was looked up as order 0 7 7 0 0..., and a caller's delivery went unfound.
  if (number && number.length >= 9) {
    if (normaliseUkPhone(number) !== ctx.callerPhone) {
      return { found: false, message: "That's a phone number, not an order number. An order is found by its number, or by the number they're ringing from: ask for the order number." };
    }
    number = undefined;
  }
  let order: Order | null = null;
  let by: 'number' | 'phone' = 'number';
  if (number) {
    const o = await ctx.repo.getOrder(ctx.tenant.id, number);
    order = o && isToday(o) ? o : null;
    if (!order) return { found: false, message: `No order ${number.split('').join(' ')} today. Check the number with them, or look it up by the number they ordered from.` };
  } else {
    if (!ctx.callerPhone) return { found: false, message: 'Ask for the order number.' };
    by = 'phone';
    order = (await ctx.repo.ordersForPhone(ctx.tenant.id, ctx.callerPhone, today, tomorrow)).find((o) => o.status !== 'cancelled') ?? null;
    if (!order) return { found: false, message: "No order today from the number they're ringing on. Ask for the order number." };
  }
  record(ctx, order.reference, 'order', 'found');
  // Its street, for the guardrail: never said back to the caller unless they say it first.
  const street = order.address?.replace(/\s*\(example\)\s*$/i, '').replace(/^\d+[a-z]?,?\s+/i, '').trim();
  if (street && street.length >= 4 && !ctx.state.privateAddresses.includes(street)) ctx.state.privateAddresses.push(street);
  const found = {
    found: true,
    order_number: order.reference,
    spoken_order_number: order.reference.split('').join(' '),
    kind: order.fulfilment,
    status: orderStatusWords(ctx, order),
    items: order.lines.map((l) => `${l.quantity} ${l.name}`).join(', '),
    total: pounds(order.total_pence),
    paid: order.payment_status === 'paid',
    ...(waiting(order).length ? { waiting_for_staff: waiting(order).map((r) => `${REQUEST_WORDS[r.kind]}: ${r.what}`) } : {}),
    never: by === 'phone'
      ? "Found by the number they're ringing from: never read the address or the name back. If they need to check it, ask them to say it."
      : 'Never read the address back. If they need to check it, ask them to say it.',
  };
  const action = str(args.action)?.toLowerCase().replace(/[\s-]+/g, '_') ?? 'find';
  if (action === 'find') return found;
  const done = action === 'add_allergy' ? await addAllergy(args, ctx, order)
    : action === 'request_cancel' || action === 'request_change' ? await requestOn(action === 'request_cancel' ? 'cancel' : 'change', args, ctx, order)
    : action === 'report_problem' ? await reportProblem(args, ctx, order)
    : { ok: false, message: 'action is one of find, add_allergy, request_cancel, request_change, report_problem.' };
  return { ...found, ...done };
}

// ── After the order (presets/takeaway.md §4.3, M2) ─────────────────────────
//
// Nothing here cancels, changes or refunds: a cancellation or change is a
// request on the ticket that staff accept or refuse, and a complaint is a
// message for the manager. Only an allergy told while the food is still to
// be made goes straight onto the order.

const REQUEST_WORDS: Record<OrderRequest['kind'], string> = { cancel: 'Cancel', change: 'Change', send_missing: 'Send out' };
const waiting = (o: Order) => (o.requests ?? []).filter((r) => !r.answer);
const notYetMade = (o: Order) => o.status === 'confirmed' || o.status === 'in_kitchen';
const NO_PROMISE = 'Never say it is cancelled, changed or refunded, or that they will get their money back: staff decide, and text them.';

/** When the manager will ring back: tonight while open, otherwise tomorrow. */
function callBack(ctx: ToolContext): string {
  const o = ctx.tenant.profile.ordering!;
  const tz = ctx.tenant.profile.timezone;
  const close = periodsOn(o, tz, toLocal(ctx.now(), tz).date).at(-1)?.close;
  return close && ctx.now().getTime() < close.getTime() ? `tonight, before we close at ${at(close, tz)}` : 'tomorrow, once we open';
}

async function complaint(ctx: ToolContext, order: Order, category: string, urgency: 'urgent' | 'today', body: string): Promise<void> {
  const from = ctx.callerPhone ?? order.phone;
  await ctx.repo.addMessage({
    tenant_id: ctx.tenant.id, call_id: ctx.callId, kind: 'message', from_name: order.name, from_phone: from, body, status: 'new',
    category, urgency, reference: order.reference, details: { order: order.reference },
  });
  ctx.state.messageTaken = true;
  ctx.action({ kind: 'message_taken', title: `${category === 'allergy' ? 'Allergy' : 'Complaint'}: order ${order.reference}`, detail: body });
}

async function addAllergy(args: Args, ctx: ToolContext, order: Order): Promise<Record<string, unknown>> {
  const what = str(args.details);
  if (!what) return { ok: false, message: 'Ask what the allergy is, then call again with it in details.' };
  if (notYetMade(order)) {
    await ctx.repo.addOrderAllergy(ctx.tenant.id, order.reference, what);
    ctx.action({ kind: 'order_updated', title: `Allergy added to order ${order.reference}`, detail: what });
    return { ok: true, added: `Allergy on order ${order.reference} for the kitchen, marked on the ticket: ${what}.`, say: "It's on the order now and marked for the kitchen.", never: 'Never say the food will be safe: the shared-kitchen caveat still stands.' };
  }
  // Made already: nothing can be taken out of it. Not to be eaten until the manager has rung.
  await complaint(ctx, order, 'allergy', 'urgent', `Allergy told after order ${order.reference} was made (${order.status.replace(/_/g, ' ')}): ${what}. Call them before they eat it.`);
  return {
    ok: true, added: false,
    say: `The order is already made, so it can't be changed now. Ask them not to eat it until the manager has called them back, ${callBack(ctx)}.`,
    never: 'Never say it is safe, or which parts are.',
  };
}

async function requestOn(kind: 'cancel' | 'change', args: Args, ctx: ToolContext, order: Order): Promise<Record<string, unknown>> {
  if (order.status === 'cancelled') return { ok: false, message: 'This order is already cancelled.' };
  if (order.status === 'completed') return { ok: false, message: `It has been ${order.fulfilment === 'delivery' ? 'delivered' : 'collected'}. If something is wrong with it, use report_problem.` };
  const what = str(args.details) ?? (kind === 'cancel' ? 'cancel the order' : null);
  if (!what) return { ok: false, message: 'Ask what they would like changed, then call again with it in details.' };
  if (kind === 'change' && order.status === 'out_for_delivery') return { ok: false, message: "It's already out with the driver, so it can't be changed. Offer a message for the manager." };
  if (waiting(order).some((r) => r.kind === kind)) return { ok: true, requested: false, message: `A ${kind} request is already with staff for this order: say they'll text the answer.`, never: NO_PROMISE };
  await ctx.repo.requestOnOrder(ctx.tenant.id, order.reference, { kind, what, phone: ctx.callerPhone ?? order.phone, at: ctx.now().toISOString() });
  ctx.action({ kind: 'order_updated', title: `${REQUEST_WORDS[kind]} request on order ${order.reference}`, detail: what });
  const made = order.status === 'in_kitchen' || order.status === 'ready';
  return {
    ok: true, requested: true,
    say: `It's with the kitchen to ${kind === 'cancel' ? 'cancel' : 'change'}${made ? ", but it's already being made, so they may not be able to" : ''}; they'll text this number to say.${order.payment_status === 'paid' && kind === 'cancel' ? ' Any refund is for the manager to decide.' : ''}`,
    never: NO_PROMISE,
  };
}

const PROBLEMS = ['missing', 'wrong', 'cold', 'late', 'something_in_food', 'ill'] as const;
type Problem = (typeof PROBLEMS)[number];

async function reportProblem(args: Args, ctx: ToolContext, order: Order): Promise<Record<string, unknown>> {
  const said = str(args.problem)?.toLowerCase().replace(/[\s-]+/g, '_') ?? '';
  const problem = PROBLEMS.find((p) => said.includes(p.split('_')[0])) as Problem | undefined;
  if (!problem) return { ok: false, message: `problem is one of ${PROBLEMS.join(', ')}.` };
  const what = str(args.details) ?? problem.replace(/_/g, ' ');
  const k = ctx.tenant.profile.ordering!.kitchen;
  const tz = ctx.tenant.profile.timezone;
  if (problem === 'late') {
    const late = Math.round((ctx.now().getTime() - order.due_at.getTime()) / 60000);
    if (order.status === 'completed' || late < (k?.late_after_minutes ?? 15)) {
      return { ok: true, logged: false, say: `Not late enough to pass on yet: it was due around ${at(order.due_at, tz)}. Give them the status.` };
    }
    await complaint(ctx, order, 'complaint', 'urgent', `Order ${order.reference} is ${late} minutes late (${order.status.replace(/_/g, ' ')}). ${what}`);
    return { ok: true, logged: true, say: `It's with the manager now, who will call them back about it ${callBack(ctx)}.`, never: NO_PROMISE };
  }
  if (problem === 'missing' && k?.missing_items === 'send_out' && order.fulfilment === 'delivery') {
    await ctx.repo.requestOnOrder(ctx.tenant.id, order.reference, { kind: 'send_missing', what, phone: ctx.callerPhone ?? order.phone, at: ctx.now().toISOString() });
    ctx.action({ kind: 'order_updated', title: `Send out to order ${order.reference}`, detail: what });
    return { ok: true, logged: true, say: `The kitchen will send the missing ${what} out with the next driver; they'll text when it's on its way.`, never: NO_PROMISE };
  }
  const serious = problem === 'ill' || problem === 'something_in_food';
  await complaint(ctx, order, 'complaint', serious ? 'urgent' : 'today', `${problem === 'ill' ? 'Ill after eating' : problem === 'something_in_food' ? 'Something in the food' : `${problem[0].toUpperCase()}${problem.slice(1)}`}, order ${order.reference}: ${what}`);
  return {
    ok: true, logged: true,
    say: `It's with the manager, who will call them back ${callBack(ctx)}.`,
    ...(problem === 'ill' ? { health: "If they feel unwell, they should contact their GP or NHS 111, or call 999 if it's severe. Ask them to keep any food that's left, and its packaging." } : {}),
    ...(problem === 'something_in_food' ? { keep: "Ask them to keep it, and the food and packaging, for the manager." } : {}),
    never: NO_PROMISE,
  };
}
