// Quotes and invoices (presets/property-maintenance.md §6, M2): quotes out
// and what became of them, and every invoice, unpaid first. The office sends
// a reminder (by text, never with bank details) or marks a bank transfer
// paid; a card payment is taken on a call, with the demo card only.
//
// Each quote and invoice is one row of two short lines with its actions at
// the end; its reference opens the rest (who pays, on which phone, the job,
// the dates). Chips choose which invoices show, with what each adds up to.

import { Fragment, useId, useState, type ReactNode } from 'react';
import { demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import type { LiveInvoice, LiveQuote, LiveState } from '../types.ts';
import { money, shortPlace } from './maintenance.ts';
import { Chips } from './RepairsKit.tsx';

const QUOTE: Record<string, { label: string; level: string }> = {
  sent: { label: 'Awaiting approval', level: 'warn' }, approved: { label: 'Approved', level: 'ok' }, declined: { label: 'Declined', level: '' }, expired: { label: 'Expired', level: '' },
};
const INVOICE: Record<LiveInvoice['status'], { label: string; level: string }> = {
  overdue: { label: 'Overdue', level: 'bad' }, due: { label: 'Due', level: 'warn' }, paid: { label: 'Paid', level: 'ok' }, void: { label: 'Cancelled', level: '' },
};
const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "Cracked bedroom window", from "Cracked bedroom window (Flat 1, 27 Bellfounder Street (example), LE11)": the address has its own line. */
const work = (description: string, address: string | null) =>
  address && description.endsWith(` (${address})`) ? description.slice(0, -(address.length + 3)) : description;

type Show = 'unpaid' | 'overdue' | 'due' | 'paid' | 'all';
const ORDER = { overdue: 0, due: 1, paid: 2, void: 3 };

export function Money({ id, state, onDone }: { id: string; state: LiveState; onDone: () => void }) {
  const [show, setShow] = useState<Show>('unpaid');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const invoices = state.invoices ?? [];
  const quotes = state.quotes ?? [];
  const of = (...s: LiveInvoice['status'][]) => invoices.filter((i) => s.includes(i.status));
  const shown = (show === 'all' ? invoices : show === 'unpaid' ? of('due', 'overdue') : of(show)).slice().sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.issued.localeCompare(a.issued));
  const total = (xs: LiveInvoice[]) => money(xs.reduce((n, i) => n + i.amount_pence, 0));
  const toggle = (ref: string) => setOpen(open === ref ? null : ref);
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
  const waiting = quotes.filter((q) => q.status === 'sent').length;
  return (
    <div className="compliance rp-view rp-money">
      <h3 className="sub">Quotes {quotes.length ? <span className="muted small">{quotes.length} out{waiting ? `, ${waiting} awaiting approval` : ''}</span> : null}</h3>
      {quotes.length ? (
        <>
          <Cols cols={['Quote', 'For', 'Amount', 'State']} />
          <ul className="rp-list rp-quotes" aria-label="Quotes">
            {quotes.map((q) => <QuoteRow key={q.reference} q={q} open={open === q.reference} onToggle={() => toggle(q.reference)} />)}
          </ul>
        </>
      ) : <p className="empty">No quotes out.</p>}
      <h3 className="sub">Invoices</h3>
      <div className="rp-tools">
        <Chips
          label="Show invoices"
          value={show}
          onChange={setShow}
          chips={[
            { key: 'unpaid', label: 'Unpaid', n: total(of('due', 'overdue')) },
            { key: 'overdue', label: 'Overdue', n: total(of('overdue')) },
            { key: 'due', label: 'Due', n: total(of('due')) },
            { key: 'paid', label: 'Paid', n: total(of('paid')) },
            { key: 'all', label: 'All', n: invoices.length },
          ]}
        />
      </div>
      {shown.length ? (
        <>
          <Cols cols={['Invoice', 'For', 'Amount', 'State', '']} className="rp-with-acts" />
          <ul className="rp-list rp-with-acts" aria-label="Invoices">
            {shown.map((i) => (
              <InvoiceRow key={i.reference} i={i} open={open === i.reference} onToggle={() => toggle(i.reference)}>
                {i.status === 'due' || i.status === 'overdue' ? (
                  <>
                    <button type="button" className="small" disabled={busy} aria-label={`Remind about ${i.reference}`} onClick={() => act(i.reference, 'remind')}>Remind</button>
                    <button type="button" className="small" disabled={busy} aria-label={`${i.reference} paid by bank`} onClick={() => act(i.reference, 'paid_bank')}>Paid by bank</button>
                  </>
                ) : null}
              </InvoiceRow>
            ))}
          </ul>
        </>
      ) : <p className="empty">{show === 'unpaid' ? 'Nothing unpaid.' : 'No invoices here.'} Choose All to see every invoice.</p>}
    </div>
  );
}

/** The column names over a list, for the eye only: each row says the same in words. */
function Cols({ cols: [ref, what, ...rest], className = '' }: { cols: string[]; className?: string }) {
  return (
    <div className={`rp-cols ${className}`} aria-hidden="true">
      <span className="rp-mmain"><span>{ref}</span><span>{what}</span></span>
      {rest.map((c, n) => <span key={n}>{c}</span>)}
    </div>
  );
}

/** One quote or invoice: the reference opens what the row leaves out. */
function Row({ reference, date, what, where, amount, badge, note, actions, details, open, onToggle }: {
  reference: string; date: string; what: string; where: string; amount: string; badge: { label: string; level: string }; note?: string;
  actions?: ReactNode; details: [string, ReactNode][]; open: boolean; onToggle: () => void;
}) {
  const fold = useId();
  return (
    <li className={open ? 'open' : ''}>
      <div className="rp-mrow">
        <span className="rp-mmain">
          <button type="button" className="rp-ref" aria-expanded={open} aria-controls={fold} onClick={onToggle}>
            <b>{reference}</b><span className="muted small">{date}</span>
          </button>
          <span className="rp-what">
            <span className="rp-one" title={what}>{what}</span>
            <span className="rp-one muted small" title={where}>{where}</span>
          </span>
        </span>
        <span className="rp-amt">{amount}</span>
        <span className="rp-state">
          <span className={`badge ${badge.level}`}>{badge.label}</span>
          {note ? <span className="muted small">{note}</span> : null}
        </span>
        {actions !== undefined ? <span className="rp-acts">{actions}</span> : null}
      </div>
      {open ? (
        <dl id={fold} className="facts-list rp-fold">
          {details.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}
        </dl>
      ) : null}
    </li>
  );
}

function QuoteRow({ q, open, onToggle }: { q: LiveQuote; open: boolean; onToggle: () => void }) {
  const details: [string, ReactNode][] = [
    ['For', q.description],
    ...(q.address ? [['Address', q.address] as [string, ReactNode]] : []),
    ...(q.client ? [['Client', q.client] as [string, ReactNode]] : []),
    ...(q.job_ref ? [['Job', q.job_ref] as [string, ReactNode]] : []),
    ['Sent', `${day(q.issued)}${q.valid_until ? `, good until ${day(q.valid_until)}` : ''}`],
    ...(q.decided_by || q.decided_at ? [['Decided', `${QUOTE[q.status].label}${q.decided_by ? ` by ${q.decided_by}` : ''}${q.decided_at ? `, ${day(q.decided_at)}` : ''}`] as [string, ReactNode]] : []),
  ];
  return (
    <Row
      reference={q.reference} date={day(q.issued)} what={work(q.description, q.address)}
      where={[shortPlace(q.address), q.client].filter(Boolean).join(' · ')}
      amount={money(q.amount_pence)} badge={QUOTE[q.status]} note={q.decided_by ? `by ${q.decided_by}` : undefined}
      details={details} open={open} onToggle={onToggle}
    />
  );
}

function InvoiceRow({ i, open, onToggle, children }: { i: LiveInvoice; open: boolean; onToggle: () => void; children: ReactNode }) {
  const paid = `${i.paid_how === 'card' ? `Demo card …${i.card_last4}` : 'Bank transfer'}${i.paid_at ? `, ${day(i.paid_at)}` : ''}`;
  const details: [string, ReactNode][] = [
    ['For', `${i.description}${i.kind === 'callout' ? ' (call-out)' : ''}`],
    ...(i.client ? [['Client', i.client] as [string, ReactNode]] : []),
    ['Payer', `${i.payer.name ?? 'Not on file'}${i.payer.phone ? ` · ${i.payer.phone}` : ''}`],
    ...(i.job_ref ? [['Job', i.job_ref] as [string, ReactNode]] : []),
    ['Sent', `${day(i.issued)}, due ${day(i.due)}`],
    ...(i.status === 'paid' ? [['Paid', paid] as [string, ReactNode]] : []),
  ];
  return (
    <Row
      reference={i.reference} date={day(i.issued)} what={work(i.description, i.address)}
      where={[shortPlace(i.address), i.client ?? i.payer.name, i.kind === 'callout' ? 'call-out' : ''].filter(Boolean).join(' · ')}
      amount={money(i.amount_pence)} badge={INVOICE[i.status]} note={i.status === 'paid' ? paid : `Due ${day(i.due)}`}
      actions={children} details={details} open={open} onToggle={onToggle}
    />
  );
}
