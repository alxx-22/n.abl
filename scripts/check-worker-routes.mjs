/* What the Worker does with a request that is not an API call.

   This exists because of a live outage. Adding worker/index.ts for the public
   assistant put a script in front of the site, and Workers Static Assets only
   applies not_found_handling when nothing else claims the request. Real files
   still matched, so the marketing pages and the prerendered legal routes were
   fine and nothing looked wrong. Every client-side route — /crm, /portal,
   /team — reached the script instead, which answered "Not found" with a 404.
   The CRM, the client portal and the team space were off the internet.

   vite preview cannot catch that: it serves dist directly and never runs the
   Worker. So this boots the real thing with `wrangler dev --local` and asks
   it the questions that were wrong.

   Usage: node scripts/check-worker-routes.mjs
*/

import { spawn } from 'node:child_process'

const PORT = 8791
const BASE = `http://localhost:${PORT}`

let pass = 0
let fail = 0
function check(label, ok, detail = '') {
  if (ok) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

const dev = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--local'], {
  stdio: ['ignore', 'pipe', 'pipe'],
})
let log = ''
dev.stdout.on('data', (d) => { log += d })
dev.stderr.on('data', (d) => { log += d })

/* Browsers send Sec-Fetch-Mode: navigate on a top-level navigation, and that
   is what not_found_handling keys on. A bare fetch is not the case that
   broke. */
const nav = (path) => fetch(`${BASE}${path}`, {
  redirect: 'follow',
  headers: { 'Sec-Fetch-Mode': 'navigate', accept: 'text/html' },
  signal: AbortSignal.timeout(10_000),
})

async function ready() {
  for (let i = 0; i < 40; i++) {
    try {
      await fetch(`${BASE}/`, {
        headers: { 'Sec-Fetch-Mode': 'navigate' },
        signal: AbortSignal.timeout(3_000),
      })
      return true
    } catch { /* not listening yet */ }
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}

try {
  console.log('\nWORKER ROUTING (wrangler dev --local)\n')
  if (!await ready()) {
    console.error('wrangler dev never came up:\n' + log.slice(-1500))
    process.exit(2)
  }

  for (const path of ['/crm', '/portal', '/team', '/privacy', '/terms', '/cookies', '/']) {
    const res = await nav(path)
    const html = await res.text()
    check(`${path} is served, not 404ed by the Worker`, res.status === 200, `got ${res.status}`)
    /* 200 is not enough on its own — a 200 carrying the Worker's own text
       would pass that and still be a broken page. */
    check(`${path} returns the app shell`, /<div id="root">/.test(html))
  }

  /* A route React Router does not know about still gets the shell; the app
     renders its own 404 inside it. That is the SPA contract. */
  const missing = await nav('/definitely-not-a-page')
  check('an unknown route also gets the shell for the app to handle',
    missing.status === 200 && /<div id="root">/.test(await missing.text()))

  /* The other half: an unknown API path must stay an error. Handing it the
     shell would turn a broken fetch into a page of HTML the caller then tries
     to parse as JSON. */
  const badApi = await fetch(`${BASE}/api/not-a-thing`, { signal: AbortSignal.timeout(10_000) })
  check('an unknown /api path is a 404, not the shell', badApi.status === 404,
    `got ${badApi.status}`)

  const wrongMethod = await fetch(`${BASE}/api/chat/public`, { signal: AbortSignal.timeout(10_000) })
  check('the assistant endpoint rejects GET', wrongMethod.status === 405,
    `got ${wrongMethod.status}`)
} finally {
  dev.kill()
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
