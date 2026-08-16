# 13 — Credits

**Status: not started.**

There is no ledger. No `credit_packs` table, no `credit_ledger` table, no
balance view, no redemption path, no team-space tab and nothing in the client
portal that shows a balance. A search of `supabase/migrations/` for the word
`credit` returns nothing. A search of `src/` returns only marketing copy and a
CSS block on the home page.

No client has ever bought a credit pack, because no pack has ever been priced.

This folder is the plan for building the credit layer. Everything in it is a
specification or a draft.

Last substantive revision: 2026-08-16.

---

## The thing to notice first

**The promise is already public. The mechanism is not.**

`src/pages/Home.jsx:365-372` is live on `nabl.agency` and reads:

> Afterwards: credits, not a retainer. You do not pay us monthly to be on
> standby. Buy a pack of credits and spend them when you actually need
> something. What we build is yours.

Three credit types are named on the same page. `04-legal` has written the
credits clause of the service agreement around them, and the scope-of-work
template has a section 10 that describes them and then holds a `[PLACEHOLDER]`
where the numbers go.

So the offer exists in writing, in public, in three places. What does not exist
is any way to sell a pack, record a balance, draw one down, or show a client
what they have left. If someone said yes tomorrow the answer would be a
spreadsheet and an email, and that is fine for the first one and unacceptable
by the fourth.

That gap is what this folder closes.

---

## What this step is

The commercial layer that sits **after** delivery. Master plan section 3C and
section 6, v5.

A client has had something built. They own it. They do not pay a monthly fee.
When they need something changed, fixed or taught, they draw on a balance of
credits they bought in advance — cheaper if they bought them alongside the
implementation.

Three things are redeemable against that balance:

| Credit type | Covers |
|---|---|
| **Build** | Small modifications, integrations, scripts, automation changes |
| **Assist** | Troubleshooting, repairs, configuration, technical support |
| **Educate** | Staff training, workshops, documentation, tool training |

The work in this folder is therefore three things and no more:

1. **Decide what a credit is** — the denomination, the pack sizes, the prices,
   the alongside-purchase discount, expiry, refundability.
2. **Build the ledger** — an append-only record of every grant and every
   drawdown, from which a balance is derived rather than stored.
3. **Show the client their balance** — a read-only card in the portal, so
   nobody has to email and ask.

**This step is not** the ROI calculation or the quote generator (`12-pricing`,
the other half of v5), the contract wording that governs credits (`04-legal`,
which is waiting on the decisions in item 1), the delivery process the credits
follow (`14-delivery`), or the internal cost of doing the work (`15-compute`
and `16-finance`).

---

## The block, stated plainly

**Pack sizes and prices are not to be invented now.**

The master plan says it in section 3C: *"Credit pack sizes and prices:
[PLACEHOLDER — to be set alongside the first three real quotes, not before]."*
`04-legal` repeats it. The scope-of-work template says to delete its credits
section rather than fill it with a guess.

The reason is not caution for its own sake. A credit price is a claim about how
much work a credit buys, and that claim can only be checked against work
actually done. n.abl has delivered no client implementations, so there is no
measured labour to price against. A number chosen today would be an invented
statistic dressed as a policy, and it would end up in a signed contract.

**What is not blocked:** everything structural. The denomination question, the
ledger schema, the redemption rules, the expiry mechanics and the portal view
are all decidable and buildable without knowing a single price. The schema does
not care what a credit costs. Build all of that, leave every figure as
`[PLACEHOLDER]`, and fill the figures in once three real quotes exist.

There is a second, softer block: `05-portal` has an open item saying the portal
schema is not in version control. See next actions, item 7.

---

## What "done" looks like

Fourteen statements. **None of them are true today.**

- [ ] The credit unit is decided and written down: what one credit is, and how a
      piece of work is converted into a number of credits without selling hours.
- [ ] Pack sizes, prices and the alongside-purchase discount are set from three
      real quotes and three real deliveries, not from estimate.
- [ ] Expiry, refundability and what happens to unused credits at the end of an
      engagement are all decided, and `04-legal` has been told, so the service
      agreement's credits clause can lose its placeholders.
- [ ] A published task menu says roughly what common jobs cost in credits, so a
      client can predict a drawdown before agreeing to it.
- [ ] The ledger is append-only. Nothing in the system ever updates or deletes a
      ledger row, and the database refuses both.
- [ ] No balance is stored anywhere. Every balance shown to anyone is derived
      from the ledger at read time.
- [ ] A balance can never go negative. Enforced inside the redemption
      transaction, not by the interface.
- [ ] Credits are consumed earliest-expiry-first, deterministically, by ordinary
      code with no model anywhere near it.
- [ ] Expiry writes a ledger row of its own. Credits never quietly vanish, and
      the client can see when and why a balance changed.
- [ ] Every redemption row names the work it paid for and who recorded it.
- [ ] The team space can sell a pack and record a redemption, with a
      confirmation step, because these rows are money.
- [ ] The client portal shows the current balance, what expires and when, and
      the recent history — read-only, RLS-scoped, SELECT-only, like everything
      else in the portal.
- [ ] The whole thing exists as a committed migration in `supabase/migrations/`
      from the first day it exists at all.
- [ ] One real pack has been sold and one real redemption has run end to end,
      with the client agreeing the drawdown before it was written.

---

## Honest status, in one paragraph

Not started. No schema has been written, no code exists, and no decision in this
folder has been made. The three credit types are settled — they come from the
master plan and are already on the live site — but that is the only settled
thing. The denomination question is open, the prices are deliberately open, and
expiry and refundability are open and are currently blocking `04-legal` from
finishing the service agreement. The files in this folder are a specification
and a draft, written now so that when the first three quotes land the only
remaining work is arithmetic and a migration rather than a design exercise.
Nothing here has been reviewed by a solicitor or an accountant, and the tax and
revenue-recognition treatment of money taken in advance for work not yet done
has not been looked at by anyone qualified.

---

## Next actions, in order

Items 1 to 3 have to happen in the world before most of this folder can be
finished. Items 4 onward can be built while waiting, because the schema does
not depend on the prices.

1. **Decide the credit unit.** This is the one decision everything else waits
   on, and it is a genuine tension: n.abl does not sell hours, because hourly
   pricing punishes getting faster, but a ledger needs a number.
   `credit-types.md` section 4 sets out three options and a recommendation.
   Pick one, write down why, and move on. It is a half-hour decision that has
   been deferred by not being asked.
2. **Deliver three real implementations.** Record the actual labour on each,
   internally, as the master plan section 3A requires. Without them there is
   nothing to price a credit against.
3. **Set the numbers.** Pack sizes, price per credit at each size, and the
   discount for buying alongside the implementation. Fill in every
   `[PLACEHOLDER]` in this folder in one sitting, then tell `04-legal` and
   `12-pricing`.
4. **Decide expiry, refundability and end-of-engagement.** `04-legal` cannot
   finish the service agreement without all three, and its README item 7 says
   so. These are not blocked by the prices — decide them now.
5. **Write the task menu.** Ten or fifteen common jobs with a credit figure
   against each, in `credit-types.md` section 6. A client who cannot predict a
   drawdown will not spend a balance, and an unspent balance is a complaint
   waiting to happen.
6. **Review `ledger-design.md` against how the first real drawdown actually
   went.** Design the schema before the first sale, revisit it immediately
   after.
7. **Commit the portal schema first.** `05-portal`'s open item: run
   `supabase db pull`, review, commit. The credit tables need `clients` and
   `current_client_id()`, and building on top of a schema that exists only in
   the hosted project makes the credit layer unrebuildable too. Do this before
   item 8, not after.
8. **Write the credits migration**, following `ledger-design.md`. Tables,
   constraints, the append-only trigger, the balance view, the redemption
   function, the RLS policies. Apply it to a branch or a local instance and try
   to break it before it goes anywhere near real money.
9. **Add the team-space tab.** A sixth tab alongside the five in
   `src/lib/teamConfig.js:7`. Selling a pack and recording a redemption both go
   through a confirmation step, because a mistyped credit figure is a mistyped
   invoice.
10. **Add the portal balance card.** `src/pages/Portal.jsx`, read-only, using
    the existing `portalClient()` path. Nothing about this feature may give the
    portal a write.
11. **Sell one pack and redeem from it once**, end to end, with a real client.
    Confirm the drawdown with them in writing before the row is written. Then
    come back and fix whatever was wrong.

---

## What each file in this folder is for

| File | What it is for | Read it when |
|---|---|---|
| `README.md` | This file. What the step is, what done means, the honest status, what to do next. | Opening the folder cold |
| [`credit-types.md`](credit-types.md) | Build, Assist and Educate: what falls into each, how to classify an awkward job, why there is one pool and three labels, what credits explicitly do not cover, the denomination options and the task menu. | Deciding what a credit is, quoting a pack, or arguing about which type a job was |
| [`ledger-design.md`](ledger-design.md) | The schema sketch: tables, constraints, the append-only rule, derived balances, earliest-expiry-first consumption, the redemption function, RLS, and what the portal is allowed to show. | Writing the migration, or checking whether a proposed change breaks the ledger |
| [`client-explanation.md`](client-explanation.md) | Draft client-facing copy explaining credits in plain language. Not yet in use anywhere. | Writing a proposal, a scope of work section 10, or answering "so what happens after you finish?" |

---

## Things in here that must not be got wrong

**1. Credits are not a retainer, and the difference is the whole point.** The
client pays for work, in advance, at a better rate. They do not pay for
availability. Anything that starts to resemble a monthly fee has broken the
model described in master plan section 3.

**2. Credits are not a service level agreement.** They buy work, not a response
time. `04-legal`'s contract checklist item 13 is explicit about this. If a
response time is ever sold, it is priced separately and called something else.

**3. The ledger is append-only, always.** A balance that can be edited is a
balance that can be disputed and not reconstructed. Corrections are new rows
with a reason, never an edit to an old row.

**4. No stored balance.** The moment a `balance` column exists somewhere, it
will disagree with the ledger, and the disagreement will be found by a client.
Derive it every time.

**5. Every figure stays `[PLACEHOLDER]` until three real quotes exist.** Not a
range, not an "indicative" number, not a worked example with invented figures.
The master plan says it, `04-legal` says it, and the scope-of-work template
says to delete the section rather than guess.

**6. The portal never writes.** A client cannot redeem, approve or adjust
anything. They see a balance. Redemption is recorded by n.abl after being
agreed with the client. This follows `05-portal` rule 4 and is not negotiable
by this folder.

**7. Money taken in advance is not yet earned.** Credits sold are an obligation
to do work, not revenue in the month they were sold. `16-finance` needs to know
this and nobody qualified has looked at it yet.
