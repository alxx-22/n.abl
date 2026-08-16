# 14 — Delivery

**Status: not started.**

No client has ever been delivered. The process in this folder has never been
run, not once, and nothing in it has survived contact with a real engagement.

There is no handover pack anywhere. No acceptance record, no credentials
register, no written training pattern that has been used with a room full of
people, and no example of a project whose progress reached a client's portal
without somebody being asked for it.

What does exist is every piece the process depends on: the team space that holds
client records, the portal that shows them, the welcome-pack generator, the
email templates, and a scope-of-work template that already names the handover
pack as a deliverable. The parts are built. The sequence that joins them into a
delivery is not.

This folder is the plan for delivering the first engagement.

Last substantive revision: 2026-08-16.

---

## The thing to notice first

**The promise is already public, and it is the load-bearing one.**

`src/pages/Home.jsx:48` is live on `nabl.agency` and reads:

> **03 Hand over.** It is yours, and it keeps working without us. Buy credits if
> you want us on hand, and spend them only when something actually needs doing.

`04-legal/scope-of-work-template.md:117` makes the handover pack deliverable 3
of every scope of work, and adds the line that matters:

> *Deliverable 3 is not optional and is never removed to reduce the price. The
> client owns what is built, and ownership without the source is a slogan.*

`04-legal/contract-checklist.md:178` says why, in one sentence: **ownership is
what makes the absence of a retainer credible.**

That is the whole argument for taking handover seriously. n.abl sells no
retainers. It sells implementations and then credits. A client only accepts that
shape if leaving is genuinely possible, and leaving is only possible if they hold
the source, the credentials and enough documentation to change the thing without
us. A thin handover turns credits into a retainer with extra steps, because the
client is buying access to the only people who understand their own system.

So handover is a deliverable with a specification, not a tidy-up at the end of a
job. This folder writes that specification before there is a client to test it
on, because the alternative is inventing it in a hurry during the first one.

---

## What this step is

Everything between `Won` in the CRM pipeline and the client running the thing
without us.

`07-crm/pipeline-stages.md:28` hands over at stage 9: *"Signed. Becomes a
client, and the work moves to `14-delivery`."* This folder picks it up there and
carries it through four phases.

| Phase | What happens | File |
|---|---|---|
| **Onboarding** | Paperwork signed, access granted, baseline measured, client record and portal populated, kickoff run | `onboarding-checklist.md` |
| **Build** | Audit the process as it really runs, build inside the stack the client already has, keep the portal current, control changes | `project-runbook.md` |
| **Train** | Teach the people who will use it, and write the thing down so it survives them | `project-runbook.md` §7 |
| **Handover** | Source, credentials, documentation, data export, our access removed, ownership confirmed in writing | `handover.md` |

**This step is not:**

- the mechanical runbook for the team space software, which is
  `business/06-team-space/adding-a-client.md` and covers the eight stages of
  creating a client record, testing the key and building the welcome pack. This
  folder wraps the engagement around it and points at it rather than repeating
  it
- the welcome pack generator itself (`09-welcome-pack`)
- the contract and scope wording (`04-legal`), which is where ownership,
  acceptance and the defect period are actually agreed
- how the price was arrived at (`12-pricing`)
- the credit ledger the client draws on afterwards (`13-credits`)
- the internal routing of the work between Class 1, 2 and 3 (`15-compute`),
  though the runbook applies it

---

## What "done" looks like

Sixteen statements. **None of them are true today.**

- [ ] A written onboarding sequence exists that starts at `Won` and ends at a
      kickoff call, and it has been run end to end at least once.
- [ ] Every engagement starts with a **baseline measurement** of the current
      process: hours, frequency, loaded cost, error rate where there is one.
      Written down, agreed with the client, and the same numbers used in
      `12-pricing`.
- [ ] Every credential the client grants is recorded in a register at the moment
      it is granted, with what it is for and how it will be removed at the end.
- [ ] Access is always in the **client's own accounts**, in named logins, never
      shared ones, and never an account n.abl owns and bills for.
- [ ] The client's project record shows a progress figure and a next milestone
      that were both true this week, and neither has gone stale for longer than
      a week.
- [ ] A cadence is defined and kept: what the client sees in the portal, how
      often, and who is responsible for putting it there.
- [ ] Changes to scope go through a written change agreement before the work
      happens, every time, with the effect on price and dates stated.
- [ ] Acceptance is run by the client against the criteria in the scope of work,
      and the result is filed as a document against their record.
- [ ] A **training pattern** exists as a repeatable shape rather than an
      improvised session, and it has been used once.
- [ ] Every build ends with a written runbook the client's own people can follow
      without us, included in the price rather than sold separately.
- [ ] A handover pack specification exists, and a real pack has been assembled
      against it and handed over.
- [ ] The handover pack has been tested by the **continuity question**: could
      this client keep running, and change, what we built if n.abl stopped
      existing tomorrow? Tested, not asserted.
- [ ] Ownership is confirmed to the client in writing on payment in full, and
      the confirmation is filed.
- [ ] n.abl's own access to the client's systems is removed at handover, on a
      stated timescale, and the removal is recorded.
- [ ] The defect period has a length, it is the same length in every document,
      and its start date is recorded per engagement.
- [ ] The whole sequence has been run for one real client, and this folder has
      been rewritten afterwards to match what actually happened.

---

## Honest status, in one paragraph

Not started. There are no clients, so nothing in this folder has been tested and
none of it can be described as working. Several things it depends on are also
open: there is no signed service agreement template (`04-legal` has it as *not
drafted*), the defect period has no agreed length, credit pack sizes and prices
are deliberately `[PLACEHOLDER]` until three real quotes exist, and the client
portal's own schema is not yet in version control, which means the system that
shows a client their progress cannot currently be rebuilt from source. The
handover pack has been named as a deliverable in the scope-of-work template and
promised on the public website, and it does not exist as a template, a checklist
or a single example. Nothing in this folder has been reviewed by a solicitor.
The files here are a specification written in advance, so that the first
delivery is a matter of following a sequence rather than designing one while a
client waits.

---

## Next actions, in order

Items 1 to 4 can be done this week and need no client. Items 5 onward need a
real engagement, and the order matters.

1. **Write the handover pack template.** A folder structure and a contents list,
   with a `README` shape the client's next technical person would actually read.
   `handover.md` §3 specifies it. This is the single highest-value item in the
   folder, because it is promised in public and in the paperwork and does not
   exist.
2. **Settle the defect period length.** `04-legal` lists it as an open decision
   blocking the scope-of-work acceptance section, and it appears in this folder
   too. Pick a number, put it in both places, stop rediscovering the question.
3. **Build the credentials register.** Decide where it lives before the first
   credential arrives. The team space documents tab against the client record is
   the obvious answer, because the buckets are private and served through
   short-lived signed links, and a spreadsheet on a laptop is not.
4. **Write the training pattern down properly** and prepare one reusable
   session. `project-runbook.md` §7 sets out the shape. Preparation is Class 3
   work and delivery costs a room and a person, so the material is the asset.
5. **Run the onboarding checklist on the first client**, exactly as written,
   with a stopwatch on the parts that annoy you. Do not improve it while running
   it. Note what was wrong and fix it afterwards.
6. **Take the baseline measurement before touching anything.** Once the process
   changes, the old numbers cannot be recovered, and without them the price in
   `12-pricing` is unverifiable and the case study can never be written.
7. **Keep the portal current for the whole of the first build**, deliberately, as
   an experiment. Count how many times the client asks for a status update. That
   count is the measure of whether the portal is doing its job.
8. **Assemble and hand over the first handover pack**, then sit with the client
   while they open it. Watch which part they cannot follow. That part is the
   specification's real weakness.
9. **Run the continuity test on it.** `handover.md` §5. Do it honestly, with the
   client, and write down what fails.
10. **Record the actual labour on the whole engagement.** Master plan section 3A
    requires it internally, `13-credits` is blocked on three of them, and
    `16-finance` needs the same figures. Delivery is where they are generated.
11. **Rewrite this folder against what happened.** Every file here is a guess
    until the first delivery. Come back and make it a record.

---

## What each file in this folder is for

| File | What it is for | Read it when |
|---|---|---|
| `README.md` | This file. What the step is, what done means, the honest status, what to do next. | Opening the folder cold |
| [`onboarding-checklist.md`](onboarding-checklist.md) | From `Won` to kickoff: what must be signed before anything starts, how access is granted and recorded, the baseline measurement, populating the client record and portal, and the kickoff call itself. Includes the copy-and-paste checklist. | A quote has been accepted and the work is about to start |
| [`project-runbook.md`](project-runbook.md) | How the work runs: the process audit, building inside the client's existing stack, how progress reaches the portal so the client never has to ask, change control, the compute routing, the training pattern, and acceptance. | You are mid-build, or you are about to start one |
| [`handover.md`](handover.md) | The handover pack: what is in it, how credentials are transferred and rotated, the data export, the removal of our access, ownership confirmation, the continuity test, and what the client is told about what happens if n.abl disappears. | An engagement is ending, by completion or otherwise |

---

## Things in here that must not be got wrong

**1. Handover is a deliverable, not an afterthought.** It is deliverable 3 in
every scope of work, it is priced into the job, and it is never dropped to bring
a quote down. A client who cannot run what they own has not been given it.

**2. The client owns it, and ownership includes the credentials.** Source,
configuration, and the logins needed to run and change the thing without us.
Ownership transfers on payment in full, per `scope-of-work-template.md` §11.

**3. Everything runs in the client's own accounts.** Platform subscriptions, API
usage and licences are theirs, in their name, paid by them. n.abl does not resell
them and does not hold the account. `04-legal/service-agreement-notes.md` §4.5
gives both reasons: it keeps our fixed cost base at the £36 a month the master
plan protects, and it means a client can leave without a hostage situation over
an account we own.

**4. No retainer sneaks in through the back door.** Not a monthly check-in, not
a "small ongoing fee to keep an eye on it", not included hours. Support is
credits, bought when needed. If delivery ends with the client dependent on a
standing arrangement, the model has broken.

**5. The portal never writes, so the update is always a team-space action.**
A client cannot approve, comment or change a milestone. `05-portal` rule 4 holds
here. If the delivery process ever needs a client to input something, it happens
by email or on a call, and a person records it.

**6. There is no draft state in the team space.** Everything saved on the
quotes, projects, meetings and documents tabs is visible in the client's portal
immediately. Write every field as though the client is reading it, because they
are.

**7. A progress bar that is wrong is worse than no progress bar.** The figure is
a promise made on your behalf to somebody who is paying. Move it when the answer
changes, including downwards.

**8. Training is part of delivery, not an upsell.** Handover documentation is
included in every build. A separate training session on the client's own
software is a paid engagement in its own right, and afterwards it is bought with
Educate credits. Both are true and the distinction has to be clear in the scope.

**9. Estimates of saving are the client's own numbers, not a warranty.** The
baseline is measured with them and agreed with them, and the scope says plainly
that projections are illustrative. Never let a delivery document turn a
projection into a guarantee.

**10. We build the system, we do not supply the advice inside it.** No legal,
medical or financial advice, at any point in delivery or training.
