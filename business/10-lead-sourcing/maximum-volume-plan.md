# Maximum legal volume at zero cost — the plan

```
Written:   2026-08-21
Objective: as many contactable UK small businesses as possible, £0, lawfully
Status:    sources built and measured; channels decided; outreach not yet built
```

Every number below was measured by running the thing, not estimated. Where a
figure is someone else's claim it says so.

---

## 1. The headline, and the thing we had wrong

We had been treating **email** as the outreach channel and **volume** as the
problem. Both were wrong, and in the same direction.

**Email is the most restricted channel available to us, not the default one.**
PECR regulation 22 requires consent for unsolicited marketing email to an
*individual subscriber*, and the ICO classes sole traders and ordinary
partnerships as individual subscribers. The Department for Business and Trade's
2025 population estimates put UK private-sector businesses at 5.7 million, of
which **3.2 million are sole proprietorships and 368,000 are ordinary
partnerships — 63% of all businesses**. Cold email cannot lawfully reach any of
them. Our Companies House feed never could either: they are not on the register.

**Post is outside PECR entirely.** No consent, no soft opt-in, no screening
obligation. And post addressed to a role — "the Owner", "the Practice Manager" —
is not personal data at all, so UK GDPR does not engage: no Article 14 notice,
no legitimate interests assessment, no ceiling derived from a balancing test.

So the channel that reaches the 63% we were structurally blind to is also the
one with the fewest legal constraints. That is the plan.

**Volume was never the binding constraint.** 81,286 businesses in territory,
sourced at £0. What binds is *reachability* — having an address that reaches a
human rather than their accountant — and *channel*, which decides who may be
contacted at all.

## 2. The sources, measured

Built and running:

| Source | Rows scanned | In territory | What it uniquely gives | Licence |
|---|---:|---:|---|---|
| Companies House Free Company Data | 5,695,466 | 66,925 | Legal entity, company number, SIC codes, incorporation date | OGL v3 |
| ICO Register of Fee Payers | 1,438,413 | 19,985 | **A self-declared address**, trading names, reaches sole traders | OGL v3 * |
| FSA Food Hygiene Ratings | 612,489 | 8,398 | A genuine trading premises address, hygiene rating | OGL v3 |

\* The ICO states OGL does not cover personal data in the dataset. The DPO
name, email, phone and address are therefore not licensed and are not read from
the file at all.

Merged: **95,308 rows in, 81,286 distinct businesses out**, 13,633 corroborated
by two registers, 399 name collisions kept separate rather than guessed at.

The merge exists for one reason. Companies House gives a *registered office*,
which for a small business is very often the accountant's. Joining the three
registers on a normalised name key moves the contact address off it:

| Address we would write to | Before ICO | After ICO |
|---|---:|---:|
| Registered office (often an accountant) | 66,119 | 53,289 |
| Declared by the organisation itself | — | 19,621 |
| Actual trading premises | 8,375 | 8,376 |
| **Reaches the business, not its agent** | **8,375** | **27,997** |

For 1,617 companies the declared address is a *different place* from the
registered office. Those are letters that would have gone to the wrong building.

Worth building next, in order:

- **CQC** — 57,080 active locations, ~1,265 in territory, and it carries a
  **phone number**. Small, high quality, cheap.
- **Charity Commission** — 171,710 registered main charities, ~2,765 in
  territory, with phone and email. Caveat: the contact address is frequently a
  trustee's home, so treat as personal data by default.
- **OpenStreetMap / Overpass** — free, no key, and it maps where a business
  physically sits. ODbL, which means share-alike on any derived database: fine
  internally, not publishable.

Assessed and rejected, with the reason, so nobody re-litigates them:

- **FCA** — bulk register extract is £11,125 one-off or £19,881/year. Not free.
- **Environment Agency public register** — the conditional licence is
  internal-use-only and expires annually. Not worth the licence risk.
- **VOA rating lists** — restricted licence, not OGL.
- **Companies House PSC bulk** — gives service addresses, which are the same
  registered offices we already hold. No trading address, so no gain.
- **Ofsted childcare** — 222,321 cells redacted; childminder home addresses are
  stripped, correctly. Marginal.
- **DVSA MOT** — last refreshed 2024. Stale.
- **Hunter / Apollo free tiers** — 50 credits a month against 81,286 businesses
  is noise, and Apollo's terms restrict use.
- **Paid search APIs for domain discovery** — Bing's API was retired in 2025,
  Google's CSE is closed to new customers and shuts on 1 January 2027, Brave's
  free tier ended February 2026. There is no free SERP route left; the
  guess-and-verify approach in section 5 replaces it.

## 3. The channel matrix, which is what actually decides volume

Corporate = limited company, LLP, PLC, Scottish partnership. Individual = sole
trader, ordinary partnership, private person.

| Channel | Corporate | Individual | Verdict |
|---|---|---|---|
| **Post** | No consent. Outside PECR. | No consent. Outside PECR. | **Primary.** Reaches all 81,286. |
| **Live phone** | Lawful, but screen against **both** CTPS and TPS first | Same, TPS | Secondary. Screening is the only unavoidable cost. |
| **Email** | No consent needed; UK GDPR legitimate interests if a person is named | **Consent required** | Corporate only, gated on a verified company match. |
| **LinkedIn / social DM** | Counts as "electronic mail" | **Consent required** | **Do not.** See below. |
| **Automated calls** | Consent required | Consent required | Unusable cold. |

**On LinkedIn**, because every competitor does it and it looks free: the ICO's
position is that professional-network users "are unlikely to be on the sites
exclusively in their business capacity", and that messaging someone using the
platform in a personal-albeit-professional capacity "is not considered B2B
marketing". Cold LinkedIn DMs are consent-required and we will not send them.
That this is widely ignored is not a reason to ignore it.

**On phone screening**: there is no free bulk TPS/CTPS screening API. A
pay-per-list reseller quotes from £5.10 for 250 numbers; an own licence is
quoted at £3,300/year. Budget roughly £100–£300 a year if we use phone at all.
It is the only line item in this whole plan that is not zero.

## 4. What this cost us in policy terms

The published privacy notice said "we do not buy or rent marketing lists, and
we do not scrape at volume". The first half is still true and stays. The second
half was written when sourcing meant a hand-built shortlist, and it has been
replaced with what actually happens: whole register files, downloaded from the
bodies that publish them for that purpose, with a plain statement that holding
a register entry and writing to someone are different things with very
different numbers.

`LIA-2026-08-v1` capped first contacts at 200 a month and said in terms that
register-scale sourcing invalidated it. It did. `LIA-2026-08-v2` is the redone
assessment. It does not raise the number by softening a judgement: v1 assessed
one audience where there are three, and a company contacted at a role address
holds no personal data at all. 200 a month becomes 2,400 across three tiers,
and the ceiling is now enforced by `marketing_ceiling_guard` rather than
remembered.

**Post is not covered by either assessment.** Section 8 of v2 says so. Before
the first letter goes out it needs its own short assessment — much easier,
because role-addressed post engages neither PECR nor UK GDPR, but it should be
written down rather than assumed.

## 5. Build order

Each step is useful on its own, so stopping after any of them leaves something
that works.

1. **~~Companies House, ICO and FSA fetchers, and the merge.~~** Done.
2. **A postal assessment**, and a role-addressed letter template. Unblocks the
   channel that reaches all 81,286.
3. **Scoring.** 81,286 is too many to write to. Rank on what the registers
   already tell us: SIC code against the ideal customer profile, company age,
   whether two registers corroborate, whether we have a non-registered-office
   address. Free, no fetching, and it decides who the first thousand letters go
   to.
4. **Website discovery.** No free SERP API survives, so: generate candidate
   domains from the normalised name, resolve, fetch, and confirm by matching
   the company name, number or postcode in the page. Hit rate unknown — measure
   it on a sample of 500 before building the full run.
5. **Contact extraction.** Fetch `/`, `/contact`, `/about` on confirmed
   domains; take `mailto:`, `tel:`, form actions and schema.org JSON-LD. This
   also yields the best free trading address there is, because a footer address
   beats a registered office. Robots.txt honoured, throttled, honest
   user-agent.
6. **Tech detection**, from HTML already fetched, against the GPL-3.0
   `webappanalyzer` fingerprints. This is the "fragile process" signal that
   makes a first contact specific rather than generic.
7. **Promote to CRM**, with subscriber type, source, source date and tier
   resolved — the fields the compliance gate refuses to send without.

## 6. Where the law actually bites, and where it does not

Worth writing down because the intuition is backwards.

**Scraping one company's own website is close to zero risk.** Database right
protects a database built with substantial investment in *obtaining or
verifying* contents. A single firm's website is almost never that. Visiting
50,000 separate company sites and taking one address from each carries
near-zero database-right exposure.

**Taking 50,000 rows from one directory is the real risk.** Regulation 16(2) of
the 1997 Regulations catches repeated and systematic extraction of insubstantial
parts that cumulatively amount to a substantial part — so slow, polite,
paginated harvesting of a whole directory is squarely within it, not outside it.
In *77m v Ordnance Survey* [2019] EWHC 3007 (Ch), 3.5 million addresses taken
from a free, no-login public service was extraction of a substantial part *and*
a breach of the service's terms. Scale was determinative.

**Terms of service bind even with no login** (*Ryanair v PR Aviation*, C-30/14):
an unprotected database can still be closed off by contract.

**OGL v3 expressly licenses the database right.** Every source in section 2 is
OGL. Bulk extraction from them is contractually clean, which is exactly why the
plan is built on registers rather than directories.

So: **registers in bulk, individual company sites one at a time, no directories.**
That is not a compromise for the sake of caution — it is where the volume is.
