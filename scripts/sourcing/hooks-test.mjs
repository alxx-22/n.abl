#!/usr/bin/env node
/* The hook library's rules, asserted.

   hooks.mjs states FACTS; scan.mjs writes the sentence. So these check
   which facts a lead yields and in what order, because the order is
   what tells the model which one is strongest.

   The one that matters most is the food hygiene score. A rating below 4
   must never reach the fact sheet at all — scan.mjs refuses to let a
   model quote a withheld score, but the safest place to withhold it is
   before it is sent. business/11-outreach/hooks.md §2 explains why
   naming a bad grade in a cold letter is a poke with a citation.

     node scripts/sourcing/hooks-test.mjs
*/
import { leadFacts, templateHook, REGISTER_HOOKS } from './hooks.mjs'

const cases = [
  ['CQC with specialism', { cqc_location_id: 'L-123', specialisms: 'Personal care; Dementia' }, 'cqc_registered'],
  ['CQC, no specialism',  { cqc_location_id: 'L-123' }, 'cqc_registered'],
  ['ICO and no website',  { ico_registration: 'ZA123456' }, 'ico_no_website'],
  ['ICO but has website', { ico_registration: 'ZA123456', website: 'https://x.co.uk', trading_years: '3' }, null],
  ['FSA rated 5',         { fhrs_id: '99', hygiene_rating: '5' }, 'food_premises'],
  ['FSA rated 1',         { fhrs_id: '99', hygiene_rating: '1' }, 'food_premises'],
  ['charity',             { charity_number: '1122334' }, 'registered_charity'],
  ['trades elsewhere',    { trading_address: '14 Mill Lane, Arnold', registered_address: 'c/o Smith & Co, Derby' }, 'trades_away_from_office'],
  ['same address',        { trading_address: '14 Mill Lane', registered_address: '14 Mill Lane' }, null],
  ['20yr no website',     { trading_years: '20' }, 'long_established_no_website'],
  ['20yr with website',   { trading_years: '20', website: 'https://x.co.uk' }, 'long_established'],
  ['3yr with website',    { trading_years: '3', website: 'https://x.co.uk' }, null],
  ['nothing at all',      {}, null],
]

let fail = 0
const ok = (name, cond, detail = '') => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}${cond ? '' : '  → ' + detail}`)
  if (!cond) fail++
}

console.log('\nWHICH FACT LEADS\n')
for (const [name, lead, expect] of cases) {
  const got = leadFacts(lead)[0]?.key ?? null
  ok(`${name.padEnd(20)} → ${got ?? '(none)'}`, got === expect, `expected ${expect ?? '(none)'}`)
}

console.log('\nALL FACTS, NOT JUST THE BEST ONE\n')
const both = leadFacts({ cqc_location_id: 'L1', trading_years: '22', website: 'https://x.co.uk' })
ok('a CQC provider trading 22 years yields more than one fact', both.length >= 2,
   both.map((f) => f.key).join(', '))

console.log('\nTHE RULES\n')

/* The one that would do real damage if it broke. */
const low = leadFacts({ fhrs_id: '99', hygiene_rating: '1' })[0]
ok('a low hygiene score never reaches the fact sheet',
   !/\b[0-3]\b/.test(low.fact) && /WITHHELD/.test(low.fact), low.fact)
ok('  …and the local fallback does not name it either',
   !/rated/.test(templateHook({ fhrs_id: '99', hygiene_rating: '1' }).observation))

const high = leadFacts({ fhrs_id: '99', hygiene_rating: '5' })[0]
ok('a good hygiene score is stated', /rated 5/.test(high.fact), high.fact)

/* The fact sheet goes to a third party that trains on what it receives.
   An address on it would be business data for a company and personal
   data for a sole trader, and there is no way to tell which from here. */
const addr = leadFacts({ trading_address: '14 Mill Lane, Arnold', registered_address: 'c/o Smith, Derby' })[0]
ok('no address reaches the fact sheet', !/Mill Lane/.test(addr.fact), addr.fact)
ok('  …but the local fallback may still name it',
   /Mill Lane/.test(templateHook({ trading_address: '14 Mill Lane, Arnold', registered_address: 'c/o Smith, Derby' }).observation))

for (const h of REGISTER_HOOKS) {
  ok(`${h.key} carries a real notWhen`, !!h.notWhen && h.notWhen.length >= 40,
     h.notWhen ? `only ${h.notWhen.length} chars` : 'missing')
}

/* Every hook has to be able to say where its claim came from, because
   "where did you get that?" is the first question a recipient asks. */
for (const h of REGISTER_HOOKS) {
  const lead = { cqc_location_id: 'L1', ico_registration: 'ZA1', fhrs_id: '9', hygiene_rating: '5',
                 charity_number: '11', trading_address: 'A', registered_address: 'B', trading_years: '20' }
  ok(`${h.key} produces evidence`, typeof h.evidence(lead) === 'string' && h.evidence(lead).length > 5)
  ok(`${h.key} states an angle for the writer`, typeof h.angle === 'string' && h.angle.length > 20)
}

console.log(`\n${fail ? fail + ' failed' : 'all hook checks passed'}`)
process.exit(fail ? 1 : 0)
