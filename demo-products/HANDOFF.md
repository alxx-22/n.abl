# Handover: the receptionist demo service (2 October 2026, third session)

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

Tests: 145 unit and HTTP tests plus the Chromium walkthrough, all passing.
`test/design-tokens.test.ts` fails if `web/src/tokens.css` drifts from the
site's `src/styles/tokens.css`: change the site's file, then copy it over.

## This session (2 October): the live runs and the scout on Pici

The session had a Gemini key, so the live checks the last session could not
do were run: all 25 scenarios (the 7 on the builder-made restaurant and the
18 older ones), fixes, re-runs of what failed, then a full run of all 25.
In that full run **21 of 25 passed, all 7 builder-made ones among them**.
The 4 that failed were fixed while it ran (it used the code from its
start), then re-run on the final code: all 4 passed.

Reading the transcripts mattered as much as the pass marks: several faults
passed their checks. Found and fixed (unit tests for all but 6 and 7,
which only live calls can show):

1. **A terrace booking seated inside.** The receptionist read it back as
   "on the terrace" but booked without naming an area, and the table went
   inside. When more than one area is free, a booking that names none is
   now refused until the area the caller chose is passed. Seen working
   live: it forgot again, was stopped, and booked the right area.
2. **Hung up before giving the reference.** It booked and put the phone
   down in one go. The call now checks the caller has heard the new
   reference or order number before hanging up; if not, the receptionist
   is told to give it first (once per reference).
3. **A promised call-back never taken** (the hotel, 3 runs out of 3). It
   said "I'll pass your details on", or even "I've passed that on", and
   took no message. Now: "I've passed that on" with no message is flagged
   like a false "it's booked"; "I'll pass that on" with no message in that
   turn gets a nudge to take it there and then; and a call marked as a
   message cannot end without one.
4. **"We don't have any allergies" read as an allergy**, which held a
   booking back. Don't, doesn't, haven't and the like now count as a no.
5. **A reference read a letter at a time**: it searched after each letter
   and said "I can't find it" five times. Every reference is five
   characters, so a shorter one is treated as unfinished.
6. **"This is not medical advice, see a healthcare professional"** to a
   parent mentioning an allergy. The receptionist is now told to
   acknowledge an allergy in a few words and carry on, and its own version
   has gone. The model service still sometimes adds a stock notice of its
   own ("This site provides factual information but does not provide
   medical advice…": once in the full run). An instruction cannot stop
   that; it may differ on the paid tier or another model.
7. **Dead air after the line to the model dropped.** The connection closed
   six seconds after the caller spoke; the call reconnected, but nothing
   answered the caller. After a reconnect an unanswered turn is now timed
   afresh, so the existing hand-over steps in. Not yet seen live: a drop
   cannot be forced.
8. **A booking not found because the caller quoted another number.** The
   search used only the number and never the name. If the number finds
   nothing, the name is now searched too.
9. **"The order is different from what was read back"** when the
   receptionist had read it back in its own words: it told the caller the
   order "had changed", and once said it was placed before it was. The
   refusal now says "not placed yet", why, and not to say it is placed
   until an order number comes back.
10. Step-free was mentioned unasked, and one booking was marked as needing
    it; availability now mentions it only when asked.
11. Two tests could not show what they claim. `ws-inside-or-out` could
    find the terrace full at Sunday lunch, so it now starts from a clear
    Sunday and needs the terrace offered. `prompt-injection` failed on any
    order, including one the simulated caller placed at full price after
    the free one was refused; it now fails only if food is given away.

**The scout on Pici** (`npm run e2e:scout -- https://www.picinottingham.co.uk/`):
the menu comes from `/pici-menus` with its six sections (snacks, small
plates, pizzettes, pasta, mains, dessert) and all 24 food prices match the
page (pici cacio e pepe £11.50). Most runs also bring in the drinks tabs
(71 items in all), which is correct too. One fault, fixed: Pici lists its
hours as "wed, thur 12-10pm" and "fri, sat 12-11pm", and the scout only
understood ranges, so the builder would have shown it closed on Wednesdays
and Fridays. Day lists now work, and the saved copy of Pici's home page has
its hours block so the regression test covers them. One run in five lost
the second model call (FAQs and policies) to a model error; the reason now
goes to the server log.

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

- **Watch the next live runs for:** the reconnect fix (point 7) when a drop
  happens; the receptionist going quiet after an empty reply from the model
  (seen once in `book-alternative`: the stall watchdog counts any message
  from the model as a reply, so it did not step in); the model service's
  health notice (point 6); and the receptionist reading an order back in
  its own words instead of the system's (point 9 makes it recover, but the
  caller hears the order twice).
- The simulated caller in `ws-amend-by-ref` and `ws-rename-by-ref` reads the
  reference one character per turn. It is a fair stress test, so it stays.
- Re-run the live scenarios after any change to `src/core/prompt.ts` or
  `src/core/tools.ts`: `npm run eval` (all 25, about 40 minutes).

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
