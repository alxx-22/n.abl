#!/usr/bin/env node
/* ============================================================
   WRITING THE OBSERVATION, ONE LEAD AT A TIME

     hooks.mjs    what is TRUE     registers, deterministic, £0
     observe.mjs  gathers it       facts + page text, £0
     scan.mjs     READ then WRITE  this file, two staged calls

   Two stages, two different models, chosen by what the call is for.

     read   Flash-Lite, temperature 0.2. Extraction: comb the page for
            candidate facts about how the business operates, each with
            a verbatim quote. High volume, low judgement, and Flash-Lite
            has four times Flash's daily headroom.
     write  Flash, temperature 0.95. Prose: turn the best candidate
            into the clause a stranger actually reads. Low volume, all
            judgement, worth the better model — and only leads that got
            something out of `read` ever reach it.

   Splitting them is not ceremony. A model asked to extract and charm in
   one breath does both worse, and the failure mode is the charming
   half inventing something for the extracting half to have found.

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

   Per model, not per account, and handled in gemini.mjs. Flash-Lite's
   thousand daily requests and Flash's two hundred and fifty are
   separate budgets; treating them as one wastes the first or blows the
   second. A 429 is believed over any published table.
   ============================================================ */
import fs from 'node:fs'
import path from 'node:path'

import { createClient, AllModelsExhausted, LIMITS, TASKS } from './gemini.mjs'

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

/* Enough of a homepage to find something specific on, and no more.
   Every character here is a token spent and a token counted against a
   daily cap, and the useful part of a small business's homepage is
   almost always near the top. */
const MAX_CHARS = 6000

const WEAK = new Set(['describes_itself', 'nothing_specific'])

const cacheName = (company) =>
  company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)

/* ---------- the two prompts ---------- */

/* STAGE 1 — READ. Extraction, low temperature, Flash-Lite.
   It is not asked to be interesting, only accurate. Everything it
   returns must be quotable, because stage 2 may only build on what
   this stage found and what the register already said. */
const READ_SYSTEM = `You comb a small UK business's own homepage for concrete facts about HOW THEY OPERATE.

Return JSON only, no prose, no code fence:
{"candidates": [{"what": string, "quote": string}]}

Up to three candidates, best first. Return {"candidates": []} freely — most pages have nothing, and that is the correct answer.

"what" is a short factual note, not a sentence to send. "bookings taken by phone only". "price list is a PDF download". "three branches listed".

"quote" must be copied WORD FOR WORD from the page, 4 to 20 words, supporting that note. It is checked against the page automatically and anything that does not match exactly is discarded.

ONLY operational facts. How work comes in, how it is booked, quoted, scheduled, recorded, staffed or delivered.
NOT what they sell. NOT adjectives about themselves. NOT guesses. NOT anything about a named person.`

/* STAGE 2 — WRITE. Prose, high temperature, a better model.
   It sees only verified material: register facts, and read-stage
   candidates whose quotes have already been checked against the page.
   So it cannot invent a fact; the worst it can do is phrase one
   badly. */
const WRITE_SYSTEM = `You write ONE clause for a letter to a small UK business, in the voice of Alex, who runs a small technology implementation business in Nottingham and is writing to them personally.

Return JSON only, no prose, no code fence:
{"observation": string, "basis": "register"|"page", "fact_key": string|null, "evidence": string|null}
or
{"observation": null}

THE CLAUSE

Write what would follow "I'm writing because I noticed that...". Lower case, no full stop, no greeting, 8 to 30 words.

It must read like one person noticing one thing about one business. VARY THE CONSTRUCTION — these go out in batches, and two letters that open the same way both get binned.

Good:
  "you are CQC-registered for dementia care, which is a lot of rotas and medication records to keep evidenced"
  "your site asks people to ring the workshop to arrange a quote, so every job starts as a phone call somebody has to write down"
  "you have been trading nineteen years without a website, so the work clearly comes from people who already know you"

Bad, and why:
  "businesses like yours often struggle with admin"  — true of everyone, so it is filler
  "you offer excellent plumbing services"            — what they sell, not how they work
  "you probably rekey orders by hand"                — a guess wearing an observation's clothes

RULES

1. Use ONLY the material given. Every fact and every quote below has already been verified; anything you add has not.
2. Using a FACT: basis "register", fact_key set to that fact's key, evidence null.
3. Using a PAGE FINDING: basis "page", evidence set to that finding's quote copied EXACTLY as given. Do not re-word it.
4. Prefer whichever is more specific about how they work. A page finding often beats a register fact; sometimes it does not.
5. Never a person's name. Never a hygiene score unless a FACT states one. Never a number, price or date that is not in the material.
6. No flattery. "Your lovely website" is not an observation.
7. {"observation": null} is a correct and common answer. A weak clause is worse than none, because a weak one gets sent.`

function readPrompt(pageText) {
  return `PAGE TEXT:\n${pageText.slice(0, MAX_CHARS)}`
}

function writePrompt(lead, findings) {
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
  parts.push('')
  if (findings?.length) {
    parts.push('PAGE FINDINGS (quotes already verified against their site):')
    for (const c of findings) parts.push(`- ${c.what}\n  quote: "${c.quote}"`)
  } else {
    parts.push('PAGE FINDINGS: none.')
  }
  return parts.join('\n')
}

/* ---------- validation ---------- */

/* Whitespace is normalised on both sides before comparing. A model that
   collapses a line break inside an otherwise perfect quote has not
   invented anything, and failing it for that would throw away good
   observations to no purpose. Everything else must match. */
const norm = (s) => String(s).replace(/\s+/g, ' ').trim().toLowerCase()

function validate(raw, lead, findings) {
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
  if (!findings?.length) return { ok: false, why: 'claimed the page when nothing was found on it' }

  /* The quote must be one the READ stage already checked against the
     page. Two gates rather than one: read cannot pass through a quote
     the page does not contain, and write cannot pass through a quote
     read did not find. */
  if (!findings.some((c) => norm(c.quote) === norm(ev))) {
    return { ok: false, why: 'evidence is not one of the verified quotes' }
  }

  return { ok: true, observation: obs, evidence: ev, basis, fact_key: null, service: null }
}

/* ---------- run ---------- */


function setupNotice(n) {
  console.log(`
  ${n} leads are ready to have their observation written.

  GEMINI_API_KEY is not set, so nothing was sent and nothing was
  written. The pipeline still works without it — observe.mjs leaves a
  fallback sentence on every lead it can — but those come from seven
  templates, and seven sentences across a batch is the bulk-sender
  fingerprint this stage exists to remove.

  Two stages, two models, both on the free tier:
${Object.entries(TASKS).map(([task, chain]) =>
  `    ${task.padEnd(6)} ${chain[0]} — ${LIMITS[chain[0]].rpm}/min, ${LIMITS[chain[0]].rpd}/day`).join('\n')}

  To run it:
    1. Get a key at aistudio.google.com/apikey (free, no card).
    2. Put it in .env.local:  GEMINI_API_KEY=...
    3. npm run sourcing:write

  --dry-run prints the models, the budgets and the exact prompts,
  without a key and without a request.
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
  console.log('  models by stage:')
  for (const [task, chain] of Object.entries(TASKS)) {
    console.log(`    ${task.padEnd(6)} ${chain[0]}  (${LIMITS[chain[0]].rpm}/min, ${LIMITS[chain[0]].rpd}/day${LIMITS[chain[0]].assumed ? ', assumed' : ''})`)
    console.log(`           falling back to ${chain.slice(1).join(', ')}`)
  }
  console.log('')
  for (const r of todoAll.slice(0, 2)) {
    const text = pageFor(r)
    console.log(`  ── ${r.company} ${'─'.repeat(Math.max(0, 46 - r.company.length))}`)
    console.log(`  currently: ${r.observation || '(nothing)'} [${r.source || 'none'}]`)
    if (text) {
      console.log('  READ would be sent:')
      console.log(`    ${text.slice(0, 200).replace(/\n/g, ' ')}…  (${Math.min(text.length, MAX_CHARS)} chars)`)
    } else {
      console.log('  READ skipped — no page cached')
    }
    console.log('  WRITE would be sent:')
    console.log(writePrompt(r, []).split('\n').map((l) => '    ' + l).join('\n'))
    console.log('')
  }
  console.log(`  …and ${Math.max(todoAll.length - 2, 0)} more\n`)
  process.exit(0)
}

if (!KEY) { setupNotice(todoAll.length); process.exit(0) }

const client = createClient({ stateFile: QUOTA_FILE, log: (m) => console.log(m) })

/* Resume where a previous run stopped. Same idiom as
   extract-contacts.mjs: a run that dies halfway must not start again
   from the beginning and spend the day's allowance twice. */
const seen = new Set()
if (fs.existsSync(CHECKPOINT)) {
  for (const line of fs.readFileSync(CHECKPOINT, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try { seen.add(JSON.parse(line).company) } catch { /* torn last line */ }
  }
  console.log(`\n  resuming: ${seen.size} already written`)
}

const todo = todoAll.filter((r) => !seen.has(r.company))
console.log(`\n  ${todo.length} leads to do\n`)

fs.mkdirSync(path.dirname(CHECKPOINT), { recursive: true })
const sink = fs.createWriteStream(CHECKPOINT, { flags: 'a' })
const written = []
let kept = 0, rejected = 0, stopped = false
const why = {}

for (const r of todo) {
  const text = pageFor(r)

  /* STAGE 1 — read. Skipped entirely when there is no page, which
     saves a call on every register-only lead. */
  let findings = []
  if (text) {
    try {
      const { text: raw } = await client.ask('read', {
        system: READ_SYSTEM, user: readPrompt(text), temperature: 0.2,
      })
      const parsed = JSON.parse(String(raw).replace(/^```(?:json)?\s*|\s*```$/g, '').trim())
      /* Every quote checked against the page here, once, so the write
         stage can only ever pick from verified material. */
      findings = (parsed.candidates || [])
        .filter((c) => c && c.quote && norm(text).includes(norm(c.quote)))
        .slice(0, 3)
    } catch (err) {
      if (err instanceof AllModelsExhausted) { stopped = true }
      else if (!(err instanceof SyntaxError)) throw err
      /* A read that failed is not fatal: the write stage can still work
         from the register facts alone. */
    }
    if (stopped) { console.log('\n  Read budget exhausted across every model. Stopping.'); break }
  }

  /* STAGE 2 — write. */
  let raw
  try {
    const out = await client.ask('write', {
      system: WRITE_SYSTEM, user: writePrompt(r, findings), temperature: 0.95,
    })
    raw = out.text
  } catch (err) {
    if (err instanceof AllModelsExhausted) {
      console.log('\n  Write budget exhausted across every model. Stopping.')
      console.log('  The checkpoint holds what is done; run again tomorrow to continue.')
      stopped = true
      break
    }
    throw err
  }

  const v = validate(raw, r, findings)
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
   The evidence quote — the thing we would have to produce if someone
   asked where a claim came from — is in the output. */
if (!KEEP_CACHE && !stopped) fs.rmSync(CACHE, { recursive: true, force: true })

/* The number the whole change is for. In August it was 9 distinct
   observations across 77 drafts. */
const distinct = new Set(written.filter((r) => r.source === 'written').map((r) => r.observation)).size

console.log(`
  ${kept} written, ${rejected} rejected and left as they were
  ${distinct} distinct sentences across ${kept} written observations
${Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${String(v).padStart(4)}  ${k}`).join('\n')}

  budget used:
${client.report()}

  page cache ${KEEP_CACHE ? 'kept (--keep-cache)' : stopped ? 'kept — the run did not finish' : 'deleted'}

  -> ${path.resolve(OUT)}
`)
