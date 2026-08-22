#!/usr/bin/env node
/* Draft one first-contact email per lead, to first-contact-template.md.
   Rewritten 2026-08-22. What was wrong with the previous version, measured
   against the 126 drafts it produced:

     - 72% of every message was word-for-word identical (115 of ~159 words).
     - 60 of 126 bodies were byte-identical to another draft. The largest
       identical cluster was 23 messages.
     - 124 of 126 shared the subject formula "<Company> — one small thing",
       which is not what first-contact-template.md asks for: it wants the
       specific thing named in the subject.
     - No postal address. PECR reg. 23 requires a valid address for opt-out
       and the template's own table says "a PO box or registered office is
       fine; nothing is not".
     - No one-click unsubscribe. Required by the template, by
       11-outreach/deliverability.md s.7, and by the Google/Yahoo/Microsoft
       bulk sender rules.
     - 159 words against a <80-word benchmark for a first touch.
     - "small technology business", dropping the word 01-positioning chose:
       implementation.

   Identical bodies at volume are the single most legible bulk-mail
   fingerprint there is, and they are also the thing LIA-2026-08-v2 s.3 calls
   the necessity limb: without a specific observation the message is bulk, and
   the assessment does not cover bulk.

   WHAT THIS VERSION DOES NOT FIX, AND WILL NOT PRETEND TO
   ------------------------------------------------------
   observe.mjs writes one observation sentence per SIGNAL, not per company.
   All 24 enquiry_form_only leads genuinely share the sentence "your enquiries
   come in through the form on your site". No amount of rewording makes that
   sentence individual, and inventing a detail to make it look individual is
   the thing first-contact-template.md s.2 forbids outright.

   So this generator individualises from facts we actually hold and can show a
   source for -- trading age from the register, town, sector, and the named
   accreditation where one was found -- and it flags every draft whose
   observation is shared with others as `shared_observation: true`. Those are
   the ones a human should put one true line into at approval gate 1, or that
   a re-run of observe.mjs should replace. The flag is the honest version of a
   problem the previous generator hid.

     node scripts/sourcing/draft-emails.mjs --batch 2026-08-21
*/

import fs from 'node:fs'

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d }
const BATCH = arg('--batch', '2026-08-21')
/* The input is the observation set and it is NOT overwritten. An earlier run
   of this rewrite wrote its 77 filtered drafts back over its own 126-draft
   input, and the next run then had nothing left to filter and reported
   dropping nothing. Read-only in, new file out. */
const IN  = arg('--in',  `business/11-outreach/drafts-${BATCH}.json`)
const OUT = arg('--out', `business/11-outreach/first-contact-${BATCH}.json`)

/* Neither of these exists yet and neither may be invented. The postal address
   is a PECR reg. 23 requirement and the unsubscribe URL is a deliverability
   and a PECR one, so a draft carrying these tokens is a draft that cannot be
   sent. That is deliberate: the alternative is a plausible-looking address
   that is not real, in a message whose whole argument is that we only say
   things we can show a source for. deliverability.md s.2 has not chosen an
   outreach domain either, so the unsubscribe host is unknown too. */
const POSTAL_ADDRESS = '{{POSTAL_ADDRESS}}'   // PECR reg. 23. Not yet set.
const UNSUB_URL      = '{{UNSUBSCRIBE_URL}}'  // One-click. Route not yet built.

// ---------------------------------------------------------------------------
// Inputs. Both are in the repo; this stage needs no network.
// ---------------------------------------------------------------------------
const prev = JSON.parse(fs.readFileSync(IN, 'utf8'))
const prevDrafts = Array.isArray(prev) ? prev : (prev.drafts || Object.values(prev)[0])
const loadSql = fs.readFileSync(`business/10-lead-sourcing/batches/load-${BATCH}.sql`, 'utf8')

const leads = new Map()
for (const line of loadSql.split('\n')) {
  if (!/^ {2}\('/.test(line)) continue
  const v = []; let i = line.indexOf('(') + 1, cur = '', inStr = false
  while (i < line.length) {
    const c = line[i]
    if (inStr) {
      if (c === "'" && line[i + 1] === "'") { cur += "'"; i += 2; continue }
      if (c === "'") { inStr = false; v.push(cur); cur = ''; i++; continue }
      cur += c; i++
    } else {
      if (c === "'") { inStr = true; i++; continue }
      if (c === ',') { if (cur.trim()) v.push(cur.trim() === 'null' ? null : cur.trim()); cur = ''; i++; continue }
      if (c === ')') break
      cur += c; i++
    }
  }
  leads.set(v[0], { company: v[0], website: v[1], industry: v[2], location: v[3], signals: v[7] })
}

// ---------------------------------------------------------------------------
// Trading name. Unchanged in behaviour from the previous version: the register
// shouts and carries a legal suffix, and writing "ARNOLD DENTAL CARE LIMITED"
// into a subject line announces where the address came from.
// ---------------------------------------------------------------------------
const LEGAL = /\s+(limited|ltd|plc|llp|l\.?l\.?p\.?|cic|c\.i\.c\.)\.?$/i
const SMALL = new Set(['and', 'of', 'the', 'for', 'at', 'in', 'on', 'to', '&', 'et'])
/* Three-letter all-caps tokens are usually initials -- JPK, DPR, MRZ, CDF --
   but not always, and "Bella Bambini DAY Nursery" in a subject line reads as
   a mail merge that did not finish. There is no reliable rule (AC and AM are
   initials, ANN and OWL are not), so this is a list, extended from the
   all-caps residue actually left in this batch. */
const NOT_INITIALS = new Set(['THE','AND','FOR','NEW','OLD','ONE','TWO','OUR','ALL','BIG','TOP','PRO','ECO','CAR','BUS','SON',
  'ANN','BAR','DAY','ET','OWL','RED','VIN'])
function tradingName(raw) {
  const base = String(raw).replace(LEGAL, '').replace(/\s*\([^)]*\)\s*$/, '').trim()
  if (!/[a-z]/.test(base)) {
    return base.split(/\s+/).map((w, i) => {
      const lower = w.toLowerCase()
      if (i > 0 && SMALL.has(lower)) return lower
      if ((/^[A-Z]{1,3}$/.test(w) && !NOT_INITIALS.has(w)) || /^[A-Z]\.([A-Z]\.?)+$/.test(w)) return w
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    }).join(' ')
  }
  return base
}

// ---------------------------------------------------------------------------
// The observation, recovered from the previous drafts, plus a subject that
// names the specific thing as first-contact-template.md requires.
// ---------------------------------------------------------------------------
const SIGNALS = {
  enquiry_form_only: {
    subject: 'Your enquiry form',
    observed: 'enquiries reach you through the form on your site rather than a named inbox',
    cost: 'Those land in one place and get worked through by hand, and the ones that arrive on a busy day are the ones that wait.',
  },
  downloadable_pricelist: {
    subject: 'Your price list',
    observed: 'your price list goes out as a document to download',
    cost: 'A price list that lives in a document has to be rebuilt and reissued every time one number moves.',
  },
  quote_request: {
    subject: 'Your quote form',
    observed: 'a quote starts with a form on your site',
    cost: 'Quoting from a form usually means somebody rebuilding the same document from scratch each time.',
  },
  hiring: {
    subject: 'The vacancy on your site',
    observed: 'you are advertising on your own careers page',
    cost: 'Hiring is usually when the manual jobs start to hurt, because someone new has to be taught every one of them.',
  },
  accreditations: {
    subject: 'Certificate renewals',
    observed: 'you carry accreditation that has to be kept current',
    cost: 'Renewal dates are the classic thing that sits in a spreadsheet until the month they matter.',
  },
  multi_site: {
    subject: 'Your two sites',
    observed: 'you run more than one website',
    cost: 'Two sites usually means the same information kept in two places and reconciled by hand.',
  },
  phone_booking: {
    subject: 'Taking bookings by phone',
    observed: 'bookings come through a phone call',
    cost: 'Phone bookings are fine until two arrive at once, and then somebody is ringing people back all afternoon.',
  },
  placeholder_site: {
    subject: 'Your holding page',
    observed: 'your website is still a holding page',
    cost: 'That is not a criticism — a holding page usually means the effort is going somewhere else that matters more.',
  },
  register_only: {
    subject: 'Finding you online',
    observed: 'I could not find a website for you at all',
    // "…and noticed I could not find a website" is awkward. This signal is the
    // absence of a thing, so it gets its own frame rather than being forced
    // through the "noticed X" one.
    opener: (name) => `I came across ${name} on the Companies House register and could not find a website for you anywhere.`,
    cost: 'That is a deliberate choice for plenty of businesses, and it usually means the phone and the inbox carry everything.',
  },
  // Deliberately absent: describes_itself. Quoting a business's own strapline
  // back at it is not an observation, it is proof that we looked and found
  // nothing. The previous generator said so in a comment and shipped 49 of
  // them anyway, six of which quoted a page title -- "For Sale", "Home Page",
  // "Main Home". Those are dropped rather than reworded.
}

// A real per-company fact, from the register, to sit beside a shared
// observation. Never estimated: if the merge did not record it, it is omitted.
const tradingYears = (signals) => {
  const m = String(signals || '').match(/trading (\d+) years?/i)
  return m ? Number(m[1]) : null
}
const accreditationName = (body) => (String(body).match(/you carry ([A-Z0-9 ]+) accreditation/) || [])[1] || null

const drafts = []
const dropped = []

// how many drafts share each observation, so the flag below can be honest
const shareCount = {}
for (const d of prevDrafts) if (SIGNALS[d.signal]) shareCount[d.signal] = (shareCount[d.signal] || 0) + 1

for (const d of prevDrafts) {
  const sig = SIGNALS[d.signal]
  if (!sig) { dropped.push({ company: d.company, signal: d.signal, why: 'no checkable observation — see the note on describes_itself above' }); continue }

  const lead = leads.get(d.company) || {}
  const name = tradingName(d.company)
  const town = /alcester|B49|B50|CV37|B80|B9[5-8]/i.test(lead.location || '') ? 'Alcester' : 'Nottingham'
  const years = tradingYears(lead.signals)
  const acc = d.signal === 'accreditations' ? accreditationName(d.body) : null

  const observed = acc ? `you carry ${acc} accreditation, which has to be kept current` : sig.observed
  const subject = `${acc ? `${acc} renewals` : sig.subject}, at ${name}`

  /* One true, per-company sentence to stand beside the shared observation.
     Trading age comes from the register, so it is checkable; where the merge
     did not record one, the sentence is simply left out rather than replaced
     with something vaguer. */
  /* A second identical sentence is a second fingerprint. The first cut of this
     had three phrasings and "Over N years that adds up" duly turned up in most
     of the batch. Selection is by a stable hash of the company name, so the
     same input still produces the same draft -- varied, not random. */
  const hash = [...d.company].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  const grounding = !years ? '' : ' ' + (
    years >= 20
      ? ['After ' + years + ' years that is a great many repetitions.',
         'Twenty years in, it is rarely the first time anyone has noticed it.',
         'On a ' + years + '-year-old business it has usually been worked around rather than fixed.'][hash % 3]
      : years <= 4
        ? ['At ' + years + ' years in, it is the sort of thing worth settling early.',
           'Early enough that fixing it now costs less than fixing it later.',
           'It is a good age to sort it, before the volume makes it expensive.'][hash % 3]
        : ['Over ' + years + ' years that adds up.',
           'Across ' + years + ' years it is a fair amount of time.',
           years + ' years of doing it by hand is a lot of afternoons.'][hash % 3])

  /* Kept deliberately short. The previous version ran to 159 words against a
     <80-word benchmark for a first touch, and two of its paragraphs -- the
     pitch and the close, 76 words between them -- were identical across every
     draft. Shortening them is not cosmetic: the fixed proportion of the
     message is exactly what makes a batch look like a batch. */
  const body = [
    `Hi,`,
    ``,
    sig.opener ? sig.opener(name) : `I came across ${name} on the Companies House register and noticed ${observed}.`,
    ``,
    `${sig.cost}${grounding}`,
    ``,
    `I'm Alex — I run n.abl, a small technology implementation business in ${town}. We take one job that is costing a business time or accuracy and fix it properly.`,
    ``,
    `No reply needed if that is not useful. If it is, I'll spend half an hour on it with you, free, and say honestly if it is not worth doing.`,
    ``,
    `Alex`,
    `n.abl — ${POSTAL_ADDRESS}`,
    `hello@nabl.agency · nabl.agency`,
    ``,
    `You're receiving this because we found ${name} on the Companies House register. What we hold and why: nabl.agency/privacy`,
    `Unsubscribe: ${UNSUB_URL}`,
  ].join('\n')

  drafts.push({
    company: d.company,
    email: d.email || null,
    signal: d.signal,
    subject,
    body,
    // True where the observation sentence is shared with other drafts in this
    // batch. A human should add one true line at approval gate 1, or a re-run
    // of observe.mjs should replace it.
    shared_observation: (shareCount[d.signal] || 0) > 1 && !acc,
    // Two counts, because they are judged differently: the prose is what a
    // reader weighs, the footer is what PECR and Article 14 require and is
    // not optional however long it is.
    words: body.split('\nAlex\n')[0].trim().split(/\s+/).length,
    words_with_footer: body.trim().split(/\s+/).length,
    blockers: [ 'postal_address_not_set', 'unsubscribe_url_not_built' ],
  })
}

fs.writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), ruleset: 'first-contact-template.md', drafts, dropped }, null, 1))

const bodies = new Set(drafts.map(d => d.body))
const subjects = new Set(drafts.map(d => d.subject))
console.log(`drafts written : ${drafts.length}  -> ${OUT}`)
console.log(`dropped        : ${dropped.length} (${[...new Set(dropped.map(d => d.signal))].join(', ')})`)
console.log(`distinct bodies: ${bodies.size} of ${drafts.length}${bodies.size === drafts.length ? '  (no two identical)' : '  ** DUPLICATES REMAIN **'}`)
console.log(`distinct subjects: ${subjects.size} of ${drafts.length}`)
console.log(`prose words    : min ${Math.min(...drafts.map(d => d.words))}, mean ${Math.round(drafts.reduce((a, d) => a + d.words, 0) / drafts.length)}, max ${Math.max(...drafts.map(d => d.words))}  (was 159 incl. footer)`)
console.log(`incl. footer   : mean ${Math.round(drafts.reduce((a, d) => a + d.words_with_footer, 0) / drafts.length)}  — footer is PECR reg.23 + Art.14, not trimmable`)
console.log(`flagged shared_observation: ${drafts.filter(d => d.shared_observation).length} — need one human line at gate 1`)
