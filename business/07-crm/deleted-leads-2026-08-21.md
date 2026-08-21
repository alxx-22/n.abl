# Record of deletion — the seven old-CRM leads, 21 August 2026

Deleted on the owner's instruction, 21 August 2026. This file exists because
nothing else records it: `sales_leads` has no soft delete, no tombstone and no
audit table, so a deleted lead leaves behind only the `marketing_suppression`
rows it never had. Without this page there would be no answer to "what was in
the CRM before?".

## Why they went

All seven were produced by the AI-driven CRM that was later stripped out, in a
thirteen-minute burst on 1 June 2026. None carried a source. Assessed against
the ICP and the compliance schema they failed on every axis that matters:

- **Territory.** All seven Birmingham / West Midlands. The territory is
  Nottinghamshire and B49/B50. `outside_territory` is a hard disqualifier in
  `10-lead-sourcing/scoring-model.md`.
- **Size.** All seven identical, "11-50". That is a default, not an estimate,
  and the scoring model says employee count is never estimated.
- **Score.** 73 to 92, all generated, all meaningless.
- **Fit.** One managed IT consultancy, which is a competitor. Three agencies,
  which are peers. Three retailers, which the ICP names under "weak fit,
  deprioritise".
- **Provenance.** No source on any of them, so under the rule in
  `lead-backfill-decisions.md` every one would have stayed on
  `do_not_contact` permanently. Two had contacts sourced from clutch.co
  profiles — a third-party directory, not an OGL register, and not a source
  this pipeline uses.

They were not a loss. The candidate pool built the same week holds 81,286
businesses that are in territory and sourced from published registers.

## What was NOT a problem

No personal data. Every contact row was "Public contact route / General
enquiries" against a generic inbox — `hi@`, `info@`, `enquiries@` — so there
was no named individual in the CRM at any point, and no data subject with
rights over any of it. Nothing had ever been sent to them: `marketing_sends`
was empty before the deletion and is empty after.

That is why this was handled as a data quality decision and not as an incident.

## What was deleted

Seven leads, seven contacts, fourteen activities, seven pipeline events. Full
state at the moment of deletion:

| Company | Sector as recorded | Location | Score | Contact route |
|---|---|---|---|---|
| Barques | Digital and creative communications agency | Birmingham | 77 | hi@barques.co.uk, 0121 233 2080 |
| Digital Waffle | Technology and digital recruitment | Birmingham | 79 | none held; sourced from clutch.co |
| LucidNine | Digital marketing agency | Birmingham | 73 | none held; sourced from clutch.co |
| kin. | Furniture and homeware retail | Stirchley, Birmingham | 91 | info@kinstore.co.uk, 0121 295 8866 |
| minima. | Furniture, lighting and homeware retail | Birmingham | 89 | enquiries@minimauk.com, +44 121 236 0100 |
| Cookes Furniture Birmingham | Furniture retail | Birmingham | 85 | info@cookesfurniture.co.uk, 0121 250 5050 |
| Liquor Store Clothing | Menswear and footwear retail | Birmingham city centre | 84 | 0121 236 5830 |

Every `website`, `email` and `source` field held a **markdown link** rather
than a URL — `[https://barques.co.uk](https://barques.co.uk)` in a column
typed as text for a URL. Model output written straight into the database with
nothing between. It is a small thing and it is the clearest single sign of how
these records were made.

## The eighth lead

There were eight. **Slink** — a managed IT consultancy in Birmingham, and a
competitor — disappeared partway through the session on 21 August, between one
read and the next, along with its pipeline event. Nothing in this session
deleted it: only `SELECT`s had run at that point, and the migration applied
afterwards touches no lead data.

It was almost certainly a browser tab, but it cannot be established either way,
and that is the point worth keeping. The CRM mirrors every lead into
`localStorage` and reads it back when the server returns no rows;
`migration-plan.md` section 8 flagged that as a hazard for exactly this class
of problem.

**Follow-up, not yet done:** there is no record anywhere that a lead was
deleted. `marketing_suppression` was deliberately built to survive lead
deletion, which is the right instinct applied to one table and not the others.
A deletion tombstone on `sales_leads` — id, company, deleted_at, deleted_by —
would have answered the Slink question in one query.
