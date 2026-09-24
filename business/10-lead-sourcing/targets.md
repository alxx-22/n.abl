# Lead-gen targets

Where to aim the Companies House pull so model quota goes on likely buyers. Written 23 September 2026 from the docs and code named below. Anything not taken from a doc is marked **check**.

**What the docs say about us.** n.abl has people in Nottingham and Alcester (ICP §2, `knowledge/services/_shared/who-we-sell-to.md`), with no office address given. Nothing has been sold and there are no clients or case studies (STATUS.md, 17-proof README).

## 1. Who to aim at

ICP §1: owner-run, 5–25 people, runs on spreadsheets and email, one process costing a day a week, a director who decides. Signals outrank sector (ICP §5).

| Shape | Services | Why (doc) |
|---|---|---|
| Trades/installers, 5–20 vans | automation, software, data | Job sheets, quoting from one spreadsheet, certificate expiries (ICP §4; software service.md: field work) |
| Engineering, fabrication, auto/aero supply | automation, data, software | Whiteboard scheduling, stock counts, delivery notes against invoices (ICP §4; data_analytics) |
| Wholesale, trade supply | automation, data, AI | Price lists reissued, POs retyped (ICP §4); supplier documents (ai service.md) |
| Small professional practices | AI, automation | Documents, onboarding, chasing clients; "reading and summarising" (ICP §4; ai). Advice boundary: saying-no §3.5 |
| Property, lettings, FM | automation, software, web | Inspections, certificate expiries, landlord statements (ICP §4); portals |
| Venues and events near Stratford | web, automation, AI | Availability, deposits and follow-up done by hand (ICP §4); booking with no online route (web) |

Leave out: retail, salons, restaurants, pubs and takeaways (weak fit, ICP §4); care (special-category data, ICP §6); IT and web firms, holding companies and property vehicles (who-we-sell-to.md).

## 2. Target presets

**How the codes were checked:** a Node script looked each one up in `SIC_2007` (`lead-prospector/sic-2007.mjs`, 731 codes) and ran it through `expandSic`. All exist. `01620` does **not** exist (UK SIC splits it into 01621 and 01629), so use `0162`.

**Window for every preset:** `incorporated_to` 2023-09-30, meaning trading 3+ years (triage.mjs counts 3–30 years in favour and under 2 against).

**Towns:** use post towns. Beeston, Arnold, West Bridgford, Hucknall and Long Eaton sit under Nottingham, and "Beeston" also matches Leeds (build-plan §4). **Check** how `location` matches with `--dump-first`.

| # | Name | Towns | SIC | Reason |
|---|---|---|---|---|
| 1 | Notts trades | Nottingham, Ilkeston | 43210, 43220, 43290, 43330, 43910, 43991, 80200 | The lead-sourcing README's named first pass; strongest sector |
| 2 | Redditch–Alcester engineering | Redditch, Alcester, Studley, Stratford-upon-Avon, Henley-in-Arden | 25110, 25500, 25610, 25620, 25730, 25930, 25990, 29320, 30300 | Strong in both territories plus the auto/aero supply chain (ICP §4) |
| 3 | Property, lettings & FM | Nottingham, Stratford-upon-Avon, Redditch, Alcester | 68310, 68320, 81100, 81210 | Recurring compliance dates, customer-facing sites. Not 68100/68209 |
| 4 | Alcester-side trades | Alcester, Redditch, Studley, Stratford-upon-Avon, Henley-in-Arden | as #1 | Same sector, second territory |
| 5 | Professional practices | Nottingham, Stratford-upon-Avon, Redditch, Alcester | 69102, 69201, 69202, 71111, 74902, 66220, 78109 | Document-heavy, nearly always has a site; the 1–2 person exception applies (ICP §3) |
| 6 | Notts wholesale | Nottingham, Ilkeston | 46690, 46730, 46740, 46900 | Price lists and retyped orders |
| 7 | Stratford venues | Stratford-upon-Avon, Alcester, Henley-in-Arden | 55100, 55209, 56210, 82301, 82302 | Manual bookings visible from outside. Not pubs or restaurants |

Lower yield: Notts haulage & hire (49410, 52103, 52290, 77320, 77390); Alcester rural (01610, 0162, 46210, 46610, 77310). Many of these are sole traders, so they are not on the register (ICP §8).

## 3. Register red flags

**Search vs profile.** The advanced-search row, as `normaliseItem` (puller.mjs) reads it, has `company_name`, `company_number`, `company_status`, `company_type`, `date_of_creation`, `registered_office_address` and `sic_codes`. It probably also has `company_subtype` and `date_of_cessation`; I am **unsure** whether it has `company_status_detail`. Everything about accounts, filings, charges or insolvency is **profile only** (`GET /company/{n}`), which `research()` fetches before any model call. Neither endpoint gives headcount or turnover.

| Flag | Field | In | Action | Why |
|---|---|---|---|---|
| Not active | `company_status` | both | Refuse (search and `admit`) | ICP §6 |
| Striking off | `company_status_detail` = `active-proposal-to-strike-off` | profile | Refuse | Stopping |
| Dormant | SIC 99999; `accounts.last_accounts.type` = `dormant` | search; profile | Refuse | ICP §6. The cabling company passed `admit`, so its SIC was not 99999: only the profile field catches it |
| Non-trading | SIC 74990, 98000, 98100, 98200 | search | Refuse (done) | Nothing to offer |
| Holding/property vehicle | SIC 64205, 64209, 70100, 68100 as the only codes | search | Refuse | who-we-sell-to.md |
| Competitor | SIC 62011, 62012, 62020, 62030, 62090, 63110, 63120 | search | Refuse | who-we-sell-to.md |
| Insolvency | `has_insolvency_history`, `has_been_liquidated` | profile | Refuse | ICP §6 (a historic CVA is arguable) |
| Overdue now | `accounts.overdue`, `confirmation_statement.overdue` | profile | Caution: cap the score | ICP tier 3 treats *past* late filing as a quiet timing signal; being overdue *now* often comes before a strike-off |
| Charges | `has_charges` | profile | Caution | The ICP asks for "a pattern"; one debenture is normal. Count them via `/charges` |
| Subsidiary | `last_accounts.type` `*-exemption-subsidiary`; a corporate officer | profile, officers | Caution | ICP §6: head office elsewhere |
| Too big? | `last_accounts.type` `medium`, `group` | profile | Caution | ICP 51+ |
| Too new | `date_of_creation` | search | Exclude with the window | triage.mjs |
| Post fails | `undeliverable_registered_office_address` | profile | Caution | Post is the main channel (maximum-volume-plan §3) |
| Weak sector | SIC 47xxx, 56101–56103, 56302, 96020 | search | Keep out of targets | ICP §4 (the takeaway was 56103) |

## 4. Budget proxies

`accounts.last_accounts.type` is the only size fact on the register. A size needs two of three limits (Companies Act 2006, raised for years starting on or after 6 April 2025). **Check current thresholds.**

| Type | At most |
|---|---|
| `micro-entity` | £1m turnover (was £632k), £500k balance sheet (was £316k), 10 staff |
| `small`, `total-exemption-full`, `unaudited-abridged` | £15m (was £10.2m), £7.5m (was £5.1m), 50 staff |
| `medium` | £54m, £27m, 250 staff |
| `full`, `group` | Could be any size; often larger or a parent |

A company may file a fuller format than it needs, so the type sets an upper limit on size and does not measure it. A micro-entity can still fall in the core 5–25 band.

**How the agents should use it:** as a ceiling on size and on build-price services, never as a headcount (scoring-model §5.2). The service docs already do this: software needs accounts beyond micro to score 80+, and data_analytics prefers small to micro. Filed accounts state average employees, which the Document API could supply. The pipeline does not fetch it (**check**).

## 5. Pipeline changes, in order

Already in the uncommitted working tree (`index.ts` `research()`, migration `202609230001`): refusal via `registerRefusal` before any model call or site fetch, `no_site` parking, and a caution ceiling. Still to do:

1. **Don't gate on a profile that wasn't read.** `chGet` returns `null` on a 429, so `registerRefusal(null)` passes a dormant company through to the models. Release the candidate and retry instead.
2. **Check territory at the pull.** `pull()` calls `admit(c, { types })` without `areas`. Pass the core and edge postcode districts (build-plan §4) so that Beeston in Leeds, or an Alcester Road elsewhere, never reaches the queue.
3. **Validate targets.** `prospect_save_target` should refuse an empty `sic_codes` (the "any SIC" run) and 5-digit codes not in SIC 2007. `expandSic` passes unknown codes through, and `pull()` reads the resulting 404 as the town being exhausted.
4. **More SIC refusals in `admit()`** (puller.mjs): add the holding/vehicle and competitor sets from §3, refusing only when every code the company lists is in them.
5. **Complete `ACCOUNTS`** in prospect.mjs: `initial`, `interim`, `partial-exemption`, `filing-exemption-subsidiary`, `audited-abridged`, `no-accounts-type-available`.
6. **Later:** seed targets from the triaged bulk universe, which already has trading addresses (maximum-volume-plan §5b).
