# Sources

The register of where lead data may come from, in order of preference, with the
access method, the licence position, the fields each one yields and the rules for
collecting from it.

**Status: specification. No source in this document has been worked yet.** No API
key has been obtained, no directory has been indexed and no website has been
fetched. Everything below is what to do, not a record of what was done.

Read this before writing any fetching code. It is the file someone will have open
while building a list, so the correction is repeated in full rather than
cross-referenced.

---

## 1. The correction

**Do not build the core lead database by bulk-exporting Google Maps.**

Two separate problems, and both matter.

**The terms.** Google's Maps terms restrict using Maps content to create or
augment business listings, mailing lists or telemarketing lists. Building a
prospect database out of Maps results is precisely the use those restrictions
describe. This is not a grey area to be managed with a lower request rate.

**The billing.** Places is pay-as-you-go with field-level billing rather than a
permanent free allowance. The original outreach plan assumed a free tier that
would carry the whole build. It does not exist in that form. A pipeline designed
around it would either stop working or start costing money at the exact moment it
became useful, and the whole business runs on a £36 monthly cost base.

### What Google may still be used for

As **one discovery signal**, used by a person, and never stored as the record.

- Confirming a business exists, trades from the address it claims, and is not
  closed.
- Finding a website URL, which is then fetched from the business's own domain and
  recorded with `source = own_website`.
- Sense-checking a territory before spending a day on it.

### What it may never be used for

- Bulk extraction of listings into a file.
- Any automated export, scrape or API loop whose output becomes the candidate
  list.
- Populating `source = ...` on a CRM record. There is deliberately no
  `google_maps` value in the `source` CHECK constraint in `07-crm`, and none
  should be added.
- Reviews, ratings or review text stored as data. A human reading reviews and
  noting "customers mention slow responses" is a research observation. A script
  harvesting review text is extraction from a source we may not extract from.

**The rule in one line:** if the pipeline cannot produce the list without Google,
the pipeline is wrong.

---

## 2. The register

Ordered by usefulness for the ideal customer profile in
[`../01-positioning/ideal-customer-profile.md`](../01-positioning/ideal-customer-profile.md).
Rank is about what a source contributes to a *correct, defensible record*, not
about how many rows it can produce quickly.

| Rank | Source | Cost | Yields | CRM `source` value |
|---|---|---|---|---|
| 1 | Companies House | £0 | Legal identity, directors, incorporation, filings, SIC, registered address | `companies_house` |
| 2 | The business's own website | £0 | Nearly every observable signal, contact routes, real language | `own_website` |
| 3 | Trade body and industry directories | £0 | Sector precision, accreditation, sometimes size | `industry_directory` |
| 4 | Local directories and chambers | £0 | Territory-shaped lists, human-curated | `local_directory` |
| 5 | Council business and licensing registers | £0 | Precise, published, patchy coverage | `council_directory` |
| 6 | Job adverts | £0 | Tier 1 and tier 3 signals, current by definition | `public_company_information` |
| 7 | Manually verified research | Time | Anything, correctly | `manual_research` |
| 8 | Licensed datasets | Paid | Volume, verified contacts | `licensed_dataset` |
| — | Google, as a discovery signal | Varies | Existence, a URL, a sense of the area | *no value. Never recorded.* |

The `source` values are the ones already constrained in the DDL sketch at
[`../07-crm/compliance-schema.md`](../07-crm/compliance-schema.md) section 4. Do
not invent new ones here without changing the constraint there, and do not add
one for Google.

---

## 3. Source 1 — Companies House

**The source of record.** It is the only source in this register that settles the
question the whole compliance schema turns on: whether a business is a corporate
subscriber or an individual subscriber.

### What it gives

| Field | Use |
|---|---|
| Company number | The stable key. Everything else joins on it. |
| Company name and previous names | Matching, and spotting rebrands |
| Company type | Ltd, PLC, LLP, Scottish partnership, and so on. Drives `subscriber_type`. |
| Company status | Active, dissolved, liquidation. Drives a hard disqualifier. |
| Incorporation date | Age of business |
| Registered office address | Territory, with the caveat below |
| SIC codes | A first pass at sector, and a weak one |
| Officers | Named directors, appointment dates. Drives decision access and the tier 3 "new director" signal. |
| Filing history | Late filings, dormant filings, charges. Drives viability disqualifiers. |
| Charges register | A pattern of charges is a viability signal |

### Access

Two routes, and both are worth having.

**The Public Data API.** Free, requires a registered application and an API key.
Rate limited. [PLACEHOLDER — the commonly cited limit is 600 requests per five
minutes, but confirm it against the current developer documentation before
building any throttle around it, and set the throttle below whatever the
documented figure turns out to be.]

**The bulk company data snapshot.** Companies House publishes a downloadable
snapshot of basic company data covering all registered companies. Right for
territory-first work: filter by postcode district offline, once, instead of
making thousands of API calls. It does not include officers, so the API is still
needed for decision access. [PLACEHOLDER — confirm the current file format,
update frequency and size before designing around it.]

Companies House data is published under the Open Government Licence. That is a
genuinely permissive position and it is the main reason this source ranks first.
Attribution requirements under the licence apply.

### Cautions

- **A registered office is not a trading address.** A large share of small
  companies register at their accountant's office. Territory must be decided from
  the trading address on the website, not from the registered office, or the
  Nottingham list will fill up with accountancy practices' clients from
  everywhere in England.
- **SIC codes are self-selected and frequently stale.** Use them to prioritise
  research, never to decide sector for scoring. The ICP already says sector is a
  weaker signal than the observable ones.
- **No match is information, not a failure.** A trading business with no
  Companies House record is very likely a sole trader or a partnership, which is
  an individual subscriber under PECR and a materially different case. Record the
  absence explicitly. Do not leave the field empty and let a later run assume
  corporate.
- **Officer records are personal data.** Collect the minimum needed to identify a
  decision-maker. Do not collect dates of birth, residential addresses or officer
  records for people not relevant to the approach.

---

## 4. Source 2 — the business's own website

**Where the value is.** Companies House says a business exists. The website says
what is wrong with it, and gives you something to write about that the business
said about itself.

### What it gives

Nearly every signal in section 5 of the ICP. In particular: downloadable forms
that have to be printed and returned, "call us for a quote" on standardised work,
visible seams between two systems that do not talk, dated PDF price lists,
generic email domains, stale copyright years, role-based addresses, fleet
photographs, trade body badges, and the business's own description of what it
does in its own words.

It also gives the trading address, which is what decides territory.

### Access and collection rules

These are the rules the fetcher must implement, not aspirations.

1. **Honour `robots.txt`.** Fetch and parse it first, cache it per host, and skip
   any disallowed path. A disallowed site is skipped entirely, not fetched more
   politely.
2. **Identify the fetcher.** A user agent naming n.abl and a URL where the site
   owner can find out what it is and how to object. Anonymous scraping is not
   compatible with a business that intends to write to these people afterwards.
3. **Rate limit hard.** One request at a time per host, with a delay between
   requests, and a small global concurrency limit. This is not a crawler and
   there is no reason for it to be fast. [PLACEHOLDER — set the exact delay and
   concurrency in `build-plan.md` once the first pass has shown how many pages a
   typical site needs.]
4. **Cache every raw response to disk, keyed by URL and date.** A re-run reads
   the cache. Re-running the extraction rules a dozen times while tuning them
   must not mean re-fetching a small business's website a dozen times.
5. **Bounded depth.** Home, about, contact, services, and anything linked from
   the top navigation. A handful of pages, not the whole site. No recursion into
   blog archives or product catalogues.
6. **Public pages only.** No logins, no forms submitted, no paywalls, no
   member-only areas, no gated PDFs. If it requires an account it is out of
   scope.
7. **Stop on failure.** A 403, a 429, a robots block or a site that looks like it
   is objecting means stop for that host and record why.
8. **Collect the minimum personal data.** A named director and a business contact
   route is what the approach needs. Staff pages, biographies and photographs are
   not needed and should not be stored.

### What is recorded

Every extracted signal carries the URL it came from, the date fetched, and the
matched text. A signal with no evidence is not a signal, and a shortlist entry
that cannot show its working is not reviewable.

---

## 5. Source 3 — trade body and industry directories

NICEIC, Gas Safe, FMB, RICS, trade association member lists, and the equivalent
for whichever sector is being worked.

**Why they rank third.** Precision. A business in an accredited members' list is
in a known sector, is usually a real trading entity, and often publishes an
accreditation level that correlates with size. For the trades and installers the
ICP ranks highest, this is the cleanest sector filter available anywhere.

**How to use them.** As a curated starting list for a sector inside a territory,
worked through by hand or with a small script over a published, public directory
page. Not as a bulk harvest.

**Cautions.**

- Check each directory's own terms before any automated access. They vary
  considerably and several prohibit systematic extraction outright. A directory
  whose terms prohibit it is used by reading it, by a person, or not at all.
- Some directories are themselves commercial lead products. Being listed is not
  consent to be marketed to, and the directory's presence does not create a
  lawful basis.
- Record the directory name in `source_detail`, not just the category.

---

## 6. Source 4 — local directories and chambers of commerce

Nottinghamshire and Warwickshire chambers, business improvement districts, town
and parish business listings, trading estate tenant lists.

**Why they matter here specifically.** The ICP defines two tight territories and
names the trading estates in both. A chamber membership list for the right area
is a hand-curated version of exactly the list this pipeline is trying to build,
usually a few hundred entries long, and small enough to work through properly.

**Cautions.** The same terms check as section 5. Membership lists go stale.
Chamber membership skews towards businesses that already buy services, which is
useful, and towards businesses that are already well served, which is not.

---

## 7. Source 5 — council business and licensing registers

Published business rates data, licensing registers, permit registers, and
approved contractor lists, where the relevant council publishes them.

**Why it is here.** Published deliberately for public inspection, precise about
address and trading name, and frequently the only source that confirms a business
occupies a specific unit on a specific estate.

**Cautions.** Coverage is inconsistent between councils and formats vary from a
clean CSV to a PDF table. Some registers exist for a statutory purpose and
carry their own reuse conditions; check each one. Licensing registers can contain
named individuals, so the minimum-collection rule applies with force.

---

## 8. Source 6 — job adverts

**Why they are worth a source of their own.** Three of the ICP's strongest
signals are only visible in a job advert: the repeatedly advertised administrator
role, the operations role requiring "advanced Excel", and the first-ever
supervisor or coordinator vacancy. An advert is also current by definition, which
almost nothing else in this register is.

**How to use them.** Read the advert on the employer's own careers page where one
exists, which also gives `source = own_website`. Where the advert is on a job
board, check that board's terms before any automated access, and treat a
prohibition as final. A person reading a board and noting what they see is
research; a script pulling adverts from a board that forbids it is not.

**Cautions.** Adverts expire, so record the date seen. An agency-posted advert
often hides the employer, and guessing which business it belongs to is exactly
the kind of inference this pipeline must not make.

---

## 9. Source 7 — manually verified research

The fallback for anything that matters, and the only acceptable method for
anything a decision rests on.

**When it is mandatory.**

- Confirming the trading address before assigning a territory.
- Confirming employee count where the estimate would move a lead across the size
  bands.
- Confirming a named decision-maker before a lead reaches the shortlist.
- Anything that will be quoted back to the business in an outreach message.

**How it is recorded.** `source = manual_research`, `source_detail` naming what
was checked and how, `source_date` the day it was checked. A manual check with no
record is indistinguishable from a guess three weeks later.

---

## 10. Source 8 — licensed datasets

Paying for verified data instead of extracting more of it. The master plan puts
this fifth in the order of what the first earnings buy, ahead of compute and
ahead of anything that only looks like growth.

**Why it is worth money later and not now.** It is cheaper than the alternative
and considerably safer, but only once there is a shortlist process good enough to
be worth feeding. Buying a list before the pipeline exists produces a large file
nobody has time to read.

**What to check before buying anything.** The licence terms for marketing use,
whether the supplier can evidence how the data was collected and what notice was
given to the people in it, whether corporate and individual subscribers are
distinguished in the data itself, and whether the supplier will state the
suppression position in writing. A supplier who cannot answer those is selling a
problem.

---

## 11. What must never be a source

Not a ranked list. A boundary.

- **Bulk-exported Google Maps listings.** Section 1.
- **Purchased scraped lists from unclear origins.** If the provenance cannot be
  stated on the record, it cannot go on the record.
- **Scraped social or professional network profiles**, including LinkedIn.
  Prohibited by the platforms and it produces personal data with no defensible
  basis.
- **Guessed email addresses.** Pattern-generated addresses, and services that
  guess a pattern and then verify it against a mail server, are not research. The
  business publishes a contact route or it does not.
- **Anything behind a login, a paywall or an account.**
- **Data from a source whose terms prohibit the use**, however convenient.
- **Any source that cannot fill in `source`, `source_detail` and `source_date`.**
  This is the practical test, and it catches most of the above without an
  argument. If the record cannot say where it came from and when, it does not get
  created.

---

## 12. What every record must carry

The compliance fields from the master plan, section 5, and from
[`../07-crm/compliance-schema.md`](../07-crm/compliance-schema.md):
`subscriber_type`, `lawful_basis`, `source`, `source_date`,
`privacy_notice_status`, `marketing_status`, `opt_out`, `suppression_list`,
`contact_history`.

Three of those are decided at sourcing time and are this folder's direct
responsibility.

| Field | Set by this pipeline | Rule |
|---|---|---|
| `source` | Yes | The category from the register above. One value, the one that actually produced the record. |
| `source_detail` | Yes | The URL, directory name or dataset name. Free text, but never empty. |
| `source_date` | Yes | The date the record was obtained. A date, not a timestamp. Nobody knows the minute. |
| `subscriber_type` | Yes | From the Companies House result, or from its documented absence. Never from the trading name. |
| `lawful_basis` | No | A business decision, recorded per record, blocked until the assessment in `07-crm` next actions exists |
| `privacy_notice_status` | No | Defaults to `not_given`. Outreach sets it, not sourcing. |
| `marketing_status` | No | Defaults to `do_not_contact`. Sourcing never sets this to `permitted`. |

**`subscriber_type` deserves the attention.** ICO guidance distinguishes
corporate subscribers from sole traders and individual subscribers, and the rules
for electronic marketing differ materially. Corporate subscribers can generally
receive unsolicited B2B electronic marketing without PECR consent, but identity
and opt-out requirements still apply, and personal data used for B2B marketing
remains subject to UK data protection law.

Both territories will produce a mix. A meaningful share of trades and rural
businesses will be sole traders or partnerships rather than limited companies.
They are not the same case and must not be filed as one. The default is
`unknown`, and `unknown` can never be marketed to.

---

## 13. Suppression, at the sourcing end

The suppression list is checked before every send, and that is `11-outreach`'s
job. Sourcing has one obligation and it is easy to forget: **a business that has
opted out must not be re-added by the next discovery run.**

A pipeline that finds the same trading estate every quarter will find the same
businesses. Without a check at the point of insert, the person who asked to be
left alone reappears as a fresh lead with a clean record and a good score.

So the insert path checks the suppression list and the disqualified list before
creating anything, and a match means the candidate is dropped with a recorded
reason. This is a Class 1 join and costs nothing. It has to exist from the first
run, not be retrofitted after the first complaint.
