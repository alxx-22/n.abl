# Contract checklist

**None of the documents described here has been reviewed by a solicitor.** This
file is an internal working checklist, not legal advice. See
[`README.md`](README.md).

Last substantive revision: 2026-08-15.

---

## 1. The document stack

Five documents, each doing one job. Confusion between them is the most common way
small businesses end up with a dispute they cannot resolve, because nobody can
say which piece of paper governs.

| Document | Job | When | Signed by | Exists? |
|---|---|---|---|---|
| **Website terms** | The general terms anyone using the site is on. The fallback where there is no signed agreement. | Always live | Nobody | Yes, `/terms` |
| **NDA** | Protects the confidential information exchanged while working out whether there is a job. | Before a deep-dive conversation, if either side wants one | Both | Draft only, [`nda-template.md`](nda-template.md) |
| **Quote** | The price, what it covers, and how long the price stands. | After scoping | Client accepts in writing | Yes, in the team space |
| **Scope of work** | What is being built, what is not, how it is accepted, who does what. | With the quote | Both | Draft template only |
| **Service agreement** | The terms the work is delivered under: payment, ownership, liability, confidentiality, termination. Signed once, then reused for later jobs. | First engagement | Both | Not drafted |

**The intended order of precedence**, to be confirmed by the solicitor:

1. The signed scope of work wins on **what is being built**.
2. The signed service agreement wins on **the terms it is built under**.
3. The website terms apply to anyone who has not signed a service agreement.

Write that precedence into the service agreement itself. If it only lives in this
file, it does not exist.

**One service agreement per client, many scopes of work.** That is the whole
reason for splitting them. Job two should need one document, not four.

---

## 2. Blocking: before any contract goes out

None of these are ticked. Every one is quick except the last.

- [ ] Legal entity settled: name, company number if there is one, registered
      address. `[PLACEHOLDER]`
- [ ] VAT position decided, and stated on quotes either way. The live terms say
      prices exclude VAT unless stated, which is only safe if the VAT position is
      known. `[PLACEHOLDER]`
- [ ] Payment terms decided: deposit percentage, stage payments, final payment,
      and days to pay. `[PLACEHOLDER]`
- [ ] Late payment position decided. B2B contracts commonly reference the Late
      Payment of Commercial Debts (Interest) Act 1998. Check whether to state a
      rate or rely on the statutory position.
- [ ] Liability cap decided, and checked against whatever insurance exists. Today
      there is none, which is precisely why the cap matters.
- [ ] Credit terms decided: expiry, refundability, what one credit buys, what
      happens to unused credits at the end of an engagement.
- [ ] The service agreement drafted from
      [`service-agreement-notes.md`](service-agreement-notes.md).
- [ ] A solicitor has read it.

Until the last box is ticked, everything goes out carrying the draft notice, and
nobody describes it as reviewed.

---

## 3. Clause checklist for the service agreement

Check any draft against this. The third column records what the live website
terms (`src/pages/Legal.jsx`, `DOCS.terms`) already say, so the drafting work is
only the gap.

| # | Clause | Must say | Live terms today |
|---|---|---|---|
| 1 | Parties and entity | Full legal names, company numbers, addresses | Not stated |
| 2 | What we do | Technology implementation for small businesses, problem-led. Not "AI automation", not "within platforms you already license" | Wrong. Old positioning |
| 3 | How work is defined | Each job is defined by a signed scope of work, which prevails on scope | Refers to "the quote or statement of work" but neither exists |
| 4 | Price basis | Fixed price per scope, or value-priced implementation. **Not hourly, no retainer, no standby fee** | Silent |
| 5 | Payment schedule | Deposit, stages, final, days to pay, suspension on overdue | 30 days, suspension on overdue. Schedule missing |
| 6 | VAT | Stated position | Excludes VAT unless stated |
| 7 | Change control | Changes are agreed in writing before work; they are a new quote or a draw on credits | Present, thin |
| 8 | Acceptance | Defined acceptance criteria per scope, a review window, and what counts as accepted by default | Absent. Biggest single gap |
| 9 | Defects vs changes | A defect is not meeting the agreed criteria and is fixed free within the defect period. A change is anything else and is a change | Absent |
| 10 | Ownership | The client owns the deliverable outright on payment in full, including source and credentials | Partial. "Bespoke configurations and automations... transfer to you on payment in full" |
| 11 | Our background IP | We keep our pre-existing tools, methods and know-how, and grant whatever licence the client needs to keep using the deliverable | Present, and close to right |
| 12 | Third-party costs | Platform subscriptions, API usage and licences are the client's, in the client's own accounts | Partial. Assumes the client already licenses everything |
| 13 | Credits | What they cover, how they are drawn down, expiry, refundability, and that they are **not** a support retainer or an SLA | Absent |
| 14 | No regulated advice | We build systems. We do not provide legal, medical or financial advice, and the system's output is not advice | Absent. Required by master plan section 2 |
| 15 | No guarantee of saving | Value estimates are illustrative, based on figures the client supplies | Present. Keep the wording |
| 16 | Client responsibilities | Access, data, decisions, a named contact, their own licences and permissions | Present |
| 17 | Backups | The client keeps their own backups of business-critical data | Present |
| 18 | Data protection | Roles, and that any sharing of personal data needs its own written terms | Absent from the terms, though the privacy policy covers the site |
| 19 | Tools and subprocessors | Client information passes through hosted services, including cloud AI. Named, with the option to restrict | Absent. See clause 6 of the NDA draft |
| 20 | Confidentiality | Mutual, survives the engagement | Present |
| 21 | Liability | Carve-outs for what cannot be limited, no indirect loss, capped total | Present. Cap needs a number that matches reality |
| 22 | Termination | Notice either side, payment for work properly done, what happens to part-built work and to unused credits | Partial. Silent on credits and on part-built work |
| 23 | Handover on exit | What the client gets: source, credentials, documentation, data export | Absent |
| 24 | Subcontracting | Whether work may be subcontracted, and that we stay responsible | Absent |
| 25 | Publicity | Whether the client can be named as a client, and that nothing is published without written consent | Absent. Matters, because there is no proof to point at yet |
| 26 | Governing law | England and Wales | Present |
| 27 | Precedence | Scope of work, then service agreement, then website terms | Absent |

Nine clauses are wholly missing: 8, 9, 13, 14, 18, 19, 23, 24, 25. Those are the
drafting job.

---

## 4. Per-engagement checklist

Run this on every client, from first conversation to filed paperwork.

**Before scoping**

- [ ] The job passes the ICP and none of the disqualifiers in
      `../01-positioning/saying-no.md` apply.
- [ ] It is not regulated advice, and not a request for us to be the adviser.
- [ ] The client can decide without a committee.
- [ ] NDA sent and signed, if either side wants one, before their data or systems
      are discussed in detail.

**Scoping**

- [ ] Scope of work drafted from
      [`scope-of-work-template.md`](scope-of-work-template.md).
- [ ] Every `[PLACEHOLDER]` and every guidance line removed from the document.
- [ ] Out of scope written down as a list, not implied by omission.
- [ ] Acceptance criteria are testable by the client without our help.
- [ ] Assumptions written down, especially about access, data quality and who
      makes decisions.
- [ ] Priced as A (efficiency, on value) or B (capability, fixed). If it is
      neither, it is not a job yet.
- [ ] If it is A, the client supplied the current-cost figures and has seen the
      arithmetic.
- [ ] Credits offered alongside, priced better bought with the implementation.
- [ ] Third-party costs identified and confirmed as the client's.

**Before work starts**

- [ ] Service agreement signed, once, by both parties.
- [ ] Scope of work signed.
- [ ] Quote accepted in writing.
- [ ] Deposit received, if the payment schedule has one.
- [ ] Access granted, in the client's own accounts, with our own named logins
      rather than shared ones.

**On completion**

- [ ] Acceptance run against the criteria in the scope, by the client.
- [ ] Handover pack delivered: source, credentials, documentation, data export.
- [ ] Ownership confirmed in writing, on payment in full.
- [ ] Defect period start date recorded.
- [ ] Credit balance recorded and confirmed to the client.

**Filing**

- [ ] Every signed document uploaded to the team space Documents tab against the
      client record, `document_type` = `contract`.
- [ ] Quote PDF attached to the quote record, status set to `accepted`.
- [ ] Project record created with the milestone dates from the scope.

The storage buckets behind the team space are private and served through
short-lived signed links. That is the right place for signed paperwork. A folder
on a laptop is not.

---

## 5. The five things this business model forces into every contract

Get these wrong and the document describes a different company.

1. **No retainers.** No monthly fee, no standby, no included hours, no minimum
   term. Support is credits, bought when needed. If a client asks for a retainer,
   the answer is the credit pack, and the reason is that they should not pay us
   for months in which we do nothing.
2. **Credits are not an SLA.** They buy work. They do not buy a response time. If
   a response time is ever promised, it is a separate, priced commitment, and it
   is not called a credit.
3. **The client owns the deliverable.** On payment in full, including source and
   credentials. Ownership is what makes the absence of a retainer credible.
4. **No regulated advice.** We build the system. We do not supply legal, medical
   or financial advice, and the system's output is not advice from us.
5. **Value pricing is not a promise of value.** The price may be derived from a
   projected saving; the projection uses the client's own numbers and is not
   warranted. Say so in the same document that contains the projection.

---

## 6. What we do not sign

Client paperwork arrives with clauses that are ordinary for a large supplier and
fatal for a two-person business. Any of these, stop and take advice.

- **Unlimited liability**, or a cap set as a multiple of fees, or uncapped
  indemnities. With no professional indemnity cover in place, this is the one
  that ends the business.
- **Assignment of our background IP.** They own what we build for them. They do
  not own our tools, methods or anything reused across clients.
- **Exclusivity or non-compete** across a sector or region.
- **Unpaid change control**: "reasonable changes at no cost", "minor amendments
  included".
- **Retainer or minimum-term language**, however it is phrased.
- **Acceptance at the client's sole discretion**, with no stated criteria.
- **Payment terms beyond 30 days**, or payment conditional on something outside
  our control.
- **Their staff-poaching, insurance or audit schedules** requiring cover or
  processes that do not exist. Do not sign a warranty that we hold insurance we
  do not hold.
- **Anything requiring a security questionnaire and a procurement cycle.** The
  master plan already says that client is out of scope. The paperwork is the tell.

The default answer to a clause we do not understand is not "it is probably fine".
It is "our terms are attached; if yours have to govern, we will need to have them
looked at, and that will cost time before we start".

---

## 7. Records to keep

| Record | Where | Why |
|---|---|---|
| Signed service agreement | Team space, Documents, `contract` | The terms in force |
| Signed scope of work | Team space, Documents, `contract` | What was agreed, when scope is disputed |
| Accepted quote | Team space, Quotes, status `accepted`, PDF attached | The price and its acceptance |
| Written change agreements | Team space, Documents | Every change, in writing, or it did not happen |
| Acceptance confirmation | Team space, Documents | Starts the defect period and triggers final payment |
| Handover confirmation | Team space, Documents | Evidence the client got the source and credentials |
| Credit balance and drawdowns | `13-credits` when it exists, until then the quote record | Disputes about credits are disputes about money |

---

## 8. Open decisions

| Decision | Blocks | Depends on |
|---|---|---|
| Deposit percentage and stage payments | Sections 2, 3 clause 5 | Agreeing it before the first quote |
| Liability cap figure | Section 3 clause 21 | Insurance, or the honest absence of it |
| Credit expiry and refundability | Section 3 clause 13 | `12-pricing`, `13-credits` |
| Defect period length | Section 3 clause 9 | The first delivery |
| Whether subcontracting is permitted | Section 3 clause 24 | Whether anyone else will ever touch client systems |
| Publicity default: named or not | Section 3 clause 25 | Ask the first client; do not assume |
