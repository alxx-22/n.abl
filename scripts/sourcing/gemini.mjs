#!/usr/bin/env node
/* ============================================================
   ONE GEMINI CLIENT, PER-MODEL LIMITS, PER-TASK MODEL CHOICE

   Three things this exists to get right, and the first version of
   scan.mjs got all three wrong.

   1. THE LIMITS ARE PER MODEL, NOT PER ACCOUNT.
      Flash-Lite and Pro do not share a budget. A single GEMINI_RPD
      env var treats them as if they do, which means either wasting
      Flash-Lite's thousand daily requests or blowing through Pro's
      hundred. The table below is keyed by model and the counters
      below are keyed by model.

   2. THE MODEL SHOULD SUIT THE TASK.
      Reading a homepage for candidate facts is extraction: high
      volume, low judgement, and Flash-Lite has by far the most daily
      headroom. Writing the clause that a stranger actually reads is
      the opposite: low volume, all judgement. Same key, different
      model, chosen by what the call is for.

   3. THE PUBLISHED NUMBERS ARE A STARTING POINT, NOT THE TRUTH.
      Google's own rate-limit page no longer prints a free-tier table;
      it says "view your active rate limits in AI Studio". The figures
      below come from third-party trackers, and those trackers
      disagree with each other — one puts Flash-Lite at 15 RPM and
      another at 30. So the table is what we try, and a 429 is what we
      believe: an observed ceiling is recorded and honoured from then
      on. Being wrong here costs a wasted request, not a wrong answer.

   Counters persist to disk, keyed by model and by Pacific date,
   because that is when Google resets RPD.
   ============================================================ */
import fs from 'node:fs'
import path from 'node:path'

/* Free-tier limits, per model.

   Sources, both read 14 Sep 2026 and disagreeing on Flash-Lite's RPM:
     aipromptshub.co/limits/gemini-rate-limits-2026
     aifreeapi.com/en/posts/gemini-api-free-tier-rate-limits
   The lower figure is taken wherever they differ. Overshooting costs a
   429 and a wasted request; undershooting costs nothing but time, and
   this is a batch job with nowhere to be.

   Check these against AI Studio when something looks wrong, and update
   `checked` when you do. */
export const LIMITS = {
  'gemini-2.5-flash-lite': { rpm: 15, rpd: 1000, tpm: 250_000, checked: '2026-09-14' },
  'gemini-2.5-flash':      { rpm: 10, rpd: 250,  tpm: 250_000, checked: '2026-09-14' },
  'gemini-2.5-pro':        { rpm: 5,  rpd: 100,  tpm: 250_000, checked: '2026-09-14' },

  /* The 3.x models are not in either tracker's free-tier table yet.
     Given 2.5's shape, Lite is the generous one and Flash the middling
     one, so they inherit those numbers until something better exists.
     If one of these turns out not to be free-tier eligible at all it
     answers 404 or 429 and the chain below moves on. */
  'gemini-3.5-flash-lite': { rpm: 15, rpd: 1000, tpm: 250_000, checked: '2026-09-14', assumed: true },
  'gemini-3.8-flash':      { rpm: 10, rpd: 250,  tpm: 250_000, checked: '2026-09-14', assumed: true },
}

/* What each stage of the pipeline asks for, cheapest-capable first.

   `read` is extraction from supplied text at one call per lead — it
   wants the model with the most daily headroom, and Flash-Lite has
   four times Flash's.

   `write` produces the sentence a stranger reads. It is worth a better
   model and there are far fewer of them, because only leads that got
   something out of `read` reach it. */
export const TASKS = {
  read:  ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'],
  write: ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  /* The lead puller's prospector: a verdict and one sentence per company,
     twenty to a call. Extraction-shaped rather than writing-shaped, so it
     takes the read chain's generous models. Its own entry so it can be
     retuned without touching the stage that writes observations. */
  judge: ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'],
}

const BASE = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com'

/* RPD resets at midnight Pacific, not UTC and not local. Getting this
   wrong means either losing most of a day's allowance or thinking there
   is allowance left when there is not. */
export const quotaDay = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(d)

export class QuotaExhausted extends Error {
  constructor(model) { super(`daily quota reached for ${model}`); this.model = model }
}
export class AllModelsExhausted extends Error {}

/* keyEnv names the environment variable holding the key, so a second
   Google project is a second client rather than a second copy of this
   file. Quota is per project and per model, so each key keeps its own
   state file — sharing one would let the prospector's calls count against
   the writer's ceiling, which is the thing the second project exists to
   prevent. The defaults are exactly what they were before this option
   existed, so every existing caller is unchanged. */
export function createClient({
  stateFile = '.sourcing/gemini-state.json',
  keyEnv = 'GEMINI_API_KEY',
  log = () => {},
} = {}) {
  const KEY = () => process.env[keyEnv] || ''
  let state = { day: quotaDay(), models: {} }
  try {
    const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    if (saved.day === quotaDay()) state = saved
  } catch { /* first run, or a new quota day */ }

  const save = () => {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true })
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 1))
  }

  const seat = (model) => {
    if (!state.models[model]) {
      state.models[model] = { used: 0, lastCall: 0, observedRpd: null, exhausted: false }
    }
    return state.models[model]
  }

  const rpdFor = (model) => {
    const s = seat(model)
    /* An observed ceiling always beats a published one. If the API says
       429 at 180 requests, 180 is the number, whatever a blog says. */
    return s.observedRpd ?? LIMITS[model]?.rpd ?? 50
  }

  const available = (model) => {
    const s = seat(model)
    return !s.exhausted && s.used < rpdFor(model)
  }

  /* A plain interval rather than a token bucket. A batch job has
     nowhere to be, and the simplest thing that cannot burst is the
     right one to point at somebody else's limit. */
  async function pace(model) {
    const rpm = LIMITS[model]?.rpm ?? 10
    const gap = Math.ceil(60_000 / Math.max(rpm, 1))
    const s = seat(model)
    const wait = s.lastCall + gap - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    s.lastCall = Date.now()
  }

  /* Ask for a task, not a model. The chain is walked in order and the
     first model with budget left answers. */
  async function ask(task, { system, user, temperature = 0.9, timeoutMs = 30_000 }) {
    const chain = TASKS[task]
    if (!chain) throw new Error(`gemini: no model chain for task "${task}"`)

    let last = ''
    for (const model of chain) {
      if (!available(model)) { last = `${model}: no budget left today`; continue }
      await pace(model)

      const s = seat(model)
      let res
      try {
        res = await fetch(`${BASE}/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY() },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { temperature, topP: 0.95, responseMimeType: 'application/json' },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch (err) {
        last = `${model}: ${err.name === 'TimeoutError' ? 'timed out' : err.message}`
        save()
        continue
      }

      s.used++

      if (res.status === 429) {
        /* Believe the API over the table. Whatever we thought the
           ceiling was, it is at most what we have already spent. */
        s.observedRpd = s.used
        s.exhausted = true
        save()
        log(`  ${model}: 429 at ${s.used} requests — recording that as its ceiling`)
        last = `${model}: rate limited`
        continue
      }
      if (res.status === 404) { s.exhausted = true; save(); last = `${model}: not available`; continue }
      if (res.status === 400) {
        const body = await res.text()
        save()
        if (/API key not valid/i.test(body)) throw new Error(`${keyEnv} is set but not valid.`)
        last = `${model}: bad request`
        continue
      }
      if (!res.ok) { save(); last = `${model}: HTTP ${res.status}`; continue }

      const data = await res.json()
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
      save()
      if (typeof text !== 'string' || !text.trim()) { last = `${model}: empty answer`; continue }
      return { text, model }
    }

    if (chain.every((m) => !available(m))) throw new AllModelsExhausted(last)
    throw new Error(last || 'no model answered')
  }

  const report = () => Object.entries(state.models)
    .map(([m, s]) => `  ${m.padEnd(24)} ${String(s.used).padStart(4)}/${rpdFor(m)}${s.observedRpd ? ' (observed)' : ''}${s.exhausted ? ' exhausted' : ''}`)
    .join('\n') || '  no calls made'

  return { ask, report, available, state: () => state, save }
}
