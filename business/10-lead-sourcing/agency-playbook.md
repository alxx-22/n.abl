# What the AI lead-gen agencies do, and what of it we can take

Research pass: 16 August 2026. Sources listed at the foot.

The brief was to look at how current AI lead-generation and GTM agencies acquire
customers, and copy the free parts. This file is the result, in three sections:
what they actually do, what of it survives contact with n.abl's situation, and
the free stack that follows.

**Read the second section before the first is exciting.** Most of this playbook
does not transfer, and the reasons why are more useful than the tactics.

---

## 1. The methodology, stripped of the marketing

Underneath the branding, the current playbook is consistent across vendors and
has four parts.

**Signal-based targeting, not list-based.** The unit of work is no longer "a
company matching the ICP" but "a company where something just changed". The
claim is that reaching someone shortly after a change produces materially better
reply rates than reaching a matching company at an arbitrary moment. The signals
named are almost always platform-native: profile views from ICP-matched
prospects, engagement on a post, website visits attributed back to LinkedIn, new
followers.

**Capture and route automatically.** Signals are collected in real time and
pushed into a campaign keyed to which signal fired, so the message can reference
the actual event.

**Research and draft by machine, approve by human.** The system researches the
signal source, drafts a message referencing something specific and real, and
queues it for a human to approve before sending. This is the part worth
noticing: even the vendors selling automation put a human gate before send.

**Multi-channel in a tight window.** The commonly cited sequence is email →
LinkedIn profile visit → DM → follow-up email, four touches inside 48 hours.

### What the numbers are worth

Very little, and this matters. The headline figures — "3–5× higher meeting rates
per dollar", "8–15 qualified meetings per seat per month", "first meetings
within 72 hours" — appear in vendor marketing with **no third-party validation,
no comparative study and no published methodology**. The supporting evidence is
a testimonial and screenshots of replies. One source states that plainly when
read closely; the rest simply assert.

Treat every number in this section as a claim by someone selling the tool.
Nothing here should be used to set an expectation, and none of it belongs in a
document a client sees.

---

## 2. What actually transfers to n.abl

Four things block most of the above.

**The signals they use require an audience we do not have.** Profile views, post
engagement and new followers are only signals if people are already looking at
you. n.abl has no following, so the entire signal layer as described produces
nothing. Copying it directly would mean building the plumbing for a stream that
is empty.

**Their buyer is not our buyer.** This playbook is written for selling B2B SaaS
and agency retainers to people with a LinkedIn habit and a budget line. n.abl
sells a £800–£1,500 implementation to the owner of a 2–50 person local business
who may not use LinkedIn at all. The channel assumptions do not hold.

**Four touches in 48 hours is wrong for us twice over.** It reads as pressure to
an owner-operator, which is the opposite of the positioning. And a same-week
multi-channel sequence into a UK small business is exactly the pattern that
attracts PECR complaints. See `11-outreach/approval-gates.md`.

**We have no proof yet.** Every tactic above assumes you can point at results.
n.abl currently has labelled illustrative examples and nothing else — see
`17-proof-and-case-studies`. Outbound without proof converts badly no matter how
good the targeting is.

### The three things that do transfer

**Signal-based beats list-based — but our signals are different.** The principle
is sound and does not depend on LinkedIn. Signals available to n.abl for free,
about local companies:

| Signal | Where it comes from | Why it means something |
|---|---|---|
| Newly incorporated, 6–24 months old | Companies House `IncorporationDate` | Past survival, before processes have calcified |
| First accounts filed / category change | Companies House filing history | The business is growing into needing systems |
| Hiring for an admin or ops role | Company site, Indeed, council job boards | About to spend £25k/yr on something a system might absorb |
| Job ad naming a specific manual task | Same | Names the problem in their own words — the single best signal we can get |
| Website with a phone number and no booking form | Their own site | Enquiries arrive by phone at the worst moment |

The last two are worth more than anything a LinkedIn tool produces, because they
describe the problem in the owner's language rather than inferring intent from a
click.

**Machine drafts, human approves.** Already the design in `11-outreach`. Worth
noting that the vendors selling full automation still do this — it is not
caution, it is what works.

**Niche down to one list of 100.** The recurring advice for a standing start is
to pick one specific niche, build 100 qualified businesses, write one message
with one real personalisation variable, send, and iterate on reply data before
adding follow-ups or channels. This is directly usable and costs nothing.

---

## 3. The free stack

### The data foundation: the Companies House bulk snapshot

The commonly repeated objection is that the Companies House **API** cannot
filter by size, sector, region or date, which is true and is why third parties
sell filtered access.

It is also the wrong file. Companies House publishes the **Free Company Data
Product**: a monthly snapshot of every live company on the register, as CSV
inside ZIP, free of charge and explicitly unsupported. One 470MB file or seven
of 49–70MB. Refreshed within five working days of month end.

It carries the fields the filtering objection says are missing:

| Field | Populated | Use |
|---|---|---|
| `RegAddress.PostCode` | 95.6% | Filter to NG (Nottingham) and B49/B50 (Alcester) |
| `SICCode.SicText_1` | 100% | Filter to target sectors |
| `IncorporationDate` | 99.9% | The 6–24 month age signal |
| `CompanyStatus` | — | Drop anything not active |

Filtering happens locally, on a file we downloaded. There is no API quota, no
scraping, no terms to breach, and no per-record cost. This is Class 1 work in
the sense of `15-compute` — ordinary code, effectively £0.

**It also solves a compliance problem by accident, and this is the important
part.** PECR treats corporate subscribers (limited companies, LLPs) differently
from sole traders and partnerships, which are handled as individuals and need
consent rather than legitimate interests. The Companies House register contains
*only* incorporated companies. Sourcing from it therefore excludes, by
construction, the population that would be unlawful to email on a legitimate
interests basis. The free data source and the legal constraint point the same
direction — see `07-crm/compliance-schema.md`.

What it does **not** contain: trading address (registered office is often the
accountant's), employee count, turnover, contact name or email. Those come from
the company's own website, one at a time, by hand at first.

### The rest of the stack, and what it costs

| Layer | Free option | Note |
|---|---|---|
| Candidate list | Companies House Free Company Data Product | Verified free, monthly |
| Enrichment | The company's own website, read manually | Slow on purpose at first — it is also research |
| Scoring | Deterministic rules in ordinary code | `scoring-model.md`. No model call |
| Reply classification | Local open-weight model | Class 2 in `15-compute` |
| Drafting | Claude, on approved shortlists only | Class 3. The only paid step |
| Sending | Existing mailbox | No platform until volume justifies one |

Nothing above requires a subscription. The £36/month ceiling in the master plan
holds.

### The tactic that beats all of it while we have no proof

Every source that addresses a standing start says a version of the same thing:
the first clients care about outcomes, not brand, and the fastest route is a
focused engagement at a keen rate **in exchange for a documented result** — the
baseline, the after, and permission to describe it.

That is not a lead-generation tactic. It is the thing that makes lead generation
work later, and `17-proof-and-case-studies` already exists to capture it. Doing
one of those properly is worth more than a hundred well-targeted emails sent
with nothing to point at.

The second, cheaper than anything else here: **work in public**. Publishing what
gets built — the problem, the approach, the measured result — is repeatedly named
as the strongest distribution move available to someone with no audience and no
budget. It compounds, it costs an evening a week, and it produces exactly the
proof that outbound is currently missing.

---

## What to do with this

Ordered, and each step depends on the one above it.

1. **Do not build the signal pipeline yet.** The signals worth having are
   Companies House events and job ads, not LinkedIn engagement. That changes what
   `build-plan.md` should build.
2. **Download one snapshot and filter it by hand** — postcode and SIC — to see
   how many candidate companies actually exist locally. If the answer is 300, the
   whole approach changes; if it is 30,000, scoring matters more than sourcing.
   This is an afternoon and it settles the question.
3. **Pick one sector from that list** and build the 100.
4. **Get one documented result** before sending anything at volume.

Steps 2 and 3 can happen now. Step 4 is the gate on `11-outreach`, and applying
the `07-crm` compliance migration is the gate on all of it.

---

## Sources

- [Signal-based outbound for GTM agencies — joinvalley.co](https://www.joinvalley.co/blog/b2b-customer-acquisition-strategy-gtm-agencies-signal-based) — the methodology, and the unvalidated metrics
- [GTM engineering trends 2026 — devcommx.com](https://www.devcommx.com/blogs/gtm-engineering-trends-2026)
- [Cold outreach for agencies serving local businesses — systemifyautomation.com](https://www.systemifyautomation.com/blog/why-cold-outreach-is-the-most-important-growth-channel-for-agencies-serving-local-businesses) — the niche-plus-100 method
- [Cold email outreach, UK guide — aether-agency.co.uk](https://aether-agency.co.uk/insights/cold-email-outreach-templates-uk-guide-2026)
- [Solo founder marketing playbook 2026 — lishchuk.com](https://lishchuk.com/blog/solo-founder-marketing-playbook-2026.html) — build-in-public
- [Consulting business models — consultingsuccess.com](https://www.consultingsuccess.com/consulting-business-models) — first clients, results over brand
- [Free Company Data Product — Companies House](https://download.companieshouse.gov.uk/en_output.html) — the snapshot, size and cadence
- [Free Data Product field specification — Companies House](https://resources.companieshouse.gov.uk/toolsToHelp/pdf/freeDataProductDataset.pdf)
- [Companies House API alternatives — globaldatabase.com](https://www.globaldatabase.com/top-5-companies-house-api-alternatives-for-uk-company-data) — the API filtering limitation
