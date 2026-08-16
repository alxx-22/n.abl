# Scoring model

**This is not a model. It is arithmetic.**

The word "model" in the filename means a scoring scheme, in the way an insurer
means it. There is no model call anywhere in this document. Scoring a lead is
Class 1 work: a pure function from a facts record to an integer and a breakdown,
with no network access, no API key and no cost.

**Status: not written.** No scorer exists. No lead has been scored by it. The
rules below are the specification, and the honest first version of them is a
person applying this page to thirty businesses by hand, as in the README's next
actions.

---

## 1. Why it is deterministic

Four reasons, in order of weight.

**It has to be explainable.** Every number on a shortlist gets questioned, and
the answer has to be better than "that is what it came out as". A weighted sum
with a stored breakdown can be read back line by line. A model score cannot.

**It has to be stable.** The same candidate file must produce the same score
file today and in six months. Otherwise a shortlist cannot be compared with the
one before it and nobody can tell whether the rules improved or the weather
changed.

**It has to be free.** The whole business runs on a £36 monthly cost base.
Scoring is the highest-volume operation in the pipeline, so it is the last place
to spend money. A weighted sum over a few dozen booleans costs nothing at any
volume.

**Class 2 would not be better at it.** The hard part of scoring is not judgement,
it is extraction: deciding whether a page contains a downloadable form that has
to be printed and returned. Once that fact is known, the arithmetic is trivial
and a local model would only make it non-reproducible.

---

## 2. Inputs

The scorer takes one facts record per candidate and nothing else. It does not
fetch, parse or infer. Everything it needs is already extracted by the enrichment
stage in [`build-plan.md`](build-plan.md).

| Field | Type | From |
|---|---|---|
| `candidate_id` | string | Discovery |
| `company_name` | string | Discovery |
| `companies_house_number` | string or `null` | Resolution |
| `company_status` | string or `null` | Companies House |
| `company_type` | string or `null` | Companies House |
| `subscriber_type` | enum | Resolution. `corporate`, `sole_trader`, `partnership`, `individual`, `unknown`. |
| `trading_postcode` | string or `null` | Website, then manual check |
| `territory` | enum | Derived: `nottingham_core`, `nottingham_edge`, `alcester_core`, `alcester_edge`, `outside`, `unknown` |
| `employee_count` | integer or `null` | Website, job adverts, manual check. Never estimated. |
| `employee_band` | enum or `null` | Derived from `employee_count` only |
| `sector` | enum or `null` | Rule list over trading description and directory category |
| `signals` | array | Enrichment. Each entry: `code`, `tier`, `url`, `matched_text`, `date_seen`. |
| `named_decision_maker` | boolean | Companies House officers, or the website |
| `decision_maker_contactable` | boolean | A published business contact route reaching that person or their office |
| `disqualifiers` | array of codes | Enrichment and resolution |
| `evidence_complete` | boolean | Every scored fact carries a URL or a manual-check note |

**Every field that could not be established is `null`, not a default.** A `null`
scores zero on its dimension. It is never filled in with a plausible value, and
`unknown` is never treated as the middle of a range.

---

## 3. The order of evaluation

```
1. suppression check   → drop, do not score
2. hard disqualifiers  → disqualified, with reason, do not score
3. dimension scoring   → integer 0-100 plus breakdown
4. band and action     → shortlist / hold / discard
5. write record        → score, breakdown, ruleset version, timestamp
```

Steps 1 and 2 run before any arithmetic. A disqualified candidate gets no score
at all, rather than a low one. A low score invites someone to argue it back up.
A disqualification with a reason does not.

---

## 4. Suppression and disqualifier gates

### 4.1 Suppression

Check the candidate against the suppression list and the previously-disqualified
list before anything else. A match drops the candidate with the reason recorded
and the original date preserved.

A candidate that was disqualified in a previous run is not re-scored just because
a new run found it again. It is re-scored only if the disqualifier that removed
it is one that can change, and only when there is evidence that it has.

### 4.2 Hard disqualifiers

From section 6 of the ICP. Any one of these ends the pursuit regardless of
everything else. These are the codes the pipeline records.

| Code | Condition | Detectable from |
|---|---|---|
| `outside_territory` | `territory = outside` | Trading postcode |
| `too_large` | `employee_count >= 51` | Website, job adverts, manual |
| `procurement_present` | A supplier portal, preferred supplier list or security questionnaire is visible | Website |
| `in_house_technical` | An in-house developer or IT manager, named or advertised for | Website, job adverts |
| `not_viable` | Dissolved, in liquidation, a winding-up petition, dormant filing while apparently trading, or a pattern of charges | Companies House |
| `franchisee` | Systems dictated by a franchisor | Website |
| `head_office_elsewhere` | Multi-site with the decision made outside the territory | Website, Companies House |

Four of these are only visible in conversation and are therefore **not** pipeline
disqualifiers: shopping for an AI strategy, insisting on a retainer, wanting
equity or deferred payment, and regulated advice as the deliverable. They belong
to the first call, and they are in
[`../01-positioning/saying-no.md`](../01-positioning/saying-no.md) with a script
each. Do not try to detect them from a website. Guessing at intent from marketing
copy will disqualify good businesses and keep bad ones.

**A disqualifier requires evidence.** The code is recorded with the URL or the
Companies House field that produced it. A disqualifier with no evidence is a
hunch, and hunches do not go in a database.

---

## 5. The dimensions

Five dimensions, 100 points, weights taken directly from section 7 of the ICP.
**These weights are not to be changed here.** If they need to change, change the
ICP first and bring this file into line, because the profile is the authority on
who a good lead is.

| Dimension | Weight |
|---|---|
| Geography | 20 |
| Size | 20 |
| Sector | 15 |
| Observable signals | 30 |
| Decision access | 15 |
| **Total** | **100** |

### 5.1 Geography — 20

| Condition | Points |
|---|---|
| `nottingham_core` or `alcester_core` | 20 |
| `nottingham_edge` or `alcester_edge` | 10 |
| `outside` | disqualified at step 2, never scored |
| `unknown` | 0 |

Territory is decided from the **trading** postcode. A registered office is not a
trading address, and a large share of small companies register at their
accountant's. Using the registered office here fills the Nottingham list with
businesses that have never been to Nottingham.

The core and edge lists are in section 2 of the ICP. They live in the code as a
postcode-district lookup table, not as a set of town names matched against free
text.

### 5.2 Size — 20

| `employee_count` | Points |
|---|---|
| 5 to 25 | 20 |
| 3 to 4 | 10 |
| 26 to 50 | 10 |
| 1 to 2 | 0, and see the exception |
| 51 or more | disqualified at step 2 |
| `null` | 0 |

**The high-value-per-head exception.** The ICP allows a one or two person
business where the owner's own time is the bottleneck and is demonstrably
valuable. That judgement cannot be made from a website, so the scorer does not
attempt it. A 1 to 2 person business scores 0 on size and is flagged
`review_small_high_value` if a `sector` of `professional_services` is present. The
flag puts it in front of a human. It does not add points.

**Employee count is never estimated.** Not from van counts, not from team page
headcounts, not from turnover. If it is not stated or countable from a source
that says so, it is `null` and it scores zero. A van count is a tier 2 signal and
gets its points there.

### 5.3 Sector — 15

| Class | Points |
|---|---|
| Strong fit, both territories | 15 |
| Additionally strong for that specific territory | 12 |
| Neutral | 6 |
| Weak fit | 0 |
| `null` | 0 |

The sector lists are in section 4 of the ICP. Two rules about applying them.

**The territory-specific classes only count in their own territory.** Logistics
scores 12 around Nottingham and 6 around Alcester. Agricultural scores 12 around
Alcester and 6 around Nottingham. The list is written that way and the code must
respect it.

**SIC codes do not decide sector.** They are self-selected and frequently stale.
They may narrow the candidates for a rule match, and that is all. Sector comes
from the business's own description of itself, matched against a keyword rule
list.

### 5.4 Observable signals — 30, capped

| Tier | Points each | What they are |
|---|---|---|
| Tier 1 | 10 | Strong signals, each worth acting on alone |
| Tier 2 | 3 | Supporting signals, meaningful in combination |
| Tier 3 | 5 | Timing signals, which make an approach welcome rather than intrusive |

Sum them and cap at 30. Three tier 1 signals reach the cap on their own, which is
correct: at that point the business is obviously worth a look and more evidence
does not make it more worth a look.

The catalogue, with the codes the extractor emits. Every signal listed in section
5 of the ICP appears here and nothing else does.

**Tier 1, 10 points each**

| Code | What matches |
|---|---|
| `printed_form` | A downloadable form that has to be printed, filled in by hand and emailed back |
| `quote_by_phone` | "Call us for a quote", or a stated quote turnaround, on obviously standardised work |
| `repeat_admin_advert` | An administrator or data entry role advertised repeatedly |
| `excel_ops_advert` | An operations role requiring "advanced Excel" or "strong Excel skills" |
| `two_systems_visible` | Two vendor systems that visibly do not talk to each other |
| `slow_response_reviews` | Public reviews mentioning slow responses, chasing or unanswered calls |
| `dated_pdf_pricelist` | A price list published as a dated PDF |

**Tier 2, 3 points each**

| Code | What matches |
|---|---|
| `bare_email_contact` | A contact page with a bare address and no form |
| `generic_email_domain` | gmail, outlook, hotmail, btconnect, btinternet on the site, van or signage |
| `stale_copyright` | Footer copyright two or more years old while clearly still trading |
| `social_ahead_of_site` | A social page more current than the website |
| `role_addresses` | Several role-based addresses in use with no shared system behind them |
| `fleet_visible` | Livery or a fleet photograph implying five to twenty vehicles |
| `trade_body_listing` | A trade body listing carrying more detail than their own site |
| `third_party_portal` | A "customer portal" link to a product they clearly do not control |
| `multiple_brands` | Multiple trading names run by the same directors |

**Tier 3, 5 points each**

| Code | What matches |
|---|---|
| `new_director` | A director appointed in the last twelve months |
| `premises_change` | A recent move to larger premises, or a second site |
| `first_supervisor_advert` | A first-ever supervisor, manager or coordinator vacancy |
| `late_filings` | Accounts filed late, or on the final day, more than once |
| `price_or_service_change` | A visible price increase or a new service line |

**`slow_response_reviews` has a sourcing constraint.** Reviews are read by a
person, from a source we are permitted to read, and the signal is recorded as a
manual observation. There is no script harvesting review text, and none from
Google. See [`sources.md`](sources.md) section 1.

**`late_filings` is noted, never mentioned.** The ICP says so and it is right. It
scores. It does not appear in an outreach message, ever.

**The best signal of all is not in this list.** A business owner describing a task
by how long it takes rather than by which software it uses cannot be seen from
outside. It is scored at the first conversation, by a person, and it outweighs
everything on this page.

### 5.5 Decision access — 15

| Condition | Points |
|---|---|
| Named director identified and contactable | 15 |
| Named but no route to reach them | 8 |
| No named person | 0 |

"Contactable" means a published business contact route that plausibly reaches
that person or their office. It does not mean a guessed address. Pattern-guessed
email addresses are not a source, and a candidate does not earn 15 points because
someone assumed `firstname@`.

---

## 6. Bands and actions

Straight from section 7 of the ICP.

| Total | Band | Action |
|---|---|---|
| 70 to 100 | `shortlist` | Goes to the human inspection pass |
| 50 to 69 | `hold` | Revisit if a timing signal appears |
| Below 50 | `discard` | Record the reason. Do not re-add later. |

Two operational rules on top.

**A `hold` is re-scored only when a tier 3 signal appears.** Tier 3 signals are
the timing ones, and timing is the only thing that legitimately changes about a
business that was otherwise not a fit. A quarterly re-run that quietly promotes
held leads because a rule got looser is the failure mode this rule prevents.

**A `discard` is written down and stays written down.** The candidate goes on the
discarded list with its score, its breakdown and the ruleset version. The next
discovery run checks that list before creating anything. See
[`sources.md`](sources.md) section 13.

---

## 7. Missing data

The single rule: **missing scores zero, and is recorded as missing.**

| Situation | Behaviour |
|---|---|
| Field is `null` | Dimension scores 0. Recorded as `missing`, not as 0 by merit. |
| Website unreachable | All website-derived dimensions score 0. Candidate flagged `enrichment_failed`. |
| Companies House no match | `subscriber_type` cannot be `corporate`. Flagged for manual determination. Decision access scores from the website only. |
| Fewer than three of five dimensions have data | Candidate is `insufficient_data`, not `discard`. Different meaning, different list. |

`insufficient_data` matters. A business that could not be researched is not the
same as a business that was researched and found unsuitable, and merging the two
loses the difference permanently. One is a gap in the pipeline. The other is a
judgement.

**Never impute.** No averages, no sector defaults, no "most businesses this size
have". The moment the scorer invents a fact, every number downstream becomes
undefendable, and the first time that surfaces in front of a client it costs more
than the lead was worth.

---

## 8. Determinism, versioning and replay

**Requirements on the implementation.**

1. Pure functions. No network, no clock, no random source, no environment
   reads inside the scoring path. The timestamp on the output record is passed
   in, not read.
2. Stable ordering. Signals are sorted by code before summing, output rows sorted
   by `candidate_id`. A diff between two runs should show real changes only.
3. The same facts file produces a byte-identical score file. This is a test, not
   an aspiration, and it is the easiest test in the whole pipeline to write.
4. Every output record carries `ruleset_version`.

**The ruleset version.** A semantic version string, bumped whenever any weight,
threshold, signal code or disqualifier changes. Scores from different versions
are not comparable and must not be sorted into one list.

`v1` is frozen after the hand-scoring pass in the README's next actions, step 6.
Freezing it before that pass would freeze rules that have never met a real
business.

**Replay.** Because facts and scores are stored separately, a rule change is
re-run over the stored facts without re-fetching a single website. This is the
main practical reason the two stages are separate, and it is why the enrichment
cache is worth the disk it uses.

**The output record.**

```
candidate_id
score                 integer 0-100
band                  shortlist | hold | discard
breakdown             { geography, size, sector, signals, decision_access }
signals_counted       [ { code, tier, points, url } ]
signals_capped        boolean
missing               [ dimension names ]
flags                 [ review_small_high_value, enrichment_failed, ... ]
disqualifiers         [ codes with evidence ]
ruleset_version       string
scored_at             passed-in timestamp
```

`breakdown` is the field that makes the shortlist reviewable. Without it, a human
inspecting a list is inspecting a number.

---

## 9. Worked examples

Both are constructed illustrations of the arithmetic, not real businesses.

**Candidate A.** An eight-person electrical contractor in Beeston. Trading
address confirmed on the site. Website has a credit account application as a
printable PDF and a "call for a quote" page. Footer copyright is three years old.
Two directors named at Companies House, one of them appointed four months ago,
and a `manager@` address published.

| Dimension | Working | Points |
|---|---|---|
| Geography | `nottingham_core` | 20 |
| Size | 8 employees, in the 5 to 25 band | 20 |
| Sector | Trades and installers, strong fit both territories | 15 |
| Signals | `printed_form` 10 + `quote_by_phone` 10 + `stale_copyright` 3 + `new_director` 5 = 28, under the cap | 28 |
| Decision access | Named and contactable | 15 |
| **Total** | | **98** |

Band `shortlist`. Note that the score is high without any estimate anywhere: five
facts, each with a URL or a Companies House record behind it.

**Candidate B.** A four-person letting agency in Evesham. Website is a one-page
site with a bare gmail address. No Companies House match found. No employee count
stated anywhere, and four is the number a person counted on a team page, which
means it does not count.

| Dimension | Working | Points |
|---|---|---|
| Geography | `alcester_edge` | 10 |
| Size | `employee_count` is `null`, a counted team page is not a stated figure | 0 |
| Sector | Property and lettings, strong fit both territories | 15 |
| Signals | `bare_email_contact` 3 + `generic_email_domain` 3 = 6 | 6 |
| Decision access | No named person, no Companies House officers | 0 |
| **Total** | | **31** |

Band `discard`, with `subscriber_type` flagged for manual determination, because
no Companies House match probably means sole trader or partnership, which is an
individual subscriber and a materially different case. The temptation here is to
score the team page as four employees and lift it to 41, which changes nothing
about the band and starts a habit that will eventually change something that
matters.

---

## 10. Test cases

Write these before the scorer. They are all Class 1 and they are all cheap.

| Test | Expects |
|---|---|
| Empty facts record | Score 0, band `discard`, all five dimensions `missing` |
| Every dimension at maximum, no cap breach | 100 |
| Four tier 1 signals | Signals dimension 30, `signals_capped` true |
| One hard disqualifier plus perfect facts elsewhere | No score written, disqualifier recorded with evidence |
| Suppressed candidate | Dropped before scoring, original suppression date preserved |
| `employee_count` 50 against 51 | 10 points against disqualified |
| Registered office in territory, trading address outside | `outside_territory`, disqualified |
| Territory-specific sector in the wrong territory | 6, not 12 |
| Same facts file run twice | Byte-identical output |
| Facts re-scored under a bumped ruleset version | New records, old ones retained, no silent overwrite |

The boundary tests are the ones worth having. Every argument about a score in
practice will be about a number sitting on a band edge.

---

## 11. Where Class 2 is allowed, and where it is not

One bounded exception, and it is optional. The pipeline must work fully without
it.

**Allowed.** Assigning `sector` where the keyword rule list produces no match and
the business's own description is ambiguous. A local model on our own hardware
classifies the description into the ICP's sector list. Its output is recorded
with `sector_source = local_model`, and it is advisory.

**The constraints on that exception.**

1. It never raises a candidate above a band threshold on its own. If removing the
   model-assigned sector would drop the candidate out of `shortlist`, the
   candidate goes to a human for a sector decision instead.
2. It runs on our own machines. £0 in fees.
3. Its output is stored as a fact with its provenance, and the scorer treats it
   as an ordinary input. The scoring path itself stays pure.
4. Where it disagrees with a later human judgement, the disagreement is logged.
   Enough of those and the keyword rule list gets fixed, which is the better
   outcome anyway.

**Not allowed, anywhere in v3.**

- Claude, for any part of scoring. v3 is Class 1 with the exception above, and
  outreach personalisation in `11-outreach` is where Claude earns its money.
- A model deciding a disqualifier. Disqualifiers end pursuits and need evidence.
- A model estimating employee count, turnover or territory.
- A model producing the score itself, in any form, including as a "sanity check"
  alongside the deterministic one. Two scores means someone will eventually
  prefer the wrong one.

---

## 12. What the score is not

**It is not a decision to contact anyone.** It is a filter for research effort. It
decides who gets human attention first and nothing else. The master plan's
sequence has two human approval gates in it and the score replaces neither.

**It is not a quality judgement about a business.** A score of 31 means the
business does not match a profile n.abl wrote for its own convenience. It is
perfectly possible to be an excellent business and score badly here.

**It is not evidence of a lawful basis.** Nothing on this page touches
`lawful_basis`, `privacy_notice_status` or `marketing_status`. A high score is
not permission. Those fields do not exist in the CRM yet, and until they do, the
only thing a shortlist can be used for is deciding who is worth researching
further.

**It is not stable across versions.** A score is only meaningful with its
`ruleset_version` attached. A number quoted without one is a number with no
definition.
