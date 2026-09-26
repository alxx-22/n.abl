#!/usr/bin/env node
/* The lead-gen agents' rules and loops, driven with fake agents.

   Imports supabase/functions/lead-prospector/prospect.mjs - the file the
   deployed function imports - unmodified. No key, no network.

     npm run test:prospector */

import {
  clampSettings, quotaScope, domainGuesses, pageKind, parseRobots, confirms, tradingName, sameSiteLinks,
  stripHtml, registerLines, quoteOnPage, validateResearch, validateSignals, validateSignalReview,
  argueSignals, validateSales, readMove, argueService, outcome, parseJson, conversationBlock,
  frontPageUrls, noSiteLine, registerRefusal, registerCautions, validatePick, signalLines,
  siteLines, contactPageLink, ceilingFor, factLines,
  accountsFacts, lateFilings, controllingCompanies, sizeVerdict, tradesOutside,
  generatorOf, staleGenerator, portfolioBlock, focusLine,
} from '../supabase/functions/lead-prospector/prospect.mjs'
import {
  normaliseDomain, isDirectory, domainsInOutcome, linkedDomains, parseAvailability, archivedUrl, readArchivedUrl,
  checkCall, pageVerdict, readOrder, runLookup, readChecker, investigatorBody,
  nameStems, wideGuesses, settledInOutcome, sweepVerdict,
} from '../supabase/functions/lead-prospector/lookup.mjs'
import { quotaScope as outreachQuotaScope } from '../supabase/functions/outreach-writer/guards.mjs'
import { redactContactRoutes, admit, unknownSic, expandSic } from '../supabase/functions/lead-prospector/puller.mjs'

let fail = 0
const ok = (label, cond, detail) => {
  if (cond) console.log(`  ok    ${label}`)
  else { fail++; console.log(`  FAIL  ${label}${detail !== undefined ? `\n        ${JSON.stringify(detail)}` : ''}`) }
}

console.log('\nTHE DIALS\n')
{
  const s = clampSettings({ agreement_turns: 999, max_services: 0, tick_budget_ms: 'x', stage_reserve_ms: { research: 1 } })
  ok('a dial cannot be turned past its stop', s.agreement_turns === 10 && s.max_services === 1)
  ok('  …and nonsense falls to the safe end', s.tick_budget_ms === 30000)
  ok('  …and a stage reserve has a floor', s.stage_reserve_ms.research === 5000)
}

console.log('\nWHICH 429 THIS IS — the same reading as the writer\n')
for (const body of ['GenerateRequestsPerDayPerProjectPerModel-FreeTier', 'PerMinute', '', { a: 'daily' }]) {
  ok(`  ${JSON.stringify(body).slice(0, 40)}`, quotaScope(429, body) === outreachQuotaScope(429, body))
}
ok('  and a 200 is not a quota refusal to either', quotaScope(200, 'daily') === outreachQuotaScope(200, 'daily'))

console.log('\nTHE WEBSITE HAS TO PROVE IT IS THEIRS\n')
{
  const g = domainGuesses('PARK VALLEY SERVICES LIMITED')
  ok('guesses start with the most likely domain', g[0] === 'parkvalley.co.uk', g)
  ok('  …and never include the noise words', !g.some((d) => d.includes('services')))
  ok('a parking page is recognised by its title', pageKind(`<title>This domain is for sale</title>${'x'.repeat(500)}`) === 'parked')
  ok('  …and a "hosted by" footer is not', pageKind(`<title>Park Valley</title>${'x'.repeat(500)} parked at GoDaddy`) === 'live')
  const holding = `<html><head><title>BW Plumbing and Heating</title><style>${'body{margin:0}'.repeat(40)}</style></head><body><h1>Welcome to BW Plumbing and Heating</h1><p>Please revisit - we'll be here very soon. For enquiries simply e-mail us.</p></body></html>`
  ok('a holding page - the name and "coming soon" - is a placeholder, not a site to prove (25 September, BW Plumbing & Heating)', pageKind(holding) === 'stub')
  ok('  …a real site that says a new page is coming soon is still a site', pageKind(`<title>Fresh Co</title><p>${'Electricians for homes and small businesses across Beeston. '.repeat(15)} New blog posts coming soon.</p>`) === 'live')
  ok('robots Disallow: / is respected', parseRobots('User-agent: *\nDisallow: /').allowed === false)
  ok('  …and a crawl delay is read, and capped', parseRobots('User-agent: *\nCrawl-delay: 60').delay === 10000)

  const cand = { company_name: 'PARK VALLEY MANAGEMENT LIMITED', company_number: '01234567', postcode: 'NG1 5AB' }
  ok('a full postcode on the page is proof', confirms('<p>Park Valley, NG1 5AB</p>', cand).reasons.includes('postcode'))
  ok('a company number on the page is proof', confirms('<p>Company no. 01234567</p>', cand).reasons.includes('company number'))
  ok('a name alone is only weak', confirms('<p>Park Valley Management</p>', cand).reasons.join() === 'company name')
  const elsewhere = confirms('<p>Park Valley Management, Norwich NR1 1AA</p>', cand)
  ok('a name on a page whose addresses are all elsewhere is a different firm', !elsewhere.reasons.length && /NR/.test(elsewhere.conflict), elsewhere)
  ok('a page that never mentions them is no match', !confirms('<p>Something else entirely</p>', cand).reasons.length)

  const links = sameSiteLinks('<a href="/about-us">a</a><a href="/contact">c</a><a href="https://other.com/services">x</a><a href="/services?x=1">s</a><a href="/about-us">dup</a>', 'https://parkvalley.co.uk/', 5)
  ok('only same-site about/services pages are followed', links.join() === 'https://parkvalley.co.uk/about-us,https://parkvalley.co.uk/services', links)
  ok('  …and never the contact page', !links.some((l) => /contact/.test(l)))
  ok('html becomes text, scripts and all removed', stripHtml('<script>var a=1</script><p>Hello&nbsp;<b>there</b></p>') === 'Hello there')
}

console.log('\nTHE REGISTER, AS LINES AN AGENT MAY CITE\n')
const REG = registerLines(
  { company_name: 'FRESH CO LTD', company_number: '22222222', postcode: 'NG9 1AA', address: '1 High St',
    town: 'Beeston', company_type: 'ltd', incorporated_on: '2015-03-01', activity: '43210 - Electrical installation' },
  { profile: { accounts: { last_accounts: { type: 'micro-entity', made_up_to: '2026-03-31' } }, has_charges: true },
    officers: { items: [
      { name: 'SMITH, John', officer_role: 'director', appointed_on: '2015-03-01' },
      { name: 'SMITH, Jane', officer_role: 'director', appointed_on: '2021-06-01' },
      { name: 'OLD, Person', officer_role: 'director', appointed_on: '2015-03-01', resigned_on: '2019-01-01' },
    ] }, today: new Date('2026-09-22') })
{
  const text = JSON.stringify(REG)
  ok('the lines carry what the register says', REG.some((r) => r.key === 'r_accounts' && /micro-entity/.test(r.text)))
  ok('  …counting active directors only', REG.find((r) => r.key === 'r_directors')?.text.startsWith('2 active directors'))
  ok('  …and years trading', /11 years/.test(REG.find((r) => r.key === 'r_age')?.text))
  ok('no company number reaches a model', !text.includes('22222222'))
  ok('no postcode or street reaches a model', !text.includes('NG9') && !text.includes('High St'))
  ok('no officer\'s name reaches a model', !/SMITH|Jane|John/i.test(text))
}

console.log('\nRESEARCH: A FACT IS ONLY A FACT IF IT CAN BE QUOTED\n')
const PAGE = 'Fresh Co. We install electrics across Nottingham. Download our booking form, fill it in and email it back to us. Call 0115 496 0000.'
const KEYS = REG.map((r) => r.key)
{
  const v = validateResearch({ say: 'They are electricians; email office@fresh.co.uk', facts: [
    { id: 'f1', fact: 'Bookings are by a form emailed back', source: 'page', quote: 'Download our booking form, fill it in and email it back' },
    { id: 'f2', fact: 'They have an app', source: 'page', quote: 'Book instantly in our app' },
    { id: 'f3', fact: 'Micro-entity accounts', source: 'register', register_key: 'r_accounts' },
    { id: 'f4', fact: 'VAT registered', source: 'register', register_key: 'r_vat' },
    { id: 'f5', fact: 'Their number is on the page', source: 'page', quote: 'Call 0115 496 0000' },
    { id: 'f1', fact: 'dup', source: 'register', register_key: 'r_age' },
    { id: 'f6', fact: 'short', source: 'page', quote: 'Fresh Co' },
  ] }, { pageText: PAGE, registerKeys: KEYS })
  ok('a quote that is on the page stands', v.facts.some((f) => f.id === 'f1'))
  ok('a quote that is not on the page is struck', !v.facts.some((f) => f.id === 'f2') && v.struck.some((s) => /f2: its quote is not on the page/.test(s)))
  ok('a register fact must name a line it was given', v.facts.some((f) => f.id === 'f3') && !v.facts.some((f) => f.id === 'f4'))
  ok('a fact carrying a phone number is struck', !v.facts.some((f) => f.id === 'f5') && v.struck.some((s) => /phone/.test(s)))
  ok('an id used twice is struck', v.struck.some((s) => /f1: the id was used twice/.test(s)))
  ok('a two-word quote proves nothing', !v.facts.some((f) => f.id === 'f6'))
  ok('what it passes on in its own words has the address taken out', !/@/.test(v.say) && /electricians/.test(v.say))
  ok('page facts need a page', validateResearch({ facts: [{ id: 'f1', fact: 'x', source: 'page', quote: 'we install electrics across' }] },
    { pageText: null, registerKeys: KEYS }).facts.length === 0)
  ok('quotes survive curly quotes and dashes', quoteOnPage('We install electrics — across Nottingham', 'we install electrics - across nottingham'))
}
const FACTS = [
  { id: 'f1', fact: 'Bookings are by a form emailed back', source: 'page', quote: 'Download our booking form, fill it in and email it back' },
  { id: 'f3', fact: 'Micro-entity accounts', source: 'register', register_key: 'r_accounts' },
]

console.log('\nSIGNALS: EVERY ONE RESTS ON A FACT\n')
{
  const v = validateSignals({ say: 's', signals: [
    { id: 's1', signal: 'Bookings are rekeyed by hand', facts: ['f1'], strength: 'strong' },
    { id: 's2', signal: 'They must hate spreadsheets', facts: ['f9'], strength: 'strong' },
    { id: 's3', signal: 'Small team', facts: ['f3'], strength: 'enormous' },
  ], promote: ['s1', 's3', 's7'] }, { facts: FACTS })
  ok('a signal citing a real fact stands', v.signals.some((s) => s.id === 's1'))
  ok('a signal citing no real fact is dropped', !v.signals.some((s) => s.id === 's2'))
  ok('an unknown strength is read as weak, not trusted', v.signals.find((s) => s.id === 's3')?.strength === 'weak')
  ok('promoting a signal that does not exist is noted', v.struck.some((s) => /s7/.test(s)) && v.promoted.join() === 's1,s3')
  ok('no promote list means every surviving signal goes forward',
    validateSignals({ signals: [{ id: 's1', signal: 'x', facts: ['f1'] }] }, { facts: FACTS }).promoted.join() === 's1')

  const r = validateSignalReview({ verdicts: [{ signal: 's1', verdict: 'overreach', why: 'it says emailed, not rekeyed' }] },
    [{ id: 's1' }, { id: 's3' }])
  ok('the reviewer has to say overreach for a signal to fall', r.objections.join() === 's1' && r.verdicts.get('s3').verdict === 'stands')
  ok('  …and its silence is on the record', r.struck.some((s) => /no verdict on s3/.test(s)))
  ok('an unreadable review lets everything stand, and says so',
    validateSignalReview(null, [{ id: 's1' }]).objections.length === 0 && /not readable/.test(validateSignalReview(null, [{ id: 's1' }]).struck[0]))
}

console.log('\nTHE FIRST REVIEW LOOP: RESEARCH <-> SIGNALS\n')
{
  const moves = []
  const RAW1 = '{"say":"two signals","signals":[{"id":"s1","signal":"Bookings rekeyed","facts":["f1"],"strength":"strong"},{"id":"s2","signal":"Tiny","facts":["f3"],"strength":"strong"}]}'
  const RAW2 = '{"say":"s2 softened","signals":[{"id":"s1","signal":"Bookings rekeyed","facts":["f1"],"strength":"strong"},{"id":"s2","signal":"Small","facts":["f3"],"strength":"possible"}]}'
  let signalCalls = 0
  const seenByRevision = []
  const r = await argueSignals({
    facts: FACTS, researchSay: 'r', reviews: 2,
    callSignals: async ({ review }) => { signalCalls++; if (review) seenByRevision.push(review.objections); return { raw: signalCalls === 1 ? RAW1 : RAW2, parsed: parseJson(signalCalls === 1 ? RAW1 : RAW2), model: 'm' } },
    callReview: async ({ round }) => round === 1
      ? { raw: '{"say":"s2 overreaches","verdicts":[{"signal":"s1","verdict":"stands"},{"signal":"s2","verdict":"overreach","why":"micro is not tiny"}]}',
          parsed: { say: 's2 overreaches', verdicts: [{ signal: 's1', verdict: 'stands' }, { signal: 's2', verdict: 'overreach', why: 'micro is not tiny' }] }, model: 'm' }
      : { raw: '{}', parsed: { say: 'fine', verdicts: [{ signal: 's1', verdict: 'stands' }, { signal: 's2', verdict: 'stands' }] }, model: 'm' },
    onMove: async (m) => { moves.push(m) },
  })
  ok('an objection sends the signals agent back to revise', signalCalls === 2 && seenByRevision[0]?.join() === 's2')
  ok('  …and what survives the last review goes to sales', r.signals.map((s) => s.id).join() === 's1,s2' && r.signals[1].strength === 'possible')
  ok('the exchange is on the record, in order',
    moves.map((m) => `${m.from}>${m.to}:${m.decision}`).join(' ') ===
    'signals>research:proposed research>signals:objected signals>research:revised research>sales:let_stand', moves.map((m) => `${m.from}>${m.to}:${m.decision}`))
  ok('  …word for word', moves[0].said === RAW1 && moves[2].said === RAW2)

  const r2 = await argueSignals({
    facts: FACTS, researchSay: 'r', reviews: 1,
    callSignals: async () => ({ raw: RAW1, parsed: parseJson(RAW1), model: 'm' }),
    callReview: async () => ({ raw: '', parsed: { verdicts: [{ signal: 's2', verdict: 'overreach', why: 'no' }] }, model: 'm' }),
    onMove: async () => {},
  })
  ok('an overreach still standing at the last review is dropped', r2.signals.map((s) => s.id).join() === 's1' && r2.dropped[0]?.id === 's2')

  const r3 = await argueSignals({
    facts: FACTS, researchSay: 'r', reviews: 2,
    callSignals: async () => ({ raw: 'not json', parsed: null, model: 'm' }),
    callReview: async () => { throw new Error('never reviewed when there is nothing to review') },
    onMove: async () => {},
  })
  ok('no signals at all ends it without a review', r3.signals.length === 0 && /promoted nothing/.test(r3.why))
}

console.log('\nSALES BRINGS IN SPECIALISTS\n')
const SIG = [{ id: 's1', signal: 'Bookings rekeyed', facts: ['f1'], strength: 'strong' }, { id: 's2', signal: 'Small', facts: ['f3'], strength: 'possible' }]
const SERVICES = ['ai', 'automation', 'data_analytics', 'software', 'web']
{
  const v = validateSales({ say: 'two', services: [
    { service: 'automation', pitch: 'yours', signals: ['s1'], score: 60 },
    { service: 'crypto', pitch: 'x', signals: ['s1'], score: 90 },
    { service: 'web', pitch: 'x', signals: [], score: 50 },
    { service: 'software', pitch: 'x', signals: ['s2'] },
    { service: 'data_analytics', pitch: 'see acme.co.uk', signals: ['s2'], score: 40 },
    { service: 'automation', pitch: 'again', signals: ['s1'], score: 61 },
  ] }, { signals: SIG, services: SERVICES, max: 3 })
  ok('a service in the portfolio, with signals and a score, is brought in', v.picks.map((p) => p.service).join() === 'automation')
  ok('a service that is not ours is refused', v.struck.some((s) => /crypto/.test(s)))
  ok('a service citing no agreed signal is refused', v.struck.some((s) => /web: cites no/.test(s)))
  ok('no opening score, no specialist', v.struck.some((s) => /software: no opening score/.test(s)))
  ok('a pitch carrying a web address is refused', v.struck.some((s) => /data_analytics: the pitch carries a web address/.test(s)))
  ok('the same service twice is refused', v.struck.some((s) => /twice/.test(s)))
  const cap = validateSales({ services: SERVICES.map((s) => ({ service: s, pitch: 'p', signals: ['s1'], score: 50 })) },
    { signals: SIG, services: SERVICES, max: 2 })
  ok('the cap on services holds', cap.picks.length === 2)
}

console.log('\nONE MOVE IN THE SCORE ARGUMENT\n')
{
  const M = (parsed, who = 'specialist', theirs = 60) => readMove(parsed, { who, theirs, signals: SIG, services: SERVICES, current: 'automation' })
  ok('agreeing means naming their number', M({ verdict: 'agree', score: 60 }).kind === 'agree')
  const wrong = M({ verdict: 'agree', score: 65, signals: ['s1'] })
  ok('"agree" with a different number is a counter', wrong.kind === 'counter' && wrong.score === 65 && /not 60/.test(wrong.guard[0]))
  ok('a counter that names their number is agreement', M({ verdict: 'counter', score: 60, signals: ['s1'] }).kind === 'agree')
  ok('a pass is 0, whatever number came with it', M({ verdict: 'pass', score: 30 }).score === 0)
  ok('a counter citing no signal does not count', M({ verdict: 'counter', score: 80 }).kind === 'none')
  ok('a counter to 0 needs no signal', M({ verdict: 'counter', score: 0 }).kind === 'counter')
  ok('no score, no proposal', M({ verdict: 'counter', signals: ['s1'] }).kind === 'none')
  ok('a score off the scale is no score', M({ verdict: 'counter', score: 140, signals: ['s1'] }).kind === 'none')
  ok('a reply carrying a contact route is refused whole',
    M({ verdict: 'counter', score: 50, signals: ['s1'], confirm_question: 'ring 0115 496 0000' }).kind === 'none')
  ok('  …but the "say" is checked on the way out, not refused',
    M({ say: 'their site is fresh.co.uk', verdict: 'counter', score: 50, signals: ['s1'] }).kind === 'counter')
  ok('a redirect names another real service', M({ verdict: 'redirect', score: 20, signals: ['s1'], redirect_to: 'web' }).redirect_to === 'web')
  ok('  …a redirect to itself is a counter', M({ verdict: 'redirect', score: 20, signals: ['s1'], redirect_to: 'automation' }).kind === 'counter')
  ok('sales cannot pass', readMove({ verdict: 'pass', score: 0 }, { who: 'sales', theirs: 10, signals: SIG, services: SERVICES }).kind === 'counter')
  ok('agreeing before there is a number is a counter',
    readMove({ verdict: 'agree', score: 50, signals: ['s1'] }, { who: 'sales', theirs: null, signals: SIG, services: SERVICES }).kind === 'counter')
}

console.log('\nTHE SECOND REVIEW LOOP: SALES <-> SPECIALIST, UNTIL THEY AGREE\n')
const PICK = { service: 'automation', pitch: 'Bookings come back by email and get rekeyed.', signals: ['s1'], score: 55 }
const script = (lines) => {
  let i = 0
  return async (ctx) => {
    const p = lines[i++]
    if (typeof p === 'function') return p(ctx)
    return { raw: JSON.stringify(p), parsed: p, model: 'fake' }
  }
}
{
  const moves = []
  const seen = []
  const r = await argueService({
    pick: PICK, turns: 6, signals: SIG, services: SERVICES,
    callSpecialist: script([
      (ctx) => { seen.push(ctx.history.map((h) => h.say)); return { raw: '{"say":"70, the form is manual","verdict":"counter","score":70,"signals":["s1"],"confirm_question":"How many forms a week?","walk_away_if":"Fewer than five"}', parsed: { say: '70, the form is manual', verdict: 'counter', score: 70, signals: ['s1'], confirm_question: 'How many forms a week?', walk_away_if: 'Fewer than five' }, model: 'fake' } },
      { say: 'fine, 62', verdict: 'agree', score: 62 },
    ]),
    callSales: script([{ say: '62, it is a micro company', verdict: 'counter', score: 62, signals: ['s2'] }]),
    onMove: async (m) => { moves.push(m) },
  })
  ok('the specialist hears the sales pitch in sales\'s own words', seen[0]?.[0] === PICK.pitch)
  ok('they agree when one takes the other\'s number', r.status === 'agreed' && r.score === 62 && r.turns === 3)
  ok('  …and the call questions come through', r.confirm_question === 'How many forms a week?' && r.walk_away_if === 'Fewer than five')
  ok('every message is logged word for word, addressed to the other',
    moves[0].said.includes('70, the form is manual') && moves[0].to === 'sales' && moves[1].to === 'specialist:automation')
  ok('  …and the agreement is recorded as code\'s reading, not a model\'s claim', /agreed at 62/.test(moves[2].guard))
}
{
  const r = await argueService({
    pick: PICK, turns: 4, signals: SIG, services: SERVICES,
    callSpecialist: script([{ verdict: 'counter', score: 80, signals: ['s1'] }, { verdict: 'counter', score: 78, signals: ['s1'] }]),
    callSales: script([{ verdict: 'counter', score: 50, signals: ['s2'] }, { verdict: 'counter', score: 52, signals: ['s2'] }]),
    onMove: async () => {},
  })
  ok('no agreement in the turns allowed is disputed, with no score', r.status === 'disputed' && r.score === null)
  ok('  …and both last numbers are kept for a person to read', r.sales === 52 && r.specialist === 78)
}
{
  const r = await argueService({
    pick: PICK, turns: 4, signals: SIG, services: SERVICES,
    callSpecialist: script([{ verdict: 'agree', score: 99 }, { verdict: 'counter', score: 58, signals: ['s1'] }]),
    callSales: script([{ verdict: 'agree', score: 12 }, { verdict: 'agree', score: 58 }]),
    onMove: async () => {},
  })
  ok('two false "agree"s do not make an agreement', r.turns === 4 && r.status === 'agreed' && r.score === 58, r)
}
{
  const brought = []
  const r = await argueService({
    pick: PICK, turns: 2, signals: SIG, services: SERVICES,
    callSpecialist: script([{ verdict: 'redirect', score: 10, signals: ['s1'], redirect_to: 'web', say: 'this is a booking flow' }]),
    callSales: script([{ verdict: 'agree', score: 10, bring_in: { service: 'web', pitch: 'they need online booking', signals: ['s1'], score: 60 } }]),
    onMove: async () => {},
    canBringIn: (s) => { brought.push(s); return true },
  })
  ok('a specialist can hand the lead on, and sales can bring that specialist in',
    r.handOns[0]?.service === 'web' && r.handOns[0].score === 60 && brought.join() === 'web')
  ok('  …while still settling its own number', r.status === 'agreed' && r.score === 10)
  const r2 = await argueService({
    pick: PICK, turns: 2, signals: SIG, services: SERVICES,
    callSpecialist: script([{ verdict: 'redirect', score: 10, signals: ['s1'], redirect_to: 'web' }]),
    callSales: script([{ verdict: 'agree', score: 10, bring_in: { service: 'web', pitch: 'p', signals: ['s1'], score: 60 } }]),
    onMove: async () => {}, canBringIn: () => false,
  })
  ok('  …but not past the cap, or twice', r2.handOns.length === 0)
}
{
  const r = await argueService({
    pick: PICK, turns: 2, signals: SIG, services: SERVICES,
    callSpecialist: script([{ verdict: 'pass', say: 'not mine' }]),
    callSales: script([{ verdict: 'agree', score: 0 }]),
    onMove: async () => {},
  })
  ok('a pass that sales accepts is an agreed 0', r.status === 'agreed' && r.score === 0)
}
ok('the conversation handed on is the agents\' own words',
  conversationBlock([{ from: 'sales', say: 'hello', score: 55 }, { from: 'specialist', say: 'no', score: 70 }], 'web')
    === '1. SALES (number: 55):\nhello\n\n2. WEB SPECIALIST (number: 70):\nno')

console.log('\nWHAT THE FIRST LIVE TEST TAUGHT\n')
{
  /* Alcester, 23 September: a dormant company went to the models, a
     takeaway scored 55 for web because no guessed domain existed, and web
     was pitched on an overdue filing. Each rule below is one of those. */

  const s = clampSettings({})
  ok('with no setting, the caution ceiling is 35, not the bottom of its range', s.caution_ceiling === 35, s.caution_ceiling)
  ok('  …a set ceiling is used', clampSettings({ caution_ceiling: 20 }).caution_ceiling === 20)
  ok('  …and a business with no site is parked unless someone switches that off',
    s.require_website === true && clampSettings({ require_website: false }).require_website === false)
  ok('territory areas are read, and anything not shaped like one dropped',
    clampSettings({ territory_areas: ['ng', 'B49', 'nonsense area', 42] }).territory_areas.join() === 'NG,B49')

  const g = domainGuesses('M & H NETWORK & CABLING LTD', 'Alcester')
  ok('"M & H" is guessed as mandh as well as mh', g.includes('mandhnetworkcabling.co.uk') && g.includes('mhnetworkcabling.co.uk'), g)
  ok('  …the "ltd" form is guessed', g.includes('mhnetworkcablingltd.co.uk'))
  ok('  …a one-letter first word is never a domain of its own, or joined to the town', !g.some((d) => /^m(alcester)?\./.test(d)), g)
  const t = domainGuesses('KEBANGING TAKEAWAY LTD', 'Alcester')
  ok('a distinctive first word is guessed alone and with the town', t.includes('kebanging.co.uk') && t.includes('kebangingalcester.co.uk'), t)
  const town = domainGuesses('THE ALCESTER BUILDING SERVICES LTD', 'Alcester')
  ok('  …but never when the first word is the town itself', !town.includes('alcester.co.uk') && !town.some((d) => /alcesteralcester/.test(d)), town)
  ok('  …or a generic word', !domainGuesses('BUILDING WORKS LTD').includes('building.co.uk'))
  ok('  …or a word half the county uses — the live test guessed electro.com for Electro Technical Midlands',
    !domainGuesses('ELECTRO TECHNICAL MIDLANDS LTD', 'Nottingham').some((d) => /^electro(nottingham)?\./.test(d)))
  const bw = domainGuesses('BW PLUMBING & HEATING SOLUTIONS LTD', 'Nottingham')
  ok('the "and" is kept and a generic last word dropped — the live run parked BW Plumbing & Heating Solutions while bwplumbingandheating.co.uk was there',
    bw.includes('bwplumbingandheating.co.uk') && bw.includes('bwplumbingheating.co.uk') && bw.includes('bwplumbingandheatingsolutions.co.uk'), bw)
  ok('  …the .co.uk and .com forms come before any .uk one, so the cap cuts .uk first',
    bw.findIndex((d) => d.endsWith('.uk') && !d.endsWith('.co.uk')) > bw.findLastIndex((d) => d.endsWith('.com')), bw)
  ok('  …but a two-word name keeps its last word: smithcontractors, never smith',
    !domainGuesses('SMITH CONTRACTORS LTD', 'Nottingham').some((d) => /^smith\./.test(d)))
  ok('  …and "& SON" is guessed as andson', domainGuesses('R BRAMLEY & SON LIMITED').includes('rbramleyandson.co.uk'))
  ok('no more than 24 guesses, however long the name',domainGuesses('ALPHA BRAVO AND CHARLIE DELTA ECHO FOXTROT LTD', 'Nottingham').length <= 24)
  ok('a front page is tried bare, then www, then plain http',
    frontPageUrls('www.fresh.co.uk').join() === 'https://fresh.co.uk/,https://www.fresh.co.uk/,http://www.fresh.co.uk/')
  const line = noSiteLine('none of 12 guessed domains exists')
  ok('not finding a site is said as not finding it, never as "none"', /not found by guessing/.test(line) && !/WEBSITE: none/.test(line) && /may have a site/.test(line))

  ok('dormant accounts are refused', /dormant/.test(registerRefusal({ company_status: 'active', accounts: { last_accounts: { type: 'dormant' } } }) ?? ''))
  ok('insolvency history is refused', /insolvency/.test(registerRefusal({ has_insolvency_history: true }) ?? ''))
  ok('a company being struck off is refused', /strike off/.test(registerRefusal({ company_status: 'active', company_status_detail: 'active-proposal-to-strike-off' }) ?? ''))
  ok('a company in liquidation is refused', /liquidation/.test(registerRefusal({ company_status: 'liquidation' }) ?? ''))
  ok('a sound, micro company is not', registerRefusal({ company_status: 'active', accounts: { last_accounts: { type: 'micro-entity' } } }) === null)
  ok('  …and a profile we could not read decides nothing', registerRefusal(null) === null)
  ok('overdue accounts and confirmation statement are cautions', registerCautions({ accounts: { overdue: true }, confirmation_statement: { overdue: true } }).length === 2)
  ok('  …and up to date is none', registerCautions({ accounts: { overdue: false } }).length === 0)
  ok('an accounts type with no meaning is left out of the register lines',
    !registerLines({ company_name: 'X' }, { profile: { accounts: { last_accounts: { type: 'no-accounts-type-available' } } } }).some((l) => l.key === 'r_accounts'))
  ok('  …and a subsidiary filing says so',
    /part of a group/.test(registerLines({ company_name: 'X' }, { profile: { accounts: { last_accounts: { type: 'filing-exemption-subsidiary' } } } }).find((l) => l.key === 'r_accounts')?.text ?? ''))

  const FX = [{ id: 'f1' }, { id: 'f2' }]
  const sv = validateSignals({ signals: [
    { id: 's1', signal: 'Bookings are taken by phone', facts: ['f1'], strength: 'strong', points_to: ['web', 'automation', 'seo'] },
    { id: 's2', signal: 'A filing is overdue', facts: ['f2'], strength: 'strong', caution: true, points_to: ['web'] },
    { id: 's3', signal: 'Something', facts: ['f1'], strength: 'weak' },
  ] }, { facts: FX, services: SERVICES })
  const [s1, s2, s3] = sv.signals
  ok('a signal keeps the services it points to that we sell', s1.points_to.join() === 'web,automation', s1)
  ok('  …and a service we do not sell is struck from it, and said', sv.struck.some((x) => /"seo", not a service we sell/.test(x)))
  ok('a caution points to nothing, whatever it claimed', s2.caution && s2.points_to.length === 0 && sv.struck.some((x) => /s2: a caution points to no service/.test(x)))
  ok('a signal that names no service points to none', Array.isArray(s3.points_to) && s3.points_to.length === 0)
  ok('where a signal points is shown to every agent', /s1 \(strong; points to web, automation\)/.test(signalLines([s1], [])) && /CAUTION/.test(signalLines([s2], [])))

  const DIR = sv.signals
  const web = validatePick({ service: 'web', pitch: 'p', signals: ['s2'], score: 55 }, { signals: DIR, services: SERVICES })
  ok('web pitched on an overdue filing is refused — the first live test', !web.ok && /none of it points to web/.test(web.why), web)
  ok('  …and pitched on a signal that points to web, it stands', validatePick({ service: 'web', pitch: 'p', signals: ['s1', 's2'], score: 55 }, { signals: DIR, services: SERVICES }).ok)
  ok('data pitched on a signal that points elsewhere is refused', !validatePick({ service: 'data_analytics', pitch: 'p', signals: ['s1'], score: 40 }, { signals: DIR, services: SERVICES }).ok)
  const cap = validatePick({ service: 'web', pitch: 'p', signals: ['s1'], score: 55 }, { signals: DIR, services: SERVICES, ceiling: 35 })
  ok('under a caution, an opening score above the ceiling is read as the ceiling, and said', cap.ok && cap.pick.score === 35 && /opened at 55, read as 35/.test(cap.note), cap)

  const R = (parsed, extra = {}) => readMove(parsed, { who: 'specialist', theirs: 35, signals: DIR, services: SERVICES, current: 'web', ...extra })
  ok('a counter for web resting on a signal that does not point to web does not count',
    R({ verdict: 'counter', score: 50, signals: ['s2'] }).kind === 'none')
  ok('  …a counter on a signal that does point there does', R({ verdict: 'counter', score: 30, signals: ['s1'] }).kind === 'counter')
  const clamped = R({ verdict: 'counter', score: 70, signals: ['s1'] }, { ceiling: 35 })
  ok('above the ceiling, a number is read as the ceiling — which here is their number, so agreement',
    clamped.kind === 'agree' && clamped.guard.some((x) => /caps this business at 35/.test(x)), clamped)
  const agreeHigh = R({ verdict: 'agree', score: 90 }, { ceiling: 35 })
  ok('  …"agree" at a number over the ceiling agrees at the ceiling', agreeHigh.kind === 'agree', agreeHigh)
  ok('a pass needs no pointing signal', R({ verdict: 'pass', score: 0 }).kind === 'pass')
  const bring = readMove({ verdict: 'agree', score: 35, bring_in: { service: 'data_analytics', pitch: 'p', signals: ['s1'], score: 40 } },
    { who: 'sales', theirs: 35, signals: DIR, services: SERVICES, current: 'web' })
  ok('sales cannot bring in a service on a signal that does not point to it', !bring.bring_in && bring.guard.some((x) => /could not bring in/.test(x)), bring)

  const one = (sic, extra = {}) => admit({ company: 'X LTD', company_status: 'active', company_type: 'ltd', postcode: 'NG1 1AA', sic: sic.map((c) => `${c} - x`), ...extra })
  ok('a software house is refused: it is in our line of work', /line of work/.test(one(['62012']).why ?? ''))
  ok('  …even when it lists another code first', !one(['43210', '62020']).ok)
  ok('a holding company with nothing else is refused', /holding company/.test(one(['64209']).why ?? ''))
  ok('  …but a builder that also owns its yard is not', one(['41202', '68100']).ok)
  ok('a pull outside the territory is refused by postcode', !admit({ company: 'X', company_status: 'active', company_type: 'ltd', postcode: 'LS9 8AA', sic: [] }, { areas: ['NG', 'B49'] }).ok)
  ok('  …and inside it, let in', admit({ company: 'X', company_status: 'active', company_type: 'ltd', postcode: 'B49 5AA', sic: [] }, { areas: ['NG', 'B49'] }).ok)
  ok('an unknown SIC code is caught before it is sent, where a 404 would end the town', unknownSic(['01620', '0162', '43210', '04']).join() === '01620,04', unknownSic(['01620', '0162', '43210', '04']))
  ok('  …and a real prefix is not', unknownSic(['432']).length === 0 && expandSic(['432']).length > 1)
}


console.log('\nWHAT THE NOTTS RUN TAUGHT: A SECTOR IS NOT A SIGNAL, AND THE CODE SEES WHAT THE AGENTS CANNOT\n')
{
  const today = new Date('2026-09-23T12:00:00Z')
  const home = '<html><head><script src="https://assets.calendly.com/assets/external/widget.js"></script>' +
    '<link rel="stylesheet" href="/wp-content/themes/x/style.css"></head><body>' +
    '<a href="/about-us/">About</a> <a href="/contact-us/">Contact</a> <a href="/careers">Join our team</a>' +
    '<a href="/docs/Credit-Account-Application.pdf">Download</a> <a href="/files/prices_2023.pdf">Price list 2023</a>' +
    '<a href="/files/brochure.pdf">Our brochure</a> <img alt="NICEIC approved contractor" src="/img/niceic.png">' +
    '<p>Email sales@fixture.test, accounts@fixture.test or service@fixture.test, or the owner at fixtureowner@gmail.com</p>' +
    '<footer>&copy; 2019 Fixture Electrical Ltd. Call 0115 496 0000. NG1 5FS</footer></body></html>'
  const words = 'We are a family firm of electricians working across the county on homes and small commercial sites. '.repeat(6)
  const contactBare = `<html><body><h1>Contact</h1><p>${words}</p><a href="mailto:info@fixture.test">Email us</a></body></html>`
  const lines = siteLines([{ url: 'https://fixture.test/', html: home }, { url: 'https://fixture.test/contact-us/', html: contactBare, contact: true }], { today })
  const L = Object.fromEntries(lines.map((l) => [l.key, l.text]))
  ok('a webmail address is measured, though no agent may read the address itself', /free webmail service \(Gmail\)/.test(L.m_webmail ?? ''), L)
  ok('  …three or more role addresses are counted', /4 different role email addresses/.test(L.m_roles ?? ''), L.m_roles)
  ok('  …a form to download and send back is named by its file when its link says only "Download"', /"Credit Account Application" \(PDF\)/.test(L.m_forms ?? ''), L.m_forms)
  ok('  …a price list published as a document, with its year', /"Price list 2023" \(PDF\)/.test(L.m_prices ?? ''), L.m_prices)
  ok('  …a brochure is neither', !/brochure/i.test(`${L.m_forms} ${L.m_prices}`))
  ok('  …an old copyright year, and how old', /says 2019, 7 years ago/.test(L.m_copyright ?? ''), L.m_copyright)
  ok('  …other companies\' products in the code', /Calendly \(booking\)/.test(L.m_tools ?? '') && /WordPress \(site builder\)/.test(L.m_tools ?? ''), L.m_tools)
  ok('  …a trade body shown only as a logo', /NICEIC/.test(L.m_trade ?? ''), L.m_trade)
  ok('  …a careers link', /Join our team/.test(L.m_jobs ?? ''), L.m_jobs)
  ok('  …a contact page with an email link and no form', /email link and has no enquiry form/.test(L.m_contact ?? ''), L.m_contact)
  ok('no measured line carries an email address, phone number, web address or postcode',
    lines.every((l) => !/@[a-z]|0115|fixture\.test|NG1/.test(l.text)), lines)
  const fresh = siteLines([{ url: 'https://f.test/', html: '<footer>© 2025 Fresh Ltd</footer>' }], { today })
  ok('a copyright year a year old is not stale', !fresh.some((l) => l.key === 'm_copyright'), fresh)
  const withForm = siteLines([{ url: 'https://f.test/', html: '<p>x</p>' },
    { url: 'https://f.test/contact', contact: true, html: '<form action="/send"><input type="email" name="e"><textarea name="m"></textarea></form>' }], { today })
  ok('a contact page with a real form says so', withForm.find((l) => l.key === 'm_contact')?.text === 'Their contact page has an enquiry form', withForm)
  const drawn = siteLines([{ url: 'https://f.test/', html: '<p>x</p>' },
    { url: 'https://f.test/contact', contact: true, html: '<div id="root"></div><script src="https://static.parastorage.com/x.js"></script><a href="mailto:a@b.test">e</a>' }], { today })
  ok('  …but "no form" is never said of a page a builder draws in the browser', !drawn.some((l) => l.key === 'm_contact'), drawn)
  ok('nothing read, nothing measured', siteLines([], { today }).length === 0)
  ok('the contact page is found to be measured, on the same host only',
    contactPageLink('<a href="https://other.test/contact">x</a><a href="/Contact-Us/">c</a>', 'https://f.test/') === 'https://f.test/Contact-Us/')

  const v = validateResearch({ facts: [
    { id: 'f1', fact: 'Customers send back a credit account form', source: 'measured', register_key: 'm_forms' },
    { id: 'f2', fact: 'Uses Gmail', source: 'register', register_key: 'm_webmail' },
    { id: 'f3', fact: 'Invented', source: 'measured', register_key: 'm_nonsense' },
  ] }, { pageText: '', registerKeys: ['r_age'], measuredKeys: ['m_forms', 'm_webmail'] })
  ok('a measured line is cited by its key', v.facts[0]?.source === 'measured' && v.facts[0].register_key === 'm_forms', v)
  ok('  …and a measured line cited as "register" is still the measured line', v.facts[1]?.source === 'measured', v)
  ok('  …and a key it was never given is struck', v.facts.length === 2 && v.struck.some((x) => /m_nonsense/.test(x)), v.struck)
  ok('  …and the next agent is told where it came from',
    /measured on their website by code: A form/.test(factLines(v.facts, [], [{ key: 'm_forms', text: 'A form' }])))

  const sv = validateSignals({ signals: [
    { id: 's1', signal: 'They issue test certificates', facts: ['f1'], strength: 'strong', points_to: ['software'], sector: true },
    { id: 's2', signal: 'A credit form comes back by email', facts: ['f1'], strength: 'strong', points_to: ['automation'] },
    { id: 's3', signal: 'Accounts overdue', facts: ['f1'], strength: 'strong', points_to: [], caution: true, sector: true },
  ] }, { facts: [{ id: 'f1' }], services: SERVICES })
  ok('a signal true of the whole sector is weak, whatever it claimed — the live run called "they issue certificates" strong',
    sv.signals[0].sector === true && sv.signals[0].strength === 'weak' && sv.struck.some((x) => /s1: true of the whole sector, so weak, not strong/.test(x)), sv)
  ok('  …a signal about this business is not', sv.signals[1].sector === false && sv.signals[1].strength === 'strong')
  ok('  …a caution is a caution, not a sector', sv.signals[2].sector === false && sv.signals[2].caution === true)
  ok('  …and every agent that argues sees it marked', /s1 \(weak, true of the whole sector; points to software\)/.test(signalLines(sv.signals, [{ id: 'f1', fact: 'x' }])))

  const sigs = [
    { id: 's1', signal: 'Certificates', facts: ['f1'], strength: 'weak', points_to: ['software'], sector: true },
    { id: 's2', signal: 'Engineers on site', facts: ['f1'], strength: 'weak', points_to: ['software'], sector: true },
    { id: 's3', signal: 'Names ServiceM8 and a paper job sheet', facts: ['f1'], strength: 'strong', points_to: ['software'], sector: false },
  ]
  const onlySector = validatePick({ service: 'software', pitch: 'field work', signals: ['s1', 's2'], score: 70 }, { signals: sigs, services: SERVICES, sectorCeiling: 30 })
  ok('a pitch argued only on the sector opens at 30, not the 70 the live run agreed',
    onlySector.ok && onlySector.pick.score === 30 && /opened at 70, read as 30: it rests only on signals true of the whole sector/.test(onlySector.note), onlySector)
  const mixed = validatePick({ service: 'software', pitch: 'x', signals: ['s1', 's3'], score: 70 }, { signals: sigs, services: SERVICES, sectorCeiling: 30 })
  ok('  …one signal about this business in particular lifts the cap', mixed.ok && mixed.pick.score === 70 && !mixed.note, mixed)
  ok('  …the lower of the register\'s and the sector\'s ceilings wins',
    ceilingFor('software', ['s1'], sigs, { ceiling: 35, sectorCeiling: 30 }).at === 30 && ceilingFor('software', ['s1'], sigs, { ceiling: 20, sectorCeiling: 30 }).at === 20)
  const mv = readMove({ verdict: 'counter', score: 65, signals: ['s2'] }, { who: 'specialist', theirs: 30, signals: sigs, services: SERVICES, current: 'software', sectorCeiling: 30 })
  ok('a counter on the sector alone is read at the sector ceiling', mv.score === 30 && mv.kind === 'agree' && mv.guard.some((g) => /true of the whole sector, so read as 30/.test(g)), mv)
  const ag = readMove({ verdict: 'agree', score: 70 }, { who: 'specialist', theirs: 30, signals: sigs, services: SERVICES, current: 'software', sectorCeiling: 30, fallbackCited: ['s1'] })
  ok('  …and an "agree" citing nothing rests on what the pitch rested on', ag.kind === 'agree' && ag.score === 30, ag)
  const r = await argueService({
    pick: { service: 'software', pitch: 'engineers on site', signals: ['s1', 's2'], score: 30 }, turns: 4, signals: sigs, services: SERVICES, sectorCeiling: 30,
    callSpecialist: script([{ verdict: 'counter', score: 70, signals: ['s1'] }]),
    callSales: script([]),
    onMove: async () => {},
  })
  ok('  …so two agents who both want 70 on the sector agree at 30', r.status === 'agreed' && r.score === 30, r)
  ok('with no setting, the sector ceiling is 30, as scoring.md says', clampSettings({}).sector_ceiling === 30 && clampSettings({ sector_ceiling: 40 }).sector_ceiling === 40)
}


console.log('\nTHE REGISTER, READ FURTHER: HEADCOUNT, LATE FILINGS, GROUPS, SIZE\n')
{
  const ctx = (id, end) => `<xbrli:context id="${id}"><xbrli:entity>x</xbrli:entity><xbrli:period><xbrli:startDate>2000-01-01</xbrli:startDate><xbrli:endDate>${end}</xbrli:endDate></xbrli:period></xbrli:context>`
  const ix = (ref, name, v, extra = '') => `<ix:nonFraction contextRef="${ref}" name="${name}" unitRef="u"${extra}>${v}</ix:nonFraction>`
  const doc = `<html>${ctx('prev', '2024-03-31')}${ctx('now', '2025-03-31')}` +
    `${ix('prev', 'core:AverageNumberEmployeesDuringPeriod', '9')}${ix('now', 'uk-core:AverageNumberEmployeesDuringPeriod', '12')}` +
    `${ix('now', 'core:TurnoverRevenue', '1,250', ' scale="3"')}${ix('now', 'core:Creditors', '<span>n/a</span>')}</html>`
  const a = accountsFacts(doc)
  ok('the filed headcount is this year\'s, whatever order the tags come in', a.employees === 12 && a.prior === 9 && a.period_end === '2025-03-31', a)
  ok('  …turnover is read at its scale', a.turnover === 1250000, a)
  ok('  …a page with no inline XBRL gives nothing, not zero', accountsFacts('<html>12 employees</html>') === null)
  const f = lateFilings([
    { category: 'accounts', date: '2025-12-20', description_values: { made_up_date: '2025-03-31' } },
    { category: 'accounts', date: '2024-11-05', description_values: { made_up_date: '2024-01-31' } },
    { category: 'accounts', date: '2023-12-01', description_values: { made_up_date: '2023-01-31' } },
    { category: 'accounts', date: '2016-12-01', description_values: { made_up_date: '2015-12-31' } },
    { category: 'confirmation-statement', date: '2025-01-01', description_values: { made_up_date: '2020-01-01' } },
  ], { incorporated: '2015-01-01', today: new Date('2026-09-24') })
  ok('late filings are counted against nine months, in the last six years, first accounts aside', f.late === 2 && f.of === 3, f)
  ok('  …and the first accounts, which have longer, are never counted late',
    lateFilings([{ category: 'accounts', date: '2021-06-01', description_values: { made_up_date: '2020-06-30' } }],
      { incorporated: '2019-07-01', today: new Date('2026-09-24') }).of === 0)
  const psc = { items: [
    { kind: 'corporate-entity-person-with-significant-control', name: 'PARENT HOLDINGS LTD' },
    { kind: 'individual-person-with-significant-control', name: 'Mr Private Person' },
    { kind: 'corporate-entity-person-with-significant-control', name: 'OLD PARENT LTD', ceased_on: '2020-01-01' },
  ] }
  ok('a controlling company is named; a person with control never is', controllingCompanies(psc).join() === 'PARENT HOLDINGS LTD')
  const lines = registerLines({ company_name: 'X LTD', incorporated_on: '2015-01-01' }, {
    profile: { previous_company_names: [{ name: 'X PLUMBING LTD' }] }, accounts: a, filings: f, psc, today: new Date('2026-09-24'),
  })
  const L = Object.fromEntries(lines.map((l) => [l.key, l.text]))
  ok('the headcount reaches the agents as a register line', /average of 12 employees in the year to 2025-03-31 \(9 the year before\)/.test(L.r_employees ?? ''), L)
  ok('  …late filing twice or more is a timing note, never a need', /2 of the last 3 times/.test(L.r_late_filings ?? '') && /never a need/.test(L.r_late_filings))
  ok('  …the group and the previous name are there', /PARENT HOLDINGS LTD/.test(L.r_parent ?? '') && /X PLUMBING LTD/.test(L.r_previous_names ?? ''))
  ok('  …and no person\'s name is anywhere in them', !/Private Person/.test(JSON.stringify(lines)))
  ok('one late filing is not a pattern', !registerLines({ company_name: 'X' }, { filings: { late: 1, of: 4 } }).some((l) => l.key === 'r_late_filings'))
  ok('over 50 filed employees is refused, as the ICP says', /over the 50/.test(sizeVerdict({ employees: 64 }, ['43210']).refuse ?? ''))
  ok('  …one or two is a caution for a trade', /below the size/.test(sizeVerdict({ employees: 1 }, ['43210']).caution ?? ''))
  ok('  …but not for a professional practice, whose own time is the bottleneck', !sizeVerdict({ employees: 1 }, ['69201']).caution)
  ok('  …and no headcount says nothing either way', !sizeVerdict(null, []).refuse && !sizeVerdict({ employees: null }).caution)
  ok('every address on its own site outside the territory is out of area — Wakefield Driveways traded from WF',
    tradesOutside(['<p>Unit 3, Wakefield WF2 7AB</p>'], ['NG', 'DE']).join() === 'WF2')
  ok('  …one address inside keeps it in, and no address says nothing',
    tradesOutside(['<p>WF2 7AB and NG7 2RD</p>'], ['NG']) === null && tradesOutside(['<p>none</p>'], ['NG']) === null)
  const s = clampSettings({})
  ok('the research loop is on by default, eight turns and up to 150 seconds a business',
    s.lookup_enabled === true && s.lookup_max_steps === 8 && s.lookup_seconds === 150 && clampSettings({ lookup_enabled: false }).lookup_enabled === false)
}

console.log('\nTHE RESEARCH LOOP: NO SEARCH ENGINE, AND NOTHING A MODEL SAYS IS TRUSTED\n')
{
  ok('a domain is normalised from whatever shape it came in', normaliseDomain('HTTPS://www.Fresh.co.uk/about?x=1') === 'fresh.co.uk' && normaliseDomain('not a domain') === null)
  ok('directories and social sites are never their site', isDirectory('m.facebook.com') && isDirectory('checkatrade.com') && !isDirectory('fresh.co.uk'))
  ok('the guesser\'s outcome offers its domains',
    domainsInOutcome('3 of 14 guessed domains exist, none confirmed as theirs — bwplumbing.com: exists but turned us away (403); rbramley.co.uk: does not mention them').join() === 'bwplumbing.com,rbramley.co.uk')
  ok('a page\'s links to other sites are offered, not its own or a directory\'s',
    linkedDomains('<a href="https://sister-co.co.uk/x">s</a><a href="https://www.fresh.co.uk/a">o</a><a href="https://facebook.com/f">f</a>', 'fresh.co.uk').join() === 'sister-co.co.uk')
  const snap = parseAvailability({ archived_snapshots: { closest: { status: '200', available: true, url: 'http://web.archive.org/web/20240524181032/https://woodfloor.co.uk/', timestamp: '20240524181032' } } })
  ok('the Internet Archive\'s answer is read', snap?.date === '2024-05-24' && snap.original === 'https://woodfloor.co.uk/', snap)
  ok('  …and no snapshot is null', parseAvailability({ archived_snapshots: {} }) === null)
  const au = archivedUrl(snap.timestamp, snap.original)
  ok('an archived page is read raw, without the archive\'s toolbar, and can be taken apart again',
    au === 'https://web.archive.org/web/20240524181032id_/https://woodfloor.co.uk/' && readArchivedUrl(au)?.date === '2024-05-24' && readArchivedUrl('https://woodfloor.co.uk') === null)
  const offered = new Set(['fresh.co.uk'])
  ok('a domain nobody offered cannot be checked: no domain comes from a model', !checkCall({ name: 'check_domain', args: { domain: 'invented.co.uk' } }, offered).ok)
  ok('  …a directory cannot, even if offered', !checkCall({ name: 'archived_copy', args: { domain: 'yell.com' } }, new Set(['yell.com'])).ok)
  ok('  …a name carrying a contact route is refused', !checkCall({ name: 'guess_domains', args: { name: 'call 0115 496 0000' } }, offered).ok)
  ok('  …an offered one can', checkCall({ name: 'check_domain', args: { domain: 'www.fresh.co.uk' } }, offered).ok)
  ok('a page is theirs on a postcode or number, name-only on the name, not theirs on a conflict',
    pageVerdict(['postcode', 'company name']) === 'theirs' && pageVerdict(['company name']) === 'name_only' && pageVerdict(['company name'], 'addresses in WF') === 'not_theirs')
  ok('the checker must say "theirs": anything else is no', readChecker({ verdict: 'theirs' }).verdict === 'theirs' && readChecker({ verdict: 'probably' }).verdict === 'unsure')
  const body = investigatorBody({ system: 's', contents: [] })
  ok('the investigator must call a tool every turn, and has no search tool', body.toolConfig.functionCallingConfig.mode === 'ANY'
    && !JSON.stringify(body).includes('googleSearch') && body.tools[0].functionDeclarations.map((t) => t.name).join() === 'register_history,guess_domains,check_domain,archived_copy,conclude')

  const agentSays = (calls) => { let i = 0; const seen = []; return { seen, fn: async (ctx) => { seen.push(ctx); const c = calls[i++] ?? { name: 'conclude', args: { domain: null, why: 'ran out' } }; return { model: 'fake-lite', content: { role: 'model', parts: (Array.isArray(c) ? c : [c]).map((x) => ({ functionCall: x })) } } } } }
  const toolsFor = (pages) => ({
    register_history: async () => ({ previous_names: [{ name: 'BRAMLEY HEATING LTD' }], directors_other_companies: [], controlled_by: [] }),
    guess_domains: async ({ name }) => ({ name, exist: ['bramleyheating.co.uk'], offer: ['bramleyheating.co.uk'] }),
    check_domain: async ({ domain }) => pages[`live:${domain}`] ?? { verdict: 'unreachable', reasons: [] },
    archived_copy: async ({ domain }) => pages[`archived:${domain}`] ?? { verdict: 'none', reasons: [] },
  })
  const moves = []
  const inv = agentSays([
    { name: 'register_history', args: {} },
    { name: 'check_domain', args: { domain: 'bramleyheating.co.uk' } },
    { name: 'guess_domains', args: { name: 'Bramley Heating' } },
    { name: 'conclude', args: { domain: 'bramleyheating.co.uk', how: 'live', why: 'postcode on it' } },
    { name: 'check_domain', args: { domain: 'bramleyheating.co.uk' } },
    { name: 'conclude', args: { domain: 'bramleyheating.co.uk', how: 'live', why: 'postcode on it' } },
  ])
  const r1 = await runLookup({ system: 's', opening: 'THE BUSINESS', offered: ['rbramley.co.uk'], maxSteps: 10, callInvestigator: inv.fn,
    callChecker: async () => ({ verdict: 'theirs' }), onMove: async (m) => moves.push(m),
    tools: toolsFor({ 'live:bramleyheating.co.uk': { verdict: 'theirs', reasons: ['postcode'], url: 'https://bramleyheating.co.uk/', excerpt: 'Heating engineers' } }) })
  ok('the previous name leads to the site, proved by its postcode', r1.found?.domain === 'bramleyheating.co.uk' && r1.found.confirmed_by.join() === 'postcode,found by the research loop', r1)
  ok('  …a domain not yet offered could not be checked, and said so', /has not been offered/.test(moves.find((m) => m.from === 'code' && m.guard)?.guard ?? ''))
  ok('  …a conclusion before the page was read was refused', moves.some((m) => /read live yet: check it before concluding/.test(m.guard ?? '')))
  ok('  …every turn after the first stays with the model that began it', inv.seen.slice(1).every((c) => c.pin === 'fake-lite') && inv.seen[0].pin === null)
  ok('  …the model\'s own parts go back to it verbatim, answered by code', inv.seen[2].contents.some((c) => c.role === 'model' && c.parts[0].functionCall?.name === 'check_domain')
    && inv.seen[2].contents.some((c) => c.parts?.[0]?.functionResponse?.name === 'check_domain'))
  ok('  …and every move is logged, the investigator\'s word for word', moves.filter((m) => m.from === 'investigator').every((m) => /functionCall/.test(m.said)))

  const nameOnly = { verdict: 'name_only', reasons: ['company name'], url: 'https://web.archive.org/web/20240524181032id_/https://rbramley.co.uk/', date: '2024-05-24', excerpt: 'R Bramley & Son, plumbers' }
  const conclude = { name: 'conclude', args: { domain: 'rbramley.co.uk', how: 'archived', why: 'their name, their trade' } }
  const checks = []
  const r2 = await runLookup({ system: 's', opening: 'x', offered: ['rbramley.co.uk'], maxSteps: 8,
    callInvestigator: agentSays([{ name: 'archived_copy', args: { domain: 'rbramley.co.uk' } }, conclude]).fn,
    callChecker: async (a) => { checks.push(a); return { verdict: 'theirs', raw: '{"verdict":"theirs"}', model: 'fake-lite' } },
    onMove: async () => {}, tools: toolsFor({ 'archived:rbramley.co.uk': nameOnly }) })
  ok('a name-only archived match is accepted only when the checker agrees', r2.found?.how === 'archived' && r2.found.confirmed_by.includes('checker agreed') && checks[0]?.verdict === nameOnly)
  const r3 = await runLookup({ system: 's', opening: 'x', offered: ['rbramley.co.uk'], maxSteps: 8,
    callInvestigator: agentSays([{ name: 'archived_copy', args: { domain: 'rbramley.co.uk' } }, conclude, conclude]).fn,
    callChecker: async () => ({ verdict: 'unsure', why: 'no town on the page' }), onMove: async () => {}, tools: toolsFor({ 'archived:rbramley.co.uk': nameOnly }) })
  ok('  …and refused twice by the checker, nothing is found', r3.found === null && /checker twice refused/.test(r3.why), r3)
  const r4 = await runLookup({ system: 's', opening: 'x', maxSteps: 8, callInvestigator: agentSays([{ name: 'conclude', args: { domain: 'guessed.co.uk', how: 'live', why: 'surely' } }, { name: 'conclude', args: { domain: null, why: 'tried the register and two guesses' } }]).fn,
    callChecker: async () => ({ verdict: 'theirs' }), onMove: async () => {}, tools: toolsFor({}) })
  ok('a conclusion naming a domain code never read is refused; "none found" is an answer', r4.found === null && /tried the register/.test(r4.why), r4)
  const r5 = await runLookup({ system: 's', opening: 'x', maxSteps: 3, callInvestigator: agentSays([{ name: 'register_history', args: {} }, { name: 'register_history', args: {} }, { name: 'register_history', args: {} }]).fn,
    callChecker: async () => ({}), onMove: async () => {}, tools: toolsFor({}) })
  ok('the loop ends when its turns do', r5.found === null && /no conclusion in 3 steps/.test(r5.why))
  let t = 0
  const r6 = await runLookup({ system: 's', opening: 'x', maxSteps: 9, deadline: 5, now: () => t++, callInvestigator: agentSays(Array(9).fill({ name: 'register_history', args: {} })).fn,
    callChecker: async () => ({}), onMove: async () => {}, tools: toolsFor({}) })
  ok('  …or its time does, and says so, so the business goes back to the queue', r6.timedOut === true && /out of time/.test(r6.why), r6)
}

console.log('\nWHAT THE 24 SEPTEMBER SAMPLE TAUGHT: CODE SWEEPS, MODELS JUDGE, AI AND WEB FIRST\n')
{
  /* The sites a person found by hand for the sample, that the guesser
     missed. Each must be among the wide guesses for its registered name. */
  const found = [
    ['PURPLE GIRAFFE JOINERY AND INSTALLATIONS LTD', 'Ilkeston', 'pgjoinery.co.uk'],
    ['ADVANCED RESIN TECHNOLOGIES (INTERNATIONAL) LTD', 'Ilkeston', 'artiltd.co.uk'],
    ['ENVO GROUP MEP LTD', 'Ilkeston', 'envogroup.co.uk'],
    ['RAILWAY ELECTRICAL SERVICES LIMITED', 'Ilkeston', 'railwayelectricalservices.co.uk'],
    ['CENTRAL ELECTRICS & SECURITY LIMITED', 'Ilkeston', 'centralelectricsandsecurity.co.uk'],
    ['PFS FIRE & SECURITY LIMITED', 'Nottingham', 'pfs-security.co.uk'],
    ['INFRASTRUCTURE SUPPORT SOLUTIONS LIMITED', 'Nottingham', 'iss-ltd.co.uk'],
    ['ALECT ELECTRICAL SERVICES LIMITED', 'Ilkeston', 'alect.co.uk'],
    ['CARTERS FLOORING (LEISURE) LIMITED', 'Ilkeston', 'carters-flooring.co.uk'],
    ['T4 SUSTAINABILITY LIMITED', 'Ilkeston', 't4sltd.co.uk'],
    ['SOUTH NOTTS (BUILDERS) LTD', 'Ilkeston', 'southnottsbuilders.co.uk'],
    ['FARADAY CHAPMAN LIGHTNING PROTECTION CONSULTANTS LIMITED', 'Nottingham', 'faraday-chapman.com'],
    ['J BARSBY ELECTRICAL LTD', 'Mansfield', 'jb-electrical.co.uk'],
    ['NDL ELECTRICAL INSTALLATIONS LTD', 'Ilkeston', 'ndl-electrical.com'],
  ]
  const missed = found.filter(([n, t, d]) => !wideGuesses([n], t).includes(d))
  ok(`the wide guess reaches all ${found.length} sites found by hand that a name can reach`, !missed.length, missed)
  ok('  …the old guess reached only a few of them', found.filter(([n, t, d]) => domainGuesses(n, t).includes(d)).length <= 3)
  ok('  …and stays a size the DNS can answer in seconds', found.every(([n, t]) => wideGuesses([n], t).length <= 80))
  ok('a previous name is guessed as well', wideGuesses(['ENVO GROUP MEP LTD', 'ENVO ELECTRICAL LTD'], 'Ilkeston').includes('envoelectrical.co.uk'))
  ok('"& son" is tried as "and sons"', nameStems('R BRAMLEY & SON LIMITED').includes('bramleyandsons'))
  ok('no guess is a directory', wideGuesses(['FACEBOOK LTD']).every((d) => !isDirectory(d)))

  const settled = settledInOutcome('4 of 15 guessed domains exist, none confirmed as theirs — diverse.co.uk: a placeholder page; diverseelectricalsolutions.com: unreachable (dns); diverse.com: does not mention them; x.com: exists but turned us away (403)')
  ok('what the guesser already read and put aside is not read again', settled.has('diverse.co.uk') && settled.has('diverse.com'))
  ok('  …but a site that turned it away or did not answer is left for the archive', !settled.has('x.com') && !settled.has('diverseelectricalsolutions.com'))

  const v = sweepVerdict([
    { domain: 'a.co.uk', how: 'live', result: { verdict: 'name_only' } },
    { domain: 'b.co.uk', how: 'live', result: { verdict: 'theirs' } },
    { domain: 'c.co.uk', how: 'live', result: null },
  ])
  ok('a page with their postcode or number is the answer, whatever else was read', v.found?.domain === 'b.co.uk')
  const w = sweepVerdict([{ domain: 'a.co.uk', how: 'live', result: { verdict: 'name_only' } }, { domain: 'd.co.uk', how: 'archived', result: { verdict: 'name_only' } }])
  ok('  …the name alone goes to the checker, most likely first', !w.found && w.nameOnly.map((c) => c.domain).join() === 'a.co.uk,d.co.uk')

  const body = '<p>' + 'We are electricians. '.repeat(20) + '</p>'
  const keys = (pages, o) => siteLines(pages, o).map((l) => l.key)
  ok('a front page with no viewport tag is measured as not made for phones', keys([{ url: 'https://x.co.uk/', html: body }]).includes('m_mobile'))
  ok('  …and one with it is not', !keys([{ url: 'https://x.co.uk/', html: `<meta name="viewport" content="width=device-width">${body}` }]).includes('m_mobile'))
  ok('a site served only over plain HTTP is measured', keys([{ url: 'http://www.x.co.uk/', html: body }]).includes('m_https'))
  ok('WordPress 4 is out of date, WordPress 6 is not', Boolean(staleGenerator('WordPress 4.5.2')) && !staleGenerator('WordPress 6.6'))
  ok('the generator tag is read in either attribute order', generatorOf('<meta content="Joomla! 1.5 - Open Source" name="generator">') === 'Joomla! 1.5 - Open Source')
  ok('a site builder is named', siteLines([{ url: 'https://x.co.uk/', html: `<img src="https://static.wixstatic.com/a.png">${body}` }]).some((l) => l.key === 'm_builder' && /Wix/.test(l.text)))
  ok('none of it is said of an archived copy: that is how the site was, not is', !keys([{ url: 'http://www.x.co.uk/', html: `<meta name="generator" content="WordPress 4.1">${body}` }], { archived: true }).some((k) => ['m_mobile', 'm_https', 'm_stale'].includes(k)))
  const faq = ['How long does a rewire take?', 'Do you give free quotes?', 'Are you NICEIC registered?', 'Can you test a rental?', 'What areas do you cover?', 'Do you do emergency callouts?']
  ok('six questions answered in writing are measured as an FAQ', keys([{ url: 'https://x.co.uk/', html: body + faq.map((q) => `<h3>${q}</h3>`).join('') }]).includes('m_faq'))
  ok('  …five are not', !keys([{ url: 'https://x.co.uk/', html: body + faq.slice(0, 5).map((q) => `<h3>${q}</h3>`).join('') }]).includes('m_faq'))

  const inBuilding = { company_name: 'CAPITAL CITY SOLUTIONS LIMITED', postcode: 'NG10 1NJ', company_number: '06602984' }
  const it = confirms(`<p>${'Managed IT support and cabling. '.repeat(10)}</p><p>Lyndhurst, 1 Cranmer Street, Long Eaton NG10 1NJ</p>`, inBuilding)
  ok('their postcode alone is not proof: another business in the same building (the Long Eaton accountant\'s)', !it.reasons.length && it.sharedAddress === true, it)
  const pg = confirms(`<h1>PG Joinery</h1><p>Purple Giraffe fire doors, Ilkeston DE7 4HD</p>`, { company_name: 'PURPLE GIRAFFE JOINERY AND INSTALLATIONS LTD', postcode: 'DE7 4HD' })
  ok('  …with a distinctive word of the name, it is', pg.reasons.includes('postcode'), pg)
  ok('  …and the company number still settles it on its own', confirms('<p>Registered in England 06602984</p>', inBuilding).reasons.includes('company number'))
  /* 25 September: a trade word is not a distinctive word. */
  const dl = confirms(`<h1>Midsco</h1><p>Commercial air conditioning and mechanical services. Unit 4, Nottingham NG6 0BJ</p>`, { company_name: 'D L MECHANICAL NOTTM LTD', postcode: 'NG6 0BJ', town: 'Nottingham' })
  ok('their postcode and a trade word of the name ("mechanical") is not proof', !dl.reasons.length && dl.sharedAddress === true, dl)
  const px = confirms(`<title>TrueTech Integrated</title><p>Security installations and integrated specialists. Gedling NG4 1ES</p>`, { company_name: 'PHOENIX SECURITY INSTALLATIONS LTD', postcode: 'NG4 1ES', town: 'Nottingham' })
  ok('  …nor two ("security installations", on a sister company\'s site)', !px.reasons.length && px.sharedAddress === true, px)
  const tv = confirms(`<p>Trent Valley Accountants, Nottingham NG2 1AB</p>`, { company_name: 'TRENT VALLEY PLUMBING & BUILDING LIMITED', postcode: 'NG2 1AB', town: 'Nottingham' })
  ok('  …nor a place in it ("valley")', !tv.reasons.length && tv.sharedAddress === true, tv)
  /* 25 September: NDL Electrical Installations Ltd is "NDL Electrical" on
     its own site, which the sweep read and put down as not theirs. */
  const ndl = { company_name: 'NDL ELECTRICAL INSTALLATIONS LTD', postcode: 'DE7 8AA', town: 'Ilkeston' }
  ok('the name they trade under, the registered one with its end left off, is a name match', confirms(`<h1>NDL Electrical</h1><p>${'Domestic and commercial electricians, NICEIC approved. '.repeat(6)}</p>`, ndl).reasons.join() === 'their trading name')
  ok('  …only a name match: the checker still decides', pageVerdict(confirms(`<h1>NDL Electrical</h1>`, ndl).reasons) === 'name_only')
  ok('  …a namesake far away is still not theirs', confirms(`<h1>NDL Electrical</h1><p>Unit 2, Glasgow G1 1AA</p>`, ndl).conflict)
  ok('  …with their postcode, it is proof', pageVerdict(confirms(`<h1>NDL Electrical</h1><p>Ilkeston DE7 8AA</p>`, ndl).reasons) === 'theirs')
  ok('  …the part in brackets is left off too ("Carters Flooring")', tradingName('CARTERS FLOORING (LEISURE) LIMITED').includes('cartersflooring'))
  ok('  …but never down to trade and place words alone', tradingName('CENTRAL ELECTRICS & SECURITY LIMITED').length === 0 && tradingName('TRENT VALLEY PLUMBING & BUILDING LIMITED', 'Nottingham').length === 0)
  /* 25 September: registered in DE, trading from NG. */
  const snPage = `<h1>South Notts (Builders) Ltd</h1><p>${'Extensions and renovations across Nottingham. '.repeat(6)}</p><p>Unit 3, West Bridgford NG2 7AA</p>`
  const snCand = { company_name: 'SOUTH NOTTS (BUILDERS) LTD', postcode: 'DE7 5AA', town: 'Ilkeston' }
  const sn = confirms(snPage, snCand, { near: true })
  ok('in the research loop, a trading address in the next postcode area over is not a different company: the checker decides', !sn.conflict && sn.reasons.length > 0 && pageVerdict(sn.reasons) === 'name_only', sn)
  ok('  …the guesser, which has no checker, still wants the same area before it takes a name alone', Boolean(confirms(snPage, snCand).conflict))
  ok('  …one a long way off is a different company to both', Boolean(confirms(`<h1>South Notts (Builders) Ltd</h1><p>Unit 3, Plymouth PL1 2AA</p>`, snCand, { near: true }).conflict))
  const reread = settledInOutcome('3 of 11 guessed domains exist, none confirmed as theirs — southnottsbuilders.co.uk: a different company with the same name, the page\'s addresses are all in NG, not DE; southnotts.com: a different company with the same name, the only phone numbers on the page are North American')
  ok('  …and the loop reads again what the guesser put aside only for its address', !reread.has('southnottsbuilders.co.uk') && reread.has('southnotts.com'))
  /* 25 September: fourteen short, taken domains read before artiltd.co.uk. */
  const order = readOrder(['art.co.uk', 'art.com', 'advancedresintechnologies.com', 'artuk.co.uk', 'nei.com', 'artiltd.co.uk'])
  ok('longer, name-shaped domains are read before short ones, which are almost always taken', order.join() === 'advancedresintechnologies.com,artiltd.co.uk,art.co.uk,art.com,artuk.co.uk,nei.com', order)
  ok('AI and web are what we lead with, by default', clampSettings({}).service_focus.join() === 'ai,web')
  ok('  …a service key that is not a key is dropped', clampSettings({ service_focus: ['web', 'DROP TABLE', 'ai'] }).service_focus.join() === 'web,ai')
  const cfg = { knowledge: [{ key: 'automation', kind: 'service', label: 'Automation' }, { key: 'web', kind: 'service', label: 'Web' }, { key: 'ai', kind: 'service', label: 'AI' }] }
  const pb = portfolioBlock(cfg, ['ai', 'web'])
  ok('every agent sees the services we lead with first, and marked', pb.indexOf('SERVICE ai') < pb.indexOf('SERVICE web') && pb.indexOf('SERVICE web') < pb.indexOf('SERVICE automation') && /SERVICE ai — AI \(we lead with this\)/.test(pb))
  ok('sales is told to lead with them, and that it may not stretch a signal to', /WE LEAD WITH AI AND WEB/.test(focusLine(['ai', 'web'])) && /refused/.test(focusLine(['ai', 'web'])))
  ok('  …and with no focus set, nothing is said', focusLine([]) === '')
}

console.log('\nTHE BUSINESS\'S SCORE\n')
{
  const o = outcome([
    { service: 'automation', status: 'agreed', score: 62, sales: 62, specialist: 62, turns: 3 },
    { service: 'web', status: 'disputed', score: null, sales: 80, specialist: 30, turns: 6 },
    { service: 'ai', status: 'agreed', score: 0, turns: 2 },
  ])
  ok('the lead scores its best agreed service', o.status === 'scored' && o.lead_score === 62)
  ok('  …a disputed service contributes nothing, however high either side went', o.lead_score !== 80)
  ok('only disputes means disputed, with no score', outcome([{ service: 'web', status: 'disputed', score: null }]).status === 'disputed'
    && outcome([{ service: 'web', status: 'disputed', score: null }]).lead_score === null)
  ok('only agreed zeros means no fit', outcome([{ service: 'ai', status: 'agreed', score: 0 }]).status === 'no_fit')
  ok('no services at all means no fit', outcome([]).status === 'no_fit')
}

console.log('\nNO AGENT READS A WAY TO REACH THEM\n')
{
  const page = 'We fit kitchens across the county. Call 0115 496 0000 or email hello@example.co.uk, ' +
    'see www.example.co.uk/contact, visit us at NG1 5FS. Established 2004, 12 staff.'
  const r = redactContactRoutes(page)
  ok('an email address is removed from the page', !/@/.test(r), r)
  ok('  …and a phone number', !/0115/.test(r), r)
  ok('  …and a web address', !/example\.co\.uk/.test(r), r)
  ok('  …and a real UK postcode', !/NG1 5FS/.test(r), r)
  ok('  …and what the business does is left to read', /fit kitchens/.test(r) && /12 staff/.test(r), r)
  ok('  …and a postcode-shaped word that is no UK area is left alone', redactContactRoutes('model GQ1 2AB') === 'model GQ1 2AB')
}

console.log(`\n${fail ? fail + ' failed' : 'all prospector checks passed'}`)
process.exit(fail ? 1 : 0)
