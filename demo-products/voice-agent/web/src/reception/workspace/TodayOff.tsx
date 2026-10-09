// A barber shop's Today (presets/barber.md §6): each barber on today's rota
// In or Off today, and one line every caller hears. A barber off today is
// never offered on a call ("Dan's off today; Marcus or Jordan could do it"),
// and their bookings left today are marked in the Diary as needing a new
// time, so turning someone off says first how many that will be.

import { useId, useState, type FormEvent } from 'react';
import type { LiveBooking, LiveState } from '../types.ts';
import { rotaToday, shopAct } from './barber.ts';
import { live, span, weekday } from './model.ts';
import './barber-office.css';

const DAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
const bookings = (n: number) => `${n} booking${n === 1 ? '' : 's'}`;

export function TodayOff({ id, state, nowMinute, onDone }: { id: string; state: LiveState; nowMinute: number; onDone: () => void }) {
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // What was last saved, until the state read after it arrives: a second switch in that moment builds on the first.
  const [saved, setSaved] = useState<{ off: string[]; notice: string | null; over: string } | null>(null);
  const b = state.barber;
  if (!b) {
    return <p className="empty">Today shows here: each barber In or Off today, and a notice every caller hears.</p>;
  }
  const read = JSON.stringify(b.today);
  const { date } = b.today;
  const { off, notice } = saved?.over === read ? saved : b.today;
  const rota = rotaToday(state).map(({ m }) => ({ m, off: off.includes(m.key) }));
  const notIn = (state.team ?? []).filter((m) => !m.days.includes(weekday(date)));
  // What turning a barber off moves: their bookings today not yet done, or (once off) those the server marked.
  const left = (key: string): LiveBooking[] => state.bookings.filter((x) => x.date === date && x.resource_key === key && live(x) && (x.needs_new_time || span(x)[1] > nowMinute));
  const needing = (key: string) => {
    const marked = left(key).filter((x) => x.needs_new_time);
    return marked.length ? marked : left(key);
  };
  const save = async (nextOff: string[], nextNotice: string | null) => {
    setBusy(true);
    const ok = await shopAct(id, 'today', 'PATCH', { off: nextOff, notice: nextNotice }, onDone);
    if (ok) setSaved({ off: nextOff, notice: nextNotice, over: read });
    setBusy(false);
    return ok;
  };
  const setOff = async (key: string, to: boolean) => {
    setAsking(null);
    await save(to ? [...off.filter((k) => k !== key), key] : off.filter((k) => k !== key), notice);
  };
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

  return (
    <div className="bb-view bb-today">
      <section aria-labelledby="bb-today-h">
        <h3 id="bb-today-h" className="bb-h">Barbers today <span className="muted small">{day}</span></h3>
        <ul className="bb-list bb-team">
          {rota.map(({ m, off: isOff }) => {
            const n = isOff ? needing(m.key).length : left(m.key).length;
            return (
              <li key={m.key} className={isOff ? 'off' : ''}>
                <span className="bb-who">
                  <b>{m.first_name}</b>
                  {isOff ? (
                    n ? <span className="bb-flag">{bookings(n)} need{n === 1 ? 's' : ''} a new time</span> : <span className="muted small">No bookings left today</span>
                  ) : (
                    <span className="muted small">{n ? `${bookings(n)} left today` : 'No bookings left today'}</span>
                  )}
                </span>
                <span className="bb-switch" role="group" aria-label={`${m.first_name} today`}>
                  <button type="button" className="small" aria-pressed={!isOff} disabled={busy} onClick={() => isOff && void setOff(m.key, false)}>In</button>
                  <button
                    type="button" className="small" aria-pressed={isOff} disabled={busy}
                    aria-expanded={asking === m.key ? true : undefined}
                    onClick={() => { if (!isOff) { if (n) setAsking(asking === m.key ? null : m.key); else void setOff(m.key, true); } }}
                  >
                    Off today
                  </button>
                </span>
                {asking === m.key ? (
                  <div className="bb-confirm" role="group" aria-label={`Mark ${m.first_name} off today`}>
                    <p className="small">
                      {m.first_name} has <b>{bookings(n)}</b> left today. {n === 1 ? 'It' : 'They'}'ll be marked in the Diary as needing a new time:
                      drag {n === 1 ? 'it' : 'each'} to another barber, or cancel. Callers who ask for {m.first_name} hear they're off today.
                    </p>
                    <div className="row-tools">
                      <button type="button" className="small primary" disabled={busy} onClick={() => void setOff(m.key, true)}>Mark {m.first_name} off</button>
                      <button type="button" className="small ghost" onClick={() => setAsking(null)}>Keep {m.first_name} in</button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
          {notIn.map((m) => (
            <li key={m.key} className="rota-off">
              <span className="bb-who"><b>{m.first_name}</b><span className="muted small">Not in on {DAYS[weekday(date)]}</span></span>
            </li>
          ))}
        </ul>
        {!rota.length ? <p className="empty">Nobody is on the rota today.</p> : null}
      </section>
      <Notice key={notice ?? ''} notice={notice} busy={busy} onSave={(text) => save(off, text)} />
    </div>
  );
}

/** One line every caller hears today; keyed on the saved notice, so a change from elsewhere shows. */
function Notice({ notice, busy, onSave }: { notice: string | null; busy: boolean; onSave: (text: string | null) => Promise<boolean> }) {
  const [text, setText] = useState(notice ?? '');
  const f = useId();
  const changed = text.trim() !== (notice ?? '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (changed) void onSave(text.trim() || null);
  };
  return (
    <form className={`bb-notice ${notice ? 'on' : ''}`} onSubmit={submit}>
      <label htmlFor={f} className="bb-h">Notice for callers</label>
      <p className="hint" id={`${f}-hint`}>One short line every caller hears today, such as “We're a barber down today, so walk-in waits are longer.”</p>
      <textarea id={f} rows={2} maxLength={160} value={text} aria-describedby={`${f}-hint`} onChange={(e) => setText(e.target.value)} />
      <div className="row-tools">
        <button type="submit" className="small primary" disabled={busy || !changed}>Save notice</button>
        {notice ? <button type="button" className="small ghost" disabled={busy} onClick={() => void onSave(null)}>Take it down</button> : null}
        {notice && !changed ? <span className="muted small" role="status">On every call today</span> : null}
      </div>
    </form>
  );
}
