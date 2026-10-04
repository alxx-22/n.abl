# Handover: the receptionist demo service (4 October 2026)

For the next session. Read `CLAUDE.md` (rules and commands) first, then this.

## How to work (Alex's request)

Alex hit his usage limit many times in earlier sessions. **Do not use
multi-agent workflows or spawn subagents.** Work directly, in small steps:
read only the files a step needs, run `npm run check` before each commit,
commit and push after each finished step. Tell Alex in plain words what was
done after each step.

## Pick up here first (the last session stopped at the weekly usage limit)

The session of 4 October stopped at 97% of Alex's weekly limit (it resets
on Thursday 8 October, 15:00 UK time). Its last two checks' results were
only in that session's container, so they are copied here. Work directly,
in small steps; no subagents. Order: fix the confirmed call-engine problems
(A), the three failed live calls (B), the other reported problems after
reproducing each, re-check the data commit, then M2.

**Progress since (next session, on branch
`claude/handoff-demo-products-onewca`, started from `voice-agent-DEV`):**

- Done: call engine new problems 1–5 (`5c1d9b4`) and its three *partly*
  items (`5553951`), each with a test that failed first.
- Done in code, not yet run live: the three failed live calls in B (this
  commit: the figure rule, named-home searches without a price, a
  `mortgage_question` line for leasehold homes, the `ea-listing-facts`
  check). The live calls **cannot run in a Claude Code cloud session**: its
  network proxy does not carry WebSockets, which the live model needs. Run
  them in the Codespace (see "Testing as Alex does").
- The prompt at its largest is now about 6,960 characters (limit 7,000):
  put new guidance in tool answers, not the prompt.
- Still to do, in order: the other reported problems below (server, back
  office, builder), the data re-check, then M2.

### A. Re-check of the review fixes

Five fix commits (listed under "Where things stand") were being re-checked
area by area. Not yet re-checked when the session stopped: data
(`288aae9`). Re-check it yourself with `git show 288aae9`.

**Builder (`267e7a7`)**: eight findings fixed; one partly: the three
"Copy Monday to Tuesday–Friday" buttons on the estate hours step still have
the same name (`web/src/reception/builder/common/Hours.tsx` ~103; name them
by week, as the day switches now are). New problems reported:

- `estate/Listings.tsx` (~238): moving a home's tenure away from shared
  ownership now wipes its share, rent and provider; moving back gives
  defaults that get read out. Don't clear it in the builder (compile already
  ignores a hidden block).
- `estate/Listings.tsx` (~109): wrapping each home row in a `listitem` div
  stops the rows stretching, so prices and badges no longer line up. Make
  the wrapper the grid item (`display: contents` or move the class).
- `estate/Listings.tsx` (~327): a viewing window with no days ticked is
  kept and shown as if it applied, but compile drops it. Warn in
  `validateEstate`, or show it as "no days chosen".

**Back office (`bdddb2a`)**: four findings fixed; one partly: a cash buyer
whose "anything to sell" answer is unknown still shows Cash on the screen
(the domain gives no Cash then). New problem: the viewing drawer now shows
only the position badges, so the "ID check" badge for an empty home (put in
`details.badges` by the seed and `create_booking`) is lost. Show
position badges plus any `details.badges` that aren't position badges.

**Server (`705c78b`)**: all five findings fixed. Two new problems reported
(this and the builder's and back office's were not double-checked:
reproduce each before fixing):

- `test/demo-api.test.ts` (~395): the estate test fails about 1 run in 40.
  It needs a received offer with a rival bidder on another phone; only the
  seed's best-and-final home has one, and its two buyers are drawn at
  random, so now and then they are the same person. Make the seed pick two
  different buyers there (and re-record the estate goldens), or set up the
  rival in the test itself.
- `src/server/demo.ts` (~635): accepting an offer withdraws every open offer
  in its `revises` chain without checking it is the same buyer's. Only
  follow `revises` to offers from the same phone.

**Call engine (`7f815bd`)**: five findings fixed, two only partly:

- *Partly*: a restaurant line like "Brilliant, 7pm is booked under Smith."
  or "Saturday at 7pm is now booked." is not flagged as a false claim,
  because `slotTaken` (`src/core/guardrails.ts`) treats it as "that time is
  taken". The gap dates from `3ecdddb`. Fixing it touches the restaurant:
  keep its goldens unchanged.
- *Partly*: when staff mark the lease as being checked, `facts()`
  (`src/domain/listings.ts`) still gives `tenure` from `tenureSentence()`,
  which includes the years left on the lease.
- *Partly*: when staff mark the price as being checked, `get_property`
  leaves it out, but `search_properties` and `send_property_details` still
  give the price.

New problems, all confirmed by a second reviewer who reproduced them:

1. `call.ts` (~558): after any earlier `find_bookings`/`modify_booking` in a
   call, no read-back is reminded to be booked, so an offer read back later
   is never recorded.
2. `guardrails.ts` `saidYes()`: a "no", "not", "but" etc. anywhere later in
   the caller's line, even in a separate sentence, cancels the yes
   ("Yes, that's right. I'm not sure about parking though.").
3. `guardrails.ts` READ_BACK: "Shall I go ahead and book that?" no longer
   counts as a read-back, so a yes to it is never reminded.
4. `guardrails.ts` (~110): `!MONEY.test(text)` also matches a mobile number's
   six-digit group or "hundred"/"thousand", so a true "I've passed your
   message on" line with a number in it is flagged.
5. `guardrails.ts` (~126): THING is tested against the whole sentence, so a
   natural "slot taken" line with "your" or "viewing" earlier in it is
   flagged again (the 3 October false alarm).

### B. Final run of the seven `ea-` live calls

Results are not in git (`eval-results/` is ignored): re-run with
`npm run eval -- --only ea-listing-facts,ea-short-lease,ea-book-viewing,ea-sale-agreed,ea-valuation-no-figure,ea-offer-taken,ea-bank-details-change`.
On 4 October, on the finished code:

- 4 of 7 passed: `ea-book-viewing`, `ea-sale-agreed`, `ea-offer-taken`
  and `ea-bank-details-change`.
- `ea-valuation-no-figure`: failed. The receptionist repeated the caller's
  own figure back ("You mentioned next door went for four hundred; when was
  that?"); the guardrail flagged it, it said the same line again, and the
  valuation was never booked. Tell it never to repeat a figure the caller
  gives (ask "when was that sale?" without the amount).
- `ea-listing-facts`: failed. The simulated caller said "the house on
  Albion Road" instead of "the one on Albion Road", so returning only the
  house was right; the check should accept that (only ask "which" when the
  caller didn't say house or flat). Two real slips: the receptionist gave
  the price from `search_properties` before calling `get_property`, so the
  full describe line (council tax band C, EPC D) was never said; and on
  flooding it took a message for Jess without saying it isn't in the
  details or naming the Environment Agency's service.
- `ea-short-lease`: failed: didn't offer the mortgage adviser or a
  solicitor.

Then go on with "Do next" below.

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
    maximum and valid (every box at its cap, twenty long towns, thirty
    districts not in a run, three different periods every day in all three
    weeks): the prompt is 6,922 characters there. Very long hours, viewing
    times and area lists are shortened in the prompt only (the open days and
    "the tool has the times"; the first few towns and districts and a count);
    the searchable answers keep them in full.
  - Independent review (3 October, evening): 29 confirmed problems across the
    call engine, staff actions, builder, back office and seed. All fixed in
    five commits on 4 October (`7f815bd`, `705c78b`, `267e7a7`, `bdddb2a`,
    `288aae9`), each with tests.
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
- The restaurant's builder still drops a half-filled question row on
  autosave (the estate's now keeps it until compile). Fix it when the
  restaurant is next touched, and re-record its goldens in that commit.
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
