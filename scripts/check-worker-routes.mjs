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
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'

const PORT = 8791
const BASE = `http://localhost:${PORT}`

/* A stand-in for the demo server (demo-products/voice-agent), so the /demo
   forwarding can be checked without it: it echoes what it received, answers
   /demo with a redirect, and speaks just enough WebSocket to echo a frame. */
const DEMO_PORT = 8792
const seenByDemo = []
const demo = createServer((req, res) => {
  let body = ''
  req.on('data', (c) => { body += c })
  req.on('end', () => {
    seenByDemo.push({ method: req.method, url: req.url, headers: req.headers, body })
    if (req.url === '/demo') { res.writeHead(302, { location: '/demo/' }); return res.end() }
    res.writeHead(200, { 'content-type': 'application/json', 'x-robots-tag': 'noindex, nofollow', 'permissions-policy': 'microphone=(self)' })
    res.end(JSON.stringify({ stub: 'demo', method: req.method, url: req.url, body }))
  })
})
demo.on('upgrade', (req, socket) => {
  const accept = createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`)
  socket.on('data', (buf) => {
    // One short masked text frame in; the same text back, unmasked.
    const len = buf[1] & 0x7f
    const mask = buf.subarray(2, 6)
    const text = Buffer.from(buf.subarray(6, 6 + len).map((b, i) => b ^ mask[i % 4]))
    socket.write(Buffer.concat([Buffer.from([0x81, text.length]), text]))
  })
})
await new Promise((r) => demo.listen(DEMO_PORT, r))

let pass = 0
let fail = 0
function check(label, ok, detail = '') {
  if (ok) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

const dev = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--local',
  '--var', `DEMO_ORIGIN:http://localhost:${DEMO_PORT}`, '--var', 'DEMO_PROXY_SECRET:route-check-secret'], {
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

  /* The private demos: /demo/* belongs to the demo server, not the site. A
     navigation must reach it rather than the SPA shell, its own headers must
     come back (the microphone is allowed there and nowhere else), and the
     call's WebSocket must pass through. */
  console.log('\nDEMO FORWARDING\n')
  const page = await nav('/demo/reception/live/abc?x=1')
  const pageBody = await page.text()
  check('/demo/reception is forwarded, not given the site shell', page.status === 200 && pageBody.includes('"stub":"demo"') && !/<div id="root">/.test(pageBody),
    `got ${page.status}: ${pageBody.slice(0, 80)}`)
  check('the path and query arrive unchanged', pageBody.includes('/demo/reception/live/abc?x=1'))
  check('the demo server\'s own headers come back', page.headers.get('permissions-policy') === 'microphone=(self)' && page.headers.get('x-robots-tag') === 'noindex, nofollow',
    `permissions-policy ${page.headers.get('permissions-policy')}`)
  const last = seenByDemo.at(-1)
  check('the demo server is told the site\'s host', last?.headers['x-forwarded-host'] === `localhost:${PORT}`, `got ${last?.headers['x-forwarded-host']}`)
  check('the proxy secret travels with the visitor address', last?.headers['x-nabl-proxy'] === 'route-check-secret')

  const spoofed = await fetch(`${BASE}/demo/api/me`, { headers: { 'x-nabl-proxy': 'guess', 'x-nabl-client-ip': '203.0.113.9' }, signal: AbortSignal.timeout(10_000) })
  await spoofed.text()
  check('a visitor cannot supply their own proxy secret', seenByDemo.at(-1)?.headers['x-nabl-proxy'] === 'route-check-secret')

  const post = await fetch(`${BASE}/demo/api/session`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"key":"DEMO-TEST"}', signal: AbortSignal.timeout(10_000) })
  check('a POST and its body are forwarded', (await post.text()).includes('DEMO-TEST'))

  const bare = await fetch(`${BASE}/demo`, { redirect: 'manual', signal: AbortSignal.timeout(10_000) })
  check('/demo\'s redirect comes back to the browser as it is', bare.status === 302 && bare.headers.get('location') === '/demo/', `got ${bare.status} ${bare.headers.get('location')}`)

  const echoed = await new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/demo/ws/talk?workspace=x`)
    const t = setTimeout(() => resolve('timeout'), 8000)
    ws.onopen = () => ws.send('hello demo')
    ws.onmessage = (m) => { clearTimeout(t); resolve(String(m.data)); ws.close() }
    ws.onerror = () => { clearTimeout(t); resolve('error') }
  })
  check('the call\'s WebSocket passes through', echoed === 'hello demo', `got ${echoed}`)

  const outside = await nav('/demonstration')
  check('/demonstration is still the site (only /demo and /demo/* are forwarded)', /<div id="root">/.test(await outside.text()))
} finally {
  dev.kill()
  demo.close()
}

console.log(`\n  ${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
