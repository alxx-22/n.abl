# Every AI process, and the model each one uses

As of 28 September 2026. For the Gemini chains the registry,
`public.outreach_model`, is the source of truth; this page explains what is
in it and why. The migrations that set it up are
`supabase/migrations/202609282130_lead_gen_every_model_where_its_allowance_goes_furthest.sql`
and `202609282200_lead_gen_a_model_google_cannot_serve_sits_out.sql`.

## The allowances

Free tier, as AI Studio showed them on 28 September. **Each Google project
has its own set, and within a project each model has its own.** We have
three projects:

- the writer's (`GEMINI_API_KEY`)
- discovery (`GEMINI_DISCOVERY_API_KEY`)
- research (`GEMINI_RESEARCH_API_KEY`)

| Model | A day | A minute | Tokens a minute | Used |
|---|---|---|---|---|
| gemini-3.5-flash-lite | 500 | 15 | 250K | yes: the workhorse |
| gemini-3.1-flash-lite | 500 | 15 | 250K | yes: the second 500 |
| gemini-3.5-flash | 20 | 5 | 250K | yes: judgement calls only |
| gemini-3.6-flash | 20 | 5 | 250K | yes: judgement calls only |
| gemini-3.7-flash | 20 | 5 | 250K | yes: judgement calls only |
| gemini-3.8-flash | 20 | 5 | 250K | yes: judgement calls only |
| gemini-3-flash-preview | 20 | 5 | 250K | yes: judgement calls only |
| gemini-flash-latest (alias) | 20 | | | yes: it had its own 20 on 23 to 26 Sep |
| gemini-flash-lite-latest (alias) | shares 3.5 Flash Lite's 500 | | | last in each chain, only as cover if 3.5 Flash Lite is retired |
| gemma-4-26b-a4b-it | 14,400 | 30 | **16K** | yes: overflow once the Lites are spent |
| gemma-4-31b-it | 14,400 | 30 | 16K | no: every probe on 28 Sep returned 500 or timed out |
| gemini-2.5-flash, 2.5-flash-lite | 20 | 5 or 10 | 250K | no: the 3.x models do the same job on separate allowances |
| gemini-2.5-pro, 3.1-pro | 0 | | | no: not on the free tier |
| Embedding, TTS, image, Live, Veo, Lyria | | | | no: we have no job for them |

The logs agreed with these figures before the registry did. It had Flash at
250 a day and the Lites at 1,000. In practice 3.5 Flash stopped at 20 to 23
calls every morning, and 3.5 Flash Lite at 480 to 500.

## The rule

- **A 20-a-day Flash model goes only to a single call where judgement is the
  whole job and a Lite would answer differently.** In lead gen that is the
  sales agent's pick (which services, at what opening number) and the
  research loop's checker ("is this page this business?"). In outreach it is
  the sentence and the letter a stranger reads.
- **Anything argued turn by turn, or checked by code afterwards, runs on the
  Lites.** That covers:
  - research: every quote is checked against the page
  - signals and the review
  - the specialists
  - the sales agent's replies in an argument
  - the investigator
- **Gemma is overflow.** It keeps the queue moving after the 1,000 Lite calls a
  day are spent, instead of everything waiting for 07:00. Its limit is 16,000
  tokens a minute. Our prompts run 4,000 to 6,000 tokens, so that is about 3
  calls a minute.
- **The lead prospector paces each model on its own clock**, so waiting out
  one model's gap never holds up a call to another. The outreach writer still
  paces on one clock.
- **A model Google cannot serve sits out for ten minutes.** A 5xx, or silence
  for the whole 30-second wait, puts a rest on that model and project
  (`outreach_model_usage.resting_until`, set by `outreach_model_rest`). The
  prospector skips it until then, and the failed call is not counted against
  the day's allowance. If Google does count it, the day's 429 still stops the
  model, as before. Only the prospector rests models; the writer does not.
- **No model call starts that could not end inside the tick.** The platform
  stops a request at 150 seconds. The prospector gives each request 140, and
  a call that would run past that is not made. The business goes back in the
  queue uncounted and picks up where it stopped on the next tick.

## Every process

### Lead gen: the lead-prospector edge function

All of these run every 5 minutes (`lead-prospector` cron). Everything except
the research loop is on the discovery project.

| Step | Role | Chain, in order | Calls a business |
|---|---|---|---|
| Research: reads the register and site, promotes facts | `prospect_research` | 3.5 Lite, 3.1 Lite, Gemma 26B, alias | 1 |
| Review: the research agent judges the signals | `prospect_research` | same | about 1.6 |
| Signals: facts into signals, tagged with services | `prospect_signals` | 3.5 Lite, 3.1 Lite, Gemma 26B, alias | about 1.6 |
| **Sales pick**: which services, opening scores | `prospect_sales` | **3.5, 3.8, 3.7, 3.6, 3 Flash, flash-latest**, then 3.5 Lite, 3.1 Lite, Gemma, alias | 1 |
| Sales replies in each argument | `prospect_sales_reply` | 3.5 Lite, 3.1 Lite, Gemma 26B, alias | about 0.7 |
| Specialists: one per service brought in | `prospect_specialist` | 3.5 Lite, 3.1 Lite, Gemma 26B, alias | about 1.8 |

A business that reaches scoring costs about 7.5 calls: 1 Flash and 6.5 Lite.

- The Lites' 1,000 a day score about 150 businesses.
- The Flash models' 100 a day cover the first 100 picks.
- After that the pick falls to a Lite, and after the Lites to Gemma.

### Lead gen: the research loop

Same edge function, `lead-lookup` cron, research project.

| Step | Role | Chain, in order | When |
|---|---|---|---|
| **Checker**: is this page this business? | `prospect_lookup_check` | **3.5, 3.8, 3.7, 3.6, 3 Flash**, then 3.5 Lite, 3.1 Lite, alias | Only on a name-only match, at most 2 a business: about 20 a day |
| Investigator: follows links and sister companies with tools | `prospect_lookup` | 3.5 Lite, 3.1 Lite, alias | Only when the code sweep leaves a lead |

Gemma is not in the investigator's chain: it did not answer a function call
within 30 seconds.

### Outreach: the outreach-writer edge function

Every 5 minutes, writer's project. It only has work once a lead is approved.

| Step | Role | Chain, in order |
|---|---|---|
| Scout, strategist, editor | `scout`, `strategist`, `editor` | 3.5 Lite, 3.1 Lite, alias |
| **The sentence and the letter** | `writer`, `letter` | **3.5, 3.8, 3.7, 3.6 Flash, flash-latest**, then 3.5 Lite |

### Outside the Gemini registry

| Process | Where | Model | Volume |
|---|---|---|---|
| Local lead sourcing scripts | `scripts/sourcing/gemini.mjs` (own table, same figures) | read and judge on the Lites, write on 3.8, 3.7, 3.6, 3.5 Flash | by hand |
| Client portal assistant | `portal-assistant` edge function | Cloudflare Workers AI: Llama 3.1 8B, then Llama 3 8B, then Mistral 7B | per portal question |
| Deep research on one lead, on request | `research-lead` edge function | Claude Opus through our Cloudflare tunnel | per click |
| Onboarding call summary | `summarise-transcript` edge function | Claude Sonnet 5 (`ANTHROPIC_MODEL`) | once per new client |
| Model diagnostics | `gemini-models` edge function | lists models (spends nothing) and probes request shapes | by hand |

## Checking a model before it goes in a chain

`gemini-models`, called with the cron secret, does the checking. Listing
models spends no quota. A probe costs 4 to 6 requests, so probe only
high-allowance models.

```sql
select net.http_post(
  url := 'https://rrkcoqopcqtowbyismcq.supabase.co/functions/v1/gemini-models',
  headers := jsonb_build_object('content-type','application/json',
             'x-outreach-secret', public.outreach_cron_secret()),
  body := '{"key":"GEMINI_DISCOVERY_API_KEY","probe":"gemma-4-26b-a4b-it","shape":"thinking"}'::jsonb,
  timeout_milliseconds := 150000);
-- then read net._http_response for that id
```

What the probes found on 28 September:

- **Gemma 4 26B** accepts our request shape: system instruction plus JSON mode.
  - It thinks by default, taking 8 to 12 seconds and hundreds of tokens even
    on a one-line answer.
  - With `thinkingConfig.thinkingLevel: "minimal"` it answered in 1.3 seconds
    with clean JSON. It refuses a thinking budget and every other level.
  - It returns its thoughts as parts marked `thought: true`. The prospector
    drops them.
- **Gemma 4 31B** returned 500 to every request shape.

## What the live test found on 28 September

For the test Gemma 26B was put first in research, signals, the sales replies
and the specialists for three businesses that had been scored before. It went
back behind the Lites afterwards.

- **Quality held.** PFS Fire & Security came out on web at 50, the same as
  on 3.5 Flash Lite. Heatpro's web argument agreed at 50 again.
- **Code caught Gemma's slips.** On Faraday Chapman it quoted one line that
  was not on the page, and code struck it. It also called two sector-wide
  signals strong, and code marked them weak. The Lites make the same kinds of
  slip, and the same checks catch them.
- **Speed:** 14 to 20 seconds a call, about the same as the Lites.
- **It is not always there.** Twice on Heatpro it gave no usable answer, and
  3.5 Flash Lite answered instead. That is acceptable for overflow, but not
  for the first choice.
- **Flash on a weekday evening is short of capacity, not quota.**
  - At 21:40 the sales pick tried all six Flash models. None had reached its
    20, and none answered. The pick fell to 3.5 Flash Lite 40 seconds later.
  - Earlier, 3.5 Flash stayed silent for its whole 30 seconds, and that tick
    was stopped at 150 seconds with nothing logged.
  - The ten-minute rest and the 140-second limit came out of this.
