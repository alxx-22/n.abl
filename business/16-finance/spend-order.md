# Spend order

**Status: not started.** Nothing has been earned, so nothing has been spent and
no decision has been recorded. The order below has never been applied to a real
purchase.

This file exists now, before there is any money, because that is the only time
it can be written honestly. Deciding where the first earnings go while looking
at the first earnings produces a different and worse answer.

Last substantive revision: 2026-08-16.

---

## 1. How this is ranked

Not by appeal. Not by urgency as it feels on the day. By **risk removed per
pound**:

```
  probability the bad thing happens
× cost if it does
÷ price of removing it
```

The purchases that come out on top are the boring ones, because the boring ones
sit in front of the expensive failures. The purchases that come out at the
bottom are the ones that look like growth, because they mostly relocate risk
rather than removing it.

Two honest caveats about the arithmetic:

- **Item 1 is not a purchase at all.** Tax set-aside removes risk at a price of
  zero, because the money was never ours. It sits at the top on a technicality,
  and the technicality is the whole point.
- **The probabilities are judgement, not data.** There is no history to compute
  them from. Where a figure is a guess it is marked as one.

The order is from master plan section 8. This file expands each item with the
trigger, the test and the cost, and does not reorder it.

---

## 2. The order

### 1. Tax set-aside

| | |
|---|---|
| **Risk removed** | Spending money owed to HMRC, then owing it anyway with penalties and interest on top |
| **Probability if skipped** | Near certain. It is not a risk, it is arithmetic deferred. |
| **Cost if it happens** | The tax, plus penalties, plus a cash-flow hole at the worst possible moment |
| **Price** | £0. It is not our money. |
| **Trigger** | The first payment landing, before any of it is treated as income |
| **One-off or recurring** | Every single payment, permanently |
| **Amount** | `[PLACEHOLDER — percentage to be set with an accountant. See tax-and-admin.md section 3.]` |

**Money owed to HMRC was never revenue.** A payment landing in the account is
not income; part of it is passing through. The set-aside happens the day the
money arrives, not at the end of the quarter, and preferably into a separate
account so the balance in the working account is a true balance.

A business that spends its set-aside is not profitable. It is borrowing from a
creditor with statutory penalties and no negotiation.

---

### 2. Backups and continuity

| | |
|---|---|
| **Risk removed** | Losing client data with no clean recovery. Supabase's free tier has no point-in-time recovery. |
| **Probability if skipped** | Low per month, and the causes are ordinary: a bad migration, a mistaken delete, a bulk update without a `WHERE` clause |
| **Cost if it happens** | The engagement, the reference, and plausibly the business. There is no version of "we lost your data" that a small consultancy recovers from on its first client. |
| **Price** | `[PLACEHOLDER — Supabase paid tier, current price]` |
| **Trigger** | **The second paying client.** Master plan section 8: "the moment there is a second paying client, not later." |
| **One-off or recurring** | Recurring. One of very few recurring costs worth accepting. |

Why second and not first: with one client and no revenue, the exposure is a
conversation. With two, the exposure is a pattern, and one of them will have
data the other cannot see, which is exactly when a restore has to be surgical
rather than wholesale.

Before paying, do the free half: a scheduled export of the Supabase schema and
data, held somewhere that is not Supabase. That is Class 1 work, costs nothing,
and materially reduces the risk while the paid tier is still pending. The paid
tier then buys recovery precision, not the existence of a backup.

The related gap, which costs nothing to fix: the client-portal schema is not in
version control. Master plan section 6 lists it as a known gap. A backend that
cannot be rebuilt from source is a continuity problem whichever tier it runs on.

---

### 3. Insurance and a solicitor

| | |
|---|---|
| **Risk removed** | Unlimited personal exposure on every engagement, and contracts nobody qualified has read |
| **Probability if skipped** | Low per engagement. Not low across a working life. |
| **Cost if it happens** | Unbounded. This is the only item on the list where the downside has no ceiling. |
| **Price** | Professional indemnity: `[PLACEHOLDER — annual premium]`. Solicitor review of the contract set: `[PLACEHOLDER — one-off fee]` |
| **Trigger** | **Before the first contract is signed**, not after something goes wrong |
| **One-off or recurring** | Insurance is recurring, usually annual. The solicitor review is one-off per document set. |

**None of the legal documents have been reviewed by a solicitor.** Not the
privacy policy, not the terms, not the cookies page, not the NDA draft, not the
scope-of-work template. They carry a visible draft notice and that notice is
honest, and a notice is not a review. Do not tell anyone, in any document or any
conversation, that a review has happened.

This item is third rather than first because it cannot be bought before there is
a legal entity to insure and a contract to review, and both of those are
blocked in `tax-and-admin.md` and `04-legal`. It moves to first the moment those
unblock. In practice it will be the first real cheque this business writes.

Note the interaction with item 1: the entity decision changes what "personal
exposure" means. That is a question for the accountant and it is in
`tax-and-admin.md` section 2, not answered here.

---

### 4. Sending infrastructure

| | |
|---|---|
| **Risk removed** | Burning the `nabl.agency` domain reputation by sending outreach from an ordinary mailbox |
| **Probability if skipped** | High, once volume rises. Low while nothing is being sent, which is today. |
| **Cost if it happens** | The domain reputation, which recovers slowly and expensively, and takes the client-facing mail with it |
| **Price** | `[PLACEHOLDER — transactional sending service, monthly]` |
| **Trigger** | **v4 exists and outreach volume makes deliverability a real constraint.** Not before. |
| **One-off or recurring** | Recurring |

The order matters here in a way that is easy to get wrong. Master plan section 5
is explicit: **automate research before automating sending.** A machine that can
send 10,000 bad emails is a liability, not an asset, and paying for
deliverability before the shortlists are worth reading buys the ability to
distribute a worse problem faster.

So this is fourth on a technicality of sequence rather than of value. When v4 is
real, it moves up sharply, because at that point the risk is live every day.

---

### 5. A licensed data source

| | |
|---|---|
| **Risk removed** | Sourcing pressure pushing the lead pipeline towards data that terms of service do not permit |
| **Probability if skipped** | Moderate, and it rises with impatience |
| **Cost if it happens** | Enforcement, reputational damage, and a lead database that has to be deleted rather than corrected |
| **Price** | `[PLACEHOLDER — depends on the source. Compare against the hours it replaces.]` |
| **Trigger** | When manual sourcing and enrichment is measurably the bottleneck in v3, with the hours to prove it |
| **One-off or recurring** | Either. Prefer a dataset purchase over a subscription where the choice exists. |

Master plan section 5 is the reason this is on the list at all: **do not build
the core lead database by bulk-exporting Google Maps.** Google's Maps terms
restrict using Maps content to create or augment business listings, mailing
lists or telemarketing lists, and Places is pay-as-you-go with field-level
billing rather than a permanent free allowance. Google is one discovery signal,
never the database of record.

Paying for verified data is described in the master plan as "cheaper than the
alternative and considerably safer". That is the correct framing. This is a
compliance purchase wearing a productivity purchase's clothes.

Before buying, exhaust the free and permitted sources properly: Companies House,
local and industry directories, the businesses' own websites, council and
business directories, public company information. Enrichment from a business's
own site is permitted, more accurate than a directory listing, and produces
better outreach, because the letter can refer to something the business actually
said about itself.

---

### 6. Compute

| | |
|---|---|
| **Risk removed** | A measured queue of work waiting on capacity |
| **Probability if skipped** | Currently zero. There is no queue, because there are no jobs. |
| **Cost if it happens** | Delivery slipping on paid work |
| **Price** | `[PLACEHOLDER — a machine, or an additional subscription seat]` |
| **Trigger** | A measured queue, and only after the routing in master plan section 4 has been applied properly |
| **One-off or recurring** | **Prefer one-off.** A machine is a purchase. A seat is a permanent increase in the base. |

**All five parts of the test in `15-compute/cost-tracking.md` section 6 must be
true, in writing, before any money is spent here.** Do not restate the test in
this file; it lives there and it must not fork.

The point master plan section 8 makes and this file will not soften: **most "we
need more compute" is actually "we are sending Class 1 work to Class 3".** The
first response to a capacity complaint is the demotion review, not a purchase.
Class 1 is the majority of most projects, and a build coming out mostly Class 3
is a design problem with a budget symptom.

The related trap, from `15-compute`: Claude Code running locally is not a local
Claude model. Claude Code is a local interface and orchestration environment;
the Claude models are cloud-hosted. Buying a machine does not buy Claude
capacity. It buys Class 2 capacity, which is a different thing, and if the
constraint is Class 3 usage limits then a machine solves nothing at all.

---

### 7. Everything that only looks like growth

| | |
|---|---|
| **Risk removed** | None. This category buys hope. |
| **Price** | Individually small. Collectively, the cost base. |
| **Trigger** | Each one has to **displace something**. |
| **One-off or recurring** | Almost always recurring, which is the problem |

Ads, tools, subscriptions, software with a monthly fee, a smarter project
tracker, a nicer scheduling app, a second analytics thing.

The rule is displacement: a new recurring charge must remove an existing one, or
remove a specific named hour of work every month, or it does not get agreed.
"It's only £12 a month" is the sentence that ends the £36 cost base, and it
never arrives once.

---

## 3. The rule underneath all of it

From master plan section 8, in full:

> **Do not raise the fixed cost base to solve a problem a one-off purchase would
> solve. The £36 figure is an asset. Protect it.**

The arithmetic is unfriendly to subscriptions. £15 a month is £180 a year and
£900 over five years, and unlike a £300 purchase it never stops. The reason to
protect the base is not thrift. It is that a business costing £36 a month can
turn down a bad client, decline a retainer, and quote a fair price without
flinching. A business costing £400 a month cannot always do those things, and
the difference shows up in the quality of the work it agrees to.

---

## 4. What the first payment does

An illustration of the mechanics, using the worked example from master plan
section 3A. The figures for the split are placeholders because the percentage
has not been decided.

A first efficiency implementation at **£1,200**:

| Step | Amount | Where it goes |
|---|---|---|
| Payment received | £1,200 | Business account |
| Tax set-aside, immediately | `[PLACEHOLDER]%` = `[PLACEHOLDER]` | Separate account, same day |
| Remaining | `[PLACEHOLDER]` | Working balance |
| Insurance and solicitor, item 3 | `[PLACEHOLDER]` | Paid once the entity exists |
| Held | The rest | Not spent. Item 2 is waiting on the second client, and nothing below it has triggered. |

Two things this makes visible. First, the fixed costs for a whole year are £432
plus the domain, so a single job of this size covers the run cost several times
over. Second, the correct action for most of the money on the first job is
**nothing**. Holding cash is a legitimate outcome of this file, and the most
likely one.

---

## 5. Decision record

Every spending decision, including the ones that ended in no purchase. The
refusals are the more useful half, because they are the ones that get
re-litigated.

| Date | What was proposed | Item # | Trigger met? | Decision | Why |
|---|---|---|---|---|---|
| `[none yet]` | | | | | |

Empty, because nothing has been earned and nothing has been proposed.

---

## 6. Things that must not be got wrong

**1. Tax first, every time, on every payment.** Not monthly, not quarterly, not
when it is convenient. The day the money arrives.

**2. The triggers are conditions, not permissions.** Item 2 does not become
available when there is money for it. It becomes required when there is a second
paying client. Money is necessary and not sufficient.

**3. Prefer one-off over recurring at every rung.** A purchase is a decision
made once. A subscription is a decision remade silently every month, by nobody.

**4. Record the refusals.** A "no" that is not written down is re-proposed in
six weeks with the same reasoning and no memory of the first answer.

**5. Nothing here is advice.** The tax set-aside percentage, the entity and the
treatment of any of these costs are questions for an accountant. See
`tax-and-admin.md`.

**6. Holding cash is a valid answer.** There is no obligation to spend the first
earnings on anything. The list is an order of priority for when a trigger fires,
not a shopping list to work through.
