#!/usr/bin/env node
/* Decide which of the 81,286 candidates are worth enriching.

   This is NOT the scoring model in business/10-lead-sourcing/scoring-model.md,
   and it must not be confused with it. That model scores a candidate on
   evidence — employee counts, observable signals, a named decision maker —
   none of which exists until a website has been fetched and read. Fetching
   81,286 websites politely is days of work, so something has to decide the
   order, and that is all this does.

   The distinction is load-bearing rather than pedantic. The scoring model says
   in terms that "SIC codes do not decide sector. They are self-selected and
   frequently stale. They may narrow the candidates for a rule match, and that
   is all." Narrowing the candidates is exactly this job. So the output is a
   `triage` band, never a score, and nothing downstream may treat it as one.

   Everything here comes from the registers, so it costs nothing and needs no
   network. Every candidate keeps the reasons it was banded, because a ranking
   you cannot argue with is a ranking you cannot fix.

     node scripts/sourcing/triage.mjs
     node scripts/sourcing/triage.mjs --limit 2000 --out .sourcing/shortlist.json
*/

import fs from 'node:fs'
import path from 'node:path'

const DIR = '.sourcing'
const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const IN = arg('--in', path.join(DIR, 'universe.json'))
const OUT = arg('--out', path.join(DIR, 'triaged.json'))
const LIMIT = Number(arg('--limit', 0)) || 0

/* SIC prefixes for the strong-fit sectors in the ICP, section 4. Prefixes
   rather than exact codes: 43210 electrical, 43220 plumbing and 43290 other
   installation are one sector to us and all start 432. */
const SIC = {
  trades: ['41', '42', '432', '433', '439', '4520', '801', '802', '803'],
  manufacturing: ['10', '13', '14', '15', '16', '17', '18', '20', '22', '23',
                  '24', '25', '26', '27', '28', '29', '30', '31', '32', '33'],
  wholesale: ['46'],
  professional: ['69', '70', '71', '73', '742', '78', '82'],
  property: ['681', '682', '683', '811', '812'],
}
/* Additionally strong in one territory only. The ICP is written that way and
   the code has to respect it: logistics is a Nottingham signal, agriculture
   and hospitality are Alcester ones. */
const SIC_NOTTINGHAM = { logistics: ['49', '52', '53'], training: ['85'], care: ['86', '87', '88'], print: ['181', '182'], hire: ['77'] }
const SIC_ALCESTER = { agricultural: ['01', '02', '03', '4661'], automotive: ['293', '3030'], hospitality: ['55', '561', '563', '932'] }

/* Weak fit. Not disqualifying — the ICP says deprioritise, not exclude — but
   they go to the back so the enrichment budget is not spent on them. */
const SIC_WEAK = ['47', '9602', '5610', '5630', '9313']

const ALCESTER = new Set(['B49', 'B50'])
const NOTTINGHAM_CORE = new Set(['NG1', 'NG2', 'NG3', 'NG5', 'NG7', 'NG8', 'NG9'])

const startsAny = (code, prefixes) => prefixes.some((p) => code.startsWith(p))

function sicHits(candidate, territory) {
  const codes = (candidate.sic || []).map((s) => String(s).replace(/\D.*$/, '').trim()).filter(Boolean)
  if (!codes.length) return { matched: [], weak: false }
  const matched = []
  for (const [name, prefixes] of Object.entries(SIC)) {
    if (codes.some((c) => startsAny(c, prefixes))) matched.push(name)
  }
  const local = territory === 'alcester' ? SIC_ALCESTER : SIC_NOTTINGHAM
  for (const [name, prefixes] of Object.entries(local)) {
    if (codes.some((c) => startsAny(c, prefixes))) matched.push(`${name}:${territory}`)
  }
  return { matched, weak: matched.length === 0 && codes.some((c) => startsAny(c, SIC_WEAK)) }
}

const universe = JSON.parse(fs.readFileSync(IN, 'utf8')).candidates
const today = new Date().toISOString().slice(0, 10)
const thisYear = Number(today.slice(0, 4))

const triaged = universe.map((c) => {
  const reasons = []
  const against = []
  const territory = ALCESTER.has(c.area) ? 'alcester' : 'nottingham'

  /* Reachability first, because it is the only one that decides whether we can
     do anything at all. An address that is the accountant's is not a route to
     the owner, and a letter sent there is wasted postage. */
  if (c.contact_address_kind === 'trading') reasons.push('trading address')
  else if (c.contact_address_kind === 'declared') reasons.push('address the business gave for itself')
  else against.push('only a registered office, which is often an accountant')

  /* Two registers agreeing is the cheapest proof that a business is real and
     currently operating: it filed at Companies House AND pays an ICO fee, or
     trades from premises a council has inspected. */
  if (c.sources.length > 1) reasons.push(`on ${c.sources.length} registers`)

  const { matched, weak } = sicHits(c, territory)
  if (matched.length) reasons.push(`sector hint: ${matched.join(', ')}`)
  if (weak) against.push('SIC suggests a weak-fit sector')

  /* ICO payment tier is a size band the organisation declared itself, which
     beats estimating one. Tier 1 is the micro band and is where the ICP sits;
     Tier 3 is large and is a disqualifier in the scoring model's terms. */
  if (c.payment_tier === 'Tier 1') reasons.push('ICO tier 1, so a micro business')
  else if (c.payment_tier === 'Tier 2') reasons.push('ICO tier 2')
  else if (c.payment_tier === 'Tier 3') against.push('ICO tier 3, too large')

  if (c.public_authority === 'Y') against.push('a public authority')

  /* Age. Old enough to have accumulated the manual process we fix, not so new
     that there is no process yet. Incorporation date only — never inferred. */
  const year = c.incorporated ? Number(c.incorporated.slice(0, 4)) : null
  const age = year ? thisYear - year : null
  if (age !== null && age >= 3 && age <= 30) reasons.push(`trading ${age} years`)
  else if (age !== null && age < 2) against.push('incorporated within the last two years')

  if (NOTTINGHAM_CORE.has(c.area) || ALCESTER.has(c.area)) reasons.push('core territory')

  /* Bands, not a number. A number invites arithmetic on facts that do not
     support it; a band says only "look at these first".

     Ordered by what the enrichment step still has to find. A candidate we can
     already reach and that looks like the right sector needs nothing more to
     be worth a letter. One with a sector hint but only a registered office is
     worth a website fetch precisely because the website will supply the real
     address. One we can reach but know nothing about is worth a look. The rest
     wait.

     An earlier version made corroboration its own tier, which produced a band
     that could never be occupied: reachability comes from the ICO and the FSA,
     and an ICO match is itself the second register. Dead logic in a ranking is
     worse than a coarse ranking, because nobody notices it is not running. */
  const reachable = c.contact_address_kind !== 'registered'
  const band =
    against.some((a) => a.startsWith('ICO tier 3') || a === 'a public authority') ? 'excluded'
      : reachable && matched.length ? 'first'
      : matched.length ? 'second'
      : reachable ? 'third'
      : 'last'

  return { ...c, territory, triage: band, triage_for: reasons, triage_against: against }
})

const ORDER = ['first', 'second', 'third', 'last', 'excluded']
triaged.sort((a, b) => ORDER.indexOf(a.triage) - ORDER.indexOf(b.triage)
  || b.triage_for.length - a.triage_for.length)

const kept = LIMIT ? triaged.slice(0, LIMIT) : triaged
fs.writeFileSync(OUT, JSON.stringify({
  generated_at: new Date().toISOString(),
  source: IN,
  note: 'Triage bands decide enrichment order only. They are not the scoring '
      + 'model in business/10-lead-sourcing/scoring-model.md and must not be '
      + 'used as a score: nothing here is evidenced to that standard.',
  count: kept.length,
  bands: Object.fromEntries(ORDER.map((b) => [b, triaged.filter((t) => t.triage === b).length])),
  candidates: kept,
}, null, 1))

const counts = ORDER.map((b) => [b, triaged.filter((t) => t.triage === b).length])
console.log(`
  ${universe.length.toLocaleString()} candidates triaged

${counts.map(([b, n]) => `  ${b.padEnd(9)} ${String(n).padStart(7)}`).join('\n')}

  -> ${path.resolve(OUT)}

  Bands decide what to enrich first. They are not scores: employee counts,
  observable signals and a named decision maker do not exist yet, and the
  scoring model refuses to run without them.
`)

for (const b of ['first', 'second']) {
  const sample = triaged.filter((t) => t.triage === b).slice(0, 3)
  if (!sample.length) continue
  console.log(`  ${b}:`)
  for (const s of sample) console.log(`    ${s.name} — ${s.triage_for.join('; ')}`)
}
console.log()
