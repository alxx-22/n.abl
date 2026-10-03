# Handover: the receptionist demo service (3 October 2026, evening)

For the next session. Read `CLAUDE.md` (rules and commands) first, then this.

## How to work (Alex's request)

Alex hit his usage limit many times in earlier sessions. **Do not use
multi-agent workflows or spawn subagents.** Work directly, in small steps:
read only the files a step needs, run `npm run check` before each commit,
commit and push after each finished step. Tell Alex in plain words what was
done after each step.

## Do next, in this order

### 1. Estate agent milestone 2 (M2)

The spec is `presets/estate-agent.md` (§12, M2): sellers and buyers the
agency knows. *How's my sale going?* for a seller verified by number and
address (the week's viewings, feedback, the offer they're considering;
"drop it by ten grand" becomes a message, not a change); buyer registration
with requirements and alerts consent; the *Applicants* and *Valuations*
views; *Call as* on the call panel (the seeded personas); "Seller replied by
phone" on offers. Add its `ea-` scenarios, run them, and re-record the estate
goldens in a commit that names the change (`node scripts/estate-goldens.ts`).

### 2. Estate agent milestone 3 (M3)

Sale progression (spec §12, M3): the *Sales progress* view (milestones,
dates, the chain, updates), *Completed: release keys*, *Fell through* (back
on the market, back-up buyers texted).

### 3. Property maintenance

**The spec is written**: `presets/property-maintenance.md`, in the estate
agent's shape, following the use cases' reviewer's corrections. Before
building, ask Alex the six "Decisions for Alex" at its end (or go with the
defaults written there: the invented town Brackenford, all four nations,
properties as sample data, approvals on the second phone, a short gas call,
answering mode later). Then build M1 as its §12 says: server preset,
migration `voice_0006_maintenance`, window booking, safety mode and the tool
gate, the six tools, prompt, guardrails, builder, back office (Jobs,
Dispatch, Properties and compliance, Safety log, the engineer's phone), walk,
`pm-` scenarios, golden corpus, database, live.

## Where things stand

- **Restaurant**: finished. Its goldens (`test/fixtures/restaurant/`)
  prove later changes leave it alone.
- **Estate agent M1: finished and live in the catalogue** (3 October).
  - Builder: nine steps (`web/src/reception/builder/estate/`), including a
    listings editor in tabs with a Part A meter and *Start from the sample*
    (it reads `GET /workspaces/:id/defaults`).
  - Back office: Diary (a row per person; a viewing's drawer has feedback
    buttons), Properties (cards with a drawn house and a Manage panel:
    status, price, blocked dates, facts being checked, best and final,
    viewings after a sale), Offers (received, sent, decided, with waiting
    timers; *Seller accepts* makes the home sale agreed, opens a sale and
    texts the buyer and other bidders). `/state` carries `listings`,
    `offers` and `team`. Staff actions are in `src/server/demo.ts`
    (`offerAction`, `listingAction`, booking `feedback`), tested in
    `test/demo-api.test.ts`.
  - Builder saves after Start sync the homes (`repo.syncListings`).
  - Walkthrough: `npm run e2e:demo -- --only estate_agent` (screenshots in
    `eval-results/demo-ui/estate_agent/`, sent to Alex).
  - Live calls: see "Live calls" below.
  - Database: `voice_0005_estate` applied to the shared Supabase project and
    recorded in `voice_schema_migrations` (3 October).
  - Golden corpus: `test/fixtures/estate_agent/`, made by
    `scripts/estate-goldens.ts`, checked by `test/estate-golden.test.ts`. The
    shared helpers are in `scripts/goldens.ts`. Its `max` setup is the true
    maximum (twenty distinct towns): the prompt is 6,484 characters there,
    after the "We cover..." fact was capped at six towns.
- **Framework** for every kind of business: done (`PRESETS.md`).
- **Order of presets** (Alex): estate agent, property maintenance, then
  takeaway (PRESETS.md §5), barber, salon, café, pub, beauty, spa, hotel,
  letting agent, gym, dog grooming, garage.
- **Not online** until the whole demo is built (Alex's decision). The
  Oracle hosting kit (`voice-agent/deploy/oracle/`) waits until then.

## Live calls (estate agent, 3 October)

First run of the seven `ea-` scenarios: `ea-short-lease`, `ea-book-viewing`
and `ea-valuation-no-figure` passed. Fixed from the other four's transcripts:
`get_property` now gives a `describe` sentence (price, tenure, council tax
band, EPC) to say first; `search_properties` offers similar homes when the
one asked for is withdrawn or sold; a caller who talked about bank or account
details always leaves an urgent fraud message; and two checks were too
narrow ("the details don't confirm it" about flooding, and "I can't comment
on whether it will be accepted"). The four were being re-run at the end of
the session: see the latest folder in `voice-agent/eval-results/`.

## Known small items

- Moving a booking to another staff member must be made generic before the
  barber; the estate Diary has no drag-to-move until then (its drawer hides
  the move list for viewings).
- The estate seed put no bookings on "today" when Start was pressed on a
  Saturday at 17:22 (after viewing hours). Check whether the seed should add
  a few earlier that day, as the restaurant's does.
- The takeaway's order fields (`ready_at`, `driver`) are written but not yet
  read back (do it when the takeaway is built).
- `NEXT-SESSION-PROMPT.md` is from an older session; use this file instead.

## Testing as Alex does

- **Codespace**:
  `https://codespaces.new/alxx-22/n.abl/tree/voice-agent-DEV?devcontainer_path=.devcontainer%2Fvoice-agent%2Fdevcontainer.json`
  It installs Chromium. Then run `npm run check:all`.
- **In the app**: in the console, issue a key, then open `/demo/reception` on
  the same address and enter it. After pulling new code, restart `npm run dev`
  and press **Reset** in the demo. The estate agent is now on the "Build a new
  demo" page.
