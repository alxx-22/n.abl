// The prospect's side of the demo, under /demo/reception:
//
//   /demo/reception              the door (key entry), then their demos
//   /demo/reception/new          pick a kind of business, optionally a website
//   /demo/reception/build/<id>   the builder
//   /demo/reception/live/<id>    the workspace: the call, the back office, the phone

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError, BASE, demoApi, onSessionEnded } from '../api.ts';
import { Toaster, toast } from '../components/Toaster.tsx';
import { Link, navigate } from '../router.tsx';
import { Builder } from './builder/Builder.tsx';
import { Workspace } from './workspace/Workspace.tsx';
import type { Me, PresetInfo, WorkspacePayload, WorkspaceSummary } from './types.ts';
import './reception.css';

export const R = `${BASE}/reception`;

const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

export function Reception({ path }: { path: string }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      setMe(await demoApi<Me>('/me'));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setMe(null);
      else toast((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
    return onSessionEnded(() => setMe(null));
  }, [load]);

  useEffect(() => {
    document.title = 'Your demo · n.abl';
  }, []);

  let page;
  if (me === undefined) page = <main className="rx-main"><p className="empty">Loading…</p></main>;
  else if (me === null) page = <Door onIn={setMe} />;
  else {
    const build = /^\/build\/([0-9a-f-]{36})$/.exec(path);
    const live = /^\/live\/([0-9a-f-]{36})$/.exec(path);
    if (build) page = <Builder key={build[1]} id={build[1]} me={me} />;
    else if (live) page = <Workspace key={live[1]} id={live[1]} me={me} onUsage={load} />;
    else if (path === '/new') page = <NewDemo me={me} />;
    else page = <Home me={me} onChange={load} />;
  }
  return (
    <div className="rx">
      {page}
      <Toaster />
    </div>
  );
}

export function RxTop({ me, children }: { me: Me | null; children?: React.ReactNode }) {
  const out = async () => {
    await demoApi('/session', { method: 'DELETE' }).catch(() => {});
    location.assign(R);
  };
  return (
    <div className="top rx-top">
      <Link to={R} className="brand">
        n.abl <b>Demo</b>
      </Link>
      {children}
      <span className="spacer" />
      {me ? (
        <>
          <span className="muted small">
            {me.person_name}
            {me.company ? `, ${me.company}` : ''}
          </span>
          <button type="button" className="ghost small" onClick={out}>
            Sign out
          </button>
        </>
      ) : null}
    </div>
  );
}

// ── The door ────────────────────────────────────────────────────────────

function Door({ onIn }: { onIn: (me: Me) => void }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enter = useCallback(
    async (k: string) => {
      setBusy(true);
      setError(null);
      try {
        const me = await demoApi<Me>('/session', { method: 'POST', json: { key: k } });
        onIn(me);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [onIn],
  );

  // The one-click link carries the key after the #, which no server ever sees. Use it once, then wipe it.
  useEffect(() => {
    const fromHash = () => {
      const m = /[#&]key=([^&]+)/.exec(location.hash);
      if (!m) return;
      const k = decodeURIComponent(m[1]);
      history.replaceState(null, '', location.pathname + location.search);
      setKey(k);
      void enter(k);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [enter]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void enter(key);
  };

  return (
    <>
      <RxTop me={null} />
      <main className="rx-main rx-door">
        <section className="panel door">
          <h1>Your private demo</h1>
          <p className="muted">
            Build an AI receptionist for your own business in a few minutes, then ring it. Enter the key from our email to begin.
          </p>
          <form onSubmit={submit}>
            <label htmlFor="demo-key">Demo key</label>
            <input
              id="demo-key" className="mono key-input" autoComplete="off" autoCapitalize="characters" spellCheck={false}
              placeholder="DEMO-XXXX-XXXX-XXXX" required value={key} onChange={(e) => setKey(e.target.value)} autoFocus
            />
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <button className="primary" type="submit" disabled={busy}>
              {busy ? 'Checking…' : 'Open my demo'}
            </button>
          </form>
          <p className="hint">
            No key? This page is for people we have invited. Ask us at <a href="https://nabl.agency">nabl.agency</a>.
          </p>
        </section>
      </main>
    </>
  );
}

// ── Home: their demos ───────────────────────────────────────────────────

function Home({ me, onChange }: { me: Me; onChange: () => void }) {
  const workspaces = me.workspaces ?? [];
  const remove = async (w: WorkspaceSummary) => {
    if (!confirm(`Delete ${w.name || 'this demo'}? Its bookings, orders and calls go with it.`)) return;
    try {
      await demoApi(`/workspaces/${w.id}`, { method: 'DELETE' });
      onChange();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const first = me.person_name.split(/\s+/)[0];
  return (
    <>
      <RxTop me={me} />
      <main className="rx-main">
        <section className="intro">
          <h1>Welcome, {first}.</h1>
          <p>
            Your private demo{me.company ? ` for ${me.company}` : ''}. Nothing you set up here is shared. Your key works until{' '}
            <b>{longDate(me.expires_at)}</b>.
          </p>
        </section>

        <div className="rx-usage">
          <span className="badge info">{Math.max(0, me.limits.call_minutes_per_day - me.used.call_minutes)} call minutes left today</span>
          <span className="badge">{me.used.workspaces} of {me.limits.workspaces} demos</span>
        </div>

        <div className="tenants">
          {workspaces.map((w) => (
            <article key={w.id} className="panel tenant-card" style={w.accent ? ({ '--accent': w.accent } as React.CSSProperties) : undefined}>
              <h3>{w.name || 'Untitled restaurant'}</h3>
              <p>{w.started_at ? 'Live: ring it, and watch the back office.' : 'Being set up. Finish the steps, then press Start.'}</p>
              <div className="row">
                {w.started_at ? (
                  <Link to={`${R}/live/${w.id}`} className="button primary">Open</Link>
                ) : null}
                <Link to={`${R}/build/${w.id}`} className={`button ${w.started_at ? '' : 'primary'}`}>
                  {w.started_at ? 'Edit setup' : 'Continue setting up'}
                </Link>
                <span className="spacer" />
                <button type="button" className="ghost small" onClick={() => remove(w)} aria-label={`Delete ${w.name}`}>
                  Delete
                </button>
              </div>
            </article>
          ))}
          {workspaces.length < me.limits.workspaces ? (
            <Link to={`${R}/new`} className="panel tenant-card new-card">
              <span className="plus" aria-hidden="true">+</span>
              <h3>Build a new demo</h3>
              <p>Pick your kind of business. Start from our defaults, or from your own website.</p>
            </Link>
          ) : null}
        </div>
      </main>
    </>
  );
}

// ── New: pick a preset, optionally a website ────────────────────────────

function NewDemo({ me }: { me: Me }) {
  const [presets, setPresets] = useState<PresetInfo[] | null>(null);
  const [chosen, setChosen] = useState<PresetInfo | null>(null);
  const [name, setName] = useState(me.company ?? '');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    demoApi<{ presets: PresetInfo[] }>('/presets').then((r) => setPresets(r.presets)).catch((e: Error) => toast(e.message));
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!chosen) return;
    setBusy(true);
    try {
      const w = await demoApi<WorkspacePayload>('/workspaces', { method: 'POST', json: { preset: chosen.key, name, website: website.trim() || undefined } });
      navigate(`${R}/build/${w.id}${website.trim() ? '?scan=1' : ''}`);
    } catch (err) {
      toast((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <RxTop me={me} />
      <main className="rx-main">
        <section className="intro">
          <h1>What kind of business?</h1>
          <p>Each one sets up the receptionist, the booking system and the back office the way that business works.</p>
        </section>
        <div className="presets" role="radiogroup" aria-label="Kind of business">
          {presets?.map((p) => (
            <button
              type="button" role="radio" aria-checked={chosen?.key === p.key} key={p.key} disabled={p.status !== 'live'}
              className={`panel preset ${chosen?.key === p.key ? 'chosen' : ''}`} onClick={() => setChosen(p)}
            >
              <span className="preset-head">
                <b>{p.label}</b>
                {p.status === 'soon' ? <span className="badge">Coming soon</span> : <span className="badge ok">Ready</span>}
              </span>
              <span className="muted">{p.blurb}</span>
              <span className="covers">{p.covers.join(' · ')}</span>
            </button>
          ))}
        </div>

        {chosen ? (
          <form className="panel new-form" onSubmit={create}>
            <h2>Your {chosen.label.toLowerCase()}</h2>
            <label htmlFor="new-name">Name</label>
            <input id="new-name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Lucas Kitchen" />
            <label htmlFor="new-site">Your website <span className="muted">(optional)</span></label>
            <input id="new-site" type="url" inputMode="url" placeholder="https://www.your-restaurant.co.uk" value={website} onChange={(e) => setWebsite(e.target.value)} />
            <p className="hint">
              With a website, we read its public pages to fill in your menu, hours, colours and fonts, and mark everything we found so you can check it.
              Without one, you start from sensible defaults.
            </p>
            <div className="row">
              <button className="primary" type="submit" disabled={busy}>
                {busy ? 'Creating…' : website.trim() ? 'Build from my website' : 'Build from the preset'}
              </button>
            </div>
          </form>
        ) : null}
      </main>
    </>
  );
}
