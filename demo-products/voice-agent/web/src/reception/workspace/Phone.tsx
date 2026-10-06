// The customer's phone: the texts a caller gets, the moment they are "sent".
// The number is the one this browser calls from in the demo (a drama-range
// number unless the prospect types another). Nothing is ever really texted.

import { useEffect, useState, type FormEvent } from 'react';
import { displayUkPhone, normaliseUkPhone } from '../../../../src/domain/phone.ts';
import { demoApi } from '../../api.ts';
import type { LiveClient, LiveEngineer, LiveJob, LiveQuote } from '../types.ts';
import { jobAct } from './maintenance.ts';

/** A seeded person the prospect can ring as (an estate agency's Call as). */
export interface CallAs {
  phone: string;
  who: string;
  try: string;
}

interface Text {
  id: string;
  body: string;
  created_at: string;
}

const key = (id: string) => `rx-phone-${id}`;

/** The demo caller's number for this workspace, remembered in this browser. */
export function usePhoneNumber(id: string): [string, (n: string) => void] {
  const [n, setN] = useState(() => {
    try {
      const saved = localStorage.getItem(key(id));
      if (saved) return saved;
    } catch { /* private window */ }
    return fresh();
  });
  const set = (v: string) => {
    setN(v);
    try {
      localStorage.setItem(key(id), v);
    } catch { /* ignore */ }
  };
  return [n, set];
}

const fresh = () => `07700 900${String(100 + Math.floor(Math.random() * 900))}`;

/**
 * A repairs contractor's people (presets/property-maintenance.md §6): the
 * phone can be an engineer's, with the job sheet, or a client's, with the
 * approvals waiting on them.
 */
interface Engineers {
  engineers: Pick<LiveEngineer, 'key' | 'first_name' | 'mobile'>[];
  clients?: LiveClient[];
  jobs: LiveJob[];
  quotes?: LiveQuote[];
  today: string;
  onDone: () => void;
}

export function Phone({ id, number, setNumber, sender, tick, nowLabel, callAs = [], crew }: { id: string; number: string; setNumber: (n: string) => void; sender: string; tick: number; nowLabel: string; callAs?: CallAs[]; crew?: Engineers }) {
  const [texts, setTexts] = useState<Text[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(number);
  const [lastNew, setLastNew] = useState<string | null>(null);
  const as = callAs.find((p) => p.phone === normaliseUkPhone(number));
  const engineer = crew?.engineers.find((e) => normaliseUkPhone(e.mobile) === normaliseUkPhone(number));
  const client = engineer ? undefined : crew?.clients?.find((c) => normaliseUkPhone(c.contact.phone) === normaliseUkPhone(number));
  const clientsToList = (crew?.clients ?? []).filter((c) => c.contact.phone && !callAs.some((p) => p.phone === normaliseUkPhone(c.contact.phone)));

  useEffect(() => {
    let stop = false;
    demoApi<{ messages: Text[] }>(`/workspaces/${id}/phone?number=${encodeURIComponent(number)}`)
      .then((r) => {
        if (stop) return;
        setTexts((prev) => {
          const last = r.messages.at(-1);
          if (last && prev.length && !prev.some((p) => p.id === last.id)) setLastNew(last.id);
          return r.messages;
        });
      })
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [id, number, tick]);

  const save = (e: FormEvent) => {
    e.preventDefault();
    const clean = draft.trim();
    if (!/^(\+44\s?7|07)\d{3}\s?\d{3}\s?\d{3}$/.test(clean.replace(/\s+/g, ' ')) && !/^(\+44|0)7\d{9}$/.test(clean.replace(/\s/g, ''))) return;
    setNumber(clean);
    setEditing(false);
  };

  return (
    <section className="phone-col" aria-label="The customer's phone">
      <div className="phone">
        <div className="phone-bar"><span>{nowLabel}</span><span className="notch" /><span>●●● 5G</span></div>
        <div className="phone-head">
          <span className="avatar" aria-hidden="true">{sender.slice(0, 1)}</span>
          <b>{sender}</b>
          <span className="muted small">{engineer ? `${engineer.first_name}'s phone` : client ? `${client.contact.name}'s phone` : 'Text message'}</span>
        </div>
        <div className="phone-thread" aria-live="polite">
          {texts.length ? texts.map((t) => (
            <div key={t.id} className={`sms ${lastNew === t.id ? 'fresh' : ''}`}>
              <p>{t.body}</p>
              <time>{new Date(t.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</time>
            </div>
          )) : (
            <p className="phone-empty">
              {engineer ? 'No pages yet. An emergency raised on the call pages the engineer on call here.'
                : client ? "No texts yet. Requests for this client's approval, and notices of their jobs, land here."
                : crew ? 'No texts yet. Report a repair on the call, and the text lands here.'
                : callAs.length ? 'No texts yet. Book a viewing or make an offer on the call, and the text lands here.'
                : 'No texts yet. Book a table or order on the call, and the confirmation lands here.'}
            </p>
          )}
        </div>
        {engineer && crew ? <JobSheet id={id} engineer={engineer.key} name={engineer.first_name} crew={crew} /> : null}
        {client && crew ? <Approvals id={id} client={client} crew={crew} /> : null}
      </div>
      <div className="phone-number">
        {callAs.length ? (
          <label className="field call-as">
            <span className="small">Call as</span>
            <select value={as?.phone ?? normaliseUkPhone(engineer?.mobile ?? client?.contact.phone) ?? ''} onChange={(e) => setNumber(e.target.value ? displayUkPhone(e.target.value) : fresh())}>
              <option value="">Yourself, a new caller</option>
              {callAs.map((p) => <option key={p.phone} value={p.phone}>{p.who}</option>)}
              {clientsToList.length ? (
                <optgroup label="A client's phone (approvals)">
                  {clientsToList.map((c) => <option key={c.key} value={normaliseUkPhone(c.contact.phone) ?? c.contact.phone}>{c.contact.name}, {c.name}</option>)}
                </optgroup>
              ) : null}
              {crew?.engineers.length ? (
                <optgroup label="An engineer's phone">
                  {crew.engineers.map((e) => <option key={e.key} value={normaliseUkPhone(e.mobile) ?? e.mobile}>{e.first_name}, engineer</option>)}
                </optgroup>
              ) : null}
            </select>
          </label>
        ) : null}
        {editing ? (
          <form onSubmit={save} className="field-row">
            <input aria-label="Your number in this demo" value={draft} onChange={(e) => setDraft(e.target.value)} inputMode="tel" />
            <button type="submit" className="small primary">Use</button>
          </form>
        ) : (
          <p className="small muted">
            {as ? <><b>{as.who}</b>. {as.try}<br /></> : null}
            {engineer ? <><b>{engineer.first_name}'s phone</b>: pages and the job sheet. Accept an emergency here, then tap On my way.<br /></> : null}
            {client && !as ? <><b>{client.contact.name}, {client.name}</b>: work over the {money(client.works_limit_pence)} limit waits here for a yes or no.<br /></> : null}
            You are calling as <b className="mono">{number}</b>.{' '}
            <button type="button" className="linkish small" onClick={() => { setDraft(number); setEditing(true); }}>Change</button>
            <br />A pretend number: texts only ever appear here.
          </p>
        )}
      </div>
    </section>
  );
}

const money = (pence: number) => `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: pence % 100 ? 2 : 0 })}`;

/**
 * The client's approvals: every job over their limit, with its quote, and
 * Approve or Decline. This is the only place a yes is given, never on a call
 * (decision 4): approving books the first free window and tells the tenant.
 */
function Approvals({ id, client, crew }: { id: string; client: LiveClient; crew: Engineers }) {
  const [busy, setBusy] = useState(false);
  const waiting = crew.jobs.filter((j) => j.status === 'awaiting_approval' && j.client === client.name);
  const act = async (ref: string, answer: 'yes' | 'no') => {
    setBusy(true);
    await jobAct(id, ref, { action: 'authorise', answer }, crew.onDone);
    setBusy(false);
  };
  return (
    <div className="job-sheet" aria-label={`Approvals for ${client.name}`}>
      <b className="small">Waiting for your approval ({waiting.length})</b>
      {waiting.length ? waiting.map((j) => {
        const q = crew.quotes?.find((x) => x.job_ref === j.reference && x.status === 'sent');
        const amount = q?.amount_pence ?? j.price_pence;
        return (
          <div key={j.reference} className="page-alert approval">
            <b>{q ? `Quote ${q.reference}` : `Job ${j.reference}`}{amount ? `: ${money(amount)}` : ''}</b>
            <span className="small">{j.address} · {j.description.replace(/: quote Q-\d+$/, '')}</span>
            <div className="row-tools">
              <button type="button" className="small primary" disabled={busy} onClick={() => act(j.reference, 'yes')}>Approve</button>
              <button type="button" className="small" disabled={busy} onClick={() => { if (confirm(`Decline ${q?.reference ?? j.reference}? The tenant will be told it isn't going ahead.`)) void act(j.reference, 'no'); }}>Decline</button>
            </div>
          </div>
        );
      }) : <p className="small muted">Nothing waiting. Work over your limit lands here for a yes or no.</p>}
    </div>
  );
}

/**
 * The engineer's job sheet: a page to accept or decline, today's jobs in
 * order with On my way, On site and Done. Never a code: the board has none.
 */
function JobSheet({ id, engineer, name, crew }: { id: string; engineer: string; name: string; crew: Engineers }) {
  const [busy, setBusy] = useState(false);
  const mine = crew.jobs.filter((j) => j.engineer_key === engineer);
  const pages = mine.filter((j) => j.status === 'new' && j.flags.includes('paged'));
  const ahead = mine.filter((j) => j.date && j.date >= crew.today && ['scheduled', 'on_the_way', 'on_site'].includes(j.status));
  // Today's jobs, or on a quiet day the next day that has some, so the sheet always shows what's coming.
  const day = ahead.some((j) => j.date === crew.today) ? crew.today : ahead.map((j) => j.date!).sort()[0];
  const today = ahead.filter((j) => j.date === day).sort((a, b) => (a.window ?? '').localeCompare(b.window ?? ''));
  const heading = !day || day === crew.today ? 'Today' : new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const act = async (ref: string, body: Record<string, unknown>) => {
    setBusy(true);
    await jobAct(id, ref, body, crew.onDone);
    setBusy(false);
  };
  return (
    <div className="job-sheet" aria-label={`${name}'s job sheet`}>
      {pages.map((j) => (
        <div key={j.reference} className="page-alert">
          <b>Emergency: {j.trade_label}</b>
          <span className="small">{j.address} · {j.description}</span>
          <div className="row-tools">
            <button type="button" className="small primary" disabled={busy} onClick={() => act(j.reference, { action: 'accept' })}>Accept</button>
            <button type="button" className="small" disabled={busy} onClick={() => act(j.reference, { action: 'decline' })}>Decline</button>
          </div>
        </div>
      ))}
      <b className="small">{heading} ({today.length})</b>
      {today.length ? today.map((j) => (
        <div key={j.reference} className="sheet-job">
          <span className="small"><b>{j.window?.split(',')[0] ?? 'Emergency'}</b> · {j.address}</span>
          <span className="small muted">{j.trade_label}: {j.description}{j.pets ? ` · ${j.pets}` : ''}</span>
          <div className="row-tools">
            {j.status === 'scheduled' && j.date === crew.today ? <button type="button" className="small primary" disabled={busy} onClick={() => act(j.reference, { action: 'on_the_way', eta_minutes: 20 })}>On my way</button> : null}
            {j.status === 'on_the_way' ? <button type="button" className="small primary" disabled={busy} onClick={() => act(j.reference, { action: 'on_site' })}>On site</button> : null}
            {j.status === 'on_site' ? <button type="button" className="small" disabled={busy} onClick={() => { const notes = prompt('What was done?'); if (notes) void act(j.reference, { action: 'done', notes }); }}>Done</button> : null}
          </div>
        </div>
      )) : <p className="small muted">Nothing booked.</p>}
    </div>
  );
}
