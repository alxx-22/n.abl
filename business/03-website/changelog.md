# Website changelog

What has changed on the public site, newest first. Commit hashes are from this
repository, so any entry can be read in full with `git show <hash>`.

## 2026-11-26 · The rest of the site in the 2026-11 brand (on `claude/modest-wright-2zlwat`)

- **One rule for the ground (`ground/story.js`):** the wisps seen bare, the
  soft blurred light, belong to the homepage's opening alone. Everywhere
  else the ground is the fluted glass (the light seen through its reeds) or
  the aurora on its own. On the homepage the glass now arrives as the hero
  is left, and the stretch from the prices to the close is the aurora.
  Other services opens on the glass and ends in the aurora; the legal
  pages and the client portal are the aurora, its curtain high behind the
  title; the discovery call's left pane shows the aurora drawing
  (`assets/aurora.svg`) instead of blurred light.

- **Other services (`pages/Services.jsx`):** the page tells its own story on
  the lit ground, in the homepage's order (`ground/story.js`,
  `servicesKeyframes`): the opening, warmth while the problems are read, the
  fluted glass for what we build (one layout of light per capability), the
  aurora for the examples, the quiet close. It used to hold the opening light
  behind every section. The three grey wireframe animations are replaced by
  scenes in the products' glass language (`film/cards.js`: `automate`,
  `analyse`, `booking`): a morning sync between three systems, three sheets
  that disagree made into one set of numbers, and a booking taken, paid for
  and put in the diary. Each is drawn small behind its problem card and
  large in its capability row, where it floats over the light unframed. The
  capability names are set in Thin; Manjari has no 600.
- **Legal pages (`pages/Legal.jsx`):** in the site's nav and footer over the
  quiet ground (`quietKeyframes`), the title in Thin, the three documents one
  step apart as chips, a contents list on a desk that marks the section
  being read, sections numbered between hairlines, and the draft notice as
  ember glass, the brand's mark for what must not be missed.
- **Client portal (`pages/Portal.jsx`, `styles/portal.css`):** the sign-in is
  the featured glass card with the trio line, the key in the mono face it is
  reserved for, and the frosted main button. The dashboard sits on the quiet
  ground under a glass bar, opens with four tiles at a glance (quotes waiting
  for review, projects being built, the next meeting, files), and shows each
  record's state as a brand chip: ember for what waits on the client, ice for
  live and done, amber for what n.abl has arranged. Prices, days and counts
  are in Thin; progress fills warm to cool; typed arrows are drawn.
- **Book a discovery call (`DiscoveryModal.jsx`):** two panes on a desk, the
  reason to book beside the form with the three lights low in its glass, the
  fields paired so it fits without scrolling; stacked on a phone. The close
  is drawn, and the sent state's tick is ice. The call length is now one
  constant (`CALL_MINUTES`), which `scripts/build-knowledge.mjs` checks the
  assistant's knowledge file against.

## 2026-11-25 · The 2026-11 brand, and a chapter for each product (on `claude/modest-wright-2zlwat`)

The brand moved to Manjari and the ember, amber and ice colourway
(`../02-brand/brand-guidelines.md`), and the homepage's middle was rebuilt
around the products.

- **Look:** Manjari throughout, the lit ground behind the page
  (`src/components/ground`), glass buttons and cards, problem, fix and result
  in ember, amber and ice. A new social card, drawn from the site's own ground.
- **What it can do, one chapter per product (`sections/Products.jsx`):** the
  See it work film and the grid of seven solution cards are replaced by one
  chapter for each of the seven products. The words on one side; on the
  other, the product's own scene (the card scenes from
  `src/components/film/cards.js`), pinned and played by the scroll, leaning
  towards the pointer. Between products the scene folds into the amber
  square, which carries the light down to the next one, across the page when
  the next one sits on the other side. Reduced motion gets each product's
  outcome as a still beside its words.
- **The scenes' interface is the brand's own (`src/styles/film.css`, THE
  PIECES):** every window, row, chip and button in the product and How we
  work scenes is now a brand component rather than the reel's dark cards
  recoloured. Glass panels with the trio line, Manjari Regular with Thin
  for big numbers and spoken lines, labels in tracked capitals, line icons
  in hairline circles, rows between hairlines, chips with the brand's
  markers (the breathing ice dot for the AI at work, the amber square for
  n.abl, the ember square for the problem and anything waiting on a
  person), frosted main buttons with the three lights inside, and
  documents as frosted glass. n.abl is marked with its square rather than
  a generic sparkle, and the typed ticks and arrows are drawn.
- **The assistant's mark (`src/components/AssistantMark.jsx`):** the flat
  amber sparkle on the Ask a question launcher (and the portal's) is
  replaced by a small sphere of dark glass with the brand's three lights
  inside it and a white spark at its centre. Its lights turn once as the
  launcher arrives and for as long as the pointer is on it; open, the spark
  turns to a cross.
- **The ring on the main buttons (`global.css`, THE RING):** under the
  pointer, Ask a question and the Book a discovery call buttons are now
  circled from outside by a ring of the brand gradient, with an arc of
  light running round it and a glow, in place of an edge that was easy to
  miss. The main button no longer clips its contents to make room for it;
  its inner light is clipped to the glass instead.
- **How we work, the five cards (`sections/Process.jsx`, `home.css` Steps):**
  in the brand's card language: the step number in Thin, the step's line
  icon in a hairline circle, and at the foot what the card turns over to
  show, with the amber square and a drawn arrow. A line runs along the top
  of the five, ember at the first step to ice at the last, and holds still
  while a card turns over to its scene. Turned over, a card shows its step
  in front of the aurora, drawn as the lit ground draws it
  (`src/assets/aurora.svg`): a wavy hem of warm light, ember into amber
  and cream, a haze with faint rays rising from it, dark below. Each card
  shows a different stretch of it, the later steps a little cooler, and it
  drifts while the card is open.
- **Firmer glass in every scene:** the scenes cannot blur what is behind
  them, so their glass is now tinted deeper (espresso at 0.84, the pills,
  chips and documents to match) to read as frosted rather than clear.
- **Room between the words and the animations:** on a desk the text column
  and the animation's box added up to more than the page's width and
  overlapped by about 32px. The text is now at most 42% of the shell and
  the box at most 600px, hanging up to 3rem into the margin, which leaves
  at least 84px between them at every width.
- **New copy:** each product now says what it is useful for and what you get.
  Every line is drawn from words the site or `assistant-knowledge.md` already
  used: the film's captions, the cases' results, the assistant's
  descriptions. No number, no client. The quotes and descriptions are the
  cards', unchanged. The copy is in `src/components/products/data.js`.
- **Navigation:** "See It Work" leaves the nav and the footer, since its
  content is now the products; `#see-it-work` still lands on them. The rail
  loses its See it work stop and the chapters renumber.
- **Retired:** the film's site version (`FilmSection.jsx`, `film/reel.js`)
  and `Solutions.jsx`. The launch films are untouched in
  `marketing/launch-video`.

## 2026-09-29 · AI implementation (on the `dev` branch)

The site repositioned as an AI implementation business for small and mid-sized
businesses. See `../01-positioning/ai-implementation-2026-09.md` for the
decision.

- **Hero:** *AI, built into your business.*, the reel's end card.
- **See it work (new):** the launch reel, run live in the page and scrubbed
  by scroll (`src/components/film`). The reel's receptionist chapter as it is,
  plus two new chapters, document AI and a back-office agent. Reduced motion
  gets the same chapters as cards.
- **What it can do:** seven solution cards replace the six problem cards. Same
  hover wipe; what they wipe to is now a small reel-style scene
  (`src/components/film/cards.js`).
- **How we work:** ends on *Run and improve*, the monthly partnership.
- **What it costs:** a fixed setup price, then Essentials, Growth and Partner
  retainers with no prices shown. Credits, the estimator and the worked example
  are gone.
- **Other services (new page, `/services`):** automation, data and analytics,
  and web, with their original cards, scenes and illustrative examples.
  Software and training are off the site.
- **Motion:** every reveal now enters through a blur, as the film's pieces do,
  and the hero arrives the same way.
- **Fix:** a duplicated `.grid` rule in `scenes.css` had been stacking the
  process steps in one column on desktop.
- **Consistency:** the assistant's knowledge, meta and structured data, the
  Terms' services line, the welcome-doc prompt and the Worker's prompt.

This covers the marketing site only: the home page, its copy, the nav and
footer, the legal pages, the shared metadata and the deployment configuration.
Portal, team space and CRM changes belong to `05-portal`, `06-team-space` and
`07-crm`.

**Adding an entry.** Date, commit, what changed, why it changed, and what was
verified. The "why" is the part worth writing — the diff already says what.

---

## 2026-08-16 — Realigned the site and the plan to the buyer's journey

Nine commits, `8e98e1d` … `7ca0e4b`, plus the reconciliation of the business
folders. Planned in [`realignment-plan.md`](realignment-plan.md), which carries
the full contradiction register and the three decisions taken on approval.

**The order changed from our taxonomy to the buyer's journey.** It was hero →
what we do → toolkit → how we work → pricing → examples → about → contact, which
asked a visitor to work through our capabilities before they had recognised
their own problem, put Python and Power BI third, and put the evidence after the
price. It is now: promise → pillars → your problem → how we help → how we work →
what we build → in practice → what it costs → afterwards → about → the ask.

**The brand promise and the pillars came back, at brand level.** The
repositioning deleted "We make your business work smarter" and the
Innovation · Automation · Optimisation strapline because both were being used as
the offer structure. Right diagnosis, wrong remedy — the problem was the layer,
not the words. The promise now leads the hero with "technology implementation"
demoted to the eyebrow, the pillars have a band of their own beneath it, and the
mnemonic is back in the footer. The offer stays problem-led.

**"Get more customers" was removed from the offer entirely.** It was defined in
the master plan as improving lead capture, follow-up and conversion, which is a
lead generation offer, and n.abl has no deliverability record, data access,
volume or proof to sell that credibly. Those systems remain internal growth
infrastructure — `10-lead-sourcing` and `11-outreach`, both of which now say so
explicitly in their first paragraph. "Understand your data" takes the slot,
which also fixes data and analytics having been reachable only through the tool
list.

**A capability layer was named.** The page went straight from the visitor's
problem to a list of vendors, so a prospect had to infer the capability from the
tooling. A new section names all six — Automation, Data & Analytics, Custom
Software, Web, AI, Training & Support — under the line that earns it: you don't
need to know what technology you need. "What we build" repeats the same six in
the same order with the detail, after the method.

**Everything else that moved:**

- Each section became its own component in `src/components/sections/`. `Home.jsx`
  now holds the order and nothing else.
- The problem cards lead with the customer's sentence as the heading, with the
  category demoted to a small label. Staggered by index rather than by column,
  so they read as a diagnostic rather than a menu dealt at once.
- Three steps became five: Listen and Recommend are now explicit. The old set
  started at Understand, which assumed the customer had already worked out and
  explained the problem.
- The examples take a fixed shape — problem, fix, result — and carry
  `provenance` and `client` fields. The "illustrative example" label is rendered
  from the data, so it cannot be edited away while true, nor left behind once a
  card becomes real. The middle example is now a data and analytics job.
- The worked example compressed from four animated counters to three lines.
  Same figures. The `Stat` counter went with it; nothing else used it.
- Credits were promoted from a pricing footnote to their own section. No pack
  size is named, because none is decided.
- About cut from three paragraphs to one, absorbed the "what you already pay
  for" list, and gained a real heading — it previously had none, leaving a hole
  in the document outline.
- The rail gained "How we help" and dropped "About", staying at eight stops for
  eleven sections.
- `.pillar__*` became `.problem__*`. "Pillar" now means the brand pillars, and
  one word for two structures is how the offer and the brand got confused.

**Claims removed.**

- *"We typically respond within 4 hours"* — the contact section, the discovery
  modal's success state, and the generated client welcome pack. Nothing measured
  it, and an unmeasured promise on a page selling reliability is a bad trade.
- *"…including when the honest answer is that it isn't worth it"* — the contact
  section. The business still declines work that would not pay for itself, and
  still shows the arithmetic; that belongs in Recommend, after listening, with
  the decision left with the client. As an ending it judged a problem we had not
  heard.

**The visual identity is provably unchanged.** `src/styles/tokens.css` has a
zero diff: no new colour, type step, radius, easing or duration. New sections are
composed from existing primitives. Two colour bugs were fixed on the way — the
footer strapline and the old response-claim rule both used `--cream-800`, which
the palette reserves for disabled states.

**Two layout defects found while checking the new sections:**

- The card-stretch fix for the problem grid was scoped to every `.reveal`, which
  turned the toolkit's row wrappers into flex containers and made their hairline
  rules shrink to the content width. Scoped to `.grid` instead.
- `grid--steps` at a 13.5rem minimum fitted only four tracks on a 1440 viewport,
  orphaning step five on its own row. The shell is narrower than its max-width
  once the gutter is taken; the minimum is now 11.5rem.

Verified: zero horizontal overflow at 390, 820 and 1440px; all 51 reveals
resolve visible under `prefers-reduced-motion`; heading order h1 → h2 → h3
throughout; every rail anchor resolves.

**Not changed, and still outstanding:** the privacy and terms pages still
describe n.abl as "an automation consultancy", and the metadata and share card
still carry the previous hero. See the README's next actions.

---

## 2026-08-15 — Repositioned the site as a technology implementation partner

`7db234d` · 13 files, +326 / −103

The current state of the site. This is the change the rest of this folder
describes.

**The offer structure changed from tool-led to problem-led.** Three pillars —
Innovation, Automation, Optimisation — became the six categories a business
owner actually arrives with: save time, reduce mistakes, get more customers,
build something new, train your team, fix something. The pillars described the
disciplines being practised, arranged for the practitioner's convenience. Nobody
wakes up needing optimisation. They wake up knowing a job takes all morning and
should not.

**The invented metrics were deleted.** The impact section counted "47 businesses
transformed", "£2.1M+ estimated client savings unlocked", "3x average efficiency
improvement" and "100% delivered inside your existing stack". None of those
things happened. A prospect can act on a number, so an invented one is not
decoration — it is a false claim, and it is the first thing that falls apart in
a room with a real client.

**That slot now carries pricing**, which is true and is the question every small
business asks first: the two pricing categories, the worked example from the
master plan (£240 a month becomes £40, saving £200 a month and £2,400 a year),
and credits instead of a retainer. The figures are labelled as illustrative
arithmetic rather than an average of work that has not been done.

**The case cards lost their fabricated attributions.** "Retail Operations — UK
SME", "Sales Team — B2B Technology" and headline outcomes like "14 hours of
weekly reporting. Gone." and "60% more accurate" are gone. The section now says
in its own standfirst that these are examples, not a client list, and that
clients are named only with permission.

Everything else that moved, in one list:

- Hero: "We make your business work smarter" became "Tell us what's costing you.
  We build the fix". The eyebrow changed from "Automation studio" to "Technology
  implementation partner".
- The systems section became the toolkit, grouped by what a job needs rather
  than by vendor. The old list was a Microsoft-and-SAP CV: Fabric, Snowflake,
  SAP S/4HANA, Salesforce, Clari, Copilot Studio, Polaris. The new one leads
  with automation and custom software, and puts "AI, where it earns its place"
  fifth of six.
- Steps: Audit / Build / Optimise became Understand / Build / Hand over.
- Section ids: `your-systems` → `toolkit`, `impact` → `pricing`. Nav, footer and
  the scroll rail's chapter labels changed with them, and a Pricing link was
  added to both the nav and the footer.
- Glyphs: three discipline glyphs became six category glyphs, in the same
  geometric language.
- Footer strapline: "Innovation · Automation · Optimisation" became "A
  technology implementation partner for small businesses." The base line changed
  from "Powered by your stack" to "No retainers."
- `index.html`: new title, description, `og:title` and `og:description`.
- `public/brand/og.png` regenerated with the new headline.
- The stat counter now groups thousands, because £2400 read as a part number
  rather than as money.

Two layout defects were found while checking the new sections on a phone, and
fixed in the same commit:

- The horizon spark travelled to 92% of its container plus its own 90px width,
  so its right edge left the container and widened the document. Every page had
  a sliver of sideways scroll that grew as the animation ran.
- The closed mobile menu was parked off-screen by transform alone, so it stayed
  in the layout and its links stayed focusable behind a menu nobody had opened.

Verified: the commit records 41/41 UI assertions and 19/19 security checks
passing, and zero horizontal overflow at 390, 820 and 1440px.

Not changed, and still outstanding: the privacy and terms pages still describe
n.abl as "an automation consultancy" offering "consultancy, automation and
optimisation services". See the README's next actions.

---

## 2026-08-15 — Motion fixes

`a9064a8` — stopped the reveal animation replaying at the viewport edge.

`fe92c70` — reveal on exit as well as entry, and stopped the scroll rail
overlapping the text.

---

## 2026-08-15 — The wordmark became drawn artwork

`a06d9d4` — the wordmark is drawn rather than set in a typeface. It is a 13-unit
monoline stroke with butt caps and true-circle curves, mastered at
`public/brand/wordmark.svg` and `mark.svg`.

`e05c6bf` — respaced optically. Gaps between outer edges are 7 / 7 / 13 / 10.

`fc487fd` — the drawn letterforms applied everywhere, not just in the `Logo`
component, so the intro curtain, the favicon and the nav all show the same
letterform.

This is brand work, recorded here because it is visible on every page of the
site. The specification lives in `02-brand`.

---

## 2026-08-15 — Brand assets regenerated

`5bb68a9` — the old brand assets replaced with a regenerated set. The old
identity was electric lime `#B8FF00` on pure black `#0A0A0A`. It does not come
back.

---

## 2026-08-15 — Netlify build pointed at the repository root

`476badc` — the site previously published a `nabl website` folder directly, with
no build step. That folder is gone. `netlify.toml` now sets `base = ""`,
`command = "npm run build"` and `publish = "dist"`.

One warning survives in that file and is worth repeating: Netlify reads
`netlify.toml` from the site's **base directory**. If the base directory is
still set to the old folder in the Netlify UI, the file is never read at all and
the build fails looking for a folder that no longer exists. That single setting
cannot be overridden from the file itself.

---

## 2026-08-14 — Portal, legal pages, scroll journey and brand imagery

`0aa2bc7` — added the client portal at `/portal`, the three legal pages at
`/privacy`, `/terms` and `/cookies`, the scroll rail and chapter markers, the
node-field canvas, the horizon divider, and the Open Graph image.

Every legal page shipped, and still ships, with the draft notice: these have not
been reviewed by a solicitor and must not be relied on as binding.

---

## 2026-08-14 — Rebrand v2: the site as it now exists

`aabf13d` — the React 18 + Vite foundation, the design-system tokens, the logo
component and the marketing site itself. This is where the current site begins.
Everything before it was a different codebase.
