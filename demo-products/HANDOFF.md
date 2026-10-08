# Handover: the receptionist demo service (8 October 2026)

For the next session. Read `CLAUDE.md` (rules and commands) first, then this.

## How to work (Alex's request)

Alex hit his usage limit many times in earlier sessions. **Do not use
multi-agent workflows or spawn subagents.** Work directly, in small steps:
read only the files a step needs, run `npm run check` before each commit,
commit and push after each finished step. Tell Alex in plain words what was
done after each step.

## Pick up here first (8 October): two sessions, split by preset

Alex split the work on 7 October so two sessions can run at once without
touching the same files:

- **The cloud session** keeps **property maintenance** (repairs, M3).
- **The Windows session** (Alex's PC) took the **takeaway**, the next
  preset in the order.

Each pushes to `voice-agent-DEV` and rebases on the other's commits before
pushing (`git -c core.autocrlf=false rebase origin/voice-agent-DEV`). Shared
files (`src/core/tools.ts`, `guardrails.ts`, `call.ts`, `src/db/repo.ts`)
take small, separate edits; neither session changes the other's preset.
Migrations take the next free number when they're written.

### A third session (8 October, evening): colours, layout, review fixes

Alex asked a third session to review the restaurant, estate agent and
repairs work, make the demo easy to get around with little scrolling, and
carry a website's colours through the demo. Done so far: the website's
three colours now drive every page (`web/src/reception/brand.ts`, light
pages for a light site; `cfdd5f0`), the workspace fits the window with
each column scrolling on its own (`a543053`), the builder keeps Back and
Next in view (`f566de2`), a `Folds` list in `builder/fields.tsx` for long
steps (`8f95fb1`), and four repairs safety fixes (`c3d9d7e`). Next it
compacts the long builder steps and back-office lists (repairs clients,
engineers and properties; estate hours, team, Applicants and Properties)
and works through a review's findings. It rebases before every push and
keeps edits to shared files small; if you are changing the same screens,
say so here.

### Property maintenance M3 (the cloud session): built (8 October)

M3 is done, and with it the repairs preset as the spec plans it
(`presets/property-maintenance.md` §12 has no M4). Built on 6–8 October:
blocks of flats with one job for a block's shared parts however many
residents ring (`4dea49c`, `8813538`), someone trapped in a block's lift
(`48cb20f`), insurance claims and business sites (`8d19612`), Scotland's
bank holidays (`4bf99ce`), a made-up reference caught on any call
(`6b809c2`, `6de4e41`), the compliance portfolio, "what have I got due
across my properties?" (Mr Kaur, `77d6caf`), the demo clock (a "Time"
button beside Reset; migration `voice_0010_demo_clock`, applied and
recorded; `fb5bf9a`), the office notice and engineers off sick or on
holiday (on Dispatch; kept in the workspace config as `office`, laid over
the profile at every rebuild; `a006442`), "your own properties" in the
builder with the week-at-a-glance strip on the Jobs board (`3a23016`), and
the answering mode, Relay UK calls and "texts only" (`2f4f997`). Ten M3
live calls were written and run (`f61f789`; see "Live calls (property
maintenance M3, 8 October)" below), and the walkthrough's final
screenshots went to Alex.

Not done, and needs a person: the safety advice in other languages is the
model's own translation (the number is always said in digits and texted).
Vetted translations of the gas, CO, fire and electrics scripts would need
a translator; flagged to Alex.

What next for this session is Alex's call: the next preset in the order
after the takeaway is the barber, which has no spec yet
(`presets/barber.md` would come first, as for the others).

### Estate agent

Built through M3. All twelve `ea-` calls were re-run on 8 October: 9 of 12
passed before the last fixes. Fixed since: viewing times now come back
with the short-lease or sale-agreed warning instead of being held back
(held back, the model guessed them; `3d98493`), a ready sentence for
anything not in the details (flooding), and promised call backs always
taken as a message (`d51bc35`). Later on 8 October a message promised
and then forgotten is stopped at hang-up and taken (`5406d7f`), and the
correction for an unchecked viewing time stops at "sorry, one moment".
Re-run on that code: `ea-short-lease`, `ea-listing-facts` and
`ea-personal-interest` all pass. Still seen at times: the model offers
viewing times before checking, caught and corrected by `invented_time`
(the scenario then fails on the flag, as it should); `ea-personal-interest`
fails only when the simulated caller makes up a mobile number.

Evening of 8 October (the cloud session), all twelve re-run after the
day's shared changes: 4 of 12 on the first run, most of the rest because
the simulated caller went quiet after a turn or two. Fixed from it
(`1e6ee66`, `e8c8266`): the buyer's position taken from their own words
when the booking leaves it out (and so the valuation offer for a home to
sell); "Thursday" booked as next week's Thursday is checked once against
the nearest; a valuation asks once why and when they're moving and
whether another agent has the home (not an executor); a placeholder such
as "[Caller's Name]" is never taken as a name. Every one of the twelve
has passed since (`eval-results/2026-10-08T18-10-55` and `T18-35-43`,
not in git). The Diary can give a viewing to someone else (panel or drag;
`4f8904b`), and the estate agent has the demo clock.

### Takeaway (the Windows session)

The spec is `presets/takeaway.md`, the use cases
`presets/takeaway-use-cases.md`. **M1 is built and live in the catalogue**
(7 October):

- Server preset `src/presets/takeaway/` (Firebird Chicken & Burgers,
  Nottingham; menu `fixtures/presets/takeaway-menu.json`); meal deals in
  `src/presets/food/deals.ts` (builder side) and `src/domain/deals.ts`
  (on a call: allergy answers choice by choice, the meal and saving offers
  made once, a no that stands, "a cheeseburger meal" is the deal).
- The kitchen, `src/core/kitchen.ts`: every order counted by when it must
  be ready, so collection and delivery share the slots; postcode zones
  with their own fee and minimum; free delivery over an amount; last
  orders, with everything handed over by closing; `get_wait_times`;
  `find_order` (today, by number or the calling phone, never the address).
- Paying the driver: asked once, with the change note on the ticket.
  Guardrails: made-up time, made-up price, card surcharge.
- Seed: a busy Friday (`src/presets/takeaway/seed.ts`); seeded orders move
  on with the clock (`advanceSeedOrders`).
- Back office: the kitchen board with an Out column, Drivers, and Call as
  (`src/presets/takeaway/personas.ts`). Builder: seven steps
  (`web/src/reception/builder/takeaway/`), with a Deals editor.
- Goldens: `test/fixtures/takeaway/` (`node scripts/takeaway-goldens.ts`).
  Walk: `--only takeaway`; screenshots in `eval-results/demo-ui/takeaway/`,
  sent to Alex on 8 October.
- The prompt at its largest is about 6,940 characters (limit 7,000): new
  guidance goes in tool answers.

**Live calls**, twelve `tk-` scenarios on `tk-firebird`
(`src/eval/scenarios.ts`): the ten for M1, and `tk-missing-item` and
`tk-anaphylaxis` for M2. The first run (7 October) passed 1 of 10; the
fixes since are in the commits titled "Takeaway calls: ...". Every one of
the twelve has now passed live at least once (8 October): the last full
run passed 7 of 12, and the five it failed passed or were fixed on re-runs
(`tk-meal-deal`, `tk-deal-declined` and `tk-deal-choices` on the next run, `tk-deal-allergy` and `tk-short-minimum` on the one after). Results still vary from run to run: the
simulated caller sometimes says "yes, bye" before it's asked anything,
and the receptionist sometimes misspeaks a time it was given ("quarter
past" for 7:45), which the guardrails catch. Re-run all twelve together
before reading much into one result.

**M2 is built** (8 October; the spec's §12 says what, and where it differs):
`find_order` actions for after the order, with requests on the ticket
(Accept and Refuse, texted either way) and complaints for the manager;
the anaphylaxis script (`src/core/reaction.ts`, 999 first, every tool held
until it's said); Menu tonight (sold out, delivery paused, long waits),
read on every order tool; big orders taking two slots and catering going
to the manager; the pay-on-the-phone list; guardrails `refund_claim` and
`address_read_back`; Call as Chris Bell and Dean Walsh; one change request
waiting after Start. Migrations `voice_0009_takeaway` and
`voice_0011_tonight` are applied to Supabase and recorded. The walk covers
the waiting request and Menu tonight; screenshots in
`eval-results/demo-ui/takeaway/`, sent to Alex on 8 October.

**M3 is built** too (8 October; the spec's §12 says what, and where it
differs): delivery to someone else (`recipient`, migration
`voice_0012_order_recipient`, applied and recorded); alcohol for an owner
who switches it on (off by default; adults only, the ID check, Check ID on
the ticket, Scotland's 10am to 10pm), with the shop's `nation`; "my usual"
(`find_order` action `last_order`, Leah Grant in Call as); drivers and
other callers; a Relay UK caller's order marked. Seven more test calls:
`tk-for-someone-else`, `tk-alcohol` and `tk-under-18` (on
`tk-firebird-licensed`), `tk-my-usual`, `tk-driver-asks`. Not built:
energy drinks (a ban still subject to Parliament; no energy drinks on the
sample menu), calories, "texts only".

**All seventeen takeaway calls together** (8 October, `--max-seconds 360`,
`eval-results/2026-10-08T12-13-32`, not in git): 13 passed, every M3 and
M2 call among them. Of the four: `tk-busy-wait` and `tk-out-of-area`
ended after two turns when the simulated caller went quiet; `tk-meal-deal`
opened its read-back with "That's sorted" and `tk-pay-driver` said "your
order is placed, number 246" before placing it. The guardrail caught both
and the real order was placed each time. The walk covers the alcohol
step and Beer and wine on Menu tonight.

The M3 screens were sent to Alex on 8 October.

**Next: the barber** (the next preset in Alex's order), taken by the
Windows session so the two sessions don't both start it. First its use
cases and spec (`presets/barber-use-cases.md`, `presets/barber.md`) with
defaults and decisions for Alex, as the takeaway's were; building waits
for his answers. The repairs demo's clock (`DemoClock.tsx`, the cloud
session's) is repairs-only; turning it on for the takeaway would let a
prospect try Saturday's last orders. After the takeaway, the next preset
in Alex's order is the barber.

### Working on Windows

The system git setting turns line endings into CRLF, which breaks the
goldens, so the Windows session works in its own worktree checked out with
LF (`git -c core.autocrlf=false` for checkout and rebase). The Gemini key
is in `voice-agent/.env.local` (git-ignored, never printed). Live calls:
`npm run eval -- --only tk-busy-wait,tk-meal-deal`. The walk needs
`CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"`.

## Earlier: picked up on 4 October (the session before stopped at the weekly usage limit)

The session of 4 October stopped at 97% of Alex's weekly limit (it resets
on Thursday 8 October, 15:00 UK time). Its last two checks' results were
only in that session's container, so they are copied here. Work directly,
in small steps; no subagents. Order: fix the confirmed call-engine problems
(A), the three failed live calls (B), the other reported problems after
reproducing each, re-check the data commit, then M2.

**Progress since (the next session, 4–5 October, on `voice-agent-DEV`).**
Everything in A and B below is done, each fix reproduced by a test first:

- Call engine: new problems 1–5 (`5c1d9b4`), the three *partly* items
  (`5553951`), and a new gap seen live: "I have you booked" with nothing
  booked is now a claim (`4628f1c`).
- B, the three failed live calls (`393f0c8`): never repeat the caller's
  figure; a search for a named home gives no price (open `get_property`
  first); a leasehold home's `mortgage_question` names the adviser and
  the solicitor; `ea-listing-facts` accepts "the house".
- Server: best and final always has two different bidders (`08657cc`);
  accepting a raise closes only the same phone's offers (`81cb2cd`).
- Back office: ID check badge back, no Cash before "anything to sell" is
  known (`4fa58a4`).
- Builder: shared ownership kept through a tenure change (`e99b839`), the
  home list lines up (`5cebc0c`), copy buttons named by week (`8a4d60c`),
  viewing hours with no days warned (`e0c0517`).
- Data re-check of `288aae9`: one slip, a buyer's travel time now counts
  from either booking (`ecb594d`).
- Live calls **do** run in a cloud session (an earlier note here said they
  couldn't; that was wrong). The live service is unsteady: a call can end
  early when the receptionist's model falls back and the simulated caller
  goes quiet. Re-run a call that ends after a turn or two before reading
  anything into it.
- Live run, night of 4–5 October (`eval-results/2026-10-04T22-51-23`, not
  in git): 2 of 7 passed (`ea-short-lease`, `ea-bank-details-change`).
  `ea-listing-facts` was right but the check read "no flood defences" as
  "never flooded" (check fixed in `e58e691`). Four calls ended with the
  receptionist silent mid-sentence for 45 s (after a tool's "not yet", or
  with no tool at all); the code from before this session (`13d333d`)
  stalls the same way on `ea-offer-taken`, so it is the live service that
  night, not the code. Re-run all seven before trusting either result. One
  real slip seen twice: a read-back phrased "I've booked ... is that
  right?" (rule 1 and the guard already cover it).
- The prompt at its largest is now about 6,960 characters (limit 7,000):
  put new guidance in tool answers, not the prompt.
- Next: M2 (below).

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

### 1. Estate agent milestone 2 (M2): built, live calls being tuned

The spec is `presets/estate-agent.md` (§12, M2). Built on 5 October, each
with tests (`test/estate-agent-tools.test.ts`, `test/demo-api.test.ts`) and
the walkthrough:
- Tools (`src/core/estate-tools.ts`): `find_party` (who the number is to
  us: bookings, portal enquiries, offers, seller or not, a missed call;
  booking from an enquiry marks it answered), `get_marketing_update`
  (verified seller only, in code, three tries a call), `get_offer_status`
  (the number that made it only), `record_viewing_feedback`,
  `register_buyer`, `stop_alerts`; `record_offer` says other offers exist.
  A verified seller's offer message is urgent and marked `seller_reply`.
- Prompt rule 7 names the checking tools (largest prompt 6,946 characters).
- Back office: *Call as* on the phone (`src/presets/estate/personas.ts`),
  *Applicants* (with Mark hot, Send matches, Stop alerts:
  `PATCH /workspaces/:id/buyers/:number`), *Valuations* (booked, done,
  outcome), "Seller replied by phone" on offers.
- Valuation outcomes (Instructed, Thinking with a follow-up day, Lost) are
  set from the Valuations view; "Try saying" suggests the M2 calls.
- Scenarios `ea-vendor-update`, `ea-stalker`, `ea-register-position`,
  `ea-personal-interest` (`src/eval/scenarios.ts`): all four pass live (5
  October, after `53adfb9`: registration now needs a search and the
  selling position first, and the seller update gives a sentence to say
  first).

Left for M2: re-run the seven M1 calls when the live service is steady.

### 2. Estate agent milestone 3 (M3): built (5 October)

- `get_sale_progress` (`src/core/estate-tools.ts`): by who is calling,
  checked in code: buyer or seller (milestones, recorded dates, chain,
  keys), a solicitor on the file (milestones; requests to the progressor),
  an agent in the chain (the chain line), the broker (agreed price,
  memorandum date); anyone else nothing.
- Sale actions (`PATCH /workspaces/:id/sales/:id` in `src/server/demo.ts`):
  tick a milestone (exchange makes the home exchanged), dates, log an
  update, *Completed: release keys* (on or after the completion date; texts
  the buyer), *Fell through* (a reason; back on the market texts back-up
  and consenting matching buyers, else withdrawn).
- `alertBuyers`: a price reduction or a return to the market texts
  consenting buyers it fits (back-up buyers on a return only).
- Back office: *Sales progress* tab (`web/src/reception/workspace/Sales.tsx`).
- A message from the buyer or seller in a sale under way goes to the
  progressor, urgent when pulling out; urgent messages say "will call you
  today".
- Rule 7 names `get_sale_progress` (largest prompt 6,965 characters).
- *Call as* adds Ben, Liam, Nadia and Harper & Co.
- *Describe your stock* (`src/presets/estate/stock.ts`): the Listings
  step drafts homes on made-up streets, every check unknown.
- `ea-fall-through` passes live (third run, after the routing fix).

Not done: Applicants' "send matches" and the alerts are pretend texts only,
as everywhere in the demo. Re-run all twelve `ea-` calls together when the
live service is steady.

### 3. Property maintenance: M1 built and live on this branch (5 October)

The spec is `presets/property-maintenance.md`. Alex's answers: go ahead,
with the demo area changed to **Nottingham, Derby and Loughborough** (real
districts NG1–NG11, DE1–DE3, DE21–DE24, LE11; every street invented and
shown "(example)"); the other five defaults stand. Built, in this order,
each with tests:

- Server preset (`src/presets/maintenance/`): answers and defaults
  (Fernhill Property Care, 8 engineers, 11 trades, 6 sample clients),
  sanitise, validate (§3's rules), the four-nation pack with the fixed
  safety scripts (`nations.ts`), compile (`profile.maintenance`; no
  `profile.booking`, so no table tools), preview, fact sheet, workspace.
- Data: 70 sample homes (`fixtures/presets/maintenance-properties.json`,
  no key safe code stored anywhere), migration `voice_0006_maintenance`
  (properties, jobs, certificates, incidents) applied to Supabase and
  recorded, repository calls, and a seeded week that replays under the
  window rules (`src/domain/windows.ts`; the replay is in
  `test/seed-replay.ts`).
- Receptionist: safety mode (`src/core/safety.ts`: an emergency in the
  caller's words arms it; every other tool refuses until the advice and
  the number are said), the tools (`src/core/maintenance-tools.ts`:
  `safety_advice`, `find_property`, `triage_fault`, `job`, `check_windows`,
  `compliance`), the prompt branch (about 5,400 characters; 6,460 at the
  largest), the §8 guardrails, and access codes removed from every
  transcript (all presets).
- Back office (`src/server/maintenance.ts`, `web/src/reception/workspace/`):
  Jobs, Dispatch (drag a job to an engineer's window), Properties and
  compliance (Book from a row), Safety log, the engineer's phone (accept or
  decline a page, On my way) and Call as.
- Builder (`web/src/reception/builder/maintenance/`): the eleven steps.
- Tests: `test/property-maintenance.test.ts`,
  `test/property-maintenance-tools.test.ts`, an end-to-end HTTP test in
  `test/demo-api.test.ts`, the golden corpus
  (`scripts/maintenance-goldens.ts`, `test/property-maintenance-golden.test.ts`),
  and the walk: `npm run e2e:demo -- --only property_maintenance`
  (screenshots sent to Alex on 5 October).
- Live calls, the seven `pm-` scenarios on `pm-fernhill`: see "Live calls
  (property maintenance)" below.

Deviations from the spec, written into it: office hours sit on the Visits
step; windows and engineers live in `profile.maintenance`, not
`profile.booking`; the Properties view's id is `compliance`; engineers keep
the estate agent's staff roles (`other`).

Not done (M3 in the spec): block managers, commercial sites and insurers,
the compliance portfolio, the demo clock, incident notice and engineer
absence, the property editor, the KPI strip, surge day, relay and
language support, Scotland's bank holidays (it counts England's for now).
M2 is section 4 below.

### 4. Property maintenance: M2 built (6 October)

Alex said "go on next milestone", directly and in small steps. Each step
was committed and pushed with `npm run check` green, and the repairs
goldens re-recorded in their own named commit each time (the restaurant's
and the estate agent's never changed):

1. Quotes and invoices: migration `voice_0007_mt_money`
   (`voice_mt_quotes`, `voice_mt_invoices`), applied to Supabase and
   recorded. The seed has four quotes waiting (Q-2291 among them), one
   approved, one declined, and 21 invoices (two from last month overdue;
   Ellie Burke, a Call as homeowner, still owes). Jobs: *Invoice* on a
   finished job.
2. Approvals on the client's own phone, never by voice (decision 4). Call
   as lists every client's phone, with Approve and Decline; Approve books
   the first free window from tomorrow, without the evening's extra
   charge, and texts the tenant. Off-call events reach a live call as a
   note (`CallNote`, `Bus.note`, `CallSession.note`): approvals, and pages
   accepted, declined or unanswered.
3. `find_invoice` and the repairs `take_demo_payment` (demo card only);
   *Homeowners pay the call-out by card when booking* in the prices step.
4. Social housing: Meadowbank Housing (six sample homes; 76 in all), "we
   act as their agent", the Awaab's Law 10-working-day clock on a damp
   job (England, social, agent), a possible emergency hazard flagged for
   the landlord to decide, consent before noting health, guardrails
   `damp_blame` and `medical_advice`. Seed: an open damp case labelled
   from Meadowbank's repairs policy, a hazard made safe, and the
   1 November 2026 electrical deadline on its homes.
5. Paging escalation: no answer in 15 minutes (a builder field) pages the
   other engineer on call, then texts the duty manager (`startPager` in
   `src/server/maintenance.ts`, every 30 s; *No answer* on the card).
6. Views *Clients* and *Quotes and invoices* (Remind, Paid by bank), and
   Call as: Jess at Harbour Lettings, Jean Ellis (Q-2291), Nadia Hussain
   (Meadowbank, damp and asthma).
7. The four M2 live calls (below), the walk with M2 screens, this note.

How it differs from the spec: the client's contact is the authoriser (an
agent's staff, like Jess, raise jobs; only the contact's phone approves);
Invoiced is a badge in "done and invoiced" below the board, not a column;
the job tool sends the approval itself when a caller asks to "go ahead
with Q-2291" as a new job, and asks once about breathing problems before
booking a social landlord's damp job.

The prompt at its largest is now about 6,960 characters (limit 7,000):
new guidance goes in tool answers.

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

## Live calls (property maintenance M3, 8 October)

Twenty-one `pm-` scenarios now: the eleven from M1 and M2 and ten for M3
(`pm-communal-door`, `pm-block-roof-leak`, `pm-lift-trapped`,
`pm-insurer-claim`, `pm-cafe-blocked-sink`, `pm-portfolio`,
`pm-storm-notice`, `pm-engineer-absent`, `pm-relay`, `pm-polish-gas`).
`pm-storm-notice` and `pm-engineer-absent` set the office notice or an
absence through the scenario's `setup`, on the tenant the call is given.

Every one has passed on the current code (the full run,
`eval-results/2026-10-08T12-02-45`, not in git, was 15 of 21 before the
last fixes; each of the six then passed on re-run). As before, the fixes
went into the tools rather than the prompt:

- Finding the home: the number someone rings from counts ("Flat 4, NG7",
  "Elm Road"); a full address already on file is never added again;
  "9, Riverside Court" reads 9 as the flat.
- Blocks: a door entry goes to an electrician; a roof (or rain through a
  ceiling) to a roofer, and is flagged as the block's shared parts as
  soon as the flat is found, so no price is said; the make-safe's
  reference is the one the caller is given.
- Insurers: the policyholder taken from the name and phone given; the
  confirmation to the claims desk and the claim text to the policyholder;
  no window surcharge offered to a client or insurer.
- Businesses: a missing purchase order asks the business questions even
  when "access" was filled in.
- Busy days: a repair taken as a message on an emergencies-only day is
  logged on the board too; moving a visit because our engineer is off
  costs nothing extra.
- Safety: a gas smell recognised in Polish, Romanian, Portuguese, Spanish,
  Italian, French and Lithuanian, with the advice in the caller's
  language; if the advice is said but the safety step skipped, the call
  logs it and texts the number as it ends; a chirping CO alarm named
  again stays a chirp.
- Damp: consent said aloud counts; "vulnerabilities" is read as
  vulnerable; hanging up on damp at a housing association's home with
  nothing raised is stopped once; a ready line for health questions (GP,
  NHS 111).
- Saying "booked" with nothing booked: a repairs call can't end "booked"
  without a job (stopped once); a landlord's gas check asked for as a
  repair is booked on the register by the job step itself; "the
  reference for that job is ..." is checked for being made up.
- Checks that were wrong: "nobody from us is booked", "speak to your GP
  about whether to keep him out of the room", and a reference written
  by the call but not read out (a block repair's) were all being flagged.

Seen but not fixed: the model sometimes adds "Not medical advice or
diagnosis; see a healthcare professional" to its health answers, in its
own words; the simulated caller still goes quiet now and then (the run
retries on the other model).

## Live calls (property maintenance M2, 6 October)

Eleven `pm-` scenarios now (the seven M1 ones and `pm-agent-over-limit`,
`pm-landlord-approves`, `pm-damp-asthma`, `pm-someone-at-door`).
`pm-landlord-approves` presses Approve on Mrs Ellis's phone mid-call
through the scenario hook `during` (`src/eval/scenarios.ts`), which acts
off the call as a second device would.

Every one has passed on the current code. The model varies from run to
run, so most fixes went into the tools rather than the prompt (it is at
about 6,960 of 7,000 characters at its largest): the job tool sends a
quote's approval itself, reads a price said in words, treats quoted work
as planned (not an emergency page), asks once about breathing problems
for a social landlord's damp job and for consent, answers "someone at my
door" from the board, and refuses visit windows for an emergency. Two
real bugs the runs found: "both" booked the gas record alone at £75, and
"nobody here is vulnerable" made a chirping CO alarm an emergency.

Seen but not fixed: the receptionist once said a made-up price for
replacing an alarm ("forty pounds"); no guardrail catches an invented
price yet. The simulated caller still goes silent now and then; the run
retries on the other model and carries on.

Last full run (`eval-results/2026-10-06T18-45-54`, not in git): 7 of 11,
then each of the four that failed was fixed in the tools and passed on
re-run (`pm-gas-record`, `pm-landlord-approves`, `pm-damp-asthma`,
`pm-agent-over-limit`; the last one also stalled once mid-call). Expect a
call or two to fail on any one full run: re-run before reading anything
into it, and fix what repeats.

## Live calls (property maintenance, 5 October)

The seven `pm-` scenarios on `pm-fernhill` (`node src/eval/run.ts --only
pm-...`; reports in `voice-agent/eval-results/`, not in git):

- Passing live: `pm-gas-smell` (first run), `pm-co-chirp`, `pm-burst-ooh`,
  `pm-diy-refused`, `pm-homeowner-repair`, `pm-eta`.
- `pm-gas-record`: every part has passed, in different runs (the register
  read and the date said; Callum booked in a morning at £75 with the row
  marked booked), but the last two runs stalled mid-call with the
  receptionist silent, as the live service does. Re-run it when the
  service is steady.
- Real slips fixed from these runs: the call-out price guessed for a gas
  record (the register now carries the prices); the street-flooding
  script for a burst pipe (the kinds are now described one by one, and
  the rules say stopcock first); "ninety five pounds" without a hyphen
  not counted as said; a job booked under the name "Owner"; refusing to
  give repressurising steps flagged as giving them; the record's end date
  not said unless asked. Several first-run failures were the checks, not
  the receptionist, and the checks are fixed.

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

- Moving a booking to another person is generic now (8 October, the cloud
  session; `4b4ed60`, `4f8904b`), ready for the barber: `repo.moveBooking`
  takes a table or a person (`kind: 'staff'`): a person must do the
  booking's service, work that weekday, be free (buffers kept) and have no
  personal interest in the home. The PATCH `move` action takes `to` (or
  the old `table`) and texts the customer who they'll now see (an estate
  agency's own "changed" text, or a plain one for any other business);
  `notify: false` sends nothing. On the web, `personOptions()` in
  `workspace/model.ts` lists who it can go to (the team in `/state` now
  carries each person's `services`, and each booking its `service_key`
  and `buffer_minutes`); the drawer has "Move to someone else", and
  `StaffDiary` takes `onMove` and drags a bar to another row, lighting the
  rows it can go to.
- The takeaway's order fields (`ready_at`, `driver`) are written but not yet
  read back (do it when the takeaway is built).
- The demo clock (the Time button) is a switch in each preset's workspace
  spec now, `clock: true` (8 October, the cloud session; `de7fe18`,
  `43c4a7c`): on for the restaurant, estate agent and repairs. For the
  takeaway, its own session can switch it on once its staff actions stamp
  `tenantNow(t)` rather than `new Date()` (`answerRequest` and
  `sendOutOrder` in `src/server/demo.ts` still use the real time); the
  back office already opens at the demo's day and time.
- `test/takeaway-demo.test.ts` ("a takeaway end to end") fails about one
  run in three: the seed's made-up phones can draw 07700 900811, the
  number the test uses for its own order, so "the prospect's own orders are
  cleared" finds a seeded one. Seen by the cloud session on 8 October and
  left for the takeaway's session (reserve 900811 in the seed, or use a
  number the seed never draws).
- `NEXT-SESSION-PROMPT.md` is from an older session; use this file instead.

## Testing as Alex does

- **Codespace**:
  `https://codespaces.new/alxx-22/n.abl/tree/voice-agent-DEV?devcontainer_path=.devcontainer%2Fvoice-agent%2Fdevcontainer.json`
  It installs Chromium. Then run `npm run check:all`.
- **In the app**: in the console, issue a key, then open `/demo/reception` on
  the same address and enter it. After pulling new code, restart `npm run dev`
  and press **Reset** in the demo. The estate agent is now on the "Build a new
  demo" page.
