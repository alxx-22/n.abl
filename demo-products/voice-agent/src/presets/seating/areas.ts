// Seating areas: inside, a terrace, the bar, a private room. Which ones take
// bookings by phone, and what a caller is told about the weather outside.

import type { SeatingArea } from '../../domain/types.ts';
import { arr, bool, key, oneOf, str } from '../common/sanitise.ts';
import type { AreaAnswer } from './types.ts';

export function defaultAreas(): AreaAnswer[] {
  return [
    { key: 'indoor', label: 'Inside', kind: 'indoor', reservable: true, enquiry_only: false, weather_rule: null },
    { key: 'terrace', label: 'Terrace', kind: 'outdoor', reservable: true, enquiry_only: false, weather_rule: 'move_inside' },
  ];
}

export function sanitiseAreas(v: unknown, d: AreaAnswer[]): AreaAnswer[] {
  const list = arr(v).slice(0, 8).map((x: any, i): AreaAnswer => ({
    key: key(x?.key, `area_${i + 1}`),
    label: str(x?.label, 30, `Area ${i + 1}`) || `Area ${i + 1}`,
    kind: oneOf(x?.kind, ['indoor', 'outdoor', 'bar', 'private', 'other'] as const, 'indoor'),
    reservable: bool(x?.reservable, true),
    enquiry_only: bool(x?.enquiry_only, false),
    weather_rule: x?.kind === 'outdoor' ? oneOf(x?.weather_rule, ['move_inside', 'own_risk', 'walk_in_only'] as const, 'move_inside') : null,
  }));
  const seen = new Set<string>();
  const unique = list.filter((a) => (seen.has(a.key) ? false : (seen.add(a.key), true)));
  return v === undefined ? d : unique;
}

const WEATHER: Record<NonNullable<AreaAnswer['weather_rule']>, string> = {
  move_inside: 'is bookable; if the weather turns, we move you inside',
  own_risk: 'is bookable, but in bad weather we cannot promise a table inside',
  walk_in_only: 'is first come, first served, not bookable',
};
export const weatherSentence = (x: AreaAnswer) => `The ${x.label.toLowerCase()} ${WEATHER[x.weather_rule!]}.`;

/** Bookable by phone: not a private room taken by enquiry, not a first-come terrace. */
export const areaTakesBookings = (x: AreaAnswer) => x.reservable && !x.enquiry_only && x.weather_rule !== 'walk_in_only';

export function areaBookable(areas: AreaAnswer[], key: string): boolean {
  const x = areas.find((y) => y.key === key);
  return Boolean(x && areaTakesBookings(x));
}

export function compileAreas(areas: AreaAnswer[]): SeatingArea[] {
  return areas.map((x) => ({
    key: x.key,
    label: x.label,
    kind: x.kind,
    reservable: areaTakesBookings(x),
    enquiry_only: x.enquiry_only || undefined,
    weather_note: x.kind === 'outdoor' && x.weather_rule ? weatherSentence(x) : undefined,
  }));
}
