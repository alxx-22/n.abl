// The setup wizard: a prospect's website in, a draft tenant profile out.
//
// Fetches the homepage and up to eight same-site pages that look useful
// (menu, contact, FAQs, services), plus a PDF menu if one is linked. A text
// model extracts only what the pages state, into a fixed schema. Everything
// the model could not find, or that had to be assumed (table layout, booking
// windows), is listed in `review_notes` for a person to check before publish.

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { Config } from '../config.ts';
import { generateJson } from '../core/gemini.ts';
import { ALLERGENS, type BusinessType, type TenantProfile, type Window } from '../domain/types.ts';
import { minutesOf, timeOf } from '../domain/time.ts';
import { freePin } from '../demo/access.ts';

const USEFUL = /menu|food|drink|eat|about|contact|find|visit|location|faq|question|book|reserv|hours|opening|allergen|price|service|treatment|spa|room|stay|takeaway|order|deliver|policy|terms/i;
const MAX_PAGES = 8;
const MAX_HTML = 1_500_000;
const MAX_TEXT = 14_000;

function privateAddress(ip: string): boolean {
  if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
  const m = /^(\d+)\.(\d+)\./.exec(ip.replace(/^::ffff:/, ''));
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** Only public http(s) sites: the wizard must not become a way to probe the server's own network. */
export async function assertPublicUrl(raw: string, allowPrivate = false): Promise<URL> {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new Error('That is not a web address.');
  }
  if (allowPrivate) return u;
  if (!['http:', 'https:'].includes(u.protocol) || (u.port && !['80', '443'].includes(u.port))) throw new Error('Only ordinary http(s) websites.');
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(u.hostname)) throw new Error('Not a public website.');
  const addrs = isIP(u.hostname) ? [{ address: u.hostname }] : await lookup(u.hostname, { all: true });
  if (addrs.some((a) => privateAddress(a.address))) throw new Error('Not a public website.');
  return u;
}

let ALLOW_PRIVATE = false;

async function fetchLimited(u: URL, accept = 'text/html'): Promise<{ type: string; body: Buffer } | null> {
  try {
    const res = await fetch(u, {
      headers: { 'user-agent': 'nabl-reception-setup/0.1 (+demo setup; one-off read)', accept },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok || !res.body) return null;
    const final = new URL(res.url);
    await assertPublicUrl(final.href, ALLOW_PRIVATE);
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of res.body as unknown as AsyncIterable<Uint8Array>) {
      size += c.length;
      if (size > (accept.includes('pdf') ? 6_000_000 : MAX_HTML)) break;
      chunks.push(Buffer.from(c));
    }
    return { type: res.headers.get('content-type') ?? '', body: Buffer.concat(chunks) };
  } catch {
    return null;
  }
}

async function robotsDisallows(origin: URL): Promise<string[]> {
  const r = await fetchLimited(new URL('/robots.txt', origin), 'text/plain');
  if (!r) return [];
  const out: string[] = [];
  let applies = false;
  for (const line of r.body.toString('utf8').split('\n')) {
    const [k, ...v] = line.split(':');
    const key = k.trim().toLowerCase();
    const val = v.join(':').trim();
    if (key === 'user-agent') applies = val === '*';
    else if (applies && key === 'disallow' && val) out.push(val);
  }
  return out;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', pound: '£', rsquo: '’', lsquo: '‘', ndash: '–', mdash: '—', hellip: '…' };

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/section|\/article)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function linksOf(html: string, base: URL): URL[] {
  const out = new Map<string, URL>();
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const u = new URL(m[1], base);
      if (u.origin !== base.origin) continue;
      const label = htmlToText(m[2]);
      if (USEFUL.test(u.pathname) || USEFUL.test(label)) out.set(u.href.replace(/\/$/, ''), u);
    } catch {
      /* ignore */
    }
  }
  return [...out.values()];
}

// ── Extraction ───────────────────────────────────────────────────────────

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    business_type: { type: 'STRING', enum: ['restaurant', 'cafe', 'takeaway', 'pub', 'hotel', 'salon', 'barber', 'other'] },
    summary: { type: 'STRING', description: 'One sentence, in the business’s own terms.' },
    address: { type: 'STRING' },
    phone: { type: 'STRING' },
    opening_hours: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { day: { type: 'STRING', enum: DAYS }, open: { type: 'STRING', description: 'HH:MM 24h' }, close: { type: 'STRING', description: 'HH:MM 24h' }, label: { type: 'STRING' } },
        required: ['day', 'open', 'close'],
      },
    },
    takes_table_bookings: { type: 'BOOLEAN' },
    takes_appointments: { type: 'BOOLEAN' },
    takes_food_orders: { type: 'BOOLEAN', description: 'True if the site mentions takeaway, collection, delivery or phone orders.' },
    offers_delivery: { type: 'BOOLEAN' },
    appointment_services: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, duration_minutes: { type: 'INTEGER' }, price_pence: { type: 'INTEGER' } }, required: ['name'] },
    },
    staff_names: { type: 'ARRAY', items: { type: 'STRING' } },
    menu: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          category: { type: 'STRING' },
          items: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                description: { type: 'STRING' },
                price_pence: { type: 'INTEGER' },
                allergens_stated: { type: 'BOOLEAN', description: 'True only if the site states this dish’s allergens.' },
                allergens: { type: 'ARRAY', items: { type: 'STRING', enum: [...ALLERGENS] }, description: 'What the dish contains.' },
                may_contain: { type: 'ARRAY', items: { type: 'STRING', enum: [...ALLERGENS] }, description: 'Only "may contain" or trace warnings.' },
                dietary: { type: 'ARRAY', items: { type: 'STRING' } },
              },
              required: ['name', 'price_pence', 'allergens_stated'],
            },
          },
        },
        required: ['category', 'items'],
      },
    },
    faqs: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { q: { type: 'STRING' }, a: { type: 'STRING' }, source_url: { type: 'STRING' } }, required: ['q', 'a'] },
    },
    policies: { type: 'ARRAY', items: { type: 'OBJECT', properties: { topic: { type: 'STRING' }, text: { type: 'STRING' } }, required: ['topic', 'text'] } },
    core_facts: { type: 'ARRAY', items: { type: 'STRING' }, description: 'The five things callers most often ask, as short sentences.' },
    missing_or_unclear: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['name', 'business_type', 'summary', 'opening_hours', 'core_facts', 'faqs'],
};

interface Extracted {
  name: string;
  business_type: BusinessType;
  summary: string;
  address?: string;
  phone?: string;
  opening_hours: { day: string; open: string; close: string; label?: string }[];
  takes_table_bookings?: boolean;
  takes_appointments?: boolean;
  takes_food_orders?: boolean;
  offers_delivery?: boolean;
  appointment_services?: { name: string; duration_minutes?: number; price_pence?: number }[];
  staff_names?: string[];
  menu?: { category: string; items: { name: string; description?: string; price_pence: number; allergens_stated: boolean; allergens?: string[]; may_contain?: string[]; dietary?: string[] }[] }[];
  faqs: { q: string; a: string; source_url?: string }[];
  policies?: { topic: string; text: string }[];
  core_facts: string[];
  missing_or_unclear?: string[];
}

const isAllergen = (a: string): a is (typeof ALLERGENS)[number] => (ALLERGENS as readonly string[]).includes(a);

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'new-business';
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);

/** `pin`: the demo line PIN the drafted business will answer to. */
export function toProfile(x: Extracted, site: string, pin: string): TenantProfile & { review_notes: string[] } {
  const notes = [...(x.missing_or_unclear ?? []).map((m) => `Not found on the site: ${m}`)];
  const hours = new Map<string, { days: number[]; open: string; close: string; label?: string }>();
  for (const h of x.opening_hours) {
    const d = DAYS.indexOf(h.day.toLowerCase());
    if (d < 0 || !/^\d{2}:\d{2}$/.test(h.open) || !/^\d{2}:\d{2}$/.test(h.close)) continue;
    const k = `${h.open}-${h.close}-${h.label ?? ''}`;
    const e = hours.get(k) ?? { days: [], open: h.open, close: h.close, label: h.label };
    e.days.push(d);
    hours.set(k, e);
  }
  const opening = [...hours.values()];
  if (!opening.length) notes.push('No opening hours found. Add them before publishing.');

  const profile: TenantProfile & { review_notes: string[] } = {
    slug: slugify(x.name),
    name: x.name,
    business_type: x.business_type,
    timezone: 'Europe/London',
    status: 'demo',
    demo_pin: pin,
    voice: x.business_type === 'barber' ? 'Charon' : 'Kore',
    greeting: `Hello, you're through to ${x.name}. I'm the AI assistant, and this is a demo line. How can I help?`,
    summary: x.summary,
    address: x.address ?? '',
    phone_display: x.phone,
    website: site,
    core_facts: x.core_facts.slice(0, 6),
    opening_hours: opening,
    knowledge: [
      ...x.faqs.map((f) => ({ q: f.q, a: f.a, source: f.source_url })),
      // A policy the FAQs already state is not repeated.
      ...(x.policies ?? [])
        .filter((p) => !x.faqs.some((f) => f.a.trim().toLowerCase() === p.text.trim().toLowerCase()))
        .map((p) => ({ q: `${p.topic}?`, a: p.text, tags: [p.topic] })),
    ],
    review_notes: notes,
  };

  const windows = (lastOffset: number): Window[] =>
    opening.map((h) => ({ days: h.days, first: h.open, last: timeOf(Math.max(minutesOf(h.open), minutesOf(h.close) - lastOffset)) }));

  if (x.takes_table_bookings && opening.length) {
    profile.booking = {
      services: [{
        key: 'table', label: 'table', kind: 'table', slot_minutes: 15,
        duration_rules: [{ max_party: 2, minutes: 75 }, { max_party: 4, minutes: 90 }, { max_party: 10, minutes: 120 }],
        windows: windows(90), max_party: 10,
        large_party_note: 'For more than 10, take their details and the manager will call back.',
        lead_minutes: 30, horizon_days: 60,
      }],
      resources: [
        ...[1, 2, 3, 4].map((n) => ({ key: `T${n}`, label: `Table ${n}`, capacity: 2, services: ['table'] })),
        ...[5, 6, 7, 8, 9].map((n) => ({ key: `T${n}`, label: `Table ${n}`, capacity: 4, services: ['table'] })),
        ...[10, 11].map((n) => ({ key: `T${n}`, label: `Table ${n}`, capacity: 6, min: 3, services: ['table'] })),
        { key: 'T10+T11', label: 'Tables 10 and 11 together', capacity: 10, min: 7, combines: ['T10', 'T11'], services: ['table'] },
      ],
    };
    notes.push('Table layout is assumed (four 2s, five 4s, two 6s). Booking windows assume last seating 90 minutes before close.');
  } else if (x.takes_appointments && x.appointment_services?.length && opening.length) {
    const staff = x.staff_names?.length ? x.staff_names : ['First available'];
    if (!x.staff_names?.length) notes.push('No staff names found: one bookable column is assumed.');
    const services = x.appointment_services.slice(0, 12).map((s) => ({
      key: key(s.name), label: s.name.toLowerCase(), kind: 'appointment' as const, slot_minutes: 15,
      duration_minutes: s.duration_minutes || 30, price_pence: s.price_pence || undefined,
      windows: windows(s.duration_minutes || 30), lead_minutes: 30, horizon_days: 28,
    }));
    if (x.appointment_services.some((s) => !s.duration_minutes)) notes.push('Some appointment lengths were not stated; 30 minutes assumed.');
    profile.booking = { services, resources: staff.map((n) => ({ key: key(n), label: n, services: services.map((s) => s.key) })) };
  }

  // The menu is kept whenever dishes were found: it answers questions even
  // where the business takes no orders. Ordering needs both.
  if (x.menu?.some((c) => c.items.length)) {
    const noAllergens = x.menu.flatMap((c) => c.items).filter((i) => !i.allergens_stated).length;
    if (noAllergens) notes.push(`${noAllergens} dishes have no published allergens: the agent will say it cannot confirm allergens for them. Add the business's allergen matrix before any real use.`);
    profile.menu = {
      allergen_statement: "Our kitchen handles all 14 major allergens, so we can't guarantee any dish is completely free from traces. For a severe allergy, we'll note it and the kitchen will take extra care.",
      modifier_groups: {},
      categories: x.menu.map((c) => ({
        key: key(c.category), label: c.category,
        items: c.items.filter((i) => i.name && i.price_pence > 0).map((i) => ({
          key: key(i.name), name: i.name, price_pence: i.price_pence, description: i.description,
          allergens: i.allergens_stated ? (i.allergens ?? []).filter(isAllergen).filter((a) => !(i.may_contain ?? []).includes(a)) : [],
          may_contain: i.allergens_stated && i.may_contain?.length ? i.may_contain.filter(isAllergen) : undefined,
          allergens_unknown: !i.allergens_stated,
          dietary: i.dietary,
        })),
      })),
    };
    if (x.takes_food_orders) {
      profile.ordering = {
        collection: true,
        delivery: x.offers_delivery ? { districts: [], fee_pence: 250, min_order_pence: 1500, extra_minutes: 20 } : undefined,
        prep_minutes: 20,
        hours: opening,
      };
      if (x.offers_delivery) notes.push('Delivery postcodes, fee and minimum order are not set. Add the postcode districts before publishing.');
    }
  }
  return profile;
}

/**
 * `pinTaken` says whether a business already holds a demo line PIN, so the
 * draft gets a free one, drawn as Start draws them: never 1000 to 1099,
 * which are kept for our own businesses. Without it (the end-to-end test,
 * which saves nothing) any PIN is taken to be free.
 */
export async function ingestWebsite(
  raw: string,
  config: Config,
  opts: { allowPrivate?: boolean; pinTaken?: (pin: string) => Promise<boolean> } = {},
): Promise<TenantProfile & { review_notes: string[]; pages: string[] }> {
  // Only the local end-to-end test reads a private address.
  ALLOW_PRIVATE = Boolean(opts.allowPrivate);
  const start = await assertPublicUrl(raw, ALLOW_PRIVATE);
  const disallow = await robotsDisallows(start);
  const allowed = (u: URL) => !disallow.some((d) => u.pathname.startsWith(d));
  const home = await fetchLimited(start);
  if (!home) throw new Error('Could not load that website.');
  const homeHtml = home.body.toString('utf8');
  const pages: { url: string; text: string }[] = [{ url: start.href, text: htmlToText(homeHtml).slice(0, MAX_TEXT) }];
  const links = linksOf(homeHtml, start).filter(allowed);
  const pdf = links.find((l) => /\.pdf$/i.test(l.pathname) && /menu/i.test(l.pathname));
  for (const link of links.filter((l) => !/\.pdf$/i.test(l.pathname)).slice(0, MAX_PAGES)) {
    const r = await fetchLimited(link);
    if (r && r.type.includes('html')) pages.push({ url: link.href, text: htmlToText(r.body.toString('utf8')).slice(0, MAX_TEXT) });
  }
  const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
    {
      text:
        'Extract a profile of this UK hospitality business from its own web pages, for an AI phone receptionist. ' +
        'Use ONLY facts the pages state. Never invent hours, prices, dishes, allergens, policies or staff. ' +
        'Prices in pence. Times as 24-hour HH:MM. Set allergens_stated true only where the site lists that dish’s allergens. ' +
        'FAQs: turn anything a caller might ask (parking, access, dogs, children, dietary, events, deposits, cancellations) into question and answer pairs, in the business’s words. ' +
        'List anything a receptionist would need but the pages do not say in missing_or_unclear.\n\n' +
        pages.map((p) => `=== ${p.url} ===\n${p.text}`).join('\n\n'),
    },
  ];
  if (pdf && allowed(pdf)) {
    const r = await fetchLimited(pdf, 'application/pdf');
    if (r && r.type.includes('pdf')) parts.push({ inlineData: { mimeType: 'application/pdf', data: r.body.toString('base64') } });
  }
  const extracted = await generateJson<Extracted>(config.textModel, parts, config.keys.scout, SCHEMA, { temperature: 0.1 });
  const pin = await freePin(opts.pinTaken ?? (async () => false));
  return { ...toProfile(extracted, start.href, pin), pages: pages.map((p) => p.url) };
}
