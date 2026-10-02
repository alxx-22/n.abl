// The restaurant's tables and areas as the builder edits them: the kinds of
// area, table features, and adding or removing a table or an area. Shared by
// the Seating and Floor plan steps.

import { autoLayout } from '../../../../../src/presets/restaurant/layout.ts';
import type { AreaAnswer, RestaurantAnswers, TableAnswer } from '../../types.ts';

export const FEATURES: { key: string; label: string }[] = [
  { key: 'window', label: 'Window' }, { key: 'booth', label: 'Booth' }, { key: 'quiet', label: 'Quiet' }, { key: 'heated', label: 'Heated' },
  { key: 'covered', label: 'Covered' }, { key: 'dog_friendly', label: 'Dog-friendly' }, { key: 'high_table', label: 'High table' },
  { key: 'sofa', label: 'Sofa' }, { key: 'view', label: 'View' },
];

export const KINDS: { value: AreaAnswer['kind']; label: string }[] = [
  { value: 'indoor', label: 'Inside' }, { value: 'outdoor', label: 'Outdoor' }, { value: 'bar', label: 'Bar or counter' },
  { value: 'private', label: 'Private room' }, { value: 'other', label: 'Other' },
];

export function nextTableKey(tables: TableAnswer[]): number {
  return Math.max(0, ...tables.map((t) => Number(/^T(\d+)$/.exec(t.key)?.[1] ?? 0))) + 1;
}

export function addTable(d: RestaurantAnswers, area: string, seats: number): void {
  const n = nextTableKey(d.seating.tables);
  d.seating.tables.push({
    key: `T${n}`, label: `Table ${n}`, area, seats, shape: seats <= 2 ? 'round' : seats <= 4 ? 'square' : 'rect',
    x: 0, y: 0, rotation: 0, accessible: false, walk_in: false, features: [], joins: [],
  });
  d.seating.tables = autoLayout(d.seating.areas, d.seating.tables);
}

export function removeTable(d: RestaurantAnswers, key: string): void {
  d.seating.tables = d.seating.tables.filter((t) => t.key !== key);
  for (const t of d.seating.tables) t.joins = t.joins.filter((j) => j !== key);
}

const AREA_LABEL: Record<AreaAnswer['kind'], string> = { indoor: 'Inside', outdoor: 'Terrace', bar: 'Bar', private: 'Private dining room', other: 'Upstairs' };

/** The key a new area of this kind will get. */
export function nextAreaKey(areas: AreaAnswer[], kind: AreaAnswer['kind']): string {
  let key = AREA_LABEL[kind].toLowerCase().replace(/[^a-z0-9]+/g, '_');
  while (areas.some((x) => x.key === key)) key += '_2';
  return key;
}

/** A new area with one table in it; returns its key. */
export function addArea(d: RestaurantAnswers, kind: AreaAnswer['kind']): string {
  const label = AREA_LABEL[kind];
  const key = nextAreaKey(d.seating.areas, kind);
  d.seating.areas.push({ key, label, kind, reservable: kind !== 'bar', enquiry_only: kind === 'private', weather_rule: kind === 'outdoor' ? 'move_inside' : null });
  addTable(d, key, kind === 'private' ? 8 : 4);
  return key;
}
