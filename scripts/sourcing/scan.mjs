#!/usr/bin/env node
/* ============================================================
   THE RESIDUAL: READING THE PAGES THE REGEXES COULD NOT

   Last in a chain of three, and deliberately the smallest.

     hooks.mjs    registers        £0, no key, most leads
     observe.mjs  page + regexes   £0, no key
     scan.mjs     a model          this file, only what is left

   The 21 August batch produced 77 drafts of which 68 shared an
   observation, almost all of them `describes_itself` — a line lifted
   from the page title because eight regexes had found nothing. Those
   are the leads here. Everything a register or a regex could answer has
   already been answered by the time this runs.

     node scripts/sourcing/scan.mjs --in .sourcing/observations.json

   WHAT GOES TO GOOGLE, AND WHAT NEVER DOES

   The prompt carries the stripped text of the business's own public
   homepage. That is all. No lead record, no contact route, no email
   address, no name, nothing from our database.

   This is not tidiness, it is the whole reason the free tier is usable.
   Google's Unpaid terms say it trains on what is submitted, that human
   reviewers may read it, and in terms: "do not submit sensitive,
   confidential, or personal information to the Unpaid Services." A page
   the business published to the world is fine by that standard. A lead
   record is not. Keeping the boundary at the prompt rather than in a
   policy means it holds whoever edits this next, and it makes the
   provider a swappable detail rather than a legal question.

   HALLUCINATION IS HANDLED BY A STRING COMPARISON, NOT BY TRUST

   Every observation must come with `evidence`: a span the model claims
   is on the page. If that span is not literally in the text we fetched,
   the observation is thrown away and the lead keeps whatever it had.
   So the worst case is the behaviour we already have, not a confident
   lie in a stranger's inbox. Same fail-closed shape as
   marketing_send_allowed.

   QUOTAS

   Google no longer publishes fixed free-tier RPM/RPD figures — the
   docs point you at your own AI Studio dashboard. So nothing here is
   hardcoded from a number somebody half-remembered. The defaults below
   are deliberately conservative, every one is overridable, and the
   daily count is persisted so a run that resumes tomorrow does not
   start the day already over budget.

   Set what your dashboard actually says:
     GEMINI_RPM=15  GEMINI_RPD=200  node scripts/sourcing/scan.mjs
   ============================================================ */
import fs from 'node:fs'
import path from 'node:path'

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const IN = arg('--in', '.sourcing/observations.json')
const OUT = arg('--out', '.sourcing/observations-scanned.json')
const CACHE = arg('--cache', '.sourcing/pages')
const QUOTA_FILE = arg('--quota', '.sourcing/gemini-quota.json')
const CHECKPOINT = OUT.replace(/\.json$/, '.jsonl')
const KEEP_CACHE = process.argv.includes('--keep-cache')
const DRY = process.argv.includes('--dry-run')

const KEY = process.env.GEMINI_API_KEY || ''
const RPM = Number(process.env.GEMINI_RPM || arg('--rpm', 15))
const RPD = Number(process.env.GEMINI_RPD || arg('--rpd', 200))

/* Overridable so the guard below can be tested against a stub that
   returns a deliberately fabricated quote. There is no way to prove a
   rejection path works by pointing it at the real API and hoping the
   model lies. */
const BASE = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com'

/* A chain rather than one name, for the reason portal-assistant/index.ts
   learned the hard way: a single hardcoded model is an outage that
   arrives without a deploy. Cheapest first — this is extraction from
   supplied text, not reasoning, and the small models are good at it. */
const MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
]

/* Enough of a homepage to find something specific on, and no more.
   Every character here is a token spent and a token counted against a
   daily cap, and the useful part of a small business's homepage is
   almost always near the top. */
const MAX_CHARS = 6000

const WEAK = new Set(['describes_itself', 'nothing_specific'])

const cacheName = (company) =>
  company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)

/* ---------- quota ---------- */

const today = () => new Date().toISOString().slice(0, 10)

function readQuota() {
  try {
    const q = JSON.parse(fs.readFileSync(QUOTA_FILE, 'utf8'))
    if (q.day === today()) return q
  } catch { /* first run, or a new day */ }
  return { day: today(), used: 0 }
}

function writeQuota(q) {
  fs.mkdirSync(path.dirname(QUOTA_FILE), { recursive: true })
  fs.writeFileSync(QUOTA_FILE, JSON.stringify(q, null, 1))
}

class QuotaExhausted extends Error {}

/* Paces requests to RPM. Not a token bucket — a plain interval, because
   a batch job has nowhere to be and the simplest thing that cannot
   burst is the right one against somebody else's limit. */
const MIN_GAP = Math.ceil(60_000 / Math.max(RPM, 1))
let lastCall = 0
const pace = async () => {
  const wait = lastCall + MIN_GAP - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()
}

/* ---------- the prompt ---------- */

/* Written to make "nothing here" an easy answer rather than a failure.
   A model asked to find something useful about a business will always
   find something, and what it finds when there is nothing is filler —
   which is the exact thing 11-outreach/first-contact-letter.md §6 says
   turns a letter into a leaflet. */
const SYSTEM = `You read a small business's own homepage and find ONE specific, checkable thing about how they work.

Return JSON only, no prose, no code fence:
{"observation": string, "evidence": string, "confidence": "high"|"low"}
or
{"observation": null}

RULES

1. The observation must be about how the business OPERATES, not what it sells. "Bookings go through a phone call" is an observation. "They offer plumbing services" is a description and is useless.

2. "evidence" must be copied WORD FOR WORD from the page text, 4 to 20 words. It is checked against the page automatically and the whole answer is discarded if it does not match exactly. Do not paraphrase it. Do not tidy the punctuation.

3. Never guess at a difficulty. "You probably rekey orders by hand" is a guess wearing an observation's clothes, and the person reading it can tell.

4. Return {"observation": null} freely. MOST PAGES HAVE NOTHING SPECIFIC ON THEM, and saying so is the correct answer, not a failure. A weak observation is worse than none, because it gets sent.

5. Write the observation as a second-person clause that would follow "I noticed that": lower case, no full stop, no greeting. Example: "your booking form goes to a shared inbox rather than a system".

6. Never mention a person's name even if the page has one.`

/* ---------- the call ---------- */

async function ask(text, quota) {
  if (quota.used >= RPD) throw new QuotaExhausted()

  let last = ''
  for (const model of MODELS) {
    await pace()
    let res
    try {
      res = await fetch(
        `${BASE}/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: 'user', parts: [{ text: text.slice(0, MAX_CHARS) }] }],
            generationConfig: { temperature: 0, responseMimeType: 'application/json' },
          }),
          signal: AbortSignal.timeout(30_000),
        }
      )
    } catch (err) {
      last = `${model}: ${err.name === 'TimeoutError' ? 'timed out' : err.message}`
      continue
    }

    quota.used++
    writeQuota(quota)

    if (res.status === 429) {
      /* The daily cap, hit earlier than our own counter expected —
         which happens whenever the configured RPD is wrong, and it will
         be, because Google does not publish it. Believe the API over
         the config and stop for the day. */
      throw new QuotaExhausted()
    }
    if (res.status === 404) { last = `${model}: not available`; continue }
    if (!res.ok) {
      const body = await res.text()
      if (res.status === 400 && /API key not valid/i.test(body)) {
        throw new Error('GEMINI_API_KEY is set but not valid.')
      }
      last = `${model}: HTTP ${res.status}`
      continue
    }

    const data = await res.json()
    const out = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof out !== 'string' || !out.trim()) { last = `${model}: empty answer`; continue }
    return out
  }
  throw new Error(last || 'no model answered')
}

/* ---------- validation ---------- */

/* Whitespace is normalised on both sides before comparing. A model that
   collapses a line break inside an otherwise perfect quote has not
   invented anything, and failing it for that would throw away good
   observations to no purpose. Everything else must match. */
const norm = (s) => String(s).replace(/\s+/g, ' ').trim().toLowerCase()

function validate(raw, pageText) {
  let parsed
  try {
    parsed = JSON.parse(String(raw).replace(/^```(?:json)?\s*|\s*```$/g, '').trim())
  } catch {
    return { ok: false, why: 'reply was not JSON' }
  }
  if (!parsed || parsed.observation == null) return { ok: false, why: 'model found nothing' }

  const obs = String(parsed.observation).trim()
  if (obs.length < 15) return { ok: false, why: 'observation too short to be specific' }
  if (obs.length > 220) return { ok: false, why: 'observation too long to be one thing' }

  const ev = String(parsed.evidence || '').trim()
  if (!ev) return { ok: false, why: 'no evidence quoted' }

  /* The whole safety argument, in one comparison. */
  if (!norm(pageText).includes(norm(ev))) {
    return { ok: false, why: 'evidence is not on the page' }
  }

  return { ok: true, observation: obs, evidence: ev, confidence: parsed.confidence || 'low' }
}

/* ---------- run ---------- */

function setupNotice(n) {
  console.log(`
  ${n} leads have nothing specific to say and would be scanned.

  GEMINI_API_KEY is not set, so nothing was sent anywhere.

  To run it:
    1. Get a key at aistudio.google.com/apikey (free, no card).
    2. Check the RPM and RPD your dashboard actually shows — Google no
       longer publishes them, so the defaults here (${RPM}/min, ${RPD}/day)
       are a guess and probably a conservative one.
    3. export GEMINI_API_KEY=...
       export GEMINI_RPM=...  GEMINI_RPD=...
       node scripts/sourcing/scan.mjs

  --dry-run shows which leads would be sent, and what would be sent,
  without a key and without a request.
`)
}

const doc = JSON.parse(fs.readFileSync(IN, 'utf8'))
const all = doc.results || doc
const residual = all.filter((r) => WEAK.has(r.signal) && r.cached)

if (!residual.length) {
  console.log('\n  Nothing to scan: every lead already has a register hook or a page signal.\n')
  process.exit(0)
}

const pageFor = (r) => {
  const f = path.join(CACHE, `${cacheName(r.company)}.txt`)
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null
}

if (DRY) {
  console.log(`\n  DRY RUN — ${residual.length} leads would be scanned, nothing sent\n`)
  for (const r of residual.slice(0, 5)) {
    const text = pageFor(r)
    console.log(`  ${r.company}`)
    console.log(`    currently: ${r.observation || '(nothing)'}`)
    console.log(`    would send: ${text ? `${Math.min(text.length, MAX_CHARS)} chars of page text` : 'NOTHING — page not cached'}`)
  }
  console.log(`\n  …and ${Math.max(residual.length - 5, 0)} more\n`)
  process.exit(0)
}

if (!KEY) { setupNotice(residual.length); process.exit(0) }

/* Resume where a previous run stopped. Same idiom as
   extract-contacts.mjs, and the reason it is here is the same: a run
   that dies halfway must not start again from the beginning and spend
   the day's allowance twice. */
const seen = new Set()
if (fs.existsSync(CHECKPOINT)) {
  for (const line of fs.readFileSync(CHECKPOINT, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try { seen.add(JSON.parse(line).company) } catch { /* torn last line */ }
  }
  console.log(`\n  resuming: ${seen.size} already scanned`)
}

const quota = readQuota()
const todo = residual.filter((r) => !seen.has(r.company))
console.log(`\n  ${todo.length} to scan, ${quota.used}/${RPD} of today's budget already spent\n`)

fs.mkdirSync(path.dirname(CHECKPOINT), { recursive: true })
const sink = fs.createWriteStream(CHECKPOINT, { flags: 'a' })
const scanned = []
let kept = 0, rejected = 0, stopped = false
const why = {}

for (const r of todo) {
  const text = pageFor(r)
  if (!text) { continue }

  let raw
  try {
    raw = await ask(text, quota)
  } catch (err) {
    if (err instanceof QuotaExhausted) {
      console.log(`\n  Daily budget reached at ${quota.used} requests. Stopping.`)
      console.log('  The checkpoint holds what is done; run again tomorrow to continue.')
      stopped = true
      break
    }
    throw err
  }

  const v = validate(raw, text)
  const row = v.ok
    ? { company: r.company, signal: 'scanned', observation: v.observation, evidence: v.evidence, confidence: v.confidence, source: 'model' }
    : { company: r.company, signal: r.signal, observation: r.observation, source: r.source || 'page', rejected: v.why }

  if (v.ok) { kept++ } else { rejected++; why[v.why] = (why[v.why] || 0) + 1 }
  scanned.push(row)
  sink.write(JSON.stringify(row) + '\n')
  if ((kept + rejected) % 10 === 0) console.log(`  ${kept + rejected}/${todo.length}  kept ${kept}`)
}
sink.end()

/* Merge back: a scanned observation replaces the weak one, everything
   else is left exactly as observe.mjs left it. */
const byCompany = new Map(scanned.map((r) => [r.company, r]))
const merged = all.map((r) => {
  const s = byCompany.get(r.company)
  return s && s.signal === 'scanned' ? { ...r, ...s, cached: undefined } : r
})
fs.writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), results: merged }, null, 1))

/* The cache is other people's website content and it has done its job.
   Keeping it would be holding more than we need, for longer than we
   need it, which is the thing UK GDPR minimisation is about — and the
   evidence quote, which is what we would actually have to produce if
   someone asked, is persisted in the output. */
if (!KEEP_CACHE && !stopped) {
  fs.rmSync(CACHE, { recursive: true, force: true })
}

console.log(`
  ${kept} observations kept, ${rejected} rejected
${Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${String(v).padStart(4)}  ${k}`).join('\n')}

  ${quota.used}/${RPD} of today's budget spent
  page cache ${KEEP_CACHE ? 'kept (--keep-cache)' : stopped ? 'kept — the run did not finish' : 'deleted'}

  -> ${path.resolve(OUT)}
`)
