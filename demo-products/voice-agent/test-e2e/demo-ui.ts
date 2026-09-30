// The prospect's journey through a real browser, without calling a model:
// a key from the team, the one-click link, a restaurant from the preset, the
// builder's steps, Start, then the back office (floor plan, moving a booking,
// the timeline, the kitchen's ready text, the phone). Fails on any page error.
//
//   npm run e2e:demo            (builds the app first: npm run build)
//
// Writes screenshots to eval-results/demo-ui/.

import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { loadConfig } from '../src/config.ts';
import { startServer } from '../src/server/main.ts';
import { generateKey, hashKey, normaliseKey, prefixOf } from '../src/demo/access.ts';

const OUT = 'eval-results/demo-ui';
mkdirSync(OUT, { recursive: true });
const dir = join(tmpdir(), `va-demo-ui-${Date.now()}`);
const app = await startServer({ ...loadConfig(), port: 0, pgliteDir: dir, databaseUrl: undefined, consolePassword: 'team', sessionSecret: 'demo-ui' }, { web: 'dist' });
const base = `http://localhost:${app.port}`;
const raw = generateKey();
const n = normaliseKey(raw)!;
await app.demo.createKey({ hash: hashKey(n), prefix: prefixOf(n), person_name: 'Sam Price', company: 'Olive & Ember', expires_at: new Date(Date.now() + 7 * 86400000) });

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const errors: string[] = [];
let step = 0;
const shot = async (page: Page, name: string) => page.screenshot({ path: join(OUT, `${String(++step).padStart(2, '0')}-${name}.png`), fullPage: true });
let failed = false;

try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/40[14]|scout/.test(m.text()) && errors.push(`console: ${m.text()}`));

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

  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`demo UI: all steps passed. Screenshots in ${OUT}/`);
} catch (err) {
  failed = true;
  console.error(`demo UI failed at step ${step}: ${(err as Error).message}`);
  if (errors.length) console.error(errors.join('\n'));
} finally {
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
