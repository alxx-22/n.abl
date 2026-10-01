// The floor plan, drawn as SVG. One component for both places it appears:
// the builder, where tables and room shapes are dragged into place one area
// at a time, and the back office, where each table shows its state and a
// booking is dragged from one table to another.
//
// Each area is its own room (layout.ts): drawn alone, or, in the back
// office's "All areas", stacked one under another.

import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import {
  CANVAS_WIDTH, GRID, TOUCHING, fixtureRect, fixtureSize, footprint, freeSpot, overlaps, roomBounds, snap, tableRect, tableSize, type Rect,
} from '../../../src/presets/restaurant/layout.ts';

export interface PlanTableLike {
  key: string;
  label: string;
  area: string | null;
  seats: number;
  shape: 'round' | 'square' | 'rect';
  x: number;
  y: number;
  rotation: number;
  accessible?: boolean;
  walk_in?: boolean;
  bookable?: boolean;
  /** Why it can't be booked by phone, printed on the table: "Walk-in", "Enquiries". */
  tag?: string | null;
  features?: string[];
  joins?: string[];
}

export interface PlanFixtureLike {
  key: string;
  area: string;
  kind: 'bar' | 'door' | 'window' | 'wall';
  x: number;
  y: number;
  length: number;
  rotation: number;
}

/** The tag for a table nobody can book by phone: kept for walk-ins, or in an area that is walk-in or enquiry only. */
export function unbookableTag(t: { walk_in?: boolean; bookable?: boolean }, area?: { reservable?: boolean; enquiry_only?: boolean } | null): string | null {
  if (t.walk_in) return 'Walk-in';
  if (t.bookable !== false) return null;
  return area?.enquiry_only ? 'Enquiries' : 'Walk-in';
}

export interface PlanArea {
  key: string;
  label: string;
  kind?: string;
}

export type TableState = 'free' | 'later' | 'arriving' | 'booked' | 'seated' | 'late' | 'closed';

export interface TableLook {
  state: TableState;
  /** Shown under the table number: a name, a time. */
  caption?: string;
  badges?: ('allergy' | 'access' | 'occasion' | 'deposit' | 'highchair')[];
  /** Part of a pushed-together pair with this table, drawn joined. */
  pairedWith?: string;
  /** Can be dragged onto another table (it has a booking at the chosen time). */
  draggable?: boolean;
  flash?: boolean;
}

const BADGE: Record<NonNullable<TableLook['badges']>[number], { text: string; cls: string; title: string }> = {
  allergy: { text: '!', cls: 'b-allergy', title: 'Allergy noted' },
  access: { text: '♿', cls: 'b-access', title: 'Step-free access needed' },
  occasion: { text: '★', cls: 'b-occasion', title: 'Birthday or occasion' },
  deposit: { text: '£', cls: 'b-deposit', title: 'Deposit' },
  highchair: { text: 'H', cls: 'b-highchair', title: 'Highchair' },
};

export const FIXTURE_LABEL: Record<PlanFixtureLike['kind'], string> = { bar: 'Bar counter', door: 'Door', window: 'Window', wall: 'Wall' };

function chairs(t: PlanTableLike, w: number, h: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const n = t.seats;
  if (t.shape === 'round') {
    const r = w / 2 + 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      out.push({ x: w / 2 + Math.cos(a) * r, y: h / 2 + Math.sin(a) * r });
    }
    return out;
  }
  // Square and long tables: seats along the two long sides, one at each end when odd or large.
  const ends = t.shape === 'rect' && n >= 6 ? 2 : n % 2 ? 1 : 0;
  const perSide = Math.ceil((n - ends) / 2);
  for (let side = 0; side < 2; side++) {
    const count = side === 0 ? perSide : n - ends - perSide;
    for (let i = 0; i < count; i++) out.push({ x: ((i + 1) * w) / (count + 1), y: side === 0 ? -9 : h + 9 });
  }
  if (ends >= 1) out.push({ x: -9, y: h / 2 });
  if (ends >= 2) out.push({ x: w + 9, y: h / 2 });
  return out;
}

/** Turns content drawn w by h about the centre of its footprint (fw by fh), so the footprint's top left stays at 0, 0. */
const turn = (rotation: number, w: number, h: number, fw: number, fh: number) =>
  rotation ? `translate(${fw / 2} ${fh / 2}) rotate(${rotation}) translate(${-w / 2} ${-h / 2})` : undefined;

/** Where each area sits on the drawing, and what the drawing shows. */
export function planLayout(
  tables: PlanTableLike[], fixtures: PlanFixtureLike[], areas: PlanArea[], area: string | null, mode: 'edit' | 'live',
): { view: Rect; offsets: Map<string, { x: number; y: number }>; zones: { area: PlanArea; rect: Rect }[] } {
  const offsets = new Map<string, { x: number; y: number }>();
  const asAnswers = tables.map((t) => ({ ...t, area: t.area ?? '' }));
  if (area) {
    offsets.set(area, { x: 0, y: 0 });
    const b = roomBounds(area, asAnswers, fixtures);
    if (mode === 'edit') {
      // Room to drag into: the canvas grows as tables move down.
      return { view: { x: 0, y: 0, w: CANVAS_WIDTH, h: Math.max(440, (b ? b.y + b.h : 0) + 160) }, offsets, zones: [] };
    }
    const r = b ?? { x: 40, y: 40, w: 400, h: 160 };
    return { view: { x: r.x - 40, y: r.y - 40, w: Math.max(r.w + 80, 640), h: r.h + 80 }, offsets, zones: [] };
  }
  // Every area, one under another, each in a labelled zone.
  const zones: { area: PlanArea; rect: Rect }[] = [];
  let top = 0;
  let width = 640;
  for (const a of areas) {
    const b = roomBounds(a.key, asAnswers, fixtures);
    if (!b) continue;
    offsets.set(a.key, { x: 40 - b.x, y: top + 64 - b.y });
    zones.push({ area: a, rect: { x: 16, y: top + 16, w: b.w + 48, h: b.h + 72 } });
    width = Math.max(width, b.w + 80);
    top += b.h + 96;
  }
  return { view: { x: 0, y: 0, w: width, h: Math.max(top, 200) }, offsets, zones };
}

type Drag = {
  kind: 'table' | 'fixture';
  key: string;
  /** Pointer to the item's top left, in plan units. */
  dx: number;
  dy: number;
  /** The item's position within its area (edit), or the pointer on the drawing (live). */
  x: number;
  y: number;
  /** Where the pointer went down, on the drawing: a click that wobbles is not a move. */
  sx: number;
  sy: number;
  moved: boolean;
  guides: { x?: number; y?: number }[];
  clash: boolean;
};

export function FloorPlan(props: {
  tables: PlanTableLike[];
  fixtures?: PlanFixtureLike[];
  areas: PlanArea[];
  /** One area's room, or null for every area stacked (the back office's "All areas"). */
  area: string | null;
  mode: 'edit' | 'live';
  /** 1 fits the width; larger scrolls. */
  zoom?: number;
  /** A table's key or a room shape's key. */
  selected?: string | null;
  onSelect?: (key: string | null) => void;
  /** Edit mode: a table was dropped at a new position within its area. */
  onMove?: (key: string, x: number, y: number) => void;
  onMoveFixture?: (key: string, x: number, y: number) => void;
  /** Edit mode: a table was dropped touching another it does not push together with yet. */
  onTouch?: (key: string, other: string) => void;
  /** Edit mode: something to tell the prospect about a move. */
  onNote?: (message: string) => void;
  /** Live mode: the booking on one table was dropped on another. */
  onDropOn?: (from: string, to: string) => void;
  looks?: Record<string, TableLook>;
  /** Tables to highlight as possible drop targets while dragging. */
  canDrop?: (from: string, to: string) => boolean;
  label?: string;
  children?: ReactNode;
}) {
  const { areas, mode, looks = {}, area } = props;
  const fixtures = props.fixtures ?? [];
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const layout = planLayout(props.tables, fixtures, areas, area, mode);
  const shown = (a: string | null) => layout.offsets.has(a ?? '');
  const tables = props.tables.filter((t) => shown(t.area));
  const shapes = fixtures.filter((f) => shown(f.area));
  const off = (a: string | null) => layout.offsets.get(a ?? '') ?? { x: 0, y: 0 };

  const toPlan = (e: { clientX: number; clientY: number }) => {
    const s = svg.current!;
    const pt = s.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(s.getScreenCTM()!.inverse());
  };

  /** A table's box on the drawing. */
  const drawn = (t: PlanTableLike): Rect => {
    const o = off(t.area);
    return { ...tableRect(t), x: t.x + o.x, y: t.y + o.y };
  };
  const hitTable = (x: number, y: number, except: string): string | null => {
    for (const t of tables) {
      if (t.key === except) continue;
      const r = drawn(t);
      if (x >= r.x - 6 && x <= r.x + r.w + 6 && y >= r.y - 6 && y <= r.y + r.h + 6) return t.key;
    }
    return null;
  };

  // Everything else in the same area, for snapping and overlaps.
  const neighbours = (kind: Drag['kind'], key: string, a: string | null) => ({
    tables: tables.filter((t) => t.area === a && !(kind === 'table' && t.key === key)),
    shapes: shapes.filter((f) => f.area === a && !(kind === 'fixture' && f.key === key)),
  });
  const sizeOf = (kind: Drag['kind'], key: string) => {
    if (kind === 'table') return footprint(tables.find((t) => t.key === key)!);
    return fixtureSize(shapes.find((f) => f.key === key)!);
  };
  const areaOf = (kind: Drag['kind'], key: string) => (kind === 'table' ? tables.find((t) => t.key === key)?.area ?? null : shapes.find((f) => f.key === key)?.area ?? null);

  const down = (e: ReactPointerEvent<SVGGElement>, kind: Drag['kind'], item: { key: string; x: number; y: number; area: string | null }) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    props.onSelect?.(item.key);
    const draggable = mode === 'edit' || (kind === 'table' && looks[item.key]?.draggable);
    if (!draggable) return;
    const p = toPlan(e);
    const o = off(item.area);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDrag({ kind, key: item.key, dx: p.x - (item.x + o.x), dy: p.y - (item.y + o.y), x: mode === 'edit' ? item.x : p.x, y: mode === 'edit' ? item.y : p.y, sx: p.x, sy: p.y, moved: false, guides: [], clash: false });
  };

  const move = (e: ReactPointerEvent<SVGGElement>) => {
    if (!drag) return;
    const p = toPlan(e);
    if (mode === 'live') {
      setDrag({ ...drag, x: p.x, y: p.y, moved: drag.moved || Math.abs(p.x - drag.sx) + Math.abs(p.y - drag.sy) > 4 });
      setOver(hitTable(p.x, p.y, drag.key));
      return;
    }
    const a = areaOf(drag.kind, drag.key);
    const o = off(a);
    const size = sizeOf(drag.kind, drag.key);
    const raw = { x: Math.max(0, Math.min(CANVAS_WIDTH - size.w, p.x - o.x - drag.dx)), y: Math.max(0, p.y - o.y - drag.dy), ...size };
    const n = neighbours(drag.kind, drag.key, a);
    const s = snap(raw, [...n.tables.map(tableRect), ...n.shapes.map(fixtureRect)]);
    const at = { ...raw, x: Math.min(CANVAS_WIDTH - size.w, s.x), y: s.y };
    const moved = drag.moved || Math.abs(p.x - drag.sx) + Math.abs(p.y - drag.sy) > 4;
    // Room shapes are for looks: only tables are kept apart.
    const clash = drag.kind === 'table' && n.tables.some((t) => overlaps(at, tableRect(t), 4));
    setDrag({ ...drag, x: at.x, y: at.y, moved, guides: s.guides, clash });
  };

  /** Puts a table down: where it was dropped, or the nearest clear space; then offers to join it to a table it now touches. */
  const placeTable = (key: string, x: number, y: number, slide: boolean) => {
    const t = tables.find((u) => u.key === key)!;
    const size = footprint(t);
    const others = tables.filter((u) => u.area === t.area && u.key !== key);
    let at = { x, y };
    if (others.some((u) => overlaps({ x, y, ...size }, tableRect(u), 4))) {
      if (!slide) return props.onNote?.('Tables cannot overlap: that space is taken.');
      // A gap wider than "touching", so a table that slid off another isn't offered as its pair.
      at = freeSpot(size, { x, y }, others.map(tableRect), TOUCHING + 4);
      props.onNote?.(`${t.label} would have sat on another table, so it went to the nearest clear space.`);
    }
    props.onMove?.(key, at.x, at.y);
    const touching = others.find((u) => !(t.joins ?? []).includes(u.key) && overlaps({ ...at, ...size }, tableRect(u), TOUCHING));
    if (touching) props.onTouch?.(key, touching.key);
  };

  const up = (e: ReactPointerEvent<SVGGElement>) => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    setOver(null);
    if (!d.moved) return;
    if (mode === 'live') {
      const target = hitTable(toPlan(e).x, toPlan(e).y, d.key);
      if (target) props.onDropOn?.(d.key, target);
      return;
    }
    if (d.kind === 'table') placeTable(d.key, Math.round(d.x), Math.round(d.y), true);
    else props.onMoveFixture?.(d.key, Math.round(d.x), Math.round(d.y));
  };

  const keyboard = (e: ReactKeyboardEvent<SVGGElement>, kind: Drag['kind'], item: { key: string; x: number; y: number }) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      props.onSelect?.(item.key);
      return;
    }
    if (mode !== 'edit') return;
    const step = e.shiftKey ? 50 : GRID;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    const size = sizeOf(kind, item.key);
    const x = Math.max(GRID, Math.min(CANVAS_WIDTH - size.w, item.x + d[0]));
    const y = Math.max(GRID, item.y + d[1]);
    if (kind === 'table') placeTable(item.key, x, y, false);
    else props.onMoveFixture?.(item.key, x, y);
  };

  const byKey = new Map(tables.map((t) => [t.key, t]));
  const posOf = (t: PlanTableLike) => (drag?.kind === 'table' && drag.key === t.key && mode === 'edit' ? { x: drag.x, y: drag.y } : t);
  const centre = (t: PlanTableLike) => {
    const p = posOf(t);
    const o = off(t.area);
    const { w, h } = footprint(t);
    return { x: p.x + o.x + w / 2, y: p.y + o.y + h / 2 };
  };
  const joins: [PlanTableLike, PlanTableLike, boolean][] = [];
  const seen = new Set<string>();
  for (const t of tables) {
    for (const j of t.joins ?? []) {
      const u = byKey.get(j);
      const k = [t.key, j].sort().join('+');
      if (!u || seen.has(k)) continue;
      seen.add(k);
      joins.push([t, u, false]);
    }
    const p = looks[t.key]?.pairedWith;
    if (p && byKey.get(p) && !seen.has(`live:${[t.key, p].sort().join('+')}`)) {
      seen.add(`live:${[t.key, p].sort().join('+')}`);
      joins.push([t, byKey.get(p)!, true]);
    }
  }
  const dragArea = drag ? off(areaOf(drag.kind, drag.key)) : { x: 0, y: 0 };
  const v = layout.view;

  return (
    <svg
      ref={svg}
      className={`floor ${mode} ${drag ? 'dragging' : ''}`}
      viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`}
      style={{ width: `${(props.zoom ?? 1) * 100}%` }}
      role="group"
      aria-label={props.label ?? 'Floor plan'}
      onPointerDown={(e) => {
        if (e.target === svg.current || (e.target as Element).classList?.contains('grid-bg')) props.onSelect?.(null);
      }}
    >
      {mode === 'edit' ? (
        <>
          <defs>
            <pattern id="plan-grid" width={GRID * 4} height={GRID * 4} patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={1.4} className="grid-dot" />
            </pattern>
          </defs>
          <rect className="grid-bg" x={v.x} y={v.y} width={v.w} height={v.h} fill="url(#plan-grid)" />
        </>
      ) : null}

      {layout.zones.map(({ area: a, rect }) => (
        <g key={a.key} className={`zone ${a.kind ?? ''}`}>
          <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={18} />
          <text x={rect.x + 16} y={rect.y + 26}>{a.label}</text>
        </g>
      ))}

      {shapes.map((f) => {
        const dragging = drag?.kind === 'fixture' && drag.key === f.key;
        const pos = dragging ? { x: drag.x, y: drag.y } : f;
        const o = off(f.area);
        const { w: fw, h: fh } = fixtureSize(f);
        const L = f.length;
        const T = f.kind === 'door' ? L : f.kind === 'bar' ? 46 : 12;
        const stools = f.kind === 'bar' ? Math.max(1, Math.floor((L - 20) / 44)) : 0;
        return (
          <g
            key={f.key}
            className={`fixture f-${f.kind} ${props.selected === f.key ? 'selected' : ''} ${dragging ? 'lifted' : ''}`}
            transform={`translate(${pos.x + o.x} ${pos.y + o.y})`}
            onPointerDown={(e) => down(e, 'fixture', f)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => setDrag(null)}
            onKeyDown={(e) => keyboard(e, 'fixture', f)}
            tabIndex={mode === 'edit' ? 0 : -1}
            role={mode === 'edit' ? 'button' : undefined}
            aria-label={mode === 'edit' ? `${FIXTURE_LABEL[f.kind]}, for looks only` : undefined}
            aria-hidden={mode === 'edit' ? undefined : true}
          >
            {mode === 'edit' ? <rect className="hit" width={fw} height={fh} /> : null}
            <g transform={turn(f.rotation, L, T, fw, fh)}>
              {f.kind === 'bar' ? (
                <>
                  {Array.from({ length: stools }, (_, i) => <circle key={i} className="stool" cx={((i + 1) * L) / (stools + 1)} cy={T + 11} r={7} />)}
                  <rect className="shape" width={L} height={T} rx={8} />
                </>
              ) : f.kind === 'door' ? (
                <>
                  <path className="swing" d={`M 0 0 A ${L} ${L} 0 0 1 ${L} ${L}`} />
                  <line className="leaf" x1={0} y1={L} x2={0} y2={0} />
                  <line className="sill" x1={0} y1={L} x2={L} y2={L} />
                </>
              ) : f.kind === 'window' ? (
                <>
                  <rect className="shape" width={L} height={T} rx={2} />
                  <line className="pane" x1={0} y1={T / 2} x2={L} y2={T / 2} />
                </>
              ) : (
                <rect className="shape" width={L} height={T} rx={3} />
              )}
            </g>
            {f.kind === 'bar' ? <text className="f-label" x={fw / 2} y={fh / 2 + 5}>Bar</text> : null}
          </g>
        );
      })}

      {joins.map(([p, q, live]) => {
        const a = centre(p);
        const b = centre(q);
        return <line key={`${p.key}-${q.key}-${live}`} className={`join ${live ? 'live' : ''}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}

      {/* Guides: the lines a dragged item has lined up on. */}
      {drag && mode === 'edit' && drag.moved
        ? drag.guides.map((g, i) => (g.x !== undefined
          ? <line key={i} className="guide" x1={g.x + dragArea.x} y1={v.y} x2={g.x + dragArea.x} y2={v.y + v.h} />
          : <line key={i} className="guide" x1={v.x} y1={g.y! + dragArea.y} x2={v.x + v.w} y2={g.y! + dragArea.y} />))
        : null}

      {tables.map((t) => {
        const { w, h } = tableSize(t);
        const { w: fw, h: fh } = footprint(t);
        const dragging = drag?.kind === 'table' && drag.key === t.key;
        const pos = posOf(t);
        const o = off(t.area);
        const look = looks[t.key];
        const tag = t.tag ?? (t.walk_in ? 'Walk-in' : null);
        const cls = [
          'table', t.shape, look?.state ?? '', props.selected === t.key ? 'selected' : '', t.walk_in ? 'walk-in' : '',
          t.bookable === false || tag ? 'unbookable' : '', over === t.key ? (props.canDrop && drag && !props.canDrop(drag.key, t.key) ? 'no-drop' : 'drop') : '',
          look?.flash ? 'flash' : '', dragging ? 'lifted' : '', dragging && drag.clash ? 'clash' : '',
        ].filter(Boolean).join(' ');
        const why = tag === 'Walk-in' ? ', kept for walk-ins, not bookable by phone' : tag ? `, ${tag.toLowerCase()} only, not bookable by phone` : '';
        const title = `${t.label}, ${t.seats} seats${t.accessible ? ', step-free' : ''}${why}${t.features?.length ? `, ${t.features.join(', ')}` : ''}`;
        return (
          <g
            key={t.key}
            className={cls}
            transform={`translate(${pos.x + o.x} ${pos.y + o.y})`}
            onPointerDown={(e) => down(e, 'table', t)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => setDrag(null)}
            onKeyDown={(e) => keyboard(e, 'table', t)}
            tabIndex={0}
            role="button"
            aria-label={`${title}${look?.caption ? `. ${look.caption}` : ''}`}
            aria-pressed={props.selected === t.key}
          >
            <title>{title}</title>
            <g transform={turn(t.rotation, w, h, fw, fh)}>
              {chairs(t, w, h).map((c, i) => (
                <circle key={i} className="chair" cx={c.x} cy={c.y} r={6} />
              ))}
              {t.shape === 'round' ? <circle className="top" cx={w / 2} cy={h / 2} r={w / 2} /> : <rect className="top" width={w} height={h} rx={10} />}
            </g>
            <text className="num" x={fw / 2} y={fh / 2 + (look?.caption ? -2 : 5)}>{t.label.replace(/^Table\s+/i, '')}</text>
            {look?.caption ? <text className="cap" x={fw / 2} y={fh / 2 + 13}>{look.caption}</text> : <text className="cap seats" x={fw / 2} y={fh / 2 + 19}>{t.seats}</text>}
            {tag ? (
              // On the table's bottom edge, where no badge sits: says at a glance why it stays free.
              <g className="walk-tag" transform={`translate(${fw / 2} ${fh})`} aria-hidden="true">
                <rect x={-tag.length * 4.6 - 9} y={-12} width={tag.length * 9.2 + 18} height={24} rx={12} />
                <text y={5}>{tag}</text>
              </g>
            ) : null}
            {(look?.badges ?? []).slice(0, 4).map((b, i) => (
              <g key={b} className={`badge-dot ${BADGE[b].cls}`} transform={`translate(${fw - 4 - i * 17} -4)`}>
                <title>{BADGE[b].title}</title>
                <circle r={8} />
                <text y={4}>{BADGE[b].text}</text>
              </g>
            ))}
            {t.accessible && mode === 'edit' ? (
              <g className="badge-dot b-access" transform={`translate(${fw - 4} -4)`}>
                <circle r={8} />
                <text y={4}>♿</text>
              </g>
            ) : null}
          </g>
        );
      })}

      {/* In live mode, a ghost follows the pointer while a booking is dragged. */}
      {drag && mode === 'live' && drag.moved ? (() => {
        const t = byKey.get(drag.key)!;
        const { w, h } = footprint(t);
        return <rect className="ghost" x={drag.x - drag.dx} y={drag.y - drag.dy} width={w} height={h} rx={10} />;
      })() : null}
      {props.children}
    </svg>
  );
}

/** Zoom out, a percentage that resets to fit, zoom in. */
export function ZoomControls({ zoom, setZoom }: { zoom: number; setZoom: (z: number) => void }) {
  const steps = [1, 1.25, 1.5, 2, 2.5];
  const i = steps.findIndex((s) => s >= zoom - 0.01);
  return (
    <span className="zoom" role="group" aria-label="Zoom">
      <button type="button" className="small" aria-label="Zoom out" disabled={i <= 0} onClick={() => setZoom(steps[Math.max(0, i - 1)])}>−</button>
      <button type="button" className="small" aria-label="Fit to the width" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
      <button type="button" className="small" aria-label="Zoom in" disabled={i >= steps.length - 1} onClick={() => setZoom(steps[Math.min(steps.length - 1, i + 1)])}>+</button>
    </span>
  );
}
