// The property maintenance builder: its eleven steps with the server's own
// titles (src/presets/maintenance/steps.ts), and what Review says about it.
// The preview pane lists the server's lines (presets/property-maintenance.md §3).

import { STEPS, type MaintenanceStep } from '../../../../../src/presets/maintenance/steps.ts';
import type { MaintenanceAnswers } from '../../../../../src/presets/maintenance/answers.ts';
import { Basics } from '../common/Basics.tsx';
import type { BuilderDef } from '../registry.ts';
import { StepArea, StepCustomers, StepEngineers, StepPlanned, StepPolicies, StepPrices, StepPriorities, StepSafety, StepTrades, StepVisits } from './steps.tsx';

const NATIONS: Record<MaintenanceAnswers['area']['nation'], string> = { england: 'England', wales: 'Wales', scotland: 'Scotland', northern_ireland: 'Northern Ireland' };
const pounds = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

export const maintenanceBuilder: BuilderDef<MaintenanceAnswers, MaintenanceStep> = {
  steps: STEPS,
  render: {
    basics: (p) => (
      <Basics
        {...p}
        copy={{
          name: 'Company name',
          style: 'What you do',
          stylePlaceholder: 'Repairs and maintenance for homes, landlords and letting agents',
          styleHint: 'How the receptionist describes you.',
          accentHint: 'Your workspace, the jobs board and texts take this colour.',
        }}
      />
    ),
    area: (p) => <StepArea {...p} />,
    customers: (p) => <StepCustomers {...p} />,
    trades: (p) => <StepTrades {...p} />,
    engineers: (p) => <StepEngineers {...p} />,
    priorities: (p) => <StepPriorities {...p} />,
    safety: (p) => <StepSafety {...p} />,
    visits: (p) => <StepVisits {...p} />,
    prices: (p) => <StepPrices {...p} />,
    planned: (p) => <StepPlanned {...p} />,
    policies: (p) => <StepPolicies {...p} />,
  },
  review: {
    rows: (a) => [
      ['Company', <>{a.basics.name || <em>no name yet</em>}, {a.basics.town}</>],
      ['Area', `${NATIONS[a.area.nation]}: ${a.area.districts.join(', ') || 'no districts yet'}`],
      ['Trades', `${a.trades.filter((t) => t.on).length} on${a.dont_do.length ? `; not ${a.dont_do.map((d) => d.what).join(', ')}` : ''}`],
      ['Engineers', a.engineers.map((e) => `${e.name.split(/\s+/)[0] || 'unnamed'}${e.gas_safe ? ' (Gas Safe)' : ''}`).join(', ') || 'nobody yet'],
      ['Clients', a.clients.map((c) => c.name || 'unnamed').join(', ') || 'none'],
      ['Emergencies', `attend within ${a.priorities.emergency.attend_hours} hours, day and night`],
      ['Windows', a.visits.windows.map((w) => `${w.label} ${w.from}–${w.to}`).join(', ') || 'none yet'],
      ['Call-out', `${pounds(a.prices.callout_pence)}${a.prices.vat_registered ? ' including VAT' : ''}, with the first hour`],
      ['Gas safety record', pounds(a.planned.gas_record_pence)],
    ],
    start: 'Start builds your receptionist from these answers and fills a week of jobs, with 70 sample homes on made-up streets, their safety certificates and one gas call in the safety log.',
    restart: 'Your changes are saved and the receptionist already uses them. To refill the board to match (new engineers, trades or windows), reset the demo data.',
    ready: () => 'Ready: a week of jobs, the certificate register and the safety log, made from your setup.',
  },
};
