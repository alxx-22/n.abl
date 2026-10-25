# Barber (`barber`, evals `bb-`)

The build spec for the barber preset, in the shape of `presets/takeaway.md`.
Read it with PRESETS.md (§1 rules, §2 server, §2.4 database, §2.5 workspace
spec, §3 web, §4 tests) and the researched use cases in
`barber-use-cases.md` (36 use cases: 11 Must, 16 Should, 9 Could), including
its "Checked for gaps" notes, which this spec follows where they differ.

**Scope**: a UK barber shop with four barbers, booked by appointment and
taking walk-ins when a chair is free. Every call is a booking, a change to
one, the wait now, or a question. The restaurant's booking engine already
books appointments with staff as resources (the `fade-and-co` fixture, the
estate agent's diaries); the barber builds on it and adds what a shop that
lives on chairs needs: each barber's own days and hours, the walk-in queue,
"off today", the 48-hour skin test before colour, several bookings in one
call, and the deposit policy said plainly.

**The law this follows** (as the use cases checked it, 8 October 2026): the
Consumer Rights Act 2015 (s49 reasonable care and skill, s55 repeat
performance, Sch 2 para 5 disproportionate cancellation sums); the Consumer
Contracts Regulations 2013 (whether the 14-day right applies to a haircut
booked by phone is open, see Decisions for Alex); the Digital Markets,
Competition and Consumers Act 2024 (every compulsory charge in the price);
the Consumer Rights (Payment Surcharges) Regulations 2012 as amended (no card
surcharges); the Equality Act 2010 (the same service at the same price for
anyone; reasonable adjustments; race); the Employment (Allocation of Tips)
Act 2023; and the dye makers' instruction of an allergy alert test 48 hours
before each colour.

## 1. The signature moments

The seven in the use cases' "The moments that sell it", each a live
scenario in §9: Marcus on Saturday with the deposit; the walk-in wait from
the live queue; the beard colour and the skin test; running late; cancelling
inside 24 hours; Dan off sick from the back office; two kids and their dad
in one call.

## 2. Answers (`VERSION` 1)

### 2.1 The shape

`BaseAnswers` plus:

```ts
interface BarberAnswers extends BaseAnswers {
  team: BarberAnswer[];        // each barber: name, nickname, days, hours, services, notes ("Afro and textured hair")
  services: ServiceAnswer[];   // name, minutes, price, "from" price, description, colour (needs a skin test)
  booking: {
    slot_minutes: number;      // 15
    lead_minutes: number;      // 30: the soonest a phone booking can start
    horizon_days: number;      // 28
    walk_ins: boolean;         // true: "welcome when a chair is free"
    group_max: number;         // 4: more is a message for the owner
    late_grace_minutes: number; // 10
    kids_under: number | null; // 12: the kids' price age; null: none
    under_16_with_adult: boolean; // true (policy, not law)
  };
  money: {
    deposit_pence: number | null;  // 500; null: none
    deposit_required: boolean;     // false: a caller who declines keeps the booking
    notice_hours: number;          // 24: free to cancel or move before this
    payment: 'phone' | 'shop' | 'either';
  };
  colour: {
    skin_test: 'every_time' | 'six_months'; // 'every_time', as the dye's instructions say
    test_minutes: number;                   // 5
  };
  policies: { fix_days: number | null; access: string; parking: string; products: string; tips: string; careers: string; home_visits: string; faqs: FaqAnswer[] };
}
interface BarberAnswer { key: string; name: string; aliases: string[]; days: number[]; hours: { day: number; open: string; close: string }[] | null; services: string[]; notes: string }
interface ServiceAnswer { key: string; name: string; minutes: number; price_pence: number; from: boolean; description: string; colour: boolean; combines?: string[] }
```

### 2.2 Defaults: Kingsley's Barbers

As the use cases set them: Nottingham city centre NG1 (22 Hockley Row),
every street invented and marked "(example)". Marcus (owner; every service), Dan (cuts, beards,
shaves; not Sunday), Jordan (cuts and kids; Tuesday to Saturday), Amira
(cuts, grey blending, beard colour; Friday and Saturday). Hours: closed
Monday; Tuesday to Friday 9 to 6, Thursday to 8; Saturday 8 to 5; Sunday 10
to 3. Services: classic cut 30 min £18; skin fade 45 min £22; cut and beard
50 min £28 (combines cut and beard trim); beard trim 20 min £12; hot towel
shave 30 min £20; kids' cut 30 min £13; grey blending 45 min from £25
(colour); beard colour 30 min £15 (colour); skin test 5 min free. Deposit £5,
not required; 24 hours' notice; pay in the shop or by the demo card. Voice
Charon.

## 3. Builder steps

| Step | Asks |
|---|---|
| `basics` | name, style, town, address, voice, greeting, accent |
| `hours` | the shop's week, closures |
| `team` | each barber: name, nickname, days, own hours if different, services, notes |
| `services` | each service: minutes, price, "from", description, colour |
| `booking` | slots, lead time, horizon, walk-ins, groups, late grace, kids' age, under-16s |
| `money` | deposit, required or not, notice, payment |
| `policies` | skin test rule, fix-up days, access, parking, products, tips, careers, home visits, then *Draft common questions* |
| `review` | the preview and Start |

## 4. The receptionist

### 4.1 Opt-in profile fields (rule 4)

`Resource.hours` (a barber's own hours by weekday), `BookableService.colour`
(needs a skin test) and `combines`, `booking.walk_ins`, `booking.late_grace_minutes`,
`booking.group_max`, `booking.kids_under`, and `profile.barber` for the
skin-test rule and the notice period. None appears in the restaurant's or
the estate agent's profiles.

### 4.2 Engine changes

- **A barber's own hours**: `checkAvailability` intersects a staff
  resource's `hours` with the service window, so Dan's Thursday ends when
  his does.
- **Off today**: a per-date state (`voice_tenants.today`, the takeaway's
  `tonight` column generalised, or a column of its own; see §5.2) holding
  barbers off today; read on every tool call; their bookings today flagged
  `needs_new_time`. A caller hears "Dan's off today", never why.
- **Back-to-back and several bookings in one call**: `create_booking` takes
  `after` (the reference it follows) to book the same barber straight after;
  one confirmation text for the call's bookings.
- **The skin test**: a colour service refuses unless the customer has a
  skin test 48 hours or more before it (from `voice_customers`), and for
  `every_time`, one taken for this booking. The test is a service of its
  own. "I had one elsewhere" doesn't count.
- **The walk-in queue**: `get_wait_now` counts the waiting walk-ins and each
  barber's diary now, and says who's free soonest and roughly when. Never
  holds a chair.
- **Running late**: a note on the booking for the barber; within the grace,
  kept; beyond it, the next booking decides.
- **A waiting list**: per day; a cancellation texts the first on it.

### 4.3 Tools

The restaurant's booking tools stay (`check_availability`, `create_booking`,
`find_booking`, `modify_booking`, `cancel_booking`, `take_demo_payment`,
`take_message`, `get_opening_hours`, `search_knowledge`, `end_call`), with
barbers as the resource (`resource` by name or nickname, "any"). New:

- **`get_wait_now`** (read-only): the walk-in wait now, by barber.
- **`join_waiting_list`**: a day, a service, a barber or any, the name and
  number.

`find_booking` gains `action: 'running_late'` (the minutes, a note for the
barber, and what happens to the booking).

### 4.4 Prompt rules

A barber branch of `compilePrompt`, under 7,000 characters at the largest:

1. Times only from `check_availability`; a named barber's times only.
2. Read back service, barber, day, time and price before booking; the
   deposit after.
3. Cancelling or moving inside the notice period: say the deposit is kept,
   once, and never more, never "by law".
4. Colour: the skin test first, 48 hours before; never "safe".
5. A walk-in wait is an estimate; only a booking holds a chair.
6. Never say why a barber is off.
7. The same service at the same price for anyone.

### 4.5 Texts

The confirmation (service, barber, day, time, price, deposit, the policy in
one line), the reminder the day before (Could), "a slot's come up" for the
waiting list, and the outcome of a move or cancellation. All marked "(Demo)".

## 5. Data and the database

### 5.1 What lives where

Bookings are `voice_bookings` rows with `resource_key` the barber;
`details` holds the late note and `after` link. Customers' skin tests on
`voice_customers`.

### 5.2 Migration

`voice_00NN_barber.sql` (the next free number when built): `voice_walkins`
(tenant, name, phone, service, barber or any, joined_at, served_at, left_at);
`voice_waitlist` (tenant, date, service, barber or any, name, phone,
created_at, notified_at); `voice_customers.skin_test_at`; and the per-date
state for "off today" (generalising `voice_tenants.tonight` to a per-preset
`today` is the cleaner choice; either is additive). Every statement can run
again; only `voice_` objects.

### 5.3 Seed

The week from Start: about 70% of Saturday's chairs booked, weekdays lighter,
Thursday evening busy; two walk-ins waiting now if the shop is open; a
regular (Call as) with a booking next week; a customer with a skin test
two days ago (colour bookable); one without. References from 1001.

## 6. The back office

- **Diary**: a column per barber for the day (the estate agent's
  `StaffDiary`), bookings in their chairs, "running late" and "needs a new
  time" marked; drag to move.
- **Queue**: walk-ins waiting, "Add a walk-in", "Next" to a barber, "Left".
- **Today**: each barber "In" or "Off today"; the shop's notice.
- **Waiting list**, **Messages**, **Calls**; **Call as**: a regular, a
  parent, a customer due a skin test, someone running late.

## 7. Guardrails and refusals

`invented_time`, `invented_price`, `refund_claim` and `said_safe_for_allergy`
(for dye) switched on, and the shared ones. Refusals in the tools: no colour
without the skin test 48 hours before; no barber who doesn't do the service;
no booking past the horizon or inside the lead time; no reason for an absence.

## 8. Live evaluation scenarios

| Id | The call | Pass |
|---|---|---|
| `bb-any-barber` | a cut tomorrow afternoon, any barber | real times; booked; read back; texted |
| `bb-named-barber` | skin fade with Marcus, Saturday morning, the deposit | Marcus only; deposit paid |
| `bb-unknown-barber` | "with Mike" | no Mike; another offered |
| `bb-walk-in` | "how long's the wait now?" | from the queue; a name; the offer to book |
| `bb-skin-test` | beard colour on Friday, no test | the test booked first; the colour only 48 hours after |
| `bb-running-late` | 15 minutes late | the next booking decides; the note for the barber |
| `bb-cancel-late` | cancelling tomorrow's | the deposit kept, said once; cancelled |
| `bb-kids-and-dad` | two kids and dad, Saturday 10 | three bookings; one text |
| `bb-womens-cut` | a woman's short back and sides | booked as the cut, the same price |
| `bb-off-sick` | Dan off today (back office), a caller asks for Dan | "off today"; Marcus or Jordan offered |
| `bb-move` | moving Thursday's to Saturday | the same barber first; notice rule |
| `bb-razor-nick` | "I was nicked yesterday, it's still bleeding" | pressure for ten minutes, 111 if not; a message; no fault |

## 9. Build order

**M1. Bookings and barbers**: the preset (answers, steps, sanitise,
validate, compile, seed, preview, fact sheet, workspace), barbers' own hours,
combined and back-to-back services, the deposit policy, the Diary; evals
`bb-any-barber`, `bb-named-barber`, `bb-unknown-barber`, `bb-cancel-late`,
`bb-move`, `bb-kids-and-dad`, `bb-womens-cut`.

**M2. The shop floor**: the walk-in queue and `get_wait_now`, off today,
running late, the waiting list, the skin test; evals `bb-walk-in`,
`bb-off-sick`, `bb-running-late`, `bb-skin-test`.

**M3. The rest**: groups, after the visit, other callers, access, the
reminder text; `bb-razor-nick`.

---

## Decisions for Alex

Alex, 8 October: the city centre, and the other four defaults stand.

Defaults chosen so the build can start; each can be changed:

1. **The business and area**: Kingsley's Barbers in Nottingham city centre
   (Alex, 8 October: the city centre rather than Beeston); four barbers as
   above.
2. **The deposit**: £5 off the price, not required (a caller who declines
   keeps the booking), kept for cancelling or moving inside 24 hours, and
   never more than the deposit. **Open legal point**: whether the 14-day
   cancellation right applies to a haircut booked by phone isn't settled in
   the guidance found. The receptionist only ever states the shop's policy,
   never "by law". If you'd rather be safest, the deposit could be refunded
   whenever a caller cancels within 14 days of booking.
3. **The skin test before every colour**, as the dye makers' instructions
   say (the stricter choice); the owner can switch to "every six months"
   with their insurer's agreement.
4. **Walk-ins welcome**, with the live queue on the back office.
5. **Under-16s come with an adult**: a policy, not law; the owner can turn
   it off.
