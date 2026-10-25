// "Describe your food" to a structured menu: one small text-model call on
// the text key (config.keys.text), then through the same menu sanitiser as
// anything the browser sends, so a draft can never put more into a profile
// than a prospect could type. The wording comes from the preset.

import type { Config } from '../../config.ts';
import { generateJson } from '../../core/gemini.ts';
import { ALLERGENS } from '../../domain/types.ts';
import { sanitiseMenu, type MenuAnswer } from './menu.ts';

export interface MenuBrief {
  /** "Wood-fired Neapolitan pizza, about ten, fresh pasta, a few starters..." */
  description: string;
  style: string;
  price_level: 'budget' | 'mid' | 'high';
  /** Roughly how many dishes in all. */
  dishes: number;
  takeaway: boolean;
}

/** What the prompt says about the business: "restaurant", its default style, and its price bands. */
export interface MenuWording {
  noun: string;
  fallbackStyle: string;
  priceGuide: Record<MenuBrief['price_level'], string>;
}

const menuSchema = (noun: string) => ({
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
    allergen_statement: { type: 'STRING', description: `Two sentences a UK ${noun} would print about allergens and cross-contamination.` },
  },
  required: ['categories', 'allergen_statement'],
});

export interface DraftedMenu {
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

/** Turns the model's menu into builder answers, through the sanitiser; `fallback` fills what the model left empty. */
export function menuFromDraft(d: DraftedMenu, fallback: MenuAnswer): MenuAnswer {
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
  return sanitiseMenu(normaliseGroupRefs(menu), fallback);
}

function normaliseGroupRefs(menu: any) {
  const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'options';
  const groups = Object.fromEntries(Object.entries(menu.modifier_groups).map(([k, v]) => [norm(k), v]));
  for (const c of menu.categories) for (const i of c.items) i.modifier_groups = (i.modifier_groups ?? []).map(norm).filter((k: string) => k in groups);
  return { ...menu, modifier_groups: groups };
}

export async function draftMenu(brief: MenuBrief, config: Config, wording: MenuWording, fallback: MenuAnswer): Promise<MenuAnswer> {
  const { noun } = wording;
  const prompt = [
    `Write a realistic menu for a UK ${noun}, for a demo of an AI phone receptionist.`,
    `The ${noun}: ${brief.style || wording.fallbackStyle}.`,
    brief.description ? `The owner describes their food: "${brief.description}"` : '',
    `About ${brief.dishes} dishes in all, in the sections a menu like this would have. ${wording.priceGuide[brief.price_level]}`,
    'Prices in pence, ending in 0 or 5. Dish names as the menu would print them; no emoji.',
    'Allergens: list what a typical recipe contains, from the UK 14 only. They are illustrations the owner will check.',
    brief.takeaway ? 'Mark takeaway false only for dishes that do not travel.' : `This ${noun} does not do takeaway; mark every dish takeaway true.`,
    'Add option groups only where they are natural (pizza extras, a size, a sauce), at most three.',
  ].filter(Boolean).join('\n');
  const d = await generateJson<DraftedMenu>(config.textModel, prompt, config.keys.text, menuSchema(noun), { temperature: 0.7 });
  if (!Array.isArray(d?.categories) || !d.categories.length) throw new Error('The draft came back empty. Try again, or describe the food in a little more detail.');
  return menuFromDraft(d, fallback);
}
