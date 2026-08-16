# Mutual non-disclosure agreement — template

**This document has not been reviewed by a solicitor.** It is a draft prepared
for n.abl by n.abl. Do not describe it as reviewed, approved or checked, and do
not rely on it as legal advice. See [`README.md`](README.md).

Last substantive revision: 2026-08-15.

---

## When to use it

An NDA is not needed for every conversation, and offering one unprompted at the
first hello reads as nervous rather than professional.

**Send one when:**

- the client asks for one, which happens more often with clients who have been
  burned before, and is a good sign rather than a bad one
- the conversation is about to involve their customer data, pricing, supplier
  terms, financials or anything they would not put on their own website
- we are about to be given access to a live system to look at how it works
- we will be describing our own method in enough detail that it is worth
  protecting

**Do not bother when** the conversation is still "what do you do and what does it
cost". There is nothing confidential in that yet.

**Mutual, always.** A one-way NDA in our favour looks presumptuous, and a one-way
NDA in theirs leaves our method unprotected while they discuss it internally. Both
sides disclose, so both sides are bound.

**Signing it does not commit either party to anything else.** Clause 9 says so
explicitly, and it is worth saying out loud too, because it is the thing that
makes a cautious client comfortable signing quickly.

---

## What was reworked from the old pack

The old business pack contained an NDA written for an AI automation agency
selling Power Platform work. That is not this business, and the differences are
not cosmetic.

| Change | Why |
|---|---|
| Positioning wording removed | n.abl is a technology implementation partner for small businesses. AI is one tool among several. The document should not describe the company as an AI automation agency anywhere |
| Platform assumptions removed | The old pack assumed work happened inside a named vendor stack the client already licensed. Work now happens wherever the problem is, including in ordinary code |
| Purpose written as a problem, not a product | The purpose clause defines what the exchange is for, and "evaluating a Power Platform engagement" is both wrong and narrower than the conversations we actually have |
| Tooling and subprocessor clause added, clause 6 | New, and the most important addition. Client information passes through hosted services, and cloud AI is one of them. An NDA that implies otherwise is untrue |
| Personal data clause added, clause 8 | The old pack treated confidentiality and data protection as the same thing. They are not, and conflating them leaves a gap |
| Ownership wording aligned, clause 7 | Consistent with the rest of the paperwork: the client owns the deliverable, and an NDA transfers nothing |
| Deliberately no charging or engagement terms | Those belong in the service agreement, not here |

Before reusing anything else from the old pack, read it for other survivals of
the same two assumptions. Anything that names a vendor stack, or describes
n.abl's work as AI, is stale.

---

## The template

Everything from here to the signature block is the document. Fill every
`[PLACEHOLDER]` before sending. Keep the notice at the top until a solicitor has
read it.

---

### Mutual non-disclosure agreement

> **Draft, not yet reviewed.** This agreement is a starting point drafted for
> n.abl and has not been reviewed by a qualified solicitor. Both parties should
> take their own advice before relying on it.

**Date:** `[PLACEHOLDER]`

**Between:**

**(1)** `[PLACEHOLDER: n.abl legal entity name]`, `[PLACEHOLDER: company number, if
a company]`, of `[PLACEHOLDER: registered address]` ("n.abl"); and

**(2)** `[PLACEHOLDER: client legal entity name]`, `[PLACEHOLDER: company number]`,
of `[PLACEHOLDER: registered address]` (the "Client").

Each a "party", and together the "parties". Each party may act as the party
disclosing information (the "Discloser") and as the party receiving it (the
"Recipient").

---

**1. Purpose**

The parties wish to discuss `[PLACEHOLDER: a short, specific description, for
example "how the Client's quoting process works today and whether n.abl could
build a system to improve it"]` (the "Purpose").

To do that, each party may need to share information it treats as confidential.
This agreement sets out how that information is handled.

**2. Confidential information**

"Confidential Information" means information disclosed by one party to the other
in connection with the Purpose, in any form, which is marked as confidential or
which a reasonable person would understand to be confidential from its nature or
the circumstances of disclosure.

It includes, without limiting the general position: business plans, pricing,
costs, margins, financial information, customer and supplier information,
employee information, data held in the Discloser's systems, technical
information, source code, methods, processes, and the existence and content of
the parties' discussions.

**3. What it does not include**

Confidential Information does not include information which the Recipient can
show:

- (a) was already known to it, free of any obligation of confidence, before
  disclosure;
- (b) is or becomes public other than through a breach of this agreement;
- (c) is received from a third party who was free to disclose it; or
- (d) was independently developed by the Recipient without use of or reference to
  the Discloser's Confidential Information.

**4. Obligations**

The Recipient shall:

- (a) keep the Confidential Information confidential;
- (b) use it only for the Purpose;
- (c) protect it with at least the care it applies to its own confidential
  information, and in any event with reasonable care;
- (d) not copy it except as reasonably necessary for the Purpose; and
- (e) not disclose it to anyone except as clause 5 and clause 6 permit.

**5. Permitted disclosure to people**

The Recipient may disclose Confidential Information to its officers, employees
and professional advisers who need it for the Purpose, provided it first makes
them aware of the confidential nature of the information and remains responsible
for their compliance as if their acts were its own.

The Recipient may also disclose Confidential Information where required by law,
by a court or by a regulator. Where it is lawful to do so, it shall tell the
Discloser first, and shall disclose only what is required.

**6. Tools and service providers**

Each party will use ordinary business tools and hosted services to do its work,
and Confidential Information may pass through them. n.abl's information
processing relies in particular on:

- `[PLACEHOLDER: hosted database, authentication and file storage, currently
  Supabase, hosted in the European Union]`
- `[PLACEHOLDER: cloud-based AI services used as development and drafting tools]`
- `[PLACEHOLDER: email and file storage providers]`

Each is used under the provider's own terms and subject to confidentiality
obligations no less protective than those in this agreement.

**Cloud AI services are not local software.** Where a tool of that kind is used,
the information given to it leaves n.abl's own machines and is processed by the
provider.

If the Client requires that particular categories of information are not put
through a third-party service, it shall say so in writing. n.abl will confirm in
writing whether that is workable, and what effect it has on the work. It is
usually workable, because most of the processing in a typical project is ordinary
code that involves no such service at all, but it has to be agreed rather than
assumed.

**7. No transfer of rights**

Nothing in this agreement transfers ownership of any information or intellectual
property, and nothing in it grants a licence, other than the limited right to use
the Confidential Information for the Purpose.

Ownership of anything n.abl later builds for the Client is dealt with in the
parties' service agreement and scope of work, not here.

**8. Personal data**

Where Confidential Information includes personal data, each party remains
responsible for its own compliance with UK data protection law.

This agreement is not a data processing agreement. If the Purpose leads to n.abl
processing personal data on the Client's behalf, the parties will agree separate
written data protection terms before that processing begins.

**9. No obligation and no partnership**

Nothing in this agreement obliges either party to disclose any particular
information, to enter into any further agreement, or to proceed with any work.

Nothing in it creates a partnership, joint venture, agency or employment
relationship, or any exclusivity between the parties.

**10. No warranty**

Confidential Information is provided as it is. Neither party warrants its accuracy
or completeness, save that each party confirms it is entitled to disclose the
information it discloses.

**11. Return or destruction**

On written request, and in any event when the Purpose has clearly ended, the
Recipient shall return or destroy the Confidential Information in its possession
and confirm in writing that it has done so.

The Recipient may keep one copy where it is required to by law, or where the
information sits in routine backups that cannot practically be deleted
selectively. Anything retained stays subject to this agreement for as long as it
is held.

**12. Duration**

This agreement starts on the date above and applies to information disclosed in
the `[PLACEHOLDER: 12]` months following it.

The obligations of confidentiality continue for `[PLACEHOLDER: 3]` years from the
date of disclosure, and for as long as the information remains a trade secret,
whichever is longer.

**13. Remedies**

Each party accepts that damages alone may not be an adequate remedy for a breach
of this agreement, and that the other party may seek injunctive relief in
addition to any other remedy available to it.

**14. General**

This agreement is the entire agreement between the parties on its subject matter
and replaces any earlier understanding about confidentiality between them.

It may only be varied in writing, signed by both parties. No failure or delay in
enforcing a right waives it. If any provision is found unenforceable, the rest
continues to apply. A person who is not a party has no right to enforce it.

**15. Governing law**

This agreement and any dispute arising from it are governed by the laws of England
and Wales, and the courts of England and Wales have exclusive jurisdiction.

---

**Signed for and on behalf of the parties**

| | n.abl | `[PLACEHOLDER: client name]` |
|---|---|---|
| Name | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| Role | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| Signature | | |
| Date | | |

---

## Before you send it

- [ ] Both legal entity names, numbers and addresses filled in. Check the
      client's at Companies House rather than copying their letterhead.
- [ ] The Purpose in clause 1 is specific to this conversation, not generic.
- [ ] Clause 6 lists the services actually in use, and nothing that is not.
- [ ] The two periods in clause 12 have numbers.
- [ ] The draft notice is still at the top.
- [ ] Signed copy uploaded to the team space Documents tab against the client
      record, `document_type` = `contract`.

## Open decisions

| Decision | Depends on |
|---|---|
| n.abl legal entity name, number and registered address | Checking what is filed at Companies House |
| Disclosure period and survival period in clause 12 | Solicitor review. The values shown are a starting point, not advice |
| The exact list of services named in clause 6 | Confirming the current stack, and keeping the list current as it changes |
| Whether to offer an NDA proactively or only on request | Founders. Current default: on request |
