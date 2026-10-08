// The demo's own clock (presets/property-maintenance-use-cases.md: "a per-workspace simulated clock"):
// a prospect can try a Friday night or a Sunday at 2am whatever the time really is. Setting it starts
// the demo week again around that time, so the board, the seeded jobs and every call agree.

import { useState } from 'react';
import { ClockIcon } from '../../components/Icons.tsx';
import { demoApi } from '../../api.ts';

/** YYYY-MM-DD and HH:MM in the business's time zone. */
function local(ms: number, timeZone: string): { date: string; time: string; label: string } {
  const d = new Date(ms);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  const label = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return { date, time, label };
}

export function DemoClock({ id, timeZone, realMs, offsetMs, disabled, onSet }: {
  id: string; timeZone: string; realMs: number; offsetMs: number; disabled: boolean; onSet: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const shown = local(realMs + offsetMs, timeZone);
  const [date, setDate] = useState(shown.date);
  const [time, setTime] = useState('21:00');
  // A week either side of today, as the server allows.
  const days = Array.from({ length: 8 }, (_, i) => {
    const ms = realMs + i * 86_400_000;
    const l = local(ms, timeZone);
    return { date: l.date, label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(ms)) };
  });
  const send = async (body: Record<string, unknown>, message: string) => {
    setBusy(true);
    try {
      await demoApi(`/workspaces/${id}/clock`, { method: 'POST', json: body });
      setOpen(false);
      onSet(message);
    } catch (e) {
      onSet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="demo-clock">
      <button type="button" onClick={() => setOpen(!open)} disabled={disabled} aria-expanded={open} title="Set the time in the demo, to try nights and weekends">
        <ClockIcon /> {offsetMs ? `Demo time ${shown.label}` : 'Time'}
      </button>
      {open ? (
        <form className="clock-pop panel" onSubmit={(e) => { e.preventDefault(); void send({ date, time }, 'The demo week starts again at the time you set.'); }}>
          <label>
            Day
            <select value={date} onChange={(e) => setDate(e.target.value)}>
              {days.map((d) => <option key={d.date} value={d.date}>{d.label}</option>)}
            </select>
          </label>
          <label>
            Time
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </label>
          <p className="hint">Setting the time starts the demo week again around it: anything done on the demo so far is cleared.</p>
          <div className="row">
            <button type="submit" className="primary" disabled={busy}>Set time</button>
            {offsetMs ? <button type="button" disabled={busy} onClick={() => void send({ real: true }, 'Back to real time: the demo week starts again now.')}>Real time</button> : null}
          </div>
        </form>
      ) : null}
    </span>
  );
}
