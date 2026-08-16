# 16 — Finance

```
Status:       not started
Owner:        Alex
Next review:  on first revenue
Evidence:     none. There is no revenue to account for
```

Nothing in this folder has been done. There is no business bank account. No
accountant has been spoken to. The legal entity is undecided, so it is not
settled whether there is a sole trader self-assessment to file or a company to
run. Nothing has been earned, so no tax has been set aside and no spending
decision has ever been made. The ICO data protection fee position has not been
checked. The only figure the business has is the £36 a month headline from
master plan section 8, and even that is incomplete, because nobody has written
down what the domain costs.

This folder is the plan for starting. Everything in it is a decision to make, a
question to put to somebody qualified, or a number to write down. None of it
describes something that exists.

Last substantive revision: 2026-08-16.

---

## The thing to notice first

**The cost base is the strongest thing this business has, and it is the thing
most easily lost.**

n.abl costs about £36 a month to run. That is two Claude Pro subscriptions.
Everything else is a free tier or a machine already owned. The consequence is
stated plainly in master plan section 8, and it is worth repeating because it
changes every decision in this folder:

> n.abl does not need to win work to survive the month. It needs to win work to
> grow.

A business that must win work to survive takes bad clients, quotes badly,
discounts under pressure and agrees to retainers it does not want. A business
that costs £36 a month can say no. That is not frugality as a virtue, it is
frugality as commercial leverage, and every recurring subscription added to the
base sells a little of it back.

So the governing rule of this folder, from master plan section 8:

> **Do not raise the fixed cost base to solve a problem a one-off purchase would
> solve. The £36 figure is an asset. Protect it.**

The second thing to notice is less comfortable. **Three folders are waiting on
decisions that live here, and one of them is blocking real work.**

| Folder | What it is waiting for |
|---|---|
| `04-legal` | The legal entity name, company number if there is one, registered address, VAT position and ICO fee position. Every contract, NDA and scope-of-work document in that folder has a `[PLACEHOLDER]` where those go. |
| `12-pricing` | Whether quoted prices are stated as excluding VAT, which depends on the VAT position, which depends on the entity |
| `13-credits` | Whether unredeemed credits are money held on account, which is a question about how they are recognised and taxed |

The `04-legal` dependency is the sharp one. A contract cannot be signed by an
entity that has not been decided.

---

## What this step is

The money side of running n.abl. Master plan section 8, made operational.

Four things, and no more:

1. **Knowing what it actually costs to run.** Not the headline. The real
   recurring total, including the annual costs that hide outside a monthly
   figure, and the free tiers that will stop being free at a known point.
2. **Deciding where the first earnings go**, in order of risk removed per pound,
   before there are any earnings to argue about.
3. **Setting money aside for tax before treating anything as income.** Money
   owed to HMRC was never revenue.
4. **Resolving the entity, tax and registration questions with people qualified
   to answer them** — an accountant, and where relevant the ICO's own guidance
   and a solicitor.

**This step is not**: the pricing method or the ROI calculation (`12-pricing`),
the per-job labour and compute measurement (`15-compute`, which does the
measuring — this folder decides what to do about the result), credit pack sizes
and the ledger (`13-credits`), or the legal documents themselves (`04-legal`).

**This step is emphatically not tax, legal or accounting advice.** Nobody
working on n.abl is qualified to give any of it. `tax-and-admin.md` is a list of
questions to ask, not a set of answers, and it says so at the top in bold.

---

## What "done" looks like

Twelve statements. **None of them are true today.**

- [ ] `running-costs.md` has no `[PLACEHOLDER]` left in the recurring cost
      table. Every figure is copied from a real invoice, not remembered.
- [ ] The true annual run cost is written as one number, including the domain
      and anything billed yearly rather than monthly.
- [ ] The legal entity is decided, registered, and the name, number and
      registered address are filled in everywhere `04-legal` has a placeholder.
- [ ] An accountant has been engaged, or a written decision exists explaining
      why not and who answers the questions instead.
- [ ] The tax set-aside percentage is decided with that accountant, written
      down, and applied to the first payment before any of it is spent.
- [ ] There is a separate business bank account, and no business money has ever
      passed through a personal one.
- [ ] The VAT position is decided and stated consistently on the site, the
      quotes and the contract.
- [ ] The ICO data protection fee question is answered, in writing, with the
      date it was checked and what it was checked against.
- [ ] Records are being kept in a way that survives an inspection: what came in,
      what went out, what it was for, with the evidence attached.
- [ ] `spend-order.md` has been applied at least once to a real purchase, and
      the decision was recorded whether or not the purchase happened.
- [ ] The first payment received has been split according to `spend-order.md`
      and the split is visible in the account, not just in a document.
- [ ] The monthly figure from `15-compute`'s review is being read here, so spend
      decisions are made from measurement rather than from the £36 headline.

---

## Honest status, in one paragraph

Not started, and mostly not started for a good reason: there is no revenue, so
most of this folder has nothing to act on yet. That excuse does not cover all of
it. Four things could be done this week with no client and no money: write down
what the domain actually costs, open a business bank account, book an hour with
an accountant, and run the ICO's own fee self-assessment. None have been done.
The entity question in particular is holding up `04-legal`, which cannot finish
a contract for an entity that does not exist, and that in turn is the thing
standing between the business and its first signed client. Everything else here
— the set-aside percentage, the spend order in practice, the records routine —
correctly waits for the first payment. The distinction matters: some of this is
blocked, and some of it is just undone.

---

## Next actions, in order

Items 1 to 4 need no revenue and no client. Do them before anything else in this
folder is read again.

1. **Write down the domain cost.** `nabl.agency`, from the registrar's actual
   invoice: the renewal price, the renewal date and whether the first year was
   discounted. Fill the row in `running-costs.md`. This is a five-minute job and
   it is the only known hole in the cost base.
2. **Check the two Claude Pro invoices.** Confirm the real charge in pounds,
   including whether it is billed in USD and converted, and whether there is any
   card fee. Replace the £36 assumption with the invoiced figure. If it is not
   £36, the master plan headline needs correcting rather than defending.
3. **Open a business bank account.** Separate from personal, from the first day,
   before the first payment rather than after it. Mixing the two is the single
   most common records problem and it is entirely avoidable now, at zero cost,
   while there is nothing to untangle.
4. **Run the ICO's own data protection fee self-assessment** and save the result
   with the date. n.abl holds client records, portal accounts, enquiry form
   submissions and, from v3, lead records containing personal data. This is a
   question with a published tool for answering it. See `tax-and-admin.md`
   section 5.
5. **Book an hour with an accountant** and take the agenda in
   `tax-and-admin.md` section 6 with you. The entity decision, the set-aside
   percentage and the VAT position all come out of that hour, and three other
   folders unblock when they do.
6. **Decide the entity and register it**, then fill every `[PLACEHOLDER]` in
   `04-legal` that starts with a legal entity question. Tell `04-legal` it is
   unblocked.
7. **Set the tax set-aside percentage** in `tax-and-admin.md` section 3 with the
   accountant's number, not a guess, and decide where the money physically sits.
8. **On the first payment, apply `spend-order.md` immediately.** Set aside the
   tax before any of it is treated as income, and record the split. The habit is
   formed on the first payment or it is not formed.
9. **Start the records routine** in `tax-and-admin.md` section 4 on the first
   transaction, however small. An imperfect routine that starts on day one beats
   a perfect one designed in month six.
10. **Read `15-compute`'s monthly review here once it exists**, and record any
    spending decision it triggers in `spend-order.md`, including the ones where
    the answer was no.

---

## What each file in this folder is for

| File | What it is for | Read it when |
|---|---|---|
| `README.md` | This file. What the step is, what done means, the honest status, what to do next, and the rule protecting the cost base. | Opening the folder cold |
| [`running-costs.md`](running-costs.md) | What is actually paid for, what is on a free tier and why that is a risk rather than a saving, the costs that are real but unpriced, and the monthly ledger. | Checking the true cost base, or before agreeing to any new recurring charge |
| [`spend-order.md`](spend-order.md) | The seven-item order for the first earnings, ranked by risk removed per pound, with the trigger and the test for each, plus the decision record. | Before spending anything, and when the first payment arrives |
| [`tax-and-admin.md`](tax-and-admin.md) | Sole trader against limited company as an open decision, self-assessment, records, VAT and the ICO fee — written as questions for an accountant, not as answers. | Preparing for the accountant conversation, or when any tax or registration question comes up |

---

## Things in here that must not be got wrong

**1. Nothing in this folder is advice.** Not tax advice, not legal advice, not
accounting advice. It is a list of questions written by people who are not
qualified to answer them, so that the hour with someone who is qualified is not
wasted. If a sentence in `tax-and-admin.md` ever starts to read like an answer,
it is a bug in the document.

**2. Money owed to HMRC was never revenue.** A payment landing in the account is
not income. Part of it belongs to someone else and is merely passing through. A
business that spends its tax set-aside is not profitable, it is borrowing from a
creditor who charges penalties.

**3. Do not raise the fixed cost base to solve a one-off problem.** Master plan
section 8. A £300 purchase once is cheaper than £15 a month forever, at any
horizon longer than twenty months, and it does not compromise the ability to say
no to a bad client. Every subscription must displace something.

**4. Free tiers are a deferred cost, not a saving.** Client data currently sits
on a Supabase free tier with no meaningful recovery story. That is not £0, it is
an unpriced risk that becomes urgent the moment there is a second paying client.
`running-costs.md` section 3 lists each free tier with the point at which it
stops being appropriate.

**5. £0 in fees is not £0 in cost.** The local machines use electricity, wear
out and will need replacing. `15-compute/cost-tracking.md` makes the same point
about Class 1 and Class 2 work. "Free" in this folder always means "no fee".

**6. Every undecided figure stays marked `[PLACEHOLDER]`.** A guessed number in
a finance document becomes a quoted number in a client conversation about three
weeks later. If it has not been decided, it says so.

**7. This folder decides, `15-compute` measures.** The per-job labour hours, the
compute class shares and the monthly Class 1 figure are produced there. Do not
duplicate the job log here. Read it, and act on it.
