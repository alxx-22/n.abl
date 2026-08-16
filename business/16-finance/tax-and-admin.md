# Tax and admin

> **This file is not advice.** It is not tax advice, legal advice or accounting
> advice, and nobody working on n.abl is qualified to give any of it. Every
> section below is a **question to put to a qualified accountant**, or in the
> case of section 5 a question with a published tool for answering it. Where a
> figure, threshold or date appears, treat it as something to confirm, not
> something to rely on. If any sentence in this file starts to read like an
> answer, that is a mistake in the document and it should be rewritten as a
> question.

**Status: not started.** No accountant has been spoken to. The legal entity is
undecided. There is no business bank account. No records routine exists. The ICO
data protection fee position has not been checked.

Last substantive revision: 2026-08-16.

---

## 1. Why this is blocking, not background

It is tempting to treat this as paperwork to catch up on after the first client.
It is not, for one specific reason:

**`04-legal` cannot finish a contract for an entity that has not been decided.**

Every document in that folder — the NDA draft, the scope-of-work template, the
service agreement notes, the contract checklist — carries a `[PLACEHOLDER]` for
the legal entity name, the company number if there is one, and the registered
address. The live terms page also states that prices exclude VAT unless stated,
which `04-legal/contract-checklist.md` correctly flags as only safe once the VAT
position is decided.

So the chain is: entity decision → `04-legal` placeholders filled → a contract
that can be signed → a client. This folder sits at the front of it.

---

## 2. The entity question: sole trader or limited company

**This is an open decision. It has not been made.**

Current position: `[PLACEHOLDER — not decided]`.

Do not decide it from this document. The two structures differ in how profits
are taxed, what has to be filed and published, what personal exposure looks like
and what the administrative burden is, and the right answer depends on facts
about the founders that an accountant will ask for and this file does not
contain.

### What to take to the accountant

The facts they will need:

| Fact | Current position |
|---|---|
| Number of people involved | `[PLACEHOLDER — two founders? What is the intended split?]` |
| Other income each founder has | `[PLACEHOLDER]` |
| Expected first-year turnover | `[PLACEHOLDER — realistically small. There is no revenue and no signed client.]` |
| Expected first-year costs | £432 plus the domain. See `running-costs.md`. |
| Nature of the work | Technology implementation for small UK businesses. Software, automation, integration, training. |
| Whether client contracts will require a specific structure | Unknown. Some clients ask; none have been asked yet. |
| Whether either founder wants the business name protected | `[PLACEHOLDER]` |
| Appetite for filing and administration | `[PLACEHOLDER]` |

### The questions to ask

1. Given those facts, which structure would you recommend, and what is the
   single biggest factor driving that recommendation?
2. What changes if turnover in year one is nearer £5,000 than £50,000, and what
   is the crossover point where the answer flips?
3. If we start as one structure, how difficult and how expensive is it to change
   later? Is there a wrong first choice, or only an inconvenient one?
4. Two founders sharing the business: what does that mean for each structure —
   is a partnership a third option we should be considering, and what would
   change if so?
5. What does personal liability look like under each, and how does that interact
   with professional indemnity insurance? `spend-order.md` item 3 assumes
   insurance is bought before the first contract; does the structure change what
   cover is needed?
6. What is publicly visible under each structure, including the registered
   address? `04-legal/nda-template.md` needs a registered address to print on a
   document that goes to clients.
7. What are the ongoing filing obligations and deadlines under each, and roughly
   what does compliance cost per year in fees and in your time?
8. What has to be registered, with whom, and by when, once the decision is made?
9. Does the answer change the name we trade under, and does `n.abl` as a trading
   name need anything doing to it?

### The decision, when it is made

| Field | Value |
|---|---|
| Structure chosen | `[PLACEHOLDER]` |
| Date decided | `[PLACEHOLDER]` |
| Who advised | `[PLACEHOLDER]` |
| Legal entity name | `[PLACEHOLDER]` |
| Company number, if applicable | `[PLACEHOLDER]` |
| Registered address | `[PLACEHOLDER]` |
| Date registered | `[PLACEHOLDER]` |

When that table is filled, go and fill every matching `[PLACEHOLDER]` in
`04-legal` on the same day, and tell that folder it is unblocked.

---

## 3. Self-assessment and the tax set-aside

### What has to be filed depends on section 2

Which returns exist, who files them and when, follows directly from the entity
decision. Until that is made, this section cannot be more specific than the
questions below, and pretending otherwise would be inventing an answer.

### Things believed to be true, every one of which must be confirmed

Written here so the accountant conversation can start from something concrete
rather than from nothing. **None of these has been checked.**

| Believed | Confirm |
|---|---|
| The UK tax year runs 6 April to 5 April | With the accountant |
| A sole trader has to register for self-assessment by a deadline in the October following the end of the tax year in which trading began | The exact date and whether it applies |
| Online self-assessment returns are due by 31 January following the end of the tax year, with payment due the same day | The dates, and whether payments on account apply |
| Payments on account can be required, which means the first bill can be larger than expected | Whether this will apply, and how to plan for it |
| A limited company has entirely different obligations, deadlines and filings | All of them |
| VAT registration becomes compulsory above a turnover threshold and is available voluntarily below it | The current threshold, and whether voluntary registration is sensible for us |

The reason this table exists as beliefs rather than facts is that getting a
deadline wrong is expensive and getting it from a document written by
non-specialists is how that happens.

### The set-aside percentage

**Current value: `[PLACEHOLDER — to be set with an accountant].`**

Ask specifically:

1. What percentage of every payment received should be set aside, given the
   structure we choose and our expected level of income?
2. Should the percentage be deliberately conservative in year one, given that we
   have no history to estimate from?
3. Does the set-aside need to cover anything besides income tax — National
   Insurance, corporation tax, VAT if registered — and should those be one
   figure or separate ones?
4. Where should the money sit? A second bank account, a savings account, or
   somewhere else?
5. When does it actually have to be paid, so we know how long it is held for?

`spend-order.md` item 1 puts the set-aside before everything, at the moment each
payment lands, and it stays there whatever number comes back. Only the
percentage is open.

---

## 4. Records

### What we need, in principle

Enough that someone else could reconstruct what happened. Currently nothing is
being kept, because nothing has happened, which makes this the cheapest possible
moment to start.

| Record | Why | Current state |
|---|---|---|
| Every payment in: date, client, amount, what it was for, invoice reference | Income | Nothing yet |
| Every payment out: date, supplier, amount, what it was for, receipt attached | Costs | Nothing yet. The Claude and domain charges are the only ones that exist. |
| Invoices issued, numbered sequentially | Income evidence | No invoice has ever been issued. No numbering scheme exists. |
| Bank statements | Reconciliation | No business bank account exists |
| Contracts and scopes signed | What was agreed | None signed. `04-legal` holds drafts only. |
| Mileage or travel, if any | Costs | None yet |
| Business expenses paid personally | These are real and easily lost | **This is already happening if the Claude subscriptions are on a personal card.** Check. |

### The one thing to do this week

**Open a business bank account.** Before the first payment, not after it.

Everything else in this section is easier if business money never touches a
personal account, and untangling a mixed account after the fact is the most
common records problem there is. It costs nothing to avoid today and there is
nothing yet to untangle.

### Questions for the accountant

1. What records do you actually need from us, in what format, and how often do
   you want them?
2. How long does everything have to be kept, and does it differ by record type?
3. Digital only, or do any originals have to be kept on paper?
4. Do you want us on a specific bookkeeping tool? **If the answer is a paid
   subscription, that is a new recurring cost and it goes through
   `spend-order.md` item 7 like anything else.** Ask whether a spreadsheet is
   adequate at our size, and at what point it stops being adequate.
5. The Claude subscriptions may be on a personal card. How should expenses paid
   personally be handled, and should that be corrected now?
6. Is there anything about how we invoice — numbering, wording, payment terms,
   what must appear on the invoice — that we should get right from invoice
   number one rather than fixing at number twenty?
7. How should n.abl credits be treated? A client buys a pack up front and
   redeems it against work later, so money is received before the work is done.
   When is that income, and does it change anything? See `13-credits`.
8. Deposits and staged payments on an implementation: same question.

Question 7 is the one most likely to produce a surprise, and `13-credits` is
waiting on the answer.

---

## 5. The ICO question

**This is a data protection question, not a tax question**, so it does not go to
the accountant. It has its own published route to an answer.

### Why it applies to n.abl

n.abl processes personal data today, and will process considerably more of it at
v3:

| Data | Where |
|---|---|
| Enquiry form submissions: name, business name, email, business type, and whatever the enquirer describes | Marketing site, into Supabase |
| Client records: business name, contact name, contact email, quotes, projects, meetings, documents | Client portal and team space |
| Staff accounts | Supabase Auth |
| **Lead records, from v3** | The CRM. Sourced from Companies House, directories and businesses' own websites, and enriched. This is the big one. |

The privacy policy already states that n.abl is the data controller for the
personal data it describes. `07-crm/compliance-schema.md` sets out the ICO
position on B2B electronic marketing in detail, including the distinction
between corporate subscribers and sole traders or individual subscribers, and
`04-legal` lists the ICO fee position as an outstanding item.

### The question

**Does n.abl have to pay the ICO data protection fee, and if so which tier?**

Current answer: `[PLACEHOLDER — not checked]`.

### How to answer it

1. Run the **ICO's own data protection fee self-assessment**. It is published
   for exactly this purpose and it is the correct source, not a summary written
   by us.
2. Do it against the real position: a UK business processing personal data
   electronically, holding client records and, from v3, a lead database
   containing personal data used for direct marketing.
3. Save the result with the date it was run and what was answered. If the
   position changes at v3, run it again.
4. If a fee applies, record the tier and the annual amount here, add it to
   `running-costs.md` section 1, and note the renewal date.

| Field | Value |
|---|---|
| Self-assessment run on | `[PLACEHOLDER — date]` |
| Outcome | `[PLACEHOLDER]` |
| Tier, if applicable | `[PLACEHOLDER]` |
| Annual fee | `[PLACEHOLDER]` |
| Renewal date | `[PLACEHOLDER]` |
| Re-check at v3 | Not done |

### What this is not

Paying a fee is not compliance. It does not make the CRM lawful, it does not
substitute for the schema in `07-crm/compliance-schema.md`, and it does not
authorise sending anything to anyone.

Two things must be true independently, and neither implies the other:

- the registration position is correct, which is this section, and
- the CRM carries `subscriber_type`, `lawful_basis`, `source`, `source_date`,
  `privacy_notice_status`, `marketing_status`, `opt_out`, `suppression_list` and
  `contact_history`, with the send path **hard-blocking** opted-out records at
  the database level.

**None of those fields exist in the CRM today.** Master plan section 6 says so
plainly. That is `07-crm`'s work, not this folder's, and it is the more
important of the two.

Also note, for the same reason: `04-legal` next action 3 requires the privacy
policy to cover people whose data arrives through research, not only people who
filled in the enquiry form. The policy currently describes enquirers, clients
and staff. It does not describe leads. That is blocking for v3.

---

## 6. The accountant conversation

One hour. Take this agenda. Three folders unblock when it is done.

| # | Topic | Section | What comes out of it |
|---|---|---|---|
| 1 | Sole trader, limited company or partnership, given our facts | 2 | The entity decision, which unblocks `04-legal` |
| 2 | What has to be registered, with whom, by when | 2, 3 | A dated list |
| 3 | The tax set-aside percentage and where the money sits | 3 | The number in `spend-order.md` item 1 |
| 4 | Filing deadlines under the chosen structure | 3 | Dates in a calendar, not in a document |
| 5 | VAT: threshold, whether to register voluntarily, and what quotes should say | 3 | The line `04-legal` and `12-pricing` are both waiting on |
| 6 | Records: what, how, how long, and whether a spreadsheet is enough | 4 | The records routine |
| 7 | Business expenses currently paid personally | 4 | Whether anything needs correcting now |
| 8 | Credits bought up front and redeemed later: when is that income | 4 | The answer `13-credits` needs |
| 9 | What the accountant costs, and on what basis | — | A row in `running-costs.md` |

Two things to be clear about in the meeting:

- **The business is tiny and has no revenue.** Do not let the conversation be
  scoped for a business that does not exist. The right advice for a business
  costing £432 a year to run is different from the right advice for one turning
  over six figures, and the difference is mostly "do less".
- **We will not be buying a monthly software subscription reflexively.** If one
  is genuinely necessary, it goes through `spend-order.md`. Ask what the minimum
  viable answer is.

### Before the meeting

- [ ] Fill in the facts table in section 2. The accountant cannot answer without
      it and filling it in during the hour wastes the hour.
- [ ] Have `running-costs.md` section 1 complete, including the domain.
- [ ] Have a realistic first-year turnover figure, even if it is a range with a
      low bottom end.
- [ ] Read `13-credits` so question 8 can be asked precisely.

---

## 7. Things that must not be got wrong

**1. Nothing in this file is an answer.** It is a list of questions and a place
to write the answers down once someone qualified has given them. Every figure,
threshold and date here is marked to be confirmed, and that marking is not
decoration.

**2. The entity decision blocks the first client.** It is not administrative
tidying. A contract needs a party, and the party is `[PLACEHOLDER]`.

**3. Money owed to HMRC was never revenue.** `spend-order.md` item 1. The
set-aside happens the day a payment lands.

**4. The ICO fee is not the compliance work.** The compliance work is the schema
in `07-crm`, the privacy policy update in `04-legal`, and the hard block on the
send path. Paying a fee changes none of it.

**5. Business money never touches a personal account.** Open the account before
the first payment. This is the cheapest correct decision available today.

**6. Nothing here has been reviewed by a solicitor either.** Neither has
anything in `04-legal`. Do not say otherwise in any document or conversation.

**7. If the accountant recommends a monthly tool, it is still a spending
decision.** `spend-order.md` item 7 and the rule from master plan section 8
apply to advice as much as to impulse.
