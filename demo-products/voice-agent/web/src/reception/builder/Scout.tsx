// "Build from my website": shown at the top of the builder when the prospect
// gave a website. The scout reads the site on the server; this card shows its
// progress, then what it found, and asks "Is this you?" before anything is
// used. Nothing is applied without a click.

import { useEffect, useRef, useState } from 'react';
import { demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import type { WorkspacePayload } from '../types.ts';

export interface ScanView {
  id: string;
  status: 'running' | 'done' | 'failed';
  stage: string;
  pages: number;
  error: string | null;
  found: {
    identity: { name: string | null; address: string | null; phone: string | null; town: string | null; logo: string | null; description: string | null };
    hours: { days: number; sentence: string } | null;
    menu: { dishes: number; priced: number; sections: string[]; source: string | null } | null;
    theme: { accent: string; primary: string; background: string; font_heading: string; font_body: string } | null;
    services: string[];
    policies: string[];
    faqs: number;
  } | null;
}

type Part = 'identity' | 'hours' | 'menu' | 'theme' | 'services' | 'policies';

export function ScoutCard({ id, website, onApplied }: { id: string; website: string; onApplied: (w: WorkspacePayload) => void }) {
  const [scan, setScan] = useState<ScanView | null>(null);
  const [closed, setClosed] = useState(false);
  const [use, setUse] = useState<Record<Part, boolean>>({ identity: true, hours: true, menu: true, theme: true, services: true, policies: true });
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const r = await demoApi<{ scan: ScanView | null }>(`/workspaces/${id}/scout`);
        if (stop) return;
        if (!r.scan) {
          const s = await demoApi<{ scan: ScanView }>(`/workspaces/${id}/scout`, { method: 'POST', json: { url: website } });
          if (!stop) setScan(s.scan);
        } else setScan(r.scan);
        if (!r.scan || r.scan.status === 'running') timer.current = setTimeout(poll, 1500);
      } catch (e) {
        if (!stop) setScan({ id: '', status: 'failed', stage: '', pages: 0, error: (e as Error).message, found: null });
      }
    };
    void poll();
    return () => {
      stop = true;
      clearTimeout(timer.current);
    };
  }, [id, website]);

  const dismiss = () => {
    setClosed(true);
    history.replaceState(null, '', location.pathname);
  };

  const apply = async () => {
    setBusy(true);
    try {
      const w = await demoApi<WorkspacePayload>(`/workspaces/${id}/scout/apply`, { method: 'POST', json: { scan: scan!.id, use } });
      onApplied(w);
      toast('Filled in from your website. Everything we found is marked, so you can check it step by step.');
      dismiss();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (closed || !scan) return closed ? null : <div className="scout panel"><p className="muted">Starting to read {website}…</p></div>;
  const host = (() => { try { return new URL(/^https?:/.test(website) ? website : `https://${website}`).host; } catch { return website; } })();

  if (scan.status === 'running') {
    return (
      <div className="scout panel running" role="status">
        <span className="spinner" aria-hidden="true" />
        <div>
          <b>Reading {host}</b>
          <p className="muted small">{scan.stage || 'Starting…'}{scan.pages ? ` · ${scan.pages} pages so far` : ''}. Usually under a minute. You can carry on meanwhile.</p>
        </div>
      </div>
    );
  }
  if (scan.status === 'failed' || !scan.found) {
    return (
      <div className="scout panel failed" role="alert">
        <div>
          <b>We could not read {host}</b>
          <p className="muted small">{scan.error ?? 'The site did not answer.'} No harm done: the preset’s defaults are in place, and you can fill in your own details below.</p>
        </div>
        <button type="button" onClick={dismiss}>Carry on</button>
      </div>
    );
  }

  const f = scan.found;
  const rows: { part: Part; label: string; detail: React.ReactNode; show: boolean }[] = [
    { part: 'identity', label: 'Name and contact', detail: [f.identity.name, f.identity.address, f.identity.phone].filter(Boolean).join(' · ') || 'nothing clear', show: Boolean(f.identity.name || f.identity.address || f.identity.phone) },
    { part: 'hours', label: 'Opening hours', detail: f.hours?.sentence, show: Boolean(f.hours) },
    { part: 'menu', label: 'Menu', detail: f.menu ? `${f.menu.dishes} dishes in ${f.menu.sections.length} sections${f.menu.priced < f.menu.dishes ? `; ${f.menu.dishes - f.menu.priced} without a price on the site` : ''}` : null, show: Boolean(f.menu?.dishes) },
    {
      part: 'theme', label: 'Colours and fonts', show: Boolean(f.theme),
      detail: f.theme ? (
        <span className="swatches">
          {[f.theme.primary, f.theme.accent, f.theme.background].map((c, i) => <span key={i} className="swatch" style={{ background: c }} title={c} />)}
          <span>{f.theme.font_heading}{f.theme.font_body !== f.theme.font_heading ? ` and ${f.theme.font_body}` : ''}</span>
        </span>
      ) : null,
    },
    { part: 'services', label: 'How you serve', detail: f.services.join(', '), show: f.services.length > 0 },
    { part: 'policies', label: 'Policies and questions', detail: `${[...f.policies, f.faqs ? `${f.faqs} questions` : ''].filter(Boolean).join(', ')}`, show: f.policies.length > 0 || f.faqs > 0 },
  ];

  return (
    <div className="scout panel done">
      <div className="is-this-you">
        {f.identity.logo ? <img src={f.identity.logo} alt="" className="logo-preview" /> : null}
        <div>
          <b>Is this you?</b>
          <p className="small">
            <b>{f.identity.name ?? host}</b>
            {f.identity.town ? `, ${f.identity.town}` : ''}. {f.identity.description ?? ''}
          </p>
        </div>
      </div>
      <p className="muted small">From {scan.pages} pages of {host}. Tick what to use; everything is marked in the steps below so you can check it.</p>
      <ul className="found">
        {rows.filter((r) => r.show).map((r) => (
          <li key={r.part}>
            <label>
              <input type="checkbox" checked={use[r.part]} onChange={(e) => setUse({ ...use, [r.part]: e.target.checked })} />
              <b>{r.label}</b>
            </label>
            <span className="muted small">{r.detail}</span>
          </li>
        ))}
      </ul>
      <div className="row-tools">
        <button type="button" className="primary" onClick={apply} disabled={busy || !Object.values(use).some(Boolean)}>{busy ? 'Filling in…' : 'Yes, use these'}</button>
        <button type="button" onClick={dismiss}>Not us: keep the preset</button>
      </div>
    </div>
  );
}
