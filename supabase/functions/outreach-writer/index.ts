/* ============================================================
   THE OUTREACH WRITER: THREE AGENTS, ONE ARGUMENT

   For each lead, three models negotiate over what a stranger reads
   first. A few leads at a time, woken by pg_cron, so it runs with the
   laptop shut.

     scout    Reads the business's own page and the public register
              facts. Produces the assessment, then ARGUES: several
              cases for what the opening clause could be, each with
              its evidence, its reason and its risk.

     editor   Never sees the page. Sees only the cases as argued.
              Promotes one, says why the others lost, briefs the
              writer. May promote nothing.

     writer   Writes what it was handed, or REFUSES with a reason.
              A refusal goes back to the editor, which promotes a
              different case, up to max_rounds.

   WHY THE EDITOR IS BLIND

   Not a limitation - the mechanism. A case that needs the page to make
   sense will not survive the business reading it either, because they
   are not holding our research, they are holding one sentence. Judging
   the argument on its own is the same test the recipient applies.

   It is safe because every quote is checked against the page in code
   before the editor ever sees it, so the editor can only choose
   between things already known to be true.

   WHAT IT DOES NOT DO: send anything. approval-gates.md says both
   gates are human and both are before sending. This fills the queue up
   to the gate and stops.

   WHERE THE DECISIONS LIVE

   Almost nothing in this file is a decision. The vocabulary, the model
   chain, the rate limits, the prompts, the register-fact rules, the
   page-source patterns and every threshold are rows, fetched in one
   outreach_config() call per tick. Adding a service category, swapping
   a deprecated model or retuning a threshold is an INSERT and takes
   effect within ten minutes.

   What stays here is the guards, in ./guards.mjs, and they name no
   term: they ask the registry which terms demand evidence rather than
   knowing that the word is "observed". A guard the registry could edit
   would not be a guard. The negotiation loop lives there too, for a
   duller reason - this file needs Deno, guards.mjs does not, and the
   editor-writer handoff is too important to be tested by deploying it.

   WHAT LEAVES THE BUILDING

   Register facts, the sector prior, and the business's own public page
   text. No company name, no contact route, no address, nothing else
   from the database.
   ============================================================ */

import {
  makeVocab, coerce, applyRequirement, validateServices, validateAngles,
  validatePromotion, validateClause, buildFacts, detectSignals, clampSettings,
  negotiate,
} from './guards.mjs'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const GEMINI_BASE = Deno.env.get('GEMINI_BASE_URL') ??
  'https://generativelanguage.googleapis.com'

type Cfg = {
  vocabulary: Record<string, unknown[]>
  models: Record<string, { model: string; rpd: number; gap_ms: number; temperature: number | null }[]>
  fact_rules: Record<string, unknown>[]
  page_signals: { key: string; pattern: string; flags: string; description: string }[]
  settings: Record<string, unknown>
  prompts: Record<string, { body: string; temperature: number }>
  sectors: { sector: string; label: string }[]
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

/* ---------- asking a model ---------- */

let lastCallAt = 0

async function ask(
  cfg: Cfg,
  role: string,
  system: string,
  user: string,
  temperature: number,
  timeoutMs: number,
): Promise<{ text: string; model: string }> {
  const chain = cfg.models[role] ?? []
  if (!chain.length) throw new Error(`no models registered for "${role}" in public.outreach_model`)

  let last = ''
  for (const spec of chain) {
    const budget = await rpc('outreach_model_budget', { p_model: spec.model })
    if (!budget || budget <= 0) { last = `${spec.model}: no budget left today`; continue }

    const wait = lastCallAt + (spec.gap_ms ?? 4000) - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastCallAt = Date.now()

    let res: Response
    try {
      res = await fetch(`${GEMINI_BASE}/v1beta/models/${spec.model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            temperature: spec.temperature ?? temperature,
            topP: 0.95,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (err) {
      last = `${spec.model}: ${(err as Error).name === 'TimeoutError' ? 'timed out' : (err as Error).message}`
      continue
    }

    await rpc('outreach_record_call', { p_model: spec.model, p_rate_limited: res.status === 429 })

    if (res.status === 429) { last = `${spec.model}: rate limited`; continue }
    if (res.status === 404) { last = `${spec.model}: not available`; continue }
    if (res.status === 400) {
      const body = await res.text()
      if (/API key not valid/i.test(body)) throw new Error('GEMINI_API_KEY is set but not valid')
      last = `${spec.model}: bad request`
      continue
    }
    if (!res.ok) { last = `${spec.model}: HTTP ${res.status}`; continue }

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string' || !text.trim()) { last = `${spec.model}: empty answer`; continue }
    return { text, model: spec.model }
  }
  throw new Error(last || `no model answered for ${role}`)
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

async function fetchSite(cfg: Cfg, url: string, settings: Record<string, number | string>) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': String(settings.user_agent), accept: 'text/html' },
      signal: AbortSignal.timeout(Number(settings.fetch_timeout_ms)),
    })
    if (!res.ok) return null
    if (!(res.headers.get('content-type') ?? '').includes('html')) return null
    const html = (await res.text()).slice(0, 400_000)
    return { text: strip(html), ...detectSignals(cfg.page_signals, html) }
  } catch {
    return null
  }
}

/* ---------- the scout ---------- */

type Vocab = ReturnType<typeof makeVocab>

function priorBlock(cfg: Cfg, lead: Record<string, any>, minSample: number): string {
  const lines: string[] = []
  const yes = (b: unknown) => (b ? 'yes' : 'no')

  if (!lead.prior) {
    lines.push('SECTOR PRIOR: none — the triage did not classify this business. Work entirely from the page.')
  } else {
    const p = lead.prior
    lines.push(`SECTOR PRIOR for "${lead.sector}" (a keyword triage's guess — contradict it if the page disagrees):`)
    lines.push(`  ${p.label}: ${p.note}`)
    lines.push(`  plausibly needs booking: ${yes(p.needs_booking)}   scheduling: ${yes(p.needs_scheduling)}`)
    lines.push(`  record-heavy: ${yes(p.record_heavy)}   data worth analysing: ${yes(p.data_worth_having)}   public facing: ${yes(p.public_facing)}`)
    lines.push(`  expected technical capacity: ${p.technical_capacity}   expected inbound volume: ${p.inbound_volume}`)
  }

  /* The seed prior is somebody's opinion from an afternoon in
     September. This is what the assessments have actually found, shown
     beside it once the sample is worth showing, with no blending:
     averaging the two would hide which one is wrong. */
  const o = lead.observed
  if (o && Number(o.n) >= minSample) {
    lines.push('')
    lines.push(`WHAT PREVIOUS ASSESSMENTS FOUND IN THIS SECTOR (${o.n} businesses — evidence about the sector, not about this one):`)
    if (o.by_category) {
      for (const [cat, counts] of Object.entries(o.by_category as Record<string, Record<string, number>>)) {
        lines.push(`  ${cat}: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}`)
      }
    }
    for (const dim of ['technical_capacity', 'inbound_volume', 'credit_fit']) {
      if (o[dim]) lines.push(`  ${dim}: ${Object.entries(o[dim] as Record<string, number>).map(([k, v]) => `${k} ${v}`).join(', ')}`)
    }
  }

  if (cfg.sectors.length) {
    lines.push('')
    lines.push(`SECTOR KEYS you may correct to: ${cfg.sectors.map((s) => s.sector).join(', ')}`)
  }
  return lines.join('\n')
}

function registryBlock(vocab: Vocab): string {
  return [
    vocab.describe('category', 'SERVICE CATEGORIES — assess each one you have something to say about'),
    '',
    vocab.describe('fit', 'FIT'),
    '',
    vocab.describe('confidence', 'CONFIDENCE'),
    '',
    vocab.describe('web_presence', 'WEB PRESENCE — what they look like from outside'),
    '',
    vocab.describe('technical_capacity', 'TECHNICAL CAPACITY — whether anyone inside would maintain what we build'),
    '',
    vocab.describe('inbound_volume', 'INBOUND VOLUME — whether answering enquiries is a visible cost'),
    '',
    vocab.describe('credit', 'CREDIT FIT — which of the three to lead with after delivery'),
  ].filter(Boolean).join('\n')
}

async function scout(cfg: Cfg, vocab: Vocab, lead: Record<string, any>, settings: any) {
  const facts = buildFacts(cfg.fact_rules, lead)
  const site = lead.website ? await fetchSite(cfg, lead.website, settings) : null

  const parts: string[] = [registryBlock(vocab), '', priorBlock(cfg, lead, settings.prior_min_sample), '']

  if (facts.length) {
    parts.push('REGISTER FACTS (verified — an angle may cite one of these by key):')
    for (const f of facts) parts.push(`- key: ${f.key}\n  ${f.fact}\n  how to read it: ${f.angle}`)
  } else parts.push('REGISTER FACTS: none beyond the company existing.')
  parts.push('')

  if (!lead.website) {
    parts.push('WEBSITE: none was found for this business.')
  } else if (!site) {
    parts.push('WEBSITE: one was listed but could not be read (no response, or not HTML).')
  } else {
    if (site.found.length) {
      parts.push('DETECTED IN THE PAGE SOURCE (facts, not opinions):')
      for (const t of site.found) parts.push(`- ${t}`)
      parts.push('')
    }
    parts.push('PAGE TEXT:')
    parts.push(site.text.slice(0, settings.max_page_chars))
  }

  const pr = cfg.prompts.scout
  if (!pr) throw new Error('no scout prompt in public.outreach_prompt')
  const { text: raw, model } = await ask(
    cfg, 'scout', pr.body, parts.join('\n'), pr.temperature, settings.model_timeout_ms)

  let p: Record<string, any>
  try { p = parseJson(raw) } catch { return { ok: false as const, why: 'assessment was not JSON', model } }

  const page = site?.text ?? null
  const { services, notes } = validateServices(vocab, p.services, page)
  if (!services.length) return { ok: false as const, why: 'no usable category verdicts', model }

  const av = validateAngles(vocab, p.angles, { pageText: page, facts, max: settings.max_angles })
  notes.push(...av.notes, ...(site?.notes ?? []))

  /* Not taken on trust where the answer is already known. If no site
     was readable it is not a brochure, whatever the model says. */
  let presence = coerce(vocab, 'web_presence', p.web_presence)
  if (!lead.website) presence = 'none'
  else if (!site) presence = 'placeholder'

  const assessed: Record<string, string> = {
    web_presence: presence,
    technical_capacity: coerce(vocab, 'technical_capacity', p.technical_capacity, lead.prior?.technical_capacity),
    inbound_volume: coerce(vocab, 'inbound_volume', p.inbound_volume, lead.prior?.inbound_volume),
  }
  assessed.credit_fit = applyRequirement(
    vocab, 'credit', coerce(vocab, 'credit', p.credit_fit), assessed, notes)

  const correction = typeof p.sector_correction === 'string' &&
    cfg.sectors.some((s) => s.sector === p.sector_correction) ? p.sector_correction : null

  return {
    ok: true as const,
    model,
    facts,
    services,
    angles: av.angles,
    notes,
    assessment: {
      ...assessed,
      credit_reason: String(p.credit_reason ?? '').slice(0, 500),
      summary: String(p.summary ?? '').slice(0, 800),
      sector_correction: correction,
      sector_correction_why: correction ? String(p.sector_correction_why ?? '').slice(0, 300) : null,
    },
  }
}

/* ---------- the editor ---------- */

async function editor(
  cfg: Cfg,
  angles: any[],
  summary: string,
  refusals: { key: string; why: string }[],
  settings: any,
) {
  const open = angles.filter((a) => !refusals.some((r) => r.key === a.key))
  if (!open.length) {
    return { ok: false as const, because: 'every case argued has been refused by the writer', model: null }
  }

  const parts: string[] = [`WHAT THE RESEARCHER MADE OF THEM: ${summary || '(nothing said)'}`, '', 'THE CASES:']
  for (const a of open) {
    parts.push('')
    parts.push(`key: ${a.key}`)
    parts.push(`  claim: ${a.claim}`)
    parts.push(a.basis === 'page' ? `  rests on their own page: "${a.quote}"` : `  rests on a public register: ${a.fact_key}`)
    parts.push(`  why it: ${a.why}`)
    parts.push(`  risk:   ${a.risk}`)
  }
  if (refusals.length) {
    parts.push('')
    parts.push('ALREADY REFUSED BY THE WRITER — do not promote these again:')
    for (const r of refusals) parts.push(`- ${r.key}: ${r.why}`)
  }

  const pr = cfg.prompts.editor
  if (!pr) throw new Error('no editor prompt in public.outreach_prompt')
  const { text: raw, model } = await ask(
    cfg, 'editor', pr.body, parts.join('\n'), pr.temperature, settings.model_timeout_ms)

  let p: Record<string, unknown>
  try { p = parseJson(raw) } catch { return { ok: false as const, because: 'editor did not return JSON', model } }

  const v = validatePromotion(p, open, refusals.map((r) => r.key))
  return { ...v, model } as { ok: boolean; angle?: any; because: string; brief?: string; model: string }
}

/* ---------- the writer ---------- */

async function writer(cfg: Cfg, angle: any, brief: string, facts: any[], settings: any, revise?: { previous: string; change: string }) {
  const parts: string[] = []
  parts.push(`THE BRIEF: ${brief || 'write the angle below'}`)
  parts.push('')
  parts.push(`THE ANGLE: ${angle.claim}`)
  if (angle.basis === 'page') {
    parts.push(`It rests on this, quoted from their own site: "${angle.quote}"`)
  } else {
    const f = facts.find((x) => x.key === angle.fact_key)
    parts.push(`It rests on this public register fact: ${f?.fact}`)
    if (f?.angle) parts.push(`How to read it: ${f.angle}`)
  }
  parts.push(`The editor's worry about it: ${angle.risk}`)
  parts.push('')
  parts.push('Nothing else about this business is known to you. Anything not above does not exist.')

  /* A revision is the same job with one instruction added, not a new
     one. The previous sentence is shown so the writer changes it
     rather than starting again - starting again loses whatever was
     already right about it. */
  if (revise) {
    parts.push('')
    parts.push('YOU HAVE ALREADY WRITTEN THIS ONCE:')
    parts.push(`  ${revise.previous}`)
    parts.push('')
    parts.push(`THE EDITOR WANTS ONE CHANGE: ${revise.change}`)
    parts.push('Make that change and nothing else. Every rule above still applies.')
  }

  const pr = cfg.prompts.writer
  if (!pr) throw new Error('no writer prompt in public.outreach_prompt')
  const { text: raw, model } = await ask(
    cfg, 'writer', pr.body, parts.join('\n'), pr.temperature, settings.model_timeout_ms)

  let p: Record<string, unknown>
  try { p = parseJson(raw) } catch { return { ok: false as const, refused: false, why: 'reply was not JSON', model } }
  return { ...validateClause(p, { angle, facts, settings }), model }
}

/* ---------- the editor, reading the sentence ---------- */
/*
   Same agent, same model chain, different job and different prompt.
   It is deliberately NOT a fourth agent: "oversee the other three" is
   not a task with an output, and a supervisor with nothing concrete to
   decide either rubber-stamps or vetoes. This one has exactly one
   artefact in front of it and two moves.
*/
async function reviewer(cfg: Cfg, angle: any, brief: string, draft: any, settings: any) {
  const pr = cfg.prompts.review
  if (!pr) return null

  const parts = [
    `THE BRIEF YOU GAVE: ${brief || '(none)'}`,
    `THE ANGLE: ${angle.claim}`,
    angle.basis === 'page'
      ? `IT RESTS ON, quoted from their own site: "${angle.quote}"`
      : `IT RESTS ON a public register fact: ${angle.fact_key}`,
    '',
    'THE SENTENCE THAT CAME BACK:',
    `  ${draft.observation}`,
  ]

  try {
    const { text: raw, model } = await ask(
      cfg, 'editor', pr.body, parts.join('\n'), pr.temperature, settings.model_timeout_ms)
    try { return { parsed: parseJson(raw), model } }
    catch { return { parsed: null, model } }
  } catch (err) {
    /* A reviewer that could not be reached must not cost us a draft
       that already passed every guard. Absence is acceptance. */
    return { parsed: null, model: null, error: (err as Error).message }
  }
}

/* ---------- one lead ---------- */

/* By registry rank, not by input order and not by looking for the word
   "strong". Reported in the run detail so a morning skim shows what the
   assessment thought each business was about. */
function strongestOf(vocab: Vocab, services: any[]): string | null {
  let best: any = null
  for (const s of services) {
    const r = (vocab.rank('fit', s.fit) ?? -1) * 10 + (vocab.rank('confidence', s.confidence) ?? 0)
    if (!best || r > best.r) best = { r, category: s.category }
  }
  return best?.category ?? null
}

async function handle(cfg: Cfg, vocab: Vocab, lead: Record<string, any>, settings: any) {
  const log = (round: number, agent: string, model: string | null, decision: string, key?: string | null, reason?: string | null) =>
    rpc('outreach_record_round', {
      p_lead_id: lead.lead_id, p_round: round, p_agent: agent,
      p_model: model ?? 'none', p_decision: decision,
      p_angle_key: key ?? null, p_reason: reason ?? null,
    }).catch(() => {})

  const s = await scout(cfg, vocab, lead, settings)
  if (!s.ok) {
    await log(0, 'scout', s.model ?? null, 'failed', null, s.why)
    return { ok: false as const, why: s.why }
  }
  await log(0, 'scout', s.model, 'argued', null,
    `${s.services.length} verdicts, ${s.angles.length} angles: ${s.angles.map((a: any) => a.key).join(', ')}`)

  /* The assessment is stored whether or not a clause comes out of it. A
     lead we understand but have not yet phrased is worth far more than
     one we skipped, and the next tick should not pay to learn it
     again. */
  await rpc('outreach_record_fit', {
    p_lead_id: lead.lead_id,
    p_assessment: s.assessment,
    p_services: s.services,
    p_model: s.model,
  })

  if (!s.angles.length) return { ok: false as const, why: 'nothing true to say about this lead', assessed: true }

  /* The loop itself is in guards.mjs and is driven by the tests with
     fakes. What is left here is only the two model calls it needs. */
  const r = await negotiate({
    angles: s.angles,
    summary: s.assessment.summary,
    maxRounds: settings.max_rounds,
    maxRevisions: settings.max_revisions,
    callEditor: ({ angles, summary, refusals }) => editor(cfg, angles, summary, refusals, settings),
    callWriter: ({ angle, brief, revise }) => writer(cfg, angle, brief, s.facts, settings, revise),
    callReview: cfg.prompts.review
      ? ({ angle, brief, draft }) => reviewer(cfg, angle, brief, draft, settings)
      : null,
    onRound: (m) => log(m.round, m.agent, m.model, m.decision, m.angle_key, m.reason),
  })

  if (!r.ok) return { ok: false as const, why: r.why, assessed: true, refusals: r.refusals.length }

  await rpc('outreach_record_observation', {
    p_lead_id: lead.lead_id,
    p_observation: r.clause.observation,
    p_basis: r.clause.basis,
    p_evidence: r.clause.evidence,
    p_model: r.clause.model,
  })

  return {
    ok: true as const,
    observation: r.clause.observation,
    angle: r.angle.key,
    rounds: r.rounds,
    revisions: r.revisions,
    assessment: s.assessment,
    notes: s.notes,
    strongest: strongestOf(vocab, s.services),
  }
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
    const cfg: Cfg = await rpc('outreach_config', {})
    for (const role of ['scout', 'editor', 'writer']) {
      if (!cfg?.prompts?.[role]) throw new Error(`public.outreach_prompt has no "${role}" row`)
      if (!cfg?.models?.[role]?.length) throw new Error(`public.outreach_model has no active "${role}" rows`)
    }
    const vocab = makeVocab(cfg.vocabulary)
    const settings = clampSettings(cfg.settings)

    const body = await req.json().catch(() => ({}))
    const limit = Math.max(1, Math.min(Number(body?.limit ?? settings.batch_size) || settings.batch_size, 25))
    const leads: Record<string, any>[] = await rpc('outreach_next_batch', { p_limit: limit })

    for (const lead of leads ?? []) {
      attempted++
      try {
        const r = await handle(cfg, vocab, lead, settings)
        if (r.ok) {
          written++
          detail.push({
            company: lead.company, angle: r.angle, rounds: r.rounds,
            revisions: r.revisions || undefined,
            presence: r.assessment.web_presence, credit: r.assessment.credit_fit,
            strongest: r.strongest, observation: r.observation,
            sector_correction: r.assessment.sector_correction ?? undefined,
            notes: r.notes.length ? r.notes : undefined,
          })
        } else {
          await rpc('outreach_record_failure', { p_lead_id: lead.lead_id, p_error: r.why })
          rejected++
          detail.push({ company: lead.company, assessed: (r as any).assessed ?? false, rejected: r.why })
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
