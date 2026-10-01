// Matching what a caller said to what is on the menu, and pricing the basket.
//
// The model passes words ("two margheritas, one with no basil"); the server
// decides what they mean. A confident match is used; an ambiguous one goes
// back to the model as a question, never as a guess. Every total is computed
// here, never generated.

import type { Allergen, Menu, MenuItem, ModifierOption, OrderLine } from './types.ts';
import { pounds } from './types.ts';

const STOP = new Set(['a', 'an', 'the', 'of', 'with', 'and', 'please', 'some', 'one', 'x']);

export function normalise(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => (w.length > 3 && w.endsWith('es') && !w.endsWith('ses') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
}

function lev(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

function wordMatch(q: string, t: string): number {
  if (q === t) return 1;
  if (q.length >= 4 && (t.startsWith(q) || q.startsWith(t))) return 0.85;
  const d = lev(q, t);
  const tol = Math.max(q.length, t.length) >= 7 ? 2 : Math.max(q.length, t.length) >= 4 ? 1 : 0;
  return d <= tol ? 0.75 : 0;
}

/** 0..1: how well the query words cover the name words (and vice versa). */
export function score(query: string, name: string): number {
  const q = normalise(query);
  const n = normalise(name);
  if (!q.length || !n.length) return 0;
  const best = (a: string[], b: string[]) => a.reduce((s, w) => s + Math.max(0, ...b.map((x) => wordMatch(w, x))), 0) / a.length;
  return 0.6 * best(q, n) + 0.4 * best(n, q);
}

export interface ItemMatch {
  item: MenuItem;
  category: string;
  score: number;
}

export function allItems(menu: Menu): { item: MenuItem; category: string }[] {
  return menu.categories.flatMap((c) => c.items.map((item) => ({ item, category: c.label })));
}

export function findItems(menu: Menu, query: string): ItemMatch[] {
  const out: ItemMatch[] = [];
  for (const { item, category } of allItems(menu)) {
    const names = [item.name, ...(item.aliases ?? [])];
    const s = Math.max(...names.map((n) => score(query, n)));
    if (s > 0.45) out.push({ item, category, score: s });
  }
  return out.sort((a, b) => b.score - a.score);
}

export type Resolve<T> = { ok: true; value: T } | { ok: false; question: string; options?: string[] };

export function resolveItem(menu: Menu, query: string): Resolve<MenuItem> {
  const matches = findItems(menu, query);
  if (!matches.length) return { ok: false, question: `"${query}" is not on the menu.` };
  const [top, next] = matches;
  const gap = next ? top.score - next.score : 1;
  if (top.score >= 0.8 && gap >= 0.12) return { ok: true, value: top.item };
  if (top.score >= 0.6 && gap >= 0.15) return { ok: true, value: top.item };
  const options = matches.slice(0, 3).map((m) => m.item.name);
  return { ok: false, question: `Which one: ${options.join(', or ')}?`, options };
}

export function optionsFor(menu: Menu, item: MenuItem): { group: string; option: ModifierOption }[] {
  return (item.modifier_groups ?? []).flatMap((g) =>
    (menu.modifier_groups[g]?.options ?? []).map((option) => ({ group: g, option })),
  );
}

export function resolveModifiers(
  menu: Menu,
  item: MenuItem,
  requested: string[],
): { ok: true; value: ModifierOption[] } | { ok: false; question: string; unmatched: string[] } {
  const available = optionsFor(menu, item);
  const picked: { group: string; option: ModifierOption }[] = [];
  const unmatched: string[] = [];
  for (const r of requested.map((x) => x.trim()).filter(Boolean)) {
    const scored = available
      .map((a) => ({ ...a, s: Math.max(score(r, a.option.name), score(r, a.option.key.replace(/_/g, ' '))) }))
      .sort((a, b) => b.s - a.s);
    if (scored[0] && scored[0].s >= 0.7) picked.push(scored[0]);
    else unmatched.push(r);
  }
  if (unmatched.length) {
    const names = available.map((a) => a.option.name);
    return {
      ok: false,
      unmatched,
      question:
        `Not an option for ${item.name}: ${unmatched.join(', ')}. ` +
        (names.length ? `Options are: ${names.join(', ')}. ` : 'It has no options. ') +
        'A special request can go in the line notes instead, if the caller agrees.',
    };
  }
  // Group rules: required choices and maximums.
  for (const g of item.modifier_groups ?? []) {
    const group = menu.modifier_groups[g];
    if (!group) continue;
    const count = picked.filter((p) => p.group === g).length;
    if (count < group.min) {
      return { ok: false, unmatched: [], question: `${item.name} needs a choice of ${group.label}: ${group.options.map((o) => o.name).join(', ')}.` };
    }
    if (count > group.max) {
      return { ok: false, unmatched: [], question: `Only ${group.max} ${group.label.toLowerCase()} allowed on ${item.name}.` };
    }
  }
  return { ok: true, value: picked.map((p) => p.option) };
}

export function lineTotal(l: OrderLine): number {
  return l.quantity * (l.unit_pence + l.modifiers.reduce((s, m) => s + m.price_pence, 0));
}

export function describeLine(l: OrderLine): string {
  const mods = l.modifiers.map((m) => m.name);
  if (l.notes) mods.push(`note: ${l.notes}`);
  return `${l.quantity} × ${l.name}${mods.length ? ` (${mods.join(', ')})` : ''} — ${pounds(lineTotal(l))}`;
}

export function allergensOf(menu: Menu, item: MenuItem, modifiers: ModifierOption[] = []): Allergen[] {
  const set = new Set<Allergen>(item.allergens);
  for (const m of modifiers) for (const a of m.allergens ?? []) set.add(a);
  return [...set].sort();
}

const ALLERGEN_WORDS: [RegExp, Allergen[]][] = [
  [/dairy|lactose|milk|cheese|cream|butter/, ['milk']],
  [/gluten|coeliac|celiac|wheat|barley|\brye\b/, ['gluten']],
  [/peanut/, ['peanuts']],
  [/(?<!pea)nut|almond|walnut|hazelnut|cashew|pistachio|pecan/, ['nuts']],
  [/shellfish/, ['crustaceans', 'molluscs']],
  [/crustacean|prawn|shrimp|crab|lobster|langoustine/, ['crustaceans']],
  [/mollusc|mussel|oyster|squid|clam|scallop|octopus/, ['molluscs']],
  [/\beggs?\b/, ['eggs']],
  [/\bfish\b/, ['fish']],
  [/\bsoy|soya/, ['soya']],
  [/sesame/, ['sesame']],
  [/celery|celeriac/, ['celery']],
  [/mustard/, ['mustard']],
  [/lupin/, ['lupin']],
  [/sulph|sulfite/, ['sulphites']],
];

/** The 14 allergens a caller's words name: "dairy" is milk, "shellfish" is crustaceans and molluscs. */
export function allergensNamed(text: string): Allergen[] {
  const s = text.toLowerCase();
  return [...new Set(ALLERGEN_WORDS.filter(([re]) => re.test(s)).flatMap(([, a]) => a))];
}

/** The approved allergen wording: data first, then the kitchen caveat, never "safe". */
export function allergenAnswer(menu: Menu, item: MenuItem): string {
  if (item.allergens_unknown) {
    return `I don't have allergen information for the ${item.name}, so I can't confirm what's in it. The team can check with the kitchen: offer to take a message or note the allergy on the order. ${menu.allergen_statement}`;
  }
  const contains = item.allergens.length ? `contains ${item.allergens.join(', ')}` : 'has none of the 14 major allergens as ingredients';
  const may = item.may_contain?.length ? ` It may contain traces of ${item.may_contain.join(', ')}.` : '';
  return `${item.name} ${contains}.${may} ${menu.allergen_statement}`;
}
