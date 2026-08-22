/* Check a deployed site is actually serving what the repo says it should.

   Written for the move to Cloudflare, where the risk is not that the site
   fails to load — it is that it loads perfectly while quietly serving no
   security headers, or 404ing every deep link on refresh. Both look fine on
   the home page.

   Runs against any origin, so the same check covers the workers.dev URL
   before DNS and the live domain after it.

     node scripts/verify-deploy.mjs https://n-abl.someone.workers.dev
     node scripts/verify-deploy.mjs https://nabl.agency
*/

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ORIGIN = (process.argv[2] || '').replace(/\/$/, '')
if (!ORIGIN) { console.error('\n  Usage: node scripts/verify-deploy.mjs <origin>\n'); process.exit(2) }

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0, fail = 0
const ok = (n) => { pass++; console.log(`  ✓ ${n}`) }
const bad = (n, d = '') => { fail++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`) }

/* Called rather than written as a leading regex literal. `const x = ...` on
   one line followed by `/pattern/.test(x)` on the next parses as division —
   the same ASI trap that has now bitten twice in this repo. */
const has = (pattern, text) => new RegExp(pattern).test(String(text || ''))

const get = async (path, opts = {}) => {
  const res = await fetch(ORIGIN + path, { redirect: 'follow', ...opts })
  return { status: res.status, headers: res.headers, body: opts.head ? '' : await res.text(), url: res.url }
}

console.log(`\n  ${ORIGIN}\n`)

/* ---- routes ---- */
console.log('ROUTES')
for (const path of ['/', '/privacy', '/terms', '/cookies', '/crm', '/portal', '/team']) {
  const r = await get(path)
  r.status === 200 ? ok(`${path} returns 200`) : bad(`${path} returns 200`, `got ${r.status}`)
}

/* A deep link on a client-side route must return the shell, not a 404 page.
   This is the thing that breaks when not_found_handling is wrong, and it
   cannot be seen from the home page. */
const deep = await get('/crm/some/deep/path')
deep.status === 200 && has('<div id="root">', deep.body)
  ? ok('an unknown deep path still returns the app shell, not a 404')
  : bad('deep link returns the app shell', `status ${deep.status}`)

/* ---- headers ---- */
console.log('\nSECURITY HEADERS')
const headersFile = readFileSync(join(ROOT, 'public', '_headers'), 'utf8')
const expected = new Map()
let section = null
for (const raw of headersFile.split('\n')) {
  if (!raw.trim() || raw.trim().startsWith('#')) continue
  if (!/^\s/.test(raw)) { section = raw.trim(); continue }
  if (section !== '/*') continue
  const i = raw.indexOf(':')
  expected.set(raw.slice(0, i).trim().toLowerCase(), raw.slice(i + 1).trim())
}

const home = await get('/')
for (const [key, want] of expected) {
  const got = home.headers.get(key)
  if (!got) bad(`${key} is served`, 'absent')
  else if (got.replace(/\s+/g, ' ') !== want.replace(/\s+/g, ' ')) {
    bad(`${key} matches _headers`, `got "${got.slice(0, 60)}…"`)
  } else ok(`${key} is served and matches _headers`)
}

/* ---- caching ---- */
console.log('\nCACHING')
const indexCache = home.headers.get('cache-control') || ''
has('no-cache', indexCache)
  ? ok('index.html is not cached, so a deploy is picked up immediately')
  : bad('index.html is no-cache', `got "${indexCache}"`)

const assetPath = (home.body.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/) || [])[0]
if (!assetPath) bad('found a hashed asset to check', 'none referenced in index.html')
else {
  const asset = await get(assetPath)
  has('immutable', asset.headers.get('cache-control'))
    ? ok('hashed assets are immutable')
    : bad('hashed assets are immutable', `got "${asset.headers.get('cache-control')}"`)
}

/* ---- is this actually the current build? ---- */
console.log('\nCONTENT')
const crmChunk = (home.body.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/) || [])[0]
const indexJs = crmChunk ? (await get(crmChunk)).body : ''
const crmName = (indexJs.match(/Crm-[A-Za-z0-9_-]+\.js/) || [])[0]
if (!crmName) bad('located the CRM chunk', 'not referenced from the entry bundle')
else {
  const crm = await get(`/assets/${crmName}`)
  has('crm-ribbon', crm.body)
    ? ok('the CRM is the ribbon layout, not the old single-page scroll')
    : bad('the CRM is the ribbon layout', 'crm-ribbon absent — this is a stale build')
  has('crm-insights', crm.body)
    ? ok('and carries the rebuilt insights view')
    : bad('carries the rebuilt insights view')
}

/* Follow the lazy chunk, not the route. /privacy returns the SPA shell and
   the notice text lives in Legal-*.js, so checking the route's HTML for the
   wording tested a document that never contains it — a pass that could not
   fail, on the exact check meant to prove the deploy is current. */
const legalName = (indexJs.match(/Legal-[A-Za-z0-9_-]+\.js/) || [])[0]
if (!legalName) bad('located the legal chunk', 'not referenced from the entry bundle')
else {
  const legal = await get(`/assets/${legalName}`)
  has('Food Standards Agency', legal.body)
    ? ok('the privacy notice is the rewritten one')
    : bad('the privacy notice is the rewritten one', 'this is a stale build')
  !has('we do not scrape at volume', legal.body)
    ? ok('and no longer claims we do not scrape at volume')
    : bad('no longer claims we do not scrape at volume', 'superseded line still served')
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
