// An estate agency's diary: a row for each member of the team, a bar for
// each viewing, valuation and mortgage appointment across the day, so a gap
// or a busy afternoon shows at once. Click a bar to open it; drag it to
// someone else's row to move it to them. A barber's Diary is the same, a row a barber.

import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { LiveBooking, LiveState } from '../types.ts';
import { DayPicker, type View } from './FloorBoard.tsx';
import { hhmm, personOptions, span, weekday } from './model.ts';

const ROLE: Record<string, string> = { manager: 'Manager', negotiator: 'Negotiator', valuer: 'Valuer', progressor: 'Progressor', adviser: 'Mortgages', other: '' };

/** What a bar says it is: a viewing of 22 Albion Road, a valuation. */
function kindOf(b: LiveBooking): { label: string; cls: string } {
  const k = (b.details?.kind as string | undefined) ?? '';
  if (b.listing_key) return { label: k === 'second_viewing' ? 'Second viewing' : 'Viewing', cls: 'viewing' };
  if (/valuation|appraisal/i.test(b.service) || k === 'valuation') return { label: 'Valuation', cls: 'valuation' };
  return { label: b.service.charAt(0).toUpperCase() + b.service.slice(1), cls: 'other' };
}

export function StaffDiary({ state, today, nowMinute, view, setView, onOpen, onMove }: {
  state: LiveState;
  today: string;
  nowMinute: number;
  view: View;
  setView: (v: View) => void;
  onOpen: (b: LiveBooking) => void;
  onMove: (b: LiveBooking, to: string) => void;
}) {
  // A bar being dragged, the row under the pointer, and the rows it may go to (lit while dragging).
  const [drag, setDrag] = useState<{ ref: string; row: string | null; moved: boolean; ok: string[] } | null>(null);
  const rowAt = (e: { clientX: number; clientY: number }) =>
    document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-row]')?.dataset.row ?? null;
  const down = (e: ReactPointerEvent<HTMLButtonElement>, b: LiveBooking) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ ref: b.reference, row: null, moved: false, ok: personOptions(state, b).map((m) => m.key) });
  };
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (drag) setDrag({ ...drag, row: rowAt(e), moved: true });
  };
  const up = (e: ReactPointerEvent<HTMLButtonElement>, b: LiveBooking) => {
    const d = drag;
    setDrag(null);
    if (!d) return;
    const row = rowAt(e);
    // A row it can't go to is still tried: the server says why not (busy, not in, a personal interest).
    if (d.moved && row && row !== b.resource_key) onMove(b, row);
    else onOpen(b);
  };
  const day = state.bookings.filter((b) => b.date === view.date && b.status === 'confirmed');
  // A barber has no duties, only services.
  const team = (state.team ?? []).filter((s) => s.does.length || s.services?.length || day.some((b) => b.resource_key === s.key));
  // The office's day, stretched to every booking on it: viewings often run into the evening.
  const lo = Math.min(9 * 60, ...day.map((b) => span(b)[0])) - 30;
  const hi = Math.max(18 * 60, ...day.map((b) => span(b)[1])) + 30;
  const pct = (m: number) => `${((Math.min(hi, Math.max(lo, m)) - lo) / (hi - lo)) * 100}%`;
  const hours: number[] = [];
  for (let h = Math.ceil(lo / 60) * 60; h <= hi; h += 60) hours.push(h);
  const wd = weekday(view.date);

  if (!team.length) return <p className="empty">No one in the team takes bookings. Add people in the setup’s “Your team”.</p>;
  return (
    <div className="timeline diary">
      <DayPicker state={state} today={today} view={view} setView={setView} />
      <div className="tl-grid" style={{ '--rows': team.length } as React.CSSProperties}>
        <div className="tl-head">
          <span />
          <div className="tl-scale">
            {hours.map((h) => <span key={h} style={{ left: pct(h) }}>{hhmm(h)}</span>)}
          </div>
        </div>
        {team.map((s) => {
          const off = !s.days.includes(wd);
          return (
            <div key={s.key} className={`tl-row ${off ? 'walk-in' : ''} ${drag?.moved && drag.ok.includes(s.key) ? 'can-drop' : ''} ${drag?.row === s.key ? 'drop' : ''}`} data-row={s.key}>
              <span className="tl-label">
                {s.first_name} <span className="muted">{ROLE[s.role] ?? ''}</span>
              </span>
              <div className="tl-track">
                {off ? <span className="tl-walkin">Day off</span> : <span className="tl-open" style={{ left: pct(lo + 30), width: `calc(${pct(hi - 30)} - ${pct(lo + 30)})` }} />}
                {day.filter((b) => b.resource_key === s.key).map((b) => {
                  const [st, en] = span(b);
                  const k = kindOf(b);
                  const badges = (b.details?.badges as string[] | undefined) ?? [];
                  return (
                    <button
                      type="button" key={b.reference} className={`tl-bar ${b.visit_status} ${k.cls} ${drag?.ref === b.reference ? 'lifted' : ''}`}
                      style={{ left: pct(st), width: `calc(${pct(en)} - ${pct(st)} - 2px)` }}
                      onPointerDown={(e) => down(e, b)} onPointerMove={move} onPointerUp={(e) => up(e, b)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(b); } }}
                      title={`${b.time}–${b.end_time} · ${k.label}${b.home ? ` of ${b.home}` : ''} · ${b.name}${badges.length ? ` · ${badges.join(', ')}` : ''}`}
                    >
                      <b>{b.time}</b> {b.home ?? k.label} · {b.name}
                    </button>
                  );
                })}
                {view.date === today ? <span className="tl-now" style={{ left: pct(nowMinute) }} /> : null}
              </div>
            </div>
          );
        })}
      </div>
      <p className="hint">{state.listings
        ? "Viewings, valuations and mortgage appointments, by person. Click one to open it, record feedback or mark it done; drag it to someone else's row to give it to them."
        : "A row a barber. Click a booking to open it or mark them in the chair; drag it to another barber's row to give it to them."}</p>
    </div>
  );
}
