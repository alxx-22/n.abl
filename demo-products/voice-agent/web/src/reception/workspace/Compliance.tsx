// Properties and compliance (presets/property-maintenance.md §6): every home
// the contractor looks after, with its client, occupant, stopcock and boiler
// notes, and its certificates marked due, due soon, overdue or booked. A
// certificate's renewal is booked straight from its row, into the first
// free window that keeps a gas record's date. Every address is an example.
//
// Ninety-odd homes are read in passing between calls, so each is one row
// that says only what needs doing; chips and a search narrow the list, and
// a home's notes and certificates open in a panel over it.

import { useState } from 'react';
import { demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import type { LiveCertificate, LiveMtProperty, LiveState } from '../types.ts';
import { splitAddress } from './maintenance.ts';
import { Chips, Search, Sheet } from './RepairsKit.tsx';

const CERT: Record<string, string> = { gas_record: 'Gas safety', eicr: 'EICR', boiler_service: 'Boiler service', alarms: 'Alarms', pat: 'PAT' };
const LEVEL: Record<LiveCertificate['state'], string> = { overdue: 'bad', 'due soon': 'warn', booked: 'ok', 'in date': '', unknown: '' };
const ACCESS: Record<string, string> = { key_safe: 'Key safe (code with the office)', keys_held: 'Keys at the office', occupant: 'Occupant lets us in' };
const date = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');

const remedials = (p: LiveMtProperty) => p.certificates.flatMap((c) => c.remedials.filter((r) => !r.done));
const has = (p: LiveMtProperty, state: LiveCertificate['state']) => p.certificates.some((c) => c.state === state);
const due = (p: LiveMtProperty) => has(p, 'overdue') || has(p, 'due soon') || remedials(p).length > 0;

type Filter = 'due' | 'overdue' | 'soon' | 'booked' | 'vulnerable' | 'all';
const FILTERS: { key: Filter; label: string; has: (p: LiveMtProperty) => boolean }[] = [
  { key: 'due', label: 'Due or overdue', has: due },
  { key: 'overdue', label: 'Overdue', has: (p) => has(p, 'overdue') },
  { key: 'soon', label: 'Due soon', has: (p) => has(p, 'due soon') },
  { key: 'booked', label: 'Booked', has: (p) => has(p, 'booked') },
  { key: 'vulnerable', label: 'Vulnerable', has: (p) => p.vulnerable.length > 0 },
  { key: 'all', label: 'All', has: () => true },
];

/** An address or postcode, a client, or whoever lives there. */
function found(p: LiveMtProperty, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || [p.address, p.town, p.district, p.client, p.occupant.name].some((s) => s?.toLowerCase().includes(q));
}

/** Overdue first, then due soon or with work outstanding, then the rest: by address within each. */
const rank = (p: LiveMtProperty) => (has(p, 'overdue') ? 0 : due(p) ? 1 : 2);

export function Compliance({ id, state, onDone }: { id: string; state: LiveState; onDone: () => void }) {
  const [filter, setFilter] = useState<Filter>('due');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const all = state.properties ?? [];
  const searched = all.filter((p) => found(p, query));
  const chosen = FILTERS.find((f) => f.key === filter)!;
  const shown = searched.filter(chosen.has).sort((a, b) => rank(a) - rank(b) || a.address.localeCompare(b.address));
  const examples = all.filter((p) => p.example).length;
  const opened = all.find((p) => p.key === open);
  return (
    <div className="compliance rp-view rp-props">
      <div className="rp-head">
        <div className="rp-tools">
          <Chips
            label="Show"
            value={filter}
            onChange={(k) => setFilter(k === filter && k !== 'all' ? 'all' : k)}
            chips={FILTERS.map((f) => ({ key: f.key, label: f.label, n: searched.filter(f.has).length }))}
          />
          <Search label="Search properties" placeholder="Address or name" value={query} onChange={setQuery} />
        </div>
        <p className="rp-showing muted small" aria-live="polite">
          {shown.length === all.length ? `${all.length} properties` : `Showing ${shown.length} of ${all.length} properties`}
          {examples === all.length ? ', all examples' : examples ? `, ${examples} of them examples` : ''}. Open one for its notes, its certificates and to book a renewal.
        </p>
        <div className="rp-cols" aria-hidden="true"><span>Property</span><span>Client and occupant</span><span>What needs doing</span></div>
      </div>
      {shown.length ? (
        <ul className="rp-list">
          {shown.map((p) => <PropertyRow key={p.key} p={p} open={open === p.key} onOpen={() => setOpen(p.key)} />)}
        </ul>
      ) : (
        <p className="empty">
          {filter === 'due' && !query ? 'Nothing due. ' : 'No properties match. '}
          <button type="button" className="ghost small" onClick={() => { setFilter('all'); setQuery(''); }}>Show every property</button>
        </p>
      )}
      {opened ? <PropertyDetail key={opened.key} id={id} p={opened} onClose={() => setOpen(null)} onDone={onDone} /> : null}
    </div>
  );
}

function PropertyRow({ p, open, onOpen }: { p: LiveMtProperty; open: boolean; onOpen: () => void }) {
  const { street, postcode } = splitAddress(p.address);
  const needs = p.certificates.filter((c) => c.state === 'overdue' || c.state === 'due soon' || c.state === 'booked');
  const fine = p.certificates.filter((c) => c.state === 'in date').length;
  const unknown = p.certificates.filter((c) => c.state === 'unknown').length;
  const work = remedials(p).length;
  const rest = [fine ? `${fine} in date` : '', unknown ? `${unknown} not known` : ''].filter(Boolean).join(', ');
  return (
    <li>
      <button type="button" className="rp-row" aria-haspopup="dialog" aria-expanded={open} onClick={onOpen}>
        <span className="rp-one" title={p.address}><b>{street}</b>{postcode ? <span className="muted"> {postcode}</span> : null}</span>
        <span className="rp-one muted small">{p.client ?? 'Homeowner'}{p.occupant.name ? ` · ${p.occupant.name}` : ''}</span>
        <span className="badges">
          {needs.map((c) => <span key={c.kind} className={`badge ${LEVEL[c.state]}`}>{CERT[c.kind] ?? c.kind}: {c.state}</span>)}
          {work ? <span className="badge warn">{work === 1 ? 'Remedial work due' : `${work} remedials due`}</span> : null}
          {p.vulnerable.length ? <span className="badge bad">Vulnerable</span> : null}
          {rest ? <span className="muted small">{needs.length || work ? `+ ${rest}` : `All ${rest}`}</span> : null}
        </span>
      </button>
    </li>
  );
}

function PropertyDetail({ id, p, onClose, onDone }: { id: string; p: LiveMtProperty; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const book = async (what: string) => {
    setBusy(true);
    try {
      const r = await demoApi<{ message: string }>(`/workspaces/${id}/properties/${p.key}`, { method: 'POST', json: { action: 'book', what } });
      toast(r.message);
      setSaid(r.message);
      onDone();
    } catch (e) {
      toast((e as Error).message);
      setSaid((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title={p.address} sub={p.client ?? 'Homeowner'} said={said} onClose={onClose}>
      <dl className="facts-list">
        <dt>Occupant</dt><dd>{p.occupant.name ?? 'Not on file'}{p.occupant.phone ? ` · ${p.occupant.phone}` : ''}</dd>
        <dt>Stopcock</dt><dd>{p.notes.stopcock ?? 'Not noted'}</dd>
        <dt>Boiler</dt><dd>{p.notes.boiler ?? 'Not noted'}</dd>
        <dt>Access</dt><dd>{ACCESS[p.access] ?? p.access}</dd>
        {p.notes.parking ? <><dt>Parking</dt><dd>{p.notes.parking}</dd></> : null}
        {p.notes.pets ? <><dt>Pets</dt><dd>{p.notes.pets}</dd></> : null}
        {p.vulnerable.length ? <><dt>Vulnerable</dt><dd>{p.vulnerable.join(', ')} (noted with consent)</dd></> : null}
        {p.markers.length ? <><dt>For staff</dt><dd>{p.markers.join(' ')}</dd></> : null}
      </dl>
      <table className="certs rp-certs">
        <thead><tr><th scope="col">Certificate</th><th scope="col">Runs to</th><th scope="col">State</th><th scope="col"><span className="sr-only">Book</span></th></tr></thead>
        <tbody>
          {p.certificates.map((c) => (
            <tr key={c.kind}>
              <td>{CERT[c.kind] ?? c.kind}{c.remedials.filter((r) => !r.done).map((r) => <span key={r.what} className="small muted block">{r.what}, by {date(r.due)}</span>)}</td>
              <td>{date(c.expires)}</td>
              <td><span className={`badge ${LEVEL[c.state]}`}>{c.state === 'booked' ? `booked: ${c.booked_job}` : c.state}</span></td>
              <td>{c.state !== 'booked' && ['gas_record', 'boiler_service', 'eicr'].includes(c.kind) ? <button type="button" className="small" disabled={busy} onClick={() => book(c.kind)} aria-label={`Book ${CERT[c.kind] ?? c.kind}`}>Book</button> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Sheet>
  );
}
