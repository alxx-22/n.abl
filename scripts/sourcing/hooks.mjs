#!/usr/bin/env node
/* ============================================================
   THE HOOK LIBRARY

   One true, checkable thing to say about a business, derived from the
   registers rather than from its marketing.

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

   Ordered most specific first. The first hook that applies wins, and
   observe.mjs only falls back to reading the page when none does.
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
    say: (l) => {
      const s = (l.specialisms || '').split(/[;,]/)[0]?.trim()
      return s
        ? `you are CQC-registered for ${s.toLowerCase()}, which means rotas, visit logs and medication records that all have to stand up to inspection`
        : 'you are CQC-registered, which means rotas, visit logs and medication records that all have to stand up to inspection'
    },
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
    say: () => 'you are registered with the ICO as handling personal data, and I could not find a website for you — which usually means that information lives in spreadsheets and filing cabinets',
    evidence: (l) => `ICO Register of Fee Payers, ${l.ico_registration}`,
    service: 'systems setup, data handling',
  },

  {
    key: 'food_premises',
    applies: (l) => !!l.fhrs_id || !!l.hygiene_rating,
    notWhen: 'Never quote the score unless it is 4, 5 or Pass. A low rating is a bad day this business already knows about, and naming it in a cold letter is not an observation, it is a poke. The hook is the paperwork an inspection creates, which is true at every grade.',
    say: (l) => HIGH_HYGIENE.has(String(l.hygiene_rating))
      ? `you are rated ${l.hygiene_rating} on the food hygiene register, which is the kind of thing that only stays true if someone is keeping the records up to date`
      : 'you are on the food hygiene register, which means temperature logs, supplier records and cleaning schedules that somebody has to keep current',
    evidence: (l) => `FSA hygiene register${l.fhrs_id ? `, FHRS ${l.fhrs_id}` : ''}`,
    service: 'record-keeping, scheduling',
  },

  {
    key: 'registered_charity',
    applies: (l) => !!l.charity_number,
    notWhen: 'The contact route still has to be a role address. fetch-charities.mjs warns that a small charity\'s published contact is very often a trustee personally, at their home — which is a named individual at a residential address, and a different lawful basis entirely.',
    say: () => 'you are a registered charity, so there is an annual return and a set of accounts to produce on a deadline that does not move',
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
    say: (l) => `you trade from ${String(l.trading_address).split(',')[0].trim()} rather than from your registered office`,
    evidence: () => 'Companies House registered office against the trading address on the public registers',
    service: 'operations',
  },

  {
    key: 'long_established_no_website',
    applies: (l) => years(l) >= 10 && !l.website,
    notWhen: 'Not a criticism, and it must not read as one. A business trading twenty years without a website has usually decided it does not need one, and is right. The hook is the length of the track record, not the gap.',
    say: (l) => `you have been trading ${years(l)} years without needing a website, which tells me the work comes from people who already know you`,
    evidence: () => 'Companies House incorporation date',
    service: 'systems setup',
  },

  {
    key: 'long_established',
    applies: (l) => years(l) >= 15,
    notWhen: 'Last resort among the register hooks. It is true of a great many businesses, so it is the weakest thing here and should lose to anything above it.',
    say: (l) => `you have been trading ${years(l)} years, which usually means a few processes that have been done the same way since before anyone thought to write them down`,
    evidence: () => 'Companies House incorporation date',
    service: 'automation',
  },
]

/* The first hook that applies, with the evidence that supports it.
   Returns null rather than reaching for something weaker — a lead with
   no register hook goes to the page reader, and a lead with neither
   gets written by hand or not at all. */
export function registerHook(lead) {
  for (const h of REGISTER_HOOKS) {
    if (!h.applies(lead)) continue
    return {
      signal: h.key,
      observation: h.say(lead),
      evidence: h.evidence(lead),
      service: h.service,
      source: 'register',
    }
  }
  return null
}

export const HOOK_KEYS = REGISTER_HOOKS.map((h) => h.key)
