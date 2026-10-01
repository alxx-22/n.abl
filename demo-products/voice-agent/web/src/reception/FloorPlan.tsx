// The floor plan, drawn as SVG from the builder's layout. One component for
// both places it appears: the builder, where tables are dragged into place,
// and the back office, where each table shows its state and a booking is
// dragged from one table to another.

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { CANVAS_WIDTH, areaBounds, tableSize } from '../../../src/presets/restaurant/layout.ts';

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

const SNAP = 10;

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

export function planHeight(tables: PlanTableLike[]): number {
  return Math.max(320, ...tables.map((t) => t.y + tableSize(t).h + 60));
}

export function FloorPlan(props: {
  tables: PlanTableLike[];
  areas: PlanArea[];
  mode: 'edit' | 'live';
  selected?: string | null;
  onSelect?: (key: string | null) => void;
  /** Edit mode: a table was dropped at a new position. */
  onMove?: (key: string, x: number, y: number) => void;
  /** Edit mode: a drop was refused (it would overlap another table). */
  onRefuse?: (why: string) => void;
  /** Live mode: the booking on one table was dropped on another. */
  onDropOn?: (from: string, to: string) => void;
  looks?: Record<string, TableLook>;
  /** Tables to highlight as possible drop targets while dragging. */
  canDrop?: (from: string, to: string) => boolean;
  label?: string;
  children?: ReactNode;
}) {
  const { tables, areas, mode, looks = {} } = props;
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ key: string; dx: number; dy: number; x: number; y: number; moved: boolean } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const height = planHeight(tables);

  const toPlan = (e: { clientX: number; clientY: number }) => {
    const s = svg.current!;
    const pt = s.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(s.getScreenCTM()!.inverse());
  };

  const hitTable = (x: number, y: number, except: string): string | null => {
    for (const t of tables) {
      if (t.key === except) continue;
      const { w, h } = tableSize(t);
      if (x >= t.x - 6 && x <= t.x + w + 6 && y >= t.y - 6 && y <= t.y + h + 6) return t.key;
    }
    return null;
  };

  const down = (e: ReactPointerEvent<SVGGElement>, t: PlanTableLike) => {
    if (e.button !== 0) return;
    const draggable = mode === 'edit' || looks[t.key]?.draggable;
    props.onSelect?.(t.key);
    if (!draggable) return;
    const p = toPlan(e);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDrag({ key: t.key, dx: p.x - t.x, dy: p.y - t.y, x: t.x, y: t.y, moved: false });
  };

  const move = (e: ReactPointerEvent<SVGGElement>) => {
    if (!drag) return;
    const p = toPlan(e);
    const x = Math.max(0, Math.min(CANVAS_WIDTH - 40, p.x - drag.dx));
    const y = Math.max(0, p.y - drag.dy);
    const moved = drag.moved || Math.abs(x - drag.x) + Math.abs(y - drag.y) > 4;
    setDrag({ ...drag, x, y, moved });
    if (mode === 'live') setOver(hitTable(p.x, p.y, drag.key));
  };

  /** Would this table, at (x, y), sit on top of another? */
  const clashes = (key: string, x: number, y: number) => {
    const t = tables.find((u) => u.key === key)!;
    const { w, h } = tableSize(t);
    return tables.some((u) => {
      if (u.key === key) return false;
      const s = tableSize(u);
      return x < u.x + s.w + 4 && u.x < x + w + 4 && y < u.y + s.h + 4 && u.y < y + h + 4;
    });
  };
  const place = (key: string, x: number, y: number) => {
    if (clashes(key, x, y)) props.onRefuse?.('Tables cannot overlap: drop it in a clear space.');
    else props.onMove?.(key, x, y);
  };

  const up = (e: ReactPointerEvent<SVGGElement>) => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    setOver(null);
    if (!d.moved) return;
    if (mode === 'edit') place(d.key, Math.round(d.x / SNAP) * SNAP, Math.round(d.y / SNAP) * SNAP);
    else {
      const p = toPlan(e);
      const target = hitTable(p.x, p.y, d.key);
      if (target) props.onDropOn?.(d.key, target);
    }
  };

  const keyboard = (e: React.KeyboardEvent<SVGGElement>, t: PlanTableLike) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      props.onSelect?.(t.key);
      return;
    }
    if (mode !== 'edit' || !props.onMove) return;
    const step = e.shiftKey ? 50 : SNAP;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    place(t.key, Math.max(10, t.x + d[0]), Math.max(10, t.y + d[1]));
  };

  const byKey = new Map(tables.map((t) => [t.key, t]));
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
  const centre = (t: PlanTableLike) => {
    const pos = drag?.key === t.key && mode === 'edit' ? { x: drag.x, y: drag.y } : t;
    const { w, h } = tableSize(t);
    return { x: pos.x + w / 2, y: pos.y + h / 2 };
  };

  return (
    <svg
      ref={svg}
      className={`floor ${mode} ${drag ? 'dragging' : ''}`}
      viewBox={`0 0 ${CANVAS_WIDTH} ${height}`}
      role="group"
      aria-label={props.label ?? 'Floor plan'}
      onPointerDown={(e) => {
        if (e.target === svg.current) props.onSelect?.(null);
      }}
    >
      {areas.map((a) => {
        const b = areaBounds(a.key, tables as never);
        if (!b) return null;
        return (
          <g key={a.key} className={`zone ${a.kind ?? ''}`}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={18} />
            <text x={b.x + 14} y={b.y + 20}>{a.label}</text>
          </g>
        );
      })}

      {joins.map(([p, q, live]) => {
        const a = centre(p);
        const b = centre(q);
        return <line key={`${p.key}-${q.key}-${live}`} className={`join ${live ? 'live' : ''}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}

      {tables.map((t) => {
        const { w, h } = tableSize(t);
        const dragging = drag?.key === t.key;
        const pos = dragging && mode === 'edit' ? { x: drag.x, y: drag.y } : t;
        const look = looks[t.key];
        const tag = t.tag ?? (t.walk_in ? 'Walk-in' : null);
        const cls = [
          'table', t.shape, look?.state ?? '', props.selected === t.key ? 'selected' : '', t.walk_in ? 'walk-in' : '',
          t.bookable === false || tag ? 'unbookable' : '', over === t.key ? (props.canDrop && drag && !props.canDrop(drag.key, t.key) ? 'no-drop' : 'drop') : '',
          look?.flash ? 'flash' : '', dragging ? 'lifted' : '',
        ].filter(Boolean).join(' ');
        const why = tag === 'Walk-in' ? ', kept for walk-ins, not bookable by phone' : tag ? `, ${tag.toLowerCase()} only, not bookable by phone` : '';
        const title = `${t.label}, ${t.seats} seats${t.accessible ? ', step-free' : ''}${why}${t.features?.length ? `, ${t.features.join(', ')}` : ''}`;
        return (
          <g
            key={t.key}
            className={cls}
            transform={`translate(${pos.x} ${pos.y})`}
            onPointerDown={(e) => down(e, t)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => setDrag(null)}
            onKeyDown={(e) => keyboard(e, t)}
            tabIndex={0}
            role="button"
            aria-label={`${title}${look?.caption ? `. ${look.caption}` : ''}`}
            aria-pressed={props.selected === t.key}
          >
            <title>{title}</title>
            <g transform={t.rotation ? `rotate(${t.rotation} ${w / 2} ${h / 2})` : undefined}>
              {chairs(t, w, h).map((c, i) => (
                <circle key={i} className="chair" cx={c.x} cy={c.y} r={6} />
              ))}
              {t.shape === 'round' ? <circle className="top" cx={w / 2} cy={h / 2} r={w / 2} /> : <rect className="top" width={w} height={h} rx={10} />}
            </g>
            <text className="num" x={w / 2} y={h / 2 + (look?.caption ? -2 : 5)}>{t.label.replace(/^Table\s+/i, '')}</text>
            {look?.caption ? <text className="cap" x={w / 2} y={h / 2 + 13}>{look.caption}</text> : <text className="cap seats" x={w / 2} y={h / 2 + 19}>{t.seats}</text>}
            {tag ? (
              // On the table's bottom edge, where no badge sits: says at a glance why it stays free.
              <g className="walk-tag" transform={`translate(${w / 2} ${h})`} aria-hidden="true">
                <rect x={-tag.length * 4.6 - 9} y={-12} width={tag.length * 9.2 + 18} height={24} rx={12} />
                <text y={5}>{tag}</text>
              </g>
            ) : null}
            {(look?.badges ?? []).slice(0, 4).map((b, i) => (
              <g key={b} className={`badge-dot ${BADGE[b].cls}`} transform={`translate(${w - 4 - i * 17} -4)`}>
                <title>{BADGE[b].title}</title>
                <circle r={8} />
                <text y={4}>{BADGE[b].text}</text>
              </g>
            ))}
            {t.accessible && mode === 'edit' ? (
              <g className="badge-dot b-access" transform={`translate(${w - 4} -4)`}>
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
        const { w, h } = tableSize(t);
        return <rect className="ghost" x={drag.x} y={drag.y} width={w} height={h} rx={10} />;
      })() : null}
      {props.children}
    </svg>
  );
}
