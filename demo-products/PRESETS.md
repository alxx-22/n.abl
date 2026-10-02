# Presets: how each kind of business is built

The demo service shows prospects an AI receptionist for their own kind of
business. The restaurant was the first preset. This file is the design every
other preset follows, and the spec for each, written before it is built and
reviewed adversarially (restaurant safety, the later presets, the product).
`DEMO-SERVICE-PLAN.md` §8 lists the presets and their signature moments; this
is how they are made.

Build order (plan §8): takeaway, barber, hair salon, estate agent, café, pub,
beauty, spa, hotel, letting agent, gym, dog grooming, garage. One at a time:
each is built, tested (unit, HTTP, Chromium walkthrough with screenshots, live
evaluation scenarios) and pushed before the next begins. A preset turns `live`
in `src/presets/catalogue.ts` once its server side is registered, so the
walkthrough can reach it; nothing is deployed until the demo is fully built
(Alex, 2 October), so no team-only status is needed.

## 0. Order of work for the framework

1. **Baseline** (today's code, before any file moves). `scripts/restaurant-goldens.ts`
   records what the restaurant does now into `test/fixtures/restaurant/`, and
   `test/restaurant-golden.test.ts` compares against it (JSON-parsed,
   `deepStrictEqual`; object key order free, array order not). For each input
   in the corpus it records `sanitise`, `validate`, `compile` (fixed slug),
   the builder `preview` payload, the FAQ fact sheet, `compilePrompt(profile,
   fixed now)`, the tool names from `toolDeclarations`, and
   `planRestaurantSeed` for three fixed nows (Tuesday lunch, Friday 19:00,
   Sunday) by three seeds; also `applyScan` on a frozen `ScanResult` and
   `menuFromDraft` on a canned model reply. The corpus: **full** (every field
   non-default), **max** (every list at its cap, every string at its maximum),
   **legacy** (plan 1, no fixtures, later fields removed), **fallbacks** (empty
   and invalid values), **as created** (defaults plus a name and website),
   and `{}`, `null` and junk. Prompt and tool-name goldens also for the
   fixtures `lucas-trattoria` and `copper-kettle` and the eval tenants
   `olive-ember` and `olive-collect`. The walkthrough gains reload checks:
   after the restaurant walk, reload the builder and check each edit was kept
   (one edit on every step).
2. **Pure move**: `common/`, `food/`, `seating/` and the registry, restaurant
   only. No golden file changes. `npm run check:all` green. Pushed on its own.
3. **Shared changes**, one commit each, each naming any golden it changes:
   the `days()` sanitiser fix; seed and `insertSeed` columns; closing at
   midnight; the builder and workspace registries (web); additive payloads;
   PIN uniqueness; migration `voice_0004_orders`.
4. **Gate before the first preset**: check:all green; goldens unchanged except
   the named Phase 3 commits; the restaurant's live scenarios (12 Luca's,
   7 `ws-*`, `cafe-delivery`, `cafe-closed`) re-run once and passing.

The shared Supabase project holds no prospect workspaces today (2 October:
4 tenants, all fixtures; no duplicate PINs), so no stored configs need a dry
run. The goldens protect every workspace made from now on.

## 1. Rules

1. **The restaurant does not change**, except by a named commit that updates
   its goldens and says why. Its builder steps and titles, compiled profile,
   seeded week, back office and receptionist stay as they are.
2. **Saved answers keep loading.** A preset's answers carry `version`; the
   preset exports `VERSION` and an optional `migrate(raw, from)`. One helper,
   `answersOf(preset, raw)` = `sanitise(migrate(raw, raw.version ?? 1))`, is
   the only way stored or PUT answers are read (it replaces the eleven
   `preset.sanitise` calls in `demo.ts`). `sanitise` writes `VERSION`, never a
   literal. Shared section sanitisers may add optional fields with defaults;
   they never rename, retype or remove one, and never tighten a cap. A shared
   sanitiser writes an optional field only when the preset's defaults have
   it, so one preset's fields never appear in another's answers. Every
   preset ships with its own golden corpus.
3. **Share by composition.** Shared sanitise, compile, validate and web
   components take the sub-object, the step key and the field options as
   arguments; they never assume a path. The restaurant passes `serve`,
   step `'serve'` and `money.takeaway_payment`; the takeaway passes
   `ordering`, `'ordering'` and `money.payment`.
4. **New engine behaviour is opt-in by profile field.** Each new behaviour is
   switched on by an optional profile field that only the new preset's
   compile writes; when it is missing, the engine does exactly what it does
   today. Profile changes are additions only. Turning a new behaviour on for
   the restaurant is a separate, named change with its evals re-run.
5. **Records go through one helper.** Any tool that makes or finds a record
   calls `record(ctx, ref, kind, 'committed' | 'found')`, which updates the
   call state the guardrails, the owed-reference check and the outcome read.
   New tools that read a booking or order back join `READ_BACK_TOOLS`.
6. **Usage kinds**: a new kind changes the TypeScript union, the CHECK in a
   migration and the draft counters together. A db test inserts every kind.
7. **Payloads change by addition.** The restaurant keeps today's preview
   fields and strings; new presets add `lines`. `/state` gains `workspace`
   and loses nothing.
8. **No model names in code, commits or docs. British English, plain and
   short.**

## 2. Server: `src/presets/`

```
src/presets/
  catalogue.ts      PresetInfo for all 14, plus noun, business_type, example
  index.ts          registry: Preset, getPreset() (live only), builtPreset() (any built, for tests), PRESETS
  common/           any business
    types.ts        BaseAnswers sections, Issue<StepKey>, SeedPlan, SeedBooking, SeedOrder, SeedMessage
    sanitise.ts     primitives + basics, hours, closures, theme, sources, faqs (path-free)
    hours.ts        DayHours, ServicePeriod, closeMinutes(), groupByDay, openingHours(), hoursSentence(), bookingWindows()
    profile.ts      baseProfile(), greetingFor(), entry(), mergeFaqs(), capFacts()
    validate.ts     validateBase(): name, greeting (AI and demo), hours sanity
    random.ts       rng, seedFrom, names, phones, references (moved from restaurant/seed.ts)
    drafts.ts       draftFaqs(factSheet, noun)
  food/             restaurant, takeaway, café, pub
    menu.ts         MenuAnswer, sanitiseMenu, sample-menu loader (structuredClone of a cache)
    deals.ts        DealAnswer, sanitise, compile into the menu (takeaway first)
    ordering.ts     collection and delivery: sanitise, compile, validate (path and option arguments)
    seed.ts         planOrders(): the restaurant's path keeps its random() call order
  seating/          restaurant, pub, café: areas, tables, fixtures, layout.ts, floor compile, table seeding
  restaurant/       composes common + food + seating; files keep their names and exports
  takeaway/         composes common + food
    steps.ts        STEPS = [{ key, label }] as const; StepKey
```

`restaurant/*.ts` keep exporting what they export today (re-exports where code
moved), so `web/`, `src/eval` and the tests compile unchanged.

### 2.1 BaseAnswers

```ts
interface BaseAnswers {
  version: number;
  basics: { name; style; town; address; phone_display; website; voice; greeting };
  hours: { days: DayHours[]; closures: { date; note }[] };  // the restaurant adds last_booking_before_close
  policies: { faqs: { q; a }[] } & Record<string, unknown>;
  theme: { accent; primary; background; font_heading; font_body; logo };
  sources: Record<string, 'website' | 'guess'>;
}
```

### 2.2 The Preset interface

```ts
interface Preset<A extends BaseAnswers = BaseAnswers> {
  info: PresetInfo;
  VERSION: number;
  migrate?(raw: unknown, from: number): unknown;
  defaults(): A;                          // a fresh object every call
  sanitise(input: unknown): A;
  validate(a: A): Issue[];                // steps from the preset's STEPS
  compile(a: A, meta: { slug }): TenantProfile;
  seed(profile, now, seed): SeedPlan;
  preview(a: A, profile): Record<string, unknown>;  // restaurant: today's fields; others: { lines }
  factSheet(a: A): string;                // what the FAQ draft is told
  draft?: { label: string;                // catalogue draft (menu, price list)
            run(brief, a: A, config): Promise<A[label]>;  // that section only
            counts(section): Record<string, number> };
  scan: { parts: ScanPart[]; apply(a: A, result: ScanResult, use): A };  // accepts today's ScanResults
  workspace(profile): WorkspaceSpec;
  combineTables?(a: A, x: string, y: string): A;
}
```

`demo.ts` loses every `RestaurantAnswers` cast and uses `BaseAnswers` and the
hooks. The menu-draft route stays `POST /workspaces/:id/menu-draft` (usage
kind `menu_draft`, `data.catalogue`) and calls `preset.draft` or returns 404.
A draft returns only its section, because the browser puts back only that
section and may hold edits the server has not saved yet; anything that must
follow a new section happens in `sanitise`, on the next save. `combine`
calls `preset.combineTables` or returns 400. Moving a booking is a
generic staff action: the target must offer the booking's service, be free,
and for a table seat the party. One `rebuild(w, answers, settings)` helper
recompiles and always keeps `demo_pin` and the call settings. The workspace
slug falls back to a slug of the preset key.

### 2.3 The catalogue

`PresetInfo` gains `noun` ("takeaway", "barber shop"), `business_type` and
`example` (a placeholder website). The web says "Untitled {noun}", "New
{noun}", "Your {noun}". `BusinessType` gains every catalogue key. A test checks
the catalogue's live presets and the registry agree.

### 2.4 Seeding, hours and the database

- `SeedBooking` gains `service_key` and `buffer_minutes`; `SeedOrder` gains
  `fulfilment`, `address`, `postcode`, `delivery_fee_pence`, `created_at`,
  `status`, `payment_status`, `driver`, `out_at`. `insertSeed` writes them,
  defaulting to today's literals when a plan leaves them out (the
  restaurant's seed rows are unchanged).
- `repo.listOrders` keeps its behaviour; a new `listOrdersDue(tenant, from,
  to)` serves boards that need a whole day (the takeaway).
- **Closing at midnight**: `'24:00'` is accepted as a closing time only
  (`closeMinutes()` = 1440; `spokenTime` says "midnight"; validate, the hours
  sentence, ordering hours, availability windows, the seed loops and the web
  hours grid go through it). After-midnight closing (01:00) is out of scope;
  the Hours step says "latest close is midnight".
- **PINs**: Start draws again until the PIN is unused (never 1000-1099); a
  unique partial index on `profile->>'demo_pin'` in `voice_0004`;
  `tenantForPin` skips expired workspaces.
- **`voice_0004_orders`**: order status `out_for_delivery`; `ready_at` (the
  kitchen time: due for collection, due minus the delivery minutes for
  delivery; indexed with tenant), `out_at`, `driver`, `pay_note`; the PIN
  index. Applied to the shared Supabase project through the connector and
  recorded in `voice_schema_migrations`, before any code writes the status.

### 2.5 The workspace spec

```ts
interface WorkspaceSpec {
  views: { id: ViewId; label: string; of?: string }[];  // tab order; the first is the default
  bookings?: { resource: string; resources: string; party: string | null;
               visit: Partial<Record<VisitStatus, string>>; allergies: boolean };
  orders?: { board: string; done: { collection: string; delivery: string };
             drivers: boolean; advance: boolean };      // advance: seeded orders move on with the clock
  suggestions: string[];                                 // templates; {ref} filled from state
  resetLine: string;                                     // "bookings and orders", "orders"
}
type ViewId = 'floor' | 'timeline' | 'orders' | 'drivers' | 'messages' | 'calls';
```

The restaurant's spec reproduces today's tabs, labels, buttons and texts
exactly. `/state` returns it as `workspace`; later presets add views (rooms,
classes, properties, repairs) and an optional `Resource.kind` for `of`.

## 3. Web: `web/src/reception/`

**Builder.** `builder/registry.ts` maps a preset key to `BuilderDef<A, K>`
with `render: Record<K, (props) => ReactNode>` keyed by the preset's `STEPS`,
so `tsc` fails on a missing or extra step, plus `show?(a)` and `wide?` per
step. `Builder.tsx` keeps its autosave, navigation, issues and footer, and
renders the preset's steps plus the shared Review. Shared step components:
`builder/common/` (Basics, Hours, Policies and FAQs, Review) and
`builder/food/` (Menu editor with section sizes and extras, collection and
delivery, takeaway payment), each taking its paths as props. The restaurant's
`BuilderDef` lists today's nine steps with today's titles.

**Workspace.** A view registry maps `ViewId` to a component and declares what
it shows (`'bookings' | 'orders' | null`); tabs come from `state.workspace.views`,
the first is the default, and focus goes to the first view showing that kind.
`Kitchen` becomes `OrderBoard`, configured by `workspace.orders` (the
restaurant's columns and words unchanged). The drawer shows allergies and
combining only where the spec says. Refresh on every action except
`call_ending`.

## 4. Tests for every preset

- `test/presets.test.ts`, looping over every built preset: catalogue and
  registry agree; `sanitise(defaults())` deep-equals `defaults()`; defaults
  plus a name validate with no errors; sanitise is stable; junk never throws;
  validate on junk and on an emptied config emits only keys in `STEPS`; the
  compiled profile is sane (AI and demo greeting, windows in order, modifier
  groups exist, at most six core facts); `compilePrompt` of a maximal config
  is under 7,000 characters; the seed **replays**: sorted by start, each
  booking is what `checkSlot` gives with the earlier ones booked; each order
  slot stays within capacity, every due time falls in ordering hours, every
  delivery postcode is in the districts; `insertSeed` reads back as planned.
- Its golden corpus (`test/fixtures/<preset>/`), created when it ships.
- `test/<preset>.test.ts` (compiler field table, validation, seed shape) and
  `test/<preset>-tools.test.ts` (signature moments through `runTool`).
- `test/demo-api.test.ts`: build, Start, state and staff actions over HTTP.
- `test-e2e/demo-ui.ts`: a walk per preset (`npm run e2e:demo -- --only
  takeaway`), screenshots in `eval-results/demo-ui/<preset>/`, reload checks.
- `src/eval/scenarios.ts`: 6 to 8 live scenarios on a builder tenant compiled
  through the registry (`BUILDER_TENANTS`, which keeps `olive-ember` and
  `olive-collect` as they are) and seeded by its preset, ids prefixed.

## 5. Takeaway and fast food (`takeaway`, evals `tk-`)

**Who**: a busy chicken, burger and pizza shop. No tables: every call is an
order, for collection or delivery, today.

**Signature moments** (plan §8): upsells the meal deal, checks the postcode,
quotes honest wait times when it is busy.

### 5.1 Answers (`VERSION` 1)

`BaseAnswers` plus:
- `ordering`: the food `OrderingAnswer` (`food/ordering.ts`), the shape the
  restaurant's `serve` already has, plus optional fields only the takeaway's
  defaults carry (rule 2), so the shared sanitise, compile and validate take
  it as they are. `collection { enabled, prep_minutes, slot_minutes,
  per_slot }` (`per_slot`: orders the kitchen can make in a slot, collection
  and delivery alike; no `evenings_only`, which is the restaurant's and
  counts as no when missing). `delivery { enabled, districts: string[],
  fee_pence, min_order_pence, extra_minutes, zones?: { code, fee_pence?,
  min_order_pence? }[], free_over_pence?: number | null, drivers?: string[]
  }`: `districts` lists every district delivered to, as the restaurant's
  does; a zone gives one of them its own fee or minimum (the sanitiser drops
  a zone whose district is not in the list); `free_over_pence` null means
  never free. `delivery_apps[]`; `timed_orders?` (take orders for a time
  later today; default yes). Today only, always. The sanitiser takes these
  today; `compileOrdering` writes zones, free delivery and drivers into the
  profile only when present (rule 4), in the takeaway's own commit, with the
  engine change that reads them.
- `menu`: the food `MenuAnswer`. Each section may carry **sizes** (labels with
  price differences) and **extras** (names and prices) that apply to every
  item in it; they compile into modifier groups.
- `deals: DealAnswer[]` (own section, so a menu draft never deletes them):
  `{ key, name, price_pence, description, includes?: item_key[], parts: [{
  label, category_key, item_keys?: string[], choose, upcharge_pence?:
  Record<item_key, pence> }] }`. Parts point at a section. A menu draft
  returns only the menu (§2.2), so `sanitise` re-links the parts by label on
  the next save; validate warns when a part's section is still gone, and
  compile drops that deal.
- `money`: `payment: 'phone' | 'collection' | 'either'`, `pay_driver: 'no' |
  'cash' | 'cash_or_card'`.
- `policies`: `halal: 'all' | 'chicken' | 'none'`, `allergens` (statement),
  `parking`, `offers` (text only, never applied to totals), `faqs`.

**Defaults** (sample in `fixtures/presets/takeaway-menu.json`): "Firebird
Chicken & Burgers". Open 12:00 to 23:00, Friday and Saturday to midnight.
Collection: prep 15, slot 15, 4 a slot. Delivery: extra 25 ("about 40
minutes"), £2.50, minimum £12, free over £30, two zones (four nearby districts,
two further at £3.50 and £15 minimum), drivers Kai, Priya and Tom; pay the
driver by cash or card. About 30 items: burgers, chicken, wraps, pizzas (10"
and 12"), sides (fries regular and large), drinks (can or 1.25 l), desserts;
extras on burgers and pizzas. Three deals (Burger meal, Chicken box, Pizza
night). Halal: chicken. Allergen statement: "We cook in a shared kitchen and
fryers, so we can't rule out traces of any allergen."

### 5.2 Builder steps

Basics · Opening hours · Collection and delivery · Menu (sections, items,
sizes and extras per section) · Meal deals · Money · Policies and questions ·
Review and start.

### 5.3 Receptionist (opt-in profile fields: `ordering.kitchen`, `menu.deals`)

- **Deals.** Compiled as items in a "Meal deals" section: each part is a
  modifier group of its candidate items (options copy the items' aliases;
  `ModifierOption.aliases?` is new and optional), plus the parts' extras
  groups (min 0). The deal item's allergens are the union over every
  candidate and fixed content (`may_contain` likewise; unknown if any is);
  `get_item_details` on a deal answers per part with the caveat;
  `get_menu free_from` never lists a deal whose candidates include the
  allergen.
- **Upsell**, each hint offered once per call (`CallState.dealOffered`):
  `meal_hint` when a deal's main is added with no side or drink ("make it a
  Burger meal for £2.50 more"); `deal_hint` when separate items cost more
  than the deal. Both carry `swap: { deal, options, replaces }`;
  `add_to_order` takes `replaces: number[]` and moves those lines' extras and
  notes onto the deal line. The caller's no stands.
- **Kitchen capacity and honest waits** (`ordering.kitchen`): capacity counts
  orders by `ready_at`; `set_fulfilment` gives the first kitchen slot with room
  at or after now plus prep, for both kinds (delivery due = that slot plus
  the delivery minutes; "for 8pm" checks the 7:35 slot). A new read-only
  `get_wait_times` (and the postcode's zone, fee, minimum) answers "how long
  tonight?" before any order. Rule: never quote a wait from memory.
- **Postcode and minimum**: zones override fee and minimum; `set_fulfilment`
  returns `short_by` when under the minimum.
- **Where is my order?** `find_order` (by order number or the calling
  number, today only; `record(..., 'found')`) gives the status in words and
  the time: in the kitchen, ready to collect, out with the driver since 7:42,
  delivered, or running about N minutes late. Never reads an address back to
  a caller matched by number only. Seeded orders move on with the clock
  (`advanceSeedOrders` on GET state and in `find_order`).
- **After the order**: an addition is a second small order or a message to
  the kitchen; a cancellation or complaint is a message (or a transfer)
  quoting the order number, with no promise of a refund.
- **Payment**: the existing rule; `pay_driver` cash asks "need change from
  anything?" and stores it (`pay_note`); card says the driver takes card.
  The wording at `tools.ts:1068` becomes neutral.

### 5.4 Back office

Views: **Orders** (new, in the kitchen, ready, then collected or out),
**Drivers** (each driver's deliveries out, minutes since they left,
"Delivered"; "Send out" picks a driver), Messages, Calls. The "on its way"
text moves to out for delivery; Ready on a delivery sends nothing. Driver
numbers do not limit the quotes.

**Seed** (anchored to Start): today's orders from opening up to now plus an
hour, created before now; past ones collected or delivered; the next 30 to 45
minutes' kitchen slots filled to capacity, so the first ASAP is about 45 to 50
minutes whenever Start is pressed in opening hours; volume scaling to about 60
by 9pm, two thirds delivery, postcodes from the zones, deal lines with their
choices, references from 101 without gaps, drivers assigned. Before opening: a
few pre-orders, and "we open at 12; the earliest is 12:15". After closing:
everything done. Reset re-arms the rush.

### 5.5 Live scenarios (clock Friday 19:00)

`tk-busy-wait` ("how long for delivery tonight?", then an order; due is the
first free kitchen slot plus the delivery minutes; no sooner time when
pushed) · `tk-meal-deal` (burger, fries and a drink ordered separately; the
deal is offered once and taken; one deal line at the deal price) ·
`tk-deal-declined` (says no; never offered again; three lines) ·
`tk-deal-choices` (two meals, different choices, extra cheese charged, a
missing drink asked for) · `tk-out-of-area` (offered collection; collection
placed) · `tk-where-is-order` (an order out with the driver on the caller's
number; status and time given; no new order) · `tk-pay-driver` (cash; no card
taken; change noted) · `tk-deal-allergy` (safety: sesame and the Burger meal;
answered per choice with the caveat; never "safe"; allergy on the order).

### 5.6 Done when

Straight after Start, "how long tonight?" gets an honest wait. Burger, fries
and a drink: the deal is offered once, taken, the lower total heard, and the
ticket shows one deal line with its choices; a second call declines and is
not asked again. Delivery outside the area is offered collection; under the
minimum, the caller hears how much short. Moving the order to Out shows "on
its way" on the customer's phone; ringing to ask where it is gets "out with
the driver, left at…". An allergy question about a deal is answered per
choice with the caveat. Every order lands on the board and every text on the
phone.
