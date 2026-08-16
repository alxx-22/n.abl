# 18 — The sales conversation

```
Status:       not started
Owner:        Alex
Next review:  after 10 qualified conversations
Evidence:     none yet. First entry will be notes from conversation #1
```

Nothing here has been tested on a real prospect, because there has not been one.
Every stage description below is a specification, not a record.

**Why this folder exists.** The website and the outreach documents each implied
a sales process without anyone writing one down. That works until two people are
selling, or until one person is tired, and then the conversation drifts back to
demonstrating expertise instead of understanding a problem — which is the exact
failure the whole positioning is built to avoid.

Last substantive revision: 2026-08-16.

---

## The philosophy, in one line

> **Listen before recommend. Curiosity first, expertise second.**

Not *"we know the answer"* but *"we know how to help you find the answer."*

The temptation in every one of these conversations is to solve it out loud in
the first ten minutes, because it is satisfying and because it demonstrates
competence. It costs the deal roughly as often as it wins it: a solution offered
before the problem is understood is a guess, the client can tell, and the
conversation becomes a negotiation about our guess instead of an exploration of
their problem.

**The customer never has to know what technology they need.** That is the
promise on the website and it is only true if the conversation makes it true.

---

## The pipeline

```
Lead
  → Qualification
    → Problem discovery
      → Exploration
        → Recommendation
          → Commercial fit
            → Proposal
              → Decision
                → Delivery
                  → Proof
                    → Referral
```

| # | Stage | What it is | What moves it on |
|---|---|---|---|
| 1 | **Lead** | A business exists and looks plausible. Sourced per `10-lead-sourcing` | Somebody makes contact, either way |
| 2 | **Qualification** | Do they fit the ICP, and is there a person who can say yes? | They fit and will talk, or they are declined |
| 3 | **Problem discovery** | The first real conversation. What is getting in the way? | They have described something concrete |
| 4 | **Exploration** | How the work actually happens today, and the systems around it | We understand it well enough to have a view |
| 5 | **Recommendation** | What we think would help, what it involves, what it should be worth | They understand the options and the arithmetic |
| 6 | **Commercial fit** | Does the value support a price both sides are happy with? | Both agree it is worth doing — or agree it is not |
| 7 | **Proposal** | Scope, price, timescale, in writing | It is sent |
| 8 | **Decision** | Theirs | Yes, no, or not now |
| 9 | **Delivery** | `14-delivery` owns this | Handover complete |
| 10 | **Proof** | `17-proof-and-case-studies` owns this | Baseline and outcome captured, permission recorded |
| 11 | **Referral** | The cheapest lead source there is | An introduction, or a decision not to ask |

**Stages 4 and 5 were originally drafted as "Economic diagnosis" and "Solution
diagnosis".** The work is unchanged — both the economic and the technical
assessment still happen, in those places. The names changed because "diagnosis"
carries the wrong implication about who is being examined, and a team that says
"exploration" internally says it fluently in front of a customer. Using one
vocabulary in both places is the whole point.

### How this maps to the CRM

`07-crm` runs ten stages of its own — `New Lead` through `Won` / `Lost` — which
describe the *record*, not the *conversation*. They are not the same list and
should not be forced into one. Roughly:

| This folder | CRM stage |
|---|---|
| Lead, Qualification | `New Lead`, `Researching`, `Ready To Contact` |
| Problem discovery | `Contacted`, `Replied`, `Meeting Scheduled` |
| Exploration, Recommendation, Commercial fit | `Meeting Scheduled` |
| Proposal | `Proposal Sent` |
| Decision | `Won` / `Lost` |
| Delivery, Proof, Referral | Beyond the CRM. `14-delivery`, `17-proof` |

---

## The four sentences

If the whole folder were lost, these would rebuild it. Each is a thing to
actually say.

**Discovery** — *"Tell us about the work that feels harder than it should."*

**Exploration** — *"We'll ask questions, understand what's happening today, and
look at the systems around it."*

**Recommendation** — *"Then we'll explain what we think would help, what it
would involve, and what it should be worth."*

**Build** — *"If we agree it's worthwhile, we'll build it at the agreed price."*

Note what the last one does: *if we agree* — a joint decision, not a verdict we
deliver. That phrasing is not decoration, it is the rule from
`02-brand/brand-promise.md` §4.2 applied to the moment it matters most.

---

## The stages that need care

### Problem discovery

The most important half-hour in the business. Rules:

1. **Do not open with technology.** Not with AI, not with automation, not with
   what we built for somebody else.
2. **Ask, then be quiet.** The useful material arrives in the pause after they
   have finished their first answer. Most people fill that pause with the real
   problem.
3. **Follow the irritation.** When a person's tone changes describing something
   routine, that is the job. Go there.
4. **Do not solve it yet.** Write it down. "That's interesting, tell me more
   about how that works now" beats "we could automate that" every time.
5. **Never grade the problem.** Not "is that costing you enough to be worth
   fixing", ever. See the questions below, and the banned phrasings in
   `02-brand/brand-promise.md` §4.2.

### Exploration

Where the baseline gets captured. `17-proof-and-case-studies/measurement.md` §3
covers how to ask for numbers without it feeling like an audit — read it before
the second conversation, not after.

The output of this stage is that we can describe their process back to them
accurately enough that they say "yes, that's it". Until that has happened, do
not recommend anything.

### Recommendation

Three things, in this order: what we think would help, what it involves, and
what it should be worth. **The arithmetic is shown**, not asserted, and it is
built from their figures.

This is also the stage where the answer is sometimes "don't". The phrasing
matters — the numbers do the refusing, not us. `12-pricing/worked-examples.md`
§4 has the script.

### Commercial fit

The stage most likely to be skipped, and the one that prevents the worst
outcome: building something at a price that made sense to nobody.

If the value does not support a price both sides are happy with, say so and stop.
That is a successful use of the process, not a failure of it — and it leaves a
relationship intact for the next thing.

---

## Discovery questions

The list. **None of them mentions a technology**, and that is deliberate: "what
AI are you interested in?" is the question that produces a conversation about
our toolbox instead of their business.

1. What keeps taking longer than it should?
2. Where does somebody repeatedly copy the same information?
3. What gets checked because nobody trusts the first result?
4. What happens when an enquiry arrives?
5. What would you stop doing tomorrow if you could?

Follow-ups worth having ready:

6. Walk me through it — what happens first?
7. Who else touches it?
8. When it goes wrong, how do you find out?
9. What did you try already, and what happened?
10. If this were fixed, what would you do with the time?
11. Is there a spreadsheet in the middle of this? *(There is usually a
    spreadsheet in the middle of it.)*
12. What decision would you make differently if you had a better answer?

Question 5 is the strongest opener in the list — it invites a complaint, which
is easier to give than a requirement. Question 12 is the one that finds
analytics work, which people rarely raise unprompted because they have stopped
believing the numbers are gettable.

---

## What "done" looks like

- [ ] Both founders can run a discovery conversation without notes.
- [ ] Ten qualified conversations have happened, and the notes have been read
      back for the words prospects actually used.
- [ ] The ICP signals and messaging spine in `01-positioning` have been rewritten
      using those words.
- [ ] At least one conversation has been ended at Commercial fit, deliberately
      and comfortably.
- [ ] The stage names here and in `07-crm` agree, or the mapping above is
      accurate enough that nobody is confused.

---

## Next actions

1. **Read `01-positioning/objection-handling.md` and `saying-no.md` before the
   first call.** They are the other half of this folder and they already exist.
2. **Rehearse the five discovery questions out loud.** Reading is not the same
   as saying.
3. **Take notes verbatim** in the first ten conversations. The prospect's own
   words are the raw material for every piece of copy the business will write.
4. **Read `17-proof-and-case-studies/measurement.md`** before the first
   Exploration, so the baseline gets captured while it still exists.
