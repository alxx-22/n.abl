# Site map

What exists at `nabl.agency`, route by route and section by section. Recorded
from the application source on 2026-08-15.

The site is a React 18 + Vite single-page application deployed on Netlify.
Routing is client-side (`react-router-dom`), with a server-side fallback so any
URL serves the same shell. Source of truth for routes is `src/App.jsx`.

---

## Routes

| Route | Component | Public? | In the nav? | Purpose |
|---|---|---|---|---|
| `/` | `pages/Home.jsx` | Yes | Yes, the logo | The marketing page. Everything below in "Page structure". |
| `/privacy` | `pages/Legal.jsx` | Yes | Footer only | Privacy policy |
| `/terms` | `pages/Legal.jsx` | Yes | Footer only | Terms of service |
| `/cookies` | `pages/Legal.jsx` | Yes | Footer only | Cookie policy |
| `/portal` | `pages/Portal.jsx` | Sign-in | Yes, nav and footer | Client portal. Access-key sign-in. |
| `/team` | `pages/Team.jsx` | Sign-in | **No** | Internal team space. Supabase Auth. |
| `/sales-intelligence` | `pages/Crm.jsx` | Sign-in | **No** | Sales CRM |
| anything else | `pages/NotFound.jsx` | Yes | No | 404 |

Four of these are marketing surfaces. The other four are application surfaces
that happen to live at the same origin.

### Code splitting

`Home` and `NotFound` are imported directly. `Portal`, `Team`, `Crm` and `Legal`
are lazy-loaded (`src/App.jsx:9-12`), so a visitor who only reads the marketing
page never downloads the portal, team space or CRM bundles. Keep it that way:
importing any of those four eagerly would put the whole application in the
critical path of the home page.

`ScrollToTop` (`src/App.jsx:14-18`) resets scroll on every route change, because
client-side navigation otherwise keeps the previous scroll position.

### How the routes are served

`netlify.toml` and `public/_redirects` both carry the SPA fallback:

```
/*  ->  /index.html  200
```

Every URL therefore returns HTTP 200 with the same HTML shell, including URLs
that end up rendering the 404 page. A crawler sees one document for every path.
That is the root of the metadata problem described in `seo-and-metadata.md`.

Caching, from `netlify.toml`: `/assets/*` and `/fonts/*` are immutable for a
year; `/index.html` is `no-cache` so a redeploy is picked up immediately.

---

## The two unlabelled routes into `/team`

Both are deliberate and documented in `src/components/layout/Footer.jsx:4-8`:

1. The full stop inside "© 2026 n.abl." is a link to `/team`, styled to read as
   punctuation (`Footer.jsx:47`).
2. A 6px accent square pinned to the footer's bottom-right corner
   (`Footer.jsx:54`), kept out of the tab order with `tabIndex={-1}`.

They are hidden from a human reader. They are not hidden from a crawler: both
are real anchors in the DOM, so `/team` is discoverable by anything that follows
links. That is the reason `robots.txt` is on the next-actions list in the
README. It is a tidiness problem, not a security one — the team space is
protected by Supabase Auth, not by being hard to find.

---

## Page structure — `/`

Sections in scroll order. IDs are the anchor targets used by the nav, the footer
and the scroll rail.

| # | `id` | Chapter label | What it holds |
|---|---|---|---|
| 1 | `hero` | Start | Eyebrow, headline, sub, two calls to action, scroll cue |
| 2 | `what-we-do` | What we do | The six problem-led category cards |
| 3 | `toolkit` | The toolkit | Six rows of capability chips, grouped by purpose |
| 4 | `how-we-work` | How we work | Three steps: understand, build, hand over |
| 5 | `pricing` | What it costs | Two pricing cards, the worked example, the credits block |
| 6 | `cases` | In practice | Three example cards, labelled as examples |
| 7 | `about` | About | The positioning statement, in the first person |
| 8 | `contact` | Let's talk | The closing question, the discovery-call button, the email address |

Chapter labels come from `CHAPTERS` in `src/components/Journey.jsx:11-20` and
drive the fixed scroll rail. **If a section `id` changes, the rail, the nav and
the footer all have to change with it.** Three of the eight were renamed in the
repositioning: `your-systems` became `toolkit`, `impact` became `pricing`, and
the pillars section kept its `id` but changed its contents entirely.

### The six categories

From `CATEGORIES` in `src/pages/Home.jsx:18-31`. Each has a number, a glyph, a
title and a one-line tag written as the client's own complaint.

| # | Title | Tag | Glyph |
|---|---|---|---|
| 01 | Save time | The job that eats your week | `time` |
| 02 | Reduce mistakes | The thing that keeps going wrong | `accuracy` |
| 03 | Get more customers | The enquiries you never followed up | `customers` |
| 04 | Build something new | The thing you do not have yet | `build` |
| 05 | Train your team | The software you already pay for | `train` |
| 06 | Fix something | The bit that broke | `fix` |

The glyphs are drawn in `CategoryGlyph` (`src/components/Visuals.jsx:105-183`),
one per category, in a single geometric language: true circles, one stroke
weight, one solid accent dot. They replaced three glyphs for three disciplines.

These six are the master plan's six categories in the master plan's order. They
are not a design choice made on the site, and they should not be reordered or
renamed here without changing `01-positioning` first.

### The toolkit rows

From `TOOLKIT` in `src/pages/Home.jsx:36-43`. Grouped by what a job needs, not
by vendor.

| Row | Chips |
|---|---|
| Automation & integration | Make, Zapier, n8n, Power Automate, Custom scripts |
| Custom software | Python, JavaScript, React, APIs, SQL databases |
| Web & customer-facing | Websites, Booking flows, Payments, Client portals |
| Data & reporting | Spreadsheets done properly, Power BI, Dashboards, Data cleaning |
| AI, where it earns its place | Document handling, Drafting, Classification, Assistants |
| What you already pay for | Microsoft 365, Google Workspace, Your CRM, Your booking system |

Every chip is a capability claim. The old list was a Microsoft-and-SAP CV, which
described where the founders came from rather than what a small business needs.
Do not add a chip for something that cannot actually be delivered.

---

## Navigation

**Header** (`src/components/layout/Nav.jsx:5-11`) — five anchors plus one route:

`What We Do` · `How We Work` · `Pricing` · `About` · `Let's Talk` · **Client
Portal** (button, to `/portal`)

The header collapses to a full-height sheet below the mobile breakpoint. The
sheet locks body scroll while open. When closed it is translated off to the
right **and** set `visibility: hidden` (`src/styles/components.css:154-174`).
The visibility is the part that matters: with the transform alone the sheet
stayed in the layout, widened the document by its own width — giving every phone
page a sliver of sideways scroll — and left its links focusable and readable to
a screen reader behind a menu nobody had opened.

**Footer** (`src/components/layout/Footer.jsx`) — three columns:

| Column | Contents |
|---|---|
| Brand | Logo, and the one-line description of what n.abl is |
| Company | What We Do, How We Work, Pricing, About, `hello@nabl.agency` |
| Legal | Privacy Policy, Terms of Service, Cookie Policy, Client Portal |

Base line: the copyright, with the hidden team dot, and "Built for small
business. No retainers."

---

## The discovery-call form

`src/components/DiscoveryModal.jsx`. Opened from two buttons on the home page —
the hero and the contact section — and from nowhere else. There is no dedicated
contact page.

Fields: name (required), business name (required), email (required), business
type (required, seven options), and a free-text "What's eating your time?".

Submission posts JSON to `https://api.web3forms.com/submit` with a public form
token. That origin is one of only two permitted by the CSP `connect-src` — the
other is the Supabase project. Anything else the page tries to reach is blocked
by the browser.

The dialog traps focus, closes on Escape, restores focus to whatever opened it,
and locks body scroll while open. On failure it tells the visitor to email
`hello@nabl.agency` rather than swallowing the error.

---

## The legal pages

One component, three documents, selected by the `doc` prop
(`src/App.jsx:38-40`). Each renders: an eyebrow, a title, an intro, the
draft-review notice, the body sections, a contact block, the last-updated date,
and a nav between the three documents.

| Document | Sections |
|---|---|
| Privacy Policy | Who we are · What we collect and why · Lawful bases · Service providers · International transfers · How long we keep it · Your rights · Security |
| Terms of Service | Services · Engagement and quotes · Your responsibilities · Fees and payment · Intellectual property · Confidentiality · Warranties and disclaimers · Limitation of liability · Termination · Governing law |
| Cookie Policy | The short version · What we do store · Third parties · Controlling storage |

Every one of them renders this notice, and it stays:

> **Draft — not yet reviewed.** This document is a starting point drafted for
> n.abl, not legal advice. It must be reviewed and approved by a qualified
> solicitor before you rely on it or publish it as binding.

Two sentences on these pages still carry the retired positioning. They are
listed as the first next action in the README.

Ownership of these documents belongs to `04-legal`. The site only renders them.

---

## Motion and accessibility

All motion respects `prefers-reduced-motion`, checked through one shared helper
(`prefersReducedMotion` in `src/components/ui/index.jsx`). With reduced motion
set: the intro curtain never appears, the reveal animations resolve immediately,
the stat counters render their final value rather than counting, and the hero
parallax does not attach a scroll listener.

Decorative elements — the node field canvas, the hero glow, the horizon, the
glyphs, the intro mark — are all `aria-hidden`.

The scroll rail is a navigation aid, not the navigation. Everything it points at
is reachable from the header and the footer.
