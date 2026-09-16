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

## 2. An argument, in five stages

```
pg_cron
  → outreach-writer edge function, a few leads
      → outreach_config()  — vocabulary, models, prompts, thresholds   £0
      → register facts + the sector prior + what that sector has
        actually turned out to look like                              £0
      → fetch the business's own homepage                             £0

      → SCOUT       Flash-Lite, cold
                      the assessment: category verdicts, the capability
                      each would be, web presence, technical capacity,
                      inbound volume, credit fit
                      then ARGUES up to four cases for the opening
                      clause, each with its evidence, reason and risk
      → VALIDATE    every verdict and every case                      code

      → EDITOR      Flash-Lite, cool.  NEVER SEES THE PAGE.
                      promotes one case, says why the others lost,
                      briefs the writer. May promote none.

      → STRATEGIST  Flash-Lite, cool.  NEVER SEES THE PAGE EITHER.
                      what the promoted case MEANS for this business:
                      the tension, the moment they would recognise, and
                      what it must not be read as implying.
                      The only stage that sees the sector and the
                      capability.
      → VALIDATE    a brief with no tension is refused                code

      → WRITER      Flash, hot
                      writes the clause — or REFUSES it with a reason,
                      which goes back to the editor for a different case
      → VALIDATE    the clause, including the hedges                  code
      → EDITOR      reads the SENTENCE, may ask for one change

      → LETTER      Flash, hot
                      the whole first-contact body, four or five short
                      paragraphs, built around the clause
      → VALIDATE    shape, compliance, and the automation tells       code
      → the trading name is substituted in HERE, after the checks

      → store the assessment, the clause, the letter, and the argument
  → page text is never persisted at all
```

### Why the strategist exists

It was added on 15 September because of one sentence:

> you mention using a unique diary system to ensure VAT deadlines are not
> missed, which typically relies on someone manually updating those entries to
> keep them accurate

True, and useless. A quote, a paraphrase, a hedge, and nothing that follows
from any of it — the shape of an answer to a comprehension question rather than
a reason to write to somebody.

Nobody owned the step between *choosing* a true thing and *phrasing* it, so the
writer was doing both in one breath. The strategist owns that step and nothing
else. On the same observation it now produces:

> **tension** — the compliance diary works until a client sends late records and
> the entire schedule has to be shifted by hand
> **they would recognise** — the Tuesday afternoon spent recalculating six other
> deadlines because one return arrived with missing receipts

Nothing was added. It is a different message.

[`sales-language.md`](sales-language.md) is the full account and the source the
strategist's prompt is written from.

**A strategist that fails does not cost the lead.** It logs `no_hook` and the
writer proceeds on the editor's brief. Losing a business because a fourth model
had a bad minute would be a worse trade than one flatter sentence.

### Why there is no company name in any of this

There never was, and the letter did not change it. The prompt writes
`{business}` where a name belongs and the substitution happens in the edge
function after every check has passed. A model that invented a name instead is
refused rather than quietly corrected.

The slot is optional: the first version required it and threw away a letter
that addressed them as "you" throughout, which was better writing than a
name-drop. A guard that refuses better writing is a bad guard.

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

- **No lead can reach a band, and that is a question for the ICP.**
  `scoring-model.md` §6 puts `shortlist` at 70 out of 100. Two of the five
  dimensions are worth 35 between them and score zero on every lead we hold, by
  decisions taken deliberately elsewhere: `size` needs an employee count and
  §5.2 says it is never estimated, `decision_access` needs a named individual
  and the lawful basis covers corporate subscribers only. So the denominator
  tops out at 65, the scorer records `unbanded_incomplete_coverage` rather than
  pretending, and the CRM says so on the lead. The fix is to decide in the ICP
  what a shortlist means when two dimensions are structurally uncollectable —
  not to lower a number here.
- **Half the signals catalogue has no pattern.** `scoring-model.md` §5.4 lists
  seven tier 1 codes; a homepage can honestly establish two of them, and until
  15 September only one had a pattern — which, it turned out, had never matched
  once in twenty-four page reads, because it demanded the literal words "for a
  quote". `role_addresses` and `fleet_visible` (tier 2) are visible and
  unimplemented; `new_director` and `late_filings` (tier 3, five each) are
  register facts we do not pull. Roughly sixteen more points of headroom, none
  of it invented.
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
- **No robots.txt check.** One homepage per lead, identifying user agent.
  Defensible at the scheduled rate; it should match `extract-contacts.mjs`'s
  politeness before volume goes up. The schedule is a `cron.alter_job` away from
  every minute, and a re-run of the whole list is exactly that — so this is the
  limitation that binds first when you drain the queue in a hurry.
- **All 149 leads are `marketing_status = 'do_not_contact'`**, which is
  `promote.mjs`'s default when `--permit` was not passed. That does not block
  the writer — see §2 of `personalisation-and-hooks.md` — but it *does* block
  sending, which is correct and stays your decision.
- **The prompts are in my voice, not yours.** The worked good and bad examples
  in the writer prompt are what every sentence a stranger reads is modelled on.
  That is the one part that cannot be delegated, it is an `UPDATE` and not a
  deploy, and it is worth an hour. See [`registries.md`](registries.md).

---

### A batch is claimed, so two runs cannot collide

`outreach_next_batch` stamps `observation_claimed_at` on the rows it hands out,
inside the same statement that selects them, with `SKIP LOCKED`. A second run
takes the next leads rather than the same ones.

That did not matter while the queue moved three leads every ten minutes; it
matters the moment you speed it up to re-run the list, because two overlapping
runs would read the same homepage, spend four model calls each on it, and race
to overwrite each other's sentence.

The stamp is a **lease**, not a flag: `outreach_setting.claim_ttl_seconds`
(ten minutes) decides how long a lead stays claimed before another run may take
it, so a run that dies mid-batch does not strand its leads. A claim is not an
attempt — a lead handed out and never shown to a model has not been tried, and
burning one of its three lives for that would discard leads nobody looked at.

### The previous sentence is kept

Re-assessing rewrites the observation, and `lead_observation_history` keeps what
was there, by trigger, before it goes. Two reasons: a re-run that comes back
refused three times must not leave a lead worse off than before it started, and
the only honest test of a prompt change is the same lead before and after.

---

## 7. Who the run is for

A run has a **target** — a row in `outreach_target` — and the cron uses the one
marked default.

| Filter | Works how |
|---|---|
| **Location** | `sales_leads.town`. Nottingham, Alcester, Newark |
| **Sector** | The triage's classification, known when the lead lands |
| **Service** | The **capability** — see the caveat below |
| **Minimum score** | A floor on `lead_score` |

**An empty list means no filter on that column**, never "match nothing". A target
with all four empty is the whole list, which is what the pipeline did before
targets existed — and that is what the seeded `Everything` target is, so applying
the migration changed nothing.

### Location is a town, because that is what a person filters by

It was the postcode district first, because that is what falls out of the address
string most cleanly, and because `scoring-model.md` §5.1 decides *territory* by
district for a good reason: matching "Beeston" against free text will match an
address in Leeds.

That reason does not carry over. Territory classification runs offline against
every company in the country; this filter runs against 148 leads that are already
in the list, and nobody asked to run outreach on NG7 — they asked to run it on
Nottingham. Two different jobs, two different handles.

`lead_town(text)` derives it: strip the postcode, strip the county, take what is
left after the last comma, and fall back one comma when that turns out to be a
street or a unit rather than a place. It is right for almost all of them and
wrong for a few, because a free-text address is not a structured one — "Market
Place, NG17 1AQ" contains no town at all.

So `town` is a **plain, editable column filled by a trigger on insert**, not a
generated one. A generated column would re-derive the same mistake on every write
and refuse to be corrected. Derive what can be derived, then let a person fix the
rest; a corrected town survives every later write.

### The capability filter cannot work the obvious way

Capability is what the run **discovers**. A lead nobody has assessed has no
capability yet, so filtering it out would guarantee it never got one.

So the rule is: a lead that has been assessed must match, and a lead that has not
been assessed passes anyway. That makes the filter useful for *re-running* a
specialist's leads and useless for aiming a first pass at one — which is the
honest behaviour, and the CRM says so on the panel rather than leaving it to be
discovered.

### Saving a target is not starting it

These were one tickbox, and that was wrong. "This is the target the cron uses"
and "start running now" are different decisions, and a tickbox that did both
meant every edit to a filter was also a press of the start button.

So starting is its own verb:

- `outreach_start_run(target)` makes that target the default. It **refuses a
  target with nothing queued** — starting a run with no work is not a run, it is
  a silent no-op, and a silent no-op looks exactly like a broken cron.
- `outreach_stop_run()` clears the default and names what it stopped.
- `outreach_save_target(...)` carries whatever run state the target already had.
  It never starts anything and never stops what is already going.

**Nothing runs by default.** A target is running because somebody pressed Run on
it, never because it was the last thing edited.

### The off switch is an empty batch, not a stopped schedule

With no default target, `outreach_next_batch` returns nothing. The schedule keeps
ticking and does nothing.

That is deliberately not `cron.alter_job`. An empty batch cannot leave a lead
half-processed, and a schedule that never stopped is a schedule nobody has to
remember to restart.

### The count reacts before you commit to it

The CRM counts the reach of the filters **as they are on screen**, from the leads
it has already loaded, re-running the same four tests `outreach_target_reach`
makes. A filter whose effect you cannot see until after you save is a filter you
are guessing at. The database stays the authority: saving re-counts server-side
and that number replaces the local one.

### Which project a model is called with

Gemini's free-tier quota is per project, and per model within it. On 16
September, before eleven in the morning, four of the five registered models were
exhausted on the single key and the pipeline stopped with 97 leads queued. A
second project is a second pool.

`outreach_model.key_secret` names the environment variable holding that row's
key, so which project a role uses is a row and not a branch — adding a third is
an INSERT and a secret, not a deploy. `outreach_model_usage` is keyed
`(usage_day, model, key_secret)`, because otherwise the same model on a second
key would spend the first key's recorded budget and the second pool would be
invisible.

Two guards, one in each layer, because a registry row that could name any
environment variable could name `SUPABASE_SERVICE_ROLE_KEY`:

- a check constraint, `key_secret ~ '^GEMINI_[A-Z0-9_]*$'`
- the same test in the edge function, which reads env through one accessor and
  nowhere else

The value never enters the database. `outreach_config()` hands over the **name**;
the function looks it up. A model whose secret is not set is skipped with a
reason, not fatal — registering a role against a project whose key nobody has
added yet should cost that role its turn in the chain, not the whole run.

`business/10-lead-sourcing/ai-discovery.md` is what the second key is for, and
why the obvious way to use it is ruled out.

---

## 8. The send switch

**Nothing sends today, and the switch says why.**

`outreach_send_blockers()` returns what is actually in the way. As of 16
September that is four things, all true:

1. **No postal address.** PECR reg. 23 requires a real one; the letter renders
   `[trading address]`.
2. **No mail transport.** Nothing in this project can send an email.
3. **149 leads are `do_not_contact`** — `promote.mjs`'s default. Lifting it is a
   decision per business, not something a switch may override.
4. **No letter has been approved.** Gate 2 has never been used.

Arming is deliberately awkward: the target's name has to be typed back exactly,
and the database checks it again regardless of what the CRM did. Disarming asks
for nothing, because stopping should always be easier than starting. Saving a
target always disarms it — changing who a run is for is exactly the moment an
armed switch becomes dangerous.

The switch exists now, blocked and with the reasons written down, rather than
not existing and being added in a hurry on the day somebody wants to send.

### Gate 2 has a column now

`lead_letter.approved_at` / `approved_by`. A person reads the letter and sets it.
No pipeline writes it, and the blocker list counts it.

---

## 9. Turning it off

```sql
select cron.unschedule('outreach-writer');
```

Re-enable by re-running `202609140003`. Removing the `GEMINI_API_KEY` secret also
stops it — the function then answers 503 and writes nothing, which is the state
it is in as this is written.
