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
import { fontCategory } from './extract.ts';

export interface Rendered {
  text: string;
  body_bg: string | null;
  header_bg: string | null;
  button_bg: string | null;
  button_fg: string | null;
  /** Filled buttons' colours, most telling first. */
  buttons?: string[];
  link: string | null;
  /** Text links' colours, most used first. */
  links?: string[];
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
  // Playwright sends even this machine's own pages through a proxy whatever the bypass list says, so a page served
  // here (the tests' sites) goes direct.
  const loopback = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(new URL(url).hostname);
  const browser = await chromium.launch({
    executablePath: exe,
    args: process.getuid?.() === 0 ? ['--no-sandbox'] : [],
    // Chromium ignores HTTPS_PROXY; where the network needs one, say so.
    proxy: process.env.HTTPS_PROXY && !loopback ? { server: process.env.HTTPS_PROXY, bypass: process.env.NO_PROXY ?? process.env.no_proxy ?? 'localhost,127.0.0.1' } : undefined,
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
      const vw = innerWidth;
      const clear = (c: string) => !c || c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c);
      // A colour we can name: rgb(), or rgba() at least half opaque (a dimming overlay is not a colour of the page).
      const opaque = (c: string) => /^rgb\(/.test(c) || Number(/^rgba\(.*,\s*([\d.]+)\)$/.exec(c)?.[1] ?? 0) >= 0.5;
      const cs = (el: Element | null) => (el ? getComputedStyle(el) : null);
      const firstFont = (f: string | undefined) => (f ?? '').split(',')[0].replace(/["']/g, '').trim() || null;
      // Cookie banners wear the consent tool's colours, not the brand's (often a stock blue "Accept all").
      const anchor = document.querySelector('main, h1, header');
      const marked = [...document.querySelectorAll('[id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i], [id*="gdpr" i], [class*="gdpr" i], [id*="onetrust" i], [id*="cookiebot" i], [class*="cky-" i], [class*="ch2-" i], [class*="cmplz" i], [id*="usercentrics" i], [class*="cc-window" i], [class*="termly" i]')]
        .filter((el) => el !== document.body && el !== document.documentElement && !(anchor && el.contains(anchor)));
      // Banners with no telling name: a small box pinned to the screen that talks about cookies.
      let k = 0;
      for (const el of document.querySelectorAll('body *')) {
        if (++k > 2500) break;
        if (getComputedStyle(el).position !== 'fixed') continue;
        const words = el.textContent ?? '';
        if (words.length < 1500 && /cookie/i.test(words) && !(anchor && el.contains(anchor))) marked.push(el);
      }
      const banners = marked.filter((el) => !marked.some((o) => o !== el && o.contains(el)));
      // Only what a visitor sees counts: not the "skip to content" link parked off screen, a hidden cart or a closed menu.
      const shown = (el: Element) => {
        const b = el.getBoundingClientRect();
        if (b.width < 1 || b.height < 1 || b.right <= 0 || b.left >= vw) return false;
        const s = getComputedStyle(el);
        return s.visibility !== 'hidden' && Number(s.opacity) > 0.1 && !banners.some((x) => x.contains(el));
      };
      const ranked = (tally: Record<string, number>) => Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([c]) => c);
      const bodyBg = [document.body, document.documentElement].map((el) => getComputedStyle(el).backgroundColor).find((c) => !clear(c)) ?? 'rgb(255, 255, 255)';

      const painted: Record<string, number> = {};
      const wide: { el: Element; b: DOMRect; bg: string }[] = [];
      let n = 0;
      for (const el of document.querySelectorAll('body, body *')) {
        if (++n > 2500) break;
        const b = el.getBoundingClientRect();
        const area = Math.min(b.width * b.height, 1_200_000);
        if (area < 600) continue;
        const bg = getComputedStyle(el).backgroundColor;
        if (clear(bg) || !shown(el)) continue;
        painted[bg] = (painted[bg] ?? 0) + area;
        if (b.width >= vw * 0.6 && b.top < 600 && opaque(bg)) wide.push({ el, b, bg });
      }

      // The header: the band across the top of the page, and its logo.
      const header = [...document.querySelectorAll('header, [role="banner"], #header, .header, .site-header, nav')]
        .find((el) => { const b = el.getBoundingClientRect(); return b.top < 150 && b.bottom > 0 && b.width >= vw * 0.6 && shown(el); }) ?? null;
      const looksLikeLogo = (i: HTMLImageElement) => /logo/i.test(`${i.className} ${i.id} ${i.alt} ${i.src}`);
      const imgs = [...document.querySelectorAll('img')].filter((i) => i.naturalWidth > 20 && shown(i));
      const logoImg = imgs.find((i) => header?.contains(i) && looksLikeLogo(i)) ?? imgs.find((i) => looksLikeLogo(i) && i.getBoundingClientRect().top < 300)
        ?? imgs.find((i) => header?.contains(i)) ?? imgs.find(looksLikeLogo) ?? null;
      // What is painted at a point: the tightest full-width band there, so a layer painted behind a see-through header (Wix) counts.
      const bandAt = (x: number, y: number) => wide.filter((w) => w.b.top <= y && w.b.bottom >= y && w.b.left <= x && w.b.right >= x)
        .sort((p, q) => p.b.width * p.b.height - q.b.width * q.b.height)[0]?.bg ?? null;
      // The main colour is the ground the logo was drawn for, so the demo's header shows the logo as the site does;
      // with no logo up there, the header's own colour, or, when that is the page's, a band inside it such as the navigation.
      let headerBg: string | null = null;
      const lb = logoImg?.getBoundingClientRect();
      if (lb && lb.top < 200) headerBg = bandAt(lb.left + lb.width / 2, lb.top + lb.height / 2) ?? bodyBg;
      else if (header) {
        const hb = header.getBoundingClientRect();
        const own = getComputedStyle(header).backgroundColor;
        headerBg = opaque(own) ? own : bandAt(vw / 2, hb.top + Math.min(hb.height / 2, 40)) ?? bodyBg;
        if (headerBg === bodyBg) {
          const band = wide.filter((w) => w.el !== header && header.contains(w.el) && w.b.height >= 20 && w.bg !== bodyBg)
            .sort((p, q) => q.b.width * q.b.height - p.b.width * p.b.height)[0];
          if (band) headerBg = band.bg;
        }
      }

      // Buttons, ranked: the ones a visitor sees first, and the ones that book or ask for a quote, count most.
      const CTA = /book|reserv|order|table|menu|quote|call|valuation|enquir|contact|appointment|get in touch/i;
      const buttons: Record<string, number> = {};
      const links: Record<string, number> = {};
      const fg: Record<string, string> = {};
      for (const el of [...document.querySelectorAll('a, button, [role="button"], input[type="submit"]')].slice(0, 1000)) {
        if (!shown(el)) continue;
        const b = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        if (clear(s.backgroundColor)) {
          // The link's text may sit in a span of its own colour (Wix): read the colour the words are painted in.
          if (el.tagName === 'A') {
            const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            let t: Node | null;
            while ((t = walk.nextNode()) && !t.textContent?.trim());
            const c = t?.parentElement ? getComputedStyle(t.parentElement).color : null;
            if (c) links[c] = (links[c] ?? 0) + 1;
          }
          continue;
        }
        // A filled panel or a full-width bar is not a button.
        if (b.width < 30 || b.height < 16 || b.width > vw * 0.5 || b.height > 120) continue;
        buttons[s.backgroundColor] = (buttons[s.backgroundColor] ?? 0) + (b.top < innerHeight ? 2 : 1) * (CTA.test(el.textContent ?? '') ? 3 : 1);
        fg[s.backgroundColor] ??= s.color;
      }
      const buttonList = ranked(buttons);

      const heading = document.querySelector('h1, h2');
      return {
        text: (document.body?.innerText ?? '').slice(0, 40000),
        // A see-through body shows the page's own ground: the html element's colour, or the browser's white.
        body_bg: bodyBg,
        header_bg: headerBg,
        button_bg: buttonList[0] ?? null,
        button_fg: buttonList[0] ? fg[buttonList[0]] : null,
        buttons: buttonList.slice(0, 8),
        links: ranked(links).slice(0, 8),
        heading_font: firstFont(cs(heading)?.fontFamily),
        body_font: firstFont(getComputedStyle(document.body).fontFamily),
        logo_src: logoImg?.currentSrc || logoImg?.src || null,
        painted: ranked(painted).slice(0, 8),
      };
    });
    const logo = r.logo_src ? await imageAsDataUrl(r.logo_src, opts.allowPrivate) : null;
    return {
      text: r.text,
      body_bg: hex(r.body_bg),
      header_bg: hex(r.header_bg),
      button_bg: hex(r.button_bg),
      button_fg: hex(r.button_fg),
      buttons: r.buttons.map(hex).filter((c): c is string => Boolean(c)),
      link: hex(r.links[0]),
      links: r.links.map(hex).filter((c): c is string => Boolean(c)),
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
 * The accent lightened until dark text on it passes WCAG AA (4.5:1). The
 * scan keeps the website's own colours; the demo's pages make them readable
 * when they draw them (web/src/reception/brand.ts).
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

function distance(a: string, b: string): number {
  const [p, q] = [rgb(a), rgb(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/** The brand's colours and fonts, from a render if there was one, else from the page's own styles. */
export function themeFrom(r: Rendered | null, fallback: { theme_color: string | null; colours: Record<string, number>; fonts: string[] }): Theme | null {
  const ground = r?.body_bg ?? null;
  // An accent stands out: a real colour, not a grey or a faint tint, and not the page's own background.
  const standsOut = (c: string | null | undefined): c is string => {
    // The browser's own link blues are not a brand choice either.
    if (!c || !/^#[0-9a-f]{6}$/i.test(c) || c === '#0000ee' || c === '#551a8b') return false;
    const [x, y, z] = rgb(c);
    return Math.max(x, y, z) - Math.min(x, y, z) >= 28 && (!ground || distance(c, ground) >= 60);
  };
  const cssTop = Object.entries(fallback.colours).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  // The buttons first, then the colour the site names, its links, and only then its painted areas, which are mostly section backgrounds.
  const buttons = r?.buttons ?? (r?.button_bg ? [r.button_bg] : []);
  const links = r?.links ?? (r?.link ? [r.link] : []);
  const accentRaw = [...buttons, fallback.theme_color, ...links, ...(r?.painted ?? []), ...cssTop].find(standsOut) ?? null;
  const heading = r?.heading_font ?? fallback.fonts[0] ?? null;
  const body = r?.body_font ?? fallback.fonts[1] ?? fallback.fonts[0] ?? null;
  if (!accentRaw && !heading) return null;
  // The website's own colours, as they are: a white site gives a light demo, a dark one a dark demo.
  const accent = accentRaw ?? '#e9ac57';
  const background = r?.body_bg ?? '#0e0c0a';
  // The main colour is the header's, whatever it is (a white or a charcoal header is a choice too);
  // a page with no header band shows its own colour there.
  const primary = r ? r.header_bg ?? background : '#2a2217';
  // The browser's defaults are not a brand choice.
  const generic = /^(system-ui|-apple-system|sans-serif|serif|times new roman|times|arial|helvetica|liberation serif|liberation sans|dejavu sans|dejavu serif)$/i;
  const fontHeading = heading && !generic.test(heading) ? heading : 'system-ui';
  const fontBody = body && !generic.test(body) ? body : 'system-ui';
  return {
    accent, primary, background, font_heading: fontHeading, font_body: fontBody,
    heading_category: fontCategory(fontHeading), body_category: fontCategory(fontBody),
  };
}
