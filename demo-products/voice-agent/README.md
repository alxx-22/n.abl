# n.abl Reception

An AI that answers the phone for hospitality businesses. It answers questions
from the business's own information, books tables and appointments, takes
orders, and takes (demo) payments, live on the call. A demo product: see
[`BUILD-PLAN.md`](BUILD-PLAN.md) for the plan and where it stands, and
[`docs/spike-results.md`](docs/spike-results.md) for what the models actually do.

It is also the **demo service**: a private page at `nabl.agency/demo` where a
prospect with a key builds the receptionist for their own restaurant (from our
defaults or from their website), rings it, and works a real back office and a
customer's phone. See [`../DEMO-SERVICE-PLAN.md`](../DEMO-SERVICE-PLAN.md) and
[The demo service](#the-demo-service) below.

## Try it: a live conversation in your browser

No phone needed. You talk into your microphone, the receptionist answers out
loud, and the board shows the conversation, the bookings and the orders as
they happen. Replies start about a second after you stop talking, and you
can interrupt.

**On your own machine** (Node 22.12 or later):

```bash
git clone https://github.com/alxx-22/n.abl.git
cd n.abl/demo-products/voice-agent
cp .env.example .env.local        # add GEMINI_API_KEY; nothing else is required
npm install
npm run dev                       # then open http://localhost:8787/demo/admin
```

**Without installing anything**, in a GitHub Codespace: on the repository
page choose **Code → Codespaces → ⋯ → New with options**, pick the
**n.abl Reception (voice agent demo)** configuration, and paste your Gemini
key when asked (or add `GEMINI_API_KEY` as a Codespaces secret first). The
app starts by itself, in the terminal tab named "Codespaces", and opens in a
new tab. Allow the microphone when the browser asks. To change the key
later, put `GEMINI_API_KEY=<your key>` in `.env.local`, then press Ctrl+C in
that terminal tab and run `npm run dev` again.

On start the terminal says whether Google accepted the key, and the app
shows a red banner if it did not.

Then pick a business, press **Start a live call** and speak. Headphones work
best: on laptop speakers the agent can hear itself. The first run creates a
local database (PGlite, in `.data/`), loads the four demo businesses and
fills a believable week of bookings.

**Settings** on each board change the receptionist's voice (all 30 Gemini
voices, with a spoken preview of the greeting), the greeting, the language,
the reply speed (how long a pause ends your turn) and the voice model. They
apply from the next call.

It cannot run as a claude.ai artifact: artifact pages are not allowed the
microphone or connections to Google, and the Gemini key must stay on a
server.

Everything is under `/demo`, the path the site's Worker forwards on
nabl.agency.

| Page | What it is |
|---|---|
| `/demo/admin` | The team console: our demo businesses, and **New demo from a website** |
| `/demo/admin/board/<slug>` | The live board: the live call, the diary, orders, texts, recent calls, and **Settings** |
| `/demo/admin/board/<slug>?phone=07700900123` | The same, with the browser call pretending to come from that number (caller ID) |
| `/demo/reception` | The prospect's side: key entry, their demos, the builder and the workspace (below) |

## The demo service

A prospect gets a link like `nabl.agency/demo/reception#key=DEMO-K7QX-M3RD-9WTF`
(the key after the `#` never reaches a server log), and then:

1. **Picks a kind of business.** Restaurant is live; the others show as coming soon.
2. **Optionally gives their website.** The scout (`src/scout/`) reads it in the
   background, politely (robots.txt, one request a second, public addresses
   only), with no model for structured data, hours, phones, providers and
   signals, one headless render for colours, fonts and logo, and two small
   model calls for the menu and the facts still missing. It then asks "Is this
   you?"; only what the prospect ticks is used, and every field it fills is
   marked. Cached for 14 days.
3. **Builds it** in nine short steps with a live preview: basics, hours, how
   they serve (tables, walk-ins, click and collect, delivery), seating areas,
   the floor plan (drag the tables), the menu ("describe your food" and the AI
   drafts it), money (deposits, takeaway payment), policies and questions, review.
4. **Presses Start.** The answers compile into the receptionist's profile and a
   believable week of bookings and today's orders is written to the database,
   shaped by their own tables, hours and menu.
5. **Uses the workspace**: the live call; the back office (a floor plan with a
   time slider, a timeline, the kitchen board, messages, calls), where a
   booking can be opened, moved by dragging, pushed onto two tables, seated or
   cancelled; and the customer's phone, which shows every text the caller gets.

**Two kinds of key**, issued in the console (`POST /demo/api/admin/keys`) or from a terminal:

| | Private | Shared |
|---|---|---|
| For | One prospect | Many people from one link (an event, a post, a group email) |
| Demos | One at a time. Building a different one replaces it, after saying so | One per person: each browser gets its own, invisible to everyone else on the link |
| Data kept | Until they reset it or replace it; deleted 30 days after the key expires or is switched off | Deleted, with every booking, order, call, transcript and text, **an hour after Start**. A draft never started goes after two hours. Reset does not buy more time |
| Limits (default) | 14 days, 30 call minutes a day, 20 AI drafts and 5 website reads a day | 30 days; per person 15 call minutes, 5 AI drafts and 2 website reads a day; 300 call minutes a day across the whole key |

```bash
npm run demo:key -- issue "Sam Price" --company "Sam's Kitchen" --days 14
npm run demo:key -- issue "Hospitality expo" --shared --days 30
npm run demo:key -- list
npm run demo:key -- revoke K7QX
```

Keys are stored only as a hash. A shared key tells people apart by a random
id in their signed session cookie, so the same person keeps their demo when
they come back in the same browser. A sweeper in the server deletes what is
due once a minute (`src/demo/sweeper.ts`); a call still in progress ends by
the demo's deletion time, and any page still open on a deleted demo says so
and offers to build another. Prospects' texts are simulated (never sent).

## How it takes turns

People on the phone pause to think, read numbers out in chunks, ask someone
in the room, and say "mm-hm" while you talk. So the server, not Gemini,
decides when the caller has finished (`src/core/turns.ts`). It looks at two
things:

- **What the receptionist just asked.** A yes-or-no question ends after
  0.5 s of silence, an open question 0.7 s, a name 0.9 s, and "what would
  you like?" or "what's your number?" 1.3 s, because people pause mid-list.
- **What the caller has said so far**, from a second listener
  (Transcribe Live) about a second behind:

| The caller | The receptionist |
|---|---|
| "Can I get a margherita and, um..." | waits up to 2.6 s for the rest. After an open question the turn has usually closed (0.7 s) before these words arrive; if the receptionist has not started speaking, the turn is reopened and its half-made reply cancelled before any of it plays |
| "It's oh seven seven double oh..." (when asked for a number) | waits for all eleven digits |
| "No, that's everything, thanks." | answers straight away |
| "Hang on, let me ask what the kids want." | says "Of course, take your time", then stays quiet through the family chat until "sorry about that" or 3.5 s of quiet |
| "Jack, what do you want?" (mid-order) | goes on hold on the spot |
| "Mm-hm", "yeah", a cough, while it talks | keeps talking |
| "No, wait, make that two", while it talks | stops (after 0.6 s of speech) |
| Anything, while it reads back an order, a booking or the demo card | stops only for 1 s or more of speech |
| Anything, just as a lookup finishes | treated as talking over it: the reply is on its way |

The board shows what it is doing ("Waiting: sounds like you're still
deciding", "On hold while you talk to someone else") and marks replies it
held back on purpose. Reply speed in **Settings** scales every wait, and
**Turn-taking: Standard** hands the decision back to Gemini's fixed pause.
If the second listener cannot connect, it works from the question alone.
If a model stops responding (the free tier does this after heavy use), the
call moves to the other model within 4 s and replays the caller's last turn
to it, so it answers rather than asking them to repeat.

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
| `npm run dev` | The server and the React app (hot reload), with PGlite, on one port | Gemini key |
| `npm run build` then `npm start` | Production: the built app from `web/dist` | Gemini key |
| `npm test` | 89 unit and integration tests, no network | nothing |
| `npm run typecheck` | `tsc` as a checker, for the server and the app | nothing |
| `npm run eval` | 23 simulated callers against the receptionist (5 on a restaurant made in the builder); report in `eval-results/` | Gemini key |
| `npm run eval -- --audio` | The same, voices crossing as audio through a simulated phone line | Gemini key |
| `npm run e2e:browser` | Headless Chromium with a fake microphone: a live call through the React app | Gemini key, Chromium |
| `npm run e2e:phone` | Plays Twilio: μ-law frames into `/demo/twilio/stream`, a real booking out | Gemini key |
| `npm run e2e:demo` | The prospect's journey in Chromium, no model: key link, builder, Start, floor plan, moving a booking, kitchen, website read | Chromium |
| `npm run e2e:scout -- <url>` | The website scout against a real site, with the real model | Gemini key |
| `npm run demo:key` | Issue, list, revoke and extend prospects' keys | — |
| `npm run e2e:ingest` | The setup wizard against a fake local website | Gemini key |
| `npm run e2e:turns` | A scripted caller who pauses, interrupts, asks the kids and says "mm-hm", against live Gemini | Gemini key |
| `npm run spike:turns` | Whether a Live model takes turns marked by the server | Gemini key |
| `npm run spike:audio` | Phase 0: latency, tokens and transcription per Live model | Gemini key |
| `npm run spike:voices` | A greeting in several voices, as WAV files | Gemini key |
| `npm run db:migrate` / `db:seed` | Migrations and demo data, against PGlite or `DATABASE_URL` | — |

In the build sandbox (not on a normal machine) Node's `fetch` needs
`NODE_USE_ENV_PROXY=1` to reach Google.

## How it fits together

```
 nabl.agency/demo/* ── the site's Worker ──► this server (everything under /demo)

 phone ── Twilio ──► /demo/twilio/voice → <Connect><Stream> ─┐
                     /demo/twilio/stream  (μ-law 8 kHz) ─────┤
 browser mic ──────► /demo/ws/talk        (PCM 16 kHz) ──────┼─► CallSession ──► Gemini Live
 npm run eval ─────► in-process bridge ──────────────────────┘      │  tools (the only way to act)
                                                                    │  guardrails (flag + correct)
 boards ◄── …/events (SSE) ◄── bus ◄────────────────────────────────┤  transcript (card numbers redacted)
                                                                    └─► Postgres: voice_* tables
 prospects ──► /demo/api (session cookie from a key) ──► builder, workspaces, back office, scout
 team ───────► /demo/api/admin (CONSOLE_PASSWORD) ──► console, keys, pre-scans
```

| Folder | Holds |
|---|---|
| `src/core/` | Gemini Live client, audio codecs, the call orchestrator, turn-taking and the parallel listener, prompt compiler, tools, guardrails, redaction |
| `src/domain/` | Pure logic: availability, time zones, menu matching and pricing, knowledge search, demo payments, phone numbers |
| `src/db/` | The `voice_` schema, one query layer for PGlite and Postgres, seeding |
| `src/channels/` | Browser, Twilio and SMS |
| `src/server/` | HTTP, WebSockets, server-sent events: `main.ts`, the prospect API (`demo.ts`), the team's (`admin.ts`) |
| `src/demo/` | Keys, sessions and the throttle; the key CLI |
| `src/presets/` | The kinds of business a prospect can build; the restaurant's answers, compiler, validator, seeder and AI drafts |
| `src/scout/` | Build from your website: fetch, render, extract, two model calls, map into the builder |
| `src/ingest/` | The team console's setup wizard: website to draft profile |
| `src/eval/` | Scenarios and the simulated-caller harness |
| `web/` | The React app (Vite, TypeScript): console, live board, live-call audio engine, settings; `web/src/reception/` is the prospect's side |
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

On an Oracle Cloud **Always Free** server (Arm, 2 processors, 12 GB, in
Frankfurt beside the Supabase project), at no cost: follow
[`deploy/oracle/README.md`](deploy/oracle/README.md). The server builds the
`Dockerfile` (Chromium included, for the scout's render), runs it behind Caddy
for HTTPS at `demo-origin.nabl.agency`, and checks GitHub every five minutes:
a push to `voice-agent-DEV` is live a few minutes later, after any call in
progress has ended. A build that fails, or does not come up healthy, leaves
the previous one running. `/demo/healthz` says which commit is running.

Settings (`/opt/nabl/secrets.env` on the server): `GEMINI_API_KEY` (and
optionally `GEMINI_API_KEY_CALLS`, `_SCOUT`, `_TEXT` to split quota by job),
`DATABASE_URL` (Supabase's session pooler: the server has IPv4 only),
`CONSOLE_PASSWORD` and `DEMO_PROXY_SECRET`. The script adds a lasting
`SESSION_SECRET` and `CLIENT_IP_HEADER=x-real-ip` (Caddy writes that header
on every request, so the key throttle sees real addresses).

Visitors reach it through the site: `worker/index.ts` forwards `/demo/*`,
WebSockets included, to `DEMO_ORIGIN` (in `wrangler.jsonc`), and passes the
visitor's address with `DEMO_PROXY_SECRET` (a Worker secret with the same
value). `npm run test:routes` in the site checks the forwarding. For the phone
line, add the Twilio variables in `.env.example` and `PUBLIC_BASE_URL`, and
point the number's voice webhook at `https://nabl.agency/demo/twilio/voice`.

**Gemini's terms**: Google allows only its paid service for apps made
available to people in the UK, the EEA or Switzerland. The free tier is for
the team's own testing; before keys go to prospects, turn on billing for the
key's Google Cloud project (about 2p a call minute at published prices; the
demo's per-key limits cap the minutes).
