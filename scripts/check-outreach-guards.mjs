#!/usr/bin/env node
/* ============================================================
   THE GUARDS IN THE OUTREACH WRITER, TESTED

   Three models negotiate over what a stranger reads first. Everything
   they are allowed to think - the vocabulary, the models, the
   thresholds, the prompts - is rows in the database, editable without
   a deploy. The guards are the part that is not.

   This imports supabase/functions/outreach-writer/guards.mjs DIRECTLY.
   Not a copy, not an extraction: the same file the edge function
   imports, which is why guards.mjs is plain JavaScript with no Deno in
   it. The previous version sliced TypeScript out of index.ts and
   stripped the annotations with a list of string replacements, and
   every restructure broke it. A test that can drift from the thing it
   tests is worse than no test, because it reports green.

   WHAT IS UNDER TEST

     1. A term the registry marks needs_evidence, used without a quote
        that is literally on the page, is DEMOTED - and the guard finds
        out which term to demote to by asking the registry, so it never
        names one.
     2. A fit that demands evidence cannot stand on a confidence that
        does not. The expensive one: without it a sector prior saying
        "care homes usually have rota problems" becomes "this care home
        definitely has rota problems", and we are wrong in the first
        sentence a stranger reads.
     3. An angle the editor can promote must already have been checked
        against the page, because the editor never sees the page.
     4. A clause may not contain a number nobody supplied.
     5. The negotiation terminates, never re-offers a refused angle,
        and never loses the reason a lead came to nothing. This one is
        here because index.ts needs Deno and cannot be run on a machine
        that has only Node - so the loop was moved into guards.mjs
        specifically to be testable, and the agents are callbacks.

     node scripts/check-outreach-guards.mjs
   ============================================================ */
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const {
  makeVocab, coerce, applyRequirement, validateServices, validateAngles,
  validatePromotion, validateClause, buildFacts, detectSignals, clampSettings, ENVELOPE,
  negotiate, validateReview, chooseDraft, registryBlock,
} = await import(`file://${join(ROOT, 'supabase', 'functions', 'outreach-writer', 'guards.mjs')}`)

let fail = 0
const ok = (n, c, d = '') => {
  console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${n}${c ? '' : '  → ' + d}`)
  if (!c) fail++
}

/* The registry as the live migration seeds it. Deliberately restated
   rather than fetched: this test has to run without a database, and
   what it is testing is that the guards obey whatever registry they
   are handed - not that this particular registry is right. The names
   below could all be different and every assertion should still pass. */
const VOCAB = makeVocab({
  category: [
    { term: 'save_time', rank: 0, meaning: '' },
    { term: 'understand_data', rank: 0, meaning: '' },
  ],
  capability: [
    { term: 'automation', rank: 0, meaning: 'work happens on its own' },
    { term: 'web', rank: 0, meaning: 'the public-facing thing' },
  ],
  fit: [
    { term: 'ruled_out', rank: 0, meaning: '' },
    { term: 'unlikely', rank: 1, meaning: '' },
    { term: 'possible', rank: 2, meaning: '', is_default: true },
    { term: 'strong', rank: 3, meaning: '', needs_evidence: true },
  ],
  confidence: [
    { term: 'guessed', rank: 0, meaning: '', is_default: true },
    { term: 'inferred', rank: 1, meaning: '' },
    { term: 'observed', rank: 2, meaning: '', needs_evidence: true },
  ],
  technical_capacity: [
    { term: 'unlikely', rank: 0, meaning: '' },
    { term: 'mixed', rank: 1, meaning: '', is_default: true },
    { term: 'likely', rank: 2, meaning: '' },
  ],
  credit: [
    { term: 'assist', rank: 0, meaning: '', is_default: true },
    { term: 'build', rank: 1, meaning: '' },
    { term: 'educate', rank: 2, meaning: '', requires_dimension: 'technical_capacity', requires_min_rank: 1 },
  ],
})

const PAGE = 'Mountford House Nursery. Places are limited so please call the office to arrange a visit. Our fees are set out in the parent handbook.'
const base = { rationale: 'r', confirm_question: 'q', disqualifier: 'd' }

console.log('\nEVIDENCE CHECKING\n')
let r = validateServices(VOCAB, [{ ...base, category: 'save_time', fit: 'strong', confidence: 'observed',
  evidence: 'please call the office to arrange a visit' }], PAGE)
ok('a real quote keeps the evidence-backed terms',
  r.services[0].confidence === 'observed' && r.services[0].fit === 'strong')

r = validateServices(VOCAB, [{ ...base, category: 'save_time', fit: 'strong', confidence: 'observed',
  evidence: 'we use a paper diary for every booking' }], PAGE)
ok('a FABRICATED quote is demoted and the quote discarded',
  r.services[0].confidence === 'inferred' && r.services[0].evidence === null)
ok('  …and the fit falls to the strongest term needing no evidence', r.services[0].fit === 'possible')
ok('  …and the demotion is recorded', /is on the page/.test(r.notes.join(' ')))

console.log('\nTHE EXPENSIVE FAILURE MODE\n')
for (const c of ['inferred', 'guessed']) {
  r = validateServices(VOCAB, [{ ...base, category: 'understand_data', fit: 'strong', confidence: c }], PAGE)
  ok(`a ${c} verdict can never reach the evidence-backed fit`, r.services[0].fit === 'possible')
}
r = validateServices(VOCAB, [{ ...base, category: 'save_time', fit: 'strong', confidence: 'observed', evidence: 'anything' }], null)
ok('with no page at all, nothing can be observed',
  r.services[0].confidence === 'inferred' && r.services[0].fit === 'possible')

console.log('\nTHE GUARD DOES NOT KNOW THE WORDS\n')
/* The same registry with every term renamed and the ranks reordered.
   If any assertion below fails, a term name has leaked into the rules
   and a change to the vocabulary would silently stop being enforced. */
const ALIEN = makeVocab({
  category: [{ term: 'aaa', rank: 0, meaning: '' }],
  fit: [
    { term: 'nope', rank: 0, meaning: '' },
    { term: 'maybe', rank: 1, meaning: '', is_default: true },
    { term: 'certain', rank: 2, meaning: '', needs_evidence: true },
  ],
  confidence: [
    { term: 'hunch', rank: 0, meaning: '', is_default: true },
    { term: 'seen_it', rank: 1, meaning: '', needs_evidence: true },
  ],
})
r = validateServices(ALIEN, [{ ...base, category: 'aaa', fit: 'certain', confidence: 'seen_it',
  evidence: 'not on this page at all' }], PAGE)
ok('a renamed vocabulary is enforced exactly the same way',
  r.services[0].confidence === 'hunch' && r.services[0].fit === 'maybe')
r = validateServices(ALIEN, [{ ...base, category: 'aaa', fit: 'certain', confidence: 'seen_it',
  evidence: 'Our fees are set out in the parent handbook' }], PAGE)
ok('  …and a real quote still survives it', r.services[0].fit === 'certain')

console.log('\nTHE FIELDS THAT MAKE IT A HYPOTHESIS\n')
r = validateServices(VOCAB, [{ category: 'save_time', fit: 'possible', confidence: 'inferred',
  rationale: 'r', confirm_question: '', disqualifier: 'd' }], PAGE)
ok('no confirm_question means the verdict is dropped entirely', r.services.length === 0)
r = validateServices(VOCAB, [{ category: 'save_time', fit: 'possible', confidence: 'inferred',
  rationale: 'r', confirm_question: 'q', disqualifier: '' }], PAGE)
ok('no disqualifier means it is dropped entirely', r.services.length === 0)

console.log('\nJUNK\n')
r = validateServices(VOCAB, [{ ...base, category: 'make_tea', fit: 'strong', confidence: 'observed', evidence: 'x' }], PAGE)
ok('an invented category is rejected', r.services.length === 0 && /unknown category/.test(r.notes.join(' ')))
r = validateServices(VOCAB, [
  { ...base, category: 'save_time', fit: 'possible', confidence: 'inferred' },
  { ...base, category: 'save_time', fit: 'strong', confidence: 'inferred' }], PAGE)
ok('a duplicate category is rejected', r.services.length === 1 && /duplicate/.test(r.notes.join(' ')))
r = validateServices(VOCAB, [{ ...base, category: 'save_time', fit: 'enormous', confidence: 'certain' }], PAGE)
ok('out-of-vocabulary terms fall back to the registry default',
  r.services[0].fit === 'possible' && r.services[0].confidence === 'guessed')
ok('a non-array does not throw', validateServices(VOCAB, 'not an array', PAGE).services.length === 0)
ok('coerce keeps a known term', coerce(VOCAB, 'fit', 'unlikely') === 'unlikely')
ok('coerce falls back on junk', coerce(VOCAB, 'fit', 'lovely') === 'possible')

console.log('\nCREDITS AGAINST CAPACITY\n')
let notes = []
ok('training credits survive where there is somebody to train',
  applyRequirement(VOCAB, 'credit', 'educate', { technical_capacity: 'likely' }, notes) === 'educate')
notes = []
const downgraded = applyRequirement(VOCAB, 'credit', 'educate', { technical_capacity: 'unlikely' }, notes)
ok('training credits are impossible where nobody would attend', downgraded === 'build')
ok('  …and the change is explained', /needs technical_capacity/.test(notes.join(' ')))
notes = []
ok('an unassessed capacity also blocks it',
  applyRequirement(VOCAB, 'credit', 'educate', {}, notes) === 'build')
notes = []
ok('a credit with no requirement passes straight through',
  applyRequirement(VOCAB, 'credit', 'assist', { technical_capacity: 'unlikely' }, notes) === 'assist' && notes.length === 0)

console.log('\nTHE CASES THE EDITOR IS ALLOWED TO SEE\n')
const FACTS = [{ key: 'long_established', fact: 'Trading 22 years.', angle: 'a', evidence: 'Companies House' }]
let a = validateAngles(VOCAB, [
  { key: 'real', claim: 'c', why: 'w', risk: 'k', basis: 'page', quote: 'Places are limited' },
  { key: 'fake', claim: 'c', why: 'w', risk: 'k', basis: 'page', quote: 'we still use paper' },
  { key: 'reg', claim: 'c', why: 'w', risk: 'k', basis: 'register', fact_key: 'long_established' },
  { key: 'badreg', claim: 'c', why: 'w', risk: 'k', basis: 'register', fact_key: 'cqc_registered' },
  { key: 'norisk', claim: 'c', why: 'w', basis: 'page', quote: 'Places are limited' },
], { pageText: PAGE, facts: FACTS, max: 8 })
ok('an angle quoting the page survives', a.angles.some((x) => x.key === 'real'))
ok('an angle quoting something NOT on the page is dropped', !a.angles.some((x) => x.key === 'fake'))
ok('an angle citing a supplied register fact survives', a.angles.some((x) => x.key === 'reg'))
ok('an angle citing a fact nobody supplied is dropped', !a.angles.some((x) => x.key === 'badreg'))
ok('an angle with no named risk is dropped', !a.angles.some((x) => x.key === 'norisk'))
a = validateAngles(VOCAB, [
  { key: 'a', claim: 'c', why: 'w', risk: 'k', basis: 'page', quote: 'Places are limited' },
  { key: 'a', claim: 'c', why: 'w', risk: 'k', basis: 'page', quote: 'parent handbook' },
], { pageText: PAGE, facts: FACTS, max: 8 })
ok('a duplicate angle key is dropped', a.angles.length === 1)
a = validateAngles(VOCAB, Array.from({ length: 9 }, (_, i) => (
  { key: `k${i}`, claim: 'c', why: 'w', risk: 'k', basis: 'page', quote: 'parent handbook' })),
  { pageText: PAGE, facts: FACTS, max: 4 })
ok('the number of angles is capped', a.angles.length === 4)
ok('no angles at all does not throw', validateAngles(VOCAB, null, { pageText: PAGE, facts: FACTS, max: 4 }).angles.length === 0)

console.log('\nWHAT THE EDITOR IS ALLOWED TO PROMOTE\n')
const ANGLES = [
  { key: 'one', claim: 'c', basis: 'page', quote: 'Places are limited', risk: 'k' },
  { key: 'two', claim: 'c', basis: 'register', fact_key: 'long_established', risk: 'k' },
]
ok('promoting a case that was argued works',
  validatePromotion({ promote: 'one', because: 'b', brief: 'br' }, ANGLES, []).ok === true)
ok('promoting a case that was NEVER argued is refused',
  validatePromotion({ promote: 'invented', because: 'b' }, ANGLES, []).ok === false)
ok('promoting nothing is a legitimate answer, and is not an error',
  validatePromotion({ promote: null, because: 'all generic' }, ANGLES, []).ok === false)
ok('re-promoting something the writer handed back is refused',
  validatePromotion({ promote: 'one', because: 'b' }, ANGLES, ['one']).ok === false)

console.log('\nTHE CLAUSE\n')
const SET = { min_words: 6, max_words: 45 }
const ANGLE = { basis: 'page', quote: 'Places are limited so please call the office to arrange a visit', key: 'one' }
const cl = (o, angle = ANGLE, facts = FACTS) => validateClause(o, { angle, facts, settings: SET })
ok('a good clause passes',
  cl({ observation: 'noticed visits are arranged by ringing the office, which usually means somebody keeps that diary' }).ok)
ok('a refusal is reported as a refusal, not a failure',
  cl({ refuse: 'cannot say this without implying criticism' }).refused === true)
ok('too short is rejected', cl({ observation: 'you take bookings' }).ok === false)
ok('too long is rejected', cl({ observation: 'word '.repeat(60).trim() }).ok === false)
ok('a capitalised opening is rejected',
  cl({ observation: 'Noticed visits are arranged by ringing the office and somebody keeps that diary' }).ok === false)
ok('a full stop at the end is rejected',
  cl({ observation: 'noticed visits are arranged by ringing the office and somebody keeps a diary.' }).ok === false)
ok('naming a person is rejected',
  cl({ observation: 'noticed Mrs Hopkins arranges the visits herself and keeps that diary by hand' }).ok === false)
ok('a number nobody supplied is rejected',
  cl({ observation: 'noticed you have been arranging visits by phone since 1998 and somebody keeps that diary' }).ok === false)
ok('  …but a number that IS in the material passes',
  cl({ observation: 'you have been doing this 22 years, which is long enough that the diary predates anyone asking why',
       basis: 'register' }, { basis: 'register', fact_key: 'long_established', key: 'two' }).ok)
ok('an angle carrying no usable evidence is rejected',
  cl({ observation: 'noticed visits are arranged by ringing the office and somebody keeps that diary' },
     { basis: 'register', fact_key: 'nothing_supplied', key: 'x' }).ok === false)
ok('an empty reply is rejected', cl({}).ok === false)
ok('the evidence returned is the quote the editor promoted',
  cl({ observation: 'noticed visits are arranged by ringing the office, which usually means somebody keeps that diary' })
    .evidence === ANGLE.quote)

console.log('\nREGISTER FACTS FROM ROWS\n')
const RULES = [
  { key: 'old_no_site', min_trading_years: 10, requires_website: false, fact_template: 'Trading {years} years. No website could be found.', angle: 'a', evidence_template: 'Companies House' },
  { key: 'old', min_trading_years: 15, fact_template: 'Trading {years} years.', angle: 'a', evidence_template: 'Companies House' },
  { key: 'sic', requires_industry: true, fact_template: 'Recorded activity: {industry}.', angle: 'a', evidence_template: 'SIC: {industry}' },
]
let f = buildFacts(RULES, { trading_years: 22, website: null, industry: 'Child day-care activities' })
ok('a long-established lead with no site gets both year facts', f.some((x) => x.key === 'old_no_site') && f.some((x) => x.key === 'old'))
ok('  …and the years are substituted', f[0].fact.includes('22'))
ok('  …and the SIC fact carries its own evidence string',
  f.find((x) => x.key === 'sic').evidence === 'SIC: Child day-care activities')
f = buildFacts(RULES, { trading_years: 22, website: 'https://x.test', industry: null })
ok('a lead WITH a website does not get the no-website fact', !f.some((x) => x.key === 'old_no_site'))
ok('  …and no industry means no SIC fact', !f.some((x) => x.key === 'sic'))
f = buildFacts(RULES, { trading_years: 3, website: null, industry: null })
ok('a young business gets neither year fact', f.length === 0)
ok('unknown trading years does not satisfy a minimum',
  buildFacts(RULES, { trading_years: null, website: null, industry: null }).length === 0)

console.log('\nPAGE SOURCE PATTERNS\n')
let d = detectSignals([
  { key: 'booking', pattern: 'calendly', flags: 'i', description: 'a booking tool is embedded' },
  { key: 'broken', pattern: '([unclosed', flags: 'i', description: 'never matches' },
], '<script src="https://CALENDLY.com/x"></script>')
ok('a pattern from the table matches case-insensitively', d.found.includes('a booking tool is embedded'))
ok('  …and reports its key, which is what the score is computed from',
  d.keys.length === 1 && d.keys[0] === 'booking')
ok('a pattern that will not compile is skipped, not fatal', d.notes.length === 1 && /will not compile/.test(d.notes[0]))

console.log('\nTHE ENVELOPE THE SETTINGS CANNOT LEAVE\n')
let c = clampSettings({ max_words: 10000, min_words: 0, max_rounds: 99, batch_size: 0, user_agent: '  ' })
ok('max_words cannot be set high enough to disable the length check', c.max_words <= ENVELOPE.max_words[1])
ok('min_words cannot be set to zero', c.min_words >= ENVELOPE.min_words[0])
ok('rounds cannot be set high enough to burn the day allowance', c.max_rounds <= ENVELOPE.max_rounds[1])
ok('batch size cannot be zero', c.batch_size >= 1)
ok('an empty user agent falls back to an identifying one', /nabl/.test(c.user_agent))
c = clampSettings({ max_words: 'banana' })
ok('a non-numeric setting does not produce NaN', Number.isFinite(c.max_words))
c = clampSettings({ min_words: 20, max_words: 20 })
ok('min and max words cannot collapse onto each other', c.max_words > c.min_words)

console.log('\nTHE NEGOTIATION\n')

/* Fakes for the three agents. No models, no network: what is under
   test is the handoff, which is where a loop like this goes wrong. */
const A = [
  { key: 'one', claim: 'c', basis: 'page', quote: 'q1', risk: 'k' },
  { key: 'two', claim: 'c', basis: 'page', quote: 'q2', risk: 'k' },
]
const promoter = (order) => {
  let i = 0
  return async ({ refusals }) => {
    while (i < order.length && refusals.some((r) => r.key === order[i])) i++
    const key = order[i]
    const angle = A.find((a) => a.key === key)
    return angle
      ? { ok: true, angle, because: 'b', brief: 'br', model: 'fake-editor' }
      : { ok: false, because: 'nothing left worth promoting', model: 'fake-editor' }
  }
}
const run = (callEditor, callWriter, maxRounds = 2) => {
  const log = []
  return negotiate({
    angles: A, summary: 's', maxRounds, callEditor, callWriter,
    onRound: (m) => log.push(`${m.round}:${m.agent}:${m.decision}:${m.angle_key ?? '-'}`),
  }).then((r) => ({ ...r, log }))
}

let n = await run(promoter(['one', 'two']),
  async ({ angle }) => ({ ok: true, observation: 'x', basis: 'page', evidence: angle.quote, model: 'fake-writer' }))
ok('a clause on the first round ends it there', n.ok && n.rounds === 1)
ok('  …and the argument is logged in order',
  n.log.join(' ') === '1:editor:promoted:one 1:writer:wrote:one', n.log.join(' '))

let offered = []
n = await run(promoter(['one', 'two']), async ({ angle, round }) => {
  offered.push(angle.key)
  return round === 1
    ? { ok: false, refused: true, why: 'cannot say this without implying criticism', model: 'fake-writer' }
    : { ok: true, observation: 'x', basis: 'page', evidence: angle.quote, model: 'fake-writer' }
})
ok('a refusal sends the editor back for a different case', n.ok && n.rounds === 2)
ok('  …and the writer is never offered the refused one twice',
  offered.join(',') === 'one,two', offered.join(','))
ok('  …and the refusal is recorded', n.log.includes('1:writer:refused:one'))

n = await run(promoter(['one', 'two']),
  async () => ({ ok: false, refused: true, why: 'all generic', model: 'fake-writer' }))
ok('refusing everything gives up rather than looping', !n.ok && n.rounds === 2)
ok('  …and both refusals are carried out', n.refusals.length === 2)
ok('  …and the reason survives to the caller', /all generic/.test(n.why))

n = await run(promoter(['one', 'two']),
  async () => ({ ok: false, refused: false, why: 'not a lower-case clause', model: 'fake-writer' }))
ok('a shape failure is NOT a refusal and stops immediately', !n.ok && n.rounds === 1)
ok('  …and it is logged as rejected, not refused', n.log.includes('1:writer:rejected:one'))

n = await run(async () => ({ ok: false, because: 'everything on offer is generic', model: 'fake-editor' }),
  async () => { throw new Error('the writer must never be called when nothing was promoted') })
ok('the editor promoting nothing is an answer, not a crash', !n.ok && /generic/.test(n.why))

n = await run(promoter(['one', 'two']),
  async ({ angle }) => ({ ok: true, observation: 'x', basis: 'page', evidence: angle.quote, model: 'fake-writer' }), 1)
ok('max_rounds of 1 means exactly one attempt', n.rounds === 1)

let calls = 0
n = await run(promoter(['one', 'two']), async () => {
  calls++
  return { ok: false, refused: true, why: 'no', model: 'fake-writer' }
}, 4)
ok('the loop cannot outlast the cases the scout argued', calls === 2 && !n.ok)

console.log('\nTHE REVISION ROUND\n')

/* By the time a clause reaches review it has already passed every
   guard. So the reviewer may ask for a change and may not veto, and a
   revision that fails must never cost us the draft we already had. */
ok('an accepted draft stands', validateReview({ verdict: 'accept' }).accept === true)
ok('a reviewer that returns junk is treated as acceptance',
  validateReview(null).accept === true && validateReview('nope').accept === true)
ok('  …and says so, so the silence is on the record',
  /did not answer usably/.test(validateReview(null).note))
ok('"revise" with no instruction is acceptance, not a veto',
  validateReview({ verdict: 'revise', change: '   ' }).accept === true)
ok('  …and that is recorded too',
  /without saying what to change/.test(validateReview({ verdict: 'revise' }).note))
let rv = validateReview({ verdict: 'revise', change: 'cut the second clause', because: 'two things' })
ok('a real instruction is passed through', rv.accept === false && rv.change === 'cut the second clause')
ok('the reviewer has no way to reject outright',
  validateReview({ verdict: 'reject', change: 'bin it' }).accept === true)

const first = { ok: true, observation: 'first', model: 'm' }
const better = { ok: true, observation: 'second', model: 'm' }
ok('a revision that passed is the one that ships',
  chooseDraft(first, better).clause.observation === 'second')
ok('a revision that FAILED never loses the original',
  chooseDraft(first, { ok: false, why: 'names a person' }).clause.observation === 'first')
ok('  …and the reason survives', /names a person/.test(chooseDraft(first, { ok:false, why:'names a person' }).why))
ok('no revision at all keeps the original', chooseDraft(first, null).clause.observation === 'first')

const ANG = [{ key: 'one', claim: 'c', basis: 'page', quote: 'q1', risk: 'k' }]
const editorAlways = async () => ({ ok: true, angle: ANG[0], because: 'b', brief: 'br', model: 'fake-editor' })
function runRev(callReview, writerFn, maxRevisions = 1) {
  const log = []
  return negotiate({
    angles: ANG, summary: 's', maxRounds: 2, maxRevisions,
    callEditor: editorAlways, callWriter: writerFn, callReview,
    onRound: (m) => log.push(`${m.agent}:${m.decision}`),
  }).then((r) => ({ ...r, log }))
}
const writesOnce = async (a) => ({
  ok: true, model: 'fake-writer',
  observation: a.revise ? 'the revised clause' : 'the first clause',
  basis: 'page', evidence: 'q1',
})

let rr = await runRev(async () => ({ parsed: { verdict: 'accept', because: 'reads well' }, model: 'fake-editor' }), writesOnce)
ok('an accepted first draft ships unchanged',
  rr.ok && rr.clause.observation === 'the first clause' && rr.revisions === 0)
ok('  …and the acceptance is logged', rr.log.join(' ').includes('editor:accepted'))

rr = await runRev(async () => ({ parsed: { verdict: 'revise', change: 'drop the adverb' }, model: 'fake-editor' }), writesOnce)
ok('a requested change produces a revised clause',
  rr.ok && rr.clause.observation === 'the revised clause' && rr.revisions === 1)
ok('  …and the whole exchange is on the record',
  rr.log.join(' ') === 'editor:promoted writer:wrote editor:asked_for_a_change writer:revised', rr.log.join(' '))

let writerCalls = 0
rr = await runRev(
  async () => ({ parsed: { verdict: 'revise', change: 'sharpen it' }, model: 'fake-editor' }),
  async (a) => { writerCalls++; return a.revise
    ? { ok: false, why: 'uses a number nobody supplied: 2003', model: 'fake-writer' }
    : { ok: true, observation: 'the first clause', basis: 'page', evidence: 'q1', model: 'fake-writer' }; })
ok('a FAILED revision keeps the first draft rather than losing the lead',
  rr.ok && rr.clause.observation === 'the first clause')
ok('  …and the editor\'s objection stays on the record for the human gate',
  rr.log.join(' ').includes('writer:revision_failed'))
ok('  …and it does not try again', writerCalls === 2)

rr = await runRev(async () => ({ parsed: { verdict: 'revise', change: 'again' }, model: 'fake-editor' }),
  async (a) => ({ ok: true, model: 'm', basis: 'page', evidence: 'q1',
                  observation: a.revise ? 'rev' + Math.random() : 'first' }), 1)
ok('max_revisions of 1 means exactly one revision', rr.revisions === 1)

rr = await runRev(null, writesOnce)
ok('with no reviewer wired the loop behaves exactly as before',
  rr.ok && rr.clause.observation === 'the first clause' && rr.revisions === 0)
ok('  …and nothing extra is logged',
  rr.log.join(' ') === 'editor:promoted writer:wrote', rr.log.join(' '))

const capped = clampSettings({ max_revisions: 99 })
ok('revisions cannot be set high enough to burn the day allowance',
  capped.max_revisions <= ENVELOPE.max_revisions[1])

console.log('\nCAPABILITY \u2014 WHOSE DESK IT LANDS ON\n')

r = validateServices(VOCAB, [{ ...base, category: 'save_time', capability: 'automation',
  fit: 'possible', confidence: 'inferred' }], PAGE)
ok('a real capability is kept', r.services[0].capability === 'automation')
r = validateServices(VOCAB, [{ ...base, category: 'save_time', capability: 'blockchain',
  fit: 'possible', confidence: 'inferred' }], PAGE)
ok('an invented capability becomes null rather than a wrong desk',
  r.services[0].capability === null)
r = validateServices(VOCAB, [{ ...base, category: 'save_time', fit: 'possible', confidence: 'inferred' }], PAGE)
ok('a missing capability is null, never defaulted', r.services[0].capability === null)
ok('  \u2026and the verdict still stands without one', r.services.length === 1)

console.log('\nTHE PROMPT BLOCK COMES FROM THE REGISTRY\n')
const block = registryBlock(VOCAB, [
  { dimension: 'capability', heading: 'CAPABILITY' },
  { dimension: 'fit', heading: 'FIT' },
])
ok('only the dimensions the registry names are described',
  block.indexOf('CAPABILITY') > -1 && block.indexOf('FIT') > -1 && block.indexOf('CONFIDENCE') === -1)
ok('  \u2026in the order given', block.indexOf('CAPABILITY') < block.indexOf('FIT'))
ok('a dimension with no terms is skipped rather than left as a bare heading',
  registryBlock(VOCAB, [{ dimension: 'nonexistent', heading: 'GHOST' }]) === '')
ok('no dimensions at all does not throw', registryBlock(VOCAB, null) === '')

console.log(`\n${fail ? fail + ' failed' : 'all guard checks passed'}`)
process.exit(fail ? 1 : 0)
