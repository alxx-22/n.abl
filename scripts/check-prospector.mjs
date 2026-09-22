#!/usr/bin/env node
/* The lead-gen agents' rules and loops, driven with fake agents.

   Imports supabase/functions/lead-prospector/prospect.mjs - the file the
   deployed function imports - unmodified. No key, no network.

     npm run test:prospector */

import {
  clampSettings, quotaScope, domainGuesses, pageKind, parseRobots, confirms, sameSiteLinks,
  stripHtml, registerLines, quoteOnPage, validateResearch, validateSignals, validateSignalReview,
  argueSignals, validateSales, readMove, argueService, outcome, parseJson, conversationBlock,
} from '../supabase/functions/lead-prospector/prospect.mjs'
import { quotaScope as outreachQuotaScope } from '../supabase/functions/outreach-writer/guards.mjs'

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

console.log(`\n${fail ? fail + ' failed' : 'all prospector checks passed'}`)
process.exit(fail ? 1 : 0)
