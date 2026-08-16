# 03 — Website

**Status: done.** The public marketing site is built, deployed and rewritten to
the six problem-led categories. The three pillars are gone from the offer
structure, the invented impact metrics are deleted, and the case cards state
plainly that they are examples rather than clients.

"Done" means the site now says the right thing. It does not mean the site has
anything to prove it. There is no client work to point at and no testimonials,
because there are no clients yet. That gap is real and it is not closed by
writing better copy.

Last substantive revision: 2026-08-15.

---

## What this step is for

The public marketing site at `nabl.agency`. One page of marketing copy, three
legal pages, and the entry points into the client portal and the internal team
space.

The site is the only thing a prospect sees before they speak to anyone. Its job
is narrow: make a business owner recognise their own problem in it, and make the
next step obvious. It is not a brochure for the technology.

**This step is not** the positioning itself (`01-positioning`), the visual
identity (`02-brand`), the legal wording (`04-legal`), the portal
(`05-portal`) or the team space (`06-team-space`). It consumes all of those.

The code lives in the application, not in this folder:

| Path | What it holds |
|---|---|
| `src/pages/Home.jsx` | Every word of the marketing page, and the page structure |
| `src/components/layout/Nav.jsx` | Nav links |
| `src/components/layout/Footer.jsx` | Footer copy and the two unlabelled team routes |
| `src/components/DiscoveryModal.jsx` | The discovery-call form and its copy |
| `src/components/Journey.jsx` | The scroll rail and its chapter labels |
| `src/components/Visuals.jsx` | The six category glyphs, the node field, the horizon |
| `src/pages/Legal.jsx` | Privacy, terms, cookies |
| `index.html` | Title, description, Open Graph, Twitter card, font preloads |
| `netlify.toml` | Build, SPA fallback, cache and security headers |

---

## What "done" looks like

Ten statements. All ten are true today.

- [x] The offer on the page is the six problem-led categories from the master
      plan: save time, reduce mistakes, get more customers, build something new,
      train your team, fix something.
- [x] Innovation / Automation / Optimisation no longer organises anything. It is
      not in the nav, the sections, the cards or the footer.
- [x] The hero leads with the problem, not the technology: "Tell us what's
      costing you. We build the fix."
- [x] The invented metrics are deleted. There is no "47 businesses transformed",
      no "£2.1M client savings", no "3x average efficiency improvement" anywhere
      in the repository.
- [x] That slot now carries pricing: the two pricing categories, the worked
      example, and credits instead of a retainer.
- [x] The worked example matches the master plan exactly — £240 a month becomes
      £40, saving £200 a month and £2,400 a year — and is labelled on the page as
      illustrative arithmetic rather than an average of past work.
- [x] The case cards carry no client attribution and the section says outright
      that they are examples, not a client list.
- [x] The toolkit section is grouped by what a job needs rather than by vendor,
      and says plainly that most of what gets built is ordinary software.
- [x] "No retainers" appears in the pricing section, the credits block and the
      footer, and matches the commercial model in the master plan.
- [x] The site is a React 18 + Vite SPA on Netlify with the app surfaces code
      split, so a marketing visitor never downloads the portal, team or CRM
      bundles.

What is **not** claimed:

- There is no proof on the site. No named client, no testimonial, no measured
  outcome. Every example is illustrative and says so.
- The site has no per-route metadata. Every URL serves the home page's title and
  description in the static shell. See `seo-and-metadata.md`.
- There is no `robots.txt` and no `sitemap.xml`.
- The public legal pages still describe n.abl as "an automation consultancy".
  That is the retired framing surviving on a public page.
- Nothing here has been checked against real visitor behaviour. There is no
  analytics on the site by design, so "does this page work" is currently a
  question answered by conversations, not data.

---

## Next actions — do these in order

Each one is a closed job. None of them reopens the copy rewrite.

- [ ] **Fix the retired framing on the public legal pages.**
      `src/pages/Legal.jsx:17` says "n.abl is an automation consultancy based in
      the United Kingdom" and `src/pages/Legal.jsx:62` sells "consultancy,
      automation and optimisation services". Both are public. Change the wording
      to the technology implementation partner framing. This is a copy change,
      not a legal one, so it does not need `04-legal` to move first — but tell
      that folder it happened. The draft-review notice stays exactly as it is:
      no document here has been reviewed by a solicitor.
- [ ] **Add `public/robots.txt` and decide what gets indexed.** There is no
      robots file at all today, and the footer carries two crawlable links into
      `/team`. Disallow `/team`, `/sales-intelligence` and `/portal`; allow the
      four public URLs. Note that a `robots.txt` disallow hides the route from
      crawling, not from anyone who reads the HTML — it is tidiness, not
      security. The access control is the sign-in.
- [ ] **Give the four public routes their own title and description.** The SPA
      serves one shell, so `/privacy`, `/terms` and `/cookies` all report the
      home page's title and description to anything that does not run
      JavaScript. Options and the recommendation are in `seo-and-metadata.md`.
- [ ] **Add `public/sitemap.xml`** listing `/`, `/privacy`, `/terms` and
      `/cookies`. Four URLs, hand-written, no generator needed.
- [ ] **Decide on the four-hour response claim.** "We typically respond within
      4 hours" appears in the contact section, and the discovery modal promises
      the same on success. Nothing measures it. Either commit to it and meet it,
      or soften it to something that will still be true on a bad week.
- [ ] **Replace one example with a real case, once there is one.** Not before.
      When there is a client willing to be named, the card carries their name
      with written permission and a number they agree with. Until then the cards
      stay labelled as examples, and the section keeps the sentence that says so.

After those five, this folder is closed until either the positioning changes or
there is real proof to put on the page.

---

## What each file in this folder is for

| File | What it is for | Read it when |
|---|---|---|
| `README.md` | This file. Status, what done means, what to do next. | You are opening the folder cold. |
| `site-map.md` | Every route, every section, the nav and footer structure, what is public and what is not, and how the SPA is served. | You need to know what exists and where, or you are adding a page. |
| `copy-deck.md` | The live copy, recorded verbatim with its source location, plus a claims audit of every factual statement on the page. | You are changing any word on the site, or checking whether a claim is true. |
| `seo-and-metadata.md` | The metadata that ships today, the gaps, and the decisions behind them — including why there is no analytics and no third-party font. | You are working on discoverability, sharing previews or indexing. |
| `changelog.md` | What changed on the site, when, and why. Newest first, with commit hashes. | You are trying to work out when something changed, or you have just changed something. |

---

## The rules that hold on this site

1. **No invented numbers.** A prospect can act on a number, so an invented one
   is a false claim rather than decoration. Every figure on the page is either
   arithmetic the reader can check or labelled as illustrative.
2. **No client is named without written permission**, and no example is dressed
   to look like a client.
3. **The offer is problem-led.** If a new section starts describing disciplines
   or tools before it describes a problem, it is wrong.
4. **No third-party requests.** Fonts are self-hosted, there is no analytics,
   no tag manager and no CDN. The CSP in `netlify.toml` permits `connect-src`
   only to Supabase and Web3Forms, so anything else added to the page will be
   blocked by the browser rather than failing quietly.
5. **Copy changes go through `copy-deck.md`.** The point of the deck is that a
   wording change is reviewable without reading JSX.
