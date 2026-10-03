// A scan's findings into the restaurant builder, only the parts the prospect
// ticked, each field marked "from your website" (or "our guess" where it was
// inferred) so the builder shows what to check.

import { hoursSentence } from '../presets/common/hours.ts';
import type { BaseAnswers } from '../presets/common/types.ts';
import type { RestaurantAnswers } from '../presets/restaurant/answers.ts';
import type { ScanResult } from './scan.ts';

export type ScanPart = 'identity' | 'hours' | 'menu' | 'theme' | 'services' | 'policies';

const FONT_STACK: Record<string, string> = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'system-ui, sans-serif',
  slab: 'Rockwell, "Roboto Slab", Georgia, serif',
  script: '"Brush Script MT", cursive',
  mono: 'ui-monospace, monospace',
  display: 'Impact, "Arial Narrow", system-ui, sans-serif',
};
export const fontStack = (category: string) => FONT_STACK[category] ?? FONT_STACK.sans;

type Mark = (path: string, how?: 'website' | 'guess') => void;
const marker = (a: BaseAnswers): Mark => (path, how = 'website') => void (a.sources[path] = how);

/** The parts every kind of business takes from its website: who and where it is, its hours, its look. */
function scanIdentity(a: BaseAnswers, r: ScanResult, mark: Mark): void {
  const id = r.identity;
  if (id.name) (a.basics.name = id.name), mark('basics.name');
  if (id.address) (a.basics.address = id.address), mark('basics.address');
  if (id.town) (a.basics.town = id.town), mark('basics.town');
  if (id.phone) (a.basics.phone_display = id.phone), mark('basics.phone_display');
  if (id.style) (a.basics.style = id.style), mark('basics.style', 'guess');
  if (r.url) a.basics.website = r.url;
  if (id.logo) (a.theme.logo = id.logo), mark('theme.logo');
}

function scanHours(a: BaseAnswers, r: ScanResult, mark: Mark): void {
  if (!r.hours) return;
  a.hours.days = r.hours.map((d) => ({ open: d.open && d.services.length > 0, services: d.services.map((s) => ({ ...s, label: s.label || 'Open' })) }));
  mark('hours.days');
}

function scanTheme(a: BaseAnswers, r: ScanResult, mark: Mark): void {
  if (!r.theme) return;
  a.theme.accent = r.theme.accent;
  a.theme.primary = r.theme.primary;
  a.theme.background = r.theme.background;
  a.theme.font_heading = r.theme.font_heading;
  a.theme.font_body = r.theme.font_body;
  mark('theme.accent');
  mark('theme.fonts');
}

/**
 * A scan into any kind of business's answers, its identity, hours and
 * theme only: a business that is not a restaurant takes nothing about menus,
 * tables or dining policies from a website.
 */
export function applyBaseScan<A extends BaseAnswers>(input: A, r: ScanResult, use: Partial<Record<ScanPart, boolean>>): A {
  const a = structuredClone(input);
  const mark = marker(a);
  if (use.identity) scanIdentity(a, r, mark);
  if (use.hours) scanHours(a, r, mark);
  if (use.theme) scanTheme(a, r, mark);
  return a;
}

export function applyScan(input: RestaurantAnswers, r: ScanResult, use: Partial<Record<ScanPart, boolean>>): RestaurantAnswers {
  const a = structuredClone(input);
  const mark = marker(a);

  if (use.identity) scanIdentity(a, r, mark);
  if (use.hours) scanHours(a, r, mark);
  if (use.menu && r.menu) {
    a.menu = {
      categories: r.menu.categories,
      modifier_groups: {},
      allergen_statement: r.menu.allergen_statement || a.menu.allergen_statement,
      source: 'website',
      // Allergens the site states are theirs; the rest are marked unknown on each dish.
      allergens_are_examples: false,
    };
    mark('menu.categories');
  }
  if (use.theme) scanTheme(a, r, mark);
  if (use.services) {
    const s = r.services;
    if (s.reservations !== null) (a.serve.reservations = s.reservations), mark('serve.reservations');
    if (s.takeaway !== null) (a.serve.collection.enabled = s.takeaway), mark('serve.collection');
    if (s.delivery_apps.length) (a.serve.delivery_apps = s.delivery_apps), mark('serve.delivery_apps');
    // Own delivery needs postcode districts before it can be switched on; the builder asks.
    if (r.signals.includes('terrace') || r.signals.includes('outdoor seating') || r.signals.includes('beer garden') || r.signals.includes('garden') || r.signals.includes('courtyard')) {
      const outdoor = a.seating.areas.find((x) => x.kind === 'outdoor');
      const label = r.signals.includes('beer garden') ? 'Beer garden' : r.signals.includes('courtyard') ? 'Courtyard' : r.signals.includes('garden') ? 'Garden' : 'Terrace';
      if (outdoor) (outdoor.label = label), mark('seating.areas', 'guess');
    }
  }
  if (use.policies) {
    for (const [k, v] of Object.entries(r.policies)) {
      if (!v) continue;
      (a.policies as Record<string, unknown>)[k] = v;
      mark(`policies.${k}`);
    }
    if (r.faqs.length) {
      const have = new Set(a.policies.faqs.map((f) => f.q.toLowerCase()));
      a.policies.faqs = [...a.policies.faqs, ...r.faqs.filter((f) => !have.has(f.q.toLowerCase()))].slice(0, 20);
      mark('policies.faqs');
    }
  }
  return a;
}

/** What the builder's scout card shows. */
export function scanView(scan: { id: string; status: 'running' | 'done' | 'failed'; result: any; error: string | null }, progress: { stage: string; pages: number } | null) {
  const r = scan.status === 'done' ? (scan.result as ScanResult) : null;
  let hours = null;
  if (r?.hours) {
    const days = r.hours.map((d) => ({ open: d.open && d.services.length > 0, services: d.services.map((s) => ({ ...s, label: s.label || 'Open' })) }));
    hours = { days: days.filter((d) => d.open).length, sentence: hoursSentence({ days }) };
  }
  const services: string[] = [];
  if (r) {
    const booking = r.services.providers.filter((p) => !['Deliveroo', 'Uber Eats', 'Just Eat', 'Slerp', 'Flipdish'].includes(p));
    if (r.services.reservations) services.push(`table bookings${booking.length ? ` (through ${booking.join(', ')})` : ''}`);
    if (r.services.takeaway) services.push('takeaway');
    if (r.services.delivery_apps.length) services.push(`on ${r.services.delivery_apps.join(', ')}`);
    if (r.signals.some((s) => ['terrace', 'garden', 'beer garden', 'courtyard', 'outdoor seating'].includes(s))) services.push('outdoor seating');
    if (r.signals.includes('private dining')) services.push('private dining');
  }
  const LABELS: Record<string, string> = { children: 'children', dogs: 'dogs', accessibility: 'access', parking: 'parking', dress_code: 'dress code', corkage: 'corkage', cakes: 'cakes', vouchers: 'vouchers', dietary: 'dietary' };
  return {
    id: scan.id,
    status: scan.status,
    stage: progress?.stage ?? (scan.status === 'running' ? 'Starting…' : ''),
    pages: r ? r.pages.length : progress?.pages ?? 0,
    error: scan.status === 'failed' ? scan.error : r?.not_hospitality ? 'That site does not look like a restaurant, café or pub. Is it the right address?' : null,
    notes: r?.notes ?? [],
    found: r
      ? {
          identity: { ...r.identity },
          hours,
          menu: r.menu ? { dishes: r.menu.dishes, priced: r.menu.priced, sections: r.menu.categories.map((c) => c.label), source: r.menu.source_url } : null,
          theme: r.theme ? { accent: r.theme.accent, primary: r.theme.primary, background: r.theme.background, font_heading: r.theme.font_heading, font_body: r.theme.font_body } : null,
          services,
          policies: Object.keys(r.policies).map((k) => LABELS[k] ?? k),
          faqs: r.faqs.length,
        }
      : null,
  };
}
