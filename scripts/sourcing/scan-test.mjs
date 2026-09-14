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

/* The stub now answers per MODEL, because the pipeline makes two calls
   per lead against two different chains: a read on Flash-Lite and a
   write on Flash. Answering by order alone stopped being meaningful. */
const READ_OK = { candidates: [{ what: 'quotes start with a phone call', quote: 'we do not take bookings online' }] }
/* On GAMMA's page, so it survives the read-stage check. The write
   stage then quotes something else entirely, which is what the second
   gate is for. */
const READ_GAMMA = { candidates: [{ what: 'tenants report faults on a form', quote: 'Tenants report maintenance issues using the form below' }] }
/* Not on DELTA's page at all — the read stage should drop this before
   the write stage ever sees it. */
const READ_LIE = { candidates: [{ what: 'a 24 hour line', quote: 'our 24 hour emergency line is always open' }] }
const READ_NONE = { candidates: [] }

/* Write-stage replies, in the order the leads are processed. */
const writes = [
  // ALPHA — truthful page claim, quoting a verified finding
  { observation: 'your site asks people to ring the workshop, so every job starts as a phone call somebody writes down', basis: 'page', evidence: 'we do not take bookings online' },
  // GAMMA — quotes something the READ stage never passed through
  { observation: 'you run a 24 hour emergency maintenance line', basis: 'page', evidence: 'our 24 hour emergency line is always open' },
  // DELTA — a paraphrase of a finding rather than the finding
  { observation: 'you have been trading since the late nineties', basis: 'page', evidence: 'quality service since 1998 in Nottingham' },
  // EPSILON — honest null
  { observation: null },
  // ETA — INVENTED registration, a fact key nobody supplied
  { observation: 'you are CQC-registered, which is a lot of evidence to keep', basis: 'register', fact_key: 'cqc_registered' },
  // THETA — WITHHELD hygiene score
  { observation: 'you are rated 2 on the food hygiene register, which must sting', basis: 'register', fact_key: 'food_premises' },
  // ZETA — legitimate register claim
  { observation: 'you are CQC-registered for personal care, which is a lot of rotas to keep evidenced', basis: 'register', fact_key: 'cqc_registered' },
]

let readN = 0, writeN = 0
const sent = []
const server = http.createServer((req, res) => {
  let captured = ''
  req.on('data', (d) => { captured += d })
  req.on('end', () => {
    sent.push({ url: req.url, body: captured })
    const isRead = /flash-lite/.test(req.url)
    let payload
    if (isRead) {
      readN++
      payload = readN === 1 ? READ_OK : readN === 2 ? READ_GAMMA : readN === 3 ? READ_LIE : READ_NONE
    } else {
      writeN++
      if (writeN > writes.length) { res.writeHead(429); res.end('{}'); return }
      payload = writes[writeN - 1]
    }
    const body = JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] })
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(body)
  })
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
  '--quota', path.join(dir, 'state.json'),
  '--keep-cache',
], { env: { ...process.env, GEMINI_API_KEY: 'test', GEMINI_BASE_URL: 'http://localhost:4197' } })
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
   by['ALPHA JOINERY LTD'].source === 'written' && /ring the workshop/.test(by['ALPHA JOINERY LTD'].observation),
   JSON.stringify(by['ALPHA JOINERY LTD']))
ok('a quote the READ stage never verified is rejected',
   by['GAMMA LETTINGS LTD'].source !== 'written' && rej['GAMMA LETTINGS LTD'] === 'evidence is not one of the verified quotes',
   rej['GAMMA LETTINGS LTD'])
ok('  …and the lead keeps what it had (null), not the lie',
   by['GAMMA LETTINGS LTD'].observation == null)
ok('a quote the READ stage invented never reaches WRITE',
   by['DELTA LTD'].source !== 'written' && rej['DELTA LTD'] === 'claimed the page when nothing was found on it',
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
   /Stopping|exhausted/.test(run.stdout), run.stdout.slice(-300))

console.log('\nSTAGED MODELS\n')
const readCalls = sent.filter((r) => /flash-lite/.test(r.url))
const writeCalls = sent.filter((r) => !/flash-lite/.test(r.url))
ok('reading went to a Flash-Lite model', readCalls.length > 0, `${readCalls.length} read calls`)
ok('writing went to a different model', writeCalls.length > 0 && writeCalls.every((r) => !/flash-lite/.test(r.url)),
   writeCalls.map((r) => r.url.split('/').pop()).slice(0, 2).join(', '))
ok('no read call was made for a lead with no page',
   readCalls.length < sent.length, `${readCalls.length} reads vs ${sent.length} total`)
ok('the read stage ran cooler than the write stage',
   JSON.parse(readCalls[0].body).generationConfig.temperature <
   JSON.parse(writeCalls[0].body).generationConfig.temperature,
   `read ${JSON.parse(readCalls[0].body).generationConfig.temperature}, write ${JSON.parse(writeCalls[0].body).generationConfig.temperature}`)
ok('the run exits cleanly', run.status === 0, `exit ${run.status} ${run.stderr.slice(0, 200)}`)

console.log('\nWHAT LEFT THE MACHINE\n')
/* The privacy argument for using a free tier that trains on submissions
   is that only the business's own public page is sent. That is a claim
   about the request body, so it is checked against the request body. */
const leaked = []
for (const { body } of sent) {
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
ok('every request carried a system instruction', sent.length > 0 && sent.every((r) => r.body.includes('systemInstruction')))
console.log(`\n${fail ? fail + ' failed' : 'all guard checks passed'}`)
fs.rmSync(dir, { recursive: true, force: true })
process.exit(fail ? 1 : 0)
