// The kitchen board: takeaway tickets in columns, New to Collected. Moving a
// ticket to Ready sends the customer the "your order is ready" text.

import { useState, type DragEvent } from 'react';
import { demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import type { LiveOrder, LiveState } from '../types.ts';

const COLUMNS: { status: LiveOrder['status']; label: string; next?: { status: LiveOrder['status']; label: string } }[] = [
  { status: 'confirmed', label: 'New', next: { status: 'in_kitchen', label: 'Start' } },
  { status: 'in_kitchen', label: 'Preparing', next: { status: 'ready', label: 'Ready: text them' } },
  { status: 'ready', label: 'Ready', next: { status: 'completed', label: 'Collected' } },
  { status: 'completed', label: 'Collected' },
];

function countdown(dueAt: string, nowMs: number): { text: string; late: boolean } {
  const m = Math.round((new Date(dueAt).getTime() - nowMs) / 60000);
  if (m > 0) return { text: `in ${m} min`, late: false };
  if (m === 0) return { text: 'due now', late: false };
  return { text: `${-m} min late`, late: -m > 5 };
}

export function Kitchen({ id, state, nowMs, onDone }: { id: string; state: LiveState; nowMs: number; onDone: () => void }) {
  const [over, setOver] = useState<string | null>(null);
  const orders = state.orders.filter((o) => o.status !== 'cancelled');
  const setStatus = async (o: LiveOrder, status: LiveOrder['status']) => {
    try {
      await demoApi(`/workspaces/${id}/orders/${o.reference}`, { method: 'PATCH', json: { status } });
      if (status === 'ready') toast(`Order ${o.reference}: ${o.name} has been texted.`);
      onDone();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const drop = (e: DragEvent, status: LiveOrder['status']) => {
    e.preventDefault();
    setOver(null);
    const ref = e.dataTransfer.getData('text/plain');
    const o = orders.find((x) => x.reference === ref);
    if (o && o.status !== status) void setStatus(o, status);
  };

  if (!state.tenant.has_ordering) return <p className="empty">Click and collect is off. Turn it on in the setup’s “How you serve”.</p>;
  return (
    <div className="kitchen">
      {COLUMNS.map((c) => {
        const mine = orders.filter((o) => o.status === c.status).sort((a, b) => a.due_at.localeCompare(b.due_at));
        return (
          <section
            key={c.status} className={`k-col ${over === c.status ? 'over' : ''}`} aria-label={c.label}
            onDragOver={(e) => { e.preventDefault(); setOver(c.status); }} onDragLeave={() => setOver(null)} onDrop={(e) => drop(e, c.status)}
          >
            <h3>{c.label} <span className="count">{mine.length}</span></h3>
            {mine.map((o) => {
              const cd = countdown(o.due_at, nowMs);
              return (
                <article key={o.reference} className="ticket" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', o.reference)}>
                  <header>
                    <span className="ref">#{o.reference}</span>
                    <span className={`due ${cd.late && c.status !== 'completed' ? 'late' : ''}`}>{o.due_time}{c.status !== 'completed' ? ` · ${cd.text}` : ''}</span>
                  </header>
                  <div className="muted small">{o.name} · {o.fulfilment}{o.address ? ` · ${o.address}` : ''}</div>
                  <ul>
                    {o.lines.map((l, i) => (
                      <li key={i}>{l.quantity} × {l.name}{l.modifiers.length ? ` (${l.modifiers.map((m) => m.name).join(', ')})` : ''}{l.notes ? `, ${l.notes}` : ''}</li>
                    ))}
                  </ul>
                  {o.allergy_notes ? <div className="allergy">ALLERGY: {o.allergy_notes}</div> : null}
                  <footer>
                    <span className={`badge ${o.payment_status === 'paid' ? 'ok' : 'warn'}`}>{o.payment_status === 'paid' ? 'Paid (demo)' : 'Pay on collection'}</span>
                    <span className="muted small">{o.total}</span>
                    {c.next ? <button type="button" className="small primary" onClick={() => setStatus(o, c.next!.status)}>{c.next.label}</button> : null}
                  </footer>
                </article>
              );
            })}
            {!mine.length ? <p className="empty">Nothing here.</p> : null}
          </section>
        );
      })}
    </div>
  );
}
