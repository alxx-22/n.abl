// A takeaway's day so far, anchored to Start (presets/takeaway.md §7): orders
// from opening until an hour from now, busiest from six to nine, two thirds
// of them deliveries out to the zones with a driver each. The kitchen's next
// forty minutes are full whenever Start is pressed in opening hours, so the
// first new order is about 45 to 50 minutes away, as on a real Friday night.
// Past orders are collected or delivered, the ones due now are out with the
// drivers or ready, and the rest are in the kitchen or the queue; seeded
// orders then move on with the clock (repo.advanceSeedOrders).
//
// Deterministic for a seed. Amy, whom the prospect can ring as, has a
// delivery out with the first driver whenever that can be true.

import type { Menu, MenuItem, OrderLine, TenantProfile } from '../../domain/types.ts';
import { lineTotal } from '../../domain/menu.ts';
import { addDays, closeMinutes, toLocal, weekdayOf, zonedToUtc } from '../../domain/time.ts';
import { ALLERGIES, ids, rng } from '../common/random.ts';
import type { SeedMessage, SeedOrder, SeedPlan } from '../common/types.ts';

/** Who the prospect can ring as (the workspace's Call as). */
export const TK_CALL_AS = {
  amy: { name: 'Amy Clarke', phone: '+447700900801' },
  parent: { name: 'Jo Patel', phone: '+447700900802' },
  outer: { name: 'Sam Reid', phone: '+447700900803' },
};

/** Orders a quarter of an hour, by the hour they leave the kitchen; a Friday or Saturday. Other days are quieter. */
const PER_SLOT: Record<number, number> = { 12: 1.2, 13: 1.5, 14: 0.6, 15: 0.4, 16: 0.6, 17: 1.8, 18: 3, 19: 3.6, 20: 3.2, 21: 2.2, 22: 1.4, 23: 0.8 };
const DAY_SCALE = [0.8, 0.6, 0.6, 0.65, 0.75, 1, 1];

const STREETS = ['Larch Close', 'Weaver Lane', 'Hosiery Row', 'Bobbin Court', 'Tanners Walk', 'Mill Yard', 'Spindle Street', 'Carding Close', 'Ropewalk Way', 'Lacemaker Road', 'Kiln Street', 'Foundry Lane', 'Chapel Mews', 'Orchard Rise', 'Brewhouse Yard', 'Canalside Walk'];
const LETTERS = 'ABDEFGHJLNPQRSTUWXYZ';
const MIN = 60_000;

interface Period { open: Date; close: Date }

function periodsToday(profile: TenantProfile, date: string): Period[] {
  const tz = profile.timezone;
  const weekday = weekdayOf(date);
  return (profile.ordering?.hours ?? [])
    .filter((h) => h.days.includes(weekday))
    .map((h) => ({ open: zonedToUtc(date, h.open, tz), close: closeMinutes(h.close) >= 24 * 60 ? zonedToUtc(addDays(date, 1), '00:00', tz) : zonedToUtc(date, h.close, tz) }))
    .sort((a, b) => a.open.getTime() - b.open.getTime());
}

/** A random line for one item, with its required choices (a size, a drink) and now and then an extra. */
function itemLine(menu: Menu, item: MenuItem, random: () => number, pick: <T>(xs: T[]) => T): Omit<OrderLine, 'line'> {
  const modifiers: OrderLine['modifiers'] = [];
  for (const g of item.modifier_groups ?? []) {
    const group = menu.modifier_groups[g];
    if (!group?.options.length) continue;
    const want = group.min > 0 ? group.min : random() < 0.2 ? 1 : 0;
    for (let i = 0; i < want; i++) {
      const o = pick(group.options);
      modifiers.push({ key: o.key, name: o.name, price_pence: o.price_pence });
    }
  }
  return { item_key: item.key, name: item.name, quantity: 1, unit_pence: item.price_pence, modifiers };
}

export function planTakeawaySeed(profile: TenantProfile, now: Date, seed: number): SeedPlan {
  const random = rng(seed);
  const id = ids(random);
  const reserved = new Set(Object.values(TK_CALL_AS).map((p) => p.phone));
  const phone = () => { for (;;) { const p = id.phone(); if (!reserved.has(p)) return p; } };
  const o = profile.ordering;
  const menu = profile.menu;
  const orders: SeedOrder[] = [];
  const messages: SeedMessage[] = [
    { from_name: id.person(), from_phone: phone(), body: 'Wanting 30 wraps and some fries for an office lunch next Friday. Please call back with a price.' },
    { from_name: id.person(), from_phone: phone(), body: 'Asking whether you are hiring delivery drivers for weekends.' },
  ];
  if (!o || !menu) return { bookings: [], orders, messages };
  const tz = profile.timezone;
  const date = toLocal(now, tz).date;
  const step = (o.slot_minutes ?? 15) * MIN;
  const cap = o.slot_capacity ?? 4;
  const prep = o.prep_minutes * MIN;
  const road = (o.delivery?.extra_minutes ?? 0) * MIN;
  const drivers = o.delivery?.drivers ?? [];
  const delivers = Boolean(o.delivery && drivers.length);
  const inner = (o.delivery?.districts ?? []).filter((d) => !o.delivery?.zones?.some((z) => z.code === d));
  const outer = (o.delivery?.districts ?? []).filter((d) => !inner.includes(d));
  const deals = new Set((menu.deals ?? []).map((d) => d.item_key));
  const items = menu.categories.flatMap((c) => c.items).filter((i) => i.available !== false && i.price_pence > 0 && !deals.has(i.key));
  const dealItems = menu.categories.flatMap((c) => c.items).filter((i) => deals.has(i.key));
  const scale = DAY_SCALE[weekdayOf(date)];

  /** One order, its kind and contents drawn, ready from the kitchen at `ready`; a delivery only if it arrives by `close`. */
  const make = (ready: Date, close: Date, who?: { name: string; phone: string }, force?: 'delivery') => {
    const delivery = force === 'delivery' || (delivers && random() < 2 / 3 && ready.getTime() + road <= close.getTime());
    const lines: OrderLine[] = [];
    const add = (l: Omit<OrderLine, 'line'>) => lines.push({ ...l, line: lines.length + 1 });
    const units = 1 + Math.floor(random() * 3);
    for (let u = 0; u < units; u++) {
      if (dealItems.length && random() < 0.4) {
        const item = id.pick(dealItems);
        add(itemLine(menu, item, random, id.pick));
      } else if (items.length) {
        add(itemLine(menu, id.pick(items), random, id.pick));
      }
    }
    const district = delivery ? (outer.length && random() < 0.25 ? id.pick(outer) : id.pick(inner.length ? inner : outer)) : null;
    const zone = district ? o.delivery?.zones?.find((z) => z.code === district) : undefined;
    const min = delivery ? zone?.min_order_pence ?? o.delivery!.min_order_pence : 0;
    // A delivery is always over its minimum: something more until it is.
    for (let guard = 0; delivery && items.length && lines.reduce((s, l) => s + lineTotal(l), 0) < min && guard < 20; guard++) add(itemLine(menu, id.pick(items), random, id.pick));
    const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
    const free = o.delivery?.free_over_pence;
    const fee = delivery ? (free && subtotal >= free ? 0 : zone?.fee_pence ?? o.delivery!.fee_pence) : 0;
    const due = new Date(ready.getTime() + (delivery ? road : 0));
    const paidNow = o.payment === 'phone' || (o.payment !== 'collection' && random() < 0.45);
    const cash = delivery && !paidNow && random() < 0.4;
    const total = subtotal + fee;
    orders.push({
      reference: '',
      name: who?.name ?? id.person(),
      phone: who?.phone ?? phone(),
      fulfilment: delivery ? 'delivery' : 'collection',
      address: delivery ? `${1 + Math.floor(random() * 120)} ${id.pick(STREETS)} (example)` : null,
      postcode: district ? `${district} ${1 + Math.floor(random() * 9)}${id.pick([...LETTERS])}${id.pick([...LETTERS])}` : null,
      delivery_fee_pence: fee,
      due_at: due,
      ready_at: ready,
      lines,
      subtotal_pence: subtotal,
      total_pence: total,
      allergy_notes: random() < 0.08 ? id.pick(ALLERGIES) : null,
      created_at: new Date(Math.min(now.getTime() - MIN, due.getTime() - (20 + Math.floor(random() * 30)) * MIN)),
      payment_status: paidNow ? 'paid' : 'unpaid',
      pay_note: cash ? `Cash: change from £${total > 2000 ? 50 : 20}` : delivery && !paidNow ? 'Card at the door' : null,
    });
  };

  for (const period of periodsToday(profile, date)) {
    const first = Math.ceil((period.open.getTime() + prep) / step) * step;
    const last = period.close.getTime();
    for (let t = first; t <= last && t <= now.getTime() + 60 * MIN; t += step) {
      const ready = new Date(t);
      const hour = Number(toLocal(ready, tz).time.slice(0, 2));
      const ahead = t - now.getTime();
      // The next forty minutes full; after that, room for the prospect's own call. Never the last half hour
      // before closing, so a late caller can still collect by the last slot.
      let n: number;
      if (ahead >= 0 && ahead < 40 * MIN && now.getTime() >= period.open.getTime() && t <= last - 30 * MIN) n = cap;
      else {
        const w = (PER_SLOT[hour] ?? 0.5) * scale;
        n = Math.min(ahead >= 40 * MIN ? cap - 1 : cap, Math.floor(w) + (random() < w % 1 ? 1 : 0));
      }
      // Before opening: just a few orders for opening time.
      if (now.getTime() < period.open.getTime()) n = Math.min(n, t - first < 2 * step ? 2 : 0);
      for (let i = 0; i < n; i++) make(ready, period.close);
    }
  }

  // Amy's delivery, out with the first driver since a few minutes ago, when it can be.
  const amyReady = Math.floor((now.getTime() - 8 * MIN) / step) * step;
  const open = periodsToday(profile, date).some((p) => amyReady >= p.open.getTime() + prep && amyReady + road <= p.close.getTime());
  if (delivers && open) make(new Date(amyReady), new Date(amyReady + road), TK_CALL_AS.amy, 'delivery');

  // Where each order is now, and who took the deliveries out.
  let turn = 0;
  for (const x of orders) {
    const ready = x.ready_at!.getTime();
    const delivery = x.fulfilment === 'delivery';
    if (delivery) x.driver = drivers[turn++ % drivers.length];
    const t = now.getTime();
    if (delivery ? x.due_at.getTime() + 5 * MIN < t : ready + 15 * MIN < t) x.status = 'completed';
    else if (delivery && ready <= t) (x.status = 'out_for_delivery'), (x.out_at = new Date(ready + 2 * MIN));
    else if (ready <= t) x.status = 'ready';
    else if (ready - prep <= t) x.status = 'in_kitchen';
    else x.status = 'confirmed';
    // Collected or delivered: paid by then.
    if (x.status === 'completed') x.payment_status = 'paid';
  }
  // Amy's is out with the first driver.
  const amy = orders.find((x) => x.phone === TK_CALL_AS.amy.phone);
  if (amy && amy.status === 'out_for_delivery') amy.driver = drivers[0];
  orders.sort((a, b) => a.created_at!.getTime() - b.created_at!.getTime());
  orders.forEach((x, i) => (x.reference = String(101 + i)));
  return { bookings: [], orders, messages };
}
