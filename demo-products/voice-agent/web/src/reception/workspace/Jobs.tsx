// A repairs contractor's jobs board (presets/property-maintenance.md §6):
// new and awaiting approval, booked, out now (on the way or on site), and
// waiting, with the fortnight's done and invoiced jobs below, each finished
// one ready to invoice. Cards are coloured by priority and carry the triage
// reason and their badges; a job made on a call flashes as it lands. Staff
// move a job on from its card. The back office is a panel about 770px wide
// on a laptop, so a card is a few short lines: where, what and when, who,
// its badges and its next step; its address opens the rest.

import { useEffect, useRef, useState } from 'react';
import type { LiveJob, LiveState } from '../types.ts';
import { PRIORITY, cardWhen, etaLeft, jobAct, jobBadges, money, splitAddress, tradeWord } from './maintenance.ts';
import './repairs-office.css';

const COLUMNS: { label: string; has: (j: LiveJob) => boolean }[] = [
  { label: 'New', has: (j) => j.status === 'new' || j.status === 'awaiting_approval' },
  { label: 'Booked', has: (j) => j.status === 'scheduled' },
  { label: 'Out now', has: (j) => j.status === 'on_the_way' || j.status === 'on_site' },
  { label: 'Waiting', has: (j) => j.status === 'waiting' },
];
const ORDER = { emergency: 0, urgent: 1, routine: 2 };
const sortKey = (j: LiveJob) => `${ORDER[j.priority]}${j.date ?? '0000'}${j.window_key ?? ''}${j.created_at}`;

/** Booked jobs on the board: today and the next two days. The rest are in Dispatch, so the board stays a glance. */
const BOARD_DAYS = 3;

export function Jobs({ id, state, nowMs, flash, onDone }: { id: string; state: LiveState; nowMs: number; flash: Set<string>; onDone: () => void }) {
  const [showDone, setShowDone] = useState(false);
  const doneToggle = useRef<HTMLButtonElement>(null);
  // The board fills the panel, so the list opens below it: scroll the panel to the list's top.
  useEffect(() => {
    if (showDone) doneToggle.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [showDone]);
  const jobs = state.jobs ?? [];
  if (!jobs.length) return <p className="empty">No jobs yet. The receptionist raises them on the phone.</p>;
  const done = jobs.filter((j) => j.status === 'done' || j.status === 'invoiced').sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''));
  const last = new Date(`${state.today}T12:00:00Z`);
  last.setUTCDate(last.getUTCDate() + BOARD_DAYS - 1);
  const until = last.toISOString().slice(0, 10);
  // A job just made on a call is always shown, whenever it is booked for.
  const soon = (j: LiveJob) => j.status !== 'scheduled' || !j.date || j.date <= until || flash.has(j.reference);
  const notice = state.maintenance?.notice;
  return (
    <div className="jobs">
      {state.kpis ? <Kpis k={state.kpis} /> : null}
      {notice ? (
        <p className="office-notice on" role="status">
          <b>Notice on every call:</b> {notice.text}{notice.emergencies_only ? <span className="badge bad">Emergencies only</span> : null}
          <span className="muted small">Change it on Dispatch.</span>
        </p>
      ) : null}
      <div className="kitchen jobs-board">
        {COLUMNS.map((c) => {
          const all = jobs.filter(c.has);
          const mine = all.filter(soon).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
          const later = all.length - mine.length;
          return (
            <section key={c.label} className="k-col" aria-label={c.label}>
              <h3>{c.label} <span className="count">{all.length}</span></h3>
              {mine.map((j) => <JobCard key={j.reference} id={id} j={j} state={state} nowMs={nowMs} fresh={flash.has(j.reference)} onDone={onDone} />)}
              {!mine.length ? <p className="empty">Nothing here.</p> : null}
              {later ? <p className="small muted">{later} more booked later: see Dispatch.</p> : null}
            </section>
          );
        })}
      </div>
      <button type="button" ref={doneToggle} className="linkish small" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
        {showDone ? 'Hide' : 'Show'} done and invoiced ({done.length}, {done.filter((j) => j.status === 'done').length} to invoice)
      </button>
      {showDone ? (
        <ul className="rp-done" aria-label="Done and invoiced">
          {done.map((j) => <DoneJob key={j.reference} id={id} j={j} invoice={(state.invoices ?? []).find((i) => i.job_ref === j.reference)?.reference} onDone={onDone} />)}
        </ul>
      ) : null}
    </div>
  );
}

/** A finished job: what was done, and its invoice, or the button that sends one. */
function DoneJob({ id, j, invoice, onDone }: { id: string; j: LiveJob; invoice?: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const bill = async () => {
    setBusy(true);
    await jobAct(id, j.reference, { action: 'invoice' }, onDone);
    setBusy(false);
  };
  const { street, postcode } = splitAddress(j.address);
  const what = j.notes ?? j.description;
  return (
    <li>
      <span className="rp-done-where" title={j.address ?? undefined}><b>{street || j.reference}</b>{postcode ? <span className="muted"> {postcode}</span> : null}</span>
      <span className="rp-done-who muted">{tradeWord(j.trade_label)} · {j.engineer ?? 'nobody'}</span>
      <span className="rp-done-what" title={what}>{what}</span>
      <span className="rp-done-end">
        {j.flags.includes('recall') ? <span className="badge warn">Recall</span> : null}
        {j.status === 'invoiced' ? <span className="badge ok">Invoiced{invoice ? ` · ${invoice}` : ''}</span> : (
          <button type="button" className="small" disabled={busy} onClick={bill} aria-label={`Invoice ${j.address ?? j.reference}`}>Invoice</button>
        )}
      </span>
    </li>
  );
}

function JobCard({ id, j, state, nowMs, fresh, onDone }: { id: string; j: LiveJob; state: LiveState; nowMs: number; fresh: boolean; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(false);
  // Closed, a card is one glance: where, what, when, who, and the next step. Open, the rest.
  const [open, setOpen] = useState(fresh);
  const tz = state.tenant.timezone;
  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    await jobAct(id, j.reference, body, onDone);
    setBusy(false);
  };
  const eta = etaLeft(j, nowMs);
  const p = PRIORITY[j.priority];
  const badges = jobBadges(j);
  const { street, postcode } = splitAddress(j.address);
  // Who has it and what it waits on: two lines at most, in full in its tooltip and once the card is open.
  const who = [
    j.engineer,
    eta !== null ? `about ${eta} min away` : null,
    j.status === 'awaiting_approval' ? `Awaiting approval${j.price_pence ? `: ${money(j.price_pence)}` : ''}` : null,
    j.waiting_for ? `Waiting for ${j.waiting_for}` : null,
  ].filter(Boolean).join(' · ');
  // The next steps. Closed, a card shows only what moves the job on, so one waiting on nothing has no row of buttons.
  const paged = j.status === 'new' && j.flags.includes('paged') && j.engineer;
  const acts = [
    paged ? <button key="accept" type="button" className="small primary" disabled={busy} onClick={() => act({ action: 'accept' })}>{j.engineer} accepts</button> : null,
    paged ? <button key="decline" type="button" className="small" disabled={busy} onClick={() => act({ action: 'decline' })}>Declines</button> : null,
    paged ? <button key="no_answer" type="button" className="small" disabled={busy} onClick={() => act({ action: 'no_answer' })} title={`What happens by itself after ${state.maintenance?.escalate_minutes ?? 15} minutes`}>No answer</button> : null,
    j.status === 'scheduled' && (j.date === state.today || !j.date) ? <button key="on_the_way" type="button" className="small primary" disabled={busy || !j.engineer} onClick={() => act({ action: 'on_the_way', eta_minutes: 20 })}>On the way</button> : null,
    j.status === 'on_the_way' ? <button key="on_site" type="button" className="small primary" disabled={busy} onClick={() => act({ action: 'on_site' })}>On site</button> : null,
    j.status === 'on_site' || j.status === 'on_the_way' ? (
      <button key="done" type="button" className="small" disabled={busy} onClick={() => { const notes = prompt('What was done?'); if (notes) void act({ action: 'done', notes }); }}>Done</button>
    ) : null,
    open && ['scheduled', 'on_site', 'new'].includes(j.status) ? (
      <button key="waiting" type="button" className="small" disabled={busy} onClick={() => { const r = prompt('Waiting for parts, access or a quote?', 'parts'); if (r) void act({ action: 'waiting', reason: r.trim().toLowerCase(), note: '' }); }}>Waiting</button>
    ) : null,
    open && ['new', 'scheduled', 'waiting'].includes(j.status) && j.priority !== 'emergency' ? (
      <button key="move" type="button" className="small" disabled={busy} onClick={() => setMoving(!moving)} aria-expanded={moving}>Move</button>
    ) : null,
    open && ['new', 'scheduled', 'waiting', 'awaiting_approval'].includes(j.status) ? (
      <button key="cancel" type="button" className="small" disabled={busy} onClick={() => { if (confirm(`Cancel ${j.reference} and text ${j.reporter.name ?? 'the caller'}?`)) void act({ action: 'cancel' }); }}>Cancel</button>
    ) : null,
  ].filter(Boolean);
  return (
    <article className={`ticket job ${j.priority} ${fresh ? 'new' : ''} ${open ? 'open' : ''}`} aria-label={`${p.label} job ${j.reference}`}>
      {/* The address opens the card: no row of its own for a More button. */}
      <header>
        <button type="button" className="jc-where" aria-expanded={open} onClick={() => setOpen(!open)} title={j.address ?? undefined}>
          <b>{street || 'A new customer'}</b>{postcode ? <span className="jc-pc">{postcode}</span> : null}
        </button>
      </header>
      <span className="jc-what">{tradeWord(j.trade_label)} · {cardWhen(j, state.today, tz)}</span>
      {who ? <span className="jc-who" title={who}>{who}</span> : null}
      {/* Routine is the card's plain colour; only urgent and emergency need saying. */}
      {j.priority !== 'routine' || badges.length ? (
        <div className="badges">
          {j.priority !== 'routine' ? <span className={`badge ${p.badge}`}>{p.label}</span> : null}
          {badges.map((b) => <span key={b.label} className={`badge ${b.level}`}>{b.label}</span>)}
        </div>
      ) : null}
      {open ? (
        <div className="jc-more">
          {j.address ? <span>{j.address}</span> : null}
          <span>{j.trade_label}: {j.description}</span>
          {j.reason ? <span className="muted">{j.reason}</span> : null}
          {j.clocks.map((c) => <span key={c.kind} className="muted">{c.label}</span>)}
          {j.client ? <span className="muted">For {j.client}</span> : null}
          <span className="muted">Ref {j.reference}{j.reporter.name ? ` · reported by ${j.reporter.name}` : ''}</span>
        </div>
      ) : null}
      {acts.length ? <div className="row-tools jc-acts">{acts}</div> : null}
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

/** The owner's Monday view: today's work, what is open, the week against its targets, and what is overdue or owed. */
function Kpis({ k }: { k: NonNullable<LiveState['kpis']> }) {
  const pct = k.targets.of ? Math.round((k.targets.met / k.targets.of) * 100) : null;
  const tiles: { label: string; value: string; note?: string; level?: 'bad' | 'warn' }[] = [
    { label: 'Jobs today', value: String(k.jobs_today) },
    { label: 'Emergencies open', value: String(k.emergencies_open), level: k.emergencies_open ? 'bad' : undefined },
    { label: 'On target, last 7 days', value: pct === null ? '–' : `${pct}%`, note: `${k.targets.met} of ${k.targets.of} jobs`, level: pct !== null && pct < 90 ? 'warn' : undefined },
    { label: 'Damp and mould clocks', value: String(k.damp_clocks), level: k.damp_clocks ? 'warn' : undefined },
    { label: 'Certificates overdue', value: String(k.certificates_overdue), level: k.certificates_overdue ? 'bad' : undefined },
    { label: 'Unpaid bills', value: money(k.unpaid.pence), note: `${k.unpaid.count} bills, ${k.unpaid.overdue} overdue`, level: k.unpaid.overdue ? 'warn' : undefined },
  ];
  return (
    <ul className="rp-kpis" aria-label="This week at a glance">
      {tiles.map((t) => (
        <li key={t.label} className={t.level ?? ''}>
          <span className="rp-kpi-label">{t.label}</span>
          <span className="rp-kpi-line">
            <b className="rp-kpi-value">{t.value}</b>
            {t.note ? <span className="rp-kpi-note">{t.note}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
