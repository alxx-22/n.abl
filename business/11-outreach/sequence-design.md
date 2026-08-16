# Sequence design

The outreach pipeline as a state machine: what the stages are, what moves a lead
between them, what runs on a timer, what runs on a local model, and what happens
when the process dies halfway through.

Nothing described here is built. This is the specification.

---

## 1. The sequence

```
find → research → score → shortlist        v3, 10-lead-sourcing
     → HUMAN inspects
     → HUMAN approves                      gate 1
     → Claude personalises                 Class 3
     → HUMAN approves                      gate 2
     → send                                Class 1
     → deterministic follow-up timer       Class 1
     → classify replies locally            Class 2
     → escalate to a human
```

Read it as a conveyor with two locked doors. Everything upstream of the second
door is preparation, everything downstream is consequence, and the doors are
operated by people.

### Class per stage

| Stage | Class | What it costs |
|---|---|---|
| Personalise | 3 — Claude | Part of the £36/month |
| Send | 1 — API call | Provider per-message cost |
| Follow-up timer | 1 — scheduler | £0 |
| Bounce, auto-reply, opt-out phrase detection | 1 — header and string parsing | £0 |
| Reply classification | 2 — local model | £0 in fees |
| Deciding anything | Human | Time |

Anyone proposing Claude for the follow-up timer or for reply classification has
mis-routed the work. The master plan's section 4 is the authority: route
low-intelligence work to ordinary code or a local model, and spend Claude only
where intelligence is worth paying for. Deciding whether it is Tuesday is not.

---

## 2. How it maps onto the pipeline that exists

The CRM already has ten stages, defined in `src/pages/Crm.jsx` and duplicated in
a database CHECK constraint. v4 does not add stages. It drives the existing ones.

| CRM stage | Who or what moves it |
|---|---|
| New Lead | v3 sourcing writes it |
| Researching | v3 enrichment |
| Ready To Contact | **gate 1 approval** |
| Contacted | the sender, on successful handoff |
| Follow Up Required | the follow-up timer, when a follow-up is due or sent |
| Replied | the reply intake, on any inbound that is not a bounce or auto-reply |
| Meeting Scheduled | a human, after reading the reply |
| Proposal Sent | a human |
| Won / Lost | a human |

Two things follow from this. First, "Ready To Contact" is the name of the
gate-1 output and should be read that way from now on. Second, no automated
process may set a stage past **Replied**. Everything from Meeting Scheduled
onward is a commercial judgement.

The stage names are byte-sensitive and duplicated in four places.
`07-crm/pipeline-stages.md` lists all four. Do not retype them.

---

## 3. The tables v4 adds

Sketch, not DDL. The real migration follows the pattern in
`07-crm/migration-plan.md`.

| Table | Holds |
|---|---|
| `outreach_batches` | A sitting of gate-1 review: who, when, how many in, how many approved |
| `outreach_approvals` | Gate 1 and gate 2 decisions, per the record shapes in `approval-gates.md` |
| `outreach_queue` | One row per message waiting to send: draft, recipient, scheduled time, attempt count, state |
| `outreach_sequence_steps` | The follow-up plan for a thread: step number, offset in business days, state, due time |
| `outreach_events` | Append-only log of every send, bounce, reply, opt-out and suppression, with the provider's message ID |
| `outreach_replies` | Inbound messages, their headers, their classification and its confidence |

`contact_history` and the suppression table are **not** here. They belong to
`07-crm`, because they outlive v4 and because a suppression list that lives in
the sending engine can be dropped along with the sending engine.

The existing `sales_email_drafts` table already carries `sent_at` and
`send_provider`, added in the June migration and never written to. v4 is what
finally writes them.

---

## 4. Queue states

```
queued → sending → sent
   │         │
   │         └──→ failed ──→ (retry, up to 3) ──→ dead
   │
   ├──→ blocked   (gate function refused; needs a human)
   └──→ cancelled (lead opted out, suppressed, or a human stopped it)
```

Rules:

- **`blocked` is terminal without a human.** It never auto-retries. A block
  means the gate function said no, and the answer to no is a person, not a loop.
- **Retries are for transport failures only.** Timeouts, 5xx from the provider,
  connection resets. Three attempts with exponential backoff, then `dead`.
- **A 4xx from the provider is not retried.** A rejected address does not become
  acceptable on the second try.
- **`cancelled` beats everything.** An opt-out arriving while a message sits in
  `sending` cancels the follow-ups regardless of what happens to the message in
  flight.

---

## 5. Pacing

The queue does not drain as fast as it can. It drains on a schedule.

- Working hours only, 08:00 to 17:00 UK time, Monday to Friday. No weekend
  sends, no 03:00 sends. Both look like a machine and both are.
- A randomised gap between messages, in the region of 60 to 240 seconds. Perfect
  regularity is a fingerprint.
- Per-recipient-domain throttling. Do not send eleven messages to one company's
  mail server inside a minute.
- Daily and hourly ceilings, enforced in the database. `deliverability.md`
  section 5 holds the numbers and the reasoning.

---

## 6. Send ordering, and what happens after a crash

The send step has to survive being killed between any two lines. The order:

1. Open a transaction. Claim the queue row with `SELECT ... FOR UPDATE SKIP
   LOCKED` and set it `sending`. This is also what stops two workers sending the
   same message.
2. Call the gate function. It raises on any failure, which rolls the claim back.
3. Write the `contact_history` row and an `outreach_events` row with a locally
   generated `idempotency_key`.
4. Commit.
5. Hand the message to the provider, passing the same `idempotency_key`.
6. In a second transaction, record the provider's message ID and set the queue
   row `sent`.

**The history is written before the send, deliberately.** If the process dies
between steps 4 and 6, the record says a message may have gone out when it might
not have. That is the safe direction of the error: the worst case is one lead
not contacted. Writing the history after the send inverts it, and the worst case
becomes a message with no record, which is the case that matters legally.

On restart, any row stuck in `sending` for more than ten minutes is examined by
a person, not automatically retried. If the provider supports lookup by
idempotency key, the recovery job can ask whether it went; if it cannot, a human
decides. This is a handful of rows a year and it does not need automating.

---

## 7. The follow-up timer

**Class 1. A plain scheduler. No model anywhere in it.**

### The sequence

Three messages maximum, including the first.

| Step | When | Content |
|---|---|---|
| 1 | On approval | The personalised message |
| 2 | +4 business days | Short follow-up, approved at gate 2 alongside step 1 |
| 3 | +9 business days from step 1 | Final, short, explicitly the last one |

Then it stops. There is no step 4. A fourth message to someone who has ignored
three is not persistence, it is noise, and it generates complaints, and
complaints are the thing that burns a domain.

### How it works

A row in `outreach_sequence_steps` per step, with a `due_at` computed at the
time the previous step sends. A job runs every 15 minutes, selects steps where
`due_at <= now()` and state is `pending`, and pushes them onto `outreach_queue`.

Business days are computed by ordinary code against a table of UK bank holidays,
maintained by hand once a year. Ten minutes of work, and it prevents a "just
following up" landing on Boxing Day.

### Stop conditions

Every one of these cancels all remaining steps immediately:

- any inbound reply that is not a bounce or an auto-reply
- any opt-out, detected or manual
- a hard bounce
- a soft bounce on two consecutive steps
- the lead moving to Won, Lost or `do_not_contact`
- a human pressing stop

**Each follow-up re-runs the full send-path gate.** The approval from a
fortnight ago does not authorise a send to someone who opted out last Tuesday.
This is the single most important line in this section.

---

## 8. Reply intake

Replies arrive at a real inbox on the sending domain. Processing is in two
layers, and the order matters because the cheap layer catches most of it.

### Layer 1 — ordinary code, Class 1

Header and pattern checks, before any model sees anything.

| Signal | Detected by | Action |
|---|---|---|
| Hard bounce | Provider webhook, or DSN with a 5.x.x status | Suppress the address. Cancel the sequence. No escalation needed. |
| Soft bounce | 4.x.x status | Count it. Two in a row cancels the sequence. |
| Auto-reply | `Auto-Submitted: auto-replied`, `X-Autoreply`, `Precedence: bulk` or `auto_reply`, `X-Autorespond` | Do not classify, do not escalate, do not advance the stage. Pause the sequence if the message names a return date. |
| Opt-out phrasing | A conservative phrase list: unsubscribe, remove me, opt out, stop emailing, take me off | **Suppress immediately**, cancel the sequence, and escalate anyway. |

The opt-out check runs before classification and its output is never overridden
by the model. False positives cost one lead. False negatives are a regulatory
failure.

### Layer 2 — local model, Class 2

Everything that survives layer 1 goes to a small open-weight model on our own
machines, via Ollama or llama.cpp. See `15-compute` for setup.

Categories:

| Category | Meaning |
|---|---|
| `interested` | Wants to talk |
| `question` | Asking something before deciding |
| `not_now` | Later, or a named future date |
| `not_interested` | A clear no |
| `wrong_person` | Referral, or "that's not my area" |
| `out_of_office` | Missed by layer 1 |
| `hostile` | Angry, or threatening a complaint |
| `unclear` | The model does not know |

The output is a category, a confidence and the raw text. It is stored in
`outreach_replies` and it does nothing else.

### What the classifier is not allowed to do

- **It never sends.** No auto-replies, no "great, here's my calendar".
- **It never suppresses on its own judgement.** Suppression comes from layer 1's
  phrase check or from a human. A model deciding someone meant unsubscribe is
  fine; a model deciding someone did not is not, so the safe direction is
  hard-coded in layer 1.
- **It never closes a thread.** `not_interested` moves nothing to Lost. A person
  does that.
- **It never sets a stage past Replied.**

Low confidence is not an error state. It routes to the same place everything
else routes to, which is a person, with the confidence shown.

---

## 9. Escalation

Every classified reply lands in one queue, sorted by category, with the original
message readable in full and the outbound thread beside it.

Response targets, as a working discipline rather than a promise to anyone:

| Category | Target |
|---|---|
| `hostile` | Same working day, by a founder |
| `interested`, `question` | Same working day |
| `wrong_person` | Within two working days |
| `not_now` | Within two working days, with a diary note |
| `not_interested` | Acknowledge briefly, mark Lost, stop |
| `unclear` | Read it properly. It is a human's job by definition. |

`hostile` deserves a note. Someone annoyed at receiving cold outreach is telling
you something useful about the targeting, and the reply should be a short
apology and an immediate suppression, not a defence of the lawful basis. Being
technically permitted is not the same as being welcome.

---

## 10. What gets measured

Small set. Measured because it changes a decision, not because it can be
counted.

| Metric | Why it matters | Where it comes from |
|---|---|---|
| Gate 1 rejection rate | High means v3 scoring is loose | `outreach_approvals` |
| Gate 2 edit rate | High means the personalisation prompt is wrong | Redrafts before approval |
| Bounce rate | Above 2% means the list is bad, and it damages the domain | `outreach_events` |
| Complaint rate | The one that burns the domain | Provider, plus Postmaster tools |
| Reply rate | The only honest measure of whether the copy works | `outreach_replies` |
| Positive reply rate | The commercial number | Classification |

**Open tracking is deliberately not on this list.** Tracking pixels and
rewritten links are a deliverability cost and a privacy imposition, and n.abl
self-hosts fonts specifically to avoid disclosing visitors' IP addresses to
third parties. Doing the equivalent to a stranger's inbox would be inconsistent.
Replies are the measure. `deliverability.md` section 7 covers the mechanics.

---

## 11. Failure modes worth designing against now

**Two workers, one message.** Solved by `FOR UPDATE SKIP LOCKED` at step 1 of
the send. Do not build a queue drain that reads then writes.

**The timer firing on a stopped sequence.** Solved by re-running the gate on
every follow-up, not by trusting the cancel to have arrived first.

**A regenerated draft inheriting an approval.** Solved by hashing the content
into the approval. `approval-gates.md` section 3.

**The localStorage mirror.** `src/pages/Crm.jsx` copies leads into
`nabl.sales-intelligence.v3` on the operator's device and reads them back when
the server returns nothing. A lead suppressed server-side can still be present
locally. `07-crm/migration-plan.md` covers the options and it must be resolved
before v4 sends anything, because a suppression list with a local cache in front
of it is not a suppression list.

**A clock change.** Business-day arithmetic in UK local time crosses BST
twice a year. Store timestamps in UTC, compute the schedule in Europe/London,
and test the last Sunday in March.
