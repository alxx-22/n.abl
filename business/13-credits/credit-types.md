# Credit types — Build, Assist, Educate

Companion to [`README.md`](README.md). **Status: not started.** Nothing
described here is implemented, and every figure is a placeholder.

The three types come from master plan section 3C. They are already named on the
live home page (`src/pages/Home.jsx:62-66`) and in the scope-of-work template
(`04-legal/scope-of-work-template.md`, section 10). They are settled. This file
covers everything around them that is not.

---

## 1. One pool, three labels

A pack is a quantity of credits. It is **not** a quantity of Build credits plus
a quantity of Assist credits plus a quantity of Educate credits.

The type is recorded **at redemption**, not at purchase.

The master plan phrases it this way — credits are "redeemable against three
things" — and there are three practical reasons to keep it that way:

1. **No stranded balance.** A client who bought a pack expecting to need
   training, and instead needs an integration, would otherwise be sitting on
   credits they cannot use. That produces exactly one conversation, and it is
   not a good one.
2. **No arguments about classification at the point of sale.** Nobody has to
   predict, twelve months ahead, what proportion of their future needs will be
   troubleshooting.
3. **The client does not have to understand our taxonomy to buy.** They buy
   credits. We categorise the work.

The three labels still earn their place, for two purposes: they tell the client
what a credit may be spent on, which is a reassurance, and they let n.abl see
what it is actually being asked for. If a year of ledger rows says 70% Assist,
something is being built badly and the ledger is the thing that says so.

---

## 2. What falls into each

### Build

Small modifications, integrations, scripts, automation changes.

The defining feature: **the system does something it did not do before.**

- Adding a field, a column or a step to something already delivered
- A new integration with a tool the business has started using
- A new report, export or scheduled job
- Extending an automation to a second team, site or product line
- A small script that does one adjacent job
- Changing a rule, threshold or schedule in a way that needs code

Build is the type most likely to run out of its own boundary. A change that
needs its own design, its own testing and its own sign-off is not a
modification, it is a project, and it goes to a quote. Section 5 sets the
boundary properly.

### Assist

Troubleshooting, repairs, configuration, technical support.

The defining feature: **the system has stopped doing what it already did, or
never quite did it.**

- A supplier changed an export format and an importer broke
- An API key expired, a permission changed, a scheduled job stopped running
- A rename or reorganisation upstream broke a path or a mapping
- Something works but is producing a wrong result in an edge case
- Reconfiguring after a change of staff, hardware or provider
- Investigating "it did something odd on Tuesday" and reporting back

Assist includes the investigation, not only the fix. Time spent finding out
that nothing was wrong is real work and is drawn down, and the client should be
told that in advance rather than discovering it on a statement. See section 7.

**Assist is not an SLA.** It buys the work of fixing something. It does not buy
a response time, and no document may imply that it does.

### Educate

Staff training, workshops, documentation, tool training.

The defining feature: **the person changes, not the system.**

- A session on the thing that was just delivered, for the people who will use it
- A refresher when new staff join
- Written documentation, runbooks, or a one-page "what to do if"
- Training on a tool the business already pays for and half-uses — master plan
  section 1 lists this as its own category of work
- A workshop on a general capability, where the outcome is a more capable team
  rather than a changed system

Educate is the type most often forgotten by the client and most often the best
value. A recurring Assist drawdown that turns out to be one person not knowing
which button to press is an Educate job that nobody booked.

---

## 3. Classifying an awkward job

Most jobs are obvious. For the rest, ask the three questions in order and stop
at the first yes.

| # | Question | Type |
|---|---|---|
| 1 | Did the system stop doing something it already did? | **Assist** |
| 2 | Will the system do something new when this is finished? | **Build** |
| 3 | Will a person be able to do something they could not before? | **Educate** |

If all three are no, it is probably not creditable work at all — see section 5.

Two rules for the genuinely mixed jobs:

- **A job gets one type.** Splitting a two-credit job across two types to be
  precise produces a ledger nobody can read for a distinction nobody cares
  about. Pick the dominant one.
- **Fixing wins over improving.** A repair that ends up slightly better than
  before is still Assist. Otherwise every repair gets reclassified upward and
  the Assist figure stops meaning anything internally.

---

## 4. What a credit actually is — the open decision

This is the decision the whole folder waits on, and it is a real tension rather
than an oversight.

Master plan section 3A: n.abl prices on economic value, not hours, because
*"hourly pricing punishes you for getting faster, and getting faster is the
entire point of the tooling."* But a ledger needs a unit, and the unit has to
be something a client can predict and n.abl can measure consistently.

Three options. All three work with the schema in `ledger-design.md`, because
the schema only stores a quantity.

### Option A — a credit is a fixed amount of money held on account

One credit is worth `£[PLACEHOLDER]` against a published task menu. Larger
packs buy credits at a lower price per credit, and buying alongside an
implementation is cheaper again.

- **For:** trivially easy to explain and to reconcile. A drawdown is a price.
- **Against:** it is prepayment with a discount, and it invites "can I have the
  money back", which pulls straight into the refundability question. It also
  makes every job a negotiation about its price rather than its credit cost.

### Option B — a credit is a defined slice of work, priced off a task menu

One credit is the unit the task menu is written in: a small job is one credit, a
half-day workshop is `[PLACEHOLDER]` credits, a new integration is
`[PLACEHOLDER]` credits. The client reads the menu and knows the cost before
agreeing.

- **For:** consistent with value pricing. If n.abl gets twice as fast at
  integrations, the integration still costs the same number of credits, and the
  speed is the margin. It is also the only option where the client can predict
  a drawdown without asking.
- **Against:** needs the task menu to exist and to be maintained, and needs a
  rule for the job that is not on the menu.
- **This is the recommendation.** It is the only option that keeps the pricing
  principle intact, and the menu is a day's work rather than a research project
  once three real jobs have been delivered.

### Option C — a credit is an hour

- **For:** everyone understands it immediately.
- **Against:** it is the thing the master plan explicitly rejects. It punishes
  getting faster, it makes the client's incentive to watch the clock, and it
  converts a value-priced business into a body shop with a prepayment scheme.
- **Rejected.** Written down here so it is rejected once rather than
  re-proposed every quarter.

Whichever is chosen, write down **why** next to the decision. An option chosen
without a recorded reason gets quietly swapped for Option C by whoever is
quoting under time pressure.

---

## 5. What credits do not cover

Stated so it can be quoted into a scope of work and used in a conversation.

| Not covered | Why | What happens instead |
|---|---|---|
| A new project | Design, testing and sign-off make it a piece of work in its own right, not a modification | A new quote, priced as an efficiency or capability solution |
| Anything needing its own scope document | If it needs a scope, it is not a drawdown | A new quote |
| A response time or availability guarantee | Credits buy work, not standby. This is the whole model | Priced separately, named as what it is, and not called a credit |
| Third-party costs | Licences, subscriptions, hosting, domains, API usage | Billed at cost, or paid by the client directly |
| Regulated advice | Master plan section 2 declines this work rather than disclaiming it | Declined |
| Rescuing a system n.abl did not build | Unbounded, and the effort is unknowable in advance | A paid investigation first, then a quote |
| Recovering data lost by someone else | Same reason | Same |
| Work on a system the client has since changed beyond recognition | The thing being supported is no longer the thing that was delivered | A reassessment, then a quote |

The general test: **credits pay for bounded work on something n.abl delivered.**
Everything unbounded is quoted, and everything belonging to someone else's
system is quoted after an investigation.

---

## 6. The task menu

The published list of common jobs and what they cost in credits. It does not
exist yet, and it cannot be written honestly until three real jobs have been
delivered and their labour recorded.

Write it as a table with these columns, ten to fifteen rows:

| Job | Type | Credits | Notes |
|---|---|---|---|
| `[PLACEHOLDER — a common small change]` | Build | `[PLACEHOLDER]` | |
| `[PLACEHOLDER — a broken integration, diagnosed and fixed]` | Assist | `[PLACEHOLDER]` | |
| `[PLACEHOLDER — a half-day training session]` | Educate | `[PLACEHOLDER]` | |

Three rules for the menu when it is written:

1. **Every row is a job that has actually been done at least once.** A menu of
   hypothetical jobs is a price list of guesses.
2. **A job not on the menu gets a credit figure agreed before the work starts**,
   and then gets added to the menu. The menu grows from real work.
3. **The menu is a guide, not a tariff.** A job that turns out to be three times
   the size of its menu entry stops, and gets re-agreed. It does not silently
   consume three times the credits.

---

## 7. Buying alongside the implementation

Master plan section 3C: credits are *"bought in bulk, cheaper when bought
alongside the implementation."*

Two separate discounts, and they should be kept separate in the pricing:

- **Volume.** A larger pack has a lower price per credit. `[PLACEHOLDER — pack
  sizes and price per credit at each size.]`
- **Alongside.** Credits bought as part of the implementation quote are cheaper
  than credits bought later. `[PLACEHOLDER — the discount, as a percentage or as
  a separate price per credit.]`

The alongside discount is not a sales tactic dressed as a favour. It is worth
real money to n.abl for reasons worth stating in the quote:

- one conversation and one invoice instead of two
- the client is committed to using the system rather than abandoning it
- the support relationship is established before something breaks, so the first
  Assist job is not also a re-introduction
- cash arrives with the project rather than later

It is also worth being honest about the risk to the client, because saying it
out loud is what makes the offer credible: **credits bought in advance and never
used are money spent for nothing.** That is what expiry, the task menu and the
portal balance card are all for. A client who can see their balance and predict
a drawdown will use it. A client who has to email and ask will not.

---

## 8. The rules that hold on credit types

1. **One pool, three labels, type recorded at redemption.** Never sell
   type-specific credits.
2. **One job, one type.** No splitting.
3. **Fixing wins over improving** when classifying a repair.
4. **Credits are not an SLA.** They buy work, never a response time. `04-legal`
   contract checklist item 13.
5. **Bounded work on something n.abl delivered.** Everything else is a quote.
6. **No figure is published until three real quotes exist.** Master plan
   section 3C. Delete a section rather than invent a number for it.
