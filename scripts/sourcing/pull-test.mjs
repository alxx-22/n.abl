#!/usr/bin/env node
/* The lead puller's rules, asserted — with no key and no network.

   Both keys are placeholders until somebody makes them, so everything
   here runs against fixtures, a fake fetch and a fake clock. puller.mjs
   is imported unmodified: these tests cannot pass while the code that
   runs is different.

   The ones that matter most are the prospector's. A model may say a
   company is worth a letter; it may never say how to reach one. An
   invented email address is the worst thing this system could produce,
   and it is exactly what a model produces confidently — so that is
   tested five ways, and so is the rule that it may only judge companies
   it was shown.

   The second most important is the key rule: the prospector must refuse
   to run on GEMINI_API_KEY. That is the writer's quota, and on 16
   September one key ran out before eleven in the morning.

     node scripts/sourcing/pull-test.mjs
*/
import {
  CH_BASE, CH_LIMIT, CH_PAGE_MAX, DEFAULT_TYPES, NON_TRADING_SIC,
  chAuthHeader, describeSic, expandSic, buildSearchUrl, createRateLimiter, pullPages, ChKeyRejected,
  normaliseItem, admit, existingKeys, dedupe,
  prospectBatch, PROSPECT_SYSTEM, VERDICTS, contactRouteIn, validateVerdicts, applyVerdicts,
  resolveKeys, mask,
} from './puller.mjs'
import { SIC_2007 } from './sic-2007.mjs'

let fail = 0, pass = 0
const ok = (name, cond, detail = '') => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}${cond ? '' : '  → ' + detail}`)
  cond ? pass++ : fail++
}
const section = (t) => console.log(`\n${t}\n`)
const throwsAsync = async (fn, match) => {
  try { await fn(); return false } catch (e) { return match ? match.test(e.message) : true }
}

/* A Companies House item in the documented shape. The field names are
   the ones Companies House's own examples use; normaliseItem is written to
   tolerate any of them being absent, which is tested separately. */
const ITEM = {
  company_name: 'SPARKS ELECTRICAL (NOTTINGHAM) LIMITED',
  company_number: '09876543',
  company_status: 'active',
  company_type: 'ltd',
  kind: 'search-results#company',
  links: { company_profile: '/company/09876543' },
  date_of_creation: '2016-03-14',
  registered_office_address: {
    address_line_1: '12 Castle Boulevard',
    locality: 'Nottingham',
    postal_code: 'NG7 1FB',
    region: 'Nottinghamshire',
  },
  sic_codes: ['43210'],
}
const item = (over = {}) => ({ ...ITEM, ...over, registered_office_address: { ...ITEM.registered_office_address, ...(over.registered_office_address || {}) } })

/* ================================================================ */
section('AUTHENTICATION — HTTP Basic, key as username, password blank')

{
  const h = chAuthHeader('abc-123')
  ok('starts "Basic "', h.startsWith('Basic '))
  const decoded = atob(h.slice(6))
  ok('decodes to the key and a colon', decoded === 'abc-123:', decoded)
  ok('the password is empty, not missing', decoded.endsWith(':') && decoded.split(':')[1] === '')
}

/* ================================================================ */
section('THE REQUEST')

{
  const u = new URL(buildSearchUrl({ location: 'Nottingham', sicCodes: ['43210', '43220'], since: '2016-01-01', size: 250, startIndex: 500 }))
  ok('the documented host and path', u.origin + u.pathname === CH_BASE + '/advanced-search/companies')
  ok('location passed through', u.searchParams.get('location') === 'Nottingham')
  ok('a list is comma-joined', u.searchParams.get('sic_codes') === '43210,43220', u.searchParams.get('sic_codes'))
  ok('active only, by default', u.searchParams.get('company_status') === 'active')
  ok('ltd and llp, by default', u.searchParams.get('company_type') === 'ltd,llp', u.searchParams.get('company_type'))
  ok('incorporated_from', u.searchParams.get('incorporated_from') === '2016-01-01')
  ok('size and start_index', u.searchParams.get('size') === '250' && u.searchParams.get('start_index') === '500')

  const bare = new URL(buildSearchUrl({ location: 'Newark' }))
  ok('an absent filter is left out, not sent empty', !bare.searchParams.has('sic_codes') && !bare.searchParams.has('incorporated_from'))
  ok('size clamped to the documented 5000', new URL(buildSearchUrl({ size: 99999 })).searchParams.get('size') === String(CH_PAGE_MAX))
  ok('size never below 1', new URL(buildSearchUrl({ size: -4 })).searchParams.get('size') === '1')
}

/* ================================================================ */
section('SIC — the API gives bare codes, and a letter must not say "43210"')

{
  ok(`the vendored table has ${Object.keys(SIC_2007).length} codes`, Object.keys(SIC_2007).length === 731)
  ok('43210 becomes the bulk file’s "code - text" form', describeSic('43210') === '43210 - Electrical installation', describeSic('43210'))
  ok('an unknown code stays bare rather than being described', describeSic('12345') === '12345')

  const e = expandSic(['432'])
  ok('a prefix expands to every code under it', e.length > 1 && e.every((c) => c.startsWith('432') && c.length === 5), e.join(','))
  ok('and includes 43210', e.includes('43210'))
  ok('a full code passes through even if the table does not know it', expandSic(['12345']).join() === '12345')
  ok('duplicates dropped, order kept', expandSic(['43210', '432']).filter((c) => c === '43210').length === 1 && expandSic(['43210', '432'])[0] === '43210')
}

/* ================================================================ */
section('SHAPING — the output must be indistinguishable from the bulk file’s')

{
  const c = normaliseItem(ITEM, { pulledOn: '2026-09-22' })
  const BULK_FIELDS = ['company_number', 'company', 'company_category', 'incorporated', 'postcode', 'area',
    'town', 'address_line_1', 'sic', 'source', 'source_detail', 'source_date']
  const missing = BULK_FIELDS.filter((f) => !(f in c))
  ok('carries every field fetch-companies-house.mjs writes', missing.length === 0, `missing ${missing.join(', ')}`)
  ok('company number', c.company_number === '09876543')
  ok('category in the bulk file’s wording', c.company_category === 'Private Limited Company', c.company_category)
  ok('incorporation date, ISO', c.incorporated === '2016-03-14')
  ok('postcode and outward area', c.postcode === 'NG7 1FB' && c.area === 'NG7', `${c.postcode} / ${c.area}`)
  ok('town from locality', c.town === 'Nottingham')
  ok('source is companies_house, so merge.mjs files it correctly', c.source === 'companies_house')
  ok('source date is the day of the pull', c.source_date === '2026-09-22')

  /* The trap, asserted against the exact expressions downstream uses. */
  const promoteIndustry = (cand) => (cand.sic || [])[0]?.replace(/^\d+\s*-\s*/, '')   // promote.mjs:128
  const triageCodes = (cand) => (cand.sic || []).map((s) => String(s).replace(/\D.*$/, '').trim())  // triage.mjs:64
  ok('promote.mjs reads the industry as words, not a number', promoteIndustry(c) === 'Electrical installation', promoteIndustry(c))
  ok('triage.mjs still reads the numeric code', triageCodes(c).join() === '43210', triageCodes(c).join())

  ok('an item with no company number is dropped, not guessed at', normaliseItem({ company_name: 'X' }) === null)
  ok('garbage is dropped, not thrown on', normaliseItem(null) === null && normaliseItem('nope') === null)
  const sparse = normaliseItem({ company_number: '01234567', company_name: 'Sparse Ltd' })
  ok('a sparse item still shapes, with nulls where nothing was said', sparse && sparse.postcode === null && sparse.town === null && Array.isArray(sparse.sic))
}

/* ================================================================ */
section('WHO IS LET IN')

{
  const c = (over) => normaliseItem(item(over), { pulledOn: '2026-09-22' })
  ok('an active ltd in the area is admitted', admit(c({})).ok)
  ok('dissolved is refused', !admit(c({ company_status: 'dissolved' })).ok)
  ok('a plc is refused by default', !admit(c({ company_type: 'plc' })).ok)
  ok('…but admitted when --types asks for it', admit(c({ company_type: 'plc' }), { types: ['ltd', 'plc'] }).ok)
  for (const [code, why] of Object.entries(NON_TRADING_SIC)) {
    ok(`SIC ${code} refused — ${why}`, !admit(c({ sic_codes: [code] })).ok)
  }
  ok('a non-trading code anywhere in the list refuses it', !admit(c({ sic_codes: ['43210', '99999'] })).ok)
  ok('no postcode is refused: territory cannot be checked', !admit(c({ registered_office_address: { postal_code: '' } })).ok)
  ok('outside --areas is refused', !admit(c({}), { areas: ['B49'] }).ok)
  ok('inside --areas is admitted', admit(c({}), { areas: ['NG'] }).ok)
  const r = admit(c({ company_status: 'liquidation' }))
  ok('a refusal says why, in words', typeof r.why === 'string' && r.why.includes('liquidation'), r.why)
}

/* ================================================================ */
section('NOT WRITING TWICE — sales_leads has no unique key, so this is the only check')

{
  const mk = (num, name, pc) => normaliseItem(item({ company_number: num, company_name: name, registered_office_address: { postal_code: pc } }))
  const pulled = [
    mk('11111111', 'Known By Number Ltd', 'NG1 1AA'),
    mk('22222222', 'Brand New Plumbing Ltd', 'NG2 2BB'),
    mk('33333333', 'Old Bakery Ltd', 'NG3 3CC'),
    mk('44444444', 'Distinctive Joinery Services Ltd', 'NG4 4DD'),
    mk('22222222', 'Brand New Plumbing Ltd', 'NG2 2BB'),        // the same company, twice in one pull
    mk('55555555', 'Same Name Different Co Ltd', 'NG5 5EE'),
  ]
  const keys = existingKeys([
    { company_number: '11111111', company: 'Known By Number Ltd' },
    /* A CRM lead carries its number only inside this sentence — promote.mjs:109. */
    { company: 'Old Bakery Ltd', subscriber_type_evidence: 'Companies House 33333333' },
    /* No number at all: only name matching can catch it. */
    { company: 'DISTINCTIVE JOINERY SERVICES LIMITED', location: 'Unit 4, Somewhere, NG9 9ZZ' },
    /* Same name, same postcode, but a DIFFERENT number: a different company. */
    { company_number: '99999998', company: 'Same Name Different Co Ltd', postcode: 'NG5 5EE' },
  ])
  const { fresh, duplicates } = dedupe(pulled, keys)
  const kept = fresh.map((c) => c.company_number)
  ok('known by company number', !kept.includes('11111111'))
  ok('known by the number inside subscriber_type_evidence, as the CRM stores it', !kept.includes('33333333'))
  ok('known by a distinctive name, against a record with no number', !kept.includes('44444444'))
  ok('the same company twice in one pull is kept once', kept.filter((n) => n === '22222222').length === 1)
  ok('a different number is a different company, whatever the name', kept.includes('55555555'))
  ok('every duplicate says how it was known', duplicates.every((d) => typeof d.how === 'string' && d.how.length > 0))
  ok('four duplicates, two new', duplicates.length === 4 && fresh.length === 2, `${duplicates.length} dup, ${fresh.length} new`)
}

/* ================================================================ */
section('PACING — 600 in five minutes, never in one burst')

{
  let t = 0
  const slept = []
  const now = () => t
  const sleep = async (ms) => { slept.push(ms); t += ms }

  const take = createRateLimiter({ max: 3, windowMs: 1000, sleep, now })
  for (let i = 0; i < 3; i++) await take()
  ok('up to the limit, no waiting', slept.length === 0 && t === 0)
  await take()
  ok('one over waits for the oldest to leave the window', t >= 1000, `clock at ${t}`)

  t = 0; slept.length = 0
  const gapped = createRateLimiter({ max: 100, windowMs: 1000, minGapMs: 250, sleep, now })
  for (let i = 0; i < 4; i++) await gapped()
  ok('a minimum gap spaces calls even inside the window', t >= 750, `clock at ${t}`)

  ok('the documented limit is 600 per five minutes', CH_LIMIT.max === 600 && CH_LIMIT.windowMs === 300_000)
  let threw = false
  try { createRateLimiter({ max: 1, windowMs: 1 }) } catch { threw = true }
  ok('refuses to exist without a sleep to wait with', threw)
}

/* ================================================================ */
section('PAGING, RETRIES AND REFUSALS — against a fake Companies House')

/* Serves `total` numbered companies, `size` at a time. Can be told to
   answer the first N requests with a given status. */
function fakeCH({ total = 7, failFirst = 0, failStatus = 429, retryAfter = '2', status = 200 } = {}) {
  const seen = []
  let calls = 0
  const fetchImpl = async (url, init) => {
    calls++
    const u = new URL(url)
    seen.push({ start: Number(u.searchParams.get('start_index')), size: Number(u.searchParams.get('size')), auth: init?.headers?.authorization })
    if (calls <= failFirst) {
      return { status: failStatus, ok: false, headers: { get: (h) => (h.toLowerCase() === 'retry-after' ? retryAfter : null) }, text: async () => 'nope', json: async () => ({}) }
    }
    if (status !== 200) return { status, ok: false, headers: { get: () => null }, text: async () => 'denied', json: async () => ({}) }
    const start = Number(u.searchParams.get('start_index'))
    const size = Number(u.searchParams.get('size'))
    const items = []
    for (let i = start; i < Math.min(start + size, total); i++) items.push(item({ company_number: String(10000000 + i) }))
    return { status: 200, ok: true, headers: { get: () => null }, json: async () => ({ hits: total, items }) }
  }
  return { fetchImpl, seen, calls: () => calls }
}
const noSleep = async () => {}

{
  const ch = fakeCH({ total: 7 })
  const r = await pullPages({ fetchImpl: ch.fetchImpl, key: 'k', limit: 100, pageSize: 3, sleep: noSleep })
  ok('collects every result across pages', r.items.length === 7, `${r.items.length}`)
  ok('start_index walks 0, 3, 6', ch.seen.map((s) => s.start).join() === '0,3,6', ch.seen.map((s) => s.start).join())
  ok('stops at the reported hits, not one page late', r.requests === 3 && r.hits === 7, `${r.requests} requests`)
  ok('every request carries the Basic header', ch.seen.every((s) => s.auth === chAuthHeader('k')))
}
{
  const ch = fakeCH({ total: 50 })
  const r = await pullPages({ fetchImpl: ch.fetchImpl, key: 'k', limit: 5, pageSize: 3, sleep: noSleep })
  ok('stops at the limit, mid-page if need be', r.items.length === 5, `${r.items.length}`)
}
{
  const ch = fakeCH({ total: 0 })
  const r = await pullPages({ fetchImpl: ch.fetchImpl, key: 'k', limit: 10, sleep: noSleep })
  ok('an empty result is an empty result, not an error', r.items.length === 0 && r.requests === 1)
}
{
  const waits = []
  const ch = fakeCH({ total: 2, failFirst: 1, retryAfter: '2' })
  const r = await pullPages({ fetchImpl: ch.fetchImpl, key: 'k', limit: 10, sleep: async (ms) => waits.push(ms) })
  ok('a 429 is waited out and the same page retried', r.items.length === 2 && ch.calls() === 2)
  ok('Retry-After is honoured, in seconds', waits[0] === 2000, `waited ${waits[0]}`)
}
{
  const waits = []
  const ch = fakeCH({ total: 2, failFirst: 1, retryAfter: null })
  await pullPages({ fetchImpl: ch.fetchImpl, key: 'k', limit: 10, sleep: async (ms) => waits.push(ms) })
  ok('with no Retry-After, it waits the whole window', waits[0] === CH_LIMIT.windowMs, `waited ${waits[0]}`)
}
{
  const ch = fakeCH({ failFirst: 99 })
  ok('persistent 429s give up rather than hammer', await throwsAsync(() => pullPages({ fetchImpl: ch.fetchImpl, key: 'k', limit: 10, sleep: noSleep, maxRetries: 3 }), /still 429/))
  ok('…after exactly the allowed retries', ch.calls() === 4, `${ch.calls()} calls`)
}
{
  const ch = fakeCH({ status: 401 })
  let err = null
  try { await pullPages({ fetchImpl: ch.fetchImpl, key: 'bad', limit: 10, sleep: noSleep }) } catch (e) { err = e }
  ok('a 401 is reported as the key', err instanceof ChKeyRejected && /COMPANIES_HOUSE_API_KEY/.test(err.message), err?.message)
  ok('…and says which kind of key is wanted', /REST/.test(err?.message) && /Live/.test(err?.message))
}
{
  const ch = fakeCH({ status: 500 })
  ok('any other failure names the status', await throwsAsync(() => pullPages({ fetchImpl: ch.fetchImpl, key: 'k', limit: 10, sleep: noSleep }), /500/))
}
{
  let called = false
  const r = await throwsAsync(() => pullPages({ fetchImpl: async () => { called = true }, key: '', limit: 10, sleep: noSleep }), /COMPANIES_HOUSE_API_KEY/)
  ok('no key: refuses before any request is made', r && !called)
}

/* ================================================================ */
section('THE PROSPECTOR — what it is shown')

const batch = [
  normaliseItem(ITEM, { pulledOn: '2026-09-22' }),
  normaliseItem(item({ company_number: '07777777', company_name: 'Quiet Ledger Accountants Ltd', sic_codes: ['69201'], registered_office_address: { postal_code: 'NG5 2AB', locality: 'Arnold', address_line_1: '1 High Street' } }), { pulledOn: '2026-09-22' }),
]
const { system, user, idMap } = prospectBatch(batch, { today: new Date('2026-09-22T12:00:00Z') })
{
  ok('opaque ids, not company numbers', idMap.get('p1') === '09876543' && idMap.get('p2') === '07777777')
  ok('no company number is sent', !user.includes('09876543') && !user.includes('07777777'))
  ok('no postcode is sent', !user.includes('NG7 1FB') && !user.includes('NG5 2AB'))
  ok('no street address is sent', !user.includes('Castle Boulevard') && !user.includes('High Street'))
  ok('the name, the activity and the town are sent', user.includes('SPARKS ELECTRICAL') && user.includes('Electrical installation') && user.includes('Nottingham'))
  ok('years trading is worked out, not the raw date', /"years_trading": 10/.test(user) && !user.includes('2016-03-14'), user.match(/years_trading[^,]*/)?.[0])
  ok('the prompt forbids contact details', /Never include an email address, phone number, website, postal address or postcode/.test(system))
  ok('the prompt forbids adding companies', /Never add a company/.test(system))
  ok('the prompt names the real services', /data and analytics, AI, websites, custom software, and automation/.test(system))
}

/* ================================================================ */
section('THE PROSPECTOR — what it may say back')

{
  const good = { verdicts: [
    { id: 'p1', verdict: 'strong', reason: 'Electrical contractors schedule site visits and certificates, which is scheduling work.' },
    { id: 'p2', verdict: 'possible', reason: 'An accountancy practice has recurring deadlines, but the register cannot show how they track them.' },
  ] }
  const v = validateVerdicts(good, idMap)
  ok('two clean verdicts, both kept, keyed by company number', v.verdicts.size === 2 && v.verdicts.get('09876543')?.verdict === 'strong')
  ok('nothing refused, nothing unjudged', v.rejected.length === 0 && v.unjudged === 0)
}

/* The five contact-route shapes, each alone in an otherwise good answer. */
const routes = [
  ['an email address', 'Worth a letter — write to office@sparkselectrical.co.uk'],
  ['a web address', 'Their site sparkselectrical.co.uk takes bookings'],
  ['a URL with a scheme', 'See https://example.org for details'],
  ['a phone number', 'Call them on 0115 912 3456 first'],
  ['a postcode', 'They trade from NG7 1FB, near the centre'],
]
for (const [what, reason] of routes) {
  const v = validateVerdicts({ verdicts: [{ id: 'p1', verdict: 'strong', reason }] }, idMap)
  ok(`refused whole: ${what}`, v.verdicts.size === 0 && v.contactRoutes === 1, JSON.stringify(v.rejected))
}
{
  const v = validateVerdicts({ verdicts: [{ id: 'p1', verdict: 'strong', reason: 'Fine.', email: 'owner@example.com' }] }, idMap)
  ok('refused whole: a contact route smuggled in an extra field', v.verdicts.size === 0 && v.contactRoutes === 1)
}
{
  const plain = [
    'Trading since 2016 and schedules 40 jobs a week',
    'A Ltd. company, e.g. a small firm',
    'Company number 09876543 is on the register',
  ]
  const falsePositives = plain.filter((s) => contactRouteIn(s))
  ok('ordinary sentences are not mistaken for contact routes', falsePositives.length === 0, falsePositives.join(' | '))
  ok('a postcode-shaped string in no real area is not a postcode', contactRouteIn('model GQ1 2AB') === null)
}
{
  const v = validateVerdicts({ verdicts: [{ id: 'p9', verdict: 'strong', reason: 'A great fit.' }] }, idMap)
  ok('an id it was not given is refused — it added a company', v.verdicts.size === 0 && /not in the batch/.test(v.rejected[0]?.why))
}
{
  const v = validateVerdicts({ verdicts: [{ id: '09876543', verdict: 'strong', reason: 'Guessed the real number.' }] }, idMap)
  ok('a real company number used as an id is still refused', v.verdicts.size === 0)
}
{
  const v = validateVerdicts({ verdicts: [
    { id: 'p1', verdict: 'strong', reason: 'First.' },
    { id: 'p1', verdict: 'skip', reason: 'Changed its mind.' },
  ] }, idMap)
  ok('a company judged twice keeps the first verdict only', v.verdicts.size === 1 && v.verdicts.get('09876543').verdict === 'strong' && v.rejected.length === 1)
}
{
  const v = validateVerdicts({ verdicts: [{ id: 'p1', verdict: 'amazing', reason: 'Very keen.' }] }, idMap)
  ok(`a verdict outside ${VERDICTS.join('/')} is refused`, v.verdicts.size === 0)
}
{
  const v = validateVerdicts({ verdicts: [{ id: 'p1', verdict: 'Strong', reason: 'Capitalised.' }] }, idMap)
  ok('case in a verdict is forgiven', v.verdicts.get('09876543')?.verdict === 'strong')
}
{
  ok('an empty reason is refused', validateVerdicts({ verdicts: [{ id: 'p1', verdict: 'weak', reason: '  ' }] }, idMap).verdicts.size === 0)
  ok('a reason longer than a sentence is refused', validateVerdicts({ verdicts: [{ id: 'p1', verdict: 'weak', reason: 'x'.repeat(301) }] }, idMap).verdicts.size === 0)
}
{
  for (const [what, raw] of [['not JSON at all', null], ['a string', 'strong'], ['an object with no list', { answer: 'p1 strong' }]]) {
    const v = validateVerdicts(raw, idMap)
    ok(`malformed (${what}): nothing kept, all unjudged`, v.verdicts.size === 0 && v.unjudged === idMap.size)
  }
}
{
  const v = validateVerdicts({ verdicts: [{ id: 'p1', verdict: 'weak', reason: 'Only one answered.' }] }, idMap)
  ok('a company it did not answer for is counted as unjudged', v.unjudged === 1)
}

/* ================================================================ */
section('APPLYING VERDICTS — no contact field can arrive from a model')

{
  const hostile = new Map([['09876543', {
    verdict: 'strong', reason: 'Fine.',
    email: 'owner@example.com', phone: '0115 912 3456', website: 'https://example.com', contact_address: '1 Street',
  }]])
  const [out] = applyVerdicts([batch[0]], hostile, 'gemini-test')
  const leaked = ['email', 'phone', 'website', 'contact_address'].filter((k) => k in out || k in (out.prospect || {}))
  ok('extra fields on a verdict are ignored, not copied', leaked.length === 0, `leaked: ${leaked.join(', ')}`)
  ok('the prospect carries exactly verdict, reason and model', Object.keys(out.prospect).sort().join() === 'model,reason,verdict', Object.keys(out.prospect).join())
  ok('the model is recorded', out.prospect.model === 'gemini-test')
  ok('a company with no verdict is returned untouched', applyVerdicts([batch[1]], hostile)[0] === batch[1])
}

/* ================================================================ */
section('KEYS — both are placeholders, and neither may be substituted')

{
  const none = resolveKeys({})
  ok('no Companies House key: named as missing', !none.ok && none.missing.includes('COMPANIES_HOUSE_API_KEY'))
  ok('without --judge, the Gemini key is not required', !none.missing.includes('GEMINI_DISCOVERY_API_KEY'))

  const judgeNoKey = resolveKeys({ COMPANIES_HOUSE_API_KEY: 'ch' }, { judge: true })
  ok('with --judge, the discovery key is required', !judgeNoKey.ok && judgeNoKey.missing.join() === 'GEMINI_DISCOVERY_API_KEY')

  const writerOnly = resolveKeys({ COMPANIES_HOUSE_API_KEY: 'ch', GEMINI_API_KEY: 'AIza-FAKE-WRITER-KEY-for-tests' }, { judge: true })
  ok('the writer’s GEMINI_API_KEY is never used in its place', !writerOnly.ok && writerOnly.gemini === '')

  const both = resolveKeys({ COMPANIES_HOUSE_API_KEY: ' ch-key ', GEMINI_DISCOVERY_API_KEY: 'AIzaDISC' }, { judge: true })
  ok('both present: ready, and trimmed', both.ok && both.ch === 'ch-key')
  ok('whitespace alone is not a key', !resolveKeys({ COMPANIES_HOUSE_API_KEY: '   ' }).ok)

  /* Deliberately NOT shaped like a real Google key (AIza + 35 characters):
     a fixture that matched would trip GitHub's secret scanning and email a
     leaked-key alert about a key that never existed. */
  const k = 'AIza-FAKE-TEST-VALUE-not-a-key-9876'
  const m = mask(k)
  ok('a masked key shows four characters each end, no more', m.startsWith('AIza') && m.endsWith('9876') && (m.match(/[^*]/g) || []).length === 8, m)
  ok('an unset key says so', mask('') === '(not set)')
  ok('a short value is starred out entirely', /^\*+$/.test(mask('abc123')))
}

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
