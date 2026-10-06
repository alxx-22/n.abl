// Quotes and invoices (presets/property-maintenance.md §6, M2): quotes out
// and what became of them, and every invoice, unpaid first. The office sends
// a reminder (by text, never with bank details) or marks a bank transfer
// paid; a card payment is taken on a call, with the demo card only.

import { useState } from 'react';
import { demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import type { LiveInvoice, LiveState } from '../types.ts';
import { money } from './maintenance.ts';

const QUOTE: Record<string, { label: string; level: string }> = {
  sent: { label: 'Awaiting approval', level: 'warn' }, approved: { label: 'Approved', level: 'ok' }, declined: { label: 'Declined', level: '' }, expired: { label: 'Expired', level: '' },
};
const INVOICE: Record<LiveInvoice['status'], { label: string; level: string }> = {
  overdue: { label: 'Overdue', level: 'bad' }, due: { label: 'Due', level: 'warn' }, paid: { label: 'Paid', level: 'ok' }, void: { label: 'Cancelled', level: '' },
};
const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function Money({ id, state, onDone }: { id: string; state: LiveState; onDone: () => void }) {
  const [show, setShow] = useState<'unpaid' | 'all'>('unpaid');
  const [busy, setBusy] = useState(false);
  const invoices = state.invoices ?? [];
  const quotes = state.quotes ?? [];
  const unpaid = invoices.filter((i) => i.status === 'due' || i.status === 'overdue');
  const order = { overdue: 0, due: 1, paid: 2, void: 3 };
  const shown = (show === 'unpaid' ? unpaid : invoices).slice().sort((a, b) => order[a.status] - order[b.status] || b.issued.localeCompare(a.issued));
  const total = (xs: LiveInvoice[]) => money(xs.reduce((n, i) => n + i.amount_pence, 0));
  const act = async (ref: string, action: 'remind' | 'paid_bank') => {
    setBusy(true);
    try {
      toast((await demoApi<{ message: string }>(`/workspaces/${id}/invoices/${ref}`, { method: 'PATCH', json: { action } })).message);
      onDone();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="compliance">
      <h3 className="sub">Quotes</h3>
      {quotes.length ? (
        <table className="certs">
          <thead><tr><th scope="col">Quote</th><th scope="col">For</th><th scope="col">Amount</th><th scope="col">State</th></tr></thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.reference}>
                <td><b>{q.reference}</b><span className="small muted block">{day(q.issued)}</span></td>
                <td>{q.description}<span className="small muted block">{q.address ?? ''}{q.client ? ` · ${q.client}` : ''}</span></td>
                <td>{money(q.amount_pence)}</td>
                <td><span className={`badge ${QUOTE[q.status].level}`}>{QUOTE[q.status].label}</span>{q.decided_by ? <span className="small muted block">by {q.decided_by}</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="empty">No quotes out.</p>}
      <h3 className="sub">Invoices</h3>
      <div className="row-tools">
        <span className="badge bad">{total(invoices.filter((i) => i.status === 'overdue'))} overdue</span>
        <span className="badge warn">{total(invoices.filter((i) => i.status === 'due'))} due</span>
        <span className="badge ok">{total(invoices.filter((i) => i.status === 'paid'))} paid</span>
        <label className="small inline-check"><input type="checkbox" checked={show === 'unpaid'} onChange={(e) => setShow(e.target.checked ? 'unpaid' : 'all')} /> Unpaid only</label>
      </div>
      {shown.length ? (
        <table className="certs">
          <thead><tr><th scope="col">Invoice</th><th scope="col">For</th><th scope="col">Amount</th><th scope="col">State</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {shown.map((i) => (
              <tr key={i.reference}>
                <td><b>{i.reference}</b><span className="small muted block">{day(i.issued)}</span></td>
                <td>{i.description}<span className="small muted block">{i.client ?? i.payer.name ?? ''}{i.kind === 'callout' ? ' · call-out' : ''}</span></td>
                <td>{money(i.amount_pence)}</td>
                <td>
                  <span className={`badge ${INVOICE[i.status].level}`}>{INVOICE[i.status].label}</span>
                  <span className="small muted block">{i.status === 'paid' ? `${i.paid_how === 'card' ? `Demo card …${i.card_last4}` : 'Bank transfer'}${i.paid_at ? `, ${day(i.paid_at)}` : ''}` : `Due ${day(i.due)}`}</span>
                </td>
                <td>
                  {i.status === 'due' || i.status === 'overdue' ? (
                    <div className="row-tools">
                      <button type="button" className="small" disabled={busy} onClick={() => act(i.reference, 'remind')}>Remind</button>
                      <button type="button" className="small" disabled={busy} onClick={() => act(i.reference, 'paid_bank')}>Paid by bank</button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="empty">Nothing unpaid. Untick to see every invoice.</p>}
    </div>
  );
}
