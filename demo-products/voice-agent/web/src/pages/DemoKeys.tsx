// The team's side of the demo service: issue a key for a prospect (shown
// once, with its one-click link), and see, extend or switch off the keys
// already out.

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ADMIN_API, api } from '../api.ts';
import { toast } from '../components/Toaster.tsx';

interface KeyRow {
  id: string;
  kind: 'private' | 'shared';
  people: number;
  key_prefix: string;
  person_name: string;
  company: string | null;
  email: string | null;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  workspaces: number;
  call_seconds_24h: number;
}

interface Issued {
  key: string;
  link: string;
  magic_link: string;
  record: { person_name: string; company: string | null; expires_at: string; kind: 'private' | 'shared' };
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export function DemoKeys() {
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [form, setForm] = useState({ kind: 'private' as 'private' | 'shared', person_name: '', company: '', email: '', days: 14 });
  const [issued, setIssued] = useState<Issued | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<{ keys: KeyRow[] }>(`${ADMIN_API}/keys`).then((r) => setKeys(r.keys)).catch((e: Error) => toast(e.message)), []);
  useEffect(() => void load(), [load]);

  const issue = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      setIssued(await api<Issued>(`${ADMIN_API}/keys`, { method: 'POST', body: JSON.stringify(form) }));
      setForm({ kind: form.kind, person_name: '', company: '', email: '', days: form.kind === 'shared' ? 30 : 14 });
      void load();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied.`);
    } catch {
      toast(text);
    }
  };

  const act = async (k: KeyRow, action: 'revoke' | 'extend') => {
    if (action === 'revoke' && !confirm(`Switch off ${k.person_name}'s key? Their demos stop working at once.`)) return;
    try {
      await api(`${ADMIN_API}/keys/${k.id}/${action}`, { method: 'POST', body: action === 'extend' ? JSON.stringify({ days: 7 }) : '{}' });
      void load();
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const now = Date.now();
  return (
    <section className="wizard panel keys-panel" aria-labelledby="keys-title">
      <h2 id="keys-title">Demo keys for prospects</h2>
      <p className="muted">
        A key opens <code>/demo/reception</code>, where they build a demo of their own restaurant and ring it. The key is shown once; only a hash is kept.
      </p>
      <fieldset className="key-kind">
        <legend className="visually-hidden">Kind of key</legend>
        <label className={form.kind === 'private' ? 'on' : ''}>
          <input type="radio" name="kind" checked={form.kind === 'private'} onChange={() => setForm({ ...form, kind: 'private', days: 14 })} />
          <b>Private</b> <span className="muted">for one prospect. Their demo stays until they reset it or start a different one.</span>
        </label>
        <label className={form.kind === 'shared' ? 'on' : ''}>
          <input type="radio" name="kind" checked={form.kind === 'shared'} onChange={() => setForm({ ...form, kind: 'shared', days: 30 })} />
          <b>Shared</b> <span className="muted">one link for many people (an event, a post). Each person gets their own demo, deleted with everything in it an hour after they press Start.</span>
        </label>
      </fieldset>
      <form onSubmit={issue} className="key-form">
        <label className="visually-hidden" htmlFor="k-name">Name</label>
        <input id="k-name" required placeholder={form.kind === 'shared' ? 'What it is for (Hospitality expo)' : 'Name (Sam Price)'} value={form.person_name} onChange={(e) => setForm({ ...form, person_name: e.target.value })} />
        {form.kind === 'private' ? (
          <>
            <label className="visually-hidden" htmlFor="k-company">Company</label>
            <input id="k-company" placeholder="Business (Sam's Kitchen)" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            <label className="visually-hidden" htmlFor="k-email">Email</label>
            <input id="k-email" type="email" placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </>
        ) : null}
        <label className="visually-hidden" htmlFor="k-days">Days</label>
        <select id="k-days" value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })}>
          {[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>{d} days</option>)}
        </select>
        <button className="primary" type="submit" disabled={busy}>{busy ? 'Issuing…' : `Issue a ${form.kind} key`}</button>
      </form>

      {issued ? (
        <div className="issued" role="status">
          <b>
            {issued.record.kind === 'shared' ? 'Shared key' : 'Key'} for {issued.record.person_name}{issued.record.company ? `, ${issued.record.company}` : ''}, until {day(issued.record.expires_at)}. Copy it now: it is not shown again.
          </b>
          <div className="field-row">
            <code className="mono">{issued.key}</code>
            <button type="button" className="small" onClick={() => copy(issued.key, 'Key')}>Copy key</button>
            <button type="button" className="small primary" onClick={() => copy(issued.magic_link, 'One-click link')}>Copy one-click link</button>
          </div>
          <span className="muted small">Page: {issued.link}</span>
        </div>
      ) : null}

      <table className="keys">
        <thead>
          <tr><th>Key</th><th>Kind</th><th>For</th><th>Until</th><th>Demos now</th><th>Calls today</th><th>Last used</th><th /></tr>
        </thead>
        <tbody>
          {(keys ?? []).map((k) => {
            const state = k.revoked_at ? 'switched off' : new Date(k.expires_at).getTime() < now ? 'expired' : null;
            return (
              <tr key={k.id} className={state ? 'off' : ''}>
                <td className="mono">{k.key_prefix}…</td>
                <td><span className={`badge ${k.kind === 'shared' ? 'info' : ''}`}>{k.kind}</span></td>
                <td>{k.person_name}{k.company ? <span className="muted">, {k.company}</span> : null}</td>
                <td>{state ?? day(k.expires_at)}</td>
                <td>{k.workspaces}{k.kind === 'shared' ? <span className="muted"> · {k.people} {k.people === 1 ? 'person' : 'people'}</span> : null}</td>
                <td>{Math.round(k.call_seconds_24h / 60)} min</td>
                <td>{k.last_used_at ? day(k.last_used_at) : <span className="muted">never</span>}</td>
                <td className="actions">
                  {!k.revoked_at ? <button type="button" className="small" onClick={() => act(k, 'extend')}>+7 days</button> : null}
                  {!k.revoked_at ? <button type="button" className="small ghost" onClick={() => act(k, 'revoke')}>Switch off</button> : null}
                </td>
              </tr>
            );
          })}
          {keys && !keys.length ? <tr><td colSpan={8} className="muted">No keys yet.</td></tr> : null}
        </tbody>
      </table>
    </section>
  );
}
