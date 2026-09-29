import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { api } from '../api.ts';
import { MicIcon } from '../components/Icons.tsx';
import { toast } from '../components/Toaster.tsx';
import { Link, navigate } from '../router.tsx';
import type { AppConfig, Profile } from '../types.ts';

const TYPE: Record<string, string> = {
  restaurant: 'Restaurant', cafe: 'Café and takeaway', takeaway: 'Takeaway', pub: 'Pub',
  hotel: 'Hotel and spa', salon: 'Salon', barber: 'Barber', other: 'Business',
};

export function Console() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [profiles, setProfiles] = useState<Profile[] | null>(null);

  useEffect(() => {
    document.title = 'n.abl Reception';
    (async () => {
      const [cfg, { tenants }] = await Promise.all([api<AppConfig>('/api/config'), api<{ tenants: { slug: string }[] }>('/api/tenants')]);
      setConfig(cfg);
      setProfiles(await Promise.all(tenants.map((t) => api<{ profile: Profile }>(`/api/tenants/${t.slug}`).then((d) => d.profile))));
    })().catch((e: Error) => toast(e.message));
  }, []);

  return (
    <>
      <div className="top">
        <span className="brand">
          n.abl <b>Reception</b>
        </span>
        <span className="badge warn">Demo console</span>
        <span className="spacer" />
        {config ? (
          <span className="muted small">
            Voice model {config.models[0]}
            {config.models.length > 1 ? `, falls back to ${config.models.slice(1).join(', ')}` : ''}
          </span>
        ) : null}
      </div>
      <main>
        <section className="intro">
          <h1>Talk to an AI receptionist</h1>
          <p>
            Pick a business, press <b>Start a live call</b> and speak. It answers questions, books tables and appointments, and takes orders and
            demo payments, out loud and in real time. You can interrupt it. Headphones work best.
          </p>
        </section>

        {config ? (
          <div className="status-row">
            <span className={`badge ${config.telephony ? 'ok' : 'info'}`}>{config.telephony ? 'Phone line connected' : 'Browser calls only (no phone line set up)'}</span>
            <span className={`badge ${config.sms ? 'ok' : 'info'}`}>{config.sms ? 'Texts sent' : 'Texts simulated'}</span>
            <span className="badge info">
              {config.active_calls} of {config.max_calls} lines in use
            </span>
          </div>
        ) : null}

        <div className="tenants">
          {profiles === null ? <p className="empty">Loading…</p> : null}
          {profiles?.map((p) => (
            <article key={p.slug} className="panel tenant-card" style={p.brand?.accent ? ({ '--accent': p.brand.accent } as CSSProperties) : undefined}>
              <h3>{p.name}</h3>
              <p>{p.summary}</p>
              <div className="row">
                <span className="badge">{TYPE[p.business_type] ?? p.business_type}</span>
                <span className="badge">Voice {p.voice}</span>
                {p.demo_pin ? <span className="badge info">PIN {p.demo_pin}</span> : null}
              </div>
              <div className="row">
                <Link to={`/board/${p.slug}`} className="button primary">
                  <MicIcon /> Start a live call
                </Link>
              </div>
            </article>
          ))}
        </div>

        <Wizard />
      </main>
    </>
  );
}

function Wizard() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<string[] | null>(null);
  const [json, setJson] = useState('');

  const read = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { profile } = await api<{ profile: Profile & { review_notes?: string[]; pages?: string[] } }>('/api/ingest', { method: 'POST', body: JSON.stringify({ url }) });
      const { review_notes = [], pages = [], ...clean } = profile;
      setNotes([`Read ${pages.length} page${pages.length === 1 ? '' : 's'}.`, ...review_notes]);
      setJson(JSON.stringify(clean, null, 2));
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    let profile: Profile;
    try {
      profile = JSON.parse(json);
    } catch {
      return toast('The profile is not valid JSON. Check the last edit.');
    }
    try {
      await api(`/api/tenants/${profile.slug}`, { method: 'PUT', body: JSON.stringify(profile) });
      await api(`/api/tenants/${profile.slug}/reset`, { method: 'POST' });
      navigate(`/board/${profile.slug}`);
    } catch (err) {
      toast((err as Error).message);
    }
  };

  return (
    <section className="wizard panel" aria-labelledby="wiz-title">
      <h2 id="wiz-title">New demo from a website</h2>
      <p className="muted">
        Paste a prospect's website. The setup reads its pages and drafts a profile: hours, menu, services and FAQs, taken only from what the site
        says. Check the notes, edit anything, then publish.
      </p>
      <form onSubmit={read}>
        <label className="visually-hidden" htmlFor="ingest-url">Website address</label>
        <input id="ingest-url" type="url" inputMode="url" placeholder="https://www.example-restaurant.co.uk" required value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className="primary" type="submit" disabled={busy}>{busy ? 'Reading… (up to a minute)' : 'Read the website'}</button>
      </form>
      {notes ? (
        <>
          <ul className="notes">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          <label htmlFor="ingest-json" className="muted">Profile (edit before publishing)</label>
          <textarea id="ingest-json" spellCheck={false} value={json} onChange={(e) => setJson(e.target.value)} />
          <div>
            <button className="primary" type="button" onClick={publish}>Publish demo</button>
          </div>
        </>
      ) : null}
    </section>
  );
}
