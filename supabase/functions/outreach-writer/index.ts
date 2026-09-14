/* ============================================================
   THE OUTREACH WRITER

   Assesses a lead against the service categories, then writes the one
   true thing a first contact says about it. A few leads at a time,
   woken by pg_cron, so it runs with the laptop shut.

   WHAT IT DOES NOT DO: send anything. approval-gates.md says both gates
   are human and both are before sending. This fills the queue up to the
   gate and stops.

   TWO STAGES, TWO MODELS

     assess  Flash-Lite, cold. Given the register facts, the sector
             prior and the page, decide what kind of web presence this
             is, which service categories plausibly fit, and what would
             confirm or kill each. Analysis, not prose.
     write   Flash, hot. Turn the strongest fit into the clause a
             stranger actually reads.

   THE THING TO UNDERSTAND BEFORE EDITING THIS

   A website assessment is a HYPOTHESIS, never a qualification. Every
   disqualifying signal in 01-positioning/service-categories.md is
   learned in conversation and invisible from outside: "they will not
   let you watch the task being done", "they can name the person but not
   the process", "nobody will own the data's accuracy". So every
   category verdict carries confirm_question and disqualifier. A fit
   score without those is a guess with a number attached, and that is
   how a business gets mischaracterised and a first contact wasted.
   There is one first contact per lead and it does not come back.

   THE PRIOR IS A STARTING POINT, NOT AN ANSWER

   The sector hint came from a keyword triage and is wrong often enough
   to matter - a concert hall is currently filed as a professional
   practice. The assessor may contradict it from the page and says so in
   sector_correction. A prior that cannot be overruled is a prejudice.

   WHAT LEAVES THE BUILDING

   Register facts, the sector prior, and the business's own public page
   text. No company name, no contact route, no address, nothing else
   from the database.
   ============================================================ */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const GEMINI_BASE = Deno.env.get('GEMINI_BASE_URL') ??
  'https://generativelanguage.googleapis.com'

/* Free-tier limits per model, lower of two third-party trackers read on
   14 Sep 2026. Google's own page no longer prints a free-tier table, so
   these are what we TRY. A 429 is what we BELIEVE: outreach_record_call
   stores the ceiling actually hit and the budget function honours it. */
const MODELS: Record<string, { rpd: number; gapMs: number }> = {
  'gemini-3.5-flash-lite': { rpd: 1000, gapMs: 4_000 },
  'gemini-2.5-flash-lite': { rpd: 1000, gapMs: 4_000 },
  'gemini-3.8-flash': { rpd: 250, gapMs: 6_000 },
  'gemini-2.5-flash': { rpd: 250, gapMs: 6_000 },
}
const CHAINS: Record<'assess' | 'write', string[]> = {
  assess: ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'],
  write: ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
}

const BATCH = Number(Deno.env.get('OUTREACH_BATCH') ?? 3)
const MAX_PAGE_CHARS = 9000
const UA = 'n.abl-research/1.0 (+https://nabl.agency; hello@nabl.agency)'

const CATEGORIES = [
  'save_time', 'reduce_mistakes', 'understand_data', 'build_new', 'fix_something',
]
const FITS = ['strong', 'possible', 'unlikely', 'ruled_out']
const CONFIDENCES = ['observed', 'inferred', 'guessed']
const PRESENCE = ['none', 'social_only', 'placeholder', 'brochure', 'transactional']
const CAPACITY = ['likely', 'mixed', 'unlikely']
const VOLUME = ['high', 'moderate', 'low']
const CREDITS = ['build', 'assist', 'educate']

/* ---------- the prompts live in the database ----------

   public.outreach_prompt holds both, with their temperatures, and the
   run fetches them at the start of each tick.

   The reason is not tidiness. The worked examples in the write prompt
   are what every sentence a stranger reads is modelled on, they are not
   yet in Alex's voice, and rewriting them is the highest-value change
   anyone can make to this system. Behind `supabase functions deploy`
   that never happens; behind an UPDATE it takes effect in ten minutes.

   Safe to do because the guards that keep generated prose honest are
   in THIS FILE, not in the prompt. A mangled prompt produces rejected
   verdicts and no observation - visible in outreach_status within the
   hour - and cannot produce a confident falsehood, because every claim
   is still checked against the page or the fact sheet. */
type Prompt = { body: string; temperature: number }
let PROMPTS: Record<string, Prompt> = {}

type Lead = {
  lead_id: string
  company: string
  website: string | null
  industry: string | null
  signals: string | null
  source: string | null
  trading_years: number | null
  sector: string | null
  sector_label: string | null
  sector_note: string | null
  needs_booking: boolean | null
  needs_scheduling: boolean | null
  record_heavy: boolean | null
  data_worth_having: boolean | null
  public_facing: boolean | null
  prior_technical: string | null
  prior_inbound: string | null
}
type Fact = { key: string; fact: string; angle: string; evidence: string }

/* Register facts. Thinner than the local pipeline's, because sales_leads
   does not yet carry the CQC, ICO, FSA and Charity Commission columns
   merge.mjs produces. When those land, add them here. */
function factsFor(lead: Lead): Fact[] {
  const out: Fact[] = []
  const yrs = lead.trading_years ?? 0

  if (yrs >= 10 && !lead.website) {
    out.push({
      key: 'long_established_no_website',
      fact: `Trading ${yrs} years. No website could be found for them.`,
      angle:
        'A long track record with no website usually means the work comes from people who already know them - a strength, not a gap. Must not read as criticism.',
      evidence: 'Companies House incorporation date',
    })
  }
  if (yrs >= 15) {
    out.push({
      key: 'long_established',
      fact: `Trading ${yrs} years.`,
      angle:
        'A long-established business usually has processes done the same way since before anyone thought to write them down.',
      evidence: 'Companies House incorporation date',
    })
  }
  if (lead.industry) {
    out.push({
      key: 'registered_activity',
      fact: `Companies House records their activity as: ${lead.industry}.`,
      angle: 'Their own filing. Useful only if it says something about how the work runs.',
      evidence: `Companies House SIC description: ${lead.industry}`,
    })
  }
  return out
}

function priorBlock(lead: Lead): string {
  if (!lead.sector_label) {
    return 'SECTOR PRIOR: none — the triage did not classify this business. Work entirely from the page.'
  }
  const yes = (b: boolean | null) => (b ? 'yes' : 'no')
  return [
    `SECTOR PRIOR (a keyword triage's guess — contradict it if the page disagrees):`,
    `  sector: ${lead.sector_label}`,
    `  ${lead.sector_note}`,
    `  plausibly needs booking: ${yes(lead.needs_booking)}`,
    `  plausibly needs scheduling: ${yes(lead.needs_scheduling)}`,
    `  record-heavy: ${yes(lead.record_heavy)}`,
    `  data worth analysing: ${yes(lead.data_worth_having)}`,
    `  public facing: ${yes(lead.public_facing)}`,
    `  expected technical capacity: ${lead.prior_technical}`,
    `  expected inbound volume: ${lead.prior_inbound}`,
  ].join('\n')
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
  task: 'assess' | 'write',
  system: string,
  user: string,
  temperature: number,
): Promise<{ text: string; model: string }> {
  let last = ''
  for (const model of CHAINS[task]) {
    const spec = MODELS[model]
    const budget = await rpc('outreach_model_budget', { p_model: model, p_default_rpd: spec.rpd })
    if (!budget || budget <= 0) { last = `${model}: no budget left today`; continue }

    await pace(spec.gapMs)
    let res: Response
    try {
      res = await fetch(`${GEMINI_BASE}/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature, topP: 0.95, responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(30_000),
      })
    } catch (err) {
      last = `${model}: ${(err as Error).name === 'TimeoutError' ? 'timed out' : (err as Error).message}`
      continue
    }

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

/* A site's own HTML answers questions the visible text does not: whether
   there is a booking widget, a shop, a form that posts somewhere, a
   payment provider. Detected here rather than asked of the model,
   because a script tag is a fact and a model's opinion about one is not. */
function techSignals(html: string): string[] {
  const s: string[] = []
  const has = (re: RegExp) => re.test(html)
  if (has(/calendly|acuityscheduling|simplybook|bookwhen|resdiary|opentable|setmore|10to8|squarespace-scheduling/i))
    s.push('a third-party booking tool is embedded')
  if (has(/shopify|woocommerce|bigcommerce|ecwid|squarespace-commerce|opencart|magento/i))
    s.push('an e-commerce platform is in use')
  if (has(/stripe\.com|paypal|worldpay|sumup|gocardless|square(up)?\.com/i))
    s.push('a payment provider is referenced')
  if (has(/<form[^>]*>/i)) s.push('the site has at least one form')
  if (has(/mailto:/i)) s.push('the site publishes a mailto link')
  if (has(/wp-content|wordpress/i)) s.push('built on WordPress')
  if (has(/wix\.com|_wixCssImports/i)) s.push('built on Wix')
  if (has(/facebook\.com\/(?!sharer|plugins)/i)) s.push('links to a Facebook page')
  if (has(/intercom|tawk\.to|crisp\.chat|livechat|zendesk|drift\.com/i))
    s.push('a live chat or chatbot widget is already installed')
  if (has(/\.(pdf)"/i)) s.push('a PDF is offered for download')
  return s
}

async function fetchSite(url: string): Promise<{ text: string; tech: string[] } | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': UA, accept: 'text/html' },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    if (!(res.headers.get('content-type') ?? '').includes('html')) return null
    const html = (await res.text()).slice(0, 400_000)
    const text = strip(html)
    return { text, tech: techSignals(html) }
  } catch {
    return null
  }
}

/* ---------- validation ---------- */

type Service = {
  category: string; fit: string; confidence: string; rationale: string
  evidence: string | null; confirm_question: string; disqualifier: string
}

/* Every category verdict is checked, and a failure DOWNGRADES rather
   than discards. A claim that says "observed" without a quote that is
   actually on the page is not worthless - it is an inference that
   overstated itself, and recording it as an inference is more useful
   than throwing the analysis away. */
function validateServices(raw: unknown, pageText: string | null): { services: Service[]; notes: string[] } {
  const notes: string[] = []
  const out: Service[] = []
  const seen = new Set<string>()

  for (const r of Array.isArray(raw) ? raw : []) {
    const c = String((r as Service)?.category ?? '')
    if (!CATEGORIES.includes(c)) { notes.push(`unknown category "${c}"`); continue }
    if (seen.has(c)) { notes.push(`duplicate category ${c}`); continue }
    seen.add(c)

    const s = r as Service
    let fit = FITS.includes(s.fit) ? s.fit : 'possible'
    let confidence = CONFIDENCES.includes(s.confidence) ? s.confidence : 'guessed'
    let evidence = typeof s.evidence === 'string' && s.evidence.trim() ? s.evidence.trim() : null

    if (confidence === 'observed') {
      if (!evidence || !pageText || !norm(pageText).includes(norm(evidence))) {
        /* The quote is not on the page. Downgrade rather than trust it. */
        notes.push(`${c}: evidence not found on the page, downgraded to inferred`)
        confidence = 'inferred'
        evidence = null
      }
    }
    /* An inference can never be "strong". This is the guard against the
       single most expensive failure mode: deciding from a sector prior
       that a business definitely has a problem, writing to them about
       it, and being wrong in the first sentence. */
    if (confidence !== 'observed' && fit === 'strong') {
      notes.push(`${c}: strong fit without observed evidence, downgraded to possible`)
      fit = 'possible'
    }

    const rationale = String(s.rationale ?? '').trim()
    const confirm = String(s.confirm_question ?? '').trim()
    const disq = String(s.disqualifier ?? '').trim()
    if (!rationale || !confirm || !disq) {
      notes.push(`${c}: missing rationale, question or disqualifier — dropped`)
      continue
    }
    out.push({ category: c, fit, confidence, rationale, evidence, confirm_question: confirm, disqualifier: disq })
  }
  return { services: out, notes }
}

const pick = (v: unknown, allowed: string[], fallback: string) =>
  typeof v === 'string' && allowed.includes(v) ? v : fallback

/* ---------- one lead ---------- */

async function assess(lead: Lead) {
  const facts = factsFor(lead)
  const site = lead.website ? await fetchSite(lead.website) : null

  const parts: string[] = []
  parts.push(priorBlock(lead))
  parts.push('')
  if (facts.length) {
    parts.push('REGISTER FACTS (verified):')
    for (const f of facts) parts.push(`- key: ${f.key}\n  ${f.fact}`)
  } else parts.push('REGISTER FACTS: none beyond the company existing.')
  parts.push('')
  if (!lead.website) {
    parts.push('WEBSITE: none was found for this business.')
  } else if (!site) {
    parts.push(`WEBSITE: ${lead.website} was listed but could not be read (no response, or not HTML).`)
  } else {
    if (site.tech.length) {
      parts.push('DETECTED IN THE PAGE SOURCE (facts, not opinions):')
      for (const t of site.tech) parts.push(`- ${t}`)
      parts.push('')
    }
    parts.push('PAGE TEXT:')
    parts.push(site.text.slice(0, MAX_PAGE_CHARS))
  }

  const pr = PROMPTS.assess
  if (!pr) throw new Error('no assess prompt in public.outreach_prompt')
  const { text: raw, model } = await ask('assess', pr.body, parts.join('\n'), pr.temperature)

  let p: Record<string, unknown>
  try { p = parseJson(raw) } catch { return { ok: false as const, why: 'assessment was not JSON' } }

  const { services, notes } = validateServices(p.services, site?.text ?? null)
  if (!services.length) return { ok: false as const, why: 'no usable category verdicts' }

  /* Findings the letter may be written from, each quote checked against
     the page once, here, so the write stage can only pick verified
     material. */
  const findings = (Array.isArray(p.findings) ? p.findings : [])
    .filter((f: { quote?: string }) =>
      f?.quote && site?.text && norm(site.text).includes(norm(f.quote)))
    .slice(0, 3)

  /* web_presence is not taken on trust where we can check it. If no
     site was readable it is not a brochure, whatever the model says. */
  let presence = pick(p.web_presence, PRESENCE, 'brochure')
  if (!lead.website) presence = 'none'
  else if (!site) presence = 'placeholder'

  const technical = pick(p.technical_capacity, CAPACITY, lead.prior_technical ?? 'mixed')
  let credit = pick(p.credit_fit, CREDITS, 'assist')
  /* The rule from 13-credits and service-categories §5: a training day
     booked for people who will not attend is money burned. Educate is
     not available where nobody could maintain anything. */
  if (credit === 'educate' && technical === 'unlikely') {
    notes.push('educate credits proposed for a business with no technical capacity — changed to assist')
    credit = 'assist'
  }

  return {
    ok: true as const,
    model,
    findings,
    facts,
    services,
    notes,
    web_presence: presence,
    technical_capacity: technical,
    inbound_volume: pick(p.inbound_volume, VOLUME, lead.prior_inbound ?? 'low'),
    credit_fit: credit,
    credit_reason: String(p.credit_reason ?? '').slice(0, 500),
    summary: String(p.summary ?? '').slice(0, 800),
    sector_correction: typeof p.sector_correction === 'string' && p.sector_correction.trim()
      ? p.sector_correction.trim() : null,
  }
}

async function writeClause(
  lead: Lead,
  facts: Fact[],
  findings: { what: string; quote: string }[],
  services: Service[],
) {
  if (!facts.length && !findings.length) {
    return { ok: false as const, why: 'nothing true to say about this lead' }
  }

  const best = services.find((s) => s.fit === 'strong') ?? services.find((s) => s.fit === 'possible')

  const parts: string[] = []
  if (best) {
    parts.push(`BEST FIT: ${best.category} — ${best.rationale}`)
    parts.push('Let this steer what you notice. Do not name or pitch the service.')
    parts.push('')
  }
  if (facts.length) {
    parts.push('FACTS (verified, from public registers):')
    for (const f of facts) parts.push(`- key: ${f.key}\n  ${f.fact}\n  angle: ${f.angle}`)
  } else parts.push('FACTS: none beyond the company existing.')
  parts.push('')
  if (findings.length) {
    parts.push('PAGE FINDINGS (quotes already verified against their site):')
    for (const c of findings) parts.push(`- ${c.what}\n  quote: "${c.quote}"`)
  } else parts.push('PAGE FINDINGS: none.')

  const pr = PROMPTS.write
  if (!pr) throw new Error('no write prompt in public.outreach_prompt')
  const { text: raw, model } = await ask('write', pr.body, parts.join('\n'), pr.temperature)

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
    /* The second gate: the quote must be one the assess stage already
       checked against the page. */
    if (!findings.some((c) => norm(c.quote) === norm(ev))) {
      return { ok: false as const, why: 'evidence is not one of the verified quotes' }
    }
    return { ok: true as const, observation: obs, basis: 'page', evidence: ev, model }
  }

  const f = facts.find((x) => x.key === String(p.fact_key ?? ''))
  if (!f) return { ok: false as const, why: 'cited a register fact we did not supply' }
  return { ok: true as const, observation: obs, basis: 'register', evidence: f.evidence, model }
}

/* ---------- entry ---------- */

Deno.serve(async (req) => {
  const presented = req.headers.get('x-outreach-secret') ?? ''
  let allowed = false
  try {
    allowed = await rpc('outreach_verify_cron_secret', { p_secret: presented }) === true
  } catch { allowed = false }
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403, headers: { 'content-type': 'application/json' },
    })
  }
  if (!GEMINI_KEY) {
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY is not set', hint: 'Dashboard -> Edge Functions -> Secrets' }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    )
  }

  const started = Date.now()
  const detail: unknown[] = []
  let attempted = 0, written = 0, rejected = 0

  try {
    /* No page cache to sweep any more. The assess stage fetches and
       reads within one invocation, so page text never touches disk. */
    PROMPTS = await rpc('outreach_prompts', {}) ?? {}
    if (!PROMPTS.assess || !PROMPTS.write) {
      throw new Error('public.outreach_prompt is missing the assess or write row')
    }

    const body = await req.json().catch(() => ({}))
    const limit = Number(body?.limit ?? BATCH)
    const leads: Lead[] = await rpc('outreach_next_batch', { p_limit: limit })

    for (const lead of leads ?? []) {
      attempted++
      try {
        const a = await assess(lead)
        if (!a.ok) {
          await rpc('outreach_record_failure', { p_lead_id: lead.lead_id, p_error: a.why })
          rejected++
          detail.push({ company: lead.company, rejected: a.why })
          continue
        }

        /* The assessment is stored whether or not a clause comes out of
           it. A lead we understand but have not yet phrased is worth
           far more than one we skipped. */
        await rpc('outreach_record_fit', {
          p_lead_id: lead.lead_id,
          p_web_presence: a.web_presence,
          p_technical: a.technical_capacity,
          p_inbound: a.inbound_volume,
          p_credit_fit: a.credit_fit,
          p_credit_reason: a.credit_reason,
          p_summary: a.sector_correction
            ? `[sector correction: ${a.sector_correction}] ${a.summary}`
            : a.summary,
          p_services: a.services,
          p_model: a.model,
        })

        const w = await writeClause(lead, a.facts, a.findings, a.services)
        if (w.ok) {
          await rpc('outreach_record_observation', {
            p_lead_id: lead.lead_id,
            p_observation: w.observation,
            p_basis: w.basis,
            p_evidence: w.evidence,
            p_model: w.model,
          })
          written++
          detail.push({
            company: lead.company,
            presence: a.web_presence,
            credit: a.credit_fit,
            strongest: a.services.find((s) => s.fit === 'strong')?.category ?? null,
            observation: w.observation,
            notes: a.notes.length ? a.notes : undefined,
            sector_correction: a.sector_correction ?? undefined,
          })
        } else {
          await rpc('outreach_record_failure', { p_lead_id: lead.lead_id, p_error: w.why })
          rejected++
          detail.push({ company: lead.company, assessed: true, clause_rejected: w.why, notes: a.notes })
        }
      } catch (err) {
        const msg = (err as Error).message
        await rpc('outreach_record_failure', { p_lead_id: lead.lead_id, p_error: msg })
        rejected++
        detail.push({ company: lead.company, error: msg })
        if (/no budget left|rate limited/i.test(msg)) break
      }
    }

    await rpc('outreach_log_run', {
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
      status: 500, headers: { 'content-type': 'application/json' },
    })
  }
})
