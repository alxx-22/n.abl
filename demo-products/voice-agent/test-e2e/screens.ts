// Every screen at every size Alex cares about: a demo for each built preset,
// then every builder step and every workspace tab (and, on a tablet or phone,
// the Call and Phone panels too) at nine window sizes, from a big Windows
// desktop down to a small phone. Each screenshot is measured, and the
// problems are printed as a table:
//
//   overflow   the page scrolls sideways, or something pokes out past the
//              window's edge (a bug at any size)
//   page-scroll  the workspace scrolls as a page on a desktop or laptop, where
//              it should fit the window with each column scrolling itself
//   sideways   a box that scrolls sideways but isn't one of the strips meant
//              to (the tabs, the steps, a board's columns, a timeline, a plan)
//   small-text text under 12px
//   small-target  on a tablet or phone, a button, tab or box under 40px
//
//   npm run screens                                   everything (builds the app first)
//   npm run screens -- --only barber,takeaway         these presets
//   npm run screens -- --sizes 390x844,820x1180       these sizes
//
// Writes the screenshots to eval-results/screens/<size>/<preset>/ and every
// measurement to eval-results/screens/report.json.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { loadConfig } from '../src/config.ts';
import { startServer } from '../src/server/main.ts';
import { chromiumPath } from '../src/scout/render.ts';
import { PRESETS } from '../src/presets/catalogue.ts';
import { builtPreset } from '../src/presets/index.ts';

const OUT = 'eval-results/screens';

const SIZES = ['1920x1080', '1536x864', '1366x768', '1280x800', '1024x768', '820x1180', '768x1024', '390x844', '360x800'];
/** The bands in reception.css, by window width. */
const band = (w: number) => (w >= 1280 ? 'desktop' : w >= 1024 ? 'laptop' : w >= 641 ? 'tablet' : 'phone');

const args = process.argv.slice(2);
const flag = (name: string) => args.flatMap((a, i) => (args[i - 1] === `--${name}` ? a.split(',') : a.startsWith(`--${name}=`) ? a.slice(name.length + 3).split(',') : [])).map((k) => k.trim()).filter(Boolean);
const built = PRESETS.filter((p) => builtPreset(p.key)).map((p) => p.key);
const presets = flag('only').length ? flag('only') : built;
const sizes = flag('sizes').length ? flag('sizes') : SIZES;
for (const p of presets) if (!built.includes(p)) throw new Error(`${p} is not a built preset. Built: ${built.join(', ')}.`);
for (const s of sizes) if (!/^\d+x\d+$/.test(s)) throw new Error(`${s} is not a size like 390x844.`);

interface Measure {
  scrollWidth: number;
  innerWidth: number;
  scrollHeight: number;
  innerHeight: number;
  /** Elements reaching past the window's edge that no sideways-scrolling box holds. */
  escapes: string[];
  /** Boxes that scroll sideways, other than the strips meant to. */
  sideways: string[];
  smallText: string[];
  smallTargets: string[];
}
interface Row { size: string; preset: string; screen: string; file: string; m: Measure; problems: { kind: string; detail: string }[] }

/** Strips meant to scroll sideways on a small screen: a row of tabs or steps, a board's columns, a timeline, a plan, a long table. */
const STRIPS = '.tabs, nav.steps ol, .day-tabs, .days, .area-tabs, .kitchen, .jobs-board, .drivers, .tl-grid, .plan-scroll, .table-scroll, [data-strip]';

/** Runs in the page: what the screen looks like to someone using it. */
function measure([touch, strips]: [boolean, string]): Measure {
  const vw = window.innerWidth;
  const name = (el: Element) => {
    const bits: string[] = [];
    let e: Element | null = el;
    for (let n = 0; e && n < 3 && e !== document.body; n++, e = e.parentElement) {
      const cls = [...e.classList].slice(0, 2).join('.');
      bits.unshift(e.tagName.toLowerCase() + (e.id ? `#${e.id}` : '') + (cls ? `.${cls}` : ''));
    }
    return bits.join(' > ');
  };
  const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30);
  const shown = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0') return null;
    return r;
  };
  /** The nearest box that clips or scrolls sideways, below the page itself. */
  const clipper = (el: Element) => {
    for (let e = el.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      const ox = getComputedStyle(e).overflowX;
      if (ox !== 'visible' && !e.matches('.workspace-page, .builder-page')) return e;
    }
    return null;
  };
  const all = [...document.body.querySelectorAll('*')];
  const escapes: string[] = [];
  for (const el of all) {
    const r = shown(el);
    if (!r || getComputedStyle(el).position === 'fixed') continue;
    if (r.right <= vw + 1 && r.left >= -1) continue;
    const c = clipper(el);
    if (c) {
      // Inside a box that scrolls or clips: fine, unless that box itself pokes out.
      const cr = c.getBoundingClientRect();
      if (cr.right <= vw + 1 && cr.left >= -1) continue;
    }
    // Only the outermost: its children poke out because it does.
    const parent = el.parentElement;
    const pr = parent ? parent.getBoundingClientRect() : null;
    if (pr && (pr.right > vw + 1 || pr.left < -1) && parent !== document.body) continue;
    escapes.push(`${name(el)} (${Math.round(r.left)} to ${Math.round(r.right)})`);
  }
  const sideways: string[] = [];
  for (const el of all) {
    if (!/auto|scroll/.test(getComputedStyle(el).overflowX) || el.scrollWidth <= el.clientWidth + 1 || !shown(el) || el.matches(strips)) continue;
    sideways.push(`${name(el)} (${el.scrollWidth}px in ${el.clientWidth}px)`);
  }
  const smallText: string[] = [];
  for (const el of all) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
    if (!own || !shown(el)) continue;
    let size = parseFloat(getComputedStyle(el).fontSize);
    // A drawing's text is drawn at the drawing's scale.
    if (el instanceof SVGGraphicsElement) size *= el.getScreenCTM()?.a ?? 1;
    if (size < 11.95) smallText.push(`${size.toFixed(1)}px ${name(el)} "${text(el)}"`);
  }
  const smallTargets: string[] = [];
  if (touch) {
    const targets = document.body.querySelectorAll('button, a.button, [role=tab], [role=button]:not(svg *), select, input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=range]), textarea, summary');
    for (const el of targets) {
      const r = shown(el);
      if (!r || el.closest('svg')) continue;
      if (Math.min(r.width, r.height) < 39.5) smallTargets.push(`${Math.round(r.width)}x${Math.round(r.height)} ${name(el)} "${text(el)}"`);
    }
  }
  return {
    scrollWidth: document.documentElement.scrollWidth, innerWidth: vw,
    scrollHeight: document.documentElement.scrollHeight, innerHeight: window.innerHeight,
    escapes, sideways, smallText, smallTargets,
  };
}

const dir = join(tmpdir(), `va-screens-${Date.now()}`);
const app = await startServer(
  { ...loadConfig(), port: 0, pgliteDir: dir, databaseUrl: undefined, consolePassword: 'team', sessionSecret: 'screens' },
  { web: 'dist' },
);
const base = `http://localhost:${app.port}`;
const exe = chromiumPath();
if (!exe) throw new Error('No Chromium found: install it (sudo apt-get install chromium) or set CHROME_PATH.');
const browser = await chromium.launch({ executablePath: exe });
const rows: Row[] = [];
const errors: string[] = [];
let failed = false;

/** A made-up business for each preset, so the screens show a name as a prospect's would. */
const NAMES: Record<string, string> = {
  restaurant: 'Olive & Ember', takeaway: 'Golden Lantern', barber: 'Sharp & Co Barbers',
  estate_agent: 'Hartley & Webb', property_maintenance: 'Fixright Repairs',
};
const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const settle = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  // Entrances finish first; endless ones (a pulse, a spinner) are left running.
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => null))));
};

try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`${base}/`);
  await page.fill('#password', 'team');
  await page.click('.signin button[type=submit]');
  await page.fill('#k-name', 'Sam Price');
  await page.fill('#k-company', 'Screens Check');
  await page.click('button:has-text("Issue a private key")');
  await page.waitForSelector('.issued code');
  const raw = (await page.textContent('.issued code'))!.trim();
  await page.goto(`${base}/demo/reception#key=${raw}`);
  await page.waitForSelector('text=Welcome, Sam.');
  const api = <T = unknown>(path: string, method = 'GET', body?: unknown) => page.evaluate(async ([p, m, b]) => {
    const r = await fetch(`/demo/api${p}`, { method: m, headers: b ? { 'content-type': 'application/json' } : {}, body: b ? JSON.stringify(b) : undefined, credentials: 'same-origin' });
    const t = await r.text();
    if (!r.ok) throw new Error(`${m} ${p}: ${r.status} ${t.slice(0, 200)}`);
    return t ? JSON.parse(t) : null;
  }, [path, method, body] as [string, string, unknown]) as Promise<T>;

  for (const preset of presets) {
    // A private key holds one demo at a time: this preset's, deleted when done.
    const w = await api<{ id: string }>('/workspaces', 'POST', { preset, name: NAMES[preset] ?? 'Screens Check' });
    const shots = new Map<string, number>();
    /** `whole`: the whole page; false for a panel open over it, which a whole-page shot would stretch. */
    const shoot = async (size: string, screen: string, whole = true) => {
      const [width] = size.split('x').map(Number);
      const folder = join(OUT, size, preset);
      const n = (shots.get(size) ?? 0) + 1;
      shots.set(size, n);
      await settle(page);
      const file = join(folder, `${String(n).padStart(2, '0')}-${screen}.png`);
      const m = await page.evaluate(measure, [band(width) === 'tablet' || band(width) === 'phone', STRIPS] as [boolean, string]);
      await page.screenshot({ path: file, fullPage: whole });
      const problems: Row['problems'] = [];
      if (m.scrollWidth > m.innerWidth || m.escapes.length) {
        problems.push({ kind: 'overflow', detail: `${m.scrollWidth > m.innerWidth ? `page ${m.scrollWidth}px wide in ${m.innerWidth}px. ` : ''}${m.escapes.slice(0, 3).join('; ')}${m.escapes.length > 3 ? ` and ${m.escapes.length - 3} more` : ''}` });
      }
      if (m.sideways.length) problems.push({ kind: 'sideways', detail: m.sideways.slice(0, 3).join('; ') });
      if (screen.startsWith('ws-') && (band(width) === 'desktop' || band(width) === 'laptop') && m.scrollHeight > m.innerHeight + 1) {
        problems.push({ kind: 'page-scroll', detail: `${m.scrollHeight}px tall in ${m.innerHeight}px` });
      }
      if (m.smallText.length) problems.push({ kind: 'small-text', detail: `${m.smallText.length}: ${m.smallText.slice(0, 3).join('; ')}` });
      if (m.smallTargets.length) problems.push({ kind: 'small-target', detail: `${m.smallTargets.length}: ${m.smallTargets.slice(0, 3).join('; ')}` });
      rows.push({ size, preset, screen, file, m, problems });
    };

    for (const size of sizes) rmSync(join(OUT, size, preset), { recursive: true, force: true });
    for (const size of sizes) mkdirSync(join(OUT, size, preset), { recursive: true });

    // The builder, step by step, at each size.
    for (const size of sizes) {
      const [width, height] = size.split('x').map(Number);
      await page.setViewportSize({ width, height });
      await page.goto(`${base}/demo/reception/build/${w.id}`);
      await page.waitForSelector('#step-title');
      const count = await page.locator('nav.steps li button').count();
      for (let i = 0; i < count; i++) {
        const step = page.locator('nav.steps li button').nth(i);
        const label = (await step.locator('span').nth(1).textContent())!.trim();
        await step.click();
        await page.waitForSelector(`#step-title:has-text("${label}")`);
        await shoot(size, `builder-${slug(label)}`);
        // The preview, where it sits behind a button.
        const preview = page.locator('button.preview-open');
        if (i === 0 && (await preview.isVisible())) {
          await preview.click();
          await shoot(size, 'builder-preview', false);
          await page.keyboard.press('Escape');
        }
      }
    }

    await api(`/workspaces/${w.id}/start`, 'POST', {});
    for (const size of sizes) {
      const [width, height] = size.split('x').map(Number);
      await page.setViewportSize({ width, height });
      await page.goto(`${base}/demo/reception/live/${w.id}`);
      await page.waitForSelector('.tabs [role=tab]');
      await page.waitForTimeout(400);
      const tabs = await page.locator('.tabs [role=tab]').allTextContents();
      for (const tab of tabs) {
        await page.locator('.tabs [role=tab]', { hasText: tab }).first().click();
        // A tab's count ("Kitchen 11") changes from run to run; its name doesn't.
        const name = slug(tab.replace(/\d+/g, ''));
        await shoot(size, `ws-${name}`);
        // A booking open beside its view, where the view shows bookings on a timeline.
        const bar = page.locator('.office-main .tl-bar').first();
        if (await bar.count() && await bar.isVisible()) {
          await bar.click();
          if (await page.locator('.drawer').count()) {
            await shoot(size, `ws-${name}-open`);
            await page.locator('.drawer header button').first().click().catch(() => {});
          }
        }
      }
      // The call and the phone, where they have slid away to a bookmark: each opened over the back office.
      for (const pane of ['call', 'phone']) {
        const mark = page.locator(`.ws-bookmark[data-pane=${pane}]`);
        if (!(await mark.count()) || !(await mark.isVisible())) continue;
        await mark.click();
        await shoot(size, `ws-${pane}-open`, false);
        await page.keyboard.press('Escape');
      }
    }
    await api(`/workspaces/${w.id}`, 'DELETE').catch(() => null);
    console.log(`${preset}: ${[...shots.values()].reduce((a, b) => a + b, 0)} screenshots`);
  }
} catch (err) {
  failed = true;
  console.error(`screens: ${(err as Error).stack ?? err}`);
} finally {
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'report.json'), JSON.stringify(rows, null, 1));
const problems = rows.flatMap((r) => r.problems.map((p) => ({ ...p, size: r.size, preset: r.preset, screen: r.screen })));
const kinds = ['overflow', 'sideways', 'page-scroll', 'small-text', 'small-target'];
const pad = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));
if (problems.length) {
  console.log(`\n${pad('size', 10)} ${pad('preset', 21)} ${pad('screen', 30)} ${pad('problem', 13)} detail`);
  for (const p of problems) console.log(`${pad(p.size, 10)} ${pad(p.preset, 21)} ${pad(p.screen, 30)} ${pad(p.kind, 13)} ${p.detail.slice(0, 260)}`);
}
// The elements behind most of them, so a fix can start with the commonest.
const common = new Map<string, { kind: string; screens: Set<string> }>();
for (const r of rows) {
  const items = [
    ...r.m.escapes.map((e) => ['overflow', e.replace(/ \(.*$/, '')]),
    ...r.m.sideways.map((e) => ['sideways', e.replace(/ \(.*$/, '')]),
    ...r.m.smallText.map((e) => ['small-text', e.replace(/ ".*$/, '')]),
    ...r.m.smallTargets.map((e) => ['small-target', e.replace(/^\d+x\d+ /, '').replace(/ ".*$/, '')]),
  ];
  for (const [kind, what] of items) {
    const k = `${kind} ${what}`;
    const c = common.get(k) ?? { kind, screens: new Set() };
    c.screens.add(`${r.size} ${r.preset} ${r.screen}`);
    common.set(k, c);
  }
}
const top = [...common.entries()].sort((a, b) => b[1].screens.size - a[1].screens.size).slice(0, 40);
if (top.length) {
  console.log('\nCommonest:');
  for (const [k, c] of top) console.log(`  ${String(c.screens.size).padStart(4)} screens  ${k}`);
}
console.log(`\n${rows.length} screens checked; ${problems.length} problems.`);
for (const k of kinds) {
  const ps = problems.filter((p) => p.kind === k);
  console.log(`  ${pad(k, 13)} ${String(ps.length).padStart(4)} screens${ps.length ? `, at ${[...new Set(ps.map((p) => p.size))].join(', ')}` : ''}`);
}
if (errors.length) console.error(errors.join('\n'));
console.log(`Screenshots in ${OUT}/<size>/<preset>/, measurements in ${OUT}/report.json`);
process.exit(failed || errors.length ? 1 : 0);
