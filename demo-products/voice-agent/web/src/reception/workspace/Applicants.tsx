// An estate agency's buyers: everyone on its list, newest contact first,
// with what they want, their position, whether they said yes to texts about
// new homes (and when), and how many homes on the market fit them now.

import type { LiveState } from '../types.ts';
import { positionBadges, when } from './estate.ts';

export function Applicants({ state }: { state: LiveState }) {
  const buyers = [...(state.buyers ?? [])].sort((a, b) => (b.last_contact ?? '').localeCompare(a.last_contact ?? ''));
  if (!buyers.length) return <p className="empty">No buyers yet. The receptionist registers them on the phone.</p>;
  const tz = state.tenant.timezone;
  const alerts = buyers.filter((b) => b.alerts).length;
  return (
    <div className="ws-messages applicants">
      <h3>{buyers.length} buyer{buyers.length === 1 ? '' : 's'} · {alerts} with alerts on</h3>
      {buyers.map((b) => (
        <div className="message applicant" key={b.phone}>
          <span><span className="from">{b.name ?? 'A buyer'}</span><span className="muted"> · {b.phone}</span></span>
          <span>{b.wants ? `Wants ${b.wants}` : 'No search noted yet'}{b.timescale ? `, ${b.timescale}` : ''}.</span>
          <div className="badges">
            {positionBadges(b.position ?? undefined).map((x) => <span key={x} className="badge">{x}</span>)}
            <span className={`badge ${b.alerts ? 'ok' : ''}`} title={b.alerts && b.consent_at ? `Said yes on ${when(b.consent_at, tz)}` : 'Never texted about new homes'}>
              {b.alerts ? 'Alerts on' : 'No alerts'}
            </span>
            {b.investor ? <span className="badge">Investor</span> : null}
            {b.backup_for.map((h) => <span key={h} className="badge warn">Back-up buyer: {h}</span>)}
          </div>
          <span className="muted small">
            {b.matches ? <b>{b.matches} home{b.matches === 1 ? ' fits' : 's fit'} now. </b> : null}
            {b.last_contact && b.last_contact <= state.now ? `Last in touch ${when(b.last_contact, tz)}` : ''}{b.source ? ` · ${b.source}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
