/* ============================================================
   THE LEAD-GEN AGENTS: THE RULES AND THE LOOPS

   Pure, like outreach-writer/guards.mjs and for the same reason:
   scripts/check-prospector.mjs imports THIS FILE, unmodified, and drives
   every loop with fake agents. index.ts only adds the network.

   THE ARGUMENT

     research     sees the register lines and the website text; promotes
                  facts it can quote.                        -> signals
     signals      never sees the website; turns facts into signals and
                  promotes the ones worth selling on.        -> research
     research     reviews each signal against what it saw: stands, or
                  overreach. An overreach is revised or dropped.
                                                             -> signals
     sales        compares the agreed signals with the portfolio and
                  brings in a specialist per service, with an opening
                  score.                                     -> specialists
     specialist   argues the score with sales, turn and turn about, until
                  one accepts the other's number exactly. May pass, or
                  hand the lead to another service; sales decides whether
                  to bring that specialist in.

   No agreement, no score. That is the rule the user asked for, and it
   is enforced here rather than requested in a prompt: a model that says
   "agree" and names a different number has not agreed.

   THE RECORD

   Every model reply is logged exactly as it came back. What an agent
   passes ON is its own "say" field plus the structured parts that
   survived the guards - never a summary written here. Where code
   overrules something (a quote not on the page, a signal citing no fact,
   an "agree" with the wrong number) that goes in the move's `guard`,
   which is this file speaking and says so.
   ============================================================ */

import { contactRouteIn, redactContactRoutes } from './puller.mjs'
import { nameKey, isPostcodeArea } from './lib.mjs'

/* ---------- the dials, and their stops ---------- */

export const ENVELOPE = {
  batch_size: [1, 5],
  tick_budget_ms: [30000, 380000],
  queue_low_water: [1, 50],
  pull_page_size: [10, 200],
  claim_ttl_seconds: [120, 3600],
  max_attempts: [1, 5],
  max_facts: [3, 20],
  max_signals: [2, 12],
  signal_reviews: [1, 3],
  max_services: [1, 5],
  agreement_turns: [2, 10],
  max_page_chars: [1000, 30000],
  pages_per_site: [1, 5],
  fetch_timeout_ms: [2000, 30000],
  model_timeout_ms: [5000, 60000],
}

export const STAGES = ['research', 'signals', 'sales', 'specialists']

export function clampSettings(raw) {
  const out = {}
  for (const [key, [lo, hi]] of Object.entries(ENVELOPE)) {
    const n = Number(raw?.[key])
    out[key] = Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : lo
  }
  const reserve = raw?.stage_reserve_ms && typeof raw.stage_reserve_ms === 'object' ? raw.stage_reserve_ms : {}
  out.stage_reserve_ms = {}
  for (const s of STAGES) {
    const n = Number(reserve[s])
    out.stage_reserve_ms[s] = Number.isFinite(n) ? Math.min(out.tick_budget_ms, Math.max(5000, n)) : 30000
  }
  const ua = typeof raw?.user_agent === 'string' ? raw.user_agent.trim() : ''
  out.user_agent = ua || 'n.abl-research/1.0 (+https://nabl.agency)'
  return out
}

/* Same reading of a 429 as outreach-writer/guards.mjs. Kept as a copy
   because the edge function deploys one folder; scripts/check-prospector.mjs
   runs both against the same bodies so they cannot drift apart. */
export function quotaScope(status, body) {
  if (status !== 429) return 'none'
  let hay = typeof body === 'string' ? body : ''
  if (body && typeof body === 'object') {
    try { hay = JSON.stringify(body) } catch { hay = '' }
  }
  if (/per[-_ ]?day|daily|requests_per_day|PerDayPerProject/i.test(hay)) return 'day'
  return 'minute'
}

export const parseJson = (raw) =>
  JSON.parse(String(raw ?? '').replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '').trim())

/* ---------- the website: guessing, and proving ----------

   Ported from scripts/sourcing/find-websites.mjs, which learned each of
   these rules on a real sample. There is no search API left to ask, so a
   domain is guessed from the name and then has to prove it is theirs. */

const NOISE = new Set(['THE', 'AND', 'OF', 'GROUP', 'HOLDINGS', 'UK', 'SERVICES', 'SERVICE'])

export function domainGuesses(name) {
  const key = nameKey(name)
  const words = key.split(' ').filter((w) => w && !NOISE.has(w))
  if (!words.length) return []
  const joined = words.join('').toLowerCase().replace(/[^a-z0-9]/g, '')
  const hyphen = words.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '')
  const short = words.slice(0, 2).join('').toLowerCase().replace(/[^a-z0-9]/g, '')
  const ok = (s) => s.length >= 4 && s.length <= 63
  const stems = [joined, hyphen, short].filter(ok)
  const out = []
  for (const tld of ['co.uk', 'com', 'uk']) for (const stem of stems) out.push(`${stem}.${tld}`)
  return [...new Set(out)]
}

const PARKED = /domain (may be|is) (available|for sale)|buy this domain|parked (free )?(at|by)|protected domain holder|this domain is for sale|domain parking/i

export function pageKind(html) {
  const body = String(html ?? '')
  if (body.length < 400) return 'stub'
  const title = (body.match(/<title[^>]*>([^<]*)/i) || [])[1] || ''
  if (PARKED.test(title)) return 'parked'
  return 'live'
}

/* Only the two questions that matter: may we fetch, and how slowly. Errs
   toward disallowing. */
export function parseRobots(text) {
  const rules = { allowed: true, delay: 0 }
  let applies = false
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.split('#')[0].trim()
    if (!line) continue
    const [field, ...rest] = line.split(':')
    const value = rest.join(':').trim()
    const key = field.trim().toLowerCase()
    if (key === 'user-agent') applies = value === '*' || value.toLowerCase().includes('n.abl')
    else if (applies && key === 'disallow' && value === '/') rules.allowed = false
    else if (applies && key === 'crawl-delay') rules.delay = Math.min(Number(value) || 0, 10) * 1000
  }
  return rules
}

const squash = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const PAGE_POSTCODE = /\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s?\d[A-Z]{2}\b/g
const areaOf = (pc) => (String(pc ?? '').toUpperCase().match(/^[A-Z]{1,2}/) || [''])[0]

/* A name match alone is not identity: the first sample found two in
   thirteen were a different firm with the same name. So a name-only
   match has to survive a contradiction test. */
export function contradicts(html, candidate) {
  const ours = areaOf(candidate.postcode)
  if (!ours) return null
  const onPage = [...String(html).toUpperCase().matchAll(PAGE_POSTCODE)]
    .map((m) => areaOf(m[1])).filter(isPostcodeArea)
  if (onPage.length && !onPage.includes(ours)) {
    return `the page's addresses are all in ${[...new Set(onPage)].slice(0, 3).join('/')}, not ${ours}`
  }
  const uk = /(\+44|\b0[12378]\d{8,9}\b|\b0\d{4}\s?\d{6}\b)/.test(html)
  const northAmerican = /\b(?:\+1[\s-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/.test(html)
  if (northAmerican && !uk) return 'the only phone numbers on the page are North American'
  return null
}

export function confirms(html, candidate) {
  const page = squash(html)
  const strong = []
  const weak = []
  const key = nameKey(candidate.company_name)
  const words = key.split(' ').filter((w) => w.length > 3 && !NOISE.has(w))
  if (candidate.postcode && squash(candidate.postcode).length >= 5 && page.includes(squash(candidate.postcode))) strong.push('postcode')
  if (candidate.company_number && page.includes(squash(candidate.company_number))) strong.push('company number')
  if (key.length >= 6 && page.includes(squash(key))) weak.push('company name')
  else if (words.length >= 2 && words.every((w) => page.includes(squash(w)))) weak.push('every word of the name')
  if (strong.length) return { reasons: [...strong, ...weak] }
  if (!weak.length) return { reasons: [] }
  const conflict = contradicts(html, candidate)
  return conflict ? { reasons: [], conflict } : { reasons: weak }
}

export function stripHtml(html) {
  return String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/* The pages most likely to say what a business does and how it works,
   on the same host only. Never a contact page: that is where the routes
   are, and nothing here needs one. */
const WORTH_READING = /\/(about|about-us|who-we-are|services|our-services|what-we-do|how-it-works|work|our-work|products|booking|book|pricing|prices)(\/|$|\.html?$)/i

export function sameSiteLinks(html, baseUrl, max = 2) {
  let base
  try { base = new URL(baseUrl) } catch { return [] }
  const out = []
  for (const m of String(html ?? '').matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["']/gi)) {
    let u
    try { u = new URL(m[1], base) } catch { continue }
    if (u.host !== base.host || !/^https?:$/.test(u.protocol)) continue
    if (!WORTH_READING.test(u.pathname)) continue
    u.search = ''
    const href = u.toString()
    if (href === base.toString() || out.includes(href)) continue
    out.push(href)
    if (out.length >= max) break
  }
  return out
}

/* ---------- the register, as lines an agent may cite ----------

   Each line has a key, and a register fact must name its key. Built from
   the advanced-search row plus the company profile and officer list.
   Deliberately absent: the company number, the registered address and
   postcode, and every officer's name. */

const PLAIN_TYPE = {
  ltd: 'private limited company', llp: 'limited liability partnership', plc: 'public limited company',
}
const ACCOUNTS = {
  'micro-entity': 'micro-entity accounts (the smallest filing category)',
  small: 'small company accounts',
  'total-exemption-full': 'small company accounts, exempt from audit',
  'total-exemption-small': 'small company accounts, exempt from audit',
  'audit-exemption-subsidiary': 'accounts exempt from audit as a subsidiary',
  medium: 'medium-sized company accounts',
  full: 'full accounts',
  group: 'group accounts',
  dormant: 'dormant company accounts',
  'unaudited-abridged': 'abridged small company accounts',
}

export function registerLines(c, { profile = null, officers = null, today = new Date() } = {}) {
  const lines = []
  const add = (key, text) => { if (text) lines.push({ key, text }) }
  add('r_name', `Registered name: ${c.company_name}`)
  if (c.activity) add('r_activity', `What it says it does (SIC): ${c.activity}`)
  const born = c.incorporated_on || profile?.date_of_creation
  if (born) {
    const y = Number(String(born).slice(0, 4))
    const years = today.getUTCFullYear() - y
    add('r_age', `Incorporated in ${y}, so trading about ${Math.max(0, years)} year${years === 1 ? '' : 's'}`)
  }
  const type = c.company_type || profile?.type
  if (type) add('r_type', `Legal form: ${PLAIN_TYPE[type] ?? type}`)
  if (c.town) add('r_town', `Registered office town: ${c.town}`)

  const acc = profile?.accounts?.last_accounts
  if (acc?.type && acc.type !== 'null') {
    add('r_accounts', `Last accounts filed as ${ACCOUNTS[acc.type] ?? acc.type}${acc.made_up_to ? `, made up to ${acc.made_up_to}` : ''}`)
  }
  if (profile?.accounts?.overdue === true || profile?.confirmation_statement?.overdue === true) {
    add('r_overdue', 'The register shows a filing overdue')
  }
  if (profile?.has_charges === true) add('r_charges', 'Has charges registered (it has borrowed against its assets)')
  if (profile?.has_insolvency_history === true) add('r_insolvency', 'Has insolvency history on the register')

  const items = Array.isArray(officers?.items) ? officers.items : null
  if (items) {
    const active = items.filter((o) => !o.resigned_on)
    const directors = active.filter((o) => /director/i.test(String(o.officer_role ?? '')))
    const years = directors.map((o) => Number(String(o.appointed_on ?? '').slice(0, 4))).filter(Boolean).sort()
    const members = active.filter((o) => /member/i.test(String(o.officer_role ?? '')))
    if (directors.length) {
      add('r_directors', `${directors.length} active director${directors.length === 1 ? '' : 's'}` +
        (years.length ? `, the most recent appointed in ${years[years.length - 1]}` : ''))
    } else if (members.length) {
      add('r_directors', `${members.length} active LLP member${members.length === 1 ? '' : 's'}`)
    }
    const corporate = active.filter((o) => /corporate/i.test(String(o.officer_role ?? ''))).length
    if (corporate) add('r_corporate_officer', `${corporate} of its officers ${corporate === 1 ? 'is a company' : 'are companies'}, not people`)
  }
  return lines
}

/* ---------- quotes ---------- */

export function normQuote(s) {
  return String(s ?? '').toLowerCase()
    .replace(/[‘’´`]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function quoteOnPage(quote, pageText) {
  const q = normQuote(quote)
  if (q.split(' ').filter(Boolean).length < 3) return false
  return normQuote(pageText).includes(q)
}

const idOk = (v) => typeof v === 'string' && /^[a-z]{1,3}\d{1,3}$/i.test(v.trim())
const str = (v, n = 600) => (typeof v === 'string' ? v.trim().slice(0, n) : '')

/** What an agent passes on in its own words. Cleaned of contact routes,
    never rewritten. */
export function sayOf(parsed) {
  return redactContactRoutes(str(parsed?.say, 4000))
}

/* ---------- research ---------- */

export function validateResearch(parsed, { pageText, registerKeys, max = 12 }) {
  const facts = []
  const struck = []
  const list = Array.isArray(parsed?.facts) ? parsed.facts : []
  const seen = new Set()
  for (const f of list) {
    const id = str(f?.id, 8)
    const fact = str(f?.fact, 400)
    const source = str(f?.source, 20).toLowerCase()
    if (!idOk(id)) { struck.push(`a fact with id "${id || '?'}" — ids look like f1`); continue }
    if (seen.has(id)) { struck.push(`${id}: the id was used twice`); continue }
    if (!fact) { struck.push(`${id}: no fact given`); continue }
    const route = contactRouteIn(`${fact} ${f?.quote ?? ''}`)
    if (route) { struck.push(`${id}: carries ${route}`); continue }
    if (source === 'page') {
      if (!pageText) { struck.push(`${id}: cites the page, and no page was read`); continue }
      if (!quoteOnPage(f?.quote, pageText)) { struck.push(`${id}: its quote is not on the page`); continue }
      facts.push({ id, fact, source, quote: str(f.quote, 400) })
    } else if (source === 'register') {
      const key = str(f?.register_key, 40)
      if (!registerKeys.includes(key)) { struck.push(`${id}: names register line "${key}", which it was not given`); continue }
      facts.push({ id, fact, source, register_key: key })
    } else {
      struck.push(`${id}: source must be page or register`)
      continue
    }
    seen.add(id)
    if (facts.length >= max) break
  }
  const unknowns = (Array.isArray(parsed?.unknowns) ? parsed.unknowns : [])
    .map((u) => redactContactRoutes(str(u, 300))).filter(Boolean).slice(0, 8)
  return { facts, struck, unknowns, say: sayOf(parsed) }
}

/* ---------- signals ---------- */

export const STRENGTHS = ['strong', 'possible', 'weak']

export function validateSignals(parsed, { facts, max = 8 }) {
  const factIds = new Set(facts.map((f) => f.id))
  const signals = []
  const struck = []
  const seen = new Set()
  for (const s of Array.isArray(parsed?.signals) ? parsed.signals : []) {
    const id = str(s?.id, 8)
    const text = str(s?.signal, 400)
    if (!idOk(id)) { struck.push(`a signal with id "${id || '?'}" — ids look like s1`); continue }
    if (seen.has(id)) { struck.push(`${id}: the id was used twice`); continue }
    if (!text) { struck.push(`${id}: says nothing`); continue }
    const route = contactRouteIn(text)
    if (route) { struck.push(`${id}: carries ${route}`); continue }
    const cited = (Array.isArray(s?.facts) ? s.facts : []).map((x) => str(x, 8)).filter((x) => factIds.has(x))
    if (!cited.length) { struck.push(`${id}: cites no fact the research agent promoted`); continue }
    const strength = STRENGTHS.includes(str(s?.strength, 12).toLowerCase()) ? str(s.strength, 12).toLowerCase() : 'weak'
    seen.add(id)
    signals.push({ id, signal: text, facts: [...new Set(cited)], strength })
    if (signals.length >= max) break
  }
  const ids = new Set(signals.map((s) => s.id))
  const asked = Array.isArray(parsed?.promote) ? parsed.promote.map((x) => str(x, 8)) : null
  /* No promote list means every surviving signal is put forward. A list
     that names nothing real is the agent promoting nothing, and says so. */
  const promoted = asked ? [...new Set(asked.filter((x) => ids.has(x)))] : [...ids]
  const ghost = asked ? asked.filter((x) => !ids.has(x)) : []
  if (ghost.length) struck.push(`promoted ${ghost.join(', ')}, which ${ghost.length === 1 ? 'is not a signal' : 'are not signals'} that survived`)
  return { signals, promoted, struck, say: sayOf(parsed) }
}

export function validateSignalReview(parsed, signals) {
  const ids = new Set(signals.map((s) => s.id))
  const verdicts = new Map()
  const struck = []
  for (const v of Array.isArray(parsed?.verdicts) ? parsed.verdicts : []) {
    const id = str(v?.signal, 8)
    if (!ids.has(id)) { if (id) struck.push(`a verdict on "${id}", which was not put forward`); continue }
    const verdict = str(v?.verdict, 12).toLowerCase() === 'overreach' ? 'overreach' : 'stands'
    verdicts.set(id, { verdict, why: redactContactRoutes(str(v?.why, 400)) })
  }
  /* Silence on a signal is not an objection. The reviewer has to say
     "overreach" for a signal to fall. */
  const unreviewed = [...ids].filter((id) => !verdicts.has(id))
  if (!parsed || typeof parsed !== 'object') struck.push('the review was not readable, so every signal stands')
  else if (unreviewed.length) struck.push(`no verdict on ${unreviewed.join(', ')}, so ${unreviewed.length === 1 ? 'it stands' : 'they stand'}`)
  for (const id of unreviewed) verdicts.set(id, { verdict: 'stands', why: '' })
  const objections = [...verdicts].filter(([, v]) => v.verdict === 'overreach').map(([id]) => id)
  return { verdicts, objections, struck, say: sayOf(parsed) }
}

/** research -> signals -> research [-> signals -> research ...]

    The first of the review loops. `reviews` is how many times the
    research agent reviews; there is one revision between each. What
    survives the last review is what sales sees. */
export async function argueSignals({ facts, researchSay, reviews = 2, max = 8, callSignals, callReview, onMove }) {
  let current = null
  let lastReview = null
  for (let r = 1; r <= reviews; r++) {
    const reply = await callSignals({ facts, researchSay, previous: current, review: lastReview, round: r })
    const v = validateSignals(reply?.parsed, { facts, max })
    const usable = v.signals.filter((s) => v.promoted.includes(s.id))
    await onMove({
      from: 'signals', to: 'research', model: reply?.model, said: reply?.raw,
      decision: r === 1 ? 'proposed' : 'revised',
      guard: [...v.struck, reply?.parsed ? null : 'the reply was not JSON'].filter(Boolean).join('; ') || null,
    })
    if (!usable.length) {
      /* A revision that loses everything does not wipe out signals the
         research agent had already let stand. */
      if (current && lastReview) break
      return { signals: [], dropped: [], say: v.say, reviews: r, why: 'the signals agent promoted nothing that survived' }
    }
    current = { signals: usable, say: v.say }

    const rev = await callReview({ facts, signals: usable, signalsSay: v.say, round: r })
    const rv = validateSignalReview(rev?.parsed, usable)
    lastReview = rv
    const standing = usable.filter((s) => rv.verdicts.get(s.id)?.verdict === 'stands')
    const last = r === reviews || !rv.objections.length
    await onMove({
      from: 'research', to: last ? 'sales' : 'signals', model: rev?.model, said: rev?.raw,
      decision: rv.objections.length ? 'objected' : 'let_stand',
      guard: [...rv.struck,
        last ? `going to sales: ${standing.map((s) => s.id).join(', ') || 'nothing'}` +
               (rv.objections.length ? `; dropped as overreach: ${rv.objections.join(', ')}` : '') : null,
      ].filter(Boolean).join('; ') || null,
    })
    if (last) {
      return {
        signals: standing,
        dropped: usable.filter((s) => !standing.includes(s)).map((s) => ({ ...s, why: rv.verdicts.get(s.id)?.why ?? '' })),
        say: v.say, reviews: r,
        why: standing.length ? null : 'the research agent let no signal stand',
      }
    }
  }
  const standing = current.signals.filter((s) => lastReview.verdicts.get(s.id)?.verdict === 'stands')
  return { signals: standing, dropped: [], say: current.say, reviews, why: standing.length ? null : 'no signal survived review' }
}

/* ---------- sales ---------- */

const scoreOf = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n) : null
}

export function validatePick(p, { signals, services }) {
  const ids = new Set(signals.map((s) => s.id))
  const service = str(p?.service, 40).toLowerCase()
  if (!services.includes(service)) return { ok: false, why: `"${service || '?'}" is not a service in the portfolio` }
  const cited = (Array.isArray(p?.signals) ? p.signals : []).map((x) => str(x, 8)).filter((x) => ids.has(x))
  if (!cited.length) return { ok: false, why: `${service}: cites no agreed signal` }
  const score = scoreOf(p?.score)
  if (score === null) return { ok: false, why: `${service}: no opening score on the 0-100 scale` }
  const pitch = str(p?.pitch, 2000)
  const route = contactRouteIn(pitch)
  if (route) return { ok: false, why: `${service}: the pitch carries ${route}` }
  return { ok: true, pick: { service, pitch: redactContactRoutes(pitch), signals: [...new Set(cited)], score } }
}

export function validateSales(parsed, { signals, services, max = 3 }) {
  const picks = []
  const struck = []
  for (const p of Array.isArray(parsed?.services) ? parsed.services : []) {
    const v = validatePick(p, { signals, services })
    if (!v.ok) { struck.push(v.why); continue }
    if (picks.some((x) => x.service === v.pick.service)) { struck.push(`${v.pick.service} was brought in twice`); continue }
    if (picks.length >= max) { struck.push(`${v.pick.service}: over the limit of ${max} services`); continue }
    picks.push(v.pick)
  }
  return {
    picks, struck, say: sayOf(parsed),
    noFitBecause: redactContactRoutes(str(parsed?.no_fit_because, 600)),
  }
}

/* ---------- one move in the score argument ---------- */

const MOVES = { specialist: ['agree', 'counter', 'pass', 'redirect'], sales: ['agree', 'counter'] }

/** One reply, turned into a move the loop can act on.

    `theirs` is the other side's last number. Agreement means naming it:
    an "agree" with a different number is read as the counter it is, and
    a counter that happens to name their number is read as agreement,
    because the number is the point. */
export function readMove(parsed, { who, theirs, signals, services, current }) {
  const guard = []
  if (!parsed || typeof parsed !== 'object') return { kind: 'none', score: null, guard: ['the reply was not JSON'] }
  const route = contactRouteIn(JSON.stringify({ ...parsed, say: undefined }))
  if (route) return { kind: 'none', score: null, guard: [`refused whole: it carries ${route}`] }

  let verdict = str(parsed.verdict, 12).toLowerCase()
  if (!MOVES[who].includes(verdict)) {
    guard.push(`"${verdict || '?'}" is not a move a ${who} agent can make; read as a counter`)
    verdict = 'counter'
  }
  let score = scoreOf(parsed.score)
  if (verdict === 'pass') {
    if (score !== 0 && score !== null) guard.push(`passed but named ${score}; a pass is 0`)
    score = 0
  }
  const ids = new Set(signals.map((s) => s.id))
  const cited = (Array.isArray(parsed.signals) ? parsed.signals : []).map((x) => str(x, 8)).filter((x) => ids.has(x))

  if (verdict === 'agree') {
    if (theirs === null || theirs === undefined) {
      guard.push('agreed before there was a number to agree with; read as a counter')
      verdict = 'counter'
    } else if (score !== theirs) {
      guard.push(`said agree but named ${score ?? 'no number'}, not ${theirs}; read as a counter`)
      verdict = 'counter'
    }
  } else if (score !== null && theirs !== null && theirs !== undefined && score === theirs) {
    guard.push(`named ${score}, the other side's own number: that is agreement`)
    verdict = 'agree'
  }

  if (verdict !== 'agree' && score === null) {
    return { kind: 'none', score: null, guard: [...guard, 'no score on the 0-100 scale, so no proposal'] }
  }
  if ((verdict === 'counter' || verdict === 'redirect') && score > 0 && !cited.length) {
    return { kind: 'none', score: null, guard: [...guard, `proposed ${score} citing no agreed signal, so it does not count`] }
  }

  const move = { kind: verdict, score, signals: cited, guard }
  if (who === 'specialist') {
    const to = str(parsed.redirect_to, 40).toLowerCase()
    if (verdict === 'redirect') {
      if (!to || to === current || !services.includes(to)) {
        guard.push(`redirected to "${to || '?'}", which is not another service; read as a counter`)
        move.kind = 'counter'
      } else move.redirect_to = to
    }
    const q = str(parsed.confirm_question, 400)
    const w = str(parsed.walk_away_if, 400)
    if (q && !contactRouteIn(q)) move.confirm_question = q
    if (w && !contactRouteIn(w)) move.walk_away_if = w
  }
  if (who === 'sales' && parsed.bring_in && typeof parsed.bring_in === 'object') {
    const b = validatePick(parsed.bring_in, { signals, services })
    if (b.ok) move.bring_in = b.pick
    else guard.push(`could not bring in: ${b.why}`)
  }
  return move
}

/** sales <-> one specialist, until one takes the other's number.

    Turns alternate, specialist first, because sales has already spoken:
    its pitch and opening score are the first message. `turns` counts
    messages after that. The history handed to each agent is the agents'
    own `say` text, in order - the conversation, not our précis of it. */
export async function argueService({
  pick, turns = 6, signals, services, callSpecialist, callSales, onMove, canBringIn = () => true,
}) {
  const history = [{ from: 'sales', say: pick.pitch, score: pick.score }]
  let sales = pick.score
  let specialist = null
  const handOns = []
  let ask = null
  let walk = null

  for (let t = 1; t <= turns; t++) {
    const who = t % 2 === 1 ? 'specialist' : 'sales'
    const theirs = who === 'specialist' ? sales : specialist
    const reply = who === 'specialist'
      ? await callSpecialist({ service: pick.service, pick, history, sales, specialist, turn: t })
      : await callSales({ service: pick.service, pick, history, sales, specialist, turn: t })
    const m = readMove(reply?.parsed, { who, theirs, signals, services, current: pick.service })
    const say = sayOf(reply?.parsed)
    if (m.confirm_question) ask = m.confirm_question
    if (m.walk_away_if) walk = m.walk_away_if

    const agreed = m.kind === 'agree'
    if (m.kind !== 'none') {
      const n = agreed ? theirs : m.score
      if (who === 'specialist') specialist = n
      else sales = n
    }
    const extra = []
    if (m.redirect_to) extra.push(`handed on to ${m.redirect_to}; sales decides`)
    if (m.bring_in) {
      if (canBringIn(m.bring_in.service)) { handOns.push(m.bring_in); extra.push(`brought in ${m.bring_in.service} at ${m.bring_in.score}`) }
      else extra.push(`${m.bring_in.service} not brought in: already heard, or no room`)
    }
    if (agreed) extra.push(`agreed at ${theirs}`)

    await onMove({
      from: who === 'specialist' ? `specialist:${pick.service}` : 'sales',
      to: who === 'specialist' ? 'sales' : `specialist:${pick.service}`,
      model: reply?.model, said: reply?.raw,
      decision: m.kind === 'none' ? 'no_move' : m.kind,
      guard: [...m.guard, ...extra].join('; ') || null,
    })
    history.push({ from: who, say, score: m.kind === 'none' ? null : (agreed ? theirs : m.score) })

    if (agreed) {
      return { service: pick.service, status: 'agreed', score: theirs, sales, specialist,
               turns: t, confirm_question: ask, walk_away_if: walk, handOns }
    }
  }
  return { service: pick.service, status: 'disputed', score: null, sales, specialist, turns,
           confirm_question: ask, walk_away_if: walk, handOns }
}

/* ---------- the verdict on the business ---------- */

/** A lead's score is its best AGREED service score. A disputed service
    contributes nothing: that is the rule. */
export function outcome(results) {
  const agreed = results.filter((r) => r.status === 'agreed')
  const positive = agreed.filter((r) => r.score > 0)
  const best = positive.length ? Math.max(...positive.map((r) => r.score)) : null
  let status = 'no_fit'
  if (positive.length) status = 'scored'
  else if (results.some((r) => r.status === 'disputed')) status = 'disputed'
  return {
    status,
    lead_score: best,
    services: results.map((r) => ({
      service: r.service, status: r.status, score: r.score,
      sales_last: r.sales ?? null, specialist_last: r.specialist ?? null,
      turns: r.turns ?? 0, confirm_question: r.confirm_question ?? null, walk_away_if: r.walk_away_if ?? null,
    })),
  }
}

/* ---------- what each agent is handed ---------- */

export const knowledgeOf = (cfg, key) => (cfg.knowledge || []).find((k) => k.key === key)
export const serviceKeys = (cfg) => (cfg.knowledge || []).filter((k) => k.kind === 'service').map((k) => k.key)

export function factLines(facts, register) {
  return facts.map((f) => f.source === 'page'
    ? `${f.id}: ${f.fact}\n    from their own website: "${f.quote}"`
    : `${f.id}: ${f.fact}\n    from the register: ${register.find((r) => r.key === f.register_key)?.text ?? f.register_key}`).join('\n')
}

export function signalLines(signals, facts) {
  return signals.map((s) => `${s.id} (${s.strength}): ${s.signal}\n    rests on: ${s.facts.map((id) => {
    const f = facts.find((x) => x.id === id)
    return f ? `${id} "${f.fact}"` : id
  }).join('; ')}`).join('\n')
}

export function portfolioBlock(cfg) {
  return (cfg.knowledge || []).filter((k) => k.kind === 'service').map((k) =>
    `SERVICE ${k.key} — ${k.label}\n${k.summary ?? ''}\nSignals that point here:\n${k.signals ?? ''}`).join('\n\n')
}

export function conversationBlock(history, service) {
  return history.map((h, i) => {
    const who = h.from === 'sales' ? 'SALES' : `${service.toUpperCase()} SPECIALIST`
    return `${i + 1}. ${who}${h.score === null || h.score === undefined ? '' : ` (number: ${h.score})`}:\n${h.say || '(said nothing usable)'}`
  }).join('\n\n')
}
