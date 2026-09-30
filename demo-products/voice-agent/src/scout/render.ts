// The scout's one look at a page as a visitor sees it: headless Chromium
// renders the home page, and we read the colours and fonts the page actually
// paints (the raw CSS of Wix and WordPress themes is mostly the builder's,
// not the brand's), the logo, and the text of pages built by script.
//
// Every request the page makes is checked first: http(s) only, public
// addresses only, no media. One render at a time. If no Chromium is
// installed, the scout carries on without it.

import { existsSync } from 'node:fs';
import { assertPublicUrl } from '../ingest/ingest.ts';
import { fontCategory, isGrey } from './extract.ts';

export interface Rendered {
  text: string;
  body_bg: string | null;
  header_bg: string | null;
  button_bg: string | null;
  button_fg: string | null;
  link: string | null;
  heading_font: string | null;
  body_font: string | null;
  logo: string | null;
  /** Background colours by painted area, largest first. */
  painted: string[];
}

const CANDIDATES = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];

export function chromiumPath(): string | null {
  return CANDIDATES.find((p): p is string => Boolean(p && existsSync(p))) ?? null;
}

let queue: Promise<unknown> = Promise.resolve();

export function renderPage(url: string, opts: { allowPrivate?: boolean; timeoutMs?: number } = {}): Promise<Rendered | null> {
  const run = queue.then(() => renderNow(url, opts)).catch(() => null);
  queue = run;
  return run;
}

async function renderNow(url: string, opts: { allowPrivate?: boolean; timeoutMs?: number }): Promise<Rendered | null> {
  const exe = chromiumPath();
  if (!exe) return null;
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({
    executablePath: exe,
    args: process.getuid?.() === 0 ? ['--no-sandbox'] : [],
    // Chromium ignores HTTPS_PROXY; where the network needs one, say so.
    proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: process.env.NO_PROXY ?? process.env.no_proxy ?? 'localhost,127.0.0.1' } : undefined,
  });
  const allowed = new Map<string, boolean>();
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      javaScriptEnabled: true,
      acceptDownloads: false,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 nabl-demo-scout/1.0 (+https://nabl.agency)',
    });
    await context.route('**/*', async (route) => {
      const req = route.request();
      const type = req.resourceType();
      if (type === 'media' || type === 'websocket' || type === 'eventsource' || type === 'manifest') return route.abort();
      let u: URL;
      try {
        u = new URL(req.url());
      } catch {
        return route.abort();
      }
      if (u.protocol === 'data:') return route.continue();
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return route.abort();
      let ok = allowed.get(u.host);
      if (ok === undefined) {
        ok = await assertPublicUrl(u.href, opts.allowPrivate).then(() => true, () => false);
        allowed.set(u.host, ok);
      }
      return ok ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.on('dialog', (d) => void d.dismiss());
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: opts.timeoutMs ?? 15000 });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    const r = await page.evaluate(() => {
      const clear = (c: string) => !c || c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c);
      const cs = (el: Element | null) => (el ? getComputedStyle(el) : null);
      const firstFont = (f: string | undefined) => (f ?? '').split(',')[0].replace(/["']/g, '').trim() || null;
      const visible = (el: Element) => {
        const b = el.getBoundingClientRect();
        return b.width > 30 && b.height > 16 && b.top < 2000;
      };
      const header = document.querySelector('header, [role="banner"], .header, #header, .site-header, nav');
      let headerBg = cs(header)?.backgroundColor ?? '';
      if (clear(headerBg) && header) {
        for (let p: Element | null = header.parentElement; p && clear(headerBg); p = p.parentElement) headerBg = getComputedStyle(p).backgroundColor;
      }
      const buttons = [...document.querySelectorAll('a, button, [role="button"]')].filter(visible);
      const filled = (el: Element) => !clear(getComputedStyle(el).backgroundColor);
      const button = buttons.find((el) => filled(el) && /book|reserv|order|table|menu/i.test(el.textContent ?? '')) ?? buttons.find(filled) ?? null;
      const link = document.querySelector('main a, article a, p a, footer a');
      const heading = document.querySelector('h1, h2');
      const logoImg = [...document.querySelectorAll('img')].find((i) => /logo/i.test(`${i.className} ${i.id} ${i.alt} ${i.src}`) && i.naturalWidth > 20)
        ?? (header?.querySelector('img') as HTMLImageElement | null) ?? null;
      const painted: Record<string, number> = {};
      let n = 0;
      for (const el of document.querySelectorAll('body, body *')) {
        if (++n > 2500) break;
        const b = el.getBoundingClientRect();
        const area = Math.min(b.width * b.height, 1_200_000);
        if (area < 600) continue;
        const bg = getComputedStyle(el).backgroundColor;
        if (clear(bg)) continue;
        painted[bg] = (painted[bg] ?? 0) + area;
      }
      return {
        text: (document.body?.innerText ?? '').slice(0, 40000),
        body_bg: getComputedStyle(document.body).backgroundColor,
        header_bg: headerBg,
        button_bg: button ? getComputedStyle(button).backgroundColor : null,
        button_fg: button ? getComputedStyle(button).color : null,
        link: link ? getComputedStyle(link).color : null,
        heading_font: firstFont(cs(heading)?.fontFamily),
        body_font: firstFont(getComputedStyle(document.body).fontFamily),
        logo_src: logoImg?.currentSrc || logoImg?.src || null,
        painted: Object.entries(painted).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c]) => c),
      };
    });
    const logo = r.logo_src ? await imageAsDataUrl(r.logo_src, opts.allowPrivate) : null;
    return {
      text: r.text,
      body_bg: hex(r.body_bg),
      header_bg: hex(r.header_bg),
      button_bg: hex(r.button_bg),
      button_fg: hex(r.button_fg),
      link: hex(r.link),
      heading_font: r.heading_font,
      body_font: r.body_font,
      logo,
      painted: r.painted.map(hex).filter((c): c is string => Boolean(c)),
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

/** rgb(12, 34, 56) or rgba(…, 1) to #0c2238; transparent to null. */
export function hex(c: string | null | undefined): string | null {
  if (!c) return null;
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c);
  if (!m || (m[4] !== undefined && Number(m[4]) < 0.5)) return null;
  return `#${[m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('')}`;
}

/** Fetches a logo (a small image from a public address) as a data: URL. */
export async function imageAsDataUrl(src: string, allowPrivate = false): Promise<string | null> {
  if (src.startsWith('data:image/')) return /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(src) && src.length < 400_000 ? src : null;
  try {
    const u = await assertPublicUrl(src, allowPrivate);
    const res = await fetch(u, { headers: { 'user-agent': 'nabl-demo-scout/1.0 (+https://nabl.agency)' }, signal: AbortSignal.timeout(8000) });
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!res.ok || !/^image\/(png|jpeg|webp|svg\+xml)$/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 280_000) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// ── Colours into a theme ─────────────────────────────────────────────────

function rgb(h: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function luminance(h: string): number {
  const [r, g, b] = rgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function mix(a: string, b: string, t: number): string {
  const [p, q] = [rgb(a), rgb(b)];
  return `#${p.map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

const INK = '#14110e';

/**
 * The workspace is dark, with dark text on accent-coloured buttons, so the
 * accent is lightened until that text passes WCAG AA (4.5:1).
 */
export function readableAccent(h: string): string {
  let c = h;
  for (let i = 0; i < 12 && contrast(c, INK) < 4.5; i++) c = mix(c, '#ffffff', 0.12);
  return c;
}

export interface Theme {
  accent: string;
  primary: string;
  background: string;
  font_heading: string;
  font_body: string;
  heading_category: ReturnType<typeof fontCategory>;
  body_category: ReturnType<typeof fontCategory>;
}

/** The brand's colours and fonts, from a render if there was one, else from the page's own styles. */
export function themeFrom(r: Rendered | null, fallback: { theme_color: string | null; colours: Record<string, number>; fonts: string[] }): Theme | null {
  const colourful = (c: string | null | undefined): c is string => Boolean(c && !isGrey(c));
  const cssTop = Object.entries(fallback.colours).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const accentRaw = [r?.button_bg, fallback.theme_color, ...(r?.painted ?? []), r?.link, ...cssTop].find(colourful) ?? null;
  const primaryRaw = [r?.header_bg, ...(r?.painted ?? [])].find((c) => colourful(c) && c !== accentRaw) ?? r?.header_bg ?? null;
  const heading = r?.heading_font ?? fallback.fonts[0] ?? null;
  const body = r?.body_font ?? fallback.fonts[1] ?? fallback.fonts[0] ?? null;
  if (!accentRaw && !heading) return null;
  const accent = readableAccent(accentRaw ?? '#e9ac57');
  const primary = primaryRaw && luminance(primaryRaw) < 0.2 ? primaryRaw : '#2a2217';
  const background = r?.body_bg && luminance(r.body_bg) < 0.05 ? r.body_bg : '#0e0c0a';
  // The browser's defaults are not a brand choice.
  const generic = /^(system-ui|-apple-system|sans-serif|serif|times new roman|times|arial|helvetica|liberation serif|liberation sans|dejavu sans|dejavu serif)$/i;
  const fontHeading = heading && !generic.test(heading) ? heading : 'system-ui';
  const fontBody = body && !generic.test(body) ? body : 'system-ui';
  return {
    accent, primary, background, font_heading: fontHeading, font_body: fontBody,
    heading_category: fontCategory(fontHeading), body_category: fontCategory(fontBody),
  };
}
