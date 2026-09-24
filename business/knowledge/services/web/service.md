# Web

## In one paragraph

Something a customer has to do the hard way. The public-facing part: the
site, the booking flow, the enquiry form that reaches the right person with
everything needed to answer it, the payment taken up front. A site is worth
building when it takes work off the business, not as a brochure for its own
sake. Web needs positive evidence: a site confirmed as theirs and read, whose
own words show customers booking, ordering or enquiring by phone, email or
paper. "No website found" only means our domain guesses missed. It is not
evidence of anything.

## Signals that point here

Only from a site confirmed as theirs and read:
- Booking or ordering language with no way to do it online: "call to book",
  "ring to check availability", "email us to reserve your date", "phone your
  order through".
- A booking or enquiry form to download, fill in and email back. The
  customer's side is web; the retyping behind it is automation.
- Deposits or payment by bank transfer after a call: "pay a deposit to secure
  your date".
- A booking widget on one page but not on the service pages people land on.
- "Call us to discuss your requirements" for work that needs sizes, photos or
  dates before anyone can answer.
- Customers who plainly look them up first (venues, hire, courses,
  appointments) and a site whose only next step is a phone call.

Measured on their own site by code (lines starting m_), each a fact about
this business's site, not its sector:
- m_mobile: no viewport tag, so a phone shows a shrunken desktop page. Most
  people find a trade, a venue or a practice on a phone.
- m_https: served only over plain HTTP, which browsers mark "Not secure" -
  on the page where a customer is asked for their details.
- m_stale or m_oldhtml: a platform long out of support, or techniques from
  before phones browsed the web.
- m_contact saying there is no enquiry form, on a business customers enquire
  with: every enquiry is a phone call or a bare email.
- A site read from the Internet Archive because their own domain has gone:
  a business still trading that once had a site and now has none.

## Signals that point somewhere else

- Online booking or payment already works and the pain is behind it
  (retyping into a diary, chasing confirmations) → **automation**.
- Customers logging in to see their own records → **software**.
- The site is fine; the question is what their sales or enquiry figures
  mean → **data_analytics**.
- Any register signal (an overdue filing, company age, accounts) → no
  service, and never web.

## What we would build

Websites where the site is the actual requirement; booking flows with payment
and calendar sync; enquiry forms that route to the right person with the
right information; payment pages; document delivery that replaces email
attachments.

## What kills it

Visible now, so score low:
- No confirmed site. "None found", parked, placeholder, unreachable or "a
  different company with the same name" all mean we did not find theirs. They
  may trade under another domain, a social page or a platform we cannot see.
- A working site that already takes bookings, orders or payment.
- A sector already served by cheap booking or ordering platforms: salons,
  beauty, restaurants, pubs, takeaways.
- Long established with no site: they have usually decided they do not need
  one, and are usually right.
- A franchise whose site is run by the franchisor.
- Register distress: see the ceilings in the scale.

Learned on a call, so use for walk_away_if:
- Work comes by referral and they do not want more enquiries.
- They have just paid someone else for a new site.
- A redesign for its own sake, with no job attached.

## How this specialist scores

When a site has been read, the evidence for web is on the page. Hold it to
that, and refuse to score what nobody saw.
- No site found and nothing else: 20 at most, whatever the sector.
- Signals that are not about web (a filing, company age, accounts): not
  evidence here. Pass, or redirect if they point elsewhere.
- Confirmed site, customer-facing business, one quoted "call to book" or
  "email to order" line for something customers book: 60–70.
- That, plus volume or size (a team, many dates or services, small-company
  accounts) and no way at all to transact online: 70–85.
- A site that already takes bookings or payment: under 20 for web. Hand on to
  automation for what sits behind it.
- Weak-fit sector: 30 at most unless the page shows a gap the usual platform
  leaves.
- An old copyright year or a dated look, alone: 25 at most. It says the site
  is not updated, not that it loses work, and it never goes in a letter.
- A measured defect on a customer-facing business (m_mobile, m_https,
  m_stale, m_oldhtml): 40–55. It is a fact about their site that costs
  enquiries, it can be checked by anyone, and it can be said politely.
- Two or more measured defects, plus enquiries by phone or bare email only:
  55–70. Add volume or size (a team, many services, small-company accounts):
  up to 75.
- Their own site has gone and only the archive has it, on a business still
  trading: 50–60. The question is whether they noticed.

## The question that settles it

"What happens when an enquiry or booking arrives — and which part of it is
done by phone or by hand?"
