// The classic reservations grid: a row per table, a bar per booking across
// the day. The quickest way to see a gap or a clash. Drag a bar to another
// row to move the booking there.

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { LiveBooking, LiveState } from '../types.ts';
import { hhmm, servicesOn, span } from './model.ts';
import { DayPicker, type View } from './FloorBoard.tsx';

export function Timeline(props: {
  state: LiveState;
  today: string;
  nowMinute: number;
  view: View;
  setView: (v: View) => void;
  onOpen: (b: LiveBooking) => void;
  onMove: (b: LiveBooking, table: string) => void;
}) {
  const { state, view } = props;
  const plan = state.plan;
  const grid = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ ref: string; row: string | null; moved: boolean } | null>(null);
  if (!plan) return <p className="empty">This business takes no table bookings.</p>;

  const services = servicesOn(state, view.date);
  const lo = (services.length ? Math.min(...services.map((s) => s.open)) : 12 * 60) - 30;
  const hi = (services.length ? Math.max(...services.map((s) => s.close)) : 22 * 60) + 90;
  const pct = (m: number) => `${((Math.min(hi, Math.max(lo, m)) - lo) / (hi - lo)) * 100}%`;
  const hours: number[] = [];
  for (let h = Math.ceil(lo / 60) * 60; h <= hi; h += 60) hours.push(h);
  const day = state.bookings.filter((b) => b.date === view.date && b.status === 'confirmed');
  const areas = new Map(plan.areas.map((a) => [a.key, a.label]));
  const rows = [...plan.tables].sort((a, b) => (a.area ?? '').localeCompare(b.area ?? '') || Number(a.key.slice(1)) - Number(b.key.slice(1)));

  const rowAt = (e: { clientX: number; clientY: number }) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-row]');
    return el?.dataset.row ?? null;
  };
  const down = (e: ReactPointerEvent<HTMLButtonElement>, b: LiveBooking) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ ref: b.reference, row: null, moved: false });
  };
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    setDrag({ ...drag, row: rowAt(e), moved: true });
  };
  const up = (e: ReactPointerEvent<HTMLButtonElement>, b: LiveBooking) => {
    const d = drag;
    setDrag(null);
    if (!d) return;
    const row = rowAt(e);
    if (d.moved && row && !b.tables.includes(row)) props.onMove(b, row);
    else props.onOpen(b);
  };

  return (
    <div className="timeline">
      <DayPicker state={state} today={props.today} view={view} setView={props.setView} />
      <div className="tl-grid" ref={grid} style={{ '--rows': rows.length } as React.CSSProperties}>
        <div className="tl-head">
          <span />
          <div className="tl-scale">
            {hours.map((h) => <span key={h} style={{ left: pct(h) }}>{hhmm(h)}</span>)}
          </div>
        </div>
        {rows.map((t, i) => {
          const newArea = i === 0 || rows[i - 1].area !== t.area;
          return (
            <div key={t.key} className={`tl-row ${drag?.row === t.key ? 'drop' : ''} ${newArea ? 'area-start' : ''}`} data-row={t.key}>
              <span className="tl-label">
                {newArea ? <span className="tl-area">{areas.get(t.area ?? '') ?? ''}</span> : null}
                {t.label.replace(/^Table /, 'T')} <span className="muted">({t.seats})</span>
              </span>
              <div className="tl-track">
                {services.map((s) => <span key={s.label} className="tl-open" style={{ left: pct(s.open), width: `calc(${pct(s.close)} - ${pct(s.open)})` }} />)}
                {day.filter((b) => b.tables.includes(t.key)).map((b) => {
                  const [s, e] = span(b);
                  return (
                    <button
                      type="button" key={b.reference}
                      className={`tl-bar ${b.visit_status} ${b.allergies ? 'allergy' : ''} ${b.tables.length > 1 ? 'paired' : ''} ${drag?.ref === b.reference ? 'lifted' : ''}`}
                      style={{ left: pct(s), width: `calc(${pct(e)} - ${pct(s)} - 2px)` }}
                      onPointerDown={(ev) => down(ev, b)} onPointerMove={move} onPointerUp={(ev) => up(ev, b)} onPointerCancel={() => setDrag(null)}
                      title={`${b.time}–${b.end_time} · ${b.name}, ${b.party_size}${b.allergies ? ` · allergy: ${b.allergies}` : ''}${b.notes ? ` · ${b.notes}` : ''}`}
                    >
                      <b>{b.party_size}</b> {b.name}
                    </button>
                  );
                })}
                {view.date === props.today ? <span className="tl-now" style={{ left: pct(props.nowMinute) }} /> : null}
              </div>
            </div>
          );
        })}
      </div>
      <p className="hint">Click a bar to open the booking. Drag it to another table’s row to move it.</p>
    </div>
  );
}
