// The part of a compiled profile every kind of business shares: who it is,
// how it greets, its hours and closures, its brand, and the first two core
// facts. A preset adds its own facts, knowledge, booking and ordering.

import type { BusinessType, KnowledgeEntry, TenantProfile } from '../../domain/types.ts';
import { hoursSentence, openingHours } from './hours.ts';
import type { BaseAnswers, BasicsAnswer, FaqAnswer } from './types.ts';

/** The prompt keeps only this many facts: the rest are the tools' job. */
export const MAX_CORE_FACTS = 6;

/** "a restaurant", "an estate agency". */
export const withArticle = (noun: string) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;

export function greetingFor(basics: BasicsAnswer, noun: string): string {
  const g = basics.greeting.trim();
  if (g) return g;
  const name = basics.name.trim() || `the ${noun}`;
  // "Hello, Pici." sounded like greeting someone called Pici: say where they have rung.
  return `Hello, you're through to ${name}. I'm the AI assistant on this demo line. How can I help?`;
}

/** A knowledge entry, or nothing when the owner left the answer empty. */
export const entry = (q: string, a: string, tags: string[]): KnowledgeEntry | null => (a.trim() ? { q, a: a.trim(), tags } : null);

/** The preset's built-in entries, then the owner's own questions. */
export function mergeFaqs(entries: (KnowledgeEntry | null)[], faqs: FaqAnswer[]): KnowledgeEntry[] {
  return [...entries.filter((x): x is KnowledgeEntry => Boolean(x)), ...faqs.filter((f) => f.q.trim() && f.a.trim()).map((f) => ({ q: f.q.trim(), a: f.a.trim(), tags: [] }))];
}

export function capFacts(facts: (string | null | undefined)[]): string[] {
  return facts.filter((f): f is string => Boolean(f && f.trim())).slice(0, MAX_CORE_FACTS);
}

export type BaseProfile = Pick<
  TenantProfile,
  'slug' | 'name' | 'business_type' | 'timezone' | 'status' | 'voice' | 'greeting' | 'summary' | 'address' | 'phone_display' | 'website' | 'brand' | 'core_facts' | 'opening_hours' | 'closures'
>;

/**
 * The profile's header. Core facts open with who and where, then the hours;
 * `facts` follow in the order given.
 */
export function baseProfile(a: BaseAnswers, meta: { slug: string }, kind: { businessType: BusinessType; noun: string; facts: (string | null | undefined)[] }): BaseProfile {
  const b = a.basics;
  const name = b.name.trim() || `Your ${kind.noun}`;
  const place = b.address.trim() || b.town.trim();
  const style = b.style.trim();
  const where = b.address.trim() ? `, at ${b.address.trim()}` : b.town.trim() ? `, in ${b.town.trim()}` : '';
  return {
    slug: meta.slug,
    name,
    business_type: kind.businessType,
    timezone: 'Europe/London',
    status: 'demo',
    voice: b.voice || 'Kore',
    greeting: greetingFor(b, kind.noun),
    summary: `${name} is ${withArticle(kind.noun)}${b.town.trim() ? ` in ${b.town.trim()}` : ''}${style ? `: ${style}` : ''}.`,
    address: place || 'Address not given',
    phone_display: b.phone_display.trim() || undefined,
    website: b.website.trim() || undefined,
    brand: {
      accent: a.theme.accent,
      primary: a.theme.primary,
      background: a.theme.background,
      font_heading: a.theme.font_heading,
      font_body: a.theme.font_body,
      logo: a.theme.logo,
    },
    core_facts: capFacts([`${name}${style ? `: ${style}` : ''}${where}.`, hoursSentence(a.hours), ...kind.facts]),
    opening_hours: openingHours(a.hours),
    closures: a.hours.closures.filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.date)).map((c) => ({ date: c.date, note: c.note || undefined })),
  };
}
