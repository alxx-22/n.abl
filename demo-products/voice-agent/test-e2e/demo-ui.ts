// The prospect's journey through a real browser, without calling a model:
// a walk for each kind of business that is built (WALKS, below). Fails on
// any page error.
//
// The estate agent's walk: an agency from the preset, an edit on each of the
// builder's nine steps (all still there after a reload), Start, then the
// Diary with a viewing's feedback, Properties with a price change, and an
// offer accepted, which makes its home sale agreed and texts the buyer.
//
// The restaurant's walk: a key from the team, the one-click link, a
// restaurant from the preset, the builder's steps (an edit on each, all
// still there after a reload), Start, then the back office (floor plan,
// moving a booking, the timeline, the kitchen's ready text, the phone); a
// second demo from a website, replacing the first; then a shared key used by
// two people, each with their own demo and its deletion time.
//
//   npm run e2e:demo                          every built preset (builds the app first)
//   npm run e2e:demo -- --only restaurant     only these: a comma-separated list
//
// Writes each walk's screenshots to eval-results/demo-ui/<preset>/.

import { mkdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { loadConfig } from '../src/config.ts';
import { startServer } from '../src/server/main.ts';
import { chromiumPath } from '../src/scout/render.ts';
import { PRESETS } from '../src/presets/catalogue.ts';
import { builtPreset } from '../src/presets/index.ts';

const OUT = 'eval-results/demo-ui';

/** What a walk is handed: `shot` saves a screenshot in the preset's folder, numbered in the order taken. */
interface Walk {
  shot(page: Page, name: string): Promise<unknown>;
}

/** A walk for each built preset. One that is built without a walk fails the run, so no kind of business goes unwalked. */
const WALKS: Record<string, (w: Walk) => Promise<void>> = {
  restaurant: walkRestaurant,
  estate_agent: walkEstate,
  property_maintenance: walkMaintenance,
  takeaway: walkTakeaway,
  barber: walkBarber,
};

const built = PRESETS.filter((p) => builtPreset(p.key)).map((p) => p.key);
const args = process.argv.slice(2);
const only = args.flatMap((a, i) => (args[i - 1] === '--only' ? a.split(',') : a.startsWith('--only=') ? a.slice(7).split(',') : [])).map((k) => k.trim()).filter(Boolean);
const chosen = only.length ? [...new Set(only)] : built;
for (const key of chosen) {
  if (!built.includes(key)) throw new Error(`${key} is not a built preset. Built: ${built.join(', ')}.`);
  if (!Object.hasOwn(WALKS, key)) throw new Error(`${key} is built but has no walk in test-e2e/demo-ui.ts.`);
}

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
/** The builder's floor plan as drawn, area by area: where every table and room shape sits, and how many joins. */
const floorPlan = async (page: Page) => {
  const out: Record<string, unknown> = {};
  const areas = await page.locator('.area-tabs [role=tab]').evaluateAll((tabs) => tabs.map((t) => t.childNodes[0].textContent!.trim()));
  for (const area of areas) {
    await page.click(`.area-tabs [role=tab]:has-text("${area}")`);
    await page.waitForSelector(`svg.floor[aria-label^="${area}:"]`);
    out[area] = await page.locator('svg.floor').evaluate((svg) => ({
      tables: [...svg.querySelectorAll('g.table')].map((g) => `${g.getAttribute('aria-label')} at ${g.getAttribute('transform')}`),
      // The kind only: whichever shape was selected before the reload is not selected after it.
      shapes: [...svg.querySelectorAll('g.fixture')].map((g) => `${[...g.classList].find((c) => c.startsWith('f-'))} at ${g.getAttribute('transform')}`),
      joins: svg.querySelectorAll('line.join').length,
    }));
  }
  return out;
};
let failed = false;

try {
  for (const preset of chosen) {
    const folder = join(OUT, preset);
    // A shot an earlier run took and this one did not would pass for this run's.
    rmSync(folder, { recursive: true, force: true });
    mkdirSync(folder, { recursive: true });
    let step = 0;
    const shot = async (page: Page, name: string) => {
      // Entrances (a blur, rising) finish first; endless ones (a pulse, a spinner) are left running.
      await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => null))));
      return page.screenshot({ path: join(folder, `${String(++step).padStart(2, '0')}-${name}.png`), fullPage: true });
    };
    try {
      await WALKS[preset]({ shot });
      if (errors.length) throw new Error(errors.join('\n'));
      console.log(`demo UI, ${preset}: all steps passed. Screenshots in ${folder}/`);
    } catch (err) {
      failed = true;
      console.error(`demo UI, ${preset}: failed at step ${step}: ${(err as Error).message}`);
      if (errors.length) console.error(errors.join('\n'));
    }
    errors.length = 0;
  }
} finally {
  await browser.close();
  await app.close();
  site.close();
  rmSync(dir, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}

async function walkRestaurant({ shot }: Walk) {
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
    await page.fill('input[aria-label="Tuesday Dinner closes"]', '22:30');
    await page.waitForSelector('.save-state.saved', { timeout: 10000 });
    await next('How you serve');
    await page.getByRole('checkbox', { name: 'Deliveroo' }).check();
    await page.waitForSelector('.save-state.saved', { timeout: 10000 });
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
    const floorBefore = await floorPlan(page);
    await next('Menu');
    await shot(page, 'builder-menu');
    await page.locator('input.dish-name').first().fill('Garlic bread with rosemary');
    await page.waitForSelector('.save-state.saved', { timeout: 10000 });
    await next('Money');
    await page.getByRole('radio', { name: 'Pay on collection' }).check();
    await page.waitForSelector('.save-state.saved', { timeout: 10000 });
    await next('Policies and questions');
    await page.getByLabel('Parking', { exact: true }).fill('Free parking behind the restaurant after 6pm.');
    await page.waitForSelector('.save-state.saved', { timeout: 10000 });
    await next('Review and start');
    await shot(page, 'builder-review');

    // Reloaded, the builder shows every edit above: autosave kept them all, and
    // the server's cleaning of the answers dropped none.
    await page.waitForSelector('.save-state.saved', { timeout: 10000 });
    await page.reload();
    await page.waitForSelector('#step-title:has-text("Basics")');
    const kept = (what: string, ok: boolean) => {
      if (!ok) throw new Error(`after a reload, the builder lost ${what}`);
    };
    kept('the style', (await page.inputValue('input[maxlength="160"][placeholder="Neapolitan pizza and fresh pasta"]')) === 'Wood-fired Neapolitan pizza and small plates');
    await next('Opening hours');
    kept("Tuesday dinner's closing time", (await page.inputValue('input[aria-label="Tuesday Dinner closes"]')) === '22:30');
    await next('How you serve');
    kept('Deliveroo', await page.getByRole('checkbox', { name: 'Deliveroo' }).isChecked());
    await next('Seating');
    kept('the extra 6-seat table', (await page.locator('.area-card').first().locator('.size-count', { hasText: '6-seat tables' }).locator('b').textContent()) === '3');
    await next('Floor plan');
    const floorAfter = await floorPlan(page);
    kept(`the floor plan (${JSON.stringify(floorBefore)} became ${JSON.stringify(floorAfter)})`, JSON.stringify(floorAfter) === JSON.stringify(floorBefore));
    await next('Menu');
    kept("the dish's new name", (await page.locator('input.dish-name').first().inputValue()) === 'Garlic bread with rosemary');
    await next('Money');
    kept('paying for takeaway on collection', await page.getByRole('radio', { name: 'Pay on collection' }).isChecked());
    await next('Policies and questions');
    kept('the parking answer', (await page.getByLabel('Parking', { exact: true }).inputValue()) === 'Free parking behind the restaurant after 6pm.');
    await next('Review and start');
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

    // The demo's own clock: tomorrow at half seven, to see dinner service whatever the real time.
    await page.click('.demo-clock > button');
    await page.waitForSelector('.clock-pop');
    await page.locator('.clock-pop select').selectOption({ index: 1 });
    await page.fill('.clock-pop input[type=time]', '19:30');
    await page.click('.clock-pop button[type=submit]');
    await page.waitForSelector('.demo-clock > button:has-text("Demo time")');
    await page.click('.tabs button:has-text("Floor plan")');
    await page.waitForSelector('.workspace svg.floor g.table');
    await page.waitForFunction(() => !document.querySelector('.toast'), undefined, { timeout: 15000 }).catch(() => {});
    await shot(page, 'workspace-clock-dinner');

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
}

async function walkEstate({ shot }: Walk) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/40[14]|scout/.test(m.text()) && errors.push(`console: ${m.text()}`));
  const saved = () => page.waitForSelector('.save-state.saved', { timeout: 10000 });
  const next = async (title: string) => {
    await page.click('.step-nav button.primary');
    await page.waitForSelector(`#step-title:has-text("${title}")`);
  };
  const kept = (what: string, ok: boolean) => {
    if (!ok) throw new Error(`after a reload, the builder lost ${what}`);
  };

  // A key from the team, and the agency from the preset.
  await page.goto(`${base}/`);
  await page.waitForSelector('#password');
  await page.fill('#password', 'team');
  await page.click('.signin button[type=submit]');
  await page.waitForSelector('#k-name');
  await page.fill('#k-name', 'Jo Green');
  await page.fill('#k-company', 'Hartwell & Green');
  await page.click('button:has-text("Issue a private key")');
  await page.waitForSelector('.issued code');
  const raw = (await page.textContent('.issued code'))!.trim();
  await page.goto(`${base}/demo/reception#key=${raw}`);
  await page.waitForSelector('text=Welcome, Jo.');
  await page.click('text=Build a new demo');
  await page.waitForSelector('.preset');
  await page.click('.preset:has-text("Estate agent")');
  await page.waitForSelector('#new-name');
  await shot(page, 'pick-preset');
  await page.click('text=Build from the preset');

  // An edit on every step.
  const style = 'input[maxlength="160"][placeholder="Independent estate agency, sales only"]';
  await page.waitForSelector('#step-title:has-text("Basics")');
  await page.fill(style, 'Independent estate agency, family run since 1998');
  await saved();
  await shot(page, 'builder-basics');
  await next('Where you work');
  await page.getByLabel('Postcode districts you cover').fill('BK1, BK2, BK3, BK4, BK5, BK6');
  await saved();
  await shot(page, 'builder-patch');
  await next('Office and viewing hours');
  // One week at a time behind a switch; each week's copy button has its own name.
  const copies: (string | null)[] = [];
  for (const week of ['Office hours', 'Viewings', 'Valuations']) {
    await page.getByRole('tab', { name: week, exact: true }).click();
    copies.push(...(await page.getByRole('button', { name: /Copy Monday/ }).evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label') ?? b.textContent))));
  }
  if (copies.length !== 3 || new Set(copies).size !== 3) throw new Error(`copy buttons not one a week, named by week: ${JSON.stringify(copies)}`);
  await page.getByRole('tab', { name: 'Viewings', exact: true }).click();
  await page.fill('input[aria-label="Viewings Saturday Open closes"]', '17:00');
  await saved();
  await shot(page, 'builder-hours');
  await next('Your team');
  // A new person's line opens by itself.
  await page.click('button:has-text("+ Add someone")');
  await page.locator('input[aria-label="Name"]').last().fill('Alex Reed');
  await saved();
  await shot(page, 'builder-team');
  await next('Listings');
  await page.click('.home-row:has-text("22 Albion Road")');
  await page.click('.home-editor [role=tab]:has-text("Price and status")');
  await page.getByLabel('Price in pounds').fill('330000');
  await saved();
  await shot(page, 'builder-listings');
  await page.click('.home-editor [role=tab]:has-text("Checklist")');
  await shot(page, 'builder-listings-checklist');
  await next('Viewings and safety');
  await page.getByLabel('Travel between homes').fill('20');
  await saved();
  await next('Offers and valuations');
  await page.getByLabel('What you call them').fill('free valuation');
  await saved();
  await shot(page, 'builder-offers');
  await next('Fees and services');
  await page.getByRole('switch', { name: /Quote your fees/ }).check();
  await saved();
  await shot(page, 'builder-services');
  await next('Area guide and questions');
  await page.click('button:has-text("+ Add an area question")');
  await page.locator('input[aria-label="Area question"]').last().fill('Is there a farmers market?');
  await page.locator('textarea[aria-label="Area answer"]').last().fill('Yes, on the High Street every Saturday morning.');
  await saved();
  await next('Review and start');
  await shot(page, 'builder-review');

  // Reloaded, every edit is still there.
  await page.reload();
  await page.waitForSelector('#step-title:has-text("Basics")');
  kept('the style', (await page.inputValue(style)) === 'Independent estate agency, family run since 1998');
  await next('Where you work');
  kept('the districts', (await page.getByLabel('Postcode districts you cover').inputValue()) === 'BK1, BK2, BK3, BK4, BK5, BK6');
  await next('Office and viewing hours');
  kept("Saturday's viewing hours", (await page.inputValue('input[aria-label="Viewings Saturday Open closes"]')) === '17:00');
  await next('Your team');
  await page.click('.fold-head:has-text("Alex Reed")');
  kept('the new person', (await page.locator('input[aria-label="Name"]').last().inputValue()) === 'Alex Reed');
  await next('Listings');
  await page.click('.home-row:has-text("22 Albion Road")');
  kept("22 Albion Road's price", (await page.locator('.home-row:has-text("22 Albion Road")').textContent())!.includes('£330,000'));
  await next('Viewings and safety');
  kept('the travel time', (await page.getByLabel('Travel between homes').inputValue()) === '20');
  await next('Offers and valuations');
  kept("the valuations' name", (await page.getByLabel('What you call them').inputValue()) === 'free valuation');
  await next('Fees and services');
  kept('fees quoted', await page.getByRole('switch', { name: /Quote your fees/ }).isChecked());
  await next('Area guide and questions');
  kept('the area question', (await page.locator('input[aria-label="Area question"]').last().inputValue()) === 'Is there a farmers market?');
  await next('Review and start');
  await page.click('button:has-text("Start my demo")');

  // The Diary: a viewing opened, its feedback recorded.
  await page.waitForSelector('.diary', { timeout: 20000 });
  await page.waitForSelector('.phone');
  await shot(page, 'workspace-diary');
  await page.locator('.days button:has(.count)').last().click();
  await page.locator('.diary .tl-bar.viewing').first().click();
  await page.waitForSelector('.drawer');
  await page.click('.drawer [aria-label="Feedback"] button:has-text("Keen")');
  await page.waitForSelector('.toast:has-text("Feedback saved")', { timeout: 10000 });
  await page.waitForSelector('.drawer [aria-label="Feedback"] button[aria-pressed="true"]:has-text("Keen")');
  await shot(page, 'workspace-diary-viewing');

  // Given to someone else: from the viewing's panel, then by dragging a bar onto another person's row.
  const who = page.locator('#bd-person');
  await who.waitFor();
  if ((await who.locator('option').count()) > 1) {
    const name = (await who.locator('option').nth(1).textContent())!.trim();
    await who.selectOption({ index: 1 });
    await page.waitForSelector(`.toast:has-text("Moved to ${name}")`, { timeout: 10000 });
    await page.waitForSelector(`.toast:has-text("has been texted")`);
  }
  await page.click('.drawer button[aria-label="Close"]');
  await page.waitForFunction(() => !document.querySelector('.toast'), undefined, { timeout: 15000 }).catch(() => {});
  let dragged = false;
  for (let i = 0; i < Math.min(8, await page.locator('.diary .tl-bar').count()) && !dragged; i++) {
    const bar = page.locator('.diary .tl-bar').nth(i);
    const title = (await bar.getAttribute('title'))!;
    const box = (await bar.boundingBox())!;
    await page.mouse.move(box.x + 6, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 12, box.y + box.height / 2, { steps: 3 });
    const target = page.locator('.diary .tl-row.can-drop').first();
    if (await target.count()) {
      const to = (await target.getAttribute('data-row'))!;
      const t = (await target.boundingBox())!;
      await page.mouse.move(t.x + t.width * 0.6, t.y + t.height / 2, { steps: 10 });
      await shot(page, 'workspace-diary-drag');
      await page.mouse.up();
      // In the new person's row, and the toast says so.
      await page.waitForSelector('.toast:has-text("Moved to")', { timeout: 10000 });
      await page.locator(`.diary .tl-row[data-row="${to}"] .tl-bar[title="${title.replace(/"/g, '\\"')}"]`).waitFor({ timeout: 10000 });
      dragged = true;
    } else {
      await page.mouse.up();
      if (await page.locator('.drawer').count()) await page.click('.drawer button[aria-label="Close"]');
    }
  }
  if (!dragged) throw new Error('no viewing in the Diary could be dragged to someone else');

  // Properties: the price the builder set, then a reduction from the back office.
  await page.click('.tabs [role=tab]:has-text("Properties")');
  const albion = page.locator('.home-card', { has: page.locator('header b', { hasText: /^22 Albion Road$/ }) });
  await albion.waitFor();
  if (!(await albion.textContent())!.includes('£330,000')) throw new Error("Properties does not show the builder's new price");
  await shot(page, 'workspace-properties');
  // Manage opens a panel over the list; Escape closes it, and focus goes back to the card's Manage button.
  await albion.locator('button:has-text("Manage")').click();
  const manage = page.getByRole('dialog', { name: '22 Albion Road' });
  await manage.getByLabel('Price £').fill('320000');
  await manage.locator('button:has-text("Change price")').click();
  await page.waitForSelector('.toast:has-text("reduced to £320,000")', { timeout: 10000 });
  await manage.getByRole('status').getByText('reduced to £320,000').waitFor();
  await shot(page, 'workspace-properties-manage');
  await page.keyboard.press('Escape');
  await manage.waitFor({ state: 'detached' });
  if (!(await albion.locator('button:has-text("Manage")').evaluate((b) => b === document.activeElement))) throw new Error('closing Manage did not return focus to its button');
  if (!(await albion.textContent())!.includes('£320,000')) throw new Error('the card does not show the new price');

  // Offers: one accepted; its home turns sale agreed, and the buyer is texted.
  await page.click('.tabs [role=tab]:has-text("Offers")');
  await page.waitForSelector('.offer');
  await shot(page, 'workspace-offers');
  const card = page.locator('.k-col', { hasText: 'Received' }).locator('.offer').first();
  const home = (await card.locator('b').first().textContent())!.trim();
  await card.locator('button:has-text("Seller accepts")').click();
  await card.locator('button:has-text("Confirm: seller accepts")').click();
  await page.waitForSelector(`.toast:has-text("${home} is sale agreed")`, { timeout: 10000 });
  await shot(page, 'workspace-offer-accepted');
  await page.click('.tabs [role=tab]:has-text("Properties")');
  const agreed = page.locator('.home-card', { has: page.locator('header b', { hasText: new RegExp(`^${home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) });
  if (!(await agreed.locator('.badge').first().textContent())!.includes('Sale agreed')) throw new Error(`${home} is not shown as sale agreed`);
  await page.click('.tabs [role=tab]:has-text("Messages")');
  await page.waitForSelector('.ws-messages');
  if (!(await page.locator('.ws-messages').textContent())!.includes('subject to contract')) throw new Error('the buyer was not texted');
  await shot(page, 'workspace-messages');
  await page.click('.tabs [role=tab]:has-text("Calls")');
  await shot(page, 'workspace-calls');
  await page.click('.tabs [role=tab]:has-text("Applicants")');
  await page.waitForSelector('.applicant');
  if (!(await page.locator('.applicants').textContent())!.includes('Alerts on')) throw new Error('no buyer with alerts on');
  await shot(page, 'workspace-applicants');
  // The chips and the search narrow the list: alerts on only, then one buyer by their number typed without spaces.
  const buyers = page.locator('.applicant');
  const everyone = await buyers.count();
  await page.locator('.ap-chip:has-text("Alerts on")').click();
  if (!(await page.locator('.ap-chip[aria-pressed="true"]:has-text("Alerts on")').count())) throw new Error('the Alerts on chip is not pressed');
  const alertsOn = await buyers.count();
  if (!alertsOn || alertsOn >= everyone || (await page.locator('.applicant .badge:has-text("Alerts on")').count()) !== alertsOn) throw new Error('Alerts on did not narrow the list to buyers with alerts');
  await shot(page, 'workspace-applicants-filtered');
  const phone = (await buyers.first().locator('.ap-who .muted').textContent())!.replace(/\s/g, '');
  await page.getByLabel('Search buyers').fill(phone);
  if ((await buyers.count()) !== 1) throw new Error(`searching ${phone} did not find one buyer`);
  await page.locator('.ap-chip:has-text("All")').click();
  await page.getByLabel('Search buyers').fill('');
  if ((await buyers.count()) !== everyone) throw new Error('All and an empty search did not bring everyone back');
  await page.click('.tabs [role=tab]:has-text("Valuations")');
  await page.waitForSelector('.valuation');
  if (!(await page.locator('.k-col[aria-label="Booked"] .valuation').count())) throw new Error('no valuation booked');
  const outcomes = await page.locator('.k-col[aria-label="Outcome"]').textContent();
  for (const o of ['Instructed', 'Thinking', 'Lost']) if (!outcomes!.includes(o)) throw new Error(`no valuation ${o}`);
  if (!(await page.locator('.valuations').textContent())!.includes('Possible double fee')) throw new Error('the double-fee flag is missing');
  await shot(page, 'workspace-valuations');

  // Sales progress (M3): a milestone ticked on 2 Elm Court; 8 Willow Gardens completes today and its keys are released;
  // Ben's sale of 3 Kingfisher Way falls through and the home goes back on the market.
  await page.click('.tabs [role=tab]:has-text("Sales progress")');
  const sale = (home: string) => page.locator(`article.sale[aria-label="Sale of ${home}"]`);
  await sale('2 Elm Court').locator('button.step:has-text("Enquiries")').click();
  await sale('2 Elm Court').locator('button.step.on:has-text("Enquiries")').waitFor();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  await sale('8 Willow Gardens').locator('input[type=date]').nth(1).fill(today);
  await sale('8 Willow Gardens').locator('button:has-text("Save dates")').click();
  await page.waitForSelector('text=8 Willow Gardens: dates saved.');
  await shot(page, 'workspace-sales');
  await sale('8 Willow Gardens').locator('button:has-text("Completed: release keys")').click();
  await page.waitForSelector('text=the buyer has been texted that the keys are ready');
  await sale('8 Willow Gardens').getByText(/^Keys released/).waitFor();
  // Why it fell through (a prompt), then yes, back on the market (a confirm): one handler for both, as they come.
  const answer = (d: import('playwright-core').Dialog) => void (d.type() === 'prompt' ? d.accept("The buyer's mortgage was refused") : d.accept());
  page.on('dialog', answer);
  await sale('3 Kingfisher Way').locator('button:has-text("Fell through")').click();
  await page.waitForSelector('text=/3 Kingfisher Way: back on the market/');
  page.off('dialog', answer);
  await shot(page, 'workspace-sales-after');

  // Call as Sarah, the seller: her number, what to try, and the texts already on her phone.
  await page.getByLabel('Call as').selectOption({ label: 'Sarah Collins, a seller' });
  await page.waitForSelector('.phone-number:has-text("07700 900001")');
  if (!(await page.locator('.phone-number').textContent())!.includes('Ask how the sale is going')) throw new Error('Call as did not say what to try');
  await shot(page, 'workspace-call-as');
  await page.getByLabel('Call as').selectOption({ label: 'Yourself, a new caller' });
  if ((await page.locator('.phone-number b.mono').textContent()) === '07700 900001') throw new Error('Call as did not go back to a new number');

  // Narrow screen.
  await page.setViewportSize({ width: 390, height: 900 });
  await page.click('.tabs [role=tab]:has-text("Properties")');
  await shot(page, 'workspace-mobile');
  await page.context().close();
}

async function walkMaintenance({ shot }: Walk) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  // Toasts from the last action clear in a few seconds: wait, so they don't cover the screenshot.
  const calm = () => page.waitForFunction(() => !document.querySelector('.toast'), undefined, { timeout: 15000 }).catch(() => {});
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/40[1349]|scout/.test(m.text()) && errors.push(`console: ${m.text()}`));
  const saved = () => page.waitForSelector('.save-state.saved', { timeout: 10000 });
  const next = async (title: string) => {
    await page.click('.step-nav button.primary');
    await page.waitForSelector(`#step-title:has-text("${title}")`);
  };
  const kept = (what: string, ok: boolean) => {
    if (!ok) throw new Error(`after a reload, the builder lost ${what}`);
  };

  // A key from the team, and the contractor from the preset.
  await page.goto(`${base}/`);
  await page.waitForSelector('#password');
  await page.fill('#password', 'team');
  await page.click('.signin button[type=submit]');
  await page.waitForSelector('#k-name');
  await page.fill('#k-name', 'Helen Ward');
  await page.fill('#k-company', 'Fernhill Property Care');
  await page.click('button:has-text("Issue a private key")');
  await page.waitForSelector('.issued code');
  const raw = (await page.textContent('.issued code'))!.trim();
  await page.goto(`${base}/demo/reception#key=${raw}`);
  await page.waitForSelector('text=Welcome, Helen.');
  await page.click('text=Build a new demo');
  await page.waitForSelector('.preset');
  await page.click('.preset:has-text("Property maintenance")');
  await page.waitForSelector('#new-name');
  await shot(page, 'pick-preset');
  await page.click('text=Build from the preset');

  // An edit on every step.
  const style = 'input[maxlength="160"][placeholder="Repairs and maintenance for homes, landlords and letting agents"]';
  await page.waitForSelector('#step-title:has-text("Basics")');
  await page.fill(style, 'Repairs, safety checks and maintenance across the East Midlands');
  await saved();
  await shot(page, 'builder-basics');
  await next('Where you work');
  const districts = page.getByLabel('Postcode districts you cover');
  await districts.fill(`${await districts.inputValue()}, NG12`);
  await saved();
  await shot(page, 'builder-area');
  await next('Who you work for');
  if (!(await page.getByRole('switch', { name: /We act as their agent for repairs/ }).isChecked())) throw new Error("Meadowbank's agent answer is not on");
  await page.click('button:has-text("+ Add a client")');
  await page.locator('input[aria-label="Client name"]').last().fill('Parkside Lettings');
  await page.getByLabel('Contact', { exact: true }).last().fill('Ruth Mills');
  await page.getByLabel('Their mobile').last().fill('07700 900420');
  await saved();
  await shot(page, 'builder-customers');
  // A property of the prospect's own, to ring about as whoever lives there.
  await page.click('button:has-text("+ Add a property")');
  await page.getByLabel('Number or name').last().fill('12');
  await page.getByLabel('Street').last().fill('Test Road');
  await page.getByLabel('Who lives or works there').last().fill('Alex Test');
  await page.getByLabel('Their phone').last().fill('07700 900999');
  await saved();
  await page.locator('h3:has-text("Your own properties")').scrollIntoViewIfNeeded();
  await shot(page, 'builder-own-property');
  await next('Trades');
  await page.getByRole('switch', { name: /^Decorating/ }).uncheck();
  await saved();
  await shot(page, 'builder-trades');
  await next('Engineers and on call');
  // Each engineer is one folded line: open the first to edit it.
  await page.locator('ul[aria-label="Engineers"] .fold-head').first().click();
  await page.getByLabel('Jobs per window').first().fill('3');
  await saved();
  await shot(page, 'builder-engineers');
  await next('Urgency and response');
  await page.getByLabel('Attend within').fill('2');
  await saved();
  await next('Safety');
  await page.getByRole('switch', { name: /Boiler pressure/ }).uncheck();
  await page.click('.scripts summary:has-text("A smell of gas")');
  await saved();
  await shot(page, 'builder-safety');
  await next('Office hours and visits');
  await page.locator('input[aria-label="Window name"]').first().fill('Morning');
  await page.getByLabel('Notice needed').fill('3');
  await saved();
  await shot(page, 'builder-visits');
  await next('Prices and payment');
  await page.getByLabel('Call-out, with the first hour').fill('99.00');
  await saved();
  await next('Safety checks and servicing');
  await page.getByLabel('Gas safety record, one appliance').fill('79.00');
  await saved();
  await shot(page, 'builder-planned');
  await next('Policies and questions');
  await page.getByLabel('Insurance').fill('£10 million public liability (example)');
  await saved();
  await next('Review and start');
  await shot(page, 'builder-review');

  // Reloaded, every edit is still there.
  await page.reload();
  await page.waitForSelector('#step-title:has-text("Basics")');
  kept('the style', (await page.inputValue(style)) === 'Repairs, safety checks and maintenance across the East Midlands');
  await next('Where you work');
  kept('the new district', (await page.getByLabel('Postcode districts you cover').inputValue()).endsWith('NG12'));
  await next('Who you work for');
  await page.locator('ul[aria-label="Clients"] .fold-head').last().click();
  kept('the new client', (await page.locator('input[aria-label="Client name"]').last().inputValue()) === 'Parkside Lettings');
  await next('Trades');
  kept('decorating off', !(await page.getByRole('switch', { name: /^Decorating/ }).isChecked()));
  await next('Engineers and on call');
  await page.locator('ul[aria-label="Engineers"] .fold-head').first().click();
  kept('jobs per window', (await page.getByLabel('Jobs per window').first().inputValue()) === '3');
  await next('Urgency and response');
  kept('the emergency target', (await page.getByLabel('Attend within').inputValue()) === '2');
  await next('Safety');
  kept('the boiler pressure check off', !(await page.getByRole('switch', { name: /Boiler pressure/ }).isChecked()));
  await next('Office hours and visits');
  kept('the notice', (await page.getByLabel('Notice needed').inputValue()) === '3');
  await next('Prices and payment');
  kept('the call-out', (await page.getByLabel('Call-out, with the first hour').inputValue()) === '99.00');
  await next('Safety checks and servicing');
  kept('the gas record price', (await page.getByLabel('Gas safety record, one appliance').inputValue()) === '79.00');
  await next('Policies and questions');
  kept('the insurance', (await page.getByLabel('Insurance').inputValue()) === '£10 million public liability (example)');
  await next('Review and start');
  await page.click('button:has-text("Start my demo")');

  // Jobs: the board, and an engineer sent on their way.
  await page.waitForSelector('.jobs-board', { timeout: 20000 });
  await page.waitForSelector('.phone');
  await shot(page, 'workspace-jobs');
  // Only today's visits can be set off; on a day with no windows (a Sunday) there are none.
  const today = page.locator('.k-col[aria-label="Booked"] .ticket.job', { has: page.locator('button:has-text("On the way")') }).first();
  if (await today.count()) {
    await today.locator('button:has-text("On the way")').click();
    await page.waitForSelector('.toast:has-text("on the way")', { timeout: 10000 });
    // A card opens from its address.
    await page.locator('.k-col[aria-label="Out now"] .ticket.job .jc-where').first().click();
    await shot(page, 'workspace-jobs-on-the-way');
  }

  // Dispatch: tonight's pair, the grid, and gas work refused for someone who isn't Gas Safe.
  await page.click('.tabs [role=tab]:has-text("Dispatch")');
  await page.waitForSelector('.dispatch');
  if (!(await page.locator('.on-call').textContent())!.match(/On call tonight: \w+ and \w+/)) throw new Error('no on-call pair shown');
  for (const tab of await page.locator('.day-tabs [role=tab]').all()) {
    await tab.click();
    const gas = page.locator('.dispatch-grid td .chip[draggable=true]', { hasText: 'gas' }).first();
    const grace = page.locator('.dispatch-grid tr', { has: page.locator('th', { hasText: /^Grace/ }) }).locator('td').first();
    if (!(await gas.count()) || (await grace.locator('text=Off').count())) continue;
    // The board refreshes after the last step's "on the way"; a refresh landing mid-drag loses the drop. The server
    // refuses this one whatever happens, so a lost drop is simply tried again.
    for (let tries = 0; ; tries++) {
      await gas.dragTo(grace);
      const told = await page.waitForSelector('.toast:has-text("Grace")', { timeout: 4000 }).catch(() => null);
      if (told) break;
      if (tries === 2) throw new Error('dragging gas work onto Grace never answered');
    }
    break;
  }
  await shot(page, 'workspace-dispatch');

  // Properties and compliance: a home opened in the panel, its overdue gas record booked there.
  await page.click('.tabs [role=tab]:has-text("Properties and compliance")');
  await page.waitForSelector('.rp-props .rp-list');
  await shot(page, 'workspace-compliance');
  const overdue = page.locator('.rp-props .rp-list li', { has: page.locator('.badge.bad', { hasText: 'Gas safety: overdue' }) }).first();
  await overdue.locator('.rp-row').click();
  await page.locator('dialog.rp-sheet .certs tr', { hasText: 'Gas safety' }).locator('button:has-text("Book")').click();
  await page.waitForSelector('.toast:has-text("gas safety record booked")', { timeout: 10000 });
  await page.waitForSelector('dialog.rp-sheet .rp-said:has-text("gas safety record booked")');
  await shot(page, 'workspace-compliance-booked');
  // The panel is modal: Escape closes it.
  await page.keyboard.press('Escape');
  await page.waitForSelector('dialog.rp-sheet', { state: 'detached' });

  // The safety log: last week's gas call, the advice given and its follow-up.
  await page.click('.tabs [role=tab]:has-text("Safety log")');
  await page.waitForSelector('.safety-log');
  if (!(await page.locator('.safety-log').textContent())!.includes('A smell of gas')) throw new Error('the gas call is not in the safety log');
  await shot(page, 'workspace-safety-log');

  // Clients: what waits on each, and the housing association that Fernhill acts for.
  await page.click('.tabs [role=tab]:has-text("Clients")');
  await page.waitForSelector('.rp-clients .rp-list');
  await calm();
  await shot(page, 'workspace-clients');
  const meadowbank = page.locator('.rp-clients .rp-list li', { hasText: 'Meadowbank Housing' });
  await meadowbank.locator('.rp-row').click();
  await page.waitForSelector('dialog.rp-sheet:has-text("Approves")');
  await shot(page, 'workspace-clients-open');
  await page.locator('dialog.rp-sheet button[aria-label="Close"]').click();
  await page.waitForSelector('dialog.rp-sheet', { state: 'detached' });

  // Quotes and invoices: an overdue bill opened, reminded by text, and one marked paid by bank transfer.
  await page.click('.tabs [role=tab]:has-text("Quotes and invoices")');
  await page.waitForSelector('.rp-money');
  if (!(await page.locator('.rp-money').textContent())!.includes('Q-2291')) throw new Error('Q-2291 is not on the quotes');
  const late = page.locator('.rp-with-acts li', { has: page.locator('.badge.bad', { hasText: 'Overdue' }) }).first();
  await late.locator('.rp-ref').click();
  await page.waitForSelector('.rp-with-acts .rp-fold:has-text("Payer")');
  await calm();
  await shot(page, 'workspace-money');
  await late.locator('button:has-text("Remind")').click();
  await page.waitForSelector('.toast:has-text("Reminder sent")', { timeout: 10000 });
  await late.locator('button:has-text("Paid by bank")').click();
  await page.waitForSelector('.toast:has-text("marked paid by bank transfer")', { timeout: 10000 });

  // The landlord's own phone: Mrs Ellis approves Q-2291 there, and the job is booked.
  await page.getByLabel('Call as').selectOption({ label: 'Jean Ellis, a landlord with quote Q-2291' });
  await page.waitForSelector('.job-sheet:has-text("Quote Q-2291")');
  await shot(page, 'workspace-approval-phone');
  await page.locator('.job-sheet .page-alert', { hasText: 'Q-2291' }).locator('button:has-text("Approve")').click();
  await page.waitForSelector('.toast:has-text("Quote Q-2291 approved")', { timeout: 10000 });
  await page.waitForSelector('.sms:has-text("quote Q-2291 approved")', { timeout: 10000 });
  await calm();
  await shot(page, 'workspace-approval-done');

  // The damp case on the clock: Meadowbank's, counting down on its card.
  await page.click('.tabs [role=tab]:has-text("Dispatch")');
  await page.click('.tabs [role=tab]:has-text("Jobs")');
  await page.waitForSelector('.jobs-board');
  const clocked = page.locator('.ticket.job', { has: page.locator('.badge', { hasText: /^Due / }) }).first();
  if (await clocked.count()) {
    await clocked.locator('.jc-where').click();
    // A full-page shot of a scrolled page draws the sticky header halfway down.
    await page.evaluate(() => window.scrollTo(0, 0));
    await calm();
    await shot(page, 'workspace-damp-clock');
  }

  // The engineer's phone, and Call as a tenant.
  await page.getByLabel('Call as').selectOption({ label: 'Dan, engineer' });
  await page.waitForSelector(".phone-head:has-text(\"Dan's phone\")");
  await page.waitForSelector('.job-sheet');
  await shot(page, 'workspace-engineer-phone');
  await page.getByLabel('Call as').selectOption({ label: 'Sam Ortiz, tenant at 14 Elm Road' });
  await page.waitForSelector('.phone-number:has-text("07700 900501")');
  await shot(page, 'workspace-call-as');
  // The prospect's own property is there to ring as, too.
  await page.getByLabel('Call as').selectOption({ label: 'Alex Test at 12 Test Road (yours)' });
  await page.waitForSelector('.phone-number:has-text("07700 900999")');

  // The demo's own clock: tomorrow at 9pm, to try the on-call side whatever the real time.
  await page.click('.demo-clock > button');
  await page.waitForSelector('.clock-pop');
  await page.locator('.clock-pop select').selectOption({ index: 1 });
  await page.fill('.clock-pop input[type=time]', '21:00');
  await shot(page, 'workspace-clock-set');
  await page.click('.clock-pop button[type=submit]');
  await page.waitForSelector('.demo-clock > button:has-text("Demo time")');
  await page.click('.tabs [role=tab]:has-text("Jobs")');
  await calm();
  await shot(page, 'workspace-clock-night');

  // The office's day: a notice every call hears, and an engineer off sick whose jobs need moving.
  await page.click('.tabs [role=tab]:has-text("Dispatch")');
  await page.fill('#office-notice-text', 'Storm Ellen: emergencies only today');
  await page.check('.office-notice input[type=checkbox]');
  await page.click('.office-notice button[type=submit]');
  await page.waitForSelector('.office-notice.on');
  await page.locator('.dispatch-grid tbody tr').first().getByRole('button', { name: 'Off sick today' }).click();
  await page.waitForSelector('.dispatch-grid .badge:has-text("Off sick")');
  await calm();
  await shot(page, 'workspace-office-notice');
  await page.click('.tabs [role=tab]:has-text("Jobs")');
  await page.waitForSelector('.jobs .office-notice.on');
  await calm();
  await shot(page, 'workspace-office-jobs');

  // Narrow screen.
  await page.setViewportSize({ width: 390, height: 900 });
  await page.click('.tabs [role=tab]:has-text("Jobs")');
  await shot(page, 'workspace-mobile');
  await page.context().close();
}

async function walkTakeaway({ shot }: Walk) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const calm = () => page.waitForFunction(() => !document.querySelector('.toast'), undefined, { timeout: 15000 }).catch(() => {});
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/40[1349]|scout/.test(m.text()) && errors.push(`console: ${m.text()}`));
  const saved = () => page.waitForSelector('.save-state.saved', { timeout: 10000 });
  const next = async (title: string) => {
    await page.click('.step-nav button.primary');
    await page.waitForSelector(`#step-title:has-text("${title}")`);
  };
  const kept = (what: string, ok: boolean) => {
    if (!ok) throw new Error(`after a reload, the builder lost ${what}`);
  };

  // A key from the team, and the takeaway from the preset.
  await page.goto(`${base}/`);
  await page.waitForSelector('#password');
  await page.fill('#password', 'team');
  await page.click('.signin button[type=submit]');
  await page.waitForSelector('#k-name');
  await page.fill('#k-name', 'Dev Shah');
  await page.fill('#k-company', 'Firebird Chicken & Burgers');
  await page.click('button:has-text("Issue a private key")');
  await page.waitForSelector('.issued code');
  const raw = (await page.textContent('.issued code'))!.trim();
  await page.goto(`${base}/demo/reception#key=${raw}`);
  await page.waitForSelector('text=Welcome, Dev.');
  await page.click('text=Build a new demo');
  await page.waitForSelector('.preset');
  await page.click('.preset:has-text("Takeaway and fast food")');
  await page.waitForSelector('#new-name');
  await shot(page, 'pick-preset');
  await page.click('text=Build from the preset');

  // An edit on every step that has one.
  const style = 'input[maxlength="160"][placeholder="Fried chicken, burgers and pizza"]';
  await page.waitForSelector('#step-title:has-text("Basics")');
  await page.fill(style, 'Fried chicken, smash burgers and pizza');
  await saved();
  await shot(page, 'builder-basics');
  await next('Opening hours');
  await shot(page, 'builder-hours');
  await next('Collection and delivery');
  await page.getByLabel('Orders per slot').fill('5');
  await page.getByRole('textbox', { name: 'Drivers' }).fill('Kai, Priya, Tom, Zara');
  await saved();
  await shot(page, 'builder-ordering');
  await next('Menu');
  await shot(page, 'builder-menu');
  await next('Meal deals');
  await page.click('button:has-text("Burger meal")');
  await page.getByLabel('Price', { exact: true }).fill('9.29');
  await saved();
  await shot(page, 'builder-deals');
  await next('Money');
  await page.click('label:has-text("Cash only")');
  await saved();
  await shot(page, 'builder-money');
  await next('Policies and questions');
  await page.getByLabel('Food hygiene rating').selectOption({ label: '4' });
  // Alcohol, off by default: switched on, with the sample drinks and the last sale.
  await page.getByLabel('We sell alcohol with food orders').check();
  await page.waitForSelector('text=Last alcohol sale');
  await saved();
  await page.getByLabel('Last alcohol sale').scrollIntoViewIfNeeded();
  await shot(page, 'builder-policies-alcohol');
  await next('Review and start');
  await shot(page, 'builder-review');

  // Reloaded, every edit is still there.
  await page.reload();
  await page.waitForSelector('#step-title:has-text("Basics")');
  kept('the style', (await page.inputValue(style)) === 'Fried chicken, smash burgers and pizza');
  await next('Opening hours');
  await next('Collection and delivery');
  kept('orders per slot', (await page.getByLabel('Orders per slot').inputValue()) === '5');
  kept('the new driver', (await page.getByRole('textbox', { name: 'Drivers' }).inputValue()).includes('Zara'));
  await next('Menu');
  await next('Meal deals');
  await page.click('button:has-text("Burger meal")');
  kept('the Burger meal price', (await page.getByLabel('Price', { exact: true }).inputValue()) === '9.29');
  await next('Money');
  kept('cash only', await page.locator('label:has-text("Cash only") input').isChecked());
  await next('Policies and questions');
  kept('the hygiene rating', (await page.getByLabel('Food hygiene rating').inputValue()) === '4');
  kept('alcohol switched on', await page.getByLabel('We sell alcohol with food orders').isChecked());
  await next('Review and start');
  await page.click('button:has-text("Start my demo")');

  // The kitchen: today's orders so far, and a ready delivery sent out with a driver.
  await page.waitForSelector('.kitchen.with-out', { timeout: 20000 });
  await page.waitForSelector('.phone');
  await shot(page, 'workspace-kitchen');
  const waiting = page.locator('.k-col[aria-label="Ready"] .ticket', { has: page.locator('button:has-text("Out with Kai")') }).first();
  if (await waiting.count()) {
    await waiting.locator('button:has-text("Out with Kai")').click();
    await page.waitForSelector('.toast:has-text("out with Kai")', { timeout: 10000 });
    await calm();
    await shot(page, 'workspace-kitchen-sent-out');
  }

  // The drivers: who has what, how long since they left, and Delivered.
  await page.click('.tabs [role=tab]:has-text("Drivers")');
  await page.waitForSelector('.drivers');
  if (!(await page.locator('.drivers').textContent())!.includes('Kai')) throw new Error('Kai is not on the Drivers view');
  await shot(page, 'workspace-drivers');
  const out = page.locator('.drivers .ticket', { has: page.locator('button:has-text("Delivered")') }).first();
  if (await out.count()) {
    await out.locator('button:has-text("Delivered")').click();
    await page.waitForSelector('.toast:has-text("delivered")', { timeout: 10000 });
  }

  // A caller's change waiting on a ticket: accepted, and the customer is texted.
  await page.click('.tabs [role=tab]:has-text("Kitchen")');
  const asked = page.locator('.ticket .request', { has: page.locator('button:has-text("Accept")') }).first();
  if (!(await asked.count())) throw new Error('no request waiting on the kitchen board');
  await asked.scrollIntoViewIfNeeded();
  await shot(page, 'workspace-request');
  await asked.locator('button:has-text("Accept")').click();
  await page.waitForSelector('.toast:has-text("accepted")', { timeout: 10000 });
  await calm();

  // Menu tonight: a dish sold out, and delivery paused; then back to business as usual.
  await page.click('.tabs [role=tab]:has-text("Menu tonight")');
  await page.waitForSelector('.tonight');
  await page.locator('.tonight .chip', { hasText: /^Cheeseburger$/ }).click();
  await page.waitForSelector('.toast:has-text("sold out tonight")', { timeout: 10000 });
  await calm();
  await page.click('label:has-text("Delivery is paused tonight") input');
  await page.waitForSelector('.toast:has-text("Delivery paused")', { timeout: 10000 });
  await page.waitForSelector('.tonight .chip.out');
  // With alcohol switched on in the setup, its drinks are on the menu too.
  if (!(await page.locator('.tonight-section[aria-label="Beer and wine"]').count())) throw new Error('the alcohol is not on the menu');
  await shot(page, 'workspace-menu-tonight');
  await calm();
  await page.click('label:has-text("Nothing: business as usual") input');
  await page.waitForSelector('.toast:has-text("No notice")', { timeout: 10000 });
  await calm();

  // Call as Amy, whose delivery is out with Kai.
  await page.getByLabel('Call as').selectOption({ label: 'Amy Clarke, with a delivery out with Kai' });
  await page.waitForSelector('.phone-number:has-text("07700 900801")');
  await calm();
  await shot(page, 'workspace-call-as');

  // Narrow screen.
  await page.setViewportSize({ width: 390, height: 900 });
  await page.click('.tabs [role=tab]:has-text("Kitchen")');
  await shot(page, 'workspace-mobile');
  await page.context().close();
}

async function walkBarber({ shot }: Walk) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const calm = () => page.waitForFunction(() => !document.querySelector('.toast'), undefined, { timeout: 15000 }).catch(() => {});
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/40[1349]|scout/.test(m.text()) && errors.push(`console: ${m.text()}`));
  const saved = () => page.waitForSelector('.save-state.saved', { timeout: 10000 });
  const next = async (title: string) => {
    await page.click('.step-nav button.primary');
    await page.waitForSelector(`#step-title:has-text("${title}")`);
  };
  const kept = (what: string, ok: boolean) => {
    if (!ok) throw new Error(`after a reload, the builder lost ${what}`);
  };

  // A key from the team, and the barber from the preset.
  await page.goto(`${base}/`);
  await page.waitForSelector('#password');
  await page.fill('#password', 'team');
  await page.click('.signin button[type=submit]');
  await page.waitForSelector('#k-name');
  await page.fill('#k-name', 'Marcus Kingsley');
  await page.fill('#k-company', "Kingsley's Barbers");
  await page.click('button:has-text("Issue a private key")');
  await page.waitForSelector('.issued code');
  const raw = (await page.textContent('.issued code'))!.trim();
  await page.goto(`${base}/demo/reception#key=${raw}`);
  await page.waitForSelector('text=Welcome, Marcus.');
  await page.click('text=Build a new demo');
  await page.waitForSelector('.preset');
  await page.click('.preset:has-text("Barber")');
  await page.waitForSelector('#new-name');
  await shot(page, 'pick-preset');
  await page.click('text=Build from the preset');

  // An edit on every step that has one.
  await page.waitForSelector('#step-title:has-text("Basics")');
  await shot(page, 'builder-basics');
  await next('Opening hours');
  await shot(page, 'builder-hours');
  await next('Your barbers');
  await page.locator('.area-card').nth(1).getByRole('textbox', { name: 'Also known as' }).fill('Danny, Big Dan');
  await saved();
  await shot(page, 'builder-team');
  await next('Services and prices');
  await page.locator('.area-card').nth(1).getByLabel('Price', { exact: true }).fill('23');
  await saved();
  await shot(page, 'builder-services');
  await next('Bookings and walk-ins');
  await page.getByLabel('Running late').fill('15');
  await saved();
  await shot(page, 'builder-booking');
  await next('Deposits and cancelling');
  await shot(page, 'builder-money');
  await next('Policies and questions');
  await next('Review and start');
  await shot(page, 'builder-review');

  // Reloaded, every edit is still there.
  await page.reload();
  await page.waitForSelector('#step-title:has-text("Basics")');
  await next('Opening hours');
  await next('Your barbers');
  kept("Dan's nicknames", (await page.locator('.area-card').nth(1).getByRole('textbox', { name: 'Also known as' }).inputValue()).includes('Big Dan'));
  await next('Services and prices');
  kept('the skin fade price', (await page.locator('.area-card').nth(1).getByLabel('Price', { exact: true }).inputValue()) === '23.00');
  await next('Bookings and walk-ins');
  kept('the late grace', (await page.getByLabel('Running late').inputValue()) === '15');
  await next('Deposits and cancelling');
  await next('Policies and questions');
  await next('Review and start');
  await page.click('button:has-text("Start my demo")');

  // The Diary: a column a barber, the week's bookings in their chairs.
  await page.waitForSelector('.diary', { timeout: 20000 });
  for (const name of ['Marcus', 'Dan', 'Jordan']) {
    if (!(await page.locator('.diary').textContent())!.includes(name)) throw new Error(`${name} is not on the Diary`);
  }
  await page.waitForSelector('.phone');
  await calm();
  await shot(page, 'workspace-diary');

  // Call as Ollie, booked inside the notice.
  await page.getByLabel('Call as').selectOption({ label: 'Ollie Price, booked with Dan within the next day' });
  await page.waitForSelector('.phone-number:has-text("07700 900902")');
  await calm();
  await shot(page, 'workspace-call-as');

  // Narrow screen.
  await page.setViewportSize({ width: 390, height: 900 });
  await shot(page, 'workspace-mobile');
  await page.context().close();
}
