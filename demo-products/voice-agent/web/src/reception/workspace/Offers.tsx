// An estate agency's offers in three columns: received, sent to the
// seller, decided. An offer not yet sent shows how long it has waited (amber
// after a day, red at two working days). Each action texts the buyer; accepting
// asks whether viewings go on, makes the home sale agreed and opens a sale.

import { useState } from 'react';
import { demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import type { Nation } from '../../../../src/domain/types.ts';
import type { LiveOffer, LiveState } from '../types.ts';
import { OFFER_STATUS, pounds, positionBadges, waited, when } from './estate.ts';

const COLUMNS: { label: string; has: (o: LiveOffer) => boolean }[] = [
  { label: 'Received', has: (o) => o.status === 'received' },
  { label: 'Sent to seller', has: (o) => o.status === 'sent' },
  { label: 'Decided', has: (o) => !['received', 'sent'].includes(o.status) },
];

const FLAGS: Record<string, string> = {
  connected: 'Connected to the agency',
  company: 'Buying as a company',
  gifted_deposit: 'Gifted deposit',
  viewed_elsewhere: 'Viewed with another agent: possible double fee',
};

export function Offers({ id, state, nowMs, onDone }: { id: string; state: LiveState; nowMs: number; onDone: () => void }) {
  const offers = state.offers ?? [];
  if (!offers.length) return <p className="empty">No offers yet. The receptionist records them on the phone.</p>;
  return (
    <div className="kitchen offers">
      {COLUMNS.map((c) => {
        const mine = offers.filter(c.has).sort((a, b) => (b.decided_at ?? b.sent_at ?? b.received_at).localeCompare(a.decided_at ?? a.sent_at ?? a.received_at));
        return (
          <section key={c.label} className="k-col" aria-label={c.label}>
            <h3>{c.label} <span className="count">{mine.length}</span></h3>
            {mine.map((o) => <OfferCard key={o.reference} id={id} o={o} nowMs={nowMs} nation={state.nation ?? 'england'} tz={state.tenant.timezone} onDone={onDone} />)}
            {!mine.length ? <p className="empty">Nothing here.</p> : null}
          </section>
        );
      })}
    </div>
  );
}

function OfferCard({ id, o, nowMs, nation, tz, onDone }: { id: string; o: LiveOffer; nowMs: number; nation: Nation; tz: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [viewings, setViewings] = useState(true);
  const open = o.status === 'received' || o.status === 'sent';
  const wait = o.status === 'received' ? waited(o.received_at, nowMs, nation, tz) : null;
  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await demoApi<{ message: string }>(`/workspaces/${id}/offers/${o.reference}`, { method: 'PATCH', json: body });
      toast(r.message.includes(o.home) ? r.message : `${o.home}: ${r.message}`);
      setAccepting(false);
      onDone();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const flags = [...o.flags.map((f) => FLAGS[f] ?? f), ...(o.revises ? [`Revises ${o.revises}`] : [])];

  return (
    <article className="ticket offer" aria-label={`Offer ${o.reference}`}>
      <header>
        <span className="ref">{pounds(o.amount_pence)}</span>
        {wait ? <span className={`due ${wait.level === 'bad' ? 'late' : wait.level}`}>{wait.text}</span> : <span className="muted small">{OFFER_STATUS[o.status]}</span>}
      </header>
      <div><b>{o.home}</b></div>
      <div className="muted small">{o.buyer_names.join(' and ') || 'A buyer'}{o.phone ? ` · ${o.phone}` : ''} · ref {o.reference}</div>
      <div className="badges">
        {o.seller_replied ? <span className="badge bad" title="The seller left a message about this home on a call: read it in Messages, then act here.">Seller replied by phone</span> : null}
        {positionBadges(o.position).map((b) => <span key={b} className="badge">{b}</span>)}
        {flags.map((f) => <span key={f} className="badge warn">{f}</span>)}
      </div>
      {o.conditions ? <div className="small">Conditions: {o.conditions}</div> : null}
      <div className="muted small">
        Received {when(o.received_at, tz)}{o.source === 'seed' ? '' : ' by the AI receptionist'}
        {o.sent_at ? ` · sent ${when(o.sent_at, tz)}` : ''}{o.decided_at ? ` · ${OFFER_STATUS[o.status].toLowerCase()} ${when(o.decided_at, tz)}` : ''}
      </div>
      {o.note ? <div className="small">Note: {o.note}</div> : null}
      {open ? (
        accepting ? (
          <div className="accept-box">
            <label className="tiny-toggle">
              <input type="checkbox" checked={viewings} onChange={(e) => setViewings(e.target.checked)} />
              The seller wants viewings to continue
            </label>
            <div className="row-tools">
              <button type="button" className="small primary" disabled={busy} onClick={() => act({ action: 'accept', viewings_continue: viewings })}>Confirm: seller accepts</button>
              <button type="button" className="ghost small" onClick={() => setAccepting(false)}>Back</button>
            </div>
          </div>
        ) : (
          <footer className="offer-actions">
            {o.status === 'received' ? <button type="button" className="small primary" disabled={busy} onClick={() => act({ action: 'sent' })}>Sent to seller</button> : null}
            <button type="button" className="small" disabled={busy} onClick={() => setAccepting(true)}>Seller accepts</button>
            <button type="button" className="small" disabled={busy} onClick={() => act({ action: 'decline' })}>Seller declines</button>
            <button type="button" className="small" disabled={busy} onClick={() => {
              const note = prompt('What did the seller come back with? (for your notes; the buyer hears that the negotiator will call)');
              if (note !== null) void act({ action: 'counter', note });
            }}>Seller counters</button>
            <button type="button" className="ghost small" disabled={busy} onClick={() => confirm('Mark this offer withdrawn? The buyer gets a text.') && act({ action: 'withdraw' })}>Withdrawn</button>
          </footer>
        )
      ) : null}
    </article>
  );
}
