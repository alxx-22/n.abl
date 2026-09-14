# SEO work, 14 September 2026 — what was done and what is yours

Read this first. It is short on purpose; the reasoning lives in
[`seo-baseline-2026-09-14.md`](seo-baseline-2026-09-14.md) and
[`seo-strategy-2026-09.md`](seo-strategy-2026-09.md).

---

## 1. What was wrong

The site was invisible to anything that does not run JavaScript. Measured, not
inferred:

```
GET https://nabl.agency/  ->  200, 2,583 bytes
<body> contents:               29 bytes
visible text:                  0 characters
```

Googlebot runs JavaScript, so Google could read it. **GPTBot, ClaudeBot and
PerplexityBot do not, and do not come back.** The site was legible to Google and
blank to every AI assistant.

It also could not be found searching for its own domain name or its own hero
headline, which is what you would expect of a page with no text in it.

---

## 2. What changed

| Change | Effect |
|---|---|
| **Build-time rendering** of the four public routes | Home page went from **0 to 7,844 characters** of readable text. Legal pages 4–11 KB each |
| `html_handling: drop-trailing-slash` | `/privacy` now answers 200 instead of 307-redirecting to `/privacy/`. The sitemap pointed at a redirect, and the page it reached declared the redirecting URL as its canonical |
| **JSON-LD** `ProfessionalService` | States that n.abl is a specific business serving Nottinghamshire and Alcester, rather than leaving a search engine to guess between four other organisations called NABL |
| `lang="en-GB"`, `og:site_name`, `og:image:alt` | Closes the last three items on the August checklist |
| `robots.txt` | Records why AI crawlers get no named group — a named group would *replace* the wildcard's Disallow rules, not add to them, and make `/crm` crawlable |
| **`scripts/check-seo.mjs`** | 29 assertions, run as the last step of `npm run build`, so a shell that ships empty fails the build rather than the deploy |

Verified in Chromium: all four routes render with no console errors, and
client-side navigation still works.

---

## 3. Four things only you can do

Nothing below is blocked on code. All four are free.

### 1. Verify Search Console — ten minutes, highest value on this list

There is **no impressions data for n.abl at all**, because nobody has verified
the property. Everything anyone says about how the site performs in search,
including everything in my baseline, is inference from third-party tools in the
wrong region.

Use a **DNS TXT record**, not an HTML file — it survives a host move, and this
site has already moved host once.

Then request indexing for the four public URLs. They have just changed from
empty to substantial and Google will not know unless asked.

### 2. Deploy

None of §2 is live yet. It is committed and pushed, and the build passes, but
the site still serves the old shells until you deploy.

```sh
npm run build          # includes the 29 SEO checks
npx wrangler deploy
npm run test:seo:live  # same checks against the deployed site
```

`test:seo:live` also confirms GPTBot and ClaudeBot get content, which is the
check that would catch Cloudflare's AI-crawler defaults quietly undoing this.

### 3. Settle the trading address

This blocks the **Google Business Profile**, which is what puts a business in the
map pack — and the map pack still answers most local searches, where AI
Overviews appear in only about 7%.

A service-area business may hide its address publicly, so your home address need
not be on the internet. Google still needs a real one to verify, and rejects PO
boxes and virtual offices.

`04-legal` and `16-finance` both carry `[PLACEHOLDER]` for this, and it is tied
to the sole-trader-versus-limited-company decision. When it is filled in, add
`address` to the JSON-LD in `index.html` — the comment there says exactly where,
and `check-seo.mjs` currently asserts its *absence*, so you will need to remove
that one line in the same commit.

### 4. Connect the Search Console reporting script

`scripts/seo-report.mjs` is written and works; it needs a credential.

```sh
export GSC_KEY_FILE=~/nabl-search-console.json
npm run seo:report
npm run seo:report -- --days 90 --out business/03-website/search-2026-10.md
```

Setup is in the file's header: service account, JSON key kept outside the repo,
added as a Full user in Search Console. Until then the script explains what it
needs and exits 0 rather than failing anything. No new npm dependency — it signs
its own JWT with `node:crypto`, because `googleapis` is 50 MB for two HTTPS
calls.

---

## 4. The finding you will not like

Searching the exact string `"nabl.agency"` returns, in order: a Berlin marketing
agency at `nabl-agency.de`, `nabl.ai`, the National Association of Bond Lawyers,
and India's National Accreditation Board. Not n.abl.

**"n.abl" and "nabl" are heavily contested**, including by an agency in an
overlapping industry that sells SEO. The full stop that makes the name
distinctive to a human is invisible to a search engine.

This is not fixable with better markup, and I am not going to pretend otherwise.
What follows from it:

- Brand search is not a cheap win. Most new businesses can at least rank for
  their own name; you will have to earn it.
- Everything that helps a search engine understand n.abl as a **specific local
  entity** — structured data, a Google Business Profile, consistent name/address
  /phone across the web — is worth more here than it would be for an
  uncontested name. Two of those three are now done or unblocked.
- The realistic near-term search win is **"technology implementation
  Nottingham"**-shaped local intent, not the brand. That needs the Business
  Profile, and eventually a page per problem.

Whether the name is worth reconsidering is a business question well outside this
task, and I mention it only because the data is unambiguous and you should see it
before more is built on top of the name.

---

## 5. What I deliberately did not do

- **Did not touch the analytics decision.** Still none, still no consent banner,
  still a genuinely differentiating sentence in the cookie policy.
- **Did not add hydration.** `main.jsx` still calls `createRoot`, which discards
  the prerendered markup and renders fresh. `hydrateRoot` would be faster, but
  `Home.jsx` seeds state from `prefersReducedMotion()` — false at build time,
  possibly true in the browser — and repairing that mismatch would fall on the
  users least able to tolerate a flicker. The markup is for readers who never run
  the script; speeding it up for everyone else is a separate change with its own
  risks. `src/prerender.jsx` records this.
- **Did not bump `lastmod` in the sitemap.** The content did not change, only its
  delivery. Inflating `lastmod` is how a site teaches Google to ignore the field.
- **Did not write service pages.** `seo-and-metadata.md` says content should wait
  until there is delivered work to write about. That judgement still holds and
  this does not change it.
- **Did not add a dependency.** Not for rendering, not for the Search Console
  client.

---

## 6. What was actually verified

Not "should work" — observed. Everything here was run before the work was
committed.

| Check | Result |
|---|---|
| `npm run test:ui` (Playwright, full suite) | **90 passed, 0 failed** |
| `npm run test:routes` (`wrangler dev --local`) | **17 passed, 0 failed** — `/crm`, `/portal`, `/team` still get the shell |
| `npm run test:seo` | **29 passed** |
| All four routes in Chromium | Render, no console errors, nav links intact |
| Trailing-slash fix, under `wrangler dev` | `/privacy` → **200**; `/privacy/` → 307 → `/privacy`. The reverse of before, and now matching the sitemap |
| `/privacy` text without JavaScript | **8,777 characters** |
| JSON-LD against the real CSP (`script-src 'self'`) | **Survives** — parsed from the DOM, no violations, app still boots |
| Build determinism | Two consecutive builds, identical MD5 |
| Secrets in prerendered HTML | None. The only match was the word "Web3Forms" in the privacy policy, which is a named processor and meant to be public |

The checks were also verified to be capable of failing, which is the part people
skip. Reintroducing the original bug — emptying `<div id="root">` — fails
`check-seo.mjs` with exit 1, and pointing a canonical at the wrong page fails it
too. A check that has never been seen to fail is a check nobody should trust.

The CSP one was worth doing. JSON-LD is an inline `<script>` and the site's
policy is `script-src 'self'` with no `'unsafe-inline'`. The spec says a
non-JavaScript MIME type is a data block and is not blocked, but a silently
blocked entity block would have undone the structured-data work with no visible
symptom, so it was tested rather than trusted.

---

## 7. Re-measuring

```sh
npm run test:seo        # built output
npm run test:seo:live   # the deployed site, plus crawler access and sitemap
npm run seo:report      # what Google actually recorded, once §3.1 is done
```

The baseline to beat is in `seo-baseline-2026-09-14.md` §7, with the raw commands
to reproduce it.
