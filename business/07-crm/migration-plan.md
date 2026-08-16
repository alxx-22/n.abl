# Migration plan

How the compliance schema in `compliance-schema.md` actually gets from a document
into the running system.

**Nothing in this plan has been started.** No migration file exists, nothing has
been applied to any database, and no front-end field has been added. Every step
below is written as an instruction, not as a record.

The target project is `rrkcoqopcqtowbyismcq`, which currently holds eight leads,
eight contacts and sixteen activities, per the header of
`supabase/migrations/202606020001_remove_sales_ai.sql`.

---

## The shape of the job

Nine steps in three groups.

| Group | Steps | Blocking on |
|---|---|---|
| Decisions and paperwork | 1 to 3 | Nothing. These can start today |
| Database | 4 to 6 | The decisions above |
| Application | 7 to 9 | The database |

The decisions are the bottleneck, not the SQL. It is not possible to write an
honest `lawful_basis` into a column when the business has not decided what it
relies on, and a migration applied before that decision just puts a
plausible-looking value in front of the problem.

---

## 1. Decide the two facts

**Which lawful basis.** For research-sourced B2B contacts, this is almost
certainly legitimate interests, and it is a decision that has to be made and
written down rather than assumed from this sentence. Consent applies to inbound
enquiries and to anyone who asked to be contacted. Contract applies to existing
clients.

**Who the controller is, by name.** The legal entity that decides how lead data
is used. This is the same `[PLACEHOLDER]` that `04-legal` is waiting on, and it
has to appear in the privacy policy and in the identity line of every outreach
message.

Output: two sentences, in `04-legal`, that everything else can point at.

## 2. Write the legitimate interests assessment

One page, answering the three-part test set out in `compliance-schema.md`
section 2.2: purpose, necessity, balance. It has to be specific about volume and
targeting, because the necessity limb is where a vague answer falls over.

Give it a stable reference — a filename is enough — because
`sales_leads.lia_ref` points at it per record, and a later revision of the
assessment must not silently rewrite the basis under which an old record was
added.

Output: `business/04-legal/legitimate-interests-assessment.md`, and a reference
string to use in the column.

## 3. Publish the research and marketing privacy notice

`04-legal` next actions, item 3. The privacy policy today describes enquirers,
clients and staff. It does not describe leads at all, which means there is
currently nothing for a first outreach email to link to and
`privacy_notice_status` would have no honest value other than `not_given`.

The section has to say what is collected, where it came from, the basis relied
on, how long it is kept, how to object and how to opt out.

Output: a live URL. Everything below can proceed once it exists.

## 4. Write the migration

File: `supabase/migrations/202608160001_crm_compliance.sql`.

Take the DDL from `compliance-schema.md` section 4 and treat it as a draft to be
read line by line, not as something to paste. Specifically:

- confirm the `subscriber_type` and `source` value lists against how leads are
  actually being found
- confirm the generated column syntax for `sales_contacts.email_normalised`
  against the project's PostgreSQL version
- keep the file idempotent, in one transaction, with the same header style as the
  existing migrations
- add the file to the table in `supabase/README.md`, which lists every migration
  and its state

Do not add a hashed identifier column. The note at the end of section 4 explains
why: `pgcrypto` lives in the `extensions` schema on Supabase and an unqualified
`digest()` inside a pinned `search_path` will fail.

## 5. Apply it, in verified passes

The AI-removal migration was applied in three passes with the result of each one
checked before the next. Follow that precedent.

1. Take a backup. Dashboard, Database, Backups.
2. Apply to a Supabase branch or a scratch project first. Not to production
   because "it is only additive". It is additive and it also adds four
   constraints and two triggers to tables that are in daily use.
3. Apply the column and constraint block. Confirm all eight existing leads still
   load in the CRM. They should: every new column has a default, and the
   restrictive defaults mean all eight land on `do_not_contact` / `unassessed` /
   `unknown`, which is correct.
4. Apply the suppression, consent and sends tables, the gate function and the
   triggers.
5. Record the applied state in the migration header, the way
   `202606020001_remove_sales_ai.sql` does. That header is the reason anyone can
   tell today what has actually been run.

Verification queries to run after, and to keep:

```sql
-- No lead can be permitted without the paperwork. Expect 0.
select count(*) from public.sales_leads
where marketing_status = 'permitted'
  and (subscriber_type = 'unknown' or lawful_basis = 'unassessed'
       or source is null or source_date is null);

-- No individual subscriber permitted without consent. Expect 0.
select count(*) from public.sales_leads
where marketing_status = 'permitted'
  and subscriber_type <> 'corporate'
  and lawful_basis <> 'consent';

-- The suppression table refuses to lose rows. Expect an exception.
begin;
  delete from public.marketing_suppression where false;
rollback;

-- The gate refuses a send to a lead that is not permitted.
-- Expect false for every existing lead on day one.
select id, company, public.marketing_send_allowed(id, 'email', 'test@example.com')
from public.sales_leads;
```

The third one is worth running properly with a real row in a scratch project. A
`delete ... where false` may be optimised away without firing a row-level
trigger, and an append-only guarantee that has never actually been tested is not
a guarantee.

## 6. Backfill the eight leads by hand

Eight records. Ten minutes of work and the only step where dishonesty is
tempting.

For each one: where did this lead actually come from, and when? If the answer is
not known, the answer is not known. Leave `source` null, leave `marketing_status`
at `do_not_contact`, and the constraint will hold the lead out of outreach until
somebody re-sources it properly. That is the correct outcome. Guessing
`companies_house` to clear a constraint defeats the entire exercise and produces
a record that looks documented and is not.

Resolve `subscriber_type` against Companies House while you are there. It is the
first source in the master plan's list, it is free, and it answers the question
definitively for anything that is a registered company. A business that does not
appear is a sole trader or a partnership until proven otherwise, and therefore
needs consent.

Do not write a backfill `UPDATE` that guesses. There are eight rows.

## 7. Update the two row mappers, together

`leadToRow` and `leadFromRow` in `src/pages/Crm.jsx` are a matched pair. The
comment above them says a column added to one and missed on the other makes the
field vanish on the next round-trip, and that is exactly what will happen.

New fields on the write path: `subscriber_type`, `subscriber_type_evidence`,
`lawful_basis`, `lia_ref`, `source`, `source_detail`, `source_date`,
`privacy_notice_status`, `marketing_status`.

**Not on the write path:** `opt_out`, `opt_out_at`, `opt_out_channel`. These are
read-only to the CRM's ordinary save path and are set only through
`apply_opt_out()`. This matters more than it looks. `pushLead` sends the whole
row on every save, so if `opt_out` were on the write path, one stale browser tab
could clear an opt-out by saving an unrelated note. The master plan's wording is
"set once, never unset by an import", and keeping the column off the update
payload is how that is achieved from the application side.

Consider a database-level belt to go with the braces: a `BEFORE UPDATE` trigger
on `sales_leads` that raises if `opt_out` moves from true to false. It is four
lines and it removes the possibility entirely.

## 8. Deal with the localStorage mirror

This is the step that will get skipped, and it is the one that quietly
undermines a suppression list.

The CRM mirrors every lead into `localStorage` under
`nabl.sales-intelligence.v3` on every state change, and reads it back when the
server returns no rows. That is a reasonable offline design for a pipeline
tracker and a poor one for a system holding other people's contact details.

What it means concretely:

- a full copy of every lead, contact, note and draft sits unencrypted on each
  operator's device
- a lead deleted from the database stays in that copy indefinitely
- a suppression written on one machine is invisible to a stale copy on another
- the copy contains no compliance fields at all, so anything read back from it is
  unassessed by definition

Three options, in order of preference:

1. **Stop mirroring lead data.** Keep the offline store for interface state only,
   accept that the CRM needs a connection, and delete the key on load if it
   exists. Simplest, and it removes a data protection question rather than
   managing one.
2. **Mirror, but never read back as authoritative.** Keep the local copy strictly
   as a crash buffer for unsaved edits, drop the "server returned nothing, keep
   the device copy" branch in the read path, and clear the store on sign-out.
3. **Mirror the compliance fields too, and honour them locally.** Most work, and
   it still leaves an unencrypted copy on the device.

Whichever is chosen, decide it explicitly and write the decision in the CRM file
next to the store. Do not leave it as it is by default.

## 9. Add the interface

Last, deliberately. The database is the control; the interface makes it visible.

**A compliance panel on the lead detail view.** Subscriber type, lawful basis,
source, source date, privacy notice status, marketing status, and the opt-out
state as read-only text. It should be obvious at a glance whether a lead is
permitted and, if not, exactly which field is missing.

**An outreach tab that refuses.** Today the tab composes a draft and approval
unlocks the `mailto:` handoff. It should refuse to unlock for a lead that is not
permitted, and say which field is missing rather than greying out a button.

**An opt-out action.** One button that calls `apply_opt_out()`, takes the reason
and the evidence, and is available from anywhere in the lead view. Recording an
opt-out has to be faster than not recording one.

**A stage rule.** `Ready To Contact` should require the gate to pass. See
`pipeline-stages.md` section 5.

**Nothing that can edit or delete a suppression row.** There is no interface for
that, on purpose, and the trigger means an attempt would fail anyway.

---

## What stays out of scope

- **The sender.** No automated sending is built here. That is v4, in
  `11-outreach`, and the master plan is explicit that it comes after v3 produces
  shortlists worth reading.
- **Reply classification and follow-up timers.** Also v4.
- **TPS and CTPS screening.** Recorded, not integrated. See
  `compliance-schema.md` section 2.4.
- **Subject access and erasure workflows.** A real gap, belonging with the
  privacy policy work in `04-legal`.
- **The client-portal schema.** Also not in version control, also worth fixing,
  and a separate job. `supabase/README.md` covers it.

---

## Rollback

The migration is additive, which makes rollback easy for the columns and awkward
for the tables, and the awkwardness is deliberate.

Constraints and columns can be dropped. Nothing else depends on them, and no
existing column changes type, so dropping them returns the schema to its current
state.

`marketing_suppression` should not be dropped, ever, once anything real is in it.
If the compliance work is abandoned or redesigned, the suppression rows still
represent people who asked not to be contacted, and that fact outlives whatever
schema was around it. Export it before touching it, and treat the export the same
way as the table.

`marketing_sends` should be kept for the same reason, less absolutely: it is the
only record of what was actually sent.

---

## When this step becomes `done`

When all twelve statements in `README.md` are ticked, the migration header
records the applied state the way the AI-removal migration does, the eight
existing leads carry honest values, and somebody who has never seen the system
can look at a lead and answer "may we email this person, and why" without opening
a document.
