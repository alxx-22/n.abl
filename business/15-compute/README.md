# 15 — Compute

**Status: not started.**

Nothing in this folder has been built. Ollama is not installed on either
machine. No open-weight model has been downloaded, prompted or tested. No job
has ever had its compute cost recorded. There is no routing rule anywhere in the
codebase, no cost log, and no measurement of how the £36 a month is actually
being consumed.

This folder is the plan for starting. Everything in it is a rule to apply or a
thing to build, not a description of something that exists.

Last substantive revision: 2026-08-16.

---

## The thing to notice first

**Six other folders already depend on this one, and it has never been built.**

The three-class model is quoted throughout the business plan as though it were
operational:

| Folder | What it assumes about this folder |
|---|---|
| `01-positioning` | Every one of the six service categories carries a compute-class line, and `service-categories.md` ends with a routing decision tree |
| `10-lead-sourcing` | v3 is "Class 1 with one bounded Class 2 exception" — the exception is sector classification, which needs a local model that does not exist |
| `11-outreach` | `sequence-design.md:234` says reply classification runs "via Ollama or llama.cpp. See `15-compute` for setup." There is no setup to see. |
| `12-pricing` | The ROI worksheet asks how much of a job is Class 1 when deciding a price |
| `13-credits` | The ledger is specified as Class 1 "with no model anywhere near it" |
| `16-finance` | Does not exist yet, and will need the cost figures this folder produces |

So the classification vocabulary is in use across the whole plan, and the thing
the vocabulary describes has not been set up. That is survivable while nothing
is running. It stops being survivable at v3, because the lead pipeline is the
first piece of work that actually needs a local model on a real machine.

The second thing to notice is smaller and more awkward. The CRM had an AI layer
and it was deliberately removed — `supabase/migrations/202606020001_remove_sales_ai.sql`
dropped the research tables, the RPCs and the AI-authored columns. That was the
right decision. It also means there is no existing model-calling code in this
repository to copy from. The first local model call will be written from
nothing.

---

## What this step is

The internal discipline that makes the £36 a month enough. Master plan section 4.

Three things, and no more:

1. **Routing.** A rule that decides, for any given task, whether it is Class 1
   (ordinary code, effectively £0), Class 2 (a genuinely local open-weight model
   on our own PCs, £0 in fees) or Class 3 (Claude, where intelligence is worth
   paying for). The rule has to be applicable by a person in under a minute,
   before they start building.
2. **Local model setup.** Ollama or llama.cpp installed on the machines we
   already own, with a chosen model, a fixed calling interface, and an
   acceptance test set that says whether it is good enough for a given job.
3. **Cost tracking.** A record, per job, of what it actually cost to build and
   what it costs to run. Kept internally, used for pricing and for spend
   decisions, and never shown to a client as an hourly rate.

**This step is not**: the pricing method itself (`12-pricing`), the bank
account, tax set-aside or spend decisions (`16-finance`, which does not exist
yet), the lead pipeline that will be the first consumer of Class 2
(`10-lead-sourcing`), or the reply classifier that will be the second
(`11-outreach`).

---

## CLAUDE CODE RUNNING LOCALLY IS NOT A LOCAL CLAUDE MODEL

This heading exists because getting it backwards is the single most expensive
mistake available in this folder.

Claude Code is a **local interface and orchestration environment**. It runs on
your machine, reads your files, runs your commands and keeps its own context.
The **Claude models themselves are cloud-hosted**. Every prompt leaves the
machine, is answered by Anthropic's infrastructure, and comes back. Installing
the tool locally does not move the model locally. There is no offline Claude.

Therefore:

- Running Claude Code on your own PC saves **nothing**. It is not free compute.
  It draws on the same Claude Pro subscription whether you invoke it from a
  terminal, a laptop or a phone.
- "We run it locally so it costs us nothing" is **false**, and it is false in a
  way a technically literate client will spot in about four seconds.
- Class 2 means something completely different: **open weights on our own
  hardware**, run by Ollama or llama.cpp, with no network call to anyone. Llama,
  Qwen, Mistral, Gemma. Those are local models. Claude is not one of them and
  never will be.

**The saving comes from ROUTING, not from location.** It comes from sending
low-intelligence work to ordinary code or a genuinely local open model, and
spending Claude only where intelligence is worth paying for.

Anyone who gets this backwards will build the cost model wrong — they will
assume Class 3 is free and stop routing — and will eventually say it wrong in
front of a client, in a meeting where the whole cost argument was the thing that
was working.

If you only remember one sentence from this folder, remember that a local
interface is not a local model.

---

## What "done" looks like

Thirteen statements. **None of them are true today.**

- [ ] `routing-rules.md` is a table a person can apply to a real task in under a
      minute, and both founders have applied it to the same five tasks
      independently and agreed on the class every time.
- [ ] Ollama (or llama.cpp) is installed on at least one machine we already own,
      and starts on boot without anyone thinking about it.
- [ ] One model is chosen as the default Class 2 model, its licence has been
      read, and the reason for choosing it is written down.
- [ ] There is a single internal function that every Class 2 call goes through.
      Nothing in any pipeline talks to a model directly.
- [ ] That function is deterministic by configuration: temperature 0, a fixed
      prompt version string, JSON-only output, a schema check, a timeout and a
      defined behaviour when the model fails or returns rubbish.
- [ ] An acceptance test set of at least 50 hand-labelled examples exists for the
      first real Class 2 job, with a measured accuracy figure and a written
      threshold for what counts as good enough.
- [ ] A Class 2 call that fails its schema check or its timeout degrades to a
      recorded "unclear" rather than to a guess or to Claude.
- [ ] Every job carries a compute-class breakdown recorded at the end, not
      estimated at the start.
- [ ] Internal labour hours are logged per job, so `12-pricing` can tell which
      kinds of work are profitable. They are never quoted to a client.
- [ ] Class 3 usage is tracked as **capacity consumed**, not as pounds, because
      the subscription is flat.
- [ ] A monthly review exists, takes fifteen minutes, and produces one number:
      the share of work that ran on Class 1.
- [ ] The "we need more compute" test in `cost-tracking.md` has been applied at
      least once before any spending decision, as master plan section 8 requires.
- [ ] No client data has ever been sent to a third-party model that the client
      was not told about.

---

## Honest status, in one paragraph

Not started. The three-class model is decided and written down in the master
plan and is quoted correctly in six other folders, so the thinking is settled
and is not what is missing. What is missing is everything physical: no local
model runtime is installed, no model is downloaded, no calling code exists, no
test set has been labelled, no job has been costed and no monthly review has
happened. The routing rule has never been applied to a real task, because there
have been no real client tasks. The hardware the Class 2 work is supposed to run
on has not been specced or written down anywhere, so this folder marks it
`[PLACEHOLDER]` rather than guessing. None of this is urgent today and all of it
is blocking at v3, which is the next thing being built.

---

## Next actions, in order

Items 1 and 2 are decisions and cost nothing. Items 3 to 6 are an afternoon.
Nothing here needs to wait for a client.

1. **Write down the hardware.** Both machines: CPU, RAM, GPU and VRAM if any,
   operating system, and whether the machine is on often enough to be depended
   on. Fill in the table at the top of `local-model-setup.md`. Everything after
   this depends on knowing whether there is a GPU, and right now nobody has
   written it down.
2. **Apply `routing-rules.md` to five tasks from `10-lead-sourcing/build-plan.md`
   independently, both founders, then compare.** If the answers differ, the table
   is wrong and the table gets fixed. This is the cheapest possible test of the
   only rule in this folder that gets used daily.
3. **Install Ollama on the better machine.** One command, then confirm it
   survives a reboot.
4. **Pull two candidate models** from `local-model-setup.md` section 4 and run
   the same ten prompts through both. Keep the outputs. This is the first
   evidence of any kind that this folder will have produced.
5. **Read the licence of whichever model wins**, and write one line in
   `local-model-setup.md` saying what it permits for commercial use. Do not skip
   this because "it is open". Open-weight licences differ and some carry
   conditions.
6. **Write the single Class 2 call wrapper.** JSON in, JSON out, temperature 0,
   timeout, schema check, prompt version string, and a log row per call. Nothing
   else in the codebase may call a model.
7. **Label 50 examples for sector classification**, the one bounded Class 2
   exception in `10-lead-sourcing`. Measure accuracy against them. Write the
   threshold down before you look at the result, not after.
8. **Start the job log**, empty, on the first real job. `cost-tracking.md`
   section 3 gives the fields. An empty log that exists beats a perfect log that
   is designed for six months.
9. **Do the first monthly review** at the end of the first month in which any
   real work happened, even if the answer is "one job, all Class 1".
10. **Hand the running figures to `16-finance`** when that folder is created, so
    the cost base and the spend decisions are working from measurement rather
    than from the £36 headline.

---

## What each file in this folder is for

| File | What it is for | Read it when |
|---|---|---|
| `README.md` | This file. What the step is, what done means, the honest status, what to do next, and the correction about Claude Code. | Opening the folder cold |
| [`routing-rules.md`](routing-rules.md) | The decision table. A one-minute test, a task lookup table, the tie-breakers, the escalation and demotion rules, and the anti-patterns. | Before building any piece of a job, every time |
| [`local-model-setup.md`](local-model-setup.md) | Hardware inventory, Ollama versus llama.cpp, the candidate models, the single call wrapper, determinism settings, the acceptance test method, and what never goes to a local model either. | Setting the machines up, choosing a model, or writing anything that calls one |
| [`cost-tracking.md`](cost-tracking.md) | What is measured and why, the job log fields, why Class 3 is tracked as capacity rather than pounds, the monthly review, and the test that must be passed before spending on compute. | Finishing a job, doing the monthly review, or arguing for a purchase |

---

## Things in here that must not be got wrong

**1. A local interface is not a local model.** See the heading above. This is
the one that ends up in front of a client.

**2. Class 1 is the majority of most projects, and that is the point.** CSV
work, deduplication, sorting, filtering, dates, scheduling, database operations,
regular expressions, HTML extraction, PDF generation, API calls, CRM updates.
None of it needs intelligence. If a build is coming out mostly Class 2 or Class
3, the design is probably wrong before the cost is.

**3. Routing is decided at build time, not at run time.** There is no clever
router that inspects a request and picks a model. A human decides which class a
piece of work belongs to while designing it, writes it down, and the code then
does one thing deterministically. A dynamic router is a way of paying for
intelligence to decide whether to pay for intelligence.

**4. Class 3 being flat-rate does not make it free.** Two Claude Pro
subscriptions cost £36 a month whether they are used once or constantly. The
scarce resource is not pounds, it is capacity and attention: usage limits, and
the time spent reviewing output. Treating Class 3 as free because the marginal
call is unmetered is how a routing discipline quietly dies.

**5. Client data does not leave the building without the client knowing.** A
Class 2 call stays on our hardware, which is one of its real advantages. A Class
3 call does not. Where a job involves client data, the class decision is also a
disclosure decision, and `04-legal` needs to have said so in the scope of work.

**6. Local models are not a smaller Claude.** They are useful for narrow,
repetitive, well-specified judgement with a fixed output shape. Given an
ambiguous instruction they produce confident nonsense. Every Class 2 use needs a
schema, a fallback and a measured accuracy figure, or it is not a Class 2 use,
it is a liability with a JSON wrapper.

**7. Internal labour cost is tracked and never sold.** Master plan section 3A.
We measure hours to know which work is profitable. We price on the value
released. Hourly pricing punishes getting faster, and getting faster is the
entire point of this folder.
