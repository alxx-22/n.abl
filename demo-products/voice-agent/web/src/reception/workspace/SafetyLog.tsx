// The safety log (presets/property-maintenance.md §6): every gas, carbon
// monoxide, fire and electrical call, when the advice was given and by which
// version of the script, and the job that followed. "Not confirmed as said"
// means the receptionist fetched the script but no transcript showed it
// saying the advice and the number.

import type { LiveState } from '../types.ts';
import { hhmm } from './maintenance.ts';

export function SafetyLog({ state }: { state: LiveState }) {
  const tz = state.tenant.timezone;
  const all = state.incidents ?? [];
  if (!all.length) return <p className="empty">No safety calls yet. Try "There's a strong smell of gas in my kitchen" on the call.</p>;
  const jobs = new Map((state.jobs ?? []).map((j) => [j.reference, j]));
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz });
  return (
    <table className="safety-log">
      <thead>
        <tr><th scope="col">When</th><th scope="col">What</th><th scope="col">Advice given</th><th scope="col">Follow-up</th></tr>
      </thead>
      <tbody>
        {all.map((i) => {
          const follow = i.follow_up_job ? jobs.get(i.follow_up_job) : undefined;
          return (
            <tr key={i.id}>
              <td>{day(i.created_at)}<span className="muted small block">{hhmm(i.created_at, tz)}</span></td>
              <td>
                <b>{i.title}</b>
                <span className="small block">{i.address ?? 'Address not taken'}{i.caller_phone ? ` · ${i.caller_phone}` : ''}</span>
                {i.number ? <span className="small muted block">Number given: {i.number}</span> : null}
              </td>
              <td>
                {i.advised_at
                  ? <><span className="badge ok">Said at {hhmm(i.advised_at, tz)}</span><span className="small muted block">Script v{i.advice_version}</span></>
                  : <span className="badge bad">Not confirmed as said</span>}
              </td>
              <td>{i.follow_up_job ? <>{i.follow_up_job}<span className="small muted block">{follow ? `${follow.trade_label}, ${follow.status.replace(/_/g, ' ')}` : ''}</span></> : <span className="muted small">None yet</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
