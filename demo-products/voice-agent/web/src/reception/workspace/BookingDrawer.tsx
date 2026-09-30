// A booking, opened from the floor plan or the timeline: who, when, where,
// what to watch for, and what staff can do with it. Every action goes to the
// server, which checks it (capacity, clashes) and logs it on the booking.

import { useEffect, useState } from 'react';
import { demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import type { LiveBooking, LiveState } from '../types.ts';
import { SOURCE, combineOptions, moveOptions } from './model.ts';

const VISIT: { key: LiveBooking['visit_status']; label: string }[] = [
  { key: 'expected', label: 'Expected' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'seated', label: 'Seated' },
  { key: 'finished', label: 'Finished' },
  { key: 'no_show', label: 'No-show' },
];

export function BookingDrawer({ id, state, booking, onClose, onDone }: { id: string; state: LiveState; booking: LiveBooking; onClose: () => void; onDone: () => void }) {
  const b = booking;
  const [notes, setNotes] = useState(b.notes ?? '');
  const [allergies, setAllergies] = useState(b.allergies ?? '');
  const [tags, setTags] = useState(b.tags.join(', '));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setNotes(b.notes ?? '');
    setAllergies(b.allergies ?? '');
    setTags(b.tags.join(', '));
  }, [b.reference, b.notes, b.allergies, b.tags.join(',')]);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await demoApi<{ message: string }>(`/workspaces/${id}/bookings/${b.reference}`, { method: 'PATCH', json: body });
      toast(`${b.name}: ${r.message}`);
      onDone();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const moves = b.status === 'confirmed' ? moveOptions(state, b) : [];
  const joins = b.status === 'confirmed' ? combineOptions(state, b) : [];
  const areas = new Map((state.plan?.areas ?? []).map((a) => [a.key, a.label]));
  const dirty = notes !== (b.notes ?? '') || allergies !== (b.allergies ?? '') || tags !== b.tags.join(', ');
  const callBack = async () => {
    if (!b.phone) return;
    try {
      await navigator.clipboard.writeText(b.phone.replace(/\s/g, ''));
      toast(`${b.phone} copied. In a live deployment, this rings them from the restaurant's line.`);
    } catch {
      toast(`Their number: ${b.phone}`);
    }
  };

  return (
    <aside className="drawer panel" aria-label={`Booking ${b.reference}`}>
      <header>
        <div>
          <h3>{b.name}</h3>
          <span className="muted small mono">Ref {b.reference}</span>
        </div>
        <button type="button" className="ghost" onClick={onClose} aria-label="Close">✕</button>
      </header>

      {b.status === 'cancelled' ? <p className="badge bad">Cancelled</p> : null}
      <dl className="facts-list">
        <dt>When</dt><dd>{b.day}, {b.time} to {b.end_time}</dd>
        <dt>Party</dt><dd>{b.party_size} {b.party_size === 1 ? 'person' : 'people'}</dd>
        <dt>Table</dt><dd>{b.with}{b.area ? `, ${b.area}` : ''}</dd>
        <dt>Phone</dt>
        <dd>
          {b.phone ?? 'not given'}{' '}
          {b.phone ? <button type="button" className="small" onClick={callBack}>Call back</button> : null}
        </dd>
        {b.deposit ? (<><dt>Deposit</dt><dd><span className={`badge ${b.deposit_paid ? 'ok' : 'warn'}`}>{b.deposit_paid ? `${b.deposit} paid (demo)` : `${b.deposit} due`}</span></dd></>) : null}
        <dt>Booked by</dt><dd>{SOURCE[b.source] ?? b.source}</dd>
      </dl>

      {b.allergies ? <div className="allergy">ALLERGY: {b.allergies}</div> : null}

      {b.status === 'confirmed' ? (
        <>
          <div className="visit" role="group" aria-label="Visit">
            {VISIT.map((v) => (
              <button type="button" key={v.key} aria-pressed={b.visit_status === v.key} disabled={busy} onClick={() => act({ action: 'visit', status: v.key })}>
                {v.label}
              </button>
            ))}
          </div>

          <div className="field">
            <label htmlFor="bd-move">Move to another table</label>
            <select id="bd-move" value="" disabled={busy || !moves.length} onChange={(e) => e.target.value && act({ action: 'move', table: e.target.value })}>
              <option value="">{moves.length ? 'Choose a free table…' : 'No other table fits at this time'}</option>
              {moves.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} ({m.seats}){m.area ? `, ${areas.get(m.area) ?? m.area}` : ''}{m.accessible ? ', step-free' : ''}
                </option>
              ))}
            </select>
            <p className="hint">Or drag the table on the floor plan onto another.</p>
          </div>
          {joins.length ? (
            <div className="field">
              <label htmlFor="bd-join">Push {b.with.replace(/^Table /, 'table ')} together with</label>
              <select id="bd-join" value="" disabled={busy} onChange={(e) => e.target.value && act({ action: 'combine', tables: [b.tables[0], e.target.value] })}>
                <option value="">Choose a table…</option>
                {joins.map((t) => <option key={t.key} value={t.key}>{t.label} ({t.seats})</option>)}
              </select>
              <p className="hint">For a wheelchair, a pram or a bigger group. The pair is remembered on your floor plan.</p>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="field">
        <label htmlFor="bd-allergy">Allergies</label>
        <input id="bd-allergy" value={allergies} maxLength={200} onChange={(e) => setAllergies(e.target.value)} placeholder="None noted" />
      </div>
      <div className="field">
        <label htmlFor="bd-notes">Notes</label>
        <textarea id="bd-notes" className="prose" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="bd-tags">Tags</label>
        <input id="bd-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="birthday, regular, wheelchair" />
      </div>
      {dirty ? (
        <button type="button" className="primary" disabled={busy} onClick={() => act({ action: 'details', notes, allergies, tags: tags.split(',').map((x) => x.trim()).filter(Boolean) })}>
          Save details
        </button>
      ) : null}

      <details className="history">
        <summary>History ({b.history.length})</summary>
        <ol>
          {b.history.map((h, i) => (
            <li key={i}>
              <span className="muted small">{new Date(h.at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>{' '}
              {h.what} <span className="muted small">({h.by === 'seed' ? 'sample' : h.by})</span>
            </li>
          ))}
        </ol>
      </details>

      {b.status === 'confirmed' ? (
        <button type="button" className="ghost danger" disabled={busy} onClick={() => confirm(`Cancel ${b.name}'s booking? They get a text.`) && act({ action: 'cancel' })}>
          Cancel booking and text them
        </button>
      ) : null}
    </aside>
  );
}
