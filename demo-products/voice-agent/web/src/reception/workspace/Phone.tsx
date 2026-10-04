// The customer's phone: the texts a caller gets, the moment they are "sent".
// The number is the one this browser calls from in the demo (a drama-range
// number unless the prospect types another). Nothing is ever really texted.

import { useEffect, useState, type FormEvent } from 'react';
import { displayUkPhone, normaliseUkPhone } from '../../../../src/domain/phone.ts';
import { demoApi } from '../../api.ts';

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

export function Phone({ id, number, setNumber, sender, tick, nowLabel, callAs = [] }: { id: string; number: string; setNumber: (n: string) => void; sender: string; tick: number; nowLabel: string; callAs?: CallAs[] }) {
  const [texts, setTexts] = useState<Text[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(number);
  const [lastNew, setLastNew] = useState<string | null>(null);
  const as = callAs.find((p) => p.phone === normaliseUkPhone(number));

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
          <span className="muted small">Text message</span>
        </div>
        <div className="phone-thread" aria-live="polite">
          {texts.length ? texts.map((t) => (
            <div key={t.id} className={`sms ${lastNew === t.id ? 'fresh' : ''}`}>
              <p>{t.body}</p>
              <time>{new Date(t.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</time>
            </div>
          )) : (
            <p className="phone-empty">{callAs.length ? 'No texts yet. Book a viewing or make an offer on the call, and the text lands here.' : 'No texts yet. Book a table or order on the call, and the confirmation lands here.'}</p>
          )}
        </div>
      </div>
      <div className="phone-number">
        {callAs.length ? (
          <label className="field call-as">
            <span className="small">Call as</span>
            <select value={as?.phone ?? ''} onChange={(e) => setNumber(e.target.value ? displayUkPhone(e.target.value) : fresh())}>
              <option value="">Yourself, a new caller</option>
              {callAs.map((p) => <option key={p.phone} value={p.phone}>{p.who}</option>)}
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
            You are calling as <b className="mono">{number}</b>.{' '}
            <button type="button" className="linkish small" onClick={() => { setDraft(number); setEditing(true); }}>Change</button>
            <br />A pretend number: texts only ever appear here.
          </p>
        )}
      </div>
    </section>
  );
}
