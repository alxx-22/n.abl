/* ============================================================
   THE LEAD PULLER — the logic, with nothing attached

   Pulls limited companies from the Companies House REST API, shapes them
   exactly the way fetch-companies-house.mjs shapes the bulk file, and
   optionally has a model argue which of them are worth writing to.

   Everything in this file is pure: values in, values out. No network,
   no filesystem, no process.env. The fetch, the clock, the sleep and the
   environment are all passed in. That is the same rule as
   supabase/functions/outreach-writer/guards.mjs, for the same reason:
   pull-test.mjs imports THIS FILE, unmodified, so the tests cannot pass
   while the code that runs differs — and nothing here needs a key, so
   the whole thing is testable before anybody has made one.

   A NEW SOURCE, NOT A NEW PIPELINE

   The output is a `.sourcing/candidates-*.json` file in the bulk
   fetcher's envelope and field names. merge.mjs already picks up every
   file matching that name as a Companies House source, so a pulled
   company flows through merge -> triage -> find-websites ->
   extract-contacts -> promote untouched, and every guard those stages
   carry applies to it without being restated here.

   WHAT A MODEL IS AND IS NOT ALLOWED TO DO HERE

   business/10-lead-sourcing/ai-discovery.md is the long version. The
   short one, enforced below rather than asked for in a prompt:

     - It may say a business is worth looking at, and why.
     - It may not say how to reach them. No email, no phone number, no
       website, no postal address. Ever. An invented email address is
       the worst thing this system could produce and it is exactly what
       a model produces confidently.
     - It may only judge companies it was given. It is shown opaque ids,
       not company numbers, so an invented candidate cannot even look
       plausible, and any id it did not receive is refused.
   ============================================================ */

import { outwardArea, makeTerritoryFilter, nameKey, isDistinctiveName, postcodeKey, isPostcodeArea } from './lib.mjs'
import { SIC_2007 } from './sic-2007.mjs'

/* ---------- Companies House, as documented ---------- */

export const CH_BASE = 'https://api.company-information.service.gov.uk'
export const CH_SEARCH_PATH = '/advanced-search/companies'

/* 600 requests in any five minutes, then a 429 for every request until the
   window resets. developer-specs.company-information.service.gov.uk/guides/rateLimiting */
export const CH_LIMIT = Object.freeze({ max: 600, windowMs: 5 * 60_000 })

/* The documented range for `size` on advanced search. */
export const CH_PAGE_MAX = 5000

/* HTTP Basic, with the key as the username and the password left blank.
   The trailing colon is not decoration: without it there is no password
   field at all, and "the password can be left blank" means an empty one,
   not a missing one. guides/authorisation.

   btoa rather than Buffer: it is global in both Node and Deno, and this
   file is meant to be liftable into an edge function unmodified. Keys
   are ASCII, so btoa's Latin-1 limit never applies. */
export function chAuthHeader(key) {
  return 'Basic ' + btoa(`${key}:`)
}

/* ---------- who we pull ----------

   The company types a pull asks for by default, and why only these.

   ltd  — private limited by shares. The ICP's population, and a corporate
          subscriber under PECR, which is what the LIA was written for.
   llp  — a body corporate in its own right, so the same PECR position.

   Deliberately NOT by default:
   plc  — public companies are large by definition; the ICP is micro and
          small, and scoring would put them at the back anyway.
   guarantee companies, CIOs, registered societies — mostly clubs,
          charities and co-operatives. Not excluded as a matter of law;
          excluded because nobody has decided we want them. --types
          overrides this for a run that does. */
export const DEFAULT_TYPES = Object.freeze(['ltd', 'llp'])

/* The bulk file's own wording for each type, so a pulled company and a
   bulk-file company carry the same company_category string downstream.
   Anything not listed passes through as the API's code, which is honest
   rather than a guessed translation. */
export const CATEGORY = Object.freeze({
  ltd: 'Private Limited Company',
  plc: 'Public Limited Company',
  llp: 'Limited Liability Partnership',
})

/* SIC codes that mean "not a trading business". A dormant company has
   no activity to improve; a residents' management company exists to own
   the freehold of a block of flats; the two household codes are not
   businesses at all. Excluded at source rather than scored low, because
   there is nothing for us to offer any of them. */
export const NON_TRADING_SIC = Object.freeze({
  '99999': 'dormant',
  '74990': 'non-trading',
  '98000': 'residents’ property management',
  '98100': 'private household, not a business',
  '98200': 'private household, not a business',
})

/* SIC codes that mean "not somebody we sell to" - business/10-lead-sourcing/
   targets.md, from who-we-sell-to.md. An IT, software or web firm would be
   buying from a competitor, so any one of these codes refuses it. */
export const COMPETITOR_SIC = Object.freeze({
  '62011': 'publishes software', '62012': 'develops software', '62020': 'IT consultancy',
  '62030': 'manages computer facilities', '62090': 'IT services', '63110': 'data processing and hosting',
  '63120': 'web portals',
})

/* A holding company or a vehicle that only owns property has no staff and
   no process to improve. Refused only when these are its ONLY codes: a
   builder that also lists 68100 is still a builder. */
export const VEHICLE_SIC = Object.freeze({
  '64205': 'financial services holding company', '64209': 'holding company', '70100': 'head office of a group',
  '68100': 'buys and sells its own property',
})

/* ---------- SIC ---------- */

/** "43210" -> "43210 - Electrical installation", the bulk file's form.
    A code the table does not know stays bare, rather than being given a
    description nobody published. */
export function describeSic(code, table = SIC_2007) {
  const c = String(code || '').trim()
  const text = table[c]
  return text ? `${c} - ${text}` : c
}

/** The codes in a list that SIC 2007 does not have, prefixes included (a
    prefix nothing starts with is unknown too). An unknown code sent to the
    advanced search makes it answer 404, which reads as "no companies here"
    and would mark the town as done - so the edge function refuses these
    before asking. */
export function unknownSic(inputs, table = SIC_2007) {
  const codes = Object.keys(table)
  return inputs.map((raw) => String(raw || '').replace(/\D/g, '')).filter(Boolean)
    .filter((p) => (p.length === 5 ? !table[p] : !codes.some((c) => c.startsWith(p))))
}

/** Prefixes to full codes: "432" -> every 432xx in the table. A full
    five-digit code passes through, known or not, so a code newer than the
    vendored table can still be asked for. Order kept, duplicates dropped. */
export function expandSic(inputs, table = SIC_2007) {
  const out = []
  const seen = new Set()
  const push = (c) => { if (!seen.has(c)) { seen.add(c); out.push(c) } }
  for (const raw of inputs) {
    const p = String(raw || '').replace(/\D/g, '')
    if (!p) continue
    if (p.length === 5) { push(p); continue }
    for (const c of Object.keys(table).sort()) if (c.startsWith(p)) push(c)
  }
  return out
}

/* ---------- the request ---------- */

/** The advanced-search URL. List parameters are sent comma-separated.

    UNVERIFIED AGAINST A LIVE RESPONSE: the reference page types
    sic_codes, company_status and company_type as "list" without saying
    whether a list is comma-joined or a repeated parameter. Comma-joined
    is the Companies House convention elsewhere. `npm run sourcing:pull:dry`
    prints this URL exactly, so the first live run is the check. */
export function buildSearchUrl(q = {}, base = CH_BASE) {
  const u = new URL(CH_SEARCH_PATH, base)
  const set = (k, v) => {
    if (v === undefined || v === null || v === '') return
    if (Array.isArray(v)) { if (v.length) u.searchParams.set(k, v.join(',')) }
    else u.searchParams.set(k, String(v))
  }
  set('location', q.location)
  set('sic_codes', q.sicCodes)
  set('company_status', q.status ?? ['active'])
  set('company_type', q.types ?? DEFAULT_TYPES)
  set('incorporated_from', q.since)
  set('incorporated_to', q.until)
  set('company_name_includes', q.nameIncludes)
  const size = Math.max(1, Math.min(CH_PAGE_MAX, Math.floor(Number(q.size) || 100)))
  u.searchParams.set('size', String(size))
  u.searchParams.set('start_index', String(Math.max(0, Math.floor(Number(q.startIndex) || 0))))
  return u.toString()
}

/* ---------- pacing ----------

   A sliding window over the documented limit, plus a minimum gap so the
   window is never spent in one burst. The window alone would allow 600
   requests in the first second, which is within the letter of the limit
   and is not how you treat somebody else's service. */
export function createRateLimiter({ max, windowMs, minGapMs = 0, now = Date.now, sleep }) {
  if (typeof sleep !== 'function') throw new Error('createRateLimiter: sleep is required')
  const stamps = []
  let last = -Infinity
  return async function take() {
    for (;;) {
      const t = now()
      while (stamps.length && stamps[0] <= t - windowMs) stamps.shift()
      const gapWait = last + minGapMs - t
      if (stamps.length < max && gapWait <= 0) {
        stamps.push(t)
        last = t
        return
      }
      const windowWait = stamps.length >= max ? stamps[0] + windowMs - t + 1 : 0
      await sleep(Math.max(gapWait, windowWait, 1))
    }
  }
}

export class ChKeyRejected extends Error {}

/** Every page of a search, up to `limit`.

    Stops at whichever comes first: `limit` reached, an empty page, or the
    `hits` total the API reports. A 429 is waited out — Retry-After if the
    response gives one, else the rest of the window — up to `maxRetries`
    times for the same page, then it gives up rather than hammer. A 401 is
    the key, and says so. */
export async function pullPages({
  fetchImpl, key, query = {}, limit = 200, pageSize, take, sleep,
  maxRetries = 3, base = CH_BASE, log = () => {},
}) {
  if (!key) throw new ChKeyRejected('COMPANIES_HOUSE_API_KEY is not set')
  const size = Math.max(1, Math.min(CH_PAGE_MAX, pageSize ?? Math.min(limit, 1000)))
  const items = []
  let hits = null
  let start = 0
  let requests = 0
  let pages = 0

  while (items.length < limit) {
    const url = buildSearchUrl({ ...query, size, startIndex: start }, base)
    let res
    for (let attempt = 0; ; attempt++) {
      if (take) await take()
      requests++
      res = await fetchImpl(url, { headers: { authorization: chAuthHeader(key), accept: 'application/json' } })
      if (res.status !== 429) break
      if (attempt >= maxRetries) throw new Error(`Companies House rate limit: still 429 after ${maxRetries} retries`)
      const after = Number(res.headers?.get?.('retry-after'))
      const waitMs = Number.isFinite(after) && after > 0 ? after * 1000 : CH_LIMIT.windowMs
      log(`  429 from Companies House; waiting ${Math.round(waitMs / 1000)}s`)
      await sleep(waitMs)
    }

    if (res.status === 401) {
      throw new ChKeyRejected('Companies House rejected COMPANIES_HOUSE_API_KEY (401). Check it is a REST key for the Live environment, not Test.')
    }
    if (!res.ok) {
      let body = ''
      try { body = String(await res.text()).slice(0, 200) } catch { /* nothing to show */ }
      throw new Error(`Companies House ${res.status} for ${url}${body ? ` — ${body}` : ''}`)
    }

    const data = await res.json()
    pages++
    if (typeof data?.hits === 'number') hits = data.hits
    const page = Array.isArray(data?.items) ? data.items : []
    for (const it of page) {
      if (items.length >= limit) break
      items.push(it)
    }
    start += page.length
    if (!page.length) break
    if (hits !== null && start >= hits) break
  }

  return { items, hits, pages, requests }
}

/* ---------- shaping ---------- */

/** One API item -> one candidate, in fetch-companies-house.mjs's shape.

    The response shape is the one documented and shown in Companies House's
    own examples: company_name, company_number, company_status,
    company_type, date_of_creation, registered_office_address{...},
    sic_codes[]. Every field is optional here, because a normaliser that
    throws on one odd company loses the other 199. */
export function normaliseItem(item, { pulledOn, sourceDetail = 'Companies House REST API, advanced search', table = SIC_2007 } = {}) {
  if (!item || typeof item !== 'object' || !item.company_number) return null
  const roa = item.registered_office_address || {}
  const postcode = String(roa.postal_code || '').trim().toUpperCase() || null
  const codes = Array.isArray(item.sic_codes) ? item.sic_codes.map((c) => String(c).trim()).filter(Boolean) : []
  return {
    company_number: String(item.company_number).trim(),
    company: String(item.company_name || '').trim(),
    company_category: CATEGORY[item.company_type] ?? item.company_type ?? null,
    company_type: item.company_type ?? null,
    company_status: item.company_status ?? null,
    incorporated: item.date_of_creation || null,
    postcode,
    area: outwardArea(postcode),
    town: roa.locality ? String(roa.locality).trim() : null,
    address_line_1: roa.address_line_1 ? String(roa.address_line_1).trim() : null,
    sic: codes.map((c) => describeSic(c, table)),
    source: 'companies_house',
    source_detail: sourceDetail,
    source_date: pulledOn || null,
  }
}

/** Whether a candidate is let in, and if not, the reason in words.

    The API was already asked for active companies of the allowed types.
    This checks again, because a filter you did not apply yourself is a
    filter you are trusting. */
export function admit(c, { types = DEFAULT_TYPES, areas = null } = {}) {
  if (!c) return { ok: false, why: 'not a company record' }
  if (c.company_status && c.company_status !== 'active') return { ok: false, why: `status is ${c.company_status}` }
  if (c.company_type && !types.includes(c.company_type)) return { ok: false, why: `type ${c.company_type} is not one we pull` }
  if (!c.company) return { ok: false, why: 'no company name' }
  if (!c.postcode) return { ok: false, why: 'no registered office postcode, so territory cannot be checked' }
  const codes = (c.sic || []).map((s) => String(s).replace(/\D.*$/, ''))
  const dead = codes.find((code) => NON_TRADING_SIC[code])
  if (dead) return { ok: false, why: `SIC ${dead}: ${NON_TRADING_SIC[dead]}` }
  const rival = codes.find((code) => COMPETITOR_SIC[code])
  if (rival) return { ok: false, why: `SIC ${rival}: ${COMPETITOR_SIC[rival]}, so it is in our line of work` }
  if (codes.length && codes.every((code) => VEHICLE_SIC[code])) {
    return { ok: false, why: `SIC ${codes.join(', ')}: ${VEHICLE_SIC[codes[0]]}, with no trading activity listed` }
  }
  if (areas && areas.length && !makeTerritoryFilter(areas)(c.postcode)) {
    return { ok: false, why: `postcode ${c.postcode} is outside ${areas.join(',')}` }
  }
  return { ok: true }
}

/* ---------- not writing twice to the same business ----------

   This matters more than it looks. sales_leads has no unique constraint
   but its primary key, so promote.mjs's `on conflict do nothing` has
   nothing to conflict on: loading the same company twice makes two
   leads, and two leads means two first letters. The load step cannot
   catch this, so the puller must.

   A company number is the only identity that cannot collide, so it wins
   outright. Two records with DIFFERENT numbers are different companies
   even under the same name at the same postcode — a dissolved company
   and its successor look exactly like that. Name matching is only used
   against a record that has no number to compare. */
export function existingKeys(records) {
  const numbers = new Set()
  const namePost = new Set()
  const distinctive = new Set()
  for (const r of records || []) {
    if (!r) continue
    const num = r.company_number || String(r.subscriber_type_evidence || '').match(/Companies House\s+([A-Z0-9]{8})\b/i)?.[1]
    if (num) { numbers.add(String(num).toUpperCase()); continue }
    const key = nameKey(r.company || r.name)
    if (!key) continue
    const pc = postcodeKey(r.postcode || String(r.location || '').match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i)?.[0])
    if (pc) namePost.add(`${key}|${pc}`)
    if (isDistinctiveName(key)) distinctive.add(key)
  }
  return { numbers, namePost, distinctive }
}

export function dedupe(candidates, keys) {
  const fresh = []
  const duplicates = []
  const seenNow = new Set()
  for (const c of candidates) {
    const num = String(c.company_number || '').toUpperCase()
    if (num && (keys.numbers.has(num) || seenNow.has(num))) {
      duplicates.push({ company: c.company, company_number: num, how: seenNow.has(num) ? 'twice in this pull' : 'company number' })
      continue
    }
    const key = nameKey(c.company)
    const pc = postcodeKey(c.postcode)
    if (key && pc && keys.namePost.has(`${key}|${pc}`)) {
      duplicates.push({ company: c.company, company_number: num, how: 'name and postcode, against a record with no number' })
      continue
    }
    if (key && keys.distinctive.has(key)) {
      duplicates.push({ company: c.company, company_number: num, how: 'distinctive name, against a record with no number' })
      continue
    }
    if (num) seenNow.add(num)
    fresh.push(c)
  }
  return { fresh, duplicates }
}

/* ---------- the prospector ----------

   The half of discovery a model is actually good at: not finding that a
   business exists — the register does that, lawfully — but arguing which
   of two hundred register rows are worth a letter.

   What it is shown, and what it is not. It gets the name, what the
   register says they do, how long they have traded, the kind of company
   and the town. It does NOT get the company number, the postcode or the
   street address: none of that helps it judge, and a model never shown a
   postcode cannot write one back that looks as if it came from us. */

export const VERDICTS = Object.freeze(['strong', 'possible', 'weak', 'skip'])

export const PROSPECT_SYSTEM = `You help a small technology consultancy in Nottingham and Alcester decide which local limited companies are worth a first letter.

WHAT THE CONSULTANCY DOES. It takes a job that is costing a business time or accuracy and builds the right fix: data and analytics, AI, websites, custom software, and automation. Its clients are small businesses — usually under fifty people — whose work involves bookings, scheduling, records, quotes, stock or repeated admin.

WHAT YOU ARE GIVEN. A list of companies from the public register, each with an id, a name, what the register says they do, how many years they have traded, the kind of company, and the town.

WHAT YOU RETURN. For every id, a verdict and a one-sentence reason.
  strong   — the register activity itself describes work this consultancy fixes
  possible — plausible, but the fit depends on things the register cannot show
  weak     — little in the activity suggests the work, or the business is likely too large or too small
  skip     — no plausible fit, or clearly not an operating business

RULES.
- Judge only the ids you were given. Never add a company.
- Your reason is about the business's likely work, from what you were told. Nothing else.
- Never include an email address, phone number, website, postal address or postcode. You were not given any, and any you wrote would be invented.
- Do not guess the size of the business beyond what the register tells you.

Return only JSON: { "verdicts": [ { "id": "p1", "verdict": "possible", "reason": "..." } ] }`

const PLAIN_TYPE = { ltd: 'private limited company', llp: 'limited liability partnership', plc: 'public limited company' }

/** A batch prompt, and the map from the opaque ids back to company numbers.
    The map never leaves this process. */
export function prospectBatch(candidates, { today = new Date() } = {}) {
  const idMap = new Map()
  const lines = candidates.map((c, i) => {
    const id = `p${i + 1}`
    idMap.set(id, c.company_number)
    const years = c.incorporated ? Math.max(0, today.getUTCFullYear() - Number(String(c.incorporated).slice(0, 4))) : null
    const activity = (c.sic || []).map((s) => String(s).replace(/^\d+\s*-\s*/, '')).filter(Boolean)
    return {
      id,
      name: c.company,
      activity: activity.length ? activity : ['not stated on the register'],
      years_trading: years,
      kind: PLAIN_TYPE[c.company_type] || c.company_type || 'company',
      town: c.town || null,
    }
  })
  return {
    system: PROSPECT_SYSTEM,
    user: `COMPANIES:\n${JSON.stringify(lines, null, 1)}`,
    idMap,
  }
}

/* A reason may say anything about the work. It may not carry a way of
   reaching the business, and these are the shapes that would. The
   postcode pattern is checked against the real list of UK postcode areas,
   because a bare postcode-shaped regex also matches things like "GQ1 2AB"
   that belong to no postal district. */
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const URL_LIKE = /\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(?:co\.uk|org\.uk|com|org|net|uk|io|biz|info|co)\b/i
const PHONE = /(?:\+44\s?\(?0?\)?\s?|\b0)\d(?:[\s-]?\d){8,10}\b/
const POSTCODE = /\b([A-Z]{1,2})\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi

export function contactRouteIn(text) {
  const s = String(text ?? '')
  if (EMAIL.test(s)) return 'an email address'
  if (URL_LIKE.test(s)) return 'a web address'
  if (PHONE.test(s)) return 'a phone number'
  for (const m of s.matchAll(POSTCODE)) if (isPostcodeArea(m[1])) return 'a postcode'
  return null
}

/** The same four shapes, taken out of a text rather than refusing it.

    For what one agent says to the next, not for anything stored against a
    lead: a sentence of argument that happens to quote the page's footer
    should still reach the next agent, without the address in it. The
    record of what was actually said keeps its words; only the onward copy
    is cleaned. */
export function redactContactRoutes(text, mark = '[contact route removed]') {
  let s = String(text ?? '')
  s = s.replace(new RegExp(EMAIL.source, 'gi'), mark)
  s = s.replace(/\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:co\.uk|org\.uk|com|org|net|uk|io|biz|info|co)\b\S*/gi, mark)
  s = s.replace(new RegExp(PHONE.source, 'g'), mark)
  s = s.replace(POSTCODE, (m, area) => (isPostcodeArea(area) ? mark : m))
  return s
}

/** The model's answer, checked. What comes out is verdicts keyed by
    company number, and a list of everything refused and why.

    Anything that carries a contact route is refused whole — not
    redacted. A model that wrote an email address into a reason has
    malfunctioned in exactly the way this file exists to catch, and the
    rest of what it said about that company is not worth keeping. */
export function validateVerdicts(raw, idMap) {
  const verdicts = new Map()
  const rejected = []
  const list = Array.isArray(raw) ? raw : raw?.verdicts
  if (!Array.isArray(list)) {
    return { verdicts, rejected: [{ why: 'the answer had no verdicts list', item: null }], contactRoutes: 0, unjudged: idMap.size }
  }
  let contactRoutes = 0
  const seen = new Set()
  for (const item of list) {
    const id = typeof item?.id === 'string' ? item.id.trim() : ''
    const route = contactRouteIn(JSON.stringify(item ?? ''))
    if (route) { contactRoutes++; rejected.push({ why: `contains ${route} — a model may never supply a contact route`, item: id || null }); continue }
    if (!idMap.has(id)) { rejected.push({ why: `id "${id}" was not in the batch — the model added a company`, item: id || null }); continue }
    if (seen.has(id)) { rejected.push({ why: `id "${id}" judged twice`, item: id }); continue }
    const verdict = String(item.verdict ?? '').trim().toLowerCase()
    if (!VERDICTS.includes(verdict)) { rejected.push({ why: `verdict "${item.verdict}" is not one of ${VERDICTS.join(', ')}`, item: id }); continue }
    const reason = String(item.reason ?? '').trim()
    if (!reason) { rejected.push({ why: 'no reason given', item: id }); continue }
    if (reason.length > 300) { rejected.push({ why: 'reason longer than a sentence', item: id }); continue }
    seen.add(id)
    verdicts.set(idMap.get(id), { verdict, reason })
  }
  return { verdicts, rejected, contactRoutes, unjudged: idMap.size - verdicts.size }
}

/** Verdicts onto candidates. Only `prospect` is written, and only three
    named fields of it — whatever else a verdict object carries is ignored,
    so no field a later stage reads as a contact route (email, phone,
    website) can arrive from a model by this path. `model` may come per
    verdict, since batches can fall through to different models. */
export function applyVerdicts(candidates, verdicts, model = null) {
  return candidates.map((c) => {
    const v = verdicts.get(c.company_number)
    if (!v) return c
    return { ...c, prospect: { verdict: v.verdict, reason: v.reason, model: typeof v.model === 'string' ? v.model : model } }
  })
}

/* ---------- keys ----------

   Read from an env object passed in, so a test can hand in any env it
   likes. The discovery key is deliberately NOT allowed to fall back to
   GEMINI_API_KEY: the whole point of a second project is a second quota
   pool, and a silent fallback would spend the writer's pool on
   prospecting and stop the writer by lunchtime — exactly what happened
   on 16 September with one key. */
export function resolveKeys(env = {}, { judge = false } = {}) {
  const ch = String(env.COMPANIES_HOUSE_API_KEY || '').trim()
  const gemini = String(env.GEMINI_DISCOVERY_API_KEY || '').trim()
  const missing = []
  if (!ch) missing.push('COMPANIES_HOUSE_API_KEY')
  if (judge && !gemini) missing.push('GEMINI_DISCOVERY_API_KEY')
  return { ok: missing.length === 0, missing, ch, gemini }
}

/** Enough to recognise a key, never enough to use one. */
export function mask(v) {
  const s = String(v || '')
  if (!s) return '(not set)'
  if (s.length <= 8) return '*'.repeat(s.length)
  return s.slice(0, 4) + '*'.repeat(s.length - 8) + s.slice(-4)
}
