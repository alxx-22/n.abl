// A takeaway's drivers (presets/takeaway.md §6): each driver's deliveries out,
// how long since they left and when each is due, and what they need at the
// door; Delivered when it's handed over. Deliveries the kitchen has ready
// wait below for a driver: sending one out texts the customer that it's on
// its way.

import { demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import type { LiveOrder, LiveState } from '../types.ts';

const minutesSince = (iso: string, nowMs: number) => Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 60000));

export function Drivers({ id, state, nowMs, onDone }: { id: string; state: LiveState; nowMs: number; onDone: () => void }) {
  const drivers = state.drivers ?? [];
  const deliveries = state.orders.filter((o) => o.fulfilment === 'delivery');
  const out = (d: string) => deliveries.filter((o) => o.status === 'out_for_delivery' && o.driver === d).sort((a, b) => a.due_at.localeCompare(b.due_at));
  const waiting = deliveries.filter((o) => o.status === 'ready').sort((a, b) => a.due_at.localeCompare(b.due_at));
  const act = async (o: LiveOrder, status: 'out_for_delivery' | 'completed', driver?: string) => {
    try {
      await demoApi(`/workspaces/${id}/orders/${o.reference}`, { method: 'PATCH', json: driver ? { status, driver } : { status } });
      toast(status === 'completed' ? `Order ${o.reference}: delivered.` : `Order ${o.reference}: out with ${driver}. ${o.name} has been texted.`);
      onDone();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  if (!drivers.length) return <p className="empty">No drivers yet. Add them in the setup’s “Collection and delivery”.</p>;
  return (
    <div className="drivers">
      {drivers.map((d) => {
        const mine = out(d);
        return (
          <section key={d} className="k-col" aria-label={d}>
            <h3>{d} <span className="count">{mine.length ? `${mine.length} out` : 'free'}</span></h3>
            {mine.map((o) => (
              <article key={o.reference} className="ticket">
                <header>
                  <span className="ref">#{o.reference}</span>
                  <span className="due">due {o.due_time}</span>
                </header>
                <div className="muted small">{o.address}</div>
                <div className="small">Left {o.out_at ? `${minutesSince(o.out_at, nowMs)} min ago` : 'just now'}</div>
                {o.allergy_notes ? <div className="allergy">ALLERGY: {o.allergy_notes}</div> : null}
                <footer>
                  <span className={`badge ${o.payment_status === 'paid' ? 'ok' : 'warn'}`}>{o.payment_status === 'paid' ? 'Paid (demo)' : o.pay_note ?? 'Take payment'}</span>
                  <span className="muted small">{o.total}</span>
                  <button type="button" className="small primary" onClick={() => act(o, 'completed')}>Delivered</button>
                </footer>
              </article>
            ))}
            {!mine.length ? <p className="empty">Back at the shop.</p> : null}
          </section>
        );
      })}
      <section className="k-col" aria-label="Waiting for a driver">
        <h3>Waiting for a driver <span className="count">{waiting.length}</span></h3>
        {waiting.map((o) => (
          <article key={o.reference} className="ticket">
            <header>
              <span className="ref">#{o.reference}</span>
              <span className="due">due {o.due_time}</span>
            </header>
            <div className="muted small">{o.address}</div>
            <footer>
              {drivers.map((d) => <button key={d} type="button" className="small primary" onClick={() => act(o, 'out_for_delivery', d)}>Out with {d}</button>)}
            </footer>
          </article>
        ))}
        {!waiting.length ? <p className="empty">Nothing ready to go.</p> : null}
      </section>
    </div>
  );
}
