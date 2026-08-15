# n.abl — the business plan

This is the master document. It replaces the old business pack and the separate
outreach plan. If those still exist anywhere, they are out of date and this file
wins.

It is a working document. Open it to see where the business is and what to do
next.

Last substantive revision: 2026-08-15.

---

## 1. What n.abl is

n.abl is a **technology implementation partner for small businesses**.

It finds an expensive, repetitive or fragile part of a business and builds the
most appropriate solution. AI is one tool among several, alongside Python, web
development, integration, automation and training. If the best answer is not AI,
AI is not forced into it.

n.abl is **not** an "AI automation agency". That framing is being retired
deliberately, and this is the single most important change in the plan.

**Why this matters commercially.** Three reasons, in order of weight:

1. It is far more defensible. "We build AI agents" is a sentence thousands of
   companies can say, and none of them can say it differently.
2. It survives the hype cycle and the falling cost of AI. When model calls get
   cheap enough to be free, a business built on selling model calls has nothing
   left. A business built on understanding a client's process still has the
   understanding.
3. It addresses a much larger market. Most small businesses do not have an AI
   problem. They have a process problem, and some of those are solved with AI.

### The offer is problem-led, not tool-led

The old structure was three pillars: Innovation, Automation, Optimisation. That
is a description of our tools, arranged for our convenience. Clients do not
arrive knowing which pillar they need.

The customer question is: **what are you trying to improve?**

| Category | What it means |
|---|---|
| **Save time** | Find repetitive work and automate it |
| **Reduce mistakes** | Replace fragile manual processes with reliable systems |
| **Get more customers** | Improve lead capture, follow-up and conversion |
| **Build something new** | Design and build software, websites, internal tools |
| **Train your team** | Make people better at the tools they already pay for |
| **Fix something** | Assistance credits, for when something breaks or needs changing |

Innovation / Automation / Optimisation may survive as a strapline. It must not
be the organising structure of the offer, on the site or in conversation.

---

## 2. Who it is for

**The ideal client** is a small UK business, roughly 2 to 50 people, that:

- has at least one process that is clearly costing real money in wasted hours or
  repeated errors, and can point to it
- has someone with authority to say yes without a committee
- runs on ordinary tools already: spreadsheets, email, a booking system, an
  off-the-shelf CRM, a website they do not fully control
- wants the problem gone, and does not care what it is built in
- can pay four figures for an implementation without it being an existential
  decision

The best possible signal is a business owner describing a task by how long it
takes them, not by what software it uses.

**Who it is explicitly not for:**

- Anyone shopping for "an AI strategy". If the requirement is framed as a
  technology rather than a problem, the engagement will end badly for both
  sides.
- Businesses wanting a body to sit on a monthly retainer. There are no
  retainers. See section 3.
- Startups wanting a technical co-founder or equity-priced work.
- Enterprises with procurement, security questionnaires and a six-month cycle.
  The overhead exceeds the deal.
- Anyone whose actual problem is that the business is not viable. Automating a
  loss-making process makes the loss arrive faster.
- Work that requires regulated advice: legal, medical, financial. We build the
  system, we do not supply the advice inside it.

Saying no to these quickly is part of the model. Time is the only inventory.

---

## 3. What it sells

**There are no retainers.** Two pricing categories, plus a credit layer that
sits on top after delivery.

### A. Efficiency solutions

An existing process made cheaper, faster or better.

These are priced on **economic value, not hours**. The method:

```
  current monthly cost of the problem
– expected monthly cost after implementation
= monthly value created
× 12
= first-year value

price = a fraction of first-year value
```

**The worked example.** Reuse this one. It is concrete, the arithmetic is
checkable in front of a client, and it does not oversell.

> A task takes 12 hours a month. At a £20/hour loaded cost, that is **£240 a
> month**.
>
> After implementation it takes 2 hours a month, so **£40 a month**.
>
> That is **£200 a month saved**, or **£2,400 a year**.
>
> An implementation priced at roughly **£800 to £1,500** lets the client see it
> plainly: *spend about £1,200 once, remove about £2,400 a year of labour.*

Internally we still track our own labour cost on every job, because we need to
know which kinds of work are profitable. We do not sell it. Hourly pricing
punishes us for getting faster, and getting faster is the entire point of the
tooling.

### B. Capability solutions

Something the business did not previously have: a portal, an app, a website, an
internal tool.

ROI here cannot be measured cleanly before the fact, and pretending otherwise
produces a number nobody believes. So these are **fixed price**. Scope is
defined, the price is stated, and changes go through credits or a new quote.

### C. n.abl credits

The post-project operating layer. Bought in bulk, cheaper when bought alongside
the implementation. Redeemable against three things:

| Credit type | Covers |
|---|---|
| **Build** | Small modifications, integrations, scripts, automation changes |
| **Assist** | Troubleshooting, repairs, configuration, technical support |
| **Educate** | Staff training, workshops, documentation, tool training |

The pitch, in the client's words:

> "You do not pay us monthly to be on standby. You buy support when you actually
> need support."

Clients own what is built. Credit pack sizes and prices: [PLACEHOLDER — to be
set alongside the first three real quotes, not before].

---

## 4. How the work gets done

The budget is **two Claude Pro subscriptions, about £36 a month total**, and the
PCs we already own. Everything the business does has to fit inside that until it
earns more.

That is achievable, because most work in a typical automation job needs no
intelligence at all. The discipline is knowing which class a piece of work
belongs to, and refusing to pay for a class above it.

### Class 1 — no AI

Ordinary code. CSV work, deduplication, sorting, filtering, date handling,
scheduling, database operations, regular expressions, HTML extraction, PDF
generation, API calls, CRM updates.

Cost: effectively **£0**. This is the majority of most projects.

### Class 2 — local AI, on our own machines

Ollama, llama.cpp, small open-weight models.

Classification, basic extraction, sentiment, spam detection, simple
summarisation, lead scoring, categorisation, embeddings, simple rewriting.

Cost: **£0 in fees**, bounded by our own hardware and time.

### Class 3 — Claude

Complex reasoning, architecture, high-quality copy, difficult coding,
client-facing documents, strategic analysis, ambiguous conversation.

Cost: the £36 a month, and it should be spent on work that is genuinely worth an
expensive model.

### The correction that must not be got wrong

**Claude Code running locally is not a local Claude model.**

Claude Code is a local interface and orchestration environment. The Claude models
themselves are cloud-hosted. Running the tool on your own machine does not move
the model onto your own machine.

The saving therefore does not come from "running Claude locally". It comes from
**routing**: sending low-intelligence work to ordinary code or a genuinely local
open model, and spending Claude only where intelligence is worth paying for.

Anyone who describes this the wrong way round will build the cost model wrong,
and will eventually say it wrong in front of a client.

---

## 5. How clients are found

### Research first, sending second

**Automate research before automating sending.** A machine that can send 10,000
bad emails is a liability, not an asset. It burns the domain, the list and the
reputation at the same time, and none of the three come back cheaply.

The sequence, with the human checkpoints in place:

```
find → research → score → shortlist
     → HUMAN inspects
     → HUMAN approves
     → Claude personalises
     → HUMAN approves
     → send
     → deterministic follow-up timer
     → classify replies locally
     → escalate to a human
```

Two approval gates, both human, both before anything leaves the building. The
follow-up timer is a plain scheduler, not a model. Reply classification is Class
2 work and runs locally.

### The sourcing correction

**Do not build the core lead database by bulk-exporting Google Maps.**

Google's Maps terms restrict using Maps content to create or augment business
listings, mailing lists or telemarketing lists. Places is pay-as-you-go with
field-level billing, not a permanent free allowance, so the "free" plan the
original outreach plan assumed does not exist in the form it assumed.

Treat Google as **one discovery signal**, never the database of record.

Prefer, in rough order of usefulness:

- Companies House
- local and industry directories
- the businesses' own websites
- council and business directories
- public company information
- manually verified results
- licensed datasets
- direct research

Enrich from the business's own website. It is permitted, it is more accurate
than a directory listing, and it produces far better outreach, because the letter
can refer to something the business actually said about itself.

### Compliance is a database feature, not a policy

A policy is something a person has to remember. A database constraint is
something the system cannot get wrong. Compliance goes in the schema.

ICO guidance distinguishes **corporate subscribers** from **sole traders and
individual subscribers**, and the rules for electronic marketing differ
materially between them. Corporate subscribers can generally receive unsolicited
B2B electronic marketing without PECR consent, but identity and opt-out
requirements still apply, and personal data used for B2B marketing remains
subject to UK data protection law.

So the CRM must carry, per record:

| Field | Why |
|---|---|
| `subscriber_type` | Corporate, sole trader or individual. Decides which rules apply. |
| `lawful_basis` | Recorded at the point of adding, not reconstructed later |
| `source` | Where the record came from |
| `source_date` | When it came from there |
| `privacy_notice_status` | Whether the required notice has been given |
| `marketing_status` | Current permitted state |
| `opt_out` | Set once, never unset by an import |
| `suppression_list` | Survives deletion of the lead record |
| `contact_history` | What was sent, when, by whom |

**The sending engine must hard-block `opted_out`.** Not a warning, not a filter
in a query someone might forget to apply. A block at the send path, enforced in
the database, that cannot be bypassed by the interface.

None of these fields exist in the CRM today. See section 6.

---

## 6. The build order

### What exists today

A React 18 + Vite SPA deployed on Netlify, with Supabase providing Postgres,
auth and private file storage. Do not propose rebuilding any of this.

| Piece | Detail |
|---|---|
| **Marketing site** | Public, live |
| **Client portal** | Access-key sign-in, RLS-scoped, SELECT-only |
| **Team space** | Supabase Auth, five CRUD tabs, file uploads, unlinked from public nav |
| **Sales CRM** | Leads, contacts, email drafts. All AI has been removed. |
| **Legal pages** | Privacy, terms, cookies |
| **Email pack** | Six branded templates, built to `.eml` from source |
| **Welcome-pack generator** | Client welcome document, generated from the team space |

Security, as built: portal access keys are 59.5-bit, generated with a CSPRNG.
Login is rate limited per IP, per key-prefix and globally. Storage buckets are
private and served only through short-lived signed URLs.

Two known gaps in what exists: the client-portal schema is not yet in version
control, and the CRM has none of the compliance fields listed in section 5.

### The brand, as it now is

The old pack is on the old brand. Everything below replaces it. The old palette
(pure black `#0A0A0A`, electric lime `#B8FF00`, Archivo Black, a lime square
dot) is wrong and should be deleted wherever it is found.

| Token | Value |
|---|---|
| Ground | `#0E0C0A` warm espresso, never flat corporate black |
| Surface | `#1A1613` raised panels |
| Cream | `#F0E7D8` body text on dark, `#FBF6EC` headings |
| Muted cream | `#9A8F80` secondary text on dark |
| Amber accent | `#E9AC57`, light `#F2C57E`, deep `#B87718` |
| Ink on cream | `#14110E` |

**On light grounds you must use the deep amber `#B87718`.** Plain amber reaches
only 1.97:1 on near-white and fails contrast outright.

Typefaces: Space Grotesk for display, Inter Tight for UI, JetBrains Mono for keys
and figures. All three are **self-hosted**, never loaded from a font CDN, because
requesting them from Google discloses every visitor's IP address to Google.

**The logo is drawn artwork, not type.** It is a 13-unit monoline stroke with
butt caps and true-circle curves. Masters live at `public/brand/wordmark.svg` and
`public/brand/mark.svg`. It must never be described as being "set in" any
typeface, in any document, ever. The square full stop survives from the old
identity and is now amber. Optical letter spacing between outer edges is
7 / 7 / 13 / 10.

### v1 to v5

**v1 — done.** Everything in the table above. The business has a front door, a
place to put clients, a place to run itself and a place to keep leads.

**v2 — make what exists match the plan.** Nothing new is built until this is
finished.

- Rewrite the site copy from the three pillars to the six problem-led categories
- Add the compliance fields from section 5 to the CRM, with the opt-out block
  enforced at the database level
- Pull the client-portal schema into a committed migration so the backend can be
  rebuilt from source
- Purge remaining old-brand assets and descriptions

**v3 — the research pipeline.** Find, enrich, score, shortlist. Sourced from
Companies House, directories and the businesses' own websites. Class 1 and Class
2 work only, no Claude in the loop. Output is a shortlist a human reads, not an
outbox.

**v4 — the outreach engine.** Only after v3 produces shortlists that are
consistently worth reading. Claude personalises, a human approves, the sender
hard-blocks opt-outs, a deterministic timer handles follow-ups, and replies are
classified locally and escalated to a person.

**v5 — the commercial layer.** The ROI calculator from section 3 turned into a
quote generator, and the credit ledger: balances, redemption against
Build / Assist / Educate, and a client-visible balance in the portal.

The order is deliberate. Each version is useless without the one before it, and
building v4 before v3 produces exactly the liability described in section 5.

---

## 7. How to use this folder

Only this file exists in `business/` today. The folders below are the agreed
structure. Create each one when work on it actually starts, so an empty folder
never implies progress that has not happened.

Status values are `done`, `in progress`, `not started`, and they are set
honestly. Most of this business does not exist yet.

| # | Folder | What it is for | Status |
|---|---|---|---|
| 01 | `01-positioning` | The repositioning, the six categories, the messaging spine, what we say no to | in progress |
| 02 | `02-brand` | Palette, typefaces, logo masters, contrast rules, usage | done |
| 03 | `03-website` | Public marketing site | done |
| 04 | `04-legal` | Privacy, terms, cookies, plus client contracts and scope documents | in progress |
| 05 | `05-portal` | Client portal | done |
| 06 | `06-team-space` | Internal team space | done |
| 07 | `07-crm` | Sales CRM and its compliance schema | in progress |
| 08 | `08-email-pack` | Six branded email templates | done |
| 09 | `09-welcome-pack` | Client welcome-pack generator | done |
| 10 | `10-lead-sourcing` | Sourcing, enrichment, scoring, shortlisting (v3) | not started |
| 11 | `11-outreach` | Approval-gated sending, follow-ups, reply handling (v4) | not started |
| 12 | `12-pricing` | ROI worksheets, quote templates, the value calculation | not started |
| 13 | `13-credits` | Credit packs, ledger, redemption (v5) | not started |
| 14 | `14-delivery` | Onboarding, project runbook, handover, ownership transfer | not started |
| 15 | `15-compute` | Class 1 / 2 / 3 routing, local model setup, cost tracking | not started |
| 16 | `16-finance` | Costs, pricing outcomes, tax set-aside, spend decisions | not started |

Notes on the entries where the status could hide something:

- **01 positioning** — decided, written down here, and carried through to the
  site, the email pack and the CRM's outreach copy. Still open, and the reason
  this is not `done`: the folder's own checklist asks for the ICP to be tested
  against a real list of local businesses, and for both founders to be able to
  give the positioning from memory. Neither has happened. There is also no
  proposal or contract written in the new framing yet.
- **03 website** — built, live, and rewritten to the six categories. The three
  pillars are gone from the offer structure, the invented impact metrics have
  been deleted, and the case cards now state that they are examples rather than
  clients. What it still lacks is any real proof: no client work to point at,
  and no testimonials.
- **04 legal** — the three public pages are live. There is no client contract
  and no scope-of-work template. **None of the legal documents have been
  reviewed by a solicitor.** Do not tell anyone, in any document or
  conversation, that they have.
- **07 crm** — built and in use. None of the compliance fields exist yet, so it
  cannot legally drive outreach in its current state.

---

## 8. The money

### What it costs to run, today

| Item | Monthly cost |
|---|---|
| Claude Pro × 2 | £36 |
| Netlify | £0, free tier |
| Supabase | £0, free tier |
| GitHub | £0, free tier |
| Fonts | £0, self-hosted |
| Local models | £0, open weights on existing PCs |
| Hardware | £0, machines already owned |
| **Total** | **£36** |

Domain registration and renewal: [PLACEHOLDER — annual, not monthly, add the
real figure].

That is the whole cost base. It is worth stating plainly, because it changes what
"a slow month" means. n.abl does not need to win work to survive the month. It
needs to win work to grow. Those are very different pressures, and the second one
produces better decisions than the first.

### Where the first earnings go, in order

Not in order of appeal. In order of what removes the most risk per pound.

1. **Tax set-aside.** Before anything is treated as income. Money owed to HMRC
   was never revenue.
2. **Backups and continuity.** Supabase's paid tier, for point-in-time recovery.
   Client data currently sits on a free tier with no meaningful recovery story.
   This becomes urgent the moment there is a second paying client, not later.
3. **Insurance and a solicitor.** Professional indemnity cover, and a solicitor
   actually reading the contract and scope templates. Before contracts scale, not
   after something goes wrong.
4. **Sending infrastructure.** A proper transactional sending setup with a
   warmed domain, once outreach volume makes deliverability a real constraint.
   Not before v4 exists.
5. **A licensed data source.** Paying for verified data instead of extracting
   more of it. Cheaper than the alternative and considerably safer.
6. **Compute.** More Claude capacity, or a machine for Class 2 work. Only when
   there is a measured queue that justifies it, and only after the routing in
   section 4 has been applied properly. Most "we need more compute" is actually
   "we are sending Class 1 work to Class 3".
7. **Everything that only looks like growth.** Ads, tools, subscriptions,
   software with a monthly fee. Last, and each one has to displace something.

The rule underneath the list: **do not raise the fixed cost base to solve a
problem a one-off purchase would solve.** The £36 figure is an asset. Protect it.
