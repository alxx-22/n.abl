# Routing rules

**Status: written, never applied.** No task has yet been routed with this table,
because no client work has been done. The next action in the folder README is to
apply it to five tasks from `10-lead-sourcing/build-plan.md` and see whether two
people get the same answers.

This file is meant to be used, not read once. It is the thing you open before
you start building a piece of a job.

Last substantive revision: 2026-08-16.

---

## 1. The three classes, in one table

| | Class 1 | Class 2 | Class 3 |
|---|---|---|---|
| **What it is** | Ordinary code | A genuinely local open-weight model on our own PCs, via Ollama or llama.cpp | Claude |
| **Fee cost** | Effectively £0 | £0 in fees | Part of £36/month, flat |
| **Real constraint** | Our time to write it | Our hardware and our time | Usage capacity and review time |
| **Good at** | Rules, arithmetic, structure, anything with a right answer | Narrow repetitive judgement with a fixed output shape | Reasoning, architecture, difficult code, client-facing writing |
| **Fails by** | Not being written | Producing confident nonsense on anything ambiguous | Costing capacity you wanted for something else |
| **Share of a typical project** | The majority | A small, bounded slice | A slice at design time, rarely at run time |

**Class 3 is Claude.** Reasoning, architecture, difficult code and client-facing
writing. That is the whole list. It is not a general-purpose fallback for
"anything the other two found hard".

---

## 2. The one-minute test

Ask three questions in order and stop at the first yes.

```
1. Does this task have a right answer that a rule could produce?
   → yes: CLASS 1. Write the code. Stop here.

2. Is it repetitive judgement, on short text, with a fixed set
   of possible answers, that a person could do in five seconds?
   → yes: CLASS 2. Local model, with a schema and a fallback.

3. Does it need reasoning, architecture, difficult code, or writing
   a client will read?
   → yes: CLASS 3. Claude, deliberately, and reviewed.
```

If none of the three is a clear yes, the task is not specified well enough to
build. That is a design problem, not a routing problem, and paying for
intelligence will not fix it.

**Route at build time, not at run time.** You are deciding what to write, once.
There is no runtime router that inspects each request and picks a model.

---

## 3. The decision table

Work down the rows. The first row that matches the task decides it.

| # | If the task… | Class | Why |
|---|---|---|---|
| 1 | Has a deterministic right answer (parse, match, sort, count, compare, schedule, format, validate, transform) | **1** | Intelligence adds error to something arithmetic already gets right |
| 2 | Is a lookup against a list, table or pattern we control | **1** | A model asked to remember a list will occasionally invent an entry |
| 3 | Moves data between two systems | **1** | Integration is plumbing |
| 4 | Enforces a rule that must never be wrong (opt-out blocks, permissions, money) | **1** | A probabilistic answer is not an enforcement mechanism. Never route this above Class 1. |
| 5 | Assigns one of a small, fixed set of labels to short text | **2** | Classification is what small models are for |
| 6 | Extracts a handful of named fields from messy but short text | **2** | With a schema check on the way out |
| 7 | Scores or ranks against criteria that are genuinely fuzzy | **2**, but see row 8 | Only if the criteria resist being written as rules |
| 8 | Scores or ranks against criteria that could be written as weighted rules | **1** | `10-lead-sourcing/scoring-model.md` does exactly this. Arithmetic, not a model call. |
| 9 | Compresses a paragraph into a sentence with no stylistic requirement | **2** | Simple summarisation |
| 10 | Turns text into vectors for similarity or clustering | **2** | Embeddings run locally, cheaply, and forever |
| 11 | Rewrites text mechanically (tone-neutral tidying, casing, expansion of an abbreviation) | **2** | With a human reading the output if it will be seen outside |
| 12 | Requires holding several constraints at once and choosing between designs | **3** | Architecture |
| 13 | Is code that is hard, unfamiliar, security-relevant, or that you would want reviewed | **3** | Cheaper than the bug |
| 14 | Produces something a client will read with our name on it | **3** | Proposals, scopes, emails, documentation, the site |
| 15 | Is analysis where being wrong is expensive and the shape of the answer is unknown | **3** | Strategy, diagnosis, pricing arguments |
| 16 | Is an open-ended conversation with an ambiguous goal | **3** | Nothing else can hold ambiguity |
| 17 | Runs on every record, forever, at volume | **1**, or **2** if rows 5–11 apply | Never Class 3. See section 6. |
| 18 | Is none of the above | **stop** | Specify the task properly, then start again at row 1 |

---

## 4. Concrete tasks, already routed

Use this as a lookup before reasoning from first principles. Most tasks that
come up are already here.

### Class 1 — ordinary code, effectively £0

| Task | Note |
|---|---|
| CSV read, write, clean, reshape | The single most common thing in this business |
| Deduplication | Needs a real key: company number, then domain, then normalised name |
| Sorting, filtering, grouping, counting | |
| Date handling, working-day arithmetic, timezones | |
| Scheduling and timers | Including the outreach follow-up timer |
| Database operations, migrations, views, constraints | Including the credit ledger |
| Regular expressions and pattern matching | |
| HTML fetching and extraction | The enrichment stage of the lead pipeline |
| PDF generation | |
| API calls and webhook handling | |
| CRM reads and writes | |
| Email header parsing, bounce and auto-reply detection | `11-outreach` layer 1 |
| Opt-out phrase detection on a conservative fixed list | Must never be a model. See row 4. |
| Deterministic lead scoring from a facts record | `10-lead-sourcing/scoring-model.md` |
| Credit balance derivation and earliest-expiry-first drawdown | `13-credits/ledger-design.md` |
| Validation, comparison, alerting | |
| File conversion and renaming | |
| Access-key generation and rate limiting | Already built |

### Class 2 — local open-weight model, £0 in fees

| Task | Note |
|---|---|
| Reply classification into a fixed category list | `11-outreach` layer 2, eight categories |
| Sector or industry classification from a website description | The one bounded exception in `10-lead-sourcing` v3 |
| Spam and junk detection | |
| Sentiment, where a coarse answer is enough | |
| Basic field extraction from short messy text | Always with a schema check |
| Simple summarisation with no style requirement | |
| Embeddings for similarity, clustering and near-duplicate detection | |
| Simple mechanical rewriting | Human reads it if it leaves the building |

Every one of these needs three things before it counts as Class 2 rather than as
a gamble: a **fixed output schema**, a **defined fallback** when the schema check
fails, and a **measured accuracy figure** against labelled examples.

### Class 3 — Claude

| Task | Note |
|---|---|
| System architecture and schema design | |
| Difficult, unfamiliar or security-relevant code | |
| Debugging something genuinely confusing | |
| Proposals, scopes of work, client emails | |
| Site copy, documentation, training material | |
| Personalising an outreach letter | `11-outreach`, and a human approves it before and after |
| Strategic analysis and pricing arguments | |
| Reading a discovery transcript and distilling it | `09-welcome-pack/how-to-run-it.md` |
| Ambiguous conversation with no defined output | |

---

## 5. Tie-breakers

When two classes look plausible, these settle it.

**T1 — Volume beats capability.** If the task runs on every record forever,
route it down a class and accept a worse answer, or write better rules. A
per-record Class 3 call is a permanent cost attached to a growing table.

**T2 — Consequence beats convenience.** If being wrong is expensive, irreversible
or regulatory, route it down to Class 1 and make it a rule, or route it up to
Class 3 and put a human after it. What you must not do is leave it at Class 2
with nobody checking.

**T3 — Build once, run forever.** Class 3 at build time is cheap and fine. Class
3 inside the running system is a recurring liability. Use Claude to write the
rules; do not use Claude as the rules.

**T4 — If you can write the test, you can write the rule.** Anyone who can
describe what a correct answer looks like precisely enough to test it can
usually write the rule directly. That is Class 1.

**T5 — Ambiguity is the only real reason to go up.** Not difficulty, not volume,
not tedium. Only ambiguity that genuinely resists specification.

**T6 — When in doubt, go down and measure.** Try Class 1. If it is not good
enough, you will have a concrete failure to point at, which is a much better
input to the next decision than a hunch.

---

## 6. Escalation and demotion

### Escalating (Class 1 → 2, or 2 → 3)

Allowed only with all three of these:

1. A named failure. "The rules got 34 of 50 right, and here are the 16."
2. A statement of what the higher class is expected to fix.
3. A cost line: if it is Class 2, whose machine and how long; if it is Class 3,
   whether it runs once at build time or on every record forever.

"It feels like it needs AI" is not an escalation. It is a request for one.

### Demoting (Class 3 → 2, or 2 → 1)

Always allowed, no justification needed, and actively encouraged. The most
common real cost saving in this business is noticing that something routed to a
model three weeks ago is now well enough understood to be a rule.

Put a demotion review in the monthly review in `cost-tracking.md`. One question:
what did we pay for intelligence for this month that we now understand well
enough to write down?

---

## 7. Anti-patterns

**A1 — "It's local so it's free."** Only if it is genuinely open weights on our
own hardware. Claude Code running on your laptop is a local interface to a
cloud-hosted model. See the folder README.

**A2 — Using a model to decide which model to use.** A runtime router that
classifies incoming work is intelligence spent on a decision a person should
have made once, at design time, in writing.

**A3 — A model where a lookup table would do.** Country codes, VAT rates,
company suffixes, SIC codes. These are lists. Lists do not hallucinate.

**A4 — A model enforcing a rule.** Opt-out blocking, permissions, balances,
prices. `11-outreach` is explicit that the opt-out check runs before
classification and is never overridden by the model. Rules are code.

**A5 — Class 3 as a fallback for a failing Class 2 call.** When the local model
fails its schema check the answer is a recorded `unclear` and a human, not an
automatic upgrade. Otherwise every hard case silently becomes the expensive
path, and the failure rate becomes an invisible bill.

**A6 — Routing by how it feels to build.** Tedious is not the same as difficult.
Most tedious work is Class 1 and stays Class 1.

**A7 — Not recording the class.** If the breakdown is not written down at the
end of the job, `cost-tracking.md` has nothing to work with and `12-pricing` is
guessing about which work is profitable.

---

## 8. A worked routing

The master plan's standing example: a task that takes 12 hours a month at a £20
an hour loaded cost, £240 a month, reduced to 2 hours, £40 a month.

Assume the task is: someone downloads three supplier spreadsheets, matches them
against the order system, chases the mismatches by email, and produces a summary
for the owner.

| Piece of the job | Class | Reasoning |
|---|---|---|
| Fetch the three files on a schedule | 1 | Row 3 |
| Normalise headers and formats | 1 | Row 1 |
| Match rows against the order system | 1 | Row 1, with a real key |
| Flag mismatches by rule | 1 | Row 1 |
| Decide which mismatches are worth chasing | 1 | Row 8. Written as thresholds, not judged. |
| Draft the chase email | 1 | A template with fields. It goes to the same supplier every week; it does not need to be written fresh. |
| Classify the supplier's reply | 2 | Row 5. Fixed categories, short text, schema check, fallback to `unclear`. |
| Produce the monthly summary for the owner | 1 | Numbers and a table. Row 1. |
| Design the whole thing, and write the matching code | 3 | Rows 12 and 13. Once, at build time. |
| Write the handover document the client keeps | 3 | Row 14 |

Running cost: **£0 in fees.** One bounded Class 2 call per supplier reply, on our
own hardware. Class 3 was spent at build time and does not recur.

That is what the routing discipline is for. The client sees an implementation at
roughly £800 to £1,500 removing about £2,400 a year of labour, and the thing they
bought does not carry a per-record cost that grows with their business.

---

## 9. The half-page version

Pin this somewhere.

```
Right answer exists?          → Class 1. Write code.
Repetitive judgement,
  fixed answers, short text?  → Class 2. Local model, schema, fallback.
Reasoning, architecture,
  hard code, client writing?  → Class 3. Claude. Deliberately.

Runs on every record forever? → Never Class 3.
Must never be wrong?          → Never Class 2.
Feels like it needs AI?       → It doesn't. Specify it better.

Local interface ≠ local model. Claude is always cloud-hosted.
The saving is routing, not location.
```
