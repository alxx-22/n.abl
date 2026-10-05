// Property maintenance as the server sees it: the hooks of PRESETS.md §2.2
// (presets/property-maintenance.md §3 and §6). The builder's preview lists
// lines; the back office is the jobs board, the dispatch diary, the
// properties and their certificates, the safety log, messages and calls.
// Properties are never imported from a website: a real address next to
// invented jobs would point at a real home.

import { toLocal, weekdayOf } from '../../domain/time.ts';
import type { TenantProfile } from '../../domain/types.ts';
import { applyBaseScan } from '../../scout/map.ts';
import type { Preset, WorkspaceSpec } from '../index.ts';
import { hoursSentence } from '../common/hours.ts';
import { VERSION, defaultAnswers, inSentence, type MaintenanceAnswers } from './answers.ts';
import { NOUN, areaSentence, calloutSentence, compileMaintenance, emergencySentence, firstName, plannedSentence, windowWords } from './compile.ts';
import { MT_NATION_PACKS, safetyScript } from './nations.ts';
import { sanitiseMaintenance } from './sanitise.ts';
import { planMaintenanceSeed } from './seed.ts';
import { STEPS } from './steps.ts';
import { validateMaintenance } from './validate.ts';

/** What the receptionist does itself, so the FAQ draft leaves it out. */
export const MAINTENANCE_HANDLES = 'emergencies and repairs, booking engineers, safety checks and quotes, and job updates';

const join = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0] ?? '');

/** The builder's preview pane: what the receptionist will say, and who it can send (rule 7: lines). */
export function maintenancePreview(a: MaintenanceAnswers, profile: TenantProfile, now = new Date()): { lines: string[] } {
  const n = a.engineers.length;
  const gas = a.engineers.filter((e) => e.gas_safe).length;
  const tonight = a.on_call.nights.find((x) => x.day === weekdayOf(toLocal(now, profile.timezone).date))?.engineers ?? [];
  const names = tonight.map((k) => a.engineers.find((e) => e.key === k)).filter((e) => e !== undefined).map(firstName);
  const windows = windowWords(a);
  return {
    lines: [
      profile.greeting,
      `${n} engineer${n === 1 ? '' : 's'}, ${gas} Gas Safe; ${names.length ? `on call tonight: ${join(names)}` : 'nobody on call tonight'}.`,
      windows ? `Windows: ${windows}.` : 'No visit windows yet.',
      emergencySentence(a),
      calloutSentence(a),
      // Built by the same code as safety_advice, so the preview shows the very words a caller hears.
      `A smell of gas: ${safetyScript('gas', a.area.nation).steps.join(' ')}`,
    ],
  };
}

/** What the FAQ draft is told about the business: its own answers, as plain facts, and no clients, properties or people's numbers. */
export function factSheet(a: MaintenanceAnswers): string {
  const trades = a.trades.filter((t) => t.on).map((t) => inSentence(t.label));
  const co = a.compliance;
  return [
    `Name: ${a.basics.name || 'the company'}. Style: ${a.basics.style}. Address: ${a.basics.address || a.basics.town}. Works in ${MT_NATION_PACKS[a.area.nation].name}.`,
    `Area: ${areaSentence(a)}`,
    `Office hours: ${hoursSentence(a.hours)} Out of hours, an engineer is on call for emergencies.`,
    `Trades: ${trades.join('; ')}. Doesn't do: ${a.dont_do.map((d) => `${d.what} (suggest ${d.suggest || 'someone else'})`).join(', ') || 'nothing listed'}.`,
    `Visits: ${windowWords(a)}. ${emergencySentence(a)}`,
    `Prices: ${calloutSentence(a)} ${plannedSentence(a)} Free quotes over £${a.prices.free_quote_over_pence / 100}. Guarantee: ${a.policies.guarantee}`,
    `Payment: ${a.policies.payment} Cancellation: ${a.prices.cancellation}`,
    `Accreditations: Gas Safe ${co.gas_safe_number || 'none'}${co.niceic ? ', NICEIC' : ''}${co.napit ? ', NAPIT' : ''}${co.oftec ? ', OFTEC' : ''}. Insurance: ${co.insurance}.`,
    `Asbestos: ${a.policies.asbestos} Parking: ${a.policies.parking} Careers: ${a.policies.careers}`,
  ].join('\n');
}

/**
 * The contractor's back office (presets/property-maintenance.md §6, the M1
 * views): the jobs board, the dispatch diary with a column per engineer,
 * properties and their certificates, the safety log, messages and calls.
 */
export function maintenanceWorkspace(profile: TenantProfile): WorkspaceSpec {
  return {
    views: [
      { id: 'jobs', label: 'Jobs' },
      { id: 'dispatch', label: 'Dispatch', of: 'engineer' },
      { id: 'compliance', label: 'Properties and compliance' },
      { id: 'safety', label: 'Safety log' },
      { id: 'messages', label: 'Messages' },
      { id: 'calls', label: 'Calls' },
    ],
    teamPhones: (profile.team ?? []).filter((t) => t.mobile).map((t) => ({ name: t.first_name, phone: t.mobile })),
    suggestions: [
      "There's a strong smell of gas in my kitchen.",
      "Water's coming through my ceiling.",
      'I need a gas safety check at 14 Elm Road.',
      "When's my engineer coming? Reference {ref}.",
      'Can you tell me how to reset my boiler?',
    ],
    resetLine: 'jobs, safety checks and incidents',
  };
}

export const propertyMaintenance: Omit<Preset<MaintenanceAnswers>, 'info'> = {
  VERSION,
  defaults: defaultAnswers,
  sanitise: sanitiseMaintenance,
  steps: STEPS,
  validate: validateMaintenance,
  compile: compileMaintenance,
  seed: planMaintenanceSeed,
  preview: (a, profile) => maintenancePreview(a, profile),
  factSheet,
  handles: MAINTENANCE_HANDLES,
  scan: { parts: ['identity', 'hours', 'theme'], apply: applyBaseScan },
  workspace: maintenanceWorkspace,
};

export { NOUN };
