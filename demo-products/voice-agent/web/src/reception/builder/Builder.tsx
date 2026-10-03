// The builder: the preset's steps with a live preview, then Review and
// start. Every change saves itself (debounced) and comes back validated, so
// the preview and the list of what is still missing are always the server's
// view, not a guess. Which steps there are, and what each shows, comes from
// the preset's builder (registry.ts).

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import { Link, navigate } from '../../router.tsx';
import { R, RxTop, expiryLine } from '../Reception.tsx';
import { brandStyle } from '../brand.ts';
import { unnamed } from '../nouns.ts';
import type { BaseAnswers, Me, WorkspacePayload } from '../types.ts';
import { Review } from './common/Review.tsx';
import { REVIEW, builderFor, type StepProps, type Update } from './registry.ts';
import { ScoutCard } from './Scout.tsx';

export function Builder({ id, me }: { id: string; me: Me }) {
  const [ws, setWs] = useState<WorkspacePayload | null>(null);
  const [answers, setAnswers] = useState<BaseAnswers | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [saving, setSaving] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef<BaseAnswers | null>(null);
  const edits = useRef(0);
  const scan = new URLSearchParams(location.search).get('scan') === '1';

  useEffect(() => {
    demoApi<WorkspacePayload>(`/workspaces/${id}`)
      .then((w) => {
        setWs(w);
        setAnswers(w.answers);
        latest.current = w.answers;
        document.title = `${w.name || unnamed(w.preset)} · setup · n.abl`;
      })
      .catch((e: Error) => toast(e.message));
    return () => clearTimeout(timer.current);
  }, [id]);

  const save = useCallback(async () => {
    const body = latest.current;
    if (!body) return;
    const at = edits.current;
    setSaving('saving');
    try {
      const w = await demoApi<WorkspacePayload>(`/workspaces/${id}/answers`, { method: 'PUT', json: body });
      setWs(w);
      // Take the server's cleaned answers only if nothing was typed meanwhile.
      if (edits.current === at) {
        setAnswers(w.answers);
        latest.current = w.answers;
      }
      setSaving(edits.current === at ? 'saved' : 'pending');
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        timer.current = setTimeout(save, 1000);
        return;
      }
      setSaving('error');
      toast((e as Error).message);
    }
  }, [id]);

  const set: Update = useCallback(
    (fn) => {
      setAnswers((prev) => {
        if (!prev) return prev;
        const next = structuredClone(prev);
        fn(next);
        latest.current = next;
        return next;
      });
      edits.current++;
      setSaving('pending');
      clearTimeout(timer.current);
      timer.current = setTimeout(save, 900);
    },
    [save],
  );

  /** Save now (before leaving, or before Start). */
  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (saving === 'pending' || saving === 'error') await save();
  }, [save, saving]);

  if (!ws || !answers) {
    return (
      <>
        <RxTop me={me} />
        <main className="rx-main"><p className="empty">Loading your setup…</p></main>
      </>
    );
  }

  const def = builderFor(ws.preset);
  if (!def) {
    return (
      <>
        <RxTop me={me} />
        <main className="rx-main"><p className="empty">This kind of business isn't ready yet.</p></main>
      </>
    );
  }
  const steps = [...def.steps.filter((s) => def.show?.[s.key]?.(answers) ?? true), REVIEW];
  const i = Math.max(0, steps.findIndex((s) => s.key === step));
  const current = steps[i];
  const issuesFor = (k: string) => ws.issues.filter((x) => x.step === k);
  const go = (k: string) => {
    void flush();
    setStep(k);
    window.scrollTo(0, 0);
  };
  const props: StepProps = { a: answers, set, ws, me, issues: ws.issues, go };
  const style = brandStyle(answers.theme);

  return (
    <div className="builder-page" style={style}>
      <div className="accent-bar" />
      <RxTop me={me}>
        <span className="crumb">
          <b>{answers.basics.name || unnamed(ws.preset)}</b> <span className="muted">· setup</span>
        </span>
        {ws.expires_at ? <span className="expiry small">{expiryLine(ws)}</span> : null}
        <span className={`save-state ${saving}`} aria-live="polite">
          {saving === 'saving' ? 'Saving…' : saving === 'pending' ? 'Unsaved changes' : saving === 'saved' ? 'All changes saved' : saving === 'error' ? 'Not saved' : ''}
        </span>
        {ws.started_at ? (
          <Link to={`${R}/live/${id}`} className="button" onClick={() => void flush()}>Back to my demo</Link>
        ) : null}
      </RxTop>

      <main className={`rx-main builder ${def.wide?.[current.key] ? 'wide-step' : ''}`}>
        <nav className="steps" aria-label="Setup steps">
          <ol>
            {steps.map((s, n) => {
              const errs = issuesFor(s.key).filter((x) => x.level === 'error').length;
              return (
                <li key={s.key}>
                  <button type="button" aria-current={s.key === current.key ? 'step' : undefined} onClick={() => go(s.key)}>
                    <span className="n">{n + 1}</span>
                    <span>{s.label}</span>
                    {errs ? <span className="badge bad">{errs}</span> : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <section className="step panel" aria-labelledby="step-title">
          {scan && answers.basics.website ? <ScoutCard id={id} website={answers.basics.website} onApplied={(w) => { setWs(w); setAnswers(w.answers); latest.current = w.answers; }} /> : null}
          <header>
            <h1 id="step-title">{current.label}</h1>
            <span className="muted small">Step {i + 1} of {steps.length}</span>
          </header>
          {issuesFor(current.key).length ? (
            <ul className="issues">
              {issuesFor(current.key).map((x, n) => (
                <li key={n} className={x.level}>{x.message}</li>
              ))}
            </ul>
          ) : null}

          {current.key === REVIEW.key
            ? <Review {...props} copy={def.review} flush={flush} onStarted={() => navigate(`${R}/live/${id}`)} />
            : def.render[current.key](props)}

          <footer className="step-nav">
            {i > 0 ? <button type="button" onClick={() => go(steps[i - 1].key)}>Back</button> : <span />}
            {i < steps.length - 1 ? (
              <button type="button" className="primary" onClick={() => go(steps[i + 1].key)}>
                Next: {steps[i + 1].label}
              </button>
            ) : null}
          </footer>
        </section>

        <aside className="preview panel" aria-label="What the receptionist will say">
          <h2>Preview</h2>
          {ws.preview ? (def.preview ? def.preview(answers, ws) : <PreviewLines preview={ws.preview} />) : null}
        </aside>
      </main>
    </div>
  );
}

/** A preset with no preview of its own: the greeting, then its lines as they come. */
function PreviewLines({ preview }: { preview: NonNullable<WorkspacePayload['preview']> }) {
  return (
    <>
      {preview.greeting ? <p className="say">“{preview.greeting}”</p> : null}
      {preview.hours ? <p className="small"><b>Hours.</b> {preview.hours}</p> : null}
      {(preview.lines ?? []).map((line, n) => <p className="small" key={n}>{line}</p>)}
      {preview.core_facts?.length ? (
        <>
          <p className="small muted">What it tells callers first:</p>
          <ul className="facts">
            {preview.core_facts.map((f, n) => <li key={n}>{f}</li>)}
          </ul>
        </>
      ) : null}
    </>
  );
}
