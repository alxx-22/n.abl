# n.abl Reception

An AI that answers the phone for hospitality businesses. It answers questions
from the business's own information, books tables and appointments, takes
orders, and takes (demo) payments, live on the call. A demo product: see
[`BUILD-PLAN.md`](BUILD-PLAN.md) for the plan and where it stands, and
[`docs/spike-results.md`](docs/spike-results.md) for what the models actually do.

## Run it

Node 22.18 or later. There is no build step: Node runs the TypeScript directly.

```bash
cp .env.example .env.local        # add GEMINI_API_KEY; nothing else is required
npm install
npm run dev                       # http://localhost:8787
```

The first run creates a local database (PGlite, in `.data/`), loads the four
demo businesses and fills a believable week of bookings. Open the console,
pick a business, and press **Talk to it** on its board. Headphones work best:
on laptop speakers the agent can hear itself.

| Page | What it is |
|---|---|
| `/` | The console: demo businesses, and **New demo from a website** |
| `/board/<slug>` | The live board: the call as it happens, the diary, orders, texts, recent calls |
| `/board/<slug>?phone=07700900123` | The same, with the browser call pretending to come from that number (caller ID) |

## The demo businesses

| Business | Slug | PIN | Shows |
|---|---|---|---|
| Luca's Trattoria | `lucas-trattoria` | 1001 | Tables, takeaway with options, delivery area, deposits for big tables, allergens |
| The Copper Kettle | `copper-kettle` | 1002 | Café orders with required choices (size, milk, bread), ordering hours |
| Linden House Hotel | `linden-house` | 1003 | Spa appointments with named therapists; room enquiries taken as messages |
| Fade & Co Barbers | `fade-and-co` | 1004 | Appointments with named barbers and skills, £5 deposits |

All fictional. Phone numbers are Ofcom's drama ranges.

**Demo card:** `1234 5678 9012 3456`, expiry `12/34`, code `123` is approved.
`1234 5678 0000 0000` is declined. Nothing else is accepted, and nothing real
should ever be read out: on the free Gemini tier, what is said may be used by
Google.

## Commands

| Command | What it does | Needs |
|---|---|---|
| `npm run dev` | The server, with PGlite | Gemini key |
| `npm test` | 65 unit and integration tests, no network | nothing |
| `npm run typecheck` | `tsc` as a checker | nothing |
| `npm run eval` | 18 simulated callers against the receptionist; report in `eval-results/` | Gemini key |
| `npm run eval -- --audio` | The same, voices crossing as audio through a simulated phone line | Gemini key |
| `npm run e2e:browser` | Headless Chromium with a fake microphone, through the live board | Gemini key, Chromium |
| `npm run e2e:phone` | Plays Twilio: μ-law frames into `/twilio/stream`, a real booking out | Gemini key |
| `npm run e2e:ingest` | The setup wizard against a fake local website | Gemini key |
| `npm run spike:audio` | Phase 0: latency, tokens and transcription per Live model | Gemini key |
| `npm run spike:voices` | A greeting in several voices, as WAV files | Gemini key |
| `npm run db:migrate` / `db:seed` | Migrations and demo data, against PGlite or `DATABASE_URL` | — |

In the build sandbox (not on a normal machine) Node's `fetch` needs
`NODE_USE_ENV_PROXY=1` to reach Google.

## How it fits together

```
 phone ── Twilio ──► /twilio/voice → <Connect><Stream> ─┐
                     /twilio/stream  (μ-law 8 kHz) ─────┤
 browser mic ──────► /ws/talk        (PCM 16 kHz) ──────┼─► CallSession ──► Gemini Live
 npm run eval ─────► in-process bridge ─────────────────┘      │  tools (the only way to act)
                                                               │  guardrails (flag + correct)
 board ◄── /api/tenants/<slug>/events (SSE) ◄── bus ◄──────────┤  transcript (card numbers redacted)
                                                               └─► Postgres: voice_* tables
```

| Folder | Holds |
|---|---|
| `src/core/` | Gemini Live client, audio codecs, the call orchestrator, prompt compiler, tools, guardrails, redaction |
| `src/domain/` | Pure logic: availability, time zones, menu matching and pricing, knowledge search, demo payments, phone numbers |
| `src/db/` | The `voice_` schema, one query layer for PGlite and Postgres, seeding |
| `src/channels/` | Browser, Twilio and SMS |
| `src/server/` | HTTP, WebSockets, server-sent events |
| `src/ingest/` | The setup wizard: website to draft profile |
| `src/eval/` | Scenarios and the simulated-caller harness |
| `public/` | Console and live board: plain HTML, CSS and JS, no framework |
| `fixtures/tenants/` | The four demo businesses, one JSON profile each |

## The shared Supabase project

Production data lives in Supabase project `auivrancfnrdwyiqoakt`, shared with
a text-chatbot demo. Everything here is prefixed `voice_`, and
`test/db.test.ts` fails any migration that touches anything else. Row-level
security is on for every table with no policies, so the shared anon key
reads nothing; the server connects as the database owner through
`DATABASE_URL`. Migrations in `src/db/migrations/` are applied to the project
through the Supabase connector and recorded in `voice_schema_migrations`.

## Deploying

`Dockerfile` and `fly.toml` (London, one always-on machine). Set
`GEMINI_API_KEY`, `DATABASE_URL`, `CONSOLE_PASSWORD`, `SESSION_SECRET` and
`PUBLIC_BASE_URL` as secrets. For the phone line, add the Twilio variables in
`.env.example` and point the number's voice webhook at
`https://<host>/twilio/voice`.
