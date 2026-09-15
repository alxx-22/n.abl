# Everything you can change without a deploy

**Live since 14 September 2026.**

The first version of the outreach writer held about thirty decisions about the
world as TypeScript constants: the five service categories, the fit and
confidence vocabularies, the three scales for web presence, technical capacity
and inbound volume, the credit types, the model list with its rate limits, the
two model chains, the trading-year thresholds, and the regexes that spot a
booking widget in a page's source.

Every one of them needed a deploy to change, and none of them could be queried.

They are rows now. One `outreach_config()` call at the start of a tick and the
function knows what it is allowed to think.

---

## 1. The line, and why it is exactly there

| | |
|---|---|
| **The vocabulary is data** | What terms exist, what they mean, how they rank, which ones demand evidence |
| **The guard is code** | That a term demanding evidence, without evidence, gets demoted |

A guard that the thing it guards can edit is not a guard. So the rules live in
`supabase/functions/outreach-writer/guards.mjs` and **they name no term**. Not
`if (confidence === 'observed')` but *"if the registry says this term needs
evidence"*. Not `fit = 'possible'` but *"the strongest fit term that needs
none"*.

The test proves this rather than asserting it: it runs the same guards against
a registry where every term has been renamed and the ranks reordered, and every
rule still fires in the same place. If a term name ever leaks back into a rule,
that test goes red.

The practical consequence: **add a sixth service category with one INSERT and
the guards cover it on the next tick without being told.** The database
constraints follow too — `lead_service_fit.category` is a foreign key into the
registry, not a hand-maintained CHECK list that would have rejected it.

---

## 2. The tables

| Table | What it decides |
|---|---|
| `outreach_vocabulary` | Every term the assessment may use, its meaning, its rank, whether it demands evidence, what it requires of other dimensions, and what to call it on screen |
| `outreach_dimension` | Which vocabularies the scout is asked about, under what heading, in what order |
| `outreach_model` | Which model does which job, in what order to fall back, and the free-tier ceiling we believe |
| `outreach_prompt` | One system prompt per agent — `scout`, `editor`, `writer` |
| `outreach_fact_rule` | Which register facts are worth showing, and **how each should be read** |
| `outreach_page_signal` | Regexes run against the raw HTML to spot booking tools, shops, live chat |
| `outreach_setting` | Batch size, page budget, timeouts, rounds, clause length |
| `sector_service_prior` | The seed assumption per sector — now shown beside what we have actually found |

### The three columns that do the work

**`rank`** orders a dimension from weakest claim to strongest. It is what lets a
guard demote something without knowing that the top of the fit scale happens to
be called "strong".

**`needs_evidence`** marks a term you may not use without a quote that is
literally on the business's own page. True for exactly two terms today — the
strongest fit, and the confidence level that asserts the page says so — and
those two are the whole reason the column exists.

**`is_default`** is the honest answer when the model said something unusable.
Marked rather than derived, because the safe answer is not the same shape in
every dimension: the weakest *fit* is "ruled out", which is a claim about the
business and not a shrug, whereas the weakest *confidence* genuinely is one. A
term that needs evidence can never be a default — the database refuses it.

**`label`** is what a person sees where the term is a code. Null for almost
everything, because underscores-to-spaces already reads correctly; set for the
six capabilities, because "ai" is AI and "software" is Custom Software and no
punctuation rule gets there. It is never sent to a model — give one a display
name and it will eventually answer with it.

### And one that generalises a business rule

`requires_dimension` / `requires_min_rank`. Today it says training credits need
at least mixed technical capacity, because a training day booked for people who
will not attend is money burned and in a small town it is a refund and a lost
reputation. It is written generically because the next rule of that shape should
be a row, not a release.

---

### Two axes, and why the CRM filters on the second

`category` is how a business arrives — they want to save time, fix something,
build something new. `capability` is what the work would actually be —
automation, data & analytics, web, custom software, AI, training & support. Both
are in [`01-positioning`](../01-positioning/README.md) §154 and they are
deliberately different questions: "someone is rekeying bookings by hand" is a
`save_time` arrival, and the job behind it could be any of three capabilities.

The team specialises along the second, so that is what the CRM's **Service**
filter offers. A specialist filtering by their own capability is asking "is
there anything here for me", and a category cannot answer it.

`capability` is the one dimension with **no `is_default` row**, and the guard
will not invent one. A lead the scout could not place shows up under
*Unassigned*, which is a queue somebody works. A lead placed on the wrong desk
is opened once and never again.

Adding a seventh capability is two inserts — one in `outreach_vocabulary`, one
in `outreach_dimension` if it needs its own prompt heading. No deploy: the
prompt block is built by walking `outreach_dimension`, which is what that table
is for.

---

## 3. The prompts, and the one edit worth your hour

```sql
select key, temperature, note from public.outreach_prompt;
update public.outreach_prompt
   set body = $$...$$, updated_by = 'alex'
 where key = 'writer';
```

Takes effect on the next tick, ten minutes later.

**The writer prompt is the highest-value edit available anywhere in this
system.** Its three good and three bad worked examples are what every sentence a
stranger reads is modelled on, and they are in my voice rather than yours.

A migration replay will not overwrite an edit of yours: the seed only updates
rows whose `updated_by` still starts with `built`. Set it to your own name and
it is yours.

The prompts no longer repeat the vocabulary — the terms and their meanings are
assembled from `outreach_vocabulary` at run time — so they say *how to think*
rather than *what the words are*, and a new category does not need three prompt
edits to go with it.

This is safe to leave unreviewed because **the guards are in code, not in the
prompt**. A mangled prompt produces rejected verdicts and no observation,
visible in `outreach_status` within the hour. It cannot produce a confident
falsehood.

---

## 4. The settings, and the envelope they cannot leave

`outreach_setting` tunes every number the run uses. `guards.mjs` clamps each one
into a fixed range it will not exceed whatever the table says.

That envelope is the one set of numbers deliberately left in code. A setting
should make the system faster, slower, more or less talkative; it should not be
able to switch off a check. `max_words` set to 10000 would do exactly that.
Editable dials, fixed stops.

---

## 5. Priors that learn

`sector_service_prior` was ten rows of my opinion about Nottingham businesses,
written in an afternoon and never revisited. Whether a care home usually has a
rota problem is a claim that ought to get better as we assess care homes, and it
could not.

The seed stays — a cold start has to come from somewhere, and an opinion you can
read beats no opinion. But the scout is now shown, beside it, **what the
assessments have actually found in that sector**, once there are enough of them
to be worth showing (`prior_min_sample`, default 8).

They are shown side by side and never blended. A blend hides which one was wrong.

```sql
select * from public.sector_prior_drift;
```

Seed against observed, per sector. **Where these disagree on a decent sample,
the seed row is wrong and should be edited** — that is the maintenance job this
system has instead of retraining.

### The triage corrects itself too

The sector used to be a substring parsed out of the free-text `signals` column
on every batch, which meant a misclassification could not be fixed because there
was nowhere to write the fix. *The Albert Hall (Nottingham)*, a concert venue,
was filed as a professional practice.

`sales_leads.sector` is a real column now, and the scout is given the list of
sector keys and told to contradict the triage where the page disagrees.
Corrections are written back with `sector_source = 'assessment'`.

Sixty-one of the 149 leads have no sector at all, because the keyword triage
never matched them. Those get *"work entirely from the page"* — and the scout
can file them.

A correction never overwrites `sector_source = 'human'`. Somebody who has spoken
to the business outranks a model that read their homepage.

---

## 6. What is still static, and should be

- **The guards.** All of `guards.mjs` except the term names it does not know.
- **The clamp envelope.** §4.
- **The pipeline shape.** Three agents in that order. Everything each agent
  knows and says is data; that there are three of them is code. A fourth would
  be a real change, not a row, because nothing could infer what to do with it.
- **The two axes.** That there are exactly two — how they arrive, and what the
  work is — is a fact about how the practice is organised, not a setting. The
  terms on each axis are rows.
- **`sales_leads` will not store an observation without evidence**, and a
  trigger refuses any verdict whose confidence term demands evidence and has
  none. Both are constraints rather than conventions, on purpose.
