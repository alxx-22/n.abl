// The restaurant as the server sees it: the hooks of PRESETS.md §2.2, each
// one the restaurant's own code from the files beside this one, so a
// workspace behaves exactly as it did before the registry existed.

import type { TenantProfile } from '../../domain/types.ts';
import { applyScan } from '../../scout/map.ts';
import { PresetError } from '../common/errors.ts';
import { hoursSentence } from '../common/hours.ts';
import { cleanBrief } from '../food/drafts.ts';
import { menuItems, type MenuAnswer } from '../food/menu.ts';
import { joinTables } from '../seating/tables.ts';
import type { CatalogueDraft, Preset, WorkspaceSpec } from '../index.ts';
import { VERSION, defaultAnswers, type RestaurantAnswers } from './answers.ts';
import { compileRestaurant } from './compile.ts';
import { RESTAURANT_HANDLES, draftMenu, factSheet } from './drafts.ts';
import { planRestaurantSeed } from './seed.ts';
import { STEPS } from './steps.ts';
import { sanitiseRestaurant, validateRestaurant } from './validate.ts';

/** The builder's preview pane: what the receptionist will actually say, and what it can book. */
export function restaurantPreview(a: RestaurantAnswers, profile: TenantProfile) {
  const tables = profile.booking?.resources.filter((r) => r.layout) ?? [];
  const covers: Record<string, number> = {};
  for (const t of tables) covers[t.area ?? ''] = (covers[t.area ?? ''] ?? 0) + (t.layout?.seats ?? 0);
  return {
    greeting: profile.greeting,
    core_facts: profile.core_facts,
    hours: hoursSentence(a.hours),
    covers: (profile.booking?.areas ?? []).map((ar) => ({ area: ar.key, label: ar.label, covers: covers[ar.key] ?? 0 })),
    bookable_tables: tables.filter((t) => t.services.length).length,
    pairs: profile.booking?.resources.filter((r) => r.combines).map((r) => r.label) ?? [],
    dishes: profile.menu?.categories.reduce((n, c) => n + c.items.length, 0) ?? 0,
  };
}

/**
 * The back office as the web draws it for a restaurant today (Workspace.tsx,
 * Kitchen.tsx, BookingDrawer.tsx): the floor plan and timeline when there are
 * tables to book, then the kitchen, messages and calls. Not read by the web
 * yet; it is what the web's view registry will draw from.
 */
export function restaurantWorkspace(profile: TenantProfile): WorkspaceSpec {
  const outside = (profile.booking?.areas ?? []).some((a) => a.reservable && !a.enquiry_only && a.kind === 'outdoor');
  const suggestions: string[] = [];
  if (profile.booking?.services.length) {
    suggestions.push(outside ? 'Can I book a table for four on Friday at half seven, outside if possible?' : 'Can I book a table for four on Friday at half seven?');
    suggestions.push("I've got a booking. Can we make it five people instead?");
  }
  if (profile.ordering) suggestions.push('Can I order some food to collect at seven?');
  suggestions.push('Do you have gluten-free options?');
  return {
    views: [
      ...(profile.booking ? [{ id: 'floor', label: 'Floor plan' }, { id: 'timeline', label: 'Timeline' }] as const : []),
      { id: 'orders', label: 'Kitchen' },
      { id: 'messages', label: 'Messages' },
      { id: 'calls', label: 'Calls' },
    ],
    bookings: {
      resource: 'table',
      resources: 'tables',
      party: 'Party',
      visit: { expected: 'Expected', arrived: 'Arrived', seated: 'Seated', finished: 'Finished', no_show: 'No-show' },
      allergies: true,
    },
    orders: { board: 'Kitchen', done: { collection: 'Collected', delivery: 'Collected' }, drivers: false, advance: false },
    suggestions,
    resetLine: 'bookings and orders',
  };
}

/** "Describe your food": a brief with no style takes the restaurant's own. */
const menuDraft: CatalogueDraft<RestaurantAnswers, MenuAnswer> = {
  label: 'menu',
  async run(body, a, config) {
    const brief = cleanBrief(body, a.basics.style);
    if (!brief.description && !brief.style) throw new PresetError(400, 'Describe the food first.');
    return draftMenu(brief, config);
  },
  counts: (menu) => ({ dishes: menuItems(menu).length }),
};

export const restaurant: Omit<Preset<RestaurantAnswers>, 'info'> = {
  VERSION,
  defaults: defaultAnswers,
  sanitise: sanitiseRestaurant,
  steps: STEPS,
  validate: validateRestaurant,
  compile: compileRestaurant,
  seed: (profile, now, seed) => planRestaurantSeed(profile, now, seed),
  preview: restaurantPreview,
  factSheet,
  handles: RESTAURANT_HANDLES,
  draft: menuDraft,
  scan: { parts: ['identity', 'hours', 'menu', 'theme', 'services', 'policies'], apply: applyScan },
  workspace: restaurantWorkspace,
  combineTables: (a, x, y) => ({ ...a, seating: { ...a.seating, tables: joinTables(a.seating.tables, x, y) } }),
};
