#!/usr/bin/env node
/* The hook library's rules, asserted.

   Most of these check ordering, which matters because the first hook
   that applies wins and the ranking is the whole editorial judgement.
   One checks something more important: that a low food hygiene score is
   never quoted back. business/11-outreach/hooks.md §2 explains why —
   naming a bad grade in a cold letter is not an observation, it is a
   poke with a citation attached.

     node scripts/sourcing/hooks-test.mjs
*/
import { registerHook, REGISTER_HOOKS } from './hooks.mjs'

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

console.log('\nWHICH HOOK WINS\n')
for (const [name, lead, expect] of cases) {
  const h = registerHook(lead)
  const got = h?.signal ?? null
  ok(`${name.padEnd(20)} → ${got ?? '(none)'}`, got === expect, `expected ${expect ?? '(none)'}`)
}

console.log('\nTHE RULES\n')

/* The one that would do real damage if it broke. */
const low = registerHook({ fhrs_id: '99', hygiene_rating: '1' })
ok('a low hygiene score is never quoted back',
   !/rated\s*[0-3]\b/i.test(low.observation) && !low.observation.includes('rated'),
   low.observation)

const high = registerHook({ fhrs_id: '99', hygiene_rating: '5' })
ok('a good hygiene score is used', /rated 5/.test(high.observation), high.observation)

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
}

console.log(`\n${fail ? fail + ' failed' : 'all hook checks passed'}`)
process.exit(fail ? 1 : 0)
