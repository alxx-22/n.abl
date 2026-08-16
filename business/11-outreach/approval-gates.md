# Approval gates

The two human checkpoints in the outreach sequence, what each one is actually
checking, and how approval is enforced so that it cannot be assumed, inherited
or clicked through.

Nothing described here is built. This is the specification.

---

## 1. Why there are two, and why both are before sending

The master plan's sequence puts a human at two points:

```
shortlist → HUMAN inspects → HUMAN approves → Claude personalises
          → HUMAN approves → send
```

The temptation, once volume feels slow, is to move one of them after sending and
call it review. That is not a gate. A gate that opens after the message has left
is an audit trail with a nicer name.

The two gates check different things and cannot be merged:

- **Gate 1 asks: should we contact this business at all?** It is about the
  target. It happens before any copy exists, so the person judging it is not
  being softened by a nicely written email.
- **Gate 2 asks: is this specific message true, lawful and something I would put
  my name to?** It is about the artefact. It happens after Claude has written,
  because that is the only point at which there is something to check.

Merging them means the person approving the target is looking at persuasive copy
while deciding whether the target is right, and people approve prettier things.
Splitting them is deliberate.

---

## 2. Gate 1 — the shortlist gate

### What arrives

A batch from `10-lead-sourcing`: business, contact, score, and the research
record that produced the score. The research must be visible on the same screen
as the decision. A gate that requires opening three tabs is a gate that gets
skipped.

### What the person is checking

Six questions, in order. Any "no" rejects.

1. **Is this a real, trading business of the right kind?** Not a shell, not a
   duplicate, not a business that closed, not a franchise head office when the
   target was a branch.
2. **Does it match the ideal client profile?** 2 to 50 people, a process that
   plainly costs money, someone able to say yes. `01-positioning` holds the
   definition and `saying-no.md` in that folder holds the exclusions.
3. **Is the contact the right person, and is the address plausibly theirs?** A
   generic `info@` is a corporate subscriber address and is usually fine. A
   guessed `firstname.lastname@` pattern that nobody verified is not.
4. **Is the subscriber type right?** Corporate subscriber, sole trader or
   individual. This decides which rules apply and it is the single most
   consequential field on the record. A sole trader marked as a limited company
   to clear a constraint is a fabricated lawful basis.
5. **Is the source honest and recorded?** Where the record came from and when.
   If it cannot be reconstructed truthfully, the lead is marked
   `do_not_contact`. Do not guess a source to satisfy a check.
6. **Would I be comfortable if this business phoned me and asked how we got
   their details?** If the honest answer is a wince, reject it.

### What the system enforces

The person is the judgement. The database is the constraint.

A lead cannot be marked gate-1 approved unless `subscriber_type`,
`lawful_basis`, `source`, `source_date` and `privacy_notice_status` are all
populated and `marketing_status` permits contact. That is a CHECK constraint in
`07-crm`, not a validation in a form.

Individual subscribers cannot pass gate 1 for electronic mail marketing on
legitimate interests alone. That rule lives in the schema, so gate 1 cannot
approve past it even by accident.

### The record

One row per lead per batch:

| Field | Why |
|---|---|
| `lead_id` | What was approved |
| `batch_id` | Which sitting it was part of |
| `approved_by` | Which person, from the team-space session |
| `approved_at` | When |
| `decision` | `approved` or `rejected` |
| `reject_reason` | Free text, required on reject |

Reject reasons are the most useful data this system produces. Twenty rejections
reading "wrong size" is a scoring bug in v3, and it is cheaper to fix there than
to keep rejecting by hand.

---

## 3. Gate 2 — the copy gate

### What arrives

One personalised message: subject, body, recipient address, and beside it the
research fields Claude was given. The reviewer needs both, because the check is
a comparison.

### What the person is checking

**The main job is factual verification, not tone.**

Claude writes well and will state things about a business with complete
confidence whether or not they are in the source material. A sentence that says
"I noticed you've recently expanded into commercial work" when the business has
not is worse than a generic opener, because it proves nobody read it before it
went.

The check:

1. **Every claim about the business traces to a stored source field.** If the
   message says it, the research record has to contain it. Anything that cannot
   be traced comes out.
2. **No invented numbers.** No statistics, no "businesses like yours typically
   save 40%", no case studies, no client names. The house rule from the master
   plan applies to outreach copy exactly as it applies to documents.
3. **The offer is described the way the business describes it.** Problem-led,
   the six categories, no "AI automation agency" framing, no unlock-your-
   potential filler.
4. **Identity and opt-out are present.** n.abl named, a real reply route, a
   working one-click opt-out. `08-email-pack` covers the footer.
5. **The recipient address is the one on the record** and is not on the
   suppression list. The system checks this too, but a reviewer noticing it here
   is cheaper than a blocked send later.
6. **Would I send this from my own name?** If it needs an explanation, it is not
   ready.

### Binding

**Approval binds to the exact bytes of subject, body and recipient address.**

The mechanism: on approval, store
`sha256(subject || "\n" || body || "\n" || normalised_recipient)`. The send path
recomputes the hash from what it is about to send and refuses on any mismatch.

This is the server-side version of a rule the CRM already follows. In
`src/pages/Crm.jsx` the outreach panel computes `approvedNow` as
`lead.outreachApproved && text === lead.outreachDraft`, so editing the body
after approving relocks the mail handoff. The component even says the backend
should enforce the same rule. It should, and this is that rule.

Without binding, "approved" attaches to a lead, and a later regeneration
inherits an approval nobody gave.

### Expiry

Gate 2 approval expires after **7 days**. Research goes stale, personalisation
that referenced something topical stops being topical, and an approval sitting
unsent for a fortnight was approved in a different context.

Gate 1 approval expires after **30 days**, for the same reason more slowly.

### The record

| Field | Why |
|---|---|
| `draft_id` | Which message |
| `content_hash` | What exactly was approved |
| `approved_by` | Which person |
| `approved_at` | When |
| `expires_at` | `approved_at` + 7 days |
| `superseded_by` | Set when a redraft replaces it, so history is not lost |

---

## 4. How the send path verifies both

One function, in the database, called inside the send transaction. It returns
nothing useful and raises on failure. The sender has no other route to the
provider.

It checks, in this order, cheapest and most absolute first:

1. The normalised recipient address is **not** on the suppression list.
2. The lead's `marketing_status` permits contact and `opt_out` is not set.
3. A gate-1 approval exists, is `approved`, and has not expired.
4. A gate-2 approval exists, has not expired, and its `content_hash` equals the
   hash of the message about to be sent.
5. Today's send count is below the daily ceiling and this hour's is below the
   hourly ceiling. See `deliverability.md` section 5.
6. No message has been sent to this address within the minimum re-contact
   interval.

**It fails closed.** A check that cannot be evaluated — a missing row, a null
where a value was expected, a table that is not there — is a failure, not a
pass. A send that cannot prove it is permitted does not go.

The interface should show the same state, because a person seeing why something
is blocked is how the system stays understood. But the interface is a display of
the rule, never the rule.

---

## 5. Throughput, honestly

A person can properly read perhaps **20 to 40** personalised messages in one
sitting before the reading becomes scanning. That is the ceiling of this design.

It is worth being direct about what that means. At 30 approved messages a day,
five days a week, that is roughly 600 a month, and a good cold reply rate on
well-researched B2B outreach is small. The pipeline is not going to produce
volume. It is going to produce a small number of messages that are worth
receiving, which is the only kind that works when the sender has no reputation
yet.

There is a happy coincidence in the numbers: 20 to 40 a day is also a sane rate
for a warmed sending domain, and well below any bulk-sender threshold. The human
constraint and the deliverability constraint agree. Nothing has to be traded.

If the ambition later is more volume, the answer is more people reading, or a
better shortlist so fewer messages are needed. It is not a weaker gate.

---

## 6. The patterns that turn a gate into a rubber stamp

Each of these has a plausible-sounding justification, which is exactly why they
need naming in advance.

**Approve all.** A button that approves a batch. It will be asked for within a
week of the first batch. There must not be one, at gate 1 or gate 2, at any
batch size, for any reason. Per-item approval with a keyboard shortcut is fast
enough.

**Approve on scroll.** Any design where the default action is approve and
rejecting takes an extra click. Make reject at least as cheap as approve.

**Pre-ticked.** Items arriving with approval already selected, so the person is
un-ticking exceptions. That is not review.

**Inherited approval.** Approving a template rather than a message. Approving a
lead rather than the text going to that lead. Approving a batch and then
regenerating the copy inside it.

**The trusted sender exception.** "This one is a warm intro so it can skip the
gate." Every exception is one person's judgement at the time, and exceptions
accumulate.

**The backlog raise.** A queue builds up, so the ceiling gets raised to clear
it. The queue building up is the system telling you the shortlist is too long or
the scoring is too loose. Fix that instead.

**Approval by the person who wrote the prompt.** Not a hard rule with two
founders, but worth noticing: the person who tuned the personalisation prompt is
the worst-placed person to spot that it invents things.

---

## 7. What is deliberately not gated

Not everything needs a human, and pretending otherwise makes the real gates feel
like ceremony.

- **Follow-up sends.** The follow-up text was approved at gate 2 as part of the
  sequence. The timer firing is Class 1 and needs no person. What the timer must
  do is re-run the send-path checks, so a lead that opted out between message
  one and message two is blocked.
- **Suppression on hard bounce.** Automatic, immediate, no review.
- **Suppression on a detected opt-out.** Automatic and immediate. The escalation
  to a human happens as well, not instead.
- **Auto-reply detection.** Header parsing. Ordinary code.

The rule underneath: **a human gates anything that starts a conversation. Code
handles anything that stops one.** Stopping is always safe.
