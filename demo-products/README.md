# Demo products

Products n.abl demonstrates to prospects and sells. They are **not** part of
the n.abl website, portal, team space or CRM: nothing here imports from
`src/`, `supabase/`, `worker/` or `scripts/`, and nothing there imports from
here. Each product has its own `package.json`, its own tests and its own
deployment, so any of them can be lifted into its own repository later with
`git subtree split --prefix demo-products/<name>`.

The **demo service** ([`DEMO-SERVICE-PLAN.md`](DEMO-SERVICE-PLAN.md), plan
for review) puts these demos in front of prospects: a private link and key,
a builder with presets so a prospect sets up their own business, and a live
workspace. It keeps the line above: the website only forwards `/demo/*` to a
demo server, and the CRM only calls a demo's API through an edge function. No
code crosses between them.

| Product | What it is | Status |
|---|---|---|
| [`voice-agent/`](voice-agent/) | **n.abl Reception.** An AI that answers the phone for hospitality businesses: answers questions, books tables and appointments, takes orders and demo payments. Gemini Live on the free tier | Building. See [`voice-agent/BUILD-PLAN.md`](voice-agent/BUILD-PLAN.md) |

## Shared rules

- **Demo data only.** Fictional businesses, placeholder payments, Ofcom's
  reserved drama phone numbers (0115 496 0xxx, 07700 900xxx). Nothing here
  takes real money or serves a real business's real customers until it moves
  to a paid pilot.
- **The shared Supabase project** (`auivrancfnrdwyiqoakt`) is used by more
  than one demo. Every product prefixes everything it creates with its own
  name (`voice_` for the voice agent) and never touches another product's
  objects.
- **Secrets** live in each product's `.env.local` (gitignored) and in its
  host's secret store, never in this repository.
