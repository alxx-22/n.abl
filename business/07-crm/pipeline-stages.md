# Pipeline stages

The ten stages a lead moves through, what each one means, and the four places the
stage names are written down.

Everything in this file describes the CRM **as it is built today**, except
section 5, which describes where the compliance gate has to sit once the schema
in `compliance-schema.md` exists. Section 5 is clearly marked as not built.

---

## 1. The stages

Defined once in the database, in the `CHECK` constraint on `sales_leads.status`
(`supabase/migrations/202606010001_sales_intelligence.sql`, lines 13 to 24), and
mirrored in the `STAGES` constant in `src/pages/Crm.jsx`.

| # | Stage | What it means | What moves a lead out of it |
|---|---|---|---|
| 1 | `New Lead` | The record exists. Company name, and possibly not much else. | Somebody starts researching it |
| 2 | `Researching` | Being looked at: website read, size and type judged, signals written down, contact route found. | The research is finished, either way |
| 3 | `Ready To Contact` | Research done, a contact route exists, and the lead is judged worth approaching. | A message is approved and actually sent |
| 4 | `Contacted` | A first approach has gone out. | A reply arrives, or the follow-up timer expires |
| 5 | `Follow Up Required` | Contacted, no reply, and the follow-up is due. | The follow-up goes out, or the lead is dropped |
| 6 | `Replied` | A human being replied. Any reply, including a no. | The conversation goes somewhere, or it does not |
| 7 | `Meeting Scheduled` | A conversation is in the diary. | The meeting happens |
| 8 | `Proposal Sent` | A scoped, priced proposal is with them. | They say yes or no |
| 9 | `Won` | Signed. Becomes a client, and the work moves to `14-delivery`. | Nothing. Terminal |
| 10 | `Lost` | Not proceeding, for any reason. | Nothing. Terminal, though a lead can be re-added later as a new record |

Two things to note about the shape of this list.

**It is not a funnel with equal steps.** Stages 1 to 3 are research and cost
almost nothing. Stages 4 to 6 are outreach and carry all of the legal risk.
Stages 7 to 10 are a sales conversation between two people and the CRM is only
keeping notes. Treating the ten as one uniform pipeline produces meaningless
conversion percentages.

**"Lost" is not a failure state.** The master plan's section 2 lists six kinds of
business n.abl is explicitly not for, and says saying no quickly is part of the
model. A lead moved to `Lost` in twenty seconds because it is an enterprise with
a procurement process is a good outcome, not a wasted one.

---

## 2. The rule that breaks everything if ignored

The stage names appear in **four** places, and they have to agree exactly:
character for character, including capitals and spaces.

| Where | What it is |
|---|---|
| `supabase/migrations/202606010001_sales_intelligence.sql` | The `CHECK` constraint on `sales_leads.status`. The authority |
| `src/pages/Crm.jsx`, `STAGES` | The dropdown, the filter, the move buttons |
| `src/pages/Crm.jsx`, `AFTER_CONTACT` and `REPLIED_ON` | Derived groupings used by the dashboard metrics |
| `src/styles/crm.css`, `.badge--*` | The badge colours |

The failure modes differ and only the first is loud.

Change the front end and not the constraint: every write on that lead fails, with
a database error, immediately. The file warns about this at line 20 and it is
right to.

Change the constraint and not `AFTER_CONTACT` or `REPLIED_ON`: nothing errors,
and the dashboard silently under-counts. `Contacted`, `Replies`, `Meetings` and
`Opportunities` all derive from those two arrays.

Change either and not the CSS: the badge falls back to the base style and looks
slightly wrong, which is the least harmful of the three and the easiest to miss.

The class name is derived, not written: `Badge` in
`src/components/ui/index.jsx` lower-cases the status and strips every character
that is not a letter, so `Ready To Contact` becomes `.badge--readytocontact`.

**Adding a stage** therefore means: write a migration that replaces the `CHECK`
constraint, update `STAGES`, decide whether the new stage belongs in
`AFTER_CONTACT` or `REPLIED_ON`, and add a badge rule. Four edits, one commit.

---

## 3. How a lead moves, today

Moves are made by hand. There is no automatic progression, no scoring rule that
promotes a lead, and no timer.

`moveLead` in `src/pages/Crm.jsx` does three things: it refuses a move to a stage
not in `STAGES`, it writes an activity entry reading "`from` to `to`", and it
inserts a row into `sales_pipeline_events` recording who moved it and when.

That pipeline-events table is the honest audit trail of stage changes and it is
currently written but never read back by the interface. Worth knowing before
somebody assumes there is no history.

`lead_score` is a hand-set priority from 1 to 100, defaulting to 50. It survived
the AI removal deliberately and it is not a model output. It sorts the lead list
and it does not gate anything.

---

## 4. Where the metrics come from

The eight dashboard tiles are plain counts over the stage field.

| Tile | Counts |
|---|---|
| Total Leads | Every lead |
| New Leads | `New Lead` |
| Contacted | Anything in `AFTER_CONTACT`: `Contacted`, `Follow Up Required`, `Replied`, `Meeting Scheduled`, `Proposal Sent`, `Won`, `Lost` |
| Replies | `REPLIED_ON`: `Replied`, `Meeting Scheduled`, `Proposal Sent`, `Won` |
| Meetings | `Meeting Scheduled` |
| Opportunities | `Proposal Sent`, `Won` |
| Won Deals | `Won` |
| Lost Deals | `Lost` |

Note that `Lost` counts as contacted and not as a reply, which is right for a
lead that never answered and wrong for a lead that was dropped at
`Researching`. With eight leads in the system this does not matter. It will
matter at a few hundred, and the fix is a stage for "disqualified before
contact" rather than a cleverer count.

---

## 5. Where the compliance gate sits — **not built**

None of this exists. It describes the intended arrangement once the schema in
`compliance-schema.md` is applied, and it is written here because the stage
boundary is where the gate belongs.

The pipeline has one line across it, between stage 3 and stage 4:

```
  New Lead  →  Researching  →  Ready To Contact
                                     |
                        ============ | ============  the compliance gate
                                     |
                                Contacted  →  Follow Up Required  →  Replied
                                     →  Meeting Scheduled  →  Proposal Sent
                                     →  Won / Lost
```

Everything above the line is research, and research on a lawfully obtained
business record is not marketing. Everything below the line involves sending
something to a person, and every one of those transitions has to be able to
prove it was allowed.

Three specific changes, when the schema exists:

**`Ready To Contact` stops being an opinion.** Today it means somebody thinks the
lead is worth approaching. It should mean that *and* that
`marketing_send_allowed()` returns true for the contact route. A lead can be
well-researched, high-scoring, perfectly targeted and still not permitted, and
the stage name should not hide that.

**Moving to `Contacted` requires a send record.** The honest sequence is: the
send is recorded in `marketing_sends`, the gate trigger either allows it or
raises, and the stage follows the recorded send. A lead should not be able to sit
at `Contacted` with nothing in the send history, because that is precisely the
state that cannot be explained to anyone afterwards.

**An opt-out overrides the stage, from anywhere.** `apply_opt_out()` sets
`marketing_status = 'opted_out'` and writes the suppression row regardless of
where the lead sits. The stage is left alone deliberately: a lead that opted out
after a proposal is still at `Proposal Sent` and that is useful history. The
gate, not the stage, decides whether anything further can be sent.

Until all of that is built, the only control is a person reading each draft
before pressing send, one at a time, in the mail-client handoff. That control
works at the current volume and does not survive automation, which is why the
master plan puts the schema in v2 and the sender in v4.

---

## 6. Two things not to do

**Do not add a stage to work around a missing field.** "Do Not Contact" is not a
pipeline stage. It is `marketing_status`. A lead can be opted out and still be at
`Meeting Scheduled`, because those two facts are about different things, and
collapsing them into one column loses both.

**Do not reuse a stage name for a different meaning.** Every stage name is written
in four places and read by two people. If a stage needs a different meaning, it
needs a different name and a migration.
