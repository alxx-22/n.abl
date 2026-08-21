#!/usr/bin/env node
/* Pull a contact route off a confirmed website.

   Runs only on domains find-websites.mjs already proved belong to the company,
   so this never guesses at whose site it is reading. It fetches the home page
   and the usual two or three others, and takes what the business has chosen to
   publish about how to reach it.

   Three things it deliberately does NOT do.

   It does not take personal email addresses. `sarah@` is a named individual;
   holding it moves the record from tier A to tier B under LIA-2026-08-v2 and
   engages UK GDPR where nothing did before. Role addresses — info@, hello@,
   enquiries@ — are the business, not a person. Named addresses are counted so
   the number is visible, and discarded.

   It does not follow links beyond the small fixed list below. A crawl that
   wanders is a crawl that ends up somewhere it was not invited.

   It does not touch a site whose robots.txt says no, and it obeys crawl-delay.

   The best thing it finds is often not the email at all. A footer address is
   the most accurate trading address available anywhere for free — better than
   Companies House, better than the ICO — because the business wrote it for
   customers who need to physically arrive.

     node scripts/sourcing/extract-contacts.mjs --in .sourcing/websites-first.json
*/

import fs from 'node:fs'
import path from 'node:path'

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const IN = arg('--in', '.sourcing/websites-first.json')
const OUT = arg('--out', IN.replace(/\.json$/, '-contacts.json'))
const CONCURRENCY = Number(arg('--concurrency', 6))
const LIMIT = Number(arg('--limit', 0)) || 0

const UA = 'n.abl-research/1.0 (+https://nabl.agency; hello@nabl.agency)'
const TIMEOUT = 12000
const PATHS = ['', '/contact', '/contact-us', '/about']

/* Role addresses are the business. Named ones are a person, and a person is
   personal data with all that follows. */
const ROLE = /^(info|hello|hi|enquiries|enquiry|contact|admin|office|sales|mail|team|reception|accounts|support|help|bookings|service|general|post)$/i

/* Addresses that belong to the website rather than the business. */
const NOT_A_CONTACT = /@(sentry|wixpress|example|domain|email|yourdomain|sentry\.io|godaddy|squarespace|shopify)\./i
const ASSET = /\.(png|jpe?g|gif|svg|webp|css|js|woff2?)$/i

async function get(url) {
  const control = new AbortController()
  const timer = setTimeout(() => control.abort(), TIMEOUT)
  try {
    const res = await fetch(url, {
      redirect: 'follow', signal: control.signal,
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
    })
    if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) return null
    return (await res.text()).slice(0, 400_000)
  } catch { return null } finally { clearTimeout(timer) }
}

async function robots(origin) {
  const body = await get(`${origin}/robots.txt`)
  const rules = { disallowed: [], delay: 0, blanket: false }
  if (!body) return rules
  let applies = false
  for (const raw of body.split('\n')) {
    const line = raw.split('#')[0].trim()
    if (!line) continue
    const [field, ...rest] = line.split(':')
    const key = field.trim().toLowerCase()
    const value = rest.join(':').trim()
    if (key === 'user-agent') applies = value === '*' || value.toLowerCase().includes('n.abl')
    else if (applies && key === 'disallow' && value) {
      if (value === '/') rules.blanket = true
      else rules.disallowed.push(value)
    } else if (applies && key === 'crawl-delay') rules.delay = Math.min(Number(value) || 0, 10) * 1000
  }
  return rules
}

const allowed = (rules, p) =>
  !rules.blanket && !rules.disallowed.some((d) => (p || '/').startsWith(d))

function harvest(html, found) {
  // mailto: first — an address the business linked deliberately.
  for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) found.emails.add(m[1].toLowerCase())
  // Then any address in the text, which catches footers that are not links.
  for (const m of html.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/g)) found.emails.add(m[0].toLowerCase())
  for (const m of html.matchAll(/tel:([+\d\s()-]{7,})/gi)) found.phones.add(m[1].replace(/\s+/g, ' ').trim())
  // UK numbers written out rather than linked.
  for (const m of html.matchAll(/\b(?:0\d{4}|\(?0\d{4}\)?)\s?\d{3}\s?\d{3}\b|\b0\d{3}\s?\d{3}\s?\d{4}\b/g)) {
    found.phones.add(m[0].replace(/\s+/g, ' ').trim())
  }
  for (const m of html.matchAll(/<form[^>]+action=["']([^"']+)["']/gi)) found.forms.add(m[1])

  /* schema.org Organization, where a business has stated its own address in a
     machine-readable form. The most reliable thing on the page when present. */
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const nodes = [].concat(JSON.parse(m[1].trim()))
      for (const node of nodes.flatMap((n) => [n, ...(n['@graph'] || [])])) {
        if (!node || typeof node !== 'object') continue
        if (node.email) found.emails.add(String(node.email).replace(/^mailto:/, '').toLowerCase())
        if (node.telephone) found.phones.add(String(node.telephone))
        const a = node.address
        if (a && typeof a === 'object') {
          const line = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode]
            .filter(Boolean).join(', ')
          if (line) { found.addresses.add(line); found.address_source = 'schema.org' }
        }
      }
    } catch { /* a malformed JSON-LD block is not worth failing the page over */ }
  }

  /* A UK postcode in the page, which is what makes the footer address usable.
     Anchored on the postcode because it is the only part with a fixed shape. */
  for (const m of html.matchAll(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s?(\d[A-Z]{2})\b/g)) {
    found.postcodes.add(`${m[1]} ${m[2]}`)
  }
}

async function extract(site) {
  const origin = new URL(site.website).origin
  const out = { name: site.name, website: site.website, area: site.area,
                emails: [], named_emails_discarded: 0, phones: [], forms: [],
                postcodes: [], addresses: [], pages_read: 0, outcome: 'nothing published' }

  const rules = await robots(origin)
  if (rules.blanket) { out.outcome = 'robots.txt disallows'; return out }

  const found = { emails: new Set(), phones: new Set(), forms: new Set(),
                  postcodes: new Set(), addresses: new Set(), address_source: null }

  for (const p of PATHS) {
    if (!allowed(rules, p)) continue
    if (out.pages_read) await new Promise((r) => setTimeout(r, rules.delay || 700))
    const html = await get(origin + p)
    if (!html) continue
    out.pages_read++
    harvest(html, found)
  }
  if (!out.pages_read) { out.outcome = 'no page could be read'; return out }

  for (const e of found.emails) {
    if (NOT_A_CONTACT.test(e) || ASSET.test(e)) continue
    const local = e.split('@')[0]
    if (ROLE.test(local)) out.emails.push(e)
    // A named address is a person. Counted, so the number is visible, and
    // not kept: holding it would move this record to tier B for nothing.
    else out.named_emails_discarded++
  }

  out.phones = [...found.phones].slice(0, 3)
  out.forms = [...found.forms].filter((f) => !/^(https?:)?\/\//.test(f) || f.startsWith(origin)).slice(0, 2)
  out.postcodes = [...found.postcodes].slice(0, 3)
  out.addresses = [...found.addresses].slice(0, 2)
  out.address_source = found.address_source
  out.emails = [...new Set(out.emails)].slice(0, 3)

  const routes = out.emails.length + out.phones.length + out.forms.length
  out.outcome = routes ? 'contact route found' : 'read, but nothing published'
  return out
}

/* Reads either the sweep's finished JSON or its in-progress JSONL checkpoint,
   so extraction can start while the sweep is still running and be re-run to
   pick up whatever it found in the meantime. */
let all = []
if (IN.endsWith('.jsonl')) {
  for (const line of fs.readFileSync(IN, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try { all.push(JSON.parse(line)) } catch { /* torn last line */ }
  }
} else {
  all = JSON.parse(fs.readFileSync(IN, 'utf8')).results || []
}

let sites = all.filter((r) => r.outcome === 'confirmed' && r.website)

/* Same checkpoint discipline as the sweep: one line per site as it completes,
   and a rerun skips what is already there. Extraction fetches up to four
   pages per site, so re-doing finished work is not just slow, it is four
   requests to somebody who already answered them. */
const CHECKPOINT = OUT.replace(/\.json$/, '.jsonl')
const results = []
const seen = new Set()
if (fs.existsSync(CHECKPOINT)) {
  for (const line of fs.readFileSync(CHECKPOINT, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try { const r = JSON.parse(line); results.push(r); seen.add(r.name) } catch { /* torn */ }
  }
  console.log(`  resuming: ${results.length.toLocaleString()} already read`)
}
sites = sites.filter((s) => !seen.has(s.name))
if (LIMIT) sites = sites.slice(0, LIMIT)

console.log(`\n  ${sites.length.toLocaleString()} confirmed sites, ${CONCURRENCY} at a time\n`)

const sink = fs.createWriteStream(CHECKPOINT, { flags: 'a' })
const queue = [...sites]
let done = 0
const started = Date.now()
async function worker() {
  while (queue.length) {
    const site = queue.shift()
    let record
    try { record = await extract(site) }
    catch (e) { record = { name: site.name, website: site.website, outcome: `error: ${e.message}` } }
    results.push(record)
    sink.write(JSON.stringify(record) + '\n')
    if (++done % 50 === 0) {
      const rate = done / ((Date.now() - started) / 1000)
      console.log(`  ${done}/${sites.length}  ${rate.toFixed(1)}/s  ~${((queue.length / rate) / 60).toFixed(0)}m left`)
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))
await new Promise((r) => sink.end(r))

const by = {}
for (const r of results) by[r.outcome] = (by[r.outcome] || 0) + 1
const withEmail = results.filter((r) => r.emails?.length).length
const withPhone = results.filter((r) => r.phones?.length).length
const withPostcode = results.filter((r) => r.postcodes?.length).length
const discarded = results.reduce((n, r) => n + (r.named_emails_discarded || 0), 0)

fs.writeFileSync(OUT, JSON.stringify({
  generated_at: new Date().toISOString(),
  source: IN, attempted: results.length,
  with_role_email: withEmail, with_phone: withPhone, with_postcode: withPostcode,
  named_emails_discarded: discarded, outcomes: by, results,
}, null, 1))

console.log(`
  ${results.length.toLocaleString()} sites read
  ${withEmail.toLocaleString()} with a role email address
  ${withPhone.toLocaleString()} with a phone number
  ${withPostcode.toLocaleString()} with a postcode on the page
  ${discarded.toLocaleString()} named addresses found and discarded

${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${String(v).padStart(5)}  ${k}`).join('\n')}

  -> ${path.resolve(OUT)}
`)
