/* ============================================================
   tps-check — the screening answer is read strictly.

   An answer that does not say, as yes or no, whether a number is on the TPS
   and on the CTPS must never be read as "clear". Every case below is one
   where a lax reader would let a call through.

   Usage: node scripts/check-tps.mjs
   ============================================================ */

import { readAnswer, providerFor, PROVIDERS } from '../supabase/functions/tps-check/screen.mjs'

let fails = 0
const ok = (label, cond, detail) => {
  if (cond) console.log(`  ok    ${label}`)
  else { fails++; console.log(`  FAIL  ${label}`); if (detail !== undefined) console.log(`        ${JSON.stringify(detail)}`) }
}

const N = '+441154960999'
console.log('\nTHE ANSWER')
ok('both registers answered, not on either: clear', (() => { const r = readAnswer({ tps: false, ctps: false, e164: N }, N); return r.ok && !r.tps && !r.ctps })())
ok('on the TPS: read as on it', readAnswer({ tps: true, ctps: false }, N).tps === true)
ok('on the CTPS alone: read as on it', readAnswer({ tps: false, ctps: true }, N).ctps === true)
ok('an answer nested under "result" is read the same', readAnswer({ result: { tps: false, ctps: true } }, N).ctps === true)
ok('a missing CTPS answer is refused, not taken as no', readAnswer({ tps: false }, N).ok === false)
ok('"false" as a string is refused, not taken as no', readAnswer({ tps: 'false', ctps: 'false' }, N).ok === false)
ok('null is refused', readAnswer({ tps: null, ctps: null }, N).ok === false)
ok('an answer about a different number is refused', readAnswer({ tps: false, ctps: false, e164: '+441154960000' }, N).ok === false)
ok('the same number written another way is accepted', readAnswer({ tps: false, ctps: false, e164: '0115 496 0999' }, N).ok === true)
ok('no answer at all is refused', readAnswer(null, N).ok === false && readAnswer('clear', N).ok === false)
ok('an error body is refused', readAnswer({ error: 'quota exceeded' }, N).ok === false)

console.log('\nTHE PROVIDER')
ok('the default is tpscheck.uk', providerFor(undefined) === PROVIDERS.tpscheck && providerFor('') === PROVIDERS.tpscheck)
ok('an unknown provider is refused, so a typo sends numbers nowhere', providerFor('tps-chekc') === null)
const req = PROVIDERS.tpscheck.request(N, 'k-test')
ok('the key goes in the Authorization header as a token, the number in the body only',
  req.headers.authorization === 'Token k-test' && JSON.parse(req.body).phone === '01154960999' && !req.body.includes('k-test'))
ok('the free allowance is the monthly default', PROVIDERS.tpscheck.free_per_month === 50)

console.log(fails ? `\n${fails} failed` : '\nall tps-check checks passed')
process.exit(fails ? 1 : 0)
