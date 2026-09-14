# SEO strategy, September 2026

What would actually move search for n.abl, in order, and what would not.

Companion to [`seo-and-metadata.md`](seo-and-metadata.md), which inventories the
tags. This file asks the different question: given a new domain, no links, one
page and no premises, what is worth doing at all.

**Recorded 14 September 2026.** Findings measured against the live site and
current published guidance; sources at the end.

---

## 1. The finding that matters

**nabl.agency serves no readable text to anything that does not run JavaScript.**

Measured against the live homepage on 14 Sep 2026:

```
GET https://nabl.agency/   →  200, 2,583 bytes
<body> contents:              29 bytes
visible text after stripping tags:  0 characters
```

Twenty-nine bytes is `<div id="root"></div>` and a script tag. Roughly 41 KB of
copy across `Home.jsx` and the components exists only after React boots.

`seo-and-metadata.md` §"What is missing" 2 anticipated this and judged
prerendering not worth it — *"Not worth doing for three legal pages that nobody
searches for."* That reasoning was correct about the legal pages and did not
consider the home page, which is in exactly the same state. `build-routes.mjs`
solved the **head** per route. It does not render the **body**.

### Why this costs more in September than it did in August

| Crawler | Executes JavaScript? |
|---|---|
| Googlebot | Yes — the only major crawler with full JS rendering |
| Google AI Overviews | Yes, inherits Googlebot's rendering |
| Microsoft Copilot | Yes, inherits Bing's |
| GPTBot / OAI-SearchBot / ChatGPT-User | **No** |
| ClaudeBot / Claude-User | **No** |
| PerplexityBot / Perplexity-User | **No** |
| CCBot, Bytespider | **No** |

Vendor documentation through Q2 2026 confirms no major AI crawler executes
JavaScript. They fetch raw HTML, extract what they find, and do not come back.

So the current position is not "Google will get there eventually, which is fine".
It is: **Google and Copilot can read the site; ChatGPT, Claude and Perplexity
cannot see a single word of it.** For a business whose buyers increasingly ask an
assistant "who does this kind of work near Nottingham", that is the whole shop
window boarded up on one side.

It also interacts badly with how citation now works. The 2026 signal set for
local service businesses is entity authority, structured data, Google Business
Profile completeness and *passage-level content clarity* — and there are no
passages to extract from an empty body.

**Recommendation: prerender the public routes.** Not a framework change.
`build-routes.mjs` already writes one shell per route after the build; extending
it to inject `renderToStaticMarkup` output into `<div id="root">` is the same
pattern one step further. React hydrates over it and nothing on screen changes.
Effort: a few hours. This is the highest-value change available.

---

## 2. What has shipped since August, and is now correct

Checking the August checklist against the repository rather than assuming:

- [x] `public/robots.txt`, disallowing `/team`, `/sales-intelligence`, `/portal`
- [x] `public/sitemap.xml` with the four public URLs
- [x] Per-route title and description — done better than proposed, at build time
      in `build-routes.mjs` rather than at runtime in React
- [x] `<link rel="canonical">` per public route — verified present in
      `dist/index.html` and `dist/privacy/index.html`
- [ ] `og:site_name` and `og:image:alt` — still absent
- [ ] `lang="en-GB"` — still `lang="en"`
- [ ] Structured data — still absent

Four of seven done, and the two hardest done properly. The August work stands up.

---

## 3. The blocker that is not a code problem

**There is no trading address.** `04-legal`, `16-finance` and the outreach
templates all carry `[PLACEHOLDER]` where it goes, and the first-contact drafts
carry an unfilled `{{POSTAL_ADDRESS}}` token precisely because inventing one is
not allowed.

This blocks the single highest-leverage item in local search. A Google Business
Profile is what puts a business in the map pack, and the map pack — not the AI
Overview — still answers the majority of local intent: AI Overviews appear in
roughly 7% of local searches, while "X near me" still returns three businesses
with reviews, a phone number and a distance.

Google permits a **service-area business** to hide its address publicly — which
solves the residential-address objection — but it still requires a real address
on the back end for verification, and explicitly rejects PO boxes and virtual
offices. A mailbox rental invites suspension.

So this is a business decision that gates a marketing channel, and it sits with
`16-finance`'s sole-trader-versus-limited-company question. Until it is made,
n.abl cannot appear in the map pack at all, and no amount of on-page work
substitutes.

---

## 4. The honest strategic position

`seo-and-metadata.md` already says the important thing and it is still true:

> n.abl has no domain history, no inbound links and no content beyond one
> marketing page. Search is not going to be a meaningful source of work for a
> long time, and no amount of metadata changes that.

Nothing found in this research contradicts it. What the research does change is
the *reason* to do the work anyway:

1. **The site is the landing point for outreach.** Every drip letter and every
   referral ends with someone typing `nabl.agency`. That traffic is not search
   traffic, but it is judged by the same page.
2. **Assistant answers are now a discovery surface**, and unlike rankings they
   are winnable early by a small, clear, well-marked-up site — there is no
   link-authority moat to climb first. Presently n.abl is not merely unranked
   there; it is unreadable.
3. **The work is cheap and permanent.** Prerendering and structured data are
   done once and keep paying.

What is *not* worth doing: chasing keywords. Nobody searches "technology
implementation partner", and one page cannot rank for "automate invoices
Nottingham" against agencies with a decade of links. Ranking for problem terms
needs a page per problem, each a real piece of writing — a content commitment
measured in months, which `seo-and-metadata.md` correctly says should wait until
there is delivered work to write about. That judgement stands.

---

## 5. Recommendations, in order

| # | Action | Effort | Why this position |
|---|---|---|---|
| 1 | **Prerender the four public routes** into real HTML, extending `build-routes.mjs` | Hours | Unlocks every AI crawler at once; nothing else works until the body has words in it |
| 2 | **Add JSON-LD** — `ProfessionalService` (a `LocalBusiness` subtype) plus `Organization`, matching visible copy exactly | ~1 hour | Pages with complete entity markup are cited by ChatGPT, Perplexity and Gemini at measurably higher rates. Depends on #1 being real content to match |
| 3 | **Settle the trading address**, then open a Google Business Profile as a service-area business with the address hidden | Business decision | The map pack still answers most local intent, and it is shut until this exists |
| 4 | **Finish the August checklist** — `og:site_name`, `og:image:alt`, `lang="en-GB"` | Minutes | Cheap, and #4 makes the share card correct for the outreach that is about to start |
| 5 | **Decide the AI-crawler posture explicitly** in `robots.txt` | Minutes | It currently names no AI agent, so the answer is "whatever the default is" — see §6 |
| 6 | **NAP consistency** once the address exists — identical name, address and phone on site, GBP, Companies House and every directory | Ongoing | Citation quality now outranks citation quantity, and minor variants ("St" vs "Street") actively confuse matching |
| 7 | **Reviews**, from the first delivered client onward | Ongoing | The strongest local differentiator, and it waits on `17-proof` like everything else |
| 8 | **A page per problem** | Months | Only once there is delivered work to write about. Not now |

Items 1, 2, 4 and 5 need nobody's permission and no money.

---

## 6. Two things to check, not assume

**Cloudflare's AI crawler defaults changed on 15 September 2026** — the day
after this was written. New sites and all existing free-plan customers get
agent and training crawlers blocked by default, though reportedly only on pages
that display ads. nabl.agency serves no ads, so it most likely does not bite.
Worth *looking at* the Security setting rather than reasoning about it, because
being invisible to assistants by an unread default would waste every hour spent
on item 1.

**Whether `llama-3.3-70b` is still Groq free-tier eligible** — unrelated to SEO,
recorded in `11-outreach/personalisation-and-hooks.md` §7, repeated here only
because both are "check the dashboard" jobs for the same sitting.

---

## 7. Decisions that must survive this

The existing deliberate choices in `seo-and-metadata.md` are not obstacles to
the above and must not be traded away for it:

- **No analytics.** The cookie policy's claim that there is nothing to consent
  to is worth more than the data at this traffic. Prerendering does not need it.
- **Self-hosted fonts.** Item 1 changes nothing here.
- **Strict CSP.** `script-src 'self'` blocks every marketing widget by design.
  JSON-LD is inline data, not script execution, and is unaffected — but any SEO
  tool that wants a tag on the page is refused, and that is correct.
- **No name on outreach.** Unrelated to SEO, and stated here because "improve
  our marketing" conversations are exactly where it gets quietly undone. See
  `11-outreach/personalisation-and-hooks.md` §1.

---

## Sources

- [Most AI Crawlers Still Don't Render JavaScript in 2026](https://hybridranking.com/blog/most-ai-crawlers-dont-render-javascript-2026)
- [Do AI Crawlers Render JavaScript? GPTBot, ClaudeBot, and Perplexity in 2026](https://searchoptimo.com/blog/do-ai-crawlers-render-javascript)
- [JavaScript Rendering and AI Crawlers: Can LLMs Read Your SPA?](https://www.getpassionfruit.com/blog/javascript-rendering-and-ai-crawlers-can-llms-read-your-spa)
- [AI Impact on Local SEO: What Changed in 2026](https://localo.com/blog/ai-impact-local-seo)
- [Google AI Mode Local SEO 2026: Guide for Trades & Service Businesses](https://thevalleymarketinggroup.com/blog/google-ai-mode-local-seo-service-businesses-2026/)
- [Service Area Business: Google Business Profile Guide 2026](https://rankai.ai/articles/service-area-business-google-business-profile-guide)
- [How to set up & optimise Google Business Profile in the UK (2026)](https://birdeye.com/blog/google-my-business-uk/)
- [Structured Data for AI Citations: The 2026 Guide](https://www.llmreach.ai/blog/implement-structured-data-for-ai-2025-guide)
- [Schema Markup Guide: SEO and AI Search in 2026](https://discoverability.co/resources/schema-markup-guide/)
- [Cloudflare Blocks AI Crawlers by Default on 15 September 2026](https://crawl-lab.com/en/blog/robots-txt/cloudflare-blocks-ai-crawlers-september-2026/)
- [The Complete Local SEO Guide (2026 Edition)](https://www.resultfirst.com/blog/local-seo/local-seo-guide/)
