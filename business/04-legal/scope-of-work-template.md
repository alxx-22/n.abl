# Scope of work — template

**This template has not been reviewed by a solicitor**, and neither has anything
produced from it. See [`README.md`](README.md).

Last substantive revision: 2026-08-15.

---

## What a scope of work is for

The scope of work is the document that decides whether a fixed price stays fixed.
Everything else in a small project can be recovered from. An argument about what
"finished" meant cannot.

It does three things:

1. Says exactly what is being built, in words the client can check.
2. Says what is not being built, as a list rather than by omission.
3. Says how the client will know it is done, before anyone starts.

It is signed alongside the quote and it prevails over any conversation, email or
demo that came before it.

**Length.** Two to four pages. A scope longer than the build is a warning that
the job is not understood yet.

---

## How to fill it in

- Every line beginning **Guidance:** is for you, not the client. Delete all of
  them before sending.
- Every `[PLACEHOLDER]` gets a value or the section gets deleted. A `[PLACEHOLDER]`
  reaching a client is worse than a blank page, because it says nobody read it.
- Write in the client's words, not ours. If they say "the Thursday spreadsheet",
  call it the Thursday spreadsheet.
- Numbers come from the client. Never invent a current cost, a volume or a time
  saving to make the arithmetic work.
- One category, one pricing basis. If the job spans two of the six categories,
  either split it into two scopes or pick the one the client actually cares about.
- If a section does not apply, delete it. Do not write "N/A" ten times; it trains
  people to stop reading.

---

## The template

Everything from here to the end of section 14 is the document. Copy it, fill it,
delete the guidance.

---

### n.abl — Scope of work

**Reference:** `[PLACEHOLDER: SOW-2026-001]`
**Client:** `[PLACEHOLDER: registered business name]`
**Client contact:** `[PLACEHOLDER: name, role, email]`
**Prepared by:** n.abl, `[PLACEHOLDER: name]`
**Date:** `[PLACEHOLDER]`
**Valid until:** `[PLACEHOLDER: date the price stands to]`
**Related quote:** `[PLACEHOLDER: Q-2026-001]`

> This scope of work is agreed under the n.abl service agreement dated
> `[PLACEHOLDER]`. Where the two differ on what is being built, this document
> applies. On all other terms, the service agreement applies.

*Guidance: if there is no signed service agreement yet, this line is wrong. Get
one signed first. See `contract-checklist.md` section 1.*

---

#### 1. The problem

`[PLACEHOLDER: two or three sentences, in the client's own words, describing what
is expensive, repetitive or fragile today.]`

**Category:** `[PLACEHOLDER: Save time / Reduce mistakes / Understand your data /
Build something new / Train your team / Fix something]`

*Guidance: one category. The six are defined in
`../01-positioning/service-categories.md`. If nothing fits, this is not a job we
have decided how to sell yet.*

**How it works today**

`[PLACEHOLDER: the current process, step by step, including who does it, how
often, and roughly how long it takes. Six lines at most. This is the paragraph the
client will check hardest, because it is about them.]`

**What it costs today**

*Guidance: efficiency jobs only. Delete this whole block for a capability build,
where there is no before to measure. Every figure here comes from the client.*

| | |
|---|---|
| Time spent | `[PLACEHOLDER]` hours per `[PLACEHOLDER: week / month]` |
| Loaded hourly cost | £`[PLACEHOLDER]`, supplied by the client |
| Current cost | £`[PLACEHOLDER]` per month |
| Other costs | `[PLACEHOLDER: errors, rework, missed enquiries, delay. Only if the client can put a number on it.]` |

---

#### 2. What we will build

`[PLACEHOLDER: plain description of the solution. What it is, where it runs, what
it does, and what the client's people will actually do differently on Monday
morning.]`

**Deliverables**

| # | Deliverable | Description |
|---|---|---|
| 1 | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| 2 | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| 3 | Handover pack | Source code, configuration, credentials, and a short written guide to running and changing it |

*Guidance: deliverable 3 is not optional and is never removed to reduce the price.
The client owns what is built, and ownership without the source is a slogan.*

**Where it runs**

`[PLACEHOLDER: the client's own accounts and subscriptions, named. Who holds the
account, who pays for it, who has admin.]`

---

#### 3. What we will not build

*Guidance: the most valuable section in the document. Write at least three lines.
Include anything discussed and dropped, anything an optimistic reader might assume
is included, and anything that would be the obvious next project.*

- `[PLACEHOLDER]`
- `[PLACEHOLDER]`
- `[PLACEHOLDER]`
- Ongoing operation, monitoring or staffing of the system after handover.
- Anything not listed in section 2.

---

#### 4. Assumptions

The price and timescale assume the following. If any turns out to be untrue, we
will tell you before doing further work, and we will agree the effect on price and
dates in writing first.

- `[PLACEHOLDER: access to the systems named in section 2, within X working days
  of signature.]`
- `[PLACEHOLDER: data is in the format and condition described, and quality is as
  described.]`
- `[PLACEHOLDER: a named person can answer questions and make decisions within X
  working days.]`
- `[PLACEHOLDER: third-party platforms behave as documented and their terms permit
  the integration described.]`
- `[PLACEHOLDER: volumes are approximately X per month.]`

---

#### 5. What we need from you

| What | Who | By when |
|---|---|---|
| `[PLACEHOLDER: access to the systems in section 2]` | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| `[PLACEHOLDER: sample data]` | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| Decisions and answers to questions | `[PLACEHOLDER: named person]` | Within `[PLACEHOLDER]` working days |
| Testing during the review window in section 7 | `[PLACEHOLDER]` | `[PLACEHOLDER]` |

You keep your own backups of business-critical data throughout.

---

#### 6. Timeline

| Milestone | What happens | Target |
|---|---|---|
| Start | Signature, deposit, access granted | `[PLACEHOLDER]` |
| `[PLACEHOLDER]` | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| Delivery | Handed over for review | `[PLACEHOLDER]` |
| Acceptance | Review window closes | `[PLACEHOLDER]` |

Dates are targets and depend on section 4 and section 5. Delay in providing
access, data or decisions moves the dates by at least the same amount.

*Guidance: milestone dates go into the project record in the team space so the
client sees progress in the portal without asking.*

---

#### 7. How we agree it is finished

**Acceptance criteria.** The work is complete when all of the following are true.

1. `[PLACEHOLDER: a specific, testable statement. "Uploading last month's file
   produces the report in under two minutes with no manual editing."]`
2. `[PLACEHOLDER]`
3. `[PLACEHOLDER]`

*Guidance: every criterion must be something the client can test themselves,
without us in the room, and get a yes or no. "Works well" is not a criterion.
Three to six of them. Write these before writing the price.*

**Review window.** You have `[PLACEHOLDER: 10]` working days from delivery to test
against the criteria above and tell us in writing of anything that does not meet
them. If we have not heard from you within that window, the work is treated as
accepted.

**Defects.** A defect is the work not meeting a criterion in this section. We fix
defects at no charge for `[PLACEHOLDER: 30]` days after acceptance.

**Changes.** Anything else is a change, including new requirements, changed
requirements, and problems caused by changes to your own systems or to third-party
platforms after acceptance. Changes are handled under section 8.

---

#### 8. Changes

Changes are agreed in writing before the work is done. Each is either quoted
separately or drawn from your credit balance, whichever you prefer.

We will not do unrequested extra work and invoice for it, and we will not absorb
requested extra work silently. Both are how fixed-price projects go wrong.

---

#### 9. Price

*Guidance: use one of the two blocks below and delete the other.*

**Block A — efficiency solution, priced on value**

| | |
|---|---|
| Cost of the current process | £`[PLACEHOLDER]` per month |
| Expected cost after implementation | £`[PLACEHOLDER]` per month |
| Expected monthly saving | £`[PLACEHOLDER]` |
| Expected first-year value | £`[PLACEHOLDER]` |
| **Implementation price** | **£`[PLACEHOLDER]`, fixed** |

These figures are based on the information you have given us. They are an
estimate of what the change is worth, not a guarantee of what you will save.

**Block B — capability solution, fixed price**

| | |
|---|---|
| **Implementation price** | **£`[PLACEHOLDER]`, fixed** |

This is something your business does not have today, so there is no existing cost
to measure against. The price is fixed for the scope in section 2.

**Both blocks**

Prices exclude VAT. `[PLACEHOLDER: confirm VAT position.]`

Third-party subscriptions, licences and usage charges are yours, in your own
accounts, and are not included: `[PLACEHOLDER: name them and give the expected
monthly cost if known.]`

**Payment**

| Stage | Amount | When |
|---|---|---|
| Deposit | `[PLACEHOLDER]`% | On signature |
| `[PLACEHOLDER]` | `[PLACEHOLDER]`% | `[PLACEHOLDER]` |
| Final | `[PLACEHOLDER]`% | On acceptance |

Invoices are payable within `[PLACEHOLDER: 30]` days.

---

#### 10. Support after handover

There is no retainer and no monthly fee. You do not pay us to be on standby.

Support is bought as n.abl credits and used when you actually need something.
Credits cover three things:

| Credit type | Covers |
|---|---|
| **Build** | Small modifications, integrations, scripts, automation changes |
| **Assist** | Troubleshooting, repairs, configuration, technical support |
| **Educate** | Staff training, workshops, documentation, tool training |

`[PLACEHOLDER: pack size, price, expiry, and the discount for buying alongside
this implementation. Do not quote credits until 12-pricing and 13-credits set
these. Delete this section rather than invent a number.]`

Credits are not a service level agreement. They buy work, not a response time.

---

#### 11. Ownership

You own what we build for you. On payment in full, the deliverables in section 2
become yours outright, including the source code, the configuration and the
credentials needed to run and change them without us.

We keep our own pre-existing tools, methods and general know-how, and remain free
to use that expertise for other clients. Nothing we reuse contains your data or
anything confidential to you.

Your data, content and business records are yours throughout and we claim nothing
over them.

---

#### 12. Limits

- We build the system. We do not provide legal, medical or financial advice, and
  nothing the system produces is advice from us. Where the work touches an area
  like that, you remain responsible for the decisions taken and for any
  professional advice you need.
- We do not warrant that third-party platforms outside our control will keep
  working as they do today.
- Estimates of savings or efficiency gains are illustrative, based on the figures
  you have supplied.

---

#### 13. Data and access

`[PLACEHOLDER: what data we will see, where it will be held, and for how long.]`

Delivering this work involves hosted services, including cloud-based AI services
used as development tools. If any of your information is confidential or contains
personal data, tell us before work starts so we can restrict how it is handled.
Where the work involves us handling personal data on your behalf, we will agree
separate written data protection terms first.

*Guidance: this is not boilerplate. Claude is a cloud service. If a client says
their data must not leave their systems, that constrains the build to ordinary
code and locally run models, and it changes the estimate. See master plan section
4, and clause 6 of `nda-template.md`.*

---

#### 14. Agreed

| | n.abl | `[PLACEHOLDER: client]` |
|---|---|---|
| Name | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| Role | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| Signature | | |
| Date | | |

---

## Worked example

The arithmetic from the master plan, section 3, filled into section 1 and section
9 of the template. Reuse these numbers when explaining the method, and replace
them with the client's own when quoting.

**What it costs today**

| | |
|---|---|
| Time spent | 12 hours per month |
| Loaded hourly cost | £20, supplied by the client |
| Current cost | £240 per month |

**Price**

| | |
|---|---|
| Cost of the current process | £240 per month |
| Expected cost after implementation | £40 per month, 2 hours |
| Expected monthly saving | £200 |
| Expected first-year value | £2,400 |
| **Implementation price** | **£1,200, fixed** |

The sentence the client should be able to say back to you: *spend about £1,200
once, remove about £2,400 a year of labour.*

Two things to hold on to when using this:

- The arithmetic is checkable in front of the client, on a single side of paper.
  That is most of why it works.
- Our own time does not appear anywhere in it. We track internal labour cost to
  know which jobs are profitable, and we do not sell hours, because hourly pricing
  punishes us for getting faster.

---

## Before you send it

- [ ] Every guidance line deleted.
- [ ] Every `[PLACEHOLDER]` filled or the section removed.
- [ ] Acceptance criteria are testable by the client alone.
- [ ] The out-of-scope list has at least three real entries.
- [ ] The price block matches the pricing category, and only one block remains.
- [ ] Credits section either has real numbers or has been deleted.
- [ ] No claim that any of this has been reviewed by a solicitor.
- [ ] Referenced service agreement exists and is signed.
- [ ] Read it once as the client. Anything you would query, they will query.
