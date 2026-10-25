// An estate agency's sales in progress, from the offer accepted to the keys:
// a card per sale with its eight milestones (click to tick), the target
// exchange and completion dates, the parties, the chain, and an updates log.
// Completed: release keys works only on or after the completion date; Fell
// through asks why, and whether the home goes back on the market.

import { useState } from 'react';
import { demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import type { LiveSale, LiveState } from '../types.ts';
import { pounds, when } from './estate.ts';

const STEPS: Record<string, string> = {
  memorandum_sent: 'Memorandum', solicitors_instructed: 'Solicitors', searches: 'Searches', survey: 'Survey',
  mortgage_offer: 'Mortgage offer', enquiries_answered: 'Enquiries', exchange: 'Exchange', completion: 'Completion',
};
const STATUS: Record<LiveSale['status'], { label: string; badge: string }> = {
  progressing: { label: 'Progressing', badge: 'warn' }, exchanged: { label: 'Exchanged', badge: 'ok' },
  completed: { label: 'Completed', badge: '' }, fell_through: { label: 'Fell through', badge: 'bad' },
};
const ROLE: Record<string, string> = { buyer_solicitor: "Buyer's solicitor", seller_solicitor: "Seller's solicitor", chain_agent: 'Agent in the chain', broker: 'Broker' };
const FROM: Record<string, string> = { staff: 'Us', buyer_solicitor: "Buyer's solicitor", seller_solicitor: "Seller's solicitor", chain_agent: 'Chain agent', buyer: 'Buyer', seller: 'Seller', receptionist: 'AI receptionist' };

export function Sales({ id, state, onDone }: { id: string; state: LiveState; onDone: () => void }) {
  const sales = state.sales ?? [];
  if (!sales.length) return <p className="empty">No sales yet. Accepting an offer opens one.</p>;
  const open = sales.filter((x) => x.status === 'progressing' || x.status === 'exchanged');
  const closed = sales.filter((x) => !open.includes(x));
  return (
    <div className="sales">
      {open.map((x) => <SaleCard key={x.id} id={id} x={x} today={state.today} tz={state.tenant.timezone} onDone={onDone} />)}
      {closed.length ? <h3 className="muted small">Completed and fallen through</h3> : null}
      {closed.map((x) => <SaleCard key={x.id} id={id} x={x} today={state.today} tz={state.tenant.timezone} onDone={onDone} />)}
    </div>
  );
}

function SaleCard({ id, x, today, tz, onDone }: { id: string; x: LiveSale; today: string; tz: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [exchange, setExchange] = useState(x.exchange_target ?? '');
  const [completion, setCompletion] = useState(x.completion_date ?? '');
  const [note, setNote] = useState('');
  const [from, setFrom] = useState('seller_solicitor');
  const live = x.status === 'progressing' || x.status === 'exchanged';
  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await demoApi<{ message: string }>(`/workspaces/${id}/sales/${x.id}`, { method: 'PATCH', json: body });
      toast(r.message);
      onDone();
      return true;
    } catch (e) {
      toast((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const fellThrough = async () => {
    const reason = prompt(`Why did the sale of ${x.home} fall through?`);
    if (!reason?.trim()) return;
    const back = confirm('Does the seller want it back on the market? Its back-up buyers and the buyers whose search it fits will be texted.');
    await act({ action: 'fell_through', reason, back_on_market: back });
  };
  const keysDue = Boolean(x.completion_date && x.completion_date <= today);
  const st = STATUS[x.status];
  return (
    <article className={`sale ${live ? '' : 'done'}`} aria-label={`Sale of ${x.home}`}>
      <header>
        <b>{x.home}</b>
        <span className={`badge ${st.badge}`}>{st.label}</span>
      </header>
      <span className="small">{x.buyer_name} · {x.buyer_phone} · agreed {pounds(x.agreed_pence)}</span>
      <ol className="milestones">
        {x.milestones.map((m) => (
          <li key={m.key}>
            <button
              type="button" className={`step ${m.done_at ? 'on' : ''}`} aria-pressed={Boolean(m.done_at)}
              disabled={busy || !live || m.key === 'completion'} title={m.key === 'completion' ? 'Recorded with Completed: release keys' : m.done_at ? `Done ${when(m.done_at, tz)}` : 'Not done yet'}
              onClick={() => act({ action: 'milestone', key: m.key, done: !m.done_at })}
            >{m.done_at ? '✓ ' : ''}{STEPS[m.key] ?? m.key}</button>
          </li>
        ))}
      </ol>
      {live ? (
        <form className="field-row sale-dates" onSubmit={(e) => { e.preventDefault(); void act({ action: 'dates', exchange_target: exchange || null, completion_date: completion || null }); }}>
          <label className="small">Exchange <input type="date" value={exchange} onChange={(e) => setExchange(e.target.value)} /></label>
          <label className="small">Completion <input type="date" value={completion} onChange={(e) => setCompletion(e.target.value)} /></label>
          <button type="submit" className="small" disabled={busy}>Save dates</button>
        </form>
      ) : (
        <span className="small muted">{x.keys_released_at ? `Keys released ${when(x.keys_released_at, tz)}` : x.completion_date ? `Completion ${x.completion_date}` : ''}</span>
      )}
      {x.parties.length ? (
        <ul className="parties small">
          {x.parties.map((p) => <li key={`${p.role}${p.name}`}><span className="muted">{ROLE[p.role] ?? p.role}:</span> {p.name}{p.firm && p.firm !== p.name ? `, ${p.firm}` : ''}{p.phone ? ` · ${p.phone}` : ''}</li>)}
        </ul>
      ) : null}
      {x.chain ? <span className="small">Chain: {x.chain}</span> : null}
      {x.updates.length ? (
        <ul className="updates small">
          {[...x.updates].reverse().slice(0, 4).map((u) => <li key={`${u.at}${u.what}`}><span className="muted">{when(u.at, tz)} · {FROM[u.by] ?? u.by}:</span> {u.what}</li>)}
        </ul>
      ) : null}
      {live ? (
        <>
          <form className="field-row" onSubmit={async (e) => { e.preventDefault(); if (note.trim() && await act({ action: 'update', from, what: note })) setNote(''); }}>
            <select aria-label="Update from" value={from} onChange={(e) => setFrom(e.target.value)}>
              {Object.entries(FROM).filter(([k]) => k !== 'receptionist').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input aria-label="The update" placeholder="Searches back; no issues" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
            <button type="submit" className="small" disabled={busy || !note.trim()}>Log it</button>
          </form>
          <div className="row-tools">
            <button type="button" className="small primary" disabled={busy || !keysDue} title={keysDue ? 'The buyer is texted that the keys are ready' : 'Only on or after the completion date'} onClick={() => act({ action: 'release_keys' })}>Completed: release keys</button>
            {x.status === 'progressing' ? <button type="button" className="ghost small" disabled={busy} onClick={fellThrough}>Fell through</button> : null}
          </div>
        </>
      ) : null}
    </article>
  );
}
