// Room shapes on the floor plan: a bar counter, a door, a window, a wall.
// For looks only; a table is never blocked by one.

import { arr, int, oneOf } from '../common/sanitise.ts';
import { FIXTURE_LENGTH, footprint } from './layout.ts';
import type { FixtureAnswer, TableAnswer } from './types.ts';

/** A bar, a door and the window by the window tables, so a sample room looks like a room. */
export function defaultFixtures(tables: TableAnswer[], area = 'indoor'): FixtureAnswer[] {
  const inside = tables.filter((t) => t.area === area);
  const windowTables = inside.filter((t) => t.features.includes('window'));
  if (!inside.length) return [];
  const right = Math.max(...inside.map((t) => t.x + footprint(t).w));
  const bottom = Math.max(...inside.map((t) => t.y + footprint(t).h));
  const out: FixtureAnswer[] = [];
  if (windowTables.length) {
    const x0 = Math.min(...windowTables.map((t) => t.x));
    const x1 = Math.max(...windowTables.map((t) => t.x + footprint(t).w));
    out.push({ key: 'F1', area, kind: 'window', x: Math.max(10, x0 - 10), y: 10, length: Math.max(80, x1 - x0 + 20), rotation: 0 });
  }
  out.push({ key: 'F2', area, kind: 'bar', x: Math.max(40, right - FIXTURE_LENGTH.bar.start), y: bottom + 50, length: FIXTURE_LENGTH.bar.start, rotation: 0 });
  out.push({ key: 'F3', area, kind: 'door', x: 40, y: bottom + 40, length: FIXTURE_LENGTH.door.start, rotation: 0 });
  return out;
}

export function sanitiseFixtures(v: unknown, areaKeys: Set<string>, d: FixtureAnswer[]): FixtureAnswer[] {
  if (v === undefined) return d;
  const seen = new Set<string>();
  return arr(v).slice(0, 60).flatMap((x: any, i): FixtureAnswer[] => {
    const kind = oneOf(x?.kind, ['bar', 'door', 'window', 'wall'] as const, 'wall');
    const k = typeof x?.key === 'string' && /^[A-Za-z0-9]{1,8}$/.test(x.key) ? x.key : `F${i + 1}`;
    if (seen.has(k) || typeof x?.area !== 'string' || !areaKeys.has(x.area)) return [];
    seen.add(k);
    const L = FIXTURE_LENGTH[kind];
    return [{
      key: k, area: x.area, kind,
      x: int(x?.x, 0, 2000, 40), y: int(x?.y, 0, 4000, 40),
      length: int(x?.length, L.min, L.max, L.start),
      rotation: (int(x?.rotation, 0, 359, 0) / 90 | 0) * 90 % 360,
    }];
  });
}
