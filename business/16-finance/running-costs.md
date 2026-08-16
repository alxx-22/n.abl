# Running costs

**Status: not started.** No invoice has been checked against this file. The
domain cost has never been written down. Nothing has been reconciled, because
there is no bank account to reconcile against.

This file is what n.abl actually pays for. It is deliberately a list of
invoices, not a budget. A budget is a plan; this is a record, and it is only
worth anything if every figure in it came off a real bill.

Last substantive revision: 2026-08-16.

---

## 1. The recurring cost base

| Item | What it buys | Billing | Cost | Verified against an invoice? |
|---|---|---|---|---|
| Claude Pro × 2 | All Class 3 work: architecture, difficult coding, client-facing documents, strategic analysis | Monthly, per seat | £36/month total | **No.** Assumed from master plan section 8. Check the actual charge. |
| Domain `nabl.agency` | The marketing site, the portal, the team space, `hello@nabl.agency` | Annual | `[PLACEHOLDER — renewal price]` | No |
| Domain renewal date | — | — | `[PLACEHOLDER — date]` | No |
| Email hosting for `hello@nabl.agency` | The only public contact address, used on the site, the legal pages, the email pack and the welcome pack | `[PLACEHOLDER — monthly or annual]` | `[PLACEHOLDER]` | No. It may be included with the registrar or a separate charge. Nobody has checked which. |

**Known monthly total: £36.**
**Known annual total: £432, plus the domain, plus whatever the email costs.**

That second line is the point of this table. The £36 headline in master plan
section 8 is a monthly figure, and there is at least one annual cost sitting
outside it. Until the domain row is filled in, the business does not know what
it costs to run for a year. It is very unlikely to be a large number. It is
still a number nobody has.

### Two things to check on the Claude invoices

- **Currency.** If the subscriptions are billed in USD and converted, the pound
  figure moves with the exchange rate and with whatever the card issuer charges
  for a non-sterling transaction. £36 is then an approximation that drifts.
- **Which card.** If the subscriptions are on a personal card, they are a
  business expense paid personally, which is a records problem rather than a
  cost problem. See `tax-and-admin.md` section 4.

---

## 2. What is not paid for, and why

| Item | Why it costs nothing today |
|---|---|
| Netlify | Free tier. Hosts the built SPA. |
| Supabase | Free tier. Postgres, auth and private storage, project hosted in the EU (`eu-north-1`). |
| GitHub | Free tier. Source control for the repository. |
| Typefaces | Space Grotesk, Inter Tight and JetBrains Mono, self-hosted. Not loaded from a font CDN, because requesting them from Google discloses every visitor's IP address to Google. |
| Local models | Open weights, on machines already owned. Class 2 work in the master plan section 4 sense. |
| Hardware | Two PCs already owned. |
| Class 1 work | Ordinary code. CSV handling, deduplication, sorting, filtering, dates, scheduling, database operations, regular expressions, HTML extraction, PDF generation, API calls. No fee of any kind. |

This is a genuinely small cost base and it is worth being pleased about. It is
also worth being precise about what "free" means here, which is section 3.

---

## 3. Free tiers are a deferred cost, not a saving

Each free tier is a bet that the failure mode will not arrive before there is
money to fix it. That is a reasonable bet today. It has an expiry date, and the
expiry date is different for each one.

| Free tier | What it is really costing | When it stops being appropriate | Where the fix is ranked |
|---|---|---|---|
| **Supabase** | Client data with no meaningful recovery story. There is no point-in-time recovery on the free tier. A bad migration, an accidental delete or a project problem has no clean undo. | **The moment there is a second paying client.** Master plan section 8 says this explicitly and says "not later". | `spend-order.md` item 2 |
| **Netlify** | Build minutes and bandwidth on someone else's allowance. Fine for a marketing site with no traffic. | When real client traffic or a busy build schedule makes it a constraint, which is not yet | Not ranked. Not close. |
| **GitHub** | Nothing meaningful. The repository is the source of truth and it is backed by every clone. | Not foreseeable | Not ranked |
| **No transactional sending service** | Outreach would go from an ordinary mailbox, which burns the domain reputation the moment volume rises | When v4 exists and outreach volume makes deliverability a real constraint | `spend-order.md` item 4 |
| **No professional indemnity cover** | Every engagement is personally exposed. This is the largest unpriced risk in the business by a wide margin. | Before the first contract is signed, not after | `spend-order.md` item 3 |
| **Unreviewed legal documents** | The three public pages and the drafts in `04-legal` have **not been reviewed by a solicitor**. They carry a visible draft notice, which is the right way round, and that notice is not a substitute for a review. | Before contracts scale | `spend-order.md` item 3 |

The free-tier figure in section 2 is therefore honest as a cash figure and
misleading as a risk figure. Both are true at once.

---

## 4. Real costs that carry no invoice

These do not appear on a bank statement and they are not zero.

| Cost | What it actually is | How it is handled |
|---|---|---|
| **Our labour** | The dominant cost of every job, by a distance. A 14-hour job at a £20/hour loaded cost is £280 of time against whatever was quoted. | Measured per job in `15-compute/cost-tracking.md`. Tracked internally, never sold. Master plan section 3A. |
| **Electricity** | Local models running on our own PCs. Class 2 is "£0 in fees", not £0 in cost. | Not tracked. Note it exists; do not invent a figure. |
| **Hardware replacement** | The two PCs are already owned, so they cost nothing today and will not last forever. There is no replacement fund. | `[PLACEHOLDER — decide whether a replacement reserve is worth setting up, and when]` |
| **Class 3 capacity** | The subscription is flat, so the scarce resource is usage limits and review time, not pounds. | Tracked as capacity in `15-compute/cost-tracking.md` section 4. Do not invent a per-job Claude cost. |

---

## 5. What would move the number

Before agreeing to any of these, the item goes through `spend-order.md`.

| Change | Effect on the monthly base | Trigger |
|---|---|---|
| Supabase paid tier | Recurring increase, `[PLACEHOLDER — current price]` | Second paying client |
| Professional indemnity insurance | Recurring, usually annual, `[PLACEHOLDER]` | Before the first signed contract |
| Solicitor review of the contract set | One-off, `[PLACEHOLDER]` | Before the first signed contract |
| Transactional email sending | Recurring, `[PLACEHOLDER]` | v4 outreach volume |
| Licensed data source | Recurring or per-dataset, `[PLACEHOLDER]` | When manual sourcing becomes the bottleneck |
| Accountant | Recurring or per-return, `[PLACEHOLDER]` | The entity decision, which is now |
| ICO data protection fee | Annual, `[PLACEHOLDER — check the current fee schedule and which tier applies]` | If the self-assessment says it applies |
| Companies House filing fees, if a limited company | Annual, `[PLACEHOLDER]` | Only if the entity decision goes that way |
| Business bank account | Often free, sometimes not, `[PLACEHOLDER]` | Now |
| A third Claude seat, or more compute | Recurring or one-off | Only after the five-part test in `15-compute/cost-tracking.md` section 6 |

Note how many of the rows that will realistically be agreed first are **annual
or one-off** rather than monthly. That is not an accident, it is the rule from
master plan section 8 doing its job.

---

## 6. The monthly ledger

One row a month. Filled in from the bank statement, not from memory.

| Month | Claude | Domain / email | Other | Total | Changed from last month? |
|---|---|---|---|---|---|
| `[none yet]` | | | | | |

Empty, because there is no business bank account and nothing has been
reconciled. It starts on the first month after the account is opened, even if
every figure in the row is £36 and nothing changed. The value of this table is
that it makes an unnoticed new subscription visible within thirty days.

`15-compute/cost-tracking.md` section 5 question 6 asks the same question from
the other side: "did the fixed cost base move?" That review reads this table.

---

## 7. Things that must not be got wrong

**1. Every figure comes from an invoice.** A remembered price is a
`[PLACEHOLDER]`. The £36 in section 1 is flagged as unverified for exactly this
reason, even though it is almost certainly right.

**2. "Free" means "no fee".** It does not mean no cost, no risk and no
obligation. Section 3 is the honest half of section 2.

**3. Annual costs hide inside monthly thinking.** The domain is the current
example. Anything billed yearly gets a row here with its renewal date, or it
will be discovered by an expiry email.

**4. A new recurring charge is a decision, not a purchase.** It goes through
`spend-order.md` and it gets recorded there, whatever the answer. £15 a month
does not feel like a decision, which is precisely why it needs to be one.

**5. This file does not hold per-job costs.** Those live in
`15-compute/cost-tracking.md`. Duplicating them here produces two versions that
disagree within a month.
