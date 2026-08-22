#!/usr/bin/env node
/* Score a batch of leads against business/10-lead-sourcing/scoring-model.md.

   Class 1 work, as that document insists: a pure function from a facts record
   to an integer and a breakdown. No network, no API key, no cost, and the same
   input produces the same output today and in six months.

   WHAT THIS SCORER DOES NOT DO, AND WHY IT SAYS SO OUT LOUD
   --------------------------------------------------------
   The model is worth 100 points across five dimensions. Two of them cannot be
   measured from anything we hold, and one can only be measured in part. Rather
   than let a null quietly read as a zero and drag every lead under the discard
   line, each lead records `points_available` alongside its score.

     Geography       20   measurable — trading postcode
     Sector          15   measurable — the business's own description
     Signals         30   partly — see the mapping note below
     Size            20   NOT measurable. No employee_count is held, and s.5.2
                          forbids estimating one. Scores 0 for everyone.
     Decision access 15   NOT measurable, and not by accident. s.5.5 awards 15
                          for a named, contactable director. The compliance
                          design forbids holding one: lawful_basis is
                          `not_personal_data`, which 202608210003 only lets
                          stand while has_named_individual() is false. The
                          sourcing run recorded "named address(es) found and
                          not kept" against 42 leads for exactly that reason.
                          So this dimension is structurally unreachable, and
                          the ICP and the compliance schema disagree with each
                          other. That is a decision for a human, not a default
                          for a scorer.

   A score of 30 therefore means "30 of the 65 points we were able to look at",
   not "30 out of 100, discard". Banding is deliberately NOT applied: the
   70/50 thresholds in s.6 were calibrated against a full 100 and mean nothing
   against 65. `band` is emitted as `unbanded_incomplete_coverage`.

   THE SIGNAL MAPPING
   ------------------
   s.5.4 lists 21 signal codes. observe.mjs emits 10 codes of its own and they
   are mostly not the same codes — it was written to find something true to say
   in a letter, not to feed this table. Only the mappings below are defensible;
   the rest score zero rather than being forced into the nearest-looking slot.
   Guessing here would inflate scores with evidence that does not exist.

     node scripts/sourcing/score.mjs --batch 2026-08-21
     node scripts/sourcing/score.mjs --batch 2026-08-21 --sql .sourcing/scores.sql
*/

import fs from 'node:fs'

const RULESET = 'scoring-model.md@2026-08-22'

const arg = (f, d) => { const i = process.argv.indexOf(f); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d }

// ---------------------------------------------------------------------------
// Territory. s.5.1 requires a postcode-district lookup, not town-name matching
// against free text. The ICP gives towns, so the districts below are the
// translation of ICP s.2 and are the one judgement call in this file.
// ---------------------------------------------------------------------------
const NOTTS_CORE = ['NG1','NG2','NG3','NG4','NG5','NG6','NG7','NG8','NG9','NG10','NG11','NG12','NG13','NG14','NG15','NG16','DE7']
const NOTTS_EDGE = ['NG17','NG18','NG19','NG20','NG21','NG22','NG24','LE11','LE12','DE1','DE21','DE22','DE23','DE24']
const ALC_CORE   = ['B49','B50','B80','B95','B96','B97','B98','CV37']
const ALC_EDGE   = ['WR11','WR7','B60','B61','B47','B90','B91','B92','B93','B94','CV31','CV32','CV34','CV35']

const district = (loc) => {
  if (!loc) return null
  // last postcode-looking token wins: the trading address ends with it
  const m = [...String(loc).toUpperCase().matchAll(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*\d[A-Z]{2}\b/g)]
  return m.length ? m[m.length - 1][1] : null
}

const territory = (loc) => {
  const d = district(loc)
  if (!d) return 'unknown'
  if (NOTTS_CORE.includes(d)) return 'nottingham_core'
  if (ALC_CORE.includes(d))   return 'alcester_core'
  if (NOTTS_EDGE.includes(d)) return 'nottingham_edge'
  if (ALC_EDGE.includes(d))   return 'alcester_edge'
  return 'outside'
}

// ---------------------------------------------------------------------------
// Sector, from ICP s.4. SIC does not decide sector (s.5.3) — it may only narrow
// a rule match, so these patterns run over the business's own trading
// description and the sector hint the merge recorded.
// ---------------------------------------------------------------------------
const SECTOR_RULES = [
  // Order matters: the most specific phrasing wins. SIC descriptions are full
  // of words that belong to another sector -- "Renting and leasing of
  // construction machinery" is hire, not trades or manufacturing, and "Taxi
  // operation" is logistics, not tax advice. Word boundaries throughout: an
  // early draft matched /tax/ against "Taxi" and filed five cab firms as
  // professional services.
  ['hire',          /renting and leasing|\bhire\b|tool hire|plant hire/i],
  ['logistics',     /\btaxi\b|transport|haulage|freight|removal|courier|warehous|logistics|passenger land/i],
  ['care',          /\bcare\b|nursing|health|social work|medical|dental|psycholog|domiciliary/i],
  ['training',      /education|training|nursery|school|pre-primary|tuition|dance/i],
  ['print',         /\bprint|signage|graphics|reproduction of sound/i],
  ['hospitality',   /restaurant|\bpub\b|public houses|\bbar\b|licensed|takeaway|take-away|catering|hotel|accommodation|holiday|tavern|cafe|\bclub\b|food services/i],
  ['agricultural',  /\bfarm|agricultur|equine|horses|forestry|silvicultur|growing of|raising of|camel|irrigation/i],
  ['property',      /real estate|letting|\bproperty\b|facilities management|cleaning of buildings|estate agenc/i],
  ['professional',  /account|\baudit|\btax\b|tax consultancy|solicit|legal|survey|architect|planning consult|insurance|recruit|consultancy|employment placement|management consult|business support/i],
  ['trades',        /electric|plumb|heating|hvac|floor|roof|scaffold|groundwork|installation|joinery|carpentry|screed|asphalt|builders|construction|security systems|repair of/i],
  ['manufacturing', /manufactur|engineering|fabricat|caravan|furniture|food products|bakery|bread|\bmeat\b|chemical|machinery/i],
  ['wholesale',     /wholesale|distribution|trade suppl|agents involved in the sale|non-specialised/i],
  ['retail_weak',   /\bretail\b|hairdress|beauty|salon/i],
]

const STRONG_BOTH  = new Set(['trades','manufacturing','wholesale','professional','property'])
const STRONG_NOTTS = new Set(['logistics','training','care','print','hire'])
const STRONG_ALC   = new Set(['agricultural','hospitality'])
const WEAK         = new Set(['retail_weak'])

const KNOWN = new Set(SECTOR_RULES.map(([n]) => n))

/* The merge already recorded a sector hint, and it is an ORDERED,
   comma-separated list whose tokens are these same sector names, each
   optionally suffixed with the territory that makes it strong --
   "professional, care:nottingham". Its first token is the merge's own primary
   judgement, so it wins. Running the regexes over the hint instead threw that
   ordering away and filed a management consultancy as care, because "care"
   appeared later in its own hint.

   The SIC description is the fallback, and only the fallback: s.5.3 says SIC
   codes are self-selected, frequently stale and do not decide sector. Where
   they are all we have, the sector is worth exactly what the register's own
   categorisation is worth -- SERVIS PERSONNEL LTD, a staffing agency filed
   under "Other accommodation", is the standing example. */
const sectorOf = (industry, signals) => {
  const hint = (String(signals || '').match(/sector hint:\s*([^;]+)/i) || [])[1] || ''
  for (const tok of hint.split(',')) {
    const name = tok.trim().split(':')[0].trim().toLowerCase()
    if (KNOWN.has(name)) return name
  }
  for (const [name, re] of SECTOR_RULES) if (re.test(industry || '')) return name
  return null
}

const sectorPoints = (sector, terr) => {
  if (!sector) return [0, 'sector null']
  if (WEAK.has(sector)) return [0, `weak fit (${sector})`]
  if (STRONG_BOTH.has(sector)) return [15, `strong fit both territories (${sector})`]
  const notts = terr.startsWith('nottingham'), alc = terr.startsWith('alcester')
  if (STRONG_NOTTS.has(sector)) return notts ? [12, `additionally strong for Nottingham (${sector})`] : [6, `neutral outside Nottingham (${sector})`]
  if (STRONG_ALC.has(sector))   return alc   ? [12, `additionally strong for Alcester (${sector})`]   : [6, `neutral outside Alcester (${sector})`]
  return [6, `neutral (${sector})`]
}

// ---------------------------------------------------------------------------
// Signals. Only defensible mappings; everything else scores nothing.
// ---------------------------------------------------------------------------
const SIGNAL_MAP = {
  downloadable_pricelist: { code: 'dated_pdf_pricelist', tier: 1, points: 10 },
  phone_booking:          { code: 'quote_by_phone',      tier: 1, points: 10 },
}
const UNMAPPED = ['enquiry_form_only','quote_request','hiring','accreditations','multi_site','placeholder_site','register_only','describes_itself']

// ---------------------------------------------------------------------------
const BATCH = arg('--batch', '2026-08-21')
const loadSql = fs.readFileSync(`business/10-lead-sourcing/batches/load-${BATCH}.sql`, 'utf8')
const draftsJson = JSON.parse(fs.readFileSync(`business/11-outreach/drafts-${BATCH}.json`, 'utf8'))
const drafts = Array.isArray(draftsJson) ? draftsJson : (draftsJson.drafts || Object.values(draftsJson)[0])
const signalByCompany = new Map(drafts.map(d => [d.company, d.signal]))

// parse the value rows of the lead inserts: ('company', 'website', 'industry', 'location', 50, ...)
const rows = []
for (const line of loadSql.split('\n')) {
  if (!/^ {2}\('/.test(line)) continue
  const vals = []
  let i = line.indexOf('(') + 1, cur = '', inStr = false
  while (i < line.length) {
    const c = line[i]
    if (inStr) {
      if (c === "'" && line[i + 1] === "'") { cur += "'"; i += 2; continue }
      if (c === "'") { inStr = false; vals.push(cur); cur = ''; i++; continue }
      cur += c; i++
    } else {
      if (c === "'") { inStr = true; i++; continue }
      if (c === ',') { if (cur.trim()) vals.push(cur.trim() === 'null' ? null : cur.trim()); cur = ''; i++; continue }
      if (c === ')' && !inStr) break
      cur += c; i++
    }
  }
  rows.push({ company: vals[0], website: vals[1], industry: vals[2], location: vals[3], signals: vals[7] })
}

const results = rows.map(r => {
  const terr = territory(r.location)
  const breakdown = {}
  let available = 0, score = 0

  // dimension 1: geography (always measurable — every lead has an address)
  available += 20
  const geo = terr.endsWith('_core') ? 20 : terr.endsWith('_edge') ? 10 : 0
  breakdown.geography = { points: geo, of: 20, territory: terr, district: district(r.location) }
  score += geo

  // dimension 2: sector
  const sector = sectorOf(r.industry, r.signals)
  const [sp, why] = sectorPoints(sector, terr)
  if (sector) available += 15
  breakdown.sector = { points: sp, of: 15, sector, basis: why, measured: !!sector }
  score += sp

  // dimension 3: observable signals, capped at 30
  const obs = signalByCompany.get(r.company) || null
  const mapped = obs ? SIGNAL_MAP[obs] : null
  if (obs) available += 30
  const sig = mapped ? Math.min(30, mapped.points) : 0
  // The prose explaining each of these lives in 202608220001_lead_scoring.sql
  // and in this file's header, not repeated across 150 rows of jsonb.
  breakdown.signals = {
    points: sig, of: 30,
    observed: obs,
    mapped_to: mapped ? mapped.code : null,
    unmapped: !!(obs && !mapped),
  }
  score += sig

  // dimensions 4 and 5: not measurable. Recorded, weighted zero, excluded from available.
  breakdown.size = { points: 0, of: 20, measured: false, reason: 'no_employee_count' }
  breakdown.decision_access = { points: 0, of: 15, measured: false, reason: 'no_named_individual_by_design' }

  const disqualified = terr === 'outside' ? 'outside_territory' : null

  return {
    company: r.company, score, available, disqualified,
    band: disqualified ? 'disqualified' : 'unbanded_incomplete_coverage',
    breakdown,
  }
})

// ---------------------------------------------------------------------------
const dq = results.filter(r => r.disqualified)
const ok = results.filter(r => !r.disqualified)
const pct = (n, d) => d ? Math.round(100 * n / d) : 0

console.log(`ruleset ${RULESET}`)
console.log(`leads scored: ${results.length}`)
console.log(`disqualified (outside_territory): ${dq.length}`)
if (dq.length) for (const d of dq.slice(0, 20)) console.log(`   ${d.breakdown.geography.district || '??'}  ${d.company}`)
console.log()
console.log(`of the 100-point model, points actually available per lead: ${ok.length ? Math.round(ok.reduce((a, r) => a + r.available, 0) / ok.length) : 0} (mean)`)
console.log(`  size (20) and decision access (15) are unmeasurable — see header`)
console.log()
const tally = {}
for (const r of ok) { const k = `${r.score}/${r.available}`; tally[k] = (tally[k] || 0) + 1 }
console.log('score distribution (earned/available):')
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${k.padEnd(9)} ${v}`)
console.log()
const sigScored = ok.filter(r => r.breakdown.signals.points > 0).length
console.log(`leads earning any signal points: ${sigScored} of ${ok.length} (${pct(sigScored, ok.length)}%) — the rest emit codes s.5.4 does not define`)
console.log(`leads with a sector determined:  ${ok.filter(r => r.breakdown.sector.measured).length} of ${ok.length}`)
console.log(`territories: ` + Object.entries(ok.reduce((a, r) => (a[r.breakdown.geography.territory] = (a[r.breakdown.geography.territory] || 0) + 1, a), {})).map(([k, v]) => `${k}=${v}`).join(', '))

const sqlOut = arg('--sql', null)
if (sqlOut) {
  // One statement, not 150. The jsonb key names are written once in the query
  // rather than repeated in every row of the payload.
  const esc = s => s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`
  const tuples = results.map(r => {
    const b = r.breakdown
    return `(${esc(r.company)},${r.score},${r.available},${esc(r.band)},` +
           `${b.geography.points},${esc(b.geography.territory)},${esc(b.geography.district)},` +
           `${b.sector.points},${esc(b.sector.sector)},${esc(b.sector.basis)},${b.sector.measured},` +
           `${b.signals.points},${esc(b.signals.observed)},${esc(b.signals.mapped_to)},${b.signals.unmapped})`
  })
  const sql =
`update public.sales_leads l set
  lead_score = v.score,
  lead_score_points_available = v.available,
  lead_score_band = v.band,
  lead_score_ruleset = ${esc(RULESET)},
  lead_score_at = now(),
  lead_score_breakdown = jsonb_build_object(
    'geography',       jsonb_build_object('points', v.geo_pts, 'of', 20, 'territory', v.territory, 'district', v.district),
    'sector',          jsonb_build_object('points', v.sec_pts, 'of', 15, 'sector', v.sector, 'basis', v.sec_basis, 'measured', v.sec_measured),
    'signals',         jsonb_build_object('points', v.sig_pts, 'of', 30, 'observed', v.observed, 'mapped_to', v.mapped_to, 'unmapped', v.unmapped),
    'size',            jsonb_build_object('points', 0, 'of', 20, 'measured', false, 'reason', 'no_employee_count'),
    'decision_access', jsonb_build_object('points', 0, 'of', 15, 'measured', false, 'reason', 'no_named_individual_by_design')
  )
from (values
${tuples.join(',\n')}
) as v(company, score, available, band, geo_pts, territory, district, sec_pts, sector, sec_basis, sec_measured, sig_pts, observed, mapped_to, unmapped)
where l.company = v.company;`
  fs.mkdirSync(sqlOut.replace(/\/[^/]+$/, ''), { recursive: true })
  fs.writeFileSync(sqlOut, sql + '\n')
  console.log(`\nwrote 1 update statement covering ${tuples.length} leads to ${sqlOut}`)
}
