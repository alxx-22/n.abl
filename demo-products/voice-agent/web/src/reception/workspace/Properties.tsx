// An estate agency's homes: a card each with a drawn house (no photos),
// the price, status, days on the market, this week's viewings, open offers
// and how many of its Part A facts are in. Manage changes the status or
// price, blocks dates, marks a fact as being checked, sets best and final,
// and says whether viewings go on after a sale is agreed.

import { useState } from 'react';
import { CHECKS } from '../../../../src/domain/listings.ts';
import { CHECK_KEYS, type HomeType, type ListingStatus } from '../../../../src/domain/types.ts';
import { demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import type { LiveListing, LiveState } from '../types.ts';
import { QUALIFIER, STATUS, pounds, when } from './estate.ts';

/** A home drawn by its type: a block of flats, a bungalow, a row of houses. */
function House({ type }: { type: HomeType }) {
  const flat = type === 'flat' || type === 'maisonette';
  const low = type === 'bungalow';
  const row = type === 'terraced' || type === 'end_terrace' ? 3 : type === 'semi' ? 2 : 1;
  return (
    <svg viewBox="0 0 120 70" className="house" aria-hidden="true">
      <line x1="4" y1="66" x2="116" y2="66" className="ground" />
      {flat ? (
        <g>
          <rect x="38" y="10" width="44" height="56" className="wall" />
          {[18, 30, 42].map((y) => [44, 58, 72].map((x) => <rect key={`${x}-${y}`} x={x - 3} y={y} width="8" height="7" className="window" />))}
          <rect x="56" y="54" width="8" height="12" className="door" />
        </g>
      ) : (
        Array.from({ length: row }, (_, i) => {
          const w = low ? 70 : row === 1 ? 46 : 34;
          const x = 60 - (w * row) / 2 + i * w;
          const top = low ? 40 : 30;
          return (
            <g key={i}>
              <polygon points={`${x},${top} ${x + w / 2},${top - (low ? 16 : 20)} ${x + w},${top}`} className="roof" />
              <rect x={x} y={top} width={w} height={66 - top} className="wall" />
              <rect x={x + w / 2 - 4} y={54} width="8" height="12" className="door" />
              <rect x={x + 5} y={top + 6} width="8" height="7" className="window" />
              <rect x={x + w - 13} y={top + 6} width="8" height="7" className="window" />
              {type === 'cottage' ? <rect x={x + w - 14} y={top - 22} width="6" height="12" className="wall" /> : null}
            </g>
          );
        })
      )}
    </svg>
  );
}

/** What can be marked as being checked: the checklist's items and the main facts. */
const FACTS: [string, string][] = [
  ['price', 'Price'], ['rooms', 'Room sizes'], ['tenure', 'Tenure'], ['lease', 'The lease'], ['local_tax', 'Council tax'], ['epc', 'EPC'],
  ...CHECK_KEYS.map((k) => [k, CHECKS[k].unknown.charAt(0).toUpperCase() + CHECKS[k].unknown.slice(1)] as [string, string]),
];
const factName = (k: string) => FACTS.find(([key]) => key === k)?.[1] ?? k.replace(/_/g, ' ');

export function Properties({ id, state, onDone }: { id: string; state: LiveState; onDone: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const listings = state.listings ?? [];
  if (!listings.length) return <p className="empty">No homes yet. Add them in the setup’s “Listings”.</p>;
  return (
    <div className="homes">
      {listings.map((l) => <HomeCard key={l.key} id={id} l={l} open={open === l.key} onToggle={() => setOpen(open === l.key ? null : l.key)} onDone={onDone} />)}
    </div>
  );
}

function HomeCard({ id, l, open, onToggle, onDone }: { id: string; l: LiveListing; open: boolean; onToggle: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [price, setPrice] = useState(String(Math.round(l.price_pence / 100)));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fact, setFact] = useState('');
  const [deadline, setDeadline] = useState('');
  const s = STATUS[l.status];
  const partA = 4 - l.part_a_missing.length;
  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await demoApi<{ message: string; affected?: string[] }>(`/workspaces/${id}/listings/${l.key}`, { method: 'PATCH', json: body });
      toast(r.affected?.length ? `${r.message} ${r.affected.join('; ')}.` : r.message);
      onDone();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`home-card ${open ? 'open' : ''}`} aria-label={l.address}>
      <div className="home-pic">
        <House type={l.type} />
        {l.example ? <span className="example">example</span> : null}
      </div>
      <div className="home-body">
        <header>
          <b>{l.address}</b>
          <span className={`badge ${s.badge}`}>{s.label}</span>
        </header>
        <div className="muted small">{l.home}{l.town ? `, ${l.town}` : ''}</div>
        <div className="home-price"><b>{pounds(l.price_pence)}</b> <span className="muted small">{QUALIFIER[l.qualifier]}</span></div>
        <div className="home-stats small">
          <span>{l.days_on_market} day{l.days_on_market === 1 ? '' : 's'} on the market</span>
          <span>{l.viewings_week} viewing{l.viewings_week === 1 ? '' : 's'} this week</span>
          <span>{l.offers} open offer{l.offers === 1 ? '' : 's'}</span>
          {l.negotiator ? <span>{l.negotiator.split(' ')[0]}</span> : null}
        </div>
        <div className="home-meter" title={l.part_a_missing.length ? `Missing: ${l.part_a_missing.join(', ')}` : 'Price, tenure, council tax band and EPC'}>
          <span className="small muted">Part A</span>
          <span className="meter-track"><span className={`meter-fill ${partA === 4 ? 'ok' : 'warn'}`} style={{ width: `${partA * 25}%` }} /></span>
          <span className="small">{partA}/4{l.unknown ? ` · ${l.unknown} unknown` : ''}</span>
        </div>
        <div className="badges">
          {l.personal_interest ? <span className="badge warn">Personal interest</span> : null}
          {l.best_final_at ? <span className="badge warn">Best and final {when(l.best_final_at)}</span> : null}
          {l.checking.map((c) => <span key={c} className="badge info">Checking: {factName(c)}</span>)}
          {l.blocked.map((b, i) => <span key={i} className="badge">No viewings {b.from}{b.to !== b.from ? ` to ${b.to}` : ''}{b.note ? ` (${b.note})` : ''}</span>)}
          {l.status === 'sale_agreed' && !l.marketing_continues ? <span className="badge">No more viewings</span> : null}
          {l.back_on_market_at ? <span className="badge info">Back on the market</span> : null}
        </div>
        <button type="button" className="small" aria-expanded={open} onClick={onToggle}>{open ? 'Close' : 'Manage'}</button>
        {open ? (
          <div className="home-manage">
            <div className="field-row">
              <label className="small" htmlFor={`st-${l.key}`}>Status</label>
              <select id={`st-${l.key}`} value={l.status} disabled={busy} onChange={(e) => act({ action: 'status', status: e.target.value as ListingStatus })}>
                {(Object.keys(STATUS) as ListingStatus[]).map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
              </select>
            </div>
            <p className="hint">Sale agreed normally comes from accepting an offer.</p>
            <div className="field-row">
              <label className="small" htmlFor={`pr-${l.key}`}>Price £</label>
              <input id={`pr-${l.key}`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
              <button type="button" className="small" disabled={busy || Number(price.replace(/[£,\s]/g, '')) * 100 === l.price_pence} onClick={() => act({ action: 'price', price_pence: Math.round(Number(price.replace(/[£,\s]/g, '')) * 100) })}>Change price</button>
            </div>
            <div className="field-row">
              <span className="small">No viewings</span>
              <input type="date" aria-label="From" value={from} onChange={(e) => setFrom(e.target.value)} />
              <input type="date" aria-label="To" value={to} onChange={(e) => setTo(e.target.value)} />
              <button type="button" className="small" disabled={busy || !from} onClick={() => act({ action: 'block', from, to: to || from })}>Block</button>
            </div>
            {l.blocked.map((b, i) => (
              <div className="field-row small" key={i}>
                <span>{b.from}{b.to !== b.from ? ` to ${b.to}` : ''}</span>
                <button type="button" className="ghost small" disabled={busy} onClick={() => act({ action: 'unblock', index: i })}>Open again</button>
              </div>
            ))}
            <div className="field-row">
              <label className="small" htmlFor={`ck-${l.key}`}>Being checked</label>
              <select id={`ck-${l.key}`} value={fact} onChange={(e) => setFact(e.target.value)}>
                <option value="">Choose a fact…</option>
                {FACTS.filter(([k]) => !l.checking.includes(k)).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
              <button type="button" className="small" disabled={busy || !fact} onClick={() => { void act({ action: 'checking', fact }); setFact(''); }}>Mark</button>
            </div>
            {l.checking.map((c) => (
              <div className="field-row small" key={c}>
                <span>{factName(c)}: the receptionist says it is being checked</span>
                <button type="button" className="ghost small" disabled={busy} onClick={() => act({ action: 'checking', fact: c, on: false })}>Checked</button>
              </div>
            ))}
            <div className="field-row">
              <label className="small" htmlFor={`bf-${l.key}`}>Best and final by</label>
              <input id={`bf-${l.key}`} type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              <button type="button" className="small" disabled={busy || !deadline} onClick={() => act({ action: 'best_final', at: new Date(deadline).toISOString() })}>Set</button>
              {l.best_final_at ? <button type="button" className="ghost small" disabled={busy} onClick={() => act({ action: 'best_final', at: null })}>Clear</button> : null}
            </div>
            {l.status === 'sale_agreed' ? (
              <label className="tiny-toggle">
                <input type="checkbox" checked={l.marketing_continues} disabled={busy} onChange={(e) => act({ action: 'viewings_continue', on: e.target.checked })} />
                Viewings continue while the sale goes through
              </label>
            ) : null}
            {l.history.length ? (
              <details className="history">
                <summary>History ({l.history.length})</summary>
                <ol>{l.history.map((h, i) => <li key={i}><span className="muted small">{when(h.at)}</span> {h.what}</li>)}</ol>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
