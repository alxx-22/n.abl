# Deliverability

Domain choice, authentication, warm-up, volume ceilings, and why a burnt domain
does not come back cheaply.

Nothing described here is set up. No outreach domain is registered, no provider
account is open, and the current mail DNS on `nabl.agency` has not been checked
as part of this work. Treat every state below as unknown until someone looks.

---

## 1. The thing to understand first

Deliverability is not a setting. It is a **reputation**, held about your domain
and your sending IP by a small number of receivers — mostly Google and Microsoft
— built from how recipients behave, and it is not something you can appeal.

There is no support line. There is no form. If Gmail decides mail from your
domain belongs in spam, it does not tell you, your messages simply stop being
read, and the first symptom is a reply rate that quietly goes to zero. You will
assume the copy is wrong and rewrite it, which changes nothing.

Reputation is slow to build and fast to lose, and that asymmetry is the whole
reason this document exists. Every rule below is an attempt to avoid finding out
what the recovery process is like.

---

## 2. Use a separate domain

**Outreach must not send from `nabl.agency`.**

`nabl.agency` carries `hello@nabl.agency`, the address on the website footer, in
the privacy policy, in the portal sign-in page, in all six email templates and
in the client welcome pack. It is how proposals reach clients and how the portal
tells someone their access key. It is the business's front door.

If cold outreach damages that domain's reputation, a client's proposal lands in
their junk folder and n.abl looks unprofessional to the one audience that is
already paying. That is not a risk worth taking to save a domain registration
fee.

So: **register a second domain for outreach.** Something plainly related and
plainly honest — the point is not to disguise anything, it is to isolate the
reputation. Choice and cost: [PLACEHOLDER — pick the name, register it, record
the annual fee here and in `16-finance`].

Three requirements on it:

1. **It must have MX records pointing at a real inbox someone reads.** A domain
   that sends and cannot receive is both a bad signal and an operational
   failure — replies, bounces and opt-out requests all arrive by mail.
2. **It must not be brand new on the day of the first send.** Domain age is a
   signal. Register it, park it, publish authentication, and leave it alone for
   at least 30 days before sending anything. This is free and it only costs
   patience, so there is no excuse for skipping it.
3. **It must resolve to something.** A live page saying who n.abl is, linking to
   `nabl.agency`. A recipient checking the domain in a message they did not
   expect should find a real business, not a parked page.

A subdomain of `nabl.agency` is the cheaper option and it is not enough. Filters
do associate subdomain behaviour with the parent, and the exposure this is
avoiding is precisely the parent's reputation.

---

## 3. SPF, DKIM and DMARC

Three records. All three are required, all three are free, and all three are
routinely got subtly wrong.

### SPF

A TXT record on the sending domain listing what is allowed to send for it.

```
v=spf1 include:<provider> -all
```

The traps:

- **One SPF record per domain.** Two records is a permanent error and it fails
  the whole check. If a record already exists, merge into it, do not add a
  second.
- **Ten DNS lookup limit.** Each `include:` costs lookups and nested includes
  count too. Exceeding ten is a permanent error. With one provider this is not
  a problem; it becomes one the third time someone adds a tool.
- **Start on `~all`, move to `-all`.** Soft-fail while checking that nothing
  legitimate is being caught, then hard-fail. Do not leave it on `~all`
  indefinitely, and never use `+all`.

### DKIM

A cryptographic signature on each message, verified against a public key
published in DNS. The provider generates the key pair and gives you the record.

- **2048-bit** where the provider supports it. 1024 is still accepted and is
  the weaker option.
- **Publish the record and verify it before the first send.** A DKIM record with
  a wrapped or truncated key is the most common setup error and it fails
  silently.
- **Plan for rotation.** Selectors exist so keys can be replaced. Once a year is
  reasonable and it needs to be in a calendar, not in someone's head.

### DMARC

A policy record at `_dmarc.<domain>` telling receivers what to do when SPF and
DKIM alignment fails, and where to send reports.

The sequence, and it is a sequence:

```
1. v=DMARC1; p=none; rua=mailto:dmarc@<domain>
   Leave it here for at least 4 weeks. Read the reports.

2. v=DMARC1; p=quarantine; pct=25; rua=...
   Raise pct in stages. Watch for anything legitimate being caught.

3. v=DMARC1; p=reject; rua=...
   Only once the reports are clean.
```

Going straight to `p=reject` before reading a month of reports is how a business
discovers, in production, that its accounting software has been sending invoices
as it for two years.

**Alignment is the part people miss.** DMARC does not just require SPF or DKIM
to pass; it requires the passing domain to align with the `From:` domain. A
message that passes SPF for the provider's own bounce domain and shows
`From: someone@<outreach domain>` fails DMARC. The provider's setup
documentation covers this and it must actually be followed.

### Verify, do not assume

Before the first send, confirm from outside: the SPF record resolves and is
unique, DKIM verifies on a test message, DMARC is published, MX resolves, and
there is no stale record from a previous provider. Send a test to a Gmail
address and read the raw headers for three `pass` results.

Also worth doing on `nabl.agency` itself while you are there, since nobody has
checked it. A domain that sends no mail should still publish an SPF record and a
DMARC policy, or anyone can send as it.

---

## 4. Warm-up

A new domain sending its first fifty messages on day one looks exactly like a
spammer, because that is what spammers do. Warm-up is the process of building a
sending history slowly enough that the volume never looks sudden.

### The schedule

Conservative, because the human approval gate caps throughput anyway and there
is nothing to be gained by racing.

| Week | Messages per day | Sent to |
|---|---|---|
| 0 | 0 | Domain registered, authenticated, parked. At least 30 days. |
| 1 | 5 | Real one-to-one mail. Colleagues, existing contacts, anyone who will reply. |
| 2 | 10 | Same, plus the first shortlisted leads at the end of the week |
| 3 | 15 | Shortlisted leads |
| 4 | 20 | Shortlisted leads |
| 5 | 25 | Shortlisted leads |
| 6 | 30 | Shortlisted leads |
| 7+ | 30 to 40 | Steady state. Do not exceed without a reason. |

### The rules that make warm-up work

- **Early messages should get replies.** Reply is the strongest positive signal
  available. Week one goes to people who will actually write back, and asking
  them to reply is a legitimate part of the process.
- **Spread across receivers.** Do not warm entirely against one provider. Mix
  Gmail, Outlook and business domains, roughly in the proportion the real list
  has.
- **Never skip a week to catch up.** A jump from 10 to 40 undoes the ramp. If
  sending pauses for a fortnight, restart two steps down.
- **Stop on the first sign of trouble.** Bounce rate over 2%, or anything
  landing in spam on a test account, halts the ramp until it is understood.
- **Warm-up is not a batch of throwaway mail.** Sending rubbish to seed accounts
  to build a number produces a number, not a reputation.

Total elapsed time from registering the domain to steady state: about ten weeks.
That is the honest figure and it should be planned for, not compressed. It is
also, usefully, roughly the time it will take to finish `07-crm` and
`10-lead-sourcing`, so the two can run in parallel.

---

## 5. Volume ceilings

Enforced in the database, checked by the send-path gate function, and not
adjustable by editing a config file.

| Ceiling | Value | Why |
|---|---|---|
| Per day | 40 after warm-up | Above the human gate's capacity anyway |
| Per hour | 8 | Spreads the day, avoids a burst |
| Per recipient domain, per day | 3 | Do not hammer one company's mail server |
| Minimum gap between messages | 60 seconds, randomised up to 240 | Regularity is a fingerprint |
| Messages per thread | 3 total | `sequence-design.md` section 7 |
| Minimum re-contact interval | 6 months | For a lead that did not reply |
| Sending window | 08:00 to 17:00, Mon to Fri, Europe/London | Both weekend and 03:00 sends look like a machine |

Raising the daily ceiling is a decision, not a configuration change. It should
require a reason written down, and the reason "we have a backlog" is the wrong
one — a backlog means the shortlist is too long, and `10-lead-sourcing` is where
that gets fixed.

Note that 40 a day is nowhere near any bulk-sender threshold. Google's published
bulk sender requirements apply above 5,000 messages a day to Gmail addresses,
which n.abl will not approach. That does not make them irrelevant: the same
filtering signals apply to everyone, the thresholds are a useful statement of
what receivers consider acceptable, and following them at low volume costs
nothing. [Check the current text at Google's own documentation before relying
on any specific figure — this guidance changes.]

---

## 6. The numbers that decide whether you are in trouble

| Signal | Target | Danger |
|---|---|---|
| Hard bounce rate | Under 1% | Over 2% — stop and fix the list |
| Spam complaint rate | Under 0.1% | Over 0.3% — Google's published bulk-sender ceiling, and a rate that will already be hurting |
| Reply rate | Whatever it is, honestly measured | Sudden fall to zero usually means filtering, not copy |
| Authentication pass rate | 100% | Anything less is a configuration error, not a reputation problem |

The complaint figures deserve attention because of how small they are. At 40
messages a day, 0.3% is roughly one complaint every eight days. Three annoyed
recipients in a month is enough to matter. This is why the targeting gate exists
and why "would I be comfortable if they phoned and asked how we got their
details?" is a real question in `approval-gates.md` section 2.

Register the sending domain with **Google Postmaster Tools** and **Microsoft
SNDS**. Both are free and both give visibility that is otherwise unavailable. At
n.abl's volume Postmaster Tools may not show a complaint rate at all, since it
suppresses data below a volume threshold — the absence of data is not the
absence of a problem.

---

## 7. Content and mechanics that affect delivery

- **Send both parts.** `multipart/alternative` with text first and HTML second.
  HTML alone is a signal against you. `08-email-pack/sending-notes.md` section 3
  covers how the templates do this.
- **No tracking pixels, no link rewriting.** Open tracking adds a remote image
  and a rewritten link domain, both of which are filtering signals, and both of
  which impose surveillance on someone who did not ask for the email. n.abl
  self-hosts its fonts to avoid disclosing visitors' IP addresses to Google;
  putting a tracking pixel in a stranger's inbox is the same thing done to a
  worse audience. Measure replies.
- **One-click unsubscribe.** `List-Unsubscribe` with
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, pointing at the
  suppression endpoint. It is expected by receivers and it is the cheapest
  possible way for someone to stop the mail without complaining instead.
- **Plain and short.** No images beyond the wordmark, no attachments, few links,
  and links that go where they say. Attachments on cold mail are close to a
  guaranteed filter.
- **Consistent From.** A named person at the outreach domain, the same one each
  time. Rotating sender identities is a spammer pattern.
- **Clean the list before sending.** Every hard bounce is reputation damage that
  a syntax check and an MX lookup would have prevented. Both are Class 1 and
  cost nothing.

---

## 8. Why a burnt domain does not come back cheaply

This is the section to read before arguing for a higher ceiling.

**There is no reset.** Reputation attaches to the domain and to the sending IP,
is held privately by each receiver, and there is no mechanism that guarantees
its removal. You cannot buy it back, and there is nobody to ask.

**Blocklist removal is not the whole problem.** Getting off Spamhaus or a
similar public list is a form and a wait. That is the easy part. The hard part
is Gmail's and Microsoft's own internal reputation, which is not a list, has no
delisting process, and simply decays slowly — if the behaviour that caused it
has stopped.

**Recovery is measured in months.** Assume a stricter version of the warm-up
schedule in section 4, from a lower base, with no guarantee at the end. Two to
three months of careful sending to restore a domain that took ten weeks to build
is a reasonable expectation, and it might not work.

**A new domain is not a free escape.** It is another registration fee, another
30-day age wait, another ten-week warm-up, and it starts with no history at a
time when your other domain has bad history. Receivers are not naive about
domains registered by the same party after a reputation problem.

**The real cost is the one that is easy to miss.** If the outreach domain is
burnt, outreach stops for a quarter, which is annoying. If `nabl.agency` is
burnt — because someone decided a separate domain was an unnecessary expense —
then proposals, welcome packs, portal key emails and every reply to
`hello@nabl.agency` become unreliable, and the business's ability to talk to
paying clients is damaged by an activity that had not yet earned anything. That
is the specific outcome section 2 exists to prevent.

**And the arithmetic never favours the shortcut.** The master plan's section 5
puts it plainly: a machine that can send 10,000 bad emails burns the domain, the
list and the reputation at the same time, and none of the three come back
cheaply. Forty good messages a day, from a warmed domain, with two people
reading them, will out-earn ten thousand bad ones in every month that follows.

---

## 9. Before the first send

- [ ] Outreach domain registered, at least 30 days old, with a live page on it
- [ ] MX pointing at an inbox a person reads daily
- [ ] Single valid SPF record, under ten lookups, on `~all`
- [ ] DKIM published, 2048-bit, verifying on a test message
- [ ] DMARC at `p=none` with `rua` reporting, and four weeks of reports read
- [ ] DMARC alignment confirmed against the actual `From:` domain
- [ ] `nabl.agency`'s own SPF and DMARC checked while you are in the DNS
- [ ] Google Postmaster Tools and Microsoft SNDS registered
- [ ] Warm-up complete to at least week 4
- [ ] Ceilings in section 5 written into the database, not a config file
- [ ] `List-Unsubscribe` one-click resolving to a working suppression endpoint
- [ ] Suppression list live in `07-crm`, with the trigger that prevents deletion
- [ ] Test message sent to Gmail, Outlook.com and a business domain, raw headers
      read, three `pass` results confirmed
- [ ] Both approval gates working and both operated by a person

Fourteen items. None of them are done, and none of them can be done until
`07-crm` and `10-lead-sourcing` are finished.
