// The contractor's clients (presets/property-maintenance.md §6, M2): each
// agent, landlord and housing association, with its limit, its emergency
// authority, who approves work and on which phone, and what waits on them
// now: jobs and quotes for their yes or no, open jobs, and unpaid bills.
// The staff notes are for the office and never said to a caller. Each
// client is one row; who approves, the limits and what waits on them open
// in a panel over the list.

import { useState } from 'react';
import type { LiveClient, LiveState } from '../types.ts';
import { money } from './maintenance.ts';
import { Sheet } from './RepairsKit.tsx';

const KIND: Record<string, string> = { agent: 'Letting agent', landlord: 'Landlord', block: 'Block manager', social: 'Housing association', commercial: 'Business', insurer: 'Insurer' };
const NOTICE: Record<string, string> = { every_job: 'every job', over_limit: 'work over the limit', emergencies: 'emergencies' };

export function Clients({ state }: { state: LiveState }) {
  const [open, setOpen] = useState<string | null>(null);
  const clients = state.clients ?? [];
  if (!clients.length) return <p className="empty">No clients yet. Add them in the setup, under Who you work for.</p>;
  const opened = clients.find((c) => c.key === open);
  return (
    <div className="compliance rp-view rp-clients">
      <div className="rp-head">
        <p className="rp-showing muted small">Work over a client's limit waits for their contact to approve it on their own phone: pick it under Call as to see it.</p>
        <div className="rp-cols" aria-hidden="true"><span>Client</span><span>Homes and limit</span><span>What waits on them</span></div>
      </div>
      <ul className="rp-list">
        {clients.map((c) => {
          const jobs = (state.jobs ?? []).filter((j) => j.client === c.name);
          const waiting = jobs.filter((j) => j.status === 'awaiting_approval');
          const live = jobs.filter((j) => !['done', 'invoiced', 'cancelled', 'awaiting_approval'].includes(j.status));
          const owed = (state.invoices ?? []).filter((i) => i.client_key === c.key && (i.status === 'due' || i.status === 'overdue'));
          const late = owed.filter((i) => i.status === 'overdue');
          return (
            <li key={c.key}>
              <button type="button" className="rp-row" aria-haspopup="dialog" aria-expanded={open === c.key} onClick={() => setOpen(c.key)}>
                <span className="rp-one"><b>{c.name}</b></span>
                <span className="rp-two muted small"><span>{KIND[c.kind] ?? c.kind} · {c.properties} homes</span><span>up to {money(c.works_limit_pence)} without asking</span></span>
                <span className="badges">
                  {c.status === 'on_stop' ? <span className="badge bad">On stop</span> : null}
                  {waiting.length ? <span className="badge warn">{waiting.length} awaiting approval</span> : null}
                  {live.length ? <span className="badge">{live.length} open {live.length === 1 ? 'job' : 'jobs'}</span> : null}
                  {owed.length ? <span className={`badge ${late.length ? 'bad' : ''}`}>{money(owed.reduce((n, i) => n + i.amount_pence, 0))} owed{late.length ? `, ${late.length} overdue` : ''}</span> : null}
                  {c.po_required ? <span className="badge info">PO on every job</span> : null}
                  {c.status !== 'on_stop' && !waiting.length && !live.length && !owed.length ? <span className="muted small">Nothing waiting</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {opened ? <ClientDetail key={opened.key} c={opened} state={state} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function ClientDetail({ c, state, onClose }: { c: LiveClient; state: LiveState; onClose: () => void }) {
  const waiting = (state.jobs ?? []).filter((j) => j.client === c.name && j.status === 'awaiting_approval');
  const quotes = (state.quotes ?? []).filter((q) => q.client_key === c.key);
  return (
    <Sheet title={c.name} sub={`${KIND[c.kind] ?? c.kind} · ${c.properties} homes${c.status === 'on_stop' ? ' · on stop' : ''}`} onClose={onClose}>
      <dl className="facts-list">
        <dt>Approves</dt><dd>{c.contact.name || 'Nobody yet'}{c.contact.phone ? ` · ${c.contact.phone}` : ''}{c.contact.email ? ` · ${c.contact.email}` : ''}</dd>
        <dt>Limits</dt><dd>{money(c.works_limit_pence)} for a repair; {money(c.emergency_authority_pence)} to make an emergency safe out of hours</dd>
        <dt>Told about</dt><dd>{NOTICE[c.notice] ?? c.notice}</dd>
        {c.instructions ? <><dt>For staff</dt><dd>{c.instructions}</dd></> : null}
      </dl>
      {waiting.length ? (
        <section className="rp-sheet-part">
          <h4>Waiting for {c.contact.name || 'them'}</h4>
          <ul className="rp-waits">
            {waiting.map((j) => {
              const q = quotes.find((x) => x.job_ref === j.reference && x.status === 'sent');
              return <li key={j.reference}><b>{j.address}</b> · {j.description.replace(/: quote Q-\d+$/, '')} · {q ? `${q.reference}, ` : ''}{j.price_pence ? money(j.price_pence) : ''}</li>;
            })}
          </ul>
        </section>
      ) : <p className="small muted">Nothing waiting for their approval.</p>}
      {quotes.some((q) => q.status !== 'sent') ? (
        <p className="small muted">Decided: {quotes.filter((q) => q.status !== 'sent').map((q) => `${q.reference} ${q.status}${q.decided_by ? ` by ${q.decided_by}` : ''}`).join('; ')}.</p>
      ) : null}
    </Sheet>
  );
}
