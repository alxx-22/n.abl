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
  confirms, stripHtml, sameSiteLinks, contactPageLink, siteLines, registerLines, controllingCompanies, accountsFacts, lateFilings, sizeVerdict, tradesOutside, registerRefusal, registerCautions, validateResearch,
  argueSignals, validateSales, argueService, outcome, knowledgeOf, serviceKeys, factLines, signalLines,
  portfolioBlock, conversationBlock,
} from './prospect.mjs'
import {
  runLookup, investigatorBody, readChecker, domainsInOutcome, linkedDomains, parseAvailability, archivedUrl, readArchivedUrl,
  pageVerdict, isDirectory,
} from './lookup.mjs'
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

/* One call down a role's chain: the registry's models in order, each
   spending its own project's budget, paced, and skipped on a 429, a 404
   or a missing key. `body` builds the request for the model it is sent
   to. `pin` holds a many-turn conversation to the model that began it:
   another model is not handed a transcript it did not write. */
async function generate(
  cfg: Cfg, role: string, body: (spec: any) => unknown, timeoutMs: number,
  { pin = null, usable = () => true }: { pin?: string | null; usable?: (content: any) => boolean } = {},
) {
  const chain = (cfg.models[role] ?? []).filter((s: any) => !pin || s.model === pin)
  if (!chain.length) throw new Error(pin ? `${pin} is no longer in the "${role}" chain` : `no models registered for "${role}" in public.outreach_model`)
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
        body: JSON.stringify(body(spec)),
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
    const content = data?.candidates?.[0]?.content
    if (!content || !Array.isArray(content.parts) || !content.parts.length || !usable(content)) { last = `${spec.model}: empty answer`; continue }
    return { content, model: spec.model as string }
  }
  throw new Error(last || `no model answered for ${role}`)
}

const textOf = (content: any) => (content?.parts ?? []).map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('')

async function ask(cfg: Cfg, role: string, system: string, user: string, temperature: number, timeoutMs: number) {
  const { content, model } = await generate(cfg, role, (spec) => ({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature: spec.temperature ?? temperature, topP: 0.95, responseMimeType: 'application/json' },
  }), timeoutMs, { usable: (c) => Boolean(textOf(c).trim()) })
  return { text: textOf(content), model }
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

/* The filed accounts live on the Document API, a second Companies House
   host with the same key. Its content answer is a redirect to a signed
   storage address that must not be sent the key, so the redirect is
   followed by hand. Only Companies House hosts are ever asked. */
const DOC_HOSTS = /(^|\.)company-information\.service\.gov\.uk$/
function chHostOk(u: URL) {
  try { return DOC_HOSTS.test(u.hostname) || u.host === new URL(CH_URL).host } catch { return false }
}
async function chDocument(metaUrl: string) {
  let meta: URL
  try { meta = new URL(metaUrl) } catch { return null }
  if (!CH_KEY || !chHostOk(meta)) return null
  const auth = { authorization: chAuthHeader(CH_KEY) }
  const m = await fetch(meta, { headers: { ...auth, accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
  if (!m.ok) return null
  const info = await m.json()
  if (!info?.resources?.['application/xhtml+xml']) return null
  const first = await fetch(new URL(`${meta.pathname.replace(/\/$/, '')}/content`, meta), {
    headers: { ...auth, accept: 'application/xhtml+xml' }, redirect: 'manual', signal: AbortSignal.timeout(20000),
  })
  let res = first
  if (first.status >= 300 && first.status < 400) {
    const to = first.headers.get('location')
    if (!to) return null
    res = await fetch(new URL(to, meta), { headers: { accept: 'application/xhtml+xml' }, signal: AbortSignal.timeout(20000) })
  }
  if (!res.ok) return null
  return (await res.text()).slice(0, 3_000_000)
}

/* What the register says beyond the profile: group control, the filing
   record, and the latest accounts' numbers. Never fatal - a business is
   researched without them if Companies House is slow or says no. */
async function registerExtras(cand: any, profile: any) {
  const n = cand.company_number
  const soft = async <T>(f: () => Promise<T>) => { try { return await f() } catch { return null } }
  const [psc, history] = await Promise.all([
    soft(() => chGet(`/company/${n}/persons-with-significant-control`)),
    soft(() => chGet(`/company/${n}/filing-history?category=accounts&items_per_page=12`)),
  ])
  const items = Array.isArray(history?.items) ? history.items : []
  const metaUrl = items.find((i: any) => i?.links?.document_metadata)?.links?.document_metadata
  const xhtml = metaUrl ? await soft(() => chDocument(metaUrl)) : null
  return {
    psc,
    filings: lateFilings(items, { incorporated: cand.incorporated_on || profile?.date_of_creation }),
    accounts: xhtml ? accountsFacts(xhtml) : null,
  }
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
/* A site already known to be theirs: added by a person, or found and
   proved by the research loop - live, or as the Internet Archive's copy
   when the live site turns automated readers away. */
async function givenWebsite(cand: any, settings: any) {
  const who = cand.website_confirmed_by.includes('a person') ? 'a person added' : 'the research loop found'
  const by = cand.website_confirmed_by as string[]
  const archived = readArchivedUrl(cand.website)
  if (archived) {
    const page = await get(cand.website, settings)
    if (!page.ok || pageKind(page.body) !== 'live') return { url: null, confirmed_by: [], outcome: `the archived copy ${who} did not load`, html: null, archived: null }
    return { url: cand.website, confirmed_by: by, outcome: `an archived copy from ${archived.date}`, html: page.body, archived }
  }
  let host = ''
  try { host = new URL(cand.website).host } catch { /* checked below */ }
  if (!host) return { url: null, confirmed_by: [], outcome: `the address ${who} is not a web address`, html: null, archived: null }
  const page = await frontPage(host, settings, Date.now() + Math.max(15000, settings.fetch_timeout_ms * 3))
  if (!page.ok) return { url: null, confirmed_by: [], outcome: `the site ${who} did not load: ${page.why}`, html: null, archived: null }
  if (pageKind(page.body) !== 'live') return { url: null, confirmed_by: [], outcome: `the site ${who} is parked or empty`, html: null, archived: null }
  return { url: page.url, confirmed_by: by, outcome: who === 'a person added' ? 'added by a person' : 'found by the research loop', html: page.body, archived: null }
}

const KNOWN_SITE = ['a person', 'found by the research loop']
async function findWebsite(cand: any, settings: any): Promise<{ url: string | null; confirmed_by: string[]; outcome: string; html: string | null; archived?: any }> {
  if (cand.website && Array.isArray(cand.website_confirmed_by) && cand.website_confirmed_by.some((b: string) => KNOWN_SITE.includes(b))) {
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
async function readSite(home: { url: string; html: string }, cand: any, settings: any, archived: any = null) {
  /* An archived site's links point at the original; each is read from the
     archive at the same date, and shown by its original address. */
  const base = archived ? archived.original : home.url
  const via = (u: string) => (archived ? archivedUrl(archived.timestamp, u) : u)
  const pages = [{ url: base, text: readable(home.html, cand), html: home.html }]
  for (const link of sameSiteLinks(home.html, base, settings.pages_per_site - 1)) {
    const p = await get(via(link), settings)
    if (p.ok) pages.push({ url: archived ? link : (p.url || link), text: readable(p.body, cand), html: p.body })
  }
  const raw: { url: string; html: string; contact?: boolean }[] = pages.map((p) => ({ url: p.url, html: p.html }))
  const contact = contactPageLink(home.html, base)
  if (contact && !pages.some((p) => p.url === contact)) {
    const c = await get(via(contact), settings)
    if (c.ok) raw.push({ url: archived ? contact : (c.url || contact), html: c.body, contact: true })
  }
  let left = settings.max_page_chars
  const out: { url: string; text: string }[] = []
  for (const p of pages) {
    if (left <= 200) break
    out.push({ url: p.url, text: p.text.slice(0, left) })
    left -= Math.min(p.text.length, left)
  }
  return { pages: out, measured: siteLines(raw), htmls: raw.map((r) => r.html) }
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
  /* Not trading, or cannot be trusted to pay: ended here, before a
     single model call or a single fetch of their site. */
  const extras = registerRefusal(profile) ? {} : await registerExtras(cand, profile)
  const size = sizeVerdict((extras as any).accounts, cand.sic_codes)
  const refusal = registerRefusal(profile) ?? size.refuse
  const register = registerLines(cand, { profile, officers, ...extras })
  const registerText = ['REGISTER', ...register.map((r) => `${r.key}: ${r.text}`)]
  if (refusal) {
    await ctx.move({
      stage: 'research', from: 'register', to: null, decision: 'refused',
      said: registerText.join('\n'), guard: `refused before any agent: ${refusal}`,
    })
    return { next: 'done', extra: { p_register: { lines: register } }, finish: { status: 'refused', note: `Refused before any agent: ${refusal}.` } }
  }
  const cautions = [...registerCautions(profile), ...(size.caution ? [size.caution] : [])]

  const site = await findWebsite(cand, settings)
  const { pages, measured, htmls } = site.html
    ? await readSite({ url: site.url!, html: site.html }, cand, settings, site.archived)
    : { pages: [], measured: [], htmls: [] as string[] }
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
    site.url ? `WEBSITE: ${site.archived ? `${site.archived.original} as the Internet Archive kept it on ${site.archived.date} (the live site turns automated readers away, so this may be out of date)` : site.url} (confirmed by ${site.confirmed_by.join(' + ')}); read ${pages.length} page${pages.length === 1 ? '' : 's'}: ${pages.map((p) => pathOf(p.url)).join(', ')}`
      : noSiteLine(site.outcome),
    ...(measuredText.length ? ['', ...measuredText] : []),
  ].join('\n')

  /* Nothing of theirs to read. Arguing from the register alone produced
     a 55 for a takeaway on the strength of a guessed domain not existing,
     so by default the business is parked instead - no model is asked -
     and a person who knows the site can add it and send it back. */
  if (!site.url && settings.require_website) {
    /* Cached for the research loop, which works on its own key and in its
       own time; a person can still add the site at any point. */
    const known = Boolean(cand.website) && (cand.website_confirmed_by ?? []).some((x: string) => KNOWN_SITE.includes(x))
    const lookup = settings.lookup_enabled && !known
    await ctx.move({ stage: 'research', from: 'sources', to: lookup ? 'lookup' : null, decision: 'parked', said: material,
      guard: lookup ? 'parked before any agent: no website to read. Sent to the research loop to look further.'
        : 'parked before any agent: no website to read. Add it in Lead gen to send this business back to research.' })
    return {
      next: 'done', extra: siteExtra,
      finish: lookup
        ? { status: 'researching', note: `No website found by guessing (${site.outcome}). With the research loop; you can still add it.` }
        : { status: 'no_site', note: `No website found (${site.outcome}). Add it to have the agents read it.` },
    }
  }

  /* Registered here, trading elsewhere: their own pages give addresses,
     and every one is outside the territory. */
  const away = site.url ? tradesOutside(htmls, settings.territory_areas) : null
  if (away) {
    await ctx.move({ stage: 'research', from: 'sources', to: null, decision: 'refused', said: material,
      guard: `refused before any agent: every address on its own site is in ${away.join(', ')}, outside the territory` })
    return { next: 'done', extra: siteExtra, finish: { status: 'refused', note: `Refused before any agent: its own site trades from ${away.join(', ')}, outside the territory; the registered office is not where it works.` } }
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

/* ---------- the research loop ----------

   For a business whose site the guesser could not find. Its models spend
   GEMINI_RESEARCH_API_KEY, a project of its own (a constraint in the
   registry keeps the lookup roles on it and every other role off it), on
   its own cron, one business at a time. What it may do, and what code
   holds it to, is in lookup.mjs. */

const LOOKUP_ROLES = ['prospect_lookup', 'prospect_lookup_check']

/* A project out of quota is nobody's fault. The first night's run failed
   twenty businesses for it - three ticks each of "no budget left", each
   counted as an attempt. Now a tick checks there is budget before it
   claims anyone, and a quota error mid-business hands it back without
   costing it an attempt. */
const QUOTA = /no budget left|daily quota reached|too many requests this minute/
async function hasBudget(cfg: Cfg, role: string) {
  for (const spec of cfg.models[role] ?? []) {
    if (!keyFor(spec.key_secret)) continue
    const left = await rpc('outreach_model_budget', { p_model: spec.model, p_key_secret: spec.key_secret })
    if (left && left > 0) return true
  }
  return false
}

async function directorsElsewhere(cand: any) {
  const officers = await chGet(`/company/${cand.company_number}/officers?items_per_page=50`)
  const active = (officers?.items ?? []).filter((o: any) => !o.resigned_on && /director|member/i.test(String(o.officer_role ?? '')))
  const names: { company: string; status: string }[] = []
  for (const o of active.slice(0, 4)) {
    const path = o?.links?.officer?.appointments
    if (typeof path !== 'string' || !path.startsWith('/officers/')) continue
    const a = await chGet(`${path}?items_per_page=30`)
    for (const it of a?.items ?? []) {
      const to = it?.appointed_to
      if (!to?.company_name || to.company_number === cand.company_number) continue
      if (!names.some((n) => n.company === to.company_name)) names.push({ company: String(to.company_name), status: String(to.company_status ?? '') })
    }
  }
  return names.slice(0, 15)
}

function lookupTools(cand: any, settings: any, until: () => number) {
  const readPage = (html: string, host: string) => {
    const c = confirms(html, cand)
    const title = ((html.match(/<title[^>]*>([^<]*)/i) || [])[1] || '').trim().slice(0, 120)
    const links = linkedDomains(html, host)
    return {
      verdict: pageVerdict(c.reasons, c.conflict ?? null), reasons: c.reasons, conflict: c.conflict ?? null,
      title: redactContactRoutes(title), excerpt: readable(html, cand).slice(0, 1200), links, offer: links,
    }
  }
  return {
    register_history: async () => {
      const [profile, psc, elsewhere] = await Promise.all([
        chGet(`/company/${cand.company_number}`),
        chGet(`/company/${cand.company_number}/persons-with-significant-control`).catch(() => null),
        directorsElsewhere(cand).catch(() => []),
      ])
      return {
        previous_names: (profile?.previous_company_names ?? []).map((p: any) => ({ name: p?.name, until: p?.ceased_on })).slice(0, 6),
        directors_other_companies: elsewhere,
        controlled_by: controllingCompanies(psc),
      }
    },
    guess_domains: async ({ name }: any) => {
      const guesses = domainGuesses(name, cand.town).filter((d) => !isDirectory(d))
      const exist = (await Promise.all(guesses.map(async (h) => (await resolves(h)) ? h : null))).filter(Boolean) as string[]
      return { name, tried: guesses.length, exist, offer: exist }
    },
    check_domain: async ({ domain }: any) => {
      const page = await frontPage(domain, settings, until())
      if (!page.ok) return { verdict: /\(40[13]\)/.test(page.why) ? 'turned_us_away' : 'unreachable', why: page.why, reasons: [] }
      const kind = pageKind(page.body)
      if (kind !== 'live') return { verdict: 'not_theirs', why: kind === 'parked' ? 'parked or for sale' : 'a placeholder page', reasons: [] }
      return { url: page.url, ...readPage(page.body, domain) }
    },
    archived_copy: async ({ domain }: any) => {
      let snap = null
      try {
        const res = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(domain)}`, {
          headers: { 'user-agent': settings.user_agent, accept: 'application/json' }, signal: AbortSignal.timeout(15000),
        })
        snap = res.ok ? parseAvailability(await res.json()) : null
      } catch { snap = null }
      if (!snap) return { verdict: 'none', why: 'the Internet Archive has no copy of it', reasons: [] }
      const url = archivedUrl(snap.timestamp, snap.original)
      const page = await get(url, settings)
      if (!page.ok) return { verdict: 'unreachable', why: `the archived copy did not load (${page.error ?? page.status})`, reasons: [], date: snap.date }
      const kind = pageKind(page.body)
      if (kind !== 'live') return { verdict: 'not_theirs', why: `the archived copy is ${kind === 'parked' ? 'a parked domain' : 'a placeholder'}`, reasons: [], date: snap.date }
      return { url, date: snap.date, ...readPage(page.body, domain) }
    },
  }
}

async function lookupOne(cfg: Cfg, settings: any, cand: any, move: Ctx['move'], deadline: number) {
  const prompt = cfg.prompts.lookup
  if (!prompt) throw new Error('public.prospect_prompt has no "lookup" row')
  const register = Array.isArray(cand.register?.lines) ? cand.register.lines : registerLines(cand)
  const opening = [
    'THE BUSINESS (from the company register; no address, number or person is given to you):',
    ...register.map((r: any) => `${r.key}: ${r.text}`),
    '',
    `WHAT THE GUESSER TRIED: ${cand.website_outcome || 'nothing recorded'}`,
    '',
    `You have ${settings.lookup_max_steps} turns. Find their own website, or conclude that you cannot.`,
  ].join('\n')
  const lookupMove = (m: any) => move({ stage: 'lookup', ...m })
  const r = await runLookup({
    system: prompt.body, opening, offered: domainsInOutcome(cand.website_outcome), maxSteps: settings.lookup_max_steps, deadline,
    tools: lookupTools(cand, settings, () => deadline),
    callInvestigator: ({ system, contents, pin }: any) => generate(cfg, 'prospect_lookup',
      (spec) => investigatorBody({ system, contents, temperature: spec.temperature ?? Number(prompt.temperature ?? 0.3) }),
      settings.model_timeout_ms, { pin, usable: (c) => c.parts.some((p: any) => p?.functionCall || p?.text) }),
    callChecker: async ({ domain, how, verdict, why }: any) => {
      const reply = await talk(cfg, settings, 'prospect_lookup_check', 'lookup_check', [
        'THE BUSINESS (from the company register):', ...register.map((r: any) => `${r.key}: ${r.text}`), '',
        `THE PAGE: ${domain}, ${how === 'archived' ? `the Internet Archive's copy from ${verdict.date}` : 'read live'}`,
        `Title: ${verdict.title || '(none)'}`,
        `Code found on it: ${verdict.reasons.join(', ') || 'nothing'} - the name, but not the registered postcode or company number.`,
        `What it says (contact details removed):\n${verdict.excerpt || '(nothing readable)'}`, '',
        `THE INVESTIGATOR SAYS: ${redactContactRoutes(why || '(nothing)')}`,
      ].join('\n'))
      return { ...readChecker(reply.parsed), raw: reply.raw, model: reply.model }
    },
    onMove: lookupMove,
  })
  return r
}

async function lookupTick(cfg: Cfg, settings: any, started: number) {
  const keys = [...new Set(LOOKUP_ROLES.flatMap((role) => (cfg.models[role] ?? []).map((m: any) => m.key_secret)))]
  if (!keys.length) return { idle: true, why: 'no lookup models are registered' }
  if (!keys.some((k) => keyFor(k))) return { idle: true, why: `${keys.join(' / ')} is not set; businesses wait in the research queue` }
  if (!settings.lookup_enabled) return { idle: true, why: 'the research loop is switched off (lookup_enabled)' }
  if (!(await hasBudget(cfg, 'prospect_lookup'))) return { idle: true, why: 'the research project has no budget left today' }
  const detail: unknown[] = []
  let done = 0
  /* A business gets what is left of the tick, up to lookup_seconds, and
     is only started with enough left to be worth it. One that runs out of
     time goes back to the queue, not to "nothing found". */
  const end = started + settings.tick_budget_ms - 8000
  while (end - Date.now() > 45000) {
    const [cand] = await rpc('prospect_lookup_next', {}) ?? []
    if (!cand) break
    let seq = Number(cand.next_seq) || 0
    const move: Ctx['move'] = async (m) => {
      seq++
      await rpc('prospect_record_round', {
        p_candidate_id: cand.id, p_seq: seq, p_stage: m.stage, p_from: m.from, p_to: m.to ?? null,
        p_model: m.model ?? null, p_decision: m.decision, p_said: m.said ?? null, p_guard: m.guard ?? null,
      })
    }
    try {
      const r = await lookupOne(cfg, settings, cand, move, Math.min(end, Date.now() + settings.lookup_seconds * 1000))
      if (r.timedOut) {
        await rpc('prospect_lookup_fail', { p_id: cand.id, p_error: 'out of time in this tick; it will be picked up again' })
        detail.push({ company: cand.company_name, paused: 'out of time', steps: r.steps })
        break
      }
      if (r.found) {
        const url = r.found.url
        await rpc('prospect_lookup_finish', {
          p_id: cand.id, p_url: url, p_confirmed_by: r.found.confirmed_by,
          p_outcome: `found by the research loop: ${r.found.domain}${r.found.how === 'archived' ? `, read from the Internet Archive's copy of ${r.found.date}` : ''}`,
          p_note: null,
        })
        detail.push({ company: cand.company_name, found: r.found.domain, how: r.found.how, steps: r.steps })
      } else {
        const why = redactContactRoutes(r.why || 'nothing found')
        await rpc('prospect_lookup_finish', {
          p_id: cand.id, p_url: null, p_confirmed_by: null, p_outcome: `research loop: ${why}`,
          p_note: `No website found by guessing or by the research loop: ${why}. Add it if you know it.`,
        })
        detail.push({ company: cand.company_name, found: null, why, steps: r.steps })
      }
      done++
    } catch (err) {
      const msg = (err as Error).message
      if (QUOTA.test(msg)) {
        await rpc('prospect_lookup_release', { p_id: cand.id })
        detail.push({ company: cand.company_name, paused: msg })
        break
      }
      await move({ stage: 'lookup', from: 'system', decision: 'failed', guard: msg }).catch(() => {})
      await rpc('prospect_lookup_fail', { p_id: cand.id, p_error: msg })
      detail.push({ company: cand.company_name, failed: msg })
      if (err instanceof ChBusy || err instanceof ChKeyRejected || /no budget left|daily quota reached|is not set|not valid|writer's key|no longer in the/i.test(msg)) break
    }
  }
  if (detail.length) {
    await rpc('prospect_log_run', { p_pulled: 0, p_stages: 0, p_finished: done, p_detail: { mode: 'lookup', businesses: detail }, p_error: null })
  }
  return { mode: 'lookup', finished: done, ms: Date.now() - started, detail }
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
    /* The research loop has its own cron: POST {"mode": "lookup"}. It
       works the queue whether or not a target is running. */
    const mode = await req.json().then((b) => b?.mode).catch(() => null)
    if (mode === 'lookup') return reply(await lookupTick(cfg, clampSettings(cfg.settings), started))
    if (!cfg.running) return reply({ idle: true })
    const settings = clampSettings(cfg.settings)

    /* Somebody pressed Run. From here a missing key is a real fault, so it
       goes in the run log where the Lead gen tab shows it. */
    const discoveryKeys = [...new Set(Object.entries(cfg.models)
      .filter(([role]) => !LOOKUP_ROLES.includes(role)).flatMap(([, chain]) => chain.map((m) => m.key_secret)))]
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
    let paused: string | null = null
    if (!(await hasBudget(cfg, 'prospect_research'))) {
      paused = 'the discovery project has no budget left today; nothing claimed'
      detail.push({ paused })
      stop = true
    }
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
        if (err instanceof ChBusy || QUOTA.test(msg)) {
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
    if (!claimed && !plan) return reply({ idle: true, ...(paused ? { paused } : {}) })

    await rpc('prospect_log_run', { p_pulled: pulled, p_stages: stages, p_finished: finished, p_detail: detail, p_error: null })
    return reply({ pulled, stages, finished, ms: Date.now() - started, detail })
  } catch (err) {
    const msg = (err as Error).message
    await rpc('prospect_log_run', { p_pulled: pulled, p_stages: stages, p_finished: finished, p_detail: detail, p_error: msg }).catch(() => {})
    return reply({ error: msg, pulled, stages, finished }, 500)
  }
})
