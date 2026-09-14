# The hook library

The one true thing a first contact says, where it comes from, and when it must
not be said.

**Nothing here is a sentence.** `scripts/sourcing/hooks.mjs` states what is
*true* about a business; `scripts/sourcing/scan.mjs` writes the clause, once per
lead, so that 149 leads get 149 sentences.

That split is the whole design. Facts have to be deterministic, because a
made-up fact reaches a stranger's inbox. Phrasing has to *not* be, because
near-identical bodies are a bulk-sender fingerprint whatever the facts behind
them — and a recipient spots a template at a glance.

The first version of this library wrote the sentences from seven fixed
templates. That was the August problem in better clothing.

Decided in [`personalisation-and-hooks.md`](personalisation-and-hooks.md), built
14 September 2026.

---

## 1. Where an observation may come from

Three sources, in this order. The first one that produces something wins, and
nothing further down is consulted.

| | Stage | Produces | Cost |
|---|---|---|---|
| 1 | **Registers** (`hooks.mjs`) | Facts. CQC, ICO, FSA, Charity Commission, Companies House | £0, no key |
| 2 | **The page** (`observe.mjs`) | Page text, cached, plus a template fallback | £0, no key |
| 3a | **Read** (`scan.mjs`) | Candidate facts off the page, each with a verbatim quote. Flash-Lite, temperature 0.2 | Free tier |
| 3b | **Write** (`scan.mjs`) | The clause itself. Flash, temperature 0.95 | Free tier |

Two model stages, two different models, chosen by what the call is for. Reading
a page for candidates is extraction — high volume, low judgement, and Flash-Lite
has four times Flash's daily headroom. Writing the clause a stranger actually
reads is the opposite, and only leads that got something out of the read stage
ever reach it. A model asked to extract and charm in one breath does both worse,
and the failure mode is the charming half inventing something for the extracting
half to have found.

Rate limits are per model and live in `scripts/sourcing/gemini.mjs`. Google's own
docs no longer print a free-tier table — they say "view your active rate limits
in AI Studio" — and the third-party trackers disagree with each other, so that
table is what we *try* and a 429 is what we *believe*: an observed ceiling is
recorded and honoured from then on.

Stage 3 runs on **every** lead, not a residual. An earlier version only called
the model where the regexes had failed, which meant the best leads — the ones
with a real register fact — got the most templated sentence. Exactly backwards.

Order still matters, but as *ranking* rather than as a cut-off: the strongest
fact is listed first and the model is told so. A register fact is dated, is what
a regulator recorded rather than what a marketing page claims, and carries its
provenance in the pipeline that fetched it. But a page that says "ring the
workshop to arrange a quote" can beat a register fact for specificity, so the
writer gets both and chooses.

### What the model may and may not do

It may choose which fact to use, and how to say it. It may **not**:

- use a register fact it was not given — a fabricated CQC registration is the
  most damaging thing this stage could produce, and `scan.mjs` rejects any claim
  whose `fact_key` was not on the sheet
- quote the page without quoting it word for word — and the quote must be one
  the read stage already checked against the page, so there are two gates rather
  than one
- name a hygiene score that was withheld, or a person

A rejected answer falls back to the template. The worst case is a sentence that
reads like a template, not a lie.

### What is deliberately not sent

The fact sheet goes to a free tier that trains on what it receives, so it
carries no company name, no contact route and **no address**. The trading-address
hook states only that the trading and registered addresses differ; the address
itself stays on this machine and is used only by the local fallback. For a
limited company an address is business data, for a sole trader it can be a home
address, and there is no way to tell which from here.

---

## 2. The rule that keeps these honest

**Every hook carries a `notWhen`: the case where the fact is true and saying it
would still be wrong.**

That half is not decoration, and it is the half that is easy to skip. The worst
draft in the August batch was not the vaguest one — it was the one that told a
business something untrue about itself with total confidence.

Worked examples of `notWhen` doing real work:

- **Food hygiene.** The score is available for every food business. It is never
  quoted unless it is 4, 5 or Pass. A low rating is a bad day the business
  already knows about, and naming it in a cold letter is not an observation, it
  is a poke with a citation attached. At every grade the honest hook is the
  paperwork an inspection creates, not the grade it produced.
- **CQC.** Never for a cancelled registration. Telling a care provider you
  noticed their registration the week they lost it would be the worst letter
  this business ever sent.
- **Charity.** The hook is fine; the *contact route* is the risk.
  `fetch-charities.mjs` warns that a small charity's published contact is very
  often a trustee personally, at their home — a named individual at a
  residential address, and a different lawful basis entirely.
- **Long-established, no website.** Must not read as criticism. A business
  trading twenty years without a website has usually decided it does not need
  one and is usually right. The hook is the length of the track record.

---

## 3. What makes a hook good

Ranked by how much of this it has:

1. **It is about how they operate**, not what they sell. "Bookings go through a
   phone call" is an observation. "They offer plumbing services" is a
   description, and the recipient learns nothing from being told it.
2. **It is checkable.** They can look at the same thing and agree.
3. **It points at something n.abl actually does.** `fetch-cqc.mjs` makes this
   argument in its own header better than this file can: *"rota, visit logging,
   medication records and CQC evidence are exactly the manual processes this
   business exists to fix."*
4. **It could not have been sent to anyone else.** The test from
   `first-contact-letter.md` §6: if it could go to every business in the batch,
   it is filler, and a letter built on filler is a leaflet.

And what disqualifies one outright: **a guess at a difficulty**. "You probably
rekey orders by hand" is a guess wearing an observation's clothes. The recipient
can tell, and it is the fastest way to sound like a mail merge.

---

## 4. Editing these

Two places, and they do different jobs.

**`hooks.mjs`** holds the facts, the `angle` (what the fact implies, which is
what the writer works from), and the `template` fallback. Edit the angle to
change *what gets noticed*.

**The prompt in `scan.mjs`** holds the voice — the worked good and bad examples
are what the sentences are modelled on. Edit those to change *how it sounds*.
They are currently in my voice, not Alex's, and that is the one part that cannot
be delegated.

When changing either:

- Read it aloud. `first-contact-letter.md` §5 asks for exactly this before a
  first send, because a letter that reads as a mail merge is easier to hear than
  to see.
- Keep the `notWhen`. If a hook's non-applicability rule is not obvious, that is
  a sign the hook is too broad rather than a sign the rule is unnecessary.
- `node scripts/sourcing/hooks-test.mjs` covers the ordering and the rules,
  including that a low hygiene score is never quoted back. It runs in under a
  second and it is worth running.

---

## 5. What is still missing

Honest list.

- **No hook uses `sic` or `industry`.** Sector is known for every lead and is
  currently only used for scoring and batch mix. There is probably a good
  sector-specific hook per trade, and writing them is the obvious next
  improvement.
- **Nothing uses the ICO registration's own fields** beyond its existence — the
  register carries the payment tier and whether the organisation is a public
  authority, and neither is read.
- **No hook is about time.** "Your last filing was late" or "your accounts are
  due in six weeks" would be specific and checkable, and would also read as
  surveillance. Recorded as considered and rejected rather than left for someone
  to discover as a bright idea.
