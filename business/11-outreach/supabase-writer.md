# The outreach writer, running in Supabase

**Status: live on the project, waiting on one secret.**
Applied 14 September 2026.

---

## 1. What you have to do

One thing.

**Supabase dashboard → Project Settings → Edge Functions → Secrets → Add new secret**

```
Name:  GEMINI_API_KEY
Value: your key from aistudio.google.com/apikey
```

That is the whole handover. Within ten minutes the first three leads get an
observation, and roughly eight hours later all 149 do.

Nothing else needs setting. The shared secret that stops strangers driving the
endpoint was generated in the database, lives in Vault, and is never read by a
person — asking you to paste a second secret to protect a job that spends a free
allowance would be ceremony.

### Watching it

```sql
select * from public.outreach_status;
```

```
waiting             how many leads still need an observation
written             how many have one
given_up            failed three times and stopped being retried
distinct_sentences  against written — the number this exists to move.
                    In August it was 9 across 77 drafts.
last_run            when, how many, and any error
today_by_model      requests spent per model today
```

If `written` is still 0 an hour after you set the key, the answer is in
`last_run.error` or in `select * from public.outreach_runs order by id desc`.

---

## 2. What it does

```
pg_cron, every 10 minutes
  → outreach-writer edge function, 3 leads
      → register facts + the sector prior            £0
      → fetch the business's own homepage            £0
      → ASSESS Flash-Lite, cold  → web presence, five service verdicts,
                                   credit fit, findings with quotes
      → VALIDATE every verdict                       code
      → WRITE  Flash, hot        → the clause
      → VALIDATE the clause                          code
      → store the assessment and the observation
  → page text is never persisted at all
```

What the assessment contains, and the rule it is built around, is in
[`service-fit.md`](service-fit.md). The short version: it is a **hypothesis**,
every verdict carries the question that would confirm it and the answer that
kills it, and an inference can never be recorded as a strong fit.

**It does not send.** `approval-gates.md` says both gates are human and both are
before sending, and that *"anyone proposing to move a gate downstream to increase
throughput has misunderstood what the gate is for"*. This fills the queue up to
the gate and stops. The drafts are still unapproved when it finishes.

Your morning job is unchanged: open the CRM, read what it wrote, approve or bin.

---

## 3. Why two models

| Stage | Model | Temp | Why |
|---|---|---|---|
| read | Flash-Lite | 0.2 | Extraction. High volume, low judgement, and Flash-Lite has 1,000 requests/day against Flash's 250 |
| write | Flash | 0.95 | Prose. Low volume, all judgement, and only leads that got something out of read reach it |

Budgets are tracked **per model, per Pacific day** — that is when Google resets
RPD. The published figures are what we *try*; a 429 is what we *believe*. When
the API rate-limits a model, the count we actually reached is recorded as that
model's ceiling and honoured from then on, so a stale published number costs one
wasted request rather than a wrong answer.

---

## 4. Why generated prose is safe here

Three checks, all in code, all of which reject rather than repair:

1. **A page claim must quote the page** — and the quote must be one the *read*
   stage already verified against the fetched text. Two gates, not one.
2. **A register claim must cite a fact we supplied.** Without this the model can
   decide a care-sounding company is CQC-registered, which is the single most
   damaging thing this stage could invent.
3. **Shape and content rules**: 6–45 words, a lower-case clause, no person's
   name, no number or date that was not in the material.

Anything rejected leaves the lead untouched and increments a counter. Three
failures and the lead is left alone rather than burning the allowance on the
same broken page.

The database enforces the last line of it: `sales_leads` will not accept an
observation without its evidence. An unsourced claim about a stranger's business
is the thing this design exists to prevent, so it is a constraint rather than a
convention.

---

## 5. What leaves the building

The prompts carry register facts and the business's own public page text. **No
company name, no contact route, no address, nothing else from the database.**

That is what makes a free tier which trains on submissions usable at all. Keeping
the boundary in the request rather than in a policy means it holds whoever edits
this next, and it makes the provider a swappable detail rather than a legal
question.

Page text is deleted the moment the observation is written, and anything older
than a day is swept at 04:17 regardless. The evidence quote — what we would have
to produce if someone asked where a claim came from — stays on the lead.

---

## 6. Honest limitations

- **The facts are thinner than the local pipeline's.** `sales_leads` does not
  carry the CQC, ICO, FSA and Charity Commission columns that `merge.mjs`
  produces; those live only in the local working files. Today the writer has
  trading years, the SIC description and the page. When those columns land, add
  them to `factsFor()` in the edge function and the write stage gets richer
  material with no other change.
- **No robots.txt check.** The local `extract-contacts.mjs` obeys robots.txt and
  crawl-delay; this fetches one homepage per lead with a ten-minute gap between
  ticks and an identifying user agent. Defensible at this rate, and it should
  match the local politeness before volume goes up.
- **All 149 leads are `marketing_status = 'do_not_contact'`**, which is
  `promote.mjs`'s default when `--permit` was not passed. That does not block the
  writer — see §2 of `personalisation-and-hooks.md` for why — but it *does* block
  sending, which is correct and stays your decision.
- **The prompts are in my voice, not yours.** The worked good and bad examples
  in `WRITE_SYSTEM` are what every sentence is modelled on. That is the one part
  that cannot be delegated, and it is worth an hour.

---

## 7. Turning it off

```sql
select cron.unschedule('outreach-writer');
```

Re-enable by re-running `202609140003`. Removing the `GEMINI_API_KEY` secret also
stops it — the function then answers 503 and writes nothing, which is the state
it is in as this is written.
