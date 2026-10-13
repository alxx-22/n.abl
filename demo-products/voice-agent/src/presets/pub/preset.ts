// The pub as the server sees it: the hooks of PRESETS.md §2.2, from the
// files beside this one (presets/pub.md).

import type { TenantProfile } from '../../domain/types.ts';
import { applyBaseScan } from '../../scout/map.ts';
import { hoursSentence } from '../common/hours.ts';
import { spokenTime } from '../../domain/time.ts';
import { menuItems } from '../food/menu.ts';
import { joinTables } from '../seating/tables.ts';
import type { Preset, PreviewPayload, WorkspaceSpec } from '../index.ts';
import { VERSION, defaultAnswers, type PubAnswers } from './answers.ts';
import { compilePub, foodSentence } from './compile.ts';
import { planPubSeed } from './seed.ts';
import { STEPS } from './steps.ts';
import { sanitisePub, validatePub } from './validate.ts';

/** What the receptionist does itself, so the FAQ draft leaves it out. */
export const PUB_HANDLES = 'booking a table for food, and answering about the menu, drinks and allergens';

/** The builder's preview pane: what the receptionist will know, line by line. */
export function pubPreview(a: PubAnswers, profile: TenantProfile): PreviewPayload {
  const rs = profile.booking?.resources.filter((r) => r.layout) ?? [];
  const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
  const booked = rs.filter((r) => r.services.includes('table')).length;
  const dishes = profile.menu?.categories.reduce((n, c) => n + c.items.length, 0) ?? 0;
  return {
    lines: [
      profile.greeting,
      ...profile.core_facts,
      `${count(booked, 'table')} can be booked; ${count(rs.length - booked, 'table')} first come or by enquiry. ${a.children.until ? `Children welcome until ${spokenTime(a.children.until)}.` : 'Children welcome any time.'} Dogs welcome everywhere.`,
      `${count(dishes, 'item')} on the menu and drinks list.`,
    ],
  };
}

/** What the FAQ draft is told about the pub: its own answers, as plain facts. */
export function factSheet(a: PubAnswers): string {
  const p = a.policies;
  return [
    `Name: ${a.basics.name || 'the pub'}. Style: ${a.basics.style}. Town: ${a.basics.town}${a.basics.address ? `, ${a.basics.address}` : ''}.`,
    `Hours: ${hoursSentence(a.hours)} ${foodSentence(a)}`,
    `Rooms: ${a.seating.areas.map((x) => x.label).join(', ')}. Children: ${p.children} Dogs: welcome everywhere.`,
    `Menu: ${menuItems(a.menu).slice(0, 20).map((i) => i.name).join(', ')}.`,
    `On tap: ${a.drinks.on_tap.join(', ')}.`,
    `ID: ${p.id} Smoking: ${p.smoking} Access: ${p.accessibility} Parking: ${p.parking}`,
    `Cash: ${a.money.cash ? 'yes' : 'card only'}. ${a.money.tips} Hire: ${p.hire} Christmas: ${p.christmas} Jobs: ${p.careers}`,
  ].join('\n');
}

/** The pub's back office (presets/pub.md §6): the floor plan and the day's bookings, then messages and calls. */
export function pubWorkspace(_profile: TenantProfile): WorkspaceSpec {
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
      'Sunday lunch for six at 1, with two kids and our dog?',
      'Can my 17-year-old have a pint with his dinner?',
      'My son has a nut allergy: which desserts can he have?',
      'Do you have gluten-free beer?',
      'Can we hire the room upstairs for a 40th? (Call as Jess)',
    ],
    resetLine: 'bookings',
    clock: true,
  };
}

export const pub: Omit<Preset<PubAnswers>, 'info'> = {
  VERSION,
  defaults: defaultAnswers,
  sanitise: sanitisePub,
  steps: STEPS,
  validate: validatePub,
  compile: compilePub,
  seed: planPubSeed,
  preview: pubPreview,
  factSheet,
  handles: PUB_HANDLES,
  scan: { parts: ['identity', 'hours', 'theme'], apply: applyBaseScan },
  workspace: pubWorkspace,
  combineTables: (a, x, y) => ({ ...a, seating: { ...a.seating, tables: joinTables(a.seating.tables, x, y) } }),
};
