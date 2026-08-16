# 12 — Pricing

**Status: not started.**

No quote has ever been issued. `Q-2026-001` does not exist. No ROI worksheet has
been filled in on a real call, no implementation price has been agreed with
anyone, and no credit pack size or price has been set. The three documents beside
this one are drafts written from the master plan. They have never met a client.

This folder is the plan for pricing the first job, not a record of jobs priced.

Last substantive revision: 2026-08-16.

---

## What this step is

The commercial method: how a conversation about a problem becomes a number, and
how that number becomes a document the client can sign.

It covers three things and nothing else:

1. **The arithmetic.** The value calculation from the master plan, §3, and the
   questions that fill it in.
2. **The quote.** A one-page document that states the number, what it buys and
   what it does not.
3. **The examples.** Worked cases, including the canonical one, so that two
   people price the same job the same way.

**This step is not** the contract or the scope of work (`04-legal`), the credit
ledger (`13-credits`), the delivery runbook (`14-delivery`), or the internal cost
model (`15-compute`, `16-finance`). The quote states a price. The scope of work
states what is being bought. They are separate documents and they are signed
together.

In the build order this is the paper half of **v5 — the commercial layer**. The
master plan describes v5 as the ROI calculator turned into a quote generator. A
generator needs something to generate. That something is written here, on paper,
and it has to work in a notebook before it is worth writing in React.

---

## The method, stated once

Category A, efficiency solutions — an existing process made cheaper, faster or
better — is priced on **economic value, not hours**.

```
  current monthly cost of the problem
– expected monthly cost after implementation
= monthly value created
× 12
= first-year value

price = a fraction of first-year value
```

**The canonical worked example.** It is the one in the master plan, the one on
the website and the one in the scope-of-work template. Reuse it exactly. Do not
improve it.

> A task takes 12 hours a month. At a £20/hour loaded cost, that is **£240 a
> month**.
>
> After implementation it takes 2 hours a month, so **£40 a month**.
>
> That is **£200 a month saved**, or **£2,400 a year**.
>
> An implementation priced at roughly **£800 to £1,500** lets the client see it
> plainly: *spend about £1,200 once, remove about £2,400 a year of labour.*

Category B, capability solutions — a portal, an app, a website, an internal tool
the business did not previously have — is **fixed price**. There is no honest
before-figure to subtract from, because the process did not exist. ROI cannot be
measured before the fact, and a projected return on something nobody has done
yet is a number nobody believes, including us. So category B sells a defined
scope at a stated price, and changes go through credits or a new quote.

Category C, credits, is the post-project layer. Pack sizes and prices are
**[PLACEHOLDER — to be set after the first three real quotes, per the master
plan]**. Until then, no quote states a credit price. Deleting the section is
correct. Inventing a number is not.

### Why hourly pricing is rejected

Not a preference. A structural decision, and it holds in both categories.

**Hourly pricing punishes us for getting faster.** The entire point of the
tooling, the routing in the master plan §4 and every reusable component we build
is that the second job of a kind takes a fraction of the first. Under an hourly
rate, every one of those improvements cuts our own invoice. We would be paid most
for being slow and least for being good, and the incentive would eventually win.

It is also worse for the client. An hourly quote makes our estimate their risk.
A fixed number makes it ours, which is where it belongs, and it is the single
strongest thing about the commercial model. See `01-positioning/objection-
handling.md`, objection 5.

### The internal cost line

**We track our own labour cost on every job. We never sell it.**

Both halves matter. We record hours internally because we need to know which
kinds of work are profitable, which components paid for themselves and which
category of job to stop taking. That number goes to `16-finance`.

It does not appear in a quote, in a proposal, in a conversation or in an answer
to "what is your day rate?". There is no day rate. The client buys an outcome at
a stated price.

---

## What "done" looks like

Eleven statements. **None of them are true today.**

- [ ] The ROI worksheet has been used on at least three real calls and the
      questions survived contact with people who do not know their own numbers.
- [ ] The house fraction of first-year value is written down as a range with a
      stated default, rather than being re-decided every time.
- [ ] A quote template exists that a client has actually read, and it fits on one
      page.
- [ ] Three real quotes have been issued, numbered from `Q-2026-001`, and each
      one's arithmetic is recorded alongside it.
- [ ] Credit pack sizes, prices, expiry and the bundled discount are set, from
      those three quotes rather than from guesswork.
- [ ] A standard payment schedule exists — deposit, stages, final — and is the
      same on every quote unless there is a reason written down.
- [ ] The VAT position is stated and applied consistently on every quote.
- [ ] Every issued quote has a matching scope of work from `04-legal`, and the
      two do not contradict each other.
- [ ] The internal labour cost of each delivered job is recorded, and the record
      is somewhere `16-finance` can read it.
- [ ] The floor is written down: the smallest job worth quoting, and what is said
      to a client whose arithmetic falls below it.
- [ ] Nothing in any client-facing pricing document states an hourly rate, a day
      rate, or our internal cost.

Zero of eleven.

---

## Honest status, in one paragraph

The method is decided and it is written down here, in the master plan and on the
website. What does not exist is any evidence that it works: no call has been run
against the worksheet, no quote has gone out, and the fraction of first-year
value that turns £2,400 into a price is currently a band inferred from one
illustrative example rather than a rule tested against a real deal. The credit
layer is a described product with no prices. The payment schedule and the VAT
position are both open, and `04-legal` is waiting on both. None of this is
blocked by v2 — writing worksheets and templates is paper, not software — so the
only thing standing between this folder and its first real number is a call with
a business that has a problem worth measuring.

---

## Next actions, in order

1. **Read [`roi-worksheet.md`](roi-worksheet.md) once, all the way through,
   before the next call.** It is a script to be held in your head, not a form to
   read aloud.
2. **Set the payment schedule.** A deposit percentage on signature and the
   balance on acceptance is the obvious default. `04-legal` has a `[PLACEHOLDER]`
   waiting for it in the scope-of-work template and cannot be finished without
   it. One decision, ten minutes.
3. **Settle the VAT position** — registered or not, and whether prices are stated
   inclusive or exclusive. It changes every number on every quote, so it is
   decided once, now, and not per deal.
4. **Write down the floor.** Below some first-year value there is no efficiency
   price that repays a build in a sensible period. Decide the number, and decide
   what is said instead: fold it into a larger job, sell it as credits later, or
   decline it. `worked-examples.md` §4 is the case that forces the question.
5. **Fill in the worksheet by hand for a process you already know** — one of our
   own, before it is ever pointed at a client. The welcome-pack generator and the
   email pack both replaced real manual assembly. If the arithmetic cannot be
   made to work on a process you understand completely, it will not survive a
   process you have known for twenty minutes.
6. **Run the worksheet on the first three real calls, whatever they lead to.**
   Fill it in even when the answer is no. A worksheet that says "no efficiency
   price supports this build" is a successful use of the worksheet.
7. **Issue `Q-2026-001` from [`quote-template.md`](quote-template.md)**, with its
   arithmetic stored beside it, and a matching scope of work from `04-legal`.
8. **After three quotes, set the fraction and the credit prices.** Not before.
   The master plan is explicit that the credit numbers wait for real quotes, and
   the same reasoning applies to the fraction.
9. **Only then consider the v5 quote generator.** A generator built before the
   paper version is stable encodes the wrong method and makes it harder to
   change, and the master plan puts v2, v3 and v4 in front of it regardless.

Steps 2, 3 and 4 are three decisions that cost nothing but keep being deferred.
They block `04-legal` as well as this folder.

---

## What each file in this folder is for

| File | What it is for | Read it when |
|---|---|---|
| `README.md` | This file. What the step is, what done means, the honest status, what to do next. | Opening the folder cold |
| [`roi-worksheet.md`](roi-worksheet.md) | The questions to ask on a call to fill in the arithmetic. The order to ask them in, how to handle "I do not know", the loaded-cost method, the residual, evidence and confidence, and the completed worksheet form. | Before every discovery call, and while writing the numbers up afterwards |
| [`quote-template.md`](quote-template.md) | The quote itself. Why the old Power Platform line-item template is gone, the category A and category B versions, the shared blocks, and the pre-send checklist. | Turning a filled-in worksheet into a document |
| [`worked-examples.md`](worked-examples.md) | The canonical example in full, plus variants: a disappointing residual, a job too small to price, a multi-person process, a mistake-driven case, and a capability job with no arithmetic at all. | Learning the method, checking your own sums, or arguing about a number |

---

## Things in here that must not be got wrong

**1. The canonical example is fixed.** 12 hours at £20 is £240; 2 hours after is
£40; £200 a month, £2,400 a year; £800 to £1,500 to implement, about £1,200 in
the middle. It appears in the master plan, on the site, in the scope-of-work
template and here. If it ever changes it changes in all four places on the same
day, or clients will be shown two different sets of arithmetic.

**2. Category B is fixed price, and the reason is honesty, not laziness.** The
temptation with a capability job is to invent a before-figure so the ROI slide
looks the same. There is no before. Say so, state the scope, state the price.

**3. Never quote an hourly or day rate.** Not as a comparison, not as a
sanity-check, not "it works out at about £X an hour". The moment that number is
said out loud, the negotiation is about hours, and hourly pricing punishes us for
getting faster.

**4. Our internal labour cost is tracked and never sold.** It goes in the job
record for `16-finance`. It never goes in a client document.

**5. The client's figures are the client's figures.** We do not supply the hours,
the rate or the error count. We ask, we write down what they say, and we round
the saving down. An estimate we invented becomes a promise we made.

**6. The projection is not a guarantee.** `04-legal` is clear that value pricing
is not a promise of value. Quotes say "expected" and "based on the figures you
gave", and no quote contains a guaranteed saving.

**7. No retainers.** Staged payments against delivery are not a retainer and are
fine. A monthly standing charge is not on the menu at any price.

**8. No invented numbers anywhere.** No statistics, no client names, no case
studies, no testimonials, no "typical client saves". Everything unfixed in this
folder is marked `[PLACEHOLDER]`, and it stays marked until it is real.
