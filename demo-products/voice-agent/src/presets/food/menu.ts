// A menu, for any business that sells food: the restaurant now, then the
// takeaway, café and pub. Sections of dishes with allergens and option
// groups, the owner's allergen statement, and where the menu came from.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLERGENS, type Allergen, type Menu, type MenuCategory, type MenuItem, type ModifierGroup } from '../../domain/types.ts';
import { arr, bool, int, key, oneOf, str } from '../common/sanitise.ts';
import type { Issue } from '../common/types.ts';

export interface MenuAnswer {
  categories: MenuCategory[];
  modifier_groups: Record<string, ModifierGroup>;
  allergen_statement: string;
  source: 'sample' | 'draft' | 'website' | 'manual';
  /** Drafted allergens are illustrations until the owner checks them. */
  allergens_are_examples: boolean;
}

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'fixtures');
const samples = new Map<string, Menu>();

/**
 * A sample menu from a fixture under fixtures/ ("tenants/lucas-trattoria.json"),
 * complete with allergens and options. Read once; every call gets its own
 * copy, because a builder edits its defaults in place. It is cleaned as it is
 * read, the way a saved menu is: the fixture leaves allergens off some
 * options, and defaults that the first save would change are not stable.
 */
export function sampleMenu(file: string): MenuAnswer {
  let m = samples.get(file);
  if (!m) {
    const p = JSON.parse(readFileSync(join(FIXTURES, file), 'utf8'));
    const clean = sanitiseMenu(
      { ...p.menu, source: 'sample', allergens_are_examples: true },
      { categories: [], modifier_groups: {}, allergen_statement: '', source: 'sample', allergens_are_examples: true },
    );
    m = { categories: clean.categories, modifier_groups: clean.modifier_groups, allergen_statement: clean.allergen_statement };
    samples.set(file, m);
  }
  const copy = structuredClone(m);
  return {
    categories: copy.categories,
    modifier_groups: copy.modifier_groups,
    allergen_statement: copy.allergen_statement,
    source: 'sample',
    allergens_are_examples: true,
  };
}

const allergens = (v: unknown): Allergen[] => [...new Set(arr(v).filter((a): a is Allergen => ALLERGENS.includes(a as Allergen)))];

export function sanitiseMenu(v: any, d: MenuAnswer): MenuAnswer {
  if (!v || typeof v !== 'object') return d;
  const groups: Record<string, ModifierGroup> = {};
  for (const [k, g] of Object.entries((v.modifier_groups ?? {}) as Record<string, any>).slice(0, 30)) {
    const gk = key(k, 'options');
    groups[gk] = {
      label: str(g?.label, 40, 'Options'),
      min: int(g?.min, 0, 5, 0),
      max: int(g?.max, 1, 10, 1),
      options: arr(g?.options).slice(0, 20).map((o: any, i) => ({
        key: key(o?.key ?? o?.name, `opt_${i + 1}`),
        name: str(o?.name, 50, `Option ${i + 1}`),
        price_pence: int(o?.price_pence, 0, 100000, 0),
        allergens: allergens(o?.allergens),
      })),
    };
  }
  const itemKeys = new Set<string>();
  const categories: MenuCategory[] = arr(v.categories).slice(0, 20).map((c: any, ci) => ({
    key: key(c?.key ?? c?.label, `cat_${ci + 1}`),
    label: str(c?.label, 40, `Section ${ci + 1}`),
    items: arr(c?.items).slice(0, 60).map((it: any, ii): MenuItem => {
      let k = key(it?.key ?? it?.name, `item_${ci + 1}_${ii + 1}`);
      while (itemKeys.has(k)) k = `${k}_2`;
      itemKeys.add(k);
      const dietary = arr(it?.dietary).filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 20)).slice(0, 5);
      const mods = arr(it?.modifier_groups).filter((g): g is string => typeof g === 'string' && g in groups);
      const aliases = arr(it?.aliases).filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 40)).slice(0, 5);
      return {
        key: k,
        name: str(it?.name, 60, `Dish ${ii + 1}`) || `Dish ${ii + 1}`,
        price_pence: int(it?.price_pence, 0, 100000, 0),
        description: str(it?.description, 200) || undefined,
        allergens: allergens(it?.allergens),
        allergens_unknown: it?.allergens_unknown === true || undefined,
        may_contain: allergens(it?.may_contain).length ? allergens(it?.may_contain) : undefined,
        dietary: dietary.length ? dietary : undefined,
        modifier_groups: mods.length ? mods : undefined,
        available: it?.available === false ? false : undefined,
        aliases: aliases.length ? aliases : undefined,
      };
    }),
  }));
  return {
    categories,
    modifier_groups: groups,
    allergen_statement: str(v.allergen_statement, 600, d.allergen_statement) || d.allergen_statement,
    source: oneOf(v.source, ['sample', 'draft', 'website', 'manual'] as const, 'manual'),
    allergens_are_examples: bool(v.allergens_are_examples, true),
  };
}

export const menuItems = (m: MenuAnswer): MenuItem[] => m.categories.flatMap((c) => c.items);
export const hasMenu = (m: MenuAnswer): boolean => m.categories.some((c) => c.items.length);

export const compileMenu = (m: MenuAnswer): Menu => ({ categories: m.categories, modifier_groups: m.modifier_groups, allergen_statement: m.allergen_statement });

/** `orderable`: takeaway is on, so callers will order from this menu. */
export function validateMenu<K extends string>(m: MenuAnswer, step: K, opts: { orderable: boolean }): Issue<K>[] {
  const out: Issue<K>[] = [];
  const items = menuItems(m);
  if (opts.orderable && !items.length) out.push({ step, level: 'error', message: 'Takeaway needs a menu: add some dishes or turn takeaway off.' });
  if (items.some((i) => i.price_pence === 0)) out.push({ step, level: 'warning', message: 'Some dishes have no price yet.' });
  if (m.allergens_are_examples && items.length) out.push({ step, level: 'warning', message: 'The allergens are examples until you check them.' });
  return out;
}
