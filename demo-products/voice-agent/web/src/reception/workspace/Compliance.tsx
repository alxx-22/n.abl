// Properties and compliance (presets/property-maintenance.md §6): every home
// the contractor looks after, with its client, occupant, stopcock and boiler
// notes, and its certificates marked due, due soon, overdue or booked. A
// certificate's renewal is booked straight from its row, into the first
// free window that keeps a gas record's date. Every address is an example.

import { useState } from 'react';
import { demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import type { LiveCertificate, LiveMtProperty, LiveState } from '../types.ts';

const CERT: Record<string, string> = { gas_record: 'Gas safety', eicr: 'EICR', boiler_service: 'Boiler service', alarms: 'Alarms', pat: 'PAT' };
const LEVEL: Record<LiveCertificate['state'], string> = { overdue: 'bad', 'due soon': 'warn', booked: 'ok', 'in date': '', unknown: '' };
const ACCESS: Record<string, string> = { key_safe: 'Key safe (code with the office)', keys_held: 'Keys at the office', occupant: 'Occupant lets us in' };
const date = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');

export function Compliance({ id, state, onDone }: { id: string; state: LiveState; onDone: () => void }) {
  const [filter, setFilter] = useState<'due' | 'all'>('due');
  const [open, setOpen] = useState<string | null>(null);
  const all = state.properties ?? [];
  const due = (p: LiveMtProperty) => p.certificates.some((c) => c.state === 'overdue' || c.state === 'due soon' || c.remedials.some((r) => !r.done));
  const shown = (filter === 'due' ? all.filter(due) : all).sort((a, b) => Number(due(b)) - Number(due(a)) || a.address.localeCompare(b.address));
  const counts = { overdue: all.filter((p) => p.certificates.some((c) => c.state === 'overdue')).length, soon: all.filter((p) => p.certificates.some((c) => c.state === 'due soon')).length };
  return (
    <div className="compliance">
      <div className="row-tools">
        <span className="badge bad">{counts.overdue} overdue</span>
        <span className="badge warn">{counts.soon} due soon</span>
        <span className="muted small">{all.length} properties, all examples</span>
        <label className="small"><input type="checkbox" checked={filter === 'due'} onChange={(e) => setFilter(e.target.checked ? 'due' : 'all')} /> Due or overdue only</label>
      </div>
      {!shown.length ? <p className="empty">Nothing due. Untick to see every property.</p> : null}
      <ul className="register">
        {shown.map((p) => (
          <li key={p.key}>
            <button type="button" className="register-row" aria-expanded={open === p.key} onClick={() => setOpen(open === p.key ? null : p.key)}>
              <b>{p.address}</b>
              <span className="muted small">{p.client ?? 'Homeowner'}{p.occupant.name ? ` · ${p.occupant.name}` : ''}</span>
              <span className="badges">
                {p.certificates.map((c) => <span key={c.kind} className={`badge ${LEVEL[c.state]}`}>{CERT[c.kind] ?? c.kind}: {c.state}</span>)}
                {p.vulnerable.length ? <span className="badge bad">Vulnerable</span> : null}
              </span>
            </button>
            {open === p.key ? <PropertyDetail id={id} p={p} onDone={onDone} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PropertyDetail({ id, p, onDone }: { id: string; p: LiveMtProperty; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const book = async (what: string) => {
    setBusy(true);
    try {
      const r = await demoApi<{ message: string }>(`/workspaces/${id}/properties/${p.key}`, { method: 'POST', json: { action: 'book', what } });
      toast(r.message);
      onDone();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="register-detail">
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
      <table className="certs">
        <thead><tr><th scope="col">Certificate</th><th scope="col">Runs to</th><th scope="col">State</th><th scope="col"><span className="sr-only">Book</span></th></tr></thead>
        <tbody>
          {p.certificates.map((c) => (
            <tr key={c.kind}>
              <td>{CERT[c.kind] ?? c.kind}{c.remedials.filter((r) => !r.done).map((r) => <span key={r.what} className="small muted block">{r.what}, by {date(r.due)}</span>)}</td>
              <td>{date(c.expires)}</td>
              <td><span className={`badge ${LEVEL[c.state]}`}>{c.state === 'booked' ? `booked: ${c.booked_job}` : c.state}</span></td>
              <td>{c.state !== 'booked' && ['gas_record', 'boiler_service', 'eicr'].includes(c.kind) ? <button type="button" className="small" disabled={busy} onClick={() => book(c.kind)}>Book</button> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
