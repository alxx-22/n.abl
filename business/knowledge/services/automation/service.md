# Automation

## In one paragraph

A person moving information that could move itself. Nearly always someone
carrying data by hand between an email, a spreadsheet, a form and a system, or
assembling the same document from parts that already exist, or remembering a
deadline nobody else tracks. We build the thing that does it on its own and
tells a person only when something fails. Mostly ordinary code; a model only
where messy text has to be read. The client says "this takes us ages" or "we
keep getting this wrong".

## Signals that point here

Seen on their own pages, in their own words:
- A form to download, print, fill in and email or post back: credit account
  application, booking form, job request, data sheet.
- "Call us for a quote" or "allow 48 hours for a quote" on plainly standard
  work.
- A price list published as a dated PDF.
- "Email us your order" or "send your purchase order": someone retypes it.
- Two named tools with nothing joining them: a booking widget from one vendor,
  an accounts or invoicing package named elsewhere.
- Deadlines they track for customers or themselves: certificates,
  inspections, servicing, renewals, calibration, MOTs.
- A promise somebody keeps by hand: "same-day quotes", "we will confirm within
  24 hours", "we remind you when your service is due".
- Volume that repeats: hundreds of jobs or orders a year, several vans, many
  small jobs.
- A vacancy on their own site for an administrator, data entry, or an
  operations role asking for "advanced Excel".

## Signals that point somewhere else

- Customers cannot book, order or pay online at all → **web**. The retyping
  behind an online form is still ours.
- The question is what their own figures mean (which jobs pay, how last month
  went) → **data_analytics**.
- There is no record to move yet and the job is a new tool (a portal, a field
  app, a register) → **software**.
- Free text read and sorted by meaning, at volume → **ai**, but only if rules
  cannot do it.
- Slow only because nobody was shown the software → training, which this
  pipeline does not score. Say so and score low.
- A signal about the register (an overdue filing, company age) → no service.

## What we would build

Quote and estimate generators from a price list plus rules; documents and
certificates from a template, filed automatically; scheduled data movement
between systems, logged, failures reported to a person; spreadsheet to
database where a spreadsheet has become the system; recurring reports built
on a schedule; shared-inbox triage and routing; job sheets and timesheets from
a phone, with the invoice raised from the same data; expiry and renewal
registers that warn early; cross-checks (invoice against delivery note, order
against despatch) that flag only the exceptions; validation at the point of
entry so bad data never gets in.

## What kills it

Visible now, so score low:
- The page shows it already done: an online form that lands in a system, a
  customer portal, named integrations.
- One person, or no sign of staff: nobody to give the time back to.
- A franchise or branch whose systems are set elsewhere.
- Register distress: see the ceilings in the scale.

Learned on a call, so use for walk_away_if:
- They will not let us watch the task done once, with the real files open.
- It is an hour or two a month. There is no job in it.
- They are mid-migration to a system that replaces the process anyway.
- They can name who makes the mistakes but not the process that allows them,
  or want the system to prove who was at fault.

## How this specialist scores

Start from what the page shows a person doing by hand, not from the sector.
- Sector alone ("trades always have admin"): 30 at most.
- One quoted manual step from the list above, in a business with staff: 60–70.
- A quoted manual step that plainly repeats many times a week (volume, several
  vans, many orders), in a business of 5 to 25 or with small-company accounts:
  75–85.
- Two or more separate manual steps quoted, plus size: up to 90.
- One director, micro-entity accounts and no sign of staff: 35 at most.
- Mark down when the page shows the process already automated.

The test is time. A day a week is the target. An hour a month is not a job,
however irritating it is.

## The question that settles it

"How many hours a month does it take, who does it, and can I watch it being
done once?"
