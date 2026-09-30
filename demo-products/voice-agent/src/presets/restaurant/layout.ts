// The first draft of a floor plan: each area a band across the canvas, its
// tables in rows by size. The prospect drags them from here; the same
// coordinates draw the live floor plan.

import type { AreaAnswer, TableAnswer } from './answers.ts';

export const CANVAS_WIDTH = 1000;
const MARGIN = 40;
const GAP = 34;
const AREA_GAP = 70;

/** A table's footprint on the plan, in plan units. */
export function tableSize(t: Pick<TableAnswer, 'seats' | 'shape'>): { w: number; h: number } {
  if (t.shape === 'round') return { w: 56 + Math.max(0, t.seats - 2) * 6, h: 56 + Math.max(0, t.seats - 2) * 6 };
  if (t.shape === 'square') return { w: 76, h: 76 };
  const w = 60 + t.seats * 17;
  return { w, h: 70 };
}

type Rect = { x: number; y: number; w: number; h: number };
const rectOf = (t: TableAnswer): Rect => ({ x: t.x, y: t.y, ...tableSize(t) });
const overlaps = (a: Rect, b: Rect, pad: number) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
const isPlaced = (t: TableAnswer) => !(t.x === 0 && t.y === 0);

/**
 * Places every table that sits at (0, 0); tables already placed stay put.
 * A new area gets a band below everything else. A table added to an area
 * that is already laid out goes in the first gap inside that area, or in a
 * new row under it, pushing the areas below down to make room, so it never
 * lands in another area.
 */
export function autoLayout(areas: AreaAnswer[], tables: TableAnswer[]): TableAnswer[] {
  const out = tables.map((t) => ({ ...t }));
  for (const a of areas) {
    const unplaced = out.filter((t) => t.area === a.key && !isPlaced(t)).sort((p, q) => p.seats - q.seats);
    if (!unplaced.length) continue;
    const placed = () => out.filter(isPlaced);
    const mine = () => placed().filter((t) => t.area === a.key);

    if (!mine().length) {
      // A band under everything placed so far.
      let top = Math.max(MARGIN + 28, ...placed().map((t) => t.y + tableSize(t).h + AREA_GAP + 28));
      let x = MARGIN;
      let rowH = 0;
      for (const t of unplaced) {
        const { w, h } = tableSize(t);
        if (x + w > CANVAS_WIDTH - MARGIN) {
          x = MARGIN;
          top += rowH + GAP;
          rowH = 0;
        }
        t.x = x;
        t.y = top;
        x += w + GAP;
        rowH = Math.max(rowH, h);
      }
      continue;
    }

    for (const t of unplaced) {
      const { w, h } = tableSize(t);
      const others = placed();
      const otherZones = areas.filter((b) => b.key !== a.key).map((b) => areaBounds(b.key, others)).filter((z): z is Rect => Boolean(z));
      const top = Math.min(...mine().map((u) => u.y));
      const bottom = Math.max(...mine().map((u) => u.y + tableSize(u).h));
      const free = (x: number, y: number) => {
        const r = { x, y, w, h };
        return !others.some((u) => overlaps(r, rectOf(u), GAP - 4)) && !otherZones.some((z) => overlaps(r, z, 8));
      };
      let spot: { x: number; y: number } | null = null;
      for (let y = top; y + h <= bottom && !spot; y += 10) {
        for (let x = MARGIN; x + w <= CANVAS_WIDTH - MARGIN; x += 10) {
          if (free(x, y)) {
            spot = { x, y };
            break;
          }
        }
      }
      if (!spot) {
        // A new row under the area: everything below it moves down to make room.
        const y = bottom + GAP;
        for (const u of others) if (u.area !== a.key && u.y >= bottom) u.y += h + GAP;
        spot = { x: MARGIN, y };
        for (let x = MARGIN; x + w <= CANVAS_WIDTH - MARGIN; x += 10) {
          if (!others.some((u) => overlaps({ x, y, w, h }, rectOf(u), GAP - 4))) {
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

/** The rectangle an area's zone is drawn as: its tables' bounds, padded. */
export function areaBounds(area: string, tables: TableAnswer[]): { x: number; y: number; w: number; h: number } | null {
  const mine = tables.filter((t) => t.area === area);
  if (!mine.length) return null;
  const pad = 22;
  const x0 = Math.min(...mine.map((t) => t.x)) - pad;
  const y0 = Math.min(...mine.map((t) => t.y)) - pad - 22;
  const x1 = Math.max(...mine.map((t) => t.x + tableSize(t).w)) + pad;
  const y1 = Math.max(...mine.map((t) => t.y + tableSize(t).h)) + pad;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
