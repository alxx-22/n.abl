# Handover and ownership transfer

**No handover pack has ever been assembled.** This is the specification for the
first one, written before there is a client to test it on.

---

## 1. Why this is a deliverable and not a courtesy

n.abl sells no retainers. That is the commercial model in master plan section 3
and it only works if one thing is true: **the client can leave.**

`04-legal/contract-checklist.md:178` states it in a sentence — *ownership is what
makes the absence of a retainer credible.* A client who owns a system they cannot
run, cannot change and cannot hand to anyone else does not own it in any way that
matters. They are dependent on us, and credits stop being "buy support when you
need it" and become a retainer they pay in instalments.

So the handover pack is deliverable 3 in every scope of work, priced into the
job, and `04-legal/scope-of-work-template.md:119` already says the part that
must not be negotiated away:

> *Deliverable 3 is not optional and is never removed to reduce the price. The
> client owns what is built, and ownership without the source is a slogan.*

The awkward test, and the one this whole document is arranged around:

> **If n.abl stopped existing tomorrow, could this client keep running what we
> built, and could a competent stranger change it?**

If the honest answer is no, the handover is not finished, whatever has been
delivered.

---

## 2. When handover happens

At the end of the engagement, by completion or otherwise. The service agreement
will say so: `04-legal/service-agreement-notes.md` §4.6 requires a handover on
exit clause covering source, credentials, documentation, data export and the
removal of our access, **with a timescale**. The agreement is not drafted yet.
Until it is, hand over on the same terms anyway.

Three cases, one specification:

| Case | What changes |
|---|---|
| **Normal completion** | Nothing. The pack is assembled at acceptance and handed over on payment in full |
| **Early termination by either side** | The pack covers what exists, in whatever state it exists, with an honest note on what is unfinished. Access is removed on the same timescale |
| **Client goes quiet or the relationship sours** | Same pack, same timescale, no leverage. Withholding credentials as pressure over an invoice would be the single most damaging thing this business could do to its own positioning |

The pack is **assembled continuously**, not at the end. The credentials register
is written as credentials arrive, the runbook is written as the training happens,
the README is written as the build proceeds. A handover pack reconstructed from
memory in an afternoon is where the gaps come from.

---

## 3. What is in the pack

Five parts. Deliver as a single folder, self-contained, in the client's own
storage, with a copy filed to their portal Documents tab so it survives a lost
laptop.

### 3.1 Source

Everything needed to rebuild what was delivered.

- All code, configuration and scripts, including the unglamorous ones: the
  scheduled job definition, the environment file template, the one-off migration
  somebody ran in March.
- **No secrets in the source.** Credentials go in part 2 and the source carries a
  template with the keys named and the values blank.
- Where it is version controlled, hand over the repository itself, in the
  client's own account or exported in full with history. A zip of the final state
  is acceptable and inferior; say which was given.
- Third-party components named, with their licences, so the client knows what
  they are relying on and what it costs.

### 3.2 Credentials and accounts

Straight from the credentials register started during onboarding.

- Every system, what it is for, whose account it is in, and which login n.abl
  used.
- Confirmation that every account is already in the client's own name. If any is
  not, transferring it is the first task of handover, not a note in the pack.
- **Rotate anything n.abl knew.** Any password, key or token we have held is
  changed by the client at handover, by them, and we never see the new value.
  This is not distrust. It is the only way the removal of our access can be
  stated as a fact rather than a promise.
- **Never send a credential in an email or a chat message.** Their password
  manager, or the platform's own invitation flow. Where something must be read
  aloud, do it on a call and have them change it immediately afterwards.

### 3.3 Documentation

Written for the person who was not in the room, and not for us.

| Document | What it must answer |
|---|---|
| **README** | What this is, what it does, where it runs, and how to start and stop it |
| **Runbook** | The procedure, numbered, in plain language, with screens named as the client sees them. Produced by the training pattern in `project-runbook.md` §7 |
| **How to change the common things** | The three or four things that will actually need changing: a rate, an email address, a template, a schedule. Where each lives, by file and line if that is what it takes |
| **When it goes wrong** | The failure modes that will really happen, what each looks like, what to do, and when to stop and call somebody |
| **Architecture, in one page** | What talks to what, and in which direction. A diagram a non-technical owner can follow and a technical stranger can act on |
| **Known limitations** | The exceptions from the audit that the system does not handle, and what a person does instead. Written down before acceptance, never discovered afterwards |
| **Screen recordings** | Anything easier shown than written. Their storage, not ours |

The known-limitations page is the one that gets left out and the one that earns
the most trust. A client who was told plainly that the system passes 20% of cases
back to a human is a client who is not disappointed on the first Monday.

### 3.4 Data export

Everything the system holds, in a format that outlives the system.

- Open formats. CSV, JSON, plain SQL. Not a proprietary backup file that only
  reopens in software they would have to keep paying for.
- The schema alongside the data, so a stranger can tell what the columns mean.
- A note of anything **not** included, and why.
- If the system holds personal data, note where it is, so the client can answer a
  subject access request without archaeology. We build the system; the client is
  the controller of their own data and needs to be equipped to act like it.

### 3.5 The exit note

One page, plain language, addressed to the owner rather than to a technical
person. It says what they now hold, what happens next, what we no longer have
access to, and what it costs to get us back. Section 6 below is the draft.

---

## 4. Ownership transfer

`04-legal/scope-of-work-template.md` §11 is the wording that governs it, and
delivery just has to make it true:

> You own what we build for you. On payment in full, the deliverables in section
> 2 become yours outright, including the source code, the configuration and the
> credentials needed to run and change them without us.
>
> We keep our own pre-existing tools, methods and general know-how, and remain
> free to use that expertise for other clients. Nothing we reuse contains your
> data or anything confidential to you.
>
> Your data, content and business records are yours throughout and we claim
> nothing over them.

Three practical consequences.

**Confirm it in writing, and file the confirmation.** A short email on payment in
full: what has transferred, and that it has. `04-legal/contract-checklist.md` §7
lists a handover confirmation as a record to keep, and its purpose is evidence
that the client received the source and the credentials.

**Know what you are reusing.** General know-how and our own pre-existing tools
stay ours. If a component built for this client is going to be reused, it must be
genuinely generic, contain none of their data and nothing confidential to them,
and it must not be something they paid to have built for them exclusively. If
that distinction is ever uncomfortable, the answer is to leave it with the
client.

**Nothing is held back as leverage.** No dead-man switch, no licence key that
expires, no component we keep so the system stops without us. If a delivered
system would stop working when we do, it has been built wrong.

---

## 5. The continuity test

Run this before calling handover complete. It is a test, not a declaration, and
it is run **with** the client.

- [ ] **They run it without us.** One full cycle, on their own machines, with us
      watching and not touching. Not a demonstration by us.
- [ ] **Someone who was not on the project reads the runbook and follows it.**
      Their choice of person. Where they get stuck is the defect.
- [ ] **They change something small themselves**, using "how to change the common
      things". An email address, a threshold, a piece of wording.
- [ ] **A technical stranger could pick it up.** Ask honestly whether a competent
      contractor, given this folder and no phone call, could make a change. If
      the answer needs a caveat, write the caveat into the documentation.
- [ ] **Every n.abl access is removed, and shown to be removed.** Work down the
      credentials register, remove each one, and record the date in the register.
      Then have the client confirm from their side.
- [ ] **Every credential we knew has been rotated by them.**
- [ ] **Nothing runs on n.abl hardware, accounts or subscriptions.** If anything
      still does, it has not been handed over.
- [ ] **The pack is in their own storage**, not only in a link we control, and a
      copy is filed to their portal Documents tab.

**The one-year question.** Ask it out loud at the end: *if you came back to this
in a year, having forgotten all of it, would this folder be enough?* Whatever
they say next is the last correction the documentation needs.

---

## 6. What the client is told, in their words

Draft for the exit note. Not yet used with anyone.

> **What you now have**
>
> Everything we built for you is yours. That means the source code, the settings,
> the documentation, and the logins needed to run it and change it. It is all in
> the folder we have handed over, and there is a copy in your portal.
>
> **What we no longer have**
>
> We have removed our access to your systems. Every account we used has been
> closed or disabled, and you have changed anything we knew. If you find a login
> of ours still active anywhere, tell us and we will close it the same day.
>
> **What happens if you need us**
>
> There is no monthly fee and never was. If you want something changed, fixed or
> explained, buy a pack of n.abl credits and spend them when you actually need
> something. `[PLACEHOLDER: pack sizes, prices and expiry. Do not quote a figure
> until 12-pricing and 13-credits set them. Say "we will send you the options"
> rather than invent one.]`
>
> **What happens if we are not here**
>
> A fair question and one most people are too polite to ask. Nothing we have
> built depends on n.abl continuing to exist. It runs in your accounts, on your
> subscriptions, with your logins. The documentation is written so that any
> competent developer can pick it up. If we disappeared tomorrow, your system
> would keep running, and the folder you now hold is what you would give to
> whoever came next.

That last paragraph is worth saying even though it invites the thought. It is the
strongest available proof that the previous three paragraphs are true, and it is
the difference between a client who owns something and a client who has been told
they do.

---

## 7. The handover checklist

Copy this into the notes for the job.

```
BEFORE
[ ] Acceptance signed off by the client against the scope criteria
[ ] Defect period start date recorded
[ ] Credentials register complete, one row per credential

THE PACK
[ ] Source complete, secrets removed, environment template included
[ ] Third-party components and licences named
[ ] Credentials list, every account confirmed in the client's name
[ ] README, runbook, how-to-change, when-it-goes-wrong, architecture page
[ ] Known limitations written down, including what the system hands back to a person
[ ] Screen recordings, in their storage
[ ] Data export in open formats, with the schema
[ ] Exit note written

TRANSFER
[ ] Pack delivered into the client's own storage
[ ] Copy filed to their portal Documents tab
[ ] Client rotates every credential n.abl knew
[ ] Every n.abl access removed, register updated with removal dates
[ ] Client confirms from their side that our access is gone

CONFIRM
[ ] Ownership confirmed in writing on payment in full, and filed
[ ] Continuity test run with the client, failures written down and fixed
[ ] Project record set to complete, progress 100
[ ] Credit position recorded and confirmed to the client
[ ] After-state measured against the onboarding baseline, honestly
[ ] Internal labour recorded for 16-finance and 13-credits
[ ] Ask permission to name them as a client, in writing, either way
```

The last line is small and worth doing. `04-legal/service-agreement-notes.md`
§4.7 makes the point: there is no client work to point at yet, and the first
permission to name someone is worth having in writing at the moment they are
happiest.

---

## 8. Things that must not happen at handover

**1. Credentials withheld over an invoice.** Whatever the dispute, the pack goes
out. There are ordinary remedies for non-payment and this is not one of them.

**2. A pack that is only a zip of code.** Source without documentation fails the
continuity test and does not discharge deliverable 3.

**3. "We'll write the documentation up next week."** It will not happen, because
the next engagement will have started. The documentation is written during the
build and the training, which is why `project-runbook.md` puts training before
handover in the sequence.

**4. Anything still running on n.abl infrastructure.** Including a scheduled task
on somebody's own machine "just for now". Especially that.

**5. A quiet ongoing arrangement.** A monthly call, a standing check-in, a
nominal fee for peace of mind. Every one of those is a retainer, and there are no
retainers.

**6. Ending without asking what was worst.** Ask directly what the frustrating
part was. The answer improves this folder, and the first delivery is the only one
where every answer is new.
