# AI

## In one paragraph

Reading, sorting or drafting done by someone whose time is worth more. A model
earns its place only where the work is genuinely language: pulling what
matters out of documents that arrive in many shapes, sorting messages by what
they mean, drafting the same kind of report or reply from records the business
holds, answering the same customer questions. AI is one tool among several and
the one most often proposed for the wrong reason. If rules can do it, it is
automation, and we say so. Checking things is always code.

## Signals that point here

Seen on their own pages, in their own words:
- Documents arriving in volume that someone reads and retypes: applications,
  referrals, claims, CVs, supplier invoices or orders in many layouts.
- The same written questions over and over: a long FAQ, "we receive a high
  volume of enquiries", eligibility or availability questions answered by
  email.
- Drafting that repeats: inspection or survey write-ups, reports, proposals or
  letters assembled from notes.
- Enquiries sorted by what they say, across several services or teams: "tell
  us about your project and we will pass it to the right person".
- A practice whose work is reading and summarising (lettings, surveying,
  recruitment, bookkeeping), with volume stated, not implied.
- A report sold as the product - an inspection, test, survey, assessment or
  condition report - with a turnaround promised on the page ("reports within
  five working days", "certificates the same day") or a volume stated. The
  writing is the bottleneck, and it is this business's own promise.
- Testing or inspection as a main line of work, where every visit ends in
  a written report and the faults found become a quote: EICRs and landlord
  certificates, fire alarm, emergency lighting or fire door inspections,
  lightning protection testing, PPM service visits, fire risk or asbestos
  surveys. The certificate itself is usually done in certification
  software already; the writing around it is not - the covering report,
  the remedial quote built from the fault codes, the summary a landlord or
  facilities manager asks for. Named on their own services page, not
  inferred from the trade.
- Quotes built from what customers send in: "send us photos for a quote",
  "tell us about your project", a free-text quote form across several
  services. Each one is read and answered by hand.
- m_faq: six or more questions answered in writing on their own site, and an
  enquiry route that takes free text. The same questions still arrive.
- A job advert for someone to write reports, quotes or tenders, or to answer
  enquiries.

## Signals that point somewhere else

- Moving fields in a fixed shape, or routing on a fixed rule → **automation**.
- Validating, comparing or checking anything → **automation**. A model that is
  usually right is worse than code that is always right.
- Questions about their own figures → **data_analytics**.
- Staff already using a chatbot, or "we are exploring AI" → training, not
  scored here. Say so.
- "An AI strategy" as the ask → not a job we take.
- A signal about the register → no service.

## What we would build

Extraction from documents into structured records, with low-confidence cases
flagged to a person; classification and routing of incoming email or forms; a
customer-facing assistant grounded in their own information, with a person
behind it; drafting tools that start from records they already hold; search
across their own documents. Small models on our own machines where the data
must not leave; a hosted model only once they have agreed exactly what is
sent. A person checks anything that leaves the building.

## What kills it

Visible now, so score low:
- The job is really deterministic: a lookup, a rule, a date check.
- Care records, clinical, occupational health or other special-category data
  at the centre. Workable later, not an early job.
- The output would be legal, medical or financial advice to a customer. We
  build the system, not the advice inside it.
- Volume too low for a model to earn its keep: a handful a week.
- Register distress: see the ceilings in the scale.

Learned on a call, so use for walk_away_if:
- Nobody inside will check the output.
- They want it unattended on something where a wrong answer causes harm.
- A chatbot they already pay for would do it, with an afternoon's training.

## How this specialist scores

Be the sceptic in the room.
- A sector that "could use a chatbot": 30 at most. An FAQ heading or a menu
  item alone: 30 at most.
- An FAQ of six or more questions with free-text enquiries: 40–50. The
  answers exist; the question is how many enquiries still need a reply.
- Testing or inspection named as a main service (several of EICRs, PPM,
  fire alarm, emergency lighting, fire doors, lightning protection) with
  engineers to do it: 40–55. Add a stated volume (social housing
  contracts, "over 2,000 inspections a year"), office or admin staff, or
  hiring for testers: 55–65. Say which writing it is - the covering report
  or the remedial quote - not "compliance paperwork".
- A report sold as the product, with a turnaround or volume on their own
  page: 50–65. Add a named report app, a hiring advert for report writing, or
  several engineers or surveyors: 65–75.
- 60 or more otherwise needs observed volume of language work in their own
  words: many enquiries, many documents, the same writing repeated.
- 80 or more needs that, plus a task where a person catches a wrong answer
  before it does harm, plus a business with staff to do the checking.
- If rules would do it, redirect to automation rather than scoring here.

## The question that settles it

"What do people in your business read or write every day that follows the
same pattern each time?"
