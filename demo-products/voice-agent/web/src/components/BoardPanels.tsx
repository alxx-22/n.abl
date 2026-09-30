import { useEffect, useRef } from 'react';
import { when } from '../api.ts';
import type { TenantState } from '../types.ts';

// Rows that arrived since the last refresh flash once, so a booking made on
// the call visibly lands in the diary.
function useFresh(keys: string[]): (key: string) => boolean {
  const seen = useRef<Set<string> | null>(null);
  const arrived = useRef(new Map<string, number>());
  const now = Date.now();
  if (seen.current === null) seen.current = new Set(keys);
  for (const k of keys) {
    if (seen.current.has(k)) continue;
    seen.current.add(k);
    arrived.current.set(k, now);
  }
  return (k) => (arrived.current.get(k) ?? 0) > now - 2500;
}

function dayLabel(d: string, i: number): string {
  if (i === 0) return 'Today';
  if (i === 1) return 'Tomorrow';
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
}

export function Diary({ state, day, setDay }: { state: TenantState; day: string; setDay: (d: string) => void }) {
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(`${state.today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  for (const b of state.bookings) if (!days.includes(b.date)) days.push(b.date);
  const list = state.bookings.filter((b) => b.date === day);
  const isNew = useFresh(state.bookings.map((b) => `${b.reference}:${b.status}:${b.time}:${b.party_size}`));
  const table = state.tenant.business_type === 'restaurant' || state.tenant.business_type === 'pub';
  const slots = useRef<HTMLDivElement>(null);

  // Bring a booking that just arrived into view inside the diary's own scroll.
  useEffect(() => {
    const box = slots.current;
    const fresh = box?.querySelector<HTMLElement>('.slot.new');
    if (box && fresh) box.scrollTop = fresh.offsetTop - box.clientHeight / 3;
  }, [state, day]);

  return (
    <section className="panel" aria-labelledby="diary-title">
      <header>
        <h2 id="diary-title">Diary</h2>
        <span className="muted">{list.filter((b) => b.status === 'confirmed').length} bookings</span>
      </header>
      <div className="days" role="group" aria-label="Day">
        {days.slice(0, 10).map((d, i) => {
          const n = state.bookings.filter((b) => b.date === d && b.status === 'confirmed').length;
          return (
            <button type="button" key={d} aria-pressed={d === day} onClick={() => setDay(d)}>
              {dayLabel(d, i)}
              {n ? <span className="count">{n}</span> : null}
            </button>
          );
        })}
      </div>
      <div className="slots" ref={slots}>
        {list.length ? (
          list.map((b) => (
            <div key={b.reference} className={`slot ${b.status === 'cancelled' ? 'cancelled' : ''} ${isNew(`${b.reference}:${b.status}:${b.time}:${b.party_size}`) ? 'new' : ''}`}>
              <span className="time">{b.time}</span>
              <span>
                <span className="who">{b.name}</span>
                <br />
                <span className="meta">
                  {table ? `${b.party_size} ${b.party_size === 1 ? 'person' : 'people'} · ${b.with}` : `${b.service} · ${b.with}`}
                  {b.notes ? ` · ${b.notes}` : ''}
                </span>
              </span>
              <span className="meta mono">
                {b.reference}
                {b.deposit ? <span className={`badge ${b.deposit_paid ? 'ok' : 'warn'}`}>{b.deposit_paid ? 'deposit paid' : `deposit ${b.deposit}`}</span> : null}
              </span>
            </div>
          ))
        ) : (
          <p className="empty">Nothing booked on this day yet.</p>
        )}
      </div>
    </section>
  );
}

export function Orders({ state }: { state: TenantState }) {
  const isNew = useFresh(state.orders.map((o) => `${o.reference}:${o.payment_status}`));
  return (
    <div className="tickets">
      {state.orders.length ? (
        state.orders.map((o) => (
          <article key={o.reference} className={`ticket ${isNew(`${o.reference}:${o.payment_status}`) ? 'new' : ''}`}>
            <header>
              <span className="ref">#{o.reference}</span>
              <span className={`badge ${o.payment_status === 'paid' ? 'ok' : 'warn'}`}>{o.payment_status === 'paid' ? 'Paid (demo)' : 'Unpaid'}</span>
            </header>
            <div className="muted">
              {o.name} · {o.fulfilment} {o.due}
              {o.address ? ` · ${o.address}` : ''}
            </div>
            <ul>
              {o.lines.map((l, i) => (
                <li key={i}>
                  {l.quantity} × {l.name}
                  {l.modifiers.length ? ` (${l.modifiers.map((m) => m.name).join(', ')})` : ''}
                  {l.notes ? `, ${l.notes}` : ''}
                </li>
              ))}
            </ul>
            {o.allergy_notes ? <div className="allergy">ALLERGY: {o.allergy_notes}</div> : null}
            <div className="muted">Total {o.total}</div>
          </article>
        ))
      ) : (
        <p className="empty">{state.tenant.has_ordering ? 'No orders yet.' : 'This business does not take orders by phone.'}</p>
      )}
    </div>
  );
}

export function Messages({ state }: { state: TenantState }) {
  return (
    <div className="messages">
      {state.messages.length ? (
        state.messages.slice(0, 12).map((m) =>
          m.kind === 'message' ? (
            <div className="message" key={m.id}>
              <span className="from">Message from {m.from_name ?? 'a caller'}</span>
              {m.from_phone ? <span className="muted"> · {m.from_phone}</span> : null}
              <div>{m.body}</div>
            </div>
          ) : (
            <div className="message" key={m.id}>
              <span className={`badge ${m.status === 'sent' ? 'ok' : 'info'}`}>{m.status === 'sent' ? 'Text sent' : 'Text (simulated)'}</span>{' '}
              <span className="muted">{m.to_number}</span>
              <div>{m.body}</div>
            </div>
          ),
        )
      ) : (
        <p className="empty">No messages.</p>
      )}
    </div>
  );
}

export function Calls({ state }: { state: TenantState }) {
  return (
    <section className="panel calls" aria-labelledby="calls-title">
      <header>
        <h2 id="calls-title">Recent calls</h2>
      </header>
      <ul>
        {state.calls.length ? (
          state.calls.map((c) => (
            <li key={c.id}>
              <span className="muted">
                {when(c.started_at)} · {c.channel}
              </span>
              <span>{c.summary ?? (c.ended_at ? 'No summary yet.' : 'In progress…')}</span>
              <span className="badges">
                {c.outcome ? <span className="badge">{c.outcome.replace(/_/g, ' ')}</span> : null}
                {c.guardrail_flags ? <span className="badge bad">{c.guardrail_flags} flag{c.guardrail_flags > 1 ? 's' : ''}</span> : null}
                {c.latency?.median_ms ? <span className="badge info">{(c.latency.median_ms / 1000).toFixed(1)} s replies</span> : null}
              </span>
            </li>
          ))
        ) : (
          <li>
            <span className="muted">No calls yet.</span>
          </li>
        )}
      </ul>
    </section>
  );
}
