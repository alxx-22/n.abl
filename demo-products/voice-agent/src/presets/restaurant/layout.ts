// The floor plan's geometry. Each seating area is its own room, drawn on its
// own canvas: a table's x and y are within its area's room, so moving one can
// never put it in another area. The prospect drags tables from the first
// draft autoLayout makes; the same coordinates draw the live floor plan.
//
// Pure, so the builder, the back office and the tests share it.

import type { AreaAnswer, FixtureAnswer, TableAnswer } from './answers.ts';

export const CANVAS_WIDTH = 1000;
export const MARGIN = 40;
/** Snap step, in plan units. */
export const GRID = 10;
const GAP = 34;
/** Tables closer than this, edge to edge, are drawn as touching: the builder offers to join them. */
export const TOUCHING = 16;

export type Rect = { x: number; y: number; w: number; h: number };

/** A table's size before it is turned, in plan units. */
export function tableSize(t: Pick<TableAnswer, 'seats' | 'shape'>): { w: number; h: number } {
  if (t.shape === 'round') return { w: 56 + Math.max(0, t.seats - 2) * 6, h: 56 + Math.max(0, t.seats - 2) * 6 };
  if (t.shape === 'square') return { w: 76, h: 76 };
  const w = 60 + t.seats * 17;
  return { w, h: 70 };
}

const sideways = (rotation: number | undefined) => ((rotation ?? 0) % 180 + 180) % 180 === 90;

/** The space a table takes on the plan: turned sideways, a long table is tall. Its x and y are this box's top left. */
export function footprint(t: Pick<TableAnswer, 'seats' | 'shape'> & { rotation?: number }): { w: number; h: number } {
  const s = tableSize(t);
  return sideways(t.rotation) ? { w: s.h, h: s.w } : s;
}

/** Room shapes, for looks only: tables are never blocked by them. */
export function fixtureSize(f: Pick<FixtureAnswer, 'kind' | 'length' | 'rotation'>): { w: number; h: number } {
  const thick = { bar: 46, wall: 12, window: 12, door: f.length }[f.kind];
  return sideways(f.rotation) ? { w: thick, h: f.length } : { w: f.length, h: thick };
}

export const FIXTURE_LENGTH: Record<FixtureAnswer['kind'], { start: number; min: number; max: number }> = {
  bar: { start: 240, min: 80, max: 700 },
  wall: { start: 200, min: 40, max: 1000 },
  window: { start: 140, min: 40, max: 600 },
  door: { start: 70, min: 50, max: 140 },
};

export const tableRect = (t: TableAnswer | (Pick<TableAnswer, 'x' | 'y' | 'seats' | 'shape'> & { rotation?: number })): Rect => ({ x: t.x, y: t.y, ...footprint(t) });
export const fixtureRect = (f: Pick<FixtureAnswer, 'x' | 'y' | 'kind' | 'length' | 'rotation'>): Rect => ({ x: f.x, y: f.y, ...fixtureSize(f) });
export const overlaps = (a: Rect, b: Rect, pad: number) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
const isPlaced = (t: TableAnswer) => !(t.x === 0 && t.y === 0);

/**
 * The nearest place to `near` where a box of this size sits clear of the
 * others (with `pad` between), on the grid, inside the canvas width. A drop
 * on top of another table slides here rather than being refused.
 */
export function freeSpot(size: { w: number; h: number }, near: { x: number; y: number }, others: Rect[], pad = 4): { x: number; y: number } {
  const maxX = CANVAS_WIDTH - size.w - GRID;
  const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
  const start = { x: clamp(Math.round(near.x / GRID) * GRID, GRID, maxX), y: Math.max(GRID, Math.round(near.y / GRID) * GRID) };
  const clear = (x: number, y: number) => !others.some((o) => overlaps({ x, y, ...size }, o, pad));
  if (clear(start.x, start.y)) return start;
  // Rings of growing distance; within a ring, the closest point wins.
  for (let r = 1; r < 400; r++) {
    let best: { x: number; y: number; d: number } | null = null;
    for (let dx = -r; dx <= r; dx++) {
      for (const dy of Math.abs(dx) === r ? Array.from({ length: 2 * r + 1 }, (_, i) => i - r) : [-r, r]) {
        const x = start.x + dx * GRID;
        const y = start.y + dy * GRID;
        if (x < GRID || x > maxX || y < GRID || !clear(x, y)) continue;
        const d = dx * dx + dy * dy;
        if (!best || d < best.d) best = { x, y, d };
      }
    }
    if (best) return { x: best.x, y: best.y };
  }
  return start;
}

/**
 * Where a box being dragged lands: lined up with a neighbour's left, centre
 * or right (top, middle or bottom) when it is within `threshold`, else on
 * the grid. Returns the lines it lined up on, for the guides drawn while
 * dragging.
 */
export function snap(moving: Rect, others: Rect[], threshold = 8): { x: number; y: number; guides: { x?: number; y?: number }[] } {
  const xs = (r: Rect) => [r.x, r.x + r.w / 2, r.x + r.w];
  const ys = (r: Rect) => [r.y, r.y + r.h / 2, r.y + r.h];
  const best = (mine: number[], theirs: number[]) => {
    let out: { shift: number; line: number } | null = null;
    for (const t of theirs) {
      for (const m of mine) {
        const shift = t - m;
        if (Math.abs(shift) <= threshold && (!out || Math.abs(shift) < Math.abs(out.shift))) out = { shift, line: t };
      }
    }
    return out;
  };
  const bx = best(xs(moving), others.flatMap(xs));
  const by = best(ys(moving), others.flatMap(ys));
  const guides: { x?: number; y?: number }[] = [];
  const x = bx ? moving.x + bx.shift : Math.round(moving.x / GRID) * GRID;
  const y = by ? moving.y + by.shift : Math.round(moving.y / GRID) * GRID;
  if (bx) guides.push({ x: bx.line });
  if (by) guides.push({ y: by.line });
  return { x: Math.max(0, x), y: Math.max(0, y), guides };
}

/**
 * Places every table that sits at (0, 0); tables already placed stay put. A
 * new area's tables go in tidy rows from the top left, smallest first, each
 * row's tables centred on one line. A table added to a laid-out area goes in
 * the first clear spot in it, row by row.
 */
export function autoLayout(areas: AreaAnswer[], tables: TableAnswer[]): TableAnswer[] {
  const out = tables.map((t) => ({ ...t }));
  for (const a of areas) {
    const unplaced = out.filter((t) => t.area === a.key && !isPlaced(t)).sort((p, q) => p.seats - q.seats);
    if (!unplaced.length) continue;
    const placed = out.filter((t) => t.area === a.key && isPlaced(t));
    if (!placed.length) {
      const rows: TableAnswer[][] = [[]];
      let x = MARGIN;
      for (const t of unplaced) {
        const { w } = footprint(t);
        if (x + w > CANVAS_WIDTH - MARGIN && rows.at(-1)!.length) {
          rows.push([]);
          x = MARGIN;
        }
        t.x = x;
        rows.at(-1)!.push(t);
        x += w + GAP;
      }
      let top = MARGIN;
      for (const row of rows) {
        const h = Math.max(...row.map((t) => footprint(t).h));
        for (const t of row) t.y = top + Math.round((h - footprint(t).h) / 2);
        top += h + GAP;
      }
      continue;
    }
    for (const t of unplaced) {
      const size = footprint(t);
      const others = out.filter((u) => u !== t && u.area === a.key && isPlaced(u)).map(tableRect);
      let spot: { x: number; y: number } | null = null;
      for (let y = MARGIN; !spot; y += GRID) {
        for (let x = MARGIN; x + size.w <= CANVAS_WIDTH - MARGIN; x += GRID) {
          if (!others.some((o) => overlaps({ x, y, ...size }, o, GAP - 4))) {
            spot = { x, y };
            break;
          }
        }
      }
      t.x = spot.x;
      t.y = spot.y;
    }
  }
  return out;
}

/** The box round everything in one area: its tables and room shapes. */
export function roomBounds(area: string, tables: TableAnswer[] | readonly (Pick<TableAnswer, 'x' | 'y' | 'seats' | 'shape' | 'area'> & { rotation?: number })[], fixtures: readonly (Pick<FixtureAnswer, 'x' | 'y' | 'kind' | 'length' | 'rotation' | 'area'>)[] = []): Rect | null {
  const rects = [...tables.filter((t) => t.area === area).map((t) => tableRect(t as TableAnswer)), ...fixtures.filter((f) => f.area === area).map(fixtureRect)];
  if (!rects.length) return null;
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Plans drawn before each area had its own room put every area on one
 * canvas, in bands. Each area's tables move up to the top left of their own
 * room, keeping how they sit relative to each other.
 */
export function intoRooms(areas: AreaAnswer[], tables: TableAnswer[]): TableAnswer[] {
  const out = tables.map((t) => ({ ...t }));
  for (const a of areas) {
    const mine = out.filter((t) => t.area === a.key && isPlaced(t));
    const b = roomBounds(a.key, mine);
    if (!b) continue;
    for (const t of mine) {
      t.x = Math.max(1, t.x - b.x + MARGIN);
      t.y = Math.max(1, t.y - b.y + MARGIN);
    }
  }
  return out;
}

/** The rectangle an area's zone is drawn as on a shared canvas: its contents' bounds, padded, with room for its name. */
export function areaBounds(area: string, tables: TableAnswer[], fixtures: FixtureAnswer[] = []): Rect | null {
  const b = roomBounds(area, tables, fixtures);
  if (!b) return null;
  const pad = 22;
  return { x: b.x - pad, y: b.y - pad - 22, w: b.w + pad * 2, h: b.h + pad * 2 + 22 };
}
