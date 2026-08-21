#!/usr/bin/env node
/* Draft one email per lead. Nothing is sent, and nothing here can send.

   Each draft is built around the observation observe.mjs found on that
   business's own website. A lead with no observation gets NO draft — the
   first-contact template says a message built on "businesses like yours often
   struggle with admin" is a leaflet, and producing one anyway would quietly
   undo the whole point of looking.

   The middle paragraph is chosen from the observation, not generated freely.
   Every sentence below is one somebody has decided is true and defensible,
   which is what makes the batch reviewable: read the eight paragraphs once
   rather than a hundred and fifty emails.

     node scripts/sourcing/draft-emails.mjs
*/

import fs from 'node:fs'
import path from 'node:path'

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const LEADS = JSON.parse(fs.readFileSync(arg('--leads', '.sourcing/all150.json'), 'utf8'))
const OBS = JSON.parse(fs.readFileSync(arg('--obs', '.sourcing/observations.json'), 'utf8')).results
const OUT = arg('--out', '.sourcing/drafts.json')

/* What we would actually offer, per signal. Kept short and specific, with no
   number in it we could not stand behind — the template forbids those. */
const OFFER = {
  enquiry_form_only:
    'Those usually land in one inbox and get worked through by hand. The fix is normally small: the enquiry lands where it needs to be, tagged and chased, without anyone retyping it.',
  quote_request:
    'Quoting from a form usually means someone rebuilding the same document each time. That is the kind of job worth doing once properly.',
  phone_booking:
    'Phone bookings are fine until two come at once. Somewhere to see the diary and take a booking without ringing back is usually a morning a week.',
  hiring:
    'Hiring is usually the point where the manual bits start to hurt, because a new person has to be taught them.',
  downloadable_pricelist:
    'A price list that lives as a document has to be rebuilt and reissued every time something changes. That is usually worth fixing once.',
  multi_site:
    'More than one site usually means the same information kept in two places and reconciled by hand.',
  accreditations:
    'Certificates with renewal dates are the classic thing that sits in a spreadsheet until the month it matters.',
  placeholder_site:
    'That is not a criticism — a holding page usually means the work is going somewhere else, which is exactly the sort of thing worth an hour of someone else’s time.',
  describes_itself:
    'Most businesses doing that have two or three jobs that eat a morning a week and nobody has ever had time to fix.',
  register_only:
    'Most businesses your size have two or three jobs that eat a morning a week and nobody has ever had time to fix.',
}

/* Register names are upper case and carry a legal suffix: "ARNOLD DENTAL CARE
   LIMITED". Writing that in a subject line announces where it came from and
   reads as a mail merge, which is the one thing the whole batch is trying not
   to be. */
const LEGAL = /\s+(limited|ltd|plc|llp|l\.?l\.?p\.?|cic|c\.i\.c\.)\.?$/i
const SMALL = new Set(['and', 'of', 'the', 'for', 'at', 'in', 'on', 'to', '&'])
/* Words that are all-caps in the register but are words, not initials. The
   initials rule below would otherwise leave "THE Lounge @ 26". */
const NOT_INITIALS = new Set(['THE', 'AND', 'FOR', 'NEW', 'OLD', 'ONE', 'TWO', 'OUR', 'ALL', 'BIG', 'TOP', 'PRO', 'ECO', 'CAR', 'BUS', 'SON'])
function tradingName(raw) {
  const base = String(raw).replace(LEGAL, '').replace(/\s*\([^)]*\)\s*$/, '').trim()
  if (!/[a-z]/.test(base)) {
    return base.split(/\s+/).map((w, i) => {
      const lower = w.toLowerCase()
      if (i > 0 && SMALL.has(lower)) return lower
      // Initials and short all-caps tokens are usually genuinely initials.
      if ((/^[A-Z]{1,3}$/.test(w) && !NOT_INITIALS.has(w)) || /^[A-Z]\.([A-Z]\.?)+$/.test(w)) return w
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    }).join(' ')
  }
  return base
}

const obsBy = new Map(OBS.map((o) => [o.company, o]))
const drafts = []
const skipped = []

for (const lead of LEADS) {
  const o = obsBy.get(lead.company)
  if (!o?.observation) { skipped.push({ company: lead.company, why: o?.signal || 'not observed' }); continue }

  const town = /alcester|B49|B50/i.test(lead.location || '') ? 'Alcester' : 'Nottingham'
  const name = tradingName(lead.company)
  const subject = o.signal === 'placeholder_site'
    ? `A quick thought about ${name}`
    : `${name} — one small thing`

  /* describes_itself is the weakest signal and must not pretend otherwise.
     Quoting a business's own description back at it as though it were an
     insight — "I noticed your site describes you as arnold dental & implant
     centre" — is worse than saying nothing, because it reads as a machine
     that looked and found nothing. It is used as a plain segue instead. */
  const opening = o.signal === 'describes_itself'
    ? `Your site calls you "${o.observation.replace(/^your site describes you as /, '')}", so this may or may not land.`
    : o.signal === 'register_only'
      ? `I came across ${name} on the Companies House register and ${o.observation}.`
      : `I had a look at your site and noticed ${o.observation}.`

  const body = [
    `Hi,`,
    ``,
    `I'm Alex — I run n.abl, a small technology business in ${town}.`,
    ``,
    opening,
    ``,
    OFFER[o.signal] || OFFER.describes_itself,
    ``,
    `We take one job that is costing a business time or accuracy and build the right fix for it. Sometimes that is an automation, sometimes a small piece of software, sometimes it is setting up something you already pay for properly.`,
    ``,
    `If it is worth twenty minutes, reply and I'll suggest a time. If not, no reply needed — I won't chase you.`,
    ``,
    `Alex`,
    `n.abl · nabl.agency`,
    ``,
    `You can stop us contacting you at any time by replying or emailing hello@nabl.agency. We hold only what your company publishes on the Companies House register, the ICO register or your own website — nabl.agency/privacy.`,
  ].join('\n')

  drafts.push({ company: lead.company, email: lead.email || null, signal: o.signal, subject, body })
}

fs.writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), drafts, skipped }, null, 1))

const bySignal = {}
for (const d of drafts) bySignal[d.signal] = (bySignal[d.signal] || 0) + 1
console.log(`
  ${drafts.length} drafts written, ${skipped.length} leads deliberately left without one
  ${drafts.filter((d) => d.email).length} have an email address to send to

${Object.entries(bySignal).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${String(v).padStart(4)}  ${k}`).join('\n')}

  Nothing is sent. Drafts land in the CRM unapproved, and the send path asks
  the compliance gate before anything opens.

  -> ${path.resolve(OUT)}
`)
