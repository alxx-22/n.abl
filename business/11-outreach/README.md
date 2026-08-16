# 11 — Outreach

> **This folder is internal growth infrastructure. It is not a service.**
>
> Everything here sends n.abl's *own* approaches to businesses on n.abl's own
> shortlist. None of it is sold. Outbound sending, sequencing, reply handling and
> AI SDR systems are **not** customer-facing services, for the reasons in
> `01-positioning/README.md`: no deliverability record, no volume, no proof. The
> compliance machinery described here exists because n.abl must obey it, not
> because it is a product.
>
> If a client asks for outbound sending as part of a build, that is a scope
> question governed by `01-positioning/service-categories.md`, and the compliance
> rules in the master plan §5 apply to their system exactly as they apply to ours.

```
Status:       not started
Owner:        Alex
Next review:  when v3 produces shortlists that are consistently worth reading
Evidence:     none. Nothing in this folder has been built
```

There is no outreach engine. No sender, no scheduler, no reply classifier, no
suppression endpoint, no sending domain, no provider account. Nothing in this
folder describes something that runs.

What exists is one manual path, built long before this plan: the CRM's outreach
tab composes a draft, a human approves it, and approval unlocks a `mailto:`
handoff into the operator's own mail client. That is a person sending an email
with help from a form. It is not v4 and it should not be mistaken for a first
version of v4.

This folder is the plan for building v4. Everything in it is a specification.

Last substantive revision: 2026-08-16.

---

## The two blocks

Neither of these is stylistic. Both are hard.

**1. `07-crm` has no compliance fields.** No `subscriber_type`, no
`lawful_basis`, no `source`, no `source_date`, no `privacy_notice_status`, no
`marketing_status`, no `opt_out`, no suppression table, no `contact_history`. A
sender cannot hard-block an opted-out record when there is no column recording
that anyone opted out. Until that migration is written and applied, the correct
number of automated sends is zero.

**2. `10-lead-sourcing` has not started.** v4 sends what v3 produces. Building
the sender first produces exactly the liability the master plan describes: a
machine that can send 10,000 bad emails. The master plan puts v4 after v3 for
this reason and section 6 says so plainly.

There is a third condition that is softer but real: `[Unsubscribe Link]` is a
dead placeholder in thirteen places across the six templates in `08-email-pack`,
because there is no list provider and nothing for it to point at.

---

## What this step is

The part of the pipeline that starts once a human has looked at a shortlist and
ends once a human is reading a reply.

```
find → research → score → shortlist          ← 10-lead-sourcing (v3)
     → HUMAN inspects
     → HUMAN approves                        ← gate 1, this folder
     → Claude personalises                   ← this folder
     → HUMAN approves                        ← gate 2, this folder
     → send                                  ← this folder
     → deterministic follow-up timer         ← this folder
     → classify replies locally              ← this folder
     → escalate to a human                   ← this folder
```

Two approval gates. Both human. Both before anything leaves the building.

The compute classes are already decided and they are not negotiable at build
time:

| Stage | Class | Cost |
|---|---|---|
| Personalising copy | 3 — Claude | Part of the £36/month |
| Follow-up timer | 1 — ordinary code | £0 |
| Bounce and auto-reply detection | 1 — header parsing | £0 |
| Reply classification | 2 — local model | £0 in fees |
| Deciding what to do about a reply | Human | Time |

**This step is not** finding or scoring leads (`10-lead-sourcing`), the
compliance schema itself (`07-crm`), the templates (`08-email-pack`), or the
proposal that follows a positive reply (`12-pricing`). It is the gated,
rate-limited, auditable path between a shortlist and a person.

---

## What "done" looks like

Fifteen statements. **None of them are true today.**

- [ ] A batch of shortlisted leads can be presented for gate 1, one at a time,
      with the research that produced them visible on the same screen.
- [ ] Gate 1 approval is recorded per lead with who approved it and when. There
      is no approve-all control and there never will be.
- [ ] A lead cannot pass gate 1 unless `subscriber_type`, `lawful_basis`,
      `source`, `source_date` and `privacy_notice_status` are all populated.
      Enforced in the database, not the interface.
- [ ] Claude personalises the copy from the research record, and every claim it
      makes about the business is traceable to a stored source field.
- [ ] Gate 2 approval binds to the exact bytes of subject, body and recipient
      address. Editing any of the three lapses the approval.
- [ ] The send path calls one gate function that verifies both approvals, the
      marketing status, the suppression list and the volume ceiling, and raises
      an exception when any of them fails. It fails closed.
- [ ] The suppression list is checked on the normalised address, inside the send
      transaction, and cannot be bypassed by the service role.
- [ ] Every message carries n.abl's identity and a working one-click opt-out
      that writes to the suppression list.
- [ ] Every send writes an append-only `contact_history` row before the message
      is handed to the provider, and the write and the send cannot get out of
      step.
- [ ] The follow-up timer is a plain scheduler with no model anywhere near it.
      It respects business days, a maximum of two follow-ups, and stops on
      reply, opt-out, bounce or manual stop.
- [ ] Bounces and auto-replies are detected from headers by ordinary code, and
      a hard bounce suppresses the address automatically.
- [ ] Replies are classified by a local model, and the classification only ever
      routes a message to a human. It never sends, never suppresses on its own
      judgement alone, and never closes a thread.
- [ ] Anything that looks like an opt-out is treated as an opt-out immediately
      and also escalated. False positives are free; false negatives are not.
- [ ] Daily and per-hour volume ceilings are enforced in the database and cannot
      be raised by editing a config file in a hurry.
- [ ] Outreach sends from a domain that is not the domain client mail arrives
      on, and that domain has SPF, DKIM and DMARC in place and a warm-up record
      behind it.

One thing is true today, and it is true by absence rather than by design:
nothing sends automatically, because there is nothing that can send. That is a
starting position, not an achievement.

---

## Honest status, in one paragraph

Not started. No code has been written for any stage of this pipeline. No
sending provider has been chosen, no account opened, no outreach domain
registered, and the DNS state of `nabl.agency` for mail purposes has not been
checked as part of this work — treat it as unknown until someone looks. The
`sales_email_drafts` table has had `sent_at` and `send_provider` columns since
the original migration in June and both have always been null, because nothing
has ever written to them. The approval behaviour in `src/pages/Crm.jsx` is a
useful precedent for how gate 2 should feel and is not an implementation of it,
because it is enforced in a React component and a React component is not a
control. The two blocks at the top of this file are the real bottleneck, and
neither of them is work that belongs to this folder.

---

## Next actions, in order

Items 1 to 3 are not in this folder. They are listed because starting here
without them is the mistake this whole step is arranged to prevent.

1. **Finish `07-crm`.** The compliance migration, applied, with the suppression
   trigger and the gate function. Follow that folder's own list. Nothing below
   item 4 can begin until this is done.
2. **Start and finish `10-lead-sourcing`.** v4 needs shortlists that are
   consistently worth reading. If the shortlist is poor, gate 1 becomes a
   rejection queue and the whole pipeline is pointless.
3. **Make `[Unsubscribe Link]` resolve.** A real endpoint that writes to the
   suppression list and returns a plain confirmation page. Small piece of work,
   blocks everything, and belongs with the suppression table in `07-crm`.
4. **Read the three files in this folder end to end** before writing any code.
   `approval-gates.md` first, because it constrains the design of everything
   else. About an hour for all three.
5. **Decide the sending domain.** A separate domain for cold outreach, kept off
   `nabl.agency`, so that a reputation problem cannot stop a client's proposal
   arriving. Register it, point MX at a real inbox, and record the choice in
   `deliverability.md` section 2. Cost: [PLACEHOLDER — domain registration,
   annual].
6. **Choose a sending provider** and open the account. The master plan puts
   sending infrastructure fourth in the order of first earnings and says "not
   before v4 exists", so this is the point at which it becomes justifiable.
   Provider and price: [PLACEHOLDER — compare on DKIM key length, one-click
   opt-out header support, bounce webhooks and per-message cost].
7. **Publish SPF, DKIM and DMARC** on the outreach domain, DMARC at `p=none`
   with reporting on, and leave it there for at least four weeks while reading
   the reports. `deliverability.md` section 3.
8. **Run the warm-up** to the schedule in `deliverability.md` section 4, using
   real one-to-one mail, before a single shortlisted lead is contacted.
9. **Build the queue and the two gates**, in that order, with no sending code
   attached. A gate that has nothing to release is the safest thing to test.
10. **Build the sender** against the gate function from `07-crm`. Write the
    `contact_history` row first, then hand the message to the provider, then
    record the provider's message ID. `sequence-design.md` section 6 covers what
    happens when that sequence is interrupted.
11. **Build the follow-up timer.** Class 1. One table, one scheduled job, no
    model. `sequence-design.md` section 7.
12. **Build the reply intake**, header parsing first (Class 1), classification
    second (Class 2). The classifier is the last thing built, not the first,
    because everything upstream of it has to be safe before there is anything to
    classify.
13. **Send the first batch of five.** Read every one of the five before and
    after. Do not raise the ceiling until at least twenty have gone out without
    a surprise.

---

## What each file in this folder is for

| File | What it is for | Read it when |
|---|---|---|
| `README.md` | This file. What the step is, what done means, honest status, what to do next. | Opening the folder cold |
| [`approval-gates.md`](approval-gates.md) | The two human gates: what each one is actually checking, how approval is bound and recorded, what lapses it, how the send path verifies it, and the patterns that quietly turn a gate into a rubber stamp. | Before designing anything else in this folder, and before anyone proposes a bulk-approve button |
| [`sequence-design.md`](sequence-design.md) | The pipeline as a state machine: queue tables, stage transitions, the follow-up timer, bounce and auto-reply handling, the local reply classifier and its categories, escalation, idempotency and what happens after a crash. | Building the queue, the sender, the timer or the classifier |
| [`deliverability.md`](deliverability.md) | Sending domain choice, SPF, DKIM and DMARC, the warm-up schedule, volume ceilings and pacing, complaint and bounce thresholds, and why a burnt domain does not come back cheaply. | Before the first send, and every time someone wants to raise the daily limit |

---

## Things in here that must not be got wrong

**1. Both gates are human and both are before sending.** Not one before and one
after. Not a human sampling every tenth message. Two gates, both operated by a
person, both upstream of the provider. Anyone proposing to move a gate
downstream to increase throughput has misunderstood what the gate is for.

**2. The human gate is the volume ceiling, and that is a feature.** One person
can properly read perhaps 20 to 40 personalised messages in a sitting. That
number is also, by coincidence, a sane cold-sending rate for a warmed domain.
The constraint and the safe limit agree with each other. Do not engineer around
either.

**3. Approval belongs to exact text, not to a lead.** The CRM already gets this
right in `src/pages/Crm.jsx`: approval lapses the moment the body is edited. The
server-side version must do the same, by hashing subject, body and recipient
together, or approval means nothing.

**4. Claude personalises, and Claude will confidently invent.** Gate 2's main
job is factual verification, not tone. A sentence about the business that is
wrong is worse than no sentence at all, because it proves nobody looked.

**5. Reply classification never acts.** It routes. A local model deciding that a
reply is "not interested" and closing the thread is the classifier making a
commercial decision on hardware that cost nothing. Every classification ends at
a person.

**6. Suspected opt-outs are treated as opt-outs.** Immediately, before anyone
reads the message, and the escalation happens anyway. Suppressing someone who
did not ask costs one lead. Failing to suppress someone who did is a
regulatory failure and it is also just rude.

**7. Nothing in this folder has been reviewed by a solicitor or by the ICO.**
It is a careful reading of published guidance by the people building the system.
The same rule as `04-legal` and `07-crm` applies: never say, write or imply
otherwise.
