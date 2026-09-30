// Restaurant answers → the receptionist's profile. Pure: the same answers
// always make the same profile, and every field the builder offers changes
// something here (test/restaurant.test.ts checks each one).

import type {
  BookableService, KnowledgeEntry, OpeningHours, Ordering, Resource, SeatingArea, TenantProfile, Window,
} from '../../domain/types.ts';
import { dayName, minutesOf, spokenTime, timeOf } from '../../domain/time.ts';
import { pounds } from '../../domain/types.ts';
import type { AreaAnswer, RestaurantAnswers, TableAnswer } from './answers.ts';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first, the way people say it

/** "Tuesday to Saturday", "Sunday", "Friday and Saturday", "Monday, Wednesday and Friday". */
export function dayRange(days: number[]): string {
  const sorted = DAY_ORDER.filter((d) => days.includes(d));
  if (sorted.length === 7) return 'Every day';
  const runs: number[][] = [];
  for (const d of sorted) {
    const last = runs[runs.length - 1];
    if (last && DAY_ORDER.indexOf(d) === DAY_ORDER.indexOf(last[last.length - 1]) + 1) last.push(d);
    else runs.push([d]);
  }
  const parts = runs.map((r) => (r.length >= 3 ? `${dayName(r[0])} to ${dayName(r[r.length - 1])}` : r.map(dayName).join(' and ')));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
}

/** Groups identical entries across days: [{days:[2..6], value}]. */
function groupByDay<T>(perDay: (T[] | null)[], key: (v: T) => string): { days: number[]; value: T }[] {
  const out = new Map<string, { days: number[]; value: T }>();
  perDay.forEach((vals, day) => {
    for (const v of vals ?? []) {
      const k = key(v);
      const g = out.get(k) ?? { days: [], value: v };
      g.days.push(day);
      out.set(k, g);
    }
  });
  return [...out.values()];
}

function openingHours(a: RestaurantAnswers): OpeningHours[] {
  return groupByDay(
    a.hours.days.map((d) => (d.open ? d.services : null)),
    (s) => `${s.label}|${s.open}|${s.close}`,
  ).map((g) => ({ days: g.days.sort(), open: g.value.open, close: g.value.close, label: g.value.label }));
}

export function hoursSentence(a: RestaurantAnswers): string {
  const byPattern = groupByDay(
    a.hours.days.map((d) => (d.open && d.services.length ? [d.services] : null)),
    (ss) => ss.map((s) => `${s.label}|${s.open}|${s.close}`).join(','),
  );
  const parts = byPattern.map((g) => {
    const ss = g.value;
    const times = ss.length === 1
      ? `${spokenTime(ss[0].open)} till ${spokenTime(ss[0].close)}`
      : ss.map((s) => `${s.label.toLowerCase()} ${spokenTime(s.open)} till ${spokenTime(s.close)}`).join(', ');
    return `${dayRange(g.days)}: ${times}`;
  });
  const closed = a.hours.days.map((d, i) => (d.open ? -1 : i)).filter((i) => i >= 0);
  if (closed.length) parts.push(`Closed ${dayRange(closed)}${closed.length === 1 ? 's' : ''}`);
  return parts.map((p) => p.replace(/^./, (c) => c.toUpperCase())).join('. ') + '.';
}

function windows(a: RestaurantAnswers): Window[] {
  return groupByDay(
    a.hours.days.map((d) =>
      d.open
        ? d.services
            .map((s) => ({ first: s.open, last: timeOf(Math.max(minutesOf(s.open), minutesOf(s.close) - a.hours.last_booking_before_close)) }))
            .filter((w) => minutesOf(w.last) >= minutesOf(w.first))
        : null,
    ),
    (w) => `${w.first}|${w.last}`,
  ).map((g) => ({ days: g.days.sort(), first: g.value.first, last: g.value.last }));
}

const WEATHER: Record<NonNullable<AreaAnswer['weather_rule']>, string> = {
  move_inside: 'is bookable; if the weather turns, we move you inside',
  own_risk: 'is bookable, but in bad weather we cannot promise a table inside',
  walk_in_only: 'is first come, first served, not bookable',
};
const weatherSentence = (x: AreaAnswer) => `The ${x.label.toLowerCase()} ${WEATHER[x.weather_rule!]}.`;

function areas(a: RestaurantAnswers): SeatingArea[] {
  return a.seating.areas.map((x) => ({
    key: x.key,
    label: x.label,
    kind: x.kind,
    reservable: x.reservable && !x.enquiry_only && x.weather_rule !== 'walk_in_only',
    enquiry_only: x.enquiry_only || undefined,
    weather_note: x.kind === 'outdoor' && x.weather_rule ? weatherSentence(x) : undefined,
  }));
}

const bookableArea = (a: RestaurantAnswers, key: string) => {
  const x = a.seating.areas.find((y) => y.key === key);
  return Boolean(x && x.reservable && !x.enquiry_only && x.weather_rule !== 'walk_in_only');
};

export const tableBookable = (a: RestaurantAnswers, t: TableAnswer) => a.serve.reservations && !t.walk_in && bookableArea(a, t.area);

function resources(a: RestaurantAnswers): Resource[] {
  const tables: Resource[] = a.seating.tables.map((t) => ({
    key: t.key,
    label: t.label,
    // Walk-in tables and unbookable areas are on the plan but never booked by phone.
    services: tableBookable(a, t) ? ['table'] : [],
    capacity: t.seats,
    min: t.seats >= 6 ? 3 : 1,
    area: t.area,
    accessible: t.accessible || undefined,
    features: t.features.length ? t.features : undefined,
    layout: { x: t.x, y: t.y, shape: t.shape, seats: t.seats, rotation: t.rotation || undefined },
  }));
  // Pushed-together pairs: only for parties too big for either table alone.
  const byKey = new Map(a.seating.tables.map((t) => [t.key, t]));
  const pairs: Resource[] = [];
  const seen = new Set<string>();
  for (const t of a.seating.tables) {
    for (const j of t.joins) {
      const u = byKey.get(j);
      if (!u || u.area !== t.area) continue;
      const [p, q] = [t, u].sort((x, y) => Number(x.key.slice(1)) - Number(y.key.slice(1)) || x.key.localeCompare(y.key));
      const key = `${p.key}+${q.key}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({
        key,
        label: `${p.label} and ${q.label.replace(/^Table /, '')}`,
        services: tableBookable(a, p) && tableBookable(a, q) ? ['table'] : [],
        capacity: p.seats + q.seats,
        min: Math.max(p.seats, q.seats) + 1,
        combines: [p.key, q.key],
        area: p.area,
        accessible: p.accessible || q.accessible || undefined,
        features: [...new Set([...p.features, ...q.features])].filter(Boolean),
      });
    }
  }
  return [...tables, ...pairs];
}

function service(a: RestaurantAnswers): BookableService {
  const d = a.money.deposit;
  return {
    key: 'table',
    label: 'table',
    kind: 'table',
    slot_minutes: 15,
    duration_rules: [
      { max_party: 2, minutes: a.seating.sittings.up_to_2 },
      { max_party: 4, minutes: a.seating.sittings.up_to_4 },
      { max_party: 8, minutes: a.seating.sittings.up_to_8 },
      { max_party: 100, minutes: a.seating.sittings.larger },
    ],
    windows: windows(a),
    max_party: a.seating.max_party,
    large_party_note: `For more than ${a.seating.max_party} people, take their name, number, preferred date and time, and say the manager will call back.`,
    lead_minutes: a.seating.notice_minutes,
    horizon_days: a.seating.horizon_days,
    buffer_minutes: a.seating.buffer_minutes || undefined,
    deposit:
      d.mode === 'per_person' ? { min_party: d.min_party, per_person_pence: d.amount_pence }
      : d.mode === 'per_booking' ? { min_party: d.min_party, flat_pence: d.amount_pence }
      : undefined,
  };
}

function ordering(a: RestaurantAnswers): Ordering | undefined {
  const c = a.serve.collection;
  const del = a.serve.delivery;
  if (!c.enabled && !del.enabled) return undefined;
  const periods = a.hours.days.map((d) =>
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
    payment: a.money.takeaway_payment,
    hours: groupByDay(periods, (s) => `${s.open}|${s.close}`).map((g) => ({ days: g.days.sort(), open: g.value.open, close: g.value.close, label: 'takeaway' })),
  };
}

function dogsAnswer(a: RestaurantAnswers): string {
  const outside = a.seating.areas.find((x) => x.kind === 'outdoor');
  if (a.policies.dogs === 'inside') return 'Dogs are welcome inside and out; we have water bowls.';
  if (a.policies.dogs === 'outside_only') {
    return outside ? `Dogs are welcome on the ${outside.label.toLowerCase()}, but not inside, apart from assistance dogs.` : 'Only assistance dogs inside, I’m afraid.';
  }
  return 'Only assistance dogs, I’m afraid.';
}

function depositSentence(a: RestaurantAnswers): string | null {
  const d = a.money.deposit;
  if (d.mode === 'per_person') return `Tables of ${d.min_party} or more pay a ${pounds(d.amount_pence)} a head deposit when booking, taken off the bill on the night.`;
  if (d.mode === 'per_booking') return `Bookings for ${d.min_party} or more pay a ${pounds(d.amount_pence)} deposit when booking, taken off the bill on the night.`;
  if (d.mode === 'card_hold') return 'We take card details to hold larger bookings; nothing is charged unless it is a no-show.';
  return null;
}

function takeawaySentence(a: RestaurantAnswers): string | null {
  const c = a.serve.collection;
  const del = a.serve.delivery;
  if (!c.enabled && !del.enabled) return null;
  const how = [c.enabled ? 'click and collect by phone' : null, del.enabled ? `delivery to ${del.districts.join(', ') || 'nearby postcodes'}` : null].filter(Boolean).join(' and ');
  const pay = { phone: 'Takeaway is paid by card over the phone.', collection: 'Takeaway is paid when you collect.', either: 'Takeaway can be paid by card over the phone or when you collect.' }[a.money.takeaway_payment];
  return `Takeaway: ${how}${c.evenings_only ? ', evenings' : ''}; food takes about ${c.prep_minutes} minutes. ${pay}`;
}

function seatingSentence(a: RestaurantAnswers): string | null {
  if (!a.serve.reservations) return a.serve.walk_ins ? 'We don’t take bookings; it’s walk-in only.' : null;
  const counts = a.seating.areas
    .map((x) => ({ x, n: a.seating.tables.filter((t) => t.area === x.key).length }))
    .filter((c) => c.n > 0)
    .map(({ x, n }) => `${x.label.toLowerCase()} (${n} tables${x.enquiry_only ? ', private hire by enquiry' : !x.reservable || x.weather_rule === 'walk_in_only' ? ', walk-in only' : ''})`);
  const outdoor = a.seating.areas.find((x) => x.kind === 'outdoor' && x.weather_rule);
  const walk = a.serve.walk_ins ? ' We keep some tables back for walk-ins.' : '';
  return `Seating: ${counts.join(' and ')}.${outdoor ? ` ${weatherSentence(outdoor)}` : ''}${walk}`;
}

function knowledge(a: RestaurantAnswers): KnowledgeEntry[] {
  const p = a.policies;
  const e = (q: string, ans: string, tags: string[]): KnowledgeEntry | null => (ans.trim() ? { q, a: ans.trim(), tags } : null);
  const list: (KnowledgeEntry | null)[] = [
    e('Can I bring my dog?', dogsAnswer(a), ['dog', 'dogs', 'pet']),
    e('Is there parking?', p.parking, ['parking', 'car', 'park']),
    e('Is it accessible for wheelchairs?', p.accessibility, ['wheelchair', 'accessible', 'disabled', 'step free', 'accessibility', 'toilet']),
    e('Is there a dress code?', p.dress_code, ['dress', 'code', 'smart', 'wear']),
    e('Can I bring my own wine?', p.corkage, ['byo', 'corkage', 'wine', 'bring']),
    e('Can I bring a birthday cake?', p.cakes, ['cake', 'birthday', 'cakeage']),
    e('Do you sell gift vouchers?', p.vouchers, ['voucher', 'gift', 'present']),
    e('Do you have vegan or gluten-free options?', p.dietary, ['vegan', 'vegetarian', 'gluten', 'coeliac', 'dairy', 'dietary']),
    e('Are children welcome?', `${p.children}${a.seating.highchairs ? ` We have ${a.seating.highchairs} highchairs.` : ''}`, ['children', 'kids', 'child', 'highchair', 'baby']),
    e('Is there a service charge?', a.money.service_charge, ['service', 'charge', 'tip', 'gratuity']),
    e('What is your cancellation policy?', a.money.cancellation_policy, ['cancel', 'cancellation', 'refund', 'deposit']),
    e('Do you take walk-ins?', a.serve.walk_ins ? 'Yes, we keep some tables for walk-ins, though booking is safest at busy times.' : 'We’re bookings only, I’m afraid.', ['walk', 'walk-in', 'without booking', 'turn up']),
    a.serve.delivery_apps.length
      ? e('Are you on the delivery apps?', `Yes, you can order from us on ${a.serve.delivery_apps.join(' and ')}.`, ['deliveroo', 'uber', 'just eat', 'app', 'delivery'])
      : null,
  ];
  return [...list.filter((x): x is KnowledgeEntry => Boolean(x)), ...a.policies.faqs.filter((f) => f.q.trim() && f.a.trim()).map((f) => ({ q: f.q.trim(), a: f.a.trim(), tags: [] }))];
}

export function greetingFor(a: RestaurantAnswers): string {
  const g = a.basics.greeting.trim();
  if (g) return g;
  const name = a.basics.name.trim() || 'the restaurant';
  return `Hello, ${name}. I'm the AI assistant on this demo line. How can I help?`;
}

export function compileRestaurant(a: RestaurantAnswers, meta: { slug: string }): TenantProfile {
  const name = a.basics.name.trim() || 'Your restaurant';
  const place = a.basics.address.trim() || a.basics.town.trim();
  const style = a.basics.style.trim();
  const where = a.basics.address.trim() ? `, at ${a.basics.address.trim()}` : a.basics.town.trim() ? `, in ${a.basics.town.trim()}` : '';
  const facts = [
    `${name}${style ? `: ${style}` : ''}${where}.`,
    hoursSentence(a),
    seatingSentence(a),
    takeawaySentence(a),
    [a.policies.accessibility, a.policies.children, a.seating.highchairs ? `${a.seating.highchairs} highchairs.` : ''].filter(Boolean).join(' '),
    a.policies.parking,
  ].filter((f): f is string => Boolean(f && f.trim()));

  const policies: Record<string, string> = {};
  const dep = depositSentence(a);
  if (dep) policies.deposit = dep;
  if (a.money.cancellation_policy.trim()) policies.cancellation = a.money.cancellation_policy.trim();
  if (a.money.service_charge.trim()) policies.service_charge = a.money.service_charge.trim();
  const tk = takeawaySentence(a);
  if (tk) policies.takeaway = tk;
  policies.dogs = dogsAnswer(a);

  const bookable = a.serve.reservations && a.seating.tables.some((t) => tableBookable(a, t));
  const hasMenu = a.menu.categories.some((c) => c.items.length);

  return {
    slug: meta.slug,
    name,
    business_type: 'restaurant',
    timezone: 'Europe/London',
    status: 'demo',
    voice: a.basics.voice || 'Kore',
    greeting: greetingFor(a),
    summary: `${name} is a restaurant${a.basics.town.trim() ? ` in ${a.basics.town.trim()}` : ''}${style ? `: ${style}` : ''}.`,
    address: place || 'Address not given',
    phone_display: a.basics.phone_display.trim() || undefined,
    website: a.basics.website.trim() || undefined,
    brand: {
      accent: a.theme.accent,
      primary: a.theme.primary,
      background: a.theme.background,
      font_heading: a.theme.font_heading,
      font_body: a.theme.font_body,
      logo: a.theme.logo,
    },
    core_facts: facts.slice(0, 6),
    opening_hours: openingHours(a),
    closures: a.hours.closures.filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.date)).map((c) => ({ date: c.date, note: c.note || undefined })),
    knowledge: knowledge(a),
    booking: bookable ? { services: [service(a)], resources: resources(a), areas: areas(a), highchairs: a.seating.highchairs } : undefined,
    menu: hasMenu ? { categories: a.menu.categories, modifier_groups: a.menu.modifier_groups, allergen_statement: a.menu.allergen_statement } : undefined,
    ordering: hasMenu ? ordering(a) : undefined,
    policies,
  };
}
