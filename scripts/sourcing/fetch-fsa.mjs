#!/usr/bin/env node
/* ============================================================
   Stage 1b — food businesses, with a REAL trading address.

   The Companies House register has one serious weakness for finding
   businesses in a town: the registered office is frequently the
   accountant's. The Food Standards Agency's hygiene register does not
   have that problem. Every address here is the premises an
   environmental health officer physically inspected, so an
   accountant's office cannot appear in it.

   611,000+ UK establishments. Free, no key, no quota, updated daily.
   Restaurants, cafes, takeaways, pubs, hotels, caterers, retailers,
   manufacturers, schools, care homes — a large slice of exactly the
   owner-operated small business this sells to.

   Verified live 21 Aug 2026: bulk CSV 144MB, Last-Modified that day.

   Usage:
     node scripts/sourcing/fetch-fsa.mjs
     node scripts/sourcing/fetch-fsa.mjs --areas NG,B49,B50
     node scripts/sourcing/fetch-fsa.mjs --areas all
     node scripts/sourcing/fetch-fsa.mjs --types "Restaurant,Retailers"
     node scripts/sourcing/fetch-fsa.mjs --keep

   Output: .sourcing/fsa-<date>-<territory>.json  (git-ignored)
   ============================================================ */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCsvLine, outwardArea, makeTerritoryFilter, areasFrom } from './lib.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT_DIR = join(ROOT, '.sourcing')

const BULK = 'https://safhrsprodstorage.blob.core.windows.net/opendatafileblobstorage/FHRS_All_en-GB.csv'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : (argv[i + 1] ?? d) }
const has = (n) => argv.includes(`--${n}`)

const AREAS = areasFrom(arg('areas', 'NG,B49,B50'))
const inTerritory = makeTerritoryFilter(AREAS)
const TYPES = arg('types', '') ? areasFrom(arg('types', '')) : null
const KEEP = has('keep')

mkdirSync(OUT_DIR, { recursive: true })
const csv = join(OUT_DIR, 'fsa-all.csv')

if (!existsSync(csv)) {
  process.stdout.write('  downloading the FSA register … ')
  await new Promise((resolve, reject) => {
    const p = spawn('curl', ['-sSL', '--max-time', '900', '-o', csv, BULK], { stdio: ['ignore', 'ignore', 'inherit'] })
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`curl exited ${c}`))))
    p.on('error', reject)
  })
  console.log(`${(statSync(csv).size / 1024 / 1024).toFixed(0)} MB`)
} else {
  console.log('  using the register already downloaded (delete .sourcing/fsa-all.csv to refresh)')
}

console.log(`\n  Territory: ${AREAS.join(', ')}`)
if (TYPES) console.log(`  Types:     ${TYPES.join(', ')}`)
console.log('')

const kept = []
let scanned = 0
let idx = null

const rl = createInterface({ input: createReadStream(csv), crlfDelay: Infinity })
for await (const line of rl) {
  if (!line) continue
  if (!idx) {
    const header = parseCsvLine(line)
    const find = (n) => header.findIndex((h) => h.replace(/^﻿/, '') === n)
    idx = {
      id: find('FHRSID'),
      name: find('BusinessName'),
      type: find('BusinessType'),
      a1: find('AddressLine1'), a2: find('AddressLine2'),
      a3: find('AddressLine3'), a4: find('AddressLine4'),
      postcode: find('PostCode'),
      la: find('LocalAuthorityName'),
      rating: find('RatingValue'),
      ratingDate: find('RatingDate'),
      lat: find('Latitude'), lon: find('Longitude'),
    }
    if (idx.name < 0 || idx.postcode < 0) {
      console.error('\n  The FSA CSV header is not what was expected. Seen:')
      console.error(`  ${header.slice(0, 10).join(' | ')}\n`)
      process.exit(1)
    }
    continue
  }

  scanned++
  const f = parseCsvLine(line)
  const postcode = f[idx.postcode]
  if (!inTerritory(postcode)) continue
  const type = f[idx.type] || ''
  if (TYPES && !TYPES.some((t) => type.toUpperCase().includes(t))) continue

  kept.push({
    fhrs_id: f[idx.id],
    company: f[idx.name],
    business_type: type,
    // The inspected premises. This is the whole point of using this source.
    address: [f[idx.a1], f[idx.a2], f[idx.a3], f[idx.a4]].filter(Boolean).join(', '),
    postcode,
    area: outwardArea(postcode),
    local_authority: f[idx.la] || null,
    hygiene_rating: f[idx.rating] || null,
    rating_date: f[idx.ratingDate] || null,
    lat: f[idx.lat] || null,
    lon: f[idx.lon] || null,
    source: 'public_company_information',
    source_detail: BULK,
    source_date: new Date().toISOString().slice(0, 10),
  })
}

const tag = AREAS.length === 1 && AREAS[0] === 'ALL' ? 'national' : AREAS.join('-').toLowerCase()
const date = new Date().toISOString().slice(0, 10)
const outFile = join(OUT_DIR, `fsa-${date}-${tag}.json`)
writeFileSync(outFile, JSON.stringify({
  register: 'FSA Food Hygiene Rating Scheme',
  areas: AREAS, types: TYPES, generated_at: new Date().toISOString(),
  count: kept.length, candidates: kept,
}, null, 2))

if (!KEEP && AREAS[0] !== 'ALL') { /* keep the csv by default: re-filtering is free */ }

const byType = kept.reduce((m, c) => { m[c.business_type] = (m[c.business_type] || 0) + 1; return m }, {})
console.log(`  ${scanned.toLocaleString()} establishments scanned`)
console.log(`  ${kept.length.toLocaleString()} in territory\n`)
console.log('  ' + Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 8)
  .map(([t, n]) => `${t}: ${n}`).join('\n  '))
console.log(`\n  → ${outFile}`)
console.log('\n  Every address here is an inspected premises, not a registered office.\n')
