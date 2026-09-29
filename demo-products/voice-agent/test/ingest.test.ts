import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicUrl, htmlToText, linksOf, toProfile } from '../src/ingest/ingest.ts';
import { allergenAnswer } from '../src/domain/menu.ts';
import { checkAvailability } from '../src/domain/availability.ts';

test('the wizard will not read private addresses', async () => {
  for (const bad of ['http://localhost:8787/', 'http://127.0.0.1/', 'http://10.0.0.5/', 'http://192.168.1.1/', 'http://169.254.169.254/latest/meta-data', 'ftp://example.com', 'https://example.com:8443/', 'http://printer.local/']) {
    await assert.rejects(assertPublicUrl(bad), bad);
  }
  const u = await assertPublicUrl('93.184.215.14');
  assert.equal(u.protocol, 'https:');
});

test('HTML becomes readable text, without scripts', () => {
  const t = htmlToText('<html><head><style>p{}</style><script>alert(1)</script></head><body><h1>Luigi&#39;s</h1><p>Open 12&ndash;10</p><ul><li>Pizza &pound;9</li></ul></body></html>');
  assert.equal(t, "Luigi's\nOpen 12–10\nPizza £9");
});

test('only useful same-site links are followed', () => {
  const base = new URL('https://luigis.example/');
  const links = linksOf(
    '<a href="/menu">Our menu</a><a href="/blog/2019">Blog</a><a href="https://facebook.com/x">FB</a><a href="/contact-us">Find us</a><a href="/menus/dinner.pdf">Dinner menu (PDF)</a>',
    base,
  ).map((u) => u.pathname);
  assert.deepEqual(links, ['/menu', '/contact-us', '/menus/dinner.pdf']);
});

test('an extraction becomes a usable profile, with the assumptions listed', () => {
  const p = toProfile(
    {
      name: "Luigi's Pizzeria",
      business_type: 'restaurant',
      summary: 'Neapolitan pizza in Sherwood.',
      address: '1 Main St, Nottingham NG5 1AA',
      opening_hours: [
        { day: 'friday', open: '17:00', close: '22:00' },
        { day: 'saturday', open: '17:00', close: '22:00' },
        { day: 'sunday', open: '12:00', close: '20:00' },
      ],
      takes_table_bookings: true,
      takes_food_orders: true,
      offers_delivery: true,
      menu: [{ category: 'Pizza', items: [
        { name: 'Marinara', price_pence: 850, allergens_stated: true, allergens: ['gluten'] },
        { name: 'Special of the day', price_pence: 1200, allergens_stated: false },
      ] }],
      faqs: [{ q: 'Is there parking?', a: 'Free parking behind the shop.' }],
      policies: [{ topic: 'deposits', text: 'Groups of 8 or more pay £5 each.' }],
      core_facts: ['Open Friday to Sunday.'],
      missing_or_unclear: ['phone number'],
    },
    'https://luigis.example/',
  );
  assert.equal(p.slug, 'luigi-s-pizzeria');
  assert.match(p.greeting, /AI assistant, and this is a demo line/);
  assert.deepEqual(p.opening_hours.map((h) => h.days), [[5, 6], [0]]);
  assert.equal(p.booking?.services[0].windows[0].last, '20:30');
  assert.ok(p.review_notes.some((n) => /Table layout is assumed/.test(n)));
  assert.ok(p.review_notes.some((n) => /phone number/.test(n)));
  assert.ok(p.review_notes.some((n) => /1 dishes have no published allergens/.test(n)));
  assert.ok(p.review_notes.some((n) => /Delivery postcodes/.test(n)));
  const special = p.menu!.categories[0].items[1];
  assert.equal(special.allergens_unknown, true);
  assert.match(allergenAnswer(p.menu!, special), /don't have allergen information/);
  assert.equal(p.knowledge.length, 2);
  const r = checkAvailability({ profile: p, date: '2026-10-09', time: '19:00', partySize: 4, now: new Date('2026-10-01T12:00:00Z'), existing: [] });
  assert.equal(r.available, true, 'the drafted profile can take a booking straight away');
});
