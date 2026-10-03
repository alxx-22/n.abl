# Handover: the receptionist demo service (3 October 2026)

For the next session. Read `CLAUDE.md` (rules and commands) first, then this.

## How to work (Alex's request)

Alex hit his usage limit many times in the last session. **Do not use
multi-agent workflows or spawn subagents.** Work directly, in small steps:
read only the files a step needs, run `npm run check` before each commit,
commit and push after each finished step. Tell Alex in plain words what was
done after each step.

## Do next, in this order

### 1. Fix a restaurant wording quirk (small)

The guardrail that catches a false "it's booked" misread "I'm afraid **7pm
is booked**" (meaning the slot is taken) as a claim that a booking was made.
It interrupted the call with a correction, so the receptionist said "Ah, my
mistake" and repeated itself (live scenario `book-alternative`, 3 October;
the other 20 restaurant scenarios passed).

- Where: `CLAIM` and `negated()` in `voice-agent/src/core/guardrails.ts`.
- Fix: don't flag "is/are booked" when its subject is a time or a slot ("7pm
  is booked", "that time is booked", "Saturday is booked"), or when it reads
  "fully booked" or "booked up". Real claims ("that's booked for you",
  "you're all booked in") must still be flagged.
- Tests: add cases to the guardrail test in `test/domain.test.ts`.
- Then run `npm run eval -- --only book-alternative,book-simple` (needs
  `GEMINI_API_KEY`) and check both pass.

### 2. Finish the estate agent's first milestone (M1)

The spec is `presets/estate-agent.md` (M1 is in its §12). The researched use
cases are in `presets/estate-agent-use-cases.md`.

**Done and pushed:** the data (`src/presets/estate/`: answers, 18 sample homes
in a made-up town in `fixtures/presets/estate-listings.json`, a fortnight
seeded from Start), migration `src/db/migrations/voice_0005_estate.sql`, repo
functions, `src/domain/listings.ts`, and the receptionist (`src/core/estate-tools.ts`:
listing search and facts, viewings that keep each seller's rules,
valuations, offers recorded and passed on, its prompt branch and guardrails,
a named negotiator's day off). Also 7 live scenarios (`ea-*`) and 241 tests.
The preset is built but **not live** in the catalogue yet.

**Still to do for M1:**
1. **Web builder:** a `BuilderDef` for `estate_agent` in
   `web/src/reception/builder/registry.ts`, keyed by `src/presets/estate/steps.ts`
   (follow the restaurant's; the listing editor without the draft).
2. **Back office** (spec §6): Diary (the timeline by negotiator and valuer),
   Properties (listings: status, price, viewings; price change and status
   actions), Offers (timers; *Sent to seller*, *Seller accepts* or *rejects*;
   accepting makes the listing sale agreed, opens a sale and texts the
   buyer). `/state` must add listings, offers and team. Staff actions go in
   `src/server/demo.ts`, each with an HTTP test.
3. Open items left by the data step:
   - wire `repo.syncListings` into the answers save after Start;
   - the reset confirm (`resetConfirm`) only knows "bookings" and "orders";
   - the scout's "not a restaurant" message is restaurant-worded.
4. Make `estate_agent` live in `src/presets/catalogue.ts`. The test
   `test/web-registry.test.ts` then requires its builder and a view for
   every tab.
5. **Walkthrough:** add an `estate_agent` walk to `test-e2e/demo-ui.ts`. It
   picks the preset, edits each step, reloads, presses Start, opens each view
   and accepts an offer. Run `npm run e2e:demo -- --only estate_agent` and
   `-- --only restaurant`. **Send Alex the screenshots** from
   `eval-results/demo-ui/estate_agent/`.
6. **Live calls:** `npm run eval -- --only` with the `ea-*` ids from
   `src/eval/scenarios.ts`. Read the transcripts, fix real faults, re-run.
7. **Database:** apply `voice_0005_estate.sql` to the shared Supabase project
   through the connector and record it in `voice_schema_migrations`.
   `voice_0004_orders` is already applied.
8. Add an estate golden corpus, as PRESETS.md §4 asks of every preset.

Then M2 (sellers and buyers the agency knows: *how's my sale going?*, buyer
registration) and M3 (sale progression), per the spec's §12.

**Alex's defaults (he can change them):** sample homes stay in the made-up
town and are labelled "example"; fees are "explained at your valuation";
the receptionist records offers itself; lettings calls become a message.

### 3. Then property maintenance (a new kind of business)

The use cases are researched (`presets/property-maintenance-use-cases.md`, 89
of them). There is no spec yet: write `presets/property-maintenance.md` in
the shape of `presets/estate-agent.md`, then build it the same way. Its
catalogue entry doesn't exist yet.

## Where things stand

- **Restaurant**: finished. Its recorded baseline (`test/fixtures/restaurant/`,
  checked by `test/restaurant-golden.test.ts`) proves later changes leave it
  alone. Change those files only in a commit whose purpose is a named
  restaurant change.
- **Framework** for every kind of business: done (`PRESETS.md` is the design).
  Shared code is in `src/presets/common`, `food` and `seating`. The registry
  is `src/presets/index.ts`, and the web has builder and back-office
  registries. `npm run e2e:demo -- --only <key>` walks one preset.
- **Order of presets** (Alex): estate agent, property maintenance, then
  takeaway (its spec is PRESETS.md §5), barber, salon, café, pub, beauty, spa,
  hotel, letting agent, gym, dog grooming, garage.
- **Not online** until the whole demo is built (Alex's decision). The
  Oracle hosting kit (`voice-agent/deploy/oracle/`) waits until then.
- Known small items: PRESETS.md §4 still mentions a restaurant exception
  that was removed; the takeaway's order fields (`ready_at`, `driver`) are
  written but not yet read back (do it when the takeaway is built); moving a
  booking to another staff member must be made generic before the barber.

## Testing as Alex does

- **Codespace**:
  `https://codespaces.new/alxx-22/n.abl/tree/voice-agent-DEV?devcontainer_path=.devcontainer%2Fvoice-agent%2Fdevcontainer.json`
  It installs Chromium. Then run `npm run check:all`.
- **In the app**: in the console, issue a key, then open `/demo/reception` on
  the same address and enter it. After pulling new code, restart `npm run dev`
  and press **Reset** in the demo.
