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
const SKIP = Number(arg('--skip', 0)) || 0
const BAND = arg('--band', 'first')
const PERMIT = has('--permit')
const DRY = has('--dry-run')

/* Short labels. These repeat on every row and the long forms made a batch
   mostly boilerplate; the full titles and URLs live in
   business/10-lead-sourcing/maximum-volume-plan.md section 2, which is where
   anyone auditing provenance would look anyway. */
const REGISTER_URL = {
  companies_house: 'Companies House bulk register',
  public_company_information: 'ICO / FSA / CQC / Charity Commission open data',
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
/* Prefers the JSONL checkpoint over the summary JSON, for the same reason the
   websites are read that way: the summary is only written when extraction
   finishes, so during a run it is stale, and after a partial run it does not
   exist at all. */
const contacts = new Map()
const CONTACTS_JSONL = CONTACTS.replace(/\.json$/, '.jsonl')
if (fs.existsSync(CONTACTS_JSONL)) {
  for (const line of fs.readFileSync(CONTACTS_JSONL, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try { const r = JSON.parse(line); contacts.set(r.name, r) } catch { /* torn */ }
  }
} else if (fs.existsSync(CONTACTS)) {
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
  const source_detail = site
    ? `${REGISTER_URL[source]}; site confirmed by ${site.confirmed_by?.join(' + ')}`
    : REGISTER_URL[source]
  const source_date = Object.values(candidate.source_date || {}).sort().pop() || null

  /* The best address we hold, and where it came from. A trading address beats
     a self-declared one beats a registered office, and a footer postcode from
     the company's own site beats all three. */
  const webPostcode = contact?.postcodes?.[0] || null
  const location = [candidate.contact_address, candidate.contact_postcode].filter(Boolean).join(', ')

  return {
    company: candidate.name,
    website: site?.website || candidate.website || null,
    industry: (candidate.sic || [])[0]?.replace(/^\d+\s*-\s*/, '') || candidate.business_type || null,
    location: location || null,
    estimated_size: null,          // never estimated; see scoring-model.md
    business_type: null,
    lead_score: 50,                // the CRM's neutral default, not a judgement
    status: 'New Lead',
    /* Short on purpose. The triage reasons already live in `signals`, and
       repeating them here made a 100-lead batch 132 KB of mostly duplication.
       Notes should carry what signals cannot: where it came from, and
       anything that disagrees with the register. */
    notes: [
      `${REGISTER_URL[source]}, ${source_date || 'undated'}, ${candidate.contact_address_kind || 'no'} address.`,
      webPostcode && webPostcode !== candidate.contact_postcode
        ? `Website gives ${webPostcode}, register says ${candidate.contact_postcode}.` : null,
      contact?.named_emails_discarded
        ? `${contact.named_emails_discarded} named address(es) found and not kept.` : null,
    ].filter(Boolean).join(' '),
    /* The three that most distinguish this lead, not all nine. The full list
       is reproducible from the triage at any time, and repeating it per row
       made the batch mostly duplication — "ICO tier 1, so a micro business"
       is true of 20,034 of them and tells a reader nothing. */
    signals: (candidate.triage_for || [])
      .filter((r) => !/^ICO tier|^core territory|^on \d+ registers/.test(r))
      .slice(0, 3).join('; ') || null,

    subscriber_type,
    subscriber_type_evidence,
    lawful_basis: 'not_personal_data',
    source,
    source_detail,
    source_date,
    privacy_notice_status: 'not_required',
    marketing_status: PERMIT ? 'permitted' : 'do_not_contact',
    _email: contact?.emails?.[0] || candidate.email || null,
    _phone: contact?.phones?.[0] || candidate.phone || null,
  }
}

/* How contactable a candidate is, as one number, so the best records go into
   the CRM first.

   The first version took the top N off a sorted file and produced three leads
   whose names began with a digit, none of which had a website or a contact of
   any kind. They were postal-workable — the address is the route — but a lead
   that shows as empty in the CRM is a lead nobody works, and "it is fine
   really" is not an answer to that. */
const sectorHint = (c) => (c.triage_for || []).find((r) => r.startsWith('sector hint:')) || ''
const hasSectorHint = (c) => Boolean(sectorHint(c))

/* The ICP scores "strong fit, both territories" above "additionally strong
   around Nottingham", 15 points against 12, and the triage marks the second
   kind with a colon — "care:nottingham". Honouring that distinction matters
   more than it looks: SIC 88 covers a commercial domiciliary care agency and
   a women's refuge equally, and only one of them buys software. */
const isCoreSector = (c) => {
  const hint = sectorHint(c).replace('sector hint:', '')
  return hint.split(',').some((h) => h.trim() && !h.includes(':'))
}

function reachScore(c) {
  const site = websites.get(c.name)
  const contact = contacts.get(c.name)
  let n = 0

  /* Fit first, and by a wide margin. A first version scored only how
     contactable a candidate was and produced a batch of thirty that were
     every one of them a charity or community organisation — because the
     charities file is the only register that carries email addresses, so
     "has an email" and "is a charity" were very nearly the same fact.

     None of them were in the ideal customer profile. That is the same mistake
     the old AI CRM made, reached from the opposite direction: it optimised
     for a plausible-looking signal and filled the pipeline with businesses we
     do not serve. Contactability is worthless without fit. */
  if (isCoreSector(c)) n += 60
  else if (hasSectorHint(c)) n += 25

  /* A registered charity is down-weighted rather than excluded. Some are
     genuinely good customers — a housing association runs the same processes
     as a letting agent — but most are small, grant-funded and have no budget
     line for this, and the charities file is the only register carrying email
     addresses, so without this they flood every batch. */
  if (c.charity_number) n -= 45

  if (contact?.emails?.length || c.email) n += 40   // a free channel, today
  if (contact?.phones?.length || c.phone) n += 20
  if (site || c.website) n += 20
  if (c.contact_address_kind === 'trading') n += 15
  else if (c.contact_address_kind === 'declared') n += 10
  else if (c.contact_address_kind === 'registered') n += 2
  if (c.sources?.length > 1) n += 5
  return n
}

/* A postal address alone is a real route and this is not a crawl-or-nothing
   rule — but a registered office is usually the accountant's, and a lead with
   nothing else is not one anybody will pick up. --any-address includes them. */
const MIN_REACH = has('--any-address') ? 1 : 10
/* --best-regardless takes the top N by rank with no requirement for a
   published contact route at all. Those leads are postal-only in practice —
   we hold a name and an address and nothing else — which is a perfectly good
   lead, just not one you can email today. */
const BEST_REGARDLESS = Number(arg('--best-regardless', 0)) || 0

let pool = triaged.filter((c) => (BAND === 'all' ? c.triage !== 'excluded' : c.triage === BAND))
/* Out-of-profile candidates are excluded rather than merely ranked down.
   Ranking alone is not enough when one sector dominates a signal: the
   charities file supplies almost every register-held email address, so a pure
   ranking hands the whole batch to charities however the weights are set.
   --any-sector promotes without the filter. */
if (!has('--any-sector')) pool = pool.filter(hasSectorHint)
const ranked = pool.map((c) => ({ c, reach: reachScore(c) }))
  .filter((x) => (BEST_REGARDLESS ? true : x.reach >= MIN_REACH))
  .sort((a, b) => b.reach - a.reach)

/* Sectors take turns, rather than the batch going to whoever ranks highest.

   Twice now a single sector has taken a whole batch, and both times for the
   same structural reason: whichever register happens to publish contact
   details decides which sector looks most reachable. Charities first, because
   the Charity Commission file is the only one carrying email addresses. Then
   care, once CQC arrived with phone numbers and websites. Both times the
   obvious fix was "weight fit more heavily", and both times a different
   sector simply won instead — the top 40 came back 21 professional services.

   Taking turns needs no weight and no cap, and the next register we add
   cannot skew it. Each sector offers its best-ranked candidate in turn; one
   that runs out stops being offered. It over-represents small sectors
   relative to the pool, which is the right trade for a batch somebody has to
   work: forty leads across trades, manufacturing and professional services is
   a week of varied calls, and forty care agencies is one conversation had
   forty times. */
const bySector = new Map()
for (const { c } of ranked) {
  const key = sectorHint(c).replace('sector hint:', '').split(',')[0]?.trim() || 'unclassified'
  if (!bySector.has(key)) bySector.set(key, [])
  bySector.get(key).push(c)
}
/* Already-promoted names are skipped so a second batch does not repeat the
   first. Matched on company name, which is what the CRM inserts on. */
const ALREADY = new Set(
  fs.existsSync('.sourcing/promoted.txt')
    ? fs.readFileSync('.sourcing/promoted.txt', 'utf8').split('\n').map((x) => x.trim()).filter(Boolean)
    : [],
)

const picked = []
/* Core sectors are offered first within each round. The ICP scores "strong
   fit, both territories" above "additionally strong around Nottingham", and
   the triage marks the second kind with a colon. Taking turns keeps the
   spread; going first keeps the priority. */
const queues = [...bySector.entries()]
  .sort(([a], [b]) => Number(a.includes(':')) - Number(b.includes(':')))
  .map(([, q]) => q)
let offeredAny = true
while (picked.length < LIMIT && offeredAny) {
  offeredAny = false
  for (const q of queues) {
    if (picked.length >= LIMIT) break
    let next = q.shift()
    while (next && ALREADY.has(next.name)) next = q.shift()
    if (next) { picked.push(next); offeredAny = true }
  }
}
pool = picked

const leads = pool.map(toLead)
const withSite = leads.filter((l) => l.website).length
const withRoute = leads.filter((l) => l._email || l._phone).length
const corporate = leads.filter((l) => l.subscriber_type === 'corporate').length

/* A contact row so the lead is not blank in the CRM. Named "General
   enquiries", which public.has_named_individual recognises as a route rather
   than a person — so these leads stay tier A and keep the not_personal_data
   basis honest. Attaching a real name here would silently move every one of
   them into tier B and engage UK GDPR. */
const contactRows = leads
  .filter((l) => l._email || l._phone)
  .map((l) => ({ company: l.company, name: 'General enquiries', email: l._email, phone: l._phone }))

/* Counted from the batch that was actually built, not from the tally the
   picker kept — the fill-the-remainder pass below the cap can add to it. */
const sectorTally = Object.entries(
  pool.reduce((acc, c) => {
    const k = sectorHint(c).replace('sector hint:', '').split(',')[0]?.trim() || 'unclassified'
    return { ...acc, [k]: (acc[k] || 0) + 1 }
  }, {}),
).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')

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
  contactRows.length ? [
    '-- One contact row per lead that has a published route, so the lead is not',
    '-- blank in the CRM. "General enquiries" is recognised by',
    '-- public.has_named_individual as a route rather than a person.',
    'insert into public.sales_contacts (lead_id, name, role, email, phone, source, confidence)',
    contactRows.map((r) =>
      `select id, 'General enquiries', 'Published contact route', ${q(r.email)}, ${q(r.phone)}, 'published on the register or their own website', 90
   from public.sales_leads where company = ${q(r.company)}`).join('\nunion all\n'),
    ';',
    '',
  ].join('\n') : '',
].join('\n')

/* A machine-readable copy of the batch, so observe.mjs can read the same
   leads without re-deriving the ranking and risking a different answer. */
fs.writeFileSync(OUT.replace(/\.sql$/, '-batch.json'), JSON.stringify(
  leads.map((l, i) => ({
    company: l.company,
    website: l.website,
    industry: l.industry,
    location: l.location,
    email: l._email,
    phone: l._phone,
    trading_years: (pool[i]?.triage_for || []).find((r) => /^trading \d+ years/.test(r))?.match(/\d+/)?.[0] || null,
    sector: (pool[i]?.triage_for || []).find((r) => r.startsWith('sector hint:'))?.replace('sector hint: ', '') || null,
  })), null, 1))

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
  ${withRoute.toLocaleString()} with a published contact route, which get a contact row
  marketing_status: ${PERMIT ? 'permitted (--permit was passed)' : 'do_not_contact (pass --permit to change)'}
  sectors: ${sectorTally}
${DRY ? '' : `\n  -> ${path.resolve(OUT)}`}
`)
