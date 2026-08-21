#!/usr/bin/env node
/* Turn sourced candidates into CRM leads, with the compliance fields already
   answered.

   The schema will not let a lead be contacted without a subscriber type, a
   lawful basis, a source and a source date. Every one of those is derivable
   from the registers we sourced from, so a human should not have to type them
   eight thousand times — but nor should they be invented to satisfy a
   constraint. What follows is the mapping, and where it says "unknown" it
   means unknown.

   SUBSCRIBER TYPE. A company number from the Companies House register proves a
   corporate subscriber. Its absence proves nothing: a business on the ICO or
   FSA register but not at Companies House is probably a sole trader, possibly
   a partnership, occasionally a trust. So it is recorded as `unknown`, which
   the send gate treats as an individual subscriber and refuses to email. That
   is the fail-closed answer and it costs us nothing, because post reaches them
   anyway.

   LAWFUL BASIS. `not_personal_data`, because none is held: the extraction
   stage discards named email addresses and the ICO fetch never reads the DPO
   columns. PMA-2026-08-v1 section 3. The gate re-checks this rather than
   trusting it — attach a person to one of these leads and it stops sending.

   PRIVACY NOTICE. `not_required`. Article 14 is owed when personal data is
   obtained from someone other than the data subject. A letter to "The Owner"
   processes none.

   MARKETING STATUS. `do_not_contact` unless --permit is passed. Promotion is
   not approval, and the default should be the safe one.

     node scripts/sourcing/promote.mjs --dry-run --limit 20
     node scripts/sourcing/promote.mjs --limit 500 --out .sourcing/promote.sql
*/

import fs from 'node:fs'
import path from 'node:path'

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const has = (flag) => process.argv.includes(flag)

const DIR = '.sourcing'
const TRIAGE = arg('--triage', path.join(DIR, 'triaged.json'))
const WEBSITES = arg('--websites', path.join(DIR, 'websites-all.jsonl'))
const CONTACTS = arg('--contacts', path.join(DIR, 'websites-all-contacts.json'))
const OUT = arg('--out', path.join(DIR, 'promote.sql'))
const LIMIT = Number(arg('--limit', 500))
const BAND = arg('--band', 'first')
const PERMIT = has('--permit')
const DRY = has('--dry-run')

const REGISTER_URL = {
  companies_house: 'Companies House Free Company Data Product',
  public_company_information: 'ICO Register of Fee Payers / FSA Food Hygiene Rating Scheme',
}

/* Numbers are emitted unquoted. Postgres would cast '50' into an integer
   column happily enough, but a literal whose type depends on a cast is a
   literal that will one day meet a column that does not cast. */
const q = (v) => {
  if (v === null || v === undefined || v === '') return 'null'
  if (typeof v === 'number') return String(v)
  return `'${String(v).replace(/'/g, "''")}'`
}

/* ---- inputs ---- */
const triaged = JSON.parse(fs.readFileSync(TRIAGE, 'utf8')).candidates
const byName = new Map(triaged.map((c) => [c.name, c]))

/* The website sweep writes JSONL as it goes, so this reads a run in progress
   as happily as a finished one. */
const websites = new Map()
if (fs.existsSync(WEBSITES)) {
  for (const line of fs.readFileSync(WEBSITES, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try { const r = JSON.parse(line); if (r.outcome === 'confirmed') websites.set(r.name, r) } catch { /* torn line */ }
  }
}
const contacts = new Map()
if (fs.existsSync(CONTACTS)) {
  for (const r of JSON.parse(fs.readFileSync(CONTACTS, 'utf8')).results || []) contacts.set(r.name, r)
}

function toLead(candidate) {
  const site = websites.get(candidate.name)
  const contact = contacts.get(candidate.name)

  const corporate = Boolean(candidate.company_number)
  const subscriber_type = corporate ? 'corporate' : 'unknown'
  const subscriber_type_evidence = corporate
    ? `Companies House ${candidate.company_number}`
    : 'not found on the Companies House register; legal form unestablished'

  const source = candidate.sources?.includes('companies_house')
    ? 'companies_house' : 'public_company_information'
  const source_detail = [REGISTER_URL[source], site ? `website confirmed at ${site.website} by ${site.confirmed_by?.join(' and ')}` : null]
    .filter(Boolean).join('; ')
  const source_date = Object.values(candidate.source_date || {}).sort().pop() || null

  /* The best address we hold, and where it came from. A trading address beats
     a self-declared one beats a registered office, and a footer postcode from
     the company's own site beats all three. */
  const webPostcode = contact?.postcodes?.[0] || null
  const location = [candidate.contact_address, candidate.contact_postcode].filter(Boolean).join(', ')

  return {
    company: candidate.name,
    website: site?.website || null,
    industry: (candidate.sic || [])[0]?.replace(/^\d+\s*-\s*/, '') || candidate.business_type || null,
    location: location || null,
    estimated_size: null,          // never estimated; see scoring-model.md
    business_type: null,
    lead_score: 50,                // the CRM's neutral default, not a judgement
    status: 'New Lead',
    notes: [
      `Sourced ${source_date || 'undated'} from ${REGISTER_URL[source]}.`,
      candidate.triage_for?.length ? `Triaged "${candidate.triage}" because: ${candidate.triage_for.join('; ')}.` : null,
      candidate.contact_address_kind ? `Address is the ${candidate.contact_address_kind} one.` : null,
      webPostcode && webPostcode !== candidate.contact_postcode
        ? `Their website gives ${webPostcode}, which differs from the register.` : null,
      contact?.emails?.length ? `Published contact route: ${contact.emails.join(', ')}.` : null,
      contact?.phones?.length ? `Phone: ${contact.phones.join(', ')}.` : null,
      contact?.named_emails_discarded
        ? `${contact.named_emails_discarded} named email address(es) were found and deliberately not kept.` : null,
    ].filter(Boolean).join(' '),
    signals: candidate.triage_for?.join('; ') || null,

    subscriber_type,
    subscriber_type_evidence,
    lawful_basis: 'not_personal_data',
    source,
    source_detail,
    source_date,
    privacy_notice_status: 'not_required',
    marketing_status: PERMIT ? 'permitted' : 'do_not_contact',
    _contact: contact?.emails?.[0] || null,
  }
}

/* Only candidates we can actually reach. A lead with no address and no
   contact route is a row in a table, not a prospect. */
let pool = triaged.filter((c) => (BAND === 'all' ? c.triage !== 'excluded' : c.triage === BAND))
pool = pool.filter((c) => c.contact_postcode || websites.has(c.name))
pool = pool.slice(0, LIMIT)

const leads = pool.map(toLead)
const withSite = leads.filter((l) => l.website).length
const withRoute = leads.filter((l) => l._contact).length
const corporate = leads.filter((l) => l.subscriber_type === 'corporate').length

const COLS = ['company', 'website', 'industry', 'location', 'lead_score', 'status', 'notes', 'signals',
  'subscriber_type', 'subscriber_type_evidence', 'lawful_basis', 'source', 'source_detail',
  'source_date', 'privacy_notice_status', 'marketing_status']

const sql = [
  '-- Generated by scripts/sourcing/promote.mjs. Every compliance field is',
  '-- derived from a register, never guessed. See the header of that file.',
  `-- ${leads.length} leads, ${corporate} corporate on the face of the register,`,
  `-- ${leads.length - corporate} whose legal form is unestablished and which`,
  '-- therefore cannot be emailed, only written to.',
  '',
  `insert into public.sales_leads (${COLS.join(', ')}, subscriber_type_checked_at) values`,
  leads.map((l) => `  (${COLS.map((c) => q(l[c])).join(', ')}, now())`).join(',\n'),
  'on conflict do nothing;',
  '',
].join('\n')

if (DRY) {
  console.log('\n  DRY RUN — nothing written\n')
  for (const l of leads.slice(0, 5)) {
    console.log(`  ${l.company}`)
    console.log(`    ${l.subscriber_type} — ${l.subscriber_type_evidence}`)
    console.log(`    ${l.marketing_status} / ${l.lawful_basis} / notice ${l.privacy_notice_status}`)
    console.log(`    ${l.location || 'no address'}`)
    console.log(`    ${l.notes}`)
    console.log()
  }
} else {
  fs.writeFileSync(OUT, sql)
}

console.log(`  ${leads.length.toLocaleString()} candidates promoted from band "${BAND}"
  ${corporate.toLocaleString()} corporate on the face of the register — emailable, subject to the gate
  ${(leads.length - corporate).toLocaleString()} legal form unestablished — postal only, by design
  ${withSite.toLocaleString()} with a confirmed website
  ${withRoute.toLocaleString()} with a published contact route
  marketing_status: ${PERMIT ? 'permitted (--permit was passed)' : 'do_not_contact (pass --permit to change)'}
${DRY ? '' : `\n  -> ${path.resolve(OUT)}`}
`)
