# Copy deck

Every word currently published on the marketing site, recorded with its source
location. Transcribed from the application on 2026-08-16, after the realignment:
the buyer's-journey reorder, the restored brand promise and pillars, and the
corrected six categories.

**Why this file exists.** The copy lives inside JSX. A wording change is
therefore invisible in review unless someone reads the component. This deck is
the reviewable copy of it, so a change can be argued about in words rather than
in a diff full of markup.

**How to use it.** Change the deck and the source in the same commit. If the two
drift apart, the source is what visitors see and the deck is wrong — fix the
deck. Curly quotes and dashes are written here as they render, not as the JSX
entities.

**Where the copy lives.** Each section of the page is its own component in
`src/components/sections/`, and its copy sits with its markup. `Home.jsx` holds
only the order.

---

## 1. Metadata and social

`index.html:8-19`

| Field | Value |
|---|---|
| `<title>` | n.abl — Technology implementation for small business |
| `description` | n.abl is a technology implementation partner for small UK businesses. Tell us what's costing you time, money or accuracy, and we build the fix — automation, software, web or training. Fixed prices, no retainers. |
| `og:title` | n.abl — Tell us what's costing you. We build the fix. |
| `og:description` | A technology implementation partner for small businesses. We start with the problem, not the technology. Fixed prices, no retainers. |
| `og:url` | `https://nabl.agency/` |
| `og:image` | `https://nabl.agency/brand/og.png`, 1200 × 630 |
| `twitter:card` | `summary_large_image` |

**Outstanding.** The metadata still carries the pre-realignment hero. The
`og:title`, the description and the generated share card all say "Tell us what's
costing you. We build the fix", which is no longer the headline. Regenerate
`public/brand/og.png` via `scripts/build-og.mjs` and rewrite these fields to the
promise — "We make your business work smarter" — when the SEO work in the
README's next actions is done. Tracked there, not here.

---

## 2. Navigation

`src/components/layout/Nav.jsx:5-11`

What We Do · How We Work · Pricing · About · Let's Talk · **Client Portal**
(button)

Scroll rail chapters, `src/components/Journey.jsx:16-25`:

Start · Your problem · How we help · How we work · What we build · In practice ·
What it costs · Let's talk

The rail carries eight stops for eleven sections. Pillars, Credits and About are
bands within the narrative rather than destinations, and eleven dots stops the
rail reading as a table of contents.

---

## 3. Hero

`src/components/sections/Hero.jsx`

> **Eyebrow** Technology implementation for small businesses
>
> **H1** We make your business work smarter.
>
> We listen to what isn't working, understand how your business actually
> operates, and build the right improvement — whether that's automation,
> analytics, software, a better website, AI or training.
>
> `[ Book a free discovery call ]` (primary) `[ See how we help ]` (ghost,
> → `#why-nabl`)
>
> No retainer. No technology for technology's sake.

The promise is the headline and the category descriptor is the eyebrow.
"Technology implementation partner" is accurate and nobody repeats it; the
promise is what a visitor leaves with. See `02-brand/brand-promise.md`.

---

## 4. The three pillars

`src/components/sections/Pillars.jsx`

> **Innovation** — Find better ways to do things.
> **Automation** — Take repetitive work off people's hands.
> **Optimisation** — Get more from the people, processes, systems and data you
> already have.
>
> One rule: start with the problem, not the technology.

**Brand framing, not a service menu.** No links, no cards, no call to action.
This band exists to be remembered, and the offer structure is the section below
it. Do not turn these into pages.

---

## 5. What are you trying to improve — the six categories

`src/components/sections/Problems.jsx`

> **Chapter** 01 Your problem
> **H2** What are you trying to improve.
> Which of these sounds familiar?

Each card: number, glyph, category label, the customer's sentence as the
heading, then the supporting line.

**01 · Save time**
> "This takes longer than it should."
> Give your team hours back by removing repetitive work.

**02 · Reduce mistakes**
> "We keep having to check this."
> Replace fragile manual processes with systems that do the job consistently.

**03 · Understand your data**
> "We have the data, but not the answers."
> Turn spreadsheets, systems and reporting into something you can make decisions
> with.

**04 · Build something new**
> "We need something that doesn't exist yet."
> Websites, internal tools, applications, portals and software built for you.

**05 · Train your team**
> "We have the tools, but we're not getting enough from them."
> Sessions built around your actual work, so people leave able to do the thing.

**06 · Fix something**
> "It works. Until it doesn't."
> Something broke, or was never quite right. Buy credits and spend them when you
> need us.

**The card leads with the customer's words, not ours.** A card that opens "This
takes longer than it should" is a diagnosis being recognised; one that opens
"Save time" is a service being sold.

**"Get more customers" was removed** and replaced by "Understand your data". The
old category was lead generation, which n.abl does not sell — see
`01-positioning/README.md`. Its funnel glyph went with it; `data` is a bar
reading in the same drawing grammar.

---

## 6. How we help — the capability layer

`src/components/sections/HowWeHelp.jsx`

> **Chapter** 02 How we help
> **H2** You don't need to know what technology you need.
> We listen first, understand how the work happens today, then recommend the
> right improvement.
>
> Automation · Data & Analytics · Custom Software · Web · AI · Training & Support

Names the capabilities and nothing more. The detail is section 8, after the
method. Same six words in the same order in both places: a promise here, its
receipt there.

---

## 7. How we work

`src/components/sections/Process.jsx`

> **Chapter** 03 How we work
> **H2** Five steps, and then we get out of the way.
> You never have to arrive knowing what you need. That part is our job.

**01 Listen** — Tell us what's getting in the way.

**02 Understand** — We look at how the work actually happens today, and the
systems around it.

**03 Recommend** — We explain what we think would help, what it involves, and
what it should be worth to you. We show our working.

**04 Build** — We choose whatever technology solves it properly, at the price
agreed before we start.

**05 Hand over** — You own it. We train your team, and we're there when you need
us.

The economic measurement lives in **Recommend**, phrased as something worked out
with the client and shown — never as a gate their problem has to pass first.

---

## 8. What we build

`src/components/sections/Capabilities.jsx`

> **Chapter** 04 What we build
> **H2** Whatever the job actually needs.
> We are not tied to one platform, and we do not force AI into a problem that
> does not have one. Most of what we build is ordinary, well-made software.

| Capability | What it covers | Tools shown |
|---|---|---|
| Automation | Workflow automation, system integration, custom scripts | n8n, Make, Zapier, Power Automate, APIs |
| Data & Analytics | Data cleaning, dashboards, reporting, decision support | Power BI, SQL, Spreadsheets done properly |
| Software | Internal tools, applications, databases | Python, JavaScript, React |
| Web | Websites, booking flows, customer portals, payments | React, Payments, Calendar sync |
| AI | Document handling, classification, assistants, drafting, analysis | Where it earns its place |
| Training & Support | Staff training, documentation, troubleshooting, improvements | Assistance credits |

Vendors are supporting detail, never headlines. This section sits after the
method deliberately: the tools are evidence that the capability is real, not a
reason to buy.

---

## 9. In practice

`src/components/sections/Examples.jsx`

> **Chapter** 05 In practice
> **H2** From problem to solution.
> The kind of problem we take on, and what gets built to solve it. Cards marked
> *illustrative* are examples rather than client work — we name clients only with
> written permission, and not before there is something worth naming.

Every card carries the same three rows, and a provenance label rendered from the
data rather than written into the copy.

**Automation** · *Illustrative example*
> **The problem** — 12 hours of manual reporting every month.
> **The fix** — An automated reporting pipeline.
> **The result** — 10 hours returned to the business every month.
> Power Automate · Excel · Power BI

**Data & Analytics** · *Illustrative example*
> **The problem** — Sales, stock and hours sit in three systems that never agree.
> **The fix** — One cleaned dataset, and a dashboard built on top of it.
> **The result** — One set of numbers, current every morning.
> Power BI · SQL

**Web** · *Illustrative example*
> **The problem** — Every booking needs a phone call, always at the worst moment.
> **The fix** — A booking flow with payment, on the website.
> **The result** — The straightforward bookings take themselves.
> Web · Payments · Calendar sync

**The label is data, not copy.** Each case has `provenance` and `client` fields;
the component renders "Illustrative example" from them, and the standfirst that
explains the label only appears while at least one card is still illustrative.
Replacing one with real proof is a data change — see
`17-proof-and-case-studies`.

Two of the three results are deliberately unquantified. Putting a number on them
would mean inventing one.

---

## 10. What it costs

`src/components/sections/Pricing.jsx`

> **Chapter** 06 What it costs
> **H2** No retainers. A price before we start.
> Two ways we price, depending on whether the problem can be counted.

**Efficiency improvements — Priced around the value they create**
> When a process already costs you money, we work out what it costs now, what it
> will cost afterwards, and price against the difference. We show our working,
> and you can check the arithmetic before you agree to anything.

**New capabilities — Fixed price, agreed before work starts**
> A portal, an app, a website — there is no before-and-after to measure, and a
> savings figure would be guesswork. So the scope is written down and the price
> is stated. Changes go through credits or a new quote.

**A worked example**
> A 12-hour monthly process becomes a 2-hour process.
> £240 → £40 per month. Around £2,400 a year.
> Your numbers are calculated from your business, not ours.

Figures match `business/README.md` §3 exactly. Compressed from four animated
counters to three lines: it is proof of how we think about price, not the pitch.

---

## 11. Afterwards — credits

`src/components/sections/Credits.jsx`

> **H2** You own what we build.
> No retainer. Need us later? Use credits — bought when something actually needs
> doing, rather than paid monthly for us to sit on standby.

**Build** — Small changes, new integrations, another automation.
**Assist** — Troubleshooting, repairs, configuration, support.
**Educate** — Training, workshops, documentation for your team.

Matches `13-credits/credit-types.md`. **No pack size or price is named**, because
neither is decided — see `13-credits`, which sets them against the first three
real quotes.

---

## 12. About

`src/components/sections/About.jsx`

> **H2** We aren't here to sell you a particular technology. We're here to
> understand the problem and build what makes the business work better.
>
> No reseller agreements, no migration upsell, no monthly retainer. Most of what
> we build runs inside the tools you already pay for — Microsoft 365, Google
> Workspace, your CRM, your booking system. If the answer is a licence you
> already hold, or an afternoon of training rather than a build, that is the
> answer we give you.
>
> Based in the UK. Working with businesses everywhere.

Cut from three paragraphs to one. "We are not an AI company" was dropped: it
defined the business by what it isn't, and the hero promise does that job
better.

---

## 13. Contact

`src/components/sections/Contact.jsx`

> **H2** Tell us what's getting in the way.
>
> A free 30-minute conversation about what's working, what's frustrating, and
> what you'd like to improve.
>
> `[ Book a discovery call ]`
>
> hello@nabl.agency

**Two removals.** The old sub offered to say when a problem "isn't worth it" —
honest, and the wrong note to end on, because it judges a problem we have not
heard. And "We typically respond within 4 hours" is gone: nothing measured it.

---

## 14. Discovery-call modal

`src/components/DiscoveryModal.jsx`

> **Eyebrow** Discovery call
> **H2** Let's find out what's possible.
> Free, 30 minutes, no pitch. Tell us a little and we'll come prepared.

Fields: Your name · Business name · Email · Business type (Retail, Professional
Services, Technology, Manufacturing, Healthcare, Finance, Other) · What's getting
in the way? (optional, placeholder "The report that takes all Monday, the inbox
nobody owns…")

Submit: **Book my discovery call** / "Sending…"

Success state:
> **You're on the list.**
> We'll be in touch to find a time. Nothing to prepare — just bring the thing
> that's getting in the way.

Errors:
> Something went wrong. Email hello@nabl.agency and we'll pick it up.
> Couldn't send just now. Email hello@nabl.agency and we'll pick it up.

---

## 15. Footer

`src/components/layout/Footer.jsx`

> We make your business work smarter. Technology implementation for small
> businesses.
>
> Innovation · Automation · Optimisation

**Company:** What We Do · How We Work · Pricing · About · hello@nabl.agency
**Legal:** Privacy Policy · Terms of Service · Cookie Policy · Client Portal

> © 2026 n.abl. All rights reserved. — Built for small business. No retainers.

The full stop in "n.abl." and the small square in the bottom-right corner are
both unlabelled routes into `/team`. Intentional. Do not label them, and keep the
square out of the tab order.

---

## 16. 404

`src/pages/NotFound.jsx` — unchanged by the realignment.

---

## Claims audit

Every factual assertion on the public site, and whether it can be supported.

| # | Claim | Where | Status |
|---|---|---|---|
| 1 | "We make your business work smarter" | Hero, footer | **Positioning, not a claim.** No measurable assertion |
| 2 | "Technology implementation for small businesses" | Hero eyebrow, footer | **True.** Describes what the business does |
| 3 | £240 → £40 per month, around £2,400 a year | Pricing | **Illustrative and labelled.** Arithmetic is visible and checkable; matches the master plan §3. The page says the reader's numbers come from their own business |
| 4 | 12 hours → 10 hours returned | In practice, card 1 | **Illustrative and labelled** by the component from `provenance` |
| 5 | "One set of numbers, current every morning" | In practice, card 2 | **Illustrative and labelled.** Deliberately unquantified |
| 6 | "The straightforward bookings take themselves" | In practice, card 3 | **Illustrative and labelled.** Deliberately unquantified |
| 7 | "No retainers" | Hero, pricing, credits, footer | **True.** Matches the commercial model in the master plan §3 |
| 8 | "You own what we build" | Credits | **True**, and stated in `04-legal`: bespoke work transfers on payment in full |
| 9 | Capability list — automation, data, software, web, AI, training | How we help, What we build | **Supportable.** Each is evidenced by software n.abl has built for itself: the site, portal, team space, CRM, email pack and document generator |
| 10 | Named tools (n8n, Power BI, Python, React…) | What we build | **Supportable**, and framed as what we work with rather than as certifications or partnerships. No vendor relationship is claimed |
| 11 | "Based in the UK. Working with businesses everywhere." | About | **True** |
| 12 | "Free, 30 minutes, no pitch" | Modal | **True**, and within the business's control to keep |
| 13 | Privacy: "We do not run advertising or analytics tracking" | `/privacy` | **True today.** If conversion measurement ships, this line must change in the same commit — the planned approach is first-party and cookieless, so the wording will narrow rather than reverse |
| 14 | Cookies: "no analytics cookies… nothing to consent to" | `/cookies` | **True today.** Same condition as 13 |
| 15 | Privacy: "n.abl is an automation consultancy" | `/privacy` | **RETIRED FRAMING.** Not false, but not the positioning. Open in the README's next actions |
| 16 | Terms: "consultancy, automation and optimisation services" | `/terms` | **RETIRED FRAMING**, and it reads as the pillars-as-offer structure. Open |

**Removed since the last audit:**

- "We typically respond within 4 hours" — contact section, discovery modal
  success state, and the generated client welcome pack. Nothing measured it.
- "…including when the honest answer is that it isn't worth it" — contact
  section. Judges a problem before hearing it.

**Never present, and must not appear:** client counts, savings totals,
testimonials, named clients, efficiency percentages, or any figure that is not
either the reader's own input or labelled illustrative arithmetic with visible
working.

---

## Rules for changing this copy

1. **No invented numbers.** A prospect can act on a number, so an invented one is
   a false claim rather than decoration.
2. **No client is named without written permission**, and no example is dressed
   to look like a client. Provenance lives in the data.
3. **The offer is problem-led.** If a new section describes disciplines or tools
   before it describes a problem, it is in the wrong place.
4. **The pillars are brand, never offer.** They may appear as a strapline or a
   band. They may not become navigation, service pages or something a client
   picks from.
5. **Never grade a problem before hearing it.** See `02-brand/brand-promise.md`
   §4.2 for the banned phrasings and the distinction that keeps honest refusal.
6. **Copy changes go through this deck**, in the same commit as the source.
