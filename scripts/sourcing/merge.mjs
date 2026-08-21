#!/usr/bin/env node
/* Merge every sourced register into one candidate universe.

   Each register knows something the others do not. Companies House has the
   legal entity, the SIC codes and the incorporation date, but its address is
   the registered office — very often an accountant's, which is useless for
   knowing where a business actually trades. The FSA has the trading name and
   the trading address, but only for food businesses and with no company
   number. Joined, a café that is also a limited company becomes one record
   carrying both: who to write to, where they actually are, and what they do.

   Matching is deliberately conservative. Two records merge on an exact
   postcode plus name key, or on a name key distinctive enough to stand alone.
   Everything else stays separate. A false merge is worse than a duplicate:
   a duplicate costs a wasted contact, a false merge writes to the wrong firm.

     node scripts/sourcing/merge.mjs
     node scripts/sourcing/merge.mjs --out .sourcing/universe.json
*/

import fs from 'node:fs'
import path from 'node:path'
import { nameKey, isDistinctiveName, postcodeKey, outwardArea } from './lib.mjs'

const DIR = '.sourcing'
const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const OUT = arg('--out', path.join(DIR, 'universe.json'))

/* Each register lands in a common shape. The register-specific fields are
   kept under their own key so nothing is lost in the flattening.

   Address provenance is the point of the whole exercise, so it is carried
   explicitly rather than inferred. Three kinds, in descending order of how
   likely they are to reach a human:

     trading    - the FSA's premises address. Where the business physically is.
     declared   - the ICO's. The address the organisation gave for itself, so
                  usually real, but nothing forces it to be the trading one.
     registered - Companies House. For a small business very often the
                  accountant's, and a letter there does not reach the owner.

   All three are kept and `contact_*` resolves to the best available. */
const KIND_ORDER = ['trading', 'declared', 'registered']

function normalise(row, kind) {
  const name = row.company || row.name || ''
  const postcode = postcodeKey(row.postcode)
  const address = row.address || row.address_line_1 || ''
  const at = (k) => (kind === k ? address : '')
  const pc = (k) => (kind === k ? postcode : '')
  return {
    // Companies House wraps a trading name in quotes inside the legal name:
    // `"4RENT ESTATES" LTD`. Stripping only the outer pair leaves a stray one
    // mid-string, so all of them go.
    name: name.replace(/"/g, '').replace(/\s+/g, ' ').trim(),
    name_key: nameKey(name),
    registered_address: at('registered'),
    registered_postcode: pc('registered'),
    declared_address: at('declared'),
    declared_postcode: pc('declared'),
    trading_address: at('trading'),
    trading_postcode: pc('trading'),
    town: row.town || '',
    lat: row.lat || null,
    lon: row.lon || null,
    sources: [row.source].filter(Boolean),
    source_detail: { [row.source]: row.source_detail },
    source_date: { [row.source]: row.source_date },
    company_number: row.company_number || null,
    company_category: row.company_category || null,
    incorporated: row.incorporated || null,
    sic: row.sic || null,
    fhrs_id: row.fhrs_id || null,
    business_type: row.business_type || null,
    local_authority: row.local_authority || null,
    hygiene_rating: row.hygiene_rating || null,
    ico_registration: row.ico_registration || null,
    charity_number: row.charity_number || null,
    cqc_location_id: row.cqc_location_id || null,
    provider: row.provider || null,
    specialisms: row.specialisms || null,
    // Contact details that arrived with the register rather than from a
    // website. The charities file and the CQC directory both carry them, which
    // is why they are worth more per minute than any amount of crawling.
    email: row.email || null,
    phone: row.phone || null,
    website: row.website || null,
    trading_names: row.trading_names || row.trading_name || null,
    payment_tier: row.payment_tier || null,
    public_authority: row.public_authority || null,
    // Set once the record is final; see resolveContact below.
    contact_address: '',
    contact_postcode: '',
    contact_address_kind: '',
    area: '',
  }
}

/* Where we would actually write. Best available kind wins — a letter to the
   accountant does not reach the owner. */
function resolveContact(r) {
  const kind = KIND_ORDER.find((k) => r[`${k}_postcode`] || r[`${k}_address`]) || ''
  r.contact_address = kind ? r[`${kind}_address`] : ''
  r.contact_postcode = kind ? r[`${kind}_postcode`] : ''
  r.contact_address_kind = kind
  r.area = outwardArea(r.contact_postcode)
  return r
}

/* Later sources fill gaps; they never overwrite a value that is already
   there. That is safe now that the two address kinds live in separate fields:
   a trading address lands in an empty `trading_address` rather than losing to
   the registered one that got there first. */
function absorb(into, from) {
  for (const [k, v] of Object.entries(from)) {
    if (k === 'sources') { for (const s of v) if (!into.sources.includes(s)) into.sources.push(s); continue }
    if (k === 'source_detail' || k === 'source_date') { Object.assign(into[k], v); continue }
    if (into[k] === null || into[k] === '' || into[k] === undefined) into[k] = v
  }
  return into
}

function loadRegister(file, kind) {
  const raw = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'))
  const rows = raw.candidates || raw.rows || (Array.isArray(raw) ? raw : [])
  return rows.map((r) => normalise(r, kind)).filter((r) => r.name && r.name_key)
}

/* Files are ingested in a fixed order so a rerun produces the same universe.
   Companies House first: it is the spine, and it is the only source with a
   company number to key a CRM record on. */
const REGISTERS = [
  { source: 'companies_house', kind: 'registered', match: /^candidates-.*\.json$/ },
  { source: 'public_company_information', kind: 'declared', match: /^ico-.*\.json$/ },
  { source: 'public_company_information', kind: 'declared', match: /^charities-.*\.json$/ },
  { source: 'public_company_information', kind: 'trading', match: /^cqc-.*\.json$/ },
  { source: 'public_company_information', kind: 'trading', match: /^fsa-.*\.json$/ },
]

const OUTPUTS = new Set([path.basename(OUT), 'universe.json', 'triaged.json', 'shortlist.json'])
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && !OUTPUTS.has(f))
const ordered = []
for (const reg of REGISTERS) {
  for (const f of files.filter((f) => reg.match.test(f)).sort()) ordered.push({ file: f, source: reg.source, kind: reg.kind })
}
/* Anything not matching a declared register is SKIPPED and named, never
   ingested. An earlier version swallowed unrecognised files as source
   'unknown', which was convenient right up until it read its own downstream
   output back in: triaged.json went in as a register and the universe grew
   from 81,286 to 95,056 without a single error. Adding a source should be a
   line in REGISTERS, not a file appearing in a directory. */
const unclaimed = files.filter((f) => !ordered.some((o) => o.file === f))

if (unclaimed.length) {
  console.log(`  skipped, not a declared register: ${unclaimed.sort().join(', ')}`)
}

if (!ordered.length) {
  console.error(`No register files in ${DIR}/. Run the fetch scripts first.`)
  process.exit(1)
}

const byExact = new Map()      // "NAMEKEY|POSTCODE" -> record
const byName = new Map()       // "NAMEKEY" -> [records], only distinctive keys
const universe = []
const stats = { read: 0, merged_exact: 0, merged_name: 0, dropped_ambiguous: 0, per_source: {} }

for (const { file, source, kind } of ordered) {
  const rows = loadRegister(file, kind)
  let added = 0, mergedHere = 0
  console.log(`\n${file}  (${rows.length.toLocaleString()} rows)`)

  for (const row of rows) {
    stats.read++
    const pc = row.trading_postcode || row.declared_postcode || row.registered_postcode
    const exactKey = pc ? `${row.name_key}|${pc}` : ''

    let target = exactKey ? byExact.get(exactKey) : undefined
    if (target) { absorb(target, row); stats.merged_exact++; mergedHere++; continue }

    /* No postcode match. A distinctive name can still merge, but only when
       exactly one record carries it — two "PENNINE JOINERY SERVICES" in
       different postcodes are genuinely ambiguous and both are kept. */
    if (isDistinctiveName(row.name_key)) {
      const pool = byName.get(row.name_key)
      if (pool && pool.length === 1 && !pool[0].sources.includes(row.sources[0])) {
        absorb(pool[0], row)
        stats.merged_name++; mergedHere++
        if (exactKey) byExact.set(exactKey, pool[0])
        continue
      }
      if (pool && pool.length > 1) stats.dropped_ambiguous++
    }

    universe.push(row)
    added++
    if (exactKey) byExact.set(exactKey, row)
    if (isDistinctiveName(row.name_key)) {
      const pool = byName.get(row.name_key)
      if (pool) pool.push(row); else byName.set(row.name_key, [row])
    }
  }

  stats.per_source[source] = (stats.per_source[source] || 0) + rows.length
  console.log(`  ${added.toLocaleString()} new, ${mergedHere.toLocaleString()} merged into existing`)
}

for (const r of universe) resolveContact(r)

/* A record is only worth contacting if there is somewhere to contact. */
const withAddress = universe.filter((r) => r.contact_postcode || r.contact_address)
const reachable = universe.filter((r) => r.contact_address_kind !== 'registered' && r.contact_address_kind)
const multi = universe.filter((r) => r.sources.length > 1)

const out = {
  generated_at: new Date().toISOString(),
  registers: ordered.map((o) => o.file),
  read: stats.read,
  count: universe.length,
  merged_exact: stats.merged_exact,
  merged_name: stats.merged_name,
  ambiguous_name_kept_separate: stats.dropped_ambiguous,
  corroborated_by_two_registers: multi.length,
  not_a_registered_office: reachable.length,
  candidates: universe,
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1))

const byArea = {}
for (const r of universe) byArea[r.area] = (byArea[r.area] || 0) + 1

console.log(`
  ${stats.read.toLocaleString()} rows read across ${ordered.length} register${ordered.length === 1 ? '' : 's'}
  ${stats.merged_exact.toLocaleString()} merged on name + postcode
  ${stats.merged_name.toLocaleString()} merged on a distinctive name alone
  ${stats.dropped_ambiguous.toLocaleString()} name collisions kept separate rather than guessed
  ${universe.length.toLocaleString()} distinct businesses
  ${multi.length.toLocaleString()} corroborated by two registers
  ${withAddress.length.toLocaleString()} with an address to write to
  ${reachable.length.toLocaleString()} of those an address the business gave for itself, not a registered office

  ${Object.entries(byArea).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([a, n]) => `${a}:${n}`).join('  ')}

  -> ${path.resolve(OUT)}
`)
