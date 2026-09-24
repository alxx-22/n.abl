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
  clampSettings, quotaScope, parseJson, domainGuesses, frontPageUrls, noSiteLine, pageKind, parseRobots,
  confirms, stripHtml, sameSiteLinks, contactPageLink, siteLines, registerLines, registerRefusal, registerCautions, validateResearch,
  argueSignals, validateSales, argueService, outcome, knowledgeOf, serviceKeys, factLines, signalLines,
  portfolioBlock, conversationBlock,
} from './prospect.mjs'
import { buildSearchUrl, chAuthHeader, normaliseItem, admit, expandSic, unknownSic, DEFAULT_TYPES, CH_BASE, redactContactRoutes } from './puller.mjs'

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
  running: boolean
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
/* Companies House asked us to slow down. Not the business's fault and not
   a failure: it is released, unread, for a later tick. Deciding a refusal
   on a profile we did not get to read would let a dormant company through. */
class ChBusy extends Error {}

async function chGet(path: string) {
  if (!CH_KEY) return null
  const res = await fetch(new URL(path, CH_URL), {
    headers: { authorization: chAuthHeader(CH_KEY), accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  if (res.status === 401) throw new ChKeyRejected('Companies House rejected COMPANIES_HOUSE_API_KEY (401): it must be a Live REST key')
  if (res.status === 429) throw new ChBusy('Companies House rate limit; the business goes back in the queue')
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Companies House ${res.status} for ${path}`)
  return await res.json()
}

async function pull(plan: any, settings: any) {
  const start = Number(plan.start_index) || 0
  const types = Array.isArray(plan.company_types) && plan.company_types.length ? plan.company_types : [...DEFAULT_TYPES]
  const unknown = unknownSic(plan.sic_codes ?? [])
  if (unknown.length) {
    throw new Error(`the target asks for SIC ${unknown.join(', ')}, which SIC 2007 does not have; fix the target and press Run again`)
  }
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
  const why: Record<string, number> = {}
  const areas = settings.territory_areas?.length ? settings.territory_areas : null
  for (const item of items) {
    const c = normaliseItem(item, { pulledOn: today })
    const a = c ? admit(c, { types, areas }) : { ok: false, why: 'not a company record' }
    if (!a.ok) {
      refused++
      const k = String(a.why).replace(/^postcode .* is outside .*/, 'registered office outside the territory').replace(/^SIC (\d+)(, \d+)*: /, '')
      why[k] = (why[k] ?? 0) + 1
      continue
    }
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
  return { inserted, seen: items.length, refused, refused_why: why, town: plan.town, exhausted }
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
   that is what an edge function has. 'nx' is a domain nobody owns; 'bare'
   is one that exists with nothing on the apex, which is when www is
   worth asking about. */
async function lookup(host: string): Promise<'yes' | 'nx' | 'bare'> {
  let bare = false
  for (const type of ['A', 'AAAA']) {
    try {
      const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
        headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) continue
      const d = await res.json()
      if (d?.Status === 3) return 'nx'
      if (d?.Status === 0 && Array.isArray(d.Answer) && d.Answer.length) return 'yes'
      if (d?.Status === 0) bare = true
    } catch { /* try the next record type */ }
  }
  return bare ? 'bare' : 'nx'
}

async function resolves(host: string) {
  const apex = await lookup(host)
  if (apex === 'yes') return true
  return apex === 'bare' && (await lookup(`www.${host}`)) === 'yes'
}

/* The front page of a host, trying the bare domain, then www, then plain
   HTTP - and robots.txt first, on whichever answered. */
async function frontPage(host: string, settings: any, until = Infinity) {
  let why = 'unreachable'
  for (const url of frontPageUrls(host)) {
    if (Date.now() > until) return { ok: false, why: 'out of time for this business' }
    const origin = new URL(url).origin
    const robots = await get(`${origin}/robots.txt`, settings, 'text/plain')
    /* No answer at all - a timeout, a refused connection, a bad
       certificate - means this origin is not there. Its front page would
       only wait out the same timeout again. */
    if (!robots.ok && robots.error) { why = `unreachable (${robots.error})`; continue }
    const rules = parseRobots(robots.ok ? robots.body : '')
    if (!rules.allowed) return { ok: false, why: 'robots.txt disallows' }
    if (rules.delay) await new Promise((r) => setTimeout(r, rules.delay))
    const page = await get(url, settings)
    if (page.ok) return { ok: true, url: page.url || url, body: page.body as string }
    why = `unreachable (${page.error ?? page.status})`
  }
  return { ok: false, why }
}

/* A site a person typed in is trusted as theirs - a person looked - but
   it still has to load, and robots.txt still has the last word. */
async function givenWebsite(cand: any, settings: any) {
  let host = ''
  try { host = new URL(cand.website).host } catch { /* checked below */ }
  if (!host) return { url: null, confirmed_by: [], outcome: 'the address a person added is not a web address', html: null }
  const page = await frontPage(host, settings, Date.now() + Math.max(15000, settings.fetch_timeout_ms * 3))
  if (!page.ok) return { url: null, confirmed_by: [], outcome: `the site a person added did not load: ${page.why}`, html: null }
  if (pageKind(page.body) !== 'live') return { url: null, confirmed_by: [], outcome: 'the site a person added is parked or empty', html: null }
  return { url: page.url, confirmed_by: ['a person'], outcome: 'added by a person', html: page.body }
}

async function findWebsite(cand: any, settings: any) {
  if (cand.website && Array.isArray(cand.website_confirmed_by) && cand.website_confirmed_by.includes('a person')) {
    return givenWebsite(cand, settings)
  }
  const guesses = domainGuesses(cand.company_name, cand.town)
  if (!guesses.length) return { url: null, confirmed_by: [], outcome: 'the name gave no usable domain to guess', html: null }
  const live = (await Promise.all(guesses.map(async (h) => (await resolves(h)) ? h : null))).filter(Boolean) as string[]
  if (!live.length) return { url: null, confirmed_by: [], outcome: `none of ${guesses.length} guessed domains exists`, html: null }
  /* A cap on the whole search. A domain that resolves and then hangs
     costs a fetch timeout per attempt; several of them could outlast the
     function itself, and a tick killed mid-stage would retry the same
     business every claim_ttl_seconds for ever. */
  const until = Date.now() + Math.max(15000, settings.fetch_timeout_ms * 3)
  /* Every domain that exists, and why it was not taken as theirs - not
     just the last one tried, which read as if their site had been found
     and was a placeholder. Written "host: reason" so the Lead gen tab can
     offer a person the likely ones to confirm with one tap. */
  const tried: string[] = []
  for (const host of live) {
    if (Date.now() > until) { tried.push(`${live.length - tried.length} more not checked: out of time`); break }
    const page = await frontPage(host, settings, until)
    if (!page.ok) {
      /* A 401 or 403 from a domain named after them is, as often as not,
         their site behind a firewall that turns away anything that is not
         a browser. We do not pretend to be one; a person can look. */
      tried.push(/\(40[13]\)/.test(page.why) ? `${host}: exists but turned us away (${page.why.match(/40[13]/)![0]})` : `${host}: ${page.why}`)
      continue
    }
    const kind = pageKind(page.body)
    if (kind !== 'live') { tried.push(`${host}: ${kind === 'parked' ? 'parked or for sale' : 'a placeholder page'}`); continue }
    const c = confirms(page.body, cand)
    if (c.reasons.length) return { url: page.url, confirmed_by: c.reasons, outcome: 'confirmed', html: page.body }
    tried.push(c.conflict ? `${host}: a different company with the same name, ${c.conflict}` : `${host}: does not mention them`)
  }
  return {
    url: null, confirmed_by: [], html: null,
    outcome: `${live.length} of ${guesses.length} guessed domains exist, none confirmed as theirs — ${tried.join('; ')}`,
  }
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

/* The pages an agent reads, and the raw HTML code measures (siteLines):
   the same pages plus the contact page, whose words no agent sees. The
   raw HTML is not kept. */
async function readSite(home: { url: string; html: string }, cand: any, settings: any) {
  const pages = [{ url: home.url, text: readable(home.html, cand), html: home.html }]
  for (const link of sameSiteLinks(home.html, home.url, settings.pages_per_site - 1)) {
    const p = await get(link, settings)
    if (p.ok) pages.push({ url: p.url || link, text: readable(p.body, cand), html: p.body })
  }
  const raw: { url: string; html: string; contact?: boolean }[] = pages.map((p) => ({ url: p.url, html: p.html }))
  const contact = contactPageLink(home.html, home.url)
  if (contact && !pages.some((p) => p.url === contact)) {
    const c = await get(contact, settings)
    if (c.ok) raw.push({ url: c.url || contact, html: c.body, contact: true })
  }
  let left = settings.max_page_chars
  const out: { url: string; text: string }[] = []
  for (const p of pages) {
    if (left <= 200) break
    out.push({ url: p.url, text: p.text.slice(0, left) })
    left -= Math.min(p.text.length, left)
  }
  return { pages: out, measured: siteLines(raw) }
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

/* A stage may end the business outright: `finish` is the status it ends
   in and the note the Lead gen tab shows beside it. */
type StageResult = { next: string; extra?: Record<string, unknown>; finish?: { status: string; note: string } }

async function research(ctx: Ctx): Promise<StageResult> {
  const { cfg, settings, cand } = ctx
  const [profile, officers] = await Promise.all([
    chGet(`/company/${cand.company_number}`),
    chGet(`/company/${cand.company_number}/officers?items_per_page=50`),
  ])
  const register = registerLines(cand, { profile, officers })
  const registerText = ['REGISTER', ...register.map((r) => `${r.key}: ${r.text}`)]

  /* Not trading, or cannot be trusted to pay: ended here, before a
     single model call or a single fetch of their site. */
  const refusal = registerRefusal(profile)
  if (refusal) {
    await ctx.move({
      stage: 'research', from: 'register', to: null, decision: 'refused',
      said: registerText.join('\n'), guard: `refused before any agent: ${refusal}`,
    })
    return { next: 'done', extra: { p_register: { lines: register } }, finish: { status: 'refused', note: `Refused before any agent: ${refusal}.` } }
  }
  const cautions = registerCautions(profile)

  const site = await findWebsite(cand, settings)
  const { pages, measured } = site.html ? await readSite({ url: site.url!, html: site.html }, cand, settings) : { pages: [], measured: [] }
  const pageText = pages.map((p) => p.text).join('\n')
  const siteExtra = { p_register: { lines: register, measured }, p_website: site.url, p_confirmed_by: site.confirmed_by, p_website_outcome: site.outcome }
  const measuredText = measured.length
    ? ['MEASURED ON THEIR SITE BY CODE (the pages above plus their contact page, before contact details were taken out):', ...measured.map((r) => `${r.key}: ${r.text}`)]
    : []

  /* What the research agent was handed, minus the page text, which is not
     kept. Built by this file, so it says so: from "sources", no model. */
  const material = [
    ...registerText,
    ...(cautions.length ? [`CAUTION: ${cautions.join('; ')} — no service may score above ${settings.caution_ceiling}`] : []),
    '',
    site.url ? `WEBSITE: ${site.url} (confirmed by ${site.confirmed_by.join(' + ')}); read ${pages.length} page${pages.length === 1 ? '' : 's'}: ${pages.map((p) => pathOf(p.url)).join(', ')}`
      : noSiteLine(site.outcome),
    ...(measuredText.length ? ['', ...measuredText] : []),
  ].join('\n')

  /* Nothing of theirs to read. Arguing from the register alone produced
     a 55 for a takeaway on the strength of a guessed domain not existing,
     so by default the business is parked instead - no model is asked -
     and a person who knows the site can add it and send it back. */
  if (!site.url && settings.require_website) {
    await ctx.move({ stage: 'research', from: 'sources', to: null, decision: 'parked', said: material,
      guard: 'parked before any agent: no website to read. Add it in Lead gen to send this business back to research.' })
    return { next: 'done', extra: siteExtra, finish: { status: 'no_site', note: `No website found (${site.outcome}). Add it to have the agents read it.` } }
  }
  await ctx.move({ stage: 'research', from: 'sources', to: 'research', decision: 'material', said: material })

  const user = [
    'REGISTER LINES (cite a register fact by its key):',
    ...register.map((r) => `${r.key}: ${r.text}`),
    '',
    pages.length ? 'THEIR OWN WEBSITE — quote from this, word for word:' : `${noSiteLine(site.outcome)} Work from the register alone.`,
    ...pages.map((p) => `--- ${pathOf(p.url)}\n${p.text}`),
    '',
    ...(measuredText.length ? [...measuredText, '(cite one with "source": "measured" and its key in "register_key")', ''] : []),
    `Promote at most ${settings.max_facts} facts.`,
  ].join('\n')
  const reply = await talk(cfg, settings, 'prospect_research', 'research', user)
  const v = validateResearch(reply.parsed, {
    pageText, registerKeys: register.map((r) => r.key), measuredKeys: measured.map((r) => r.key), max: settings.max_facts,
  })
  await ctx.move({
    stage: 'research', from: 'research', to: 'signals', model: reply.model, said: reply.raw,
    decision: v.facts.length ? 'promoted' : 'found_nothing',
    guard: [...(reply.parsed ? [] : ['the reply was not JSON']), ...v.struck].join('; ') || null,
  })
  ctx.state = {
    ...ctx.state, register, measured, facts: v.facts, research_say: v.say, unknowns: v.unknowns,
    cautions, ceiling: cautions.length ? settings.caution_ceiling : null, has_site: Boolean(site.url),
  }
  return { next: v.facts.length ? 'signals' : 'done', extra: siteExtra }
}

/* Said to every agent that argues a score: the rule code holds them to. */
const sectorLine = (settings: any) =>
  `A service argued only on signals marked "true of the whole sector" is read at ${settings.sector_ceiling} at most, whatever number is named. Cite a signal about this business in particular to go higher.`

/* Said to every agent that judges, when the register has flagged it. */
const cautionBlock = (state: any) => (state.cautions?.length
  ? [`CAUTION FROM THE REGISTER: ${state.cautions.join('; ')}. No service may score above ${state.ceiling} on this business; a higher number is read as ${state.ceiling}.`, '']
  : [])

async function signals(ctx: Ctx): Promise<StageResult> {
  const { cfg, settings, state } = ctx
  const { who } = shared(cfg)
  const facts = state.facts ?? []
  const services = serviceKeys(cfg)
  const r = await argueSignals({
    facts, researchSay: state.research_say, reviews: settings.signal_reviews, max: settings.max_signals, services,
    callSignals: ({ previous, review }: any) => {
      const parts = [
        'WHO WE SELL TO:', who, '',
        'WHAT WE SELL (tag each signal with the keys of the services it points to, from this list only):', portfolioBlock(cfg), '',
        ...cautionBlock(state),
        `THE RESEARCH AGENT SAYS:\n${state.research_say || '(nothing)'}`, '',
        'THE FACTS IT PROMOTED TO YOU:', factLines(facts, state.register ?? [], state.measured ?? []),
      ]
      if (state.unknowns?.length) parts.push('', 'WHAT IT COULD NOT FIND OUT:', ...state.unknowns.map((u: string) => `- ${u}`))
      parts.push('', `Put forward at most ${settings.max_signals} signals. Service keys: ${services.join(', ')}.`)
      if (previous && review) {
        parts.push('', 'YOUR LAST SIGNALS:', signalLines(previous.signals, facts), '',
          `THE RESEARCH AGENT'S REVIEW:\n${review.say || '(said nothing)'}`,
          ...[...review.verdicts].map(([id, v]: any) => `- ${id}: ${v.verdict}${v.why ? ` — ${v.why}` : ''}`),
          '', 'Revise: fix or withdraw what it objected to; keep what it let stand.')
      }
      return talk(cfg, settings, 'prospect_signals', 'signals', parts.join('\n'))
    },
    callReview: ({ signals: sigs, signalsSay }: any) => talk(cfg, settings, 'prospect_research', 'research_review', [
      'THE FACTS YOU PROMOTED:', factLines(facts, state.register ?? [], state.measured ?? []), '',
      `THE SIGNALS AGENT SAYS:\n${signalsSay || '(nothing)'}`, '',
      'ITS SIGNALS:', signalLines(sigs, facts),
    ].join('\n')),
    onMove: (m: any) => ctx.move({ stage: 'signals', ...m }),
  })
  ctx.state = { ...state, signals: r.signals, signals_say: r.say, dropped_signals: r.dropped }
  return { next: r.signals.length ? 'sales' : 'done' }
}

async function sales(ctx: Ctx): Promise<StageResult> {
  const { cfg, settings, state } = ctx
  const { who, scoring } = shared(cfg)
  const services = serviceKeys(cfg)
  const reply = await talk(cfg, settings, 'prospect_sales', 'sales', [
    'WHO WE SELL TO:', who, '', 'THE SCALE:', scoring, '',
    'THE PORTFOLIO:', portfolioBlock(cfg), '',
    ...cautionBlock(state),
    `THE SIGNALS AGENT SAYS:\n${state.signals_say || '(nothing)'}`, '',
    'THE SIGNALS THE RESEARCH AGENT LET STAND:', signalLines(state.signals, state.facts), '',
    `Bring in at most ${settings.max_services} specialists. Service keys: ${services.join(', ')}.`,
    'A service may only be pitched on signals that point to it; a pitch resting on signals that point elsewhere is refused.',
    sectorLine(settings),
  ].join('\n'))
  const v = validateSales(reply.parsed, {
    signals: state.signals, services, max: settings.max_services, ceiling: state.ceiling ?? null, sectorCeiling: settings.sector_ceiling,
  })
  await ctx.move({
    stage: 'sales', from: 'sales', to: v.picks.length ? v.picks.map((p) => `specialist:${p.service}`).join(',') : null,
    model: reply.model, said: reply.raw, decision: v.picks.length ? 'brought_in' : 'no_fit',
    guard: [...(reply.parsed ? [] : ['the reply was not JSON']), ...v.struck].join('; ') || null,
  })
  ctx.state = { ...state, sales_say: v.say, queue: v.picks, consulted: v.picks.map((p) => p.service), results: [] }
  return { next: v.picks.length ? 'specialists' : 'done' }
}

async function specialist(ctx: Ctx): Promise<StageResult> {
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
      ...cautionBlock(state),
      'THE SIGNALS THE RESEARCH AGENT LET STAND:', signalLines(state.signals, state.facts), sectorLine(settings), '',
      `THE OTHER SERVICES, if you hand this on: ${others}`, '',
      'THE CONVERSATION SO FAR:', conversationBlock(history, pick.service), '',
      `Sales's number is ${s}.${mine === null ? '' : ` Yours was ${mine}.`}`,
    ].join('\n')),
    callSales: ({ history, sales: s, specialist: theirs }: any) => talk(cfg, settings, 'prospect_sales', 'sales_reply', [
      `YOU ARE TALKING TO THE ${pick.service.toUpperCase()} SPECIALIST.`, '',
      'THE SCALE:', scoring, '', 'THE PORTFOLIO:', portfolioBlock(cfg), '',
      ...cautionBlock(state),
      'THE SIGNALS THE RESEARCH AGENT LET STAND:', signalLines(state.signals, state.facts), sectorLine(settings), '',
      'THE CONVERSATION SO FAR:', conversationBlock(history, pick.service), '',
      `The specialist's number is ${theirs ?? 'not yet given'}. Yours was ${s}.`,
      `Already brought in: ${consulted.join(', ')}. You may bring in ${Math.max(0, settings.max_services - consulted.length)} more.`,
    ].join('\n')),
    onMove: (m: any) => ctx.move({ stage: 'specialists', ...m }),
    ceiling: state.ceiling ?? null,
    sectorCeiling: settings.sector_ceiling,
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

const STAGE_FN: Record<string, (ctx: Ctx) => Promise<StageResult>> = {
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
    /* Cheapest possible no-op: nothing is running, so nothing is checked
       and nothing is logged - otherwise the runs table would fill with 288
       empty ticks a day, and a key nobody has added yet would read as an
       error before anybody asked for a run. */
    const cfg: Cfg = await rpc('prospect_config', {})
    if (!cfg.running) return reply({ idle: true })
    const settings = clampSettings(cfg.settings)

    /* Somebody pressed Run. From here a missing key is a real fault, so it
       goes in the run log where the Lead gen tab shows it. */
    const discoveryKeys = [...new Set(Object.values(cfg.models).flat().map((m) => m.key_secret))]
    if (!discoveryKeys.some((k) => keyFor(k))) {
      const msg = 'GEMINI_DISCOVERY_API_KEY is not set (Supabase -> Edge Functions -> Secrets)'
      await rpc('prospect_log_run', { p_pulled: 0, p_stages: 0, p_finished: 0, p_detail: null, p_error: msg })
      return reply({ error: msg }, 503)
    }

    const plan = await rpc('prospect_pull_plan', {})

    if (plan) {
      if (!CH_KEY) detail.push({ pull: 'skipped: COMPANIES_HOUSE_API_KEY is not set' })
      else {
        const p = await pull(plan, settings)
        pulled = Number(p.inserted) || 0
        detail.push({ pull: p })
      }
    }

    /* One business at a time, for as long as the tick has time and up to
       batch_size of them. A business parked for having no website costs a
       few DNS lookups; one that is argued over costs a minute. Claiming
       one at a time lets a tick do either without holding claims it will
       not reach. */
    let stop = false
    let claimed = 0
    while (!stop && claimed < settings.batch_size) {
      if (settings.tick_budget_ms - (Date.now() - started) < settings.stage_reserve_ms.research) break
      const [cand] = ((await rpc('prospect_next_batch', { p_limit: 1 })) ?? []) as any[]
      if (!cand) break
      claimed++
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
            const o = r.finish
              ? { status: r.finish.status, lead_score: null, services: [], note: r.finish.note }
              : { ...outcome(ctx.state.results ?? []), note: null }
            await rpc('prospect_finish', {
              p_id: cand.id, p_status: o.status, p_lead_score: o.lead_score, p_services: o.services,
              p_state: ctx.state, p_note: o.note,
            })
            finished++
            detail.push({ company: cand.company_name, status: o.status, score: o.lead_score, stages: done, ...(o.note ? { note: o.note } : {}) })
          }
        }
        if (stage !== 'done') detail.push({ company: cand.company_name, paused_at: stage, stages: done })
      } catch (err) {
        const msg = (err as Error).message
        if (err instanceof ChBusy) {
          await rpc('prospect_release', { p_id: cand.id })
          detail.push({ company: cand.company_name, paused_at: stage, why: msg })
          stop = true
          continue
        }
        await ctx.move({ stage, from: 'system', decision: 'failed', guard: msg }).catch(() => {})
        await rpc('prospect_fail', { p_id: cand.id, p_error: msg })
        detail.push({ company: cand.company_name, failed_at: stage, error: msg })
        /* Out of budget, or a key problem, is the end of the tick; the
           next candidate would fail the same way. */
        if (err instanceof ChKeyRejected || /no budget left|daily quota reached|is not set|not valid|writer's key/i.test(msg)) stop = true
      }
    }
    if (!claimed && !plan) return reply({ idle: true })

    await rpc('prospect_log_run', { p_pulled: pulled, p_stages: stages, p_finished: finished, p_detail: detail, p_error: null })
    return reply({ pulled, stages, finished, ms: Date.now() - started, detail })
  } catch (err) {
    const msg = (err as Error).message
    await rpc('prospect_log_run', { p_pulled: pulled, p_stages: stages, p_finished: finished, p_detail: detail, p_error: msg }).catch(() => {})
    return reply({ error: msg, pulled, stages, finished }, 500)
  }
})
