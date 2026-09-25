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
import { nameKey, isPostcodeArea, makeTerritoryFilter } from './lib.mjs'

/* ---------- the dials, and their stops ---------- */

export const ENVELOPE = {
  /* Most a tick will take on. It claims them one at a time and stops
     when the time is gone, so a run of parked businesses (a DNS lookup
     each, no model) moves ten times faster than a run of arguments. */
  batch_size: [1, 25],
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
  /* The highest score any service may reach on a business the register
     shows is behind on its filings. The agents still have to agree; they
     just cannot agree above this. */
  caution_ceiling: [0, 100],
  /* The highest score a service may reach when every signal it is argued
     on is true of nearly every business of its kind ("electricians issue
     test certificates"). scoring.md: evidence resting on sector, 30 at
     most. The first Notts run scored two businesses 60 and 70 on exactly
     that. */
  sector_ceiling: [0, 100],
  /* The research loop: tool calls allowed per business, and seconds. */
  lookup_max_steps: [3, 20],
  lookup_seconds: [60, 300],
}

export const STAGES = ['research', 'signals', 'sales', 'specialists']

export function clampSettings(raw) {
  const out = {}
  for (const [key, [lo, hi]] of Object.entries(ENVELOPE)) {
    const n = Number(raw?.[key])
    out[key] = Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : lo
  }
  if (!Number.isFinite(Number(raw?.caution_ceiling)) || raw?.caution_ceiling === null) out.caution_ceiling = 35
  if (!Number.isFinite(Number(raw?.sector_ceiling)) || raw?.sector_ceiling === null) out.sector_ceiling = 30
  const reserve = raw?.stage_reserve_ms && typeof raw.stage_reserve_ms === 'object' ? raw.stage_reserve_ms : {}
  out.stage_reserve_ms = {}
  for (const s of STAGES) {
    const n = Number(reserve[s])
    out.stage_reserve_ms[s] = Number.isFinite(n) ? Math.min(out.tick_budget_ms, Math.max(5000, n)) : 30000
  }
  /* A business with no website we can find is parked before any model is
     asked about it, unless this is switched off. Off means the agents
     argue from the register alone, which the first live test showed is
     mostly argument about nothing. */
  out.require_website = raw?.require_website !== false
  /* A business with no site found goes to the research loop, which spends
     its own project's key (GEMINI_RESEARCH_API_KEY), unless switched off. */
  out.lookup_enabled = raw?.lookup_enabled !== false
  if (!Number.isFinite(Number(raw?.lookup_max_steps)) || raw?.lookup_max_steps === null) out.lookup_max_steps = 8
  if (!Number.isFinite(Number(raw?.lookup_seconds)) || raw?.lookup_seconds === null) out.lookup_seconds = 150
  /* Postcode areas or districts a pulled company's registered office must
     be in (NG, B49...). The advanced search matches town names as text,
     and "Beeston" is in Leeds as well as Nottingham. Empty means no check. */
  out.territory_areas = (Array.isArray(raw?.territory_areas) ? raw.territory_areas : [])
    .map((a) => String(a ?? '').trim().toUpperCase()).filter((a) => /^[A-Z]{1,2}(\d{1,2}[A-Z]?)?$/.test(a))
  /* The services n.abl leads with (the owner, 24 September: "AI and web
     above all else"). Listed first to every agent, and sales is told to
     bring their specialists in whenever a signal points there. It never
     lets a service be pitched on a signal that does not point to it. */
  const focus = Array.isArray(raw?.service_focus) ? raw.service_focus : ['ai', 'web']
  out.service_focus = [...new Set(focus.map((k) => String(k ?? '').trim()).filter((k) => /^[a-z_]{2,30}$/.test(k)))].slice(0, 3)
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

/* Words that say what a business does rather than who it is. In a name,
   whatever comes before the first of them is the part people shorten:
   "PURPLE GIRAFFE JOINERY" trades as pgjoinery, "PFS FIRE & SECURITY" as
   pfs-security. And a page that shares a business's postcode and one of
   these words has not named it: on 25 September "mechanical" put an
   air-conditioning firm's site on D L Mechanical, and "security
   installations" a sister company's on Phoenix Security Installations. */
export const TRADE_WORDS = new Set([
  'ELECTRICAL', 'ELECTRICS', 'ELECTRIC', 'ELECTRICIANS', 'PLUMBING', 'PLUMBERS', 'HEATING', 'GAS', 'BOILERS', 'JOINERY',
  'JOINERS', 'CARPENTRY', 'ROOFING', 'SCAFFOLDING', 'FLOORING', 'FLOORS', 'CARPETS', 'BUILDING', 'BUILDERS', 'BUILD',
  'CONSTRUCTION', 'SECURITY', 'FIRE', 'ALARMS', 'ALARM', 'SURVEILLANCE', 'CCTV', 'INSTALLATIONS', 'INSTALLATION', 'INSTALL',
  'INSTALLERS', 'CONTRACTING', 'CONTRACTORS', 'CONTRACTS', 'ENGINEERING', 'ENGINEERS', 'MECHANICAL', 'KITCHENS', 'KITCHEN',
  'BATHROOMS', 'BRICKWORK', 'PLASTERING', 'DECORATING', 'PAINTING', 'TILING', 'GLAZING', 'WINDOWS', 'WINDOW', 'DOORS',
  'INTERIORS', 'DRIVEWAYS', 'LANDSCAPES', 'LANDSCAPING', 'FENCING', 'DRAINAGE', 'GROUNDWORKS', 'DEMOLITION', 'INSULATION',
  'AIR', 'CONDITIONING', 'VENTILATING', 'VENTILATION', 'REFRIGERATION', 'COOLING', 'SOLAR', 'RENEWABLES', 'ENERGY', 'POWER',
  'LIFTS', 'RAIL', 'NETWORK', 'NETWORKS', 'SURVEYING', 'SURVEYORS', 'CLEANING', 'MAINTENANCE', 'FACILITIES',
  'ENVIRONMENTAL', 'SYSTEMS', 'SOLUTIONS', 'SERVICES', 'PROJECTS', 'TECHNOLOGIES', 'INSPECTIONS', 'TESTING',
])

/* Words too common to be a business's whole domain on their own. */
const GENERIC = new Set([
  'NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL', 'NATIONAL', 'GLOBAL', 'INTERNATIONAL', 'BRITISH', 'ENGLISH',
  'BUILDING', 'BUILDERS', 'CONSTRUCTION', 'PROPERTY', 'PROPERTIES', 'HOMES', 'DESIGN', 'DESIGNS', 'SOLUTIONS',
  'SYSTEMS', 'TECHNOLOGY', 'TECHNOLOGIES', 'CONSULTING', 'CONSULTANCY', 'MANAGEMENT', 'ENTERPRISES', 'TRADING',
  'VENTURES', 'INVESTMENTS', 'CAPITAL', 'PARTNERS', 'ASSOCIATES', 'CONTRACTORS', 'ENGINEERING', 'ELECTRICAL',
  'PLUMBING', 'HEATING', 'CLEANING', 'MOTORS', 'CARE', 'HEALTH', 'TRAVEL', 'FOOD', 'TAKEAWAY', 'CAFE', 'BAR',
  'STUDIO', 'MEDIA', 'MARKETING', 'LOGISTICS', 'TRANSPORT', 'SUPPLIES', 'PRODUCTS', 'DIGITAL', 'CREATIVE',
  'ELECTRO', 'ELECTRIC', 'ELECTRICS', 'TECHNICAL', 'GENERAL', 'PREMIER', 'ELITE', 'QUALITY', 'SMART', 'EXPRESS',
  'CITY', 'COUNTY', 'ROYAL', 'FIRST', 'PRIME', 'SUPREME', 'ULTIMATE', 'TOTAL', 'UNITED', 'ADVANCED', 'MODERN',
  'MIDLANDS', 'MIDLAND', 'EASTMIDLANDS', 'NOTTS', 'NOTTINGHAM', 'DERBY', 'DERBYSHIRE', 'LEICESTER', 'BIRMINGHAM',
  'WARWICKSHIRE', 'WORCESTERSHIRE', 'COTSWOLD', 'COTSWOLDS', 'TRENT', 'SHERWOOD', 'HEART', 'ENGLAND',
])

/* Places a name carries that say where, not who. */
const PLACES = new Set([
  'NOTTM', 'NOTTS', 'ILKESTON', 'BEESTON', 'ARNOLD', 'CARLTON', 'HUCKNALL', 'MANSFIELD', 'NEWARK', 'BULWELL', 'WOLLATON',
  'RUDDINGTON', 'BINGHAM', 'COTGRAVE', 'EASTWOOD', 'KIMBERLEY', 'STAPLEFORD', 'LONG', 'EATON', 'RUSHCLIFFE', 'GEDLING',
  'BROXTOWE', 'EREWASH', 'ALCESTER', 'STRATFORD', 'REDDITCH', 'STUDLEY', 'EVESHAM', 'WARWICK', 'VALLEY',
])

/* Last words a business's own domain often leaves off. */
const TAIL = new Set([
  'SOLUTIONS', 'CONTRACTORS', 'CONTRACTING', 'SYSTEMS', 'ENTERPRISES', 'TRADING', 'SPECIALISTS', 'INSTALLATIONS',
  'COMPANY', 'CO', 'SUPPLIES', 'TECHNOLOGIES', 'INDUSTRIES', 'LTD', 'LIMITED',
])

/** Domains a small UK business is likely to have, from its registered
    name (and town, when given). Guesses only: each has to resolve, load,
    and then prove it is theirs by naming them. More guesses than a person
    would try, because the first live test parked two businesses in three
    as "no website" on six guesses each. */
export function domainGuesses(name, town = null) {
  const key = nameKey(name)
  const all = key.split(' ').filter(Boolean)
  const words = all.filter((w) => !NOISE.has(w))
  if (!words.length) return []
  const low = (ws, sep = '') => ws.join(sep).toLowerCase().replace(sep ? /[^a-z0-9-]/g : /[^a-z0-9]/g, '')
  const joined = low(words)
  const hyphen = low(words, '-')
  const short = low(words.slice(0, 2))
  const ok = (x) => x.length >= 4 && x.length <= 63 && !/^-|-$/.test(x)
  const main = [joined, hyphen, short]
  /* "M & H NETWORK & CABLING" is as likely to be mandhnetworkcabling as
     mhnetworkcabling. */
  const initials = all.filter((w, i) => w !== 'AND' || (all[i - 1]?.length === 1 && all[i + 1]?.length === 1))
    .filter((w) => !NOISE.has(w) || w === 'AND')
  if (initials.length !== words.length) main.push(low(initials))
  /* "BW PLUMBING & HEATING SOLUTIONS" trades as bwplumbingandheating: the
     live Notts run parked it on bwplumbing.com while that domain was there.
     So the "and" is kept, and a generic last word is dropped. */
  const withAnd = all.filter((w) => !NOISE.has(w) || w === 'AND')
  const tail = (ws) => {
    const out = [...ws]
    while (out.filter((w) => w !== 'AND').length > 2 && TAIL.has(out[out.length - 1])) out.pop()
    while (out[out.length - 1] === 'AND') out.pop()
    return out
  }
  main.splice(1, 0, low(withAnd), low(tail(withAnd)), low(tail(words)))
  const extra = [`${joined}ltd`]
  const t = String(town ?? '').toLowerCase().replace(/[^a-z]/g, '')
  /* The first word alone, or with the town, only when it is distinctive:
     not generic, and not the town itself (alcester.co.uk is the town's). */
  const first = low([words[0]])
  const distinctive = !GENERIC.has(words[0]) && first !== t
  if (distinctive && first.length >= 6) extra.push(first)
  if (distinctive && t.length >= 3 && first.length >= 4) extra.push(`${first}${t}`)
  /* Most likely first, and .uk last: the cap cuts from the end. */
  const stems = [...new Set([...main, ...extra])].filter(ok)
  const out = []
  for (const tld of ['co.uk', 'com']) for (const stem of stems) out.push(`${stem}.${tld}`)
  for (const stem of [...new Set(main)].filter(ok)) out.push(`${stem}.uk`)
  return [...new Set(out)].slice(0, 24)
}

/** How to ask for a host's front page: the bare domain over HTTPS, then
    www, then plain HTTP on www - a sole trader's site from 2012 is often
    only the last. */
export function frontPageUrls(host) {
  const h = String(host ?? '').replace(/^www\./, '')
  return [`https://${h}/`, `https://www.${h}/`, `http://www.${h}/`]
}

/** What the agents are told when no site was found. Never "none": the
    finder only guesses, and not finding a guess is not knowing. */
export function noSiteLine(outcome) {
  return `WEBSITE: not found by guessing its domain (${outcome}). That is not the same as having none: it may have a site we did not guess, or trade through a directory or app.`
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
/* Postcode areas that border each other, around the two territories. A
   registered office is often an accountant's in the next town: on 25
   September South Notts (Builders) was registered in DE and its own site
   gave only NG addresses, and code threw it out as a namesake before the
   checker, who is told a neighbouring town is normal, ever saw it. Only
   where a checker reads the page next (the research loop, `near`): the
   guesser has no checker, and takes a name match that nothing
   contradicts, so for it the page still has to share the area. */
const BORDERS = [
  ['NG', 'DE'], ['NG', 'LE'], ['NG', 'LN'], ['NG', 'DN'], ['NG', 'S'],
  ['DE', 'LE'], ['DE', 'ST'], ['DE', 'S'], ['DE', 'SK'], ['DE', 'B'], ['DE', 'WS'],
  ['LE', 'CV'], ['LE', 'NN'], ['LE', 'PE'], ['LE', 'LN'], ['LE', 'B'],
  ['B', 'CV'], ['B', 'WS'], ['B', 'WV'], ['B', 'DY'], ['B', 'WR'],
  ['CV', 'WR'], ['CV', 'NN'], ['CV', 'OX'], ['CV', 'GL'],
  ['WR', 'GL'], ['WR', 'DY'], ['WR', 'HR'], ['GL', 'OX'], ['GL', 'HR'],
]
const nextTo = (a, b) => a === b || BORDERS.some(([x, y]) => (x === a && y === b) || (x === b && y === a))

export function contradicts(html, candidate, { near = false } = {}) {
  const ours = areaOf(candidate.postcode)
  if (!ours) return null
  const onPage = [...String(html).toUpperCase().matchAll(PAGE_POSTCODE)]
    .map((m) => areaOf(m[1])).filter(isPostcodeArea)
  if (onPage.length && !onPage.some((a) => (near ? nextTo(a, ours) : a === ours))) {
    return `the page's addresses are all in ${[...new Set(onPage)].slice(0, 3).join('/')}, not ${ours}`
  }
  const uk = /(\+44|\b0[12378]\d{8,9}\b|\b0\d{4}\s?\d{6}\b)/.test(html)
  const northAmerican = /\b(?:\+1[\s-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/.test(html)
  if (northAmerican && !uk) return 'the only phone numbers on the page are North American'
  return null
}

/* The name a business trades under is often its registered name with the
   end left off: NDL Electrical Installations Ltd is "NDL Electrical" on
   its own site (25 September), Carters Flooring (Leisure) Ltd is "Carters
   Flooring". The registered name with trailing trade and filler words
   taken off, two words at least, one of them saying who they are - a match
   is only ever the name, and the checker still has to agree. */
export function tradingName(name, town = null) {
  const full = squash(nameKey(name))
  const bare = String(name ?? '').replace(/\([^)]*\)/g, ' ')
  const trimmed = nameKey(bare).split(' ').filter(Boolean)
  const filler = (w) => TRADE_WORDS.has(w) || GENERIC.has(w) || NOISE.has(w)
  while (trimmed.filter((w) => w !== 'AND').length > 2 && filler(trimmed[trimmed.length - 1])) trimmed.pop()
  while (trimmed[trimmed.length - 1] === 'AND') trimmed.pop()
  const core = trimmed.filter((w) => w !== 'AND')
  const townWords = new Set(nameKey(town ?? '').split(' '))
  if (core.length < 2) return []
  if (!core.some((w) => !GENERIC.has(w) && !TRADE_WORDS.has(w) && !PLACES.has(w) && !townWords.has(w))) return []
  return [...new Set([squash(trimmed.join('')), squash(core.join(''))])].filter((f) => f.length >= 6 && f !== full)
}

export function confirms(html, candidate, { near = false } = {}) {
  const page = squash(html)
  const strong = []
  const weak = []
  const key = nameKey(candidate.company_name)
  const words = key.split(' ').filter((w) => w.length > 3 && !NOISE.has(w))
  if (candidate.postcode && squash(candidate.postcode).length >= 5 && page.includes(squash(candidate.postcode))) strong.push('postcode')
  if (candidate.company_number && page.includes(squash(candidate.company_number))) strong.push('company number')
  const trading = tradingName(candidate.company_name, candidate.town)
  if (key.length >= 6 && page.includes(squash(key))) weak.push('company name')
  else if (words.length >= 2 && words.every((w) => page.includes(squash(w)))) weak.push('every word of the name')
  else if (trading.some((t) => page.includes(t))) weak.push('their trading name')
  if (strong.includes('company number')) return { reasons: [...strong, ...weak] }
  /* The registered postcode alone is not proof: it is often an
     accountant's office or a shared building, and every business there
     carries it. On 24 September the loop took an IT firm's site for an
     electrical contractor registered in the same Long Eaton building. The
     postcode counts with the name, or the part of it that says who they
     are: a word that is not a trade or a place, five letters or more (a
     shorter one turns up inside other words), or the words before the
     trade, together. */
  if (strong.length) {
    const town = new Set(nameKey(candidate.town ?? '').split(' '))
    const says = (w) => !GENERIC.has(w) && !TRADE_WORDS.has(w) && !PLACES.has(w) && !town.has(w)
    /* The words before the first trade or generic one, as a phrase:
       "Park Valley" of Park Valley Management, "JM Dale" of J M Dale
       Plumbing. */
    const all = key.split(' ').filter((w) => w && !NOISE.has(w))
    const cut = all.findIndex((w, i) => i > 0 && (TRADE_WORDS.has(w) || GENERIC.has(w)))
    const head = cut > 0 ? all.slice(0, cut) : all
    const phrase = head.join('')
    const partial = words.some((w) => w.length >= 5 && says(w) && page.includes(squash(w)))
      || (phrase.length >= 6 && head.some(says) && page.includes(squash(phrase)))
    if (weak.length || partial) return { reasons: [...strong, ...(weak.length ? weak : ['part of the name'])] }
    return { reasons: [], sharedAddress: true }
  }
  if (!weak.length) return { reasons: [] }
  const conflict = contradicts(html, candidate, { near })
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

/** The contact page, found only to be measured. Its text is never given
    to an agent: it is where the routes are. */
export function contactPageLink(html, baseUrl) {
  let base
  try { base = new URL(baseUrl) } catch { return null }
  for (const m of String(html ?? '').matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["']/gi)) {
    let u
    try { u = new URL(m[1], base) } catch { continue }
    if (u.host !== base.host || !/^https?:$/.test(u.protocol)) continue
    if (/\/(contact|contact-us|contactus|get-in-touch|enquiries|enquire|enquiry)(\/|$|\.html?$|\.php$)/i.test(u.pathname)) {
      u.search = ''
      return u.toString()
    }
  }
  return null
}

/* ---------- measured on their site, by code ----------

   Most of the tier 2 signals in the ICP (section 5) are in what the
   agents never see. The email address is removed before any agent reads a
   page, and a link to a PDF booking form is just its words once the
   markup is stripped. So code measures them first, from the raw pages,
   and gives the agents lines they cite by key, as they cite the register.
   Each line says what was measured and where. None carries a contact
   route, and a line that somehow would is dropped. */

const WEBMAIL = [
  [/@(?:gmail|googlemail)\.com\b/i, 'Gmail'], [/@(?:hotmail|outlook|live|msn)\.(?:com|co\.uk)\b/i, 'Hotmail or Outlook'],
  [/@(?:yahoo|ymail)\.(?:com|co\.uk)\b/i, 'Yahoo'], [/@btinternet\.com\b/i, 'BT Internet'], [/@btconnect\.com\b/i, 'BT Connect'],
  [/@aol\.(?:com|co\.uk)\b/i, 'AOL'], [/@(?:icloud|me|mac)\.com\b/i, 'iCloud'], [/@sky\.com\b/i, 'Sky'],
  [/@talktalk\.net\b/i, 'TalkTalk'], [/@(?:virginmedia|ntlworld|blueyonder)\.(?:com|co\.uk)\b/i, 'Virgin Media'],
  [/@(?:plus|tiscali)\.(?:net|co\.uk)\b/i, 'an internet provider'],
]
const ROLE_LOCALS = new Set(['info', 'sales', 'accounts', 'admin', 'office', 'enquiries', 'enquiry', 'bookings', 'booking',
  'service', 'support', 'hello', 'contact', 'orders', 'jobs', 'careers', 'quotes', 'estimates', 'hr', 'reception', 'lettings'])

/* Written as their makers write them; none may look like a web address,
   or the contact-route check would rightly drop the line. */
const TOOLS = [
  ['booking', 'Calendly', /calendly\.com/i], ['booking', 'Acuity', /acuityscheduling\.com/i],
  ['booking', 'SimplyBook', /simplybook\.(?:me|it|net)/i], ['booking', 'Setmore', /setmore\.com/i],
  ['booking', 'Fresha', /fresha\.com/i], ['booking', 'Bookwhen', /bookwhen\.com/i], ['booking', 'Checkfront', /checkfront\.com/i],
  ['booking', 'ResDiary', /resdiary\.com/i], ['booking', 'OpenTable', /opentable\.(?:com|co\.uk)/i],
  ['booking', 'YouCanBookMe', /youcanbook\.me/i], ['booking', 'Timely', /gettimely\.com/i], ['booking', 'Square Appointments', /squareup\.com\/appointments|square\.site/i],
  ['forms', 'Jotform', /jotform\.com/i], ['forms', 'Typeform', /typeform\.com/i], ['forms', 'Google Forms', /docs\.google\.com\/forms|forms\.gle/i],
  ['forms', 'Formstack', /formstack\.com/i], ['forms', 'Cognito Forms', /cognitoforms\.com/i], ['forms', 'Microsoft Forms', /forms\.office\.com/i],
  ['payments', 'Stripe', /js\.stripe\.com|buy\.stripe\.com|checkout\.stripe\.com/i], ['payments', 'PayPal', /paypal\.com|paypalobjects\.com/i],
  ['payments', 'SumUp', /sumup\.(?:com|co\.uk)/i], ['payments', 'GoCardless', /gocardless\.com/i],
  ['shop', 'Shopify', /cdn\.shopify\.com|myshopify\.com/i], ['shop', 'WooCommerce', /woocommerce/i],
  ['site builder', 'Wix', /wixstatic\.com|static\.parastorage\.com/i], ['site builder', 'Squarespace', /squarespace(?:-cdn)?\.com/i],
  ['site builder', 'WordPress', /\/wp-content\/|\/wp-includes\//i], ['site builder', 'GoDaddy', /img1\.wsimg\.com/i],
  ['site builder', 'Weebly', /weebly\.com/i], ['site builder', 'Webflow', /webflow\.(?:com|io)/i], ['site builder', 'Jimdo', /jimdo/i],
  ['chat or CRM', 'Tawk', /tawk\.to/i], ['chat or CRM', 'Intercom', /widget\.intercom\.io|js\.intercomcdn\.com/i],
  ['chat or CRM', 'LiveChat', /livechatinc\.com/i], ['chat or CRM', 'HubSpot', /js\.hs-scripts\.com|js\.hsforms\.net/i],
  ['chat or CRM', 'Tidio', /tidio\.co/i], ['chat or CRM', 'Zendesk', /zdassets\.com|zendesk\.com/i],
  ['job management', 'ServiceM8', /servicem8\.com/i], ['job management', 'Tradify', /tradifyhq\.com/i],
  ['job management', 'simPRO', /simprogroup\.com|simprosuite\.com/i], ['job management', 'Commusoft', /commusoft\.(?:com|co\.uk)/i],
  ['job management', 'Joblogic', /joblogic\.com/i], ['job management', 'Jobber', /getjobber\.com/i],
  ['job management', 'BigChange', /bigchange\.com/i], ['job management', 'Fergus', /fergus\.com/i],
]
const TRADE = [
  ['NICEIC', /\bniceic\b/i], ['NAPIT', /\bnapit\b/i], ['Gas Safe Register', /gas\s*safe|gassaferegister/i],
  ['TrustMark', /\btrustmark\b/i], ['Checkatrade', /checkatrade/i], ['TrustATrader', /trustatrader/i],
  ['Rated People', /ratedpeople/i], ['MyBuilder', /\bmybuilder\b/i], ['Trustpilot', /trustpilot/i],
  ['Federation of Master Builders', /fmb\.org\.uk|federation of master builders/i],
  ['Which? Trusted Traders', /trustedtraders|which\?\s*trusted trader/i], ['SafeContractor', /safecontractor/i],
  ['CHAS', /\bchas\.co\.uk\b|\bchas accredited\b/i], ['Constructionline', /constructionline/i], ['ECA', /\beca\.co\.uk\b/i],
  ['OFTEC', /\boftec\b/i], ['HETAS', /\bhetas\b/i], ['FENSA', /\bfensa\b/i], ['ARLA Propertymark', /propertymark|\barla\b/i],
]
const DOC = /<a\b[^>]*\bhref\s*=\s*["']([^"']+\.(pdf|docx?|xlsx?))(?:[?#][^"']*)?["'][^>]*>([\s\S]*?)<\/a>/gi
const DOC_KIND = { pdf: 'PDF', doc: 'Word', docx: 'Word', xls: 'Excel', xlsx: 'Excel' }
const TO_FILL = /\b(form|application|apply|booking|order|request|enquiry|registration|credit account|account opening|instruction|questionnaire|checklist|job sheet|timesheet)s?\b/i
const PRICE_DOC = /\b(price|prices|pricing|price ?list|tariff|rates|rate card)s?\b/i
const CAREERS = /\b(careers|vacancies|current vacancies|job opportunities|we'?re hiring|join (?:our|the) team|work (?:for|with) us)\b/i

const plainWords = (s) => stripHtml(s).replace(/\s+/g, ' ').trim()

/** Lines measured on a business's own pages. `pages` is [{ url, html, contact }],
    raw HTML, the contact page (if read) marked. Keys start m_. */
export function siteLines(pages, { today = new Date(), archived = false } = {}) {
  const list = (Array.isArray(pages) ? pages : []).filter((p) => p && typeof p.html === 'string')
  if (!list.length) return []
  const lines = []
  const add = (key, text) => { if (text && !contactRouteIn(text)) lines.push({ key, text }) }
  const all = list.map((p) => p.html).join('\n')

  /* How a customer reaches them. */
  const emails = [...new Set([...all.matchAll(/(?:mailto:)?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi)].map((m) => m[1].toLowerCase()))]
    .filter((e) => !/\.(png|jpe?g|gif|webp|svg)$/.test(e) && !/@(?:sentry|example|domain|email)\./.test(e))
  const webmail = [...new Set(emails.map((e) => WEBMAIL.find(([re]) => re.test(e))?.[1]).filter(Boolean))]
  if (webmail.length) {
    add('m_webmail', `The email address the site gives is on a free webmail service (${webmail.join(', ')}), not a domain of the business's own`)
  }
  const roles = [...new Set(emails.map((e) => e.split('@')[0]).filter((l) => ROLE_LOCALS.has(l)))]
  if (roles.length >= 3) add('m_roles', `The site gives ${roles.length} different role email addresses (${roles.slice(0, 5).map((r) => `${r}@`).join(', ')})`)

  const contact = list.find((p) => p.contact)
  const formIn = (html) => /<form\b[\s\S]*?(<textarea\b|type\s*=\s*["']?email)[\s\S]*?<\/form>/i.test(html)
  /* "No form" is only said of a page code can see whole: not one a
     builder draws in the browser, or with a frame that may hold a form. */
  const drawn = (html) => /<iframe\b/i.test(html) || /wixstatic\.com|static\.parastorage\.com|squarespace|webflow/i.test(html)
    || plainWords(html.replace(/<script[\s\S]*?<\/script>/gi, ' ')).length < 400
  if (contact) {
    const mailto = /href\s*=\s*["']mailto:/i.test(contact.html)
    const hosted = TOOLS.filter(([kind, , re]) => kind === 'forms' && re.test(contact.html)).map(([, name]) => name)
    if (formIn(contact.html) || hosted.length) add('m_contact', `Their contact page has an enquiry form${hosted.length ? ` (from ${hosted.join(', ')})` : ''}`)
    else if (drawn(contact.html)) { /* cannot tell */ }
    else if (mailto) add('m_contact', 'Their contact page gives an email link and has no enquiry form')
    else add('m_contact', 'Their contact page has no enquiry form and no email link')
  }

  /* How old the site is. A year the page's own script writes is not in
     the HTML, so a missing line means nothing. */
  const bare = all.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ')
  const years = [...bare.matchAll(/(?:©|&copy;|&#169;|&#xa9;|\(c\)|copyright)\s*(?:&nbsp;|\s)*(?:(?:19|20)\d{2}\s*(?:[-–—]|&ndash;|&#8211;|to)\s*)?((?:19|20)\d{2})/gi)]
    .map((m) => Number(m[1])).filter((y) => y >= 1995 && y <= today.getUTCFullYear())
  if (years.length) {
    const y = Math.max(...years)
    const ago = today.getUTCFullYear() - y
    if (ago >= 2) add('m_copyright', `The copyright line on the site says ${y}, ${ago} years ago`)
  }

  /* Documents to download: forms to fill in and send back, and price
     lists (ICP tier 1, both). */
  const forms = []
  const prices = []
  for (const p of list) {
    for (const m of p.html.matchAll(DOC)) {
      const file = decodeURIComponent(m[1].split('/').pop() || '').replace(/\.[a-z]+$/i, '').replace(/[-_+]+/g, ' ').trim()
      let label = plainWords(m[3])
      if (label.length < 4 || /^(click here|here|download|view|read more|pdf|open)$/i.test(label)) label = file
      label = label.slice(0, 70)
      if (!label || contactRouteIn(label)) continue
      const kind = DOC_KIND[m[2].toLowerCase()]
      const hay = `${label} ${file}`
      const item = `${label}" (${kind}`
      if (PRICE_DOC.test(hay)) prices.push(item)
      else if (TO_FILL.test(hay)) forms.push(item)
    }
  }
  const docs = (xs) => [...new Set(xs)].slice(0, 3).map((x) => `"${x})`).join(', ')
  if (forms.length) add('m_forms', `The site links to ${[...new Set(forms)].length === 1 ? 'a document' : 'documents'} to download, fill in and send back: ${docs(forms)}`)
  if (prices.length) add('m_prices', `The site links to a price list as a document: ${docs(prices)}`)

  /* Other companies' products in the pages' code. Two that plainly do not
     talk to each other is tier 1; a booking or payment product already in
     use argues against web. */
  const found = new Map()
  for (const [kind, name, re] of TOOLS) if (re.test(all)) found.set(kind, [...(found.get(kind) ?? []), name])
  if (found.size) add('m_tools', `Other companies' products in the site's code: ${[...found].map(([k, ns]) => `${ns.join(', ')} (${k})`).join('; ')}`)
  const trade = TRADE.filter(([, re]) => re.test(bare) || re.test(all)).map(([n]) => n)
  if (trade.length) add('m_trade', `Trade bodies, schemes or review sites the site shows or links to: ${trade.slice(0, 6).join(', ')}`)

  const careers = [...all.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => plainWords(m[1])).find((t) => t.length < 40 && CAREERS.test(t))
  if (careers) add('m_jobs', `The site has a link to jobs or careers ("${careers}")`)

  /* The site itself, as a customer meets it: on a phone, in a browser
     that warns, built with what and how long ago. Web signals about this
     business's own site, not its sector. The front page is the first one
     given. An archived copy is how the site was, not how it is, so none of
     this is said of one. */
  const home = list[0]
  if (!archived && home) {
    if (!/<meta\b[^>]*\bname\s*=\s*["']?viewport/i.test(home.html) && plainWords(home.html).length >= 50) {
      add('m_mobile', 'The front page has no viewport tag, so a phone shows it as a shrunken desktop page')
    }
    if (/^http:\/\//i.test(String(home.url ?? ''))) add('m_https', 'The site answered only over plain HTTP, which browsers mark "Not secure"')
    const built = BUILDERS.filter(([, re]) => re.test(all)).map(([n]) => n)
    const gen = generatorOf(all)
    const stale = gen && staleGenerator(gen)
    if (stale) add('m_stale', `The site's generator tag says ${gen}: ${stale}`)
    else if (built.length) add('m_builder', `The site is built with ${built.slice(0, 2).join(' and ')}`)
    if (/<frameset\b|\.swf["'?]|<font\b[^>]*\bface\s*=|<marquee\b/i.test(all)) {
      add('m_oldhtml', 'The site uses web techniques from before phones browsed the web (frames, Flash or font tags)')
    }
  }

  /* The same written questions again and again (AI's signal, and the
     knowledge pack's): questions set as headings or FAQ toggles. */
  const questions = new Set([...all.matchAll(/<(h[2-6]|summary|dt|button|strong)\b[^>]*>([^<]{12,160}\?)\s*<\/\1>/gi)]
    .map((m) => plainWords(m[2]).toLowerCase()))
  if (questions.size >= 6) add('m_faq', `The site answers ${questions.size} common questions in writing (an FAQ)`)

  return lines
}

/* Site builders and platforms, by what they leave in a page's code. */
const BUILDERS = [
  ['Wix (a do-it-yourself site builder)', /static\.wixstatic\.com|static\.parastorage\.com/i],
  ['Squarespace (a do-it-yourself site builder)', /static1\.squarespace\.com|squarespace-cdn\.com/i],
  ["GoDaddy's website builder", /img1\.wsimg\.com|Go Daddy Website Builder/i],
  ['Weebly (a do-it-yourself site builder)', /editmysite\.com|weebly\.com\/uploads/i],
  ['Jimdo (a do-it-yourself site builder)', /jimdo(?:cdn|free)?\.com/i],
  ['Duda (the builder behind many sites sold with directory listings)', /irp\.cdn-website\.com|multiscreensite\.com/i],
  ['Mr Site (a do-it-yourself site builder)', /mrsite\.com/i],
  ['Shopify (an online shop platform)', /cdn\.shopify\.com/i],
  ['WordPress', /\/wp-content\/|\/wp-includes\//i],
]

/** The page's own generator tag, when it names one. */
export function generatorOf(html) {
  const s = String(html ?? '')
  const m = s.match(/<meta\b[^>]*\bname\s*=\s*["']generator["'][^>]*\bcontent\s*=\s*["']([^"']{2,80})["']/i)
    || s.match(/<meta\b[^>]*\bcontent\s*=\s*["']([^"']{2,80})["'][^>]*\bname\s*=\s*["']generator["']/i)
  return m ? m[1].trim() : null
}

/** Why a generator is out of date, or null. Only versions long out of
    support are named: a site on them has not been looked after. */
export function staleGenerator(gen) {
  const g = String(gen ?? '')
  let m
  if ((m = g.match(/^WordPress\s+(\d+)\.(\d+)/i)) && Number(m[1]) < 5) return `a version of WordPress from before 2018, no longer updated`
  if ((m = g.match(/^Joomla!?\s+(\d+)(?:\.(\d+))?/i)) && Number(m[1]) < 4) return `a version of Joomla out of support since 2023 or earlier`
  if ((m = g.match(/^Drupal\s+(\d+)/i)) && Number(m[1]) < 8) return `a version of Drupal out of support since January 2025 or earlier`
  if (/Microsoft FrontPage|Adobe Dreamweaver|iWeb|NetObjects/i.test(g)) return 'a desktop web editor from the 2000s'
  return null
}

/** Where a business actually trades, when its own pages say. The
    territory is checked at the pull against the registered office, which
    is often an accountant's; a site whose every address is elsewhere
    (a Nottingham-registered firm trading from Wakefield) is out of area.
    No postcode on the pages, or any one inside, and it stays in. */
export function tradesOutside(htmls, areas) {
  if (!Array.isArray(areas) || !areas.length) return null
  const inside = makeTerritoryFilter(areas)
  const found = []
  for (const html of Array.isArray(htmls) ? htmls : []) {
    const text = String(html ?? '').replace(/<[^>]+>/g, ' ').toUpperCase()
    for (const m of text.matchAll(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s?(\d[A-Z]{2})\b/g)) {
      if (isPostcodeArea(m[1].match(/^[A-Z]+/)[0])) found.push(`${m[1]} ${m[2]}`)
    }
  }
  if (!found.length || found.some((pc) => inside(pc))) return null
  return [...new Set(found.map((pc) => pc.split(' ')[0]))].slice(0, 4)
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
  'audited-abridged': 'abridged small company accounts, audited',
  'filing-exemption-subsidiary': 'no accounts filed: exempt as a subsidiary, so part of a group',
  'partial-exemption': 'partially exempt accounts',
  initial: 'initial accounts (a newly formed company)',
  interim: 'interim accounts',
  'no-accounts-type-available': null,
}

export function registerLines(c, { profile = null, officers = null, accounts = null, filings = null, psc = null, today = new Date() } = {}) {
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
  if (acc?.type && acc.type !== 'null' && ACCOUNTS[acc.type] !== null) {
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

  /* Read from the filed accounts and filing history, not the profile. The
     first is the only headcount the register has; the ICP asks for its
     people "from their own words", and a filed average is that. */
  if (accounts?.employees !== null && accounts?.employees !== undefined) {
    add('r_employees', `Its filed accounts give an average of ${accounts.employees} employee${accounts.employees === 1 ? '' : 's'}` +
      `${accounts.period_end ? ` in the year to ${accounts.period_end}` : ''}` +
      `${accounts.prior !== null && accounts.prior !== undefined ? ` (${accounts.prior} the year before)` : ''}`)
  }
  if (accounts?.turnover) add('r_turnover', `Its filed accounts give turnover of £${accounts.turnover.toLocaleString('en-GB')}`)
  if (filings && filings.of >= 2 && filings.late >= 2) {
    add('r_late_filings', `Filed its accounts after the deadline ${filings.late} of the last ${filings.of} times. A timing note from the ICP, never a need, and never mentioned to them`)
  }
  const parents = controllingCompanies(psc)
  if (parents.length) add('r_parent', `Controlled by ${parents.length === 1 ? 'another company' : 'other companies'} (${parents.slice(0, 2).join(', ')}), so part of a group; the decision may sit there`)
  const before = (Array.isArray(profile?.previous_company_names) ? profile.previous_company_names : [])
    .map((p) => String(p?.name ?? '').trim()).filter(Boolean)
  if (before.length) add('r_previous_names', `Previously registered as ${before.slice(0, 3).join('; ')}`)
  return lines
}

/* ---------- what the filings say ----------

   The latest accounts, if filed as inline XBRL (most are since 2016), carry
   tagged numbers. Only two are wanted: the average number of employees,
   which even micro-entity accounts must state, and turnover when a
   company chose to file it. Each value belongs to a context; the one
   whose period ends latest is this year's. */

const IX_VALUE = /<ix:nonFraction\b([^>]*)>([\s\S]*?)<\/ix:nonFraction>/gi
const attr = (attrs, name) => (attrs.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i')) || [])[1] ?? null

export function accountsFacts(xhtml) {
  const doc = String(xhtml ?? '')
  if (!/<ix:/i.test(doc)) return null
  const ends = new Map()
  for (const m of doc.matchAll(/<xbrli:context\b[^>]*\bid\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/xbrli:context>/gi)) {
    const end = (m[2].match(/<xbrli:(?:endDate|instant)>\s*([\d-]{10})\s*</i) || [])[1]
    if (end) ends.set(m[1], end)
  }
  const values = (concept) => {
    const out = []
    for (const m of doc.matchAll(IX_VALUE)) {
      const name = attr(m[1], 'name') ?? ''
      if (!new RegExp(`:${concept}$`).test(name)) continue
      const raw = m[2].replace(/<[^>]+>/g, '').replace(/[,\s]/g, '')
      if (!/^\d+(\.\d+)?$/.test(raw)) continue
      const scale = Number(attr(m[1], 'scale') ?? 0)
      const n = Math.round(Number(raw) * 10 ** (Number.isFinite(scale) ? scale : 0))
      out.push({ n, end: ends.get(attr(m[1], 'contextRef') ?? '') ?? null })
    }
    return out.sort((a, b) => String(b.end ?? '').localeCompare(String(a.end ?? '')))
  }
  const staff = values('AverageNumberEmployeesDuringPeriod')
  const sales = values('TurnoverRevenue')
  const periodEnd = staff[0]?.end ?? sales[0]?.end ?? null
  const earlier = staff.find((v) => v.end && periodEnd && v.end < periodEnd)
  return {
    employees: staff.length ? staff[0].n : null,
    prior: earlier ? earlier.n : null,
    turnover: sales.length && sales[0].end === periodEnd ? sales[0].n : null,
    period_end: periodEnd,
  }
}

/** How often the accounts went in late. A private company has nine months
    from the end of its year; its first accounts have longer, so a filing
    for a year ending within two years of incorporation is not counted. */
export function lateFilings(items, { incorporated = null, years = 6, today = new Date() } = {}) {
  const born = incorporated ? Date.parse(incorporated) : NaN
  const since = new Date(today); since.setUTCFullYear(since.getUTCFullYear() - years)
  let late = 0
  let of = 0
  for (const f of Array.isArray(items) ? items : []) {
    if (String(f?.category ?? '') !== 'accounts') continue
    const madeUp = Date.parse(f?.description_values?.made_up_date ?? '')
    const filed = Date.parse(f?.date ?? '')
    if (!Number.isFinite(madeUp) || !Number.isFinite(filed) || filed < since.getTime()) continue
    if (Number.isFinite(born) && madeUp - born < 730 * 864e5) continue
    const due = new Date(madeUp); due.setUTCMonth(due.getUTCMonth() + 9)
    of++
    if (filed > due.getTime() + 864e5) late++
  }
  return { late, of }
}

/** Companies, not people, with significant control: the business is part
    of a group. Only company names come back; a person's never does. */
export function controllingCompanies(psc) {
  return (Array.isArray(psc?.items) ? psc.items : [])
    .filter((p) => !p?.ceased_on && /corporate-entity|legal-person/.test(String(p?.kind ?? '')))
    .map((p) => String(p?.name ?? '').trim()).filter(Boolean)
}

/* ---------- the register's red flags ----------

   Two kinds. A REFUSAL ends the business before any model is asked: it
   is not trading, or cannot be trusted to pay. A CAUTION lets the
   argument go ahead with a ceiling on the score. Both are read from the
   company profile, which the research stage fetches anyway. */

export function registerRefusal(profile) {
  if (!profile || typeof profile !== 'object') return null
  const status = String(profile.company_status ?? '')
  if (status && status !== 'active') return `the register shows it as ${status.replace(/-/g, ' ')}`
  if (profile.company_status_detail) return `the register shows ${String(profile.company_status_detail).replace(/-/g, ' ')}`
  if (profile.has_insolvency_history === true) return 'it has insolvency history on the register'
  if (profile.has_been_liquidated === true) return 'it has been liquidated before'
  if (String(profile.accounts?.last_accounts?.type ?? '') === 'dormant') return 'its last accounts were filed as dormant, so it is not trading'
  return null
}

export function registerCautions(profile) {
  const out = []
  if (!profile || typeof profile !== 'object') return out
  if (profile.accounts?.overdue === true) out.push('its accounts are overdue')
  if (profile.confirmation_statement?.overdue === true) out.push('its confirmation statement is overdue')
  return out
}

/** The ICP's size rules, applied to the filed average headcount - the
    only number the register has. Over 50: not for us. One or two: not
    for us unless a professional practice, whose own time is the thing we
    would save (ICP section 3), so a caution rather than a refusal. */
const PROFESSIONAL_SIC = /^(66220|69\d{3}|70229|71\d{3}|74\d{3}|78109)$/
export function sizeVerdict(accounts, sicCodes = []) {
  const n = accounts?.employees
  if (n === null || n === undefined || !Number.isFinite(n)) return { refuse: null, caution: null }
  if (n > 50) return { refuse: `its filed accounts give ${n} employees, over the 50 we serve`, caution: null }
  const professional = (Array.isArray(sicCodes) ? sicCodes : []).some((c) => PROFESSIONAL_SIC.test(String(c)))
  if (n <= 2 && !professional) return { refuse: null, caution: `its filed accounts give ${n === 0 ? 'no employees beyond its directors' : `${n} employee${n === 1 ? '' : 's'}`}, below the size we serve` }
  return { refuse: null, caution: null }
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

export function validateResearch(parsed, { pageText, registerKeys, measuredKeys = [], max = 12 }) {
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
    } else if (source === 'register' || source === 'measured') {
      /* The key says which it is: a measured line cited as "register",
         or the other way round, is the same line either way. */
      const key = str(f?.register_key ?? f?.key, 40)
      if (registerKeys.includes(key)) facts.push({ id, fact, source: 'register', register_key: key })
      else if (measuredKeys.includes(key)) facts.push({ id, fact, source: 'measured', register_key: key })
      else { struck.push(`${id}: names ${source} line "${key}", which it was not given`); continue }
    } else {
      struck.push(`${id}: source must be page, register or measured`)
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

/** A signal says which services it points to, by key. That is what lets
    code refuse a pitch that rests on a signal about something else - the
    first live test pitched web on an overdue filing. A caution is a
    signal against the business itself (behind on filings, barely
    trading): it may be put forward, so every agent sees it, and it points
    to nothing, so nothing can be sold on it. */
export function validateSignals(parsed, { facts, max = 8, services = null }) {
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
    let strength = STRENGTHS.includes(str(s?.strength, 12).toLowerCase()) ? str(s.strength, 12).toLowerCase() : 'weak'
    const caution = s?.caution === true
    /* True of nearly every business of its kind: the sector talking, not
       this business. Weak by definition, whatever it claimed. */
    const sector = s?.sector === true && !caution
    if (sector && strength !== 'weak') { struck.push(`${id}: true of the whole sector, so weak, not ${strength}`); strength = 'weak' }
    const named = (Array.isArray(s?.points_to) ? s.points_to : []).map((x) => str(x, 40).toLowerCase()).filter(Boolean)
    const unknown = services ? named.filter((x) => !services.includes(x)) : []
    if (unknown.length) struck.push(`${id}: points to ${unknown.map((x) => `"${x}"`).join(', ')}, not ${unknown.length === 1 ? 'a service' : 'services'} we sell; ignored`)
    let points = [...new Set(services ? named.filter((x) => services.includes(x)) : named)]
    if (caution && points.length) { struck.push(`${id}: a caution points to no service; ${points.join(', ')} ignored`); points = [] }
    seen.add(id)
    signals.push({ id, signal: text, facts: [...new Set(cited)], strength, points_to: points, caution, sector })
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
export async function argueSignals({ facts, researchSay, reviews = 2, max = 8, services = null, callSignals, callReview, onMove }) {
  let current = null
  let lastReview = null
  for (let r = 1; r <= reviews; r++) {
    const reply = await callSignals({ facts, researchSay, previous: current, review: lastReview, round: r })
    const v = validateSignals(reply?.parsed, { facts, max, services })
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

/** Which of the cited signals point to this service. A signal with no
    points_to list at all (an older reply shape) is trusted as pointing
    anywhere, so a missing field cannot silently zero a business; a signal
    that names services and not this one, or is a caution, does not. */
export function pointingAt(service, cited, signals) {
  return cited.filter((id) => {
    const sig = signals.find((x) => x.id === id)
    if (!sig || sig.caution) return false
    if (!Array.isArray(sig.points_to)) return true
    return sig.points_to.includes(service)
  })
}

/** A score over the register's ceiling is read as the ceiling. */
export function capped(score, ceiling) {
  return ceiling !== null && ceiling !== undefined && score !== null && score > ceiling ? ceiling : score
}

/** The ceiling on one proposal, and why: the register's, or the sector
    ceiling when every cited signal that points to this service is one
    true of the whole sector. A proposal that also cites a signal about
    this business in particular is free of the second. */
export function ceilingFor(service, cited, signals, { ceiling = null, sectorCeiling = null } = {}) {
  const pointing = pointingAt(service, cited, signals).map((id) => signals.find((s) => s.id === id))
  const sectorOnly = sectorCeiling !== null && sectorCeiling !== undefined && pointing.length > 0 && pointing.every((s) => s?.sector === true)
  const caps = []
  if (ceiling !== null && ceiling !== undefined) caps.push({ at: ceiling, why: 'the ceiling the register sets' })
  if (sectorOnly) caps.push({ at: sectorCeiling, why: 'it rests only on signals true of the whole sector' })
  if (!caps.length) return { at: null, why: null }
  return caps.reduce((a, b) => (b.at < a.at ? b : a))
}

export function validatePick(p, { signals, services, ceiling = null, sectorCeiling = null }) {
  const ids = new Set(signals.map((s) => s.id))
  const service = str(p?.service, 40).toLowerCase()
  if (!services.includes(service)) return { ok: false, why: `"${service || '?'}" is not a service in the portfolio` }
  const cited = (Array.isArray(p?.signals) ? p.signals : []).map((x) => str(x, 8)).filter((x) => ids.has(x))
  if (!cited.length) return { ok: false, why: `${service}: cites no agreed signal` }
  if (!pointingAt(service, cited, signals).length) {
    return { ok: false, why: `${service}: rests on ${cited.join(', ')}, and none of ${cited.length === 1 ? 'it points' : 'them point'} to ${service}` }
  }
  const asked = scoreOf(p?.score)
  if (asked === null) return { ok: false, why: `${service}: no opening score on the 0-100 scale` }
  const cap = ceilingFor(service, cited, signals, { ceiling, sectorCeiling })
  const score = capped(asked, cap.at)
  const pitch = str(p?.pitch, 2000)
  const route = contactRouteIn(pitch)
  if (route) return { ok: false, why: `${service}: the pitch carries ${route}` }
  return {
    ok: true,
    pick: { service, pitch: redactContactRoutes(pitch), signals: [...new Set(cited)], score },
    note: score !== asked ? `${service}: opened at ${asked}, read as ${score}: ${cap.why}` : null,
  }
}

export function validateSales(parsed, { signals, services, max = 3, ceiling = null, sectorCeiling = null }) {
  const picks = []
  const struck = []
  for (const p of Array.isArray(parsed?.services) ? parsed.services : []) {
    const v = validatePick(p, { signals, services, ceiling, sectorCeiling })
    if (!v.ok) { struck.push(v.why); continue }
    if (v.note) struck.push(v.note)
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
export function readMove(parsed, { who, theirs, signals, services, current, ceiling = null, sectorCeiling = null, fallbackCited = [] }) {
  const guard = []
  if (!parsed || typeof parsed !== 'object') return { kind: 'none', score: null, guard: ['the reply was not JSON'] }
  const route = contactRouteIn(JSON.stringify({ ...parsed, say: undefined }))
  if (route) return { kind: 'none', score: null, guard: [`refused whole: it carries ${route}`] }

  let verdict = str(parsed.verdict, 12).toLowerCase()
  if (!MOVES[who].includes(verdict)) {
    guard.push(`"${verdict || '?'}" is not a move a ${who} agent can make; read as a counter`)
    verdict = 'counter'
  }
  const ids = new Set(signals.map((s) => s.id))
  const cited = (Array.isArray(parsed.signals) ? parsed.signals : []).map((x) => str(x, 8)).filter((x) => ids.has(x))
  /* An agreement that cites nothing rests on what the pitch rested on. */
  const cap = current
    ? ceilingFor(current, cited.length ? cited : fallbackCited, signals, { ceiling, sectorCeiling })
    : { at: ceiling, why: 'the ceiling the register sets' }
  let score = scoreOf(parsed.score)
  const over = capped(score, cap.at)
  if (over !== score) {
    guard.push(cap.at === ceiling && cap.why === 'the ceiling the register sets'
      ? `named ${score}; the register caps this business at ${ceiling}, so read as ${ceiling}`
      : `named ${score}; ${cap.why}, so read as ${cap.at}`)
    score = over
  }
  if (verdict === 'pass') {
    if (score !== 0 && score !== null) guard.push(`passed but named ${score}; a pass is 0`)
    score = 0
  }

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
  if ((verdict === 'counter' || verdict === 'redirect') && score > 0 && current && !pointingAt(current, cited, signals).length) {
    return {
      kind: 'none', score: null,
      guard: [...guard, `proposed ${score} for ${current} on ${cited.join(', ')}, which ${cited.length === 1 ? 'does' : 'do'} not point to ${current}, so it does not count`],
    }
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
    const b = validatePick(parsed.bring_in, { signals, services, ceiling, sectorCeiling })
    if (b.ok) { move.bring_in = b.pick; if (b.note) guard.push(b.note) }
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
  pick, turns = 6, signals, services, callSpecialist, callSales, onMove, canBringIn = () => true, ceiling = null, sectorCeiling = null,
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
    const m = readMove(reply?.parsed, { who, theirs, signals, services, current: pick.service, ceiling, sectorCeiling, fallbackCited: pick.signals })
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

export function factLines(facts, register, measured = []) {
  return facts.map((f) => {
    if (f.source === 'page') return `${f.id}: ${f.fact}\n    from their own website: "${f.quote}"`
    if (f.source === 'measured') return `${f.id}: ${f.fact}\n    measured on their website by code: ${measured.find((r) => r.key === f.register_key)?.text ?? f.register_key}`
    return `${f.id}: ${f.fact}\n    from the register: ${register.find((r) => r.key === f.register_key)?.text ?? f.register_key}`
  }).join('\n')
}

export function signalLines(signals, facts) {
  const where = (s) => (s.caution ? 'CAUTION, points to no service'
    : Array.isArray(s.points_to) ? (s.points_to.length ? `points to ${s.points_to.join(', ')}` : 'points to no service') : 'direction not given')
  return signals.map((s) => `${s.id} (${s.strength}${s.sector ? ', true of the whole sector' : ''}; ${where(s)}): ${s.signal}\n    rests on: ${s.facts.map((id) => {
    const f = facts.find((x) => x.id === id)
    return f ? `${id} "${f.fact}"` : id
  }).join('; ')}`).join('\n')
}

export function portfolioBlock(cfg, focus = []) {
  const rank = (k) => { const i = focus.indexOf(k.key); return i < 0 ? focus.length : i }
  return (cfg.knowledge || []).filter((k) => k.kind === 'service')
    .map((k, i) => ({ k, i })).sort((a, b) => rank(a.k) - rank(b.k) || a.i - b.i).map(({ k }) =>
      `SERVICE ${k.key} — ${k.label}${focus.includes(k.key) ? ' (we lead with this)' : ''}\n${k.summary ?? ''}\nSignals that point here:\n${k.signals ?? ''}`).join('\n\n')
}

/** Said to sales: the services we lead with, and the limit on it. */
export function focusLine(focus = []) {
  if (!focus.length) return ''
  return `WE LEAD WITH ${focus.join(' AND ').toUpperCase()}. Whenever a signal about this business points to ${focus.length > 1 ? 'one of them' : 'it'}, bring that specialist in, even if another service looks stronger. Never stretch a signal to reach them: a pitch on a signal that does not point there is refused.`
}

export function conversationBlock(history, service) {
  return history.map((h, i) => {
    const who = h.from === 'sales' ? 'SALES' : `${service.toUpperCase()} SPECIALIST`
    return `${i + 1}. ${who}${h.score === null || h.score === undefined ? '' : ` (number: ${h.score})`}:\n${h.say || '(said nothing usable)'}`
  }).join('\n\n')
}
