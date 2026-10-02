// Takeaway: collection and delivery by phone, for any business that sells
// food. Each function takes the ordering sub-object, the step key and the
// payment choice as arguments, never a path, so each preset keeps them where
// its answers do: the restaurant passes `serve`, step 'serve' and
// `money.takeaway_payment`.

import { minutesOf } from '../../domain/time.ts';
import type { KnowledgeEntry, Ordering } from '../../domain/types.ts';
import { groupByDay } from '../common/hours.ts';
import { entry } from '../common/profile.ts';
import { arr, bool, int, oneOf } from '../common/sanitise.ts';
import type { DayHours, Issue } from '../common/types.ts';

export interface CollectionAnswer {
  enabled: boolean;
  prep_minutes: number;
  slot_minutes: number;
  per_slot: number;
  /** Only in services that close after 5pm. */
  evenings_only: boolean;
}

export interface DeliveryAnswer {
  enabled: boolean;
  districts: string[];
  fee_pence: number;
  min_order_pence: number;
  extra_minutes: number;
}

export interface OrderingAnswer {
  collection: CollectionAnswer;
  delivery: DeliveryAnswer;
  /** Named for the FAQ only: "you'll find us on Deliveroo". */
  delivery_apps: string[];
}

export const ORDER_PAYMENTS = ['phone', 'collection', 'either'] as const;
export type OrderPayment = (typeof ORDER_PAYMENTS)[number];

/** The ordering fields of `v`; anything else in it is the caller's to read. */
export function sanitiseOrdering(v: unknown, d: OrderingAnswer): OrderingAnswer {
  const s = (v ?? {}) as any;
  return {
    collection: {
      enabled: bool(s.collection?.enabled, d.collection.enabled),
      prep_minutes: int(s.collection?.prep_minutes, 5, 120, d.collection.prep_minutes),
      slot_minutes: oneOf(s.collection?.slot_minutes, [5, 10, 15, 20, 30] as unknown as readonly number[] as never, d.collection.slot_minutes as never),
      per_slot: int(s.collection?.per_slot, 0, 50, d.collection.per_slot),
      evenings_only: bool(s.collection?.evenings_only, d.collection.evenings_only),
    },
    delivery: {
      enabled: bool(s.delivery?.enabled, d.delivery.enabled),
      districts: arr(s.delivery?.districts).filter((z): z is string => typeof z === 'string')
        .map((z) => z.toUpperCase().replace(/\s+/g, '')).filter((z) => /^[A-Z]{1,2}\d[A-Z\d]?$/.test(z)).slice(0, 30),
      fee_pence: int(s.delivery?.fee_pence, 0, 2000, d.delivery.fee_pence),
      min_order_pence: int(s.delivery?.min_order_pence, 0, 10000, d.delivery.min_order_pence),
      extra_minutes: int(s.delivery?.extra_minutes, 0, 120, d.delivery.extra_minutes),
    },
    delivery_apps: arr(s.delivery_apps).filter((z): z is string => typeof z === 'string').map((z) => z.slice(0, 20)).slice(0, 5),
  };
}

export const sanitisePayment = (v: unknown, d: OrderPayment): OrderPayment => oneOf(v, ORDER_PAYMENTS, d);

export const takesOrders = (o: OrderingAnswer): boolean => o.collection.enabled || o.delivery.enabled;

/** The profile's ordering, or nothing when neither collection nor delivery is on. */
export function compileOrdering(o: OrderingAnswer, hours: { days: DayHours[] }, payment: OrderPayment): Ordering | undefined {
  const c = o.collection;
  const del = o.delivery;
  if (!c.enabled && !del.enabled) return undefined;
  const periods = hours.days.map((d) =>
    d.open ? d.services.filter((s) => !c.evenings_only || minutesOf(s.close) > minutesOf('17:00')).map((s) => ({ ...s, label: 'takeaway' })) : null,
  );
  return {
    collection: c.enabled,
    delivery: del.enabled
      ? { districts: del.districts.map((x) => x.toUpperCase().trim()).filter(Boolean), fee_pence: del.fee_pence, min_order_pence: del.min_order_pence, extra_minutes: del.extra_minutes }
      : undefined,
    prep_minutes: c.prep_minutes,
    slot_minutes: c.slot_minutes,
    slot_capacity: c.per_slot > 0 ? c.per_slot : undefined,
    payment,
    hours: groupByDay(periods, (s) => `${s.open}|${s.close}`).map((g) => ({ days: g.days.sort(), open: g.value.open, close: g.value.close, label: 'takeaway' })),
  };
}

/** One core fact: how takeaway works and how it is paid for. */
export function takeawaySentence(o: OrderingAnswer, payment: OrderPayment): string | null {
  const c = o.collection;
  const del = o.delivery;
  if (!c.enabled && !del.enabled) return null;
  const how = [c.enabled ? 'click and collect by phone' : null, del.enabled ? `delivery to ${del.districts.join(', ') || 'nearby postcodes'}` : null].filter(Boolean).join(' and ');
  const pay = { phone: 'Takeaway is paid by card over the phone.', collection: 'Takeaway is paid when you collect.', either: 'Takeaway can be paid by card over the phone or when you collect.' }[payment];
  return `Takeaway: ${how}${c.evenings_only ? ', evenings' : ''}; food takes about ${c.prep_minutes} minutes. ${pay}`;
}

export function deliveryAppsEntry(o: OrderingAnswer): KnowledgeEntry | null {
  return o.delivery_apps.length
    ? entry('Are you on the delivery apps?', `Yes, you can order from us on ${o.delivery_apps.join(' and ')}.`, ['deliveroo', 'uber', 'just eat', 'app', 'delivery'])
    : null;
}

export function validateOrdering<K extends string>(o: OrderingAnswer, step: K): Issue<K>[] {
  return o.delivery.enabled && !o.delivery.districts.length ? [{ step, level: 'error', message: 'List the postcode districts you deliver to, like NG1.' }] : [];
}
