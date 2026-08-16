# Worked examples

Six cases, so that two people pricing the same job arrive at the same number.

**Every example on this page is illustrative.** None of them is a client, none of
them is a job we have done, and none of the figures came from a real business.
They exist to demonstrate the arithmetic. No client name, case study or
testimonial appears anywhere in this folder, because we do not have any.

The one exception is §1, which is canonical and is used publicly.

---

## 1. The canonical example

This is the example in the master plan §3, on the website, in the scope-of-work
template in `04-legal`, and in the README beside this file. **Reuse it exactly.**
If it ever changes, it changes in all of those places on the same day.

> A task takes 12 hours a month. At a £20/hour loaded cost, that is **£240 a
> month**.
>
> After implementation it takes 2 hours a month, so **£40 a month**.
>
> That is **£200 a month saved**, or **£2,400 a year**.
>
> An implementation priced at roughly **£800 to £1,500** lets the client see it
> plainly: *spend about £1,200 once, remove about £2,400 a year of labour.*

Laid out as the worksheet lays it out:

| | |
|---|---|
| Current hours per month | 12 h |
| Loaded cost per hour | £20 |
| **Current monthly cost** | **£240** |
| Residual hours per month | 2 h |
| **Expected monthly cost after** | **£40** |
| **Monthly value created** | **£200** |
| **First-year value** | **£2,400** |
| Implementation | £800 – £1,500, about £1,200 |
| Payback at £1,200 | 6 months |

Why this one works, and why it should not be improved:

- **It is checkable on one side of paper**, in front of someone, with no
  spreadsheet. That is most of the reason it persuades.
- **The residual is not zero.** Two hours a month remain, stated up front. Every
  competitor's version of this slide says the work disappears entirely.
- **Our time appears nowhere in it.** We track internal labour cost to know which
  jobs are profitable. We do not sell it, because hourly pricing punishes us for
  getting faster.
- **The numbers are ordinary.** Twelve hours and £20 an hour are figures a small
  business recognises. Nothing here is a best case.

---

## 2. The same job with a disappointing residual

Same before-figure. The discovery call reveals that half the work is judgement
about awkward cases and cannot be automated.

| | |
|---|---|
| Current hours per month | 12 h at £20 |
| **Current monthly cost** | **£240** |
| Residual hours per month | 6 h |
| **Expected monthly cost after** | **£120** |
| **Monthly value created** | **£120** |
| **First-year value** | **£1,440** |
| Implementation | about £700 |
| Payback | about 6 months |

**The lesson: the price falls with the residual, and it must.** The temptation is
to keep the £1,200 because the build is the same size. Resist it. The number is a
fraction of value created, not of effort expended, and a client who was quoted on
a two-hour residual and got a six-hour one will notice within a month.

This is why part 3 of the worksheet exists, and why the residual is agreed on the
call rather than assumed afterwards.

---

## 3. A process spread across several people

The commonest case where the before-figure is badly underestimated, because each
person reports only their own share and nobody adds it up.

Four people, five hours each per month, at a £22 loaded cost. Eighty per cent of
it is data movement.

| | |
|---|---|
| People | 4 |
| Hours each per month | 5 h |
| Total hours per month | 20 h |
| Loaded cost per hour | £22 |
| **Current monthly cost** | **£440** |
| Residual hours per month | 4 h |
| **Expected monthly cost after** | **£88** |
| **Monthly value created** | **£352** |
| First-year value, unrounded | £4,224 |
| **First-year value, rounded down** | **£4,200** |
| Implementation | about £2,000 |
| Payback | about 6 months |

Two rules on display:

- **Ask who else touches it.** The owner would have described this as "five hours
  a month". It is twenty, and the arithmetic quadruples.
- **Round the first-year value down, never up.** £4,224 becomes £4,200. The
  rounding always goes against us, so that reality always lands on the good side
  of the quote.

---

## 4. The job that should not be built

The most useful example on this page.

A task takes about ninety minutes a month. It is irritating, it is visible, and
the owner mentions it first because irritation is what people remember.

| | |
|---|---|
| Current hours per month | 1.5 h at £20 |
| **Current monthly cost** | **£30** |
| Residual hours per month | 0.5 h |
| **Expected monthly cost after** | **£10** |
| **Monthly value created** | **£20** |
| **First-year value** | **£240** |

There is no implementation price that works. Even a £400 build takes twenty
months to repay, and the client would be right to refuse it.

**What to say:**

> "Let me show you the arithmetic on this one. It's costing you about twenty
> pounds a month, and anything I built for it would take a year and a half to
> pay for itself. That's your call rather than mine — but on those numbers I'd
> leave it. Tell me more about the other thing you mentioned, the one with the
> spreadsheet."

**Note the phrasing.** The numbers do the refusing, not us. "This isn't worth
building" is a verdict on their problem; "here is the arithmetic, and on these
numbers I'd leave it" is the same information with the decision left where it
belongs. The distinction is in `02-brand/brand-promise.md` §4.2, and it is the
difference between declining work honestly and grading a customer's problem.

Three things that follow from saying it:

1. It is true, and the arithmetic is on the table, so it is visibly true.
2. It moves the conversation to the process that is actually expensive, which is
   usually the one they mentioned in passing.
3. It is the cheapest credibility available. A supplier who talks you out of a
   piece of work is remembered.

**The floor is currently [PLACEHOLDER — decide the first-year value below which
no efficiency build is quoted, and what is offered instead].** Options for the
"instead": fold it into a larger job in the same business, defer it and sell it
later as credits, or decline it.

---

## 5. A job where the cost is mistakes, not hours

Only counted when the client volunteers figures they can stand behind. Here they
say roughly two orders a month go out wrong, each costing about £45 in refunds
and redelivery, on top of three hours a month of checking and chasing.

| | Before | After |
|---|---|---|
| Time per month | 3 h at £20 = £60 | 1 h at £20 = £20 |
| Errors per month | 2 at £45 = £90 | 1 at £45 = £45 |
| **Monthly cost** | **£150** | **£65** |

| | |
|---|---|
| **Monthly value created** | **£85** |
| First-year value, unrounded | £1,020 |
| **First-year value, rounded down** | **£1,000** |
| Implementation | about £500 |
| Payback | about 6 months |

Three cautions:

- **The error rate does not go to zero either.** It halves here. A system that
  never makes a mistake is not a thing that exists, and claiming one is how a
  quote becomes a complaint.
- **The £45 is theirs, not ours.** We never supply the cost of a mistake. If they
  cannot put a number on it, it is described in words and left out of the
  arithmetic.
- **The unquantified damage stays unquantified.** If they say it has cost them
  customers, note it, let them weigh it, and do not put a figure on a lost
  customer in a document. An invented number there discredits the honest ones
  above it.

---

## 6. A capability job, with no arithmetic at all

A business wants something it has never had: a portal where its customers can log
in and see their own documents.

| | |
|---|---|
| Current monthly cost of the problem | — |
| Expected monthly cost after | — |
| Monthly value created | — |

There is nothing to subtract. The process does not exist, so there is no
before-figure, and a projected return on something nobody has ever done is a
number nobody believes, including us.

**So it is fixed price.** What replaces the arithmetic:

- a clear description of the capability, in the client's own words
- a defined scope, with acceptance criteria in the scope of work
- one number, fixed, which does not move if the work is harder than expected
- changes handled through credits or a new quote, agreed in writing beforehand

Price: **[PLACEHOLDER — no capability price has been set, because no capability
job has been quoted. Do not put an illustrative figure here; an example price for
a portal would be read as a price list.]**

If a genuine measurable saving sits alongside the new capability, that part is a
category A component and belongs on its own quote with its own arithmetic. One
page, one pricing category.

---

## 7. An automation job, priced on the work it removes

The category-1 shape at a size where the arithmetic gets easy, and the example
to reach for when somebody asks what "automation" is actually worth.

**The problem, in their words.** *"Two people spend most of a day each week
copying orders out of email into the system, and chasing the ones that look
wrong."*

**Their numbers, asked for and written down:**

> Two people, roughly half a day each, five days a week. Call it 20 hours a
> month between them once you take out the weeks it is quieter.
>
> Loaded cost £20 an hour → **£400 a month**, **£4,800 a year**.

**Afterwards.** Orders arrive already in the system. Anything the parser is not
confident about is flagged for a human rather than guessed at, which is the
residual: somebody still looks at the exceptions.

> Residual, agreed with them: about 3 hours a month → **£60 a month**.
>
> Saving: **£340 a month**, **£4,080 a year**. Round down: call it **£4,000**.

**Price.** £2,000 to £3,200. At £2,600 the client spends once to remove about
£4,000 a year of copying, and the payback lands inside eight months.

**What makes this an automation job rather than a "save time" job.** Nothing.
That is the point of the layer split: *save time* is how the client describes
it, *automation* is what we build. The client never has to know the second word.

---

## 8. An analytics job, priced on the reporting it replaces

Data and analytics work prices exactly like any other efficiency job when there
is a manual reporting process to measure against. The mistake to avoid is
treating analytics as inherently unmeasurable and defaulting to fixed price.

**The problem, in their words.** *"It takes me two days at the start of every
month to work out how the last one went, and by the time I know, it's too late
to do anything about it."*

**Their numbers:**

> Two days a month, owner's own time. Loaded at £35 an hour — higher than staff
> cost, because it is the owner and the hours have an alternative use.
>
> 16 hours × £35 = **£560 a month**, **£6,720 a year**.

**Afterwards.** Sales, stock and hours are reconciled on a schedule into one
dataset, and the monthly pack builds itself. The owner still reads it and still
makes the judgement — that is the residual, and it is the part worth keeping.

> Residual: about 2 hours a month reading and deciding → **£70 a month**.
>
> Saving: **£490 a month**, **£5,880 a year**. Round down: **£5,500**.

**Price.** £2,750 to £4,400. At £3,500, payback lands around seven months.

**The part not in the arithmetic, and not sold as if it were.** The owner sees
the numbers on the 2nd instead of the 15th, which is worth something real and
cannot be counted. Say it plainly as an unpriced benefit; do not put a figure on
it. A number invented to make a proposal look better is the first thing to fall
apart at the three-month review.

**When this becomes category B instead.** If the business has never produced the
report at all, there is no before-figure, nothing to measure, and it is a fixed
price. Do not manufacture a baseline by asking what it "would" take.

---

## The pattern across the examples

| # | Case | First-year value | Price | Payback |
|---|---|---|---|---|
| 1 | Canonical | £2,400 | ~£1,200 | 6 months |
| 2 | Larger residual | £1,440 | ~£700 | ~6 months |
| 3 | Four people | £4,200 | ~£2,000 | ~6 months |
| 4 | Too small | £240 | none | — |
| 5 | Mistake-driven | £1,000 | ~£500 | ~6 months |
| 6 | Capability | not measurable | fixed | not applicable |

The payback column lands in the same place every time, and that is not a
coincidence: pricing at about half of first-year value *is* a six-month payback.
It is a useful sanity check. If a price implies a payback much longer than a year,
the client will not buy it and should not. If it implies one much shorter than
three months, the value has probably been overstated somewhere and it is worth
re-reading the before-figure.

**The house fraction is still [PLACEHOLDER], to be set after the first three real
quotes.** What legitimately moves a price within the band: how much of the build
is reusable, how much is Class 1 code, how solid the client's figures are, and
how uncertain the residual is. What never moves it: how long we expect to spend.
That number is tracked internally for `16-finance` and is never sold.

---

## Rules these examples exist to demonstrate

1. **Their numbers, never ours.** We ask, they answer, we write it down.
2. **The residual is never zero.** State it, agree it, put it in the quote.
3. **Round the saving down.** Every ambiguity resolves against us.
4. **Sometimes the answer is no.** §4 is a successful use of the method.
5. **Capability work is fixed price.** No before-figure, no projection, no
   pretending otherwise.
6. **No hourly rate, ever.** It punishes us for getting faster, and it makes our
   estimate the client's risk.
7. **Expected, not guaranteed.** These are projections built on figures a client
   supplied. `04-legal` is clear that value pricing is not a promise of value.
8. **Automation and analytics are priced the same way as anything else.** §7 and
   §8 exist because both get mistaken for special cases — automation for being
   "just a script", analytics for being unmeasurable. Neither is. Where there is
   a manual process with hours attached, the method in §1 applies unchanged.
9. **Unpriced benefits stay unpriced.** Say them out loud, leave them out of the
   arithmetic. §8 has one.
