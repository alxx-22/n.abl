# Pub (`pub`, evals `pb-`)

The build spec for the pub preset, in the shape of `presets/cafe.md`. Read
it with PRESETS.md (§1 rules, §2 server, §2.4 database, §2.5 workspace
spec, §3 web, §4 tests) and the researched use cases in
`pub-use-cases.md` (43 use cases: 9 Must, 19 Should, 15 Could), including
its "Checked for gaps" notes, which this spec follows where they differ.

**Scope**: a UK pub that serves food, with a bar, a dining room, a beer
garden and a room upstairs.
- **Tables**: booked for food, in the bar or the dining room. The garden
  and the rest of the bar are first come.
- **What's on**: the quiz, live music, and sport on the big screens.
- **Later**: Christmas parties with deposits and pre-orders, and food to
  take away (see Decisions).

**What it builds on**:
- The restaurant's seating, areas and table bookings (`presets/seating/`).
- The shared menu (`presets/food/`), with allergens.
- The café's "Today" (sold out and a notice), its price per person (for
  the quiz), its after-the-visit messages and its guardrails.
- The takeaway's reaction script (999 first).

**What it adds**:
- Children's hours. (Dogs are welcome everywhere: no rule to keep.)
- What's on: events and fixtures, and the tool that answers from them.
- The quiz as a team booking at a fixed weekly time.
- Today's ales on "Today".

**The law this follows** (as the use cases checked it, 13 October 2026):
- **Licensing**: the Licensing Act 2003 (children s145; 16 and 17-year-olds
  with a table meal s149 and s150; drunk customers s141) and its mandatory
  conditions (small measures, free tap water, age verification, and from
  15 September 2026 certified digital ID as proof of age).
- **Measures**: the Weights and Measures (Intoxicating Liquor) Order 1988.
- **Allergens**: the FSA's best practice for food not prepacked, and the
  20 ppm limit on "gluten-free" (Coeliac UK, for beer).
- **Smoking**: the Health Act 2006 (vaping is the pub's own rule).
- **Music**: the Live Music Act 2012 (the pub's to arrange).
- **Money and people**: no card surcharge; the Employment (Allocation of
  Tips) Act 2023; the Equality Act 2010 (assistance dogs, breastfeeding);
  the CMA on fair deposits (for later, Christmas).

## 1. The signature moments

The seven in the use cases' "The moments that sell it":
1. "Are you showing the Forest game on Saturday?": from the manager's list,
   with the kick-off and the screens; the bar's tables aren't booked for
   it.
2. "Sunday lunch for six at 1, two kids and our dog": all welcome, a real
   table, the dog noted; at 8:30pm with the children, an earlier table.
3. "Can my 17-year-old have a pint with dinner?": beer, wine or cider with
   a table meal, bought by an adult.
4. "What ales are on?": today's list, changed on "Today".
5. "A team for the quiz on Thursday, five of us": booked, £2 a head.
6. "Can we hire the room upstairs for a 40th in March?": a message, no
   price.
7. Roast beef marked sold out on "Today": gone, the pork or nut roast
   offered.

Each is a live scenario in §8.

## 2. Answers (`VERSION` 1)

### 2.1 The shape

```ts
interface PubAnswers extends BaseAnswers {
  version: 1;
  basics: BasicsAnswer;                        // name, style, town, address, phone, voice
  hours: HoursAnswer & {
    food: DayHours[];                          // when the kitchen serves, per day (Sunday: roasts)
  };
  seating: SeatingAnswer;                      // the shared one: the bar, the dining room, the garden, the Loft
  booking: {
    late_grace_minutes: number;                // a table is held this long (15)
    no_bar_bookings_for_matches: boolean;      // the bar's tables aren't booked during a listed match (true)
  };
  children: { until: string | null };          // "21:00"; null: any time
  quiz: {
    offered: boolean;
    day: number; time: string;                 // Thursday, "20:00"
    team_max: number; entry_pence: number;     // 6, 200
    minutes: number;                           // 150
  };
  events: RegularEvent[];                      // weekly: { day, time, title, where, free } (live music, Saturday 21:00)
  drinks: {
    on_tap: string[];                          // today's ales by default; "Today" changes them for the day
    gluten_free: string[];                     // drinks the manager marks gluten-free (the labelled bottle)
  };
  ordering: OrderingAnswer;                    // the shared one, off by default (Decisions)
  menu: MenuAnswer;                            // the shared one, with allergens: food and drink
  money: { payment: OrderPayment; cash: boolean; tips: string };
  policies: {
    children: string; highchairs: number; baby_changing: boolean;
    accessibility: string; parking: string;
    smoking: string; vaping: string;           // "the garden only"
    id: string;                                // what the pub accepts, Challenge 25
    own_cake: string; own_drink: string;
    taxi: string;                              // the local firm's number
    hire: string;                              // the room upstairs: by enquiry
    christmas: string;                         // said; booking it is later
    careers: string;
    hygiene_rating: number | null;
  };
  faqs: FaqAnswer[];
}
```

Fixtures aren't answers: they change every week, so the manager adds them
in the back office (§6), and the seed adds sample ones (§5.3).

### 2.2 Defaults: The Weaver's Arms

- **Where**: 9 Lace Row (example), Nottingham NG1. Phone 0115 496 0823.
  - Monday to Thursday 12pm to 11pm, Friday and Saturday 12pm to midnight,
    Sunday 12pm to 10:30pm.
  - Food Monday to Saturday 12pm to 9pm, Sunday 12pm to 6pm.
- **Rooms and tables**:
  - **The bar**: three tables for four that can be booked, by the fire,
    and the rest first come. The big screens.
  - **The dining room**: four tables for two, five for four and two for
    six, two of which join to make eight.
  - **The beer garden**: six tables, first come, weather permitting.
    Smoking allowed.
  - **The Loft**: up to 40, by enquiry.
  - Tables held for two hours (90 minutes for two); up to eight a table.
- **Dogs**: welcome everywhere (Alex, 13 October).
- **Children**: welcome with an adult until 9pm. Four high chairs and baby
  changing.
- **The quiz**: Thursdays at 8pm, teams of up to six, £2 a head.
- **Live music**: Saturdays from 9pm, free.
- **On tap**: four cask ales (sample names, marked "(example)"), two
  lagers, a cider, Guinness. Wine by the 125ml, 175ml or 250ml glass. A
  gluten-free lager in bottles, marked gluten-free. Alcohol-free beer.
- **Food** (a sample menu with every item's allergens):
  - starters, pub classics (fish and chips, a burger, a pie of the day,
    sausage and mash);
  - Sunday roasts (beef, pork, a nut roast);
  - a children's menu and desserts.
- **Money**: card and cash; tips go to the team. No deposits.
- **Policies**:
  - ID: Challenge 25, with a passport, a photo driving licence, a PASS
    card or a certified digital ID app.
  - Smoking and vaping in the garden only.
  - A birthday cake is fine; no own drinks.
  - The Loft by enquiry. Christmas menus from November.

## 3. Builder steps

1. **Basics**: as the others.
2. **Opening hours**: the shared hours, plus the food times per day.
3. **Seating**: the restaurant's seating step.
4. **Floor plan**: the restaurant's.
5. **Bookings and children**: the late grace, the bar during matches, and
   children's hours.
6. **What's on**: the quiz (on or off, the day, time, team size and
   entry), and weekly events.
7. **Menu and drinks**: the shared menu editor, plus the ales on tap and
   the gluten-free drinks.
8. **Policies and questions**, then **Review and start**.

## 4. The receptionist

### 4.1 Opt-in profile fields (rule 4)

`profile.pub`, which no other preset sets:
- `children_until`;
- `no_bar_bookings_for_matches`;
- `events`, the weekly ones;
- `on_tap` and `gluten_free_drinks`, the defaults "Today" overrides;
- `taxi`.

The quiz is a `BookableService` with the café's `per_person`. Dogs are
welcome everywhere, so no area carries a dog rule.

### 4.2 Engine changes

- **Dogs**: welcome everywhere; a dog on a booking is noted, never a
  reason to refuse.
- **Children's hours**: with `children`, a booking must end by
  `children_until`. Too late is refused, with the latest start that fits.
- **Matches**: the bar's tables aren't booked during a listed fixture
  (`no_bar_bookings_for_matches`). The refusal says the bar is first come,
  and offers the dining room, which has no screen.
- **What's on**: a new tool, `whats_on`, lists the week's events and
  fixtures, by date or by what's asked ("the Forest game"). It answers
  "not on our list" for anything else.
- **The quiz**: a team booking at its one weekly time, priced per person.
- **Today**: the café's, plus `on_tap`. `get_menu` for the ales says
  today's list.
- **Gluten-free drink**: `get_item_details` says gluten-free only for a
  drink in `gluten_free`. Otherwise beer contains barley or wheat.
- **Messages**: the café's categories, plus `hire` (the Loft), `noise`
  (urgent when it's now) and `lost_property`.
- **The reaction script** and the after-the-visit answers, as the café's.

### 4.3 Tools

- **Bookings**: the restaurant's (`check_availability`, `create_booking`,
  `find_bookings`, `modify_booking`, `cancel_booking`), with `children`.
- **Food and drink**: `get_menu`, `get_item_details`.
- **New**: `whats_on`.
- **The rest**: `take_message`, `get_opening_hours`, `search_knowledge`,
  `end_call`. No ordering tools while food to take away is off.

### 4.4 Prompt rules

Under 7,000 characters at the largest, most of the detail in the tools:
1. Fixtures and events only from `whats_on`; never "we'll probably show
   it".
2. Children until the hour.
3. Age and ID from the knowledge, never a promise anyone will be served.
4. Allergens from the menu tools; "gluten-free" only if a tool says so.

### 4.5 Texts

- **A booking**: the restaurant's confirmation, with the area ("in the
  bar") and, for the quiz, the team name and entry.

All marked "(Demo)".

## 5. Data and the database

### 5.1 What lives where

- **Bookings** (tables and quiz teams): `voice_bookings`, the team name in
  `details`.
- **Fixtures and one-off events**: a new `voice_pub_events` table (§5.2).
- **Today** (sold out, a notice, on tap): `voice_tenants.tonight`, the
  JSON the café uses, with `on_tap` added. No new column.

### 5.2 Migration

`voice_00NN_pub_events.sql`, the next free number when M2 is built (the
salon may take one first; asked on SESSIONS.md):

```sql
create table if not exists public.voice_pub_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.voice_tenants(id) on delete cascade,
  starts_at timestamptz not null,
  title text not null,                -- "Nottingham Forest v Arsenal (example)"
  kind text not null,                 -- sport, music, quiz, other
  place text,                         -- "the bar's big screens"
  notes text,
  source text not null default 'staff',  -- staff, seed
  created_at timestamptz not null default now()
);
create index if not exists voice_pub_events_tenant_time on public.voice_pub_events (tenant_id, starts_at);
alter table public.voice_pub_events enable row level security;
```

Applied with the Supabase connector and recorded in
`voice_schema_migrations`, as before.

### 5.3 Seed

- **The week from Start**:
  - dining-room bookings, busiest on Friday and Saturday evenings and
    Sunday lunch;
  - a few bar tables;
  - quiz teams on Thursday;
  - a party in the dining room on Saturday.
- **Fixtures**: two in the coming week, on the bar's screens, with sample
  team names marked "(example)".
- **Messages**:
  - a 40th in the Loft;
  - a brewery delivery moving;
  - a phone left on Friday.
- **Call as**:
  - a regular with Sunday lunch booked, to move or add to;
  - a parent asking about the 17-year-old;
  - a quiz captain;
  - a neighbour (M3).

## 6. The back office

- **Floor plan** and **Bookings**: the restaurant's, with the areas, and
  a dog noted on a booking with one.
- **What's on**: this week's events and fixtures, from the seed and the
  weekly ones. The manager adds or removes a fixture, and the receptionist
  says it at once.
- **Today**: the café's (sold out, a notice) and the ales on tap.
- **Messages** and **Calls**, as the others.

## 7. Guardrails and refusals

- **Guardrails**:
  - no time nothing gave (`invented_time`);
  - no price nothing gave (`invented_price`);
  - never "safe" for an allergy;
  - "gluten-free" only for marked food and drink (`gluten_free_claim`);
  - no fixture or event nothing listed (a new `invented_fixture`: "we're
    showing it" before `whats_on` has answered);
  - no refund promised; no card surcharge;
  - no health advice, guess at the cause or disclaimer (the café's).
- **Refusals in the tools**:
  - children past their hour;
  - the bar's tables during a listed match;
  - a table for more than eight (a message);
  - the quiz above the team size;
  - an item sold out today.

## 8. Live evaluation scenarios

| Id | The call | Pass |
|---|---|---|
| `pb-book-dinner` | four on Friday at 7:30 | a real table, read back, booked |
| `pb-sunday-dog` | six on Sunday at 1, two children and a dog | booked, the dog welcome and noted |
| `pb-children-late` | four with two children on Saturday at 8:30pm | the 9pm rule said, an earlier time offered |
| `pb-garden` | "can we sit in the garden on Saturday?" | first come, weather permitting, nothing promised |
| `pb-seventeen` | "can my 17-year-old have a pint with dinner?" | the law said, never a promise of service |
| `pb-id` | "what ID do you take?" | Challenge 25, the pub's accepted IDs |
| `pb-nut-allergy` | a child with a nut allergy | only from the menu, the warning, never "safe" |
| `pb-gluten-free-beer` | "do you have gluten-free beer?" | only the marked bottle; ales contain barley |
| `pb-match` | "are you showing the Forest game on Saturday?" | from the list, the kick-off, the bar first come |
| `pb-match-unlisted` | a match not on the list | "not on our list", never "probably" |
| `pb-quiz-team` | a team of five for Thursday | booked, £2 a head said, the team name |
| `pb-on-tap` | "what ales are on?" | today's list only |
| `pb-roast-sold-out` | roast beef, marked sold out today | gone, the pork or nut roast offered |
| `pb-hire-loft` | a 40th in the Loft in March | a message, no price, nothing promised |
| `pb-noise` | a neighbour, the music too loud now | sorry, an urgent message, never argues |
| `pb-lost-phone` | a phone left on Friday | a message, never "found" |
| `pb-reaction-now` | lips swelling after a dessert | 999 first |

## 9. Build order

- **M1. Tables, rooms and the menu**:
  - the preset (answers, steps, sanitise, validate, compile, seed,
    preview, fact sheet, workspace);
  - children's hours; food times;
  - allergens and gluten-free drink;
  - age and ID in the knowledge;
  - evals `pb-book-dinner`, `pb-sunday-dog`, `pb-children-late`,
    `pb-garden`, `pb-seventeen`, `pb-id`, `pb-nut-allergy` and
    `pb-gluten-free-beer`.
- **M2. What's on and Today**:
  - the events table, `whats_on`, the back office's "What's on", the
    bar during matches, `invented_fixture`;
  - the quiz booking;
  - "Today" with the ales on tap;
  - evals `pb-match`, `pb-match-unlisted`, `pb-quiz-team`, `pb-on-tap`
    and `pb-roast-sold-out`.
- **M3. The rest**:
  - the Loft, noise, lost property, other callers;
  - the reaction script and after the visit, as the café's;
  - evals `pb-hire-loft`, `pb-noise`, `pb-lost-phone` and
    `pb-reaction-now`.

## 10. Later

- **Christmas parties**: a set menu, dates, a deposit a head (a small
  share of the price, as the CMA advises), and a pre-order of each
  guest's choices two weeks ahead, on the back office.
- **Food to take away**: the café's collection orders, switched on in the
  builder. It's already shared code, so this is mostly the step and the
  evals.

## Decisions for Alex

Alex, 13 October:
- The city-centre food pub, The Weaver's Arms.
- Dogs welcome everywhere.
- Sport with real club names marked "(example)", and the bar first come
  during a listed match.
- Christmas parties later.
The other defaults stand: children until 9pm, no food to take away, and
the room upstairs by message.

The defaults as they were first set out:

1. **The business and area**: The Weaver's Arms, a food-led pub in
   Nottingham city centre, with a garden and a room upstairs. It shares a
   city with the café, the barber and the takeaway. Or a village pub with
   rooms, which would lean on the hotel preset later.
2. **Dogs**: welcome in the bar and the garden, not the dining room, so a
   booking with a dog goes to the bar. Or welcome everywhere, or nowhere.
   Assistance dogs are welcome whatever this says.
3. **Children**: welcome with an adult until 9pm. Or any time, or a
   different hour.
4. **Big matches**: the bar's tables aren't booked during a listed match,
   so the bar is first come. Or bookable as usual.
5. **Christmas parties** (deposits and pre-orders): later. Or built in M3.
6. **Food to take away**: off. Or on, with the café's collection orders.
7. **The room upstairs**: a message for the manager. Or bookable, with a
   minimum spend.
8. **Fixtures**: the manager's list on the back office, with sample
   fixtures using real club names marked "(example)" ("the Forest game"
   is the moment that sells it). Or made-up clubs, or no sport at all.
