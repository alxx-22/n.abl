// Takeaway: collection and delivery by phone, for any business that sells
// food. Each function takes the ordering sub-object, the step key and the
// payment choice as arguments, never a path, so each preset keeps them where
// its answers do: the restaurant passes `serve`, step 'serve' and
// `money.takeaway_payment`.
//
// The optional fields belong to some presets only (the restaurant's evenings
// switch, the takeaway's zones, free delivery, drivers and timed orders).
// The sanitiser writes one only when the preset's defaults have it, so each
// preset's answers keep exactly the shape its defaults give (PRESETS.md §1,
// rule 2) and the restaurant's never gain the takeaway's.

import { closeMinutes, minutesOf } from '../../domain/time.ts';
import type { KnowledgeEntry, Ordering } from '../../domain/types.ts';
import { groupByDay } from '../common/hours.ts';
import { entry } from '../common/profile.ts';
import { arr, bool, int, oneOf, str } from '../common/sanitise.ts';
import type { DayHours, Issue } from '../common/types.ts';

export interface CollectionAnswer {
  enabled: boolean;
  prep_minutes: number;
  slot_minutes: number;
  per_slot: number;
  /** Only in services that close after 5pm. The restaurant's; missing counts as no. */
  evenings_only?: boolean;
}

/** One district's own fee or minimum, in place of the delivery-wide ones. */
export interface DeliveryZone {
  code: string;
  fee_pence?: number;
  min_order_pence?: number;
}

export interface DeliveryAnswer {
  enabled: boolean;
  /** Every postcode district delivered to. */
  districts: string[];
  fee_pence: number;
  min_order_pence: number;
  extra_minutes: number;
  /** Only districts in `districts`, each at most once. */
  zones?: DeliveryZone[];
  /** Delivery is free at or over this; null: never free. */
  free_over_pence?: number | null;
  /** First names, for the back office. */
  drivers?: string[];
}

export interface OrderingAnswer {
  collection: CollectionAnswer;
  delivery: DeliveryAnswer;
  /** Named for the FAQ only: "you'll find us on Deliveroo". */
  delivery_apps: string[];
  /** Orders for a time later today, not only as soon as possible. */
  timed_orders?: boolean;
}

export const ORDER_PAYMENTS = ['phone', 'collection', 'either'] as const;
export type OrderPayment = (typeof ORDER_PAYMENTS)[number];

/** A postcode district as typed ("ng 7" is NG7), or null when it is not one. */
const district = (z: unknown): string | null => {
  const code = typeof z === 'string' ? z.toUpperCase().replace(/\s+/g, '') : '';
  return /^[A-Z]{1,2}\d[A-Z\d]?$/.test(code) ? code : null;
};

/** Pence from 0 to max, or undefined when `v` is not a number. */
const pence = (v: unknown, max: number): number | undefined => {
  const n = int(v, 0, max, -1);
  return n < 0 ? undefined : n;
};

function sanitiseZones(v: unknown, districts: string[]): DeliveryZone[] {
  const out: DeliveryZone[] = [];
  for (const z of arr(v) as any[]) {
    const code = district(z?.code);
    if (!code || !districts.includes(code) || out.some((x) => x.code === code)) continue;
    const zone: DeliveryZone = { code };
    const fee = pence(z.fee_pence, 2000);
    const min = pence(z.min_order_pence, 10000);
    if (fee !== undefined) zone.fee_pence = fee;
    if (min !== undefined) zone.min_order_pence = min;
    out.push(zone);
  }
  return out;
}

/**
 * The ordering fields of `v`; anything else in it is the caller's to read.
 * The result has exactly the optional fields `d` has, which is what makes the
 * cast below true. A field `v` leaves out takes its default, so answers saved
 * before a preset gained one still load.
 */
export function sanitiseOrdering<O extends OrderingAnswer>(v: unknown, d: O): Pick<O, keyof OrderingAnswer & keyof O> {
  const s = (v ?? {}) as any;
  const collection: CollectionAnswer = {
    enabled: bool(s.collection?.enabled, d.collection.enabled),
    prep_minutes: int(s.collection?.prep_minutes, 5, 120, d.collection.prep_minutes),
    slot_minutes: oneOf(s.collection?.slot_minutes, [5, 10, 15, 20, 30] as unknown as readonly number[] as never, d.collection.slot_minutes as never),
    per_slot: int(s.collection?.per_slot, 0, 50, d.collection.per_slot),
  };
  if (d.collection.evenings_only !== undefined) collection.evenings_only = bool(s.collection?.evenings_only, d.collection.evenings_only);
  // A missing or empty districts list stays empty, never the defaults': the restaurant has always read it so.
  const districts = arr(s.delivery?.districts).map(district).filter((z): z is string => z !== null).slice(0, 30);
  const delivery: DeliveryAnswer = {
    enabled: bool(s.delivery?.enabled, d.delivery.enabled),
    districts,
    fee_pence: int(s.delivery?.fee_pence, 0, 2000, d.delivery.fee_pence),
    min_order_pence: int(s.delivery?.min_order_pence, 0, 10000, d.delivery.min_order_pence),
    extra_minutes: int(s.delivery?.extra_minutes, 0, 120, d.delivery.extra_minutes),
  };
  if (d.delivery.zones !== undefined) delivery.zones = sanitiseZones(s.delivery?.zones === undefined ? d.delivery.zones : s.delivery.zones, districts);
  if (d.delivery.free_over_pence !== undefined) {
    const free = s.delivery?.free_over_pence;
    delivery.free_over_pence = free === null ? null : pence(free, 10000) ?? d.delivery.free_over_pence;
  }
  if (d.delivery.drivers !== undefined) {
    const names = s.delivery?.drivers === undefined ? d.delivery.drivers : arr(s.delivery.drivers);
    delivery.drivers = names.map((x) => str(x, 30)).filter(Boolean).slice(0, 10);
  }
  const out: OrderingAnswer = {
    collection,
    delivery,
    delivery_apps: arr(s.delivery_apps).filter((z): z is string => typeof z === 'string').map((z) => z.slice(0, 20)).slice(0, 5),
  };
  if (d.timed_orders !== undefined) out.timed_orders = bool(s.timed_orders, d.timed_orders);
  return out as Pick<O, keyof OrderingAnswer & keyof O>;
}

export const sanitisePayment = (v: unknown, d: OrderPayment): OrderPayment => oneOf(v, ORDER_PAYMENTS, d);

export const takesOrders = (o: OrderingAnswer): boolean => o.collection.enabled || o.delivery.enabled;

/** The profile's ordering, or nothing when neither collection nor delivery is on. */
export function compileOrdering(o: OrderingAnswer, hours: { days: DayHours[] }, payment: OrderPayment): Ordering | undefined {
  const c = o.collection;
  const del = o.delivery;
  if (!c.enabled && !del.enabled) return undefined;
  const periods = hours.days.map((d) =>
    d.open ? d.services.filter((s) => !c.evenings_only || closeMinutes(s.close) > minutesOf('17:00')).map((s) => ({ ...s, label: 'takeaway' })) : null,
  );
  // Zones, free delivery and timed orders reach the profile only when the answers have them (§1 rule 4): the restaurant's never do.
  const zones = (del.zones ?? []).filter((z) => z.fee_pence !== undefined || z.min_order_pence !== undefined);
  return {
    collection: c.enabled,
    delivery: del.enabled
      ? {
        districts: del.districts.map((x) => x.toUpperCase().trim()).filter(Boolean), fee_pence: del.fee_pence, min_order_pence: del.min_order_pence, extra_minutes: del.extra_minutes,
        ...(zones.length ? { zones: zones.map((z) => ({ ...z })) } : {}),
        ...(del.free_over_pence ? { free_over_pence: del.free_over_pence } : {}),
      }
      : undefined,
    ...(o.timed_orders !== undefined ? { timed_orders: o.timed_orders } : {}),
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
