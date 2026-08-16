# 10 — Lead sourcing

> **This folder is internal growth infrastructure. It is not a service.**
>
> Everything here builds n.abl's *own* customer acquisition: finding, enriching,
> scoring and shortlisting businesses that n.abl might approach. None of it is
> sold to anyone. Lead generation, lead conversion and outbound sales systems are
> **not** customer-facing services — n.abl has no deliverability record, no data
> access, no volume and no proof, and could not compete in that market credibly
> today. They may become a service one day; that decision has not been made and
> is not implied by anything in this folder. See `01-positioning/README.md`.

**Status: not started.**

Nothing in this folder has been built. There is no sourcing script, no candidate
file, no enrichment cache, no scoring code and no shortlist. A search of the
repository for a `scripts/research/` directory returns nothing. This folder is
the plan for starting v3, not a description of a pipeline that exists.

Last substantive revision: 2026-08-16.

---

## The sourcing correction, first

**Do not build the core lead database by bulk-exporting Google Maps.**

Google's Maps terms restrict using Maps content to create or augment business
listings, mailing lists or telemarketing lists. Places is pay-as-you-go with
field-level billing rather than a permanent free allowance, so the free tier the
original outreach plan assumed does not exist in the form it assumed.

Treat Google as **one discovery signal, never the database of record.** It can
tell you that a business is worth looking at. It cannot be the thing you keep,
score, store or contact from.

The preferred sources, in order:

| # | Source | Why it ranks here |
|---|---|---|
| 1 | **Companies House** | Free, licensed for reuse, authoritative on directors, incorporation, filing history and registered address. The only source that settles `subscriber_type`. |
| 2 | **The businesses' own websites** | Where nearly every observable signal actually lives, and the only material that makes outreach worth reading |
| 3 | **Trade body and industry directories** | High precision on sector, often on size and accreditation |
| 4 | **Local directories and chambers of commerce** | Territory-shaped, human-curated, small enough to work by hand |
| 5 | **Council business and licensing registers** | Published for the public, precise, patchy coverage |
| 6 | **Job adverts** | Current by definition, and the source of several of the strongest signals |
| 7 | **Manually verified research** | Slow, correct, and the fallback for anything that matters |
| 8 | **Licensed datasets** | Once there is money to pay for one. Cheaper and safer than extracting more. |
| 9 | *Google, as a discovery signal only* | Confirms a business exists in a place. Nothing from it is stored as a record. |

The full register, with access methods, licence positions, field mappings and the
collection rules, is in [`sources.md`](sources.md). Read it before writing a line
of fetching code.

---

## What this step is

v3 of the build order: **find, research, score, shortlist.**

It produces a list of businesses that a human then reads. It does not produce an
outbox. The output of this step is a document somebody sits down with, marks up
and either approves or throws away.

The sequence from the master plan, with this step's part marked:

```
find → research → score → shortlist      ← this folder
     → HUMAN inspects                    ← this folder ends here
     → HUMAN approves
     → Claude personalises                 11-outreach
     → HUMAN approves
     → send
     → deterministic follow-up timer
     → classify replies locally
     → escalate to a human
```

Class 1 and Class 2 work only. **No Claude in the loop.** Fetching, parsing,
matching, deduplication and scoring are ordinary code and cost nothing. A local
open model may assist with one bounded job, described in
[`scoring-model.md`](scoring-model.md), and its output can never move a lead over
a threshold on its own.

**This step is not** the outreach engine (`11-outreach`), the CRM schema itself
(`07-crm`), or the ideal customer profile (`01-positioning`). The profile decides
who counts as a good lead. This folder decides how they are found, what is
recorded about them, and how the list gets short enough for one person to read.

---

## What "done" looks like

Twelve statements. **None of them are true today.**

- [ ] A written source register exists, each source has a named access method and
      a recorded licence position, and no source in it is Google Maps as a
      database.
- [ ] A discovery stage produces a candidate list for a named territory and
      sector, where every candidate carries the source it came from and the date
      it came from there.
- [ ] Every candidate is resolved against Companies House, or explicitly marked
      as having no match, and `subscriber_type` is set from that result rather
      than guessed from a trading name.
- [ ] Enrichment fetches the business's own website, honours `robots.txt`,
      identifies itself in the user agent, rate limits itself, and caches raw
      responses so a re-run does not re-fetch.
- [ ] Signal extraction is deterministic code, and every signal recorded carries
      the URL and the matched text that produced it.
- [ ] Scoring runs as pure functions with no network and no model call, and the
      same input file produces a byte-identical score file on every run.
- [ ] Every score is stored with its full breakdown and the ruleset version that
      produced it, so any number on the shortlist can be explained.
- [ ] Hard disqualifiers are applied before scoring and produce a recorded
      reason, and a disqualified business is not silently re-added by the next
      run.
- [ ] The shortlist is a human-readable document, ordered, with the evidence for
      each entry visible without opening another tool.
- [ ] A human inspection pass happens, is logged, and rejections feed back into
      the rules rather than being fixed by hand each time.
- [ ] Nothing writes to the CRM until the compliance fields from `07-crm` exist,
      and when it does write, it populates `source`, `source_date`,
      `subscriber_type`, `lawful_basis` and `privacy_notice_status` on every row.
- [ ] Running the whole pipeline for one territory costs £0 in fees.

Zero of twelve. That is the accurate shape of this step.

---

## Honest status, in one paragraph

This is a plan. No code has been written, no territory has been worked, no
candidate list exists and no business has been scored. The CRM holds eight leads
that were found by hand before any of this was designed, and they were not
produced by a pipeline. Two things also block the finish of this step rather than
its start: the master plan puts v2 before anything new is built, and the
compliance fields in `07-crm` do not exist, so nothing here may write a
marketable record into the CRM yet. Neither of those blocks the research work
itself. Research and shortlisting can proceed today. Storing leads as
marketing-ready records, and sending anything at all, cannot.

---

## Next actions, in order

1. **Read [`sources.md`](sources.md) end to end.** It is the specification for
   what may be collected and from where. Half an hour, before any code.
2. **Get a Companies House API key** and confirm the current rate limit and terms
   against the live documentation rather than against this folder. Free, but the
   figures in `sources.md` are marked for verification.
3. **Decide the first territory and sector to work.** One of each. Nottingham
   core with trades and installers is the obvious first pass, because the ICP
   ranks both highly and the signals are the easiest to spot. Write the choice
   down before starting, so the first list can be judged against an intention.
4. **Build the candidate list for that one pass by hand, on paper or in a
   spreadsheet.** Thirty businesses, no code. This is not a warm-up. It is how
   you find out which fields are actually obtainable, which signals are actually
   visible, and whether the scoring weights survive contact with reality.
5. **Score those thirty by hand against
   [`scoring-model.md`](scoring-model.md).** Record every disagreement between
   the score and your instinct. Those disagreements are the rule changes.
6. **Adjust the rules, then freeze them as `v1` of the ruleset.** A scoring rule
   changed after automation starts invalidates every score already stored, which
   is why the version number exists.
7. **Finish v2 before writing pipeline code.** The master plan is explicit that
   nothing new is built until the site copy, the compliance fields, the portal
   schema and the brand purge are done. Steps 1 to 6 are research and design, not
   new software, so they are not blocked. Step 8 onwards is.
8. **Build the stages in the order in [`build-plan.md`](build-plan.md)**, one at a
   time, each with its own verification. Discovery, then resolution, then
   enrichment, then scoring, then the shortlist document.
9. **Run the pipeline against the same thirty businesses** and compare its output
   with the hand-scored sheet from step 5. Any difference is a bug in the code or
   a gap in the rules, and both are worth finding before the list is a thousand
   long.
10. **Only then connect it to the CRM**, and only after the `07-crm` compliance
    migration is applied. Until that exists the pipeline writes files, not rows.

Steps 3, 4 and 5 are the ones people will want to skip. They are the ones that
decide whether the rest is worth building.

---

## What each file in this folder is for

| File | What it is for | Read it when |
|---|---|---|
| `README.md` | This file. What the step is, what done means, the honest status, what to do next. | Opening the folder cold |
| [`sources.md`](sources.md) | The ranked source register. The Google correction in full, what each source gives, how it is accessed, the licence position, what it maps to in the CRM, the collection rules, and what must never be a source. | Before fetching anything, and before any argument about where a record came from |
| [`scoring-model.md`](scoring-model.md) | The deterministic Class 1 scoring rules. Inputs, hard disqualifiers, the five weighted dimensions, missing-data handling, thresholds, versioning, and the test cases. It is arithmetic, not a model call. | Writing or changing the scorer, or explaining a number on a shortlist |
| [`build-plan.md`](build-plan.md) | How v3 actually gets built. The six stages, where the code lives, the file formats, what runs at which cost class, verification for each stage, and what stays out of scope. | Doing the work |

---

## Things in here that must not be got wrong

**1. Google is a signal, not a database.** Bulk-exporting Maps to build the lead
list is off, permanently, and not because it is difficult. Anyone who reaches for
it because it is the fastest path has misunderstood the constraint.

**2. Research is not sending.** This folder can be built and run in full without
sending a single email, and it should be. A machine that can send 10,000 bad
emails is a liability. A machine that can research 10,000 businesses and hand
back the thirty worth talking to is the actual asset.

**3. The score is a filter for research effort, not a decision.** It decides who
gets human attention first. It never decides who gets contacted. The two human
approval gates in the master plan stay, and no score replaces either.

**4. Missing data scores zero. It is never guessed.** A field that could not be
found is recorded as not found. A pipeline that infers an employee count to fill
a column produces a confident number nobody can defend, and the first time that
happens in front of a client it costs more than the lead was worth.

**5. Nothing writes a marketable record to the CRM until `07-crm` is done.** The
compliance fields do not exist. Until they do, a lead stored by this pipeline has
nowhere to record its lawful basis, and a record with no recorded basis is not a
lead, it is a liability with a company name attached.

**6. No Claude in this step.** Not for extraction, not for scoring, not for
tidying up a sector name. v3 is Class 1 with one bounded Class 2 exception. If a
piece of this seems to need Claude, the rule is probably wrong, and fixing the
rule is cheaper than paying for intelligence on every record forever.

**7. Nothing in this folder has been reviewed by a solicitor.** It is a careful
reading of published terms and guidance by the people building the system. The
same rule as `04-legal` and `07-crm` applies: never say, write or imply
otherwise.
