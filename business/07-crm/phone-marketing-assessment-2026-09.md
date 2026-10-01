# Phone marketing assessment — PHA-2026-09 (draft)

```
Reference:    PHA-2026-09
Status:       DRAFT — not yet relied on; needs the owner's sign-off (section 8)
Drafted:      2026-09-29
Covers:       Live, unsolicited sales calls, made by a person, to UK businesses
              found on the food hygiene register, OpenStreetMap or Companies
              House, including sole traders and partnerships
Does not cover: automated or recorded calls, AI voice calls, texts, calls to
              private individuals at home, calls to anyone outside the UK
Review:       on any change to section 6, or by 2026-12-29, whichever is first
```

> **Once signed it is immutable.** If it changes, write a new version.
>
> **It has not been reviewed by a solicitor.** Nothing here is legal advice.

---

## 1. Why this exists

The owner asked on 29 September 2026 to include sole traders and to reach them
by live calls from a person, after checking each number is not on the
Telephone Preference Service. The existing assessments do not cover this.
`LIA-2026-08-v2` covers email to companies. `PMA-2026-08-v1` covers post. The
compliance schema (`compliance-schema.md` section 2.4) said phone would need
screening "as a separate piece of work". This is that work.

## 2. The law that applies

**PECR regulation 21 (live calls).** A live unsolicited marketing call is
lawful unless:

- the number has been on the **TPS** for 28 days or more (the TPS covers
  individuals, sole traders and most non-LLP partnerships); or
- it has been on the **CTPS** for 28 days or more (companies, LLPs, some
  partnerships, public bodies); or
- the person has told us not to call.

A business's legal form is often unknown for a business found on the food
register or a map. So every number is checked against **both** registers,
every time. We never guess which one applies.

**PECR regulation 24.** The caller must say who is calling and, if asked,
give an address or a freephone number.

**PECR regulation 19.** Automated calls, recorded messages and AI voices need
prior consent. They are **out of scope**. Nothing built here dials
automatically. (This is separate from the AI call agent n.abl *sells*. That
answers a business's *own* inbound calls and is not a marketing call.)

**UK GDPR.** A sole trader's business number, and their name, are personal
data. The basis relied on is legitimate interests, balanced in section 4. A
limited company's switchboard is not personal data. It becomes personal data
when a person is named against it.

## 3. What we hold, and where it came from

- **The business:** name, trading address and what it does, from the Food
  Standards Agency food hygiene register (Open Government Licence),
  OpenStreetMap (ODbL), or Companies House.
- **The number:** the business's own published number. It comes from the
  listing, or code reads it from the business's own confirmed website. Where
  it came from is recorded (`prospect_candidate.phone_source`, then
  `sales_contacts.source`). It is never generated or suggested by a model,
  and no model is ever shown it.
- **No named person** is sought or recorded. The contact is "Public contact
  route".

## 4. Legitimate interests: the balance

**Purpose.** To offer small local businesses services that fit a need seen
on their own website: a booking system, a website, an AI call agent for
missed calls.

**Necessity.** Many sole traders publish no email address, and cannot be
emailed without consent anyway (PECR reg 22). A letter is slower and cannot
answer a question. A short call to the number the business itself publishes
for enquiries is the least intrusive way to ask whether they want to hear
more.

**Balance.**

- They published the number so that people would ring it about their business.
- The call is about their business, not their private life, and is made in
  working hours.
- They can say no in one sentence, and that is recorded permanently (section 5).
- The TPS/CTPS check means anyone who has opted out of sales calls is never rung.
- Volume is capped (section 6).

**Against it.** A call interrupts working time, more than a letter does. On
balance, with the controls below, the interest is not overridden. That holds
for a business number and one call. It would not hold for repeated calls
after a "no", or for a private mobile that is not published for the business.

## 5. Controls, and where each is enforced

| Control | Where |
|---|---|
| Both TPS and CTPS checked; a check counts for 28 days | `phone_screening`, `phone_screen_clear()` |
| A number found on either register is suppressed permanently | `phone_screening_write()` → `marketing_suppression` (`tps_ctps`) |
| No call without a clear check, a basis and an assessment on file | `marketing_send_allowed()`, phone branch; `sales_leads_li_needs_assessment` |
| Every call recorded *before* the dialler opens; a refused call opens nothing | `marketing_sends` insert, gate trigger; `PhoneLine.jsx` |
| "Don't call us" recorded on the spot, permanently, all channels | `apply_opt_out(..., 'phone_request', ...)`, "They asked not to be contacted" |
| The caller identifies themselves and n.abl; gives our address on request | Call script shown in the CRM; `sender_identity` records who called |
| Privacy notice given on the first call | `privacy_notice_status` must not be `not_given` |
| At most 50 first calls a month | `marketing_monthly_ceiling('phone', …)`, `marketing_ceiling_guard()` |
| Checks are append-only, with who recorded them | `phone_screening` trigger; `recorded_by` |
| Sole traders are still never emailed without consent | email branch of `marketing_send_allowed()` |

**Screening sources.** Checks come from TPSCheck (tpscheck.uk; free, 50 a
month, used automatically through the `tps-check` function once
`TPS_CHECK_API_KEY` is set). A person can also check by hand on a checker's
own site, such as TPS Checker (tpschecker.co.uk, 10 free a day), and record
the result under their own name.

**Neither service states that it licenses the TPS and CTPS files from TPS
Ltd.** Liability for calling a registered number is ours, whichever checker
said it was clear. **Before relying on a checker, ask it in writing whether it
screens against a current, licensed copy of both registers, refreshed at least
every 28 days, and keep the answer with this document.** The official route is
a TPS licence (about £3,300 a year) or a licensed list-cleaning bureau. At
the volumes in section 6, that cost was judged out of proportion. Revisit this
if calls grow.

## 6. The ceiling

**50 first calls a month**, across all tiers. A follow-up call to a business
already called does not count. The number is roughly what one person can make
properly alongside other work, and it matches one free screening allowance. It
is hard-coded; raising it takes a new version of this assessment and a
migration.

## 7. What would invalidate this assessment

- Calling a number with no clear check under 28 days old, or after a "no".
- Any automated, recorded or AI-voiced outbound call.
- Seeking or recording named individuals, or private numbers.
- A checker that turns out not to use current, licensed register data (stop
  calling, and re-screen through one that does).
- A complaint to the ICO, or ICO guidance that changes any of the above.

## 8. Record of reliance

```
Signed off by:   ____________________   Date: __________
Checker(s) confirmed as using licensed, current TPS and CTPS data:
                 ____________________   (answer kept with this document)
```

Until this block is completed, set leads to `legitimate_interests` with
`lia_ref = PHA-2026-09` only after the sign-off.
