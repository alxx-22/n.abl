# Pulling leads from scratch, with a model

**Status: design, with one route ruled out on Google's own terms and a second
built in its place. Nothing here has been run.**

Written 16 September 2026, alongside
`supabase/migrations/202609160007_a_second_project_is_a_second_pool.sql`.

---

## 1. The obvious route is not available

The obvious implementation is: give a model Google Search grounding, ask it for
accountants in Newark, write down what comes back. It would work, and it is a
breach of the Gemini API terms — not a grey area, a named example.

> "it is a violation of these terms to use Grounding with Google Search to
> extract or collect one or more of these components for another purpose (for
> example, using programmatic or automated means to collect Links, using Links
> to build an index…)"

> "you will not, and will not allow your end user or any third party to, store
> (except as provided below), cache, copy, frame, … syndicate, resell, analyze,
> train on, or otherwise learn from Grounded Results."

Grounded results also have to be shown to the end user who submitted the prompt,
with their Search Suggestions attached, unmodified. A cron job writing rows into
`sales_leads` has no end user, shows nothing, and stores everything.

This is the same shape as the correction at the top of `sources.md`: Google Maps
was ruled out for building prospect lists for the same reason, in nearly the same
words, a month earlier. Ruling the approach out again from the other end of the
pipeline is not a coincidence — it is Google saying the same thing twice.

**So: no Google Search grounding in the discovery path.** Not at a lower request
rate, not with a delay, not "just for the first pass".

Source: <https://ai.google.dev/gemini-api/terms>, read 16 September 2026.

## 2. What is left, and it is more than it sounds

Discovery has two halves, and only one of them was ever the search engine's job.

| | |
|---|---|
| **Finding that a business exists** | A register. Companies House, ICO, FSA, CQC, the charity register — all lawfully obtained, all already in `sources.md`, all already fetched by `scripts/sourcing/fetch-*.mjs` |
| **Deciding it is worth writing to** | Judgement. This is the half a model is actually good at, and the half currently done by a keyword triage |

Today `promote.mjs` turns register rows into leads and `triage.mjs` classifies
them by keyword match on the SIC description. That is why the sector column has
the shape it has: it is not a decision, it is whatever the keywords hit.

**The prospector works over the registers, not over the web.** Given a town and a
brief, it reads register rows we already hold a lawful basis for, and argues for
the ones worth promoting — the same shape as the scout arguing angles, one level
earlier. Nothing it produces is a Grounded Result, because nothing was grounded.

Where a candidate has a website, the existing pipeline already fetches that
business's own page, which is lawful and is where every real signal comes from
anyway. The prospector does not need to invent a domain, and **must not**: see §4.

## 3. Why the second project, and why it is not negotiable

Gemini's free-tier quota is per project and per model within it. As of 10:14 on
16 September, on the single project:

| model | used | state |
|---|---|---|
| gemini-3.5-flash-lite | 496 | exhausted |
| gemini-3.5-flash | 21 | exhausted |
| gemini-flash-latest | 19 | exhausted |
| gemini-flash-lite-latest | 1 | exhausted |
| gemini-3.1-flash-lite | 2 | running |

Four of five pools spent before eleven in the morning, with 97 leads still
queued. A discovery stage sharing that key would not be slow, it would be dead on
arrival — and worse, it would take the writer down with it, because they would be
spending the same pool.

A second project is a second pool. That is the argument, and it is a capacity
argument rather than a clever one.

**The caveat, recorded when it was found and not since withdrawn.** Google's
enforcement notice describes "attempts to circumvent quota restrictions by
operating multiple projects as a single project". Two projects doing two
different jobs on two different schedules is not that, and the honest test is
whether we would describe the setup to Google in those words. Here we would:
discovery and drafting are separate pipelines, with separate prompts and separate
cadences. If that stops being true — if the second key is ever used to keep the
writer going after the first key's pool runs out — it becomes exactly the thing
the notice names, and the right answer then is to pay.

## 4. The guards, which matter more here than anywhere else

The writer pipeline's failure mode is an embarrassing sentence. Discovery's
failure mode is **writing to an address that does not exist, or to the wrong
business entirely**, and that is not recoverable by editing a prompt.

1. **No contact route from a model. Ever.** Not an email, not a phone number, not
   a domain. A model may say a business is worth looking at; it may not say how
   to reach them. Contact routes come from the extraction stage reading the
   business's own page, or they stay null. An invented email address is the
   single worst thing this system could produce, and it is exactly the kind of
   thing a model produces confidently.
2. **A company must resolve to a register row** before it becomes a lead. The
   prospector selects from candidates, it does not conjure them.
3. **A website must be fetched and must mention the business** before it is
   stored, and directory and aggregator domains are rejected outright — a Yell or
   Facebook page is not the business's own site, and the scout would read the
   wrong thing off it.
4. **Deduplicate on normalised domain and normalised name** against
   `sales_leads`. Writing twice to one business breaks the promise in
   `first-contact-letter.md`.
5. **`marketing_status = 'do_not_contact'`**, as `promote.mjs` already does.
   Discovery is not approval.

## 5. What Article 14 needs, and it is not the current footer

Every lead today carries `source = 'companies_house'` and the letter footer says
so. That sentence is the Article 14 source disclosure and it has to be **true for
that lead**.

A lead the prospector found through a different register gets that register's
name in `source`, `source_detail` and `source_date`, and the footer follows the
lead rather than the programme. The CRM's footer already branches on `l.source`
and falls through to "in public business information", so the mechanism exists;
what does not exist yet is a branch per register.

`LIA-2026-08-v1` assessed the register-sourced list. A discovery pipeline that
promotes on a model's judgement rather than a keyword rule is a different
processing operation on the same lawful basis, and the balancing test should be
re-read before the first letter goes out — not because the answer is likely to
change, but because "we did not re-read it" is the finding, not the outcome.

## 6. What is built and what is not

**Built, 16 September:**

- `outreach_model.key_secret` — which project a model row is called with,
  constrained to `^GEMINI_[A-Z0-9_]*$` so a registry row can never name
  `SUPABASE_SERVICE_ROLE_KEY`.
- `outreach_model_usage` keyed by `(usage_day, model, key_secret)`, so the second
  project's pool is counted separately instead of spending the first's.
- `outreach_config()` hands the edge function the **name** of the secret. The
  value is never in the database and never travels over that call.
- The edge function reads the named secret through one allowlisted accessor, and
  skips a model whose secret is not set rather than failing the run.

**Built, 22 September — the lead puller, as a local script, with both keys as
placeholders:**

| file | what it is |
|---|---|
| `scripts/sourcing/puller.mjs` | the logic, pure: no network, no filesystem, no `process.env`. Same rule as `guards.mjs` |
| `scripts/sourcing/pull.mjs` | the runner — the only part that reads the environment, calls the network, writes a file |
| `scripts/sourcing/pull-test.mjs` | 117 checks, no key, no network. `npm run test:pull` |
| `scripts/sourcing/sic-2007.mjs` | the 731 SIC codes, vendored from Companies House's published list |

It is **a new source, not a new pipeline.** It writes
`.sourcing/candidates-<date>-api-<tag>.json` in exactly the bulk fetcher's
envelope and field names, so `merge.mjs` picks it up as a Companies House
source and `triage → find-websites → extract-contacts → promote` run on it
unchanged. Proven end to end against a stand-in Companies House and Gemini:
merge accepted the file and triage classified the sector correctly.

```
npm run sourcing:pull:dry -- --location Nottingham --sic 432,433   # no request; shows the URL and which keys are set
npm run sourcing:pull     -- --location Nottingham --sic 432 --since 2016-01-01
npm run sourcing:pull     -- --location Alcester --judge --only strong,possible
```

**The placeholders.** `COMPANIES_HOUSE_API_KEY` and `GEMINI_DISCOVERY_API_KEY`
are empty lines in `.env.local.example`, and `set-keys.sh` / `set-keys.ps1`
prompt for both — `./scripts/set-keys.sh --companies-house` asks for just the
one. Neither is a string to paste over in a tracked file; that is the rule both
scripts already state. Until they are filled, the dry run works and reports them
missing, and the real run refuses before any request.

**What the tests prove, and how.** Six critical rules were each deliberately
broken in turn to confirm the suite catches them: contact routes stripped from
the checks (six tests went red), the discovery key falling back to the writer's,
verdict fields leaking onto a candidate, SIC left bare, the same company kept
twice in one pull, and invented ids accepted. All six were caught.

**Guards, in code rather than in the prompt:**

- The model is shown opaque ids (`p1`, `p2`), never company numbers, and any id
  it was not given is refused — so an invented company cannot look plausible.
- It is never shown a company number, postcode or street. It sees the name, the
  register activity, years trading, the kind of company and the town.
- A verdict carrying an email address, web address, phone number or real UK
  postcode is **refused whole**, not redacted — including one smuggled in an extra
  field. The postcode check uses the real list of UK postcode areas, so
  `GQ1 2AB`-shaped noise is not a false positive.
- `applyVerdicts` copies exactly three named fields. No `email`, `phone` or
  `website` can reach a candidate from a model.
- The prospector **refuses** to run on `GEMINI_API_KEY`. It is the writer's quota.
  `set-keys` refuses to write the same value to both.
- Dormant (99999), non-trading (74990), residents' management (98000) and
  private-household (98100, 98200) companies are refused at source.
- Every pulled company still arrives `do_not_contact` through `promote.mjs`.

**Two things not yet verified against the live API,** because nobody has a key
yet. `--dump-first` prints the first raw item on the first real run so both can be
checked in one go:

1. The response field names. Taken from Companies House's documented examples,
   not a live response. `normaliseItem` tolerates any of them being absent.
2. Whether list parameters (`sic_codes`, `company_type`) are comma-joined or
   repeated. Comma-joined is the Companies House convention; the dry run prints
   the exact URL.

### A bug this surfaced, which the puller works around but does not fix

**`sales_leads` has no unique constraint except its primary key.** So the
`on conflict do nothing` in `promote.mjs` never has anything to conflict on, and
loading the same company twice creates two leads — which means two first letters.
`build-load-sql.mjs` describes the load as idempotent; for leads, it is not.

The puller deduplicates before anything reaches the load: by company number first
(including the number the CRM stores inside `subscriber_type_evidence`), then by
name and postcode or a distinctive name, but only against records that have no
number — two different numbers are two different companies. A second identical
pull finds everything already known and writes nothing.

It can only dedupe against what it can see locally. To include the leads already
in the CRM, save them to `.sourcing/existing-leads.json` (gitignored) before a
pull:

```sql
select company, location, subscriber_type_evidence from public.sales_leads;
```

The proper fix is a column and a unique index on the company number. Not done
here: it is a schema change, and `sales_leads` has 149 rows to backfill first.

## 7. Built, 23 September — the agents, live in Supabase and in the CRM

The prospector now runs as the `lead-prospector` edge function, in the same
frame as the outreach writer: agents, prompts, models and settings are rows, not
code; the model registry is the same `outreach_model` table with the same
per-model daily budget and 429 handling, switching down each role's chain when a
model runs out; and a `pg_cron` job wakes it every five minutes with the same
vault-held cron secret the writer uses. **It does nothing until somebody presses
Run** on a target in the Lead gen tab.

**Who does what, per business, one stage per tick and resumable:**

1. **Research** reads the Companies House row and up to three pages of the
   business's own site, and lists facts, each with a quote. A quote that is not
   on the page is struck by code. The page text has contact routes and the
   company number removed before any agent reads it.
2. **Signals** turns those facts into signals, each resting on named facts.
   Research reviews them and can send them back — up to `signal_reviews` rounds.
3. **Sales** sets the signals against the service portfolio and picks up to
   `max_services` services, each resting on named signals.
4. **Specialists** — one per picked service (AI, automation, data and analytics,
   software, web) — each argue the score with sales. A specialist can also bring
   in another specialist it thinks fits better.
5. **Agreement.** A service is scored only when one side accepts the other's
   *exact* number. "Agree" with a different number is a counter, not agreement.
   No agreement in `agreement_turns` turns is **disputed**, and a disputed
   service scores nothing. The business's score is its best agreed score.

**Each specialist knows its service** from `business/knowledge/services/<service>/service.md`
— what the service is, the signals that point to it and away from it, what kills
it, how that specialist scores and the one question that settles it.
`npm run knowledge:services` turns the folders into a migration;
`npm run test:service-knowledge` fails if the folders and the migration drift.

**The log is what they said.** Every reply is stored exactly as the model
returned it, with who it was from and who it was addressed to. Nothing
summarises it. Where code overruled a reply (a struck quote, an "agree" with the
wrong number) that is stored separately and shown as code, not as an agent. The
outreach writer's log was changed to the same rule. Both are read in the CRM
through **View argument log**.

**In the CRM, Lead gen tab:** a target (towns, SIC codes or prefixes,
incorporated between), Save / Run / Stop, the last tick including anything that
went wrong (a missing key shows here), every candidate with its agreed and
disputed services, the question to ask and when to walk away, and **Promote**,
**Dismiss** and **Argue it again**. A promoted lead arrives `do_not_contact`.

**Two secrets, and only two** — Supabase → Edge Functions → Secrets:

| secret | what |
|---|---|
| `COMPANIES_HOUSE_API_KEY` | the Companies House REST key |
| `GEMINI_DISCOVERY_API_KEY` | the key from the new Google project |

The cron secret already exists in the vault and is shared with the writer. The
function refuses `GEMINI_API_KEY` outright.

**Deploying.** The Supabase CLI deploys `supabase/functions/lead-prospector` as
it is. Through a channel that takes one payload, `npm run bundle:edge -- lead-prospector`
builds a deterministic single file whose sha256 can be checked against the
deployed copy.

**Tests:** `npm run test:prospector` (the agents' guards: quotes, agreement,
page redaction), `npm run test:pull` (the writer's key is never used for discovery), `npm run test:outreach-guards` (the log is
verbatim), `node scripts/check-crm-usability.mjs --harness --component leadgen`
(the tab on phones, tablets and desktops).

**What is needed from a person**, once, and never through a chat transcript:

1. A Companies House REST key — developer.company-information.service.gov.uk →
   Your applications → Create an application (Live) → Add a new key → REST.
2. A new project in Google AI Studio, and an API key in it.
3. Both into Supabase → Edge Functions → Secrets under the names above. For the
   local script, `./scripts/set-keys.sh` (or `set-keys.ps1`) puts them in
   `.env.local`.
