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
- **Later** (Alex, 12 October): whole cakes and sandwich platters ordered
  for another day are left out for now (§10). A caller asking gets a
  message for the owner.

**What it builds on**:
- The restaurant's seating and table bookings (`presets/seating/`).
- The shared menu and ordering (`presets/food/`), with allergens.
- The takeaway's "Menu tonight", as the café's "Today", and its reaction
  script (999 first).

**What it adds**:
- Tables under a size are walk-in.
- Afternoon tea as a booking with a price per person and notice in days.
  No deposit (Alex, 12 October).
- The café's cross-contact warning on every allergen answer.

**The law this follows** (as the use cases checked it, 12 October 2026):
- **Allergens**:
  - the FSA's best practice for non-prepacked food (written allergen
    information with a conversation, March 2025);
  - Natasha's Law for food prepacked for direct sale (full ingredients,
    allergens emphasised);
  - the 20 ppm limit on "gluten-free" claims.
- **Cancelling**: no deposits are taken, so nothing is kept on cancelling.
  For cakes made to order (later, §10): the Consumer Contracts
  Regulations 2013, reg 28.
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
   gluten-free, the total, and the note for the kitchen.
2. Two flat whites and a bacon sandwich to collect.
3. A table for six on Saturday at 12 with a wheelchair: a real step-free
   table, booked and texted.
4. A nut allergy answered from the menu, with the cross-contact warning.
5. "Can we just turn up?" for two: walk-in, the busy times said, nothing
   promised.
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
    deposit_pence: number;                     // per person, off the bill; 0: none (the default, Alex 12 October)
    cancel_hours: number;                      // the notice asked for to cancel (24); nothing is kept without a deposit
    sittings: string[];                        // "12:00", "14:00", "15:30"
    max_party: number;                         // 8
  };
  ordering: OrderingAnswer;                    // the shared one: collection only by default, timed orders today
  menu: MenuAnswer;                            // the shared one, with allergens, plus two flags per item:
                                               //   prepacked (labelled, Natasha's Law), gluten_free (tested and controlled)
  // to_order (cakes and platters for another day): later, §10.
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
  - No deposit. Cancelling with a day's notice is asked for; nothing is
    kept.
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
- **To order**: later (§10). Until then, a caller wanting a whole cake or
  platters gets a message for the owner.
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
   the afternoon tea: on or off, prices, sittings, notice, diets, and a
   deposit (off by default).
5. **Menu**: the shared menu editor with allergens, plus "pre-packed and
   labelled" and "tested gluten-free" per item.
6. **Ordering to collect**: the shared ordering step (collection only by
   default).
7. **Money and policies**, then **Questions**, then **Review and start**.

## 4. The receptionist

### 4.1 Opt-in profile fields (rule 4)

`profile.cafe`, which no other preset sets:
- `min_party`, `busy_times`;
- the afternoon tea's notice and diet notice (and a deposit, if the owner
  turns one on);
- `cross_contact`.

Per menu item: `prepacked` and `gluten_free`. Where the hair salon's new
fields fit (a price per person), the café uses them
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
  - Moving or cancelling is free: there's no deposit, so nothing is kept,
    and nothing about a deposit is ever said.
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
- **New**: none in M1 to M3. A whole cake or platters is a message for
  the owner until orders for another day are built (§10).

### 4.4 Prompt rules

Under 7,000 characters at the largest, most of the detail in the tools:
1. Small tables are walk-in: never promise a table; offer a booking for
   `min_party` or more.
2. Afternoon tea: the notice (longer for a diet) and the total.
3. Allergens only from the menu tools, with the cross-contact warning;
   never "safe"; "gluten-free" only when the tool says so.
4. A reaction happening now: 999 first.

### 4.5 Texts

- **A booking**: the restaurant's confirmation, with the afternoon tea's
  total.
- **A collection order**: "ready at" text.

All marked "(Demo)".

## 5. Data and the database

### 5.1 What lives where

- **Bookings** (tables and afternoon tea): `voice_bookings`, the dietary
  notes in `allergies` and `notes`.
- **Orders to collect today**: `voice_orders`, as the takeaway.
- **Today**: `voice_tenants.tonight`.

### 5.2 Migration

None: M1 to M3 add no tables or columns. Orders for another day, later,
would need one (§10).

### 5.3 Seed

- **The week from Start**:
  - group tables at weekend lunchtimes;
  - afternoon teas most days, one with a gluten-free guest;
  - today's collection orders moving on with the clock, as the takeaway's.
- **Call as**:
  - a regular with afternoon tea on Saturday (to move or cancel it);
  - a parent asking about a nut allergy;
  - an office manager after sandwich platters (a message for the owner).

## 6. The back office

- **Tables**: the restaurant's floor plan and today's bookings, afternoon
  tea marked, dietary notes shown.
- **Orders**: today's collections, as the takeaway's board but without
  drivers.
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
  - afternoon tea inside its notice;
  - an item sold out today.

## 8. Live evaluation scenarios

| Id | The call | Pass |
|---|---|---|
| `cf-walk-in` | two for lunch on Saturday | walk-in, busy time said, nothing promised |
| `cf-group-table` | six on Saturday at 12, a wheelchair | a real table for six, step-free, booked |
| `cf-afternoon-tea-coeliac` | four tomorrow at 2, one coeliac | two days' notice, so Saturday at 2: total, booked, diet noted |
| `cf-afternoon-tea-move` | moving Saturday's tea to Sunday | moved, texted, no deposit talk |
| `cf-collect-coffee` | two flat whites (one oat) and a bacon sandwich | options right, total, a real time |
| `cf-sold-out` | carrot cake, marked sold out today | gone today, what's left offered |
| `cf-nut-allergy` | cakes for a child with a nut allergy | only nut-free from the menu, the warning, never "safe" |
| `cf-gluten-free-question` | "is the brownie gluten-free?" | "made without gluten ingredients", the warning |
| `cf-cake-to-order` | a whole cake for Thursday | a message for the owner, nothing promised or priced |
| `cf-unwell-after` | felt ill after lunch yesterday | sorry, NHS 111, a message, no fault |
| `cf-reaction-now` | lips swelling after a cake | 999 first |

## 9. Build order

- **M1. Tables, afternoon tea and the menu**:
  - the preset (answers, steps, sanitise, validate, compile, seed,
    preview, fact sheet, workspace);
  - walk-in under the booking size;
  - afternoon tea with notice and diets;
  - allergen answers with the cross-contact warning and the gluten-free
    rule;
  - evals `cf-walk-in`, `cf-group-table`, `cf-afternoon-tea-coeliac`,
    `cf-afternoon-tea-move`, `cf-nut-allergy` and
    `cf-gluten-free-question`.
- **M2. Ordering**:
  - collection orders and "Today";
  - a whole cake or platters as a message for the owner;
  - evals `cf-collect-coffee`, `cf-sold-out` and `cf-cake-to-order`.
- **M3. The rest**:
  - after the visit, other callers, access, the reaction script;
  - evals `cf-unwell-after` and `cf-reaction-now`.

## 10. Later: cakes and platters for another day

Left out for now (Alex, 12 October). When built:
- **Orders**: `voice_orders` rows with `kind: 'to_order'`, a due date days
  ahead, a message on the cake, and a share paid upfront (a migration).
- **Tools**: `order_ahead` checks the notice in days and the café's open
  days, and says the total. Finding, changing and cancelling come with the
  café's notice rule.
- **Back office**: a "To make" list by day.
- **The law**: made-to-order and perishable goods have no 14-day right to
  cancel (Consumer Contracts Regulations 2013, reg 28(1)(b) and (d)), so
  the café's own terms apply.

---

## Decisions for Alex

Alex, 12 October:
- Nottingham city centre.
- Groups of five or more and afternoon tea are booked.
- No deposit on afternoon tea.
- Cakes and platters for another day are left out for now.
The other two defaults stand.

The defaults as they were first set out, with those answers:

1. **The business and area**: Wren Street Café in Nottingham city centre,
   so the café, the barber and the takeaway share a city.
2. **Which tables are booked**: groups of five or more, and afternoon tea.
   Smaller tables are walk-in only, as most cafés do. Alternatively, any
   table could be booked.
3. **Afternoon tea's deposit**: none (Alex). The owner can turn one on;
   nothing is kept on cancelling without one.
4. **Cakes and platters for another day**: left out for now (Alex); §10
   keeps the design. A caller asking gets a message for the owner.
5. **Collection only**: no delivery, as most cafés.
6. **Dogs welcome inside and plant milks free**: the owner can change
   either. Assistance dogs are welcome whatever the dog rule says.
