// The takeaway as the server sees it: the hooks of PRESETS.md §2.2, from the
// files beside this one (presets/takeaway.md).

import type { Config } from '../../config.ts';
import type { TenantProfile } from '../../domain/types.ts';
import { applyFoodScan } from '../../scout/map.ts';
import { PresetError } from '../common/errors.ts';
import { hoursSentence } from '../common/hours.ts';
import { dealComplete } from '../food/deals.ts';
import { cleanBrief, draftMenu as draftMenuFor, type MenuBrief, type MenuWording } from '../food/drafts.ts';
import { menuItems, type MenuAnswer } from '../food/menu.ts';
import type { CatalogueDraft, Preset, PreviewPayload, WorkspaceSpec } from '../index.ts';
import { VERSION, defaultAnswers, type TakeawayAnswers } from './answers.ts';
import { compileTakeaway, deliverySentence, halalSentence, paySentence } from './compile.ts';
import { sanitiseTakeaway } from './sanitise.ts';
import { planTakeawaySeed } from './seed.ts';
import { STEPS } from './steps.ts';
import { validateTakeaway } from './validate.ts';

/** What the receptionist does itself, so the FAQ draft leaves it out. */
export const TAKEAWAY_HANDLES = 'taking orders for collection or delivery, and saying how long an order will be';

const PRICE_GUIDE: Record<MenuBrief['price_level'], string> = {
  budget: 'Budget: burgers and wraps about £4 to £6, pizzas £6 to £9, sides £1.50 to £2.50, cans £1.',
  mid: 'Mid-priced: burgers and wraps about £6 to £9, pizzas £9 to £13, sides £2.50 to £3.50, cans £1.50.',
  high: 'Upmarket: burgers about £10 to £15, pizzas £12 to £17, sides £3.50 to £5, drinks £2.50 to £4.',
};
const WORDING: MenuWording = { noun: 'takeaway', fallbackStyle: 'a chicken, burger and pizza takeaway', priceGuide: PRICE_GUIDE };

/** The builder's preview pane: what the receptionist will know, line by line. */
export function takeawayPreview(a: TakeawayAnswers, profile: TenantProfile): PreviewPayload {
  const items = menuItems(a.menu).length;
  const deals = a.deals.filter((d) => dealComplete(a.menu, d)).length;
  return {
    lines: [
      profile.greeting,
      ...profile.core_facts,
      `${items} item${items === 1 ? '' : 's'} on the menu in ${a.menu.categories.length} section${a.menu.categories.length === 1 ? '' : 's'}, and ${deals} meal deal${deals === 1 ? '' : 's'}.`,
    ],
  };
}

/** What the FAQ draft is told about the takeaway: its own answers, as plain facts. */
export function factSheet(a: TakeawayAnswers): string {
  const sections = a.menu.categories.map((c) => `${c.label}: ${c.items.slice(0, 6).map((i) => i.name).join(', ')}`).join('; ');
  return [
    `Name: ${a.basics.name || 'the takeaway'}. Style: ${a.basics.style}. Town: ${a.basics.town}${a.basics.address ? `, ${a.basics.address}` : ''}.`,
    `Hours: ${hoursSentence(a.hours)}`,
    `Collection: ${a.ordering.collection.enabled ? 'yes' : 'no'}. ${deliverySentence(a) || 'No delivery.'}${a.ordering.delivery_apps.length ? ` Also on ${a.ordering.delivery_apps.join(', ')}.` : ''}`,
    paySentence(a),
    `${halalSentence(a)} ${a.menu.allergen_statement}`,
    `Parking: ${a.policies.parking} Bags: ${a.policies.bags} Tips: ${a.policies.tips} Jobs: ${a.policies.careers}${a.policies.offers ? ` Offers: ${a.policies.offers}` : ''}`,
    `Menu: ${sections}.`,
    `Meal deals: ${a.deals.map((d) => d.name).join(', ') || 'none'}.`,
  ].join('\n');
}

/** The takeaway's back office (presets/takeaway.md §6): the kitchen board, the drivers, then messages and calls. */
export function takeawayWorkspace(profile: TenantProfile): WorkspaceSpec {
  const drivers = Boolean(profile.ordering?.delivery?.drivers?.length);
  const suggestions = ['How long for delivery tonight?', 'Can I get a burger, fries and a can for collection?'];
  if (profile.ordering?.delivery) suggestions.push('Do you deliver to NG9?');
  suggestions.push("My son's allergic to sesame. Is the Burger meal OK?");
  if (drivers) suggestions.push("Where's my order? (Call as Amy)");
  return {
    views: [
      { id: 'orders', label: 'Kitchen' },
      ...(drivers ? [{ id: 'drivers' as const, label: 'Drivers' }] : []),
      { id: 'tonight', label: 'Menu tonight' },
      { id: 'messages', label: 'Messages' },
      { id: 'calls', label: 'Calls' },
    ],
    orders: { board: 'Kitchen', done: { collection: 'Collected', delivery: 'Delivered' }, drivers, advance: true },
    suggestions,
    resetLine: 'orders',
  };
}

/** "Describe your food": a brief with no style takes the takeaway's own. */
const menuDraft: CatalogueDraft<TakeawayAnswers, MenuAnswer> = {
  label: 'menu',
  async run(body, a, config: Config) {
    const brief = cleanBrief(body, a.basics.style);
    if (!brief.description && !brief.style) throw new PresetError(400, 'Describe the food first.');
    return draftMenuFor(brief, config, WORDING, defaultAnswers().menu);
  },
  counts: (menu) => ({ dishes: menuItems(menu).length }),
};

export const takeaway: Omit<Preset<TakeawayAnswers>, 'info'> = {
  VERSION,
  defaults: defaultAnswers,
  sanitise: sanitiseTakeaway,
  steps: STEPS,
  validate: validateTakeaway,
  compile: compileTakeaway,
  seed: planTakeawaySeed,
  preview: takeawayPreview,
  factSheet,
  handles: TAKEAWAY_HANDLES,
  draft: menuDraft,
  scan: { parts: ['identity', 'hours', 'menu', 'theme'], apply: applyFoodScan },
  workspace: takeawayWorkspace,
};
