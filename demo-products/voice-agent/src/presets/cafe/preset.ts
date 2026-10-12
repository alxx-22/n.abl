// The café as the server sees it: the hooks of PRESETS.md §2.2, from the
// files beside this one (presets/cafe.md).

import type { TenantProfile } from '../../domain/types.ts';
import { applyBaseScan } from '../../scout/map.ts';
import { hoursSentence } from '../common/hours.ts';
import { menuItems } from '../food/menu.ts';
import { joinTables } from '../seating/tables.ts';
import type { Preset, PreviewPayload, WorkspaceSpec } from '../index.ts';
import { VERSION, defaultAnswers, type CafeAnswers } from './answers.ts';
import { bookingSentence, compileCafe, teaSentence } from './compile.ts';
import { planCafeSeed } from './seed.ts';
import { STEPS } from './steps.ts';
import { sanitiseCafe, validateCafe } from './validate.ts';

/** What the receptionist does itself, so the FAQ draft leaves it out. */
export const CAFE_HANDLES = 'booking a table for a group or afternoon tea, and answering about the menu and allergens';

/** The builder's preview pane: what the receptionist will know, line by line. */
export function cafePreview(a: CafeAnswers, profile: TenantProfile): PreviewPayload {
  const rs = profile.booking?.resources ?? [];
  const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
  // Which tables a group fits, which take afternoon tea, and which are never booked.
  const groups = rs.filter((r) => r.services.includes('table') && (r.capacity ?? 0) >= a.booking.min_party);
  const joined = groups.filter((r) => r.combines?.length).length;
  const single = groups.length - joined;
  const teas = rs.filter((r) => r.layout && r.services.includes('afternoon_tea')).length;
  const walkIn = rs.filter((r) => r.layout && !r.services.length).length;
  const dishes = profile.menu?.categories.reduce((n, c) => n + c.items.length, 0) ?? 0;
  return {
    lines: [
      profile.greeting,
      ...profile.core_facts,
      `Groups of ${a.booking.min_party} or more: ${single ? `${count(single, 'table')} seat${single === 1 ? 's' : ''} them` : 'no table seats them'}${joined ? `, or ${count(joined, 'pair')} joined` : ''}.`,
      [teas ? `Afternoon tea at ${count(teas, 'table')}.` : null, walkIn ? `${count(walkIn, 'table')} walk-in only.` : null, `${count(dishes, 'item')} on the menu.`].filter(Boolean).join(' '),
    ],
  };
}

/** What the FAQ draft is told about the café: its own answers, as plain facts. */
export function factSheet(a: CafeAnswers): string {
  const p = a.policies;
  return [
    `Name: ${a.basics.name || 'the café'}. Style: ${a.basics.style}. Town: ${a.basics.town}${a.basics.address ? `, ${a.basics.address}` : ''}.`,
    `Hours: ${hoursSentence(a.hours)}`,
    bookingSentence(a),
    teaSentence(a) ?? 'No afternoon tea.',
    `Menu: ${menuItems(a.menu).slice(0, 20).map((i) => i.name).join(', ')}.`,
    `Dogs: ${p.dogs.replace('_', ' ')}. Children: ${p.children} Access: ${p.accessibility} Wi-Fi: ${p.wifi} Laptops: ${p.laptops} Parking: ${p.parking}`,
    `Cash: ${a.money.cash ? 'yes' : 'card only'}. ${a.money.tips} Cups: ${p.reusable_cups} Hire: ${p.hire} Jobs: ${p.careers}`,
  ].join('\n');
}

/** The café's back office (presets/cafe.md §6): the floor plan and the day's bookings, then messages and calls. */
export function cafeWorkspace(profile: TenantProfile): WorkspaceSpec {
  const tea = profile.booking?.services.some((s) => s.key === 'afternoon_tea');
  return {
    views: [
      { id: 'floor', label: 'Floor plan' },
      { id: 'timeline', label: 'Bookings' },
      { id: 'messages', label: 'Messages' },
      { id: 'calls', label: 'Calls' },
    ],
    bookings: {
      resource: 'table',
      resources: 'tables',
      party: 'Party',
      visit: { expected: 'Expected', arrived: 'Arrived', seated: 'Seated', finished: 'Finished', no_show: 'No-show' },
      allergies: true,
      combine: true,
    },
    suggestions: [
      ...(tea ? ['Can I book afternoon tea for four on Saturday? One of us is coeliac.'] : []),
      'Can six of us book a table for lunch on Saturday?',
      'My daughter has a nut allergy: which cakes can she have?',
      'Is the brownie gluten-free?',
    ],
    resetLine: 'bookings',
    clock: true,
  };
}

export const cafe: Omit<Preset<CafeAnswers>, 'info'> = {
  VERSION,
  defaults: defaultAnswers,
  sanitise: sanitiseCafe,
  steps: STEPS,
  validate: validateCafe,
  compile: compileCafe,
  seed: planCafeSeed,
  preview: cafePreview,
  factSheet,
  handles: CAFE_HANDLES,
  scan: { parts: ['identity', 'hours', 'theme'], apply: applyBaseScan },
  workspace: cafeWorkspace,
  combineTables: (a, x, y) => ({ ...a, seating: { ...a.seating, tables: joinTables(a.seating.tables, x, y) } }),
};
