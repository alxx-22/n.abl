// An estate agency's valuations as a pipeline: booked, done, then the outcome
// (instructed, thinking with a follow-up date, or lost), three columns so they
// fit beside the call and the phone. A card has what the receptionist
// captured: the home, why and when they are moving, any agent they are with
// (a possible double fee), whether they need to buy, and who is selling.

import { useState } from 'react';
import { demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import type { LiveState, LiveValuation } from '../types.ts';
import { when } from './estate.ts';

const outcome = (v: LiveValuation) => (typeof v.details.outcome === 'string' ? v.details.outcome : null);

const COLUMNS: { label: string; has: (v: LiveValuation, now: string) => boolean }[] = [
  { label: 'Booked', has: (v, now) => !outcome(v) && v.ends_at > now },
  { label: 'Done', has: (v, now) => !outcome(v) && v.ends_at <= now },
  { label: 'Outcome', has: (v) => Boolean(outcome(v)) },
];
const OUTCOME: Record<string, { label: string; badge: string; order: number }> = {
  instructed: { label: 'Instructed', badge: 'ok', order: 0 },
  thinking: { label: 'Thinking', badge: 'warn', order: 1 },
  lost: { label: 'Lost', badge: 'bad', order: 2 },
};

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function Valuations({ id, state, onDone }: { id: string; state: LiveState; onDone: () => void }) {
  const all = state.valuations ?? [];
  if (!all.length) return <p className="empty">No valuations yet. The receptionist books them on the phone.</p>;
  return (
    <div className="kitchen offers valuations">
      {COLUMNS.map((c) => {
        const mine = all.filter((v) => c.has(v, state.now)).sort((a, b) =>
          c.label === 'Booked' ? a.starts_at.localeCompare(b.starts_at)
          : c.label === 'Outcome' ? (OUTCOME[outcome(a)!]?.order ?? 9) - (OUTCOME[outcome(b)!]?.order ?? 9)
          : b.starts_at.localeCompare(a.starts_at));
        return (
          <section key={c.label} className="k-col" aria-label={c.label}>
            <h3>{c.label} <span className="count">{mine.length}</span></h3>
            {mine.map((v) => <ValuationCard key={v.reference} id={id} v={v} tz={state.tenant.timezone} done={v.ends_at <= state.now} onDone={onDone} />)}
            {!mine.length ? <p className="empty">Nothing here.</p> : null}
          </section>
        );
      })}
    </div>
  );
}

function ValuationCard({ id, v, tz, done, onDone }: { id: string; v: LiveValuation; tz: string; done: boolean; onDone: () => void }) {
  const d = v.details;
  const [busy, setBusy] = useState(false);
  const set = async (outcome: string) => {
    const lost_to = outcome === 'lost' ? prompt('Lost to which agent? (optional)') ?? '' : undefined;
    setBusy(true);
    try {
      const r = await demoApi<{ message: string }>(`/workspaces/${id}/bookings/${v.reference}`, { method: 'PATCH', json: { action: 'outcome', outcome, lost_to } });
      toast(`${text(d.address) ?? 'Valuation'}: ${r.message}`);
      onDone();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const capacity = text(d.capacity);
  const purpose = text(d.purpose);
  const other = text(d.other_agent);
  return (
    <article className="ticket offer valuation">
      <b>{text(d.address) ?? 'A home'}{text(d.postcode) ? `, ${text(d.postcode)}` : ''}</b>
      <span className="muted small">{when(v.starts_at, tz)} · {v.valuer} · ref {v.reference}</span>
      <span>{v.name}{capacity && capacity !== 'owner' ? ` (${capacity})` : ''} · {v.phone}</span>
      {text(d.reason) || text(d.timescale) ? <span className="small">{[text(d.reason), text(d.timescale)].filter(Boolean).join(', ')}</span> : null}
      {other ? <span className="small">With {other}</span> : null}
      <div className="badges">
        {outcome(v) ? <span className={`badge ${OUTCOME[outcome(v)!]?.badge ?? ''}`}>{OUTCOME[outcome(v)!]?.label ?? outcome(v)}</span> : null}
        {d.hot ? <span className="badge ok">Hot</span> : null}
        {d.dual_fee ? <span className="badge warn">Possible double fee</span> : null}
        {d.needs_to_buy ? <span className="badge">Needs to buy</span> : null}
        {purpose && purpose !== 'sale' ? <span className="badge">{purpose}</span> : null}
      </div>
      {text(d.tone) ? <span className="small muted">{text(d.tone)}</span> : null}
      {outcome(v) === 'thinking' && text(d.follow_up) ? <span className="small">Follow up {when(`${text(d.follow_up)}T09:00:00Z`, tz).split(',')[0]}</span> : null}
      {outcome(v) === 'lost' && text(d.lost_to) ? <span className="small muted">Lost to {text(d.lost_to)}</span> : null}
      {done ? (
        <div className="row-tools">
          {(['instructed', 'thinking', 'lost'] as const).filter((o) => o !== outcome(v)).map((o) => (
            <button key={o} type="button" className="small" disabled={busy} onClick={() => set(o)}>{OUTCOME[o].label}</button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
