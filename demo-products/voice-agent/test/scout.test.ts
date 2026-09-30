// The website scout: reading without a model, then a whole scan of a fake
// restaurant's site served locally, with the model replaced, into the builder.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fontCategory, fontsOf, hoursFromWords, linkScore, parseClock, readPage } from '../src/scout/extract.ts';
import { contrast, hex, readableAccent, themeFrom } from '../src/scout/render.ts';
import { startScan, digest, type ScanResult } from '../src/scout/scan.ts';
import { applyScan, scanView } from '../src/scout/map.ts';
import { openPglite, migrate, type Db } from '../src/db/db.ts';
import { DemoRepo } from '../src/db/demo-repo.ts';
import { loadConfig } from '../src/config.ts';
import { defaultAnswers } from '../src/presets/restaurant/answers.ts';
import { sanitiseRestaurant, validateRestaurant } from '../src/presets/restaurant/validate.ts';
import type { FactsOut, MenuOut } from '../src/scout/model.ts';

const HOME = `<!doctype html><html><head><title>Bella Vista | Italian kitchen, Nottingham</title>
<meta name="description" content="Family Italian kitchen on Mansfield Road.">
<meta property="og:site_name" content="Bella Vista">
<meta name="theme-color" content="#1f5c3a">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Lato&display=swap" rel="stylesheet">
<style>h1{font-family:'Playfair Display',serif;color:#1f5c3a} .btn{background:#c8553d;color:#fff} body{background:#ffffff;color:#333333}</style>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Restaurant","name":"Bella Vista","telephone":"0115 496 0999",
"address":{"@type":"PostalAddress","streetAddress":"212 Mansfield Road","addressLocality":"Nottingham","postalCode":"NG5 2BU"},
"servesCuisine":["Italian","Pizza"],"acceptsReservations":"True","logo":"/logo.png"}]}</script></head>
<body><header><img class="site-logo" src="/logo.png" alt="Bella Vista logo"><nav><a href="/menu">Our menu</a> <a href="/find-us">Find us</a> <a href="/faq">FAQs</a>
<a href="/admin">Admin</a> <a href="https://www.opentable.co.uk/r/bella-vista">Book a table</a> <a href="https://deliveroo.co.uk/menu/nottingham/bella">Deliveroo</a>
<a href="/wp-login.php">Log in</a></nav></header>
<main><h1>Bella Vista</h1><p>Wood-fired pizza and fresh pasta. Sit on our sunny terrace. Dogs are welcome in the bar.</p>
<a class="btn" href="/menu">See the menu</a></main></body></html>`;

const PAGES: Record<string, { type: string; body: string | Buffer; status?: number }> = {
  '/robots.txt': { type: 'text/plain', body: 'User-agent: *\nDisallow: /admin\nSitemap: /sitemap.xml' },
  '/sitemap.xml': { type: 'application/xml', body: '<urlset><url><loc>http://HOST/private-dining</loc></url><url><loc>http://HOST/admin/secret</loc></url><url><loc>http://HOST/blog/2019/01/news</loc></url></urlset>' },
  '/': { type: 'text/html', body: HOME },
  '/menu': { type: 'text/html', body: '<html><body><h2>Pizza</h2><p>Margherita £10.50. Diavola £12.50. Quattro Formaggi £13.00. Marinara £9.00.</p><h2>Pasta</h2><p>Carbonara £12.00. Arrabbiata £10.00.</p></body></html>' },
  '/find-us': { type: 'text/html', body: '<html><body><p>212 Mansfield Road, Nottingham NG5 2BU. Tel 0115 496 0999.</p><p>Opening hours: Tuesday to Saturday 5pm to 10pm. Sunday 12pm to 8pm. Closed Mondays.</p><p>Free parking on Hucknall Road after 6pm.</p></body></html>' },
  '/faq': { type: 'text/html', body: '<html><body><h3>Can I bring my dog?</h3><p>Dogs are welcome in the bar area.</p><h3>Do you do gluten free?</h3><p>Yes, gluten-free pizza bases.</p></body></html>' },
  '/private-dining': { type: 'text/html', body: '<html><body><p>Our private room seats 20 for parties and events.</p></body></html>' },
  '/admin': { type: 'text/html', body: '<html><body>SECRET-ADMIN-PAGE</body></html>' },
  '/admin/secret': { type: 'text/html', body: '<html><body>SECRET-ADMIN-PAGE</body></html>' },
  // A 1x1 PNG.
  '/logo.png': { type: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') },
};

let server: Server;
let origin: string;
let db: Db;
let demo: DemoRepo;
let dir: string;
const hits: string[] = [];

before(async () => {
  server = createServer((req, res) => {
    hits.push(req.url ?? '');
    const p = PAGES[(req.url ?? '/').split('?')[0]];
    if (!p) {
      res.writeHead(404, { 'content-type': 'text/html' });
      return res.end('not found');
    }
    res.writeHead(p.status ?? 200, { 'content-type': p.type });
    res.end(typeof p.body === 'string' ? p.body.replace(/HOST/g, `localhost:${(server.address() as { port: number }).port}`) : p.body);
  });
  await new Promise<void>((r) => server.listen(0, r));
  origin = `http://localhost:${(server.address() as { port: number }).port}`;
  dir = mkdtempSync(join(tmpdir(), 'va-scout-'));
  db = await openPglite(dir);
  await migrate(db);
  demo = new DemoRepo(db);
});

after(async () => {
  server.close();
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

test('scout: structured data, meta, links, providers and signals from one page', () => {
  const s = readPage(HOME, 'https://bellavista.example/');
  assert.equal(s.business.name, 'Bella Vista');
  assert.equal(s.business.telephone, '0115 496 0999');
  assert.equal(s.business.postcode, 'NG5 2BU');
  assert.equal(s.business.town, 'Nottingham');
  assert.equal(s.business.reservations, true);
  assert.equal(s.business.logo, 'https://bellavista.example/logo.png');
  assert.deepEqual(s.business.cuisine, ['Italian', 'Pizza']);
  assert.equal(s.theme_color, '#1f5c3a');
  assert.equal(s.site_name, 'Bella Vista');
  assert.deepEqual(s.providers.sort(), ['Deliveroo', 'OpenTable']);
  for (const x of ['terrace', 'dog friendly', 'reservations']) assert.ok(s.signals.includes(x), x);
  assert.deepEqual(s.fonts.slice(0, 2), ['Playfair Display', 'Lato']);
  assert.ok(s.colours['#1f5c3a'] && s.colours['#c8553d']);
  assert.equal(s.colours['#333333'], undefined, 'greys are not brand colours');
  assert.ok(s.logo_candidates.includes('https://bellavista.example/logo.png'));
});

test('scout: opening hours in the ways sites write them', () => {
  const a = hoursFromWords('Opening hours: Tuesday to Saturday 5pm to 10pm. Sunday 12pm to 8pm. Closed Mondays.')!;
  assert.equal(a[1].open, false);
  assert.deepEqual(a[2].services, [{ label: 'Dinner', open: '17:00', close: '22:00' }]);
  assert.deepEqual(a[6].services, [{ label: 'Dinner', open: '17:00', close: '22:00' }]);
  assert.deepEqual(a[0].services, [{ label: 'All day', open: '12:00', close: '20:00' }]);
  const b = hoursFromWords('Mon–Fri: 12:00–14:30, 17:30–22:00\nSat 12 noon - 11pm')!;
  assert.deepEqual(b[3].services.map((s) => `${s.label} ${s.open}-${s.close}`), ['Lunch 12:00-14:30', 'Dinner 17:30-22:00']);
  assert.deepEqual(b[6].services.map((s) => `${s.open}-${s.close}`), ['12:00-23:00']);
  assert.equal(b[0].open, false);
  const c = hoursFromWords('Wednesday - Sunday 5 - 10')!;
  assert.deepEqual(c[3].services.map((s) => `${s.open}-${s.close}`), ['17:00-22:00'], '"5 - 10" is an evening');
  assert.equal(hoursFromWords('Established in 1998. Call 0115 496 0999.'), null);
  assert.equal(parseClock('5.30pm'), '17:30');
  assert.equal(parseClock('noon'), '12:00');
  assert.equal(parseClock('12am'), '00:00');
  assert.equal(parseClock('25:00'), null);
});

test('scout: which links are worth a read, and fonts and colours into a readable theme', () => {
  const o = 'https://x.example';
  assert.ok(linkScore(`${o}/menu`, 'Our menu', o) > linkScore(`${o}/about`, 'About', o));
  assert.equal(linkScore(`${o}/wp-login.php`, 'Log in', o), 0);
  assert.equal(linkScore('https://other.example/menu', 'Menu', o), 0);
  assert.equal(linkScore(`${o}/basket`, 'Basket', o), 0);
  assert.equal(fontCategory('Playfair Display'), 'serif');
  assert.equal(fontCategory('Lato'), 'sans');
  assert.equal(fontCategory('Bebas Neue'), 'display');
  assert.deepEqual(fontsOf('<style>body{font-family:-apple-system, "Segoe UI"} h1{font-family: "Canela", serif}</style>'), ['Canela']);
  assert.equal(hex('rgb(31, 92, 58)'), '#1f5c3a');
  assert.equal(hex('rgba(0, 0, 0, 0)'), null);
  // A dark brand green becomes an accent dark text can sit on.
  const acc = readableAccent('#1f5c3a');
  assert.ok(contrast(acc, '#14110e') >= 4.5, `${acc} is readable`);
  const t = themeFrom(null, { theme_color: '#1f5c3a', colours: { '#c8553d': 3 }, fonts: ['Playfair Display', 'Lato'] })!;
  assert.equal(t.font_heading, 'Playfair Display');
  assert.equal(t.font_body, 'Lato');
  assert.ok(contrast(t.accent, '#14110e') >= 4.5);
});

const FACTS: FactsOut = {
  is_hospitality: true, name: 'Bella Vista', style: 'Wood-fired pizza and fresh pasta', summary: 'A family Italian kitchen in Nottingham.',
  town: 'Nottingham', address: '212 Mansfield Road, Nottingham NG5 2BU', phone: '0115 496 0999', hours: [], takes_reservations: true, takeaway: true, own_delivery: false,
  policies: { children: '', dogs: 'inside', accessibility: '', parking: 'Free parking on Hucknall Road after 6pm.', dress_code: '', corkage: '', cakes: '', vouchers: '', dietary: 'Gluten-free pizza bases.' },
  faqs: [{ q: 'Can I bring my dog?', a: 'Dogs are welcome in the bar area.' }],
};
const MENU: MenuOut = {
  categories: [
    { label: 'Pizza', items: [
      { name: 'Margherita', description: '', price_pence: 1050, allergens_stated: false, allergens: [], dietary: ['vegetarian'] },
      { name: 'Diavola', description: '', price_pence: 1250, allergens_stated: true, allergens: ['gluten', 'milk'], dietary: [] },
    ] },
    { label: 'Pasta', items: [{ name: 'Carbonara', description: '', price_pence: 1200, allergens_stated: false, allergens: [], dietary: [] }] },
  ],
  allergen_statement: '',
};

test('scout: a whole site, politely, into the builder', async () => {
  let digestSeen = '';
  let menuFrom = '';
  const deps = {
    demo, config: loadConfig(), allowPrivate: true, paceMs: 0,
    model: {
      facts: async (d: string) => ((digestSeen = d), FACTS),
      menu: async (s: { url: string }) => ((menuFrom = s.url), MENU),
    },
  };
  const id = await startScan(deps, `${origin}/`, null);
  let scan = await demo.getScan(id);
  for (let i = 0; i < 200 && scan?.status === 'running'; i++) {
    await new Promise((r) => setTimeout(r, 100));
    scan = await demo.getScan(id);
  }
  assert.equal(scan?.status, 'done', scan?.error ?? '');
  const r = scan!.result as ScanResult;

  // Politeness: robots.txt was read, and nothing it disallows was fetched.
  assert.ok(hits.includes('/robots.txt'));
  assert.ok(!hits.some((h) => h.startsWith('/admin')), `fetched ${hits.join(', ')}`);
  assert.ok(!hits.includes('/wp-login.php'));
  assert.ok(hits.includes('/private-dining'), 'the sitemap adds pages worth reading');
  assert.ok(r.pages.length >= 4 && r.pages.length <= 13);

  assert.equal(r.identity.name, 'Bella Vista');
  assert.equal(r.identity.phone, '0115 496 0999');
  assert.equal(r.identity.address, '212 Mansfield Road, NG5 2BU');
  assert.match(r.identity.logo ?? '', /^data:image\/png;base64,/);
  assert.equal(r.hours?.[1].open, false, 'closed Mondays, from the find-us page');
  assert.equal(r.hours?.[5].services[0].open, '17:00');
  assert.equal(menuFrom, `${origin}/menu`, 'the page with the prices is the menu');
  assert.equal(r.menu?.dishes, 3);
  assert.equal(r.services.reservations, true);
  assert.deepEqual(r.services.delivery_apps, ['Deliveroo']);
  assert.ok(r.services.providers.includes('OpenTable'));
  assert.equal(r.policies.dogs, 'inside');
  assert.ok(r.theme && contrast(r.theme.accent, '#14110e') >= 4.5);
  assert.ok(digestSeen.length < 16500 && digestSeen.includes('Hucknall Road'), 'the digest carries the useful sentences');
  assert.ok(!digestSeen.includes('SECRET'));

  // What the builder's card shows.
  const view = scanView(scan!, null);
  assert.equal(view.found?.identity.name, 'Bella Vista');
  assert.match(view.found!.hours!.sentence, /Closed Mondays/);
  assert.ok(view.found!.services.some((s) => /OpenTable/.test(s)));
  assert.ok(view.found!.services.includes('outdoor seating'));

  // Applied: only what was ticked, every field marked, and still a valid restaurant.
  const base = defaultAnswers();
  base.basics.name = 'Prospect Ltd';
  const applied = sanitiseRestaurant(applyScan(base, r, { identity: true, hours: true, menu: true, theme: false, services: true, policies: true }));
  assert.equal(applied.basics.name, 'Bella Vista');
  assert.equal(applied.sources['basics.name'], 'website');
  assert.equal(applied.sources['basics.style'], 'guess');
  assert.equal(applied.theme.accent, base.theme.accent, 'the theme was not ticked');
  assert.equal(applied.menu.source, 'website');
  assert.equal(applied.menu.categories[0].items[0].allergens_unknown, true, 'allergens the site does not state stay unknown');
  assert.deepEqual(applied.menu.categories[0].items[1].allergens, ['gluten', 'milk']);
  assert.deepEqual(applied.serve.delivery_apps, ['Deliveroo']);
  assert.equal(applied.policies.parking, 'Free parking on Hucknall Road after 6pm.');
  assert.equal(applied.policies.faqs.length, 1);
  assert.deepEqual(validateRestaurant(applied).filter((i) => i.level === 'error'), []);

  // A second scan of the same site within the fortnight reuses the first.
  const before = hits.length;
  assert.equal(await startScan(deps, `${origin}/`, null), id);
  assert.equal(hits.length, before);
});

test('scout: refuses private addresses, and a site behind a bot wall says so', async () => {
  await assert.rejects(startScan({ demo, config: loadConfig() }, 'http://127.0.0.1/', null), /Not a public website/);
  await assert.rejects(startScan({ demo, config: loadConfig() }, 'http://169.254.169.254/latest/meta-data', null), /Not a public website/);
  await assert.rejects(startScan({ demo, config: loadConfig() }, 'http://example.com:8080/', null), /Only ordinary/);
  await assert.rejects(startScan({ demo, config: loadConfig() }, 'file:///etc/passwd', null), /Only ordinary http|Not a public|not a web address/i);
  PAGES['/walled'] = { type: 'text/html', body: '<html><body>Access denied</body></html>', status: 403 };
  const deps = { demo, config: loadConfig(), allowPrivate: true, paceMs: 0, model: { facts: async () => FACTS, menu: async () => MENU } };
  // A different "site" (host) so the cache does not answer: 127.0.0.1 instead of localhost.
  const id = await startScan(deps, `${origin.replace('localhost', '127.0.0.1')}/walled`, null);
  let scan = await demo.getScan(id);
  for (let i = 0; i < 100 && scan?.status === 'running'; i++) {
    await new Promise((r) => setTimeout(r, 100));
    scan = await demo.getScan(id);
  }
  assert.equal(scan?.status, 'failed');
  assert.match(scan!.error ?? '', /bot protection/);
  assert.ok(digest([{ url: 'x', text: 'a'.repeat(100000), signals: readPage('', 'https://x.example') }]).length <= 16000);
});
