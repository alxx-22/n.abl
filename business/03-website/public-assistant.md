# The public assistant

The chat box on nabl.agency. It answers from one file and can reach nothing
else.

**Content lives in `assistant-knowledge.md`.** Edit it, push, done — it is
bundled into the Worker at build time. This file is about the plumbing.

---

## What it is, in one diagram

```
visitor → /api/chat/public → Worker → Groq (llama-3.3-70b)
                               ↑
                    knowledge.generated.ts
                    (bundled from assistant-knowledge.md at build)
```

No Supabase client, no service key, no database binding. It cannot leak client
data because nothing in its path can fetch any. That is structural, not
careful.

It also writes nothing. A visitor who wants a call gets the existing discovery
form opened with what they said filled in, and they press send.

## Why Groq and not Workers AI

The client assistant runs on Workers AI; this one does not, and the difference
is worth understanding before anyone "tidies" it.

|  | Workers AI | Groq |
|---|---:|---:|
| Free allowance | 10,000 Neurons/day | 14,400 requests/day |
| Turns/day at this knowledge size | **~357** | ~4,000+ |
| Model | 8B | 70B |

This bot carries the whole knowledge file in every turn — about 1,320 tokens
before the question — so a turn costs roughly 28 Neurons. 357 turns is one
curious afternoon on a page anyone can find.

The argument that keeps the *client* assistant on Cloudflare is that Cloudflare
is already a processor of client personal data, so Workers AI adds no
sub-processor. This bot sees no client data at all, so that argument never
applied to it.

## Turning it on

**1. A Groq key.** console.groq.com, free, no card. Then:

```bash
npx wrangler secret put GROQ_API_KEY
```

That is the only setting. The assistant's endpoint is a fixed path on the same
origin, served by the same Worker as the page, so there is nothing to point it
at. An earlier version required a `VITE_ASSISTANT_URL` build variable, which
added a setting to find and get wrong in exchange for nothing — build-time and
runtime variables live in different parts of the Cloudflare dashboard, and the
build one is easy to miss.

If the key is missing the assistant still renders and answers *"I'm not set up
yet — email hello@nabl.agency"*, which is the failure that needed handling.

**2. A rate limiting rule.** Cloudflare → Security → WAF → Rate limiting rules.
The free plan includes one, and this is what it is for:

| | |
|---|---|
| If | URI Path equals `/api/chat/public` |
| Rate | 20 requests per 1 minute, per IP |
| Then | Block for 1 minute |

**Do not skip this.** The guard inside the Worker is an in-memory counter, and
Workers isolates are per-colo and short-lived, so it stops a naive loop from
one browser and nothing more. Without the zone rule, one determined visitor can
spend the whole daily allowance in a few minutes and the assistant goes quiet
for everyone until midnight UTC.

## Checking it works

```bash
curl -s https://nabl.agency/api/chat/public \
  -H 'content-type: application/json' \
  -d '{"message":"What do you do?"}'
```

Expect `{"reply":"...","intent":"answer"}`.

Then the two that matter more:

```bash
# Should refuse to give a number and offer the call
-d '{"message":"How much for a small automation?"}'

# Should say it does not know, and offer to ask the team
-d '{"message":"Do you have an office in Leeds?"}'
```

If it invents a price or an office, the knowledge file needs tightening — not
the prompt.

## What it costs when it goes wrong

Nothing, in money. Groq's free tier does not bill; it refuses. A visitor then
gets *"I can't answer right now — email hello@nabl.agency"*, which is a fine
worst case and the reason the failure path says that rather than showing an
error.

## The three rules it is given

Written into the system prompt, and they matter more than the content:

1. Answer only from the knowledge file
2. Never state a price, cost or timescale that is not written down
3. Never claim a client, a case study or a result

The second exists because `12-pricing` says plainly that no quote has gone out
and the worked example is illustrative. An assistant quoting that figure would
be putting a number in front of strangers that is not a price.

## Privacy

Visitor questions go to Groq in the United States. The privacy notice says so,
names Groq as a processor, and states the transfer basis. It also says what is
*not* sent, which is everything else: no name, no email, no prior
correspondence, nothing from any client account.

If the model or provider changes, that section changes with it.

## Tests

```bash
npm run test:assistant
```

Builds with the assistant enabled and drives it: the launcher appears, the
question reaches the endpoint, the canned opener is not sent back as history,
a handoff is offered rather than performed, the form opens pre-filled and
still editable, and — the one the whole design exists for — the assistant
submits nothing itself.

Adding a single `fetch` to Web3Forms in the component turns two of those red.
