# 01 — Positioning

**Status: in progress.**

The positioning is decided, written down in this folder, and now carried
through the client-facing copy: the website is organised around the six
categories, the invented impact metrics are gone, and the email pack and the
CRM's outreach copy have been rewritten to match.

What remains is the part no document can do for you. The ideal customer profile
has not been tested against a real list of businesses, and nobody has said any
of this out loud to a prospect yet. Until both have happened this step is not
done, however good the writing is.

This folder is the source of truth for what n.abl says it is, who it sells to,
what it sells, how it says it, and what it says no to. Every other folder in
`business/` inherits from this one. If you are writing website copy, an outreach
email, a proposal or a lead-scoring rule, the answer is in here.

Last substantive revision: 2026-08-15.

---

## What this step is

n.abl is repositioning from an **AI automation agency** to a **technology
implementation partner for small businesses**. That is the single most important
change in the plan, and this folder is where it is made concrete enough to act
on.

The change has three parts:

1. **The claim changes.** We find the expensive, repetitive or fragile part of a
   business and build the most appropriate fix. AI is one tool among several,
   alongside Python, web development, integration, automation and training. If
   the best answer is not AI, AI is not forced into it.
2. **The structure changes.** The offer is organised by the client's problem, not
   by our toolbox. Innovation / Automation / Optimisation may survive as a
   strapline. It must not be the organising structure of the offer anywhere.
3. **The buyer gets specific.** Small businesses around Nottingham and Alcester,
   defined by employee count, sector and observable signals, tightly enough to
   throw work away.

**This step is not** the website rewrite (`03-website`), the pricing worksheets
(`12-pricing`) or the lead sourcing pipeline (`10-lead-sourcing`). Those consume
this folder. They do not belong in it.

---

## What "done" looks like

Done is not "the documents exist". The documents exist now and the step is still
in progress. Done is these nine statements being true and checkable.

- [ ] Both founders can give the short positioning statement from memory, in
      their own words, without using the phrase "AI automation agency".
- [ ] The six categories are agreed, and neither founder has to look them up.
- [ ] The ICP is specific enough that a real list of 20 local businesses can be
      scored against it and roughly half fail.
- [ ] That list has actually been built and scored, and the failures have written
      reasons.
- [ ] Every service n.abl offers maps to exactly one of the six categories, and
      to exactly one pricing category (A efficiency, B capability, C credits).
- [ ] Someone can answer the ten most likely objections without improvising, and
      can say the ten most likely nos out loud without flinching.
- [ ] Every `[PLACEHOLDER]` in this folder either has a value or a named decision
      it is waiting on.
- [ ] The handoffs in the table below have been made, so the folders downstream
      are unblocked.
- [ ] No document anywhere in the repository still describes n.abl as an AI
      automation agency, or organises the offer around the three pillars.

The last one is currently false. The live website is still built on Innovation /
Automation / Optimisation. That is the largest single gap between this plan and
reality, and no amount of writing in this folder closes it.

---

## Next actions, in order

1. **Read the five working files below**, in the order they are listed. Roughly
   an hour. Do not start scoring leads before reading the ICP.
2. **Both founders read the positioning statement and disagree out loud.** Any
   sentence either of you would not say to a stranger in a pub gets rewritten
   now, not after it is on the website.
3. **Agree the six categories.** Confirm each is a sentence a client would say
   unprompted, and that nothing n.abl offers falls outside all six.
4. **Test the ICP against reality.** Build a list of 20 real businesses across
   both territories from Companies House, trade directories and their own
   websites. Score each using the model in section 7 of the ICP. Contact none of
   them.
5. **Review the scores.** If nearly everything scores above 70, the profile is
   too loose and the signals are not discriminating. If nearly nothing does,
   either the territory or the size band is wrong. Adjust the profile, not the
   scores.
6. **Fill or assign every `[PLACEHOLDER]`.** Run `grep -rn "PLACEHOLDER"` over
   this folder. Each gets a value, or a named owner and a date.
7. **Rehearse out loud.** Objections 1, 2, 6 and 20, and sections 3.1, 3.2 and
   3.9 of `saying-no.md`. Reading them is not the same as saying them, and the
   price question will be the first one asked.
8. **Make the handoffs** in the table below. Each is a specific thing another
   folder needs from this one.
9. **Set the review trigger.** Revisit this folder after the first ten qualified
   conversations, and rewrite the ICP signals and the messaging spine using the
   words those businesses actually used.

Steps 1 to 3 are a single sitting. Step 4 is the real work, and it is where the
profile will be proved or disproved.

---

## The files in this folder

| File | What it is for | Read it when |
|---|---|---|
| `README.md` | This file. What the step is, what done looks like, what to do next. | First |
| [`positioning-statement.md`](positioning-statement.md) | What n.abl is, in three lengths. What it is not. Why this positioning, commercially. The honest position on proof. | Writing anything client-facing |
| [`ideal-customer-profile.md`](ideal-customer-profile.md) | Territories, employee bands, sectors, observable signals, disqualifiers, the scoring model, and lawful sourcing for this profile. | Building or scoring a list |
| [`service-categories.md`](service-categories.md) | The six categories. For each: what the client says on arrival, what we actually build, the pricing category, and the disqualifying signal. | Scoping a job or writing a proposal |
| [`messaging-spine.md`](messaging-spine.md) | How it gets said. The claim at four lengths, words we use and never use, sentence patterns, and skeletons for email, voicemail, call openings, web pages and proposals. | Writing copy of any kind |
| [`objection-handling.md`](objection-handling.md) | Twenty objections from prospects worth keeping, with what each usually means and what to say. | Before any call. Genuinely, before. |
| [`saying-no.md`](saying-no.md) | The exclusion list as scripts. Hard nos, soft nos, nos during an engagement, and the phrases never to use. | Before any call, and the moment one goes the wrong way |

The split between the last two matters: `objection-handling.md` is for
conversations to continue, `saying-no.md` is for conversations to end.

---

## The six categories

The spine of everything here. Full detail, including the disqualifying signal for
each, in [`service-categories.md`](service-categories.md).

| Category | What they say when they arrive | Pricing |
|---|---|---|
| **Save time** | "This takes us ages every month" | A — efficiency, priced on value |
| **Reduce mistakes** | "We keep getting this wrong" | A — efficiency, priced on value |
| **Get more customers** | "Enquiries come in and nothing happens" | A or B |
| **Build something new** | "We need a thing that does X" | B — capability, fixed price |
| **Train your team** | "We pay for this and nobody uses it" | B — fixed price |
| **Fix something** | "It worked and now it doesn't" | C — credits |

The organising question, which opens every conversation and structures every
page: **what are you trying to improve?**

---

## The ICP in one line

> An owner-run business of 5 to 25 people in the Nottingham or Alcester areas,
> running on spreadsheets and email, with at least one process that visibly costs
> them a day a week or more, and a named director who can say yes on their own.

The strongest single signal, and the one to listen for above all others: **a
business owner who describes a task by how long it takes rather than by which
software it uses.**

---

## Handoffs this step owes other folders

Positioning is only finished when the folders downstream can act on it. None of
these have been made.

| To | What it needs from here | Status |
|---|---|---|
| `03-website` | The six categories as the navigation and page structure, replacing the three pillars. The short and standard statements as copy. The page skeleton in `messaging-spine.md` section 10. | Not made. Largest open gap. |
| `07-crm` | The scoring model and the disqualifier list as fields, so a lead can be scored and a rejection recorded with a reason. | Not made |
| `10-lead-sourcing` | Territories, size bands, sectors, signals and the preferred source list. | Not made |
| `12-pricing` | The A / B / C split per category, and the value-based method for A. | Not made |
| `13-credits` | The three credit types, Build / Assist / Educate, and what each covers. | Not made |
| `14-delivery` | The scope boundaries: regulated advice, defect versus change, ownership on handover. | Not made |

---

## Things in here that must not be got wrong

Four points where a plausible-sounding mistake is expensive.

**1. Claude Code running locally is not a local Claude model.** Claude Code is a
local interface and orchestration environment; the Claude models themselves are
cloud-hosted. The saving comes from routing low-intelligence work to ordinary
code or a genuinely local open model, not from where the tool runs. Anyone who
says this the wrong way round will build the cost model wrong and will eventually
say it wrong in front of a client.

**2. Compliance is a database feature, not a policy.** ICO guidance distinguishes
corporate subscribers from sole traders and individual subscribers, and the rules
for electronic marketing differ materially. The record carries `subscriber_type`,
`lawful_basis`, `source`, `source_date`, `privacy_notice_status`,
`marketing_status`, `opt_out`, `suppression_list` and `contact_history`, and the
sending path hard-blocks opted-out records at the database level. None of these
fields exist in the CRM today, so the CRM cannot lawfully drive outreach yet.

**3. Do not build the lead database from Google Maps.** Google's Maps terms
restrict using Maps content to create or augment business listings, mailing lists
or telemarketing lists, and Places is pay-as-you-go with field-level billing
rather than a permanent free allowance. Google is one discovery signal, never the
database of record. Prefer Companies House, trade and local directories, and the
businesses' own websites.

**4. The logo is drawn artwork, not type.** A 13-unit monoline stroke with butt
caps and true-circle curves, mastered at `public/brand/wordmark.svg` and
`public/brand/mark.svg`. It must never be described as "set in" any typeface. The
old brand pack says exactly that, and the old pack is wrong in every particular:
the palette is now warm espresso `#0E0C0A` and amber `#E9AC57`, not black and
lime. On light grounds use the deep amber `#B87718`, because the primary amber
reaches only 1.97:1 on near-white and fails contrast.

---

## Open decisions

Everything marked `[PLACEHOLDER]` in this folder, gathered in one place.

| Decision | Where | Depends on |
|---|---|---|
| Credit pack sizes, prices and expiry period | `service-categories.md` §6 | The first three real quotes. Do not set before. |
| Fixed-price bands for capability builds | `service-categories.md` §4 | The first three fixed-price deliveries and their real hours |
| Training session and programme rates | `service-categories.md` §5 | On-site versus remote, and group size |
| Standard payment schedule for staged work | `saying-no.md` §3.2, `objection-handling.md` §4 | Agreeing it before the first quote goes out |
| Turnover band as an ICP cross-check | `ideal-customer-profile.md` §3 | The first ten qualified conversations |
| Email signature form of the statement | `positioning-statement.md` §9 | Final email addresses |
| Companies House registered description / SIC | `positioning-statement.md` §9 | Checking what is currently filed |
| Professional indemnity cover, for the liability objection | `objection-handling.md`, final section | First earnings. Master plan §8, item 3. |
| Client contract and scope-of-work templates | `objection-handling.md`, final section | A solicitor. **None of the legal documents have been reviewed by one. Never say they have.** |
| Owner and target date for this step | This file | Founders |

---

## Where this sits

The master plan is [`../README.md`](../README.md). It is the parent document and
wins any disagreement with this folder. This folder expands its sections 1, 2 and
3 into working material.

Read the master plan first if you have not. This folder assumes it.
