// The builder's two drafting helpers: "describe your food" to a structured
// menu, and the common questions a caller asks, from everything set so far.
// One small text-model call each, on the text key (config.keys.text), then
// through the same sanitiser as anything the browser sends, so a draft can
// never put more into a profile than a prospect could type.

import type { Config } from '../../config.ts';
import { generateJson } from '../../core/gemini.ts';
import { ALLERGENS } from '../../domain/types.ts';
import type { RestaurantAnswers } from './answers.ts';
import { hoursSentence } from './compile.ts';
import { sanitiseRestaurant } from './validate.ts';

export interface MenuBrief {
  /** "Wood-fired Neapolitan pizza, about ten, fresh pasta, a few starters..." */
  description: string;
  style: string;
  price_level: 'budget' | 'mid' | 'high';
  /** Roughly how many dishes in all. */
  dishes: number;
  takeaway: boolean;
}

const PRICE_GUIDE: Record<MenuBrief['price_level'], string> = {
  budget: 'Budget: mains about £7 to £11, starters £4 to £6, desserts £4 to £5.',
  mid: 'Mid-priced: mains about £12 to £19, starters £6 to £9, desserts £6 to £8.',
  high: 'Upmarket: mains about £22 to £38, starters £10 to £16, desserts £9 to £12.',
};

const MENU_SCHEMA = {
  type: 'OBJECT',
  properties: {
    categories: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING', description: 'Section name as a menu would print it: Starters, Pizza, Pasta, Desserts.' },
          items: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                description: { type: 'STRING', description: 'One short line, under 15 words.' },
                price_pence: { type: 'INTEGER' },
                allergens: { type: 'ARRAY', items: { type: 'STRING', enum: [...ALLERGENS] }, description: 'What a typical recipe for this dish contains, from the UK 14.' },
                dietary: { type: 'ARRAY', items: { type: 'STRING', enum: ['vegetarian', 'vegan', 'gluten-free option', 'spicy'] } },
                modifier_groups: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Keys of option groups this dish offers.' },
                takeaway: { type: 'BOOLEAN', description: 'False for dishes that do not travel.' },
              },
              required: ['name', 'price_pence', 'allergens'],
            },
          },
        },
        required: ['label', 'items'],
      },
    },
    modifier_groups: {
      type: 'ARRAY',
      description: 'At most three option groups, such as pizza extras or a size choice.',
      items: {
        type: 'OBJECT',
        properties: {
          key: { type: 'STRING' },
          label: { type: 'STRING' },
          min: { type: 'INTEGER' },
          max: { type: 'INTEGER' },
          options: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: { name: { type: 'STRING' }, price_pence: { type: 'INTEGER' }, allergens: { type: 'ARRAY', items: { type: 'STRING', enum: [...ALLERGENS] } } },
              required: ['name', 'price_pence'],
            },
          },
        },
        required: ['key', 'label', 'min', 'max', 'options'],
      },
    },
    allergen_statement: { type: 'STRING', description: 'Two sentences a UK restaurant would print about allergens and cross-contamination.' },
  },
  required: ['categories', 'allergen_statement'],
};

interface DraftedMenu {
  categories: { label: string; items: { name: string; description?: string; price_pence: number; allergens: string[]; dietary?: string[]; modifier_groups?: string[]; takeaway?: boolean }[] }[];
  modifier_groups?: { key: string; label: string; min: number; max: number; options: { name: string; price_pence: number; allergens?: string[] }[] }[];
  allergen_statement: string;
}

export function cleanBrief(b: any, fallbackStyle: string): MenuBrief {
  const description = String(b?.description ?? '').trim().slice(0, 1200);
  return {
    description,
    style: String(b?.style ?? fallbackStyle).trim().slice(0, 160),
    price_level: ['budget', 'mid', 'high'].includes(b?.price_level) ? b.price_level : 'mid',
    dishes: Math.min(40, Math.max(6, Math.round(Number(b?.dishes) || 18))),
    takeaway: b?.takeaway !== false,
  };
}

/** Turns the model's menu into builder answers, through the sanitiser. */
export function menuFromDraft(d: DraftedMenu): RestaurantAnswers['menu'] {
  const groups: Record<string, unknown> = {};
  for (const g of d.modifier_groups ?? []) {
    groups[g.key] = { label: g.label, min: g.min, max: Math.max(1, g.max), options: g.options };
  }
  const menu = {
    categories: d.categories.map((c) => ({
      label: c.label,
      items: c.items.map((i) => ({
        name: i.name, description: i.description, price_pence: i.price_pence, allergens: i.allergens,
        dietary: i.dietary, modifier_groups: i.modifier_groups,
        // Dishes that do not travel stay on the menu but off takeaway.
        available: i.takeaway === false ? false : undefined,
      })),
    })),
    modifier_groups: groups,
    allergen_statement: d.allergen_statement,
    source: 'draft',
    allergens_are_examples: true,
  };
  // modifier group keys are normalised by the sanitiser; match the items' references to them.
  return sanitiseRestaurant({ menu: normaliseGroupRefs(menu) }).menu;
}

function normaliseGroupRefs(menu: any) {
  const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'options';
  const groups = Object.fromEntries(Object.entries(menu.modifier_groups).map(([k, v]) => [norm(k), v]));
  for (const c of menu.categories) for (const i of c.items) i.modifier_groups = (i.modifier_groups ?? []).map(norm).filter((k: string) => k in groups);
  return { ...menu, modifier_groups: groups };
}

export async function draftMenu(brief: MenuBrief, config: Config): Promise<RestaurantAnswers['menu']> {
  const prompt = [
    'Write a realistic menu for a UK restaurant, for a demo of an AI phone receptionist.',
    `The restaurant: ${brief.style || 'a neighbourhood restaurant'}.`,
    brief.description ? `The owner describes their food: "${brief.description}"` : '',
    `About ${brief.dishes} dishes in all, in the sections a menu like this would have. ${PRICE_GUIDE[brief.price_level]}`,
    'Prices in pence, ending in 0 or 5. Dish names as the menu would print them; no emoji.',
    'Allergens: list what a typical recipe contains, from the UK 14 only. They are illustrations the owner will check.',
    brief.takeaway ? 'Mark takeaway false only for dishes that do not travel.' : 'This restaurant does not do takeaway; mark every dish takeaway true.',
    'Add option groups only where they are natural (pizza extras, a size, a sauce), at most three.',
  ].filter(Boolean).join('\n');
  const d = await generateJson<DraftedMenu>(config.textModel, prompt, config.keys.text, MENU_SCHEMA, { temperature: 0.7 });
  if (!Array.isArray(d?.categories) || !d.categories.length) throw new Error('The draft came back empty. Try again, or describe the food in a little more detail.');
  return menuFromDraft(d);
}

// ── Common questions ─────────────────────────────────────────────────────

const FAQ_SCHEMA = {
  type: 'OBJECT',
  properties: {
    faqs: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { q: { type: 'STRING' }, a: { type: 'STRING' } }, required: ['q', 'a'] },
    },
  },
  required: ['faqs'],
};

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

export async function draftFaqs(a: RestaurantAnswers, config: Config): Promise<{ q: string; a: string }[]> {
  const prompt = [
    'These are the facts about a UK restaurant, set by its owner for an AI phone receptionist demo.',
    factSheet(a),
    '',
    'Write the ten questions callers most often ask a restaurant like this that the facts above answer, each with a short spoken answer (one or two sentences, friendly, British English).',
    'Use only these facts. Where the facts do not cover something, leave that question out rather than guess. No questions about booking a table or ordering food themselves; the receptionist handles those.',
  ].join('\n');
  const d = await generateJson<{ faqs: { q: string; a: string }[] }>(config.textModel, prompt, config.keys.text, FAQ_SCHEMA, { temperature: 0.4 });
  return sanitiseRestaurant({ policies: { faqs: d?.faqs ?? [] } }).policies.faqs.slice(0, 12);
}
