// Build from your website: one scan of a prospect's site, run in the
// background while they carry on in the builder.
//
//   1. Fetch    robots.txt respected, an honest user agent, one request a
//               second, the home page plus up to twelve pages picked from the
//               links and sitemap, and a PDF menu. Every hop, redirects
//               included, must be a public address.
//   2. Render   the home page in headless Chromium for the colours, fonts and
//               logo it really shows (render.ts), when Chromium is installed.
//   3. Extract  structured data, phones, postcodes, hours, providers and
//               signals, with no model (extract.ts).
//   4. Model    two small calls: the menu, and the facts still missing.
//   5. Keep     pages and the result cached for 14 days, so a second scan of
//               the same site costs nothing.
//
// The result fills the builder only after the prospect says "Yes, use these"
// (map.ts). DEMO-SERVICE-PLAN.md §4.7.

import { createHash } from 'node:crypto';
import type { Config } from '../config.ts';
import type { DemoRepo } from '../db/demo-repo.ts';
import { assertPublicUrl } from '../ingest/ingest.ts';
import type { MenuCategory } from '../domain/types.ts';
import { sanitiseRestaurant } from '../presets/restaurant/validate.ts';
import { READER, closingAt, coloursOf, fontsOf, labelServices, linkScore, menuPdf, pageText, pencePrice, readPage, type DayHoursFound, type PageSignals } from './extract.ts';
import { askFacts, askMenu, type FactsOut, type MenuOut } from './model.ts';
import { imageAsDataUrl, renderPage, themeFrom, type Rendered, type Theme } from './render.ts';

export const CACHE_DAYS = 14;
const MAX_PAGES = 12;
const MAX_HTML = 1_500_000;
const MAX_PDF = 5_000_000;
const MAX_TOTAL = 5_000_000 + MAX_PDF;
const PACE_MS = 1000;
const UA = 'nabl-demo-scout/1.0 (+https://nabl.agency; reads a few public pages once, for a demo the owner asked for)';

export interface ScanResult {
  /** The reader that made it (extract.ts READER): older scans are not reused. */
  reader?: number;
  site: string;
  url: string;
  pages: string[];
  identity: { name: string | null; address: string | null; town: string | null; phone: string | null; description: string | null; logo: string | null; style: string | null };
  hours: DayHoursFound[] | null;
  menu: { categories: MenuCategory[]; allergen_statement: string | null; source_url: string; dishes: number; priced: number } | null;
  theme: Theme | null;
  services: { reservations: boolean | null; providers: string[]; takeaway: boolean | null; own_delivery: boolean | null; delivery_apps: string[] };
  policies: Partial<Record<'children' | 'accessibility' | 'parking' | 'dress_code' | 'corkage' | 'cakes' | 'vouchers' | 'dietary', string>> & { dogs?: 'inside' | 'outside_only' | 'no' };
  faqs: { q: string; a: string }[];
  signals: string[];
  not_hospitality: boolean;
  notes: string[];
  requests: number;
}

export class ScoutError extends Error {}

/** Where each running scan has got to, for the builder's progress line. */
const progress = new Map<string, { stage: string; pages: number }>();
export const scanProgress = (id: string) => progress.get(id) ?? null;

export interface ScanDeps {
  demo: DemoRepo;
  config: Config;
  /** Tests read a local site. */
  allowPrivate?: boolean;
  /** Tests replace the model. */
  model?: { facts: (digest: string) => Promise<FactsOut>; menu: (src: { text?: string; pdf?: Buffer; url: string }) => Promise<MenuOut> };
  /** Tests skip the one-a-second pacing. */
  paceMs?: number;
}

export const siteOf = (u: URL) => u.host.replace(/^www\./, '').toLowerCase();

/** Starts a scan (or reuses a recent one) and returns its id at once. */
export async function startScan(deps: ScanDeps, raw: string, keyId: string | null): Promise<string> {
  let start: URL;
  const input = raw.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(input) && !/^https?:\/\//i.test(input)) throw new ScoutError('Only ordinary http(s) websites.');
  try {
    start = await assertPublicUrl(input, deps.allowPrivate);
  } catch (err) {
    const m = (err as Error).message;
    throw new ScoutError(/ENOTFOUND|EAI_AGAIN|getaddrinfo/.test(m) ? 'We could not find that website. Check the address.' : m);
  }
  const site = siteOf(start);
  const reuse = await deps.demo.recentScan(site, CACHE_DAYS);
  if (reuse && ((await deps.demo.getScan(reuse))?.result as ScanResult | null)?.reader === READER) return reuse;
  const id = await deps.demo.createScan(site, keyId);
  progress.set(id, { stage: 'Reading your home page', pages: 0 });
  const counter = { requests: 0 };
  void runScan(deps, id, start, counter)
    .then((result) => deps.demo.finishScan(id, { status: 'done', result, requests: result.requests, tokens: 0 }))
    .catch((err) => deps.demo.finishScan(id, { status: 'failed', requests: counter.requests, tokens: 0, error: friendly(err) }))
    .catch(() => {})
    .finally(() => progress.delete(id));
  return id;
}

function friendly(err: unknown): string {
  const m = (err as Error)?.message ?? '';
  if (err instanceof ScoutError) return m;
  if (/abort|timeout/i.test(m)) return 'The site took too long to answer.';
  return 'Something went wrong while reading the site.';
}

// ── Fetching ─────────────────────────────────────────────────────────────

interface Fetched {
  url: string;
  status: number;
  type: string;
  body: Buffer;
}

/** A GET that checks every redirect hop is a public address, with a size cap. */
async function fetchChecked(raw: string, accept: string, cap: number, allowPrivate?: boolean): Promise<Fetched | null> {
  let url = raw;
  for (let hop = 0; hop < 5; hop++) {
    const u = await assertPublicUrl(url, allowPrivate).catch(() => null);
    if (!u) return null;
    let res: Response;
    try {
      res = await fetch(u, { headers: { 'user-agent': UA, accept, 'accept-language': 'en-GB,en;q=0.8' }, redirect: 'manual', signal: AbortSignal.timeout(12000) });
    } catch {
      return null;
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location')!, u).href;
      continue;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    if (res.body) {
      for await (const c of res.body as unknown as AsyncIterable<Uint8Array>) {
        size += c.length;
        if (size > cap) break;
        chunks.push(Buffer.from(c));
      }
    }
    return { url: u.href, status: res.status, type: res.headers.get('content-type') ?? '', body: Buffer.concat(chunks) };
  }
  return null;
}

async function robots(origin: URL, allowPrivate?: boolean): Promise<{ disallow: string[]; sitemaps: string[] }> {
  const r = await fetchChecked(new URL('/robots.txt', origin).href, 'text/plain', 200_000, allowPrivate);
  const out = { disallow: [] as string[], sitemaps: [] as string[] };
  if (!r || r.status >= 400) return out;
  let applies = false;
  for (const line of r.body.toString('utf8').split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    const v = line.slice(i + 1).replace(/#.*/, '').trim();
    if (k === 'user-agent') applies = v === '*' || /nabl/i.test(v);
    else if (k === 'disallow' && applies && v) out.disallow.push(v);
    else if (k === 'sitemap' && v) out.sitemaps.push(v);
  }
  return out;
}

const BLOCKED = /just a moment|checking your browser|verify you are human|captcha|access denied|attention required|enable javascript and cookies/i;

// ── The scan ─────────────────────────────────────────────────────────────

async function runScan(deps: ScanDeps, id: string, start: URL, counter: { requests: number }): Promise<ScanResult> {
  const { demo, allowPrivate } = deps;
  const pace = deps.paceMs ?? PACE_MS;
  const stage = (s: string) => progress.set(id, { stage: s, pages: pages.length });
  const pages: { url: string; signals: PageSignals; text: string }[] = [];
  let total = 0;
  let last = 0;
  const politely = async () => {
    const wait = last + pace - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
  };
  const notes: string[] = [];

  const getHtml = async (url: string): Promise<{ url: string; signals: PageSignals; text: string } | null> => {
    const cached = await demo.cachedPage(url, 'html', CACHE_DAYS);
    if (cached?.text && cached.status < 400 && (cached.signals as PageSignals)?.reader === READER) return { url, signals: cached.signals as PageSignals, text: cached.text };
    await politely();
    const r = await fetchChecked(url, 'text/html,application/xhtml+xml', MAX_HTML, allowPrivate);
    if (!r) return null;
    total += r.body.length;
    if (r.status >= 400 || !/html/i.test(r.type)) return r.status >= 400 ? { url: r.url, signals: readPage('', r.url), text: `HTTP ${r.status}` } : null;
    const html = r.body.toString('utf8');
    const signals = readPage(html, r.url);
    const text = pageText(html).slice(0, 60000);
    await demo.cachePage({ site: siteOf(start), url: r.url, kind: 'html', status: r.status, text, signals, hash: createHash('sha1').update(text).digest('hex') }).catch(() => {});
    return { url: r.url, signals, text };
  };

  // 1. The home page, and robots.txt.
  const rules = await robots(start, allowPrivate);
  counter.requests++;
  const allowed = (u: string) => {
    try {
      const p = new URL(u).pathname;
      return !rules.disallow.some((d) => d !== '/' ? p.startsWith(d) : true);
    } catch {
      return false;
    }
  };
  if (!allowed(start.href)) throw new ScoutError('The site asks robots not to read it, so we have not.');
  const home = await getHtml(start.href);
  counter.requests++;
  if (!home) throw new ScoutError('The site did not answer.');
  if (/^HTTP (403|401|429|503)/.test(home.text)) throw new ScoutError('The site turned us away: it has bot protection, which we respect.');
  if (/^HTTP \d+/.test(home.text)) throw new ScoutError(`The site answered with an error (${home.text.slice(5)}).`);
  pages.push(home);
  const origin = new URL(home.url).origin;

  // 2. The pages worth reading: from the home page's links and the sitemap.
  stage('Finding your menu and opening hours');
  const candidates = new Map<string, number>();
  for (const l of home.signals.links) {
    const s = linkScore(l.url, l.label, origin);
    if (s > 0) candidates.set(l.url.replace(/#.*$/, '').replace(/\/$/, ''), Math.max(s, candidates.get(l.url) ?? 0));
  }
  for (const sm of (rules.sitemaps.length ? rules.sitemaps.slice(0, 2) : ['/sitemap.xml']).map((x) => new URL(x, origin).href)) {
    await politely();
    const r = await fetchChecked(sm, 'application/xml,text/xml', 2_000_000, allowPrivate);
    counter.requests++;
    if (!r || r.status >= 400) continue;
    for (const m of r.body.toString('utf8').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
      const u = m[1].replace(/&amp;/g, '&');
      const s = linkScore(u, '', origin) - 1; // a link someone chose to show beats a sitemap entry
      if (s > 0 && !candidates.has(u.replace(/\/$/, ''))) candidates.set(u.replace(/\/$/, ''), s);
      if (candidates.size > 300) break;
    }
  }
  const picks = [...candidates.entries()].filter(([u]) => u !== home.url.replace(/\/$/, '') && !/\.pdf(\?|$)/i.test(u) && allowed(u))
    .sort((a, b) => b[1] - a[1]).slice(0, MAX_PAGES).map(([u]) => u);
  for (const u of picks) {
    if (total > MAX_TOTAL) break;
    const p = await getHtml(u);
    counter.requests++;
    if (p && !/^HTTP \d+/.test(p.text)) {
      pages.push(p);
      stage(`Reading ${new URL(p.url).pathname}`);
    }
  }

  // 3. The look: rendered, when Chromium is here.
  stage('Looking at your colours and fonts');
  let rendered: Rendered | null = await renderPage(home.url, { allowPrivate }).catch(() => null);
  if (BLOCKED.test(home.text.slice(0, 2000)) && (!rendered || BLOCKED.test(rendered.text.slice(0, 2000)))) {
    throw new ScoutError('The site turned us away: it has bot protection, which we respect.');
  }
  if (rendered && home.text.length < 400 && rendered.text.length > home.text.length) home.text = rendered.text;
  // No render (no Chromium, or it could not load the page): the site's own stylesheets give fonts and colours instead.
  let cssFonts: string[] = [];
  let cssColours: Record<string, number> = {};
  if (!rendered) {
    for (const sheet of (home.signals.stylesheets ?? []).slice(0, 2)) {
      await politely();
      const r = await fetchChecked(sheet, 'text/css', 600_000, allowPrivate);
      counter.requests++;
      if (!r || r.status >= 400) continue;
      const css = r.body.toString('utf8');
      cssFonts = [...new Set([...cssFonts, ...fontsOf('', css)])];
      for (const [c, n] of Object.entries(coloursOf('', css))) cssColours[c] = (cssColours[c] ?? 0) + n;
    }
  }

  // 4a. The menu: the page with the most prices, else a PDF, else the most menu-like page.
  stage('Reading your menu');
  // A page called menu with prices beats a page with more prices that is something else (a shop, a gift list).
  const menuScore = (p: (typeof pages)[number]) => {
    const path = new URL(p.url).pathname;
    return p.signals.prices + (/menu/i.test(path) ? 25 : /food|eat|dish/i.test(path) ? 10 : 0) - (/deliver|collection|takeaway|christmas|party|group|event/i.test(path) ? 8 : 0);
  };
  const byPrices = pages.filter((p) => p.signals.prices >= 5).sort((a, b) => menuScore(b) - menuScore(a));
  const menuish = pages.filter((p) => /menu|food|eat|dish/i.test(new URL(p.url).pathname)).sort((a, b) => menuScore(b) - menuScore(a));
  let menuSource: { text?: string; pdf?: Buffer; url: string } | null = null;
  // An everyday menu's PDF from any page read, never a seasonal or set one (a festive menu was taken for Pici's).
  const pdfMenu = menuPdf([...new Set(pages.flatMap((p) => p.signals.pdfs))].filter(allowed));
  if (byPrices[0] && byPrices[0].signals.prices >= 5) menuSource = { text: byPrices[0].text, url: byPrices[0].url };
  else if (pdfMenu) {
    await politely();
    const r = await fetchChecked(pdfMenu, 'application/pdf', MAX_PDF, allowPrivate);
    counter.requests++;
    if (r && r.status < 400 && /pdf/i.test(r.type) && r.body.length < MAX_PDF) menuSource = { pdf: r.body, url: r.url };
  }
  if (!menuSource && menuish[0]) {
    let text = menuish[0].text;
    if (text.length < 400) {
      const r = await renderPage(menuish[0].url, { allowPrivate }).catch(() => null);
      if (r && r.text.length > text.length) text = r.text;
    }
    if (text.length > 200) menuSource = { text, url: menuish[0].url };
  }
  const model = deps.model ?? { facts: (d: string) => askFacts(d, deps.config), menu: (s: { text?: string; pdf?: Buffer; url: string }) => askMenu(s, deps.config) };
  let menu: ScanResult['menu'] = null;
  if (menuSource) {
    try {
      const out = await model.menu(menuSource);
      counter.requests++;
      const clean = sanitiseRestaurant({
        menu: {
          categories: out.categories.map((c) => ({
            label: c.label,
            items: c.items.map((i) => ({
              name: i.name, description: i.description || undefined, price_pence: i.price ? pencePrice(i.price) : Math.max(0, i.price_pence || 0),
              allergens: i.allergens_stated ? i.allergens : [], allergens_unknown: !i.allergens_stated, dietary: i.dietary,
            })),
          })),
          modifier_groups: {},
          allergen_statement: out.allergen_statement || undefined,
          source: 'website',
          allergens_are_examples: false,
        },
      }).menu;
      const items = clean.categories.flatMap((c) => c.items);
      if (items.length) menu = { categories: clean.categories, allergen_statement: out.allergen_statement || null, source_url: menuSource.url, dishes: items.length, priced: items.filter((i) => i.price_pence > 0).length };
    } catch (err) {
      counter.requests++;
      // The prospect sees only the note; the reason goes to the server log.
      console.warn(`scout ${menuSource.url}: menu: ${(err as Error).message.slice(0, 300)}`);
      notes.push(/429|quota/i.test((err as Error).message) ? 'The menu could not be read this time (the free model limit was reached).' : 'The menu could not be read.');
    }
  } else notes.push('No menu found on the site.');

  // 4b. The facts, from a digest of every page.
  stage('Putting it together');
  let facts: FactsOut | null = null;
  try {
    facts = await model.facts(digest(pages));
    counter.requests++;
  } catch (err) {
    counter.requests++;
    console.warn(`scout ${home.url}: details: ${(err as Error).message.slice(0, 300)}`);
    notes.push(/429|quota/i.test((err as Error).message) ? 'Some details could not be read this time (the free model limit was reached).' : 'Some details could not be read.');
  }

  // 5. Put it together: structured data first, then patterns, then the model.
  const biz = Object.assign({}, ...pages.map((p) => p.signals.business).reverse(), home.signals.business) as PageSignals['business'];
  const allSignals = [...new Set(pages.flatMap((p) => p.signals.signals))];
  const providers = [...new Set(pages.flatMap((p) => p.signals.providers))];
  const phone = biz.telephone ?? home.signals.phones[0] ?? pages.flatMap((p) => p.signals.phones)[0] ?? (facts?.phone || null);
  const postcode = biz.postcode ?? pages.flatMap((p) => p.signals.postcodes)[0] ?? null;
  const street = biz.street ?? null;
  const address = street ? [street, postcode].filter(Boolean).join(', ') : facts?.address || (postcode ?? null);
  // Hours: the business's structured data, then the visit or contact page, then the home page; a shop's or a blog's never.
  const visitFirst = [...pages].filter((p) => !/\/(store|shop|blog|news|policies|careers|jobs)\b/i.test(new URL(p.url).pathname))
    .sort((a, b) => hoursRank(b.url) - hoursRank(a.url));
  const hours = (home.signals.business.name ? home.signals.hours : null) ?? visitFirst.map((p) => p.signals.hours).find((h) => h?.some((d) => d.open)) ?? hoursFromFacts(facts);
  const theme = themeFrom(rendered, {
    theme_color: home.signals.theme_color,
    colours: pages.slice(0, 3).reduce<Record<string, number>>((acc, p) => {
      for (const [c, n] of Object.entries(p.signals.colours)) acc[c] = (acc[c] ?? 0) + n;
      return acc;
    }, { ...cssColours }),
    fonts: [...new Set([...home.signals.fonts, ...cssFonts])],
  });
  let logo = rendered?.logo ?? null;
  for (const src of [biz.logo, ...home.signals.logo_candidates].filter((x): x is string => Boolean(x))) {
    if (logo) break;
    logo = await imageAsDataUrl(src, allowPrivate);
  }
  const name = biz.name ?? (facts?.name || null) ?? home.signals.site_name ?? home.signals.title?.split(/\s[|\-–—]\s/)[0] ?? null;
  const policies: ScanResult['policies'] = {};
  if (facts) {
    for (const k of ['children', 'accessibility', 'parking', 'dress_code', 'corkage', 'cakes', 'vouchers', 'dietary'] as const) {
      const v = facts.policies?.[k]?.trim();
      if (v) policies[k] = v.slice(0, 300);
    }
    if (facts.policies?.dogs && facts.policies.dogs !== 'unknown') policies.dogs = facts.policies.dogs;
  }
  const bookingProviders = providers.filter((p) => !['Deliveroo', 'Uber Eats', 'Just Eat', 'Slerp', 'Flipdish'].includes(p));
  return {
    reader: READER,
    site: siteOf(start),
    url: home.url,
    pages: pages.map((p) => p.url),
    identity: {
      name: name ? name.slice(0, 60) : null,
      address: address ? address.slice(0, 160) : null,
      town: biz.town ?? (facts?.town || null),
      phone: phone ? phone.slice(0, 20) : null,
      description: (facts?.summary || home.signals.description || null)?.slice(0, 240) ?? null,
      logo,
      style: facts?.style || (biz.cuisine?.join(', ') ?? null),
    },
    hours,
    menu,
    theme,
    services: {
      reservations: biz.reservations ?? facts?.takes_reservations ?? (bookingProviders.length > 0 || allSignals.includes('reservations') ? true : null),
      providers,
      takeaway: facts?.takeaway ?? (allSignals.includes('takeaway') ? true : null),
      own_delivery: facts?.own_delivery ?? null,
      delivery_apps: providers.filter((p) => ['Deliveroo', 'Uber Eats', 'Just Eat'].includes(p)),
    },
    policies,
    faqs: (facts?.faqs ?? []).filter((f) => f.q && f.a).slice(0, 10),
    signals: allSignals,
    not_hospitality: facts?.is_hospitality === false,
    notes,
    requests: counter.requests,
  };
}

/** What the facts model sees: never the whole site, at most about 4,000 tokens. */
export function digest(pages: { url: string; signals: PageSignals; text: string }[]): string {
  const KEY = /open|hour|clos|park|dog|child|kid|high ?chair|access|wheelchair|step|gluten|vegan|vegetarian|allerg|deposit|book|reserv|terrace|garden|outside|private|voucher|gift|cake|corkage|byo|dress|group|party|deliver|collect|takeaway|address|find us|phone|call/i;
  const out: string[] = [];
  const home = pages[0];
  const b = home.signals.business;
  out.push(`Site: ${home.url}`);
  if (home.signals.title) out.push(`Title: ${home.signals.title}`);
  if (home.signals.description) out.push(`Description: ${home.signals.description}`);
  if (Object.keys(b).length) out.push(`Structured data: ${JSON.stringify(b)}`);
  const phones = [...new Set(pages.flatMap((p) => p.signals.phones))];
  const pcs = [...new Set(pages.flatMap((p) => p.signals.postcodes))];
  if (phones.length) out.push(`Phone numbers seen: ${phones.join(', ')}`);
  if (pcs.length) out.push(`Postcodes seen: ${pcs.join(', ')}`);
  const prov = [...new Set(pages.flatMap((p) => p.signals.providers))];
  if (prov.length) out.push(`Uses: ${prov.join(', ')}`);
  out.push(`\n=== ${home.url} ===\n${home.text.slice(0, 3500)}`);
  for (const p of pages.slice(1)) {
    const sentences = p.text.split(/(?<=[.!?])\s+|\n+/).filter((s) => KEY.test(s) && s.length < 400);
    const body = sentences.join(' ').slice(0, 1400);
    if (body) out.push(`\n=== ${p.url} ===\n${body}`);
  }
  return out.join('\n').slice(0, 16000);
}

function hoursRank(url: string): number {
  const p = new URL(url).pathname.toLowerCase();
  if (/visit|find|contact|location|hours|opening|directions/.test(p)) return 3;
  if (p === '/' || p === '') return 2;
  return 1;
}

function hoursFromFacts(f: FactsOut | null): DayHoursFound[] | null {
  if (!f?.hours?.length) return null;
  const days: DayHoursFound[] = Array.from({ length: 7 }, () => ({ open: false, services: [] }));
  const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (const h of f.hours) {
    const d = names.indexOf(h.day);
    if (d < 0 || !/^\d{2}:\d{2}$/.test(h.open) || !/^\d{2}:\d{2}$/.test(h.close)) continue;
    const close = closingAt(h.close);
    if (close <= h.open) continue;
    days[d].open = true;
    days[d].services.push({ label: h.label || '', open: h.open, close });
  }
  if (!days.some((d) => d.open)) return null;
  const labelled = labelServices(days);
  // Keep the site's own labels where it gave them.
  for (const h of f.hours) {
    const d = labelled[names.indexOf(h.day)];
    const s = d?.services.find((x) => x.open === h.open && x.close === closingAt(h.close));
    if (s && h.label) s.label = h.label.slice(0, 30);
  }
  return labelled;
}

export { type Rendered };
