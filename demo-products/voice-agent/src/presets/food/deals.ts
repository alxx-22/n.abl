// Meal deals, for any business that sells food: the takeaway now, the café
// and pub later. A deal is a price and a few choices, each from one section
// of the menu ("any burger", "a side", "a can"), plus anything it always
// includes. Deals are their own answers, not part of the menu, because a
// menu draft returns only the menu (PRESETS.md §2.2): the next save re-links
// each choice to its section by key or label, validation says which deal
// is still pointing at something gone, and compile leaves that deal out.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MenuCategory } from '../../domain/types.ts';
import { arr, int, key, str } from '../common/sanitise.ts';
import type { Issue } from '../common/types.ts';
import type { MenuAnswer } from './menu.ts';

export interface DealPartAnswer {
  /** What the caller is asked to choose: "Burger", "Side", "Drink". */
  label: string;
  category_key: string;
  /** Only these items of the section; missing: any item in it. */
  item_keys?: string[];
  /** How many to choose: two pizzas, two cans. */
  choose: number;
  /** Extra for a dearer choice: a double cheeseburger in a Burger meal. */
  upcharge_pence?: Record<string, number>;
}

export interface DealAnswer {
  key: string;
  name: string;
  price_pence: number;
  description: string;
  /** Items always in it, whatever is chosen: Pizza night's garlic bread. */
  includes?: string[];
  parts: DealPartAnswer[];
}

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'fixtures');

/** The deals in a sample fixture (fixtures/presets/takeaway-menu.json), cleaned against its menu. */
export function sampleDeals(file: string, menu: MenuAnswer): DealAnswer[] {
  return sanitiseDeals(JSON.parse(readFileSync(join(FIXTURES, file), 'utf8')).deals, menu);
}

const plain = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '').replace(/s$/, '');

/** The section a choice belongs to: its own key, or after a menu draft a section with the same key or label. */
export function dealSection(menu: Pick<MenuAnswer, 'categories'>, part: Pick<DealPartAnswer, 'category_key' | 'label'>): MenuCategory | undefined {
  const exact = menu.categories.find((c) => c.key === part.category_key);
  if (exact) return exact;
  const want = [part.category_key, part.label].map(plain).filter(Boolean);
  return menu.categories.find((c) => want.includes(plain(c.key)) || want.includes(plain(c.label)));
}

/** The items a choice can be: the listed ones still in its section, or every item in it. */
export function dealCandidates(menu: Pick<MenuAnswer, 'categories'>, part: DealPartAnswer) {
  const section = dealSection(menu, part);
  if (!section) return [];
  return part.item_keys ? section.items.filter((i) => part.item_keys!.includes(i.key)) : section.items;
}

export function sanitiseDeals(v: unknown, menu: MenuAnswer): DealAnswer[] {
  const out: DealAnswer[] = [];
  const everything = new Set(menu.categories.flatMap((c) => c.items.map((i) => i.key)));
  for (const raw of arr(v).slice(0, 12) as any[]) {
    const name = str(raw?.name, 40);
    if (!name) continue;
    let k = key(raw?.key ?? name, 'deal');
    for (let n = 2; out.some((d) => d.key === k); n++) k = `${key(raw?.key ?? name, 'deal')}_${n}`;
    const parts: DealPartAnswer[] = [];
    for (const p of arr(raw.parts).slice(0, 5) as any[]) {
      const label = str(p?.label, 30);
      const category = key(p?.category_key, '');
      if (!label || !category) continue;
      const section = dealSection(menu, { category_key: category, label });
      // Re-linked to the section's key; its items checked against it only once it is found, so a
      // choice whose section a draft took away keeps what it named until the owner fixes it.
      const inSection = (x: string) => !section || section.items.some((i) => i.key === x);
      const part: DealPartAnswer = { label, category_key: section?.key ?? category, choose: int(p.choose, 1, 4, 1) };
      if (Array.isArray(p.item_keys)) part.item_keys = [...new Set(p.item_keys.map((x: unknown) => key(x, '')).filter((x: string) => x && inSection(x)))] as string[];
      if (p.upcharge_pence && typeof p.upcharge_pence === 'object') {
        const up = Object.entries(p.upcharge_pence as Record<string, unknown>)
          .map(([x, pence]) => [key(x, ''), int(pence, 0, 1000, -1)] as const)
          .filter(([x, pence]) => x && pence > 0 && inSection(x));
        if (up.length) part.upcharge_pence = Object.fromEntries(up);
      }
      parts.push(part);
    }
    const deal: DealAnswer = { key: k, name, price_pence: int(raw.price_pence, 0, 10000, 0), description: str(raw.description, 160), parts };
    if (Array.isArray(raw.includes)) deal.includes = [...new Set(raw.includes.map((x: unknown) => key(x, '')).filter((x: string) => x && everything.has(x)))] as string[];
    out.push(deal);
  }
  return out;
}

/** A deal the receptionist can sell: a price, and every choice with something to choose from. */
export function dealComplete(menu: Pick<MenuAnswer, 'categories'>, d: DealAnswer): boolean {
  return d.price_pence > 0 && d.parts.length > 0 && d.parts.every((p) => dealCandidates(menu, p).length > 0);
}

export function validateDeals<K extends string>(deals: DealAnswer[], menu: MenuAnswer, step: K): Issue<K>[] {
  const out: Issue<K>[] = [];
  const items = menu.categories.flatMap((c) => c.items);
  for (const d of deals) {
    if (!d.parts.length) out.push({ step, level: 'error', message: `${d.name}: add at least one choice, like "any burger".` });
    if (!d.price_pence) out.push({ step, level: 'error', message: `${d.name}: give it a price.` });
    const gone = d.parts.filter((p) => !dealCandidates(menu, p).length);
    for (const p of gone) {
      out.push({ step, level: 'warning', message: `${d.name}: the "${p.label}" choice has nothing on the menu to choose from, so the deal is left out until you fix it.` });
    }
    if (gone.length || !d.parts.length || !d.price_pence) continue;
    // The cheapest way to fill it, bought separately: a deal dearer than that is never worth suggesting.
    const cheapest = d.parts.reduce((s, p) => s + p.choose * Math.min(...dealCandidates(menu, p).map((i) => i.price_pence)), 0)
      + (d.includes ?? []).reduce((s, x) => s + (items.find((i) => i.key === x)?.price_pence ?? 0), 0);
    if (d.price_pence >= cheapest) {
      out.push({ step, level: 'warning', message: `${d.name} costs as much as its cheapest choices bought separately, so the receptionist won't suggest it as a saving.` });
    }
  }
  return out;
}
