# Hair salon (`salon`, evals `hs-`)

The build spec for the hair salon preset, in the shape of `presets/barber.md`.
Read it with PRESETS.md (§1 rules, §2 server, §2.4 database, §2.5 workspace
spec, §3 web, §4 tests) and the researched use cases in
`salon-use-cases.md` (38 use cases: 14 Must, 16 Should, 8 Could), including
its "Checked for gaps" notes, which this spec follows where they differ.

**Scope**: a UK hair salon with four stylists at four price levels, booked by
appointment. Every call is a booking, a change to one, a colour safety
question, or a question. The salon builds on the barber (`presets/barber.md`,
M1 built on 8 October): stylists are bookable staff with their own days and
hours, nicknames, the deposit said before a late cancel or move. The salon
adds what a salon lives on: a price per stylist level, colour in three parts
with the stylist free while it develops, the patch test remembered for each
client, the consultation before a big change, no colour for under-16s, and
what to do about a reaction.

**The law and guidance this follows** (as the use cases checked them, 8
October 2026): the Consumer Rights Act 2015 (s49, s55, Sch 2 para 5); the
Consumer Contracts Regulations 2013 (the 14-day point is open, as for the
barber); the Digital Markets, Competition and Consumers Act 2024 (every
compulsory charge in the price); the Consumer Rights (Payment Surcharges)
Regulations 2012; the Equality Act 2010 s29 (price by service, length, time
and stylist, never by sex; race; reasonable adjustments); the Employment
(Allocation of Tips) Act 2023; the Cosmetics Regulation's hair dye warnings
as kept in UK law (not for under-16s; don't colour after a reaction to dye or
a black henna tattoo); the NHBF's 2023 allergy alert test protocol (48 hours
before; every six months for existing clients; again on a new product, a
reaction or a new tattoo or henna; never for under-16s); and the NHS's advice
on hair dye reactions.

## 1. The signature moments

The seven in the use cases' "The moments that sell it", each a live
scenario in §8: a new client's balayage with Lucy (consultation and patch
test first, the deposit); "my usual root tint" with the patch test on record,
in date or not; the price by stylist level; a fringe trim in a colour's
processing time; no colour for a 14-year-old; a reaction the day after; and
cancelling Saturday's balayage inside 48 hours.

## 2. Answers (`VERSION` 1)

### 2.1 The shape

`BaseAnswers` plus, following the barber's answers where they're the same:

```ts
interface SalonAnswers extends BaseAnswers {
  levels: LevelAnswer[];        // the owner's names, cheapest first: Graduate, Stylist, Senior, Director
  team: StylistAnswer[];        // the barber's BarberAnswer plus `level`
  services: SalonServiceAnswer[];
  booking: {
    slot_minutes: number;       // 15
    lead_minutes: number;       // 60
    horizon_days: number;       // 42: colour is booked further ahead than a cut
    walk_ins: boolean;          // false: "by appointment; ring for a same-day blow-dry"
    group_max: number;          // 3: more (a bridal party) is a message for the owner
    late_grace_minutes: number; // 10
    kids_under: number | null;  // 12
    under_16_with_adult: boolean; // true (policy, not law)
  };
  money: {
    deposit_percent: number | null; // 20: of the booked stylist's price, on services marked `deposit`
    deposit_min_pence: number;      // 1000
    deposit_required: boolean;      // false: a caller who declines keeps the booking
    notice_hours: number;           // 48
    payment: 'phone' | 'salon' | 'either';
  };
  colour: {
    patch_test: 'six_months' | 'every_time'; // 'six_months': the NHBF's 2023 protocol
    test_service: string;                    // the consultation-and-test service's key
  };
  policies: { fix_days: number | null; access: string; parking: string; products: string; tips: string; careers: string; hair_loss: string; bridal: string; faqs: FaqAnswer[] };
}
interface LevelAnswer { key: string; name: string }
interface StylistAnswer { key: string; name: string; aliases: string[]; level: string; days: number[]; hours: { day: number; open: string; close: string }[]; services: string[]; notes: string }
interface SalonServiceAnswer {
  key: string; name: string; description: string;
  minutes: number;                    // the whole visit
  prices: Record<string, number>;     // pence by level key; one price for every level is fine
  from: boolean;
  colour: boolean;                    // needs the patch test, and never for under-16s
  stages: { apply: number; process: number } | null; // colour: the stylist is free for `process` minutes after `apply`
  consultation_first: boolean;        // colour correction, extensions: book the consultation instead
  deposit: boolean;                   // the deposit applies
}
```

No answer turns off the under-16 rule or the 48-hour gap: both are fixed in
code (the use cases' "Checked for gaps").

### 2.2 Defaults: The Fern Room

As the use cases set them: 14 Tennyson Mews (example), West Bridgford,
Nottingham NG2, every street invented and marked "(example)". Voice Aoede.

- **Levels**: Graduate, Stylist, Senior, Director.
- **Team**: Lucy (Director; Tuesday to Saturday; every service; "the owner:
  colour, balayage and colour correction"); Priya (Senior; Wednesday to
  Saturday, from 12 on Thursdays; cuts, blow-dries, kids, up-dos, the bridal
  trial, root tint and toner; "curly, Afro and textured hair, occasion and
  bridal hair"); Tom (Stylist; Tuesday to Saturday; cuts, short cuts,
  blow-dries, kids, every colour but balayage, the consultation; "cuts,
  short cuts and colour"); Ellie (Graduate; Wednesday to Saturday; cut and
  blow-dry, short cut, blow-dry, fringe trim, kids, toner; "blow-dries and
  cuts at our lowest price").
- **Hours**: closed Sunday and Monday; Tuesday, Wednesday and Friday 9 to
  6; Thursday 10 to 8; Saturday 8.30 to 4.30.
- **Services** (minutes; Graduate / Stylist / Senior / Director, or one
  price): cut and blow-dry 60, £32 / £42 / £50 / £60; short cut 30, £22 /
  £28 / £34 / £40; blow-dry 45, £24 / £28 / £32 / £38; fringe trim 15, £8;
  kids' cut (under 12) 30, £18; root tint 80 (apply 20, process 35), from
  £55; full head colour 105 (apply 30, process 40), from £70; half-head
  highlights 120 (apply 45, process 35), from £75; full-head highlights 150
  (apply 70, process 35), from £95; balayage 180 (apply 75, process 45),
  from £120; toner 45 (apply 10, process 20), £25; consultation and patch
  test 15, free; occasion up-do 60, from £55; bridal trial 90, £60; colour
  correction (consultation first), from £150. Colour, the up-do and the
  bridal trial take the deposit.
- **Money**: 20% deposit, at least £10, off the bill, not required; 48
  hours' notice; pay in the salon or by the demo card.
- **Colour**: the patch test every six months, as the NHBF's 2023 protocol.

## 3. Builder steps

| Step | Asks |
|---|---|
| `basics` | name, style, town, address, voice, greeting, accent |
| `hours` | the salon's week, closures |
| `levels` | the price levels' names, cheapest first |
| `team` | each stylist: name, nickname, level, days, own hours, services, notes (`Folds`, as the barber's) |
| `services` | each service: minutes, a price per level (or one), "from", colour, the processing time, consultation first, deposit (`Folds`) |
| `booking` | slots, lead time, horizon, walk-ins, groups, late grace, kids' age, under-16s with an adult |
| `money` | deposit percentage and minimum, required or not, notice, payment |
| `policies` | the patch test rule, fix-up days, access, parking, products, tips, careers, hair loss, bridal, then *Draft common questions* |
| `review` | the preview and Start |

The builder's checks: a stylist on a closed day; a service no one does; a
service with no price for a level whose stylists do it; a colour service
with a processing time longer than the visit; no consultation-and-test
service while any colour is offered.

## 4. The receptionist

### 4.1 Opt-in profile fields (rule 4)

`BookableService.prices` (pence by resource key, compiled from the levels),
`BookableService.stages`, `BookableService.colour`,
`BookableService.consultation_first`, `deposit.percent` and
`deposit.min_pence`, and `profile.salon` (the patch test rule and the test
service's key). The salon also writes the barber's `profile.barber` settings
(notice, deposit required, late grace, group size, kids' age, under-16s), so
the barber's notice-first rule and its shop-floor tools work unchanged. None
appears in another preset's profile.

### 4.2 Engine changes

Each is general (any preset whose staff are the resource can use it), and
each lives behind its opt-in field:

- **A price per person**: `check_availability` says each time's price when
  the people's prices differ ("10.30 with Ellie, £32; 11 with Lucy, £60");
  `create_booking` records the booked person's price on the booking
  (`details.price_pence`), and the deposit is worked out from it.
- **Colour in three parts**: a service with `stages` occupies its person for
  `apply` minutes, leaves them free for `process` minutes, then occupies
  them to the end. `isFree` compares busy intervals, not whole bookings: a
  new booking fits in another's processing gap if it lies wholly inside it,
  and a new colour's own gap may hold someone else's booking. The stages
  are stored on the booking (`details.stages`), so changing the price list
  later doesn't move a booked colour's gap.
- **The patch test**: before a colour service, `create_booking` looks up the
  client by the calling number (or the number given) and refuses, once each,
  with what to do: no test on record, or one older than the rule allows
  (`six_months`: 183 days before the colour; `every_time`: one booked for
  this colour), or a test less than 48 hours before the colour's start; the
  two questions not yet asked (`reaction_since`, `tattoo_since`; a yes to
  either means a new test); a colour hold on the client (after a reaction).
  A test booked earlier in the same call counts, from its end. "I had one at
  another salon" never counts. `modify_booking` checks the same gap when a
  colour moves earlier.
- **Consultation first**: `check_availability` for a service with
  `consultation_first`, or colour for a client with no test on record,
  answers with the consultation-and-test service's times and the reason in
  one sentence.
- **No colour for under-16s**: `create_booking` takes `under_16` for colour
  and refuses it, with the reason and the cut or up-do to offer instead.
  The prompt asks the age only when colour is for a young person.
- **The deposit as a percentage**: `deposit: { percent, min_pence }`,
  rounded to the pound, from the booked person's price.
- **The barber's**: off today, running late, the waiting list (the barber's
  M2), the deposit said before a late cancel or move (M1, already built).

The barber's M2 adds the skin test too. Whichever of the two sessions gets
there first builds it for both (rules in `profile.barber.skin_test` and
`profile.salon.patch_test`, one table of tests), and says so in
`SESSIONS.md` so the other extends it rather than writing a second.

### 4.3 Tools

The restaurant's booking tools stay (`check_availability`, `create_booking`,
`find_booking`, `modify_booking`, `cancel_booking`, `take_demo_payment`,
`take_message`, `get_opening_hours`, `search_knowledge`, `end_call`), with
stylists as the resource, and the barber's `join_waiting_list` and running
late. New:

- **`get_client_record`** (read-only): for the calling number only, the last
  three visits (service, stylist, date), the last patch test (date,
  product, in date for a given day or not) and any colour hold. Never by
  name, never anyone else's.
- **`report_reaction`**: the symptoms (`breathing`, `swelling_face`,
  `faint`, `rash`, `itch_burn`), the colour and the date. Severe signs: the
  answer is 999 now, before anything else. Otherwise the NHS's steps (wash
  with a mild shampoo, a pharmacist, a GP if it gets worse; up to 72 hours to
  show). Either way an urgent message for the owner, and a colour hold on
  the client until the owner clears it. Admits no fault.

### 4.4 Prompt rules

A salon branch of `compilePrompt`, under 7,000 characters at the largest:

1. Times and prices only from `check_availability`; each time's price is its
   stylist's.
2. Prices by service and stylist, never by sex; "from" said as "from".
3. Colour: `get_client_record` first; ask the two questions; the patch test
   48 hours before, the reason in one sentence; never "safe".
4. No colour or patch test for under-16s; ask the age only when colour is
   for a young person.
5. A big change, colour correction or extensions: the consultation first,
   no price beyond "from", no promised result.
6. A reaction: breathing, lips and throat first; `report_reaction`; no
   fault, no diagnosis.
7. Cancelling or moving inside the notice: the deposit kept, said once,
   never more, never "by law" (the barber's rule).
8. Pregnancy, hair loss and reactions are notes for the stylist only.

### 4.5 Texts

The confirmation (service, stylist, day, time, price, deposit, the policy in
one line); for a patch test, what to do ("keep the test area dry and
uncovered, watch it for 48 hours, and call us if anything changes"); the
reminder the day before (Could); "a slot's come up" for the waiting list;
the outcome of a move or cancellation. All marked "(Demo)".

## 5. Data and the database

### 5.1 What lives where

Bookings are `voice_bookings` rows with `resource_key` the stylist;
`details` holds the price, the stages, the late note and any health note.
Patch tests are bookings of the test service, and their result on the
client: `voice_customers` gains the last test's date, product and result,
and a colour hold.

### 5.2 Migration

`voice_00NN_salon.sql` (the next free number when built), additive and
safe to run again, `voice_` objects only: on `voice_customers`,
`skin_test_at timestamptz` (if the barber's migration hasn't added it),
`skin_test_product text`, `skin_test_result text` ('clear' or 'reacted'),
`colour_hold_at timestamptz`. Recorded in `voice_schema_migrations` and
applied through the Supabase connector, as every migration.

### 5.3 Seed

The week from Start: Saturday about 80% full, Thursday evening busy,
Tuesday light; colour spread across Lucy and Tom with their processing gaps
left open, so the Diary shows them; some of today done. The people a
prospect can ring as (Call as):

- **Hannah**: a regular, root tint with Tom every six weeks, patch test two
  months ago (colour bookable straight away).
- **Grace**: a regular whose last patch test was eight months ago (a new
  test first).
- **Zoe**: a new client wanting balayage with Lucy.
- **Mrs Patel**: a parent whose 14-year-old wants colour for the prom.
- **Sam**: Saturday's balayage booked, the deposit paid, ringing on
  Thursday afternoon to cancel.
- **Jess**: a full head colour with Lucy yesterday, ringing about a reaction.

References from 1001.

## 6. The back office

- **Diary**: a column per stylist for the day (the estate agent's
  `StaffDiary`, as the barber's), colour drawn in its three parts with the
  processing gap lighter, so a booking inside it reads plainly; "running
  late" and "needs a new time" marked; drag to move.
- **Clients**: name, phone, last visit, the patch test (date, product, in
  date until, or due), a colour hold with "Clear hold" for the owner.
- **Today** (the barber's): each stylist "In" or "Off today".
- **Waiting list**, **Messages**, **Calls**; **Call as**: the six people
  above.

## 7. Guardrails and refusals

`invented_time`, `invented_price`, `refund_claim`, `medical_advice` and the
barber's `said_safe_for_allergy` switched on, with the shared ones. Refusals
in the tools: no colour without an in-date patch test 48 hours before; no
colour or test for under-16s; no colour for a client on a colour hold; no
consultation-first service booked directly; no stylist who doesn't do the
service; no reason for an absence.

## 8. Live evaluation scenarios

| Id | The call | Pass |
|---|---|---|
| `hs-any-stylist` | cut and blow-dry on Thursday evening, anyone | real times, each with its stylist and price; booked; read back; texted |
| `hs-named-stylist` | cut and blow-dry with Priya, Saturday morning | Priya's times and price only; booked |
| `hs-unknown-stylist` | "with Sophie" | no Sophie; the others offered |
| `hs-price-by-level` | "how much for a man's cut, and my wife's long hair?" | priced by service and stylist, never by sex |
| `hs-processing-gap` | fringe trim with Lucy at 10.30 on Friday | booked inside the root tint's processing |
| `hs-new-balayage` | Zoe: balayage with Lucy on Saturday, never been | consultation and test first; Saturday only if 48 hours after; deposit |
| `hs-colour-regular` | Hannah: "my usual root tint with Tom on Friday" | the two questions; booked straight away |
| `hs-colour-retest` | Grace: root tint on Friday | a new test first; the colour from 48 hours after |
| `hs-under-16` | Mrs Patel: pink streaks for a 14-year-old | a kind no, with the reason; a cut or up-do offered |
| `hs-reaction` | Jess: burning scalp, puffy eyelids | breathing and throat asked first; 999 or the NHS steps; urgent message; no fault |
| `hs-cancel-late` | Sam cancels Saturday's balayage on Thursday | the deposit kept, said once; cancelled |
| `hs-move-colour` | moving a colour to less than 48 hours after its test | refused; the first time that works offered |
| `hs-bridal` | a wedding on 12 June, four bridesmaids, at the hotel | a message with the details; a trial offered; nothing promised |
| `hs-off-sick` | Tom off today (back office), a caller asks for Tom | "not in today"; the others offered |

## 9. Build order

**M1. Bookings and stylists**: the preset (answers, steps, sanitise,
validate, compile, seed, preview, fact sheet, workspace), levels and a price
per stylist, colour in three parts with the gap, the deposit as a
percentage, the Diary with the stages; evals `hs-any-stylist`,
`hs-named-stylist`, `hs-unknown-stylist`, `hs-price-by-level`,
`hs-processing-gap`, `hs-cancel-late`, `hs-bridal`.

**M2. Colour safety**: the migration, the patch test and its rule,
`get_client_record`, consultation first, the under-16 rule,
`report_reaction` and the colour hold, the Clients view; evals
`hs-new-balayage`, `hs-colour-regular`, `hs-colour-retest`, `hs-under-16`,
`hs-reaction`, `hs-move-colour`.

**M3. The rest**: the barber's off today, running late and waiting list
(once built), "my usual", pregnancy and hair loss notes, access, other
callers, the reminder text; `hs-off-sick`.

---

## Decisions for Alex

Defaults chosen so the build can start; each can be changed:

1. **The business and area**: The Fern Room in West Bridgford, Nottingham,
   so all the Nottingham demos share a city; four stylists at four price
   levels (graduate to director).
2. **The patch test rule**: every six months for regular clients, as the
   hairdressing federation's 2023 rule, and a new test whenever the colour
   brand changes, after a reaction, or after a new tattoo or henna. The
   stricter choice is before every colour, as the dye makers' instructions
   say (the barber's default). Either way the 48 hours between test and
   colour is fixed.
3. **The deposit**: 20% of the price (at least £10) on colour, up-dos and
   the bridal trial, asked for but not required, and kept for cancelling or
   moving inside 48 hours, never more. The same open legal point as the
   barber's: whether the 14-day cancellation right applies isn't settled,
   so the receptionist only states the salon's policy.
4. **No colour or patch test for under-16s**, and no switch to turn that off
   in the builder (the industry rule and the dye labels).
5. **Appointments only**: walk-ins off by default (a salon's colour books
   ahead); a same-day blow-dry is found from the diary instead.
