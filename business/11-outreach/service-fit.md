# Service fit: what we think a lead needs, and how sure we are

**Live on the project since 14 September 2026.** Waiting on `GEMINI_API_KEY`.

Replaces `signals` — *"address the business gave for itself; sector hint: property;
trading 4 years"* — which was true and told you nothing you could act on.

---

## 1. The rule this is built around

**A website assessment is a hypothesis. It is never a qualification.**

Every disqualifying signal in
[`01-positioning/service-categories.md`](../01-positioning/service-categories.md)
is something you learn in a conversation and cannot learn from a homepage:

| Category | What kills it — and you can't see it from outside |
|---|---|
| Save time | *"They will not let you watch the task being done."* |
| Reduce mistakes | *"They can name the person who makes the mistakes, but not the process that allows them."* |
| Understand data | *"The underlying data does not exist, or nobody will own its accuracy."* |
| Build new | *"They will not answer: what happens on the day it does not exist?"* |
| Train the team | *"The tool genuinely cannot do the job."* |
| Fix something | *"Nobody can produce the source, the accounts or the credentials."* |

So **every category verdict carries two extra fields**:

- `confirm_question` — the one question on a thirty-minute call that settles it
- `disqualifier` — what answer means walk away

A fit score without those is a guess with a number attached. That is how a
business gets mischaracterised, and there is one first contact per lead.

---

## 2. What gets assessed

Five categories per lead. **Train your team is deliberately excluded** — nothing
on a homepage tells you whether staff can use software they already pay for. It
is inferred much more weakly as `technical_capacity`, which points at a credit
type rather than at a sale.

Plus four judgements about the business as a whole:

| Field | Values | What it decides |
|---|---|---|
| `web_presence` | `none` · `social_only` · `placeholder` · `brochure` · `transactional` | Four different conversations that `website is not null` collapsed into one. A Facebook page is not a website |
| `technical_capacity` | `unlikely` · `mixed` · `likely` | Whether anyone inside will maintain what we build |
| `inbound_volume` | `low` · `moderate` · `high` | Whether a chatbot or auto-responder earns its keep at all |
| `credit_fit` | `assist` · `build` · `educate` | Which of [`13-credits`](../13-credits/README.md)' three to lead with after delivery |

Those are the terms as seeded. None of them is in the code — they are rows in
`public.outreach_vocabulary`, and so is everything the model is told they mean.
See [`registries.md`](registries.md).

**The credit rule**: `educate` is unavailable where `technical_capacity` is
`unlikely`, and is silently changed to the best still-permitted credit type with
a note. `service-categories.md` §5 is blunt about why — a training day booked
for people who will not attend is money burned, and in a small town it is a
refund and a lost reputation.

That rule is a registry row (`educate` requires `technical_capacity` at rank 1
or better) enforced by generic code, so the next rule of that shape is an INSERT.

---

## 3. Confidence, and the guard that matters most

| | Meaning | Evidence |
|---|---|---|
| `observed` | The page or a register says so | **Required**, and checked verbatim against the fetched page |
| `inferred` | Follows from the sector, not this page | None |
| `guessed` | Neither | None — should almost never appear |

Two rules run in code, not in the prompt:

1. **A term the registry marks as needing evidence, used without a quote that is
   literally on the page**, is demoted to the strongest term that needs none,
   and its evidence discarded.
2. **A fit that demands evidence cannot stand on a confidence that does not.**

Rule 2 is the expensive one. Without it, a sector prior saying *"care homes
usually have rota problems"* becomes *"this care home definitely has rota
problems"*, and we write to them about a problem we invented. Being wrong in the
first sentence of a cold letter is not recoverable.

Neither rule names a term. Both ask the registry. `npm run test:outreach-guards`
proves that by running the same guards against a vocabulary with every term
renamed and the ranks reordered — if a term name ever leaks back into a rule,
that assertion fails.

The test imports `supabase/functions/outreach-writer/guards.mjs` directly: the
same file the deployed function imports, unmodified. It cannot pass while the
deployed guards differ.

---

## 4. Sector priors, and permission to overrule them

`public.sector_service_prior` holds a row per sector: does this kind of business
plausibly need booking, scheduling, record-keeping; is its data worth analysing;
is it public-facing; what technical capacity and inbound volume to expect.

They are in SQL rather than in the prompt on purpose. **A prior is a claim about
the world and someone should be able to disagree with it in a diff.**

They are also, importantly, **overrulable** — and now correctable. The scout is
given the list of sector keys and told the triage is wrong often enough to
matter; *The Albert Hall (Nottingham)*, a concert venue, was filed as a
professional practice. A correction writes back to `sales_leads.sector` with
`sector_source = 'assessment'`, and never overwrites a human's.

And they are no longer only opinion. Beside the seed, the scout is shown what
previous assessments actually found in that sector, once there are enough of
them to be worth showing. Side by side, never blended: a blend hides which one
was wrong. `select * from public.sector_prior_drift` is where you see the seed
losing.

Full detail in [`registries.md`](registries.md) §5.

---

## 5. Reading it

```sql
select * from public.lead_fit_briefing where company = 'SOME COMPANY LTD';
```

One row per lead, ready before a call: what they look like from outside, the
observation with its evidence, and every category verdict ordered strongest and
best-evidenced first — by registry rank, so a new term sorts correctly without
anyone editing the view.

Each carries `ask` and `walk_away_if`.

```sql
select * from public.lead_argument where company = 'SOME COMPANY LTD';
```

Why it got the sentence it got: what the scout argued, what the editor promoted
and why it passed over the rest, whether the writer took it or handed it back.
**When a draft looks wrong the mistake is usually in what the editor promoted,
not in how the writer phrased it.**

Across the register:

```sql
select * from public.outreach_status;
```

`top_fits_by_category` is the one to watch. **If every lead is a strong fit for
everything, the assessment has stopped discriminating** and the scout prompt
needs tightening — that is the failure mode to look for, not an empty result.

---

## 6. Changing what it thinks

Three places, none of which need a deploy: the prompts, the vocabulary, and the
sector assumptions. All of it is in [`registries.md`](registries.md).

The short version: the voice is `outreach_prompt` where `key = 'writer'`, and
rewriting its worked examples in your own voice is the single highest-value edit
available in this system.

---

## 7. Honest limitations

- **Register facts are thinner here than in the local pipeline.**
  `sales_leads` does not carry the CQC, ICO, FSA and Charity Commission columns
  that `merge.mjs` produces — they live only in local working files. The scout
  works from trading years, the SIC description and the page. Landing those
  columns, and adding a row per register to `outreach_fact_rule`, is the
  biggest single upgrade available to this.
- **Only the homepage is read.** A booking system on `/book` is invisible. The
  page-source detection catches embedded tools (Calendly, Shopify, Stripe, live
  chat, analytics) which recovers some of it, but not all.
- **`social_only` is under-detected.** A business whose only presence is a
  Facebook page usually has no website in our record at all, so it lands as
  `none`. Distinguishing them properly needs a search step that does not exist.
- **61 of 149 leads have no sector**, because the keyword triage never matched
  them. They get "work entirely from the page", and the scout may file them —
  which is better than the substring parse ever was, and still worth checking
  on the first few.
- **No robots.txt check.** One homepage per lead, ten minutes apart, identifying
  user agent. Defensible at this rate; should match `extract-contacts.mjs`'s
  politeness before volume rises.
- **Nothing here has been run against a real page yet.** The guards and the
  negotiation are tested, the plumbing is verified end to end, and the
  assessment quality is unknown until the key is set and the first ten come
  back. Read those ten before trusting the eleventh.
