# 03 — Website

```
Status:       in progress
Owner:        Alex
Next review:  after 10 qualified conversations, or on the first real case study
Evidence:     src/pages/Home.jsx + src/components/sections/, copy-deck.md,
              the scored lead sheet once it exists
```

The site is built, deployed, and ordered as a buyer's journey. What it does not
yet have is any proof, any discoverability, any measurement, or a lead-capture
path anybody has tested end to end.

**The definition of done changed, and that is why this folder is no longer
`done`.** It used to read:

> Done = the site says the right thing

It now reads:

> **Done = the site is ready to perform as a sales asset.**

The old definition was satisfiable by writing. The new one is not, and the
difference is the point: work is not done because the code shipped.

| Component | Status |
|---|---|
| Messaging | ✓ |
| Brand | ✓ |
| Structure | ✓ revised to the buyer's journey |
| Proof | ✗ unavailable — no clients yet. The only honest gap |
| SEO | ✓ robots, sitemap, per-route metadata and canonicals |
| Conversion measurement | ✓ first-party, cookieless, instrumented |
| Legal consistency | ✓ retired positioning gone from every public surface |
| Lead capture | ⚠ instrumented and spam-protected, but never tested end to end by a human |

Last substantive revision: 2026-08-16.

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

Done = **the site is ready to perform as a sales asset.** Eight components,
each with an honest state. Four are true. Four are not, and no amount of writing
closes them.

### Messaging ✓

- [x] The offer is the six corrected problem categories: save time, reduce
      mistakes, understand your data, build something new, train your team, fix
      something.
- [x] Lead generation appears nowhere as a customer offer. "Get more customers"
      is removed from the site, the master plan and the positioning folder.
- [x] Automation and Data & Analytics are first-class named capabilities, not
      buried in a tool list.
- [x] No judgemental or gatekeeping framing. The site never grades a problem
      before hearing it.

### Brand ✓

- [x] The hero leads with the promise, "We make your business work smarter",
      with the descriptor as the eyebrow.
- [x] Innovation · Automation · Optimisation appears as brand framing — the band
      under the hero and the footer strapline — and organises nothing.
- [x] The visual identity is unchanged. `src/styles/tokens.css` has no diff:
      no new colour, type step, radius, easing or duration.

### Structure ✓

- [x] The page follows the buyer's journey: promise, pillars, your problem, how
      we help, method, capability, evidence, price, credits, trust, ask.
- [x] The chapter rail, anchors and heading hierarchy survive the reorder.
      Reduced-motion behaviour is intact: every reveal resolves visible.
- [x] Each section is its own component in `src/components/sections/`, so the
      order of the page is legible from `Home.jsx` alone.

### Proof ✗ — unavailable

- [ ] There is no proof on the site. No named client, no testimonial, no
      measured outcome.
- [x] Every example is labelled illustrative **by the component that renders
      it**, from a `provenance` field in the data rather than from copy.
- [x] A real case replaces an illustrative one one-for-one as a data change.
      Process in `17-proof-and-case-studies`.

This is the honest gap. It closes when there is a first delivery, not before.

### SEO ✓

- [x] `public/robots.txt` disallows `/team`, `/sales-intelligence` and `/portal`
      and points at the sitemap. Tidiness, not security — the sign-in is the
      access control.
- [x] `public/sitemap.xml` lists the four public URLs.
- [x] Per-route metadata. `scripts/build-routes.mjs` writes a shell per public
      route after the Vite build, each with its own title, description, og tags
      and canonical. Rewrite rules are explicit and ahead of the catch-all.
- [x] The shared metadata and the generated share card carry the current hero.

### Conversion measurement ✓

- [x] Both CTAs, the email link, the form's four states and section reach depth
      are recorded.
- [x] First-party and cookieless: events go to our own Supabase project inside
      the existing CSP. No third-party request, no cookie, no storage, no IP, no
      fingerprint, no identifier surviving the tab. Do Not Track honoured.
- [x] Both legal pages updated in the same commit, so they stay true.
- [ ] Nobody has read the data yet. The first review is the next action.

**What this cannot answer:** unique visitors, returning visitors, anything
across sessions. That is the price of collecting nothing that identifies anyone,
and it was the right trade for a site whose privacy position is a
differentiator.

### Legal consistency ✓

- [x] The privacy policy and terms describe technology implementation. The
      retired "automation consultancy" framing is gone from every public
      surface, including the welcome-pack generator's model prompt.
- [x] The draft-review notice is present on all three documents. **No legal
      document here has been reviewed by a solicitor. Never say one has.**

### Lead capture ⚠ — instrumented, not validated

- [x] A honeypot rejects scripted submissions, off-screen and out of the tab
      order, showing the success state rather than an error so a bot gets no
      signal.
- [x] The form has a confirmation state, a focus trap and an error path, and all
      four outcomes are now measured.
- [ ] **Nobody has confirmed end to end that a submission reaches a human.**
      This needs a person to fill the form on the live site and check the inbox.
      It is the last thing on this list that cannot be done from the repository.

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
- [x] ~~**Decide on the four-hour response claim.**~~ Removed, 2026-08-16. It
      appeared in the contact section, the discovery modal's success state and
      the generated welcome pack. Nothing measured it, and an unmeasured promise
      on a page selling reliability is a bad trade. If a response time is ever
      offered again it is a priced commitment, measured, and named as one —
      see `13-credits`, which is explicit that credits buy work and not standby.
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
