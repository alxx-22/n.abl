/* ============================================================
   THE OUTREACH WRITER

   Writes the one true thing a first contact says about a business, a
   few leads at a time, woken by pg_cron. It exists here rather than as
   a Node script because a script on a laptop only runs when the laptop
   is open, and this is meant to run overnight.

   WHAT IT DOES NOT DO: send anything. approval-gates.md says both gates
   are human and both are before sending, and that "anyone proposing to
   move a gate downstream to increase throughput has misunderstood what
   the gate is for". This fills the queue up to the gate and stops. The
   drafts are still unapproved when it finishes.

   TWO STAGES, TWO MODELS

     read   Flash-Lite, temperature 0.2. Comb the page for candidate
            facts, each with a verbatim quote. High volume, low
            judgement, four times Flash's daily headroom.
     write  Flash, temperature 0.95. Turn the best one into the clause
            a stranger actually reads. Low volume, all judgement.

   Splitting them buys two gates instead of one: read cannot pass
   through a quote the page does not contain, and write cannot pass
   through a quote read did not find. A model asked to extract and
   charm in one breath does both worse, and the failure mode is the
   charming half inventing something for the extracting half to have
   found.

   WHAT LEAVES THE BUILDING

   The prompts carry register facts and the business's own public page
   text. No company name, no contact route, no address, nothing out of
   our database beyond the facts themselves. That is what makes a free
   tier which trains on submissions usable at all, and keeping the
   boundary in the request rather than in a policy means it holds
   whoever edits this next.

   A SMALL BATCH PER TICK

   Three reasons that happen to agree: an edge function has a wall
   clock, the daily allowance is spent more safely in bites, and
   11-outreach/README.md says one person can properly read 20 to 40
   messages in a sitting anyway.

   ONE SECRET, NOT TWO

   GEMINI_API_KEY is the only thing a person has to set. The shared
   secret that stops strangers driving this endpoint was generated in
   the database, lives in Vault, and is verified through
   outreach_verify_cron_secret -- machine to machine, never typed,
   never read by anyone. Asking someone to paste a second secret into a
   dashboard to protect a job that spends a free allowance is ceremony.

   Deploy:
     supabase secrets set GEMINI_API_KEY=...
     supabase functions deploy outreach-writer --no-verify-jwt
   ============================================================ */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const GEMINI_BASE = Deno.env.get('GEMINI_BASE_URL') ??
  'https://generativelanguage.googleapis.com'

/* Free-tier limits per model, lower of two third-party trackers read on
   14 Sep 2026. Google's own page no longer prints a free-tier table —
   it says to view your limits in AI Studio — so these are what we TRY.
   A 429 is what we BELIEVE: outreach_record_call records the ceiling we
   actually hit and the budget function honours it from then on. Being
   wrong costs one wasted request, not a wrong answer. */
const MODELS: Record<string, { rpd: number; gapMs: number }> = {
  'gemini-3.5-flash-lite': { rpd: 1000, gapMs: 4_000 },
  'gemini-2.5-flash-lite': { rpd: 1000, gapMs: 4_000 },
  'gemini-3.8-flash': { rpd: 250, gapMs: 6_000 },
  'gemini-2.5-flash': { rpd: 250, gapMs: 6_000 },
}
const CHAINS: Record<'read' | 'write', string[]> = {
  read: ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'],
  write: ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
}

const BATCH = Number(Deno.env.get('OUTREACH_BATCH') ?? 3)
const MAX_PAGE_CHARS = 6000
const UA = 'n.abl-research/1.0 (+https://nabl.agency; hello@nabl.agency)'

/* ---------- prompts ---------- */

const READ_SYSTEM =
  `You comb a small UK business's own homepage for concrete facts about HOW THEY OPERATE.

Return JSON only, no prose, no code fence:
{"candidates": [{"what": string, "quote": string}]}

Up to three candidates, best first. Return {"candidates": []} freely — most pages have nothing, and that is the correct answer.

"what" is a short factual note, not a sentence to send. "bookings taken by phone only". "price list is a PDF download". "three branches listed".

"quote" must be copied WORD FOR WORD from the page, 4 to 20 words, supporting that note. It is checked against the page automatically and anything that does not match exactly is discarded.

ONLY operational facts. How work comes in, how it is booked, quoted, scheduled, recorded, staffed or delivered.
NOT what they sell. NOT adjectives about themselves. NOT guesses. NOT anything about a named person.`

const WRITE_SYSTEM =
  `You write ONE clause for a letter to a small UK business, in the voice of Alex, who runs a small technology implementation business in Nottingham and is writing to them personally.

Return JSON only, no prose, no code fence:
{"observation": string, "basis": "register"|"page", "fact_key": string|null, "evidence": string|null}
or
{"observation": null}

THE CLAUSE

Write what would follow "I'm writing because I noticed that...". Lower case, no full stop, no greeting, 8 to 30 words.

It must read like one person noticing one thing about one business. VARY THE CONSTRUCTION — these go out in batches, and two letters that open the same way both get binned.

Good:
  "you have been trading nineteen years without a website, so the work clearly comes from people who already know you"
  "your site asks people to ring the workshop to arrange a quote, so every job starts as a phone call somebody has to write down"
  "your price list goes out as a PDF, which means it is out of date the day after you change a price"

Bad, and why:
  "businesses like yours often struggle with admin"  — true of everyone, so it is filler
  "you offer excellent plumbing services"            — what they sell, not how they work
  "you probably rekey orders by hand"                — a guess wearing an observation's clothes

RULES

1. Use ONLY the material given. Every fact and quote below is already verified; anything you add is not.
2. Using a FACT: basis "register", fact_key set to that fact's key, evidence null.
3. Using a PAGE FINDING: basis "page", evidence set to that finding's quote copied EXACTLY as given. Do not re-word it.
4. Prefer whichever is more specific about how they work.
5. Never a person's name. Never a number, price or date that is not in the material.
6. No flattery. "Your lovely website" is not an observation.
7. {"observation": null} is a correct and common answer. A weak clause is worse than none, because a weak one gets sent.`

/* ---------- register facts ----------

   Thinner than the local pipeline's, because sales_leads does not yet
   carry the CQC, ICO, FSA and Charity Commission columns that
   merge.mjs produces — those live only in the local working files. When
   those columns land, add them here and the write stage gets richer
   material with no other change.

   Every fact carries the rule for when it must NOT be used. That half
   is the one that is easy to skip and it is where the damage lives. */
type Lead = {
  lead_id: string
  company: string
  website: string | null
  industry: string | null
  signals: string | null
  source: string | null
  trading_years: number | null
  sector: string | null
}
type Fact = { key: string; fact: string; angle: string; evidence: string }

function factsFor(lead: Lead): Fact[] {
  const out: Fact[] = []
  const yrs = lead.trading_years ?? 0

  if (yrs >= 10 && !lead.website) {
    out.push({
      key: 'long_established_no_website',
      fact: `Trading ${yrs} years. No website could be found for them.`,
      /* Must not read as criticism. A business trading twenty years
         without a website has usually decided it does not need one and
         is usually right. The hook is the track record. */
      angle:
        'A long track record with no website usually means the work comes from people who already know them — a strength, not a gap.',
      evidence: 'Companies House incorporation date',
    })
  }
  if (yrs >= 15) {
    out.push({
      key: 'long_established',
      fact: `Trading ${yrs} years.`,
      angle:
        'A long-established business usually has a few processes done the same way since before anyone thought to write them down.',
      evidence: 'Companies House incorporation date',
    })
  }
  if (lead.industry) {
    out.push({
      key: 'registered_activity',
      fact: `Companies House records their activity as: ${lead.industry}.`,
      angle:
        'What they registered as doing, in their own filing. Useful only if it says something about how the work runs.',
      evidence: `Companies House SIC description: ${lead.industry}`,
    })
  }
  return out
}

/* ---------- database ---------- */

async function rpc(fn: string, args: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(args),
  })
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

/* ---------- Gemini ---------- */

const norm = (s: string) => String(s).replace(/\s+/g, ' ').trim().toLowerCase()

let lastCallAt = 0
async function pace(gapMs: number) {
  const wait = lastCallAt + gapMs - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCallAt = Date.now()
}

async function ask(
  task: 'read' | 'write',
  system: string,
  user: string,
  temperature: number,
): Promise<{ text: string; model: string }> {
  let last = ''
  for (const model of CHAINS[task]) {
    const spec = MODELS[model]
    const budget = await rpc('outreach_model_budget', {
      p_model: model,
      p_default_rpd: spec.rpd,
    })
    if (!budget || budget <= 0) {
      last = `${model}: no budget left today`
      continue
    }

    await pace(spec.gapMs)
    let res: Response
    try {
      res = await fetch(`${GEMINI_BASE}/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            temperature,
            topP: 0.95,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(25_000),
      })
    } catch (err) {
      last = `${model}: ${(err as Error).name === 'TimeoutError' ? 'timed out' : (err as Error).message}`
      continue
    }

    /* Recorded whatever the outcome — a 429 still consumed an attempt,
       and a model that answered still consumed a request. */
    await rpc('outreach_record_call', { p_model: model, p_rate_limited: res.status === 429 })

    if (res.status === 429) { last = `${model}: rate limited`; continue }
    if (res.status === 404) { last = `${model}: not available`; continue }
    if (res.status === 400) {
      const body = await res.text()
      if (/API key not valid/i.test(body)) throw new Error('GEMINI_API_KEY is set but not valid')
      last = `${model}: bad request`
      continue
    }
    if (!res.ok) { last = `${model}: HTTP ${res.status}`; continue }

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string' || !text.trim()) { last = `${model}: empty answer`; continue }
    return { text, model }
  }
  throw new Error(last || 'no model answered')
}

const parseJson = (raw: string) =>
  JSON.parse(String(raw).replace(/^```(?:json)?\s*|\s*```$/g, '').trim())

/* ---------- the page ---------- */

const strip = (h: string) =>
  h.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': UA, accept: 'text/html' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    if (!(res.headers.get('content-type') ?? '').includes('html')) return null
    const text = strip((await res.text()).slice(0, 300_000))
    return text.length > 80 ? text : null
  } catch {
    return null
  }
}

/* ---------- one lead ---------- */

async function writeFor(lead: Lead) {
  const facts = factsFor(lead)

  /* Stage 1 — read. Skipped entirely when there is no page, which saves
     a call on every register-only lead. */
  let findings: { what: string; quote: string }[] = []
  let pageText: string | null = null
  if (lead.website) {
    pageText = await fetchPage(lead.website)
    if (pageText) {
      const { text } = await ask('read', READ_SYSTEM, `PAGE TEXT:\n${pageText.slice(0, MAX_PAGE_CHARS)}`, 0.2)
      try {
        const parsed = parseJson(text)
        /* Every quote checked against the page HERE, once, so the write
           stage can only ever pick from verified material. */
        findings = (parsed.candidates ?? [])
          .filter((c: { quote?: string }) => c?.quote && norm(pageText!).includes(norm(c.quote)))
          .slice(0, 3)
      } catch { /* a read that failed is not fatal; the facts remain */ }
    }
  }

  if (!facts.length && !findings.length) {
    return { ok: false as const, why: 'nothing true to say about this lead' }
  }

  /* Stage 2 — write. */
  const parts: string[] = []
  if (facts.length) {
    parts.push('FACTS (verified, from public registers):')
    for (const f of facts) parts.push(`- key: ${f.key}\n  ${f.fact}\n  angle: ${f.angle}`)
  } else parts.push('FACTS: none beyond the company existing.')
  parts.push('')
  if (findings.length) {
    parts.push('PAGE FINDINGS (quotes already verified against their site):')
    for (const c of findings) parts.push(`- ${c.what}\n  quote: "${c.quote}"`)
  } else parts.push('PAGE FINDINGS: none.')

  const { text: raw, model } = await ask('write', WRITE_SYSTEM, parts.join('\n'), 0.95)

  let p: Record<string, unknown>
  try { p = parseJson(raw) } catch { return { ok: false as const, why: 'reply was not JSON' } }
  if (!p || p.observation == null) return { ok: false as const, why: 'model found nothing' }

  const obs = String(p.observation).trim()
  const words = obs.split(/\s+/).length
  if (words < 6) return { ok: false as const, why: 'clause too short to be specific' }
  if (words > 45) return { ok: false as const, why: 'clause too long to be one thing' }
  if (/^[A-Z]/.test(obs) || /\.$/.test(obs)) return { ok: false as const, why: 'not a lower-case clause' }
  /* A name moves the record into a lawful basis this programme has not
     been assessed for. See first-contact-letter.md §1. */
  if (/\b(mr|mrs|ms|miss|dr)\b\.?\s+[A-Z]/i.test(obs)) return { ok: false as const, why: 'names a person' }

  if (p.basis === 'page') {
    const ev = String(p.evidence ?? '').trim()
    if (!ev) return { ok: false as const, why: 'claimed the page but quoted nothing' }
    /* The second gate. The quote must be one the read stage already
       checked against the page. */
    if (!findings.some((c) => norm(c.quote) === norm(ev))) {
      return { ok: false as const, why: 'evidence is not one of the verified quotes' }
    }
    return { ok: true as const, observation: obs, basis: 'page', evidence: ev, model }
  }

  /* A register claim may only cite a fact we supplied. Without this the
     model can decide a care-sounding company is CQC-registered, which
     is the most damaging thing it could invent here. */
  const f = facts.find((x) => x.key === String(p.fact_key ?? ''))
  if (!f) return { ok: false as const, why: 'cited a register fact we did not supply' }
  return { ok: true as const, observation: obs, basis: 'register', evidence: f.evidence, model }
}

/* ---------- entry ---------- */

Deno.serve(async (req) => {
  /* verify_jwt is off so pg_cron can call this without a user token,
     which leaves the URL open to the internet. The secret it checks
     against lives in Vault rather than in this function's environment,
     so there is one fewer thing for a person to set up and one fewer
     place for it to be pasted wrongly. Compared constant-time in the
     database. */
  const presented = req.headers.get('x-outreach-secret') ?? ''
  let allowed = false
  try {
    allowed = await rpc('outreach_verify_cron_secret', { p_secret: presented }) === true
  } catch { allowed = false }
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    })
  }
  if (!GEMINI_KEY) {
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY is not set', hint: 'supabase secrets set GEMINI_API_KEY=...' }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    )
  }

  const started = Date.now()
  let run: { id: number } | null = null
  const detail: unknown[] = []
  let attempted = 0, written = 0, rejected = 0

  try {
    await rpc('outreach_sweep_page_cache', {})

    const body = await req.json().catch(() => ({}))
    const limit = Number(body?.limit ?? BATCH)
    const leads: Lead[] = await rpc('outreach_next_batch', { p_limit: limit })

    for (const lead of leads ?? []) {
      attempted++
      try {
        const r = await writeFor(lead)
        if (r.ok) {
          await rpc('outreach_record_observation', {
            p_lead_id: lead.lead_id,
            p_observation: r.observation,
            p_basis: r.basis,
            p_evidence: r.evidence,
            p_model: r.model,
          })
          written++
          detail.push({ company: lead.company, basis: r.basis, observation: r.observation })
        } else {
          await rpc('outreach_record_failure', { p_lead_id: lead.lead_id, p_error: r.why })
          rejected++
          detail.push({ company: lead.company, rejected: r.why })
        }
      } catch (err) {
        /* Budget exhaustion ends the tick rather than grinding through
           the rest of the batch against a closed door. */
        const msg = (err as Error).message
        await rpc('outreach_record_failure', { p_lead_id: lead.lead_id, p_error: msg })
        rejected++
        detail.push({ company: lead.company, error: msg })
        if (/no budget left|rate limited/i.test(msg)) break
      }
    }

    run = await rpc('outreach_log_run', {
      p_attempted: attempted, p_written: written, p_rejected: rejected,
      p_detail: detail, p_error: null,
    })

    return new Response(
      JSON.stringify({ attempted, written, rejected, ms: Date.now() - started, detail }),
      { headers: { 'content-type': 'application/json' } },
    )
  } catch (err) {
    const msg = (err as Error).message
    await rpc('outreach_log_run', {
      p_attempted: attempted, p_written: written, p_rejected: rejected,
      p_detail: detail, p_error: msg,
    }).catch(() => {})
    return new Response(JSON.stringify({ error: msg, attempted, written, rejected }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
})
