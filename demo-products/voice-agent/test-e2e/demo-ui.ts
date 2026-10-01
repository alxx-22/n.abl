// The prospect's journey through a real browser, without calling a model:
// a key from the team, the one-click link, a restaurant from the preset, the
// builder's steps, Start, then the back office (floor plan, moving a booking,
// the timeline, the kitchen's ready text, the phone); a second demo from a
// website, replacing the first; then a shared key used by two people, each
// with their own demo and its deletion time. Fails on any page error.
//
//   npm run e2e:demo            (builds the app first: npm run build)
//
// Writes screenshots to eval-results/demo-ui/.

import { mkdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { loadConfig } from '../src/config.ts';
import { startServer } from '../src/server/main.ts';
import { chromiumPath } from '../src/scout/render.ts';

const OUT = 'eval-results/demo-ui';
mkdirSync(OUT, { recursive: true });
// A fake restaurant website for "Build from my website", read with a stand-in model.
const SITE: Record<string, string> = {
  '/': `<html><head><title>Bella Vista</title><meta name="theme-color" content="#1f5c3a"><style>h1{font-family:'Playfair Display',serif}</style>
    <script type="application/ld+json">{"@type":"Restaurant","name":"Bella Vista","telephone":"0115 496 0999","address":{"streetAddress":"212 Mansfield Road","addressLocality":"Nottingham","postalCode":"NG5 2BU"}}</script></head>
    <body><h1>Bella Vista</h1><p>Sit on our terrace.</p><a href="/menu">Menu</a> <a href="/find-us">Find us</a></body></html>`,
  '/menu': '<html><body><p>Margherita £10.50. Diavola £12.50. Carbonara £12.00. Tiramisu £6.00. Garlic bread £4.50.</p></body></html>',
  '/find-us': '<html><body><p>Opening hours: Tuesday to Saturday 5pm to 10pm. Sunday 12pm to 8pm. Closed Mondays.</p></body></html>',
};
const site = createServer((req, res) => {
  const body = SITE[(req.url ?? '/').split('?')[0]];
  res.writeHead(body ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' });
  res.end(body ?? 'not found');
});
await new Promise<void>((r) => site.listen(0, r));
const siteUrl = `http://localhost:${(site.address() as { port: number }).port}/`;
const model = {
  facts: async () => ({
    is_hospitality: true, name: 'Bella Vista', style: 'Wood-fired pizza and fresh pasta', summary: 'A family Italian kitchen.', town: 'Nottingham', address: '', phone: '',
    hours: [], takes_reservations: true, takeaway: true, own_delivery: false,
    policies: { children: '', dogs: 'outside_only' as const, accessibility: '', parking: 'Free parking after 6pm.', dress_code: '', corkage: '', cakes: '', vouchers: '', dietary: '' },
    faqs: [{ q: 'Is there parking?', a: 'Free parking after 6pm.' }],
  }),
  menu: async () => ({
    categories: [{ label: 'Pizza', items: [
      { name: 'Margherita', description: '', price_pence: 1050, allergens_stated: false, allergens: [], dietary: [] },
      { name: 'Diavola', description: '', price_pence: 1250, allergens_stated: false, allergens: [], dietary: [] },
    ] }],
    allergen_statement: '',
  }),
};

const dir = join(tmpdir(), `va-demo-ui-${Date.now()}`);
const app = await startServer(
  { ...loadConfig(), port: 0, pgliteDir: dir, databaseUrl: undefined, consolePassword: 'team', sessionSecret: 'demo-ui' },
  { web: 'dist', scoutTest: { allowPrivate: true, paceMs: 0, model } },
);
const base = `http://localhost:${app.port}`;

const exe = chromiumPath();
if (!exe) throw new Error('No Chromium found: install it (sudo apt-get install chromium) or set CHROME_PATH.');
const browser = await chromium.launch({ executablePath: exe });
const errors: string[] = [];
let step = 0;
const shot = async (page: Page, name: string) => {
  // Entrances (a blur, rising) finish first; endless ones (a pulse, a spinner) are left running.
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => null))));
  return page.screenshot({ path: join(OUT, `${String(++step).padStart(2, '0')}-${name}.png`), fullPage: true });
};
let failed = false;

try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/40[14]|scout/.test(m.text()) && errors.push(`console: ${m.text()}`));

  // The team issues a key from the console.
  await page.goto(`${base}/`);
  await page.waitForSelector('#password');
  await page.fill('#password', 'team');
  await page.click('.signin button[type=submit]');
  await page.waitForSelector('#k-name');
  await page.fill('#k-name', 'Sam Price');
  await page.fill('#k-company', 'Olive & Ember');
  await page.click('button:has-text("Issue a private key")');
  await page.waitForSelector('.issued code');
  const raw = (await page.textContent('.issued code'))!.trim();
  if (!/^DEMO-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(raw)) throw new Error(`odd key: ${raw}`);
  await shot(page, 'console-key-issued');
  // The team's own demo business, on its live board.
  await page.goto(`${base}/demo/admin/board/lucas-trattoria`);
  await page.waitForSelector('.board .talk');
  await shot(page, 'console-board');

  // The door, with a wrong key, then the one-click link.
  await page.goto(`${base}/demo/`);
  await page.waitForSelector('#demo-key');
  await page.fill('#demo-key', 'DEMO-AAAA-BBBB-CCCC');
  await page.click('button[type=submit]');
  await page.waitForSelector('.form-error');
  await shot(page, 'door-wrong-key');
  await page.goto(`${base}/demo/reception#key=${raw}`);
  await page.waitForSelector('text=Welcome, Sam.');
  if (page.url().includes('#key')) throw new Error('the key stayed in the address bar');
  await shot(page, 'home');

  // A new restaurant, from the preset (no website).
  await page.click('text=Build a new demo');
  await page.waitForSelector('.preset');
  await page.click('.preset:has-text("Restaurant")');
  await page.waitForSelector('#new-name');
  await shot(page, 'pick-preset');
  await page.click('text=Build from the preset');
  await page.waitForSelector('#step-title:has-text("Basics")');
  await page.fill('input[maxlength="160"][placeholder="Neapolitan pizza and fresh pasta"]', 'Wood-fired Neapolitan pizza and small plates');
  await page.waitForSelector('.save-state.saved', { timeout: 10000 });
  await shot(page, 'builder-basics');

  const next = async (title: string, p = page) => {
    await p.click('.step-nav button.primary');
    await p.waitForSelector(`#step-title:has-text("${title}")`);
  };
  await next('Opening hours');
  await shot(page, 'builder-hours');
  await next('How you serve');
  await next('Seating');
  // One more 6-seat table inside.
  await page.click('button[aria-label="One more 6-seat table in Inside"]');
  await page.waitForSelector('.save-state.saved', { timeout: 10000 });
  await shot(page, 'builder-seating');
  await next('Floor plan');
  const table = page.locator('svg.floor g.table').first();
  const box = (await table.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 40, { steps: 6 });
  await page.mouse.up();
  await page.waitForSelector('#tb-label');
  await page.waitForSelector('.save-state.saved', { timeout: 10000 });
  // Plan units to screen pixels, from the drawing's width.
  const scale = (await page.locator('svg.floor').boundingBox())!.width / 1000;
  const dragBy = async (label: string, to: { x: number; y: number } | string) => {
    const b = (await page.locator(`svg.floor g.table[aria-label^="${label},"]`).boundingBox())!;
    const target = typeof to === 'string' ? (await page.locator(`svg.floor g.table[aria-label^="${to},"]`).boundingBox())! : null;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    const end = target ? { x: target.x + target.width / 2, y: target.y + target.height / 2 } : { x: b.x + b.width / 2 + (to as { x: number }).x * scale, y: b.y + b.height / 2 + (to as { y: number }).y * scale };
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up();
  };
  // Dropped on another table, it slides to the nearest clear space.
  await dragBy('Table 5', 'Table 6');
  await page.waitForSelector('.toast:has-text("nearest clear space")', { timeout: 5000 });
  // Dropped next to another, the builder offers to push them together.
  await dragBy('Table 9', { x: -24, y: 0 });
  await page.waitForSelector('.join-offer:has-text("Table 9 is next to Table 8")', { timeout: 5000 });
  await shot(page, 'builder-floor');
  // Mid-drag: the guides show what it lines up with.
  const b16 = (await page.locator('svg.floor g.table[aria-label^="Table 16,"]').boundingBox())!;
  await page.mouse.move(b16.x + b16.width / 2, b16.y + b16.height / 2);
  await page.mouse.down();
  await page.mouse.move(b16.x + b16.width / 2 + 60 * scale, b16.y + b16.height / 2 + 4 * scale, { steps: 6 });
  await page.waitForSelector('svg.floor line.guide', { state: 'attached' });
  await shot(page, 'builder-floor-guides');
  await page.mouse.move(b16.x + b16.width / 2, b16.y + b16.height / 2, { steps: 4 });
  await page.mouse.up();
  await page.click('.join-offer button:has-text("Join them")');
  await page.waitForSelector('.join-offer', { state: 'detached' });
  // Each area is its own tab; a bar goes on the terrace.
  await page.click('.area-tabs [role=tab]:has-text("Terrace")');
  await page.click('.plan-tools button:has-text("+ Bar")');
  await page.waitForSelector('svg.floor g.fixture.f-bar.selected');
  await page.waitForSelector('#fx-length');
  await page.waitForSelector('.save-state.saved', { timeout: 10000 });
  await shot(page, 'builder-floor-terrace');
  await next('Menu');
  await shot(page, 'builder-menu');
  await next('Money');
  await next('Policies and questions');
  await next('Review and start');
  await shot(page, 'builder-review');
  await page.click('button:has-text("Start my demo")');

  // The workspace.
  await page.waitForSelector('.workspace svg.floor g.table', { timeout: 20000 });
  await page.waitForSelector('.phone');
  await shot(page, 'workspace-floor');
  await page.click('.area-tabs [role=tab]:has-text("Inside")');
  await page.waitForSelector('svg.floor[aria-label*="Inside"]');
  await shot(page, 'workspace-floor-inside');
  await page.click('.area-tabs [role=tab]:has-text("All areas")');

  // Open a booked table on the timeline, then move it with the drawer.
  await page.click('.tabs button:has-text("Timeline")');
  await page.waitForSelector('.tl-bar');
  await shot(page, 'workspace-timeline');
  await page.locator('.tl-bar').first().click();
  await page.waitForSelector('.drawer');
  const options = await page.locator('#bd-move option').count();
  if (options > 1) {
    const value = await page.locator('#bd-move option').nth(1).getAttribute('value');
    await page.selectOption('#bd-move', value!);
    await page.waitForSelector('.toast:has-text("Moved to")', { timeout: 10000 });
  }
  await shot(page, 'workspace-drawer');

  // The kitchen: mark the first new order ready; its text lands on the phone only if it is this phone's number, so check the message list.
  await page.click('.tabs button:has-text("Kitchen")');
  await page.waitForSelector('.kitchen');
  const start = page.locator('.k-col').nth(1).locator('button:has-text("Ready")').first();
  if (await start.count()) {
    await start.click();
    await page.waitForSelector('.toast:has-text("texted")', { timeout: 10000 });
  }
  await shot(page, 'workspace-kitchen');
  await page.click('.tabs button:has-text("Messages")');
  await page.waitForSelector('.ws-messages');
  await shot(page, 'workspace-messages');

  // Narrow screen.
  await page.setViewportSize({ width: 390, height: 900 });
  await page.click('.tabs button:has-text("Floor plan")');
  await shot(page, 'workspace-mobile');

  // Build from a website: a private key holds one demo, so this one replaces
  // the first (after saying so); then the scout card, "Is this you?", and the
  // builder filled in.
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto(`${base}/demo/reception`);
  await page.click('text=Try a different demo');
  await page.click('.preset:has-text("Restaurant")');
  await page.fill('#new-name', 'My place');
  await page.fill('#new-site', siteUrl);
  await page.waitForSelector('.replace-box:has-text("Olive & Ember")');
  await shot(page, 'replace-asked');
  await page.click('text=Replace it and build');
  await page.waitForSelector('.scout.done', { timeout: 60000 });
  await shot(page, 'scout-found');
  await page.click('text=Yes, use these');
  await page.waitForSelector('.toast:has-text("Filled in from your website")');
  const name = await page.inputValue('.field input[maxlength="60"]');
  if (name !== 'Bella Vista') throw new Error(`the name was not filled in from the website (${name})`);
  if (!(await page.locator('.source.website').count())) throw new Error('fields from the website are not marked');
  await shot(page, 'scout-applied');
  await page.goto(`${base}/demo/reception`);
  await page.waitForSelector('.tenant-card h3');
  if ((await page.locator('.tenant-card:not(.new-card)').count()) !== 1) throw new Error('the replaced demo is still listed');

  // A shared key: one link for many people. Each gets a demo of their own,
  // deleted with everything in it an hour after Start.
  await page.goto(`${base}/`);
  await page.waitForSelector('#k-name');
  await page.click('.key-kind label:has-text("Shared")');
  await page.fill('#k-name', 'Hospitality expo');
  await page.click('button:has-text("Issue a shared key")');
  await page.waitForSelector('.issued:has-text("Shared key")');
  const shared = (await page.textContent('.issued code'))!.trim();
  await page.waitForSelector('table.keys td:has-text("Hospitality expo")');
  await shot(page, 'console-shared-key');

  const visitor = async (label: string) => {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(`pageerror (${label}): ${e.message}`));
    await p.goto(`${base}/demo/reception#key=${shared}`);
    await p.waitForSelector('text=deleted an hour after you press Start');
    if (await p.locator('.tenant-card:not(.new-card)').count()) throw new Error(`${label} can see someone else's demo`);
    await p.click('text=Build a new demo');
    await p.click('.preset:has-text("Restaurant")');
    await p.fill('#new-name', `Expo ${label}`);
    await p.click('text=Build from the preset');
    await p.waitForSelector('#step-title:has-text("Basics")');
    await p.waitForSelector('.expiry:has-text("A draft")');
    return p;
  };
  const first = await visitor('first visitor');
  await shot(first, 'shared-draft');
  await first.fill('input[maxlength="160"][placeholder="Neapolitan pizza and fresh pasta"]', 'Pizza and pasta');
  await first.waitForSelector('.save-state.saved', { timeout: 10000 });
  for (const title of ['Opening hours', 'How you serve', 'Seating', 'Floor plan', 'Menu', 'Money', 'Policies and questions', 'Review and start']) await next(title, first);
  await first.click('button:has-text("Start my demo")');
  await first.waitForSelector('.workspace svg.floor g.table', { timeout: 20000 });
  await first.waitForSelector('.badge:has-text("Deleted in 1 h")');
  await shot(first, 'shared-workspace');
  await first.goto(`${base}/demo/reception`);
  await first.waitForSelector('.tenant-card .expiry:has-text("with everything in it")');
  await shot(first, 'shared-home');
  // Someone else on the same link starts with nothing of the first person's.
  const second = await visitor('second visitor');
  await second.context().close();
  await first.context().close();
  await page.goto(`${base}/`);
  await page.waitForSelector('table.keys td:has-text("2 people")');

  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`demo UI: all steps passed. Screenshots in ${OUT}/`);
} catch (err) {
  failed = true;
  console.error(`demo UI failed at step ${step}: ${(err as Error).message}`);
  if (errors.length) console.error(errors.join('\n'));
} finally {
  await browser.close();
  await app.close();
  site.close();
  rmSync(dir, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
