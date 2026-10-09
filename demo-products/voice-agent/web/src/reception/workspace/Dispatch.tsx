// The dispatch diary (presets/property-maintenance.md §6): a row for each
// engineer and a column for each visit window on the chosen day. Drag a job
// onto an engineer's window to book or move it; the server refuses gas work
// for someone who isn't Gas Safe, a full window, or a district they don't
// cover, and says why. Tonight's on-call pair sits on top; jobs not yet in
// a window wait in the tray.

import { useState, type DragEvent, type FormEvent } from 'react';
import type { LiveEngineer, LiveJob, LiveMtWindow, LiveState } from '../types.ts';
import { PRIORITY, hhmm, jobAct, officeAct } from './maintenance.ts';

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);
const label = (iso: string, today: string) =>
  iso === today ? 'Today' : day(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const LIVE = ['new', 'scheduled', 'on_the_way', 'on_site', 'waiting'];

export function Dispatch({ id, state, flash, onDone }: { id: string; state: LiveState; flash: Set<string>; onDone: () => void }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = day(state.today);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const [date, setDate] = useState(state.today);
  const [over, setOver] = useState<string | null>(null);
  const m = state.maintenance;
  const engineers = state.engineers ?? [];
  const jobs = (state.jobs ?? []).filter((j) => LIVE.includes(j.status));
  const windows = (m?.windows ?? []).filter((w) => w.days.includes(day(date).getUTCDay())).sort((a, b) => a.from.localeCompare(b.from));
  const tray = jobs.filter((j) => !j.window_key && j.priority !== 'emergency');
  const emergencies = jobs.filter((j) => j.priority === 'emergency' && !j.window_key);
  const drop = (e: DragEvent, engineer: LiveEngineer, w: LiveMtWindow) => {
    e.preventDefault();
    setOver(null);
    const ref = e.dataTransfer.getData('text/plain');
    if (ref) void jobAct(id, ref, { action: 'assign', engineer: engineer.key, date, window: w.key }, onDone);
  };
  return (
    <div className="dispatch">
      <OfficeNotice id={id} state={state} onDone={onDone} />
      <p className="on-call small">
        <b>On call tonight:</b> {m?.on_call_tonight.length ? m.on_call_tonight.join(' and ') : 'nobody'} · duty manager {m?.duty_manager}
      </p>
      <div className="day-tabs" role="tablist" aria-label="Day">
        {days.map((d) => <button key={d} type="button" role="tab" aria-selected={d === date} onClick={() => setDate(d)}>{label(d, state.today)}</button>)}
      </div>
      {emergencies.length ? (
        <div className="emergencies">
          {emergencies.map((j) => (
            <span key={j.reference} className={`chip emergency ${flash.has(j.reference) ? 'new' : ''}`}>
              {j.address} · {j.trade_label} · {j.engineer ? `${j.flags.includes('paged') ? 'paged' : 'with'} ${j.engineer}` : 'nobody yet'}{j.attend_by ? ` · by ${hhmm(j.attend_by, state.tenant.timezone)}` : ''}
            </span>
          ))}
        </div>
      ) : null}
      {windows.length ? (
        // On a phone the grid keeps its columns and scrolls sideways inside this box, not the page.
        <div className="table-scroll">
        <table className="dispatch-grid">
          <thead>
            <tr><th scope="col" className="dp-eng">Engineer</th>{windows.map((w) => <th key={w.key} scope="col">{w.label}<span className="muted small"> {w.from}–{w.to}</span></th>)}</tr>
          </thead>
          <tbody>
            {engineers.map((e) => {
              // Off: not their working day, or off sick or on holiday (from the office board) through that day.
              const away = e.off && date <= e.off.to ? e.off : null;
              const off = !e.days.includes(day(date).getUTCDay()) || Boolean(away);
              return (
                <tr key={e.key} className={off ? 'off' : ''}>
                  <th scope="row">
                    {/* Name and the absence buttons on one line, the trades on the next: eight engineers fit the panel. */}
                    <div className="dp-who">
                      <b>{e.first_name}</b>
                      <span className="row-tools dp-off">
                        {e.off ? (
                          <>
                            <span className="badge warn">{e.off.reason === 'sick' ? 'Off sick' : 'On holiday'}</span>
                            <button type="button" className="linkish" aria-label={`${e.first_name} is back`} onClick={() => void officeAct(id, { action: 'back', engineer: e.key }, onDone)}>Back</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="linkish" onClick={() => void officeAct(id, { action: 'absent', engineer: e.key, reason: 'sick', days: 1 }, onDone)}>Off sick today</button>
                            <button type="button" className="linkish" onClick={() => void officeAct(id, { action: 'absent', engineer: e.key, reason: 'holiday', days: 7 }, onDone)}>Holiday, a week</button>
                          </>
                        )}
                      </span>
                      <span className="dp-trades muted">{e.gas_safe ? 'Gas Safe · ' : ''}{e.trades.map((t) => m?.trades.find((x) => x.key === t)?.label.split(/[,;]| and /)[0] ?? `${t[0].toUpperCase()}${t.slice(1).replace(/_/g, ' ')} (off)`).join(', ')}</span>
                    </div>
                  </th>
                  {windows.map((w) => {
                    const cell = `${e.key}|${w.key}`;
                    const here = jobs.filter((j) => j.engineer_key === e.key && j.date === date && j.window_key === w.key);
                    return (
                      <td
                        key={w.key}
                        className={`${over === cell ? 'over' : ''} ${here.length >= e.per_window ? 'full' : ''}`}
                        onDragOver={(ev) => { if (!off) { ev.preventDefault(); setOver(cell); } }}
                        onDragLeave={() => setOver(null)}
                        onDrop={(ev) => drop(ev, e, w)}
                        aria-label={`${e.first_name}, ${w.label}: ${here.length} of ${e.per_window}`}
                      >
                        {off ? (
                          <>
                            <span className="muted small">{away ? (away.reason === 'sick' ? 'Off sick' : 'On holiday') : 'Off'}</span>
                            {here.map((j) => <JobChip key={j.reference} j={j} fresh={flash.has(j.reference)} />)}
                          </>
                        ) : here.map((j) => <JobChip key={j.reference} j={j} fresh={flash.has(j.reference)} />)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      ) : (
        <p className="empty">No visit windows on {label(date, state.today)}.</p>
      )}
      <section className="tray" aria-label="Not yet in a window">
        <h3 className="small">Not yet in a window ({tray.length}) <span className="muted">· drag onto an engineer</span></h3>
        {tray.length ? tray.map((j) => <JobChip key={j.reference} j={j} fresh={flash.has(j.reference)} />) : <p className="empty small">Nothing waiting.</p>}
      </section>
    </div>
  );
}

/** The office's notice for today: every call hears it; "emergencies only" books nothing else (surge day). */
function OfficeNotice({ id, state, onDone }: { id: string; state: LiveState; onDone: () => void }) {
  const notice = state.maintenance?.notice ?? null;
  const [text, setText] = useState('');
  const [only, setOnly] = useState(false);
  const put = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) void officeAct(id, { action: 'notice', text, emergencies_only: only }, () => { setText(''); onDone(); });
  };
  if (notice) {
    return (
      <div className="office-notice on" role="status">
        <b>Notice on every call:</b> {notice.text}{notice.emergencies_only ? <span className="badge bad">Emergencies only</span> : null}
        <button type="button" onClick={() => void officeAct(id, { action: 'notice', text: '' }, onDone)}>Take down</button>
      </div>
    );
  }
  return (
    <form className="office-notice" onSubmit={put}>
      <label htmlFor="office-notice-text" className="small"><b>Office notice</b> for every call today</label>
      <input id="office-notice-text" value={text} maxLength={140} placeholder="Storm Ellen: roofers on make-safe only today" onChange={(e) => setText(e.target.value)} />
      <label className="small check"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> Emergencies only</label>
      <button type="submit" disabled={!text.trim()}>Put up</button>
    </form>
  );
}

function JobChip({ j, fresh }: { j: LiveJob; fresh: boolean }) {
  return (
    <span
      className={`chip ${j.priority} ${fresh ? 'new' : ''} ${j.engineer_off ? 'needs-move' : ''}`}
      draggable={['new', 'scheduled', 'waiting'].includes(j.status)}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', j.reference)}
      title={`${PRIORITY[j.priority].label}: ${j.description} (${j.status.replace(/_/g, ' ')})${j.engineer_off ? '. Its engineer is off: drag it to someone else.' : ''}`}
    >
      {j.address?.split(' (example)')[0] ?? j.reference} · {j.trade_label.split(/[,;]| and /)[0]}{j.flags.includes('gas') && !/gas/i.test(j.trade_label.split(/[,;]| and /)[0]) ? ' · gas' : ''}{j.status === 'on_the_way' ? ' · on the way' : j.status === 'on_site' ? ' · on site' : j.status === 'waiting' ? ' · waiting' : ''}
    </span>
  );
}
