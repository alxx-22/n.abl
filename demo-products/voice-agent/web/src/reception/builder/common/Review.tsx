// Review and start, the last step of every builder: a summary in the
// preset's words, what is still missing (each a link to its step), then
// Start, or Reset once the demo is running.

import { useState, type ReactNode } from 'react';
import { demoApi } from '../../../api.ts';
import { toast } from '../../../components/Toaster.tsx';
import type { BaseAnswers, WorkspacePayload } from '../../types.ts';
import type { ReviewCopy, StepProps } from '../registry.ts';

export function Review({ a, ws, go, copy, flush, onStarted }: StepProps & { copy: ReviewCopy<BaseAnswers>; flush: () => Promise<void>; onStarted: () => void }) {
  const [busy, setBusy] = useState(false);
  const errors = ws.issues.filter((i) => i.level === 'error');
  const warnings = ws.issues.filter((i) => i.level === 'warning');
  const start = async () => {
    setBusy(true);
    try {
      await flush();
      const r = await demoApi<{ bookings: number; orders: number; workspace: WorkspacePayload }>(`/workspaces/${ws.id}/${ws.started_at ? 'reset' : 'start'}`, { method: 'POST' });
      toast(copy.ready(r));
      onStarted();
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <div className="fields review">
      <dl className="summary">
        {copy.rows(a, ws).map(([label, value]) => (
          <Row key={label} label={label} value={value} />
        ))}
      </dl>
      {errors.length ? (
        <div className="issues-box bad">
          <b>Still to do before Start</b>
          <ul>{errors.map((x, i) => <li key={i}><button type="button" className="linkish" onClick={() => go(x.step)}>{x.message}</button></li>)}</ul>
        </div>
      ) : null}
      {warnings.length ? (
        <div className="issues-box">
          <b>Worth a look</b>
          <ul>{warnings.map((x, i) => <li key={i}><button type="button" className="linkish" onClick={() => go(x.step)}>{x.message}</button></li>)}</ul>
        </div>
      ) : null}
      <div className="start-box">
        <p>{ws.started_at ? copy.restart : copy.start}</p>
        <button type="button" className="primary big" disabled={busy || errors.length > 0} onClick={start}>
          {busy ? 'Building your demo…' : ws.started_at ? 'Reset the demo data' : 'Start my demo'}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
