// The floor plan board, the back office's centrepiece: tonight's service at
// a glance, every table coloured by what it is doing at the chosen minute.

import { FloorPlan } from '../FloorPlan.tsx';
import type { LiveState } from '../types.ts';
import { addDays, bookingOn, dayLabel, hhmm, looksAt, servicesOn, span } from './model.ts';

export interface View {
  date: string;
  minute: number;
}

export function DayPicker({ state, today, view, setView }: { state: LiveState; today: string; view: View; setView: (v: View) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  return (
    <div className="days" role="group" aria-label="Day">
      {days.map((d) => {
        const n = state.bookings.filter((b) => b.date === d && b.status === 'confirmed').length;
        const first = servicesOn(state, d)[0];
        return (
          <button type="button" key={d} aria-pressed={d === view.date} onClick={() => setView({ date: d, minute: d === view.date ? view.minute : first ? first.open + 60 : view.minute })}>
            {dayLabel(d, today)}
            {n ? <span className="count">{n}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function FloorBoard(props: {
  state: LiveState;
  today: string;
  nowMinute: number;
  view: View;
  setView: (v: View) => void;
  selected: string | null;
  onSelectTable: (key: string | null) => void;
  onDrop: (from: string, to: string) => void;
  flash: Set<string>;
}) {
  const { state, view, setView, today } = props;
  const plan = state.plan;
  if (!plan) return <p className="empty">This business takes no table bookings.</p>;
  const services = servicesOn(state, view.date);
  const isToday = view.date === today;
  const looks = looksAt(state, view.date, view.minute, isToday ? props.nowMinute : null, props.flash);
  const lo = services.length ? Math.min(...services.map((s) => s.open)) : 11 * 60;
  const hi = services.length ? Math.max(...services.map((s) => s.close)) : 23 * 60;
  const current = services.find((s) => view.minute >= s.open && view.minute <= s.close + 60) ?? null;

  // The service's numbers.
  const inService = state.bookings.filter((b) => b.date === view.date && b.status === 'confirmed' && (!current || (span(b)[0] >= current.open - 30 && span(b)[0] <= current.close)));
  const covers = inService.reduce((n, b) => n + b.party_size, 0);
  const arriving = inService.filter((b) => b.visit_status === 'expected' && span(b)[0] >= view.minute && span(b)[0] - view.minute <= 30).length;
  const free = Object.entries(looks).filter(([k, l]) => (l.state === 'free' || l.state === 'later') && plan.tables.find((t) => t.key === k)?.bookable).length;
  const due = state.orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled').length;

  const canDrop = (from: string, to: string) => {
    const b = bookingOn(state, from, view.date, view.minute);
    const t = plan.tables.find((x) => x.key === to);
    if (!b || !t) return false;
    return t.seats >= b.party_size && !state.bookings.some((x) => x.id !== b.id && x.date === b.date && x.status === 'confirmed' && x.tables.includes(to) && span(x)[0] < span(b)[1] && span(b)[0] < span(x)[1]);
  };

  return (
    <div className="floor-board">
      <DayPicker state={state} today={today} view={view} setView={setView} />
      <div className="service-bar">
        {services.map((s) => (
          <button type="button" key={s.label} aria-pressed={current?.label === s.label} className="small" onClick={() => setView({ ...view, minute: Math.min(s.close, s.open + 60) })}>
            {s.label}
          </button>
        ))}
        {!services.length ? <span className="muted small">Closed this day.</span> : null}
        <label className="slider">
          <span className="mono">{hhmm(view.minute)}</span>
          <input
            type="range" aria-label="Time" min={lo} max={hi} step={15}
            value={Math.min(hi, Math.max(lo, view.minute))} onChange={(e) => setView({ ...view, minute: Number(e.target.value) })}
          />
        </label>
        {isToday ? <button type="button" className="small" onClick={() => setView({ date: today, minute: props.nowMinute })}>Now</button> : null}
      </div>
      <div className="numbers">
        <span><b>{covers}</b> covers{current ? ` at ${current.label.toLowerCase()}` : ''}</span>
        <span><b>{free}</b> tables free at {hhmm(view.minute)}</span>
        <span><b>{arriving}</b> arriving in the next half hour</span>
        {state.tenant.has_ordering ? <span><b>{due}</b> takeaway orders open</span> : null}
      </div>
      <div className="floor-wrap live">
        <FloorPlan
          mode="live"
          label={`Floor plan at ${hhmm(view.minute)}, ${dayLabel(view.date, today)}`}
          tables={plan.tables}
          areas={plan.areas}
          looks={looks}
          selected={props.selected}
          onSelect={props.onSelectTable}
          onDropOn={props.onDrop}
          canDrop={canDrop}
        />
      </div>
      <div className="legend" aria-hidden="true">
        <span><i className="l-free" /> Free</span>
        <span><i className="l-arriving" /> Arriving within 30 min</span>
        <span><i className="l-booked" /> Booked now</span>
        <span><i className="l-seated" /> Seated</span>
        <span><i className="l-late" /> Late</span>
        {plan.tables.some((t) => !t.bookable) ? <span><i className="l-walkin" /> Walk-ins only</span> : null}
        <span className="muted">Drag a booked table onto a free one to move the booking.</span>
      </div>
    </div>
  );
}
