// An estate agency's homes: a small card each with a drawn house (no
// photos), the price, status, days on the market, this week's viewings, open
// offers and how many of its Part A facts are in. Manage opens a panel over
// the list (the cards keep their places) that changes the status or price,
// blocks dates, marks a fact as being checked, sets best and final, and says
// whether viewings go on after a sale is agreed.

import { useEffect, useRef, useState } from 'react';
import { CHECKS } from '../../../../src/domain/listings.ts';
import { CHECK_KEYS, type HomeType, type ListingStatus } from '../../../../src/domain/types.ts';
import { demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import type { LiveListing, LiveState } from '../types.ts';
import { QUALIFIER, STATUS, pounds, when } from './estate.ts';
import './estate-office.css';

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
  const tz = state.tenant.timezone;
  const managed = listings.find((l) => l.key === open);
  return (
    <>
      <div className="homes">
        {listings.map((l) => <HomeCard key={l.key} l={l} tz={tz} open={open === l.key} onManage={() => setOpen(l.key)} />)}
      </div>
      {managed ? <ManageHome key={managed.key} id={id} l={managed} tz={tz} onClose={() => setOpen(null)} onDone={onDone} /> : null}
    </>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const describe = (l: LiveListing) => `${l.home}${l.town ? `, ${l.town}` : ''}`;

function HomeCard({ l, tz, open, onManage }: { l: LiveListing; tz: string; open: boolean; onManage: () => void }) {
  const s = STATUS[l.status];
  const partA = 4 - l.part_a_missing.length;
  const flags = [
    l.personal_interest ? <span key="pi" className="badge warn">Personal interest</span> : null,
    l.best_final_at ? <span key="bf" className="badge warn">Best and final {when(l.best_final_at, tz)}</span> : null,
    ...l.checking.map((c) => <span key={`ck-${c}`} className="badge info">Checking: {factName(c)}</span>),
    ...l.blocked.map((b, i) => <span key={`bl-${i}`} className="badge">No viewings {b.from}{b.to !== b.from ? ` to ${b.to}` : ''}{b.note ? ` (${b.note})` : ''}</span>),
    l.status === 'sale_agreed' && !l.marketing_continues ? <span key="nv" className="badge">No more viewings</span> : null,
    l.back_on_market_at ? <span key="bm" className="badge info">Back on the market</span> : null,
  ].filter(Boolean);

  return (
    <article className={`home-card ${open ? 'managing' : ''}`} aria-label={l.address}>
      <div className="home-top">
        <div className="home-pic">
          <House type={l.type} />
          {l.example ? <span className="example">example</span> : null}
        </div>
        <header>
          <b title={l.address}>{l.address}</b>
          <span className="home-price"><b>{pounds(l.price_pence)}</b> <span className="muted small">{QUALIFIER[l.qualifier]}</span></span>
        </header>
      </div>
      <p className="home-desc muted" title={describe(l)}>{describe(l)}</p>
      <div className="home-stats">
        <span className={`badge ${s.badge}`}>{s.label}</span>
        <span>{plural(l.days_on_market, 'day')} on the market</span>
        <span>{plural(l.viewings_week, 'viewing')} this week</span>
        <span>{plural(l.offers, 'open offer')}</span>
        {l.negotiator ? <span title="Negotiator">{l.negotiator.split(' ')[0]}</span> : null}
      </div>
      {flags.length ? <div className="badges">{flags}</div> : null}
      <div className="home-foot">
        <div className="home-meter" title={l.part_a_missing.length ? `Missing: ${l.part_a_missing.join(', ')}` : 'Price, tenure, council tax band and EPC'}>
          <span className="small muted">Part A</span>
          <span className="meter-track"><span className={`meter-fill ${partA === 4 ? 'ok' : 'warn'}`} style={{ width: `${partA * 25}%` }} /></span>
          <span className="small">{partA}/4{l.unknown ? ` · ${l.unknown} unknown` : ''}</span>
        </div>
        <button type="button" className="small" aria-haspopup="dialog" aria-label={`Manage ${l.address}`} onClick={onManage}>Manage</button>
      </div>
    </article>
  );
}

/**
 * Everything Manage can change, in a panel over the list: a modal dialog, so
 * Escape closes it and focus stays inside until it does, then goes back to
 * the card's Manage button. The outcome of each change shows in the panel as
 * well as in a toast, which sits behind it.
 */
function ManageHome({ id, l, tz, onClose, onDone }: { id: string; l: LiveListing; tz: string; onClose: () => void; onDone: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const back = useRef<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const [price, setPrice] = useState(String(Math.round(l.price_pence / 100)));
  // The panel stays open through Reset and other changes: the box follows the live price.
  useEffect(() => setPrice(String(Math.round(l.price_pence / 100))), [l.price_pence]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fact, setFact] = useState('');
  const [deadline, setDeadline] = useState('');
  const s = STATUS[l.status];

  useEffect(() => {
    const d = dialog.current;
    // Development runs effects twice: open once, and remember what had focus before it opened.
    if (!d || d.open) return;
    back.current = document.activeElement as HTMLElement | null;
    d.showModal();
  }, []);
  const closed = () => {
    onClose();
    back.current?.focus();
  };

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await demoApi<{ message: string; affected?: string[] }>(`/workspaces/${id}/listings/${l.key}`, { method: 'PATCH', json: body });
      const text = r.affected?.length ? `${r.message} ${r.affected.join('; ')}.` : r.message;
      toast(text);
      setSaid(text);
      onDone();
    } catch (e) {
      toast((e as Error).message);
      setSaid((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialog} className="home-sheet" aria-labelledby={`hm-${l.key}`} onClose={closed}>
      <header className="sheet-head">
        <House type={l.type} />
        <div>
          <h3 id={`hm-${l.key}`}>{l.address}</h3>
          <p className="muted small">{describe(l)} · ref {l.ref}</p>
        </div>
        <button type="button" className="ghost" aria-label="Close" onClick={() => dialog.current?.close()}>✕</button>
      </header>
      <p className="sheet-now">
        <b>{pounds(l.price_pence)}</b> <span className="muted small">{QUALIFIER[l.qualifier]}</span>
        <span className={`badge ${s.badge}`}>{s.label}</span>
        <span className="muted small">{plural(l.days_on_market, 'day')} on the market</span>
      </p>
      <p className="sheet-said small" role="status">{said}</p>

      <div className="sheet-field">
        <label htmlFor={`st-${l.key}`}>Status</label>
        <select id={`st-${l.key}`} value={l.status} disabled={busy} onChange={(e) => act({ action: 'status', status: e.target.value as ListingStatus })}>
          {(Object.keys(STATUS) as ListingStatus[]).map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
        </select>
        <p className="hint">Sale agreed normally comes from accepting an offer.</p>
      </div>

      <div className="sheet-field">
        <label htmlFor={`pr-${l.key}`}>Price £</label>
        <div className="sheet-row">
          <input id={`pr-${l.key}`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
          <button type="button" className="small" disabled={busy || Number(price.replace(/[£,\s]/g, '')) * 100 === l.price_pence} onClick={() => act({ action: 'price', price_pence: Math.round(Number(price.replace(/[£,\s]/g, '')) * 100) })}>Change price</button>
        </div>
      </div>

      <fieldset className="sheet-field">
        <legend>No viewings</legend>
        <div className="sheet-row">
          <input type="date" aria-label="From" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" aria-label="To" value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="button" className="small" disabled={busy || !from} onClick={() => act({ action: 'block', from, to: to || from })}>Block</button>
        </div>
        {l.blocked.map((b, i) => (
          <div className="sheet-item small" key={i}>
            <span>{b.from}{b.to !== b.from ? ` to ${b.to}` : ''}{b.note ? ` (${b.note})` : ''}</span>
            <button type="button" className="ghost small" disabled={busy} onClick={() => act({ action: 'unblock', index: i })}>Open again</button>
          </div>
        ))}
      </fieldset>

      <div className="sheet-field">
        <label htmlFor={`ck-${l.key}`}>Being checked</label>
        <div className="sheet-row">
          <select id={`ck-${l.key}`} value={fact} onChange={(e) => setFact(e.target.value)}>
            <option value="">Choose a fact…</option>
            {FACTS.filter(([k]) => !l.checking.includes(k)).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <button type="button" className="small" disabled={busy || !fact} onClick={() => { void act({ action: 'checking', fact }); setFact(''); }}>Mark</button>
        </div>
        {l.checking.map((c) => (
          <div className="sheet-item small" key={c}>
            <span>{factName(c)}: the receptionist says it is being checked</span>
            <button type="button" className="ghost small" disabled={busy} onClick={() => act({ action: 'checking', fact: c, on: false })}>Checked</button>
          </div>
        ))}
      </div>

      <div className="sheet-field">
        <label htmlFor={`bf-${l.key}`}>Best and final by</label>
        <div className="sheet-row">
          <input id={`bf-${l.key}`} type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          <button type="button" className="small" disabled={busy || !deadline} onClick={() => act({ action: 'best_final', date: deadline.slice(0, 10), time: deadline.slice(11, 16) })}>Set</button>
          {l.best_final_at ? <button type="button" className="ghost small" disabled={busy} onClick={() => act({ action: 'best_final', at: null })}>Clear</button> : null}
        </div>
        {l.best_final_at ? <p className="hint">Now set for {when(l.best_final_at, tz)}.</p> : null}
      </div>

      {l.status === 'sale_agreed' ? (
        <label className="tiny-toggle sheet-toggle">
          <input type="checkbox" checked={l.marketing_continues} disabled={busy} onChange={(e) => act({ action: 'viewings_continue', on: e.target.checked })} />
          Viewings continue while the sale goes through
        </label>
      ) : null}

      {l.history.length ? (
        <details className="history">
          <summary>History ({l.history.length})</summary>
          <ol>{l.history.map((h, i) => <li key={i}><span className="muted small">{when(h.at, tz)}</span> {h.what}</li>)}</ol>
        </details>
      ) : null}
    </dialog>
  );
}
