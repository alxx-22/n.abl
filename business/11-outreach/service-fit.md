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
| `technical_capacity` | `likely` · `mixed` · `unlikely` | Whether anyone inside will maintain what we build |
| `inbound_volume` | `high` · `moderate` · `low` | Whether a chatbot or auto-responder earns its keep at all |
| `credit_fit` | `build` · `assist` · `educate` | Which of [`13-credits`](../13-credits/README.md)' three to lead with after delivery |

**The credit rule that is enforced in code**: `educate` is impossible where
`technical_capacity` is `unlikely`, and gets silently changed to `assist` with a
note. `service-categories.md` §5 is blunt about why — a training day booked for
people who will not attend is money burned, and in a small town it is a refund
and a lost reputation.

---

## 3. Confidence, and the guard that matters most

| | Meaning | Evidence |
|---|---|---|
| `observed` | The page or a register says so | **Required**, and checked verbatim against the fetched page |
| `inferred` | Follows from the sector, not this page | None |
| `guessed` | Neither | None — should almost never appear |

Two rules run in code, not in the prompt:

1. **An `observed` verdict whose quote is not literally on the page** is
   downgraded to `inferred` and its evidence discarded.
2. **Anything not `observed` can never be `strong`.**

Rule 2 is the expensive one. Without it, a sector prior saying *"care homes
usually have rota problems"* becomes *"this care home definitely has rota
problems"*, and we write to them about a problem we invented. Being wrong in the
first sentence of a cold letter is not recoverable.

`npm run test:outreach-guards` covers both, plus junk categories, duplicates,
missing questions and the no-page case. It lifts the functions out of the live
TypeScript rather than copying them, so it cannot pass while the deployed code
differs.

---

## 4. Sector priors, and permission to overrule them

`public.sector_service_prior` holds a row per sector: does this kind of business
plausibly need booking, scheduling, record-keeping; is its data worth analysing;
is it public-facing; what technical capacity and inbound volume to expect.

They are in SQL rather than in the prompt on purpose. **A prior is a claim about
the world and someone should be able to disagree with it in a diff.** Buried in a
prompt string it is unreviewable and it drifts.

They are also, importantly, **overrulable**. The sector hint comes from a keyword
triage and is wrong often enough to matter — *The Albert Hall (Nottingham)*, a
concert venue, is currently filed as a professional practice. The assessor is
told it may contradict the prior from the page, and records what it actually
found in `sector_correction`. A prior that cannot be overruled is a prejudice.

---

## 5. Reading it

```sql
select * from public.lead_fit_briefing where company = 'SOME COMPANY LTD';
```

One row per lead, ready before a call: what they look like from outside, the
observation with its evidence, and every category verdict ordered strongest and
best-evidenced first. Each carries `ask` and `walk_away_if`.

Across the register:

```sql
select * from public.outreach_status;
```

`strong_fits_by_category` is the one to watch. **If every lead is a strong fit
for everything, the assessment has stopped discriminating** and the prompt needs
tightening — that is the failure mode to look for, not an empty result.

---

## 6. Changing what it thinks

Three places, none of which need a deploy.

**The voice** — `public.outreach_prompt` where `key = 'write'`. The three good
and three bad worked examples are what every sentence a stranger reads is
modelled on. They are in my voice, not Alex's, and rewriting them is the
single highest-value edit available here.

```sql
update public.outreach_prompt set body = $$...$$, updated_by = 'alex'
where key = 'write';
```

Takes effect on the next tick, ten minutes later.

**What gets noticed** — `public.outreach_prompt` where `key = 'assess'`. The five
categories and their disqualifiers are quoted from `service-categories.md`; if
that document changes, change this too.

**Sector assumptions** — `update public.sector_service_prior ...`.

This is safe to leave unreviewed because **the guards are in code, not in the
prompt**. A mangled prompt produces rejected verdicts and no observation, visible
in `outreach_status` within the hour. It cannot produce a confident falsehood.

---

## 7. Honest limitations

- **Register facts are thinner here than in the local pipeline.**
  `sales_leads` does not carry the CQC, ICO, FSA and Charity Commission columns
  that `merge.mjs` produces — they live only in local working files. The
  assessor works from trading years, the SIC description and the page. Landing
  those columns is the biggest single upgrade available to this.
- **Only the homepage is read.** A booking system on `/book` is invisible. The
  page-source detection catches embedded tools (Calendly, Shopify, Stripe, live
  chat) which recovers some of it, but not all.
- **`social_only` is under-detected.** A business whose only presence is a
  Facebook page usually has no website in our record at all, so it lands as
  `none`. Distinguishing them properly needs a search step that does not exist.
- **No robots.txt check.** One homepage per lead, ten minutes apart, identifying
  user agent. Defensible at this rate; should match `extract-contacts.mjs`'s
  politeness before volume rises.
- **Nothing here has been run against a real page yet.** The guards are tested,
  the plumbing is verified end to end, and the assessment quality is unknown
  until the key is set and the first ten come back. Read those ten before
  trusting the eleventh.
