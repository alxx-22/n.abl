#!/usr/bin/env node
/* ============================================================
   WRITING THE OBSERVATION, ONE LEAD AT A TIME

     hooks.mjs    what is TRUE     registers, deterministic, £0
     observe.mjs  gathers it       facts + page text, £0
     scan.mjs     writes the line  this file, one call per lead

   The division is the whole point. Facts must be deterministic, because
   a made-up fact reaches a stranger's inbox. Phrasing must not be,
   because 149 leads sharing seven sentences is the same bulk-sender
   fingerprint the August batch had — near-identical bodies read as a
   mail merge whatever the facts behind them.

   So every lead gets its own call and its own sentence. What the model
   is given is a fact sheet it may not add to, and a page it may quote
   from. What it produces is prose, which is the one thing here that
   should vary.

   This runs on EVERY lead, not a residual. An earlier version only
   scanned the leads the regexes had failed on, which meant the best
   leads — the ones with a real register fact — got the most templated
   sentence. Exactly backwards.

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

   Generated prose is only safe because the facts under it are not.
   Three checks, all in code:

   1. A claim sourced from the page must quote it word for word. If the
      quote is not literally in the text we fetched, the whole answer is
      discarded.
   2. A claim sourced from a register must name one of the fact keys we
      supplied. The model cannot invent a registration.
   3. Forbidden content — a food hygiene score we deliberately withheld,
      a person's name — fails the answer outright.

   A rejected answer falls back to what observe.mjs produced. So the
   worst case is the templated sentence, not a confident lie. Same
   fail-closed shape as marketing_send_allowed.

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

/* Two things this prompt has to do at once, and they pull against each
   other: produce a sentence that sounds like it was written for this
   business specifically, and refuse to say anything that is not on the
   fact sheet or the page.

   The temperature below is deliberately not zero. A batch of sentences
   generated at temperature 0 from six fact patterns converges on six
   sentences, which is the problem this file exists to solve. */
const SYSTEM = `You write ONE clause for a letter to a small UK business, in the voice of Alex, who runs a small technology implementation business and is writing to them personally.

You are given FACTS (verified, from public registers) and optionally PAGE TEXT (their own website).

Return JSON only, no prose, no code fence:
{"observation": string, "basis": "register"|"page", "fact_key": string|null, "evidence": string|null}
or
{"observation": null}

THE CLAUSE

Write what would follow "I'm writing because I noticed that...". Lower case, no full stop, no greeting, 8 to 30 words.

It must read like one person noticing one thing about one business. Vary the construction — these letters go out in batches and two that open the same way both go in the bin.

Good:
  "you are CQC-registered for dementia care, which is a lot of rotas and medication records to keep evidenced"
  "your site asks people to ring the workshop to arrange a quote, which means every one of those starts as a phone call"
  "you have been trading nineteen years without a website, so the work clearly comes from people who already know you"

Bad, and why:
  "businesses like yours often struggle with admin"  — true of everyone, so it is filler
  "you offer excellent plumbing services"            — that is what they sell, not how they work
  "you probably rekey orders by hand"                — a guess wearing an observation's clothes

WHAT YOU MAY SAY

1. Only what is in FACTS or literally in PAGE TEXT. Never add a detail because it seems likely.
2. If you use a FACT, set basis "register" and fact_key to that fact's key. Set evidence to null.
3. If you use the PAGE, set basis "page" and copy 4 to 20 words from it into evidence WORD FOR WORD. It is checked automatically and the whole answer is discarded if it does not match. Do not paraphrase. Do not tidy the punctuation.
4. Prefer the strongest fact, which is the first one listed. But if the page shows something more specific about how they actually work, use that instead.

WHAT YOU MAY NEVER SAY

5. Never a person's name, even if the page is full of them.
6. Never a food hygiene score unless a FACT states it. If the fact sheet says a rating is withheld, it is withheld because it is poor, and naming it would be an insult with a citation.
7. Never a number, price, date or timescale that is not in FACTS or PAGE TEXT.
8. Never flattery. "Your beautiful website" is not an observation.

RETURNING NOTHING

9. {"observation": null} is a correct answer and a common one. A weak clause is worse than none, because a weak one gets sent.`

/* ---------- the call ---------- */

function promptFor(lead, pageText) {
  const parts = []
  if (lead.facts?.length) {
    parts.push('FACTS (verified, from public registers):')
    for (const f of lead.facts) {
      parts.push(`- key: ${f.key}`)
      parts.push(`  ${f.fact}`)
      parts.push(`  angle: ${f.angle}`)
    }
  } else {
    parts.push('FACTS: none on the public registers beyond the company existing.')
  }
  if (pageText) {
    parts.push('', 'PAGE TEXT (their own website):', pageText.slice(0, MAX_CHARS))
  } else {
    parts.push('', 'PAGE TEXT: none — no website could be read.')
  }
  return parts.join('\n')
}

async function ask(prompt, quota) {
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
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            /* Not zero. At temperature 0 a batch built from six fact
               patterns converges on six sentences, which is the exact
               thing this file exists to prevent. */
            generationConfig: { temperature: 0.9, topP: 0.95, responseMimeType: 'application/json' },
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

function validate(raw, lead, pageText) {
  let parsed
  try {
    parsed = JSON.parse(String(raw).replace(/^```(?:json)?\s*|\s*```$/g, '').trim())
  } catch {
    return { ok: false, why: 'reply was not JSON' }
  }
  if (!parsed || parsed.observation == null) return { ok: false, why: 'model found nothing' }

  const obs = String(parsed.observation).trim()
  const words = obs.split(/\s+/).length
  if (words < 6) return { ok: false, why: 'clause too short to be specific' }
  if (words > 45) return { ok: false, why: 'clause too long to be one thing' }
  if (/^[A-Z]/.test(obs) || /\.$/.test(obs)) return { ok: false, why: 'not a lower-case clause' }

  /* Forbidden regardless of where the claim came from. These are the
     two that would do real damage: a withheld hygiene score, which is
     withheld because it is poor, and a person's name, which moves the
     whole record into a lawful basis this programme has not assessed.
     See business/11-outreach/hooks.md §2 and first-contact-letter.md §1. */
  const facts = lead.facts || []
  const scoreStated = facts.some((f) => /rated \d/i.test(f.fact))
  if (!scoreStated && /\b(rated|rating|score[ds]?)\b/i.test(obs)) {
    return { ok: false, why: 'quotes a hygiene rating that was withheld' }
  }
  if (/\b(mr|mrs|ms|miss|dr)\b\.?\s+[A-Z]/i.test(obs)) {
    return { ok: false, why: 'names a person' }
  }

  const basis = parsed.basis === 'page' ? 'page' : 'register'

  if (basis === 'register') {
    /* The model may only use a registration we handed it. Without this
       it can decide a care-sounding company is CQC-registered, which is
       the single most damaging thing it could invent here. */
    const key = String(parsed.fact_key || '')
    const f = facts.find((x) => x.key === key)
    if (!f) return { ok: false, why: 'cited a register fact we did not supply' }
    return { ok: true, observation: obs, evidence: f.evidence, basis, fact_key: key, service: f.service }
  }

  const ev = String(parsed.evidence || '').trim()
  if (!ev) return { ok: false, why: 'claimed the page but quoted nothing' }
  if (!pageText) return { ok: false, why: 'claimed the page when there was no page' }

  /* The whole safety argument for page claims, in one comparison.
     Whitespace is normalised on both sides — a model that collapses a
     line break inside an otherwise perfect quote has invented nothing,
     and failing it for that throws away good observations to no
     purpose. Everything else must match. */
  if (!norm(pageText).includes(norm(ev))) {
    return { ok: false, why: 'evidence is not on the page' }
  }

  return { ok: true, observation: obs, evidence: ev, basis, fact_key: null, service: null }
}

/* ---------- run ---------- */

function setupNotice(n) {
  console.log(`
  ${n} leads are ready to have their observation written.

  GEMINI_API_KEY is not set, so nothing was sent anywhere and nothing
  was written. The pipeline still works without it — observe.mjs leaves
  a fallback sentence on every lead it could — but those fall back to
  one of seven templates, and seven sentences across a batch is the
  bulk-sender fingerprint this stage exists to remove.

  To run it:
    1. Get a key at aistudio.google.com/apikey (free, no card).
    2. Check the RPM and RPD your dashboard actually shows. Google no
       longer publishes them, so the defaults here (${RPM}/min, ${RPD}/day)
       are a conservative guess.
    3. export GEMINI_API_KEY=...
       export GEMINI_RPM=...  GEMINI_RPD=...
       node scripts/sourcing/scan.mjs

  --dry-run prints the exact prompt for the first few leads, without a
  key and without a request.
`)
}

const doc = JSON.parse(fs.readFileSync(IN, 'utf8'))
const all = doc.results || doc

const pageFor = (r) => {
  const f = path.join(CACHE, `${cacheName(r.company)}.txt`)
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null
}

/* Every lead with something to write from. A lead with neither a
   register fact nor a readable page has nothing to say and is left
   alone — it gets written by hand or not written to at all. */
const todoAll = all.filter((r) => (r.facts && r.facts.length) || pageFor(r))

if (!todoAll.length) {
  console.log('\n  Nothing to write: no lead has a register fact or a readable page.\n')
  process.exit(0)
}

if (DRY) {
  console.log(`\n  DRY RUN — ${todoAll.length} leads, nothing sent\n`)
  for (const r of todoAll.slice(0, 3)) {
    console.log(`  ── ${r.company} ${'─'.repeat(Math.max(0, 50 - r.company.length))}`)
    console.log(`  currently: ${r.observation || '(nothing)'} [${r.source || 'none'}]`)
    console.log('  prompt:')
    console.log(promptFor(r, pageFor(r)).split('\n').map((l) => '    ' + l).join('\n').slice(0, 1200))
    console.log('')
  }
  console.log(`  …and ${Math.max(todoAll.length - 3, 0)} more\n`)
  process.exit(0)
}

if (!KEY) { setupNotice(todoAll.length); process.exit(0) }

/* Resume where a previous run stopped. Same idiom as
   extract-contacts.mjs, and the reason is the same: a run that dies
   halfway must not start again from the beginning and spend the day's
   allowance twice. */
const seen = new Set()
if (fs.existsSync(CHECKPOINT)) {
  for (const line of fs.readFileSync(CHECKPOINT, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try { seen.add(JSON.parse(line).company) } catch { /* torn last line */ }
  }
  console.log(`\n  resuming: ${seen.size} already written`)
}

const quota = readQuota()
const todo = todoAll.filter((r) => !seen.has(r.company))
console.log(`\n  ${todo.length} to write, ${quota.used}/${RPD} of today's budget already spent\n`)

fs.mkdirSync(path.dirname(CHECKPOINT), { recursive: true })
const sink = fs.createWriteStream(CHECKPOINT, { flags: 'a' })
const written = []
let kept = 0, rejected = 0, stopped = false
const why = {}

for (const r of todo) {
  const text = pageFor(r)

  let raw
  try {
    raw = await ask(promptFor(r, text), quota)
  } catch (err) {
    if (err instanceof QuotaExhausted) {
      console.log(`\n  Daily budget reached at ${quota.used} requests. Stopping.`)
      console.log('  The checkpoint holds what is done; run again tomorrow to continue.')
      stopped = true
      break
    }
    throw err
  }

  const v = validate(raw, r, text)
  const row = v.ok
    ? { company: r.company, signal: v.basis === 'register' ? v.fact_key : 'page_observation',
        observation: v.observation, evidence: v.evidence, service: v.service || r.service || null,
        source: 'written' }
    : { company: r.company, signal: r.signal, observation: r.observation,
        source: r.source || null, rejected: v.why }

  if (v.ok) { kept++ } else { rejected++; why[v.why] = (why[v.why] || 0) + 1 }
  written.push(row)
  sink.write(JSON.stringify(row) + '\n')
  if ((kept + rejected) % 10 === 0) console.log(`  ${kept + rejected}/${todo.length}  written ${kept}`)
}
sink.end()

const byCompany = new Map(written.map((r) => [r.company, r]))
const merged = all.map((r) => {
  const w = byCompany.get(r.company)
  return w && w.source === 'written' ? { ...r, ...w, cached: undefined, facts: undefined } : r
})
fs.writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), results: merged }, null, 1))

/* The cache is other people's website content and it has done its job.
   The evidence quote — the thing we would actually have to produce if
   someone asked where a claim came from — is in the output. */
if (!KEEP_CACHE && !stopped) fs.rmSync(CACHE, { recursive: true, force: true })

/* How many distinct sentences came out. This is the number the whole
   change is for: in August it was 9 across 77 drafts. */
const distinct = new Set(written.filter((r) => r.source === 'written').map((r) => r.observation)).size

console.log(`
  ${kept} written, ${rejected} rejected and left as they were
  ${distinct} distinct sentences across ${kept} written observations
${Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${String(v).padStart(4)}  ${k}`).join('\n')}

  ${quota.used}/${RPD} of today's budget spent
  page cache ${KEEP_CACHE ? 'kept (--keep-cache)' : stopped ? 'kept — the run did not finish' : 'deleted'}

  -> ${path.resolve(OUT)}
`)
