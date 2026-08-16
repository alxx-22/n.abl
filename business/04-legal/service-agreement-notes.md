# Service agreement — what has to change

**There is no service agreement.** This file is the change list that has to be
worked through before one is drafted. Nothing described here has been reviewed by
a solicitor, and nothing produced from it should be described as if it has. See
[`README.md`](README.md).

Last substantive revision: 2026-08-15.

---

## Why this is notes and not a draft

There are two starting points available, and both are wrong in ways that would
survive a rewrite unless they are written down first.

**The old business pack** contained a service agreement and a set of terms and
conditions written for an AI automation agency selling Power Platform work. The
whole document assumes a different company: a different thing being sold, inside
a vendor stack the client already licensed, on a commercial model that is not
ours. Editing it paragraph by paragraph would produce something that looks
correct and quietly keeps the assumptions.

**The live website terms** at `src/pages/Legal.jsx` are closer, and about half of
the clauses are reusable more or less as they stand. But they were written as
website terms rather than as a signed agreement, and they carry the same old
positioning in their opening lines.

So: change list first, draft second, solicitor third. The drafting is one sitting
once the decisions below are made.

---

## 1. The four structural changes

Everything else on this page is detail. These four are the ones that make it a
different document rather than the same document with new words.

### 1.1 No retainers

There is no monthly fee, no standby arrangement, no included hours, no minimum
term and no rolling contract. The agreement is a framework: it is signed once and
sits there at no cost until a scope of work is signed under it.

**What that means in the drafting:**

- The agreement itself has no price. Price lives in the scope of work.
- Nothing may create an ongoing payment obligation.
- "Support" appears only as credits, and never as an entitlement.
- Termination of the agreement costs nothing and requires no notice period beyond
  finishing any live scope of work.

The sentence the client should be able to repeat: *you do not pay us monthly to
be on standby; you buy support when you actually need support.*

### 1.2 Credits

A clause that has no equivalent anywhere in the old pack, because the old model
did not have credits.

It has to state, at minimum:

- the three types and what each covers: Build, Assist, Educate
- how credits are drawn down, and who confirms the drawdown
- that credits are bought in advance, in packs, and are cheaper bought alongside
  an implementation
- expiry `[PLACEHOLDER]`
- refundability `[PLACEHOLDER]`
- what happens to unused credits if the relationship ends `[PLACEHOLDER]`
- **that credits are not a service level agreement.** They buy work, not a
  response time. If a response time is ever agreed, it is separate, priced and
  named as such.

Do not draft the numbers yet. The master plan says pack sizes and prices are set
alongside the first three real quotes, not before, and a placeholder in a contract
is more honest than a guess.

### 1.3 The client owns the deliverable

The live terms say bespoke configurations and automations "transfer to you on
payment in full", which is the right instinct written too narrowly. It has to
become an ownership clause with teeth:

- on payment in full, the deliverables described in the scope of work belong to
  the client outright, including source code, configuration and the credentials
  needed to run and change them
- n.abl keeps its pre-existing tools, methods and general know-how, and stays free
  to use that expertise for other clients
- where a deliverable contains any of that background material, the client gets a
  perpetual, irrevocable licence to use, modify and maintain it as part of the
  deliverable, including through another supplier
- the client's data, content and business records are theirs throughout
- handover on exit is defined: source, credentials, documentation, data export

Ownership is not a goodwill gesture. It is what makes the absence of a retainer
credible, and it is the reason a client can buy credits without feeling trapped.

### 1.4 No regulated advice

New, and required by section 2 of the master plan.

- n.abl builds systems. It does not provide legal, medical or financial advice.
- Output produced by a system n.abl builds is not advice from n.abl.
- Where a client's process touches a regulated area, the client remains
  responsible for the decisions taken and for obtaining professional advice.
- The clause pairs with a scoping rule: work that requires regulated advice is
  declined, not disclaimed. A disclaimer does not save a badly chosen engagement.

---

## 2. What must be removed from the old pack

| Remove | Replace with |
|---|---|
| Any description of n.abl as an AI automation agency, or of the work as AI | Technology implementation for small businesses. AI is one tool among several, alongside Python, web development, integration, automation and training |
| Any named vendor stack, and any assumption that work happens inside platforms the client already licenses | Work happens wherever the problem is. Third-party platforms are named per scope of work, in the client's own accounts |
| Retainer, monthly fee, standby, included hours, minimum term | The credits clause, section 1.2 |
| Hourly rates as the basis of price | Fixed price per scope of work. Efficiency work priced on value, capability work fixed. Internal labour cost is tracked, never sold |
| Three pillars of Innovation, Automation and Optimisation as the description of services | The six problem-led categories, or better, no service list at all. Services are defined by the scope of work |
| Anything implying the documents have been checked by a lawyer | The draft notice, until that is true |
| Old brand references: lime, pure black, Archivo Black, a wordmark "set in" a typeface | The current identity. See `../02-brand/` |

---

## 3. What the live website terms already give us

From `src/pages/Legal.jsx`, `DOCS.terms`. Reuse the good ones rather than
rewriting.

**Reusable close to as-is:** fees and payment, the client's responsibilities,
backups, confidentiality, the reasonable care and skill wording, the disclaimer
that savings estimates are illustrative, the liability structure with its
carve-outs and cap, termination, and governing law.

**Reusable with the changes in section 1:** intellectual property, which needs
section 1.3, and engagement and quotes, which needs the scope of work to be named
as the controlling document.

**Wrong today, and worth fixing on the live page as well as in the agreement:**

- *Services*: "consultancy, automation and optimisation services, generally
  delivered within software platforms you already license". Old positioning in the
  first line, and the old platform assumption written into a contract term.
- *Privacy, Who we are*: "n.abl is an automation consultancy based in the United
  Kingdom". Same problem, and it is the first sentence a client reads.

Both are single strings in one file, and both are on the next-actions list in
[`README.md`](README.md).

**Missing entirely**, and these are the drafting job: acceptance, defects versus
changes, credits, no regulated advice, data protection roles, tools and
subprocessors, handover on exit, subcontracting, publicity, and precedence
between the documents. Nine clauses, listed against the full checklist in
[`contract-checklist.md`](contract-checklist.md) section 3.

---

## 4. Clauses to add that never existed

### 4.1 Acceptance

The single largest gap. Without it, "finished" is whatever the client decides on
the day, and a fixed price becomes an open one.

The mechanism belongs in the scope of work, which carries the criteria. The
agreement carries the framework: criteria are defined per scope, there is a review
window, work is accepted when the criteria are met or when the window closes
without written objection, and acceptance triggers final payment and starts the
defect period.

### 4.2 Defects versus changes

A defect is the work not meeting an agreed acceptance criterion. It is fixed at no
charge within the defect period `[PLACEHOLDER: length]`.

Anything else is a change: new requirements, changed requirements, changes to the
client's own systems, and changes made by third-party platforms after acceptance.
Changes are quoted or drawn from credits, agreed in writing before the work.

State plainly that a third-party platform changing its behaviour after acceptance
is not a defect. It is the most common source of a "you broke it" conversation
eighteen months later, and it is exactly what credits are for.

### 4.3 Tools and subprocessors

Client information passes through hosted services, and cloud AI services are among
them. The agreement should name the categories, commit to confidentiality
obligations flowing down, and give the client a route to restrict particular
categories of information in writing.

**Claude Code running locally is not a local Claude model.** Claude Code is a
local interface and orchestration environment; the models are cloud-hosted. Never
draft a clause that implies client information stays on our machines because a
tool runs on our machines. Clause 6 of [`nda-template.md`](nda-template.md) has
wording that can be lifted.

### 4.4 Data protection

Roles stated: ordinarily each party is its own controller. If n.abl processes
personal data on the client's behalf, separate written data protection terms are
agreed before that processing starts. Confidentiality is not the same obligation
as data protection, and one clause cannot carry both.

### 4.5 Third-party costs

Platform subscriptions, API usage and licences are the client's, in the client's
own accounts, in the client's name. n.abl does not resell them and does not hold
the account. Named per scope of work.

This matters more than it looks: it keeps our fixed cost base at the £36 a month
the master plan protects, and it means a client can leave without a hostage
situation over an account we own.

### 4.6 Handover on exit

What the client receives when an engagement ends, whether it ends by completion or
early: source, credentials, documentation, data export, and the removal of our
access. Give it a timescale.

### 4.7 Subcontracting and publicity

Two small clauses that are easy to forget and awkward to add later. Whether work
may be subcontracted and that n.abl stays responsible either way. Whether the
client may be named as a client, and that neither party publishes anything about
the other without written consent.

Publicity matters now rather than later, because there is no client work to point
at yet and the first permission to name someone is worth having in writing.

### 4.8 Precedence

Scope of work first on what is being built, service agreement second on the terms,
website terms as the fallback for anyone with no signed agreement.

---

## 5. What must never appear in it

- Any form of retainer, standby fee, minimum term or included monthly hours.
- A guarantee of savings, a guaranteed return on investment, or a percentage
  improvement stated as a promise. The pricing method rests on a projection made
  from the client's own numbers, and the document that contains the projection has
  to say that it is one.
- A response time dressed as a credit.
- An uncapped liability, or a warranty that insurance is held that is not held.
- Regulated advice, however carefully disclaimed.
- Any claim that the document has been reviewed by a solicitor.

---

## 6. Drafting order

1. Settle the decisions in section 7. Half of the drafting is currently blocked on
   numbers nobody has chosen.
2. Take the reusable clauses from the live website terms, section 3.
3. Apply the four structural changes, section 1.
4. Add the eight new clauses, section 4.
5. Check the result against
   [`contract-checklist.md`](contract-checklist.md) section 3, all 27 rows.
6. Read it once as a client who has been let down by a supplier before. That is
   the reader who finds the gap.
7. Send it to a solicitor. Until they have read it, it goes out with the draft
   notice attached and is described as our standard terms, never as reviewed.

Steps 2 to 4 are one sitting. Do not spend a week polishing prose that is about to
be marked up by someone who knows what they are doing.

---

## 7. Decisions this document is blocked on

| Decision | Clause it blocks | Depends on |
|---|---|---|
| Legal entity name, number, registered address | Parties | Companies House |
| VAT position | Fees | Turnover, and whether to register voluntarily |
| Deposit and stage payments | Payment | Agreeing it before the first quote |
| Late payment position | Payment | Whether to state a rate or rely on the statutory position |
| Liability cap figure | Liability | Insurance, or the honest absence of it |
| Credit expiry, refundability, end-of-relationship treatment | Credits | `12-pricing`, `13-credits`, after the first three quotes |
| Defect period length | Defects | The first delivery |
| Review window length | Acceptance | The first delivery |
| Whether subcontracting is permitted | Subcontracting | Whether anyone else will ever touch client systems |
| Publicity default | Publicity | Ask the first client |
| Solicitor and budget | All of it | First earnings. Master plan section 8, item 3 |
