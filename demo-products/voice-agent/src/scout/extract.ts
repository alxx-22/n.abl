// The scout's reading, without a model: structured data, meta tags, phone
// numbers and postcodes, opening hours in the forms sites write them, who
// they book and deliver through, and the words that say terrace or dogs
// welcome. Everything here is pure and tested (test/scout.test.ts); the model
// is asked only for what this leaves empty. DEMO-SERVICE-PLAN.md §4.7.

import { MIDNIGHT } from '../domain/time.ts';
import { htmlToText } from '../ingest/ingest.ts';

export interface DayHoursFound {
  open: boolean;
  services: { label: string; open: string; close: string }[];
}

/**
 * How pages are read. Bumped when reading changes, so pages and scans cached
 * the old way are read again rather than reused for the fortnight.
 * 2: tabbed menus keep their tab names; prices without a £ sign count.
 * 3: a place that closes at midnight closes at midnight, not a minute before.
 */
export const READER = 3;

/**
 * A closing time as the builder keeps it. Sites and the model write midnight
 * as 00:00 (or 24:00); read as a time of day that is before any opening, so
 * the evening was dropped or cut to 23:59.
 */
export const closingAt = (close: string): string => (close === '00:00' || close === '24:00' ? MIDNIGHT : close);

export interface PageSignals {
  reader?: number;
  title: string | null;
  site_name: string | null;
  description: string | null;
  og_image: string | null;
  theme_color: string | null;
  business: {
    name?: string; telephone?: string; street?: string; town?: string; postcode?: string; cuisine?: string[];
    logo?: string; reservations?: boolean; menu_url?: string; price_range?: string;
  };
  hours: DayHoursFound[] | null;
  phones: string[];
  postcodes: string[];
  providers: string[];
  signals: string[];
  prices: number;
  fonts: string[];
  colours: Record<string, number>;
  links: { url: string; label: string }[];
  pdfs: string[];
  logo_candidates: string[];
  /** The page's own stylesheets, for fonts and colours when there is no render. */
  stylesheets: string[];
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_WORD = '(?:sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)(?:day|s|sday|nesday|rsday|urday)?';
const DAY_RANGE = '-|\\bto\\b|\\buntil\\b|\\btill\\b|\\bthrough\\b';
/** Days as sites write them: "Tuesday to Saturday", "wed, thur", "Fri & Sat", "Mon-Wed, Fri". */
const DAY_LIST = `\\b${DAY_WORD}\\b(?:\\s*(?:${DAY_RANGE}|,|&|\\band\\b|\\/|\\+)\\s*\\b${DAY_WORD}\\b)*`;

// ── Structured data ──────────────────────────────────────────────────────

function jsonLd(html: string): any[] {
  const out: any[] = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1].trim());
      const flat = (x: any): void => {
        if (Array.isArray(x)) x.forEach(flat);
        else if (x && typeof x === 'object') {
          out.push(x);
          if (Array.isArray(x['@graph'])) x['@graph'].forEach(flat);
        }
      };
      flat(j);
    } catch {
      /* broken JSON-LD is common; skip it */
    }
  }
  return out;
}

const BUSINESS_TYPES = /restaurant|foodestablishment|localbusiness|barorpub|cafeorcoffeeshop|bakery|fastfoodrestaurant|winery|brewery|organization/i;

function time24(v: string): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(v);
  if (!m) return null;
  const h = Number(m[1]) % 24;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

function hoursFromSpec(spec: any[]): DayHoursFound[] | null {
  const days: DayHoursFound[] = DAYS.map(() => ({ open: false, services: [] }));
  let any = false;
  for (const s of spec) {
    const opens = time24(String(s?.opens ?? ''));
    const closes = time24(String(s?.closes ?? ''));
    if (!opens || !closes) continue;
    const list = (Array.isArray(s.dayOfWeek) ? s.dayOfWeek : [s.dayOfWeek]).map((d: unknown) => String(d ?? '').replace(/^https?:\/\/schema\.org\//, '').toLowerCase());
    for (const d of list) {
      const i = DAYS.indexOf(d);
      if (i < 0) continue;
      days[i].open = true;
      days[i].services.push({ label: '', open: opens, close: closingAt(closes) });
      any = true;
    }
  }
  return any ? labelServices(days) : null;
}

/** "Mo-Sa 12:00-22:00" (schema.org openingHours text). */
function hoursFromText(list: string[]): DayHoursFound[] | null {
  const days: DayHoursFound[] = DAYS.map(() => ({ open: false, services: [] }));
  const abbr = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'];
  let any = false;
  for (const entry of list) {
    const m = /^([A-Za-z,\-\s]+)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/.exec(entry.trim());
    if (!m) continue;
    const idx: number[] = [];
    for (const part of m[1].split(',')) {
      const [a, b] = part.trim().toLowerCase().split('-').map((x) => abbr.indexOf(x.trim().slice(0, 2)));
      if (a < 0) continue;
      if (b === undefined || b < 0) idx.push(a);
      else for (let d = a; ; d = (d + 1) % 7) { idx.push(d); if (d === b) break; }
    }
    for (const d of idx) {
      days[d].open = true;
      days[d].services.push({ label: '', open: time24(m[2])!, close: closingAt(time24(m[3])!) });
      any = true;
    }
  }
  return any ? labelServices(days) : null;
}

export function labelServices(days: DayHoursFound[]): DayHoursFound[] {
  for (const d of days) {
    // A restaurant opening at midnight is office hours or a shop's, not the dining room's.
    d.services = d.services.filter((x) => x.open >= '06:00');
    if (!d.services.length) d.open = false;
    d.services.sort((a, b) => a.open.localeCompare(b.open));
    // Keep at most three, drop duplicates.
    d.services = d.services.filter((s, i) => d.services.findIndex((x) => x.open === s.open && x.close === s.close) === i).slice(0, 3);
    if (d.services.length === 1) d.services[0].label = d.services[0].open < '15:00' && d.services[0].close > '19:00' ? 'All day' : d.services[0].open >= '16:00' ? 'Dinner' : 'Open';
    else d.services.forEach((s, i) => (s.label = s.open < '15:00' ? (i === 0 ? 'Lunch' : 'Afternoon') : 'Dinner'));
  }
  return days;
}

// ── Hours written as text ────────────────────────────────────────────────

function dayIndex(word: string): number {
  const w = word.toLowerCase().slice(0, 3);
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(w);
}

/** The days a phrase like "Mon-Wed, Fri" names, as day numbers (Sunday 0). */
function daysIn(phrase: string): number[] {
  const out = new Set<number>();
  let prev = -1;
  let range = false;
  for (const m of phrase.matchAll(new RegExp(`\\b(${DAY_WORD})\\b|(${DAY_RANGE})`, 'gi'))) {
    if (m[2]) {
      range = true;
      continue;
    }
    const d = dayIndex(m[1]);
    if (d < 0) continue;
    if (range && prev >= 0) for (let x = prev; x !== d; x = (x + 1) % 7) out.add(x);
    out.add(d);
    prev = d;
    range = false;
  }
  return [...out];
}

/** "5pm", "5.30pm", "17:30", "12 noon", "midnight" → HH:MM. */
export function parseClock(s: string): string | null {
  const t = s.trim().toLowerCase().replace(/\s+/g, '');
  if (/^noon$|^12noon$|^midday$/.test(t)) return '12:00';
  if (t === 'midnight') return '23:59';
  const m = /^(\d{1,2})(?:[:.](\d{2}))?(am|pm)?$/.exec(t);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ?? '00';
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (!m[3] && h > 0 && h < 7) h += 12; // "5-10" on a restaurant's site means evening
  if (h > 23 || Number(min) > 59) return null;
  return `${String(h).padStart(2, '0')}:${min}`;
}

const CLOCK = '(12\\s*noon|\\d{1,2}(?:[:.]\\d{2})?\\s*(?:am|pm)?|noon|midday|midnight)';

/**
 * Opening hours from text like "Tuesday to Saturday 5pm to 10pm. Sunday 12pm
 * to 8pm. Closed Mondays." or "Mon–Fri: 12:00–14:30, 17:30–22:00".
 */
export function hoursFromWords(text: string): DayHoursFound[] | null {
  const days: DayHoursFound[] = DAYS.map(() => ({ open: false, services: [] }));
  let any = false;
  const t = text.replace(/[–—]/g, '-').replace(/ /g, ' ');
  const range = new RegExp(`(${DAY_LIST})\\s*:?\\s*((?:${CLOCK}\\s*(?:-|to|till|until)\\s*${CLOCK}(?:\\s*(?:,|&|and)\\s*)?)+)`, 'gi');
  for (const m of t.matchAll(range)) {
    const named = daysIn(m[1]);
    if (!named.length) continue;
    const spans = [...m[2].matchAll(new RegExp(`${CLOCK}\\s*(?:-|to|till|until)\\s*${CLOCK}`, 'gi'))];
    const services = spans.map((s) => {
      const open = parseClock(s[1]);
      let close = parseClock(s[2]);
      // "5-10": the close is in the evening too.
      if (open && close && close <= open && Number(close.slice(0, 2)) < 12 && !/am/i.test(s[2])) close = `${Number(close.slice(0, 2)) + 12}${close.slice(2)}`;
      if (close && (close === '00:00' || /midnight/i.test(s[2]))) close = MIDNIGHT;
      return { label: '', open, close };
    }).filter((s): s is { label: string; open: string; close: string } => Boolean(s.open && s.close && s.open < s.close));
    if (!services.length) continue;
    for (const d of named) {
      days[d].open = true;
      days[d].services.push(...services.map((s) => ({ ...s })));
      any = true;
    }
  }
  if (!any) return null;
  for (const m of t.matchAll(new RegExp(`closed\\s+(?:on\\s+)?(${DAY_LIST})`, 'gi'))) {
    for (const d of daysIn(m[1])) if (!days[d].services.length) days[d].open = false;
  }
  return labelServices(days);
}

// ── Menus ────────────────────────────────────────────────────────────────

/**
 * A page's text, with each tab panel headed by its tab's name. Site builders
 * (Webflow, and anything using ARIA tabs) list the tab names together above
 * the panels, so as plain text a drinks menu's "aperitivo", "wine", "softs"
 * all sat in one line and the panels below had no headings.
 */
export function pageText(html: string): string {
  const labels = new Map<string, string>();
  for (const m of html.matchAll(/<[a-z]+\b[^>]*\brole=["']tab["'][^>]*>([\s\S]*?)<\/(?:a|button|li|div)>/gi)) {
    const id = /\bid=["']([^"']+)["']/i.exec(m[0])?.[1];
    const label = htmlToText(m[1]).trim();
    if (id && label) labels.set(id, label);
  }
  const headed = html.replace(/<(div|section)\b[^>]*>/gi, (tag) => {
    const webflow = /\bw-tab-pane\b/.test(tag) ? /\bdata-w-tab=["']([^"']+)["']/i.exec(tag)?.[1] : null;
    const aria = /\brole=["']tabpanel["']/i.test(tag)
      ? /\baria-label=["']([^"']+)["']/i.exec(tag)?.[1] ?? labels.get(/\baria-labelledby=["']([^"']+)["']/i.exec(tag)?.[1] ?? '')
      : null;
    const name = webflow ?? aria;
    return name ? `${tag}<h3>${name}</h3>` : tag;
  });
  return htmlToText(headed);
}

/** A price as written: "£12.50", "12.5", "95p". */
const PRICE_WORD = /^£?\s?\d{1,3}(?:[.,]\d{1,2})?p?$/i;
const BARE_PRICE_LINE = /^£?\s?\d{1,3}(?:[.,]\d{1,2})?(?:\s*\/\s*(?:£?\s?\d{1,3}(?:[.,]\d{1,2})?|[–-]))*$/;

/**
 * How many prices a page shows: every "£12.50", plus lines that are only a
 * price under a line that isn't, the way many menus set a price beside each
 * dish with no £ sign ("pici cacio e pepe" then "11.5").
 */
export function priceCount(text: string): number {
  const pounds = (text.match(/£\s?\d{1,3}(?:[.,]\d{2})?/g) ?? []).length;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let bare = 0;
  for (let i = 1; i < lines.length; i++) {
    if (BARE_PRICE_LINE.test(lines[i]) && !lines[i].includes('£') && !BARE_PRICE_LINE.test(lines[i - 1]) && /[a-z]{3}/i.test(lines[i - 1])) bare++;
  }
  return pounds + bare;
}

/** Pence from a price as the menu writes it; 0 when there is none. */
export function pencePrice(written: string): number {
  // "– / – / 47": only by the bottle, so the first price given.
  const first = written.trim().split(/\s*\/\s*/).map((x) => x.replace(/\s+/g, '')).find((x) => /\d/.test(x)) ?? '';
  if (!PRICE_WORD.test(first)) {
    const m = /£\s?(\d{1,3})(?:[.,](\d{1,2}))?/.exec(written);
    return m ? Number(m[1]) * 100 + Number((m[2] ?? '0').padEnd(2, '0')) : 0;
  }
  if (/p$/i.test(first) && !first.startsWith('£')) return Number(first.replace(/\D/g, ''));
  const m = /(\d{1,3})(?:[.,](\d{1,2}))?/.exec(first)!;
  return Number(m[1]) * 100 + Number((m[2] ?? '0').padEnd(2, '0'));
}

/** Seasonal and one-off menus: a Christmas set menu is not what a caller orders from in March. */
const ONE_OFF = /festive|christmas|xmas|valentine|mother'?s|father'?s|easter|new.?year|\bnye\b|halloween|bonfire|party|parties|group|event|function|private|wedding|gift|voucher|jobs?\b|careers|wine.?list|drinks?|cocktail/i;

/** The PDF most likely to be the everyday menu, or null. */
export function menuPdf(pdfs: string[]): string | null {
  const name = (u: string) => decodeURIComponent(u.split('/').pop() ?? '').toLowerCase();
  const scored = pdfs
    .filter((u) => !ONE_OFF.test(name(u)))
    .map((u) => ({ u, n: (/a.?la.?carte|main|dinner|evening|food/.test(name(u)) ? 3 : 0) + (/menu/.test(name(u)) ? 2 : 0) + (/lunch|brunch|breakfast/.test(name(u)) ? 1 : 0) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  return scored[0]?.u ?? null;
}

// ── Everything else ──────────────────────────────────────────────────────

const PROVIDERS: [RegExp, string][] = [
  [/opentable\./i, 'OpenTable'], [/resdiary\./i, 'ResDiary'], [/sevenrooms\./i, 'SevenRooms'], [/designmynight\./i, 'DesignMyNight'],
  [/tablein\./i, 'Tablein'], [/quandoo\./i, 'Quandoo'], [/thefork\./i, 'TheFork'], [/resy\.com/i, 'Resy'], [/collinsbookings|bookings\.collins/i, 'Collins'],
  [/deliveroo\./i, 'Deliveroo'], [/ubereats\.|uber\.com\/.*eats/i, 'Uber Eats'], [/just-eat\.|justeat\./i, 'Just Eat'],
  [/slerp\./i, 'Slerp'], [/flipdish\./i, 'Flipdish'], [/wix\.com\/.*restaurants|wixrestaurants/i, 'Wix Restaurants'],
];

const SIGNALS: [RegExp, string][] = [
  [/\bterrace\b/i, 'terrace'], [/beer garden/i, 'beer garden'], [/\bgarden\b/i, 'garden'], [/courtyard/i, 'courtyard'], [/al fresco|outdoor seating|outside seating/i, 'outdoor seating'],
  [/private dining|private room|private hire|function room/i, 'private dining'],
  [/dogs? (?:are )?(?:very )?welcome|dog[- ]friendly/i, 'dog friendly'], [/no dogs|dogs are not/i, 'no dogs'],
  [/step[- ]free|wheelchair|accessible toilet|disabled access/i, 'step-free'],
  [/gluten[- ]free|coeliac/i, 'gluten free'], [/\bvegan\b/i, 'vegan'], [/vegetarian/i, 'vegetarian'],
  [/car park|parking/i, 'parking'], [/kids'? menu|children'?s menu|high ?chairs?/i, 'children'], [/\bbyo\b|bring your own|corkage/i, 'corkage'],
  [/gift vouchers?|gift cards?/i, 'vouchers'], [/takeaway|take away|collection|click (?:and|&) collect/i, 'takeaway'], [/\bdelivery\b|we deliver/i, 'delivery'],
  [/book (?:a|your) table|reservations?|book now/i, 'reservations'], [/deposit/i, 'deposits'], [/service charge/i, 'service charge'],
];

const UK_PHONE = /(?:\+44\s?\(?0?\)?\s?|\b0)(?:\d\s?){9,10}\b/g;
const POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/g;

function meta(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, 'i');
  const tag = re.exec(html)?.[0];
  const c = tag ? /content=["']([^"']*)["']/i.exec(tag)?.[1] : null;
  return c ? decode(c).trim() || null : null;
}

function decode(s: string): string {
  return htmlToText(s.replace(/</g, '&lt;')).replace(/&lt;/g, '<');
}

function absolute(u: string, base: URL): string | null {
  try {
    const x = new URL(u, base);
    return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : null;
  } catch {
    return null;
  }
}

/** Font families a page asks for: Google Fonts links, @font-face and font-family rules. */
export function fontsOf(html: string, css = ''): string[] {
  const out = new Map<string, number>();
  const add = (f: string, w = 1) => {
    const name = f.replace(/["']/g, '').replace(/\+/g, ' ').replace(/:.*$/, '').trim();
    if (!name || /^(inherit|initial|sans-serif|serif|monospace|cursive|system-ui|-apple-system|blinkmacsystemfont|segoe ui|roboto|helvetica neue|helvetica|arial|var\(.*|ui-.*|emoji|apple color emoji|segoe ui emoji|segoe ui symbol|noto color emoji|fontawesome.*|font awesome.*|icomoon|dashicons|eicons|glyphicons.*|slick|swiper-icons|wix.*|madefor.*)$/i.test(name)) return;
    out.set(name, (out.get(name) ?? 0) + w);
  };
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'\s>]+)/gi)) {
    for (const fam of m[1].replace(/&amp;/g, '&').split('&').filter((p) => p.startsWith('family=')).flatMap((p) => p.slice(7).split('|'))) add(decodeURIComponent(fam), 5);
  }
  const all = `${html}\n${css}`;
  for (const m of all.matchAll(/@font-face\s*{[^}]*font-family:\s*([^;}]+)/gi)) add(m[1].split(',')[0], 2);
  for (const m of all.matchAll(/font-family:\s*([^;}"]+|"[^"]+"[^;}]*)/gi)) add(m[1].split(',')[0], 1);
  return [...out.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 6);
}

/** Hex colours by how often the page's own styles use them (greys, black and white left out). */
export function coloursOf(html: string, css = ''): Record<string, number> {
  const out: Record<string, number> = {};
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>|style=["']([^"']+)["']/gi)].map((m) => m[1] ?? m[2]).join('\n') + css;
  for (const m of styles.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    let h = m[1].toLowerCase();
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (isGrey(`#${h}`)) continue;
    out[`#${h}`] = (out[`#${h}`] ?? 0) + 1;
  }
  return out;
}

export function isGrey(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return Math.max(r, g, b) - Math.min(r, g, b) < 18;
}

export function readPage(html: string, url: string): PageSignals {
  const base = new URL(url);
  const text = pageText(html);
  const ld = jsonLd(html);
  const biz = ld.find((x) => BUSINESS_TYPES.test(String([x['@type']].flat().join(' '))) && (x.name || x.address)) ?? {};
  const addr = Array.isArray(biz.address) ? biz.address[0] : biz.address;
  const business: PageSignals['business'] = {};
  if (typeof biz.name === 'string') business.name = decode(biz.name).trim();
  if (typeof biz.telephone === 'string') business.telephone = biz.telephone.trim();
  if (addr && typeof addr === 'object') {
    if (addr.streetAddress) business.street = String(addr.streetAddress).trim();
    if (addr.addressLocality) business.town = String(addr.addressLocality).trim();
    if (addr.postalCode) business.postcode = String(addr.postalCode).trim().toUpperCase();
  } else if (typeof addr === 'string') business.street = addr.trim();
  if (biz.servesCuisine) business.cuisine = [biz.servesCuisine].flat().map(String).slice(0, 4);
  const logo = typeof biz.logo === 'string' ? biz.logo : biz.logo?.url;
  if (logo) business.logo = absolute(String(logo), base) ?? undefined;
  if (biz.acceptsReservations !== undefined) business.reservations = /true|yes/i.test(String(biz.acceptsReservations));
  const menu = typeof biz.hasMenu === 'string' ? biz.hasMenu : biz.hasMenu?.url ?? biz.menu;
  if (typeof menu === 'string') business.menu_url = absolute(menu, base) ?? undefined;
  if (typeof biz.priceRange === 'string') business.price_range = biz.priceRange;

  const spec = [biz.openingHoursSpecification].flat().filter(Boolean);
  const hours = (spec.length ? hoursFromSpec(spec) : null) ?? (biz.openingHours ? hoursFromText([biz.openingHours].flat().map(String)) : null) ?? hoursFromWords(text);

  const links: PageSignals['links'] = [];
  const pdfs: string[] = [];
  const logos: string[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const u = absolute(m[1], base);
    if (!u) continue;
    const label = htmlToText(m[2]).slice(0, 80);
    if (/\.pdf(\?|$)/i.test(u)) pdfs.push(u);
    links.push({ url: u, label });
  }
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = /\ssrc=["']([^"']+)["']/i.exec(tag)?.[1] ?? /data-src=["']([^"']+)["']/i.exec(tag)?.[1];
    if (src && /logo/i.test(tag)) {
      const u = absolute(src, base);
      if (u) logos.push(u);
    }
  }
  const stylesheets: string[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    if (!/rel=["']?stylesheet/i.test(m[0])) continue;
    const href = /href=["']([^"']+)["']/i.exec(m[0])?.[1];
    const u = href ? absolute(href, base) : null;
    // Their own CSS, not a font service or a plugin's.
    if (u && !/fonts\.googleapis|use\.typekit|fontawesome|wp-includes|plugins\/|jquery|bootstrap/i.test(u)) stylesheets.push(u);
  }
  const providers = [...new Set(PROVIDERS.filter(([re]) => re.test(html)).map(([, n]) => n))];
  const signals = [...new Set(SIGNALS.filter(([re]) => re.test(text)).map(([, n]) => n))];
  const phones = [...new Set([...text.matchAll(UK_PHONE)].map((m) => m[0].replace(/\s+/g, ' ').trim()).filter((p) => p.replace(/\D/g, '').length >= 10))].slice(0, 4);
  const postcodes = [...new Set([...text.toUpperCase().matchAll(POSTCODE)].map((m) => `${m[1]} ${m[2]}`))].slice(0, 4);

  return {
    reader: READER,
    title: htmlToText(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '') || null,
    site_name: meta(html, 'og:site_name') ?? meta(html, 'application-name'),
    description: meta(html, 'description') ?? meta(html, 'og:description'),
    og_image: (() => { const x = meta(html, 'og:image'); return x ? absolute(x, base) : null; })(),
    theme_color: (() => { const c = meta(html, 'theme-color'); return c && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : null; })(),
    business,
    hours,
    phones,
    postcodes,
    providers,
    signals,
    prices: priceCount(text),
    fonts: fontsOf(html),
    colours: coloursOf(html),
    links,
    pdfs: [...new Set(pdfs)],
    logo_candidates: [...new Set(logos)],
    stylesheets: [...new Set(stylesheets)].slice(0, 4),
  };
}

/** How much a link looks like a page worth reading, 0 for not at all. */
export function linkScore(url: string, label: string, origin: string): number {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return 0;
  }
  if (u.origin !== origin) return 0;
  if (/\.(jpe?g|png|gif|webp|svg|mp4|zip|ics)(\?|$)/i.test(u.pathname)) return 0;
  if (/wp-admin|wp-login|\/cart|\/basket|\/checkout|\/account|\/login|\/admin|\/feed|\/tag\/|\/category\/|\/author\/|\/page\/\d/i.test(u.pathname)) return 0;
  // Online shops (gift boxes, merchandise) are not the restaurant's menu.
  if (/\/(store|shop|products?|collections|merch)(\/|$)/i.test(u.pathname)) return 0;
  const s = `${u.pathname} ${label}`.toLowerCase();
  let n = 0;
  if (/menu|food|dishes|eat\b|kitchen/.test(s)) n += 5;
  if (/drink|wine|cocktail|bar\b/.test(s)) n += 2;
  if (/book|reserv|table/.test(s)) n += 3;
  if (/visit|find|contact|location|hours|opening|directions/.test(s)) n += 4;
  if (/about|story/.test(s)) n += 2;
  if (/faq|question|info|policies|policy|allergen|dietary/.test(s)) n += 4;
  if (/takeaway|order|deliver|collect/.test(s)) n += 3;
  if (/private|events|functions|group|party/.test(s)) n += 2;
  if (/gift|voucher/.test(s)) n += 1;
  if (/\.pdf(\?|$)/i.test(u.pathname) && /menu/i.test(s)) n += 4;
  return n;
}

/** Nearest free font for a family we cannot (and will not) copy: the category decides the system stack. */
export function fontCategory(name: string): 'serif' | 'sans' | 'slab' | 'script' | 'mono' | 'display' {
  const n = name.toLowerCase();
  if (/mono|code|courier/.test(n)) return 'mono';
  if (/script|hand|brush|marker|pacifico|dancing|caveat|satisfy|sacramento|great vibes|allura|parisienne/.test(n)) return 'script';
  if (/slab|rockwell|arvo|roboto slab|zilla|bitter|crete/.test(n)) return 'slab';
  if (/bebas|oswald|anton|league gothic|abril|alfa|ultra|fjalla|archivo black|bungee/.test(n)) return 'display';
  if (/serif(?!.*sans)|garamond|playfair|lora|merriweather|baskerville|caslon|didot|bodoni|georgia|times|cormorant|libre caslon|crimson|spectral|dm serif|prata|domine|noto serif|source serif|pt serif|cardo|gilda|marcellus|cinzel|trajan|freight|tiempos|canela|recoleta|ogg/.test(n)) return 'serif';
  return 'sans';
}
