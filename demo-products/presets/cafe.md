# Café (`cafe`, evals `cf-`)

The build spec for the café preset, in the shape of `presets/barber.md`.
Read it with PRESETS.md (§1 rules, §2 server, §2.4 database, §2.5 workspace
spec, §3 web, §4 tests) and the researched use cases in
`cafe-use-cases.md` (35 use cases: 11 Must, 15 Should, 9 Could), including
its "Checked for gaps" notes, which this spec follows where they differ.

**Scope**: a UK café with about 30 seats inside and a few outside.
- **Tables**: walk-in for small tables. Groups and afternoon tea are
  booked.
- **Orders to collect**: coffee and food ordered by phone for today.
- **Orders to make**: whole cakes and sandwich platters for a later day.

**What it builds on**:
- The restaurant's seating and table bookings (`presets/seating/`).
- The shared menu and ordering (`presets/food/`), with allergens.
- The takeaway's "Menu tonight", as the café's "Today", and its reaction
  script (999 first).

**What it adds**:
- Tables under a size are walk-in.
- Afternoon tea as a booking with a price per person, notice in days and a
  deposit per person.
- Orders for a later day.
- The café's cross-contact warning on every allergen answer.

**The law this follows** (as the use cases checked it, 12 October 2026):
- **Allergens**:
  - the FSA's best practice for non-prepacked food (written allergen
    information with a conversation, March 2025);
  - Natasha's Law for food prepacked for direct sale (full ingredients,
    allergens emphasised);
  - the 20 ppm limit on "gluten-free" claims.
- **Cancelling**: the Consumer Contracts Regulations 2013, reg 28. Made to
  the customer's specification and perishable goods have no 14-day right
  to cancel. The Consumer Rights Act 2015, Sch 2 para 5, against
  disproportionate cancellation sums.
- **Prices**: the Digital Markets, Competition and Consumers Act 2024
  (every compulsory charge in the price) and the Payment Surcharges
  Regulations 2012 as amended (no card surcharge).
- **People**: the Equality Act 2010 (assistance dogs, breastfeeding,
  reasonable adjustments) and the Employment (Allocation of Tips) Act 2023.
- **Packaging**: England's single-use plastics ban from October 2023.
- **Not required here**: calorie labelling (250 employees or more), free
  tap water (licensed premises only), and showing the hygiene rating in
  England.

## 1. The signature moments

The seven in the use cases' "The moments that sell it":
1. Afternoon tea for four with a coeliac guest: the longer notice for
   gluten-free, the deposit, and the note for the kitchen.
2. Two flat whites and a bacon sandwich to collect.
3. A birthday cake for Thursday with a message on it.
4. A nut allergy answered from the menu, with the cross-contact warning.
5. "Can we just turn up?" for six, which is booked, and for two, which is
   walk-in.
6. Carrot cake marked sold out on "Today".
7. "Is the brownie gluten-free?"

Each is a live scenario in §8.

## 2. Answers (`VERSION` 1)

### 2.1 The shape

```ts
interface CafeAnswers extends BaseAnswers {
  version: 1;
  basics: BasicsAnswer;                        // name, style, town, address, phone, voice
  hours: HoursAnswer & {
    breakfast_until: string | null;            // "11:30"
    kitchen_closes_before: number;             // minutes before closing that food stops (30)
  };
  seating: SeatingAnswer;                      // the shared one: inside and outside, tables, high chairs
  booking: {
    min_party: number;                         // tables for this many or more are booked; smaller are walk-in (5)
    busy_times: string;                        // said to walk-ins: "Saturday 11 till 2 is our busiest"
  };
  afternoon_tea: {
    offered: boolean;
    adult_pence: number; child_pence: number;  // 2450, 1200
    notice_days: number;                       // 1
    diet_notice_days: number;                  // 2, for gluten-free or vegan
    diets: string[];                           // the versions the kitchen makes
    deposit_pence: number;                     // per person, off the bill (1000)
    cancel_hours: number;                      // refunded with this much notice; kept after (48)
    sittings: string[];                        // "12:00", "14:00", "15:30"
    max_party: number;                         // 8
  };
  ordering: OrderingAnswer;                    // the shared one: collection only by default, timed orders today
  menu: MenuAnswer;                            // the shared one, with allergens, plus two flags per item:
                                               //   prepacked (labelled, Natasha's Law), gluten_free (tested and controlled)
  to_order: {
    items: { key: string; name: string; description: string; price_pence: number;
             serves: number; notice_days: number }[];
    message_pence: number;                     // piping a message on a cake (400); 0: free; null: not offered
    deposit_share: number;                     // paid upfront (0.5)
    cancel_days: number;                       // deposit refunded with this much notice (2)
    collect_from: string;                      // "10:00"
  };
  money: { payment: OrderPayment; cash: boolean; plant_milk_pence: number; tips: string };
  policies: {
    dogs: 'inside' | 'outside_only' | 'no';    // assistance dogs are always welcome, whatever this says
    children: string; baby_changing: boolean; accessibility: string; toilet: string;
    wifi: string; laptops: string; parking: string; tap_water: boolean;
    cross_contact: string;                     // "Made in a kitchen that uses nuts, gluten and milk."
    hygiene_rating: number | null; reusable_cups: string; careers: string; hire: string;
  };
  faqs: FaqAnswer[];
}
```

### 2.2 Defaults: Wren Street Café

- **Where**: 14 Wren Street (example), Nottingham NG1. Phone 0115 496
  0812. Monday to Friday 8am to 4pm, Saturday 9am to 5pm, Sunday 10am to
  3pm. Breakfast until 11:30; food stops half an hour before closing.
- **Seats**: inside, four tables for two, three for four, and one for
  eight by the window; outside, three tables for two (weather permitting).
  Three high chairs; step-free with an accessible toilet.
- **Bookings**: tables for five or more. "Saturday 11 till 2 is our
  busiest; weekday mornings are quieter."
- **Afternoon tea**: £24.50, children £12. Sittings at 12, 2 and 3:30.
  - A day's notice; gluten-free or vegan with two days'.
  - £10 a person deposit, off the bill.
  - Refunded with 48 hours' notice; kept after that.
  - Up to eight people.
- **Menu**:
  - **Hot drinks**: espresso £2.40, americano £2.90, flat white £3.30,
    cappuccino and latte £3.40, a pot of tea £2.80, hot chocolate £3.50.
    Oat, soya or almond milk free; extra shot 60p; decaf.
  - **Breakfast**: full breakfast £10.50, veggie breakfast £9.95, avocado
    on sourdough £8.50 (a poached egg £1.50 extra), bacon sandwich £5.50,
    porridge £4.75.
  - **Lunch**: soup of the day with bread £6.50; toasties (ham and cheese,
    cheese and onion, tuna melt) £6.95; jacket potato £7.50; salad bowl
    £8.95.
  - **Cakes**: Victoria sponge £3.80, carrot cake £3.95, chocolate brownie
    £3.50 (made without gluten ingredients, not marked gluten-free), scone
    with jam and cream £4.25, vegan banana bread £3.60.
  - **Pre-packed and labelled**: chicken and stuffing sandwich £5.25, egg
    mayo £4.50.
  - **Children's**: toast and jam £2.50, babyccino free.
  - Every item carries its allergens.
- **To order**: Victoria sponge (serves 12) £32; carrot cake (serves 12)
  £36; chocolate fudge cake (serves 12) £38; each with three days' notice.
  A message on top £4. A sandwich platter (serves 10) £45 with a day's
  notice. Half paid upfront; refunded with two days' notice. Collection
  from 10am.
- **Money and policies**:
  - Card and cash; tips by card go to the staff.
  - Dogs welcome inside.
  - "Laptops welcome, except at weekend lunchtimes."
  - Free tap water.
  - Cross-contact: "Everything is made in one kitchen that uses nuts,
    gluten, milk and egg."
  - Hygiene rating 5.

## 3. Builder steps

1. **Basics**: as the others.
2. **Opening hours**: the shared hours, with breakfast and when food stops.
3. **Tables**: the restaurant's seating step and floor plan (inside and
   outside, high chairs).
4. **Bookings and afternoon tea**: the walk-in size, the busy times, and
   the afternoon tea: on or off, prices, sittings, notice, diets, deposit,
   cancelling.
5. **Menu**: the shared menu editor with allergens, plus "pre-packed and
   labelled" and "tested gluten-free" per item.
6. **Ordering to collect**: the shared ordering step (collection only by
   default).
7. **Cakes and platters to order**: the items, notice, message price,
   deposit and cancelling.
8. **Money and policies**, then **Questions**, then **Review and start**.

## 4. The receptionist

### 4.1 Opt-in profile fields (rule 4)

`profile.cafe`, which no other preset sets:
- `min_party`, `busy_times`;
- the afternoon tea's notice, diet notice, deposit per person and
  cancelling hours;
- the to-order items, deposit share and cancelling days;
- `cross_contact`.

Per menu item: `prepacked` and `gluten_free`. Where the hair salon's new
fields fit (a price per person, `deposit.percent`), the café uses them
rather than adding its own; this is agreed with the cloud session on the
sessions board before building.

### 4.2 Engine changes

- **Walk-in under the booking size**:
  - `check_availability` and `create_booking` for a table for fewer than
    `min_party` answer "walk-in", with the busy times, and book nothing.
  - Afternoon tea is booked at any size up to its maximum.
- **Afternoon tea**: a table service with sittings.
  - The notice is checked in days, and in `diet_notice_days` when a diet
    is named.
  - The price per person (adults and children) and the total are said.
  - The deposit is per person, taken with the demo card.
  - Cancelling or moving inside `cancel_hours` says the deposit is kept,
    once, before doing it: the barber's notice rule (`core/barber-tools.ts`,
    `noticeFirst`), made to work for any profile that sets a notice.
- **Orders for a later day**: `voice_orders` rows with
  `kind: 'to_order'`, a due date days ahead, a message, and a deposit
  share paid with the demo card. The takeaway's orders stay as they are.
  The notice is checked in code. Cancelling has the same notice rule
  (refunded with `cancel_days`, kept after).
- **"Today"**: the takeaway's `tonight` (sold out, a notice), read for a
  café as well as a takeaway's kitchen.
- **Allergens**:
  - The shared menu tools answer, and every allergen answer carries
    `cross_contact`.
  - `get_item_details` says "gluten-free" only for an item marked
    `gluten_free`; otherwise "made without gluten ingredients" with the
    warning.
  - A pre-packed item says it carries a full ingredients label.
- **The reaction script**: `armReaction` runs for a café too (999 first).

### 4.3 Tools

- **Bookings**: the restaurant's booking tools (`check_availability`,
  `create_booking`, `find_bookings`, `modify_booking`, `cancel_booking`,
  `take_demo_payment`).
- **Ordering**: the shared ordering tools (`get_menu`, `get_item_details`,
  `add_to_order`, `set_fulfilment`, `review_order`, `confirm_order`), with
  collection only.
- **The rest**: `take_message`, `get_opening_hours`, `search_knowledge`
  and `end_call`.
- **New**:
  - **`order_ahead`**: a to-order item (or several), the date and time to
    collect, a message, allergies, and a name. It checks the notice and
    the café's days, says the total and the deposit, and gives a
    reference. The deposit goes through `take_demo_payment` (for
    "deposit").
  - **`find_order_ahead`** and **`change_order_ahead`**: change the date,
    time or message, or cancel, with the notice rule.

### 4.4 Prompt rules

Under 7,000 characters at the largest, most of the detail in the tools:
1. Small tables are walk-in: never promise a table; offer a booking for
   `min_party` or more.
2. Afternoon tea: the notice (longer for a diet), the total, the deposit
   after booking.
3. Allergens only from the menu tools, with the cross-contact warning;
   never "safe"; "gluten-free" only when the tool says so.
4. Cakes and platters need notice: never promise one sooner.
5. A reaction happening now: 999 first.

### 4.5 Texts

- **A booking**: the restaurant's confirmation, with the afternoon tea's
  total, deposit and cancelling line.
- **A collection order**: "ready at" text.
- **An order ahead**: what, the message, the collection day and time, the
  deposit paid and the balance due, and the cancelling line.

All marked "(Demo)".

## 5. Data and the database

### 5.1 What lives where

- **Bookings** (tables and afternoon tea): `voice_bookings`, the dietary
  notes in `allergies` and `notes`.
- **Orders to collect today**: `voice_orders`, as the takeaway.
- **Orders ahead**: `voice_orders` with `kind = 'to_order'`.
- **Today**: `voice_tenants.tonight`.

### 5.2 Migration

`voice_00NN_cafe.sql` (the next free number when built):
`voice_orders.kind` (`'now'` by default, or `'to_order'`),
`voice_orders.message`, and `voice_orders.deposit_pence` /
`deposit_paid`. It only adds; every statement can run again; only `voice_`
objects.

### 5.3 Seed

- **The week from Start**:
  - group tables at weekend lunchtimes;
  - afternoon teas most days, one with a gluten-free guest;
  - today's collection orders moving on with the clock, as the takeaway's;
  - three cake orders and a platter over the coming week.
- **Call as**:
  - a regular with afternoon tea on Saturday (to move it, or cancel inside
    48 hours);
  - a parent asking about a nut allergy;
  - someone with a cake order on Thursday (to change the message);
  - an office manager.

## 6. The back office

- **Tables**: the restaurant's floor plan and today's bookings, afternoon
  tea marked, dietary notes shown.
- **Orders**: today's collections, as the takeaway's board but without
  drivers.
- **To make**: orders ahead by day (what, the message, the deposit paid,
  the balance due), each marked done when collected.
- **Today**: sold out and a notice, as the takeaway's "Menu tonight".
- **Messages** and **Calls**, as the others.

## 7. Guardrails and refusals

- **Guardrails**:
  - no time nothing gave (`invented_time`);
  - no price nothing gave, totals of known prices allowed
    (`invented_price`);
  - never "safe" for an allergy (`said_safe_for_allergy`);
  - "gluten-free" said only of an item marked so (a new
    `gluten_free_claim`);
  - no refund promised (`refund_claim`);
  - no card surcharge (`card_surcharge`).
- **Refusals in the tools**:
  - a table under the booking size;
  - afternoon tea or an order ahead inside its notice;
  - an item sold out today.

## 8. Live evaluation scenarios

| Id | The call | Pass |
|---|---|---|
| `cf-walk-in` | two for lunch on Saturday | walk-in, busy time said, nothing promised |
| `cf-group-table` | six on Saturday at 12, a wheelchair | a real table for six, step-free, booked |
| `cf-afternoon-tea-coeliac` | four on Saturday at 2, one coeliac | two days' notice checked, total, booked, deposit, note |
| `cf-afternoon-tea-cancel-late` | cancelling tomorrow's tea | deposit kept, said once; cancelled |
| `cf-collect-coffee` | two flat whites (one oat) and a bacon sandwich | options right, total, a real time |
| `cf-sold-out` | carrot cake, marked sold out today | gone today, what's left offered |
| `cf-nut-allergy` | cakes for a child with a nut allergy | only nut-free from the menu, the warning, never "safe" |
| `cf-gluten-free-question` | "is the brownie gluten-free?" | "made without gluten ingredients", the warning |
| `cf-cake-order` | chocolate cake for Thursday with a message | notice checked, price with message, half paid |
| `cf-cake-too-soon` | a cake for tomorrow | refused for the notice, the earliest day offered |
| `cf-unwell-after` | felt ill after lunch yesterday | sorry, NHS 111, a message, no fault |
| `cf-reaction-now` | lips swelling after a cake | 999 first |

## 9. Build order

- **M1. Tables, afternoon tea and the menu**:
  - the preset (answers, steps, sanitise, validate, compile, seed,
    preview, fact sheet, workspace);
  - walk-in under the booking size;
  - afternoon tea with notice, deposit and the notice rule;
  - allergen answers with the cross-contact warning and the gluten-free
    rule;
  - evals `cf-walk-in`, `cf-group-table`, `cf-afternoon-tea-coeliac`,
    `cf-afternoon-tea-cancel-late`, `cf-nut-allergy` and
    `cf-gluten-free-question`.
- **M2. Ordering**:
  - collection orders and "Today";
  - orders ahead (cakes and platters) with the migration and the "To make"
    view;
  - evals `cf-collect-coffee`, `cf-sold-out`, `cf-cake-order` and
    `cf-cake-too-soon`.
- **M3. The rest**:
  - after the visit, other callers, access, the reaction script;
  - evals `cf-unwell-after` and `cf-reaction-now`.

---

## Decisions for Alex

Defaults chosen so the build can start; each can be changed:

1. **The business and area**: Wren Street Café in Nottingham city centre,
   so the café, the barber and the takeaway share a city.
2. **Which tables are booked**: groups of five or more, and afternoon tea.
   Smaller tables are walk-in only, as most cafés do. Alternatively, any
   table could be booked.
3. **Afternoon tea's deposit**: £10 a person, off the bill. It's refunded
   with 48 hours' notice and kept after that, under the café's policy and
   never "by law". Alternatively, no deposit.
4. **Cakes and platters for another day**: in the demo, in M2. This is the
   biggest new piece: an order for a later day, with notice and half paid
   upfront. Cakes made to order have no 14-day right to cancel, so the
   café's terms apply. Leaving it out would make the café quicker to
   build.
5. **Collection only**: no delivery, as most cafés.
6. **Dogs welcome inside and plant milks free**: the owner can change
   either. Assistance dogs are welcome whatever the dog rule says.
