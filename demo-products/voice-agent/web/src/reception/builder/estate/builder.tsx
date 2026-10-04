// The estate agent's builder: its nine steps with the server's own titles
// (src/presets/estate/steps.ts), and what Review says about it. The preview
// pane lists the server's lines (presets/estate-agent.md §3).

import { STEPS, type EstateStep } from '../../../../../src/presets/estate/steps.ts';
import type { DayHours } from '../../../../../src/presets/common/types.ts';
import type { EstateAnswers } from '../../../../../src/presets/estate/answers.ts';
import { Basics } from '../common/Basics.tsx';
import type { BuilderDef } from '../registry.ts';
import { StepListings, stockLine } from './Listings.tsx';
import { ROLES, StepHours, StepOffers, StepPatch, StepPolicies, StepServices, StepTeam, StepViewings } from './steps.tsx';

/** "Mon–Fri 09:00–17:30; Sat 09:00–16:00": days with the same hours run together, Monday first. */
function weekLine(days: DayHours[]): string {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const runs: { from: number; to: number; hours: string }[] = [];
  for (const d of [1, 2, 3, 4, 5, 6, 0]) {
    const day = days[d];
    const hours = day.open ? day.services.map((s) => `${s.open}–${s.close}`).join(', ') : '';
    const last = runs.at(-1);
    if (last && last.hours === hours) last.to = d;
    else runs.push({ from: d, to: d, hours });
  }
  return runs.filter((r) => r.hours).map((r) => `${names[r.from]}${r.to !== r.from ? `–${names[r.to]}` : ''} ${r.hours}`).join('; ') || 'closed all week';
}

const NATIONS: Record<EstateAnswers['patch']['nation'], string> = { england: 'England', wales: 'Wales', northern_ireland: 'Northern Ireland' };

export const estateBuilder: BuilderDef<EstateAnswers, EstateStep> = {
  steps: STEPS,
  render: {
    basics: (p) => (
      <Basics
        {...p}
        copy={{
          name: 'Agency name',
          style: 'What kind of agency',
          stylePlaceholder: 'Independent estate agency, sales only',
          styleHint: 'How the receptionist describes you.',
          accentHint: 'Your workspace, the diary and texts take this colour.',
        }}
      />
    ),
    patch: (p) => <StepPatch {...p} />,
    hours: (p) => <StepHours {...p} />,
    team: (p) => <StepTeam {...p} />,
    listings: (p) => <StepListings {...p} />,
    viewings: (p) => <StepViewings {...p} />,
    offers: (p) => <StepOffers {...p} />,
    services: (p) => <StepServices {...p} />,
    policies: (p) => <StepPolicies {...p} />,
  },
  review: {
    rows: (a) => [
      ['Agency', <>{a.basics.name || <em>no name yet</em>}, {a.basics.town}</>],
      ['Office', weekLine(a.hours.days)],
      ['Viewings', weekLine(a.diary.viewing_days)],
      ['Patch', `${NATIONS[a.patch.nation]}: ${a.patch.districts.join(', ') || 'no districts yet'}`],
      ['Team', a.team.map((t) => `${t.name.split(/\s+/)[0] || 'unnamed'} (${ROLES[t.role].toLowerCase()})`).join(', ') || 'nobody yet'],
      ['Homes', stockLine(a.listings)],
      ['Each viewing', `${a.viewings.minutes} minutes, ${a.viewings.travel_minutes} to travel, booked up to ${a.viewings.horizon_days} days ahead`],
      ['Offers', a.offers.take === 'record' ? 'recorded and read back, then passed to the negotiator' : 'taken as an urgent message'],
      ['Fees', a.fees.quote ? (a.fees.kind === 'percent' ? `${(a.fees.percent_hundredths / 100).toFixed(2).replace(/\.?0+$/, '')}% including VAT` : `£${(a.fees.fixed_pence / 100).toLocaleString('en-GB', { minimumFractionDigits: a.fees.fixed_pence % 100 ? 2 : 0, maximumFractionDigits: 2 })} including VAT`) : `explained at your ${a.valuations.name}`],
      ['Questions', <>{a.area.faqs.length} about the area and {a.policies.faqs.length} of your own</>],
    ],
    start: 'Start builds your receptionist from these answers and fills a fortnight of viewings, valuations, offers and sales, shaped by your own homes, team and hours.',
    restart: 'Your changes are saved and the receptionist already uses them. To refill the diary to match (new homes, team or hours), reset the demo data.',
    ready: (r) => `Ready: ${r.bookings} viewings and valuations this fortnight, made from your setup.`,
  },
};
