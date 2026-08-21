#!/usr/bin/env node
/* The Charity Commission register of charities.

   The reason this exists and the website sweep does not replace it: this file
   already contains the email address and the phone number. No domain guessing,
   no crawling, no 27% hit rate — a download and a filter, and every row that
   has a contact route hands it over.

   The catch, and it is a serious one. The contact address on a small charity
   is very often a trustee's home, and the contact email is very often a
   trustee personally. That is personal data about a named individual at a
   residential address, which is the exact thing the ICO fetch goes out of its
   way not to keep. So the same rule applies here and is applied on read:
   a named personal email is counted and discarded, and only role addresses
   are kept.

     node scripts/sourcing/fetch-charities.mjs
     node scripts/sourcing/fetch-charities.mjs --areas all
*/

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { outwardArea, makeTerritoryFilter, areasFrom } from './lib.mjs'

const URL_ = 'https://ccewuksprdoneregsadata1.blob.core.windows.net/data/json/publicextract.charity.zip'
const DIR = '.sourcing'
const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const AREAS = areasFrom(arg('--areas', null), 'NG,B49,B50')
const inTerritory = makeTerritoryFilter(AREAS)

/* Same rule as the website extraction: a role address is the organisation, a
   named one is a person. Kept identical deliberately — two different answers
   to "is this a person" is how a tier A record quietly becomes tier B. */
const ROLE = /^(info|hello|hi|enquiries|enquiry|contact|admin|office|mail|team|reception|accounts|support|help|bookings|secretary|chair|treasurer|trustees|general|post|charity)$/i

fs.mkdirSync(DIR, { recursive: true })
const zip = path.join(DIR, 'charities.zip')
if (!fs.existsSync(zip)) {
  console.log('  downloading … (about 57 MB)')
  execFileSync('curl', ['-sS', '-L', '--max-time', '900', '-o', zip, URL_])
} else console.log('  using the copy already downloaded')

const listed = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n')
const member = listed.find((f) => /\.json$/i.test(f)) || listed[0]
console.log(`  reading ${member}`)
const raw = execFileSync('unzip', ['-p', zip, member], { encoding: 'utf8', maxBuffer: 1 << 30 })

/* The file opens with a UTF-8 byte order mark, which JSON.parse rejects. */
const rows = JSON.parse(raw.replace(/^\uFEFF/, ''))
let scanned = 0, kept = 0, personalEmails = 0
const out = []

for (const r of rows) {
  scanned++
  // A charity can appear more than once: the main registration and its linked
  // subsidiaries share a number and differ by linked_charity_number.
  if (Number(r.linked_charity_number) !== 0) continue
  if (r.charity_registration_status !== 'Registered') continue

  const postcode = r.charity_contact_postcode || ''
  if (!inTerritory(postcode)) continue

  const name = (r.charity_name || '').trim()
  if (!name) continue

  const address = [1, 2, 3, 4, 5]
    .map((n) => (r[`charity_contact_address${n}`] || '').trim())
    .filter(Boolean).join(', ')

  const rawEmail = (r.charity_contact_email || '').trim().toLowerCase()
  let email = null
  if (rawEmail && rawEmail.includes('@')) {
    if (ROLE.test(rawEmail.split('@')[0])) email = rawEmail
    else personalEmails++
  }

  /* A charity that is also a registered company is a corporate subscriber on
     the face of the register, exactly like any other company. One that is not
     is unincorporated, and its subscriber type is not established here. */
  const companyNumber = (r.charity_company_registration_number || '').toString().trim() || null

  out.push({
    charity_number: String(r.registered_charity_number || ''),
    company_number: companyNumber,
    charity_is_cio: r.charity_is_cio === true || r.charity_is_cio === 'true' || null,
    company: name,
    address,
    postcode: postcode.trim(),
    area: outwardArea(postcode),
    email,
    phone: (r.charity_contact_phone || '').trim() || null,
    website: (r.charity_contact_web || '').trim() || null,
    registered_since: r.date_of_registration ? String(r.date_of_registration).slice(0, 10) : null,
    source: 'public_company_information',
    source_detail: URL_,
    source_date: new Date().toISOString().slice(0, 10),
  })
  kept++
}

const file = path.join(DIR, `charities-${new Date().toISOString().slice(0, 10)}-${AREAS.join('-').toLowerCase()}.json`)
fs.writeFileSync(file, JSON.stringify({
  register: 'Charity Commission register of charities',
  licence: 'OGL v3',
  areas: AREAS,
  generated_at: new Date().toISOString(),
  personal_emails_discarded: personalEmails,
  count: out.length,
  candidates: out,
}, null, 1))

const withEmail = out.filter((r) => r.email).length
const withPhone = out.filter((r) => r.phone).length
console.log(`
  ${scanned.toLocaleString()} rows scanned
  ${kept.toLocaleString()} registered main charities in territory
  ${withEmail.toLocaleString()} with a role email address
  ${withPhone.toLocaleString()} with a phone number
  ${personalEmails.toLocaleString()} personal email addresses found and discarded

  -> ${path.resolve(file)}

  The contact address on a small charity is often a trustee's home. Treat the
  address as personal data unless something else says otherwise.
`)
