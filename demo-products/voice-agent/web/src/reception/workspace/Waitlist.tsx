// A barber shop's waiting list (presets/barber.md §6): callers who wanted a
// day that was full, by day. When a slot comes up the first who fits is
// texted, and their row says so; staff remove whoever has been sorted out.

import { useState } from 'react';
import type { LiveState, LiveWaitlistEntry } from '../types.ts';
import { dayTime, shopAct } from './barber.ts';
import { dayLabel } from './model.ts';
import './barber-office.css';

export function Waitlist({ id, state, today, onDone }: { id: string; state: LiveState; today: string; onDone: () => void }) {
  const b = state.barber;
  if (!b) {
    return <p className="empty">The waiting list shows here: callers who wanted a day that was full, by day, and whether they've been texted that a slot has come up.</p>;
  }
  const days = [...new Set(b.waitlist.map((w) => w.date))].sort();
  const tz = state.tenant.timezone;
  return (
    <div className="bb-view bb-waitlist">
      <p className="hint">Callers who wanted a day that was full. When a slot comes up, the first who fits is texted.</p>
      {days.length ? days.map((d) => {
        const here = b.waitlist.filter((w) => w.date === d);
        const label = dayLabel(d, today);
        const full = new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
        return (
          <section key={d} aria-label={full}>
            <h3 className="bb-h">{label === 'Today' || label === 'Tomorrow' ? `${label}, ${full}` : full} <span className="count">{here.length}</span></h3>
            <ul className="bb-list bb-wl">
              {here.map((w) => <WaitRow key={w.id} id={id} w={w} tz={tz} onDone={onDone} />)}
            </ul>
          </section>
        );
      }) : (
        <p className="empty">Nobody on the waiting list. The receptionist offers it when a caller's day is full.</p>
      )}
    </div>
  );
}

function WaitRow({ id, w, tz, onDone }: { id: string; w: LiveWaitlistEntry; tz: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <li className="bb-wl-row">
      <span className="bb-what">
        <b>{w.service}</b>
        <span className="muted small">{w.with ?? 'Any barber'}</span>
      </span>
      <span className="bb-who">
        <span>{w.name}</span>
        {w.phone ? <span className="muted small">{w.phone}</span> : null}
      </span>
      <span className="bb-added muted small">Added {dayTime(w.created_at, tz)}</span>
      <span className="bb-texted">
        {w.notified_at ? <span className="badge ok" title={`Texted ${dayTime(w.notified_at, tz)} that a slot has come up`}>Texted</span> : null}
      </span>
      <span className="bb-acts">
        <button
          type="button" className="small ghost" disabled={busy} aria-label={`Remove ${w.name} from the waiting list`}
          onClick={async () => { setBusy(true); await shopAct(id, `waitlist/${w.id}`, 'PATCH', { action: 'remove' }, onDone); setBusy(false); }}
        >
          Remove
        </button>
      </span>
    </li>
  );
}
