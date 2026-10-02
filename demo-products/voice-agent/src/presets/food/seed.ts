// Today's takeaway orders for a seeded week, from the business's own menu,
// spread over its collection slots, each at the kitchen stage its due time
// puts it in. Draws from the plan's shared dice, so it must keep drawing in
// the same order: the restaurant's recorded weeks depend on it.

import { LAST_START, closeMinutes, minutesOf, toLocal, weekdayOf, zonedToUtc } from '../../domain/time.ts';
import type { MenuItem, OrderLine, TenantProfile } from '../../domain/types.ts';
import { ALLERGIES, type Ids } from '../common/random.ts';
import type { SeedOrder } from '../common/types.ts';

export function planOrders(profile: TenantProfile, now: Date, random: () => number, { pick, person, phone }: Ids): SeedOrder[] {
  const tz = profile.timezone;
  const today = toLocal(now, tz).date;
  const orders: SeedOrder[] = [];
  const o = profile.ordering;
  const items = (profile.menu?.categories ?? []).flatMap((c) => c.items).filter((i) => i.available !== false && i.price_pence > 0);
  if (o?.collection && items.length) {
    const weekday = weekdayOf(today);
    const periods = o.hours.filter((h) => h.days.includes(weekday));
    const slot = o.slot_minutes ?? 15;
    const slots: Date[] = [];
    for (const p of periods) {
      // A slot at midnight would fall on tomorrow's date.
      for (let m = minutesOf(p.open) + (o.prep_minutes ?? 20); m <= Math.min(closeMinutes(p.close), LAST_START); m += slot) {
        slots.push(zonedToUtc(today, `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, tz));
      }
    }
    const count = Math.min(slots.length * 2, 8 + Math.floor(random() * 5));
    const perSlot = new Map<number, number>();
    const cap = o.slot_capacity ?? 99;
    for (let i = 0; i < count && slots.length; i++) {
      const due = slots[Math.min(slots.length - 1, Math.floor(random() * slots.length))];
      const n = perSlot.get(due.getTime()) ?? 0;
      if (n >= Math.max(1, cap - 1)) continue; // leave room in every slot for the prospect's own call
      perSlot.set(due.getTime(), n + 1);
      const lines: OrderLine[] = [];
      const picks = 1 + Math.floor(random() * 3);
      for (let l = 0; l < picks; l++) {
        const it: MenuItem = pick(items);
        const existingLine = lines.find((x) => x.item_key === it.key);
        if (existingLine) existingLine.quantity++;
        else lines.push({ line: lines.length + 1, item_key: it.key, name: it.name, quantity: 1, unit_pence: it.price_pence, modifiers: [] });
      }
      const subtotal = lines.reduce((s, x) => s + x.quantity * x.unit_pence, 0);
      const mins = (due.getTime() - now.getTime()) / 60000;
      const status: SeedOrder['status'] = mins < -10 ? 'completed' : mins < 5 ? 'ready' : mins < (o.prep_minutes ?? 20) ? 'in_kitchen' : 'confirmed';
      const paid = o.payment === 'phone' ? true : o.payment === 'collection' ? status === 'completed' : random() < 0.5 || status === 'completed';
      orders.push({
        reference: '',
        name: person(),
        phone: phone(),
        due_at: due,
        lines,
        subtotal_pence: subtotal,
        total_pence: subtotal,
        allergy_notes: random() < 0.1 ? pick(ALLERGIES) : null,
        status,
        payment_status: paid ? 'paid' : 'unpaid',
      });
    }
    orders.sort((a, b) => a.due_at.getTime() - b.due_at.getTime());
    orders.forEach((x, i) => (x.reference = String(101 + i)));
  }
  return orders;
}
