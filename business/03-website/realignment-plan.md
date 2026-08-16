# Realignment plan — website and business plan

**Status: proposed. Awaiting approval. No implementation has begun.**

This is the Phase 1 output of the strategic realignment brief: restore the n.abl
brand promise and the three pillars as *brand* architecture without reverting the
customer-led repositioning, correct the offer so it only claims what the business
can deliver, reorder the homepage to follow the buyer's journey, and leave the
website and the business plan saying the same thing.

Audited 2026-08-16 against commit `70cec8c`, including the site as it actually
renders, not only as it reads in source.

Read section 1 before anything else. Six of the brief's premises do not match the
repository, and two of them change what the right answer is.

---

## 1. Where the brief and the repository disagree

The brief invites this section: *"If you find something in the repository that
contradicts this brief and you think the repository is right, say so before
proceeding."* Six items. The first two change the work.

### 1.1 The site is not built in Next.js — it is a Vite + React SPA

The brief describes "a Next.js marketing site". It is React 18 + Vite 5, served
as a static SPA on Netlify with a catch-all rewrite (`netlify.toml`,
`public/_redirects`). There is no server, no per-route rendering and no metadata
API.

**Consequence for Phase 6.** "Per-route metadata: title, description, canonical,
OG and Twitter tags" cannot be done the way the brief assumes. Every URL serves
the same static shell from `index.html`, so `/privacy`, `/terms` and `/cookies`
report the home page's title to any crawler that does not run JavaScript.
`03-website/seo-and-metadata.md` already diagnosed this. `robots.txt` and
`sitemap.xml` are trivial static files; per-route metadata needs an actual
decision (options in §6.6).

### 1.2 "Fix something" was never lost — it is live, and card 06

Open question 2 asks whether "Fix something" should be restored, having been
"absorbed into Train or improve". It was not absorbed. It is on the live page
right now as card 06 (`src/pages/Home.jsx:29`), and it is category 6 in every
positioning document.

What is genuinely *absent* from the customer-facing set is **Understand your
data** and **Automate processes**. Data and reporting exist only inside the
toolkit list, which is exactly the "buried" placement §1.2 of the brief objects
to.

**Consequence.** Question 2's premise is inverted, and that changes the answer to
questions 1 and 2 together. See §6.1 — it makes the brief's own alternative set
the strongest option rather than the fallback.

### 1.3 n.abl does not currently sell lead generation anywhere

Greping the whole repository for `lead generation`, `lead-generation`, `AI SDR`,
`outbound sales` and `lead conversion` returns **zero results**. There is no
lead-gen service line to remove from the CRM taxonomy, the pricing examples or
the proposal templates, because none was ever written.

The §1.1 correction lands on exactly one thing: the customer-problem category
**"Get more customers"**, defined in `business/README.md:49` as *"Improve lead
capture, follow-up and conversion"*. That is the lead-generation-as-service
framing, it is real, and it appears in 17 places. Removing it is correct and it
is the whole job.

**Consequence.** Phase 3's instruction to strip a lead-generation service
category from `07-crm` is a no-op — see 1.4. Phase 7's cross-check across
proposal templates finds one line (`04-legal/scope-of-work-template.md:78`).

### 1.4 `07-crm` has no service taxonomy to correct

The brief asks to "remove any lead-generation service category from the taxonomy"
and make "pipeline stages and service fields match the corrected capability
layer". The CRM has no service category field and no service taxonomy at all. Its
ten pipeline stages (`New Lead` → `Won` / `Lost`) describe **n.abl's own sales
process**, not a menu of services, and they are enforced by a `CHECK` constraint
in `supabase/migrations/202606010001_sales_intelligence.sql`.

Nothing in `07-crm` needs correcting for §1.1. The folder's real open gap — no
compliance fields, so it cannot lawfully drive outreach — is already documented
and is outside this brief.

### 1.5 `10-lead-sourcing` and `11-outreach` are already internal

Both READMEs already describe n.abl acquiring its own customers, in detail, with
status `not started`. Neither frames itself as a service. The acceptance
criterion asks for them to be *unambiguously* framed, which is fair — an explicit
sentence is missing, and a future reader skimming folder names could misread
them. That is a one-paragraph addition to each README, not a reframe.

### 1.6 The banned phrase does not exist; its honest cousin does

*"Let's establish what is actually worth fixing"* appears nowhere. The nearest
analogues are:

| Where | Line |
|---|---|
| `src/pages/Home.jsx:459`, `copy-deck.md:299` | "…what it would take to fix — including when the honest answer is that it isn't worth it." |
| `12-pricing/worked-examples.md:138` | "Honestly, this one is not worth building. It is costing you about twenty pounds a month…" |

These are not gatekeeping. They are the business refusing to sell something that
would not pay for itself, which is the most trust-building thing on the page and
is load-bearing in the pricing model.

**I think the repository is right here and the brief's rule needs a narrower
edge.** The thing to ban is n.abl *grading the customer's problem before hearing
it* ("let's establish what is worth fixing" — a precondition). The thing to keep
is n.abl showing its arithmetic and declining work that fails it — after
listening, with the numbers visible, as the customer's decision. Proposed
rewrites in §6.5 keep the honesty and remove the verdict.

---

## 2. The contradiction register

Every place the website, the strategy documents and the brief's corrections
disagree. This is the artefact the brief asks to be preserved rather than
summarised, so it is complete rather than short.

### 2.A Retired category — "Get more customers" (brief §1.1)

Present in 17 locations. All must go.

| # | Location | What it says | Action |
|---|---|---|---|
| A1 | `src/pages/Home.jsx:23-24` | Category card 03, "The enquiries you never followed up" | Replace with new category |
| A2 | `src/components/Visuals.jsx:137-146` | `customers` glyph, a funnel | Delete; add two new glyphs |
| A3 | `business/README.md:49` | "**Get more customers** \| Improve lead capture, follow-up and conversion" | **The lead-gen-as-service framing.** Remove row |
| A4 | `01-positioning/README.md:138` | Category table row | Replace |
| A5 | `01-positioning/positioning-statement.md:82` | Category table row | Replace |
| A6 | `01-positioning/positioning-statement.md:212` | The six named in the messaging ladder | Replace |
| A7 | `01-positioning/service-categories.md:24` | Summary table row 3 | Replace |
| A8 | `01-positioning/service-categories.md:255` | Full section "## 3. Get more customers" | Rewrite as new category |
| A9 | `01-positioning/ideal-customer-profile.md:209` | "…the 'get more customers' category with proof attached" | Rewrite |
| A10 | `01-positioning/ideal-customer-profile.md:399` | "'get more customers' may prove easier to sell" | Rewrite |
| A11 | `01-positioning/messaging-spine.md:26` | The six in the spine | Replace |
| A12 | `01-positioning/messaging-spine.md:83` | Category → question mapping | Replace |
| A13 | `02-brand/voice-and-tone.md:44` | The six listed | Replace |
| A14 | `03-website/README.md:52` | "Done" checklist names the six | Replace |
| A15 | `03-website/copy-deck.md:91` | Verbatim card copy | Replace |
| A16 | `03-website/site-map.md:104` | Section inventory row, glyph name | Replace |
| A17 | `04-legal/scope-of-work-template.md:78` | `[PLACEHOLDER: Save time / … / Get more customers / …]` | Replace |

`03-website/changelog.md:25` also names it, in a dated historical entry. **Leave
that one.** A changelog records what was true then; rewriting history to match
the present is how you lose the ability to audit a decision.

### 2.B Business documents that describe a website that no longer exists

The single largest inconsistency in the repository, and the brief does not
mention it. Commit `7db234d` rewrote the site to the six problem-led categories
on 2026-08-15. Several documents still assert the opposite.

| # | Location | Claims | Reality |
|---|---|---|---|
| B1 | `01-positioning/README.md:73-75` | "The last one is currently false. The live website is still built on Innovation / Automation / Optimisation." | False since `7db234d`. Pillars are gone from the site entirely |
| B2 | `01-positioning/README.md:167` | Handoff to `03-website`: "Not made. Largest open gap." | Made. The site runs the six categories |
| B3 | `01-positioning/positioning-statement.md:167` | "**Current status: the live website is still organised around the three pillars.**" | False |
| B4 | `01-positioning/positioning-statement.md:247` | "Website hero \| Short \| Not done. Site still on three pillars." | False |
| B5 | `01-positioning/messaging-spine.md:325` | "Website hero \| Short claim \| Not done. Site still on the three pillars." | False |
| B6 | `01-positioning/README.md:71` | Done-criterion: no document "organises the offer around the three pillars" | Now satisfiable — and about to be deliberately re-scoped by this brief, since pillars return as *brand*, not offer |

B6 matters beyond bookkeeping: the criterion as written would forbid the restored
pillars. It has to be rewritten to the three-layer distinction, or the next
person to read it will delete the brand device again.

### 2.C The brand promise and pillars were deliberately deleted (brief §1.3)

| # | Location | Record |
|---|---|---|
| C1 | `03-website/changelog.md:52` | *"Hero: 'We make your business work smarter' became 'Tell us what's costing you. We build the fix'."* |
| C2 | `03-website/changelog.md:66` | *"Footer strapline: 'Innovation · Automation · Optimisation' became 'A technology implementation partner for small businesses.'"* |
| C3 | `business/README.md:54`, `01-positioning/README.md:38`, `positioning-statement.md:156`, `voice-and-tone.md:47` | All four say the pillars "may survive as a strapline" |

**The repository is closer to the brief than the brief credits.** §1.3 says
`01-positioning`'s "implied solution (delete the pillars) is wrong" — but the
folder never implies deletion, it implies demotion to strapline, which is within
touching distance of the brief's own answer. The genuine gap is that "may survive
as a strapline, if they survive at all" is too weak and too optional to stop
someone deleting them, and nothing anywhere records the brand promise as an
asset. That is what §2 of the brief fixes, and it needs writing down positively,
not merely permitted.

### 2.D Capabilities buried or missing (brief §1.2)

| # | Location | Problem |
|---|---|---|
| D1 | `src/pages/Home.jsx:36-43` | Data & reporting is row 4 of 6 in the toolkit and appears nowhere else. No customer-problem entry point reaches it |
| D2 | `src/pages/Home.jsx:19-31` | Automation is implied by "Save time" but never named as a capability the business has |
| D3 | Site-wide | There is no named capability layer at all. The page goes problem → vendor list, with no "here is what we do" in between |
| D4 | `12-pricing/worked-examples.md` | Six worked examples, none framed as an analytics implementation; automation is implicit in all of them and named in none |
| D5 | `14-delivery/*` | No statement that the solution is technology-agnostic. Nothing says a delivery may be a Python application, a website, an analytics system or a training programme |

### 2.E Unsubstantiated and stale claims on the public site

| # | Location | Claim | Status |
|---|---|---|---|
| E1 | `src/pages/Home.jsx:469` | "We typically respond within 4 hours." | **Unsubstantiated.** Nothing measures it. Already flagged in `03-website/README.md:115` |
| E2 | `src/components/DiscoveryModal.jsx:102` | "We'll be in touch within 4 hours to find a time." | Same claim, second surface, made *after* the visitor has committed |
| E3 | `src/pages/Legal.jsx:17` | "n.abl is an automation consultancy based in the United Kingdom." | Retired positioning, on a public page |
| E4 | `src/pages/Legal.jsx:62` | "We provide consultancy, automation and optimisation services…" | Retired positioning; also reads as the pillars-as-offer structure |
| E5 | `src/pages/Home.jsx:55-60` | £240 / £40 / £200 / £2,400 | **Substantiated as illustrative.** Arithmetic is visible, matches `business/README.md:118-126`, and is labelled. Keep |
| E6 | `src/pages/Home.jsx:70-80` | Three case cards | **Labelled** in the section standfirst, but the label is prose, not rendered per-card, and there is no provenance flag in the data. Brief §6.07 requires both |
| E7 | `src/pages/Home.jsx:441` | "Based in the UK. Working with businesses everywhere." | Accurate |
| E8 | `index.html:8` | Meta description, 211 chars | Truncated in results at ~155. Not false, just wasted. Noted in `seo-and-metadata.md` |

No invented client counts, savings totals or testimonials exist anywhere. The
discipline the brief asks to extend in Phase 5 is already being kept.

### 2.F Structural gaps the repository already admits

| # | Gap | Recorded at |
|---|---|---|
| F1 | No `robots.txt`; `/team` and `/sales-intelligence` are crawlable via two deliberate footer links | `03-website/README.md:103`, `seo-and-metadata.md` |
| F2 | No `sitemap.xml` | `03-website/README.md:113` |
| F3 | No per-route metadata | `03-website/README.md:109` |
| F4 | No conversion measurement of any kind | `03-website/README.md:85-87` |
| F5 | Lead capture posts to Web3Forms with no honeypot, no rate limit and no captcha | `src/components/DiscoveryModal.jsx:62` |
| F6 | Client-portal schema not in version control | `business/README.md:322` |

### 2.G Status claims that hide unfinished work (brief Phase 5)

| # | Folder | Claims | Beneath it |
|---|---|---|---|
| G1 | `03-website` | **done** — "the site now says the right thing" | Six open next-actions listed in the same file. This is the definition-of-done the brief replaces |
| G2 | `02-brand` | **done** | "Old-brand wording survives in five places" |
| G3 | All 16 folders | Status only | No Owner, no Next review, no Evidence link anywhere |
| G4 | `business/README.md:405` | Master table lists `03-website` as done | Same problem, second surface. Must move together |

### 2.H The brief's Phase 6 collides with a load-bearing site principle

Flagged as an open question rather than a change, because it is a strategic
decision, not an implementation detail.

Phase 6 asks to "instrument the primary CTA, the secondary CTA, section reach
depth and form submission". Four things currently forbid that:

| Where | What it says |
|---|---|
| `03-website/README.md:150` | Rule 4: "**No third-party requests.** Fonts are self-hosted, there is no analytics, no tag manager and no CDN." |
| `netlify.toml:59` | CSP `connect-src` allows only Supabase and Web3Forms. Anything else is blocked by the browser |
| `src/pages/Legal.jsx:24` | Privacy policy: "We do not run advertising or analytics tracking, we do not build behavioural profiles" |
| `src/pages/Legal.jsx:108` | Cookie policy: "no analytics cookies and no third-party tracking cookies… there is no consent banner because there is nothing to consent to" |

Adding conventional analytics means editing the CSP, rewriting two public legal
pages, probably adding a consent banner, and giving up a differentiator the site
currently states out loud. See §6.7 for three options and a recommendation.

### 2.I Sundries

| # | Location | Note |
|---|---|---|
| I1 | `src/pages/Home.jsx:421-445` | The About section has no heading at all — a `<section>` with a blockquote. Minor heading-hierarchy and landmark-naming gap; worth fixing while it is being shortened |
| I2 | `scripts/e2e-ui.mjs` | 38 assertions, all against portal / team / CRM. **No test asserts on homepage copy or order**, so the rewrite breaks no test — and nothing will catch a regression either |
| I3 | `src/components/Journey.jsx:11-20` | The rail has exactly 8 chapters, hard-coded and matched by id to sections. Target order has 11 sections. See §4.2 |

---

## 3. Proposed homepage order

Promise → recognition → capability → method → evidence → price → afterwards →
trust → ask.

| # | Section | id | Component | Change |
|---|---|---|---|---|
| 01 | Hero | `hero` | `sections/Hero.jsx` | Rewritten — brand promise leads |
| 02 | Three pillars | `pillars` | `sections/Pillars.jsx` | **New** |
| 03 | What are you trying to improve? | `what-we-do` | `sections/Problems.jsx` | Reordered content, rewritten cards |
| 04 | Why n.abl / how we help | `why-nabl` | `sections/HowWeHelp.jsx` | **New** — names the capability layer |
| 05 | How we work | `how-we-work` | `sections/Process.jsx` | Rewritten, 3 steps → 5 |
| 06 | What we build | `toolkit` | `sections/Capabilities.jsx` | Moved down 4 places, regrouped |
| 07 | What this looks like | `cases` | `sections/Examples.jsx` | Restructured, provenance flags |
| 08 | Pricing | `pricing` | `sections/Pricing.jsx` | Compressed |
| 09 | Afterwards (credits) | `credits` | `sections/Credits.jsx` | **Promoted** out of pricing |
| 10 | About | `about` | `sections/About.jsx` | Shortened |
| 11 | Final CTA | `contact` | `sections/Contact.jsx` | Rewritten |

### 3.1 There are no homepage components today

The brief asks for "the component that will implement each section". None exist.
`src/pages/Home.jsx` is one 479-line file holding all eight sections as inline
JSX plus six module-level content constants. Nav, Footer, Journey and Visuals are
separate; the sections are not.

**Proposal:** extract each section into `src/components/sections/`, as a
mechanical refactor in its own commit, *before* any reorder or copy change. Three
reasons: the reorder becomes a readable diff instead of a 479-line rewrite; each
section's content constant travels with its markup; and the one-for-one
case-study replacement the brief asks for in §6.07 gets a natural home
(`Examples.jsx` owns both the data shape and the provenance label).

### 3.2 The chapter rail stays at eight

`Journey.jsx` hard-codes 8 chapters as fixed dots down the left edge. Eleven dots
would crowd the rail and dilute a device that currently reads as a table of
contents. Proposal: **sections ≠ chapters.** Pillars, Credits and About render as
bands without rail stops.

| Rail | id |
|---|---|
| Start | `hero` |
| Your problem | `what-we-do` |
| How we help | `why-nabl` |
| How we work | `how-we-work` |
| What we build | `toolkit` |
| In practice | `cases` |
| What it costs | `pricing` |
| Let's talk | `contact` |

Nav (`Nav.jsx:5-11`) and Footer (`Footer.jsx:25-29`) anchor lists update to
match. `#pricing` and `#about` survive as ids, so no existing inbound anchor
breaks.

### 3.3 Copy

Copy is given in full so it can be approved as words, not as intent. It goes into
`copy-deck.md` at implementation time, per that folder's rule 5.

**01 — Hero**

> `eyebrow` Technology implementation for small businesses
>
> # We make your business work smarter.
>
> We listen to what isn't working, understand how your business actually
> operates, and build the right improvement — whether that's automation,
> analytics, software, a better website, AI or training.
>
> `[ Book a free discovery call ]` `[ See how we help ]`
>
> `footnote` No retainer. No technology for technology's sake.

The pillars move to section 02 rather than sitting under the hero CTAs, so the
hero closes on the differentiator instead of a list. Primary CTA keeps
`btn--primary`; secondary stays `btn--ghost` and visually subordinate, as now.

**02 — Three pillars**

> **INNOVATION** — Find better ways to do things.
> **AUTOMATION** — Take repetitive work off people's hands.
> **OPTIMISATION** — Get more from the people, processes, systems and data you
> already have.
>
> One rule: start with the problem, not the technology.

**03 — What are you trying to improve?**

> `chapter 01` Your problem
> ## What are you trying to improve?
> Which of these sounds familiar?

Six cards, each leading with the customer's voice. Card set pending §6.1.

| Card | Opening line | Supporting line |
|---|---|---|
| Save time | "This takes longer than it should." | Give your team hours back by removing repetitive work. |
| Reduce mistakes | "We keep having to check this." | Replace fragile manual processes with systems that do the job consistently. |
| Understand your data | "We have the data, but not the answers." | Turn spreadsheets, systems and reporting into something you can make decisions with. |
| Build something new | "We need something that doesn't exist yet." | Websites, internal tools, applications, portals and bespoke software. |
| Train your team | "We have the tools, but we're not getting enough from them." | Training, optimisation, troubleshooting and ongoing improvements. |
| Fix something | "It works. Until it doesn't." | Something broke, or was never quite right. Buy credits and spend them when you need us. |

**04 — Why n.abl / how we help**

> `chapter 02` How we help
> ## You don't need to know what technology you need.
> We listen first, understand how the work happens today, then recommend the
> right improvement.
>
> Automation · Data & Analytics · Custom Software · Web · AI · Training & Support

**05 — How we work**

> `chapter 03` How we work
> ## Five steps, and then we get out of the way.

> **Listen** — Tell us what's getting in the way.
> **Understand** — We look at how the work actually happens today, and the systems around it.
> **Recommend** — We explain what we think would help, what it involves, and what it should be worth to you.
> **Build** — We choose whatever technology solves it properly, at the price agreed before we start.
> **Hand over** — You own it. We train your team, and we're there when you need us.

Three cards become five. The existing `grid--3` becomes a five-across rail on
desktop, wrapping on narrow screens — composed from existing grid primitives, no
new tokens.

**06 — What we build**

> `chapter 04` What we build
> ## Whatever the job actually needs.
> Grouped by what it does, not by who makes it. Most of what we build is
> ordinary, well-made software.

| Group | Detail |
|---|---|
| Automation | workflow automation, system integration, custom scripts (n8n, Make, Power Automate, APIs) |
| Data & Analytics | data cleaning, dashboards, reporting, decision support (Power BI, SQL, spreadsheets) |
| Software | internal tools, applications, databases (Python, JavaScript, React) |
| Web | websites, booking flows, customer portals, payments |
| AI | document handling, classification, assistants, drafting, analysis |
| Training & Support | staff training, documentation, troubleshooting, improvements, assistance credits |

This drops the current sixth row, "What you already pay for" (Microsoft 365,
Google Workspace, your CRM, your booking system). It is a good idea in the wrong
place — it belongs in About, where "no reseller agreements, no migration upsell"
already lives. Flagged rather than silently deleted.

**07 — What this looks like**

> `chapter 05` In practice
> ## From problem to solution.
> `label rendered adjacent to the cards:` Illustrative examples — not client
> work. We name clients only with permission, and not before there is something
> worth naming.

Every card identical in shape:

> **THE PROBLEM** — 12 hours of manual reporting every month.
> **THE FIX** — An automated reporting pipeline.
> **THE RESULT** — 10 hours returned to the business every month.

Data shape carries provenance so a real case replaces an illustrative one
one-for-one:

```js
{ provenance: 'illustrative',   // 'illustrative' | 'client'
  client: null,                 // set only with written permission
  capability: 'Automation',
  problem: '…', fix: '…', result: '…',
  tools: ['Power Automate', 'Power BI'] }
```

`Examples.jsx` renders the label from `provenance`, so the disclaimer cannot
survive the arrival of real proof and cannot be lost when it is still needed.

**08 — Pricing**

> `chapter 06` What it costs
> ## No retainers. A price before we start.
>
> Efficiency improvements: priced around the measurable value they create.
> New capabilities: fixed price, agreed before work starts.

Two existing price cards stay. The worked example compresses from a four-counter
band to three lines:

> A 12-hour monthly process becomes a 2-hour process.
> £240 → £40 per month. Around £2,400 a year.
> *Your numbers are calculated from your business, not ours.*

**This deletes the `Stat` counter component from the homepage** (`Home.jsx:115`)
and the `useParallax` call on the stats band. Both are good work, and the
counters currently occupy roughly a third of the pricing section. Compressing is
the right call and it is a real subtraction, so it is called out rather than
buried. `Stat` stays in the file history; nothing else imports it.

**09 — Afterwards (credits)**

> ## You own what we build.
> No retainer. Need us later? Use credits.
>
> **Build** — Small changes, new integrations, another automation.
> **Assist** — Troubleshooting, repairs, configuration, support.
> **Educate** — Training, workshops, documentation for your team.
>
> Buy a pack of ten hours when you need us, instead of committing to a monthly
> fee indefinitely.

**10 — About**

> We aren't here to sell you a particular technology.
> We're here to understand the problem and build what makes the business work
> better.
>
> No reseller agreements, no migration upsell, no monthly retainer. If the answer
> is a licence you already hold, or an afternoon of training rather than a build,
> that is the answer we give you.
>
> `Based in the UK. Working with businesses everywhere.`

Cuts the current three paragraphs to one and drops "We are not an AI company",
which is strong but defines n.abl by what it isn't — weaker than the promise now
carrying the hero.

**11 — Final CTA**

> ## Tell us what's getting in the way.
> A free 30-minute conversation about what's working, what's frustrating, and
> what you'd like to improve.
>
> `[ Book a discovery call ]`
> hello@nabl.agency

The four-hour response line is removed here and in `DiscoveryModal.jsx` — see
§6.5.

### 3.4 Visual identity: what this touches

The brief requires the identity be provably unchanged. It will be:

| File | Change |
|---|---|
| `src/styles/tokens.css` | **None.** Zero diff. This is the mechanical proof — no new colour, type step, radius, easing or duration |
| `src/styles/home.css` | New rules composed only from existing tokens, reusing `.section`, `.shell`, `.grid`, `.edge`, `.chapter`, `.chip`, `.eyebrow`, `.reveal`, `.dot` |
| `src/components/Visuals.jsx` | `customers` glyph deleted; `data` glyph added. Same grammar: 64×64, 1.4 stroke, true circles, one solid accent dot |
| Everything else | Untouched: `Logo`, `NodeField`, `Horizon`, `Intro`, the grain, the palette, the three typefaces |

Two new sections (Pillars, Credits) need a visual treatment. Both compose from
existing primitives — Pillars as a typographic band using `.eyebrow` + display
type on `--bg-alt`, Credits reusing the existing `.credits__grid`. No new
component library, no imagery, no illustration style.

Accessibility and motion: every new section uses the existing `Reveal`, which
already honours `prefers-reduced-motion`. Heading order stays h1 → h2 → h3, and
About gains a real heading (fixing I1). The rail keeps `aria-current` and its
labels.

---

## 4. File-by-file change list — business folders

### `01-positioning`
- `README.md` — replace the six-category table (A4); correct the three stale
  "site still on the pillars" claims (B1, B2, B6); rewrite the done-criterion at
  :71 to the three-layer distinction so it stops forbidding the brand device.
- `positioning-statement.md` — A5, A6, B3, B4; rewrite §5 from "the pillars
  survive only as a strapline, if at all" to the brand-architecture position.
- `service-categories.md` — A7; rewrite §3 wholesale (A8) as the replacement
  category, with its own arrival language, pricing category and disqualifier.
- `messaging-spine.md` — A11, A12, B5.
- `ideal-customer-profile.md` — A9, A10.
- **New in `README.md`:** the three-layer architecture table from brief §2
  verbatim, the pillar→capability statement, the "should Automation be on the
  services page?" worked example, and an explicit line that lead generation,
  lead conversion and outbound sales systems are internal capabilities in
  development, not customer-facing services.
- `objection-handling.md` — audit for judgemental framing (§6.5 governs).

### `02-brand`
- `README.md` — status line gains Owner / Next review / Evidence.
- **New `brand-promise.md`** — "We make your business work smarter", the three
  pillar definitions, what the pillars are and are not permitted to do, and the
  worked example. Keeps it out of `brand-guidelines.md`, which is visual.
- `voice-and-tone.md` — A13; add the §1.4 judgemental phrasings to the existing
  banned-words table; add the "we know how to help you find the answer" register
  note. The British-English rule (:54) and most of §3's banned list are already
  there and correct.

### `03-website`
- `README.md` — A14; replace "Done = the site says the right thing" with
  "Done = the site is ready to perform as a sales asset", decomposed per Phase 5;
  add Owner / Next review / Evidence.
- `copy-deck.md` — A15; re-record all copy verbatim after the rewrite; refresh
  the claims audit (E1–E8).
- `site-map.md` — A16; new section order, ids, rail chapters.
- `seo-and-metadata.md` — record what Phase 6 closes and what it cannot (§1.1).
- `changelog.md` — new entry. **Historical entries stay as written.**
- `realignment-plan.md` — this file.

### `07-crm`
- No taxonomy change (§1.4). `README.md` gains the four status fields, and one
  line recording that the CRM's stages are n.abl's own pipeline, not a service
  menu — which is the confusion §1.1 is guarding against.

### `10-lead-sourcing`, `11-outreach`
- Each README gains an explicit framing paragraph: internal business-development
  infrastructure for n.abl's own acquisition, never a customer-facing service,
  with a pointer to the positioning statement. Plus the four status fields.

### `12-pricing`
- `worked-examples.md` — add two named examples: an **automation** removing ~20
  hours of repetitive work a month, and an **analytics** implementation cutting
  manual reporting from two days to two hours a month. No lead-generation
  example exists to remove (§1.3).
- `README.md` — status fields; make the A/B/C mapping name automation and
  analytics explicitly.
- §6.5 governs the tone of `worked-examples.md:138`.

### `13-credits`
- Verify Build / Assist / Educate wording matches homepage section 09 exactly.
  Already consistent (`credit-types.md:1`); this is a check, not a rewrite.
  Status fields.

### `14-delivery`
- Add the full-solution principle: the solution is technology-agnostic, and
  delivery may choose a Python application, custom software, a website, an
  automation, an analytics system, an integration, an AI workflow, a training
  programme or a combination, based on the customer's goal. Status fields.

### `business/README.md`
- A3 — remove the lead-capture/conversion row, the clearest statement of the
  retired offer in the repository.
- §1's category table → corrected set; §1's pillar paragraph → brand
  architecture; folder status table (G4) → new definition of done for 03.

### All 16 folder READMEs
- Add Owner / Next review / Evidence beneath the existing status.

### New folders
- **`17-proof-and-case-studies`** — README plus criteria, permission and approval
  process, before/after measurement captured at delivery start, ROI methodology,
  testimonial timing, screenshots and technical evidence, anonymised format,
  illustrative-labelling rules, what can and cannot be claimed, a case-study
  template, and the one-for-one homepage replacement process keyed to the
  `provenance` field in §3.3.
- **`18-sales-conversation`** — README plus the pipeline
  `Lead → Qualification → Problem discovery → Exploration → Recommendation →
  Commercial fit → Proposal → Decision → Delivery → Proof → Referral`, the
  listen-before-recommend philosophy, and the discovery questions. See §6.4 on
  the stage names.

---

## 5. Sequencing

Twelve commits. Each leaves the site building; copy and structure are separated
so copy can be reverted without losing the reordering.

| # | Commit | Leaves working |
|---|---|---|
| 1 | Extract the homepage sections into components | Identical render. Pure refactor — verified by screenshot diff |
| 2 | Reorder the homepage to follow the buyer's journey | New order, **existing copy**. Rail, nav, footer anchors move together |
| 3 | Lead with the brand promise, and restore the three pillars | Hero + Pillars band |
| 4 | Lead the problem cards with the customer's words | Card copy, corrected category set, glyph swap |
| 5 | Name the capability layer, and move the toolkit beneath it | Sections 04 and 06 |
| 6 | Give the process five steps | Section 05 |
| 7 | Give every example the same shape, and a provenance flag | Section 07 |
| 8 | Compress the worked example and promote credits | Sections 08 and 09 |
| 9 | Shorten the about band and sharpen the final ask | Sections 10 and 11; removes the four-hour claim |
| 10 | Reconcile the business plan with the site | §4, all folders. **Contradiction register goes to empty here** |
| 11 | Add the proof engine and the sales conversation | Folders 17 and 18 |
| 12 | Give every folder README an owner, a review trigger and evidence | Phase 5 |

Operational completion (Phase 6) follows as its own short series once the above
is approved and landed: `robots.txt` and `sitemap.xml` (trivial), legal-page
wording E3/E4, then the two decisions in §6.6 and §6.7.

Commits 1 and 2 are the risky pair. Both are verified by rebuilding, scrolling
the page section by section, and confirming zero horizontal overflow at 390, 820
and 1440px — the same check `7db234d` recorded.

---

## 6. Open questions — raised, not resolved

### 6.1 The card set (brief questions 1 and 2, which are one decision)

The brief's corrected set is *Save time · Reduce mistakes · Understand your data
· Automate processes · Build something new · Train or improve*, while
acknowledging that "Save time" and "Automate processes" are near-synonyms.

There is a further problem with including "Automate processes": the brief's own
three-layer table places **Automation** in the Brand and Capability layers, and
its worked example concludes that Automation "is a brand pillar and a capability,
but **not** a customer-problem entry point". A card called "Automate processes"
in the customer-problem layer contradicts the rule the same section establishes.

| Option | Set | Assessment |
|---|---|---|
| **A** | The brief's six as written | Keeps two near-synonyms; contradicts the brief's own worked example |
| **B** | Save time · Reduce mistakes · Understand your data · Build something new · Train your team · Fix something | Six non-overlapping entry points. Exactly the current live set with "Get more customers" → "Understand your data". Smallest change, keeps "Fix something" (already live, §1.2), and honours the layer rule. **Recommended** |
| **C** | Merge Save time + Automate into five cards | Five reads as thin, and loses "Fix something", a common first-contact reason |

Option B is the set written into §3.3. **It is the brief's own question-2
alternative**, and §1.2 shows it costs one card swap rather than a rebuild.

### 6.2 Capabilities appear twice (brief question 3)

Named in section 04, detailed in section 06. **Recommendation: keep both, with a
strict division of labour.** 04 names the six capabilities as a plain list and
nothing more — it answers "can these people do the thing?" at the moment the
visitor has just been told they don't need to know what they need. 06 is the
evidence, with vendors as supporting detail, after the method has been explained.
Same six words in the same order both times, so it reads as a promise then its
receipt, not as two lists. If only one can survive, keep 06 and fold the naming
into 04's paragraph.

### 6.3 Pillar treatment (brief question 4)

Three options within the existing system: a full-width band on `--bg-alt` with
the three terms in display type; a quiet typographic rail under the hero; or
integrated into the hero itself. **Recommendation: the full-width band** (§3.3),
because it gives the pillars their own moment without competing with the promise,
and because a hero already carrying an eyebrow, an h1, a sub, two CTAs and a
differentiator line has no room left. Not decided.

### 6.4 Sales-pipeline stage names (brief §8)

The brief renames "Economic diagnosis" and "Solution diagnosis" to "Exploration"
and "Recommendation", noting the §1.4 rule applies to customer-facing language
first, and inviting a view. **My view: adopt the new names everywhere, internal
included.** Not because "diagnosis" is unkind internally, but because two stages
sharing one word invite exactly the confusion the rename fixes — and a team that
says "exploration" internally says it fluently in front of a customer.

### 6.5 The honesty-versus-judgement line (§1.6)

Proposed rewrites, keeping the honesty and removing the verdict:

| Where | From | To |
|---|---|---|
| Final CTA | "…what it would take to fix — including when the honest answer is that it isn't worth it." | "A free 30-minute conversation about what's working, what's frustrating, and what you'd like to improve." (§3.3 — the clause disappears) |
| Pricing section | — | "We'll work out what it's worth to your business, and show our working." |
| `12-pricing/worked-examples.md:138` | "Honestly, this one is not worth building." | "Here's the arithmetic on this one: about £20 a month, and anything I built would take eighteen months to pay for itself. That's your call, not mine — tell me about the spreadsheet one." |

Confirm this reading of §1.4 before commit 9.

### 6.6 Per-route metadata, given there is no server (§1.1)

| Option | Cost | Result |
|---|---|---|
| Accept it | Zero | `/privacy`, `/terms`, `/cookies` keep the home title for non-JS crawlers |
| Set `document.title` per route in React | ~20 lines | Correct for Google, wrong for most social scrapers |
| Prerender the four public routes at build | A build plugin, small | Correct for everything |
| Netlify per-path header/redirect injection | Fiddly | Partial |

**Recommendation: prerender at build.** Four static routes, no framework change,
no runtime cost. But it adds a build dependency to a repository that is
deliberately lean, so it is your call.

### 6.7 Conversion measurement versus the no-third-party principle (§2.H)

| Option | What it costs |
|---|---|
| **A — conventional analytics** (GA4, Plausible, Fathom) | CSP edit, both legal pages rewritten, probably a consent banner, and the loss of a stated differentiator. Even cookieless tools are a third-party request the site currently promises not to make |
| **B — first-party events into Supabase** | CTA clicks, section depth and form submits posted to a table already inside the CSP. No new vendor, no cookie, no banner, privacy policy gains one honest line. Less capable than GA, and enough to answer "which CTA gets used" |
| **C — measure nothing on the page**, instrument the form endpoint only | Free. Tells you conversions, not what caused them |

**Recommendation: B.** It satisfies "the next iteration is informed by behaviour
rather than opinion" without dismantling a genuine differentiator, and it is the
only option where the privacy policy still reads as true. Not decided — this is
the one item in the brief that cannot be executed as written without a strategic
trade.

### 6.8 Smaller flags

- **"What you already pay for"** — the toolkit row being dropped in §3.3. Move to
  About, or lose it?
- **Final CTA wording** (brief question 5) — "Tell us what's getting in the way"
  is written into §3.3. "What's the job you wish you never had to do again?" is
  the current live line and is sharper, but it presumes a single hated task,
  which the broadened offer no longer assumes. Flagged, not decided.
- **The `Stat` counters** disappear from the homepage under §3.3. Confirm.
- **No test covers the homepage** (I2). The rewrite touches every section and
  nothing would catch a regression. Worth adding a handful of assertions —
  section order, the six card titles, the illustrative label — to
  `scripts/e2e-ui.mjs` in commit 2? Out of the brief's scope, cheap, and the
  brief does ask for a repository that behaves like a management system.
- **Historical accuracy** — `changelog.md` entries and the `03-website` "what
  changed and why" record stay as written, including their references to the
  retired category. Confirm you want history preserved rather than made
  consistent.

---

## 7. What this plan will not do

- No new design tokens, colours, type scale, radii, easings or component library.
  `tokens.css` diff must be empty.
- No stock imagery, no illustration change, no photography.
- No change to `Logo`, `NodeField`, `Horizon`, `Intro` or the grain.
- No invented proof, savings, client stories or client counts. Every number stays
  either the customer's own input or labelled illustrative arithmetic with
  visible working.
- No claim that any legal document has been reviewed by a solicitor. The draft
  notice in `Legal.jsx:144` stays exactly as it is.
- No rebuild of the portal, team space or CRM.
- No rewriting of dated changelog history.

---

## 8. Approval

Nothing above has been implemented. Approve the plan, and confirm §6.1, §6.5 and
§6.7 in particular, and I will work through the twelve commits in order.
