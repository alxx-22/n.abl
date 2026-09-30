# n.abl Demo Service: build plan

**Status: phases 1 to 6 built and tested (30 September 2026); not yet
deployed.** Decisions D1 to D13 as recommended, except D12 and D13 as amended
below. Branch: `voice-agent-DEV`. Where each phase stands is in section 10.

The short version: a prospect gets a private link and a key. They pick their
kind of business, build a believable version of it in about ten minutes
(seating, menu, takeaway, deposits, policies), press **Start**, and the demo
fills their own booking system with realistic data. Then they ring their new
AI receptionist from the browser and watch bookings land on their floor plan,
orders land on their kitchen board, and confirmation texts land on a
customer's phone, all live. The restaurant with click and collect is built
first and in full; the other presets follow on the same framework. Later the
CRM issues the keys and sees how each prospect used their demo.

---

## 0. What already exists, and what this adds

Built and tested in `demo-products/voice-agent/` (see its `README.md` and
`BUILD-PLAN.md`):

| Exists | Where |
|---|---|
| Live voice calls in the browser and over the phone, Gemini Live, fallback between two models, a watchdog that replays a missed turn to the other model | `src/core/call.ts`, `src/channels/` |
| Contextual turn-taking: waits through thinking pauses, chunked numbers and side conversations; "mm-hm" does not interrupt | `src/core/turns.ts` |
| Tables with capacities, pushed-together tables (`combines`), sitting lengths by party size, booking windows, deposits | `src/domain/availability.ts`, `types.ts` |
| Menu with allergens (the UK 14), may-contain, dietary tags, options with prices; ordering for collection and delivery, delivery districts | `src/domain/menu.ts` |
| Find, change and cancel a booking by reference, by phone or by name | `src/core/tools.ts` |
| Demo card payments, deposits, simulated SMS | `src/domain/payments.ts`, `src/channels/sms.ts` |
| A live board: transcript, diary, orders, messages, settings (voice, greeting, turn-taking, reply speed, model) | `web/` (React) |
| `voice_` tables in the shared Supabase project `auivrancfnrdwyiqoakt`, RLS on | `src/db/migrations/` |
| Setup from a website (drafts a profile from the business's own pages) | `src/ingest/` |

What this plan adds: private access, a guided builder with presets, a seeded
workspace per prospect, a real back office (floor plan, timeline, kitchen
board) that staff can act on, the customer's-eye view, the agent behaviours a
restaurant needs, hosting under `nabl.agency`, and the CRM link.

---

## 1. What a prospect experiences (the restaurant, start to finish)

Sam runs a busy restaurant with indoor and outdoor seating, both reservable,
and does click and collect by phone.

1. **The invitation.** Sam gets an email or letter with a link,
   `nabl.agency/demo/reception`, and a key like `K7QX-M3RD-9WTF`. A one-click
   version of the link carries the key after a `#`, which never reaches a server
   log or another site.
2. **The door.** An unlisted page (no index, not in the sitemap, not linked
   from anywhere). Sam pastes the key. The page greets them by name and company
   ("Your private demo, Sam. Nothing you set up here is shared."), with the key's
   expiry date.
3. **Pick a business.** A grid of presets. Restaurant is live; the others show
   as "coming soon" until they are built.
4. **Build it** (section 4.1 has every field). Seven short steps with a live
   preview on the right: basics and hours; how you serve (tables, walk-ins,
   click and collect, delivery); seating areas and tables; the floor plan;
   the menu ("describe your food" and the AI drafts it, then Sam edits);
   money (deposits, and whether takeaway is paid on the phone or on
   collection); policies and FAQs. Every step has sensible defaults, so
   "Next, Next, Next" still produces a good demo.
5. **Start.** The demo compiles Sam's answers into the receptionist's
   profile and fills a week of bookings and today's orders in the database,
   shaped by Sam's own tables, areas, hours and menu. Real rows in Supabase,
   not placeholders.
6. **The workspace.** Three panels:
   - **The call**: press *Start a live call* and ring the receptionist.
   - **The back office**: the floor plan for tonight's service with every table
     coloured by state, a timeline of the evening, and the kitchen board.
   - **The customer's phone**: a phone on screen that receives the texts a
     caller would get.
7. **The call.** Sam books a table for four on Friday at half seven. The
   receptionist asks inside or outside, mentions that the terrace moves
   indoors if it rains, asks about allergies, and hears "my son's coeliac".
   The booking appears on the floor plan (Table 12, terrace), flagged with an
   allergy badge; the customer's phone gets "Booked: Friday 7:30pm, 4 people,
   terrace. Ref KX4Q7. To change it, call us and quote your reference."
8. **The back office is real.** Sam clicks the table: name, number (with a
   *call back* button), party, time, allergy note, "booked by the AI
   receptionist at 14:02". Sam drags the booking from Table 2 to Table 4 to
   free Tables 2 and 3 to push together for a wheelchair user. The change is
   saved, checked (capacity, clashes), and logged on the booking.
9. **Amend by reference.** Sam rings again: "I've got a booking, reference KX4Q7,
   can we make it five?" The receptionist finds it, checks the table still fits
   (or moves it), confirms, and a new text arrives.
10. **Click and collect.** Sam orders two pizzas for collection at quarter past
    seven. The receptionist checks the kitchen has room in that slot, reads the
    order back with the total, and, because Sam chose "pay on collection",
    doesn't take a card. The ticket appears on the kitchen board with its
    collection time; the phone gets the order number.
11. **Adjust and replay.** *Edit my setup* goes back to the builder (for example
    to require deposits for groups of six); *Reset* refills the data. Sam can
    come back until the key expires.

---

## 2. Decisions to confirm

Each has a recommendation; the plan assumes it unless you say otherwise.

| # | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | Where the demo lives | `nabl.agency/demo/reception`, served by the site's Cloudflare Worker forwarding `/demo/*` (web pages and the call's WebSocket) to the demo server on Fly.io | Matches "a sub-page of the main site". The call needs a long-running server, which Workers and Netlify are not; the Worker only forwards. Fallback if forwarding WebSockets gives trouble: `demo.nabl.agency` pointed straight at Fly |
| D2 | Key format | The portal's: 12 characters from its 31-glyph alphabet, shown as `XXXX-XXXX-XXXX` (59.5 bits). Stored **hashed**, unlike the portal, because only our server checks them | One format across n.abl; hashing because we can |
| D3 | Key lifetime and limits | 14 days; 30 minutes of live calls a day; 3 workspaces; 20 menu drafts a day; extendable from the CRM | Protects the free-tier quota from a forwarded link; generous for a real evaluation |
| D4 | Where demo data lives | The voice demo Supabase project (`auivrancfnrdwyiqoakt`), `voice_` tables. The CRM stores only the key's first four characters and a usage summary | Keeps prospects' sandboxes away from client and CRM data |
| D5 | CRM | A new stage, **Demo Sent**, plus a *Send demo* action from *Ready To Contact* onwards. A demo sent as a first approach goes through the same outreach approval gates as any first contact | It is outreach, and the compliance layer applies to it |
| D6 | Menu drafting | Gemini 3.5 Flash (free tier, text) with a strict schema; generated allergens are labelled "examples: check before going live" | Already in use for summaries and setup |
| D7 | The customer's phone | Simulated texts on an on-screen phone. Optional later: send the real text to the prospect's own mobile, off by default | No SMS cost, no consent question, and it shows just as well |
| D8 | Capacity | The free tier holds about two busy calls per model at once, and on 30 September it slowed badly after heavy use. Cap concurrent demo calls at 4 with a friendly "all lines busy" message, and cost the paid tier before sending demos in volume | A prospect's first impression must not be a slow receptionist |
| D9 | Order of presets | Restaurant (with click and collect) → takeaway and fast food → barber → hair salon → estate agent → café → pub → the rest | Restaurant exercises everything; takeaway reuses most of it; barber and salon introduce staff diaries; estate agent introduces a new domain |
| D11 | Build from your website | A **scout** that reads the site with code first and a model second: plain fetching and parsing for facts, a headless browser for colours and fonts, and small Gemini Flash calls only for the menu and the gaps (section 4.7). No generated website or layout | Measured on ten real sites: a home page is 400 to 2,400 tokens, so the model part is cheap when it only sees what matters |
| D12 | When the scout runs | **Decided: only when the prospect asks.** After choosing a preset, an optional "Your website" field; the scout fetches branding and menu only if it is filled in. Nothing is fetched at key issue | The prospect chooses what we read |
| D13 | API keys | **Decided: one key for now** (`GEMINI_API_KEY`), with a key per job ready to switch on: `GEMINI_API_KEY_CALLS`, `GEMINI_API_KEY_SCOUT`, `GEMINI_API_KEY_TEXT`, each falling back to the main key. Using several free projects just to multiply one job's quota may breach Google's terms: check before relying on it | Isolation when needed, no extra setup now |
| D10 | How real the back office is | Demo-grade but genuine: persisted, validated, live-updating, and staff actions work. Not a production reservations system: no staff logins, no emails, no real payments | It must survive being poked at by a restaurateur. A workspace can later be promoted into a real pilot (section 9.4) |

---

## 3. Architecture

### 3.1 Where it runs

```
 prospect's browser
   │  https://nabl.agency/demo/reception          (pages, API, SSE)
   │  wss://nabl.agency/demo/ws/talk               (the call)
   ▼
 Cloudflare Worker (existing, worker/index.ts)
   │  /demo/*  → forwarded, unchanged, to the demo server
   │  anything else → the site, exactly as today
   ▼
 Demo server on Fly.io (London, always on)       demo-products/voice-agent
   │  serves the React app under /demo/, the API under /demo/api,
   │  the call WebSocket under /demo/ws
   ├──► Gemini Live (calls), Transcribe Live (turn-taking), Gemini Flash (menus)
   └──► Supabase auivrancfnrdwyiqoakt: voice_* tables
```

- **The Worker change is small**: one branch in the fetch handler that
  forwards `/demo/*` to `DEMO_ORIGIN` (a Worker variable), passing WebSocket
  upgrades through. Nothing else on the site changes. `test:routes` gets a
  case for it.
- **Headers**: the site blocks the microphone everywhere
  (`Permissions-Policy: microphone=()`). Forwarded responses carry the demo
  server's own headers, which allow the microphone for the demo only
  (`microphone=(self)`), with its own strict CSP. To confirm in phase 6: that
  the site's `_headers` rules do not also apply to Worker-forwarded responses.
- **Base path**: the React app builds with `base: '/demo/'`, so it works both
  behind the Worker and directly on Fly (for testing).
- **Search engines**: `X-Robots-Tag: noindex, nofollow` on every `/demo`
  response, `Disallow: /demo` in `robots.txt`, not in the sitemap.

### 3.2 Access keys and sessions

- **Issuing**: from the team console now (and a CLI), from the CRM later
  (section 9). A key records: who it is for (name, company, email), which
  products it opens (`reception` now; others later), expiry, limits, who issued
  it, the CRM lead it belongs to.
- **Storage**: `voice_demo_keys` holds a SHA-256 hash and the first four
  characters (for display and for throttling), never the key itself. The raw
  key is shown once, at issue.
- **Entering**: the page posts the key to `/demo/api/session`. On a match, the
  server sets an HttpOnly, Secure, SameSite=Strict cookie holding a signed
  session (key id, expiry). The key is not kept in the browser. The one-click
  link's `#key=…` is read by the page, sent once, and wiped from the address
  bar.
- **Throttling**: the portal's pattern: misses counted per IP and per key
  prefix; a correct key is checked first and never throttled.
- **Scope**: every API route under `/demo/api` resolves the session to a key
  and only touches workspaces that key owns. The existing team console and
  admin routes move under `/demo/admin` behind the team password.
- **Revoking**: set `revoked_at`; the next request fails and any live call is
  ended politely.

### 3.3 Workspaces: config, profile and data

A **workspace** is one demo business: a `voice_tenants` row owned by a key.

- **Config**: the builder's answers, stored as `voice_tenants.config` (JSON),
  versioned by preset (`{ preset: 'restaurant', version: 1, answers: {...} }`).
  This is what the builder reopens.
- **Profile**: compiled from the config by the preset's compiler into the
  existing `TenantProfile` the receptionist already runs on. One compiler per
  preset, pure and unit-tested. The receptionist never reads the config.
- **Seed**: *Start* runs the preset's seeder: a week of bookings, today's orders,
  a few customers and messages, generated from the config (section 4.6) and
  written in one transaction. *Reset* deletes the workspace's transactional rows
  and seeds again.
- **Slugs**: generated (`demo-k7qx-lucas-kitchen`), never shown to others.

### 3.4 Limits and abuse

| Limit | Default | Enforced where |
|---|---|---|
| Key expiry | 14 days | session check |
| Live call minutes per key per day | 30 | call start and a running meter; the call ends politely at the limit |
| Concurrent calls per key | 1 | `/demo/ws/talk` upgrade |
| Concurrent demo calls in total | 4 | same; "all lines busy" message |
| Workspaces per key | 3 | create |
| Menu drafts per key per day | 20 | `/demo/api/menu/draft` |
| Builder saves | 1 a second | API |

Usage is written to `voice_demo_usage` (key opened, preset chosen, config saved,
started, call made with minutes, bookings and orders made), which feeds the
CRM (section 9) and our own view of what prospects try.

### 3.5 Data and privacy

- Prospects' names and emails on keys: business contact data under the
  existing legitimate-interest assessment (`business/07-crm/lia-2026-08-v2.md`);
  the privacy policy's section for people we approach already covers it. To
  check with `04-legal` before the first key goes out.
- What prospects type into the builder is their business's public-facing
  information. What they say on calls goes to Gemini's free tier, which may use
  it; the workspace says so on the call panel ("Don't use real customers'
  details").
- Retention: workspaces and usage deleted 30 days after the key expires, by a
  scheduled job. Call audio is never stored.

---

## 4. The restaurant preset, in full

### 4.1 The builder: every step and field

Each field says what it changes. Defaults in brackets. The preview pane
shows the greeting, the floor plan and a sample conversation line as fields
change.

**Step 1. Basics**

| Field | Options / default | Changes |
|---|---|---|
| Restaurant name | text (required) | greeting, texts, everything |
| Style or cuisine | text, e.g. "Neapolitan pizza and fresh pasta" | menu draft, greeting tone, FAQ draft |
| Town and address | text; fictional is fine | directions answers, delivery area default |
| Phone number shown | [a 01632 drama-range number] | texts, "call us" lines |
| Voice and greeting | the existing settings: 30 voices with preview; greeting drafted from name and style, must say AI and demo | the call |
| Opening hours | per day: closed, or one or two services. [Tue–Sat lunch 12:00–14:30, dinner 17:30–22:00; Sun 12:00–20:00; Mon closed] | availability, "are you open?" |
| Last booking before close | [60 min] | booking windows |
| Closures | dates, with reason | availability, answers |

**Step 2. How you serve** (any combination)

| Service | Default | Sub-questions |
|---|---|---|
| Table reservations | on | steps 3 and 4 appear |
| Walk-ins | on | "Do you keep tables back for walk-ins?" [yes, 20%]: the seeder leaves them free, the agent says so |
| Click and collect | on | collection hours [same as dinner], prep time [20 min], collection slot every [15 min], orders per slot [6], "earliest collection" rule |
| Delivery (own drivers) | off | postcode districts, fee [£2.50], minimum [£15], extra time [20 min] |
| Delivery apps | off | "We're on Deliveroo / Uber Eats / Just Eat": FAQ only, no ordering |

**Step 3. Seating** (if reservations)

| Field | Options / default |
|---|---|
| Areas | Indoor [on], Outdoor terrace [on], Bar / counter [off], Private dining room [off], plus custom areas with a name |
| Per area: reservable | [yes]; Private room: [enquiry only, callback] |
| Per area: tables | counts by size: 2-tops, 4-tops, 6-tops, 8-tops [Indoor: 4×2, 5×4, 2×6; Terrace: 4×4] |
| Per area: features | window, booth, quiet corner, heated, covered, dog-friendly, step-free |
| Outdoor weather rule | [bookable; moved inside if it rains] / bookable at own risk / walk-in only / seasonal (dates) |
| Accessible tables | which tables are step-free with room for a wheelchair [2 indoor] |
| Tables that push together | pairs or groups [adjacent 2-tops and 4-tops, auto-suggested from the floor plan] |
| Sitting length | by party size [up to 2: 75 min; up to 4: 90; up to 8: 120] |
| Largest party by phone | [8]; above that: [take details for a callback] |
| Booking notice and horizon | [30 min ahead; up to 60 days out] |
| Highchairs | [3] |
| Buffer between sittings | [0 min] |

**Step 4. Floor plan**

- Generated from step 3: each area is a labelled zone; tables are placed on a
  grid by size, round for 2-tops, square for 4-tops, long for 6 and 8.
- Drag to arrange, rotate, rename ("Table 12"), mark features and
  accessibility, link tables that push together (drawn as a dashed join).
- Stored as positions on the table resources (section 5). The same drawing is
  the back office's floor plan, so what Sam arranges here is what Sam sees
  later.
- Guard rails: no overlapping tables; every table in an area; seats counted
  per area and shown ("Indoor: 42 covers").

**Step 5. Menu**

- *Describe your food*: a text box ("Wood-fired Neapolitan pizza, about ten,
  fresh pasta, a few starters, tiramisu, Italian wines; mid-priced; good vegan
  options"), plus price level and roughly how many dishes.
- The server drafts a structured menu (categories, dishes, prices in pounds,
  descriptions, allergens from the UK 14, may-contain, dietary tags, options
  such as size or extra toppings with prices, which dishes are available for
  takeaway) against a strict schema, then validates it (prices sane, keys
  unique, allergens from the list).
- Sam edits in a table: rename, reprice, delete, add, move between categories,
  toggle allergens, mark "not for takeaway", add a kids' menu or a set menu.
- Alternatives: *Import from my website* (the existing ingest), or *Start from
  a sample menu* for the cuisine.
- The allergen statement is drafted ("Our kitchen handles all 14 allergens…")
  and editable. Generated allergens carry a visible "examples" label.

**Step 6. Money**

| Field | Options / default | Agent behaviour |
|---|---|---|
| Table deposits | none / £X per person for parties of N+ / £X per booking / card to secure, no charge [£10 a head for 6+] | after booking, offers the demo card or "we'll text you a link" (simulated) |
| Cancellation policy | text [48 hours' notice or the deposit is kept] | read out when a deposit is taken |
| Takeaway payment | pay on the phone / pay on collection / either [either] | takes the demo card, or tells the caller to pay on collection |
| Delivery payment | pay on the phone [required] / cash or card on delivery | same |
| Service charge | text [12.5% for tables of 6+] | FAQ |

**Step 7. Policies and questions**

Toggles with short editable text, each becoming a fact the agent can use:
children and highchairs, dogs (inside / terrace only / no), accessibility
(step-free entrance, accessible toilet), parking, dress code, corkage and BYO,
birthday cakes, gift vouchers, gluten-free and vegan options. Then *Draft
common questions*: the model proposes ten Q&As from everything above, which Sam
keeps, edits or deletes.

**Review.** A one-page summary, a list of anything still missing, and
**Start my demo**.

### 4.2 What the receptionist does differently

| When | It | Driven by |
|---|---|---|
| Both areas are reservable and the terrace is open at that time | asks "inside or on the terrace?" once date, time and party are known; if the preferred area is full, offers the other area or the nearest time | areas, availability by area |
| Terrace chosen | mentions the weather rule in one short sentence | outdoor weather rule |
| "By the window", "a booth", "somewhere quiet" | matches a table with that feature; if none is free, books and notes the request | table features |
| Wheelchair, step-free, pram | allocates an accessible table, or a pushed-together pair that is; notes it | accessible tables, combines |
| Highchairs | notes how many; warns if more than available | highchair count |
| Allergies | asks what and how severe; records them in the booking's allergy field, which the floor plan flags | booking allergy field |
| Birthday or occasion | records a tag; answers the cake policy | policies |
| Party above the phone limit, or the private room | takes name, number, date and details for a callback | largest party, area rules |
| Deposit due | books first, then offers the demo card; if declined, the booking stands and a payment link is "sent" | money step |
| "I've got a booking, reference KX4Q7" | finds it; can change date, time, party size, area or notes, re-checking the table; cancels on request. New text each time | existing tools, extended with area |
| Click and collect | takes the order, then the time: earliest is now plus prep time, only slots with kitchen room are offered, and it reads back items, total and time | collection slots, orders per slot |
| Paying for takeaway | follows the payment rule: card now, or "pay when you collect" | takeaway payment |
| Walk-in questions | "We keep some tables for walk-ins, so do pop by" | walk-in setting |

Every text ends with the reference and "to change it, call us and quote your
reference", so the amend-by-reference flow is discoverable from the phone
mockup.

### 4.3 The back office

**The floor plan board** (the centrepiece)

- Header: date, service (Lunch / Dinner), a time slider with a "now" line, and
  the service's numbers (covers booked, tables free, arriving next half hour,
  takeaway orders due).
- The plan, drawn as SVG from the builder's layout. Each table shows its
  number and seats, and its state at the chosen time: free, booked later,
  arriving within 30 minutes, seated, running over. Badges: allergy, access,
  highchair, birthday, deposit paid or due.
- A booking made on a call flashes on its table as it lands.
- **Click a table** to open the booking drawer: name, phone with *call back*
  (copies the number; later it can place a demo call back), party, times,
  area and table, allergy and notes, tags, deposit, source ("AI receptionist,
  call at 14:02, listen to transcript"), and the booking's history.
- **Actions**: move to another table (drag the booking onto it, or choose from a
  list of tables that fit and are free); push two tables together for this
  booking; mark arrived, seated, finished or no-show; edit notes; cancel (with
  the customer text). Every action is validated on the server (capacity,
  clashes, opening hours), saved, logged on the booking, and pushed to every
  open view.

**The timeline** (second tab): one row per table and time across the service, a
bar per booking. Drag a bar to another table or time. It is the classic
reservations grid, and the quickest way to see a clash.

**The kitchen board** (third tab): takeaway tickets in columns: New, Preparing,
Ready, Collected. Each shows the collection time with a countdown, items and
options, allergy notes in red, paid or pay-on-collection. Drag across columns;
moving to Ready sends the "your order is ready" text.

**Messages**: callback requests and messages the receptionist took, with *mark
done*.

**Calls**: each call's summary, outcome, reply times and full transcript.

### 4.4 The customer's phone

A phone frame beside the back office showing the SMS thread for the caller's
number. On a browser call the caller's number is one the prospect types once
(any UK mobile format; never texted in the demo) or the default drama-range
number. Texts appear the moment they are "sent": booking confirmed, changed,
cancelled, deposit link and receipt, order confirmed with collection time,
order ready. Each shows the business name as the sender and a timestamp.

### 4.5 Seating logic changes (engine)

- **Areas**: resources get an `area`; `check_availability` takes an optional area
  and returns per-area options; allocation prefers the requested area, then
  features, then the smallest table that fits (existing rule), then combined
  tables.
- **Accessibility and features**: a request becomes a hard filter (accessible)
  or a preference (window, booth, quiet).
- **Staff moves**: a new repository call reassigns a booking's table, with the
  same clash check as bookings made on calls. A combined pair is represented
  as the existing `combines` resource, so a staff "push together" picks or
  creates it.
- **Visit state**: arrived, seated, finished, no-show, separate from the booking
  status (confirmed or cancelled), so the agent's logic is untouched.
- **Collection slots**: orders get a slot; capacity per slot comes from the
  config; the agent is offered only slots with room.

### 4.6 The dummy data

Generated from the config, so every workspace looks like its own business.

- **Bookings for seven days**, per service, filling to a target that varies by
  day and service (Friday and Saturday dinner about 80% of covers, weekday
  lunch about 30%, Sunday lunch about 70%), leaving the walk-in share free,
  respecting sitting lengths, areas (the terrace lighter), largest party and
  opening hours. Today's earlier bookings are marked seated or finished, one is
  a no-show.
- **Details that make it believable**: invented British names; phone numbers
  from Ofcom's drama range (07700 900xxx); about 10% with allergies (coeliac,
  nut, dairy, shellfish), 5% birthdays or anniversaries, 3% needing step-free
  access, some highchairs, a few regulars (repeat customers), a large party on
  pushed-together tables, deposits paid on the big groups.
- **Takeaway today**: 8 to 12 orders from the real menu, spread across collection
  slots before and after "now", in the right kitchen columns.
- **Messages**: two callback requests (a private dining enquiry, a lost
  umbrella).
- Stored with `source = 'seed'`, so it can be told apart and reset. Every seeded
  row passes the same validation as a real booking.

### 4.7 Build from your website: the scout

*Start from my website* is the builder's first choice beside *Start from
scratch*. It fills the builder, not the demo: every field it sets is marked
"from your website" or "we guessed, please check", and the prospect still
presses Start.

**What ten real restaurant sites looked like** (measured 30 September; token
counts from Gemini's count endpoint, which uses no quota):

| Finding | Detail | What the scout does about it |
|---|---|---|
| 2 in 10 could not be read | one answered with a bot check, one refused (403) | says so plainly and offers *Start from scratch*, pre-filled with whatever the CRM knows |
| 2 in 10 were a different business | `hawksmoor.com` is a guest house; `iberico.co.uk` sells fruit | always asks "Is this you?" with the name, logo and address it found. The CRM's verified website avoids most of this |
| Pages are small | home page 370 to 2,433 tokens, menu page 76 to 3,409 | the model sees a digest and the menu, never the whole site |
| Business details in structured data are rare | 3 in 8 named the business; only one (WordPress, with an SEO plugin) gave phone, address and hours | reads structured data first, then patterns (UK phone, postcode, hours), then asks the model only for what is still missing |
| Menus rarely carry prices as text | 1 in 6 menu pages had £ prices; the rest keep them in PDFs, images or scripts | reads PDFs (the model takes PDFs directly), renders script-built pages, and leaves prices blank with a clear "add your prices" rather than inventing them |
| Colours from the raw code are unreliable | right on 4 sites; on Wix and WordPress themes the loudest colours belonged to the site builder, not the brand | reads the colours the rendered page actually uses (section below) |
| Fonts are often licensed | Futura, Gotham, bespoke brand fonts; Google Fonts on 3 sites | uses the same Google Font where it is one, otherwise the nearest free match (a small lookup table), never their font files |
| Providers are easy to spot | SevenRooms twice, OpenTable, Deliveroo | switches services on (reservations, delivery apps) and says who they use |

**The stages**

1. **Fetch** (no model). A polite crawler: `robots.txt` respected, an honest
   user agent, one request a second, the home page plus up to twelve pages
   picked from the sitemap and links (menu, food, drink, book, visit, contact,
   about, FAQ, allergens, takeaway, private dining), PDFs linked as menus, a
   5 MB cap. The existing `assertPublicUrl` guard stays, so it cannot be
   pointed at our own network.
2. **Render** (no model). The home page and any script-built menu page open in
   headless Chromium (already on the server image for testing). From the
   rendered page it reads computed styles: header, navigation and footer
   backgrounds, the main button's fill and text, link colour, heading and
   body fonts; the logo element (cropped from a screenshot, or its image);
   and the text of script-built pages. One render at a time, in a queue, about
   five seconds each.
3. **Extract** (no model). Structured data (Restaurant, LocalBusiness,
   openingHoursSpecification, servesCuisine, hasMenu, acceptsReservations),
   meta tags, UK phone numbers and postcodes, hours in common written forms,
   booking and ordering providers (OpenTable, ResDiary, SevenRooms,
   DesignMyNight, Tablein, Deliveroo, Uber Eats, Just Eat, Slerp, Flipdish and
   others), and seating and policy signals ("terrace", "beer garden",
   "private dining", "dog friendly", "step-free", "gluten free", "vegan").
   Menu pages are ranked by price density, URL and title.
4. **Model** (small, targeted, Gemini 3.5 Flash or Flash-Lite, structured
   output):
   - *Facts*: a digest of at most about 4,000 tokens (structured data, the
     signals and the sentences around them) → style or cuisine line, summary,
     policies, and FAQs, filling only fields stages 1 to 3 left empty.
   - *Menu*: the best menu page's text (split if over about 8,000 tokens) or
     its PDF → categories, dishes, descriptions, dietary tags, prices only
     where stated, allergens only where stated (otherwise "not on your site,
     please tick").
   - *Optional*, off by default: one screenshot to the model to name the look
     ("deep green and cream, hand-drawn type"), only if the computed colours
     are ambiguous.
5. **Map** to the restaurant builder's answers, each with its source, and to a
   **theme**: primary, accent and background colours from the computed styles,
   corrected for contrast (WCAG AA), the font pair, the logo, and the social
   sharing image as the workspace header. The workspace, the floor plan's
   accents and the texts' sender name take on their brand. Nothing more
   generative than that: no rebuilt pages, no invented imagery.
6. **Cache**. Pages and results are kept per site for 14 days
   (`voice_site_pages`, `voice_site_scans`: text and extracted signals, not raw
   HTML; logos as small images). A second scan in that window costs nothing,
   so the team can scan before issuing a key and the prospect's builder opens
   instantly.

**Cost per website, free tier**: 2 to 4 model requests and roughly 8,000 to
20,000 tokens (a digest and a menu; more if the menu is a long PDF). The
limit that bites on the free tier is requests per day, not tokens: divide the
daily request limit for Flash or Flash-Lite shown in AI Studio by about four
to get websites per day per key. Rendering costs server time, not quota.

**What it will not do**: get past bot protection, read prices that are only in
photographs unless the optional image step is on, or guess table counts (sites
almost never state them; the builder's defaults stand, and "covers" mentions
set the total where given).

### 4.8 Definition of done for the restaurant

A prospect with a key can, from an empty workspace and in under ten minutes:
build their restaurant using the defaults or their own answers; press Start
and see a full floor plan; ring the receptionist and book a terrace table for
four with an allergy, and watch it land flagged; move it to another table;
ring again and change it by reference; order click and collect for a chosen
slot paying on collection and see the ticket on the kitchen board; and read
every text on the customer's phone. All of it on `nabl.agency/demo/reception`
from a key issued in the team console.

---

## 5. Data model changes

One migration, `voice_0002_demo.sql`, `voice_` prefix only, applied to
`auivrancfnrdwyiqoakt` through the connector and recorded in
`voice_schema_migrations`. RLS on for every new table, with no policies (the
server connects as the owner).

| Change | Detail |
|---|---|
| `voice_demo_keys` (new) | id, key_hash (unique), key_prefix, person_name, company, email, products (text[]), crm_lead_id (text, the other project's id), issued_by, created_at, expires_at, revoked_at, last_used_at, limits (jsonb), notes |
| `voice_demo_usage` (new) | id, key_id, tenant_id, at, kind (opened, preset_chosen, config_saved, started, call, booking, order, menu_draft), data (jsonb) |
| `voice_demo_attempts` (new) | the throttle: at, ip_hash, key_prefix, ok |
| `voice_site_pages` (new) | the scout's page cache: url, site, fetched_at, status, kind (html, pdf, rendered), text, signals (jsonb), content hash |
| `voice_site_scans` (new) | one per site and run: site, started_at, finished_at, result (jsonb: facts, menu, theme, sources), tokens used, requests, errors, reviewed_by |
| `voice_tenants` | add owner_key_id (null for our own demo businesses), config (jsonb), preset (text), expires_at |
| `voice_bookings` | add visit_status (expected, arrived, seated, finished, no_show), allergies (text), tags (text[]), history (jsonb). The status check stays as it is |
| `voice_orders` | add collect_slot (timestamptz); kitchen columns use the existing status values (confirmed, in_kitchen, ready, completed) |
| `voice_call_events` | no schema change; demo events use the existing `system` kind |

Profile additions (JSON, no migration): `booking.areas[]` (key, label,
reservable, outdoor, weather_rule, enquiry_only), and on each resource `area`,
`x`, `y`, `w`, `h`, `rotation`, `shape`, `accessible`, `features[]`;
`ordering.slot_minutes`, `ordering.slot_capacity`, `ordering.payment`;
`booking.deposit_policy` text; `highchairs`; `walk_in_share`.

---

## 6. The API (all under `/demo/api`, session required unless noted)

| Method and path | Does |
|---|---|
| `POST /session` (open) | key in, session cookie out; throttled |
| `GET /me` | who the key is for, expiry, limits used today |
| `GET /presets` | the preset list and each one's builder schema |
| `GET /workspaces`, `POST /workspaces` | list and create (preset chosen) |
| `GET /workspaces/:id/config`, `PUT …/config` | load and save builder answers (validated per preset) |
| `POST /workspaces/:id/start` | compile the profile, seed the data, return the workspace |
| `POST /workspaces/:id/reset` | reseed |
| `POST /menu/draft` | describe → structured menu; counted against the limit |
| `POST /faq/draft` | config → suggested Q&As |
| `GET /workspaces/:id/state` | floor plan, bookings for a date, orders, messages, calls |
| `GET /workspaces/:id/events` | server-sent events (existing) |
| `PATCH /workspaces/:id/bookings/:ref` | move table, combine, visit status, notes, cancel |
| `PATCH /workspaces/:id/orders/:ref` | kitchen status |
| `GET /workspaces/:id/phone?number=` | the customer's text thread |
| `WS /demo/ws/talk?workspace=` | the call (existing channel, now scoped to the session) |
| `/demo/admin/*` (team password) | issue and revoke keys, see usage, the existing console |

---

## 7. The front end

The existing React app gains routes, all under `/demo/`:

| Route | Page |
|---|---|
| `/demo/reception` | key entry and welcome |
| `/demo/reception/new` | preset grid |
| `/demo/reception/build/:workspace` | the builder: step navigation, schema-driven forms, live preview |
| `/demo/reception/live/:workspace` | the workspace: call, back office (floor plan, timeline, kitchen, messages, calls), customer's phone |
| `/demo/admin` | the existing console and board, plus keys |

- **Schema-driven builder**: each preset declares its steps and fields (types:
  text, hours grid, toggles, counts, table editor, floor plan, menu editor), so
  a new preset is mostly data plus its compiler and seeder.
- **Floor plan**: SVG with pointer events for drag, snap-to-grid and rotate; the
  same component renders the builder editor and the live board (read-only
  layout, draggable bookings). No new dependency needed.
- **Timeline**: CSS grid with draggable bars.
- **Phone mockup**: CSS only.
- Design follows the existing tokens (espresso, cream, amber) with each
  business's accent colour, which the builder lets the prospect choose.

---

## 8. The other presets

Each preset brings: its builder steps, a compiler to the profile, a seeder, any
engine additions, and its back-office view. The call panel, the phone mockup
and the framework are shared.

| Preset | What gets booked | Resources | Catalogue | Orders | Money | Back office | Receptionist's signature moments |
|---|---|---|---|---|---|---|---|
| **Restaurant** (first) | tables | tables in areas | menu | click and collect, delivery | deposits, takeaway payment | floor plan, timeline, kitchen board | inside or out, allergies, amend by reference, collection slots |
| **Takeaway and fast food** | none | kitchen slots | menu with sizes, meal deals, extras | collection, delivery | pay now or on collection | kitchen board, driver list | upsells the meal deal, postcode check, busy-time quotes |
| **Barber** | appointments | barbers | cuts with durations and prices | none | optional deposit, no-show fee | a column per barber | "any barber" or a named one, walk-in queue answer |
| **Hair salon** | appointments, often two parts (colour, then cut) | stylists by level | services priced by stylist level | none | deposits on colour | a column per stylist | patch test 48 hours before colour, processing gaps |
| **Estate agent** | viewings and valuations | negotiators, properties | property list: price, beds, area, status | none | none | viewings calendar, property board | qualifies the buyer (mortgage in principle, chain, budget), books the viewing, captures valuation leads |
| **Café and coffee shop** | small tables (optional) | tables | drinks with sizes and milks, food | pre-order collection, office catering | none or card for catering | order board | oat milk and extra shots, catering order for Friday |
| **Pub and bar** | tables, beer garden, function room | tables in areas | food menu, events (quiz, live sport) | none | deposits for groups | floor plan | "Is the match on?", function room enquiries |
| **Beauty and nails** | appointments | therapists, rooms | treatments | none | deposits | columns | treatment lengths, aftercare questions |
| **Spa and massage** | appointments needing a therapist and a room | therapists, rooms | treatments, packages | none | prepaid packages | room grid | couples' treatments, arrival time |
| **Hotel and B&B** | room nights | rooms by type | room types and rates | none | deposit or prepay | room grid by night | dates, check-in times, dogs, parking |
| **Letting agent** | viewings; repair reports | negotiators, properties | rentals | none | holding deposit | viewings, repair log | referencing questions, emergency repair triage |
| **Gym and personal training** | classes, PT sessions | trainers, class places | timetable | none | membership questions | class timetable | trial class, class full |
| **Dog grooming** | appointments by dog size and coat | groomers | services by size | none | deposit | columns | breed changes the duration |
| **Garage and MOT** | appointments in bays | bays, mechanics | MOT, service, repairs | none | none | bay diary | registration, drop-off and pick-up |

Engine work the later presets need, not the restaurant: appointments needing two
resources at once (therapist and room); multi-part appointments with gaps
(salon colour); room-night stays (hotel); a property catalogue and viewings
(estate and letting agents).

---

## 9. The CRM link

### 9.1 In the CRM (site project, `rrkcoqopcqtowbyismcq`)

- **Stage**: add `Demo Sent` between `Replied` and `Meeting Scheduled`. Following
  `business/07-crm/pipeline-stages.md` §2, that is four edits in one commit: the
  `CHECK` constraint migration, `STAGES`, the `AFTER_CONTACT` and `REPLIED_ON`
  groupings (it belongs in `AFTER_CONTACT`), and a badge colour.
- **Action**: *Send demo* on a lead from `Ready To Contact` onwards: choose the
  product (Reception now; the chat assistant and others as their demos exist),
  expiry and the person. It issues the key, shows the link and key once, fills
  the email or letter template, and moves the lead to `Demo Sent`.
- **Compliance**: a demo sent as a first approach is a first contact and goes
  through the existing outreach approval gates and the compliance gate
  (`marketing_tier`, channel rules). The action refuses a lead whose tier
  forbids the channel, the same way the Compliance tab refuses an invalid
  combination today.
- **New columns on `sales_leads`**: demo_product, demo_key_prefix,
  demo_expires_at, demo_first_opened_at, demo_last_used_at, demo_summary
  (jsonb: preset, business name, minutes, calls, bookings, orders).

### 9.2 How the two projects talk

A Supabase edge function in the site project, `demo-keys`, holds a shared
secret for the demo server. The CRM (signed-in team member) calls the function;
it checks the caller is on the team, asks the demo server's admin API to issue
a key, stores the prefix and expiry on the lead, and returns the key once. The
demo server posts usage back to a second function, `demo-usage`, which updates
`demo_summary` and the timestamps. No CRM data reaches the demo project beyond
the lead id.

### 9.3 What the team sees

On the lead: product, key prefix, expiry, first opened, last used, what they
built ("Restaurant: Lucas Kitchen, indoor and terrace, click and collect"),
minutes of calls, bookings and orders made, with *extend*, *revoke* and *resend*.
A lead opening its demo for the first time is a strong signal and should
notify the owner; how (email or the team space) is decided in the outreach
folder.

### 9.4 From demo to product

Because a workspace is a real profile plus config, *Promote to pilot* can copy
it into a live tenant (status `pilot`), attach a phone number and drop the demo
limits. That is the start of delivery for a Reception client, and the same
framework will carry the other AI products' demos: the access keys, sessions,
usage and CRM link are product-neutral from the start (the key's `products`
column).

---

## 10. Phases

Each phase ends with its tests passing, a live check where it touches Gemini,
a commit to `voice-agent-DEV`, and the plan's status updated.

Where it stands (30 September 2026):

| Phase | State | Notes |
|---|---|---|
| 1 | **Done** | Keys hashed, throttle trusts the Worker's address only with its shared secret; migration `voice_0002_demo` applied to `auivrancfnrdwyiqoakt`. 11 HTTP tests. `npm run demo:key` issues keys. |
| 2 | **Done** | Nine steps (the seven, plus the floor plan and review), autosave, live preview, SVG floor plan editor (drag, keys, no overlaps), AI menu and FAQ drafts on the text key. |
| 2b | **Done** | Tested on a local fake site (politeness, private addresses, bot wall, cache, "Is this you?", apply) and on one real site with the real model: 48 priced dishes from its menu page in 32 s, two requests. Not yet the scored 20-site run. Render works; in the build sandbox Chromium cannot pass the TLS proxy, so live renders were checked locally only, and the stylesheet fallback on the real site. |
| 3 | **Done** | Property tests over the defaults and 20 varied configs. |
| 4 | **Done** | Floor plan board with time slider and states, drag a booking between tables, drawer (visit states, move, push together, details, cancel with a text), timeline with drag, kitchen board with the ready text, messages, calls, the customer's phone. Chromium walkthrough (`npm run e2e:demo`). |
| 5 | **Done** | Areas ("inside or on the terrace?"), weather rule, step-free tables, preferences, allergies (with a once-per-call safety net if the caller mentioned one), occasions, highchairs, change by reference keeping the table, collection slots with kitchen capacity, the takeaway payment rule, texts that end "quote your reference". 7 tool tests; 5 new evaluation scenarios on a builder-made restaurant, all passing against the live model (cancel by reference, full terrace and full slot are covered by tool tests rather than scenarios). |
| 6 | **Built, not deployed** | Worker forwards `/demo/*` including WebSockets (27/27 in `test:routes` against the real Workers runtime); robots; Dockerfile with Chromium; fly.toml at 1 GB. Needs: the Fly app deployed with its secrets, `DEMO_PROXY_SECRET` set on both sides, then a live smoke test from a phone. The retention job is not built yet. |
| 7 | Not started | |
| 8 | Not started | |

| Phase | Builds | Done when | Tested by |
|---|---|---|---|
| **1. Access and workspaces** | migration `voice_0002_demo`; keys (issue, hash, revoke, throttle); sessions; workspace ownership and scoping; base path `/demo/`; noindex; admin key page | a key opens its own empty workspace list and nothing else; a bad key is throttled; admin can issue and revoke | unit tests on keys and scoping; e2e: key entry, wrong key, expired key, revoked mid-session |
| **2. Restaurant builder** | preset framework; the seven steps; floor plan editor; menu drafting and editor; money; policies and FAQ drafting; compiler to profile; review | the defaults alone produce a valid restaurant, and every field changes what it claims to | compiler unit tests (every field); menu draft schema validation; builder e2e in Chromium |
| **2b. The scout** | fetch, render, extract, model, map, cache (4.7); "Is this you?"; per-field sources; theme from brand | on a fixed set of 20 real restaurant sites: readable ones yield name, contact and hours where stated, a menu where one exists, and a theme a person judges on-brand; unreadable ones fail politely | extractor unit tests on saved pages; a scored run over the 20 sites, repeated when prompts change |
| **3. Seeder** | seven days of bookings, today's orders, customers, messages, from the config | 20 random configs each seed with no clashes, within hours and areas, near target occupancy | property-style tests over generated configs |
| **4. Back office and phone** | floor plan board, time slider, drawer and actions, timeline, kitchen board, messages, calls, customer's phone | a restaurateur can do every action in 4.3 and see it persist and propagate | API tests for every action and its validation; e2e: drag a booking, push tables together, move a ticket to Ready and see the text |
| **5. Receptionist behaviours** | areas and preferences, accessibility, allergies, occasions, deposits by policy, amend by reference with area, collection slots with capacity, takeaway payment rule, texts with reference | the walk-through in section 1 works end to end by voice | 8 new evaluation scenarios (terrace booking, full terrace offers inside, wheelchair, allergy recorded, amend by reference, cancel by reference, collection slot full, pay on collection); `e2e:turns`-style live run |
| **6. Hosting** | Fly deploy on Supabase; Worker forwarding `/demo/*` including WebSockets; headers; robots; retention job | `nabl.agency/demo/reception` works from a phone and a laptop with a real key | live smoke test script; `test:routes`; header checks |
| **7. CRM link** | `Demo Sent` stage (four edits); *Send demo*; edge functions; usage feedback; lead panel | issuing, sending, opening and usage all show on the lead | CRM tests; compliance gate refusal test |
| **8. Next presets** | takeaway and fast food, then barber, hair salon, estate agent, and on through section 8 | each preset meets its own version of 4.8 | per preset: compiler, seeder and evaluation scenarios |

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Free-tier Gemini is slow or stops listening under load (seen on 30 September) | cap concurrent calls; the watchdog and turn replay already recover; cost the paid tier before volume |
| A forwarded link burns quota | per-key daily minutes, expiry, revocation, concurrency of one |
| The scout reads the wrong business, or misreads a menu | "Is this you?" before anything is used; every field shows its source; scans for issued keys are checked by the team first |
| Scraping a prospect's site | only public pages, `robots.txt` respected, identified user agent, one request a second, cached so it is read once |
| Generated menus carry wrong allergens | labelled as examples; the agent's allergy wording always carries the caveat; editable |
| The Worker does not forward WebSockets as expected | test in phase 6 first thing; fallback `demo.nabl.agency` |
| The site's microphone ban applies to forwarded pages | check in phase 6; the Worker can rewrite that one header for `/demo/*` |
| Prospects enter real customers' details | notice on the call panel; retention job; no audio stored |
| A preset feels generic | the builder's cuisine or style text drives menu, greeting and FAQs; the accent colour and floor plan are theirs |
| Sending demos breaks outreach compliance | the CRM action runs through the same gates; no automated sending |

## 12. Not in this plan

Staff logins and roles inside a workspace; real card payments; real SMS or
email to diners; integrations with real reservation systems (OpenTable,
ResDiary) or tills; multi-site groups; languages other than English for the
builder (the receptionist can already follow the caller's language).
