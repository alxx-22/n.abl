#!/usr/bin/env node
/* ============================================================
   WHAT SEARCH ACTUALLY DID, FROM GOOGLE RATHER THAN FROM GUESSING

   check-seo.mjs asserts that the site is readable. This asks the only
   organisation that knows whether anyone read it.

   On 14 September 2026 the baseline was: no impressions data at all,
   because nobody had ever verified the property. Everything written
   about n.abl's search performance before that date was inference from
   third-party search tools, in the wrong region, with no access to the
   one free source of truth. That is the gap this closes.

     node scripts/seo-report.mjs                 # last 28 days
     node scripts/seo-report.mjs --days 90
     node scripts/seo-report.mjs --out business/03-website/search-2026-10.md

   SETUP — ABOUT TEN MINUTES, ONCE

   1. Verify https://nabl.agency/ in Google Search Console. A DNS TXT
      record on the domain is the sturdiest method: it survives a host
      move, which an HTML file does not, and this site has already moved
      host once.
   2. In Google Cloud, create a project, enable the "Google Search
      Console API", and create a service account. No roles needed.
   3. Create a JSON key for that service account and save it OUTSIDE
      this repository. It is a credential; .gitignore already covers
      *.json under .secrets/ but the safest place is your home
      directory.
   4. In Search Console → Settings → Users and permissions, add the
      service account's client_email as a Full user.
   5. export GSC_KEY_FILE=~/nabl-search-console.json

   Until step 5 is done this script prints what it needs and exits 0
   rather than failing a build.

   NO NEW DEPENDENCIES

   The googleapis package is 50 MB and this needs one signed JWT and two
   HTTPS calls. node:crypto signs RS256 natively, so it is done by hand
   below. The same reasoning as self-hosting the fonts: a dependency is
   a permanent cost for a one-off convenience.
   ============================================================ */
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import crypto from 'node:crypto'

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const KEY_FILE = process.env.GSC_KEY_FILE || ''
const SITE = process.env.GSC_SITE || 'https://nabl.agency/'
const DAYS = Number(arg('--days', 28))
const OUT = arg('--out', '')

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

function setupNotice() {
  console.log(`
Search Console reporting is not configured yet.

  GSC_KEY_FILE is ${KEY_FILE ? `set to "${KEY_FILE}", which does not exist` : 'not set'}.

This is the highest-value item on the SEO list and it is free. The steps
are in the header of this file — roughly ten minutes, once. Until then
there is no impressions data for n.abl at all, and anything anyone says
about how the site performs in search is inference.
`)
}

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

/* A service-account JWT, signed RS256 and exchanged for an access
   token. Google's own documented flow; the libraries only wrap it. */
async function accessToken(key) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(JSON.stringify({
    iss: key.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }))
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(`${header}.${claim}`)
  const jwt = `${header}.${claim}.${b64url(signer.sign(key.private_key))}`

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(`token exchange failed (${res.status}): ${data.error_description || data.error || 'unknown'}`)
  }
  return data.access_token
}

async function query(token, body) {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) {
    const msg = data.error?.message || `HTTP ${res.status}`
    if (res.status === 403) {
      throw new Error(
        `${msg}\n\nThis usually means the service account is not a user on the property. ` +
        `Add its client_email in Search Console → Settings → Users and permissions.`
      )
    }
    throw new Error(msg)
  }
  return data.rows || []
}

const iso = (d) => d.toISOString().slice(0, 10)
const pct = (n) => `${(n * 100).toFixed(1)}%`
const pos = (n) => n.toFixed(1)

function table(rows, label) {
  if (!rows.length) return `_No ${label} recorded in the period._\n`
  const head = `| ${label} | Clicks | Impressions | CTR | Avg position |\n|---|--:|--:|--:|--:|\n`
  return head + rows.map((r) =>
    `| ${String(r.keys[0]).replace(/\|/g, '\\|')} | ${r.clicks} | ${r.impressions} | ${pct(r.ctr)} | ${pos(r.position)} |`
  ).join('\n') + '\n'
}

async function main() {
  if (!KEY_FILE || !existsSync(KEY_FILE)) { setupNotice(); return }

  const key = JSON.parse(await readFile(KEY_FILE, 'utf8'))
  const token = await accessToken(key)

  /* Search Console data lags about three days. Asking for yesterday
     returns an empty row set and looks like a bug. */
  const end = new Date(Date.now() - 3 * 86400_000)
  const start = new Date(end.getTime() - DAYS * 86400_000)
  const range = { startDate: iso(start), endDate: iso(end) }

  const [totals, queries, pages, countries] = await Promise.all([
    query(token, { ...range, dimensions: [] }),
    query(token, { ...range, dimensions: ['query'], rowLimit: 25 }),
    query(token, { ...range, dimensions: ['page'], rowLimit: 25 }),
    query(token, { ...range, dimensions: ['country'], rowLimit: 10 }),
  ])

  const t = totals[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 }
  const lines = []
  lines.push(`# Search performance, ${range.startDate} to ${range.endDate}`)
  lines.push('')
  lines.push(`Google Search Console, property \`${SITE}\`, ${DAYS} days.`)
  lines.push('Generated by `scripts/seo-report.mjs`. Figures are Google\'s, not estimates.')
  lines.push('')
  lines.push('| | |')
  lines.push('|---|--:|')
  lines.push(`| Clicks | ${t.clicks} |`)
  lines.push(`| Impressions | ${t.impressions} |`)
  lines.push(`| CTR | ${pct(t.ctr)} |`)
  lines.push(`| Average position | ${pos(t.position)} |`)
  lines.push('')
  if (t.impressions === 0) {
    lines.push('**Zero impressions.** The site was not shown in a single search result')
    lines.push('in this period. Check that the property is verified, that indexing has')
    lines.push('been requested for the four public URLs, and that `npm run test:seo:live`')
    lines.push('passes — a page that renders nothing cannot be shown for anything.')
    lines.push('')
  }
  lines.push('## Queries')
  lines.push('')
  lines.push(table(queries, 'Query'))
  lines.push('## Pages')
  lines.push('')
  lines.push(table(pages, 'Page'))
  lines.push('## Countries')
  lines.push('')
  lines.push(table(countries, 'Country'))

  const md = lines.join('\n')
  if (OUT) {
    await writeFile(OUT, md)
    console.log(`  → ${OUT}`)
  } else {
    console.log(md)
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
