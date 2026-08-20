# Free sourcing and scraping methods, evaluated

Research pass: 20 August 2026. Sources at the foot.

The question was which free scraping methods to use. The answer turns out to be
mostly "don't scrape for the part everyone scrapes for" — the candidate list is
a free bulk download, and scraping is reserved for one narrow job it is actually
good at.

---

## 1. The constraint that decides everything

**The published privacy notice says: *"We do not buy or rent marketing lists, and
we do not scrape at volume."*** That is live on nabl.agency/privacy, and
`LIA-2026-08-v1` §3 rests the necessity limb on the same claim.

So this is not an open question about what is technically possible. Anything
built here has to keep a public commitment true. A bulk scraper would make the
site a liar, which is a worse outcome than having no leads.

That rules out the entire category of "point a crawler at a directory and take
everything", regardless of how free or effective it is.

## 2. Where the law actually sits

Scraping public, non-personal, non-copyrighted content is lawful in the UK.
Personal data needs a lawful basis — which `LIA-2026-08-v1` provides, for
corporate subscribers only.

Two things worth being precise about:

- **`robots.txt` is not legally binding**, but ignoring it increases exposure,
  because the ICO and the courts treat it as evidence of the site owner's
  intent. Honouring it costs nothing and removes the argument.
- **Terms of service are a contract**, and contract claims are the ones that
  succeed. The risk rises sharply the moment you authenticate — logging in to
  take data is a different act from reading a public page.

Practical position: read public pages, honour `robots.txt`, throttle, never log
in, never take a whole database.

## 3. The methods, compiled

| Method | Cost | What it is good for | Verdict here |
|---|---|---|---|
| **Companies House bulk snapshot** | £0 | The entire candidate universe: name, company number, registered postcode, SIC, incorporation date, status | **Chosen.** Not scraping at all — a published file we download |
| **Companies House REST API** | £0, needs a free key | Officers, filing history, per-company detail | **Later.** Useful for signals; needs a credential |
| **Plain `fetch` + HTML parse** | £0 | Reading one company's own site: contact route, phone, booking form, observable signals | **Chosen.** Most small-business sites are server-rendered |
| **Playwright** | £0 | The minority of sites that render via JavaScript | **Chosen as fallback.** Already a dependency here |
| **Crawlee / Scrapy** | £0 | Queues, session pools, proxy rotation, crawls at scale | **Rejected.** Built for the volume we have promised not to do |
| **Crawl4AI** | £0 + model cost | Clean Markdown for LLM consumption | **Rejected for sourcing.** Solves a problem we do not have |
| **Google Maps / Places export** | Paid, and against terms | Local business listings | **Forbidden.** See `sources.md` §1 |
| **Bought or rented lists** | Paid | Volume | **Forbidden.** Contradicts the privacy notice |

## 4. Why the boring option wins

The instinct is to scrape a directory. The bulk snapshot is better on every axis
that matters:

- **It is complete.** Every live company on the register, not whatever a
  directory happened to list.
- **It is structured.** SIC codes and postcodes as columns, not as text to be
  guessed at.
- **It cannot break.** A CSV schema does not change when someone redesigns a
  page. Every scraper is one redesign away from silently returning nothing.
- **It is unambiguously permitted.** Published for reuse, no terms to weigh, no
  `robots.txt` to interpret.
- **It excludes the wrong people by construction.** The register holds only
  incorporated companies, which is exactly the population PECR lets us approach
  on legitimate interests. Sole traders never enter the pipeline.

Verified on 20 August 2026 by running the whole thing. All seven parts:
**5,695,466 companies scanned, 66,925 active in NG/B49/B50.** The download is
about 490MB in total and takes a few minutes.

**That settles a question the tracker has been carrying.** There is no shortage
of candidates, so sourcing is not the hard part — scoring is. Any effort spent
finding more companies is misdirected; the work is deciding which of 65,000 are
worth approaching.

## 5. What scraping is still for

One job, and it is the job that produces the thing the LIA depends on: **a
specific, checkable observation about that business, in their own words.**

That comes from the company's own website — a phone number and no booking form,
a jobs page advertising an admin role, a services list that implies manual
process. One site at a time, on a candidate that has already passed the filter,
at human pace.

That is not scraping at volume. It is reading a page before writing to someone,
which is what anyone sensible would do by hand — just less tediously.

## 6. The stack

Nothing new is installed.

| Layer | Tool | Note |
|---|---|---|
| Candidate universe | `curl` + Node `zlib`/CSV parse | The bulk snapshot |
| Filter and score | Plain JavaScript | Deterministic, Class 1, no model |
| Read one site | `fetch` + regex/`DOMParser` | Handles server-rendered sites |
| Read a JS-heavy site | Playwright | Already a devDependency |
| Politeness | `robots.txt` check, 1 req/site, delay between sites | Non-negotiable |

## 7. Build plan

Four stages. Each is independently useful and independently committable.

1. **`fetch-companies-house.mjs`** — download one part of the snapshot, unzip,
   stream-parse the CSV, filter to target postcodes and SIC codes, write a
   candidate JSON. *No network beyond one published file. No credential.*
2. **`score-candidates.mjs`** — deterministic scoring against the ICP: age band,
   SIC match, territory. No model call. Produces a ranked shortlist.
3. **`enrich-candidate.mjs`** — for one candidate at a time: check `robots.txt`,
   fetch the homepage and an obvious contact page, extract a contact route and
   any observable signal. Throttled, resumable, and it stops rather than
   guessing.
4. **Review and promote** — a human reads the shortlist and promotes chosen rows
   into `sales_leads`, where the compliance schema then demands a subscriber
   type, lawful basis, source and source date before anything can be sent.

Stage 4 deliberately keeps a person between the pipeline and the CRM. The
compliance schema already refuses to let an unassessed lead be contacted; this
stage is where the assessment actually happens.

## 8. What needs a credential

Nothing, for stages 1–3.

Stage 4 writes to Supabase, which the app already authenticates for. The
Companies House **REST API** would need a free API key if per-company officers
or filing history are wanted later — the **bulk snapshot used here does not**.

---

## Sources

- [Is web scraping legal in the UK — Sprintlaw](https://sprintlaw.co.uk/articles/is-web-scraping-legal-in-the-uk/)
- [UK web scraping compliance guide — UK Data Services](https://ukdataservices.co.uk/blog/articles/web-scraping-compliance-uk-guide)
- [Web scraping legal guide: public data, GDPR, robots.txt, ToS](https://use-apify.com/blog/web-scraping-legal-guide)
- [Best open-source web scrapers 2026 — Scrapfly](https://scrapfly.io/blog/posts/best-open-source-web-scrapers)
- [Best open-source web scraping libraries — Firecrawl](https://www.firecrawl.dev/blog/best-open-source-web-scraping-libraries)
- [Free Company Data Product — Companies House](https://download.companieshouse.gov.uk/en_output.html)
