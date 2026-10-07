// Meal deals during a call (presets/takeaway.md §4.2): the allergy answer
// choice by choice, and the two offers, worked out here from the menu and the
// basket, never by the model. A deal item lists every allergen any choice
// has, so anything that reads the item alone stays safe; this is where a
// caller hears which choices have it and which don't.

import type { Allergen, Menu, MenuDeal, MenuItem, OrderLine } from './types.ts';
import { pounds } from './types.ts';

export const dealOf = (menu: Menu, itemKey: string): MenuDeal | undefined => menu.deals?.find((d) => d.item_key === itemKey);

const itemOf = (menu: Menu, key: string): MenuItem | undefined => menu.categories.flatMap((c) => c.items).find((i) => i.key === key);
const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs[0] ?? '');
const choicesOf = (menu: Menu, group: string): MenuItem[] => (menu.modifier_groups[group]?.options ?? []).map((o) => itemOf(menu, o.key)).filter((i): i is MenuItem => Boolean(i));

/** An option the deal keeps from a line it replaces: an extra (extra cheese), not one of its choices. */
export function dealExtra(menu: Menu, deal: MenuDeal, optionKey: string): boolean {
  const item = itemOf(menu, deal.item_key);
  const parts = new Set(deal.parts.map((p) => p.group));
  return (item?.modifier_groups ?? []).some((g) => !parts.has(g) && menu.modifier_groups[g]?.options.some((o) => o.key === optionKey));
}

/** Which of a part's choices contain one allergen, and which don't as an ingredient: "every choice contains sesame". */
function allergenClause(choices: MenuItem[], a: Allergen): { says: string; traces: string[] } {
  const has = choices.filter((c) => c.allergens.includes(a));
  const traces = choices.filter((c) => !has.includes(c) && c.may_contain?.includes(a)).map((c) => c.name);
  if (has.length === choices.length) return { says: `${choices.length === 1 ? `${choices[0].name} contains` : 'every choice contains'} ${a}`, traces };
  if (!has.length) return { says: `${choices.length === 1 ? `${choices[0].name} doesn't contain` : 'none of the choices contains'} ${a} as an ingredient`, traces };
  const without = choices.filter((c) => !has.includes(c)).map((c) => c.name);
  return { says: `${list(has.map((c) => c.name))} ${has.length === 1 ? 'contains' : 'contain'} ${a}; ${list(without)} ${without.length === 1 ? "doesn't" : "don't"}, as an ingredient`, traces };
}

/**
 * One part of a deal, for an allergy: allergen by allergen, which choices
 * contain it and which don't as an ingredient, so "gluten or sesame" never
 * reads as both. With none named, what each choice contains.
 */
function partAnswer(label: string, choices: MenuItem[], asked: Allergen[]): string {
  if (choices.some((c) => c.allergens_unknown)) return `${label}: we don't have allergen information for every choice, so it can't be confirmed.`;
  if (!asked.length) {
    return `${label}: ${choices.map((c) => `${c.name} ${c.allergens.length ? `contains ${list(c.allergens)}` : 'has none of the 14 major allergens as ingredients'}`).join('; ')}.`;
  }
  const clauses = asked.map((a) => allergenClause(choices, a));
  const traces = [...new Set(clauses.flatMap((c) => c.traces))];
  return `${label}: ${clauses.map((c) => c.says).join('; ')}.${traces.length ? ` ${list(traces)} may contain traces.` : ''}`;
}

/** A deal's allergy answer, choice by choice, with the shared-kitchen caveat. `asked`: the allergens the caller named, if any. */
export function dealAllergenAnswer(menu: Menu, deal: MenuDeal, asked: Allergen[]): string {
  const item = itemOf(menu, deal.item_key);
  const parts = deal.parts.map((p) => partAnswer(p.label, choicesOf(menu, p.group), asked));
  const fixed = deal.includes.map((k) => itemOf(menu, k)).filter((i): i is MenuItem => Boolean(i));
  const always = fixed.length ? [partAnswer('Always included', fixed, asked)] : [];
  return [`${item?.name ?? 'The deal'}, choice by choice.`, ...parts, ...always, menu.allergen_statement].filter(Boolean).join(' ');
}

export interface DealOffer {
  kind: 'meal' | 'deal';
  say: string;
  /** What add_to_order takes on a yes: the deal, the choices known so far, and the lines it replaces. */
  swap: { deal: string; options: string[]; replaces: number[] };
  /** The deal's choices the caller hasn't picked yet ("Side", "Drink"), to ask before adding it. */
  still_to_choose: string[];
}

const sentence = (s: string) => (s ? `${s[0].toLowerCase()}${s.slice(1).replace(/\.$/, '')}` : s);

/** A deal's main, added on its own: "Make it a Burger meal for £2.50 more: any burger with regular fries and a can." */
export function mealHint(menu: Menu, lines: OrderLine[], added: OrderLine): DealOffer | null {
  if (added.quantity !== 1) return null;
  for (const d of menu.deals ?? []) {
    const [main, ...rest] = d.parts;
    const option = main && main.choose === 1 ? menu.modifier_groups[main.group]?.options.find((o) => o.key === added.item_key) : undefined;
    if (!option) continue;
    // Something for its other parts is already in: the cheaper-as-a-deal offer fits better.
    if (rest.some((p) => lines.some((l) => l.line !== added.line && menu.modifier_groups[p.group]?.options.some((o) => o.key === l.item_key)))) continue;
    const item = itemOf(menu, d.item_key)!;
    const more = item.price_pence + option.price_pence - added.unit_pence;
    if (more <= 0) continue;
    return {
      kind: 'meal',
      say: `Make it a ${item.name} for ${pounds(more)} more${d.description ? `: ${sentence(d.description)}` : ''}.`,
      swap: { deal: item.name, options: [option.name], replaces: [added.line] },
      still_to_choose: rest.map((p) => p.label),
    };
  }
  return null;
}

/** Lines already in the basket that cost more than a deal made of them: "As a Burger meal, that's £1.49 less." The biggest saving wins. */
export function dealHint(menu: Menu, lines: OrderLine[]): DealOffer | null {
  let best: { offer: DealOffer; saving: number } | null = null;
  for (const d of menu.deals ?? []) {
    const used: number[] = [];
    const options: string[] = [];
    let separate = 0;
    let upcharges = 0;
    const complete = d.parts.every((p) => {
      const choices = menu.modifier_groups[p.group]?.options ?? [];
      for (let need = p.choose; need > 0; need--) {
        // One of each, priced as it stands: its free options (a regular fries, a can) and any extras the deal keeps.
        const l = lines.find((x) => !used.includes(x.line) && x.quantity === 1 && !dealOf(menu, x.item_key) && choices.some((o) => o.key === x.item_key)
          && x.modifiers.every((m) => m.price_pence === 0 || dealExtra(menu, d, m.key)));
        if (!l) return false;
        const choice = choices.find((o) => o.key === l.item_key)!;
        used.push(l.line);
        options.push(choice.name);
        separate += l.unit_pence;
        upcharges += choice.price_pence;
      }
      return true;
    });
    if (!complete) continue;
    const item = itemOf(menu, d.item_key)!;
    const saving = separate - item.price_pence - upcharges;
    if (saving > 0 && (!best || saving > best.saving)) {
      best = { saving, offer: { kind: 'deal', say: `As a ${item.name}, that's ${pounds(saving)} less.`, swap: { deal: item.name, options, replaces: used }, still_to_choose: [] } };
    }
  }
  return best?.offer ?? null;
}

/**
 * "No thanks", "just as it is": the caller turned an offer down. A bare "no"
 * counts only on its own or followed by thanks, so "no onions on that" is
 * an order, not a refusal.
 */
export const DECLINED = /^\s*(?:no|nah|nope)(?:\s*[,.!]|\s*$|\s+(?:thanks?|thank you|ta|just|i'?m (?:ok|okay|fine|good)|that'?s (?:ok|okay|fine))\b)|\bno,? thank(?:s| you)\b|\bjust as it is\b|\bnot (?:the|a) (?:meal|deal)\b|\bwithout the (?:meal|deal)\b/i;
