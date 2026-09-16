/* ============================================================
   THE OUTREACH WRITER: AN ARGUMENT, IN FIVE STAGES

   For each lead, several models negotiate over what a stranger reads
   first. A few leads at a time, woken by pg_cron, so it runs with the
   laptop shut.

     scout       Reads the business's own page and the public register
                 facts. Produces the assessment, then ARGUES: several
                 cases for what the opening clause could be, each with
                 its evidence, its reason and its risk.

     editor      Never sees the page. Sees only the cases as argued.
                 Promotes one, says why the others lost, briefs the
                 writer. May promote nothing.

     strategist  Takes the promoted case and works out what it MEANS
                 for this business: the tension, and the moment they
                 would recognise. The only stage that sees the sector
                 and the capability.

     writer      Writes the clause, or REFUSES with a reason. A refusal
                 goes back to the editor, which promotes a different
                 case, up to max_rounds. The editor then reads the
                 SENTENCE and may ask for one change.

     letter      Writes the whole first-contact body around the clause.

   WHY THE EDITOR IS BLIND

   Not a limitation - the mechanism. A case that needs the page to make
   sense will not survive the business reading it either, because they
   are not holding our research, they are holding one sentence. Judging
   the argument on its own is the same test the recipient applies.

   It is safe because every quote is checked against the page in code
   before the editor ever sees it, so the editor can only choose
   between things already known to be true.

   WHY THE STRATEGIST EXISTS

   Because nobody owned the step between choosing a true thing and
   phrasing it, the writer was doing both at once, and what came out
   was a quote followed by a paraphrase with a hedge on it:

     "you mention using a unique diary system to ensure VAT deadlines
      are not missed, which typically relies on someone manually
      updating those entries"

   True, and an answer to a comprehension question rather than a reason
   to write to somebody. business/11-outreach/sales-language.md is the
   full account.

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

   That still holds with the letter stage, which obviously needs a name
   in it: the prompt writes {business} and the substitution happens
   here, after the letter has passed every check. A model that tried to
   write a name of its own is refused rather than quietly corrected.
   ============================================================ */

import {
  makeVocab, coerce, applyRequirement, validateServices, validateAngles,
  validatePromotion, validateClause, buildFacts, detectSignals, clampSettings,
  negotiate, registryBlock, quotaScope,
  validateHook, validateLetter, fillLetter, tradingName,
} from './guards.mjs'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_BASE = Deno.env.get('GEMINI_BASE_URL') ??
  'https://generativelanguage.googleapis.com'

/* WHICH KEY A MODEL IS CALLED WITH
   -------------------------------
   Gemini's free-tier quota is per project and per model within it, so a
   second project is a second daily pool of the same model. Which project
   a role uses is a registry decision - outreach_model.key_secret names
   the environment variable - and not a branch in here, so adding a third
   is a row and a secret rather than a deploy.

   The registry names the secret. This decides whether it may be read.
   A row that could name any environment variable could name
   SUPABASE_SERVICE_ROLE_KEY, so the name is tested against the same
   shape the check constraint enforces, and read from nowhere else. The
   schema says it and the code says it: a prompt rule is a request, a
   guard is a rule. */
const KEY_SECRET = /^GEMINI_[A-Z0-9_]*$/
const DEFAULT_KEY_SECRET = 'GEMINI_API_KEY'

function keyFor(name: string | null | undefined): string {
  const secret = name || DEFAULT_KEY_SECRET
  if (!KEY_SECRET.test(secret)) return ''
  return Deno.env.get(secret) ?? ''
}

const GEMINI_KEY = keyFor(DEFAULT_KEY_SECRET)

type Cfg = {
  vocabulary: Record<string, unknown[]>
  models: Record<string, {
    model: string; rpd: number; gap_ms: number
    temperature: number | null; key_secret?: string | null
  }[]>
  fact_rules: Record<string, unknown>[]
  page_signals: { key: string; pattern: string; flags: string; description: string }[]
  dimensions: { dimension: string; heading: string }[]
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
    /* A model whose key is not set is skipped, not fatal. Registering a
       role against a project whose secret has not been added yet should
       cost that role its turn in the chain, not the whole run. */
    const secret = spec.key_secret || DEFAULT_KEY_SECRET
    const key = keyFor(secret)
    if (!key) {
      last = KEY_SECRET.test(secret)
        ? `${spec.model}: ${secret} is not set`
        : `${spec.model}: ${secret} is not a name this function may read`
      continue
    }

    const budget = await rpc('outreach_model_budget',
      { p_model: spec.model, p_key_secret: secret })
    if (!budget || budget <= 0) { last = `${spec.model}: no budget left today`; continue }

    const wait = lastCallAt + (spec.gap_ms ?? 4000) - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastCallAt = Date.now()

    let res: Response
    try {
      res = await fetch(`${GEMINI_BASE}/v1beta/models/${spec.model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
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

    /* A 429 is read, not assumed. Before this, every one of them wrote
       the model off until midnight, so a single busy minute cost a day
       of the best model in the chain. */
    const body429 = res.status === 429 ? await res.text() : ''
    const scope = quotaScope(res.status, body429)
    await rpc('outreach_record_call', {
      p_model: spec.model,
      p_rate_limited: scope === 'day',
      p_minute_limited: scope === 'minute',
      p_key_secret: secret,
    })

    if (res.status === 429) {
      last = `${spec.model}: ${scope === 'day' ? 'daily quota reached' : 'too many requests this minute'}`
      continue
    }
    if (res.status === 404) { last = `${spec.model}: not available`; continue }
    if (res.status === 400) {
      const body = await res.text()
      if (/API key not valid/i.test(body)) throw new Error(`${secret} is set but not valid`)
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

async function scout(cfg: Cfg, vocab: Vocab, lead: Record<string, any>, settings: any) {
  const facts = buildFacts(cfg.fact_rules, lead)
  const site = lead.website ? await fetchSite(cfg, lead.website, settings) : null

  const parts: string[] = [registryBlock(vocab, cfg.dimensions), '', priorBlock(cfg, lead, settings.prior_min_sample), '']

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
    /* Which patterns matched, not just what they said. The re-score
       turns these into scoring-model.md catalogue codes, and a signal
       point that cannot name what matched is a claim we could not
       stand behind. Absent (rather than empty) when no page was read. */
    signalKeys: site ? (site.keys ?? []) : null,
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

async function writer(cfg: Cfg, angle: any, brief: string, facts: any[], settings: any, revise?: { previous: string; change: string }, hook?: any) {
  const parts: string[] = []
  parts.push(`THE BRIEF: ${hook?.brief || brief || 'write the angle below'}`)
  parts.push('')
  /* The strategist already did the thinking. Handing the writer the
     tension and the moment, rather than only the fact, is what stops it
     paraphrasing the quote and calling that an observation. */
  if (hook) {
    parts.push(`WHAT THIS MEANS FOR THEM: ${hook.tension}`)
    parts.push(`THE MOMENT THEY WOULD RECOGNISE: ${hook.recognition}`)
    if (hook.must_not_imply) parts.push(`IT MUST NOT READ AS: ${hook.must_not_imply}`)
    parts.push('')
  }
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

/* ---------- the strategist ---------- */
/*
   What the observation MEANS for this business. It is the only agent
   that sees the sector and the capability, because those decide whether
   a tension is plausible or presumptuous - and until now they were
   collected and then used for nothing but a CRM filter.

   It does not see the page either. It sees one verified thing and is
   asked what follows from it, which is the whole point: a strategist
   with the page in front of it would start summarising the page again.
*/
async function strategist(
  cfg: Cfg, vocab: Vocab, angle: any, brief: string,
  lead: Record<string, any>, capability: string | null, summary: string, settings: any,
) {
  const pr = cfg.prompts.strategist
  if (!pr) return null

  const parts = [
    `THE VERIFIED OBSERVATION: ${angle.claim}`,
    angle.basis === 'page'
      ? `IT RESTS ON, quoted from their own page: "${angle.quote}"`
      : `IT RESTS ON a public register fact: ${angle.fact_key}`,
    `THE EDITOR'S WORRY ABOUT IT: ${angle.risk}`,
    brief ? `THE EDITOR ASKED FOR: ${brief}` : '',
    '',
    `WHAT THE RESEARCHER MADE OF THEM: ${summary || '(nothing said)'}`,
    lead.sector ? `SECTOR: ${lead.sector}${lead.prior?.label ? ` — ${lead.prior.label}` : ''}` : 'SECTOR: not established',
  ]

  if (capability) {
    const t = vocab.get('capability', capability)
    parts.push(`THE WORK THIS WOULD BE: ${capability}${t?.meaning ? ` — ${t.meaning}` : ''}`)
  } else {
    parts.push('THE WORK THIS WOULD BE: could not be established. Work from the observation alone and do not guess one.')
  }

  try {
    const { text: raw, model } = await ask(
      cfg, 'strategist', pr.body, parts.filter(Boolean).join('\n'), pr.temperature, settings.model_timeout_ms)
    try { return { parsed: parseJson(raw), model } }
    catch { return { parsed: null, model } }
  } catch (err) {
    return { parsed: null, model: null, error: (err as Error).message }
  }
}

/* ---------- the letter ---------- */
/*
   The body, written for this business rather than merged into a slot.
   The company name is NOT sent: the prompt writes {business} and the
   substitution happens here, after the checks, which keeps the promise
   in this file's header that no company name leaves the building.
*/
async function letterWriter(
  cfg: Cfg, vocab: Vocab, clause: any, hook: any, capability: string | null, settings: any,
) {
  const pr = cfg.prompts.letter
  if (!pr) return null

  const parts = [
    `THE OBSERVATION, WORD FOR WORD — the letter is built on this and must contain it:`,
    `  ${clause.observation}`,
    '',
    hook ? `WHAT IT MEANS FOR THEM: ${hook.tension}` : '',
    hook ? `THE MOMENT THEY WOULD RECOGNISE: ${hook.recognition}` : '',
    hook?.must_not_imply ? `IT MUST NOT READ AS: ${hook.must_not_imply}` : '',
  ]
  if (capability) {
    const t = vocab.get('capability', capability)
    parts.push(`IF THEY BECAME A CLIENT THE WORK WOULD BE: ${capability}${t?.meaning ? ` — ${t.meaning}` : ''}`)
  }
  parts.push('', `Between ${settings.letter_min_words} and ${settings.letter_max_words} words.`)

  try {
    const { text: raw, model } = await ask(
      cfg, 'letter', pr.body, parts.filter(Boolean).join('\n'), pr.temperature, settings.model_timeout_ms)
    try { return { parsed: parseJson(raw), model } }
    catch { return { parsed: null, model } }
  } catch (err) {
    return { parsed: null, model: null, error: (err as Error).message }
  }
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

/* The capability of the STRONGEST verdict, not of the first one the
   model happened to list. Null stays null: sending the strategist a
   guessed capability is how a plausible tension gets written about the
   wrong kind of work. */
function capabilityOf(vocab: Vocab, services: any[]): string | null {
  let best: any = null
  for (const s of services) {
    const r = (vocab.rank('fit', s.fit) ?? -1) * 10 + (vocab.rank('confidence', s.confidence) ?? 0)
    if (!best || r > best.r) best = { r, capability: s.capability ?? null }
  }
  return best?.capability ?? null
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
    /* null when no page was read, so the re-score can tell "looked and
       found nothing" from "never looked". Only the first is a
       measurement, and only a measurement may move the score. */
    p_page_signals: s.signalKeys,
  })

  if (!s.angles.length) return { ok: false as const, why: 'nothing true to say about this lead', assessed: true }

  const capability = capabilityOf(vocab, s.services)

  /* The loop itself is in guards.mjs and is driven by the tests with
     fakes. What is left here is only the model calls it needs. */
  const r = await negotiate({
    angles: s.angles,
    summary: s.assessment.summary,
    maxRounds: settings.max_rounds,
    maxRevisions: settings.max_revisions,
    callEditor: ({ angles, summary, refusals }) => editor(cfg, angles, summary, refusals, settings),
    callStrategist: cfg.prompts.strategist
      ? ({ angle, brief }) => strategist(cfg, vocab, angle, brief, lead, capability, s.assessment.summary, settings)
      : null,
    callWriter: ({ angle, brief, hook, revise }) => writer(cfg, angle, brief, s.facts, settings, revise, hook),
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

  /* The letter, which is the thing a person actually receives. It needs
     the hook, so a lead whose strategist failed gets a clause and no
     letter rather than a letter written from a fact with no meaning
     attached - and the CRM shows which, instead of quietly filling the
     gap with a template. */
  let letter: { subject: string; words: number } | null = null
  let letterWhy: string | null = null
  if (cfg.prompts.letter && r.hook) {
    const lw = await letterWriter(cfg, vocab, r.clause, r.hook, capability, settings)
    const v: any = validateLetter(lw?.parsed, { clause: r.clause.observation, settings })
    const subject = String((lw?.parsed as any)?.subject ?? '').trim().slice(0, 200)
    if (v.ok) {
      /* The name is put in HERE, after every check has run, and never
         reaches a model. See the header: what leaves the building is
         the page text, the register facts and the sector - not who
         they are. */
      const name = tradingName(lead.company, lead.trading_name)
      const body = fillLetter(String(v.body), name)
      await rpc('outreach_record_letter', {
        p_lead_id: lead.lead_id,
        p_subject: subject || r.clause.observation.slice(0, 60),
        p_body: body,
        p_hook: r.hook,
        p_model: lw?.model ?? null,
        /* Written down so the CRM does not have to derive it again in
           SQL, and the dashboard a third time in JavaScript. Stored
           only where nobody has corrected it. */
        p_trading_name: name,
      })
      letter = { subject, words: body.split(/\s+/).length }
      await log(r.rounds, 'letter', lw?.model ?? null, 'wrote', r.angle.key, subject)
    } else {
      letterWhy = String(v.why ?? 'the letter did not pass')
      await log(r.rounds, 'letter', lw?.model ?? null, 'failed', r.angle.key, letterWhy)
    }
  } else if (!r.hook) {
    letterWhy = 'no hook, so no letter - the clause stands on its own'
  }

  return {
    ok: true as const,
    observation: r.clause.observation,
    angle: r.angle.key,
    rounds: r.rounds,
    revisions: r.revisions,
    assessment: s.assessment,
    notes: s.notes,
    strongest: strongestOf(vocab, s.services),
    letter,
    letterWhy,
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
    /* strategist and letter are NOT required here. They are the newest
       stages and a project that has not run their migration yet should
       degrade to the three-agent pipeline rather than refuse to run. */
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
            letter: r.letter ?? undefined, no_letter: r.letterWhy ?? undefined,
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
        /* Out of budget for the day is the end of the batch. A minute's
           worth of requests is not - the next lead is far enough away
           in wall-clock time that trying it is right. */
        if (/no budget left|daily quota reached/i.test(msg)) break
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
