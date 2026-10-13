// A café on a call (presets/cafe.md §4.2): small tables are walk-in, never
// booked; afternoon tea needs notice in days, longer for a gluten-free or
// vegan version, and is priced per person; and "gluten-free" is said only of
// food the owner marked so. Only a profile with `cafe` gets any of this.

import type { FunctionDeclaration } from './live.ts';
import { addDays, isIsoDate, minutesOf, spokenDate, spokenTime, toLocal } from '../domain/time.ts';
import { allergensNamed } from '../domain/menu.ts';
import { pounds, type BookableService, type Menu, type MenuItem, type Tenant } from '../domain/types.ts';
import { displayUkPhone, normaliseUkPhone } from '../domain/phone.ts';
import { I, S, int, smsTo, str } from './tool-kit.ts';
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

// ── After the visit, and other callers (presets/cafe-use-cases.md) ──────────

const CF_CATEGORIES = ['booking', 'complaint', 'unwell', 'cake_order', 'hire', 'lost_property', 'staff', 'supplier', 'careers', 'compliment', 'other'] as const;

/** Who to call if they're still unwell: never advice of our own. */
export const UNWELL_ADVICE = "If you're still unwell, do call your GP or NHS 111, or 999 if it's serious.";

/** take_message for a café: what each kind of call needs, and a category and urgency for the owner. */
export function cafeMessageParams(decl: FunctionDeclaration, t: Tenant): FunctionDeclaration {
  if (!t.profile.cafe) return decl;
  const params = decl.parameters as { properties: Record<string, unknown>; required?: string[] };
  return {
    ...decl,
    description: [
      'A message for the owner, with a name and call-back number.',
      'Unhappy with food or an order: say sorry; category complaint, with what and when. Never promise a refund.',
      `Felt unwell after eating: say sorry, then "${UNWELL_ADVICE}" and nothing more on health, no disclaimer of your own; category unwell, with what they ate and when. Never admit fault, guess the cause, or say it wasn't the food.`,
      'A whole cake or platters: category cake_order, with the date, what and how many; never promise or price it.',
      'Hiring the café: category hire, with the date, how many and the idea; never quote a price.',
      "Lost property: category lost_property, with what and when; never say it's been found.",
      'Staff ringing in sick: category staff. A supplier: category supplier, no account details. A job: category careers. A sales call: thank them, say no, take no message.',
    ].join(' '),
    parameters: {
      ...params,
      properties: { ...params.properties, category: S(`One of: ${CF_CATEGORIES.join(', ')}`), urgency: S('urgent, today or this week') },
    },
  } as FunctionDeclaration;
}

/** A café's message, kept with its category and urgency, and what to tell the caller after. Null for anyone else. */
export async function cafeMessage(args: Args, ctx: ToolContext): Promise<Record<string, unknown> | null> {
  if (!ctx.tenant.profile.cafe) return null;
  const category = (CF_CATEGORIES as readonly string[]).includes(str(args.category) ?? '') ? str(args.category)! : 'other';
  const asked = (['urgent', 'today', 'this_week'] as const).find((u) => u === str(args.urgency)?.replace(' ', '_')) ?? null;
  // Staff off sick is urgent; someone ill after eating is for the owner today, whatever was said.
  const urgency = category === 'staff' ? 'urgent' : category === 'unwell' ? (asked === 'urgent' ? 'urgent' : 'today') : asked;
  const phone = normaliseUkPhone(str(args.phone)) ?? ctx.callerPhone;
  const name = str(args.name) ?? 'Unknown';
  const body = str(args.message) ?? '';
  await ctx.repo.addMessage({ tenant_id: ctx.tenant.id, call_id: ctx.callId, kind: 'message', from_name: name, from_phone: phone, body, status: 'new', category, urgency });
  ctx.state.messageTaken = true;
  ctx.action({ kind: 'message_taken', title: `Message from ${name}${urgency === 'urgent' ? ' (urgent)' : ''}`, detail: `${category.replace('_', ' ')} · ${body}${phone ? ` · ${displayUkPhone(phone)}` : ''}` });
  const owner = ctx.tenant.profile.owner_sms_number;
  if (owner) await smsTo(ctx, owner, `${urgency === 'urgent' ? 'URGENT ' : ''}Message from ${name}: ${body}`);
  const note: Record<string, string> = {
    unwell: `Taken for the owner, who will call back today. Make sure they've heard: "${UNWELL_ADVICE}" Never admit fault or guess the cause.`,
    complaint: 'Taken for the owner, who will call back. Never promise a refund.',
    cake_order: 'Taken for the owner, who will call back about it. Never promise it or give a price.',
    hire: 'Taken for the owner, who will call back about it. Never quote a price.',
    lost_property: "Taken: the team will look and call back. Never say it's been found.",
    staff: 'Passed to the owner now. Tell them to rest and that the owner will sort the day.',
  };
  return { taken: true, category, ...(urgency ? { urgency } : {}), note: note[category] ?? 'Tell them the owner will call back.' };
}

// ── "Which cakes can she have?" (presets/cafe-use-cases.md, allergens) ──────

/** A question about what they can eat: "which ... can she have", "is anything safe for her". Not "my sister is coeliac" on its own. */
const WHAT_CAN = /\b(?:which|what|anything|any of)\b[^.?!]{0,60}\b(?:can|could|would|is|are)\b[^.?!]{0,40}\b(?:have|eat|safe|ok(?:ay)?|fine|suitable|free)\b|\b(?:safe|suitable|ok(?:ay)?) for (?:her|him|them|me|my|someone|a)\b/i;

/**
 * "Which of your cakes would be safe for my daughter? She has a nut
 * allergy": the allergen, and the menu section named, for get_menu's
 * free_from. Null for anything else. A live call (13 October) answered
 * this from nowhere, with a disclaimer, and never looked.
 */
export function freeFromAsked(menu: Menu, line: string): { allergen: string; section?: string } | null {
  if (!WHAT_CAN.test(line)) return null;
  const allergen = allergensNamed(line)[0];
  if (!allergen) return null;
  const said = line.toLowerCase();
  const named = (w: string) => w.length > 3 && [w, w.replace(/s$/, ''), w.replace(/es$/, '')].some((x) => new RegExp(`\\b${x}`).test(said));
  const section = menu.categories.find((c) => c.label.toLowerCase().split(/[^a-z']+/).some(named))?.label;
  return section ? { allergen, section } : { allergen };
}
