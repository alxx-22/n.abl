# The outreach writer, running in Supabase

**Status: live on the project, waiting on one secret.**
Applied 14 September 2026. Edge function v5.

---

## 1. What you have to do

One thing.

**Supabase dashboard → Project Settings → Edge Functions → Secrets → Add new secret**

```
Name:  GEMINI_API_KEY
Value: your key from aistudio.google.com/apikey
```

That is the whole handover. Within ten minutes the first three leads get an
assessment and a draft clause, and roughly eight hours later all 149 do.

Nothing else needs setting. The shared secret that stops strangers driving the
endpoint was generated in the database, lives in Vault, and is never read by a
person — asking you to paste a second secret to protect a job that spends a free
allowance would be ceremony.

### Watching it

```sql
select * from public.outreach_status;
```

```
waiting             leads still needing an assessment
assessed            leads we now understand
written             leads that also have a clause
given_up            failed three times and stopped being retried
distinct_sentences  against written — the number this exists to move.
                    In August it was 9 across 77 drafts.
sectors_corrected   leads the scout refiled after reading their page
rounds_by_decision  how the argument goes: promoted / wrote / refused /
                    rejected / promoted_nothing
today_by_model      requests spent per model today
last_run            when, how many, and any error
```

**`rounds_by_decision` is the new number to watch.** A refusal count of zero
means the writer is not applying its own rules. A refusal count near the
promoted count means the scout is arguing cases that cannot be written, and the
scout prompt is what needs changing — not the writer.

If `written` is still 0 an hour after you set the key, the answer is in
`last_run.error` or `select * from public.outreach_runs order by id desc`.

---

## 2. Three agents, one argument

```
pg_cron, every 10 minutes
  → outreach-writer edge function, 3 leads
      → outreach_config()  — vocabulary, models, prompts, thresholds   £0
      → register facts + the sector prior + what that sector has
        actually turned out to look like                              £0
      → fetch the business's own homepage                             £0

      → SCOUT   Flash-Lite, cold
                  the assessment: five category verdicts, web presence,
                  technical capacity, inbound volume, credit fit
                  then ARGUES up to four cases for the opening clause,
                  each with its evidence, its reason and its risk
      → VALIDATE every verdict and every case                         code

      → EDITOR  Flash-Lite, cool.  NEVER SEES THE PAGE.
                  promotes one case, says why the others lost,
                  writes the writer a one-line brief. May promote none.

      → WRITER  Flash, hot
                  writes the promoted case — or REFUSES it with a reason,
                  which goes back to the editor for a different case
      → VALIDATE the clause                                           code

      → store the assessment, the clause, and the whole argument
  → page text is never persisted at all
```

### Why the editor is blind

It is given the scout's cases with their quotes, and nothing else. Not a
limitation — the mechanism.

A case that needs the page to make sense will not survive the business reading
it either, because they are not holding our research. They are holding one
sentence from a stranger. Making the editor judge the argument on its own is the
same test the recipient applies.

It is safe to do because **every quote is checked against the page in code
before the editor sees it**. The editor can only choose between things already
known to be true, and promoting something that was never argued is rejected.

### Why the writer can refuse

Previously a writer that could not honestly phrase the chosen angle failed the
lead, and the lead went back in the queue to be assessed again from scratch.
Now it hands the angle back with a reason, the editor promotes its next-best
case, and the lead usually survives on the second-best true thing rather than
on nothing. Two rounds by default.

A refusal is the writer saying *"this cannot be written without claiming more
than the evidence supports"*, which is the most useful sentence in the system.
It is logged.

### Reading the argument back

```sql
select * from public.lead_argument where company = 'SOME COMPANY LTD';
```

Every move, in order: what the scout argued, what the editor promoted and why,
whether the writer took it. **When a draft looks wrong, the mistake is usually
in what the editor promoted, not in how the writer phrased it**, and this is
where you see that.

**It does not send.** `approval-gates.md` says both gates are human and both are
before sending. This fills the queue up to the gate and stops. Your morning job
is unchanged: open the CRM, read what it wrote, approve or bin.

---

## 3. Why three models and which

| Agent | Model | Temp | Why |
|---|---|---|---|
| scout | Flash-Lite | 0.15 | Extraction and judgement at volume. Flash-Lite has 1,000 requests/day against Flash's 250 |
| editor | Flash-Lite | 0.3 | Judgement over a short argument, and it may run twice a lead |
| writer | Flash | 0.95 | Prose. The only stage a stranger reads, and the only one worth the smaller allowance |

None of that is in the code. It is `public.outreach_model`, and swapping a
deprecated model for its successor is an UPDATE.

Budgets are tracked **per model, per Pacific day** — that is when Google resets
RPD. The published figures are what we *try*; a 429 is what we *believe*. When
the API rate-limits a model, the count we actually reached is recorded as that
model's ceiling and honoured from then on, so a stale published number costs one
wasted request rather than a wrong answer.

---

## 4. Why generated prose is safe here

Four checks, all in code, all of which reject rather than repair:

1. **A page claim must quote the page** — and by the time the writer sees it,
   that quote has been checked twice: once when the scout's verdict was
   validated, once when its case was.
2. **A register claim must cite a fact we supplied.** Without this the model can
   decide a care-sounding company is CQC-registered, which is the single most
   damaging thing this stage could invent.
3. **Every digit must appear in the material.** "trading since 2003" for a
   business whose incorporation year nobody gave us is the most
   plausible-sounding falsehood this stage can produce and the hardest to catch
   by eye, because it reads like research.
4. **Shape rules**: 6–45 words, a lower-case clause, no person's name.

Anything rejected leaves the lead untouched and increments a counter. Three
failures and the lead is left alone rather than burning the allowance on the
same broken page.

The database enforces the last line of it. `sales_leads` will not accept an
observation without its evidence, and a trigger on `lead_service_fit` refuses
any verdict whose confidence term the registry marks as needing evidence and
which has none. An unsourced claim about a stranger's business should be
impossible to store by any route, including a careless UPDATE at the SQL prompt.

---

## 5. What leaves the building

The prompts carry register facts, the sector prior, and the business's own
public page text. **No company name, no contact route, no address, nothing else
from the database.**

That is what makes a free tier which trains on submissions usable at all.
Keeping the boundary in the request rather than in a policy means it holds
whoever edits this next, and it makes the provider a swappable detail rather
than a legal question.

Page text is never written to disk. The evidence quote — what we would have to
produce if someone asked where a claim came from — stays on the lead.

---

## 6. Honest limitations

- **Nothing has been run against a real page yet.** The guards and the
  negotiation are tested; the plumbing is verified end to end; the *quality* of
  what three models say to each other is unknown until the key is set. Read the
  first ten before trusting the eleventh, and read them in `lead_argument`
  rather than only in the CRM.
- **`index.ts` is not covered by any test**, because it needs Deno and the
  machine this was built on has Node. That is why the guards and the
  negotiation loop were moved into `guards.mjs`, which the test imports
  directly. What remains untested is the HTTP and the prompt assembly.
- **The facts are thinner than the local pipeline's.** `sales_leads` does not
  carry the CQC, ICO, FSA and Charity Commission columns that `merge.mjs`
  produces. Landing those columns, and adding a row per register to
  `outreach_fact_rule`, is the biggest single upgrade available.
- **No robots.txt check.** One homepage per lead, ten minutes apart, identifying
  user agent. Defensible at this rate; it should match `extract-contacts.mjs`'s
  politeness before volume goes up.
- **All 149 leads are `marketing_status = 'do_not_contact'`**, which is
  `promote.mjs`'s default when `--permit` was not passed. That does not block
  the writer — see §2 of `personalisation-and-hooks.md` — but it *does* block
  sending, which is correct and stays your decision.
- **The prompts are in my voice, not yours.** The worked good and bad examples
  in the writer prompt are what every sentence a stranger reads is modelled on.
  That is the one part that cannot be delegated, it is an `UPDATE` and not a
  deploy, and it is worth an hour. See [`registries.md`](registries.md).

---

## 7. Turning it off

```sql
select cron.unschedule('outreach-writer');
```

Re-enable by re-running `202609140003`. Removing the `GEMINI_API_KEY` secret also
stops it — the function then answers 503 and writes nothing, which is the state
it is in as this is written.
