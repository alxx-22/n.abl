# 07 — Sales CRM

**Status: in progress.**

> **The CRM's stages are n.abl's own sales pipeline, not a service menu.**
> `New Lead` through `Won` describes n.abl pursuing a customer. There is no
> service-category field in the CRM and there should not be one that mirrors a
> lead-generation offer, because lead generation is not something n.abl sells —
> see `01-positioning/README.md`. Where a service category is needed on a record,
> it is one of the six customer-problem categories.

The CRM is built and in daily use. It holds leads, contacts, pipeline stages,
notes, activity and outreach drafts, and it works. What it does not have is a
single one of the compliance fields the master plan requires. A search of the
whole repository for `subscriber_type`, `lawful_basis`, `opt_out` or
`suppression` returns nothing outside the business documents that ask for them.

So the honest position is: **the CRM is a working pipeline tracker and it is not
yet allowed to drive outreach.** Those are two different things and the gap
between them is what this folder is for.

Last substantive revision: 2026-08-15.

---

## The hard block

**The CRM cannot legally drive outreach until the compliance fields exist.**

Not "should not". Not "ideally would not before v4". It cannot, because there is
nowhere in the database to record which rules apply to a record, what basis it is
held on, where it came from, whether the person has already told us to stop, or
what was sent to them. Without those, every send is a decision made from memory,
and memory is not a control.

This is not a theoretical block. Today the outreach tab composes a draft, a human
approves it, and approval unlocks a `mailto:` handoff into the operator's mail
client. That path is manual and low volume, which is the only reason it has not
already caused a problem. The moment sending is automated, or the volume rises
above what one person reads line by line, the absence of these fields becomes the
whole risk.

The master plan says the same thing twice: section 5, "compliance is a database
feature, not a policy", and section 7, "built and in use. None of the compliance
fields exist yet, so it cannot legally drive outreach in its current state."

Nothing in this folder softens that.

---

## What this step is

The internal sales system: the pipeline the team runs on, and the schema that
decides who may lawfully be contacted through it.

| Part | Where it lives |
|---|---|
| The application | `src/pages/Crm.jsx`, one file, about 1,430 lines |
| Styling | `src/styles/crm.css` |
| Original schema | `supabase/migrations/202606010001_sales_intelligence.sql` |
| AI removal | `supabase/migrations/202606020001_remove_sales_ai.sql`, applied 2026-08-15 |
| Compliance schema | **Does not exist.** Specified in `compliance-schema.md` |

Five tables are live today: `sales_leads`, `sales_contacts`,
`sales_email_drafts`, `sales_activities` and `sales_pipeline_events`. A sixth,
`sales_research_runs`, was dropped with the AI layer.

**This step is not** lead sourcing (`10-lead-sourcing`, the v3 research
pipeline), the outreach engine (`11-outreach`, v4 sending, follow-ups and reply
handling), the public legal pages (`04-legal`), or the client-facing portal
(`05-portal`). It is the record of who a lead is, what stage they are at, and
what we are permitted to do with them.

It has a dependency in both directions with `04-legal`. The privacy policy has to
describe what the CRM does with lead data before the CRM does it, and the CRM has
to have a `privacy_notice_status` field to record that it was done. Neither exists
yet. See that folder's next actions, item 3.

---

## What "done" looks like

Twelve statements. Four are true today.

- [x] The pipeline exists, is signed in through the team space session, and is
      used for real leads.
- [x] There is no model in the loop. Every field is hand-entered or derived from
      hand-entered values by plain arithmetic. Cost of running it: £0.
- [x] Nothing sends automatically. A draft is composed, a human approves it, and
      approval unlocks a mail-client handoff and nothing more.
- [x] The ten pipeline stages are byte-identical between the front end and the
      database CHECK constraint.
- [ ] Every lead record carries `subscriber_type`, `lawful_basis`, `source`,
      `source_date` and `privacy_notice_status`, and the safe value is the
      default rather than something a person has to remember to set.
- [ ] `marketing_status` cannot be set to permitted unless the basis, the
      subscriber type, the source and the notice are all recorded. Enforced by a
      CHECK constraint, not by the interface.
- [ ] An individual subscriber — a sole trader, a non-LLP partnership outside
      Scotland, a named private individual — cannot be marked permitted for
      electronic mail marketing on legitimate interests alone. Enforced in the
      schema.
- [ ] There is a suppression list, keyed on the normalised address rather than
      the lead, that is checked before every send and cannot be deleted from or
      edited. Enforced by a trigger, so it holds against the service role and
      against anyone with the SQL editor open.
- [ ] Deleting a lead does not delete the fact that they opted out. The
      suppression row survives the lead record.
- [ ] There is a `contact_history` record of what was sent, to whom, when, by
      whom, and whether an opt-out route and a sender identity were included. It
      is append-only and it is not wiped by an ordinary lead save.
- [ ] The send path calls one gate function and fails closed. A send that cannot
      prove it is permitted raises an exception rather than going out.
- [ ] A legitimate interests assessment exists on file, is referenced from the
      lead record, and has been reviewed at least once since it was written.

Eight of twelve outstanding. That is the accurate shape of this step: the easy
half is built and the half that carries the legal risk is not started.

---

## Honest status, in one paragraph

The CRM was built, then had its AI layer removed in August 2026, and what remains
is a clean, boring, hand-driven pipeline tracker holding eight leads. It is
genuinely useful and nothing here proposes rebuilding it. The compliance schema
has not been started: no migration file has been written, nothing has been
applied to the hosted project, and no front-end field exists. `compliance-schema.md`
in this folder is a specification and a DDL sketch, not a record of work done. The
DDL in it has not been run anywhere. Until it has, the correct number of automated
marketing emails this system may send is zero, and the correct number of manual
ones is however many one person can personally justify, one at a time.

---

## Next actions, in order

1. **Read `compliance-schema.md` end to end** before writing any SQL. It is the
   specification. Half an hour.
2. **Settle the two facts the schema depends on.** Whether n.abl relies on
   legitimate interests for B2B research-sourced contacts, and who the data
   controller is by name. Both go in the privacy policy and both are referenced
   by `lawful_basis`. This is a decision, not a task, and it blocks everything
   below it.
3. **Write the legitimate interests assessment.** Purpose, necessity, balancing.
   One page. It has to exist before a single record can honestly be marked
   `legitimate_interests`. Store it in `04-legal` and reference it by name from
   `lia_ref`.
4. **Add the research and marketing section to the privacy policy**
   (`04-legal`, item 3 of that folder's list). The schema records that a notice
   was given. There has to be a notice to give.
5. **Write the migration** as `supabase/migrations/202608160001_crm_compliance.sql`,
   following `migration-plan.md`. Do not paste the DDL sketch in unread: it is a
   sketch, the Supabase extension schema question in it is unresolved, and it
   needs testing before it touches the hosted project.
6. **Apply it to a branch or a scratch project first**, then to
   `rrkcoqopcqtowbyismcq`. Take a backup first. The AI-removal migration set the
   precedent for doing this in verified passes and it is a good precedent.
7. **Backfill the eight existing leads by hand.** Eight records, ten minutes.
   Every one of them was found before any of this was recorded, so the source and
   the date have to be reconstructed honestly or the record marked
   `do_not_contact`. Do not guess a source to clear a constraint.
8. **Update the two row mappers together.** `leadToRow` and `leadFromRow` in
   `src/pages/Crm.jsx` are a matched pair; a column added to one and missed on
   the other makes the field vanish on the next round-trip. The file says so at
   line 116 and it is right.
9. **Add the compliance panel to the lead detail view**, and make the outreach
   tab refuse to compose for a lead that is not permitted. The interface should
   make the block visible, but the database is what enforces it.
10. **Deal with the localStorage mirror.** Every lead is copied into
    `nabl.sales-intelligence.v3` on the operator's device and is read back when
    the server returns nothing. A lead deleted server-side stays on that device.
    This is the one part of the current design that quietly undermines a
    suppression list, and `migration-plan.md` covers the options.

Items 2, 3 and 4 are not code and they are the actual bottleneck. Nobody can
write an honest `lawful_basis` value into a database when the business has not
decided what it is relying on.

---

## What each file in this folder is for

| File | What it is for | Read it when |
|---|---|---|
| `README.md` | This file. What the step is, what done means, honest status, what to do next. | Opening the folder cold |
| [`pipeline-stages.md`](pipeline-stages.md) | The ten stages, what each one means, what moves a lead between them, the four places the stage names are duplicated, and where the compliance gate sits on the pipeline. | Changing a stage name, adding a stage, or arguing about what "Ready To Contact" means |
| [`compliance-schema.md`](compliance-schema.md) | The specification. The ICO B2B position, corporate subscribers against sole traders and partnerships, legitimate interests and the balancing test, opt-out on every message, the suppression list, and the whole schema as a SQL DDL sketch. | Before writing any of the migration, and before any conversation about who can be emailed |
| [`migration-plan.md`](migration-plan.md) | How the schema actually gets applied: order, backfill of the eight live leads, the front-end changes, verification queries, rollback, and what stays out of scope. | Doing the work |

---

## Things in here that must not be got wrong

**1. The block is legal, not stylistic.** Anyone reading this folder and
concluding "we should add these fields at some point" has read it wrongly. Until
they exist, automated outreach is off.

**2. Compliance goes in the schema, not in a policy document.** A policy is
something a person has to remember at 6pm on a Friday. A CHECK constraint is
something the system cannot get wrong. Every rule in `compliance-schema.md` that
could be a constraint is written as a constraint.

**3. The suppression list is never deleted from.** Not to tidy it, not to reuse
an address, not because a record "looks like a test". Keeping a minimal
suppression record is how the objection is honoured; deleting it is how the
person gets contacted again.

**4. The stage names are duplicated in four places** and one changed character
breaks every write on that lead. `pipeline-stages.md` lists all four.

**5. Nothing in this folder has been reviewed by a solicitor or by the ICO.**
It is a careful reading of published ICO guidance by the people building the
system. It is not legal advice. The same rule as `04-legal` applies: never say,
write or imply otherwise.

**6. Do not propose rebuilding the CRM.** It works. This step adds fields,
constraints, one table for suppression, one for contact history, and a gate
function. It does not redesign anything that already runs.
