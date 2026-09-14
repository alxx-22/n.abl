# The hook library

The one true thing a first contact says, where it comes from, and when it must
not be said.

**The sentences themselves live in `scripts/sourcing/hooks.mjs`**, not here. One
source, so this file cannot drift away from what actually gets sent. What this
file carries is the editorial judgement behind them — the part only a person can
settle, and the part that decides whether a letter reads as written or
generated.

Decided in [`personalisation-and-hooks.md`](personalisation-and-hooks.md), built
14 September 2026.

---

## 1. Where an observation may come from

Three sources, in this order. The first one that produces something wins, and
nothing further down is consulted.

| | Source | Cost | Covers |
|---|---|---|---|
| 1 | **Registers** — CQC, ICO, FSA, Charity Commission, Companies House | £0, no key | Most leads |
| 2 | **The page** — eight regexes over the homepage | £0, no key | Some of the rest |
| 3 | **A model** — one Gemini call per lead | Free tier | Only what is left |

The order is not arbitrary. A register fact is dated, is what a regulator
recorded rather than what a marketing page claims, and already carries its
provenance in the pipeline that fetched it. A homepage is a business talking
about itself. When both are available the register wins and it is not close.

This ordering is also why the model stage is small enough to be free. It only
ever sees the residual.

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

The sentences in `hooks.mjs` are a first draft by someone who is not Alex. They
are correct and they are not yet in his voice, which is the whole point of the
exercise.

When changing one:

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
