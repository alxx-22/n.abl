# Cost tracking

**Status: not started.** No job has been costed. No log exists, in any form. No
monthly review has happened. The only cost figure the business has is the £36 a
month headline from master plan section 8, which is an input, not a measurement.

This file is the plan for measuring. It is deliberately small, because a
measurement system nobody keeps up is worse than none — it produces confident
numbers from partial data.

Last substantive revision: 2026-08-16.

---

## 1. Why any of this is tracked

Three reasons, and only three. Anything that does not serve one of them does not
get measured.

**Reason 1 — to know which work is profitable.** Master plan section 3A: we
price on the value released, not on hours, but we still track our own labour
cost internally, because we need to know which kinds of work are worth taking.
`12-pricing` cannot answer that question without this data.

**Reason 2 — to keep the routing honest.** The three-class model only saves
money if it is applied. A monthly figure for the share of work that ran on Class
1 is the only way to notice that it has quietly stopped being applied.

**Reason 3 — to make spend decisions from evidence.** Master plan section 8 puts
compute sixth in the spending order, and only "when there is a measured queue
that justifies it". A measured queue requires measurement.

**What is explicitly not a reason: billing.** No client is ever shown an hourly
figure, a per-job labour cost, or a compute cost. Hourly pricing punishes us for
getting faster, and getting faster is the entire point of the routing discipline.
These numbers are internal, permanently.

---

## 2. What a job actually costs

Four costs, and they behave completely differently.

| Cost | Behaviour | How it is tracked |
|---|---|---|
| **Fee cost, Class 1** | £0 | Not tracked. It is zero. |
| **Fee cost, Class 2** | £0 in fees | Not tracked as money. Machine hours noted only if a job runs long enough to be inconvenient. |
| **Fee cost, Class 3** | Flat £36/month for two Claude Pro subscriptions, regardless of use | Tracked as **capacity**, not pounds. See section 4. |
| **Our labour** | The real cost of every job, by a distance | Hours, per job, per phase. Section 3. |

The important consequence: **for a given job, the marginal cash cost is
effectively zero.** Everything is either free or already paid for. The scarce
resources are our hours and our Class 3 capacity, and those are what get
measured.

A job that took 14 hours and produced a £1,200 implementation is the number that
matters. At a £20 an hour loaded cost that is £280 of our time against £1,200 of
revenue, which is a decision-grade fact. "It used no API credits" is not.

---

## 3. The job log

One row per job. Filled in **at the end**, from what happened, not at the start
from what was expected.

| Field | What goes in it |
|---|---|
| `job_id` | Short reference |
| `client` | Or `internal` |
| `category` | One of the six problem-led categories from `01-positioning` |
| `pricing_type` | Efficiency (A), Capability (B) or Credits (C) |
| `price_quoted` | What the client paid |
| `hours_discovery` | Understanding the problem, on site or on a call |
| `hours_build` | Writing it |
| `hours_test` | Including any Class 2 acceptance testing |
| `hours_handover` | Documentation, training, the welcome pack |
| `hours_aftercare` | Anything unbilled after delivery. This is the number that reveals a bad job. |
| `class_1_share` | Rough share of the delivered system that is ordinary code |
| `class_2_share` | Rough share that is local model |
| `class_3_at_build` | Was Claude used to build it. Yes or no, plus a note. |
| `class_3_at_runtime` | Is Claude in the running system. Should almost always be no. |
| `reuse_from` | What existing work this was built on |
| `reusable` | What this produces that the next job can use |
| `what_went_wrong` | One line. Honest. |

The shares are estimates to the nearest 10%. Precision here is false; the signal
is "mostly Class 1" versus "somehow mostly Class 3", and that is visible at 10%
resolution.

### Where the log lives

**Start as a single Markdown table in this folder,** committed to the
repository. Not a database, not a team-space tab, not a spreadsheet somewhere.

The reason is the failure mode: a proper system built before there is any data
becomes a thing to maintain instead of a thing to use, and the log stays empty.
`13-credits` makes the same argument about its ledger and reaches the opposite
conclusion, correctly, because a credit ledger holds money and this holds
retrospective estimates.

Move it into the team space when there are more than roughly fifteen rows, or
when `16-finance` needs to read it programmatically, whichever comes first.

### Job log

| job_id | client | category | price | hours | C1/C2/C3 | note |
|---|---|---|---|---|---|---|
| `[none yet]` | | | | | | |

Empty, because no job has been delivered. It stays empty until one has.

---

## 4. Class 3 is tracked as capacity, not pounds

This is the part most likely to be got wrong, and it follows directly from the
correction in the folder README.

Two Claude Pro subscriptions cost **£36 a month whether they are used once or
constantly**. There is no per-call charge to add up. So there is no meaningful
"this job cost £4.20 of Claude", and inventing one produces a fake number that
will end up in a pricing conversation.

What is actually scarce:

| Scarce thing | What running out looks like |
|---|---|
| **Usage capacity** | Hitting a limit mid-afternoon, on the day a proposal is due |
| **Review time** | Class 3 output that nobody has time to check properly, which is worse than no output |
| **Attention** | Using the expensive tool on something a rule would have handled, and not noticing |

So the Class 3 measure is a note, not an arithmetic:

- Did we hit a usage limit this month? How many times, and on what?
- What was Class 3 spent on? Three or four lines is enough.
- Was any of it work that should have been routed lower?

If limits are being hit regularly while the answers to the third question are
uncomfortable, the problem is routing, not capacity. Master plan section 8 makes
this point explicitly: most "we need more compute" is actually "we are sending
Class 1 work to Class 3".

---

## 5. The monthly review

Fifteen minutes, at the end of the month, both founders. Six questions.

1. **What did we deliver, and how many hours did it take?** From the job log.
2. **What share of the delivered work was Class 1?** One number. It should be a
   large majority. If it is falling, find out why before the next quote.
3. **Where did Class 3 go?** Section 4. Was any of it misrouted?
4. **What can be demoted?** `routing-rules.md` section 6. What did we pay for
   intelligence for this month that we now understand well enough to write as a
   rule? This is where the real saving lives.
5. **What was built that is reusable?** The second job in a category should be
   materially cheaper than the first. If it is not, we are rebuilding.
6. **Did the fixed cost base move?** It should be £36. If it is not, what
   changed and was it a one-off purchase or a new recurring commitment.

Write the six answers in five lines under a dated heading. Do not produce a
report. A review that takes an hour to write happens twice.

### Reviews

`[none yet — the first review happens at the end of the first month in which any
real work is delivered]`

---

## 6. The test before spending anything on compute

Master plan section 8 puts compute sixth in the order of first earnings, behind
tax set-aside, backups, insurance and a solicitor, sending infrastructure and a
licensed data source. It also attaches a condition: only when there is a
measured queue that justifies it, and only after the routing has been applied
properly.

That condition is this test. **All five must be true, in writing, before any
money is spent on compute.**

- [ ] There is a **measured** queue. Named jobs, waiting, with dates — not a
      feeling that things are slow.
- [ ] The routing has been applied to the queued work, and it is genuinely Class
      2 or Class 3. If it is Class 1 waiting to be written, the constraint is our
      hours and a machine does not fix it.
- [ ] The demotion review in section 5 question 4 has been done this month and
      found nothing worth demoting.
- [ ] The purchase removes the constraint. A faster machine does not help if the
      bottleneck is that nobody has labelled the acceptance test set.
- [ ] It is a **one-off purchase, not a new recurring cost**, or there is an
      explicit decision to raise the fixed base. Master plan section 8: do not
      raise the fixed cost base to solve a problem a one-off purchase would
      solve. The £36 figure is an asset.

The reason to write this as a checklist rather than a principle is that the
moment it gets used is the moment the business is busy and the purchase feels
obviously justified. That is exactly when a five-line check is worth having.

---

## 7. What this feeds

| Folder | What it needs from here |
|---|---|
| `12-pricing` | Real labour hours per category, so the ROI worksheet's confidence question has an evidence base and so we can tell which categories are worth quoting for |
| `13-credits` | Actual delivery labour on three real jobs, which is the stated precondition for setting a credit price at all |
| `16-finance` | The running cost base, the labour cost per job and the spend-decision test. This folder does the measuring; `16-finance` decides what to do about it. That folder does not exist yet. |
| `15-compute` itself | The Class 1 share, which is the only real measure of whether the routing discipline is alive |

---

## 8. Things that must not be got wrong

**1. Hours are measured and never sold.** Internal, permanently. The moment an
hourly figure appears in a client document, the pricing model in master plan
section 3A has been abandoned.

**2. Do not invent a per-job Claude cost.** The subscription is flat. A made-up
per-call figure is an invented statistic, and this business does not write those.

**3. Log at the end, honestly.** A job log full of the hours we meant to spend
is worse than no job log, because it produces confident wrong pricing. The
`hours_aftercare` and `what_went_wrong` fields exist precisely because they are
the ones people are tempted to leave blank.

**4. £0 in fees is not £0 in cost.** Class 1 and Class 2 cost hours, electricity
and attention. "Free" in this folder always means "no fee", never "no cost", and
the distinction matters when deciding whether to build something or leave it
manual.

**5. A rising Class 3 share is a routing failure, not a growth signal.** It
usually means work is being started before it is specified. Fix the
specification, not the budget.

**6. The £36 is the thing being protected.** It is what makes a slow month
survivable. n.abl does not need to win work to survive the month; it needs to
win work to grow. Every measurement in this file exists to keep that true.
