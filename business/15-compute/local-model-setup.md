# Local model setup

**Status: not started.** Ollama is not installed. No model has been downloaded.
No model has been prompted. Nothing described below has been run.

This is the plan for setting Class 2 up on machines we already own. Every figure
about our own hardware is `[PLACEHOLDER]` because nobody has written the specs
down yet, and guessing them here would produce a plan that fails on contact with
the actual PCs.

Last substantive revision: 2026-08-16.

---

## 1. What Class 2 is, precisely

**Open-weight models, downloaded, running on our own hardware, with no network
call to anybody.** Llama, Qwen, Mistral, Gemma and similar. The weights sit on
our disk. The inference happens on our CPU or GPU. Nothing leaves the machine.

That is the entire basis of the "£0 in fees" claim in master plan section 4.

**Claude is not a Class 2 option and never will be.** Claude Code running on a
local machine is a local *interface* to a cloud-hosted model. The folder README
has a whole heading about this. It is repeated here because this is the file
someone opens when they are about to install something, and this is the moment
the confusion causes damage.

---

## 2. The hardware, as recorded

**Nothing here is filled in. Filling it in is action 1 in the folder README, and
everything else in this file depends on it.**

| | Machine A | Machine B |
|---|---|---|
| Owner / location | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| CPU | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| RAM | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| GPU | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| VRAM | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| OS | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| Free disk | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| Typically powered on | `[PLACEHOLDER]` | `[PLACEHOLDER]` |
| Nominated Class 2 host | `[PLACEHOLDER]` | `[PLACEHOLDER]` |

Three things the answers decide:

- **VRAM decides model size.** A model has to fit, quantised, in available
  memory or it runs at a speed that makes it useless. With no discrete GPU it
  runs on CPU and system RAM, which works for small models and short prompts and
  is slow for anything else. That is often perfectly acceptable for batch work
  that runs overnight.
- **"Typically powered on" decides the architecture.** If neither machine is
  reliably on, Class 2 has to be a batch job that catches up when the machine
  wakes, not a service the pipeline calls synchronously and waits for.
- **Disk decides how many candidate models can be kept.** Quantised weights are
  typically a few gigabytes each.

Write the answers in before doing anything else in this file.

---

## 3. Ollama or llama.cpp

Both are real options. They are not equivalent in effort.

| | Ollama | llama.cpp |
|---|---|---|
| Install | One installer, runs as a service | Build it, or fetch a release binary |
| Model management | `ollama pull <name>` | Find and download GGUF files yourself |
| Interface | Local HTTP API on `localhost:11434`, plus a CLI | `llama-server` HTTP API, or the library directly |
| Control over inference parameters | Good enough | Complete |
| Best for | Getting Class 2 working this week | Squeezing a specific model onto specific hardware |

**Start with Ollama.** The reason is not that it is better; it is that the
question this folder needs answering is "is a small local model good enough for
sector classification", and Ollama gets to that question in an hour rather than
an evening. Ollama is built on llama.cpp underneath, so moving down a layer
later is a change of interface, not a change of approach.

Move to llama.cpp if, and only if, a measured problem demands it: a model that
only fits with an unusual quantisation, a throughput requirement Ollama's
defaults will not meet, or a need to embed inference inside another process.

### First-run checklist

- [ ] Install on the nominated host from section 2.
- [ ] Confirm the service starts on boot and survives a reboot. A Class 2
      dependency that needs someone to remember to start it will fail on the one
      morning nobody is at that desk.
- [ ] Confirm it binds to localhost only. It should not be reachable from the
      network without a deliberate decision.
- [ ] Note the exact version installed, here: `[PLACEHOLDER]`.
- [ ] Record where model weights are stored and how much disk they take.

---

## 4. Candidate models

**None of these has been tested by us.** They are the shortlist to try, not a
recommendation, and no quality claim below is ours until section 6 has produced
a number.

| Family | Sizes worth trying | Notes |
|---|---|---|
| Llama 3.x instruct | 8B | Widely used, lots of documentation, community licence with conditions — read it |
| Qwen 2.5 instruct | 7B, 14B | Strong at structured output in general report; 14B needs more memory |
| Mistral 7B instruct | 7B | Small, fast, permissively licensed |
| Gemma 2 instruct | 9B | Google terms of use, read them |
| Phi-3 / small instruct models | 3.8B | Worth trying if the host has no GPU |
| Embedding models | `nomic-embed-text`, `bge-small` or similar | For row 10 of the routing table. Separate from the chat model. |

### Choosing between them

Do not choose on published benchmarks. Choose on our actual task, using the
method in section 6. The first real task is sector classification for
`10-lead-sourcing`, and the second is reply classification for `11-outreach`.

Pull **two** candidates, not five. Run the same prompts through both. Keep the
outputs in a file. Pick one, write down why in one paragraph, and stop.

### Licences

**Read the licence of whatever wins, before it touches client work.**
"Open-weight" is not one licence. Some are permissive, some carry acceptable-use
conditions, some carry conditions tied to the size of the deploying company, and
some restrict specific uses. Record the answer here:

- Chosen model: `[PLACEHOLDER]`
- Licence: `[PLACEHOLDER]`
- What it permits for our commercial use, in one sentence: `[PLACEHOLDER]`
- Date read, and by whom: `[PLACEHOLDER]`

This is not legal advice and nothing in this folder has been reviewed by a
solicitor.

---

## 5. The call wrapper

**Every Class 2 call in the business goes through one function.** Nothing in any
pipeline talks to a model directly. This is the single most important design
decision in this file, and it is worth the extra hour.

Why: it gives one place to change the model, one place that enforces the output
schema, one place that logs, and one place to look when something starts
behaving oddly. Without it, a model swap becomes a search through the codebase,
and there will be no record of what was asked or answered.

### What the wrapper takes

| Input | Purpose |
|---|---|
| `task` | A named task, e.g. `sector_classification`. Not a free-text prompt. |
| `input` | The text being judged |
| `schema` | The exact shape of an acceptable answer |
| `prompt_version` | A string. Changing a prompt without changing this makes old results meaningless. |

### What the wrapper guarantees

| Guarantee | Setting |
|---|---|
| Determinism as far as it goes | Temperature 0, fixed seed where available, no sampling variation |
| Bounded output | A low maximum token count. Classification answers are short. |
| JSON only | The prompt asks for JSON and nothing else, and the wrapper parses it |
| Schema validation | Anything not matching the schema is a failure, not a value |
| A timeout | `[PLACEHOLDER — set once the host's real speed is known]` |
| A defined failure | Returns `unclear` with a reason. Never a guess, never a retry loop, never an escalation to Claude. |
| A log row per call | Task, prompt version, model name, input hash, output, latency, pass or fail |

### Prompt shape for classification

Keep it boring. The categories, the input, and an instruction to answer in JSON
with one of the listed categories and a confidence. No persona, no examples of
being clever, no "think step by step" on a task that takes five seconds of human
judgement. Long prompts on small models make output less predictable, not more.

Include an explicit `unclear` category in the list. A model with no way to say
"I don't know" will always say something.

---

## 6. Deciding whether it is good enough

A local model is only Class 2 if there is a number saying it works. Otherwise it
is a guess with a JSON wrapper.

### The method

1. **Write the threshold down first.** Before running anything. "Sector
   classification is acceptable at 85% agreement with the hand labels, with no
   more than 2% of errors landing in a category that would change a shortlist
   decision." Deciding the threshold after seeing the result is how every
   disappointing system gets approved.
2. **Hand-label at least 50 real examples.** Real ones, from the actual source,
   including the messy ones. 50 is the floor, not the target. Store them with the
   labels in version control.
3. **Run the candidates.** Same prompt, same schema, temperature 0.
4. **Count.** Overall agreement, and a breakdown by category, because an average
   hides a category that is always wrong.
5. **Look at every disagreement.** Some will be the model being wrong. Some will
   be the label being wrong. Some will reveal that the categories are badly
   drawn, which is the most useful outcome available and costs nothing to fix.
6. **Record the result**, pass or fail, in this file. A failed test is a real
   finding: it means the task goes back to Class 1 rules or gets a human.

### Results

| Task | Model | Prompt version | Examples | Agreement | Threshold | Verdict | Date |
|---|---|---|---|---|---|---|---|
| `[none yet]` | | | | | | | |

The table is empty because nothing has been run. It stays empty until it isn't.

---

## 7. Running it in a pipeline

**Batch, not synchronous, until proven otherwise.** A pipeline that blocks
waiting for a local model on a desktop PC inherits that PC's uptime. Write
records to a queue, process the queue, write results back. If the machine was
off, the queue drains later and nothing is lost.

**Concurrency of one, to begin with.** A single model instance on a desktop
handling one request at a time is easy to reason about. Volume at v3 is a
shortlist of businesses, not a stream.

**Log the model name and prompt version on every stored result.** When results
from three months ago look strange, the only useful question is what produced
them, and the only way to answer it is to have written it down at the time.

**A model change is a re-test.** New model, new quantisation, new prompt: rerun
section 6 before it touches anything real. This takes twenty minutes once the
labelled set exists, which is the main reason the labelled set is worth building.

---

## 8. Things that must not be got wrong

**1. Local means local.** If a "local" setup is calling a hosted API, it is not
Class 2, it is Class 3 with a confusing name and possibly an undisclosed data
transfer. Check what the runtime does by default.

**2. Client data on our hardware is an advantage — use it deliberately.** Class 2
keeps data on our machines. That is worth saying to a client, accurately, in the
scope of work. It is also worth checking against `04-legal` before saying it,
and the corresponding truth is that Class 3 work does send data to Anthropic,
which the client should know about when their data is involved.

**3. A model with no fallback is not a system.** Every Class 2 call needs a
defined answer for "the model failed", and that answer is never "ask Claude" and
never "guess".

**4. Small models are confidently wrong.** They do not know when they are out of
their depth. The schema, the fixed category list, the `unclear` option and the
measured accuracy figure are not bureaucracy; they are the only things standing
between a local model and a shortlist full of quiet nonsense.

**5. Do not tune before you measure.** Quantisation levels, context sizes,
sampling parameters and prompt phrasings are an infinite time sink. Get one
model, one prompt and one number first.

**6. Do not buy hardware yet.** Master plan section 8 puts compute sixth in the
spend order, and only after routing has actually been applied. Most "we need a
better machine" is "we are sending Class 1 work to Class 3". Prove the queue is
real first — `cost-tracking.md` section 6 has the test.
