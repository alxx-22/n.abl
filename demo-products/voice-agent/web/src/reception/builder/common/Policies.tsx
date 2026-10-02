// Policies and questions, for any kind of business: the preset's own policy
// fields go in as children, then the common questions callers ask, which the
// AI can draft from everything set so far, for this kind of business.

import { useState, type ReactNode } from 'react';
import { demoApi } from '../../../api.ts';
import { toast } from '../../../components/Toaster.tsx';
import { presetInfo } from '../../../../../src/presets/catalogue.ts';
import { Source, Text } from '../fields.tsx';
import type { StepProps } from '../registry.ts';

/** "a restaurant", "an estate agency". */
const withArticle = (noun: string) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;

/** One written policy, saved under policies.<key>. */
export function PolicyText({ a, set, k, label, hint }: Pick<StepProps, 'a' | 'set'> & { k: string; label: string; hint?: string }) {
  const value = a.policies[k];
  return (
    <Text
      label={<>{label} <Source of={`policies.${k}`} sources={a.sources} /></>} area rows={2} max={300} value={typeof value === 'string' ? value : ''}
      onChange={(v) => set((d) => void (d.policies[k] = v))} hint={hint}
    />
  );
}

export function Policies({ a, set, ws, children }: StepProps & { children?: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const p = a.policies;
  const draft = async () => {
    setBusy(true);
    try {
      const { faqs } = await demoApi<{ faqs: { q: string; a: string }[] }>(`/workspaces/${ws.id}/faq-draft`, { method: 'POST', json: { answers: a } });
      const have = new Set(a.policies.faqs.map((f) => f.q.toLowerCase()));
      const fresh = faqs.filter((f) => !have.has(f.q.toLowerCase()));
      set((d) => void (d.policies.faqs = [...d.policies.faqs, ...fresh].slice(0, 20)));
      toast(`${fresh.length} questions drafted. Keep, edit or delete each one.`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fields">
      <p className="lead">Each becomes something the receptionist can answer. Short and in your own words is best.</p>
      {children}

      <h3 className="sub">Common questions</h3>
      {p.faqs.map((f, i) => (
        <div className="faq" key={i}>
          <input aria-label="Question" value={f.q} maxLength={150} onChange={(e) => set((d) => void (d.policies.faqs[i].q = e.target.value))} />
          <textarea aria-label="Answer" className="prose" rows={2} maxLength={500} value={f.a} onChange={(e) => set((d) => void (d.policies.faqs[i].a = e.target.value))} />
          <button type="button" className="ghost" aria-label="Remove this question" onClick={() => set((d) => void d.policies.faqs.splice(i, 1))}>✕</button>
        </div>
      ))}
      <div className="row-tools">
        <button type="button" className="primary" onClick={draft} disabled={busy}>{busy ? 'Drafting…' : 'Draft common questions'}</button>
        <button type="button" className="small" onClick={() => set((d) => void d.policies.faqs.push({ q: '', a: '' }))}>+ Add one</button>
      </div>
      <p className="hint">{`The AI proposes questions callers ask ${withArticle(presetInfo(ws.preset)?.noun ?? 'business')} like yours, answered only from what you have set.`}</p>
    </div>
  );
}
