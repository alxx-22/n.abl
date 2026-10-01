// The scout's two small model calls, on the scout key (config.keys.scout):
// the facts, from a digest of at most about 4,000 tokens, and the menu, from
// the best menu page or its PDF. Both are told to state only what the site
// says; prices and allergens the site does not give stay empty.

import type { Config } from '../config.ts';
import { generateJson } from '../core/gemini.ts';
import { ALLERGENS } from '../domain/types.ts';

export interface FactsOut {
  is_hospitality: boolean;
  name: string;
  style: string;
  summary: string;
  town: string;
  address: string;
  phone: string;
  hours: { day: string; open: string; close: string; label: string }[];
  takes_reservations: boolean | null;
  takeaway: boolean | null;
  own_delivery: boolean | null;
  policies: { children: string; dogs: 'inside' | 'outside_only' | 'no' | 'unknown'; accessibility: string; parking: string; dress_code: string; corkage: string; cakes: string; vouchers: string; dietary: string };
  faqs: { q: string; a: string }[];
}

export interface MenuOut {
  /** price: as the menu writes it ("11.5", "£9.50", "6 / 30"), turned into pence by pencePrice; price_pence from older callers. */
  categories: { label: string; items: { name: string; description: string; price?: string; price_pence?: number; allergens_stated: boolean; allergens: string[]; dietary: string[] }[] }[];
  allergen_statement: string;
}

const S = { type: 'STRING' };
const FACTS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    is_hospitality: { type: 'BOOLEAN', description: 'True if this is a restaurant, café, pub, bar or takeaway.' },
    name: S,
    style: { type: 'STRING', description: 'Their food in under 12 words, e.g. "Neapolitan pizza and fresh pasta". Empty if unclear.' },
    summary: { type: 'STRING', description: 'One sentence in their own terms.' },
    town: S, address: { type: 'STRING', description: 'Street and postcode, as written.' }, phone: S,
    hours: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { day: { type: 'STRING', enum: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] }, open: { type: 'STRING', description: 'HH:MM 24h' }, close: { type: 'STRING', description: 'HH:MM 24h' }, label: { type: 'STRING', description: 'Lunch, Dinner, or empty' } }, required: ['day', 'open', 'close'] },
    },
    takes_reservations: { type: 'BOOLEAN', nullable: true },
    takeaway: { type: 'BOOLEAN', nullable: true, description: 'Collection or takeaway orders.' },
    own_delivery: { type: 'BOOLEAN', nullable: true, description: 'They deliver themselves (not only through an app).' },
    policies: {
      type: 'OBJECT',
      properties: {
        children: S, dogs: { type: 'STRING', enum: ['inside', 'outside_only', 'no', 'unknown'] }, accessibility: S, parking: S, dress_code: S,
        corkage: S, cakes: S, vouchers: S, dietary: S,
      },
      required: ['dogs'],
    },
    faqs: { type: 'ARRAY', items: { type: 'OBJECT', properties: { q: S, a: S }, required: ['q', 'a'] } },
  },
  required: ['is_hospitality', 'name', 'hours', 'policies', 'faqs'],
};

const MENU_SCHEMA = {
  type: 'OBJECT',
  properties: {
    categories: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: S,
          items: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: S,
                description: S,
                // As written, not converted: the model read "11.5" as 115 pence. pencePrice does the sums.
                price: { type: 'STRING', description: 'The price exactly as the menu writes it, e.g. "11.5", "£9.50", "6 / 30". Empty if none.' },
                allergens_stated: { type: 'BOOLEAN', description: 'True only if the menu lists this dish’s allergens.' },
                allergens: { type: 'ARRAY', items: { type: 'STRING', enum: [...ALLERGENS] } },
                dietary: { type: 'ARRAY', items: { type: 'STRING', enum: ['vegetarian', 'vegan', 'gluten-free', 'gluten-free option', 'spicy'] } },
              },
              required: ['name', 'price', 'allergens_stated'],
            },
          },
        },
        required: ['label', 'items'],
      },
    },
    allergen_statement: { type: 'STRING', description: 'Their allergen statement if they give one, else empty.' },
  },
  required: ['categories'],
};

const RULES = 'Use ONLY what these pages state. Never invent prices, dishes, hours, allergens or policies. Leave a field empty (or null) when the pages do not say.';

export async function askFacts(digest: string, config: Config): Promise<FactsOut> {
  return generateJson<FactsOut>(config.textModel, `A UK hospitality business's website, read for a demo of an AI phone receptionist. ${RULES}\nFAQs: the questions a caller might ask that these pages answer (parking, dogs, children, access, dietary, groups, deposits), in their words, at most ten.\n\n${digest}`, config.keys.scout, FACTS_SCHEMA, { temperature: 0.1 });
}

export async function askMenu(source: { text?: string; pdf?: Buffer; url: string }, config: Config): Promise<MenuOut> {
  const intro = [
    `The menu of a UK restaurant, from ${source.url}. ${RULES}`,
    'Sections: use the menu\'s own headings (snacks, small plates, pasta, mains, dessert…), in order. Every dish belongs to the heading above it, until the next heading. A tab such as "food" or "drink" that holds headed sections is not a section itself.',
    'Prices: many menus write them without a £ sign, as a bare number after each dish ("11.5" is £11.50). Copy each price exactly as written. A dish with no price of its own (a set menu) has an empty price.',
    'Names: keep their dish names and wording. When a dish is a list of ingredients ("rigatoni, nduja, mascarpone, lemon"), the first part is the name and the rest the description. Marks like (v), (vg), (n), * and ** are not part of the name: use the menu\'s key for dietary.',
    'Skip set menus for groups or seasons when the everyday menu is there too. At most 80 dishes; skip drinks lists longer than 15 lines.',
  ].join('\n');
  const parts = source.pdf
    ? [{ text: intro }, { inlineData: { mimeType: 'application/pdf', data: source.pdf.toString('base64') } }]
    : [{ text: `${intro}\n\n${(source.text ?? '').slice(0, 32000)}` }];
  return generateJson<MenuOut>(config.textModel, parts, config.keys.scout, MENU_SCHEMA, { temperature: 0.1 });
}
