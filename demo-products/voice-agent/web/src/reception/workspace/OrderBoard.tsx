// The order board: phone orders in columns, New to done, in the business's
// own words (the restaurant's kitchen: Collected). Moving a collection to
// Ready sends the customer the "your order is ready" text. A takeaway with
// drivers (presets/takeaway.md §6) has an Out column: a ready delivery is
// sent out with a driver, and that is when the customer hears it's on its way.

import { useState, type DragEvent } from 'react';
import { demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import type { LiveOrder, LiveState } from '../types.ts';
import type { WorkspaceSpec } from './spec.ts';

type OrdersSpec = NonNullable<WorkspaceSpec['orders']>;
type Column = { status: LiveOrder['status']; label: string };

/** What an order is once it has gone: collected, or delivered. */
const doneFor = (spec: OrdersSpec, o: LiveOrder) => (o.fulfilment === 'delivery' ? spec.done.delivery : spec.done.collection);

function columns(spec: OrdersSpec): Column[] {
  const { collection, delivery } = spec.done;
  return [
    { status: 'confirmed', label: 'New' },
    { status: 'in_kitchen', label: 'Preparing' },
    { status: 'ready', label: 'Ready' },
    ...(spec.drivers ? [{ status: 'out_for_delivery' as const, label: 'Out' }] : []),
    { status: 'completed', label: collection === delivery ? collection : `${collection} or ${delivery.toLowerCase()}` },
  ];
}

function countdown(dueAt: string, nowMs: number): { text: string; late: boolean } {
  const m = Math.round((new Date(dueAt).getTime() - nowMs) / 60000);
  if (m > 0) return { text: `in ${m} min`, late: false };
  if (m === 0) return { text: 'due now', late: false };
  return { text: `${-m} min late`, late: -m > 5 };
}

/** How it is paid for: on the phone, at the counter, or to the driver at the door. */
function payBadge(o: LiveOrder, drivers: boolean): { text: string; ok: boolean } {
  if (o.payment_status === 'paid') return { text: 'Paid (demo)', ok: true };
  if (drivers && o.fulfilment === 'delivery') return { text: o.pay_note ?? 'Pay the driver', ok: false };
  return { text: 'Pay on collection', ok: false };
}

export function OrderBoard({ id, state, spec, nowMs, onDone }: { id: string; state: LiveState; spec: OrdersSpec; nowMs: number; onDone: () => void }) {
  const [over, setOver] = useState<string | null>(null);
  const orders = state.orders.filter((o) => o.status !== 'cancelled');
  const drivers = spec.drivers ? state.drivers ?? [] : [];
  const setStatus = async (o: LiveOrder, status: LiveOrder['status'], driver?: string) => {
    try {
      await demoApi(`/workspaces/${id}/orders/${o.reference}`, { method: 'PATCH', json: driver ? { status, driver } : { status } });
      if (status === 'out_for_delivery') toast(`Order ${o.reference}: out with ${driver}. ${o.name} has been texted.`);
      else if (status === 'ready' && !(spec.drivers && o.fulfilment === 'delivery')) toast(`Order ${o.reference}: ${o.name} has been texted.`);
      onDone();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  /** The buttons that move a ticket on from where it is. */
  const actions = (o: LiveOrder) => {
    const delivery = o.fulfilment === 'delivery';
    switch (o.status) {
      case 'confirmed':
        return <button type="button" className="small primary" onClick={() => setStatus(o, 'in_kitchen')}>Start</button>;
      case 'in_kitchen':
        return <button type="button" className="small primary" onClick={() => setStatus(o, 'ready')}>{spec.drivers && delivery ? 'Ready' : 'Ready: text them'}</button>;
      case 'ready':
        return spec.drivers && delivery
          ? drivers.map((d) => <button key={d} type="button" className="small primary" onClick={() => setStatus(o, 'out_for_delivery', d)}>Out with {d}</button>)
          : <button type="button" className="small primary" onClick={() => setStatus(o, 'completed')}>{doneFor(spec, o)}</button>;
      case 'out_for_delivery':
        return <button type="button" className="small primary" onClick={() => setStatus(o, 'completed')}>{doneFor(spec, o)}</button>;
      default:
        return null;
    }
  };
  const drop = (e: DragEvent, status: LiveOrder['status']) => {
    e.preventDefault();
    setOver(null);
    const ref = e.dataTransfer.getData('text/plain');
    const o = orders.find((x) => x.reference === ref);
    // Out needs a driver: dropping there sends it with the first one; the buttons pick any.
    if (o && o.status !== status) void setStatus(o, status, status === 'out_for_delivery' ? drivers[0] : undefined);
  };

  if (!state.tenant.has_ordering) return <p className="empty">Click and collect is off. Turn it on in the setup’s “How you serve”.</p>;
  return (
    <div className={`kitchen ${spec.drivers ? 'with-out' : ''}`}>
      {columns(spec).map((c) => {
        const mine = orders.filter((o) => o.status === c.status).sort((a, b) => a.due_at.localeCompare(b.due_at));
        return (
          <section
            key={c.status} className={`k-col ${over === c.status ? 'over' : ''}`} aria-label={c.label}
            onDragOver={(e) => { e.preventDefault(); setOver(c.status); }} onDragLeave={() => setOver(null)} onDrop={(e) => drop(e, c.status)}
          >
            <h3>{c.label} <span className="count">{mine.length}</span></h3>
            {mine.map((o) => {
              const cd = countdown(o.due_at, nowMs);
              const pay = payBadge(o, spec.drivers);
              const away = o.out_at ? Math.max(0, Math.round((nowMs - new Date(o.out_at).getTime()) / 60000)) : null;
              return (
                <article key={o.reference} className="ticket" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', o.reference)}>
                  <header>
                    <span className="ref">#{o.reference}</span>
                    <span className={`due ${cd.late && c.status !== 'completed' ? 'late' : ''}`}>{o.due_time}{c.status !== 'completed' ? ` · ${cd.text}` : ''}</span>
                  </header>
                  <div className="muted small">{o.name} · {o.fulfilment}{o.address ? ` · ${o.address}` : ''}</div>
                  {o.status === 'out_for_delivery' && o.driver ? <div className="small">With {o.driver}{away !== null ? `, left ${away} min ago` : ''}</div> : null}
                  <ul>
                    {o.lines.map((l, i) => (
                      <li key={i}>{l.quantity} × {l.name}{l.modifiers.length ? ` (${l.modifiers.map((m) => m.name).join(', ')})` : ''}{l.notes ? `, ${l.notes}` : ''}</li>
                    ))}
                  </ul>
                  {o.allergy_notes ? <div className="allergy">ALLERGY: {o.allergy_notes}</div> : null}
                  <footer>
                    <span className={`badge ${pay.ok ? 'ok' : 'warn'}`}>{pay.text}</span>
                    <span className="muted small">{o.total}</span>
                    {actions(o)}
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
