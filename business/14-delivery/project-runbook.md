# Project runbook — how the work actually runs

From kickoff to acceptance. Onboarding is `onboarding-checklist.md`; handover is
`handover.md`.

**None of this has been run on a real engagement.** It is the intended shape,
written before the first client rather than after, and the first delivery should
be treated as a test of it.

Three commitments hold across everything below, and they are the ones a client
will notice:

1. We measure the process before we change it.
2. We build inside the tools they already run, not alongside them.
3. They never have to ask where we are up to.

---

## 1. The shape of a delivery

| Step | What it produces | Typical share of effort |
|---|---|---|
| **Audit** | A written description of the process as it really runs, and the measured baseline | 15% |
| **Design** | The smallest thing that removes the cost, and the list of what it will not do | 10% |
| **Build** | The working system, inside their stack | 45% |
| **Test with real data** | Proof it survives the client's actual mess | 15% |
| **Train** | People who can use it, and a runbook that outlives them | 10% |
| **Handover** | The pack, the credentials, the ownership confirmation | 5% |

The percentages are an expectation, not a rule, and they are stated for one
reason: **the audit and the training are not the parts to compress when the build
runs long.** Compressing them is how a technically correct system ends up unused
and undocumented, which is a failure the client pays for and we do not see.

---

## 2. The audit

The audit is the part clients do not expect and remember afterwards. It is also
where most of the value is decided, because the biggest saving is usually
something nobody asked us to look at.

**Do it by watching, not by asking.**

Sit with the person who does the work while they do it, once, at normal speed.
Screen share is fine. Ask them to narrate. Do not suggest improvements during it,
because the moment you do, they start performing the process rather than
demonstrating it.

What you are looking for, in order of how often it pays:

- **The step done twice.** The same figure typed into two systems, the same file
  saved in two places, a check somebody repeats because they do not trust the
  first one.
- **The step that exists because of an old constraint.** A report formatted for
  a person who left, a manual export from a system that has had an API for three
  years.
- **The step nobody can explain.** "We've always done that." Sometimes it is
  load-bearing, sometimes it has been dead for years, and you cannot tell which
  without asking a second person.
- **The waiting.** Time the process spends sitting in somebody's inbox is often
  larger than the time it spends being worked on, and it is invisible in an
  hours-based estimate.
- **The workaround.** Whatever they do when the normal route fails. It happens
  more often than they will admit, and if the new system does not handle it, they
  will keep the old process alive alongside it.
- **The exceptions.** Ask directly: how often is it not straightforward, and what
  happens then. A system that handles 80% and dumps the other 20% back on a
  person unannounced saves far less than it appears to.

**Write it up as a numbered sequence** with a time against each step, and send it
back to them. Two things come of that. They correct it, which is free accuracy.
And they frequently reply with something like "I hadn't realised it was that
many steps", which is the moment the price stops being an argument.

**Then check the baseline still holds.** The figures taken during onboarding were
the client's estimate. What you have just watched is the measurement. If they
differ materially, say so before building, and adjust the scope in writing if the
value has changed.

**Three honest outcomes of an audit, and all of them are acceptable:**

- The problem is what they said, and it is worth building. Proceed.
- The problem is smaller than they thought. Say so, quote less, keep the trust.
  A small honest job beats a large resented one.
- The problem is not a technology problem. The tool is right and nobody knows how
  to use it, which is category 5, *train your team*. Or the process is broken in
  a way software will only make faster. Say it plainly. Master plan section 2
  is explicit that automating a loss-making process makes the loss arrive faster.

---

## 3. Building inside the existing stack

**The default is: add nothing the client has to carry.**

The public promise at `src/pages/Home.jsx:47` is already specific about it:

> Price agreed before we start. Built inside the tools you already run. No new
> servers, no migration project, no new subscription to carry.

That is a design constraint on every build, not a marketing line. Applied:

| Prefer | Over |
|---|---|
| A script or scheduled job on hardware or a service they already have | A new server |
| The API of the system they already pay for | A replacement system |
| Their existing spreadsheet, done properly | A bespoke database |
| Their existing CRM's fields | A new CRM |
| A file drop in their existing storage | A new file service |
| A scheduled task with a plain timer | An orchestration platform |

**Every new dependency is a question you must be able to answer:** who pays for
it, whose account is it in, what happens when the card on it expires, and can the
client cancel it without breaking what we built. If any answer is uncomfortable,
find another way.

Where a new subscription is genuinely unavoidable, it goes in the client's own
account, in their name, paid by them, and it is named in the scope of work under
"where it runs" before it is bought. Never on an n.abl account, and never resold.

**Boring technology wins.** The client is going to own this. In eighteen months
the person maintaining it may be a local IT contractor or an in-house person with
moderate skills. A Python script with a clear name and a README will outlive
something clever, and outliving something clever is the entire point of the
handover.

### Compute routing while you build

Master plan section 4 applies to delivery directly. The discipline is knowing
which class of work a piece of the job is, and refusing to pay for a class above
it.

| Class | What it covers | In a delivery |
|---|---|---|
| **Class 1, no AI** | CSV work, deduplication, sorting, filtering, dates, scheduling, database operations, regular expressions, HTML extraction, PDF generation, API calls, CRM updates | The majority of most builds. Effectively £0 |
| **Class 2, local models** | Classification, basic extraction, sentiment, spam detection, simple summarisation, scoring, categorisation, embeddings, simple rewriting | On our own machines, £0 in fees |
| **Class 3, Claude** | Complex reasoning, architecture, difficult coding, high-quality copy, client-facing documents, ambiguous conversation | Part of the £36 a month, spent where intelligence is worth paying for |

Two things this folder must not get wrong.

**Claude Code running locally is not a local Claude model.** Claude Code is a
local interface and orchestration environment. The models are cloud-hosted.
Running the tool on your own machine does not move the model onto your machine.
The saving comes from routing, not from location. Anyone who says it the wrong
way round in front of a client will build the cost model wrong too.

**Using an expensive model to build the thing does not mean the thing needs an
expensive model to run.** Most of what we ship should cost the client effectively
nothing to operate, and that is a selling point rather than an accident. If a
delivered system would carry a running model bill, the client must know the
figure before they agree to it, it goes in their own account, and it belongs in
the scope of work.

---

## 4. How progress reaches the portal

The portal exists for one reason, stated in `05-portal/README.md`: **a client
should never have to ask where something is.** Delivery is where that promise is
either kept or quietly abandoned.

The mechanics are fixed by the software and there is no way around them:

- The portal is **read-only**. A client cannot comment, approve or change
  anything. Every update is a team-space action performed by a person.
- There is **no draft state**. What you save is visible to them at once.
- There is **no notification**. Saving a project update does not email anybody.
  If something needs to reach them today, a person sends an email.

### The cadence

| When | What | Where |
|---|---|---|
| Whenever the answer changes | Progress figure | Projects tab, `progress_percent` |
| Whenever the next visible thing changes | Next milestone and its date | Projects tab |
| At least weekly, same day each week | A progress update even if the figure has not moved | Projects tab, plus a short email if the reason it has not moved matters |
| When a meeting is agreed | The meeting with a join link | Meetings tab |
| Within a day of receiving or producing one | Any document the client should hold | Documents tab |
| At acceptance | Progress to 100, status `complete` | Projects tab |

**The weekly update is unconditional.** A week with no visible movement is
exactly the week a client starts to worry, and the update that says "still on the
supplier's file format, here is where that stands" is worth more than the one
that reports progress.

### Rules for the progress figure

1. **It is a promise, not a mood.** Somebody is paying against it.
2. **It moves down when the truth moves down.** A rediscovered problem that
   pushes progress from 70 back to 55, with one sentence in the milestone field
   explaining it, costs far less trust than a bar that sat at 65 for three weeks.
3. **It never reaches 100 before acceptance.** 100 means the client has run the
   acceptance criteria and agreed. Not "we think it is done".
4. **90 is not a resting place.** Everything sits at 90 forever in every project
   ever run. If it is at 90 for two weeks, either it is not at 90 or something is
   blocked, and the client should be told which.

### Milestones are written for them, not for us

`Next milestone` is the next thing that will visibly happen to the client, in
words they would use. "First version for you to try on Tuesday", not "finish
transform layer". If the next real event is internal, name the client-visible
consequence of it instead.

### The measure of whether this works

Count how many times the client asks for a status update during the first
engagement. Zero is the target. Every question is a defect in this section, and
the fix is almost always that something was true internally for several days
before anyone put it in the portal.

---

## 5. Change control

Anything not in section 2 of the scope of work is a change. Changes are normal
and welcome. Undocumented changes are the mechanism by which fixed-price work
becomes unprofitable and clients become unhappy at the same time.

**The rule: written agreement before the work happens, every time, including the
small ones.** The small ones especially, because they are the ones that accrete.

A change agreement is short. Four lines is enough:

```
Change:      One sentence on what is being added or altered
Reason:      Why it came up
Effect:      £X, or no charge, and the effect on the dates
Agreed:      Name, date, and the email or message where they said yes
```

File it in Documents against the client record. Update the project's next
milestone if dates moved.

**"While you're in there" is the phrase to listen for.** Sometimes the answer is
genuinely yes, it takes ten minutes, do it and say so. The judgement is whether it
changes the shape of the deliverable or only its detail. If in doubt, write the
four lines. It takes two minutes and settles an argument that would take an hour.

**Defects are not changes.** Something in the agreed scope that does not work is
ours to fix at no charge, during the build and during the defect period after
acceptance. Something that works as agreed but is now wanted differently is a
change. Confusing these two in either direction is expensive: one way we work for
free, the other way we invoice for our own mistake. The defect period length is
an open decision in `04-legal` and needs settling before the first acceptance.

---

## 6. Testing with the client's real data

Test with their actual data, including the ugly parts, before anyone calls it
finished.

- **Ask for a real extract, not a clean sample.** The clean sample is the version
  somebody tidied, and it hides exactly the cases that will break the system on
  the first Monday.
- **Run a full cycle in parallel.** Old process and new process, same period,
  compare the outputs. Discrepancies found here are cheap. Discrepancies found
  after the old process has been switched off are not.
- **Test the exceptions from the audit.** Every workaround they described. If the
  system cannot handle one, the runbook must say what a person does instead, and
  the client must be told before acceptance rather than discover it.
- **Watch someone else use it.** Not the person who has been on every call. The
  colleague who has heard nothing about it. What they get stuck on is what the
  training and the runbook have to cover.

Where the work touched personal data, the same care applies as anywhere else in
this business: real personal data is not copied onto our machines when a subset
or a redacted extract would do the job.

---

## 7. The training pattern

**Train your team** is one of the six categories in the master plan, and training
appears in delivery in two distinct forms. Keep them separate, in the scope and
in your head.

| Form | What it is | How it is paid for |
|---|---|---|
| **Handover training** | Teaching the client's people to use and maintain what we just built for them | Included in every build. Never a line item that can be cut |
| **Capability training** | Teaching them a tool they already pay for, independent of anything we built | A priced engagement in its own right, category 5, fixed price. Afterwards it is bought with **Educate** credits |

Both use the same five-part pattern below. It exists so training is a repeatable
shape rather than an improvised session that depends on who is delivering it.

### The pattern

**1. Before: know who is in the room, by name.**

Ask for the names and their roles a week ahead. Two questions decide whether the
session is worth running. *Does their manager know they will be released?* and
*will these people actually do this task?* `01-positioning` treats "nobody will
be released to attend" as a disqualifying signal, and a session delivered to
whoever happened to be free is money burned on both sides.

Cap it. Six to eight people for anything hands-on. Beyond that it stops being
training and becomes a presentation, and presentations do not change what anyone
does on Monday.

**2. Show the whole thing once, end to end, at normal speed.**

No pausing to explain. People need the shape before the detail, and a session
that starts with settings and buttons loses the room before it reaches the point.

**3. They do it, on their own machines, with their own data.**

This is the part that cannot be skipped and the part most often skipped for time.
Watching someone do something produces no capability whatsoever. Hands on
keyboards, real logins, real records. Sit on your hands while they struggle, and
resist taking the mouse.

**4. Teach-back.**

Each person explains one part of it to the others, in their own words. It takes
ten minutes and it is the only reliable test of whether the session worked.
Where somebody stumbles is precisely where the runbook needs to be better, so
write that down during the session rather than trusting memory.

**5. Leave something behind, always.**

A session with nothing written down is a session that expires when the attendees
leave. Three artefacts, and the first is not optional:

- **The runbook.** The procedure, numbered, in plain language, with the screens
  named as the client sees them. Written for the person who was not in the room.
  It goes in the handover pack and it is frequently the real deliverable.
- **A screen recording** of anything easier shown than written. Five minutes,
  unedited, with narration. Their file storage, not ours.
- **A one-page "when it goes wrong" card.** The three or four things that will
  actually happen, and what to do about each, ending with how to reach us and
  what it costs.

### Afterwards

**Follow up once, about a month later, unprompted.** One short email: are you
still doing it this way, what has been annoying, has anyone new joined who needs
showing. It costs ten minutes, it catches the drift back to the old process while
it is still reversible, and it is the most natural moment for a client to
recognise that they want a credit pack.

### Three things that make a training session fail

1. **The tool genuinely cannot do the job.** Training will not fix it. Establish
   this before selling a session, because a day that ends with "the software
   cannot actually do this" is a refund and a damaged reputation in a small town.
2. **It is really a performance problem.** Training booked as a formality before
   a difficult conversation about someone's work is not a technology engagement
   and should not be dressed as one.
3. **Nobody was released.** See part 1. Reschedule rather than deliver it badly.

---

## 8. Acceptance

Acceptance is the client running the criteria in section 2 of the scope of work
and saying, in writing, that it does what was agreed.

- [ ] The client runs the acceptance criteria themselves. Not a demonstration by
      us that they watch and nod at.
- [ ] The result is confirmed in writing and filed in Documents against their
      record.
- [ ] The defect period start date is recorded. Its length comes from the scope,
      once `04-legal` has settled it.
- [ ] The project record goes to progress 100 and status `complete`.
- [ ] The handover pack is delivered. `handover.md`. This is a deliverable of the
      job, not a follow-up, and the job is not finished without it.
- [ ] Final payment is invoiced per the payment schedule.
- [ ] Ownership is confirmed in writing on payment in full.
- [ ] The credit position is recorded and confirmed to the client, with every
      figure a `[PLACEHOLDER]` until `13-credits` sets them.
- [ ] The after-state is measured against the baseline from onboarding, and the
      real figure is written down whatever it says.
- [ ] Internal labour on the whole engagement is recorded, for `16-finance` and
      `13-credits`.

**Measure the after-state even when it is disappointing.** A saving smaller than
projected is information the pricing method needs, and the first honest
before-and-after is worth more to this business than a flattering one, because
`03-website` currently has no client proof of any kind and the first piece of it
must be true.
