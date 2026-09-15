/* ============================================================
   THE GUARDS

   Everything in this file is pure: values in, values out, no network,
   no Deno, no database. That is not tidiness. scripts/check-outreach-guards.mjs
   imports THIS FILE, unmodified, as the thing it tests - so the tests
   cannot pass while the deployed guards differ, and there is no
   extraction step to break when the code moves.

   WHAT IS DATA AND WHAT IS CODE

   The vocabulary is data. Which terms exist, what they mean, how they
   rank, which of them demand evidence - all rows in
   public.outreach_vocabulary, all editable without a deploy.

   The rules are here, and they name no term. "A term marked
   needs_evidence may not be used without a quote that is literally on
   the page" is a rule. "observed requires evidence" is a rule with a
   word baked into it, and the word changes.

   That separation is the whole design. A guard that the thing it
   guards can edit is not a guard, so the registry can say anything it
   likes about what the words mean and cannot say that an unsourced
   claim is allowed.
   ============================================================ */

/* The one deliberately static thing in the system.

   public.outreach_setting can tune every number the run uses. This is
   the range each is allowed to be tuned WITHIN. A setting should make
   the system faster, slower, more or less talkative; it should not be
   able to switch off a check by being set to zero, and max_words set
   to 10000 would do exactly that. Editable dials, fixed stops. */
export const ENVELOPE = {
  batch_size: [1, 25],
  max_page_chars: [1000, 40000],
  fetch_timeout_ms: [2000, 30000],
  model_timeout_ms: [5000, 60000],
  max_rounds: [1, 4],
  max_revisions: [0, 3],
  min_words: [4, 20],
  max_words: [20, 60],
  max_angles: [1, 8],
  prior_min_sample: [3, 500],
}

export const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

export function clampSettings(raw) {
  const out = {}
  for (const [key, [lo, hi]] of Object.entries(ENVELOPE)) {
    const n = Number(raw?.[key])
    out[key] = Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : lo
  }
  /* Not a number, so not clamped - only defaulted. Sending an empty
     user agent would be worse manners than sending a wrong one. */
  const ua = typeof raw?.user_agent === 'string' ? raw.user_agent.trim() : ''
  out.user_agent = ua || 'n.abl-research/1.0 (+https://nabl.agency)'
  if (out.min_words >= out.max_words) out.max_words = out.min_words + 10
  return out
}

/* ---------- the registry, wrapped ---------- */

export function makeVocab(vocabulary) {
  const byDim = new Map()
  for (const [dim, terms] of Object.entries(vocabulary ?? {})) {
    const list = (Array.isArray(terms) ? terms : [])
      .filter((t) => t && typeof t.term === 'string')
      .map((t) => ({
        term: t.term,
        rank: Number(t.rank) || 0,
        meaning: String(t.meaning ?? ''),
        needs_evidence: t.needs_evidence === true,
        is_default: t.is_default === true,
        requires_dimension: t.requires_dimension || null,
        requires_min_rank: t.requires_min_rank == null ? null : Number(t.requires_min_rank),
      }))
      .sort((a, b) => a.rank - b.rank || a.term.localeCompare(b.term))
    byDim.set(dim, list)
  }

  const terms = (dim) => byDim.get(dim) ?? []
  const get = (dim, term) => terms(dim).find((t) => t.term === term) ?? null

  return {
    dimensions: () => [...byDim.keys()],
    terms,
    get,
    has: (dim, term) => get(dim, term) !== null,
    rank: (dim, term) => get(dim, term)?.rank ?? null,
    needsEvidence: (dim, term) => get(dim, term)?.needs_evidence === true,

    /* The honest fallback when the model said something unusable.
       Marked in the registry rather than derived, because the safe
       answer is not the same shape in every dimension: the weakest fit
       is "ruled out", which is a claim about the business and not a
       shrug, whereas the weakest confidence genuinely is one. */
    fallback(dim) {
      const list = terms(dim)
      if (!list.length) return null
      return (list.find((t) => t.is_default) ?? list[0]).term
    },

    /* The strongest thing sayable without producing a quote. This is
       what a failed evidence check demotes to, and the reason no guard
       below has to know the word "possible". */
    strongestUngated(dim) {
      const open = terms(dim).filter((t) => !t.needs_evidence)
      return open.length ? open[open.length - 1].term : null
    },

    /* Rendered into the prompts, so the prompts do not repeat the
       vocabulary and adding a category is one INSERT. */
    describe(dim, heading) {
      const list = terms(dim)
      if (!list.length) return ''
      const lines = [`${heading}:`]
      for (const t of list) {
        lines.push(`  ${t.term}${t.needs_evidence ? ' [requires a verbatim quote]' : ''} — ${t.meaning}`)
      }
      return lines.join('\n')
    },
  }
}

export function coerce(vocab, dim, value, fallback) {
  if (typeof value === 'string' && vocab.has(dim, value)) return value
  if (fallback && vocab.has(dim, fallback)) return fallback
  return vocab.fallback(dim)
}

/* ---------- the two rules that matter ---------- */
/*
   1. A term that demands evidence, used without a quote that is
      literally on the business's own page, is DEMOTED - not dropped.
      A claim that said "the page shows this" and cannot show where is
      not worthless; it is an inference that overstated itself, and
      recording it as an inference keeps the analysis and loses only
      the overstatement.

   2. A fit that demands evidence cannot stand on a confidence that
      does not. This is the expensive one. Without it a sector prior
      saying "care homes usually have rota problems" becomes "this care
      home definitely has rota problems", we write to them about a
      problem we invented, and we are wrong in the first sentence a
      stranger ever reads from us. That does not come back.
*/
export function applyEvidenceRules(vocab, { fit, confidence, evidence }, pageText, notes, label) {
  let f = fit, c = confidence, e = evidence

  if (vocab.needsEvidence('confidence', c)) {
    if (!e || !pageText || !norm(pageText).includes(norm(e))) {
      const down = vocab.strongestUngated('confidence')
      notes.push(`${label}: "${c}" claimed without a quote that is on the page — down to "${down}"`)
      c = down
      e = null
    }
  }

  if (vocab.needsEvidence('fit', f) && !vocab.needsEvidence('confidence', c)) {
    const down = vocab.strongestUngated('fit')
    notes.push(`${label}: "${f}" needs observed evidence and has none — down to "${down}"`)
    f = down
  }

  return { fit: f, confidence: c, evidence: e }
}

/* A term can require another dimension to have reached a rank. Today
   that is training credits requiring somebody technical to train: a
   training day booked for people who will not attend is money burned,
   and in a small town it is a refund and a lost reputation. Written
   generically because the next such rule should be a row, not a
   release. */
export function applyRequirement(vocab, dim, term, assessed, notes) {
  const spec = vocab.get(dim, term)
  if (!spec?.requires_dimension) return term

  const have = vocab.rank(spec.requires_dimension, assessed?.[spec.requires_dimension])
  if (have != null && have >= spec.requires_min_rank) return term

  const allowed = vocab.terms(dim).filter((t) => {
    if (!t.requires_dimension) return true
    const r = vocab.rank(t.requires_dimension, assessed?.[t.requires_dimension])
    return r != null && r >= t.requires_min_rank
  })
  const down = allowed.length ? allowed[allowed.length - 1].term : vocab.fallback(dim)
  notes.push(
    `${dim} "${term}" needs ${spec.requires_dimension} at rank ${spec.requires_min_rank} ` +
    `and this business is "${assessed?.[spec.requires_dimension] ?? 'unassessed'}" — changed to "${down}"`,
  )
  return down
}

/* ---------- verdicts ---------- */

export function validateServices(vocab, raw, pageText) {
  const notes = []
  const out = []
  const seen = new Set()

  for (const r of Array.isArray(raw) ? raw : []) {
    const c = String(r?.category ?? '')
    if (!vocab.has('category', c)) { notes.push(`unknown category "${c}"`); continue }
    if (seen.has(c)) { notes.push(`duplicate category ${c}`); continue }
    seen.add(c)

    const { fit, confidence, evidence } = applyEvidenceRules(vocab, {
      fit: coerce(vocab, 'fit', r?.fit),
      confidence: coerce(vocab, 'confidence', r?.confidence),
      evidence: typeof r?.evidence === 'string' && r.evidence.trim() ? r.evidence.trim() : null,
    }, pageText, notes, c)

    const rationale = String(r?.rationale ?? '').trim()
    const confirm = String(r?.confirm_question ?? '').trim()
    const disq = String(r?.disqualifier ?? '').trim()
    /* The two fields that make this a hypothesis instead of a score.
       Every disqualifying signal in service-categories.md is learned in
       a conversation and invisible from a homepage, so a verdict with
       no question and no walk-away is a guess with a number attached. */
    if (!rationale || !confirm || !disq) {
      notes.push(`${c}: missing rationale, question or disqualifier — dropped`)
      continue
    }

    out.push({ category: c, fit, confidence, rationale, evidence, confirm_question: confirm, disqualifier: disq })
  }
  return { services: out, notes }
}

/* ---------- the cases the scout argues ---------- */
/*
   Verified here, once, before the editor ever sees them. The editor is
   deliberately blind to the page, so it cannot check a quote itself;
   this is what makes that blindness safe rather than negligent.
*/
export function validateAngles(vocab, raw, { pageText, facts, max }) {
  const notes = []
  const out = []
  const seen = new Set()
  const factKeys = new Set((facts ?? []).map((f) => f.key))

  for (const a of Array.isArray(raw) ? raw : []) {
    const key = String(a?.key ?? '').trim().slice(0, 60)
    if (!key) { notes.push('angle with no key — dropped'); continue }
    if (seen.has(key)) { notes.push(`duplicate angle "${key}"`); continue }

    const claim = String(a?.claim ?? '').trim()
    const why = String(a?.why ?? '').trim()
    const risk = String(a?.risk ?? '').trim()
    /* An angle whose risk the scout could not name is one it has not
       thought about, and the editor cannot weigh what it is not told. */
    if (!claim || !why || !risk) {
      notes.push(`angle "${key}": missing claim, reason or risk — dropped`)
      continue
    }

    const basis = a?.basis === 'register' ? 'register' : 'page'
    let quote = null, factKey = null

    if (basis === 'page') {
      quote = typeof a?.quote === 'string' ? a.quote.trim() : ''
      if (!quote || !pageText || !norm(pageText).includes(norm(quote))) {
        notes.push(`angle "${key}": quote is not on the page — dropped`)
        continue
      }
    } else {
      factKey = String(a?.fact_key ?? '').trim()
      if (!factKeys.has(factKey)) {
        notes.push(`angle "${key}": cites register fact "${factKey}" which was not supplied — dropped`)
        continue
      }
    }

    const category = vocab.has('category', a?.category) ? a.category : null
    seen.add(key)
    out.push({ key, claim, why, risk, basis, quote, fact_key: factKey, category })
    if (out.length >= max) break
  }
  return { angles: out, notes }
}

/* ---------- what the editor came back with ---------- */

export function validatePromotion(raw, angles, refused) {
  const promote = typeof raw?.promote === 'string' ? raw.promote.trim() : ''
  const because = String(raw?.because ?? '').trim()
  const brief = String(raw?.brief ?? '').trim()

  if (!promote) return { ok: false, because: because || 'the editor promoted nothing' }

  const angle = angles.find((a) => a.key === promote)
  /* Promoting something that was never argued means the editor invented
     an angle, which is the one thing its blindness to the page makes
     dangerous. Refused rather than repaired. */
  if (!angle) return { ok: false, because: `editor promoted "${promote}", which is not one of the cases argued` }
  if (refused?.includes(promote)) {
    return { ok: false, because: `editor re-promoted "${promote}" after the writer handed it back` }
  }
  return { ok: true, angle, because, brief }
}

/* ---------- the clause a stranger reads ---------- */

export function validateClause(raw, { angle, facts, settings }) {
  if (typeof raw?.refuse === 'string' && raw.refuse.trim()) {
    return { ok: false, refused: true, why: raw.refuse.trim().slice(0, 300) }
  }
  const obs = String(raw?.observation ?? '').trim()
  if (!obs) return { ok: false, refused: false, why: 'the writer returned nothing' }

  const words = obs.split(/\s+/).length
  if (words < settings.min_words) return { ok: false, refused: false, why: 'clause too short to be specific' }
  if (words > settings.max_words) return { ok: false, refused: false, why: 'clause too long to be one thing' }
  if (/^[A-Z]/.test(obs)) return { ok: false, refused: false, why: 'not a lower-case clause' }
  if (/\.\s*$/.test(obs)) return { ok: false, refused: false, why: 'ends as a sentence, not a clause' }
  /* A name moves the record into a lawful basis this programme has not
     been assessed for. See first-contact-letter.md §1. */
  if (/\b(mr|mrs|ms|miss|dr)\b\.?\s+[A-Z]/i.test(obs)) {
    return { ok: false, refused: false, why: 'names a person' }
  }

  /* Every digit in the clause has to have come from somewhere. This is
     what stops "trading since 2003" appearing for a business whose
     incorporation year nobody supplied - the most plausible-sounding
     falsehood this stage can produce, and the hardest to spot in a
     draft because it reads like research. */
  const material = [angle?.quote ?? '', ...(facts ?? []).map((f) => f.fact)].join(' ')
  const invented = (obs.match(/\d+/g) ?? []).filter((n) => !material.includes(n))
  if (invented.length) {
    return { ok: false, refused: false, why: `uses a number nobody supplied: ${invented.join(', ')}` }
  }

  const basis = angle?.basis === 'register' ? 'register' : 'page'
  const evidence = basis === 'page'
    ? angle.quote
    : (facts ?? []).find((f) => f.key === angle?.fact_key)?.evidence

  /* The database will refuse an observation with no evidence anyway.
     Catching it here means the lead is retried rather than the run
     dying on a constraint. */
  if (!evidence) return { ok: false, refused: false, why: 'the promoted angle carries no evidence' }

  return { ok: true, observation: obs, basis, evidence }
}

/* ---------- register facts, from rows ---------- */

export function buildFacts(rules, lead) {
  const out = []
  const years = lead?.trading_years ?? null
  const industry = lead?.industry ?? null
  const hasSite = Boolean(lead?.website)

  for (const r of Array.isArray(rules) ? rules : []) {
    if (r?.min_trading_years != null && (years == null || years < r.min_trading_years)) continue
    if (r?.max_trading_years != null && (years == null || years > r.max_trading_years)) continue
    if (r?.requires_website === true && !hasSite) continue
    if (r?.requires_website === false && hasSite) continue
    if (r?.requires_industry === true && !industry) continue
    if (r?.requires_industry === false && industry) continue

    const fill = (s) => String(s ?? '')
      .split('{years}').join(String(years ?? ''))
      .split('{industry}').join(String(industry ?? ''))

    out.push({
      key: r.key,
      fact: fill(r.fact_template),
      angle: String(r.angle ?? ''),
      evidence: fill(r.evidence_template),
    })
  }
  return out
}

/* ---------- what the page source gives away ---------- */
/*
   Matched here rather than asked of a model, because a script tag is a
   fact and a model's opinion about one is not. A pattern that will not
   compile is skipped and reported: one bad row in a table anybody can
   edit must not take the run down.
*/
export function detectSignals(signals, html) {
  const found = []
  const keys = []
  const notes = []
  for (const s of Array.isArray(signals) ? signals : []) {
    try {
      if (new RegExp(s.pattern, s.flags || 'i').test(html)) {
        found.push(s.description)
        /* The key as well as the prose. The description is what the
           scout reads; the key is what the score is computed from, and
           a score has to be able to show what matched. */
        if (s.key) keys.push(s.key)
      }
    } catch {
      notes.push(`page signal "${s?.key}" has a pattern that will not compile — skipped`)
    }
  }
  return { found, keys, notes }
}

/* ---------- the editor reading the draft ---------- */
/*
   The reviewer's ONLY moves are accept and revise. It may not reject.

   That asymmetry is deliberate. By the time a clause reaches review it
   has already passed every guard: its quote is on the page, its digits
   came from the material, it names nobody, it is the right shape. A
   reviewer that could veto that would be re-litigating checks that
   already ran, and the over-strict editor that refused the first four
   leads of the day is what happens when a judging agent is handed a
   veto and no floor.

   So an objection it cannot turn into a better sentence becomes a note
   on the record instead - visible in the argument log, in front of a
   person at the gate, which is where "this reads badly to me" belongs.
*/
export function validateReview(raw) {
  if (!raw || typeof raw !== 'object') {
    /* A reviewer that answered nothing usable must not cost us a draft
       that already passed. Silence is acceptance. */
    return { accept: true, note: 'the reviewer did not answer usably, so the draft stands' }
  }
  const verdict = String(raw.verdict ?? '').trim().toLowerCase()
  const change = String(raw.change ?? '').trim()
  const note = String(raw.because ?? raw.note ?? '').trim()

  if (verdict !== 'revise') return { accept: true, note }
  if (!change) {
    return { accept: true, note: note || 'asked for a revision without saying what to change' }
  }
  return { accept: false, change, note }
}

/* Which of the two sentences ships.

   The revision only wins if it passed every guard. A revision that
   broke one is not a reason to lose the draft we already had - the
   loop exists to improve output, and a version of it that can reduce
   output is worse than not having it. */
export function chooseDraft(original, revised) {
  if (revised && revised.ok) return { clause: revised, revised: true }
  return {
    clause: original,
    revised: false,
    why: revised ? (revised.why || 'the revision did not pass') : 'no revision was produced',
  }
}

/* ---------- the negotiation ---------- */
/*
   The loop the three agents argue in, with the model calls injected.

   It lives here rather than in index.ts for one reason: index.ts needs
   Deno and cannot be run on a machine that only has Node, so anything
   inside it is verified by deploying and hoping. The handoff between
   the editor and the writer is the part of this system with the most
   ways to go subtly wrong - promoting a refused angle, looping forever,
   losing the reason a lead failed - and it is much too important to be
   tested by watching the live queue.

   So the agents are callbacks, the loop is pure, and scripts/check-outreach-guards.mjs
   drives it with fakes.
*/
export async function negotiate({
  angles, summary, maxRounds, maxRevisions,
  callEditor, callWriter, callReview, onRound,
}) {
  const refusals = []
  let why = 'no round produced a clause'

  for (let round = 1; round <= maxRounds; round++) {
    const e = await callEditor({ angles, summary, refusals, round })
    if (!e.ok) {
      await onRound?.({ round, agent: 'editor', model: e.model, decision: 'promoted_nothing', reason: e.because })
      return { ok: false, why: e.because || 'the editor promoted nothing', rounds: round, refusals }
    }
    await onRound?.({
      round, agent: 'editor', model: e.model, decision: 'promoted',
      angle_key: e.angle.key, reason: [e.because, e.brief && `brief: ${e.brief}`].filter(Boolean).join(' — '),
    })

    const w = await callWriter({ angle: e.angle, brief: e.brief ?? '', round })
    if (w.ok) {
      await onRound?.({ round, agent: 'writer', model: w.model, decision: 'wrote', angle_key: e.angle.key, reason: w.observation })

      /* ---- refinement: the editor now reads the SENTENCE ---- */
      let clause = w
      let revisions = 0
      while (callReview && revisions < (maxRevisions || 0)) {
        const rv = await callReview({ angle: e.angle, brief: e.brief ?? '', draft: clause, round })
        const verdict = validateReview(rv && rv.parsed)

        if (verdict.accept) {
          await onRound?.({
            round, agent: 'editor', model: rv && rv.model, decision: 'accepted',
            angle_key: e.angle.key, reason: verdict.note || 'the sentence does the job',
          })
          break
        }

        await onRound?.({
          round, agent: 'editor', model: rv && rv.model, decision: 'asked_for_a_change',
          angle_key: e.angle.key, reason: verdict.change,
        })

        const rw = await callWriter({
          angle: e.angle, brief: e.brief ?? '', round,
          revise: { previous: clause.observation, change: verdict.change },
        })
        const picked = chooseDraft(clause, rw)
        revisions++

        if (picked.revised) {
          clause = picked.clause
          await onRound?.({
            round, agent: 'writer', model: rw.model, decision: 'revised',
            angle_key: e.angle.key, reason: rw.observation,
          })
        } else {
          /* The objection stands on the record even though the sentence
             did not change. A person reads it at the gate. */
          await onRound?.({
            round, agent: 'writer', model: rw && rw.model, decision: 'revision_failed',
            angle_key: e.angle.key,
            reason: `${picked.why} — keeping the earlier draft, which the editor wanted changed: ${verdict.change}`,
          })
          break
        }
      }

      return { ok: true, clause, angle: e.angle, rounds: round, revisions, refusals }
    }

    await onRound?.({
      round, agent: 'writer', model: w.model,
      decision: w.refused ? 'refused' : 'rejected', angle_key: e.angle.key, reason: w.why,
    })
    why = w.why ?? 'the writer produced nothing usable'

    /* Only a REASONED refusal sends the editor back for another case.
       A clause that broke a shape rule is the writer's mistake and not
       the angle's; re-promoting the same angle would be the right move
       and is not worth a second model call to hear the same brief, so
       it stops here and the lead is retried on a later tick. */
    if (!w.refused) return { ok: false, why, rounds: round, refusals }
    refusals.push({ key: e.angle.key, why })
  }

  return { ok: false, why, rounds: maxRounds, refusals }
}
