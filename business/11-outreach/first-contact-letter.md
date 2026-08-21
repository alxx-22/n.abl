# The first contact letter

The only postal message n.abl may send to a business that has not heard from us
before. It exists because post reaches the whole market and email does not:
63% of UK businesses are sole traders or ordinary partnerships, they are
individual subscribers under PECR, cold email to them is unlawful without
consent, and most of them are not on the Companies House register at all.

**Status: written, never sent.**

**Governed by `07-crm/postal-marketing-assessment-2026-08.md` (PMA-2026-08-v1),
not by the legitimate interests assessments.** Those cover electronic mail. This
is a different channel with different rules, and mostly fewer of them.

**Not legal advice, and not reviewed by a solicitor.**

---

## 1. The one rule everything else rests on

**No letter carries a person's name.** Not "Dear Sarah Patel", not "FAO Sarah
Patel", not a name in the address block.

This is not a matter of tone. A letter addressed to a role identifies a
building and a job, so no personal data is processed and UK GDPR is not
engaged: no lawful basis to establish, no Article 14 notice owed, no balancing
test, no ceiling derived from one. Put a name on it and all of that arrives at
once, and PMA-2026-08-v1 does not cover it.

A mail merge whose name field falls back to a director's name would move the
whole programme into a regime it has not been assessed for, silently, one
envelope at a time. That is the failure to design against.

Address it to the role: **The Owner**, **The Practice Manager**, **The
Operations Manager**, **The Yard Manager**. If the right role is not known,
"The Owner" is honest and always correct for a small business.

## 2. The template

Square brackets are filled by a human, or drafted and then approved by a human
at gate 2 in `approval-gates.md`. Nothing here sends automatically.

> The Owner
> [Company]
> [Trading address, and it must be the trading one — see section 4]
>
> [Date]
>
> Dear Owner,
>
> I'm Alex. I run n.abl, a small technology business in [Nottingham /
> Alcester], and I'm writing because of [the specific, checkable observation —
> the booking form on your site that goes to an inbox, the job advert for an
> administrator, the price list you send out as a PDF].
>
> Most businesses your size have two or three jobs that eat a morning a week
> and nobody has ever had time to fix — rekeying orders, chasing timesheets,
> rebuilding the same spreadsheet every month. We take one of those and build
> the right fix for it. Sometimes that's an automation, sometimes a small piece
> of software, sometimes it's setting up a tool you already pay for properly.
>
> [One sentence on what that might look like for them specifically, tied to the
> observation above. No numbers we cannot stand behind.]
>
> If it's worth a conversation, my number is [phone] and my email is
> alex@nabl.agency. If it isn't, no reply needed — I won't write again.
>
> Alex [Surname]
> n.abl
> [Postal address]
> hello@nabl.agency · nabl.agency/privacy
>
> ---
> *If you would rather we didn't write to you again, email
> hello@nabl.agency or write to the address above and we will remove you
> permanently. We hold only what your company publishes on the Companies House
> register, the ICO register or your own website.*

## 3. Why each element is there

| Element | Why it is required |
|---|---|
| Addressed to a role, never a person | The whole basis of PMA-2026-08-v1 §3. A name engages UK GDPR |
| A real, checkable observation | Not a rule. It is the difference between a letter and a leaflet, and the thing that makes it worth the stamp |
| Named sender, real business, real address | Basic honesty, and the same standard PECR reg 23 sets for electronic mail |
| A plain way to stop it, in the letter | Article 21(2). The right to object is absolute in any medium, and there is no one-click equivalent in post, so the wording has to carry it |
| Both an email and a postal route to object | Somebody who does not use email must still be able to stop us |
| A link to the privacy notice | Not owed for a role-addressed letter, but cheap and it is where someone will look |
| "I won't write again" | A promise, and it is enforced: a single first contact per lead per channel is what `marketing_sends.is_first_contact` records |
| Says where the data came from | Also not owed here. Included because the first question a recipient asks is "how did you get my address", and refusing to answer it reads badly |

## 4. The address must be the trading one

A letter to a registered office usually reaches an accountant, who bins it. The
sourcing pipeline exists in large part to avoid this: `merge.mjs` prefers a
trading address over a self-declared one over a registered office, and records
which kind it used in `contact_address_kind`.

**Do not send to a lead whose only address is a registered office** unless
something else confirms the business is actually there. It is not a compliance
rule, it is a waste of a stamp and of the one first contact that lead gets.

## 5. What must be true before the first letter goes out

- [ ] A `post` channel path through `marketing_sends`, so letters are visible
      to the suppression check and to the monthly count. **The column accepts
      `'post'` and the gate handles it; nothing writes it yet.**
- [ ] The two approval gates in `approval-gates.md` applied to postal sends.
- [ ] A printed proof read aloud once. A letter that reads as a mail merge is
      the thing this document exists to prevent, and that is easier to hear
      than to see.

## 6. What would make this template wrong

- A person's name appearing anywhere on it.
- The observation in paragraph one becoming generic — "businesses like yours
  often struggle with admin" is not an observation, it is filler, and a letter
  built on it is a leaflet.
- Sending a second letter to someone who did not reply. The template promises
  not to. One first contact per lead, and the database records it.
- Sending to a residential address rather than a business one.
