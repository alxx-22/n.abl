# The first contact email

The only message n.abl may send to someone who has not heard from us before.
Every element below is here because something requires it — PECR, UK GDPR
Article 14, or `LIA-2026-08-v1`. Section 3 says which.

**Status: written, never sent.** No outreach has gone out. Sending is still
blocked on the compliance migration being applied — see `business/STATUS.md`.

**Not legal advice, and not reviewed by a solicitor.** The regulation references
in section 3 are given so each requirement can be looked up and checked, not as
a citation to rely on. Where a row matters commercially, verify it against the
ICO's own guidance rather than against this table.

---

## 1. The template

Square brackets are filled by a human, or drafted by Claude and then approved by
a human at gate 2. Nothing here sends automatically.

> **Subject:** [the specific thing], at [Company]
>
> Hi [First name],
>
> I came across [Company] [where — "on the Companies House register", "through
> your website"] and noticed [the specific, checkable observation — a job ad for
> an admin role, a booking process that runs through the phone, a filing that
> suggests growth].
>
> I'm Alex. I run n.abl, a small technology implementation business in
> [Nottingham / Alcester]. We take a job that's costing a business time or
> accuracy and build the right fix for it — sometimes an automation, sometimes a
> small piece of software, sometimes just setting up a tool you already pay for
> properly.
>
> [One sentence on what that might look like for them specifically, tied to the
> observation above. No promises, no numbers we cannot stand behind.]
>
> If that's not useful, no reply needed and I won't chase you.
>
> If it is, I'm happy to spend half an hour looking at it with you, free, and
> tell you honestly if it isn't worth doing.
>
> Alex
> n.abl — [postal address]
> hello@nabl.agency · nabl.agency
>
> ---
> *You're receiving this because we found [Company] on [source]. Our privacy
> notice explains what we hold and why: nabl.agency/privacy.
> [Unsubscribe] — one click, and we won't contact you again.*

## 2. What must never appear in it

- **A fake thread.** No "Re:" or "Following up on my last email" where there was
  no previous email. It is a lie, it is a dark pattern, and it is exactly what
  makes people complain rather than ignore.
- **A false personalisation claim.** "I've been following your work" is not true
  and does not survive one reply asking which work.
- **Invented numbers.** No "we saved a business like yours £40,000". There is no
  case study yet; `17-proof-and-case-studies` exists for when there is.
- **A misleading subject line.** PECR requires the subject not disguise what the
  message is.
- **Pressure.** No fake scarcity, no "circling back for the third time", no
  four-touches-in-48-hours sequence. See `agency-playbook.md` in
  `10-lead-sourcing` for why the standard playbook is wrong here.
- **A no-reply sender.** Every message must be replyable, because "please stop"
  arriving as a reply is the most common way an objection is expressed.

## 3. Why each element is there

| Element | Required by | Note |
|---|---|---|
| Real sender identity, with a postal address | PECR reg. 23 | Identity must not be concealed and a valid address for opt-out requests must be given. A PO box or registered office is fine; nothing is not |
| Where we got their details | UK GDPR Art. 14 | Stated in the message *and* linked, not only linked |
| Link to the privacy notice | Art. 14 | `nabl.agency/privacy` — the *If we contacted you first* section |
| One-click unsubscribe | PECR regs. 22–23, Art. 21(2) | Must work without a login, without a reason, and without an "are you sure?" |
| Replyable address | Art. 21(2) in practice | Most objections arrive as a reply, not a click |
| A specific, checkable observation | `LIA-2026-08-v1` §3 | This is the necessity limb. Without it the message is bulk, and the assessment does not cover bulk |
| No pressure, no chasing | `LIA-2026-08-v1` §4 | The balance turns partly on the message not reading as bulk |

The sixth row is the one that carries the legal weight and is easiest to lose
when volume feels slow. If the observation is generic enough to paste into
another email unchanged, the message is bulk, whatever the merge fields say.

## 4. Recording it

Every send writes a `marketing_sends` row: recipient, subject, a hash of the
exact body, who approved it and when, and `opt_out_included`. The schema will not
accept the row without the opt-out flag, so a message with no unsubscribe route
cannot be recorded, and anything that cannot be recorded must not be sent.

`privacy_notice_status` moves to `given_at_first_contact` **only** once a message
containing the notice link has actually gone. Setting it in advance because the
template contains the link is a lie the schema cannot catch.

## 5. Follow-up

One. Sent no sooner than five working days later, carrying the same opt-out and
the same identity, and referring to the first message honestly ("I wrote last
week about…").

If there is no reply to that, stop. The record is deleted within six months, as
the privacy notice says. There is no third email.
