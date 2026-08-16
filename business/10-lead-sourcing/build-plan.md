# Build plan — v3, the research pipeline

How the sourcing pipeline actually gets built: the stages, where the code lives,
the file formats, what runs at which cost class, how each stage is verified, and
what stays out of scope.

**Status: not started.** No stage exists. `scripts/research/` does not exist. No
candidate file, cache or shortlist has been produced. Everything below is the
order of work, written in advance.

---

## 1. The gates

Three things constrain when this can be built, and they are not the same
constraint.

**Gate 1 — v2 comes first.** The master plan is explicit: "v2 — make what exists
match the plan. Nothing new is built until this is finished." That means the site
copy rewrite, the CRM compliance fields, the portal schema migration and the
old-brand purge. Pipeline code is new software and waits behind them.

**What is not blocked by gate 1:** reading the sources register, getting a
Companies House key, choosing a territory, building the first thirty-business
list by hand, and hand-scoring it. None of that is software. All of it is the
work that decides whether the software is worth writing, and it can start today.

**Gate 2 — the CRM cannot hold a lead yet.** The compliance fields specified in
[`../07-crm/compliance-schema.md`](../07-crm/compliance-schema.md) do not exist.
Until the migration is applied, this pipeline writes files, not rows. That is not
a serious limitation for v3: the output of this step is a document a human reads,
and a document does not need a database.

**Gate 3 — nothing here sends anything.** Sending is v4 and lives in
`11-outreach`. This pipeline has no mail path, no address book export and no
outbox. Building one before the shortlists are consistently worth reading
produces exactly the liability the master plan describes.

---

## 2. Shape

Six stages. Each one reads a file, writes a file and does one job. That is the
whole architecture, and it is deliberately boring.

```
0  config      territory tables, sector rules, signal patterns   Class 1
1  discovery   candidate list from a named source                Class 1
2  resolution  Companies House match, subscriber_type            Class 1
3  enrichment  fetch and extract from the business's own site    Class 1
4  scoring     deterministic rules over facts                    Class 1
5  shortlist   a document a human reads                          Class 1
```

Class 2 appears once, optionally, inside stage 4's inputs: sector classification
where the keyword rules cannot decide. The constraints on it are in
[`scoring-model.md`](scoring-model.md) section 11. **No Claude anywhere in v3.**

**Why file in, file out.** Three reasons. A stage can be re-run without re-running
the ones before it. A rule change can be replayed over stored facts without
re-fetching a single website. And every intermediate result is inspectable with
an ordinary text editor, which is what makes the whole thing debuggable by one
person on a Tuesday evening.

---

## 3. Where the code lives

`scripts/research/`, alongside the existing `scripts/` directory. Node ESM, run
from the command line, consistent with `build-og.mjs`, `security-check.mjs` and
the rest.

```
scripts/research/
  config/
    territories.json      postcode districts → core / edge / outside
    sectors.json          keyword rules → sector class, per territory
    signals.json          signal codes → match patterns, tier, points
    disqualifiers.json    codes → conditions
  discover.mjs            stage 1
  resolve.mjs             stage 2
  enrich.mjs              stage 3
  score.mjs               stage 4
  shortlist.mjs           stage 5
  lib/
    fetcher.mjs           robots, rate limit, cache, user agent
    extract.mjs           HTML extraction rules
    facts.mjs             the facts record shape and validation
    rules.mjs             the pure scoring functions
```

**Dependencies: prefer none.** Node's built-in `fetch`, `fs` and `URL` cover the
fetching and the file work. If HTML extraction proves genuinely painful with
plain string and regular expression work, one small well-known parser is
acceptable. Anything with a monthly fee is not, and nothing here needs one.

**Add npm scripts** to `package.json` in the existing style: `research:discover`,
`research:enrich`, `research:score`, `research:shortlist`. Consistency with
`test:ui` and `test:security` costs nothing and makes the commands discoverable.

### Data, and the one thing that must be got right first

```
research-data/            ← gitignored, before the first run
  candidates/
  cache/                  raw fetched responses, keyed by URL and date
  facts/
  scores/
  shortlists/
  suppressed.jsonl
  disqualified.jsonl
```

**Add `research-data/` to `.gitignore` before writing a single line of stage 1.**

This holds names, business addresses, director names and contact routes. Some of
it is personal data. Git history is permanent, and a commit of a candidate file
cannot be undone by deleting the file in the next commit. This is a two-minute
task that is unrecoverable if skipped, so it goes first.

**Format: JSON Lines** for every record file. One JSON object per line. It diffs
readably, it streams, it appends without rewriting, and it can be inspected with
ordinary tools. The shortlist is the exception and is Markdown, because a person
reads it.

---

## 4. Stage 0 — config

The tables the rest of the pipeline reads. No code runs here; it is data, written
once and then edited as the rules improve.

| File | Contents | Source of truth |
|---|---|---|
| `territories.json` | Postcode districts mapped to `nottingham_core`, `nottingham_edge`, `alcester_core`, `alcester_edge` | ICP section 2 |
| `sectors.json` | Keyword rules to sector class, with the territory-specific classes marked | ICP section 4 |
| `signals.json` | Signal codes, tiers, points and match patterns | ICP section 5, [`scoring-model.md`](scoring-model.md) section 5.4 |
| `disqualifiers.json` | The seven pipeline-detectable disqualifier codes and their conditions | [`scoring-model.md`](scoring-model.md) section 4.2 |

**Territories are postcode districts, not town names.** Matching "Beeston"
against free text will match an address in Leeds. The district lookup is a
morning's work with a map and it removes a whole class of quiet errors.

**Verified when:** every town named in ICP section 2 resolves to at least one
district, and a handful of known addresses in each territory classify correctly
by hand.

---

## 5. Stage 1 — discovery

Produce a candidate list for one territory and one sector. A candidate is a
business name plus at least one locator: a website URL, a company number, or a
directory entry URL.

**Sources, in the order in [`sources.md`](sources.md).** For the first pass, that
means the Companies House bulk snapshot filtered by postcode district, plus one
trade body directory and one chamber list worked by hand.

**Every candidate carries `source`, `source_detail` and `source_date` from the
moment it is created.** Not added later. A candidate that cannot say where it
came from is not created, which is the practical test that keeps the register
honest.

**The suppression check runs here**, not at the end. A candidate matching the
suppression list or the disqualified list is dropped immediately with the reason
recorded. This is the rule that stops a quarterly re-run resurrecting somebody
who asked to be left alone.

**Deduplication is Class 1 and needs a real key.** Company number where there is
one; otherwise normalised domain; otherwise normalised name plus postcode
district. Names alone will merge two different businesses and split one.

**Verified when:** running the same territory twice produces the same candidate
set, no duplicates, and every row has a source triple.

---

## 6. Stage 2 — resolution

Match each candidate to Companies House, or record explicitly that there is no
match.

**Outputs.** Company number, status, type, incorporation date, officers,
filing-history flags, and `subscriber_type` derived from company type.

**The rule on no match.** No Companies House record most likely means a sole
trader or a partnership, which is an individual subscriber under PECR and a
materially different case. Record `companies_house_number = null` and
`subscriber_type = unknown`, flagged for manual determination. **Never infer
`corporate` from a trading name.** "Something Ltd" on a van is not a filing.

**Matching is deliberately conservative.** An uncertain match is no match. A
wrongly matched company number attaches the wrong directors, the wrong filing
history and the wrong subscriber type to a business, and every downstream
judgement inherits the error.

**Rate limiting.** Throttle below the documented API limit, cache every response,
and never re-request a company already resolved this quarter. See
[`sources.md`](sources.md) section 3 for the limit and its verification marker.

**Verified when:** twenty known businesses resolve correctly by hand check, no
false match survives a spot check of ten, and `subscriber_type` distribution is
plausible for the territory rather than 100% corporate.

---

## 7. Stage 3 — enrichment

Fetch the business's own website and extract the observable signals. This is the
stage that produces the value and the stage with the etiquette obligations.

**The fetcher rules, from [`sources.md`](sources.md) section 4, restated as
implementation requirements:**

1. Fetch and parse `robots.txt` first, cache per host, skip disallowed paths
   entirely.
2. Send a user agent naming n.abl with a URL explaining what it is.
3. One request at a time per host, with a delay, and a small global concurrency
   limit. [PLACEHOLDER — set the exact figures after the first pass shows how
   many pages a typical site needs. Start slow. There is no deadline.]
4. Cache every raw response to `research-data/cache/`, keyed by URL and date. A
   re-run reads the cache.
5. Bounded depth: home, about, contact, services, and top-navigation links. A
   handful of pages.
6. Public pages only. No logins, no form submissions, no gated files.
7. Stop on 403, 429 or anything that looks like an objection, and record why.
8. Collect the minimum personal data. A decision-maker and a contact route.

**Extraction is Class 1.** Pattern matching over HTML and link targets, driven by
`signals.json`. A `.pdf` link whose anchor text mentions a form, application or
data sheet is `printed_form`. A `mailto:` on a free mail domain is
`generic_email_domain`. A footer year two or more behind the current year is
`stale_copyright`.

**Every signal carries its evidence:** the URL, the matched text and the date
seen. A signal without evidence is not written. This is what makes the shortlist
reviewable, and it is also what lets a human overrule the extractor with a
reason.

**Expect the extractor to be wrong at first**, and expect that to be fine.
Precision matters more than recall here: a missed signal costs a slightly lower
score, a false signal puts a bad business in front of a person and erodes trust
in the whole list. Tune towards fewer, more certain matches.

**Verified when:** the extractor is run over the thirty hand-researched
businesses from the README's next actions and its signals are compared against
the hand-written ones. Disagreements are listed. Every false positive is fixed
before the pipeline is pointed at anything larger.

---

## 8. Stage 4 — scoring

Pure functions over the facts file. Fully specified in
[`scoring-model.md`](scoring-model.md); this section is only the build notes.

- No network, no clock, no randomness inside the scoring path. The timestamp is
  passed in.
- Stable ordering, so a diff between two runs shows real changes only.
- Every output record carries `ruleset_version`.
- Disqualifiers and suppression are checked before any arithmetic.
- The full breakdown is written, not just the total.

**Verified when:** the test cases in [`scoring-model.md`](scoring-model.md)
section 10 pass, including the byte-identical re-run, and the pipeline's scores
for the thirty hand-scored businesses match the hand-scored sheet or the
differences are explained and one of the two is corrected.

---

## 9. Stage 5 — shortlist

A Markdown document, ordered by score, that a human sits down with.

**Per entry:** company name, score and band, the breakdown by dimension, each
signal with its evidence link, the named decision-maker, the source triple, the
subscriber type, and any flags. Everything needed to judge the entry without
opening another tool.

**Per document:** the territory and sector, the date, the ruleset version, the
counts at each band, and the count of candidates dropped by suppression and by
disqualifier. The dropped counts matter. A run that discards ninety per cent of
its candidates is telling you something about the source, not about the
businesses.

**The human pass, which is part of this step and not an afterthought.** A person
reads the shortlist and marks each entry: approve, reject with a reason, or
research further. Rejections with reasons are the feedback that improves the
rules. A rejection reason that appears three times is a rule change, not a
judgement to keep making by hand.

**Verified when:** a person who did not build the pipeline can read a shortlist
and make a decision on every entry without asking a question.

---

## 10. Order of work

The design and research steps are not blocked by gate 1. The code steps are.

| # | Work | Class | Blocked by |
|---|---|---|---|
| 1 | Read [`sources.md`](sources.md). Get a Companies House key. Verify its limits against live documentation. | — | Nothing |
| 2 | Choose one territory and one sector. Write the choice down. | — | Nothing |
| 3 | Build a thirty-business candidate list by hand. | — | Nothing |
| 4 | Hand-score those thirty against [`scoring-model.md`](scoring-model.md). Log every disagreement with instinct. | — | 3 |
| 5 | Adjust the rules. Freeze `ruleset_version` at `v1`. | — | 4 |
| 6 | Add `research-data/` to `.gitignore`. | 1 | Nothing |
| 7 | Stage 0 config files. | 1 | 5, gate 1 |
| 8 | Stage 1 discovery, plus dedup and the suppression check. | 1 | 7 |
| 9 | Stage 2 resolution. | 1 | 8 |
| 10 | Stage 3 fetcher: robots, user agent, throttle, cache. | 1 | 9 |
| 11 | Stage 3 extraction rules, tuned against the thirty. | 1 | 10 |
| 12 | Stage 4 scorer, with its test cases written first. | 1 | 5, 11 |
| 13 | Stage 5 shortlist document, and the first human pass. | 1 | 12 |
| 14 | Feedback loop: rejection reasons into rule changes. | 1 | 13 |
| 15 | CRM write path. | 1 | 14, and the `07-crm` migration being applied |

Steps 1 to 5 are the ones that decide whether steps 7 to 15 are worth doing, and
they are the ones that will feel like a delay. They are not. Writing a scorer
before scoring thirty businesses by hand means writing a scorer against an
imagined profile.

[PLACEHOLDER — effort estimates per step, once step 3 has shown how long one
business actually takes to research properly. Guessing them now would produce a
plan built on a made-up number, which is the thing this whole folder argues
against.]

---

## 11. The CRM write path

Last, and gated.

When the `07-crm` compliance migration is applied, stage 5 gains an optional
export that creates `sales_leads` rows for approved shortlist entries. The rules:

- **Only human-approved entries.** The shortlist document's approval marks are
  the input, not the score.
- **`source`, `source_detail`, `source_date` and `subscriber_type` are written
  from the pipeline's own records.** They are already known and they are the
  fields the whole compliance schema turns on.
- **`marketing_status` stays at its default `do_not_contact`.** Sourcing never
  sets a record to permitted. That requires a lawful basis, a completed
  assessment and a privacy notice position, and all three are decisions a person
  makes.
- **`lawful_basis` stays `unassessed`** until the assessment named in the
  `07-crm` next actions exists.
- **The suppression check runs again at insert.** Belt and braces, in the
  database, where it cannot be forgotten.
- **`lead_score` carries the pipeline score**, and the breakdown goes in the
  notes or a dedicated column, so the number can be explained months later.

Note the existing `sales_leads.lead_score` column already has a `check
(lead_score between 1 and 100)` constraint. A pipeline score of 0 will fail it.
Either map 0 to 1 on export or widen the constraint in the compliance migration.
Decide it once, deliberately, and write down which.

---

## 12. Cost

| Stage | Cost |
|---|---|
| Config | £0 |
| Discovery | £0. Companies House is free, directories are public. |
| Resolution | £0 |
| Enrichment | £0. Bandwidth on an existing connection. |
| Scoring | £0. Arithmetic. |
| Shortlist | £0 |
| Optional Class 2 sector classification | £0 in fees. Local model on an existing PC. |
| **Total** | **£0** |

The whole of v3 adds nothing to the £36 monthly cost base. That is not a
coincidence, it is a design constraint, and it is the reason there is no Claude
in this pipeline. The master plan's rule holds: do not raise the fixed cost base
to solve a problem a one-off purchase, or an afternoon of ordinary code, would
solve.

---

## 13. Risks

**The extractor produces confident nonsense.** The most likely failure. A regular
expression matching "quote" on every page in the country puts hundreds of bad
candidates on a shortlist and nobody trusts it again. Mitigation: tune for
precision over recall, require evidence on every signal, and check the first pass
by hand against thirty known businesses.

**The list gets long before it gets good.** Automation makes it trivially easy to
go from thirty candidates to three thousand, and a shortlist nobody has time to
read is the same as no shortlist. Mitigation: work one territory and one sector
to completion first, and treat shortlist length as a target to keep small.

**Someone reaches for Google Maps because it is faster.** It is faster. It is
also off, permanently, for the reasons in [`sources.md`](sources.md) section 1.
Mitigation: there is no `google_maps` value in the CRM `source` constraint, so a
record sourced that way has nowhere legitimate to be filed.

**Sourcing gets built and sending gets bolted on.** The whole point of the v3/v4
split is that research is safe and sending is not. Mitigation: this pipeline has
no mail path at all, and adding one is a different folder's work.

**Personal data ends up in git.** Unrecoverable once it happens. Mitigation: step
6 of the order of work, and doing it before step 8 rather than after.

**The rules get tuned until every business scores well.** Scoring is only useful
if it rejects things. A quarterly drift towards looser thresholds makes the
shortlist longer and less useful at the same time. Mitigation: `ruleset_version`
on every score, and rule changes driven by logged rejection reasons rather than
by a run that returned fewer leads than hoped.

---

## 14. Out of scope

Named, so that nobody builds them here.

| Not in v3 | Where it belongs |
|---|---|
| Sending anything | `11-outreach` |
| Claude personalisation of messages | `11-outreach` |
| Follow-up timers | `11-outreach` |
| Reply classification | `11-outreach`, and it is Class 2 |
| The compliance schema itself | `07-crm` |
| The lawful basis decision and the assessment | `07-crm` and `04-legal` |
| Buying a licensed dataset | `16-finance` decides when there is money |
| Changing the ICP weights | `01-positioning`. Change the profile there, then bring [`scoring-model.md`](scoring-model.md) into line. |
| Any part of the existing CRM interface being rebuilt | Nowhere. It works. Do not. |
