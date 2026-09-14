# SEO baseline, 14 September 2026

Where n.abl actually appears in search today, measured rather than assumed, so
that later work has something to be measured against.

**Re-run this before claiming any improvement.** Every number below is
reproducible with the commands given.

---

## 1. The short version

**n.abl does not appear in search results at all.** Not low down — absent. And
the cause is mechanical rather than competitive: there is no text on the page
for a search engine to match.

---

## 2. Indexation

| Query | n.abl in results? |
|---|---|
| `"nabl.agency"` (exact string, the domain itself) | **No** |
| `"Tell us what's costing you"` (the site's own hero headline, exact phrase) | **No** |
| `n.abl technology implementation Nottingham small business` | **No** |

A site that is indexed will normally surface for an exact-phrase match on its
own headline, because almost nothing else on the web contains that string. It
does not. The reason is §4: that headline is not in the HTML that a crawler
receives.

*Caveat, stated so it is not over-read:* the search tool available here is
US-region. That weakens conclusions about UK-local ranking, but not these — an
exact-phrase miss is strong evidence in any region.

---

## 3. The brand-name problem

Searching the exact domain string returns, instead of n.abl:

| Result | What it is | Why it matters |
|---|---|---|
| `nabl-agency.de` | "nABL Agency", a Berlin marketing agency | **Direct name collision**, and they sell SEO, so they are good at ranking |
| `nabl.ai` | "NABL — Find Local Businesses Ready to Buy" | Name collision, and adjacent to lead generation |
| `nabl.org` | National Association of Bond Lawyers | Large, old, authoritative |
| NABL | India's National Accreditation Board for Testing and Calibration Laboratories | Very large entity, owns the acronym |
| `abl-business.co.uk` | ABL Business Ltd, UK commercial finance | Owns "ABL" in a UK business context |

This is a real strategic finding and not a technical one. **"n.abl" and "nabl"
are heavily contested terms**, held by bigger, older entities including one
agency in an overlapping industry. Ranking for the bare brand name will be
harder than it is for most new businesses, and the punctuation that makes the
name distinctive to a human is invisible to a search engine.

The practical consequence: brand search is not a cheap win here, and anything
that helps a search engine understand n.abl as a *specific local entity* —
structured data, a Google Business Profile, consistent NAP — is worth
disproportionately more than it would be for an uncontested name.

---

## 4. What a crawler actually receives

```
$ curl -sS https://nabl.agency/ -o /tmp/live.html -w "%{http_code} %{size_download}\n"
200 2583

$ python3 - <<'PY'   # strip tags, count visible text
...
body bytes: 29
visible text chars: 0
PY
```

Twenty-nine bytes is `<div id="root"></div>` plus a script tag. Around 41 KB of
copy across `Home.jsx` and its components exists only once React has run.

Identical for every crawler tested — same 2,583 bytes, same empty body:

```
$ curl -A "…Googlebot/2.1…"  → 200, 2583 bytes
$ curl -A "…GPTBot/1.1…"     → 200, 2583 bytes
$ curl -A "…ClaudeBot/1.0…"  → 200, 2583 bytes
```

Googlebot renders JavaScript and will eventually see the page. GPTBot,
ClaudeBot and PerplexityBot do not, and do not return. So the site is
**legible to Google and blank to every AI assistant.**

---

## 5. Technical health: good, which makes §4 the whole story

Everything that could be blocking indexing was checked and is clean:

| Check | Result |
|---|---|
| `noindex` in HTML or `X-Robots-Tag` header | **None** — searched source and live headers |
| `robots.txt` reachable | 200 |
| `sitemap.xml` reachable | 200 |
| Cloudflare's 15 Sep 2026 AI-crawler default block | **Not blocking** — GPTBot and ClaudeBot both got 200 with content, verified by user-agent |
| HTTPS, HSTS, CSP, security headers | All present |

That last row deserves a note. The 15 September default was a live risk to this
plan and it was checked rather than assumed: both AI user agents receive a
normal 200. Nothing needs changing in Cloudflare's dashboard.

So there is no penalty, no block and no misconfiguration. There is simply
nothing to index.

---

## 6. One real bug found

`sitemap.xml` declares `https://nabl.agency/privacy`. The server does this:

```
$ curl -sSI https://nabl.agency/privacy
HTTP/2 307
location: /privacy/

$ curl -sSL https://nabl.agency/privacy
final=https://nabl.agency/privacy/   200   2628 bytes
<title>Privacy Policy — n.abl</title>
canonical" href="https://nabl.agency/privacy"
```

So: **the sitemap points at a URL that redirects, and the page it lands on
declares its canonical to be the redirecting URL.** Every public legal page has
this.

The cause is `build-routes.mjs` writing `dist/privacy/index.html` — a folder
index — combined with Cloudflare Workers' default `html_handling`
(`auto-trailing-slash`), which serves folder indexes at the slashed form and
redirects the unslashed one to it.

Google will usually resolve this, but it costs a redirect hop on every legal
page and it declares a canonical that is not the URL serving the content.

**Fix:** set `"html_handling": "drop-trailing-slash"` in `wrangler.jsonc`, which
serves `/privacy` directly at 200 and redirects `/privacy/` instead — matching
what the sitemap and the canonical tags already say.

Worth noting this is a Cloudflare-migration regression. `build-routes.mjs` says
in its header *"Netlify serves an existing file before it applies the SPA
rewrite"* — true on Netlify, and the move to Workers changed the behaviour
without changing the file.

---

## 7. How to re-measure

```sh
# Text a crawler receives (the number that has to stop being zero)
curl -sS https://nabl.agency/ | python3 -c "import sys,re;h=sys.stdin.read();b=re.search(r'<body.*?>(.*?)</body>',h,re.S).group(1);t=re.sub(r'<script.*?</script>',' ',b,flags=re.S);print(len(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',t)).strip()))"

# Redirect behaviour on the legal routes
for p in privacy terms cookies; do curl -sSI "https://nabl.agency/$p" | head -1; done

# Crawler access
for ua in "Googlebot/2.1" "GPTBot/1.1" "ClaudeBot/1.0"; do
  curl -sS -A "$ua" -o /dev/null -w "$ua %{http_code} %{size_download}\n" https://nabl.agency/
done
```

`scripts/check-seo.mjs` automates all of the above — `npm run test:seo`.

---

## 8. What this baseline does not tell us

Stated so nobody reads more into it than it holds:

- **No Google Search Console data.** Nobody has verified the property, so there
  are no impressions, no average position and no query list. That is the single
  best source of truth for all of this and it is free. See the handover.
- **No UK-region search results.** The available tooling searches US.
- **No competitor ranking analysis.** Pointless before there is anything to
  compare — the site does not rank for its own name.
