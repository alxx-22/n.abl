#!/usr/bin/env node
/* The CQC directory of registered care locations.

   Small, and worth it for the same reason as the charities file: it already
   holds the phone number and the trading address. Care providers are also a
   genuinely good fit — rota, visit logging, medication records and CQC
   evidence are exactly the manual processes this business exists to fix.

   The address here is where care is delivered from, not a registered office,
   because CQC registers locations rather than companies.

     node scripts/sourcing/fetch-cqc.mjs
     node scripts/sourcing/fetch-cqc.mjs --areas all
*/

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { parseCsvLine, outwardArea, makeTerritoryFilter, areasFrom } from './lib.mjs'

const LANDING = 'https://www.cqc.org.uk/about-us/transparency/using-cqc-data'
const DIR = '.sourcing'
const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const AREAS = areasFrom(arg('--areas', null), 'NG,B49,B50')
const inTerritory = makeTerritoryFilter(AREAS)
const curl = (a) => execFileSync('curl', a, { encoding: 'utf8', maxBuffer: 1 << 28 })

/* The filename carries the publication date and changes monthly, so it is
   read off the page rather than hardcoded — the same reason as the ICO fetch.
   A hardcoded URL 404s next month and reads as an outage. */
console.log('  finding the current directory …')
const page = curl(['-sS', '-L', '--max-time', '60', LANDING])
const url = page.match(/href="(https:\/\/[^"]*[Dd]irectory[^"]*\.csv)"/)?.[1]
if (!url) {
  console.error(`  Could not find the directory link on ${LANDING}.`)
  process.exit(1)
}
console.log(`  ${url}`)
const published = url.match(/(\d{1,2})_([A-Za-z]+)_(\d{4})/)
const sourceDate = published
  ? new Date(`${published[2]} ${published[1]}, ${published[3]} UTC`).toISOString().slice(0, 10)
  : new Date().toISOString().slice(0, 10)

fs.mkdirSync(DIR, { recursive: true })
const csv = path.join(DIR, 'cqc-directory.csv')
if (!fs.existsSync(csv)) {
  console.log('  downloading …')
  curl(['-sS', '-L', '--max-time', '900', '-o', csv, url])
} else console.log('  using the copy already downloaded')

const text = fs.readFileSync(csv, 'utf8').replace(/^﻿/, '')
const lines = text.split(/\r?\n/)

/* The file carries a few banner rows before the real header, so the header is
   found by looking for the column we need rather than assumed to be line one. */
let headerIndex = lines.findIndex((l) => /(^|,)Name,/i.test(l) && /Postcode,/i.test(l))
if (headerIndex < 0) { console.error('  Could not find the header row.'); process.exit(1) }
const header = parseCsvLine(lines[headerIndex])
const col = (needle) => header.findIndex((h) => h.trim().toLowerCase() === needle.toLowerCase())

/* Column names taken from the file, not from a description of it. An earlier
   version used the names a research note gave — "Location Name", "Location
   Postal Code" — and none of them exist in what CQC actually publishes. The
   header lookup below fails loudly rather than silently producing empty rows,
   which is the only reason that was a two-minute problem. */
const C = {
  id: col('CQC Location ID (for office use only)'),
  name: col('Name'),
  alsoKnownAs: col('Also known as'),
  phone: col('Phone number'),
  web: col("Service's website (if available)"),
  address: col('Address'),
  postcode: col('Postcode'),
  la: col('Local Authority'),
  types: col('Service types'),
  specialisms: col('Specialisms/services'),
  provider: col('Provider name'),
  providerId: col('CQC Provider ID (for office use only)'),
}
const missing = Object.entries(C).filter(([, i]) => i < 0).map(([k]) => k)
if (missing.length) {
  console.error(`  Columns not found: ${missing.join(', ')}`)
  console.error(`  Header was: ${header.slice(0, 25).join(' | ')}`)
  process.exit(1)
}

let scanned = 0
const out = []
for (const line of lines.slice(headerIndex + 1)) {
  if (!line.trim()) continue
  scanned++
  const f = parseCsvLine(line)
  const postcode = f[C.postcode] || ''
  if (!inTerritory(postcode)) continue
  const name = (f[C.name] || '').trim()
  if (!name) continue

  out.push({
    cqc_location_id: (f[C.id] || '').trim(),
    company: name,
    provider: (f[C.provider] || '').trim() || null,
    cqc_provider_id: (f[C.providerId] || '').trim() || null,
    address: (f[C.address] || '').trim(),
    postcode: postcode.trim(),
    area: outwardArea(postcode),
    phone: (f[C.phone] || '').trim() || null,
    website: (f[C.web] || '').trim() || null,
    local_authority: (f[C.la] || '').trim() || null,
    business_type: (f[C.types] || '').trim() || null,
    specialisms: (f[C.specialisms] || '').trim() || null,
    trading_name: (f[C.alsoKnownAs] || '').trim() || null,
    source: 'public_company_information',
    source_detail: url,
    source_date: sourceDate,
  })
}

const file = path.join(DIR, `cqc-${sourceDate}-${AREAS.join('-').toLowerCase()}.json`)
fs.writeFileSync(file, JSON.stringify({
  register: 'CQC directory of registered locations',
  licence: 'OGL v3, with acknowledgement of the Care Quality Commission',
  areas: AREAS,
  published: sourceDate,
  generated_at: new Date().toISOString(),
  count: out.length,
  candidates: out,
}, null, 1))

console.log(`
  ${scanned.toLocaleString()} locations scanned
  ${out.length.toLocaleString()} active in territory
  ${out.filter((r) => r.phone).length.toLocaleString()} with a phone number
  ${out.filter((r) => r.website).length.toLocaleString()} with a website already stated
  ${out.filter((r) => r.provider).length.toLocaleString()} naming the provider company behind the location

  -> ${path.resolve(file)}

  Contains public sector information licensed under the Open Government
  Licence v3.0, from the Care Quality Commission.
`)
