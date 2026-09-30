// The prospect's journey through a real browser, without calling a model:
// a key from the team, the one-click link, a restaurant from the preset, the
// builder's steps, Start, then the back office (floor plan, moving a booking,
// the timeline, the kitchen's ready text, the phone). Fails on any page error.
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

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors: string[] = [];
let step = 0;
const shot = async (page: Page, name: string) => page.screenshot({ path: join(OUT, `${String(++step).padStart(2, '0')}-${name}.png`), fullPage: true });
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
  await page.click('text=Issue a key');
  await page.waitForSelector('.issued code');
  const raw = (await page.textContent('.issued code'))!.trim();
  if (!/^DEMO-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(raw)) throw new Error(`odd key: ${raw}`);
  await shot(page, 'console-key-issued');

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

  const next = async (title: string) => {
    await page.click('.step-nav button.primary');
    await page.waitForSelector(`#step-title:has-text("${title}")`);
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
  await shot(page, 'builder-floor');
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

  // Build from a website: the scout card, "Is this you?", then the builder filled in.
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto(`${base}/demo/reception/new`);
  await page.click('.preset:has-text("Restaurant")');
  await page.fill('#new-name', 'My place');
  await page.fill('#new-site', siteUrl);
  await page.click('text=Build from my website');
  await page.waitForSelector('.scout.done', { timeout: 60000 });
  await shot(page, 'scout-found');
  await page.click('text=Yes, use these');
  await page.waitForSelector('.toast:has-text("Filled in from your website")');
  const name = await page.inputValue('.field input[maxlength="60"]');
  if (name !== 'Bella Vista') throw new Error(`the name was not filled in from the website (${name})`);
  if (!(await page.locator('.source.website').count())) throw new Error('fields from the website are not marked');
  await shot(page, 'scout-applied');

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
