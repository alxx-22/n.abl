#!/usr/bin/env node
/* Proves the guard in scan.mjs actually rejects things.

   The safety argument for sending prospect pages to a model is one line
   of code: an observation is discarded unless the quote supporting it
   is literally on the page. That argument is worth exactly as much as
   the evidence that the line works, so this stands up a fake Gemini
   that returns, in order: a truthful answer, a fabricated quote, a
   paraphrase, an honest null, and a 429.

   Pointing the real API at this and hoping it lies is not a test.

     node scripts/sourcing/scan-test.mjs
*/
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-test-'))
const pages = path.join(dir, 'pages')
fs.mkdirSync(pages)

const PAGE_A = 'Bespoke joinery in Arnold. To arrange a quote please call the workshop, we do not take bookings online.'
const PAGE_B = 'Gamma Lettings manage property across Nottingham. Tenants report maintenance issues using the form below.'
const PAGE_C = 'Delta Ltd. Quality service since 1998.'
const PAGE_D = 'Epsilon Services. We care about our customers.'

fs.writeFileSync(path.join(pages, 'alpha-joinery-ltd.txt'), PAGE_A)
fs.writeFileSync(path.join(pages, 'gamma-lettings-ltd.txt'), PAGE_B)
fs.writeFileSync(path.join(pages, 'delta-ltd.txt'), PAGE_C)
fs.writeFileSync(path.join(pages, 'epsilon-services-ltd.txt'), PAGE_D)
fs.writeFileSync(path.join(pages, 'eta-supplies-ltd.txt'), 'Eta Supplies. Trade counter open weekdays.')
fs.writeFileSync(path.join(pages, 'iota-works-ltd.txt'), 'Iota Works. Fabrication to order.')

const CQC_FACT = { key: 'cqc_registered', fact: 'Registered with the Care Quality Commission for personal care.', angle: 'rotas and medication records', evidence: 'CQC register, location L-1', service: 'record-keeping' }
const FSA_WITHHELD = { key: 'food_premises', fact: 'On the FSA food hygiene register. THE RATING IS WITHHELD ON PURPOSE — do not speculate about it.', angle: 'temperature logs', evidence: 'FSA hygiene register', service: 'record-keeping' }

fs.writeFileSync(path.join(dir, 'obs.json'), JSON.stringify({ results: [
  { company: 'ALPHA JOINERY LTD',   signal: 'describes_itself', observation: 'your site describes you as Bespoke Joinery', source: 'page', facts: [], cached: true },
  { company: 'GAMMA LETTINGS LTD',  signal: 'nothing_specific', observation: null, facts: [], cached: true },
  { company: 'DELTA LTD',           signal: 'nothing_specific', observation: null, facts: [], cached: true },
  { company: 'EPSILON SERVICES LTD',signal: 'nothing_specific', observation: null, facts: [], cached: true },
  { company: 'ETA SUPPLIES LTD',    signal: 'nothing_specific', observation: null, facts: [], cached: true },
  { company: 'THETA CATERING LTD',  signal: 'food_premises', observation: 'you are on the food hygiene register', source: 'register-template', facts: [FSA_WITHHELD] },
  { company: 'ZETA CARE LTD',       signal: 'cqc_registered', observation: 'you are CQC-registered', source: 'register-template', facts: [CQC_FACT] },
  { company: 'IOTA WORKS LTD',      signal: 'nothing_specific', observation: null, facts: [], cached: true },
] }))

/* One scripted reply per call, in order. */
const replies = [
  // 1. truthful page claim: the quote is on page A word for word
  { observation: 'quotes start with a phone call to the workshop rather than a form', basis: 'page', evidence: 'we do not take bookings online' },
  // 2. FABRICATED quote: plausible, fluent, and nowhere on page B
  { observation: 'you run a 24 hour emergency maintenance line', basis: 'page', evidence: 'our 24 hour emergency line is always open' },
  // 3. PARAPHRASED: close to page C but not a quote
  { observation: 'you have been trading since the late nineties', basis: 'page', evidence: 'quality service since 1998 in Nottingham' },
  // 4. honest null — the correct answer for a page with nothing on it
  { observation: null },
  // 5. INVENTED REGISTRATION: a fact key nobody supplied. The single
  //    most damaging thing this stage could get wrong.
  { observation: 'you are CQC-registered, which is a lot of evidence to keep', basis: 'register', fact_key: 'cqc_registered' },
  // 6. WITHHELD SCORE: the fact sheet deliberately did not state it
  { observation: 'you are rated 2 on the food hygiene register, which must sting', basis: 'register', fact_key: 'food_premises' },
  // 7. legitimate register claim, matching a supplied key
  { observation: 'you are CQC-registered for personal care, which is a lot of rotas to keep evidenced', basis: 'register', fact_key: 'cqc_registered' },
]
let n = 0
const sent = []
const server = http.createServer((req, res) => {
  let captured = ''
  req.on('data', (d) => { captured += d })
  req.on('end', () => { sent.push(captured) })
  n++
  if (n > replies.length) { res.writeHead(429); res.end('{}'); return }
  const body = JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(replies[n - 1]) }] } }] })
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(body)
})
await new Promise((r) => server.listen(4197, r))

/* spawn, not spawnSync. spawnSync blocks Node's event loop, so the stub
   server above can never answer a request and every call times out —
   which is exactly what happened on the first attempt at this test. */
const run = await new Promise((resolve) => {
  const child = spawn(process.execPath, [
  path.join(import.meta.dirname, 'scan.mjs'),
  '--in', path.join(dir, 'obs.json'),
  '--out', path.join(dir, 'out.json'),
  '--cache', pages,
  '--quota', path.join(dir, 'quota.json'),
  '--keep-cache',
], { env: { ...process.env, GEMINI_API_KEY: 'test', GEMINI_BASE_URL: 'http://localhost:4197', GEMINI_RPM: '600', GEMINI_RPD: '50' } })
  let stdout = '', stderr = ''
  child.stdout.on('data', (d) => { stdout += d })
  child.stderr.on('data', (d) => { stderr += d })
  child.on('close', (status) => resolve({ status, stdout, stderr }))
})

server.close()

if (!fs.existsSync(path.join(dir, 'out.json'))) {
  console.log('--- scan.mjs stdout ---\n' + run.stdout)
  console.log('--- scan.mjs stderr ---\n' + run.stderr)
  console.log('--- exit ' + run.status + ' ---')
  process.exit(1)
}
const out = JSON.parse(fs.readFileSync(path.join(dir, 'out.json'), 'utf8')).results
const by = Object.fromEntries(out.map((r) => [r.company, r]))
const lines = fs.readFileSync(path.join(dir, 'out.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
const rej = Object.fromEntries(lines.map((l) => [l.company, l.rejected]))

let fail = 0
const ok = (name, cond, detail = '') => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}${cond ? '' : '  → ' + detail}`)
  if (!cond) fail++
}

console.log('\nGUARD BEHAVIOUR\n')
ok('a truthful page claim is kept',
   by['ALPHA JOINERY LTD'].source === 'written' && /phone call to the workshop/.test(by['ALPHA JOINERY LTD'].observation),
   JSON.stringify(by['ALPHA JOINERY LTD']))
ok('a FABRICATED quote is rejected',
   by['GAMMA LETTINGS LTD'].source !== 'written' && rej['GAMMA LETTINGS LTD'] === 'evidence is not on the page',
   rej['GAMMA LETTINGS LTD'])
ok('  …and the lead keeps what it had (null), not the lie',
   by['GAMMA LETTINGS LTD'].observation == null)
ok('a PARAPHRASED quote is rejected too',
   by['DELTA LTD'].source !== 'written' && rej['DELTA LTD'] === 'evidence is not on the page',
   rej['DELTA LTD'])
ok('an honest null is accepted as an answer',
   by['EPSILON SERVICES LTD'].source !== 'written' && rej['EPSILON SERVICES LTD'] === 'model found nothing',
   rej['EPSILON SERVICES LTD'])
ok('an INVENTED registration is rejected',
   by['ETA SUPPLIES LTD'].source !== 'written' && rej['ETA SUPPLIES LTD'] === 'cited a register fact we did not supply',
   rej['ETA SUPPLIES LTD'])
ok('a WITHHELD hygiene score is rejected',
   by['THETA CATERING LTD'].source !== 'written' && rej['THETA CATERING LTD'] === 'quotes a hygiene rating that was withheld',
   rej['THETA CATERING LTD'])
ok('  …and that lead keeps its template sentence',
   by['THETA CATERING LTD'].observation === 'you are on the food hygiene register')
ok('a legitimate register claim is kept, with the register as evidence',
   by['ZETA CARE LTD'].source === 'written' && by['ZETA CARE LTD'].evidence === 'CQC register, location L-1',
   JSON.stringify(by['ZETA CARE LTD']))
ok('a 429 stops the run rather than hammering the API',
   /Daily budget reached|Stopping/.test(run.stdout), run.stdout.slice(-200))
ok('the run exits cleanly', run.status === 0, `exit ${run.status} ${run.stderr.slice(0, 200)}`)

console.log('\nWHAT LEFT THE MACHINE\n')
/* The privacy argument for using a free tier that trains on submissions
   is that only the business's own public page is sent. That is a claim
   about the request body, so it is checked against the request body. */
const leaked = []
for (const body of sent) {
  /* Fact keys ARE sent deliberately — the model has to cite one, and
     they are category labels derived from public registers. What must
     never appear is anything identifying: the company's name, a contact
     route, an address, or a field out of our own database. */
  for (const needle of ['ALPHA JOINERY', 'GAMMA LETTINGS', 'DELTA LTD', 'EPSILON', 'ZETA CARE',
                        'THETA CATERING', 'ETA SUPPLIES', '@', 'lead_id', 'Mill Lane']) {
    if (body.includes(needle)) leaked.push(`${needle} in a request body`)
  }
}
ok(`no company name, signal or lead field in any of the ${sent.length} request bodies`,
   leaked.length === 0, leaked.slice(0, 3).join(', '))
ok('every request carried page text', sent.length > 0 && sent.every((b) => b.includes('systemInstruction')))
console.log(`\n${fail ? fail + ' failed' : 'all guard checks passed'}`)
fs.rmSync(dir, { recursive: true, force: true })
process.exit(fail ? 1 : 0)
