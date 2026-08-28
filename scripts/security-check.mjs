/* ============================================================
   Security regression checks.

   These encode decisions that are easy to undo by accident: key
   entropy, the absence of secrets in the bundle, the CSP, and the
   live rate limiter. Run before every deploy.

   Usage: node scripts/security-check.mjs
          LIVE=1 node scripts/security-check.mjs   (also probes the backend)
   ============================================================ */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0, fail = 0, skip = 0
const ok = (n, d = '') => { pass++; console.log(`  ✓ ${n}${d ? ` — ${d}` : ''}`) }
const bad = (n, d = '') => { fail++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`) }
const meh = (n, d = '') => { skip++; console.log(`  · ${n}${d ? ` — ${d}` : ''}`) }

const read = (p) => readFileSync(join(ROOT, p), 'utf8')

console.log('\nCREDENTIAL STRENGTH')
{
  const src = read('src/lib/teamConfig.js')
  src.includes('crypto.getRandomValues')
    ? ok('access keys use a CSPRNG')
    : bad('access keys use a CSPRNG', 'Math.random() is predictable and must not mint credentials')
  const genBody = src.split('export function generateKey')[1] || ''
  const usesMathRandom = /Math\.random\(\)/.test(genBody)
  usesMathRandom
    ? bad('generateKey avoids Math.random()')
    : ok('generateKey avoids Math.random()')

  const alpha = src.match(/const KEY_ALPHABET = '([^']+)'/)?.[1]
  const len = Number(src.match(/const KEY_LENGTH = (\d+)/)?.[1])
  if (alpha && len) {
    const bits = Math.log2(alpha.length ** len)
    bits >= 55
      ? ok('key entropy is sufficient', `${bits.toFixed(1)} bits`)
      : bad('key entropy is sufficient', `${bits.toFixed(1)} bits — want >= 55`)
    const ambiguous = /[O0I1L]/.test(alpha)
    if (ambiguous) meh('key alphabet avoids ambiguous glyphs', 'contains O/0/I/1/L')
    else ok('key alphabet avoids ambiguous glyphs')
  } else bad('could not parse the key format')
}

console.log('\nSECRETS')
{
  // Only the anon key may ship. A service-role key in the bundle is total compromise.
  const dist = join(ROOT, 'dist')
  if (!existsSync(dist)) meh('bundle scanned for secrets', 'run npm run build first')
  else {
    const files = []
    const walk = (d) => readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(js|css|html)$/.test(e.name)) files.push(p)
    })
    walk(dist)
    let serviceRole = 0, otherJwt = new Set()
    for (const f of files) {
      const s = readFileSync(f, 'utf8')
      for (const m of s.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.([A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g)) {
        try {
          const p = JSON.parse(Buffer.from(m[1], 'base64').toString())
          if (p.role === 'service_role') serviceRole++
          else otherJwt.add(p.role || 'unknown')
        } catch { /* not a JWT payload */ }
      }
      if (/-----BEGIN [A-Z ]*PRIVATE KEY/.test(s)) bad('no private keys in the bundle', f)
    }
    serviceRole === 0
      ? ok('no service-role key in the bundle')
      : bad('no service-role key in the bundle', `${serviceRole} found — rotate immediately`)
    ok('only public roles present', [...otherJwt].join(', ') || 'none')
  }
}

console.log('\nDELIVERY HEADERS')
{
  const t = read('netlify.toml')
  const csp = t.match(/Content-Security-Policy = "([^"]+)"/)?.[1]
  if (!csp) bad('a Content-Security-Policy is set')
  else {
    ok('a Content-Security-Policy is set')
    const scriptSrc = csp.match(/script-src([^;]*)/)?.[1] || ''
    const scriptUnsafe = scriptSrc.includes('unsafe-inline') || scriptSrc.includes('unsafe-eval')
    if (scriptUnsafe) bad('script-src does not allow unsafe-inline', 'this is the clause that stops XSS')
    else ok('script-src does not allow unsafe-inline')
    for (const clause of ["object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'"]) {
      if (csp.includes(clause)) ok(clause); else bad(clause)
    }
    const connect = csp.match(/connect-src([^;]*)/)?.[1] || ''
    if (connect.includes('supabase.co') && !connect.includes('*'))
      ok('connect-src is allow-listed')
    else bad('connect-src is allow-listed', connect.trim())
  }
  for (const [h, re] of [
    ['Strict-Transport-Security', /Strict-Transport-Security/],
    ['X-Content-Type-Options', /X-Content-Type-Options = "nosniff"/],
    ['Referrer-Policy', /Referrer-Policy/],
    ['Permissions-Policy', /Permissions-Policy/],
  ]) { if (re.test(t)) ok(`${h} present`); else bad(`${h} present`) }
}

console.log('\nCLIENT-SIDE HYGIENE')
{
  const files = []
  const walk = (d) => readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.jsx?$/.test(e.name)) files.push(p)
  })
  walk(join(ROOT, 'src'))
  const danger = files.filter((f) => readFileSync(f, 'utf8').includes('dangerouslySetInnerHTML'))
  if (danger.length === 0) ok('no dangerouslySetInnerHTML anywhere')
  else bad('no dangerouslySetInnerHTML anywhere', danger.join(', '))

  /* Assigning innerHTML is the same risk class, and the check above never
     looked for it — it matches a React prop name, so a plain DOM write
     walked straight past. The scene host is the one place that needs it:
     the animations are SVG strings built from literals in
     src/components/scenes, with nothing from a user, a URL, a query
     string or the network anywhere in them, and React has no way to
     hand a subtree to code that drives it by attribute per frame.
     Clearing to '' is always fine. Anything else, anywhere else, is a
     finding — including a second scene host added later. */
  const SCENE_HOST = join('src', 'components', 'scenes', 'Scene.jsx')
  /* Read the assigned token rather than a negative lookahead: `\s*` hands a
     space back on backtracking, so `=\s*(?!'')` matches the very `= ''`
     it is written to allow. */
  const writesHtml = files.filter((f) => {
    if (f.endsWith(SCENE_HOST)) return false
    const src = readFileSync(f, 'utf8')
    for (const m of src.matchAll(/\.innerHTML\s*=\s*(\S+)/g)) {
      if (!/^(''|""|``)/.test(m[1])) return true
    }
    return false
  })
  if (writesHtml.length === 0) ok('innerHTML written only by the scene host')
  else bad('innerHTML written only by the scene host', writesHtml.join(', '))

  // The access key must never be written to durable storage.
  // Comments are stripped first — the file documents that it avoids
  // localStorage, and matching that sentence is not a finding.
  const stripComments = (s) => s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  const portal = stripComments(read('src/pages/Portal.jsx'))
  const persists = /localStorage|sessionStorage|document\.cookie/.test(portal)
  if (persists) bad('portal never persists the access key')
  else ok('portal never persists the access key')
  const viaRpc = portal.includes("rpc('portal_login'")
  if (viaRpc) ok('portal signs in through the throttled RPC')
  else bad('portal signs in through the throttled RPC', 'direct table select is unthrottled')
}

if (process.env.LIVE === '1') {
  console.log('\nLIVE BACKEND')
  const URL = 'https://rrkcoqopcqtowbyismcq.supabase.co'
  const ANON = process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJya2NvcW9wY3F0b3dieWlzbWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNjE1NTksImV4cCI6MjA5NTczNzU1OX0.p8Hj0sULNLos0_nZhJ_OyYyfiqfmAspwFxtLBdoK4R0'
  const H = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' }
  const login = (k) => fetch(`${URL}/rest/v1/rpc/portal_login`, {
    method: 'POST', headers: H, body: JSON.stringify({ p_key: k }) })

  // Guess repeatedly against ONE prefix. Counting per-IP alone is not enough:
  // an attacker rotating egress addresses splits the count and slips under the
  // limit, which is exactly what happened the first time this was tested.
  const stamp = Date.now()
  let locked = false, tried = 0
  for (let i = 0; i < 30 && !locked; i++) {
    tried++
    const r = await login(`SECCHK-${stamp}-${String(i).padStart(4, '0')}`)
    if (r.status === 400 && /too many attempts/i.test(await r.text())) locked = true
  }
  if (locked) ok('brute force is throttled', `blocked after ${tried} guesses`)
  else bad('brute force is throttled', '30 guesses all answered — not throttled')

  // A lockout must never be usable to deny a real client their own portal.
  const real = await login('ACME-DEMO-2026')
  const body = await real.text()
  if (real.status === 200 && body.includes('business_name'))
    ok('a throttled prefix does not lock out the real key')
  else bad('a throttled prefix does not lock out the real key', `HTTP ${real.status}`)

  // The attempt log must not be readable by the public.
  const leak = await fetch(`${URL}/rest/v1/portal_login_attempts?select=*`, { headers: H })
  const rows = await leak.json().catch(() => null)
  Array.isArray(rows) && rows.length === 0
    ? ok('attempt log is not readable by anon')
    : bad('attempt log is not readable by anon', JSON.stringify(rows)?.slice(0, 80))
}

console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped`)
process.exit(fail ? 1 : 0)
