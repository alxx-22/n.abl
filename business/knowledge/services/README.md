# What the lead-gen agents know about what we sell

One folder per service. Each is what that service's **specialist agent** reads
before it argues with the sales agent about a lead, and part of it is what the
**sales agent** reads when it decides which specialists to bring in.

```
services/
  _shared/
    who-we-sell-to.md    every agent that judges a lead reads this
    scoring.md           the one scale every score is on, and what agreement means
  ai/service.md
  automation/service.md
  data_analytics/service.md
  software/service.md
  web/service.md
```

The five folder names are the `capability` terms in
`public.outreach_vocabulary` — the same five the CRM filters by. A folder whose
name is not one of those terms is refused by the build, so the agents can never
be argued into a service the CRM cannot show.

## Who reads what

| Agent | Reads |
|---|---|
| research | `_shared/who-we-sell-to.md` |
| signals | `_shared/who-we-sell-to.md` |
| sales | `_shared/*`, and from every service: **In one paragraph** and **Signals that point here** |
| specialist for *X* | `_shared/*` and the whole of `X/service.md` |

The sales agent sees a short version of every service on purpose. It is the
generalist: its job is to decide who to bring in, not to out-argue the
specialist on the specialist's own ground.

## The headings are load-bearing

`scripts/build-service-knowledge.mjs` cuts each `service.md` at its `##`
headings. These must exist, in any order:

- `## In one paragraph`
- `## Signals that point here`
- `## Signals that point somewhere else`
- `## What we would build`
- `## What kills it`
- `## How this specialist scores`
- `## The question that settles it`

A missing heading fails the build rather than shipping a specialist that has
quietly lost its scoring rules.

## Changing what an agent knows

1. Edit the markdown.
2. `npm run knowledge:services` — writes a migration that loads the new text
   into `public.prospect_knowledge`, and updates `manifest.json`.
3. Apply the migration. The next tick uses it; nothing is redeployed.

`npm run test:service-knowledge` fails if a folder has changed since its last
migration was generated, so an edit cannot sit in the repository looking live
while the agents are still reading the old version.

## What does not go in here

Prices. `12-pricing` still has placeholders where the bands will go, and an
agent that has read a number will put it in an argument, and from there into a
letter. The specialists score fit, not deal size.
