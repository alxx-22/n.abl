#!/usr/bin/env node
/* The ICO Register of Fee Payers.

   Every organisation processing personal data must pay the ICO a fee and
   appear on this register, so it covers ground Companies House does not: sole
   traders, partnerships, charities, schools, practices. 1.4 million rows,
   published daily under OGL v3, no key, no sign-up.

   Two things make it the best of the free registers for us:

   1. The address is the one the organisation gave for ITSELF. Companies House
      gives a registered office, which for a small business is very often the
      accountant's. This is far more often where they actually work.
   2. It carries trading names, so a company that trades under something other
      than its legal name can still be recognised.

   Two things to be careful about, both handled below:

   - The ICO states that OGL "does not apply to personal data in the dataset".
     Sole trader rows and the DPO contact fields are therefore NOT licensed
     open data — they sit on UK GDPR and PECR alone. The DPO fields are
     dropped on read rather than stored and filtered later, because the
     cheapest way not to misuse a field is not to have it.
   - Tier 1 registrations skew heavily to sole traders and individuals, who
     are individual subscribers under PECR and cannot be emailed cold. Nothing
     here decides that; the tier gate in the database does. This script only
     records what the register says, so that gate has something to read.
   - A large share of Tier 1 rows are a private individual's name against a
     residential address — "Mrs Eunice Mary Cubbage, 2 Ladbroke Close". That is
     personal data outright, not business data, and keeping twenty thousand of
     them because they were in the file is the opposite of data minimisation.
     Rows that read as a person and carry no trading name are dropped on read
     and counted, so the number is visible rather than silently retained.

     node scripts/sourcing/fetch-ico.mjs
     node scripts/sourcing/fetch-ico.mjs --areas all
*/

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { parseCsvLine, outwardArea, makeTerritoryFilter, areasFrom } from './lib.mjs'

const LANDING = 'https://ico.org.uk/about-the-ico/what-we-do/register-of-fee-payers/download-the-register/'
const DIR = '.sourcing'
const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const AREAS = areasFrom(arg('--areas', null), 'NG,B49,B50')
const inTerritory = makeTerritoryFilter(AREAS)

const curl = (args) => execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 1 << 28 })

/* The filename carries the publication date and changes daily, so it is read
   off the page rather than hardcoded — a hardcoded URL would 404 tomorrow and
   look like an outage. */
console.log('  finding today\'s register …')
const page = curl(['-sS', '-L', '--max-time', '60', LANDING])
const href = page.match(/href="([^"]*register-of-data-controllers[^"]*\.zip)"/)?.[1]
if (!href) {
  console.error('  Could not find the register link on the ICO download page.')
  console.error(`  Check ${LANDING} — the link text or filename may have changed.`)
  process.exit(1)
}
const url = href.startsWith('http') ? href : new URL(href, 'https://ico.org.uk').toString()
const published = url.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || null
console.log(`  ${url}`)

fs.mkdirSync(DIR, { recursive: true })
const zip = path.join(DIR, 'ico-register.zip')
if (!fs.existsSync(zip)) {
  console.log('  downloading … (about 76 MB)')
  curl(['-sS', '-L', '--max-time', '900', '-o', zip, url])
} else {
  console.log('  using the copy already downloaded')
}

const csv = path.join(DIR, 'ico-register.csv')
if (!fs.existsSync(csv)) {
  const listed = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n')
  const member = listed.find((f) => /\.csv$/i.test(f))
  if (!member) { console.error(`  No CSV inside the archive. Contents: ${listed.join(', ')}`); process.exit(1) }
  execFileSync('unzip', ['-p', zip, member], { stdio: ['ignore', fs.openSync(csv, 'w'), 'inherit'], maxBuffer: 1 << 30 })
}

/* Streamed rather than read whole: the file is ~500 MB unzipped and reading
   it into a string is the difference between working and an OOM. */
const COL = {}
let header = null
let scanned = 0, kept = 0
const rows = []
const tiers = {}

/* "Mrs Eunice Mary Cubbage" is a person; "Emma Housham Limited" is a company
   that happens to be named after one; "Joe's Plumbing" is a business. The test
   is deliberately narrow — a personal title, or two or three capitalised words
   with nothing that marks a trading entity — because the cost of a false
   positive is a lead we never see, and the cost of a false negative is holding
   someone's home address. Narrow means we err toward dropping. */
const TITLE = /^(mr|mrs|miss|ms|mx|dr|prof|professor|sir|dame|rev|reverend|lord|lady|capt|major|col)\b\.?\s/i
const ENTITY = /\b(ltd|limited|plc|llp|lp|cic|cio|company|co|group|services?|solutions?|consult\w*|associates?|partners?|practice|clinic|surgery|centre|center|school|academy|trust|charity|council|club|society|studio|salon|garage|motors|shop|stores?|cafe|bar|kitchen|works?|trading|holdings?|properties|lettings|estates?|agency|media|design|therapy|physio|dental|vets?|veterinary)\b/i

function looksPersonal(name) {
  const n = name.trim()
  if (TITLE.test(n)) return true
  if (ENTITY.test(n)) return false
  const words = n.split(/\s+/)
  if (words.length < 2 || words.length > 3) return false
  // Every word a plain capitalised word: "Helen White", "Nadey Hakim".
  return words.every((w) => /^[A-Z][a-z'’-]+$/.test(w))
}

let personal = 0
const stream = fs.createReadStream(csv, { encoding: 'utf8' })
let carry = ''

/* The DPO fields are named here so the intent is explicit and greppable:
   these are the columns we deliberately do not keep. */
const PERSONAL_FIELDS = /^(DPO|Data_Protection_Officer)/i

for await (const chunk of stream) {
  const lines = (carry + chunk).split('\n')
  carry = lines.pop()
  for (const raw of lines) {
    if (!raw.trim()) continue
    const f = parseCsvLine(raw)
    if (!header) {
      header = f
      f.forEach((name, i) => { if (!PERSONAL_FIELDS.test(name)) COL[name] = i })
      continue
    }
    scanned++
    if (scanned % 250000 === 0) console.log(`  ${scanned.toLocaleString()} scanned, ${kept.toLocaleString()} in territory so far`)

    const postcode = f[COL.Organisation_postcode] || ''
    if (!inTerritory(postcode)) continue

    const name = (f[COL.Organisation_name] || '').trim()
    if (!name) continue

    /* Registration is annual, so every live row carries an end date a year
       after its start. Current means "not yet expired", not "has no end date"
       — a first draft read it the other way round and reported all 22,096
       entries as lapsed, which was the tell. */
    const ends = (f[COL.End_date_of_registration] || '').trim()

    const trading = (f[COL.Trading_names] || '').replace(/\|/g, ' ').trim()

    const address = [1, 2, 3, 4, 5]
      .map((n) => (f[COL[`Organisation_address_line_${n}`]] || '').trim())
      .filter(Boolean).join(', ')

    const tier = (f[COL.Payment_tier] || '').trim()

    /* Data minimisation, applied on read rather than later. If the registered
       name reads as a private individual and there is no trading name, the row
       is a person and a home address rather than a business, and we have no
       reason to hold it. */
    if (!trading && looksPersonal(name)) { personal++; continue }
    tiers[tier] = (tiers[tier] || 0) + 1

    rows.push({
      ico_registration: (f[COL.Registration_number] || '').trim(),
      company: name,
      trading_names: trading || null,
      address,
      postcode: postcode.trim(),
      area: outwardArea(postcode),
      public_authority: (f[COL.Public_authority] || '').trim() || null,
      // Tier 1 skews to sole traders and individuals. Recorded, not acted on:
      // the tier gate in the database decides who may be contacted.
      payment_tier: tier || null,
      registration_start: (f[COL.Start_date_of_registration] || '').trim() || null,
      registration_end: ends || null,
      source: 'public_company_information',
      source_detail: url,
      source_date: published,
    })
    kept++
  }
}

const today = new Date().toISOString().slice(0, 10)
const active = rows.filter((r) => !r.registration_end || r.registration_end >= today)
const out = path.join(DIR, `ico-${published || 'latest'}-${AREAS.join('-').toLowerCase()}.json`)
fs.writeFileSync(out, JSON.stringify({
  register: 'ICO Register of Fee Payers',
  licence: 'OGL v3, except personal data in the dataset, which is not licensed',
  personal_fields_dropped: 'DPO name, email, phone and address are not read from the file',
  personal_rows_dropped: personal,
  areas: AREAS,
  published,
  generated_at: new Date().toISOString(),
  count: active.length,
  candidates: active,
}, null, 1))

console.log(`
  ${scanned.toLocaleString()} registrations scanned
  ${kept.toLocaleString()} in territory, of which ${active.length.toLocaleString()} are still current
  ${personal.toLocaleString()} dropped as a private individual at a home address
  ${Object.entries(tiers).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t || 'no tier'}:${n}`).join('  ')}

  -> ${path.resolve(out)}

  Payment tier is a hint about subscriber type, not an answer. Tier 1 is
  disproportionately sole traders, who are individual subscribers under PECR
  and cannot be emailed without consent. The gate in the database decides.
`)
