// A café on a call (presets/cafe.md §4.2): small tables are walk-in, never
// booked; afternoon tea needs notice in days, longer for a gluten-free or
// vegan version, and is priced per person; and "gluten-free" is said only of
// food the owner marked so. Only a profile with `cafe` gets any of this.

import type { FunctionDeclaration } from './live.ts';
import { addDays, isIsoDate, minutesOf, spokenDate, spokenTime, toLocal } from '../domain/time.ts';
import { pounds, type BookableService, type Menu, type MenuItem, type Tenant } from '../domain/types.ts';
import { I, S, int, str } from './tool-kit.ts';
import type { Args, ToolContext } from './tools.ts';

/** check_availability's and create_booking's `children` and `diet`, for a café. */
export function cafeParams(decl: FunctionDeclaration, t: Tenant): FunctionDeclaration {
  if (!t.profile.cafe) return decl;
  const p = { ...(decl.parameters as { properties: Record<string, unknown> }).properties };
  p.children = I("Afternoon tea: how many of the party are children (the children's price)");
  p.diet = S('Afternoon tea: a gluten-free or vegan version, and for how many ("gluten-free for 1")');
  return { ...decl, parameters: { ...(decl.parameters as object), properties: p } } as FunctionDeclaration;
}

/** A table for fewer than the booking size: walk-in, and nothing promised. Null when it can be booked. */
export function walkInFirst(ctx: ToolContext, service: BookableService, party: number, key: 'available' | 'booked'): Record<string, unknown> | null {
  if (!ctx.tenant.profile.cafe || !service.min_party || party >= service.min_party) return null;
  return { [key]: false, reason: 'walk_in', message: service.walk_in_note ?? `Tables for fewer than ${service.min_party} are walk-in.` };
}

const DIET_WORDS: Record<string, RegExp> = {
  'gluten-free': /\b(?:coeliac|celiac|gluten)/i,
  vegan: /\bvegan/i,
};

/** The service's diets the call has asked for: in `diet`, the allergies, or what the caller said lately. */
export function dietsAsked(ctx: ToolContext, service: BookableService, args: Args): string[] {
  const said = [str(args.diet), str(args.allergies), str(args.notes), ...ctx.state.heard.slice(-6)].filter(Boolean).join(' ');
  return (service.diets ?? []).filter((d) => (DIET_WORDS[d.toLowerCase()] ?? new RegExp(`\\b${d}`, 'i')).test(said));
}

/**
 * Notice in days: afternoon tea a day ahead, a gluten-free or vegan version
 * two. Too soon says the earliest day, and that the standard tea may be
 * sooner. Null when there's notice enough, or no date yet.
 */
export function noticeFirst(ctx: ToolContext, service: BookableService, date: string, args: Args, key: 'available' | 'booked' | 'changed'): Record<string, unknown> | null {
  if (!ctx.tenant.profile.cafe || (!service.notice_days && !service.diet_notice_days) || !isIsoDate(date)) return null;
  const today = toLocal(ctx.now(), ctx.tenant.profile.timezone).date;
  const diets = dietsAsked(ctx, service, args);
  const days = diets.length ? (service.diet_notice_days ?? service.notice_days ?? 0) : (service.notice_days ?? 0);
  const earliest = addDays(today, days);
  if (date >= earliest) return null;
  const plain = service.notice_days ?? 0;
  const sooner = diets.length && days > plain && date >= addDays(today, plain);
  return {
    [key]: false, reason: 'notice', earliest,
    message: `${service.label} needs booking ${days === 1 ? 'a day' : `${days} days`} ahead${diets.length ? ` for a ${diets.join(' or ')} version` : ''}: the earliest is ${spokenDate(earliest)}. Offer that${sooner ? `, or the standard ${service.label.toLowerCase()} on the day they asked for the rest of the table, said plainly` : ''}.`,
  };
}

/** The price per person and the total, for the party and its children. Null for anything not priced per person. */
export function perPerson(service: BookableService, party: number, children: number): { price: string; total: string } | null {
  const pp = service.per_person;
  if (!pp) return null;
  const kids = Math.max(0, Math.min(children, party));
  const total = (party - kids) * pp.adult_pence + kids * pp.child_pence;
  return {
    price: `${pounds(pp.adult_pence)} a person${pp.child_pence ? `, ${pounds(pp.child_pence)} for under-${pp.child_under}s` : ''}`,
    total: `${pounds(total)} for ${party}${kids ? `, ${kids} of them children` : ''}`,
  };
}

/** What to read back for afternoon tea: the day, the sitting, how many, the total and any diet. */
export function teaReadBack(service: BookableService, total: string | undefined, diets: string[]): string {
  return `Read back the ${service.label.toLowerCase()}: the day, the sitting, how many (children too)${total ? `, the total (${total})` : ''}${diets.length ? `, and the ${diets.join(' and ')} version for whom` : ''}; book with create_booking when they say yes, with the diet in diet.`;
}

/** The party, and its children, from a call's arguments. */
export const partyOf = (args: Args) => ({ party: int(args.party_size) ?? 1, children: int(args.children) ?? 0 });

/**
 * "Gluten-free" only for an item the owner marked so; otherwise made without
 * gluten ingredients, in a kitchen that uses flour (presets/cafe-use-cases.md:
 * the 20 ppm rule). Undefined for an item with gluten, or not a café.
 */
export function glutenAnswer(ctx: ToolContext, item: MenuItem): string | undefined {
  if (!ctx.tenant.profile.cafe || item.allergens.includes('gluten')) return undefined;
  if (item.dietary?.some((d) => /gluten[- ]free/i.test(d))) {
    ctx.state.glutenFreeSaid = true;
    return 'Marked gluten-free by the café: you may say so.';
  }
  return 'Made without gluten ingredients, but in a kitchen that uses flour: say exactly that, and never call it gluten-free.';
}

/**
 * Breakfast after its time ("until 11:30"), by when the order is ready:
 * never added, and the rest of the menu offered. Null for anything else, or
 * before then.
 */
export function breakfastOver(ctx: ToolContext, menu: Menu, key: string): string | null {
  const until = ctx.tenant.profile.cafe?.breakfast_until;
  if (!until) return null;
  const c = menu.categories.find((x) => x.items.some((i) => i.key === key));
  if (!c || !/breakfast/i.test(`${c.key} ${c.label}`)) return null;
  const ready = ctx.state.fulfilment?.due_at ?? ctx.now();
  if (minutesOf(toLocal(ready, ctx.tenant.profile.timezone).time) < minutesOf(until)) return null;
  return `Breakfast is served until ${spokenTime(until)}. Say sorry, and offer something from lunch or the cakes.`;
}
