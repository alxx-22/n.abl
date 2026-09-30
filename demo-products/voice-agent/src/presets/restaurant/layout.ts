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

/** Places every table that sits at (0, 0), area by area; tables already placed stay put. */
export function autoLayout(areas: AreaAnswer[], tables: TableAnswer[]): TableAnswer[] {
  const out = tables.map((t) => ({ ...t }));
  let top = MARGIN + 28; // room for the area's name
  for (const a of areas) {
    const mine = out.filter((t) => t.area === a.key && t.x === 0 && t.y === 0);
    const placed = out.filter((t) => t.area === a.key && !(t.x === 0 && t.y === 0));
    if (placed.length) {
      const bottom = Math.max(...placed.map((t) => t.y + tableSize(t).h));
      top = Math.max(top, bottom + GAP);
    }
    let x = MARGIN;
    let rowH = 0;
    for (const t of mine.sort((p, q) => p.seats - q.seats)) {
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
    top += rowH + AREA_GAP + 28;
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
