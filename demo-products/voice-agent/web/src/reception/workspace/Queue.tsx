// A barber shop's walk-in queue (presets/barber.md §6): how soon each barber
// is free, then everyone waiting, first in first, with how long they've
// waited and who they want. "Next" puts the walk-in in a barber's chair, as a
// booking starting now; "Left" takes them off the queue. The receptionist
// reads the same queue when a caller asks how long the wait is.

import { useId, useRef, useState, type FormEvent } from 'react';
import { normaliseUkPhone } from '../../../../src/domain/phone.ts';
import type { LiveState, LiveWalkIn } from '../types.ts';
import { chairFreeAt, clockTime, mins, rotaToday, serviceMinutes, shopAct, shopServices, sinceRead } from './barber.ts';
import { hhmm, toMin, weekday } from './model.ts';
import { Sheet } from './RepairsKit.tsx';
import './barber-office.css';

export function Queue({ id, state, nowMs, nowMinute, onDone }: { id: string; state: LiveState; nowMs: number; nowMinute: number; onDone: () => void }) {
  const [adding, setAdding] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const b = state.barber;
  if (!b) {
    return <p className="empty">The walk-in queue shows here: who's waiting, for how long and for whom, and how soon each barber is free.</p>;
  }
  const drift = sinceRead(state, nowMs);
  const tz = state.tenant.timezone;
  const wait = b.wait_now.map((w) => ({ ...w, left: Math.max(0, w.minutes - drift) }));
  const inToday = rotaToday(state).filter(({ off }) => !off).map(({ m }) => m);
  const wd = weekday(b.today.date);
  const open = state.opening_hours.some((h) => h.days.includes(wd) && toMin(h.open) <= nowMinute && nowMinute < toMin(h.close));
  // In today but not in the wait now: no gap left for a cut today (or the shop has shut).
  const full = open ? inToday.filter((m) => !wait.some((w) => w.resource_key === m.key)) : [];
  /** Who can take this walk-in, soonest free first: their chair from the Diary, not the wait for someone new. */
  const chairsFor = (q: LiveWalkIn) => {
    const minutes = serviceMinutes(state, q.service_key);
    return inToday
      .filter((m) => !m.services?.length || m.services.includes(q.service_key))
      .map((m) => ({ resource_key: m.key, with: m.first_name, at: chairFreeAt(state, m.key, b.today.date, nowMinute, minutes) }))
      .sort((x, y) => x.at - y.at || x.with.localeCompare(y.with));
  };
  const closed = () => {
    setAdding(false);
    // The panel is gone, and focus with it: back to the button that opened it.
    requestAnimationFrame(() => addButton.current?.focus());
  };
  return (
    <div className="bb-view bb-queue">
      <section className="bb-wait" aria-labelledby="bb-wait-h">
        {/* The server's, as callers hear it: for someone new, so it counts everyone already waiting. */}
        <h3 id="bb-wait-h" className="bb-h">Wait now <span className="muted small">for someone walking in, after the queue</span></h3>
        {wait.length || full.length ? (
          <ul className="bb-wait-list">
            {wait.map((w) => (
              <li key={w.resource_key} className={w.left === 0 ? 'free' : ''}>
                <b>{w.with}</b>
                {w.left === 0 ? <span className="bb-wait-when">Free now</span> : <><span className="bb-mins">{mins(w.left)}</span><span className="bb-wait-when">Free at {w.free_at}</span></>}
              </li>
            ))}
            {full.map((m) => (
              <li key={m.key} className="full">
                <b>{m.first_name}</b>
                <span className="bb-wait-when">Booked up today</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">{!open ? 'The shop is closed now.' : 'No barbers in today.'}</p>
        )}
      </section>

      <div className="bb-head">
        <h3 className="bb-h">Waiting <span className="count">{b.queue.length}</span></h3>
        <button ref={addButton} type="button" className="small primary" aria-haspopup="dialog" onClick={() => setAdding(true)}>Add a walk-in</button>
      </div>
      {b.queue.length ? (
        <ol className="bb-list bb-walkins">
          {b.queue.map((q, i) => (
            <WalkInRow
              key={q.id} id={id} q={q} place={i + 1} tz={tz} onDone={onDone}
              waited={Math.max(q.waited_minutes, Math.floor((nowMs - Date.parse(q.joined_at)) / 60000))}
              barbers={chairsFor(q)} nowMinute={nowMinute}
            />
          ))}
        </ol>
      ) : (
        <p className="empty">Nobody waiting. Add a walk-in when someone comes in without a booking.</p>
      )}
      <p className="hint">Next puts them in a barber's chair now, and they show in the Diary. Callers asking about the wait hear it from this queue.</p>
      {adding ? <AddWalkIn id={id} state={state} onClose={closed} onDone={onDone} /> : null}
    </div>
  );
}

function WalkInRow({ id, q, place, waited, barbers, nowMinute, tz, onDone }: {
  id: string;
  q: LiveWalkIn;
  place: number;
  waited: number;
  barbers: { resource_key: string; with: string; at: number }[];
  nowMinute: number;
  tz: string;
  onDone: () => void;
}) {
  const asked = barbers.some((w) => w.resource_key === q.resource_key) ? q.resource_key : null;
  const [to, setTo] = useState<string>(asked ?? barbers[0]?.resource_key ?? '');
  const [busy, setBusy] = useState(false);
  const pick = useId();
  // The list moves under the select as barbers come free; keep the choice only while it's still there.
  const chosen = barbers.some((w) => w.resource_key === to) ? to : asked ?? barbers[0]?.resource_key ?? '';
  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    await shopAct(id, `walkins/${q.id}`, 'PATCH', body, onDone);
    setBusy(false);
  };
  return (
    <li className="bb-walkin">
      <span className="bb-place" aria-hidden="true">{place}</span>
      <span className="bb-who">
        <b>{q.name}</b>
        {q.phone ? <span className="muted small">{q.phone}</span> : null}
      </span>
      <span className="bb-what">
        <span>{q.service}</span>
        <span className="muted small">{q.with ? `Wants ${q.with}` : 'Any barber'}</span>
      </span>
      <span className={`bb-waited ${waited >= 30 ? 'long' : ''}`} title={`Came in at ${clockTime(q.joined_at, tz)}`}>
        <span className="visually-hidden">Waited </span>{mins(waited)}
      </span>
      <span className="bb-acts">
        <label htmlFor={pick} className="visually-hidden">Barber for {q.name}</label>
        <select id={pick} value={chosen} disabled={!barbers.length || busy} onChange={(e) => setTo(e.target.value)}>
          {barbers.length ? barbers.map((w) => (
            <option key={w.resource_key} value={w.resource_key}>{w.with} · {w.at <= nowMinute ? 'free now' : `free ${hhmm(w.at)}`}</option>
          )) : <option value="">No one in</option>}
        </select>
        <button type="button" className="small primary" disabled={!chosen || busy} aria-label={`Next: ${q.name} to the chosen barber`} onClick={() => act({ action: 'serve', resource_key: chosen })}>Next</button>
        <button type="button" className="small ghost" disabled={busy} aria-label={`${q.name} left`} onClick={() => act({ action: 'left' })}>Left</button>
      </span>
    </li>
  );
}

function AddWalkIn({ id, state, onClose, onDone }: { id: string; state: LiveState; onClose: () => void; onDone: () => void }) {
  const services = shopServices(state);
  const [name, setName] = useState('');
  const [service, setService] = useState(services[0]?.key ?? '');
  const [barber, setBarber] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const f = useId();
  // Only barbers in today who do the service; "any" lets whoever is free first take them.
  const able = rotaToday(state).filter(({ m, off }) => !off && (!m.services?.length || m.services.includes(service)));
  const who = able.some(({ m }) => m.key === barber) ? barber : '';
  // Said before sending: the server would quietly drop a number it can't read.
  const badPhone = phone.trim() !== '' && !normaliseUkPhone(phone);
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !service || badPhone) return;
    setBusy(true);
    const ok = await shopAct(id, 'walkins', 'POST', { name: name.trim(), service_key: service, resource_key: who || null, ...(phone.trim() ? { phone: phone.trim() } : {}) }, onDone);
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Sheet title="Add a walk-in" sub="They join the end of the queue." onClose={onClose}>
      <form className="bb-form" onSubmit={add}>
        <div className="field">
          <label htmlFor={`${f}-name`}>Name</label>
          <input id={`${f}-name`} value={name} autoComplete="off" required maxLength={40} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${f}-service`}>Service</label>
          <select id={`${f}-service`} value={service} onChange={(e) => setService(e.target.value)}>
            {services.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${f}-barber`}>Barber</label>
          <select id={`${f}-barber`} value={who} onChange={(e) => setBarber(e.target.value)}>
            <option value="">Any barber</option>
            {able.map(({ m }) => <option key={m.key} value={m.key}>{m.first_name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${f}-phone`}>Mobile <span className="muted small">(optional)</span></label>
          <input
            id={`${f}-phone`} type="tel" inputMode="tel" autoComplete="off" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)}
            aria-invalid={badPhone || undefined} aria-describedby={badPhone ? `${f}-phone-err` : undefined}
          />
          {badPhone ? <p id={`${f}-phone-err`} className="hint bb-err">That isn't a UK number. Leave it empty, or check it.</p> : null}
        </div>
        <div className="row-tools">
          <button type="submit" className="primary" disabled={busy || !name.trim() || !service || badPhone}>Add to the queue</button>
        </div>
      </form>
    </Sheet>
  );
}
