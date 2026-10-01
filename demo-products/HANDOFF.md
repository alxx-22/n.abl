# Handover: the receptionist demo service (1 October 2026)

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
| Site Worker forwarding `/demo/*` | repo root `worker/index.ts`, `wrangler.jsonc` (`DEMO_ORIGIN`) |
| Evals | `src/eval/scenarios.ts` (`ws-*` = builder-made restaurant) |

Tests: 136 unit and HTTP tests plus the Chromium walkthrough, all passing.
All seven `ws-*` live scenarios pass.

## Alex's feedback to act on, in order

Alex tested a restaurant called "Pici" in a Codespace and rang it. The fixes
already made for that call are in commit `c51033f` and noted in the plan's
phase 5 row. What follows is what is still to do.

### 1. The seeded week must look like a real business

> "it shouldn't do that as that is not realistic for a business"

This is about the seeded week. Right now it:
- keeps an inside table for two and for four free at every time, **except
  Friday and Saturday 7–8pm**, which may fill completely;
- pushes extra bookings into that peak, so it fills for every party size.

Alex says that isn't realistic. To do:
- Remove the Friday/Saturday exception: `mayFill` in
  `src/presets/restaurant/seed.ts`, and the matching skip in `checkPlan` in
  `test/restaurant.test.ts`.
- Spread the bookings so the week looks like a busy but bookable restaurant.
  The targets are in `targetFor()`.
- Confirm with Alex how busy it should look.

The `ws-amend-by-ref` scenario clears Saturday first, so it doesn't depend
on the seeded week.

### 2. "How was it reading the data correctly when table 4 had no bookings at all that day?"

Table 4 is a **walk-in table** in the builder's defaults
(`defaultTables()` in `src/presets/restaurant/answers.ts`).
- It compiles to a resource with no bookable services, so the receptionist
  can't book it and the seeding never uses it.
- The board showed it as free, which looked like a bug. The timeline and the
  floor plan's legend now mark it, but that isn't enough.

To do:
- Make walk-in tables obvious in the builder (the Seating and Floor plan
  steps) and on the workspace floor plan (a label, not just a dashed
  outline).
- Ask Alex whether the default restaurant should have a walk-in table at all.
- Explain it to Alex in one line.

### 3. Dairy: "half correct"

> "it added the dairy allergy but also tried to search it in the menu"

During a booking, the model looked "dairy" up as a dish (`get_item_details`).
- That tool now replies "it's an allergy, not a dish; record it as the
  allergy", and `get_menu` has a `free_from` option. The model may still
  make the lookup, though.

To do:
- Add a line to the booking flow in `compilePrompt` (`src/core/prompt.ts`):
  for a booking, record the allergy as the caller said it; look dishes up
  only if they ask what they can eat.
- Make `ws-sunday-lunch-table4` fail if `get_item_details` or `get_menu` is
  called with an allergen during a booking. The tool calls are in
  `c.summary.tools`.

### 4. The scout on https://www.picinottingham.co.uk/

It missed the prices and grouped the menu into sections badly.

To do:
- Run `npm run e2e:scout -- https://www.picinottingham.co.uk/`. It writes to
  `eval-results/scout/`.
- Find where the menu actually lives: a PDF, an image, a page built in the
  browser, or a booking-platform embed.
- Fix the parts responsible: choosing the menu page (`scan.ts`), extraction
  (`extract.ts`), the menu prompt and schema (`model.ts` `askMenu`), and
  mapping into the builder's categories (`map.ts`).
- Add the site, or a saved copy of it, as a regression case in
  `test/scout.test.ts`.

In the cloud sandbox, Chromium can't get through the TLS-intercepting proxy,
so renders only work on a normal machine or in a Codespace. Plain fetches
work everywhere.

### 5. The floor plan "needs mega work"

Alex wants:
- much better moving of tables;
- each seating area (Inside, Terrace…) as its own sub-tab.

This applies in both the builder's Floor plan step and the workspace board.

Files:
- `web/src/reception/FloorPlan.tsx` (the shared SVG editor and board)
- `builder/StepFloor.tsx`
- `workspace/FloorBoard.tsx`
- `src/presets/restaurant/layout.ts` (`autoLayout`)

Ideas to put to Alex before building:
- drag with snapping and alignment guides;
- rotate and resize handles;
- multi-select;
- keyboard nudges;
- add, duplicate and delete;
- areas as tabs, each with its own canvas;
- zoom;
- joining tables by dragging one onto another.

Show Alex screenshots as you go: the Chromium walkthrough saves them to
`eval-results/demo-ui/`.

### 6. A UI overhaul of everything under /demo, to match the new website

This covers every screen:
- the door (key entry) and the prospect's home;
- the preset picker;
- the builder;
- the workspace;
- the console at `/demo/admin`.

It should follow the website's new design on `main`.

**`main` has moved on a lot.** It has "Reposition the site as AI
implementation, with a scroll-driven film" (`b47e384`), the release
`a76740d`, new components in `src/components/` (`layout/Nav.jsx`,
`sections/*`, `film/*`), and a `dev` branch. It is about 337 files ahead of
`voice-agent-DEV`.

1. First, `git fetch origin main` (slow: the repository is large, so give it
   a long timeout or run it in the background). Merge `origin/main` into
   `voice-agent-DEV`. Watch for conflicts in `worker/index.ts` and
   `wrangler.jsonc`: `main` changed `worker/index.ts`, and this branch has the
   `/demo/*` forwarding and `DEMO_ORIGIN`.
2. Study the new site's look: colours, type, spacing, components and motion.
3. Build a shared set of design tokens for `web/src/styles.css` and
   `web/src/reception/reception.css`, then restyle every `/demo` screen.
4. Keep the existing demo behaviour: microphone permission, accessibility,
   and a 390px phone width.

## Still outstanding (not from today's feedback)

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
