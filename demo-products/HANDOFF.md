# Handover: the receptionist demo service (1 October 2026, second session)

For the next session. Read `CLAUDE.md` (rules and commands) first.

## What exists

`demo-products/voice-agent/`: an AI receptionist (Gemini Live) and a private
demo service at `nabl.agency/demo`. All on the `voice-agent-DEV` branch.

**The team console** (`/demo/admin`):
- Issues demo keys. *Private* keys are for one prospect; their demo lasts
  until they reset or replace it. *Shared* keys are for many people; each
  visitor's demo and everything in it is deleted an hour after Start.
- Has the team's own demo businesses.

**The prospect** (`/demo/reception`):
- Enters their key, picks a preset (only Restaurant is built), and
  optionally gives their website. The website scout fills in the builder
  from it.
- Builds the restaurant in nine steps, including a floor plan.
- Presses **Start**, which writes a believable week of bookings and orders.
- Uses the workspace: a live call in the browser, a back office (floor plan,
  timeline, kitchen, messages, calls) and a customer's phone that shows the
  texts.

**Hosting**: a kit for Oracle Cloud's free tier is ready in
`voice-agent/deploy/oracle/`. Alex has not set it up yet.

| Area | Key files |
|---|---|
| Server, prospect API, console API | `src/server/{main,demo,admin,http}.ts` |
| Demo keys, sessions, sweeper | `src/demo/{access,sweeper,cli}.ts`, `src/db/demo-repo.ts` |
| Restaurant preset (answers, compile, seed, layout) | `src/presets/restaurant/*.ts` |
| Booking engine | `src/domain/availability.ts` |
| The receptionist's tools and instructions | `src/core/tools.ts`, `src/core/prompt.ts`, `src/core/guardrails.ts` |
| Turn-taking | `src/core/turns.ts` |
| The call itself | `src/core/call.ts` |
| Website scout | `src/scout/{scan,extract,render,model,map}.ts` |
| Prospect web app | `web/src/reception/`: `Reception.tsx`, `builder/`, `workspace/`, shared `FloorPlan.tsx`, `reception.css` |
| Console web app | `web/src/pages/`, `web/src/styles.css` |
| The site's design in the demo | `web/src/tokens.css` (a copy of the site's), `web/src/fonts.css` and `fonts/`, `components/Logo.tsx` |
| Floor plan geometry (rooms, snapping, free spots) | `src/presets/restaurant/layout.ts` |
| Site Worker forwarding `/demo/*` | repo root `worker/index.ts`, `wrangler.jsonc` (`DEMO_ORIGIN`) |
| Evals | `src/eval/scenarios.ts` (`ws-*` = builder-made restaurant) |

Tests: 142 unit and HTTP tests plus the Chromium walkthrough, all passing.
`test/design-tokens.test.ts` fails if `web/src/tokens.css` drifts from the
site's `src/styles/tokens.css`: change the site's file, then copy it over.

## Alex's feedback: done on 1 October (second session)

All six points from Alex's first test call are built, tested and pushed.

1. **The seeded week** looks like a busy neighbourhood restaurant that can
   always be booked: quiet early week, busy weekend, never full. A table for
   two and for four stays free inside at every time, every day (the
   Friday/Saturday 7–8pm exception is gone). Alex chose to keep this level.
2. **Walk-in tables** carry a "Walk-in" tag on both floor plans and are
   chosen per area in Seating. Alex asked for them to be **off by default**,
   so the default restaurant has none. The evaluation restaurant still keeps
   table 4 for walk-ins, so `ws-sunday-lunch-table4` tests that case.
3. **Allergies during a booking** are recorded as said, with no menu lookup
   unless the caller asks what they can eat. `ws-sunday-lunch-table4` fails
   on a lookup by allergen.
4. **The scout on Pici**: the menu page (Webflow tabs, prices without £) is
   now read instead of the festive set menu's PDF, with its prices and its
   own sections. A saved copy is a regression test.
5. **The floor plan**: each area is its own tab and room; line-up guides and
   a grid while dragging; a drop on another table slides to the nearest
   clear space; touching tables are offered as a pair; bar, door, window and
   wall shapes; zoom. Alex picked these from a list. Not picked, for later:
   a tray to drag new tables from, buttons on the selected table, moving
   several at once.
6. **The restyle**: `origin/main` merged in (no conflicts; the site builds
   and the Worker's `/demo/*` check passes 27/27). Every `/demo` screen uses
   the site's tokens, fonts, wordmark, buttons, cards and eyebrows.

## To do next

- **Run the live scenarios.** The session had no Gemini key, so none ran.
  Run all of them: the seeded week, the walk-in default and the booking
  prompt all changed.
  `npm run eval -- --only ws-terrace-allergy,ws-inside-or-out,ws-wheelchair,ws-amend-by-ref,ws-sunday-lunch-table4,ws-rename-by-ref,ws-collect-pay-later`
- **Run the scout on Pici with the model**:
  `npm run e2e:scout -- https://www.picinottingham.co.uk/`. Check the
  sections (snacks, small plates, pizzettes, pasta, mains, dessert) and the
  prices (e.g. pici cacio e pepe £11.50).
- **A key for cloud sessions**: Alex was asked to add `GEMINI_API_KEY` to
  the cloud environment's settings, so the next session can run both.

## Still outstanding (not from Alex's feedback)

- **Hosting**: Alex to create the Oracle account and server following
  `voice-agent/deploy/oracle/README.md`, then add the DNS record
  `demo-origin` and the Worker secret `DEMO_PROXY_SECRET`. Then merge
  `voice-agent-DEV` into `main` so `nabl.agency/demo` forwards. Then a live
  test from a phone.
- **Gemini billing** before any prospect gets a key, as Google's terms
  require.
- **Plan phases 7 and 8**: the CRM link (§9) and the other presets (§8).
- **Scout**: the scored run over 20 sites.
- **Security hardening**: Chromium runs without its own sandbox (Playwright's
  default). See the plan's risks table.

## Testing as Alex does

- **Codespace**:
  `https://codespaces.new/alxx-22/n.abl/tree/voice-agent-DEV?devcontainer_path=.devcontainer%2Fvoice-agent%2Fdevcontainer.json`
  It installs Chromium. Then run `npm run check:all`.
- **In the app**: in the console, issue a key, then open
  `/demo/reception` on the same address and enter it. After pulling new
  code, restart `npm run dev` and press **Reset** in the demo.
