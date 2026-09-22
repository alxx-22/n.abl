/* ============================================================
   LEAD-PROSPECTOR: FINDING BUSINESSES, AND ARGUING ABOUT THEM

   Woken by pg_cron every five minutes, exactly like outreach-writer, and
   does nothing unless a target in public.prospect_target is running -
   which only the Run button in the CRM's Lead gen tab can make true.

   Each tick:

     1. PULL     if fewer than queue_low_water candidates are waiting,
                 one page from Companies House advanced search for the
                 running target's next town. Deduplicated in SQL against
                 every candidate and every lead we already hold.
     2. ARGUE    claim a candidate and move it through as many stages as
                 the tick has time for, saving after each:

                   research -> signals <-> research review
                            -> sales -> specialist <-> sales (per service)

                 The loops and every rule are in ./prospect.mjs, which
                 scripts/check-prospector.mjs drives with fake agents.
                 This file is only the network.

   THE SAME FRAMEWORK AS OUTREACH

   Model chains, daily budgets, pacing and 429 handling come from
   public.outreach_model and outreach_model_budget / outreach_record_call,
   the same functions the writer spends through. The prospect_* rows name
   GEMINI_DISCOVERY_API_KEY; this file refuses to read GEMINI_API_KEY at
   all, and a database constraint refuses to let a prospect row name it.

   TWO SECRETS, AND NO MORE

     COMPANIES_HOUSE_API_KEY    the register (pull, profile, officers)
     GEMINI_DISCOVERY_API_KEY   the fresh Google AI Studio project

   The cron is authenticated with the outreach job's existing vault secret.

   WHAT LEAVES THE BUILDING

   To a model: the register lines built in prospect.mjs (name, activity,
   age, legal form, town, accounts category, how many directors) and the
   text of the business's own confirmed website, with its email addresses,
   phone numbers, web addresses, postcodes and company number taken out
   before any agent reads it. Never the company number,
   the registered address or postcode, or an officer's name. Nothing here
   sends an email or writes a lead: promotion is a person pressing a
   button, and the lead arrives do_not_contact.
   ============================================================ */

import {
  clampSettings, quotaScope, parseJson, domainGuesses, pageKind, parseRobots, confirms,
  stripHtml, sameSiteLinks, registerLines, validateResearch, argueSignals, validateSales,
  argueService, outcome, knowledgeOf, serviceKeys, factLines, signalLines, portfolioBlock,
  conversationBlock,
} from './prospect.mjs'
import { buildSearchUrl, chAuthHeader, normaliseItem, admit, expandSic, DEFAULT_TYPES, CH_BASE, redactContactRoutes } from './puller.mjs'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_BASE = Deno.env.get('GEMINI_BASE_URL') ?? 'https://generativelanguage.googleapis.com'
const CH_URL = Deno.env.get('COMPANIES_HOUSE_BASE_URL') ?? CH_BASE
const CH_KEY = (Deno.env.get('COMPANIES_HOUSE_API_KEY') ?? '').trim()

/* Which environment variable a registry row may name. The writer's key is
   refused by name: discovery spending the writer's pool is the one failure
   the second project exists to prevent. */
const KEY_SECRET = /^GEMINI_[A-Z0-9_]*$/
const WRITERS_KEY = 'GEMINI_API_KEY'
function keyFor(name: string | null | undefined): string {
  if (!name || !KEY_SECRET.test(name) || name === WRITERS_KEY) return ''
  return (Deno.env.get(name) ?? '').trim()
}

type Chain = { model: string; rpd: number; gap_ms: number; temperature: number | null; key_secret: string }[]
type Cfg = {
  models: Record<string, Chain>
  prompts: Record<string, { body: string; temperature: number }>
  settings: Record<string, unknown>
  knowledge: { key: string; kind: string; label: string; body: string; summary: string | null; signals: string | null }[]
}
type Reply = { raw: string | null; parsed: any; model: string | null }

/* ---------- database ---------- */

async function rpc(fn: string, args: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify(args),
  })
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

/* ---------- asking a model: the outreach chain, on the discovery key ---------- */

let lastCallAt = 0

async function ask(cfg: Cfg, role: string, system: string, user: string, temperature: number, timeoutMs: number) {
  const chain = cfg.models[role] ?? []
  if (!chain.length) throw new Error(`no models registered for "${role}" in public.outreach_model`)
  let last = ''
  for (const spec of chain) {
    const secret = spec.key_secret
    const key = keyFor(secret)
    if (!key) {
      last = secret === WRITERS_KEY ? `${spec.model}: refuses to spend the writer's key`
        : KEY_SECRET.test(secret ?? '') ? `${spec.model}: ${secret} is not set` : `${spec.model}: ${secret} is not a name this function may read`
      continue
    }
    const budget = await rpc('outreach_model_budget', { p_model: spec.model, p_key_secret: secret })
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
          generationConfig: { temperature: spec.temperature ?? temperature, topP: 0.95, responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (err) {
      last = `${spec.model}: ${(err as Error).name === 'TimeoutError' ? 'timed out' : (err as Error).message}`
      continue
    }
    const body429 = res.status === 429 ? await res.text() : ''
    const scope = quotaScope(res.status, body429)
    await rpc('outreach_record_call', {
      p_model: spec.model, p_rate_limited: scope === 'day', p_minute_limited: scope === 'minute', p_key_secret: secret,
    })
    if (res.status === 429) { last = `${spec.model}: ${scope === 'day' ? 'daily quota reached' : 'too many requests this minute'}`; continue }
    if (res.status === 404) { last = `${spec.model}: not available`; continue }
    if (res.status === 400) {
      const b = await res.text()
      if (/API key not valid/i.test(b)) throw new Error(`${secret} is set but not valid`)
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

/* One agent speaking: the prompt from the registry, the reply kept whole. */
async function talk(cfg: Cfg, settings: any, role: string, promptKey: string, user: string): Promise<Reply> {
  const pr = cfg.prompts[promptKey]
  if (!pr) throw new Error(`public.prospect_prompt has no "${promptKey}" row`)
  const { text, model } = await ask(cfg, role, pr.body, user, Number(pr.temperature ?? 0.4), settings.model_timeout_ms)
  let parsed: any = null
  try { parsed = parseJson(text) } catch { parsed = null }
  return { raw: text, parsed, model }
}

/* ---------- Companies House ---------- */

class ChKeyRejected extends Error {}

async function chGet(path: string) {
  if (!CH_KEY) return null
  const res = await fetch(new URL(path, CH_URL), {
    headers: { authorization: chAuthHeader(CH_KEY), accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  if (res.status === 401) throw new ChKeyRejected('Companies House rejected COMPANIES_HOUSE_API_KEY (401): it must be a Live REST key')
  if (res.status === 404 || res.status === 429) return null
  if (!res.ok) throw new Error(`Companies House ${res.status} for ${path}`)
  return await res.json()
}

async function pull(plan: any, settings: any) {
  const start = Number(plan.start_index) || 0
  const types = Array.isArray(plan.company_types) && plan.company_types.length ? plan.company_types : [...DEFAULT_TYPES]
  const url = buildSearchUrl({
    location: plan.town, sicCodes: expandSic(plan.sic_codes ?? []), types,
    since: plan.incorporated_from ?? undefined, until: plan.incorporated_to ?? undefined,
    size: settings.pull_page_size, startIndex: start,
  }, CH_URL)
  const res = await fetch(url, {
    headers: { authorization: chAuthHeader(CH_KEY), accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  })
  if (res.status === 401) throw new ChKeyRejected('Companies House rejected COMPANIES_HOUSE_API_KEY (401): it must be a Live REST key')
  if (res.status === 429) return { inserted: 0, seen: 0, note: 'Companies House rate limit; next tick' }
  /* Advanced search answers a search with no results as a 404. */
  const data = res.status === 404 ? { items: [], hits: 0 } : res.ok ? await res.json() : null
  if (!data) throw new Error(`Companies House ${res.status} for the advanced search`)

  const items: any[] = Array.isArray(data.items) ? data.items : []
  const today = new Date().toISOString().slice(0, 10)
  const rows = []
  let refused = 0
  for (const item of items) {
    const c = normaliseItem(item, { pulledOn: today })
    if (!c || !admit(c, { types }).ok) { refused++; continue }
    rows.push({
      company_number: c.company_number, company_name: c.company, company_type: c.company_type,
      company_status: c.company_status, incorporated_on: c.incorporated,
      sic_codes: Array.isArray(item.sic_codes) ? item.sic_codes.map(String) : [],
      activity: c.sic.join('; ') || null, town: c.town, postcode: c.postcode, address: c.address_line_1,
    })
  }
  const next = start + items.length
  const exhausted = !items.length || (typeof data.hits === 'number' && next >= data.hits)
  const inserted = await rpc('prospect_insert_candidates', {
    p_target_id: plan.target_id, p_town: plan.town, p_next_index: next, p_exhausted: exhausted, p_rows: rows,
  })
  return { inserted, seen: items.length, refused, town: plan.town, exhausted }
}

/* ---------- the website ---------- */

async function get(url: string, settings: any, accept = 'text/html,application/xhtml+xml') {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': settings.user_agent, accept },
      signal: AbortSignal.timeout(settings.fetch_timeout_ms),
    })
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok) return { ok: false, status: res.status }
    if (accept.includes('html') && !type.includes('html')) return { ok: false, status: res.status }
    return { ok: true, status: res.status, url: res.url, body: (await res.text()).slice(0, 400_000) }
  } catch (e) {
    return { ok: false, error: (e as Error).name === 'TimeoutError' ? 'timeout' : (e as Error).message }
  }
}

/* A DNS lookup before any fetch: a few milliseconds, and no load on
   anybody's server for a domain that does not exist. Over HTTPS, because
   that is what an edge function has. */
async function resolves(host: string) {
  for (const type of ['A', 'AAAA']) {
    try {
      const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
        headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) continue
      const d = await res.json()
      if (d?.Status === 0 && Array.isArray(d.Answer) && d.Answer.length) return true
    } catch { /* try the next record type */ }
  }
  return false
}

async function findWebsite(cand: any, settings: any) {
  const guesses = domainGuesses(cand.company_name)
  if (!guesses.length) return { url: null, confirmed_by: [], outcome: 'the name gave no usable domain', html: null }
  const live = (await Promise.all(guesses.map(async (h) => (await resolves(h)) ? h : null))).filter(Boolean) as string[]
  if (!live.length) return { url: null, confirmed_by: [], outcome: 'no guessed domain exists', html: null }
  let outcomeText = 'resolved but the page does not mention them'
  for (const host of live) {
    const robots = await get(`https://${host}/robots.txt`, settings, 'text/plain')
    const rules = parseRobots(robots.ok ? robots.body : '')
    if (!rules.allowed) { outcomeText = 'robots.txt disallows'; continue }
    if (rules.delay) await new Promise((r) => setTimeout(r, rules.delay))
    const page = await get(`https://${host}/`, settings)
    if (!page.ok) { outcomeText = `unreachable (${page.error ?? page.status})`; continue }
    const kind = pageKind(page.body)
    if (kind !== 'live') { outcomeText = kind === 'parked' ? 'the domain is parked or for sale' : 'a placeholder page'; continue }
    const c = confirms(page.body!, cand)
    if (c.reasons.length) return { url: page.url || `https://${host}/`, confirmed_by: c.reasons, outcome: 'confirmed', html: page.body! }
    outcomeText = c.conflict ? `a different company with the same name — ${c.conflict}` : 'resolved but the page does not mention them'
  }
  return { url: null, confirmed_by: [], outcome: outcomeText, html: null }
}

/* A business's own page carries its footer: address, phone, email, often
   its company number. None of that helps an agent judge the business, so
   it is taken out before any agent reads the page - and quotes are checked
   against the same cleaned text, so nothing can be quoted back in. */
function readable(html: string, cand: any) {
  let text = redactContactRoutes(stripHtml(html))
  if (cand.company_number) text = text.split(cand.company_number).join('[company number removed]')
  return text
}

async function readSite(home: { url: string; html: string }, cand: any, settings: any) {
  const pages = [{ url: home.url, text: readable(home.html, cand) }]
  for (const link of sameSiteLinks(home.html, home.url, settings.pages_per_site - 1)) {
    const p = await get(link, settings)
    if (p.ok) pages.push({ url: p.url || link, text: readable(p.body, cand) })
  }
  let left = settings.max_page_chars
  const out: { url: string; text: string }[] = []
  for (const p of pages) {
    if (left <= 200) break
    out.push({ url: p.url, text: p.text.slice(0, left) })
    left -= Math.min(p.text.length, left)
  }
  return out
}

const pathOf = (u: string) => { try { return new URL(u).pathname } catch { return u } }

/* ---------- the stages ---------- */

type Ctx = {
  cfg: Cfg; settings: any; cand: any; state: any
  move: (m: { stage: string; from: string; to?: string | null; model?: string | null; decision: string; said?: string | null; guard?: string | null }) => Promise<void>
}

const shared = (cfg: Cfg) => {
  const who = knowledgeOf(cfg, 'who-we-sell-to')?.body ?? ''
  const scoring = knowledgeOf(cfg, 'scoring')?.body ?? ''
  return { who, scoring }
}

async function research(ctx: Ctx) {
  const { cfg, settings, cand } = ctx
  const [profile, officers] = await Promise.all([
    chGet(`/company/${cand.company_number}`),
    chGet(`/company/${cand.company_number}/officers?items_per_page=50`),
  ])
  const register = registerLines(cand, { profile, officers })
  const site = await findWebsite(cand, settings)
  const pages = site.html ? await readSite({ url: site.url!, html: site.html }, cand, settings) : []
  const pageText = pages.map((p) => p.text).join('\n')

  /* What the research agent was handed, minus the page text, which is not
     kept. Built by this file, so it says so: from "sources", no model. */
  const material = [
    'REGISTER',
    ...register.map((r) => `${r.key}: ${r.text}`),
    '',
    site.url ? `WEBSITE: ${site.url} (confirmed by ${site.confirmed_by.join(' + ')}); read ${pages.length} page${pages.length === 1 ? '' : 's'}: ${pages.map((p) => pathOf(p.url)).join(', ')}`
      : `WEBSITE: none — ${site.outcome}`,
  ].join('\n')
  await ctx.move({ stage: 'research', from: 'sources', to: 'research', decision: 'material', said: material })

  const user = [
    'REGISTER LINES (cite a register fact by its key):',
    ...register.map((r) => `${r.key}: ${r.text}`),
    '',
    pages.length ? 'THEIR OWN WEBSITE — quote from this, word for word:' : `WEBSITE: none was found (${site.outcome}). Work from the register alone.`,
    ...pages.map((p) => `--- ${pathOf(p.url)}\n${p.text}`),
    '',
    `Promote at most ${settings.max_facts} facts.`,
  ].join('\n')
  const reply = await talk(cfg, settings, 'prospect_research', 'research', user)
  const v = validateResearch(reply.parsed, { pageText, registerKeys: register.map((r) => r.key), max: settings.max_facts })
  await ctx.move({
    stage: 'research', from: 'research', to: 'signals', model: reply.model, said: reply.raw,
    decision: v.facts.length ? 'promoted' : 'found_nothing',
    guard: [...(reply.parsed ? [] : ['the reply was not JSON']), ...v.struck].join('; ') || null,
  })
  ctx.state = { ...ctx.state, register, facts: v.facts, research_say: v.say, unknowns: v.unknowns }
  return {
    next: v.facts.length ? 'signals' : 'done',
    extra: { p_register: { lines: register }, p_website: site.url, p_confirmed_by: site.confirmed_by, p_website_outcome: site.outcome },
  }
}

async function signals(ctx: Ctx) {
  const { cfg, settings, state } = ctx
  const { who } = shared(cfg)
  const facts = state.facts ?? []
  const r = await argueSignals({
    facts, researchSay: state.research_say, reviews: settings.signal_reviews, max: settings.max_signals,
    callSignals: ({ previous, review }: any) => {
      const parts = [
        'WHO WE SELL TO:', who, '',
        `THE RESEARCH AGENT SAYS:\n${state.research_say || '(nothing)'}`, '',
        'THE FACTS IT PROMOTED TO YOU:', factLines(facts, state.register ?? []),
      ]
      if (state.unknowns?.length) parts.push('', 'WHAT IT COULD NOT FIND OUT:', ...state.unknowns.map((u: string) => `- ${u}`))
      parts.push('', `Put forward at most ${settings.max_signals} signals.`)
      if (previous && review) {
        parts.push('', 'YOUR LAST SIGNALS:', signalLines(previous.signals, facts), '',
          `THE RESEARCH AGENT'S REVIEW:\n${review.say || '(said nothing)'}`,
          ...[...review.verdicts].map(([id, v]: any) => `- ${id}: ${v.verdict}${v.why ? ` — ${v.why}` : ''}`),
          '', 'Revise: fix or withdraw what it objected to; keep what it let stand.')
      }
      return talk(cfg, settings, 'prospect_signals', 'signals', parts.join('\n'))
    },
    callReview: ({ signals: sigs, signalsSay }: any) => talk(cfg, settings, 'prospect_research', 'research_review', [
      'THE FACTS YOU PROMOTED:', factLines(facts, state.register ?? []), '',
      `THE SIGNALS AGENT SAYS:\n${signalsSay || '(nothing)'}`, '',
      'ITS SIGNALS:', signalLines(sigs, facts),
    ].join('\n')),
    onMove: (m: any) => ctx.move({ stage: 'signals', ...m }),
  })
  ctx.state = { ...state, signals: r.signals, signals_say: r.say, dropped_signals: r.dropped }
  return { next: r.signals.length ? 'sales' : 'done' }
}

async function sales(ctx: Ctx) {
  const { cfg, settings, state } = ctx
  const { who, scoring } = shared(cfg)
  const services = serviceKeys(cfg)
  const reply = await talk(cfg, settings, 'prospect_sales', 'sales', [
    'WHO WE SELL TO:', who, '', 'THE SCALE:', scoring, '',
    'THE PORTFOLIO:', portfolioBlock(cfg), '',
    `THE SIGNALS AGENT SAYS:\n${state.signals_say || '(nothing)'}`, '',
    'THE SIGNALS THE RESEARCH AGENT LET STAND:', signalLines(state.signals, state.facts), '',
    `Bring in at most ${settings.max_services} specialists. Service keys: ${services.join(', ')}.`,
  ].join('\n'))
  const v = validateSales(reply.parsed, { signals: state.signals, services, max: settings.max_services })
  await ctx.move({
    stage: 'sales', from: 'sales', to: v.picks.length ? v.picks.map((p) => `specialist:${p.service}`).join(',') : null,
    model: reply.model, said: reply.raw, decision: v.picks.length ? 'brought_in' : 'no_fit',
    guard: [...(reply.parsed ? [] : ['the reply was not JSON']), ...v.struck].join('; ') || null,
  })
  ctx.state = { ...state, sales_say: v.say, queue: v.picks, consulted: v.picks.map((p) => p.service), results: [] }
  return { next: v.picks.length ? 'specialists' : 'done' }
}

async function specialist(ctx: Ctx) {
  const { cfg, settings, state } = ctx
  const { who, scoring } = shared(cfg)
  const services = serviceKeys(cfg)
  const queue = [...(state.queue ?? [])]
  const pick = queue.shift()
  if (!pick) return { next: 'done' }
  const know = knowledgeOf(cfg, pick.service)
  const consulted: string[] = [...(state.consulted ?? [])]
  const others = services.filter((s) => s !== pick.service).map((s) => `${s} — ${knowledgeOf(cfg, s)?.label ?? s}`).join('; ')

  const r = await argueService({
    pick, turns: settings.agreement_turns, signals: state.signals, services,
    callSpecialist: ({ history, sales: s, specialist: mine }: any) => talk(cfg, settings, 'prospect_specialist', 'specialist', [
      `YOUR SERVICE: ${pick.service}`, '', know?.body ?? '', '',
      'THE SCALE:', scoring, '', 'WHO WE SELL TO:', who, '',
      'THE SIGNALS THE RESEARCH AGENT LET STAND:', signalLines(state.signals, state.facts), '',
      `THE OTHER SERVICES, if you hand this on: ${others}`, '',
      'THE CONVERSATION SO FAR:', conversationBlock(history, pick.service), '',
      `Sales's number is ${s}.${mine === null ? '' : ` Yours was ${mine}.`}`,
    ].join('\n')),
    callSales: ({ history, sales: s, specialist: theirs }: any) => talk(cfg, settings, 'prospect_sales', 'sales_reply', [
      `YOU ARE TALKING TO THE ${pick.service.toUpperCase()} SPECIALIST.`, '',
      'THE SCALE:', scoring, '', 'THE PORTFOLIO:', portfolioBlock(cfg), '',
      'THE SIGNALS THE RESEARCH AGENT LET STAND:', signalLines(state.signals, state.facts), '',
      'THE CONVERSATION SO FAR:', conversationBlock(history, pick.service), '',
      `The specialist's number is ${theirs ?? 'not yet given'}. Yours was ${s}.`,
      `Already brought in: ${consulted.join(', ')}. You may bring in ${Math.max(0, settings.max_services - consulted.length)} more.`,
    ].join('\n')),
    onMove: (m: any) => ctx.move({ stage: 'specialists', ...m }),
    canBringIn: (s: string) => {
      if (consulted.includes(s) || consulted.length >= settings.max_services) return false
      consulted.push(s)
      return true
    },
  })
  queue.push(...r.handOns)
  const results = [...(state.results ?? []), r]
  ctx.state = { ...state, queue, consulted, results }
  return { next: queue.length ? 'specialists' : 'done' }
}

const STAGE_FN: Record<string, (ctx: Ctx) => Promise<{ next: string; extra?: Record<string, unknown> }>> = {
  research, signals, sales, specialists: specialist,
}

/* ---------- entry ---------- */

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  let allowed = false
  try {
    allowed = await rpc('outreach_verify_cron_secret', { p_secret: req.headers.get('x-outreach-secret') ?? '' }) === true
  } catch { allowed = false }
  if (!allowed) return reply({ error: 'forbidden' }, 403)

  const started = Date.now()
  const detail: unknown[] = []
  let pulled = 0, stages = 0, finished = 0

  try {
    /* Cheapest possible no-op: nothing is running, so nothing is logged
       either - otherwise the runs table would fill with 288 empty ticks a
       day. */
    const plan = await rpc('prospect_pull_plan', {})
    const cfg: Cfg = await rpc('prospect_config', {})
    const settings = clampSettings(cfg.settings)

    const discoveryKeys = [...new Set(Object.values(cfg.models).flat().map((m) => m.key_secret))]
    if (!discoveryKeys.some((k) => keyFor(k))) {
      return reply({ error: 'GEMINI_DISCOVERY_API_KEY is not set', hint: 'Supabase -> Edge Functions -> Secrets' }, 503)
    }

    if (plan) {
      if (!CH_KEY) detail.push({ pull: 'skipped: COMPANIES_HOUSE_API_KEY is not set' })
      else {
        const p = await pull(plan, settings)
        pulled = Number(p.inserted) || 0
        detail.push({ pull: p })
      }
    }

    const batch: any[] = (await rpc('prospect_next_batch', { p_limit: settings.batch_size })) ?? []
    if (!batch.length && !plan) return reply({ idle: true })

    let stop = false
    for (const cand of batch) {
      if (stop) { await rpc('prospect_release', { p_id: cand.id }); continue }
      let seq = Number(cand.next_seq) || 0
      const ctx: Ctx = {
        cfg, settings, cand, state: cand.state ?? {},
        move: async (m) => {
          seq++
          await rpc('prospect_record_round', {
            p_candidate_id: cand.id, p_seq: seq, p_stage: m.stage, p_from: m.from, p_to: m.to ?? null,
            p_model: m.model ?? null, p_decision: m.decision, p_said: m.said ?? null, p_guard: m.guard ?? null,
          })
        },
      }
      let stage: string = cand.stage
      const done: string[] = []
      try {
        while (stage !== 'done') {
          const left = settings.tick_budget_ms - (Date.now() - started)
          if (left < settings.stage_reserve_ms[stage]) {
            await rpc('prospect_release', { p_id: cand.id })
            stop = true
            break
          }
          const r = await STAGE_FN[stage](ctx)
          stages++
          done.push(stage)
          stage = r.next
          if (stage !== 'done') {
            await rpc('prospect_save_state', { p_id: cand.id, p_stage: stage, p_state: ctx.state, ...(r.extra ?? {}) })
          } else {
            if (r.extra) await rpc('prospect_save_state', { p_id: cand.id, p_stage: 'done', p_state: ctx.state, ...r.extra })
            const o = outcome(ctx.state.results ?? [])
            await rpc('prospect_finish', {
              p_id: cand.id, p_status: o.status, p_lead_score: o.lead_score, p_services: o.services, p_state: ctx.state,
            })
            finished++
            detail.push({ company: cand.company_name, status: o.status, score: o.lead_score, stages: done })
          }
        }
        if (stage !== 'done') detail.push({ company: cand.company_name, paused_at: stage, stages: done })
      } catch (err) {
        const msg = (err as Error).message
        await ctx.move({ stage, from: 'system', decision: 'failed', guard: msg }).catch(() => {})
        await rpc('prospect_fail', { p_id: cand.id, p_error: msg })
        detail.push({ company: cand.company_name, failed_at: stage, error: msg })
        /* Out of budget, or a key problem, is the end of the tick; the
           next candidate would fail the same way. */
        if (err instanceof ChKeyRejected || /no budget left|daily quota reached|is not set|not valid|writer's key/i.test(msg)) stop = true
      }
    }

    await rpc('prospect_log_run', { p_pulled: pulled, p_stages: stages, p_finished: finished, p_detail: detail, p_error: null })
    return reply({ pulled, stages, finished, ms: Date.now() - started, detail })
  } catch (err) {
    const msg = (err as Error).message
    await rpc('prospect_log_run', { p_pulled: pulled, p_stages: stages, p_finished: finished, p_detail: detail, p_error: msg }).catch(() => {})
    return reply({ error: msg, pulled, stages, finished }, 500)
  }
})
