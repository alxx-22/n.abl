# Onboarding — from `Won` to kickoff

**Nothing in this document has been run with a real client.** It is written in
advance so the first one is a sequence to follow rather than a design exercise
carried out while somebody waits. Expect to rewrite it afterwards.

The scope is narrow and worth stating. This is the **engagement** wrapper. The
**software** steps, creating the client record, generating and testing the access
key, building the welcome pack, all live in
`business/06-team-space/adding-a-client.md`, which is already written, already
accurate, and is not repeated here. Where this document says "run stages 1 to 8",
that is the file it means.

**Target elapsed time:** signature to kickoff call inside five working days. Not
because speed impresses anyone, but because access requests and account
permissions are the slowest part of every small-business engagement, and the gap
between "yes" and "something is happening" is where doubt grows.

---

## 1. Stage 0 — before anything is created

Six things must be true. If any is not, stop. Creating a client record mints a
live credential pointing at real data, and a half-onboarded client is the worst
state to be in.

- [ ] **The quote is accepted in writing.** Email is fine. A verbal yes on a call
      is not, and "we're going ahead" without a figure attached is not.
- [ ] **A scope of work is signed**, built from
      `04-legal/scope-of-work-template.md`. Sections 2 and 3, what we will build
      and what we will not, are the two that prevent every argument this
      engagement could have.
- [ ] **Terms are in force.** Ideally a signed service agreement. There is no
      drafted service agreement today: `04-legal/contract-checklist.md` lists it
      as *not drafted*, and until it exists the website terms are the fallback
      for anyone with no signed agreement. Know which of the two you are relying
      on before starting, and say so in the file note. **No legal document here
      has been reviewed by a solicitor.**
- [ ] **The deposit position is clear.** Whether there is one, and whether it has
      arrived. The percentage is an open decision in `04-legal` and has to be
      settled before the first quote, not during it.
- [ ] **You know who owns the decision.** One named person who can say yes to a
      change without a committee. Master plan section 2 treats this as part of
      the ideal client profile, and its absence is the most common way a small
      job becomes a long one.
- [ ] **You know who will actually use the thing.** By name. Not the person who
      bought it. This matters for training and it matters for the audit, because
      the buyer's description of the process and the user's description of it are
      rarely the same document.

---

## 2. Stage 1 — the paperwork, filed

Everything signed goes into the team space, Documents tab, against the client
record, `document_type` = `contract`. The buckets are private and served through
short-lived signed links. A folder on a laptop is not a filing system.

`04-legal/contract-checklist.md` §7 is the authority on what is kept. The
delivery-relevant subset:

| Record | Where it goes |
|---|---|
| Signed scope of work | Documents, `contract` |
| Signed service agreement, when one exists | Documents, `contract` |
| Accepted quote | Quotes tab, status `accepted`, PDF attached |
| NDA, if one was signed | Documents, `contract` |

The client sees documents in their portal as soon as the row is saved. That is
correct and intended. They should have their own copy of what they signed
without asking for it.

---

## 3. Stage 2 — the baseline measurement

**Do this before anything is touched.** Once the process changes, the old numbers
are gone and cannot be reconstructed honestly.

This is the most skipped step in the whole folder and the most expensive to skip.
Three separate things depend on it:

1. **The price.** Efficiency solutions are priced as a fraction of first-year
   value under master plan section 3A. The value is the baseline minus the
   expected cost afterwards. Without a baseline the price has no derivation.
2. **The proof.** n.abl has no case studies and no testimonials, and
   `03-website` names that as its remaining gap. The first real before-and-after
   figure is the most valuable thing the first engagement produces, and it can
   only be captured now.
3. **The internal cost model.** `16-finance` and `13-credits` both need real
   delivered work to price against.

Record, in the client's own words and the client's own numbers:

| What | Example |
|---|---|
| The task, as they describe it | "Building the Monday reporting pack" |
| Who does it | Named person, and who covers when they are away |
| How often | Weekly |
| How long each time | 3 hours |
| Loaded hourly cost | £`[PLACEHOLDER: the client's figure, not ours]` |
| Monthly cost | Hours × frequency × rate |
| Error rate, if there is one | "About one in ten needs redoing" |
| What errors cost | Only if they can put a number on it |
| What they expect afterwards | Their guess, recorded before ours |

Then the arithmetic from the master plan, done in front of them:

> A task takes 12 hours a month. At a £20/hour loaded cost, that is £240 a month.
> After implementation it takes 2 hours a month, so £40 a month. That is £200 a
> month saved, or £2,400 a year.

Two rules on this section. **Use their numbers, not yours** — an estimate you
supplied and they nodded at is not a baseline. And **say plainly that the
projection is illustrative**, in the same document that contains it. The scope of
work already carries that wording in section 12 and delivery must not quietly
upgrade it into a promise.

For a capability solution, where there is nothing being replaced, there is no
baseline to take. Record instead what the client currently does without the
thing, and what "working" will look like, because that becomes the acceptance
criteria.

---

## 4. Stage 3 — access, in their accounts, recorded

The rule from `04-legal/service-agreement-notes.md` §4.5, applied on the ground:

**Everything runs in the client's own accounts, in the client's name, paid for by
the client.** n.abl does not hold the account, does not resell the subscription,
and does not become the billing contact. Two reasons, both practical: it keeps
the n.abl fixed cost base at £36 a month, and it means the client can end the
relationship without a hostage situation over an account we own.

**Named logins, never shared ones.** A `info@` login that three people already
use tells you nothing about who did what, cannot be revoked without disrupting
the client, and makes handover impossible to evidence. Ask for a user created for
n.abl, with the least privilege that lets the work happen.

Every credential is written into the **credentials register** at the moment it is
granted, not at the end. The register is the source for the handover pack and for
the removal of access, and both are impossible to do properly from memory.

| Field | Why it is there |
|---|---|
| System | What it gives access to |
| Account holder | The client, always. If this ever says n.abl, something is wrong |
| Login used | Named user, e.g. `nabl@theirdomain.co.uk` |
| Permission level | The least that works |
| Granted on | Date |
| Granted by | Which of their people authorised it |
| Purpose | One line, so a stranger can judge whether it is still needed |
| Removal method | How it will be revoked at handover, written now while it is obvious |
| Removed on | Filled at handover |

Where the register lives is an open decision: see `README.md` next action 3. Until
it is settled, keep it as a document against the client record in the team space,
not in a personal file.

**Never accept a password in an email or a chat message.** Ask for the account to
be created and the invitation sent to a named n.abl address, or for the
credential to be shared through the client's own password manager. If neither is
possible and something arrives in plain text anyway, change it at first use and
note that you did.

---

## 5. Stage 4 — create the client record and get the key out

Run `business/06-team-space/adding-a-client.md`, stages 1 to 8, in one sitting.
In summary, and only so you know what you are committing to:

1. Client record created, business name exactly as they write it, key generated
   with the **Generate** button after the name is typed.
2. Key tested in a private window against `nabl.agency/portal` before it is sent.
3. Quote record created, PDF attached, status set.
4. Project record created. See the fields section below, because this one has
   delivery consequences.
5. Kickoff meeting scheduled with a join link.
6. Welcome pack built, goals written from the discovery notes.
7. Saved to the portal, then emailed using `nabl-emails/email-welcome.html` from
   `08-email-pack`. **Nothing in the team space sends email.** Sending is a
   person's job.
8. Verified from the client's side: business name, quote, project, meeting,
   welcome pack, all visible.

Two things worth repeating because they bite:

- **There is no draft state.** Everything saved is visible in their portal
  immediately.
- **Do not press Generate again on an existing client** unless you intend to lock
  them out.

**The project record, filled for delivery:**

| Field | What to put | Delivery note |
|---|---|---|
| Title | The outcome, not the technology | "Weekly reporting pack", never "Python ETL" |
| Description | Two or three sentences the client would recognise as their own problem | Lift the wording from the baseline in stage 2 |
| Status | `active` | |
| Progress | `0` | Honest from the first day sets the tone for every later figure |
| Next milestone | The next thing that will visibly happen to them | Not an internal task |
| Next milestone date | A date you will meet | Move it early and tell them, rather than let it pass |

---

## 6. Stage 5 — the kickoff call

Thirty to forty-five minutes. The purpose is not to restate the scope. It is to
make the next four weeks predictable and to meet the people who will use the
thing.

**Agenda:**

1. **Confirm the outcome in one sentence**, in their words, and check they agree
   with it. If the sentence you say back is not the sentence they would have
   said, stop and fix it here.
2. **Walk the process as it actually runs.** Not the version in the scope. See
   `project-runbook.md` §2, the audit. Book this separately if it needs longer
   than twenty minutes, and it usually does.
3. **Agree the update rhythm.** What appears in the portal, how often, and what
   arrives by email. `project-runbook.md` §4. Say the sentence plainly: *you will
   not have to ask us where we are up to.*
4. **Show them the portal**, briefly, with their own data in it. They have the
   key from the welcome pack. Sign in with them once so the first time is not
   alone.
5. **Name the people for training now**, not at the end. Who is coming, and does
   their manager know they will be released for it. `01-positioning` treats
   "nobody will be released to attend" as a disqualifying signal for training
   work, and it applies to training inside a build too.
6. **State what happens to changes.** Anything not in the scope gets a written
   change agreement with the price and date effect before the work happens.
   Saying this while everyone is friendly is much easier than saying it later.
7. **State what handover will contain**, at a high level: source, credentials,
   documentation, a data export, and the removal of our access. It costs a
   sentence and it is the thing that makes the absence of a retainer believable.

Afterwards, set the meeting status to `completed` and update the project's next
milestone to whatever you agreed on the call. That single edit is the first
evidence to the client that the portal is maintained rather than decorative.

---

## 7. The whole thing as a checklist

Copy this into the notes for the job.

```
BEFORE ANYTHING
[ ] Quote accepted in writing
[ ] Scope of work signed, sections 2 and 3 complete
[ ] Terms in force, and you know which document you are relying on
[ ] Deposit position clear
[ ] Decision-maker named
[ ] End users named

PAPERWORK
[ ] Signed documents filed in team space, document_type = contract
[ ] Quote record set to accepted, PDF attached

BASELINE  (before touching anything)
[ ] Task, owner, frequency, duration, loaded rate recorded in their numbers
[ ] Monthly and annual cost calculated in front of them
[ ] Expected after-state recorded
[ ] Illustrative-not-guaranteed stated in writing

ACCESS
[ ] Every account in the client's name, paid by the client
[ ] Named logins, least privilege, no shared inboxes
[ ] Credentials register started, one row per credential, removal method written
[ ] No password accepted in plain text; anything that arrived that way changed

TEAM SPACE  (06-team-space/adding-a-client.md, stages 1-8)
[ ] Client record created, key generated after the business name was typed
[ ] Key tested in a private window
[ ] Quote, project, kickoff meeting created
[ ] Project title is the outcome, progress 0, next milestone dated
[ ] Welcome pack built and saved to the portal
[ ] Welcome email sent from the template, key in the body
[ ] Verified from the client's side

KICKOFF
[ ] Outcome confirmed in one sentence, in their words
[ ] Process walked, or a separate audit session booked
[ ] Update rhythm agreed and stated
[ ] Portal shown, signed into together once
[ ] Training attendees named
[ ] Change process stated
[ ] Handover contents stated
[ ] Meeting marked completed, next milestone updated
```

---

## 8. What goes wrong, and what it means

| What happened | What it means | What to do |
|---|---|---|
| Access has not arrived after a week | The most common cause of a late project, and it is usually one person who has not been asked properly | Escalate to the named decision-maker, and record the delay against the assumptions in the scope. The scope already says price and dates assume timely access |
| They want to give you a shared `info@` login | They do not have per-user accounts, or nobody wants to create one | Explain that it makes handover unevidenced and revocation disruptive. If they insist, record it in the register and in the risks |
| The account would have to be in n.abl's name | A platform that will not sell to them directly, or a shortcut being offered | Refuse the shortcut. Master plan and `04-legal` §4.5 both forbid it. If genuinely impossible, it is a scope decision made in writing, not a delivery convenience |
| They cannot give a baseline number | Either nobody has measured, or the process is more varied than described | Measure it with them for one cycle before pricing further work. A guess dressed as a baseline undermines the whole pricing method |
| The person who does the work disagrees with the person who bought it | Very common, and it is information, not a problem | Believe the person who does the work. Update the scope in writing if the difference is material |
| Somebody asks about a monthly fee | The retainer question, arriving early | The answer is credits: you do not pay us monthly to be on standby. Do not soften it |
| The welcome pack shows a key that does not work | The key was regenerated after the pack was built | Rebuild the pack, or send the current key from their row. `05-portal` has this as a known open item |
