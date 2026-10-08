// A booking, opened from a view that shows bookings: who, when, where, what
// to watch for, and what staff can do with it, in the business's own words
// (a table and a party, or a member of staff). Allergies and pushing tables
// together show only where the workspace spec says. Every action goes to the
// server, which checks it (capacity, clashes) and logs it on the booking.

import { useEffect, useState } from 'react';
import { demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import type { LiveBooking, LiveState } from '../types.ts';
import { bookingBadges } from './estate.ts';
import { SOURCE, combineOptions, moveOptions, personOptions } from './model.ts';
import type { WorkspaceSpec } from './spec.ts';

type BookingsSpec = NonNullable<WorkspaceSpec['bookings']>;

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A viewing's feedback, as the agent who showed it records it. */
const FEEDBACK: [string, string][] = [['keen', 'Keen'], ['second_viewing', 'Second viewing'], ['likely_offer', 'Likely offer'], ['not_for_me', 'Not for me']];

export function BookingDrawer({ id, state, booking, words, onPlan, onClose, onDone }: {
  id: string;
  state: LiveState;
  booking: LiveBooking;
  words: BookingsSpec;
  /** A floor plan is one of the views, so a booking can be dragged there too. */
  onPlan: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const b = booking;
  const visits = Object.entries(words.visit) as [LiveBooking['visit_status'], string][];
  const [notes, setNotes] = useState(b.notes ?? '');
  const [allergies, setAllergies] = useState(b.allergies ?? '');
  const [tags, setTags] = useState(b.tags.join(', '));
  const [busy, setBusy] = useState(false);
  const feedback = b.details?.feedback as { category: string; words?: string } | undefined;
  const [said, setSaid] = useState(feedback?.words ?? '');
  useEffect(() => setSaid(feedback?.words ?? ''), [b.reference, feedback?.words]);
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

  const moves = b.status === 'confirmed' && !words.property ? moveOptions(state, b) : [];
  // A booking with a person (a viewing, a valuation): to someone else who can take it then.
  const byPerson = (state.team ?? []).some((m) => m.key === b.resource_key);
  const people = byPerson ? personOptions(state, b) : [];
  const joins = b.status === 'confirmed' && words.combine ? combineOptions(state, b) : [];
  const areas = new Map((state.plan?.areas ?? []).map((a) => [a.key, a.label]));
  const dirty = notes !== (b.notes ?? '') || allergies !== (b.allergies ?? '') || tags !== b.tags.join(', ');
  const callBack = async () => {
    if (!b.phone) return;
    try {
      await navigator.clipboard.writeText(b.phone.replace(/\s/g, ''));
      toast(`${b.phone} copied. In a live deployment, this rings them from ${words.property ? 'your office' : 'the restaurant'}'s line.`);
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
        {words.party ? (<><dt>{words.party}</dt><dd>{b.party_size} {b.party_size === 1 ? 'person' : 'people'}</dd></>) : null}
        <dt>{capital(words.resource)}</dt><dd>{b.with}{b.area ? `, ${b.area}` : ''}</dd>
        <dt>Phone</dt>
        <dd>
          {b.phone ?? 'not given'}{' '}
          {b.phone ? <button type="button" className="small" onClick={callBack}>Call back</button> : null}
        </dd>
        {b.deposit ? (<><dt>Deposit</dt><dd><span className={`badge ${b.deposit_paid ? 'ok' : 'warn'}`}>{b.deposit_paid ? `${b.deposit} paid (demo)` : `${b.deposit} due`}</span></dd></>) : null}
        {words.property && b.home ? (<><dt>Home</dt><dd>{b.home}</dd></>) : null}
        {words.property && b.details?.postcode ? (<><dt>Postcode</dt><dd>{String(b.details.postcode)}</dd></>) : null}
        <dt>Booked by</dt><dd>{SOURCE[b.source] ?? b.source}</dd>
      </dl>
      {words.property ? (
        <div className="badges">
          {bookingBadges(b.details).map((x) => <span key={x} className="badge">{x}</span>)}
        </div>
      ) : null}

      {words.allergies && b.allergies ? <div className="allergy">ALLERGY: {b.allergies}</div> : null}

      {b.status === 'confirmed' ? (
        <>
          <div className="visit" role="group" aria-label="Visit">
            {visits.map(([key, label]) => (
              <button type="button" key={key} aria-pressed={b.visit_status === key} disabled={busy} onClick={() => act({ action: 'visit', status: key })}>
                {label}
              </button>
            ))}
          </div>

          {words.property && b.listing_key ? (
            <div className="field">
              <label>Feedback</label>
              <div className="visit" role="group" aria-label="Feedback">
                {FEEDBACK.map(([key, label]) => (
                  <button type="button" key={key} aria-pressed={feedback?.category === key} disabled={busy} onClick={() => act({ action: 'feedback', category: key, words: said })}>{label}</button>
                ))}
              </div>
              <input aria-label="What they said" placeholder="What they said (optional)" value={said} maxLength={300} onChange={(e) => setSaid(e.target.value)} />
              {feedback && said !== (feedback.words ?? '') ? <button type="button" className="small" disabled={busy} onClick={() => act({ action: 'feedback', category: feedback.category, words: said })}>Save feedback</button> : null}
            </div>
          ) : null}
          {byPerson && b.status === 'confirmed' ? (
            <div className="field">
              <label htmlFor="bd-person">Move to someone else</label>
              <select id="bd-person" value="" disabled={busy || !people.length} onChange={(e) => e.target.value && act({ action: 'move', to: e.target.value })}>
                <option value="">{people.length ? 'Choose who…' : 'Nobody else who does this is free then'}</option>
                {people.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
              <p className="hint">{`Or drag it to their row in the Diary. ${b.name} gets a text saying who they'll see.`}</p>
            </div>
          ) : null}
          {words.property ? null : (<div className="field">
            <label htmlFor="bd-move">{`Move to another ${words.resource}`}</label>
            <select id="bd-move" value="" disabled={busy || !moves.length} onChange={(e) => e.target.value && act({ action: 'move', table: e.target.value })}>
              <option value="">{moves.length ? `Choose a free ${words.resource}…` : `No other ${words.resource} fits at this time`}</option>
              {moves.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} ({m.seats}){m.area ? `, ${areas.get(m.area) ?? m.area}` : ''}{m.accessible ? ', step-free' : ''}
                </option>
              ))}
            </select>
            {onPlan ? <p className="hint">{`Or drag the ${words.resource} on the floor plan onto another.`}</p> : null}
          </div>)}
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

      {words.allergies ? (
        <div className="field">
          <label htmlFor="bd-allergy">Allergies</label>
          <input id="bd-allergy" value={allergies} maxLength={200} onChange={(e) => setAllergies(e.target.value)} placeholder="None noted" />
        </div>
      ) : null}
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
