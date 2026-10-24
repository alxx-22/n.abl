// A pub's What's on (presets/pub.md §6): this week's fixtures and events, as
// the receptionist's whats_on reads them. The manager adds a fixture or takes
// one off, and a call in progress hears it at once. The weekly ones (the
// quiz, live music) are changed in the builder, so they have no remove.

import { useState } from 'react';
import { demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import { useBand } from '../bands.ts';
import type { LiveState, WeekEvent } from '../types.ts';

const dayLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const plusDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const KIND: Record<WeekEvent['kind'], string> = { sport: 'Sport', music: 'Music', quiz: 'Quiz', other: 'Event' };

export function WhatsOn({ id, state, today, onDone }: { id: string; state: LiveState; today: string; onDone: () => void }) {
  const week = state.pub?.events ?? [];
  const days = Array.from({ length: 7 }, (_, i) => plusDays(today, i));
  const [date, setDate] = useState(days.find((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === 6) ?? today);
  const [time, setTime] = useState('15:00');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  // On a phone the form folds away behind its own button: the week's list is what the manager looks at.
  const phone = useBand() === 'phone';
  const add = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const r = await demoApi<{ message: string }>(`/workspaces/${id}/events`, { method: 'POST', json: { date, time, title: title.trim(), kind: 'sport' } });
      toast(r.message);
      setTitle('');
      onDone();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (e: WeekEvent) => {
    try {
      await demoApi(`/workspaces/${id}/events/${e.id}`, { method: 'DELETE' });
      toast(`${e.title} is off the list.`);
      onDone();
    } catch (err) {
      toast((err as Error).message);
    }
  };
  return (
    <div className="whats-on">
      <details className="whats-on-adder" open={!phone || undefined} key={phone ? 'phone' : 'wide'}>
      <summary>Add a fixture</summary>
      <form className="whats-on-add" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <label>
          Day
          <select value={date} onChange={(e) => setDate(e.target.value)}>
            {days.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
          </select>
        </label>
        <label>
          Kick-off
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label className="grow">
          The match
          <input value={title} maxLength={80} placeholder="Nottingham Forest v Arsenal" onChange={(e) => setTitle(e.target.value)} />
        </label>
        <button type="submit" className="primary" disabled={busy || !title.trim()}>Add a fixture</button>
      </form>
      </details>
      <p className="hint">Callers asking "are you showing the match?" hear only what's here. During a match the bar is first come; the dining room can still be booked.</p>
      {days.map((d) => {
        const on = week.filter((e) => e.date === d);
        if (!on.length) return null;
        return (
          <section key={d} className="whats-on-day" aria-label={dayLabel(d)}>
            <h4>{d === today ? 'Today' : dayLabel(d)}</h4>
            <ul>
              {on.map((e) => (
                <li key={`${e.id ?? e.title}-${e.time}`} className={`whats-on-event ${e.kind}`}>
                  <b className="time">{e.time}</b>
                  <span className="kind">{KIND[e.kind]}</span>
                  <span className="title">{e.title}{e.place ? <span className="place"> · {e.place}</span> : null}</span>
                  {e.id ? <button type="button" className="small" onClick={() => void remove(e)}>Take off</button> : <span className="weekly">Every week</span>}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {!week.length ? <p className="empty">Nothing on this week yet. Add a fixture above.</p> : null}
    </div>
  );
}
