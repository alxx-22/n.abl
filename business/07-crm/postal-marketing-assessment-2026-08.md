# Postal marketing assessment — PMA-2026-08-v1

```
Reference:    PMA-2026-08-v1
Status:       complete
Completed:    2026-08-21
Assessor:     Alex
Covers:       Unsolicited business-to-business marketing by POST to UK
              businesses, addressed to a role rather than a named person
Review:       on any change in section 6, or by 2026-11-21, whichever is first
```

> **It is immutable.** If the assessment changes, write a new version and leave
> this one alone.
>
> **It has not been reviewed by a solicitor.** Nothing here is legal advice.

---

## 1. Why this document exists, and why it is short

`LIA-2026-08-v2` section 8 says in terms that it covers electronic mail only
and that post is not assessed. Post is now the primary channel, so it needs its
own assessment.

It is much shorter than the LIA, and the reason is not that less care was taken.
It is that postal marketing to a role at a business address engages neither of
the two regimes that make email hard. Most of the LIA's length is spent on
balancing tests and ceilings that simply do not arise here. Where something
*does* arise, it is in sections 4 and 5, and those are the parts to read.

## 2. Why post, and not email

Not a preference. Two facts decide it.

**Cold email cannot reach most UK businesses.** PECR regulation 22 requires
consent for unsolicited marketing email to an *individual subscriber*, and the
ICO classes sole traders and ordinary partnerships as individual subscribers.
The Department for Business and Trade's 2025 population estimates put UK
private-sector businesses at 5.7 million, of which 3.2 million are sole
proprietorships and 368,000 are ordinary partnerships — **63% of all
businesses**. We have no consent from any of them, and no soft opt-in, so email
is closed. Companies House does not even list them, so our largest register is
structurally blind to the majority of the market.

**Post is outside PECR entirely.** PECR governs electronic communications.
Postal marketing is not one, needs no consent, and carries no screening
obligation equivalent to TPS or CTPS.

So the channel that reaches the businesses we could not otherwise reach is also
the one with the fewest constraints on it. That is a genuinely unusual position
and it is worth stating plainly rather than assuming a catch.

## 3. Is UK GDPR engaged at all?

**Not for a role-addressed letter.** "The Owner, 14 Mansfield Road,
Nottingham NG1 3FB" identifies a building and a job, not a living individual.
No personal data is processed in addressing it, so there is no lawful basis to
establish, no Article 14 notice owed, and no balancing test to perform.

That is the whole of the legal analysis for the ordinary case, and it is why
this document is three pages rather than fifteen.

**It stops being true the moment a name goes on the envelope.** "Dear Sarah
Patel" is personal data and UK GDPR applies in full: a lawful basis, an
Article 14 notice because the data did not come from her, and the absolute
right to object under Article 21(2). That case is **not covered here** and
needs the legitimate interests route in `LIA-2026-08-v2` extended to post
before any such letter is sent.

**The rule this creates, and it is not a soft one:** *no letter carries a
person's name.* Not as a nicety — it is the single condition on which this
assessment rests. A merge field that falls back to a director's name would
move the entire programme into a regime it has not been assessed for, silently,
one letter at a time.

## 4. What we hold, and where it came from

The candidate pool is 81,286 UK businesses drawn from three registers that the
publishing bodies release as open data under OGL v3: the Companies House Free
Company Data Product, the ICO Register of Fee Payers, and the FSA Food Hygiene
Rating Scheme. OGL v3 expressly licenses the database right, so bulk extraction
from them is contractually clean.

Two safeguards already applied at source, both because holding less is better
than filtering later:

- The ICO states that OGL does not cover personal data in its dataset. The DPO
  name, email, phone and address columns are **not read from the file at all**.
- ICO rows that read as a private individual at a home address — a personal
  name with no trading name — are **dropped on read**. 2,111 went. A sole
  trader with a trading name is kept, because she is a business.

Where we also hold a website-derived address, it came from the business's own
published pages, which is not a protected database and carries no database
right of its own.

## 5. What still applies, and must be built

Post is not exempt from everything, and these are the parts that need doing.

**The right to object still applies, and it is still absolute.** Article 21(2)
covers direct marketing in any medium. A business that writes, emails or rings
to say stop must be suppressed permanently, across every channel, and that
suppression must survive the lead being deleted. `marketing_suppression` already
does this and is append-only. **Every letter must therefore carry a plain way to
stop it** — an email address and a postal address, in the letter, not in small
print. There is no one-click equivalent in post, which makes the wording matter
more, not less.

**Accuracy still applies.** Article 5(1)(d). Writing to a company at an address
it left three years ago is not a breach of anything on its own, but it is the
kind of inaccuracy the principle is about, and it wastes the postage. This is
why the merge prefers a trading address over a registered office and why the
89% territory-match rate on website-derived postcodes matters.

**The Mailing Preference Service does not bind us**, but it is worth knowing
what it is. MPS is a Direct Marketing Association scheme for **named consumers
at home addresses**. It is not a statutory bar and it does not cover business
post. We do not rely on that as permission to be a nuisance — see the next
point.

**Our own suppression list is the real control.** Because there is no statutory
register to screen against, everything depends on us recording an objection the
first time and honouring it forever. That is a database guarantee, not a
promise, and it already exists.

**Not yet built, and needed before the first letter:**

1. A `post` channel path through `marketing_sends`. The column already accepts
   `'post'`; nothing writes it. Without it, letters are invisible to the
   suppression check and to any count.
2. The tier and ceiling logic assumes email. A postal send should record
   against the same suppression list, but the LIA-derived monthly ceilings in
   `LIA-2026-08-v2` section 6 do **not** apply to post — they exist to bound a
   legitimate interests balance that post does not engage. A postal ceiling, if
   there is one, is a business decision about cost and taste, not a legal one.
   Section 6 below sets one anyway, and says why.
3. A role-addressed letter template, with the stop-this wording.

## 6. The ceiling, and why there is one at all

**No legal ceiling applies.** UK GDPR is not engaged and PECR does not cover
post, so nothing in law limits how many role-addressed letters may be sent.

A ceiling is set anyway, at **1,000 letters per calendar month**, for reasons
that are ours rather than the law's:

1. **Cost.** Post is the only channel here that is not free. At second-class
   rates a thousand letters is real money and it should be a decision.
2. **The rule in section 3 is one mistake from being broken.** A ceiling bounds
   how many envelopes a bad merge could put a person's name on before anyone
   notices.
3. **A volume we cannot make specific is a volume we should not send.** The
   same reasoning as `LIA-2026-08-v2` section 6. A letter that reads as bulk
   is the thing this business is trying not to be.

Exceeding it should require writing a v2 of this document, not changing a
number.

## 7. What would invalidate this assessment

- **A person's name appears on a letter.** The single most likely one, and the
  one that changes the regime rather than stretching it.
- Letters go to residential addresses rather than business ones.
- The source mix changes to anything not published as open data by the body
  that holds it.
- An objection is not suppressed, or suppression stops covering all channels.
- The channel changes. This covers post only.
- Complaint volume becomes non-trivial, or the ICO publishes guidance moving
  the position on business post.

## 8. Record of reliance

Postal sends record `channel = 'post'` in `marketing_sends` and carry no
`lia_ref`, because no legitimate interests assessment is relied on. Where a
letter is ever sent to a named individual, that send is **not** covered by this
document and must carry the `LIA` reference for whichever assessment does cover
it — which, as of today, is none.
