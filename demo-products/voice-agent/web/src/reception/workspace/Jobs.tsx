// A repairs contractor's jobs board (presets/property-maintenance.md §6):
// new and awaiting approval, booked, out now (on the way or on site), and
// waiting, with this week's done jobs below. Cards are coloured by priority
// and carry the triage reason and their badges; a job made on a call
// flashes as it lands. Staff move a job on from its card.

import { useState } from 'react';
import type { LiveJob, LiveState } from '../types.ts';
import { PRIORITY, etaLeft, jobAct, jobBadges, jobWhen } from './maintenance.ts';

const COLUMNS: { label: string; has: (j: LiveJob) => boolean }[] = [
  { label: 'New', has: (j) => j.status === 'new' || j.status === 'awaiting_approval' },
  { label: 'Booked', has: (j) => j.status === 'scheduled' },
  { label: 'Out now', has: (j) => j.status === 'on_the_way' || j.status === 'on_site' },
  { label: 'Waiting', has: (j) => j.status === 'waiting' },
];
const ORDER = { emergency: 0, urgent: 1, routine: 2 };
const sortKey = (j: LiveJob) => `${ORDER[j.priority]}${j.date ?? '0000'}${j.window_key ?? ''}${j.created_at}`;

export function Jobs({ id, state, nowMs, flash, onDone }: { id: string; state: LiveState; nowMs: number; flash: Set<string>; onDone: () => void }) {
  const [showDone, setShowDone] = useState(false);
  const jobs = state.jobs ?? [];
  if (!jobs.length) return <p className="empty">No jobs yet. The receptionist raises them on the phone.</p>;
  const done = jobs.filter((j) => j.status === 'done' || j.status === 'invoiced').sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''));
  return (
    <div className="jobs">
      <div className="kitchen jobs-board">
        {COLUMNS.map((c) => {
          const mine = jobs.filter(c.has).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
          return (
            <section key={c.label} className="k-col" aria-label={c.label}>
              <h3>{c.label} <span className="count">{mine.length}</span></h3>
              {mine.map((j) => <JobCard key={j.reference} id={id} j={j} state={state} nowMs={nowMs} fresh={flash.has(j.reference)} onDone={onDone} />)}
              {!mine.length ? <p className="empty">Nothing here.</p> : null}
            </section>
          );
        })}
      </div>
      <button type="button" className="linkish small" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
        {showDone ? 'Hide' : 'Show'} done this week ({done.length})
      </button>
      {showDone ? (
        <ul className="done-jobs">
          {done.map((j) => (
            <li key={j.reference}>
              <b>{j.address ?? j.reference}</b> · {j.trade_label} · {j.engineer ?? 'nobody'} · <span className="muted">{j.notes ?? j.description}</span>
              {j.flags.includes('recall') ? <span className="badge warn">Recall</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function JobCard({ id, j, state, nowMs, fresh, onDone }: { id: string; j: LiveJob; state: LiveState; nowMs: number; fresh: boolean; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(false);
  const tz = state.tenant.timezone;
  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    await jobAct(id, j.reference, body, onDone);
    setBusy(false);
  };
  const eta = etaLeft(j, nowMs);
  const p = PRIORITY[j.priority];
  return (
    <article className={`ticket job ${j.priority} ${fresh ? 'new' : ''}`} aria-label={`${p.label} job ${j.reference}`}>
      <header>
        <b>{j.address ?? 'A new customer'}</b>
        <span className={`badge ${p.badge}`}>{p.label}</span>
      </header>
      <span>{j.trade_label}: {j.description}</span>
      {j.reason ? <span className="small muted">{j.reason}</span> : null}
      <span className="small">
        {jobWhen(j, tz)}{j.engineer ? ` · ${j.engineer}` : ''}{eta !== null ? ` · about ${eta} min away` : ''} · ref {j.reference}
      </span>
      {j.client ? <span className="small muted">For {j.client}</span> : null}
      {j.status === 'awaiting_approval' ? <span className="small">Awaiting approval{j.price_pence ? `: £${(j.price_pence / 100).toLocaleString('en-GB')}` : ''}</span> : null}
      {j.waiting_for ? <span className="small">Waiting for {j.waiting_for}</span> : null}
      <div className="badges">{jobBadges(j).map((b) => <span key={b.label} className={`badge ${b.level}`}>{b.label}</span>)}</div>
      <div className="row-tools">
        {j.status === 'new' && j.flags.includes('paged') && j.engineer ? (
          <>
            <button type="button" className="small primary" disabled={busy} onClick={() => act({ action: 'accept' })}>{j.engineer} accepts</button>
            <button type="button" className="small" disabled={busy} onClick={() => act({ action: 'decline' })}>Declines</button>
          </>
        ) : null}
        {j.status === 'scheduled' ? <button type="button" className="small primary" disabled={busy || !j.engineer} onClick={() => act({ action: 'on_the_way', eta_minutes: 20 })}>On the way</button> : null}
        {j.status === 'on_the_way' ? <button type="button" className="small primary" disabled={busy} onClick={() => act({ action: 'on_site' })}>On site</button> : null}
        {j.status === 'on_site' || j.status === 'on_the_way' ? (
          <button type="button" className="small" disabled={busy} onClick={() => { const notes = prompt('What was done?'); if (notes) void act({ action: 'done', notes }); }}>Done</button>
        ) : null}
        {['scheduled', 'on_site', 'new'].includes(j.status) ? (
          <button type="button" className="small" disabled={busy} onClick={() => { const r = prompt('Waiting for parts, access or a quote?', 'parts'); if (r) void act({ action: 'waiting', reason: r.trim().toLowerCase(), note: '' }); }}>Waiting</button>
        ) : null}
        {['new', 'scheduled', 'waiting'].includes(j.status) && j.priority !== 'emergency' ? (
          <button type="button" className="small" disabled={busy} onClick={() => setMoving(!moving)} aria-expanded={moving}>Move</button>
        ) : null}
        {['new', 'scheduled', 'waiting', 'awaiting_approval'].includes(j.status) ? (
          <button type="button" className="small" disabled={busy} onClick={() => { if (confirm(`Cancel ${j.reference} and text ${j.reporter.name ?? 'the caller'}?`)) void act({ action: 'cancel' }); }}>Cancel</button>
        ) : null}
      </div>
      {moving ? <MoveForm j={j} state={state} busy={busy} onMove={(b) => act({ action: 'assign', ...b }).then(() => setMoving(false))} /> : null}
    </article>
  );
}

/** An engineer, a day and a window: the server says if it can't be done, and why. */
export function MoveForm({ j, state, busy, onMove }: { j: LiveJob; state: LiveState; busy: boolean; onMove: (b: { engineer: string; date: string; window: string }) => void }) {
  const engineers = (state.engineers ?? []).filter((e) => e.trades.includes(j.trade) && (!j.flags.includes('gas') || e.gas_safe));
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(`${state.today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const [engineer, setEngineer] = useState(j.engineer_key ?? engineers[0]?.key ?? '');
  const [date, setDate] = useState(j.date && j.date >= state.today ? j.date : days[1]);
  const windows = (state.maintenance?.windows ?? []).filter((w) => w.days.includes(new Date(`${date}T12:00:00Z`).getUTCDay()));
  const [win, setWin] = useState(j.window_key ?? '');
  // A day without the chosen window offers its first one instead.
  const chosen = windows.find((w) => w.key === win)?.key ?? windows[0]?.key ?? '';
  return (
    <form className="move-job" onSubmit={(e) => { e.preventDefault(); onMove({ engineer, date, window: chosen }); }}>
      <label className="field"><span className="small">Engineer</span>
        <select value={engineer} onChange={(e) => setEngineer(e.target.value)}>{engineers.map((e) => <option key={e.key} value={e.key}>{e.first_name}{e.gas_safe ? ' (Gas Safe)' : ''}</option>)}</select>
      </label>
      <label className="field"><span className="small">Day</span>
        <select value={date} onChange={(e) => setDate(e.target.value)}>
          {days.map((d) => <option key={d} value={d}>{new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}</option>)}
        </select>
      </label>
      <label className="field"><span className="small">Window</span>
        <select value={chosen} onChange={(e) => setWin(e.target.value)}>{windows.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}</select>
      </label>
      <button type="submit" className="small primary" disabled={busy || !engineer || !windows.length}>Move</button>
    </form>
  );
}
