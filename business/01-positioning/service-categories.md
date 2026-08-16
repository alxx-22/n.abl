# Service categories

The six problem-led categories, and what n.abl actually builds for each.

This replaces the old three-pillar structure of Innovation / Automation /
Optimisation. That structure described our toolbox, arranged for our
convenience. This one describes what a client is trying to achieve, in words they
would use unprompted.

The same six appear in the site navigation, the discovery conversation and the
proposal contents. That repetition is deliberate: a client should always be able
to tell where they are.

Last substantive revision: 2026-08-15.

---

## The six, at a glance

| # | Category | What they say when they arrive | Pricing | Typical compute |
|---|---|---|---|---|
| 1 | **Save time** | "This takes us ages every month" | A — efficiency, priced on value | Class 1, some Class 2 |
| 2 | **Reduce mistakes** | "We keep getting this wrong" | A — efficiency, priced on value | Class 1 |
| 3 | **Understand your data** | "We have the data, but not the answers" | A or B | Class 1, Class 2, some Class 3 |
| 4 | **Build something new** | "We need a thing that does X" | B — capability, fixed price | Class 1 to run, Class 3 to build |
| 5 | **Train your team** | "We pay for this and nobody uses it" | B — fixed price | Class 3 in preparation only |
| 6 | **Fix something** | "It worked and now it doesn't" | C — credits | Class 1 |

Pricing categories A, B and C are defined in the master plan, section 3. Compute
classes 1, 2 and 3 are defined in section 4 of the same document. Both are
summarised at the end of this file.

**Every category below has four fixed parts**, in this order: what the client
says when they arrive, what we actually build, which pricing category it falls
under, and the disqualifying signal. The last one is the part that gets skipped
under pressure, which is exactly why it is written down.

**A note on the categories.** They are an opening, not a taxonomy. Real
engagements cross them constantly: a job that starts as "save time" usually
reduces mistakes too, and often ends with a training session. The category
decides how the conversation starts and how the proposal is titled. The diagnosis
decides what gets built.

---

## 1. Save time

### What they say when they arrive

> "This takes us ages every month."

Other openings that are the same category:

- "Karen spends most of Thursday on this."
- "We're drowning in admin."
- "I end up doing it myself at the weekend."
- "Every invoice gets typed in twice."
- "It's fine, it's just a faff."

The tell is a unit of time in the sentence. A person, a task, and a duration.

### What we actually build

The problem is nearly always a person moving information from one place to
another by hand: between two systems, between a system and a spreadsheet,
between an email and a system, or between a piece of paper and all three. The
second most common version is a document assembled by hand from parts that
already exist somewhere.

- **Quote and estimate generators.** A price list plus rules, producing a
  consistent branded document. Removes the assembly time and the pricing errors
  that come from an out-of-date spreadsheet at the same time.
- **Document generation from a template.** Reports, certificates, statements,
  monthly packs, letters. Populated from real data, produced as PDF, filed
  automatically.
- **Data movement between systems with no integration.** Scheduled, logged, and
  with failures reported to a human rather than swallowed silently.
- **Spreadsheet to database migration.** Where a spreadsheet has become an
  operational system and is now the constraint. Forms in, database underneath,
  reports out, several people able to work at once.
- **Recurring report automation.** The monthly pack that takes half a day,
  produced on a schedule instead.
- **Email triage and routing.** Enquiries arriving in a shared mailbox, sorted,
  categorised, logged, routed to the right person.
- **Job sheet and timesheet capture.** Field staff submitting from a phone
  instead of returning paper, with the invoice raised from the same data.
- **Bulk data work.** CSV cleaning, deduplication, matching, reformatting,
  reconciliation. Unglamorous, and frequently the single highest-value hour of
  any engagement.

### Pricing category

**A — efficiency.** Priced on the value of the time released, never on hours.
The arithmetic is done in front of the client, on paper, so they can check it:

> A task takes 12 hours a month. At a £20 an hour loaded cost, that is £240 a
> month. After implementation it takes 2 hours a month, so £40 a month. That is
> £200 a month saved, or £2,400 a year. An implementation at roughly £800 to
> £1,500 lets the client see it plainly: spend about £1,200 once, remove about
> £2,400 a year of labour.

The loaded cost figure must be the client's, not ours. Ask what the person doing
the task costs, including employer's National Insurance and pension. If they do
not know, £20 an hour is a defensible working figure for administrative work and
must be stated as an assumption rather than presented as fact.

### The disqualifying signal

**They will not let you watch the task being done.**

"I can tell you how it works" is not the same as opening the real files and
doing it once while you watch. Every time this is refused, one of three things is
true: the process is not what they think it is, the hours are an impression
rather than a measurement, or somebody else owns the task and has not been told
this conversation is happening. All three produce a quote built on a number that
will not survive delivery.

Two supporting signals that also end it:

- **The measured figure comes out under about £1,000 a year.** One hour a month
  at £20 is £240 a year. There is no job in it, and saying so is worth more than
  the job would have been.
- **They are already mid-migration to a new system.** Automating a process that
  is being replaced in six weeks is spending their money on something they are
  about to throw away.

### Not this category

If the time cost is small but the consequences of getting it wrong are large,
that is category 2. If the task is only slow because nobody knows how to use the
software properly, that is category 5, and it is cheaper for the client.

### Discovery questions

1. How many hours a month, and who does it?
2. What does that person cost, roughly, including on-costs?
3. Show me. Walk through it once with the real files open.
4. What happens now if that person is on holiday?
5. Has anyone tried to fix this before?

### Compute

Overwhelmingly Class 1: ordinary code, effectively £0 to run. CSV work,
deduplication, sorting, filtering, date handling, scheduling, database
operations, regular expressions, HTML extraction, PDF generation, API calls.

Class 2 appears where something has to be categorised or extracted from messy
text, and runs locally on our own machines at no fee. Class 3 is rare here and
usually a sign the problem has been misread.

---

## 2. Reduce mistakes

### What they say when they arrive

> "We keep getting this wrong."

Other openings that are the same category:

- "We had to redo a whole job because someone quoted off the old price list."
- "We nearly missed an insurance renewal."
- "Two people were working off different versions."
- "It only goes wrong occasionally, but when it does it's expensive."
- "I don't trust the numbers in there."

The tell is an incident. They can usually name one, and the memory of it is
still uncomfortable.

### What we actually build

The problem is nearly always a fragile manual process with no validation and no
single source of truth: the same fact recorded in three places and drifting
apart, or a deadline that depends on somebody remembering it.

- **Validation at the point of entry.** A form that will not accept a malformed
  postcode, an impossible date, a missing reference or a price below cost. Most
  data quality problems are far cheaper to prevent than to clean.
- **A single source of truth.** One record for a customer, a job or a product,
  with everything else reading from it rather than keeping its own copy.
- **Expiry and renewal tracking.** Insurance, certifications, DBS checks,
  calibration dates, service intervals, contract renewals, MOTs, qualifications.
  A register, a schedule, and a warning that arrives early enough to act on. One
  of the most reliably valuable things we build for trades and manufacturers,
  and almost entirely Class 1 work.
- **Automated cross-checks.** Invoice against delivery note, order against
  despatch, timesheet against job sheet, bank line against ledger. The system
  flags exceptions and a person looks only at those.
- **Reconciliation reports.** Two lists compared on a schedule, differences
  surfaced, matches ignored.
- **Audit trails.** Who changed what, when. Frequently the actual requirement
  behind a vaguely worded compliance worry.
- **Controlled price lists and rate cards.** One version, dated, with history, so
  nobody quotes from last year's PDF.
- **Permissions and access control**, where the real problem is that everybody
  can edit everything.

### Pricing category

**A — efficiency.** Same arithmetic shape as category 1, different input: the
cost of the error rather than the cost of the hours.

Ask for the last three occurrences and what each one cost. Rework, a credit note,
a wasted visit, an expedited delivery, a lost customer, a fine. Multiply by a
conservative frequency. If the client cannot name three, this may not be as
expensive as it feels, and the honest answer is to say so.

Where an error cost is genuinely unquantifiable but the exposure is real, such as
a lapsed certification, price it as a capability solution at a fixed price
rather than pretending to a number nobody believes.

### The disqualifying signal

**They can name the person who makes the mistakes, but not the process that
allows them.**

"It's Dave, he's careless" is a management problem wearing a technology costume.
A system will not fix a person, and building one means being handed a side in an
internal argument that was running long before we arrived. Worse, it gives
everyone a place to point when it happens again.

Two supporting signals that also end it:

- **They want the system to prove somebody was at fault**, rather than to stop
  the fault happening. That is a disciplinary tool, and we do not build those.
- **The check has to be "usually right".** If a client is comfortable with a
  check that is mostly accurate, they do not have the problem they think they
  have, and we would be selling reassurance rather than reliability.

### Not this category

If the fact lives in one place and is simply hard to find, that is closer to
category 5. If the error only costs time rather than money or risk, price it as
category 1 instead.

### Discovery questions

1. When did this last go wrong, and what did it cost?
2. How did you find out it had gone wrong?
3. Where does this fact live? Anywhere else?
4. Who checks it now, and what happens when they are away?
5. If it went wrong today, how long before anyone noticed?

### Compute

Almost entirely Class 1. Validation, comparison, scheduling and alerting are
deterministic problems and must be built deterministically. A model that is
usually right is worse than no check at all here, because it teaches people to
trust it.

**Do not use AI to check things. Use code to check things.**

---

## 3. Understand your data

### What they say when they arrive

> "We have the data, but not the answers."

Other openings that are the same category:

- "It takes me two days to work out how last month went."
- "Every system gives me a different number and I don't know which is right."
- "I'd like to know which jobs actually make money."
- "We keep the figures, we just never look at them."
- "Someone rebuilds that spreadsheet by hand every Monday."

### What we actually build

Almost never a "big data" problem. Nearly always the same shape: the numbers
exist, they live in three or four places that disagree, and assembling them by
hand costs somebody a day a month — so it happens late, or not at all, and
decisions get made on memory instead.

- **Data cleaning and reconciliation.** Getting the same customer, product or job
  to mean the same thing across the systems that hold it. Unglamorous, and the
  step everything else depends on.
- **A single dataset** assembled on a schedule from the systems already in use,
  so there is one set of numbers rather than four.
- **Reporting that builds itself.** The pack that somebody currently rebuilds by
  hand, produced overnight and waiting before the meeting.
- **Dashboards**, where a live view genuinely changes a decision. Where it does
  not, a scheduled email with five numbers in it is better and cheaper.
- **Decision support.** Job-level profitability, utilisation, where the time
  actually goes. Usually the first time the business has seen it.
- **Spreadsheets done properly.** Often the right answer. A well-built workbook
  the owner already knows how to use beats a dashboard they have to be trained
  into.

**Start with the decision, not the data.** The question is never "what could we
report?" — it is "what would you do differently if you knew?". If there is no
answer to the second question, the report is decoration.

### Pricing category

**A — efficiency**, where reporting currently costs measurable hours. The
arithmetic is the same as category 1: hours a month, loaded rate, hours
afterwards. Two days a month of manual reporting reduced to two hours is a
countable saving and prices cleanly.

**B — capability, fixed price**, where the business has never had the view at all
and there is no before-and-after to measure. No savings figure is offered,
because there is nothing to compare against and inventing one is the fastest way
to lose the client at the three-month mark.

### The disqualifying signal

**The underlying data does not exist, or nobody will own its accuracy.**

Analytics on records nobody maintains produces confident, wrong answers, and the
business will act on them. If job records are half-filled and nobody is
accountable for filling them, that is a process problem to fix first — which may
be category 1 or 2 — and the reporting comes after.

Two supporting signals that also end it:

- **They want a dashboard because a competitor has one.** No decision attached,
  no question it answers.
- **The answer is already available in a report they already own and do not
  open.** Say so. It costs a sale and buys the relationship.

### Not this category

If the numbers are fine and the problem is that one person retypes them between
two systems, that is category 1 or 2 — an integration, not an analytics job.

### Discovery questions

1. What decision would you make differently if you had a better answer?
2. Where do the numbers live now, and who needs them?
3. Who assembles them, how long does it take, and how often?
4. When two systems disagree, which one do you believe, and why?
5. Who is responsible for the underlying records being right?

## 4. Build something new

### What they say when they arrive

> "We need a thing that does X, and nothing off the shelf does it."

Other openings that are the same category:

- "Our customers keep ringing to ask where their certificate is."
- "We want a portal."
- "We've outgrown the spreadsheet."
- "Everyone in our industry does it this way and it's daft."
- "Can you build us an app?"

### What we actually build

Sometimes exactly what they said. More often, an off-the-shelf product does exist
and nobody has found it, or a much smaller internal tool solves the real problem
for a tenth of the cost.

Check for the off-the-shelf answer first, and say so if it exists. Losing a
five-figure build and gaining a client who trusts us is a good trade, and in a
two-town territory it is the behaviour that generates referrals.

- **Client portals.** Customers logging in to see their own documents, jobs,
  certificates, statements or history. We have built one for ourselves, which
  makes it the easiest thing in this list to demonstrate honestly.
- **Internal tools and staff dashboards.** The thing that replaces the shared
  spreadsheet nobody is allowed to touch.
- **Booking and scheduling systems**, where the business has real constraints
  that generic products cannot express.
- **Field applications.** Mobile-friendly job sheets, inspection forms, photo
  capture, sign-off on site.
- **Registers.** Stock, assets, plant, vehicles, tools, documents.
- **Websites**, where the site is the actual requirement rather than a wrapper
  for something else.
- **Customer-facing document delivery**, with private storage and short-lived
  signed links rather than files emailed as attachments.
- **Small integrations that become products**, where a client's workflow is
  unusual enough to be worth building once and owning.

### Pricing category

**B — capability. Fixed price, always.** Return on investment cannot be measured
cleanly before the fact, and pretending otherwise produces a number nobody
believes.

Scope is defined in writing, the price is stated, and changes go through credits
or a new quote. This is the category where scope discipline decides whether the
job is profitable, and where an undefined "and it should also do..." is most
likely to appear at week three.

Indicative bands: [PLACEHOLDER — set these after the first three fixed-price
builds are delivered and the real hours are known. Quoting a band before then
invents a number and anchors us to it.]

### The disqualifying signal

**They will not answer "what happens on the day it does not exist?"**

If nobody can describe what the business does today instead, then either it is
not a real requirement or the real requirement has not been found yet. Building
against an unanswered version of that question produces something correct and
unused, which is the most expensive possible outcome for both sides.

Two supporting signals that also end it:

- **A finished specification and a request for a price only.** No diagnosis is
  wanted, the work is being quoted against three other suppliers on price alone,
  and the part where we are useful has been cut out. Deprioritise it.
- **The build is a product venture rather than a business need.** Something to
  sell to their industry, funded from hope, often with equity or deferred payment
  attached. That is a co-founder request, not a client engagement.

### Not this category

If an existing process is being improved rather than a new capability created,
that is category 1 or 2, and it is priced on value instead of a fixed price. The
distinction matters commercially: getting it wrong means either leaving money on
the table or quoting a return on investment nobody will believe.

### Discovery questions

1. What do you do today instead of having this?
2. Who uses it, how many of them, and how often?
3. What happens on the day it does not exist? Push hard on this one.
4. Have you looked at anything off the shelf? What was wrong with it?
5. What is the smallest version that would be genuinely useful?

### Compute

Class 1 for the running system in almost every case. Class 3 is used heavily
during the build itself, for architecture and difficult coding, which is exactly
what Claude is for.

Keep the two separate. Using an expensive model to build the thing does not mean
the thing needs an expensive model to run. Most of what we ship should cost
effectively nothing to operate, and that is a selling point.

---

## 5. Train your team

### What they say when they arrive

> "We pay for this software and nobody really uses it."

Other openings that are the same category:

- "We're only using about a tenth of it."
- "Everything stops when Sarah's off, because only Sarah knows how."
- "Nothing is written down anywhere."
- "The staff are using ChatGPT and I don't know what they're putting into it."
- "Can you just show us how to do it ourselves?"

### What we actually build and deliver

Usually exactly what they described: a business paying a monthly licence fee for
a product it uses a tenth of, having concluded the product is the problem.

This is the most underrated category in the list. It requires no build, carries
no maintenance burden, delivers value in a single day, and produces goodwill that
converts into build work later. It is also the honest answer more often than we
will find comfortable.

- **Tool training on what they already pay for.** Microsoft 365, Google
  Workspace, Xero, QuickBooks, Sage, their CRM, their booking system, their job
  management product.
- **Spreadsheet training past the basics.** Lookups, pivot tables, Power Query,
  structured tables, and the discipline of separating data from presentation. The
  highest-return training available to this profile.
- **Shared mailbox and inbox practice.** Rules, categories, shared ownership, and
  getting a business out of the state where one person's inbox is the operating
  system.
- **File structure and permissions.** SharePoint, OneDrive, Google Drive. Where
  things live, who can see them, what happens when someone leaves.
- **AI tool training with guardrails.** How to use a chatbot usefully, and more
  importantly what must never be pasted into one: client personal data, payroll,
  anything commercially confidential. Small businesses are already doing this and
  almost nobody has told them the rules.
- **Written runbooks and documentation.** The procedure written down so it
  survives the person who knows it. Frequently the real deliverable.
- **Screen recordings** for procedures easier shown than written.
- **Handover documentation** for anything we have built, included in every build
  rather than sold separately.

### Pricing category

**B — fixed price**, per session or per programme. Not hourly, for the same
reason nothing else is hourly: it punishes us for being efficient and it invites
a negotiation about duration rather than value.

Session rates and programme prices: [PLACEHOLDER — depends on whether delivery is
on site or remote, and on group size. Set after the first two sessions have been
delivered and the real preparation time is known.]

Training bought as part of an implementation should be cheaper than training
bought alone. Training is also redeemable against Educate credits, which is the
natural way for it to be bought after a project.

### The disqualifying signal

**The tool genuinely cannot do the job.**

Training will not make it. Establish this honestly before selling a session,
because a training day that ends with "the software cannot actually do this" is a
refund and a lost reputation in a small town. If the tool is wrong, say the tool
is wrong, and the conversation becomes category 1 or category 4.

Two supporting signals that also end it:

- **Nobody will be released to attend.** A training day booked for people who
  will be pulled onto jobs that morning is money burned. Ask who is coming, by
  name, and whether their manager knows.
- **The request is really a performance problem.** Training as a formality before
  a difficult conversation about somebody's work is not a technology engagement
  and should not be dressed as one.

### Not this category

If people know how to use the tool and it still takes all day, the tool is not
the constraint and this is category 1.

### Discovery questions

1. What software do you pay for monthly? All of it.
2. Which of it does everyone use, and which does one person use?
3. When someone joins, how do they learn this?
4. What is written down, and where?
5. Who is the person everybody asks when they are stuck?

### Compute

Class 3 during preparation, for materials and documentation. Nothing at delivery.
The running cost of a training engagement is a room and a person.

---

## 6. Fix something

### What they say when they arrive

> "It worked and now it doesn't."

Other openings that are the same category:

- "Can you change the wording on the certificate?"
- "The import stopped last Tuesday and nobody noticed until Friday."
- "Our supplier changed their file and now it won't load."
- "We need one more field on the form."
- "The person who set this up has left."

### What we actually do

Something changed underneath. A supplier altered a file format, an interface
updated, a password expired, a certificate lapsed, a person left, or volume grew
past what the original design assumed.

This is the post-project operating layer, and it is how a client relationship
continues without a retainer. Work is redeemed against **n.abl credits**, in
three kinds:

| Credit type | Covers |
|---|---|
| **Build** | Small modifications, integrations, scripts, automation changes |
| **Assist** | Troubleshooting, repairs, configuration, technical support |
| **Educate** | Staff training, workshops, documentation, tool training |

Typical work: an automation that stopped, an integration broken by a supplier
change, a new field or report, a rule change, migration when the client switches
software, reconstructing how something works after the person who knew has left,
a performance problem that arrived with growth.

### Pricing category

**C — credits.** Bought in bulk, cheaper when bought alongside the
implementation. The pitch, in the client's words:

> "You do not pay us monthly to be on standby. You buy support when you actually
> need support."

Pack sizes and prices: [PLACEHOLDER — set alongside the first three real quotes,
not before. A pack must be large enough to be worth administering and small
enough to be an easy yes at the point of project sign-off, which is the only
moment it will ever be easy to sell.]

Credit expiry: [PLACEHOLDER — decide a period. Long enough to be fair, short
enough that the ledger does not become an indefinite liability. It has to be
stated plainly at the point of sale, because a surprise expiry destroys more
trust than the credit was worth.]

### The disqualifying signal

**Nobody can produce the source, the accounts or the credentials for the thing
that broke.**

Being asked to repair a system whose code nobody has, whose hosting nobody can
log into, and whose original builder is unreachable is not a fix. It is an
archaeology project priced as a small job, and it will overrun. If the client
wants it rescued anyway, that is a new engagement, quoted properly, with the
investigation itself as the first deliverable.

Two supporting signals that also end it:

- **The fix is a redesign.** Say so early rather than burning a credit pack on
  something that was never going to fit inside it.
- **They want credits as an insurance policy.** Credits are prepaid work at a
  better rate. They are not cover, not a guaranteed response time, and must never
  be sold as either.

### The rules

- **Clients own what is built. Always.** A client with no credits still owns a
  working system, and it keeps running.
- **A defect in something we built and delivered is fixed at our cost**, not
  against the client's credits. Get this boundary right in the scope document and
  be generous at the edges. Arguing with a client about whose fault it is costs
  more than the fix.
- **Credits do not expire silently.** Whatever period is set, it is said out loud
  at the point of sale and shown in the portal.

### Discovery questions

1. When did it last work, and what changed around then?
2. Who else has touched it?
3. Do you have the accounts and the source? Can you show me now?
4. What is it costing you while it is broken?
5. Is this a fix, or is this the thing you actually wanted in the first place?

### Compute

Class 1 in almost every case. Diagnosis occasionally justifies Class 3.

---

## Routing summary

### Which pricing category

```
Did the business already do this, just worse?
  ├─ yes → A. Efficiency. Price on the value released. Show the arithmetic.
  └─ no  → Is it a capability they did not have?
             ├─ yes → B. Capability. Fixed price. Scope in writing.
             └─ no  → Is it a change to something already delivered?
                        └─ yes → C. Credits.
```

### Which compute class

```
Does the task need judgement, or only rules?
  ├─ only rules → Class 1. Ordinary code. Effectively £0.
  └─ judgement  → Is it simple, repetitive judgement?
                    ├─ yes → Class 2. Local model on our own machines. £0 in fees.
                    └─ no  → Class 3. Claude. Spend it deliberately.
```

**The correction that must not be got wrong.** Claude Code running locally is not
a local Claude model. Claude Code is a local interface and orchestration
environment; the Claude models themselves are cloud-hosted. Running the tool on
your own machine does not move the model onto your own machine.

The saving comes from routing, not from location: sending low-intelligence work
to ordinary code or a genuinely local open model, and spending Claude only where
intelligence is worth paying for. Anyone who describes this the wrong way round
will build the cost model wrong, and will eventually say it wrong in front of a
client.

### What we do not build, in any category

- Anything requiring us to supply regulated legal, medical or financial advice.
- Anything whose purpose is to send unsolicited messages without the compliance
  fields and the opt-out block in place.
- Anything sourced from a place whose terms forbid it, including building a
  client a lead list out of Google Maps.
- Ongoing managed IT, networks, hardware supply or a helpdesk.
- Anything where the client's actual problem is that the business is not viable.

The words to use when refusing each of these are in
[`saying-no.md`](saying-no.md). Knowing the boundary is not the same as being
able to say it out loud on a call.
