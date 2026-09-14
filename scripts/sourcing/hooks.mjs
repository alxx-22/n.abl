#!/usr/bin/env node
/* ============================================================
   THE FACTS A HOOK CAN BE BUILT FROM

   What is verifiably true about a business, pulled from the registers,
   plus the rules about what must never be said. This file does NOT
   write the sentence — scan.mjs does that, once per lead, so that 149
   leads get 149 sentences rather than seven.

   The first version of this file did write them, from seven templates.
   That was the August problem wearing a better hat: near-identical
   bodies are a bulk-sender fingerprint whatever the facts behind them,
   and a recipient can tell a template at a glance. Facts here,
   phrasing there.

   WHY THIS EXISTS

   The 21 August batch produced 77 drafts and 68 of them shared an
   observation. The cause was not the phrasing: observe.mjs read the
   homepage and ran eight regexes over it, and a page that tripped none
   of them fell through to a line lifted from the page title.

   Meanwhile merge.mjs was already building every lead record with
   cqc_location_id, hygiene_rating, ico_registration, charity_number,
   specialisms, trading_address and incorporated on it, from five
   registers fetched at £0 — and observe.mjs read none of them.

   A register fact beats a homepage inference on every axis that
   matters. It is dated. It is what an inspector or a regulator
   recorded, not what a marketing page claims. And its provenance is
   already stored field by field in source, source_detail and
   source_date, so "where did you get that?" has an answer without
   keeping a copy of anyone's website.

   THE RULE THAT KEEPS THESE HONEST

   Every hook carries a `notWhen` — the case where the fact is true and
   saying it would still be wrong. That half is not decoration. The
   worst draft in the August batch was not the vaguest one, it was the
   one that confidently told a business something untrue about itself.

   Ordered most specific first, because the model is told which fact is
   strongest rather than left to choose. `template` is a fallback
   sentence used only when there is no API key or the day's quota is
   gone — it keeps the pipeline working without a model, and it is
   explicitly the degraded path, not the product.
   ============================================================ */

const years = (lead) => Number(lead.trading_years) || null

/* Grades are a judgement somebody else passed on the business, and
   repeating a bad one in a first contact is not an observation, it is
   an insult with a citation. So the FSA hook below talks about the
   record-keeping an inspection creates and never about the score. */
const HIGH_HYGIENE = new Set(['5', '4', 'Pass', 'pass'])

export const REGISTER_HOOKS = [
  {
    key: 'cqc_registered',
    /* First because it is the strongest fit in the whole library.
       fetch-cqc.mjs makes the argument in its own header: "rota, visit
       logging, medication records and CQC evidence are exactly the
       manual processes this business exists to fix." */
    applies: (l) => !!l.cqc_location_id,
    notWhen: 'Never for a location whose registration has been cancelled — the fetch keeps only active registrations, but if that ever changes, check first. Telling a provider you noticed their registration when they have just lost it would be the worst letter we ever sent.',
    fact: (l) => {
      const s = (l.specialisms || '').split(/[;,]/)[0]?.trim()
      return s
        ? `Registered with the Care Quality Commission for ${s.toLowerCase()}.`
        : 'Registered with the Care Quality Commission.'
    },
    angle: 'CQC registration means rotas, visit logs, medication records and evidence that has to stand up to inspection — all things this business fixes.',
    template: (l) => 'you are CQC-registered, which means rotas, visit logs and medication records that all have to stand up to inspection',
    evidence: (l) => `CQC register, location ${l.cqc_location_id}`,
    service: 'record-keeping and evidence, scheduling',
  },

  {
    key: 'ico_no_website',
    /* Two register facts crossed, which is why it beats either alone:
       an organisation that has told the ICO it processes personal data
       and has no website is almost certainly doing it on paper and in
       spreadsheets. */
    applies: (l) => !!l.ico_registration && !l.website,
    notWhen: 'Not if a website turns up later by another route. The whole force of this one is the absence, and being told you have no website when you do reads as carelessness.',
    fact: () => 'On the ICO Register of Fee Payers, so processes personal data. No website could be found for them.',
    angle: 'An organisation handling personal data with no digital front door is almost always doing it on paper and in spreadsheets.',
    template: () => 'you are registered with the ICO as handling personal data, and I could not find a website for you',
    evidence: (l) => `ICO Register of Fee Payers, ${l.ico_registration}`,
    service: 'systems setup, data handling',
  },

  {
    key: 'food_premises',
    applies: (l) => !!l.fhrs_id || !!l.hygiene_rating,
    notWhen: 'Never quote the score unless it is 4, 5 or Pass. A low rating is a bad day this business already knows about, and naming it in a cold letter is not an observation, it is a poke. The hook is the paperwork an inspection creates, which is true at every grade.',
    fact: (l) => HIGH_HYGIENE.has(String(l.hygiene_rating))
      ? `On the FSA food hygiene register, rated ${l.hygiene_rating}.`
      : 'On the FSA food hygiene register. THE RATING IS WITHHELD ON PURPOSE — do not speculate about it.',
    angle: 'A food premises keeps temperature logs, supplier records and cleaning schedules, and somebody has to keep them current.',
    template: (l) => HIGH_HYGIENE.has(String(l.hygiene_rating))
      ? `you are rated ${l.hygiene_rating} on the food hygiene register`
      : 'you are on the food hygiene register, which means temperature logs and cleaning schedules somebody has to keep current',
    evidence: (l) => `FSA hygiene register${l.fhrs_id ? `, FHRS ${l.fhrs_id}` : ''}`,
    service: 'record-keeping, scheduling',
  },

  {
    key: 'registered_charity',
    applies: (l) => !!l.charity_number,
    notWhen: 'The contact route still has to be a role address. fetch-charities.mjs warns that a small charity\'s published contact is very often a trustee personally, at their home — which is a named individual at a residential address, and a different lawful basis entirely.',
    fact: (l) => `Registered charity, number ${l.charity_number}.`,
    angle: 'A charity has an annual return and accounts due on a deadline that does not move.',
    template: () => 'you are a registered charity, so there is an annual return and a set of accounts on a deadline that does not move',
    evidence: (l) => `Charity Commission register, charity ${l.charity_number}`,
    service: 'reporting, data and analytics',
  },

  {
    key: 'trades_away_from_office',
    /* The trading address is where the business physically is; the
       registered office is very often the accountant's. That they
       differ is a fact about real premises and real operations, and
       merge.mjs already records which kind of address it used. */
    applies: (l) => !!l.trading_address && !!l.registered_address
      && l.trading_address.trim().toLowerCase() !== l.registered_address.trim().toLowerCase(),
    notWhen: 'Not worth saying on its own if the business is a single self-employed person — the distinction is normal and noticing it sounds like surveillance rather than interest.',
    /* Deliberately does NOT include the address itself. The sentence
       does not need it, and for a sole trader a trading address can be
       a home address — which is personal data, and this fact sheet is
       sent to a free tier that trains on what it receives. The fact is
       that the two differ; the address stays here. */
    fact: () => 'Trades from a working premises that is not their registered office.',
    angle: 'Real premises rather than an accountant\'s address means real operations and real admin happening somewhere.',
    /* The local fallback never leaves this machine, so it may name the
       address where the fact sheet above may not. */
    template: (l) => `you trade from ${String(l.trading_address).split(',')[0].trim()} rather than from your registered office`,
    evidence: () => 'Companies House registered office against the trading address on the public registers',
    service: 'operations',
  },

  {
    key: 'long_established_no_website',
    applies: (l) => years(l) >= 10 && !l.website,
    notWhen: 'Not a criticism, and it must not read as one. A business trading twenty years without a website has usually decided it does not need one, and is right. The hook is the length of the track record, not the gap.',
    fact: (l) => `Trading ${years(l)} years. No website could be found for them.`,
    angle: 'A long track record with no website usually means the work comes from people who already know them, which is a strength rather than a gap.',
    template: (l) => `you have been trading ${years(l)} years without needing a website`,
    evidence: () => 'Companies House incorporation date',
    service: 'systems setup',
  },

  {
    key: 'long_established',
    applies: (l) => years(l) >= 15,
    notWhen: 'Last resort among the register hooks. It is true of a great many businesses, so it is the weakest thing here and should lose to anything above it.',
    fact: (l) => `Trading ${years(l)} years.`,
    angle: 'A long-established business usually has a few processes done the same way since before anyone thought to write them down.',
    template: (l) => `you have been trading ${years(l)} years, which usually means processes nobody has had time to revisit`,
    evidence: () => 'Companies House incorporation date',
    service: 'automation',
  },
]

/* Everything true about this lead, strongest first, for scan.mjs to
   write from. Not one hook — all of them, because a business that is
   both CQC-registered and twenty years old is more interesting than
   either fact alone, and only the model can see that. */
export function leadFacts(lead) {
  const hit = REGISTER_HOOKS.filter((h) => h.applies(lead))
  return hit.map((h) => ({
    key: h.key,
    fact: h.fact(lead),
    angle: h.angle,
    evidence: h.evidence(lead),
    service: h.service,
    notWhen: h.notWhen,
  }))
}

/* The degraded path: no key, or the day's quota is spent. Uses the
   strongest hook's fallback sentence so the pipeline still produces
   something, and marks it so nobody mistakes it for generated copy.
   If a batch comes out full of these, that is the signal that the key
   is missing — not that the writing got worse. */
export function templateHook(lead) {
  for (const h of REGISTER_HOOKS) {
    if (!h.applies(lead)) continue
    return {
      signal: h.key,
      observation: h.template(lead),
      evidence: h.evidence(lead),
      service: h.service,
      source: 'register-template',
    }
  }
  return null
}

export const HOOK_KEYS = REGISTER_HOOKS.map((h) => h.key)
