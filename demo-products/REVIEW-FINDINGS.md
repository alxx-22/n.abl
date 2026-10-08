# Review findings still to check (8 October, evening)

A review of the restaurant, estate agent and repairs code found these, but
its second check didn't run (the usage limit stopped it), so **reproduce
each one before fixing it**: some may be wrong. The high ones are already
fixed (`c3d9d7e` repairs safety mode, `aa1ebe6` restaurant allergy and
"lunch fully booked", `1edede2` a buyer dropped from Applicants).

Who takes which is agreed in `SESSIONS.md`. Tick one off here, with its
commit, when it's fixed or shown to be wrong.

**Estate agent (server)**

- [x] [medium] A countered offer cannot be closed, is never told of an acceptance, and the seller hears it is 'about to be put to you' (`src/server/demo.ts:737`) Fixed in `e35c1c6`.
- [x] [medium] Changing a home's status in Properties leaves its sale disagreeing, and re-marketing a withdrawn home skips the back-up buyers (`src/server/demo.ts:821`) Fixed in `2bc9b93`.
- [x] [medium] A viewing on a withdrawn or sold home stays booked and the receptionist moves it to a new day (`src/core/tools.ts:773`) Fixed in `c84d419`.
- [x] [medium] A buyer offering on a home in best and final is never told the deadline (`src/core/estate-tools.ts:854`) Fixed in `75f5e73`.
- [x] [medium] The builder's 'Book viewings and valuations when the office is shut' switch does nothing (`src/presets/estate/compile.ts:114`) Fixed in `b1215d7`.
- [x] [low] Unknown broadband or mobile never names Ofcom's checker, because of a key mismatch (`src/core/estate-tools.ts:846`) Fixed in `ba74a58`.
- [low] Seeded sales contradict their own logs and chain (`src/presets/estate/seed.ts:487`)
- [low] Seeded valuation leads are listed as buyers, and the owner who instructed 19 Copse Lane is not its seller (`src/presets/estate/seed.ts:380`)
- [low] The home 'new to the market today' has a portal enquiry from yesterday and, with some seeds, viewings last week (`src/presets/estate/seed.ts:594`)
- [x] [low] Removing a home in the builder makes get_offer_status and record_viewing_feedback fail for its buyers (`src/core/estate-tools.ts:1081`) Fixed in `32aa55a`.

**Restaurant**

- [medium] Times inside the notice period, or already gone, are called "taken", and changing tonight's booking close to its start is refused (`src/domain/availability.ts:213`)
- [medium] A table marked No-show or Finished stays taken for callers and staff moves, while the floor plan shows it Free (`src/db/repo.ts:446`)
- [medium] The default restaurant takes phone bookings up to 10, but parties of 9 or 10 can never be booked and are told to try another day (`src/presets/seating/floor.ts:130`)
- [medium] The restaurant's "Postcode districts" box drops every comma and space typed, so a second district cannot be entered (`web/src/reception/builder/food/Ordering.tsx:62`)
- [medium] Deposit mode "Card details to secure" never takes a card, though the builder and the policy say it does (`src/presets/seating/floor.ts:98`)
- [low] Tables in an enquiry-only private room are called walk-in tables in the Timeline, the click toast and the legend (`web/src/reception/workspace/Timeline.tsx:76`)
- [low] Clearing a name and pausing refills the box with a placeholder; a cleared table name takes another table's number (`src/presets/seating/tables.ts:43`)
- [low] On a closure day, Start fills the Kitchen with today's takeaway orders (`src/presets/food/seed.ts:17`)
- [low] A restaurant whose tables all seat 6 or more starts with an empty week (`src/presets/seating/seed.ts:84`)
- [low] Broken phrases the receptionist is given: "There is no the inside…", "in the inside", "(1 tables…)" (`src/domain/availability.ts:286`)

**Repairs (server)**

- [x] [medium] In-hours page declined or unanswered goes to last night's on-call pair (`/home/user/n.abl/src/server/maintenance.ts:245`) Fixed in `5e17c27`.
- [x] [medium] In-hours emergency pages an engineer the office marked off sick (`/home/user/n.abl/src/core/maintenance-tools.ts:669`) Fixed in `5e17c27`.
- [x] [medium] A waiting job given a new window stays 'waiting' and can't go on the way (`/home/user/n.abl/src/server/maintenance.ts:220`) Fixed in `ab7a2d8`.
- [x] [medium] Register's booked_job: voice books twice, and cancel or done never clears it (`/home/user/n.abl/src/core/maintenance-tools.ts:1366`) Fixed in `b36dd5b` (a finished check also renews the record now).
- [x] [medium] Call-out invoice ignored: job billed twice, and stays due after cancel (`/home/user/n.abl/src/server/maintenance.ts:330`) Fixed in `223107c`.
- [x] [low] Gas record offer says '(£30 extra)' but the price excludes it; tenant told too (`/home/user/n.abl/src/core/maintenance-tools.ts:1370`) Fixed in `7d8dc51`.
- [x] [low] Safety log shows every non-gated incident as 'Not confirmed as said', with no follow-up job (`/home/user/n.abl/src/core/maintenance-tools.ts:1422`) Fixed in `1c788d7`.
- [x] [low] Bank holidays are working days: Christmas windows booked, emergencies paged in-hours (`/home/user/n.abl/src/core/maintenance-tools.ts:366`) Fixed in `0716ac0`.
