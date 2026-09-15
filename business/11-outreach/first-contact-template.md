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

## 1. There is no template

There was one, and it read like one. Every recipient got the same four
paragraphs with a single line swapped, opening:

> I came across [Company] on the Companies House register and noticed [the
> observation].

Three things wrong with that, and only the first is a matter of taste.

1. **"I came across … and noticed"** narrates the research rather than the
   finding, and it is now the recognised opener of automated mail. See
   [`sales-language.md`](sales-language.md) §6.
2. **It says where we found them in the first line.** That disclosure is
   required by Article 14 — and it is already in the footer, in full, beside
   the privacy notice. Putting it at the top turns an obligation into a boast
   about surveillance.
3. **`ACCOUNTING SOLUTIONS (AS) LTD`.** That is how Companies House files a
   name, not how anybody writes one.

So the body is **written for each business** by the `letter` stage and checked
in code. What stays fixed is the chrome, because the law fixes it.

### What is fixed, and why

| Fixed | Required by |
|---|---|
| The header — the wordmark, and a real sender identity | PECR reg. 23 |
| The footer — postal address, `hello@nabl.agency`, the site | PECR reg. 23 |
| Where we found them, in the footer | UK GDPR Art. 14 |
| The privacy-notice link | Art. 14 |
| One-click unsubscribe, no login, no reason, no "are you sure?" | PECR regs. 22–23, Art. 21(2) |

### What is written

Four or five short paragraphs, in this order. The order is the part that is
not arbitrary.

1. **The observation, and what it means for them.** Not a greeting that says
   nothing, not who we are. The specific true thing is the entire reason the
   message is allowed to exist — `LIA-2026-08-v1` §3, the necessity limb.
2. **Who Alex is and what n.abl does.** Two sentences, no adjectives.
3. **One sentence on what the fix might look like for them.** A direction, not
   a promise. Left out entirely if it cannot be said honestly.
4. **The way out.** No reply needed, and he will not chase.
5. **The offer.** Half an hour, free, and an honest answer if it is not worth
   doing.

**Four comes before five deliberately.** The JOLT research found that 40–60% of
qualified B2B deals die in no-decision, mostly to indecision rather than a real
preference for standing still — and that pressing harder on the cost of
inaction made it *worse* 84% of the time, while taking risk off the table
worked. Making it easy to say no is the strongest thing in this letter, and it
has to arrive before the ask rather than after it.

### The name

The model is never told what the business is called: no company name is sent to
a model, which predates this stage and still holds. It writes `{business}` where
a name belongs, and the substitution happens after every check has passed. It
does not have to use it — "you" throughout is usually better than a name-drop.

The name substituted in is `sales_leads.trading_name`, or a tidied version of
the registered one where nobody has set that. The tidying is a heuristic and it
will be wrong sometimes, which is exactly why the column exists.

### The subject line

Lower case, two to seven words, one idea, taken from the observation and never
from what we sell. Lower case is not a style preference: across a large
cold-email corpus, all-lowercase subject lines outperformed Title Case by
roughly a fifth, because they read as a message from a person rather than
marketing.

---

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
