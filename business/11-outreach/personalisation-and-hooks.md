# Personalisation and hooks

How a first contact gets the one true thing it says, and where that thing comes
from.

**Status: decided 13 September, built 14 September.** Steps 1, 2 and 4 of §6 are
done: [`hooks.md`](hooks.md) and `scripts/sourcing/hooks.mjs` carry the library,
`observe.mjs` reads the registers first, and `scripts/sourcing/scan.mjs` handles
the residual and is waiting on an API key. Step 3, the drip, is not started.

**Depends on:** `10-lead-sourcing` (the registers), `approval-gates.md` (gate 2
is where the copy is checked), `deliverability.md` (the cadence).

---

## 1. The word "personalised" means something specific here

In ordinary sales language a personalised message is one addressed to a named
human. **In this system that is the one thing it must never be.**

`first-contact-letter.md` §1 states the rule and the reason: a letter addressed
to a role identifies a building and a job, so no personal data is processed and
UK GDPR is not engaged. Put a name on it and a lawful basis, an Article 14
notice, a balancing test and a tier ceiling all arrive at once. The same
principle already runs on the email side, where `extract-contacts.mjs` finds
named addresses, counts them and throws them away, because `sarah@` moves the
record from tier A to tier B.

So, for the avoidance of the obvious mistake:

> **Personalised = the observation is about them specifically.**
> **Not the salutation.**

This matters because every outreach product and every workflow template in
existence means the other thing, and a single merge field named `first_name`
would re-classify the whole programme silently, one message at a time.

---

## 2. Where the observation comes from

### The defect this fixes

`observe.mjs` reads the business's homepage and runs eight regexes over it.
Everything else known about the business is ignored.

`merge.mjs` builds every lead record carrying these fields, from five registers
already fetched at £0:

```
incorporated, sic, hygiene_rating, fhrs_id, business_type,
local_authority, ico_registration, charity_number,
cqc_location_id, provider, specialisms, trading_address,
payment_tier, public_authority
```

`observe.mjs` reads **none of them**. A grep for `fsa|cqc|ico|rating|hygiene|
incorporat|sic` in that file returns nothing.

The result was visible in the 21 August batch: of 77 drafts, 68 shared an
observation, because a homepage that trips none of the eight regexes falls
through to a generic description pulled from the page title.

### The order of preference

A register fact beats a homepage inference on every axis that matters:

| | homepage scan | register |
|---|---|---|
| Specificity | "you carry Gas Safe accreditation" | "your last FSA inspection was 12 Mar 2024, rated 4" |
| Authority | what the business's marketing says | what an inspector recorded |
| Evidence trail | needs a cached page and a quote to validate against | `source`, `source_detail`, `source_date` already stored per field |
| Data leaving the country | page text to a processor | none |

So: **registers first, page second, model last.**

The evidence problem largely disappears under this ordering. A claim sourced
from the ICO register is already provenanced by the pipeline that fetched it,
which is why there is nothing here about caching pages and validating quotes
against them — that machinery is only needed for the residual.

---

## 3. The hook library

What exists today is a *rule* about what makes an observation good
(`first-contact-letter.md` §6: filler is a leaflet, not a letter). What does not
exist is a *library* of them.

That library is the missing artefact, and it is ordinary writing — no key, no
provider, no model. Each entry maps a signal already in the record to a
checkable hook to the service it points at.

Starting set, to be written properly in `hooks.md`:

| Signal | Hook | Points at |
|---|---|---|
| `cqc_location_id` + `specialisms` | rota, visit logging, medication records, CQC evidence | the pitch `fetch-cqc.mjs` already writes in its own header |
| `hygiene_rating` + inspection date | inspection records kept on paper | document and record systems |
| `ico_registration`, no website | processes personal data, no digital front door | basic systems setup |
| `trading_address` ≠ registered office | real premises, real operations, real admin | operations |
| careers page, admin job advert | about to pay a salary for a job software does | automation |
| downloadable PDF price list | a price list that is out of date the day it is published | the same |

Each entry needs an example sentence **and the rule for when it does not
apply** — the second half is what stops a hook becoming filler. `observe.mjs`
already carries the cautionary tale: an early regex matched a title merely
starting with "home" and filed two working websites as holding pages.

---

## 4. Cadence: a drip, not a batch

Five to ten first contacts a day, each one read by a person before it goes.

This is not a compromise forced by quotas. Three independent constraints already
in this repository point at the same number:

1. `README.md` §"Things that must not be got wrong" 2 — "One person can properly
   read perhaps 20 to 40 personalised messages in a sitting. That number is
   also, by coincidence, a sane cold-sending rate for a warmed domain."
2. `deliverability.md` — a new sending domain earns reputation by ramping
   slowly. A 138-message batch from a cold domain is the worst possible opening.
3. Near-identical bodies are themselves a bulk-sender fingerprint. Volume and
   sameness are the same problem wearing two hats.

The consequence worth stating plainly: **at eight messages a day, the drafting
problem mostly disappears.** That is about twenty minutes of writing. Slop is
not a prose-generation problem, it is a having-nothing-specific-to-say problem,
and a person handed a good hook writes three good sentences quickly. The work
worth automating is finding and ranking the hook, not phrasing it.

---

## 5. Options considered and rejected

Recorded so they are not re-proposed from scratch.

### Staged free-tier model calls (Google AI Studio / Gemini Flash-Lite)

Proposed as: one model pulls the website, a second scans it, a third drafts the
email, run on a high-RPD free key.

Rejected as the *primary* design, for one reason and one reason only: it
optimises the wrong stage. Registers supply better observations than any model
reading a homepage, at zero calls. Once §2's ordering is applied, the residual
needing a model is small enough that provider choice stops being load-bearing.

Not rejected outright. It remains the right tool for the residual — leads with a
website and no register signal — and the design rule that makes it safe is
recorded here: **the prompt carries public page text only.** No lead record, no
contact route, no name. That keeps prospect personal data out of a US processor
that trains on submissions, and makes the provider a swappable detail.

Free-tier terms, checked 13 Sep 2026: Google uses submitted content to improve
its products, human reviewers may read it, and the terms say in terms *"do not
submit sensitive, confidential, or personal information to the Unpaid
Services."* Acceptable for a business's own published homepage. Not acceptable
for anything out of our database. If it is ever used, it needs a line in the LIA
and an entry in the ROPA, shaped like the existing Groq entry in `Legal.jsx`.

### Cloudflare Workers AI for the scan

Rejected on contention. Workers AI's free allocation is 10,000 Neurons/day
**account-wide**, and the portal assistant already lives there. A scan batch
costs roughly 3,300 Neurons — about a third of the portal's daily capacity — and
Cloudflare's failure mode is a hard error, not degradation. A batch job that can
take a client-facing service down is the wrong dependency, even when the numbers
currently have headroom.

Today the risk is theoretical: one client, two quotes, two meetings. It stops
being theoretical at roughly five active clients.

### n8n

Rejected. What it would be brought in to provide — pacing, backoff, resume,
don't-redo-completed-work — `find-websites.mjs` and `extract-contacts.mjs` each
already implement, with concurrency control, robots.txt crawl-delay obedience,
resumable `.jsonl` checkpointing and bounded retry on transient failures. Adding
Gemini quota handling on top of that is roughly thirty lines.

The cost that decided it is not the hosting fee — self-hosted n8n sits
comfortably in the Class 2 slot `15-compute` already defines. It is that
workflows live in n8n's database rather than in git, and the reasoning attached
to this pipeline is its most valuable part. `observe.mjs` explains why its
placeholder regex is anchored at both ends; `extract-contacts.mjs` explains
which LIA clause `sarah@` engages. Moved into node parameters, that is not
deleted but it is no longer diffable, greppable or reviewable.

n8n remains worth knowing as an implementation skill to sell. Learn it on a
client's problem, not by rebuilding working code.

---

## 6. Next actions

1. ~~Write `hooks.md`~~ — **done.** Seven register hooks in
   `scripts/sourcing/hooks.mjs`, each with its non-applicability rule, and
   [`hooks.md`](hooks.md) for the editorial judgement behind them.
   `npm run test:hooks` covers the ordering and the rules.
2. ~~Wire the registers into `observe.mjs`~~ — **done.** `promote.mjs` now
   carries the CQC, ICO, FSA, charity and Companies House fields through, and
   `observe.mjs` tries a register hook before it fetches anything.
3. **Build the drip** to the state machine `sequence-design.md` already
   specifies. Class 1, £0, and it warns against over-tooling it. **Not started**
   — the one piece of §6 still outstanding.
4. ~~Decide on a model for the residual~~ — **built, waiting on a key.**
   `scripts/sourcing/scan.mjs`, Gemini Flash-Lite, one call per residual lead.
   `npm run test:scan` proves the guard rejects a fabricated quote.

### What Alex has to do

1. **Read the sentences in `hooks.mjs` and make them sound like you.** They are
   correct and they are in my voice, not yours, which is the one thing that
   cannot be delegated. `hooks.md` §4 is the guidance.
2. **Get a Gemini key** at aistudio.google.com/apikey — free, no card — and
   check what RPM and RPD your dashboard actually shows. Google no longer
   publishes those figures, so `scan.mjs` defaults to a conservative guess and
   takes `GEMINI_RPM` and `GEMINI_RPD` from the environment.
3. **Run it once with `--dry-run`** before spending a single request. It prints
   which leads would be sent and how much text, and needs no key.

---

## 7. Findings recorded on the way

Unrelated to this decision, found while checking it, and not yet acted on:

- **`portal-assistant/index.ts` leads with a deprecated model.**
  `@cf/meta/llama-3.1-8b-instruct` was deprecated on 30 May 2026. The fallback
  chain is why the assistant still answers. The list wants refreshing against
  the current free-plan catalogue.
- **The Groq free-tier figure in this repository is stale.** `worker/index.ts`,
  `03-website/assistant-knowledge.md` and `03-website/public-assistant.md` all
  cite 14,400 requests/day. On Groq's current published limits that figure
  belongs to Llama Prompt Guard, a moderation classifier. General chat models
  sit near 1K RPD and 200K tokens/day. The "why Groq and not Workers AI"
  argument rests on the old number.
- **`llama-3.3-70b` was not found in Groq's free-tier table.** The public
  assistant runs on it. It may simply be unlisted; if it is not free-tier
  eligible, the public bot is one 429 from being down with nothing watching.
  Checkable only on the account's own limits page.
- **Live counts drifted from the 21 August report.** The database holds 149
  leads and 76 unapproved drafts, not the 150 and 77 reported at the time. The
  load file's 150 rows contain one duplicate company name.
