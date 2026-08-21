# The eight leads — what has to be decided, and by whom

The compliance migration deliberately locked every existing lead to
`do_not_contact` / `unassessed` / `unknown`. That was not a failure of the
import; it is the schema refusing to assume things nobody recorded at the time.

Each lead needs **five answers**. They are decisions about facts, not
preferences, and only you know some of them. Nothing can be sent to any of
these leads until all five are answered for that lead.

**The honest answer is always available.** If you do not know where a lead came
from, say so. The lead stays on `do_not_contact` and gets re-sourced properly
from the register data we now hold — which is a better record than a guess, and
we now have 81,286 candidates, so losing one costs nothing. Guessing
`companies_house` to clear a constraint produces a record that looks documented
and is not, which is worse than an empty one.

---

## Question 1 — What kind of subscriber is it?

This decides which channels are lawful. It is a question about legal form, not
about size.

| Answer | Means | Effect |
|---|---|---|
| `corporate` | Limited company, LLP, PLC, Scottish partnership | Email is lawful without consent |
| `sole_trader` | An individual trading in their own name | **Email needs consent.** Post and screened phone are fine |
| `partnership` | Ordinary partnership, not an LLP | Same as sole trader |
| `individual` | A private person | Same as sole trader |
| `unknown` | Not established | **Blocked from everything.** Unknown is not permission |

**How to answer it properly:** look the business up on Companies House. It is
free and definitive. If it is a registered company, it is `corporate`. If it
does not appear, it is `sole_trader` or `partnership` until proven otherwise —
not `unknown`, and certainly not `corporate`.

Then tell me the evidence, in a few words: "Companies House 12345678", or
"their website footer says Ltd, no number given". It goes in
`subscriber_type_evidence` and the schema will not accept the type without it.

## Question 2 — Where did this lead actually come from, and when?

| Answer | Use when |
|---|---|
| `companies_house` | Found on the register |
| `own_website` | They filled in our form, or we found them via their own site |
| `referral` | Someone introduced them |
| `event` | Met them somewhere |
| `inbound_enquiry` | They contacted us first |
| *leave blank* | **You genuinely do not remember** |

Plus a date, and a sentence of detail. If the answer is "I don't remember",
that is a complete and correct answer — say it and move on.

## Question 3 — Have they ever asked us not to contact them?

Yes or no, for each. If yes for any of them, that is not a field edit — it goes
through `apply_opt_out()` so it writes a permanent suppression row that
survives the lead being deleted. Tell me and I will do it that way.

This is the one question where a wrong answer is unrecoverable in the sense
that matters: contacting someone who objected is the breach that gets reported.

## Question 4 — Did they enquire with us, or did we approach them?

| They enquired | `lawful_basis = consent`, `privacy_notice_status = not_required` |
| We approached them | `lawful_basis = legitimate_interests`, and see question 5 |

An inbound enquiry is the easy case: they asked, so there is no ceiling, no
Article 14 notice needed, and no balancing test.

## Question 5 — For any we approached: have they been sent the privacy notice?

Almost certainly no, since nothing has been sent. In that case
`privacy_notice_status` stays `not_given` and the notice goes with the first
message — the template already links it.

---

## What I need back

For each of the eight, five lines. Something like:

```
Acme Joinery Ltd    corporate / CH 09876543 / companies_house 2026-07 / never contacted / we approached
Dave's Plumbing     sole_trader / not on CH / don't remember where / never contacted / we approached
Riverside Dental    corporate / CH 04455667 / inbound_enquiry 2026-08-02 / no / they enquired
```

Give me the eight rows in whatever form is easiest — the fresh session will
print the current state as a table you can annotate directly.

## What happens then

I write the eight `UPDATE`s by hand, one per lead, each one traceable to your
answer. No bulk update, no `WHERE` clause covering more than one row, no
defaults filled in to clear a constraint.

Leads answered `unknown` or with no source stay on `do_not_contact` and get
re-sourced from the register data instead. That is a fine outcome — it is eight
records against a candidate pool of 81,286.
