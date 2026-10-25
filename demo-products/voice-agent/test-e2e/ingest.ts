// The setup wizard against a fake restaurant website served locally, with the
// real text model doing the extraction. No real business's site is read.
//
//   npm run e2e:ingest

import { createServer } from 'node:http';
import { loadConfig } from '../src/config.ts';
import { ingestWebsite } from '../src/ingest/ingest.ts';

const PAGES: Record<string, string> = {
  '/robots.txt': 'User-agent: *\nDisallow: /admin',
  '/': `<html><body><h1>Bella Vista</h1><p>Family Italian kitchen on Mansfield Road, Nottingham. Book a table or order a takeaway.</p>
    <nav><a href="/menu">Menu</a> <a href="/find-us">Find us</a> <a href="/faq">FAQs</a> <a href="/admin">Admin</a></nav></body></html>`,
  '/menu': `<html><body><h2>Pizza</h2><ul>
    <li>Margherita £10.50 (contains: gluten, milk)</li><li>Quattro Formaggi £13.00 (contains: gluten, milk)</li><li>Chef's special £14.00</li></ul>
    <h2>Desserts</h2><ul><li>Tiramisu £6.00 (contains: gluten, eggs, milk; may contain nuts)</li></ul>
    <p>Takeaway for collection or delivery within 3 miles.</p></body></html>`,
  '/find-us': `<html><body><p>212 Mansfield Road, Nottingham NG5 2BU. Tel 0115 496 0999.</p>
    <p>Opening hours: Tuesday to Saturday 5pm to 10pm. Sunday 12pm to 8pm. Closed Mondays.</p></body></html>`,
  '/faq': `<html><body><h3>Can I bring my dog?</h3><p>Dogs are welcome in the front room.</p>
    <h3>Is there parking?</h3><p>Free parking on Hucknall Road after 6pm.</p>
    <h3>Do you take deposits?</h3><p>Groups of 10 or more pay a £10 per person deposit.</p></body></html>`,
  '/admin': '<html><body>SECRET-ADMIN-PAGE</body></html>',
};

const server = createServer((req, res) => {
  const page = PAGES[req.url ?? '/'];
  res.writeHead(page ? 200 : 404, { 'content-type': req.url === '/robots.txt' ? 'text/plain' : 'text/html' });
  res.end(page ?? 'not found');
});
await new Promise<void>((r) => server.listen(0, r));
const port = (server.address() as { port: number }).port;
try {
  const p = await ingestWebsite(`http://localhost:${port}/`, loadConfig(), { allowPrivate: true });
  console.log(JSON.stringify({ name: p.name, type: p.business_type, address: p.address, hours: p.opening_hours, pages: p.pages }, null, 1));
  console.log('menu:', p.menu?.categories.map((c) => `${c.label}: ${c.items.map((i) => `${i.name} ${i.price_pence}p${i.allergens_unknown ? ' (allergens unknown)' : ` [${i.allergens.join(', ')}]`}`).join('; ')}`));
  console.log('knowledge:', p.knowledge.map((k) => k.q));
  console.log('review notes:', p.review_notes);
  const ok = p.name.includes('Bella') && p.menu?.categories.some((c) => c.items.some((i) => i.price_pence === 1050)) && !p.pages.some((u) => u.includes('/admin'));
  console.log(ok ? '\nOK' : '\nUNEXPECTED');
  process.exitCode = ok ? 0 : 1;
} finally {
  server.close();
}
