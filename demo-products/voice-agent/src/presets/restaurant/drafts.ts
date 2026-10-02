// The restaurant's two drafts: "describe your food" to a structured menu,
// and the common questions a caller asks, from everything set so far. The
// drafting is shared (food/drafts.ts, common/drafts.ts); what is the
// restaurant's own is the wording, the price bands and the fact sheet.

import type { Config } from '../../config.ts';
import { draftFaqs as draftFaqsFrom } from '../common/drafts.ts';
import { draftMenu as draftMenuFor, menuFromDraft as menuFrom, type DraftedMenu, type MenuBrief, type MenuWording } from '../food/drafts.ts';
import { defaultAnswers, type RestaurantAnswers } from './answers.ts';
import { hoursSentence } from './compile.ts';

export { cleanBrief, type MenuBrief } from '../food/drafts.ts';

const PRICE_GUIDE: Record<MenuBrief['price_level'], string> = {
  budget: 'Budget: mains about £7 to £11, starters £4 to £6, desserts £4 to £5.',
  mid: 'Mid-priced: mains about £12 to £19, starters £6 to £9, desserts £6 to £8.',
  high: 'Upmarket: mains about £22 to £38, starters £10 to £16, desserts £9 to £12.',
};

const WORDING: MenuWording = { noun: 'restaurant', fallbackStyle: 'a neighbourhood restaurant', priceGuide: PRICE_GUIDE };

/** Turns the model's menu into builder answers, through the sanitiser. */
export const menuFromDraft = (d: DraftedMenu): RestaurantAnswers['menu'] => menuFrom(d, defaultAnswers().menu);

export const draftMenu = (brief: MenuBrief, config: Config): Promise<RestaurantAnswers['menu']> => draftMenuFor(brief, config, WORDING, defaultAnswers().menu);

// ── Common questions ─────────────────────────────────────────────────────

/** What the model is told about the restaurant: its own answers, as plain facts. */
export function factSheet(a: RestaurantAnswers): string {
  const areas = a.seating.areas.map((x) => `${x.label}${x.reservable ? '' : ' (walk-in only)'}${x.enquiry_only ? ' (enquiries only)' : ''}`).join(', ');
  const dishes = a.menu.categories.map((c) => `${c.label}: ${c.items.slice(0, 6).map((i) => i.name).join(', ')}`).join('; ');
  return [
    `Name: ${a.basics.name || 'the restaurant'}. Style: ${a.basics.style}. Town: ${a.basics.town}${a.basics.address ? `, ${a.basics.address}` : ''}.`,
    `Hours: ${hoursSentence(a)}`,
    `Table bookings: ${a.serve.reservations ? `yes, up to ${a.seating.max_party} by phone; areas ${areas}` : 'no'}. Walk-ins: ${a.serve.walk_ins ? 'welcome' : 'bookings only'}.`,
    `Click and collect: ${a.serve.collection.enabled ? `yes, ${a.serve.collection.prep_minutes} minutes' notice` : 'no'}. Delivery: ${a.serve.delivery.enabled ? `own drivers to ${a.serve.delivery.districts.join(', ')}` : 'no'}${a.serve.delivery_apps.length ? `; on ${a.serve.delivery_apps.join(', ')}` : ''}.`,
    `Deposits: ${a.money.deposit.mode === 'none' ? 'none' : `${a.money.deposit.mode.replace('_', ' ')} for parties of ${a.money.deposit.min_party} or more`}. ${a.money.cancellation_policy} ${a.money.service_charge}`,
    `Children: ${a.policies.children} Dogs: ${a.policies.dogs.replace('_', ' ')}. Access: ${a.policies.accessibility} Parking: ${a.policies.parking}`,
    `Dress code: ${a.policies.dress_code} Corkage: ${a.policies.corkage} Cakes: ${a.policies.cakes} Vouchers: ${a.policies.vouchers} Dietary: ${a.policies.dietary}`,
    `Menu: ${dishes}.`,
  ].join('\n');
}

/** What the receptionist does itself, so the FAQ draft leaves it out. */
export const RESTAURANT_HANDLES = 'booking a table or ordering food';

export async function draftFaqs(a: RestaurantAnswers, config: Config): Promise<{ q: string; a: string }[]> {
  return draftFaqsFrom(factSheet(a), 'restaurant', RESTAURANT_HANDLES, config);
}
