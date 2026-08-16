# Website changelog

What has changed on the public site, newest first. Commit hashes are from this
repository, so any entry can be read in full with `git show <hash>`.

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
