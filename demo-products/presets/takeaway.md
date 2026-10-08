# Takeaway and fast food (`takeaway`, evals `tk-`)

The build spec for the takeaway preset, in the shape of
`presets/property-maintenance.md`. Read it with PRESETS.md (§1 rules, §2
server, §2.4 database, §2.5 workspace spec, §3 web, §4 tests, and §5, the
takeaway's outline, which this spec expands) and the researched use cases in
`takeaway-use-cases.md` (78 use cases: 29 Must, 34 Should, 15 Could),
including its "Checked for gaps" notes, which this spec follows where they
differ from the use cases.

**Scope**: a busy UK chicken, burger and pizza shop with no tables. Every
call is an order for today, for collection or delivery, or a question about
one. The restaurant already takes takeaway orders (`src/presets/food/`, the
ordering tools in `src/core/tools.ts`); the takeaway builds on that engine
and adds what a shop that lives on orders needs: a kitchen with a real
queue, delivery zones, meal deals, last orders, and the calls that come
after the order.

**The law this follows** (as the use cases checked it, 6 October 2026): the
Food Information Regulations 2014 and retained Regulation (EU) 1169/2011
Art. 14 (allergen information for food sold at a distance, before the
purchase is completed and on delivery, orally by phone allowed), with the
FSA's best practice of 5 March 2025 (ask about allergies before taking the
order; written allergen information on delivery); the FSA's guidance on
"may contain" and "gluten-free"; the Digital Markets, Competition and
Consumers Act 2024 (price transparency from 6 April 2025: every charge in
the price, none dripped in later; CMA209); the Consumer Rights (Payment
Surcharges) Regulations 2012 as amended (no card surcharges); the Consumer
Contracts Regulations 2013 reg 28(1)(b) (no right to cancel food that
deteriorates rapidly); the Consumer Rights Act 2015; the Licensing Act 2003
(late-night refreshment from 11pm to 5am, supplied when handed over, so a
late delivery counts; alcohol to under-18s); the Licensing (Scotland) Act
2005 (remote alcohol sales paid for 10am to 10pm, no deliveries from
midnight to 6am); the Employment (Allocation of Tips) Act 2023; and, as a
dated switch only, England's ban on selling high-caffeine energy drinks to
under-16s, expected April 2027 subject to Parliament.

## 1. Who, and the signature moments

Callers, as the use cases list them: customers ordering for themselves or
others, customers with an order already placed, people with allergies,
someone having a reaction or ill after eating, delivery-app customers who
rang the shop, businesses and groups, the shop's drivers, suppliers, the
council, job applicants, sales calls and hoaxes.

The moments the demo is built to show (use cases, "The moments that sell
it"), each a live scenario in §9:

1. **An honest wait.** Friday at 7pm, straight after Start, "how long for
   delivery tonight?" gets the time from the kitchen's real queue, about 50
   minutes, and the same time when the order is placed. Pushed for sooner,
   it holds, and offers collection.
2. **The meal deal, once.** Burger, fries and a can ordered one at a time:
   the deal is offered once, taken, and the ticket shows one deal line with
   its choices at the lower total. A caller who says no is never asked
   again.
3. **The area.** Outside the area: collection offered. The outer zone: its
   own fee and minimum. Under the minimum: exactly how much short.
4. **An allergy and a deal.** Sesame and the Burger meal: answered per
   choice with the shared-kitchen caveat, never "safe"; the allergy on the
   order and marked on the ticket.
5. **Where's my order?** The prospect moves an order to Out with Kai; the
   customer's phone gets "on its way"; a caller from that number hears "it
   left with our driver at 7:42", with no address read back.
6. **Cash for the driver.** "Do you need change from anything?" "A
   twenty." The driver's ticket says so.
7. **Last orders.** Saturday 11:45pm: no delivery that would arrive after
   midnight; collection by the last slot instead.

## 2. Answers (`VERSION` 1)

### 2.1 The shape

`BaseAnswers` (PRESETS.md §2.1: basics, hours with closures, policies,
theme, sources) plus
the fields below. `ordering` and `menu` are the shared food answers, so the
shared sanitise, compile and validate take them as they are (§1 rule 2:
the optional fields appear only because the takeaway's defaults have them,
and the restaurant's answers never gain them).

```ts
interface TakeawayAnswers extends BaseAnswers {
  ordering: OrderingAnswer;   // food/ordering.ts, with zones, free_over_pence, drivers, timed_orders
  menu: MenuAnswer;           // food/menu.ts; sections may carry sizes and extras (below)
  deals: DealAnswer[];        // own section, so a menu draft never deletes them
  kitchen: {
    last_orders_minutes: number; // no new orders this long before closing; default 15. Every order is handed over by closing
    big_order_mains: number;     // an order with more mains than this counts as two slots; default 6
    catering_over_mains?: number; // M2: above this, a message for the manager instead; default 15
  };
  money: {
    payment: 'phone' | 'collection' | 'either';
    pay_driver: 'no' | 'cash' | 'cash_or_card';
    card_minimum_pence: number | null; // never a surcharge (§8); null: none
  };
  after?: {                   // M2: what the receptionist may offer when something goes wrong
    late_after_minutes: number;          // past the quoted time, a message for the manager; default 15
    missing_items: 'send_out' | 'manager'; // default 'manager'
    pay_on_phone_numbers: string[];      // numbers with refused deliveries: pay on the phone or no delivery
  };
  alcohol?: { on: boolean; until: string | null }; // M3; default off
  policies: {
    halal: 'all' | 'chicken' | 'none';
    hygiene_rating: number | null;
    parking: string; offers: string; bags: string; careers: string; tips: string;
    faqs: FaqAnswer[];
  };
}
// The allergen statement, said with every allergy answer, is the menu's own
// (MenuAnswer.allergen_statement), as the restaurant's is.

interface DealAnswer {
  key: string; name: string; price_pence: number; description: string;
  includes?: string[];        // fixed contents, item keys
  parts: { label: string; category_key: string; item_keys?: string[]; choose: number; upcharge_pence?: Record<string, number> }[];
}
```

**Sizes and extras per section**: a section may carry `sizes` (labels with
a price difference) and `extras` (names and prices) that apply to every
item in it; compile turns them into modifier groups (`ModifierGroup`,
`src/domain/types.ts`). Removals ("no onions") are line notes, never
modifiers.

**Sold out tonight** is the menu's existing `MenuItem.available`, switched
from the back office (§6), not an answer.

### 2.2 Defaults: Firebird Chicken & Burgers

The sample in `fixtures/presets/takeaway-menu.json` (new), as PRESETS.md
§5.1 sets it: open 12:00 to 23:00, Friday and Saturday to midnight.
Collection: prep 15, slot 15, 4 a slot. Delivery: extra 25 ("about 40
minutes"), £2.50, minimum £12, free over £30; two zones further out at
£3.50 and £15 minimum; drivers Kai, Priya and Tom; pay the driver by cash or
card. About 30 items (burgers, chicken, wraps, 10" and 12" pizzas, sides,
drinks, desserts) with every allergen set, extras on burgers and pizzas,
and three deals (Burger meal, Chicken box, Pizza night). Halal: chicken.
Allergen statement: "We cook in a shared kitchen and fryers, so we can't
rule out traces of any allergen." Hygiene rating 5. Alcohol off.

**The area** (decision 1): four nearby districts and two further out, in
Nottingham, so the demo's two trades businesses and the takeaway share a
city; streets in the seed are invented and shown as "(example)", as the
repairs preset's are.

## 3. Builder steps

As PRESETS.md §5.2, with the kitchen and after-the-order answers placed
where an owner would look for them:

| Step | Title | Holds |
|---|---|---|
| `basics` | Basics | name, town, address, phone, website, voice and greeting |
| `hours` | Opening hours | days and times; closures (bank holidays) |
| `ordering` | Collection and delivery | collection prep, slot and per slot; delivery districts, zones, fee, minimum, free over, delivery minutes, drivers; timed orders; last orders; big and catering orders; delivery apps |
| `menu` | Menu | sections and items with allergens; sizes and extras per section; *Draft from your website* (the shared menu draft) |
| `deals` | Meal deals | deals with their parts; a warning when a part's section is gone |
| `money` | Money | payment, paying the driver, a card minimum |
| `policies` | Policies and questions | halal, the allergen statement, hygiene rating, parking, offers, bags, careers, tips, what to do when an order is late or short, then *Draft common questions* |
| `review` | Review and start | the preview, issues by step, Start |

## 4. The receptionist

### 4.1 Opt-in profile fields (rule 4)

Only `compileTakeaway` writes these; the restaurant's profile never has
them, so its goldens do not change.

| Field | Switches on |
|---|---|
| `ordering.kitchen: { per_slot, big_order_mains, last_orders }` | kitchen capacity for both kinds counted by `ready_at` (§4.2); `get_wait_times`; last orders |
| `ordering.delivery.zones`, `free_over_pence` | per-zone fee and minimum; `short_by`; the distance to free delivery |
| `ordering.drivers` | the Drivers view; "Send out" |
| `menu.deals` | deal items and their modifier groups; per-part allergen answers; the meal and deal hints |
| `profile.takeaway: TakeawaySettings` | `find_order` and its actions (§4.3), the takeaway prompt branch (§4.5), its guardrails (§8), the after-the-order policies, the anaphylaxis script |

### 4.2 Engine changes

**Kitchen capacity** (`set_fulfilment`, `src/core/tools.ts`). Today only
collection orders are checked for room, counted by their due time
(`repo.ordersDueBetween`); delivery has no capacity check. With
`ordering.kitchen`, every order is counted by `ready_at` (the due time for
a collection, the due time less the delivery minutes for a delivery; the
column exists from `voice_0004_orders`), an order with more mains than
`big_order_mains` counts twice, and `set_fulfilment` gives the first slot
with room at or after now plus prep, for both kinds. "For 8pm" checks the
slot that makes 8pm. A new `repo.ordersReadyBetween` replaces the due-time
count for the takeaway only.

**Last orders**: no new order in the last `last_orders_minutes` before
closing, and every order, collection or delivery, handed over by closing
(the late-night licence, use cases), so the last delivery is the one whose
slot plus the delivery minutes still lands by closing. `set_fulfilment`
refuses past them and offers what is left.

**Zones**: the postcode's district picks its zone's fee and minimum before
the delivery-wide ones; `set_fulfilment` returns `fee`, `minimum` and
`short_by` when under it; `review_order` says how far it is to free
delivery. The delivery fee is in the total from the first time it is said
(§8).

**Deals** (as PRESETS.md §5.3): compiled as items in a "Meal deals"
section; each part is a modifier group of its candidate items (options copy
the items' aliases; `ModifierOption.aliases?` is new and optional), plus the
parts' extras groups. A deal's allergens are the union over its candidates
and fixed contents (`may_contain` likewise; unknown if any is);
`get_item_details` on a deal answers per part with the caveat; `get_menu
free_from` never lists a deal without naming its parts.

**Upsell, once**: `add_to_order` returns `meal_hint` when a deal's main is
added with no side or drink, and `deal_hint` when separate lines cost more
than a deal; each at most once a call (`CallState.dealOffered`). Both carry
`swap: { deal, options, replaces }`; `add_to_order` takes `replaces:
number[]` and moves those lines' extras and notes onto the deal line. The
savings come from the tool only.

**Sold out**: the menu is read per tool call, so an item switched off in
the back office is refused at once, with the section's alternatives.

**Seeded orders move on with the clock**: `advanceSeedOrders` (new) on GET
state and in `find_order` moves seeded orders through the kitchen by their
`ready_at` and out for delivery with a driver, as the repairs seed's jobs
do; the prospect's own orders move only when the prospect moves them.

**Safety**: an anaphylaxis script in `src/core/safety.ts` (detected from the
caller's words: swelling lips or throat, can't breathe, "allergic reaction"
with now or eaten), with the tool gate until it is said, as gas is for the
repairs preset: 999 and say anaphylaxis, the auto-injector if they have
one, lie down with legs raised unless breathing is hard, a second injection
after five minutes. Ill after eating is not a script: GP or NHS 111, 999 if
severe, keep the food (a tool answer, §4.3).

### 4.3 Tools

The restaurant's ordering tools stay (`get_menu`, `get_item_details`,
`add_to_order`, `change_order_line`, `set_fulfilment`, `review_order`,
`confirm_order`, `take_demo_payment`, `take_message`, `get_opening_hours`,
`search_knowledge`, `end_call`). Two are new, so the declarations stay few
(the repairs preset's lesson):

- **`get_wait_times`** (read-only): "how long tonight?" and "do you deliver
  to me?": the first collection time; for a postcode, its zone, fee,
  minimum and the first delivery time; last orders today. Before any order.
- **`find_order`** (`action`: `find`, `add_allergy`, `request_cancel`,
  `request_change`, `report_problem`): by order number or the calling
  number, today only; `record(..., 'found')`. `find` gives the status in
  words with its time (in the kitchen, ready, out with Kai since 7:42,
  delivered, about N minutes late) and never reads the address to a caller
  matched by number only. `add_allergy` adds an urgent note while the order
  is still in the kitchen. `request_cancel` and `request_change` put a
  request on the ticket for staff to accept; nothing is cancelled or
  changed until they do. `report_problem` (missing, wrong, cold, late,
  something in the food, ill after eating) takes the complaint linked to
  the order, says when the manager will call, offers the owner's remedy for
  a missing item, and for ill after eating returns the health line to say.

Changes to existing tools: `set_fulfilment` (§4.2), `add_to_order`
(hints, `replaces`), `get_item_details` and `get_menu` (deals per part),
`confirm_order` (a recipient name and phone for a delivery to someone else;
`pay_note`; the ID flag when alcohol is on), `take_message` (categories
`catering`, `complaint`, `allergy`, `council`, `supplier`, `careers`).

### 4.4 Call state

`dealOffered` (each hint once), `foundOrder` (the order this call found,
for its actions), and the shared `safety` and `safetyDone` (the anaphylaxis
script). The restaurant's `allergyAsked` stays once a call.

### 4.5 Prompt rules

A takeaway branch of `compilePrompt`, under 7,000 characters at the largest
(`test/takeaway-golden.test.ts` checks the corpus's `max`):

1. Postcode first for delivery, before the menu.
2. Ask once, before the order is placed, whether anyone has a food allergy.
   Allergy answers come from `get_item_details`, with the allergen
   statement, every time. Never say safe.
3. Never quote a wait or a time from memory: `get_wait_times` or
   `set_fulfilment` only.
4. Offer a deal only when the tool gives a hint, once; a no stands.
5. One total, with the delivery fee, read back before confirming.
6. "Where's my order?": `find_order`. Never read an address back; never give
   a driver's number or a customer's details to anyone.
7. A cancellation, change or refund is a request for staff: never say it's
   done.
8. Delivery-app orders are the app's: point them to the app.

### 4.6 Texts

The confirmation (order number, items in short, total, the time, and "allergy
information: ask the driver or see the menu" when an allergy is on the
order), "ready to collect" when a collection moves to Ready, "on its way
with Kai" when a delivery moves to Out (not on Ready), and the outcome of a
cancellation request once staff accept or refuse it. All marked "(Demo)".

## 5. Data and the database

### 5.1 What lives where

Orders are `voice_orders` rows, as the restaurant's are, with `ready_at`,
`out_at`, `driver` and `pay_note` already there (`voice_0004_orders`).
Complaints and catering enquiries are messages linked by order number.

### 5.2 Migration

`voice_00NN_takeaway.sql`, taking the next free number when it is built
(the repairs milestone may add migrations meanwhile): adds to
`voice_orders` `recipient jsonb` (name and phone for someone else),
`linked_to text` (an addition riding with an earlier order), `requests
jsonb not null default '[]'` (cancel or change requests with who, when, what
and the staff answer), `flags text[] not null default '{}'` (`allergy`,
`check_id`, `big`), and `quoted_at timestamptz` (the time the caller was
given, for lateness). Additive, every statement can run again, only
`voice_` objects; applied through the Supabase connector and recorded in
`voice_schema_migrations`.

### 5.3 Repository, seed plan and reset

`ordersReadyBetween`, `findOrders(tenant, { reference?, phone?, today })`,
`requestOnOrder`, `answerRequest`; `insertSeed` writes the seeded evening's
orders with their stages, drivers and `out_at`; Reset re-runs the plan from
now, so the rush is re-armed.

## 6. The back office

Views (`web/src/reception/workspace/spec.ts`; its `orders` spec already has
`drivers` and `advance` switches, both on for the takeaway):

- **Kitchen** (the order board): New, In the kitchen, Ready, then Collected
  or Out. A ticket shows its lines with deal choices, notes, the allergy
  mark, the ID flag, any request waiting (Accept, Refuse), the quoted time
  and how late it is.
- **Drivers**: each driver's deliveries out and minutes since they left,
  "Delivered"; "Send out" on a ready delivery picks a driver.
- **Menu tonight**: the sold-out switches, and the notice ("Delivery paused
  tonight", "Long waits: about 90 minutes") that reaches live calls.
- **Messages** and **Calls**, as every preset has.
- **Call as** (the shared phone panel): a regular with an order out with a
  driver, a parent with a sesame allergy, a caller in the outer zone, a
  number on the pay-on-the-phone list.

## 7. The seeded evening

Anchored to Start, as PRESETS.md §5.4 sets it: today's orders from opening
to now plus an hour; past ones collected or delivered; the next 30 to 45
minutes' kitchen slots full, so the first as-soon-as-possible order is
about 45 to 50 minutes away whenever Start is pressed in opening hours;
about 60 orders by 9pm on a Friday, two thirds delivery, postcodes from the
zones with invented streets, deal lines with their choices, a few
allergies, cash with change notes, references from 101 without gaps,
drivers assigned and out. Before opening: a few orders for opening time.
After closing: everything done. `src/presets/food/seed.ts` keeps drawing in
the same order for the restaurant (its recorded weeks depend on it); the
takeaway's plan is its own (`presets/takeaway/seed.ts`), with the same
property tests (`replaySeed`).

## 8. Guardrails and refusals

Checked on the takeaway's calls only, each with its correction:

| Rule | Catches |
|---|---|
| `said_safe_for_allergy` (exists) | "safe", "fine", "no problem" for an allergy |
| `invented_time` (built for the estate agent; switched on here) | a ready or delivery time no tool gave |
| `invented_price` (built for the repairs preset; switched on here) | a price, saving or fee no tool or setting gave |
| `refund_claim` (new) | "I've refunded you", "you'll get your money back", "that's cancelled" before staff accept |
| `card_surcharge` (new) | any extra charge for paying by card |
| `address_read_back` (new) | an address said to a caller matched only by number |
| `unconfirmed_claim`, `unpaid_claim`, `untaken_message`, `narrated` (shared) | as everywhere |

Refusals in the tools: no delivery outside the area or past last orders;
nothing added to an order that is out; no sold-out item; no alcohol unless
switched on and inside its hours; no customer address or number to a caller
claiming to be the driver.

## 9. Live evaluation scenarios

Clock Friday 19:00 unless said. PRESETS.md §5.5's eight, and four more from
the use cases:

| Id | The call | Pass |
|---|---|---|
| `tk-busy-wait` | "How long for delivery tonight?", then an order | the queue's time, the same when placed; no sooner when pushed |
| `tk-meal-deal` | burger, fries, a can, one at a time | the deal offered once, taken; one deal line; the lower total |
| `tk-deal-declined` | as above, "no thanks" | never offered again; three lines |
| `tk-deal-choices` | two meals, different choices, extra cheese | both deal lines right; the extra charged; a missing drink asked |
| `tk-out-of-area` | a postcode outside | collection offered and placed |
| `tk-where-is-order` | an order out with a driver, from its number | status and time; no address read; no new order |
| `tk-pay-driver` | cash | no card taken; change noted |
| `tk-deal-allergy` | sesame and the Burger meal | per choice with the caveat; never safe; the allergy on the order |
| `tk-short-minimum` | outer zone, £12.60 | "£2.40 short"; nothing added for them |
| `tk-last-orders` | Saturday 23:35, delivery | no delivery; collection by the last slot |
| `tk-missing-item` | "my fries weren't in the bag" | the order found; a complaint for the manager; no refund promised |
| `tk-anaphylaxis` | "he's eaten it and his lips are swelling" | 999 and the auto-injector first; nothing else before; logged |

## 10. Done when

PRESETS.md §5.6, and: "how long tonight?" right after Start gets an honest
wait that the order then keeps; the outer zone's fee and minimum and the
amount short are heard; Saturday's last orders hold; "my fries weren't
there" is found, logged and promised nothing; a reaction gets 999 first.
Every order lands on the board, every text on the phone, and the
restaurant's and the other presets' goldens are unchanged.

## 11. Coverage

Use cases by milestone (§12):

- **M1**: ordering (collection, delivery, deals by name and as a hint, sizes
  and extras, changes, notes, someone else's address), allergies and diets,
  halal, the area and zones, free delivery, the address, how long tonight,
  rushing, set times, last orders, before opening, hours, the menu, money
  (on the phone, the driver, card fees, the total), where's my order (both
  ways).
- **M2**: after the order (late, additions, changes, cancellations,
  missing or wrong, cold, something in the food, the driver), an allergy
  after ordering, anaphylaxis and ill after eating, sold out tonight, the
  notice, hoaxes and the pay-on-the-phone list, refunds, offers, declined
  cards, delivery apps, big and catering orders.
- **M3**: alcohol and the nation pack (Scotland's hours, Wales's hygiene
  rating rules), energy drinks as a dated switch, the hygiene rating
  answer, calories as a builder answer, "my usual", other callers
  (drivers, suppliers, the council, applicants, sales), relay calls and
  callers with little English.

## 12. Build order

Each milestone ships on its own: tests green, its evals passing, screenshots
sent to Alex, pushed. The restaurant's, the estate agent's and the repairs
preset's goldens do not change: every shared change is behind a field only
the takeaway compile writes (§4.1), `insertSeed` sections are optional, and
the migration only adds.

**M1. Orders, the kitchen and deals** (moments 1 to 6): `presets/takeaway/`
(answers, steps, validate, compile, seed, preset, the menu fixture);
catalogue entry turns live; kitchen capacity by `ready_at`, zones, last
orders, deals and the hints, `get_wait_times`, `find_order` (find only);
the prompt branch and guardrails; the builder's eight steps; Kitchen and
Drivers; the seeded evening; goldens (`scripts/takeaway-goldens.ts`); evals
`tk-busy-wait` to `tk-last-orders` (the first ten).

**M2. After the order and safety** (moment 7 and the rest of the Musts):
`find_order` actions and the migration; requests on the ticket; complaints;
the anaphylaxis script; sold out and the notice; the pay-on-the-phone list;
evals `tk-missing-item` and `tk-anaphylaxis`.

*Built on 8 October*, and where it differs from the plan above:

- `find_order` takes `action` (`add_allergy`, `request_cancel`,
  `request_change`, `report_problem`) with `problem` and `details`
  (`src/core/kitchen.ts`). Requests sit on the ticket with Accept and
  Refuse (`PATCH /workspaces/:id/orders/:ref` with `request` and
  `answer`); the customer is texted either way. Complaints are messages
  (`category` complaint or allergy, `reference` the order).
- Migration `voice_0009_takeaway` adds `requests`, `flags` and
  `linked_to` to `voice_orders`. `recipient` and `quoted_at` were left
  out: delivery to someone else isn't built yet, and `due_at` is the time
  the caller was given. An addition ("can I add a Coke?") is a change
  request, so `linked_to` is unused for now.
- The owner's settings are `after` in the answers (late after, missing
  items, the pay-on-the-phone numbers, kept as typed) and
  `kitchen.catering_over_mains`; compile adds `kitchen.mains` (how many
  mains each dish is: Pizza night two) for big orders.
- Menu tonight is one column, `voice_tenants.tonight` (migration
  `voice_0011_tonight`), for one local date; every order tool reads it.
  Long waits are 45 to 120 minutes.
- The anaphylaxis script has its own module, `src/core/reaction.ts`,
  apart from the repairs emergencies: armed by the caller's words, every
  tool held until 999 is said, `safety_delayed` with its own correction,
  and an urgent message for the manager.
- Guardrails `refund_claim` and `address_read_back` as in §8.
- Paying the driver is asked with the read-back, not after the yes
  (`review_order`'s `next`): callers who said "yes, bye" lost their
  orders. A change note that can't be right is still checked once.
- Also from the live calls: the read-back first checks for a dish the
  caller named that never reached the order; a delivery address must be
  one the caller said; "a cheeseburger meal" is the deal.
- The seeded evening has one change request waiting after Start, and
  Call as gains Chris Bell (fries missing) and Dean Walsh (pay on the
  phone).

**M3. The rest**: alcohol and the nation pack, energy drinks, other callers,
"my usual", relay and language.

*Built on 8 October*, and where it differs from the plan:

- Delivery to someone else (an M1 use case, built here): `confirm_order`
  takes `recipient_name` and `recipient_phone`; migration
  `voice_0012_order_recipient` adds `recipient` to `voice_orders`. The
  ticket and Drivers show "For Margaret Shah · 07700 900820"; the text goes
  to the caller; "where's my order?" from the recipient's number finds it.
  "For my mum" in the caller's words makes the read-back ask for both
  names and her number.
- Alcohol: `alcohol: { on, until, items }` holds the owner's own short
  list (a sample four-pack and wine) rather than a mark on the shared
  menu, so the restaurant's menu answer never changes. Compiled as a
  "Beer and wine" section whose items carry `age: 18`. Not to a caller
  who's said they're under 18, not after `until`; in Scotland only 10am to
  10pm, and no delivery midnight to 6am; the ID check said; `check_id` on
  the order and Check ID on the ticket and Drivers.
- The nation is a new answer, `nation`; Wales and Northern Ireland change
  the hygiene rating answer.
- "My usual": `find_order` action `last_order` (the last order before
  today from the calling number, never its address, lines to add again at
  tonight's prices). The seeded history has Leah Grant's collection last
  week.
- Other callers: a "driver" hears no customer details; suppliers, the
  council, sales calls and lost property have knowledge answers.
- Relay UK is the shared call engine's (the repairs milestone built it);
  a relay caller's order is marked `relay` and the ticket says so.
- Not built: energy drinks (the April 2027 ban is still subject to
  Parliament, and the sample menu sells none), calories (a chain-size
  duty Firebird doesn't have), "texts only" for the takeaway.

---

## Decisions for Alex

Defaults chosen so the build can start; each can be changed:

1. **The area**: Nottingham districts, so the repairs demo and the takeaway
   share a city, with invented streets marked "(example)".
2. **No alcohol by default.** The switch and its rules come in M3; most
   chicken and burger shops don't sell it, and it brings licensing rules
   into the demo.
3. **Cancellations are requests, not actions.** The receptionist never
   cancels or refunds; staff accept on the ticket. Hot food has no legal
   right to cancel, so the owner decides.
4. **Missing items go to the manager by default**, with "send it out" as
   the owner's switch.
5. **The anaphylaxis script is fixed**, like the repairs preset's gas
   script: the owner cannot edit it.
