// The barber as the server sees it: the hooks of PRESETS.md §2.2, from the
// files beside this one (presets/barber.md).

import type { TenantProfile } from '../../domain/types.ts';
import { applyBaseScan } from '../../scout/map.ts';
import { hoursSentence } from '../common/hours.ts';
import type { Preset, PreviewPayload, WorkspaceSpec } from '../index.ts';
import { VERSION, defaultAnswers, type BarberAnswers } from './answers.ts';
import { SKIN_TEST_KEY } from '../../domain/shop-floor.ts';
import { compileBarber, depositSentence, teamSentence } from './compile.ts';
import { sanitiseBarber } from './sanitise.ts';
import { planBarberSeed } from './seed.ts';
import { STEPS } from './steps.ts';
import { validateBarber } from './validate.ts';

/** What the receptionist does itself, so the FAQ draft leaves it out. */
export const BARBER_HANDLES = 'booking, moving and cancelling appointments with any barber or a named one, and saying the prices';

/** The builder's preview pane: what the receptionist will know, line by line. */
export function barberPreview(a: BarberAnswers, profile: TenantProfile): PreviewPayload {
  const services = profile.booking?.services.filter((s) => s.key !== SKIN_TEST_KEY).length ?? 0;
  const barbers = profile.booking?.resources.length ?? 0;
  return {
    lines: [
      profile.greeting,
      ...profile.core_facts,
      `${services} service${services === 1 ? '' : 's'} on the price list, booked with ${barbers} barber${barbers === 1 ? '' : 's'}.`,
    ],
  };
}

/** What the FAQ draft is told about the shop: its own answers, as plain facts. */
export function factSheet(a: BarberAnswers): string {
  return [
    `Name: ${a.basics.name || 'the barber shop'}. Style: ${a.basics.style}. Town: ${a.basics.town}${a.basics.address ? `, ${a.basics.address}` : ''}.`,
    `Hours: ${hoursSentence(a.hours)}`,
    teamSentence(a),
    `Prices: ${a.services.map((s) => `${s.name} ${s.from ? 'from ' : ''}£${(s.price_pence / 100).toFixed(2)}`).join(', ')}.`,
    depositSentence(a),
    `Walk-ins: ${a.booking.walk_ins ? 'welcome when a chair is free' : 'no, appointments only'}. Kids: ${a.booking.kids_under ? `kids' price under ${a.booking.kids_under}` : 'no kids\' price'}${a.booking.under_16_with_adult ? '; under-16s with an adult' : ''}.`,
    `Access: ${a.policies.access} Parking: ${a.policies.parking} Products: ${a.policies.products} Tips: ${a.policies.tips} Jobs: ${a.policies.careers} Home visits: ${a.policies.home_visits}`,
  ].join('\n');
}

/** The barber's back office (presets/barber.md §6): the day's Diary, a row per barber, the shop floor, then messages and calls. */
export function barberWorkspace(profile: TenantProfile): WorkspaceSpec {
  const first = profile.booking?.resources[0]?.label ?? 'Marcus';
  return {
    views: [
      { id: 'timeline', label: 'Diary', of: 'staff' },
      { id: 'queue', label: 'Queue' },
      { id: 'today', label: 'Today' },
      { id: 'waitlist', label: 'Waiting list' },
      { id: 'messages', label: 'Messages' },
      { id: 'calls', label: 'Calls' },
    ],
    bookings: {
      resource: 'barber', resources: 'barbers', party: null,
      visit: { expected: 'Booked', arrived: 'In the chair', finished: 'Done', no_show: 'No-show' },
      allergies: false, combine: false,
    },
    suggestions: [
      `Can I get a skin fade with ${first} on Saturday morning?`,
      'Is anyone free for a cut tomorrow afternoon?',
      "Do you cut women's hair? I want a short back and sides.",
      "I need to cancel tomorrow's (Call as Ollie)",
    ],
    resetLine: 'bookings',
    clock: true,
  };
}

export const barber: Omit<Preset<BarberAnswers>, 'info'> = {
  VERSION,
  defaults: defaultAnswers,
  sanitise: sanitiseBarber,
  steps: STEPS,
  validate: validateBarber,
  compile: compileBarber,
  seed: planBarberSeed,
  preview: barberPreview,
  factSheet,
  handles: BARBER_HANDLES,
  scan: { parts: ['identity', 'hours', 'theme'], apply: applyBaseScan },
  workspace: barberWorkspace,
};
