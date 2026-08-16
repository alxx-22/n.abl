# 04 — Legal

```
Status:       in progress
Owner:        Alex
Next review:  before the first contract is signed — whichever comes first, that or
              a solicitor becoming affordable
Evidence:     none. No document here has been reviewed by a solicitor
```

The three public pages are live. The client-facing paperwork is not. Between
those two facts sits everything this folder is for.

Last substantive revision: 2026-08-15.

---

## The rule that governs this entire folder

**Nothing in here has been reviewed by a solicitor.** Not the privacy policy,
not the terms, not the cookie policy, not the NDA draft, not the scope-of-work
template, not the notes towards a service agreement.

They were drafted for n.abl by n.abl. They are a starting point that saves a
solicitor an hour of blank-page time. They are not legal advice and they are not
a substitute for legal advice.

Never say, write, imply or let a client assume otherwise. Not in an email, not on
a call, not in a proposal, not in a footer. "Our standard terms" is fine.
"Reviewed by our solicitor" is a lie until it is not, and it is the kind of lie
that only surfaces at the worst possible moment.

The master plan puts a solicitor third in the queue for first earnings
(`../README.md`, section 8). That is the point at which this rule stops
constraining what can be said.

---

## What this step is

Everything n.abl publishes or signs that has legal weight:

- the three public pages — privacy, terms, cookies
- the paperwork that surrounds an engagement — NDA, scope of work, service
  agreement
- the wording that has to be right because the business model depends on it: no
  retainers, credits rather than standby, the client owning what is built, and no
  regulated advice

**This step is not** the delivery runbook (`14-delivery`), the pricing method
(`12-pricing`), the credit ledger (`13-credits`) or the CRM's compliance schema
(`07-crm`). Those are separate folders and they are where the mechanics live.
This folder covers only the documents.

It has a hard dependency on `07-crm` in one direction: the privacy policy has to
describe what the CRM does before the CRM does it. See next actions, item 3.

---

## Where the public pages actually live

They are code, not documents. Do not rewrite them in this folder and do not keep
a second copy here. There is one source of truth and it is the component.

| Page | Route | Source |
|---|---|---|
| Privacy Policy | `/privacy` | `src/pages/Legal.jsx`, `DOCS.privacy` |
| Terms of Service | `/terms` | `src/pages/Legal.jsx`, `DOCS.terms` |
| Cookie Policy | `/cookies` | `src/pages/Legal.jsx`, `DOCS.cookies` |

All three render from one component. The content is a plain object at the top of
the file, so editing the words needs no React knowledge: find the section, change
the string.

Two things in that file to know before touching it:

- `LAST_UPDATED` is a single constant, currently `15 August 2026`, and it drives
  the date on all three pages.
- Every page renders a `legal__notice` block that says the document is a draft
  and has not been reviewed. **That block stays until a solicitor has actually
  read the page.** It is the honest-status mechanism, not decoration.

---

## What "done" looks like

Ten statements. Two are true today.

- [x] Privacy, terms and cookies are published, reachable and rendered from one
      source of truth.
- [x] No document, page or conversation describes any of this as solicitor
      reviewed. This is the only item on the list that can be lost by accident,
      in a single careless sentence.
- [ ] The public pages describe the business as it now is. Today the privacy
      policy opens with "n.abl is an automation consultancy" and the terms sell
      "consultancy, automation and optimisation services, generally delivered
      within software platforms you already license". Both are the old
      positioning, and the second is the old Power Platform assumption written
      into a contract term.
- [ ] The privacy policy covers people whose data arrives through research, not
      only people who filled in the enquiry form. It currently describes three
      groups: enquirers, clients, and our own staff. It does not describe leads.
- [ ] There is a scope-of-work template that has been used to scope a real job
      and survived contact with a real client.
- [ ] There is a service agreement drafted for the current model: no retainers,
      credits, client ownership of the deliverable, no regulated advice.
- [ ] An NDA can be sent within a day of a client asking for one, without
      anything being written from scratch.
- [ ] The company details that have to appear somewhere are decided and stated:
      legal entity name, company number if there is one, registered address, VAT
      position, ICO data protection fee position.
- [ ] A solicitor has read the service agreement, the scope-of-work template and
      the three public pages, and the draft notice has been removed only from
      what was actually read.
- [ ] Every signed document has a home and a filing process that someone follows
      without being reminded.

---

## Honest status, in one paragraph

The public pages are live and reasonable, and they carry a visible draft notice,
which is the right way round. What does not exist is the paperwork for actually
taking on a client: there is no service agreement written for this business model
and no scope-of-work document. This folder now holds a first draft of a
scope-of-work template and an NDA, plus a change list for the service agreement.
Drafts are not contracts. None of them has been sent to anyone, none has been
reviewed, and the step stays `in progress` until the items above are ticked.

The old business pack contained an NDA, a service agreement and a set of terms
and conditions. All three were written for an AI automation agency selling Power
Platform work. That is not this business. The NDA has been reworked here. The
service agreement has not been redrafted, because a redraft that repeats the old
assumptions is worse than no draft at all; `service-agreement-notes.md` lists
what has to change first.

---

## Next actions, in order

1. **Read the four other files in this folder.** Half an hour. Start with
   `contract-checklist.md`, which explains how the documents fit together.
2. **Fix the positioning wording on the live pages.** Two strings in
   `src/pages/Legal.jsx`: the first paragraph of `DOCS.privacy` "Who we are", and
   the first paragraph of `DOCS.terms` "Services". Both still describe the old
   business. This is a ten-minute edit and it removes a contradiction between the
   contract terms and the sales conversation.
3. **Add the research and marketing section to the privacy policy.** Before a
   single lead sourced from Companies House, a directory or a business's own
   website is added to the CRM. It has to say what is collected, where it came
   from, the lawful basis relied on, how long it is kept, how to object and how to
   opt out. This is blocking for v3 in the master plan, and it pairs with the
   `privacy_notice_status` field in `07-crm`. Do not treat it as paperwork to
   catch up on later.
4. **Fill the company details.** Every `[PLACEHOLDER]` in this folder that starts
   with a legal entity question. Check what is filed at Companies House, decide
   the VAT position, and check whether the ICO data protection fee applies.
5. **Use the scope-of-work template on the next real conversation.** Not a
   hypothetical one. The template is only proved by a client reading it and
   arguing with a line of it.
6. **Draft the service agreement** from `service-agreement-notes.md`, in one
   sitting, then leave it alone. Do not polish it. It is going to be marked up by
   someone who knows what they are doing.
7. **Decide the credit terms the contract depends on**: what a credit buys,
   whether credits expire, whether they are refundable, and what happens to
   unused credits if the engagement ends. The contract cannot be finished without
   these. They belong to `12-pricing` and `13-credits`, and the master plan says
   not to set the numbers before the first three real quotes.
8. **Book the solicitor review** when first earnings allow. Until then, every
   document goes out with its draft notice intact.
9. **Write down where signed documents go.** The team space already has a
   Documents tab with a `document_type` of `contract` and a private storage
   bucket. Use it, from the first client, rather than a folder on someone's
   laptop.

Items 2 and 3 are the ones with a real deadline attached, because item 3 blocks
outreach entirely.

---

## What each file in this folder is for

| File | What it is for | Read it when |
|---|---|---|
| `README.md` | This file. What the step is, what done means, honest status, what to do next. | Opening the folder cold |
| [`contract-checklist.md`](contract-checklist.md) | How the documents fit together, what a contract has to cover, the per-engagement checklist from first call to signed and filed, and what n.abl will not sign. | Before sending anything to a client, and before signing anything a client sends |
| [`scope-of-work-template.md`](scope-of-work-template.md) | The scope document. Fill-in template with guidance, a worked example using the master plan's numbers, and the acceptance and change-control wording that keeps a fixed price fixed. | Scoping any job |
| [`nda-template.md`](nda-template.md) | A mutual NDA, reworked off the old pack, including the clause that discloses the tools client information passes through. | A client asks for one, or the conversation is about to involve their data |
| [`service-agreement-notes.md`](service-agreement-notes.md) | What has to change before the old service agreement can be reused, clause by clause, and what has to be added that never existed. | Drafting the service agreement |

There is deliberately no copy of the privacy, terms or cookies text in this
folder. Two copies of a legal document means one of them is wrong and nobody
knows which.

---

## Things in here that must not be got wrong

**1. Nothing has been reviewed by a solicitor.** Covered above, and repeated here
because it is the one failure in this folder that cannot be undone by editing a
file.

**2. We build the system, we do not supply the advice inside it.** Legal, medical
and financial advice are out of scope, and that has to appear in the contract as
a term rather than in a conversation as a preference. Master plan, section 2.

**3. There are no retainers.** Any document that offers monthly support, standby,
"included hours" or a rolling fee contradicts the business model. Support is
bought as credits, when it is needed. Master plan, section 3.

**4. The client owns what is built.** Not "licensed for use", not "hosted by us
on your behalf". Owned, on payment in full, including the source and the
credentials needed to run it without us. The credit layer only works if leaving
is genuinely possible.

**5. Estimates of saving are illustrative.** The pricing method in the master
plan is built on a projected saving, so the contract has to be explicit that a
projection is not a warranty. The live terms already say this. Keep it.

**6. Client information passes through third-party services.** Supabase holds it,
and Claude is a cloud service, not a local model. Any confidentiality document
that implies information never leaves our machines is untrue. See the tooling
clause in `nda-template.md`.

---

## Open decisions

| Decision | Needed for | Depends on |
|---|---|---|
| Legal entity name, company number, registered address | Every document in this folder | Checking what is filed at Companies House |
| VAT registration position | Contract and quotes | Turnover, and whether registration is voluntary |
| ICO data protection fee position | Privacy policy | Checking whether it applies to us |
| Professional indemnity cover | Liability clause and the liability objection | First earnings. Master plan section 8, item 3 |
| Credit expiry, refundability and redemption rules | Service agreement | `12-pricing` and `13-credits`, after the first three real quotes |
| Standard payment schedule for staged work | Service agreement and SOW | Agreeing it before the first quote goes out |
| Defect period length after handover | SOW acceptance section | The first delivery, then set it and keep it |
| Solicitor, and the budget for the review | Removing the draft notices | First earnings |
| Owner and target date for this step | This file | Founders |

---

## Where this sits

The master plan is [`../README.md`](../README.md). It wins any disagreement with
this folder. It records this step as `in progress`, with the three public pages
live, no client contract, no scope-of-work template, and nothing reviewed by a
solicitor. Nothing in this folder changes that, and no file in here should be
read as claiming otherwise.
