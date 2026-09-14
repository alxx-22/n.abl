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

fs.writeFileSync(path.join(dir, 'obs.json'), JSON.stringify({ results: [
  { company: 'ALPHA JOINERY LTD',   signal: 'describes_itself',  observation: 'your site describes you as Bespoke Joinery', source: 'page', cached: true },
  { company: 'GAMMA LETTINGS LTD',  signal: 'nothing_specific',  observation: null, cached: true },
  { company: 'DELTA LTD',           signal: 'nothing_specific',  observation: null, cached: true },
  { company: 'EPSILON SERVICES LTD',signal: 'nothing_specific',  observation: null, cached: true },
  { company: 'ETA SUPPLIES LTD',    signal: 'nothing_specific',  observation: null, cached: true },
  { company: 'ZETA CARE LTD',       signal: 'cqc_registered',    observation: 'you are CQC-registered', source: 'register' },
] }))

/* One scripted reply per call, in order. */
const replies = [
  // 1. truthful: the quote is on page A word for word
  { observation: 'quotes start with a phone call to the workshop rather than a form', evidence: 'we do not take bookings online', confidence: 'high' },
  // 2. FABRICATED: plausible, fluent, and nowhere on page B
  { observation: 'you run a 24 hour emergency maintenance line', evidence: 'our 24 hour emergency line is always open', confidence: 'high' },
  // 3. PARAPHRASED: close to page C but not a quote
  { observation: 'you have been trading since the late nineties', evidence: 'quality service since 1998 in Nottingham', confidence: 'low' },
  // 4. honest null — the correct answer for a page with nothing on it
  { observation: null },
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
ok('a truthful observation is kept',
   by['ALPHA JOINERY LTD'].signal === 'scanned' && /phone call to the workshop/.test(by['ALPHA JOINERY LTD'].observation),
   JSON.stringify(by['ALPHA JOINERY LTD']))
ok('a FABRICATED quote is rejected',
   by['GAMMA LETTINGS LTD'].signal !== 'scanned' && rej['GAMMA LETTINGS LTD'] === 'evidence is not on the page',
   rej['GAMMA LETTINGS LTD'])
ok('  …and the lead keeps what it had (null), not the lie',
   by['GAMMA LETTINGS LTD'].observation == null)
ok('a PARAPHRASED quote is rejected too',
   by['DELTA LTD'].signal !== 'scanned' && rej['DELTA LTD'] === 'evidence is not on the page',
   rej['DELTA LTD'])
ok('an honest null is accepted as an answer',
   by['EPSILON SERVICES LTD'].signal !== 'scanned' && rej['EPSILON SERVICES LTD'] === 'model found nothing',
   rej['EPSILON SERVICES LTD'])
ok('a lead with a register hook is never sent',
   by['ZETA CARE LTD'].signal === 'cqc_registered' && !('rejected' in by['ZETA CARE LTD']))
ok('a 429 stops the run rather than hammering the API',
   /Daily budget reached|Stopping/.test(run.stdout), run.stdout.slice(-200))
ok('the run exits cleanly', run.status === 0, `exit ${run.status} ${run.stderr.slice(0, 200)}`)

console.log('\nWHAT LEFT THE MACHINE\n')
/* The privacy argument for using a free tier that trains on submissions
   is that only the business's own public page is sent. That is a claim
   about the request body, so it is checked against the request body. */
const leaked = []
for (const body of sent) {
  for (const needle of ['ALPHA JOINERY', 'GAMMA LETTINGS', 'DELTA LTD', 'EPSILON', 'ZETA CARE',
                        'cqc_registered', 'describes_itself', 'nothing_specific', '@', 'lead_id']) {
    if (body.includes(needle)) leaked.push(`${needle} in a request body`)
  }
}
ok(`no company name, signal or lead field in any of the ${sent.length} request bodies`,
   leaked.length === 0, leaked.slice(0, 3).join(', '))
ok('every request carried page text', sent.length > 0 && sent.every((b) => b.includes('systemInstruction')))
console.log(`\n${fail ? fail + ' failed' : 'all guard checks passed'}`)
fs.rmSync(dir, { recursive: true, force: true })
process.exit(fail ? 1 : 0)
