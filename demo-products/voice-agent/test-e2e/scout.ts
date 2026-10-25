// The website scout against a real site, with the real model: what a
// prospect would see after typing their address.
//
//   npm run e2e:scout -- https://www.example-restaurant.co.uk
//
// Reads a handful of public pages once (robots.txt respected) and makes two
// small model calls on the scout key. Writes the result to eval-results/scout/.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.ts';
import { migrate, openPglite } from '../src/db/db.ts';
import { DemoRepo } from '../src/db/demo-repo.ts';
import { startScan } from '../src/scout/scan.ts';
import { scanView } from '../src/scout/map.ts';

const url = process.argv[2];
if (!url) {
  console.error('Which website?  npm run e2e:scout -- https://www.example.co.uk');
  process.exit(1);
}
const dir = join(tmpdir(), `va-scout-e2e-${Date.now()}`);
const db = await openPglite(dir);
await migrate(db);
const demo = new DemoRepo(db);
const t = Date.now();
try {
  const id = await startScan({ demo, config: loadConfig() }, url, null);
  let scan = await demo.getScan(id);
  let last = '';
  while (scan?.status === 'running') {
    await new Promise((r) => setTimeout(r, 500));
    scan = await demo.getScan(id);
    const v = scanView(scan!, (await import('../src/scout/scan.ts')).scanProgress(id));
    if (v.stage !== last) console.log(`${((Date.now() - t) / 1000).toFixed(1)}s  ${(last = v.stage)}`);
  }
  const view = scanView(scan!, null);
  mkdirSync('eval-results/scout', { recursive: true });
  const out = join('eval-results/scout', `${new URL(/^https?:/.test(url) ? url : `https://${url}`).host}.json`);
  writeFileSync(out, JSON.stringify({ view, result: scan!.result }, null, 2));
  console.log(`\n${scan!.status} in ${((Date.now() - t) / 1000).toFixed(1)}s${scan!.error ? `: ${scan!.error}` : ''}`);
  console.log(JSON.stringify({ ...view, found: view.found ? { ...view.found, identity: { ...view.found.identity, logo: view.found.identity.logo ? `${view.found.identity.logo.slice(0, 30)}…` : null } } : null }, null, 2));
  console.log(`\nFull result: ${out}`);
} finally {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
}
