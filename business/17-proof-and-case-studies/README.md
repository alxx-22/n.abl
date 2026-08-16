# 17 — Proof and case studies

```
Status:       not started
Owner:        Alex
Next review:  before the first delivery begins — not after it ends
Evidence:     none yet. First entry will be a baseline sheet from delivery #1
```

Nothing in this folder has been used, because there has been no client. That is
exactly why it exists now.

**The problem this folder solves.** n.abl has no proof, is honest about having
no proof, and has no system for turning a delivery into proof. So the first
successful job will produce a happy client, a working system, and nothing
publishable — because the numbers that would have made it publishable were never
captured at the start.

Proof is not something you write up afterwards. It is something you **instrument
beforehand**. A before-figure cannot be reconstructed once the "before" has been
deleted.

Last substantive revision: 2026-08-16.

---

## What "done" looks like

- [ ] No delivery starts without a baseline captured and signed off by the
      client.
- [ ] The first completed delivery produces a case study, or a written reason
      why it cannot.
- [ ] Permission is asked for at the point it is easiest to give, and recorded.
- [ ] At least one illustrative example on the homepage has been replaced,
      one-for-one, by real work.
- [ ] Every number published anywhere traces to a figure the client supplied and
      agreed.

---

## The files in this folder

| File | What it is for |
|---|---|
| `README.md` | This file. The rules, the criteria, what may and may not be claimed |
| [`measurement.md`](measurement.md) | Capturing the baseline at the start of delivery, and the after-figure at handover |
| [`permission-and-testimonials.md`](permission-and-testimonials.md) | Asking, recording, the anonymised route, and when to ask |
| [`case-study-template.md`](case-study-template.md) | The template, and the one-for-one homepage replacement process |

---

## 1. When a delivery becomes a case study

Five criteria. **All five**, not most.

1. **There is a before-figure and an after-figure**, both from the client, both
   agreed in writing. Not estimated by us afterwards.
2. **Enough time has passed for the after-figure to be real.** At least one full
   cycle of whatever the process is — a month for a monthly report. A figure
   taken the week of handover measures optimism, not outcome.
3. **The client has given written permission** for what is published, in the
   form it will be published.
4. **The result would survive the client reading it.** If the client would wince
   at the framing, it is oversold, and the person best placed to expose it is
   the one who lived it.
5. **The work is representative.** A one-off favour done cheaply for a friend is
   not evidence of what the business does.

If a delivery fails criterion 3 only, it becomes an **anonymised** case study.
If it fails 1 or 2, it is not a case study and no amount of writing fixes it.

---

## 2. First-client criteria — what to look for

The first case study matters more than the next five, because it is the one that
unlocks the ability to win the second client. When choosing which early job to
instrument hardest, prefer one that:

- has a **countable** before-figure the client already knows (hours a month is
  ideal; error rates and turnaround times also work)
- sits in a sector where the next ten prospects also live
- is small enough to finish quickly — a case study in six weeks beats a better
  one in nine months
- has a client who is talkative and pleased to be asked
- does not depend on anything confidential to be legible

**Do not choose the most technically interesting job.** The audience is a
business owner who wants their Monday back, not a peer reviewer.

---

## 3. What can and cannot be claimed

### Can

- A figure the client supplied, agreed in writing, and would repeat.
- Arithmetic performed on those figures, with the working shown.
- A description of what was built, in plain terms.
- A named client **with written permission** for that specific use.
- Software n.abl has built for itself — the site, portal, team space, CRM, email
  pack, document generator. This is real, demonstrable, and currently the
  strongest technical evidence available.
- Anything a prospect can be shown live in a demonstration.

### Cannot — ever

- A client count, a savings total, an average, or a percentage improvement
  across engagements, until there are enough engagements for the number to mean
  something. Two is not enough.
- A projected saving presented as an achieved one. The quote's expected value is
  a projection. The case study's figure is an outcome. They are different
  numbers and must never be printed as the same one.
- A client's name, logo or sector detail without written permission.
- A testimonial that n.abl drafted and the client merely approved. If they will
  not write it themselves, take a quote from something they actually said, and
  ask them to confirm that wording.
- Anything from a delivery still in progress.
- A figure rounded in n.abl's favour. Every ambiguity resolves against us — the
  same rule as `12-pricing`.

### The rule underneath all of it

**Every number published traces to either the client's own input or a labelled
illustrative calculation with visible arithmetic.** No invented proof, no
invented savings, no invented customer stories, no invented client counts. This
is a brand principle, not a practice — it is recorded in
`02-brand/brand-promise.md` and in the site's own rules.

---

## 4. Illustrative examples — the labelling rules

Until there is real proof, the homepage carries illustrative examples. These are
legitimate, and only while they are labelled.

1. **The label is rendered from data, not written into copy.** Each example
   carries `provenance: 'illustrative' | 'client'` and a `client` field. The
   component prints the label from those. A disclaimer written into a paragraph
   can be edited away by someone who does not know why it is there.
2. **The word is "illustrative", every time.** Not "typical", not "example
   outcome", not "representative". Those imply a distribution of real results.
3. **No fictional attribution.** No sector labels, no "UK SME", no invented
   company descriptions. The site carried "Retail Operations — UK SME" once;
   that is a fabricated client and it is worse than nothing.
4. **Illustrative results should be modest.** An illustrative figure that sounds
   impressive is doing the work of a claim while wearing a disclaimer.
5. **The explanatory standfirst is conditional.** It appears only while at least
   one card is still illustrative, so it disappears by itself.

---

## 5. The one-for-one replacement process

Replacing an illustrative example with real work is a **data change**, by
design. See `case-study-template.md` §4 for the full procedure. In short:

1. The case study is written, approved and signed off.
2. In `src/components/sections/Examples.jsx`, one entry in `CASES` is edited:
   `provenance` becomes `'client'`, `client` gets the agreed name, and
   `problem` / `fix` / `result` take the agreed figures.
3. Nothing else changes. No markup, no copy, no styling.
4. `03-website/copy-deck.md` is updated in the same commit, and the claims audit
   gains a row.
5. The card that was replaced moves into this folder's archive so the
   illustrative set does not silently shrink over time.

Replace one at a time. Three real cases is the point at which the "illustrative"
standfirst disappears on its own.

---

## 6. Forms of proof, in order of persuasive weight

Worth knowing which to chase, because they cost very different amounts.

| # | Form | Cost to obtain | Weight |
|---|---|---|---|
| 1 | Named client, agreed figures, quoted | High — needs permission and a result | Highest |
| 2 | Anonymised client, agreed figures | Medium — permission is much easier | High |
| 3 | A live demonstration of something built | Low — it already exists | High, and underrated |
| 4 | Software n.abl runs its own business on | Already paid for | Medium, and available today |
| 5 | Technical evidence: screenshots, a repository, an architecture note | Low | Medium, audience-dependent |
| 6 | Testimonial with no figures | Low | Low, but easy |
| 7 | Illustrative example, labelled | Free | Lowest, and honest |

Rows 3 and 4 are available **right now** and are the most under-used assets the
business has. A prospect watching a working portal built for n.abl itself is
better evidence than a paragraph about a client they cannot verify.

---

## 7. Next actions, in order

1. **Before the first delivery starts**, read `measurement.md` and prepare the
   baseline sheet. This is the only item with a hard deadline attached to an
   external event.
2. **Add the baseline capture to the onboarding checklist** in `14-delivery`, so
   it cannot be skipped by someone in a hurry.
3. **Write the permission wording** into the scope-of-work template in
   `04-legal`, so asking is the default rather than an awkward later
   conversation.
4. **Diarise the testimonial ask** for the week after handover, while the
   relief is fresh.
5. **Replace the first illustrative card** once one case study clears all five
   criteria.
