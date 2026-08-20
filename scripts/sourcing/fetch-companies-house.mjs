#!/usr/bin/env node
/* ============================================================
   Stage 1 — the candidate universe, from a published file.

   Downloads one part of the Companies House Free Company Data
   Product, streams the CSV out of the zip, and keeps only the
   companies inside our territory.

   This is deliberately NOT scraping. The snapshot is published for
   reuse, needs no credential, has no terms to weigh and no
   robots.txt to interpret — and unlike any directory it is complete
   and structured. See business/10-lead-sourcing/scraping-methods.md.

   It also solves a compliance problem sideways: the register holds
   only incorporated companies, which is exactly the population PECR
   allows us to approach on legitimate interests. Sole traders never
   enter the pipeline because they were never in the file.

   Usage:
     node scripts/sourcing/fetch-companies-house.mjs                 # part 1
     node scripts/sourcing/fetch-companies-house.mjs --part 3
     node scripts/sourcing/fetch-companies-house.mjs --all           # all 7
     node scripts/sourcing/fetch-companies-house.mjs --areas NG,B49
     node scripts/sourcing/fetch-companies-house.mjs --all --areas all   # national
     node scripts/sourcing/fetch-companies-house.mjs --keep          # keep the zip

   Output: .sourcing/candidates-<date>.json  (git-ignored)
   ============================================================ */

import { spawn, spawnSync } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT_DIR = join(ROOT, '.sourcing')

/* ---------- arguments ---------- */
const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : (argv[i + 1] ?? fallback)
}
const has = (name) => argv.includes(`--${name}`)

// Territory. Registered-office postcode, with the caveat below.
const AREAS = String(arg('areas', 'NG,B49,B50'))
  .split(',').map((a) => a.trim().toUpperCase()).filter(Boolean)

const PARTS = has('all') ? [1, 2, 3, 4, 5, 6, 7] : [Number(arg('part', 1))]
const KEEP = has('keep')

/* The snapshot is published within five working days of month end, so the
   current month's file may not exist yet on the 1st or 2nd. Try this month
   first, then last month. */
function candidateDates() {
  const now = new Date()
  const out = []
  for (let back = 0; back < 3; back++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1))
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

const urlFor = (date, part) =>
  `https://download.companieshouse.gov.uk/BasicCompanyData-${date}-part${part}_7.zip`

/* ---------- csv ---------- */
/* The file is quoted CSV with commas inside quoted fields, so it cannot be
   split on commas. This is a small hand-rolled parser rather than a
   dependency: one format, one shape, and it does not change. */
function parseCsvLine(line) {
  const out = []
  let field = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++ }   // escaped quote
        else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { out.push(field); field = '' }
    else field += c
  }
  out.push(field)
  return out.map((f) => f.trim())
}

/** The register writes dates as DD/MM/YYYY. Postgres wants ISO, and so does
    any comparison — '05/07/2023' sorts as a string, not as a date. */
function isoDate(ddmmyyyy) {
  const m = String(ddmmyyyy || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

/** NG1 2AB -> NG ; B49 6AA -> B49. Returns '' when there is no postcode. */
function outwardArea(postcode) {
  const pc = String(postcode || '').trim().toUpperCase()
  if (!pc) return ''
  const outward = pc.split(/\s+/)[0] || ''
  const m = outward.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)$/)
  if (!m) return ''
  return m[1]
}

function inTerritory(postcode) {
  // --areas all keeps every active company. Territory is a business decision,
  // not a property of the data, and the whole register is the same download.
  if (AREAS.length === 1 && AREAS[0] === 'ALL') return true
  const outward = outwardArea(postcode)
  if (!outward) return false
  const letters = outward.match(/^[A-Z]{1,2}/)?.[0] || ''
  // 'NG' matches any NG district; 'B49' matches only that district.
  return AREAS.some((a) => (/\d/.test(a) ? outward === a : letters === a))
}

async function head(url) {
  return new Promise((resolve) => {
    const p = spawn('curl', ['-sI', '--max-time', '45', url])
    let body = ''
    p.stdout.on('data', (d) => { body += d })
    p.on('close', () => resolve(/(^|\r?\n)HTTP\/[\d.]+ 200/.test(body)))
    p.on('error', () => resolve(false))
  })
}

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    const p = spawn('curl', ['-sSL', '--max-time', '900', '-o', dest, url], { stdio: ['ignore', 'ignore', 'inherit'] })
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`curl exited ${code}`))))
    p.on('error', reject)
  })
}

/* ---------- main ---------- */
mkdirSync(OUT_DIR, { recursive: true })

let snapshotDate = null
for (const date of candidateDates()) {
  process.stdout.write(`  checking snapshot ${date} … `)
  if (await head(urlFor(date, PARTS[0]))) { console.log('available'); snapshotDate = date; break }
  console.log('not published')
}
if (!snapshotDate) {
  console.error('\n  No snapshot found for the last three months. Check')
  console.error('  https://download.companieshouse.gov.uk/en_output.html — the filename')
  console.error('  format may have changed.\n')
  process.exit(1)
}

console.log(`\n  Territory: ${AREAS.join(', ')}`)
console.log(`  Parts:     ${PARTS.join(', ')} of 7\n`)

const kept = []
let scanned = 0
let header = null

for (const part of PARTS) {
  const url = urlFor(snapshotDate, part)
  const zip = join(OUT_DIR, `ch-${snapshotDate}-part${part}.zip`)

  if (!existsSync(zip)) {
    process.stdout.write(`  part ${part}: downloading … `)
    await download(url, zip)
    console.log(`${(statSync(zip).size / 1024 / 1024).toFixed(0)} MB`)
  } else {
    console.log(`  part ${part}: already downloaded`)
  }

  // Stream the CSV out of the zip rather than extracting it: the expanded
  // file is several hundred MB per part and we keep a few hundred rows.
  const unzip = spawn('unzip', ['-p', zip])
  const rl = createInterface({ input: unzip.stdout, crlfDelay: Infinity })

  let idx = null
  for await (const line of rl) {
    if (!line) continue
    if (!idx) {
      header = parseCsvLine(line)
      const find = (name) => header.findIndex((h) => h === name)
      idx = {
        name: find('CompanyName'),
        number: find(' CompanyNumber') >= 0 ? find(' CompanyNumber') : find('CompanyNumber'),
        status: find('CompanyStatus'),
        category: find('CompanyCategory'),
        incorporated: find('IncorporationDate'),
        postcode: find('RegAddress.PostCode'),
        town: find('RegAddress.PostTown'),
        line1: find('RegAddress.AddressLine1'),
        sic1: find('SICCode.SicText_1'),
        sic2: find('SICCode.SicText_2'),
      }
      if (idx.name < 0 || idx.postcode < 0) {
        console.error('\n  The CSV header is not what was expected. Columns seen:')
        console.error(`  ${header.slice(0, 8).join(' | ')}\n`)
        process.exit(1)
      }
      continue
    }

    scanned++
    const f = parseCsvLine(line)
    if (f[idx.status] !== 'Active') continue        // dissolved is a hard disqualifier
    if (!inTerritory(f[idx.postcode])) continue

    kept.push({
      company_number: f[idx.number],
      company: f[idx.name],
      company_category: f[idx.category],
      incorporated: isoDate(f[idx.incorporated]),
      postcode: f[idx.postcode],
      area: outwardArea(f[idx.postcode]),
      town: f[idx.town] || null,
      address_line_1: f[idx.line1] || null,
      sic: [f[idx.sic1], f[idx.sic2]].filter((s) => s && s !== 'None'),
      // Provenance, recorded now so the CRM never has to guess it later.
      source: 'companies_house',
      source_detail: url,
      source_date: snapshotDate,
    })
  }

  await new Promise((r) => unzip.on('close', r))
  if (!KEEP) { try { spawnSync('rm', ['-f', zip]) } catch {} }
  console.log(`  part ${part}: ${scanned.toLocaleString()} scanned, ${kept.length.toLocaleString()} in territory so far`)
}

const tag = AREAS.length === 1 && AREAS[0] === 'ALL' ? 'national' : AREAS.join('-').toLowerCase()
const outFile = join(OUT_DIR, `candidates-${snapshotDate}-${tag}.json`)
writeFileSync(outFile, JSON.stringify({
  snapshot: snapshotDate,
  areas: AREAS,
  parts: PARTS,
  generated_at: new Date().toISOString(),
  count: kept.length,
  candidates: kept,
}, null, 2))

const byArea = kept.reduce((m, c) => { m[c.area] = (m[c.area] || 0) + 1; return m }, {})

console.log(`\n  ${scanned.toLocaleString()} companies scanned`)
console.log(`  ${kept.length.toLocaleString()} active in territory`)
console.log(`  ${Object.entries(byArea).sort((a, b) => b[1] - a[1]).slice(0, 8)
  .map(([a, n]) => `${a}:${n}`).join('  ')}`)
console.log(`\n  → ${outFile}`)
console.log(`\n  Registered office is not always the trading address — an accountant's`)
console.log(`  address is common. Treat territory as a strong hint, not a fact.\n`)
