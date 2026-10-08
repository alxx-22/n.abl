// An estate agency's buyers: one row each, newest contact first, with what
// they want, their position, whether they said yes to texts about new homes
// (and when), and how many homes on the market fit them now. A list of forty
// or more is read in passing between calls, so chips and a search narrow it
// to the few that matter now (the hot ones, the cash buyers, one area).
// Staff can mark one hot, text them the homes that fit (only with their yes),
// or stop their alerts.

import { useId, useState } from 'react';
import { demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import type { LiveBuyer, LiveState } from '../types.ts';
import { positionBadges, when } from './estate.ts';
import './estate-office.css';

type Filter = 'all' | 'alerts' | 'hot' | 'ftb' | 'cash' | 'chain';

/** The chips, in the badges' own rule: "we're cash" with a home to sell is a chain, not a cash buyer. */
const FILTERS: { key: Filter; label: string; has: (b: LiveBuyer) => boolean }[] = [
  { key: 'all', label: 'All', has: () => true },
  { key: 'alerts', label: 'Alerts on', has: (b) => b.alerts },
  { key: 'hot', label: 'Hot', has: (b) => b.hot },
  { key: 'ftb', label: 'First-time buyers', has: (b) => positionBadges(b.position ?? undefined).includes('FTB') },
  { key: 'cash', label: 'Cash', has: (b) => positionBadges(b.position ?? undefined).includes('Cash') },
  { key: 'chain', label: 'Chain', has: (b) => positionBadges(b.position ?? undefined).some((x) => x.startsWith('Chain')) },
];

/** A name, a phone number however it is typed (spaces, +44), or anything in what they want: an area, a type, a price. */
function found(b: LiveBuyer, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if ([b.name, b.wants, ...b.backup_for].some((s) => s?.toLowerCase().includes(q))) return true;
  const digits = q.replace(/\D/g, '').replace(/^44/, '0');
  return /^[\d\s+()-]+$/.test(q) && digits.length > 0 && b.phone.replace(/\D/g, '').includes(digits);
}

/** "£270k", "£1.25m": what they want, short enough for one line of a row. */
const shortPrices = (text: string) => text.replace(/£(\d{1,3}(?:,\d{3})+)/g, (_, n: string) => {
  const v = Number(n.replace(/,/g, ''));
  return v >= 1e6 ? `£${+(v / 1e6).toFixed(2)}m` : v >= 1e4 ? `£${+(v / 1e3).toFixed(1)}k` : `£${n}`;
});

/** "8 Oct, 14:05": the weekday is left out to keep the column narrow. */
const touchedOn = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone });

export function Applicants({ id, state, onDone }: { id: string; state: LiveState; onDone: () => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const searchId = useId();
  const buyers = [...(state.buyers ?? [])].sort((a, b) => (b.last_contact ?? '').localeCompare(a.last_contact ?? ''));
  if (!buyers.length) return <p className="empty">No buyers yet. The receptionist registers them on the phone.</p>;
  const tz = state.tenant.timezone;
  // The chips count within the search, so "Hot 2" means two of the buyers the search found.
  const searched = buyers.filter((b) => found(b, query));
  const chosen = FILTERS.find((f) => f.key === filter)!;
  const shown = searched.filter(chosen.has);

  return (
    <div className="applicants">
      <div className="ap-head">
        <div className="ap-tools">
          <div className="ap-chips" role="group" aria-label="Show">
            {FILTERS.map((f) => (
              <button
                key={f.key} type="button" className="ap-chip" aria-pressed={filter === f.key}
                onClick={() => setFilter(filter === f.key ? 'all' : f.key)}
              >{f.label} <span className="n">{searched.filter(f.has).length}</span></button>
            ))}
          </div>
          <div className="ap-search">
            <label htmlFor={searchId} className="visually-hidden">Search buyers</label>
            <input id={searchId} type="search" placeholder="Name, phone or area" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <p className="ap-showing muted small" aria-live="polite">
          {shown.length === buyers.length ? `${buyers.length} buyer${buyers.length === 1 ? '' : 's'}` : `Showing ${shown.length} of ${buyers.length} buyers`}, newest contact first
        </p>
        <div className="ap-cols" aria-hidden="true"><span>Buyer</span><span>Looking for</span><span>Last in touch</span></div>
      </div>
      {shown.length ? (
        <ul className="ap-list">
          {shown.map((b) => <BuyerRow key={b.phone} id={id} b={b} tz={tz} now={state.now} onDone={onDone} />)}
        </ul>
      ) : (
        <p className="empty">
          No buyers match.{' '}
          <button type="button" className="ghost small" onClick={() => { setFilter('all'); setQuery(''); }}>Show everyone</button>
        </p>
      )}
    </div>
  );
}

function BuyerRow({ id, b, tz, now, onDone }: { id: string; b: LiveBuyer; tz: string; now: string; onDone: () => void }) {
  const touched = b.last_contact && b.last_contact <= now ? touchedOn(b.last_contact, tz) : '';
  return (
    <li className="applicant">
      <div className="ap-who">
        <b>{b.name ?? 'A buyer'}</b>
        <span className="muted small">{b.phone}</span>
      </div>
      <p className="ap-wants" title={b.wants ? `${b.wants}${b.timescale ? `, ${b.timescale}` : ''}` : undefined}>
        {b.wants ? shortPrices(b.wants) : <span className="muted">No search noted yet</span>}{b.timescale ? <span className="muted">, {b.timescale}</span> : null}
        {b.matches ? <b className="ap-fit"> · {b.matches} home{b.matches === 1 ? ' fits' : 's fit'} now</b> : null}
      </p>
      <p className="ap-when muted small" title={touched ? `Last in touch ${when(b.last_contact!, tz)}` : undefined}>
        {touched ? <><span className="visually-hidden">Last in touch </span>{touched}</> : null}
        {b.source ? `${touched ? ' · ' : ''}${b.source}` : ''}
      </p>
      <div className="ap-foot">
        <div className="badges ap-tags">
          {positionBadges(b.position ?? undefined).map((x) => <span key={x} className="badge">{x}</span>)}
          {b.alerts ? <span className="badge ok" title={b.consent_at ? `Said yes on ${when(b.consent_at, tz)}` : undefined}>Alerts on</span> : null}
          {b.hot ? <span className="badge bad">Hot</span> : null}
          {b.investor ? <span className="badge">Investor</span> : null}
          {b.backup_for.map((h) => <span key={h} className="badge warn">Back-up buyer: {h}</span>)}
        </div>
        <BuyerActions id={id} b={b} onDone={onDone} />
      </div>
    </li>
  );
}

function BuyerActions({ id, b, onDone }: { id: string; b: LiveBuyer; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const act = async (action: string) => {
    setBusy(true);
    try {
      const r = await demoApi<{ message: string }>(`/workspaces/${id}/buyers/${b.phone.replace(/\s/g, '')}`, { method: 'PATCH', json: { action } });
      toast(r.message);
      onDone();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const who = b.name ?? b.phone;
  return (
    <div className="row-tools buyer-actions">
      <button type="button" className="small" disabled={busy} aria-label={`${b.hot ? 'Not hot' : 'Mark hot'}: ${who}`} onClick={() => act('hot')}>{b.hot ? 'Not hot' : 'Mark hot'}</button>
      {b.alerts ? <button type="button" className="small" disabled={busy || !b.matches} aria-label={`Send matches: ${who}`} title={b.matches ? 'A pretend text with the homes that fit' : 'Nothing fits right now'} onClick={() => act('send_matches')}>Send matches</button> : null}
      {b.alerts ? <button type="button" className="ghost small" disabled={busy} aria-label={`Stop alerts: ${who}`} onClick={() => act('unsubscribe')}>Stop alerts</button> : null}
    </div>
  );
}
