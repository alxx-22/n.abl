// Tables: how many of each size, their features and joins, which ones a
// caller can book, and the profile's resources, pushed-together pairs
// included.

import type { Resource } from '../../domain/types.ts';
import { PresetError } from '../common/errors.ts';
import { arr, bool, int, oneOf, str } from '../common/sanitise.ts';
import { areaBookable } from './areas.ts';
import { autoLayout } from './layout.ts';
import type { AreaAnswer, SeatingAnswer, TableAnswer } from './types.ts';

export const TABLE_FEATURES = ['window', 'booth', 'quiet', 'heated', 'covered', 'dog_friendly', 'high_table', 'sofa', 'view'] as const;

/** Table counts by size, per area: the builder's "how many tables" step. */
export type TableCounts = Record<string, { 2: number; 4: number; 6: number; 8: number }>;

export function tablesFromCounts(areas: AreaAnswer[], counts: TableCounts): TableAnswer[] {
  const tables: TableAnswer[] = [];
  let n = 1;
  for (const a of areas) {
    const c = counts[a.key] ?? { 2: 0, 4: 0, 6: 0, 8: 0 };
    for (const seats of [2, 4, 6, 8] as const) {
      for (let i = 0; i < c[seats]; i++) {
        tables.push({
          key: `T${n}`, label: `Table ${n}`, area: a.key, seats,
          shape: seats === 2 ? 'round' : seats === 4 ? 'square' : 'rect',
          x: 0, y: 0, rotation: 0, accessible: false, walk_in: false, features: [], joins: [],
        });
        n++;
      }
    }
  }
  return autoLayout(areas, tables);
}

export function sanitiseTables(v: unknown, areaKeys: Set<string>, d: TableAnswer[]): TableAnswer[] {
  if (v === undefined) return d;
  const list = arr(v).slice(0, 80).map((x: any, i): TableAnswer => {
    const seats = int(x?.seats, 1, 20, 4);
    const k = typeof x?.key === 'string' && /^[A-Za-z0-9]{1,8}$/.test(x.key) ? x.key : `T${i + 1}`;
    return {
      key: k,
      label: str(x?.label, 30, `Table ${i + 1}`) || `Table ${i + 1}`,
      area: typeof x?.area === 'string' && areaKeys.has(x.area) ? x.area : [...areaKeys][0] ?? 'indoor',
      seats,
      shape: oneOf(x?.shape, ['round', 'square', 'rect'] as const, seats <= 2 ? 'round' : seats <= 4 ? 'square' : 'rect'),
      x: int(x?.x, 0, 2000, 0),
      y: int(x?.y, 0, 4000, 0),
      rotation: int(x?.rotation, 0, 359, 0),
      accessible: bool(x?.accessible, false),
      walk_in: bool(x?.walk_in, false),
      features: arr(x?.features).filter((f): f is (typeof TABLE_FEATURES)[number] => TABLE_FEATURES.includes(f as never)),
      joins: arr(x?.joins).filter((j): j is string => typeof j === 'string').slice(0, 4),
    };
  });
  const seen = new Set<string>();
  const unique = list.filter((t) => (seen.has(t.key) ? false : (seen.add(t.key), true)));
  // Joins must point at real tables, both ways.
  const keys = new Set(unique.map((t) => t.key));
  for (const t of unique) t.joins = [...new Set(t.joins.filter((j) => j !== t.key && keys.has(j)))];
  for (const t of unique) for (const j of t.joins) {
    const u = unique.find((x) => x.key === j)!;
    if (!u.joins.includes(t.key)) u.joins.push(t.key);
  }
  return unique;
}

/** A caller can book it, if the business takes bookings at all: not kept for walk-ins, in an area that takes bookings. */
export const tableBookable = (s: Pick<SeatingAnswer, 'areas'>, t: TableAnswer) => !t.walk_in && areaBookable(s.areas, t.area);

/** The profile's resources: every table, then the pairs that push together. */
export function compileTables(s: SeatingAnswer, reservations: boolean): Resource[] {
  const bookable = (t: TableAnswer) => reservations && tableBookable(s, t);
  const tables: Resource[] = s.tables.map((t) => ({
    key: t.key,
    label: t.label,
    // Walk-in tables and unbookable areas are on the plan but never booked by phone.
    services: bookable(t) ? ['table'] : [],
    capacity: t.seats,
    min: t.seats >= 6 ? 3 : 1,
    area: t.area,
    accessible: t.accessible || undefined,
    features: t.features.length ? t.features : undefined,
    layout: { x: t.x, y: t.y, shape: t.shape, seats: t.seats, rotation: t.rotation || undefined },
  }));
  // Pushed-together pairs: only for parties too big for either table alone.
  const byKey = new Map(s.tables.map((t) => [t.key, t]));
  const pairs: Resource[] = [];
  const seen = new Set<string>();
  for (const t of s.tables) {
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
        services: bookable(p) && bookable(q) ? ['table'] : [],
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

/**
 * The tables with x and y pushed together, both ways: staff joining two
 * tables for a booking in the back office. Refuses two that cannot be.
 */
export function joinTables(tables: TableAnswer[], x: string, y: string): TableAnswer[] {
  const tx = tables.find((t) => t.key === x);
  const ty = tables.find((t) => t.key === y);
  if (!tx || !ty || x === y) throw new PresetError(400, 'Pick two different tables.');
  if (tx.area !== ty.area) throw new PresetError(409, `${tx.label} and ${ty.label} are in different areas.`);
  if (tx.walk_in || ty.walk_in) throw new PresetError(409, 'One of those tables is kept for walk-ins.');
  return tables.map((t) => (t === tx ? { ...t, joins: [...new Set([...t.joins, y])] } : t === ty ? { ...t, joins: [...new Set([...t.joins, x])] } : t));
}
