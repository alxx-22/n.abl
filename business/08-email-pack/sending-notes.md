# Sending notes

How to send one of these without getting it wrong, and what has to be true
before any of it is automated.

There is no sending system. Everything below is a manual process, and that is
the current state, not a temporary inconvenience to be engineered around
quickly. Read section 5 before writing any code that sends.

---

## 1. Pick the template

| You are… | Use |
|---|---|
| following up, sending something, keeping a thread alive | `email-general` |
| flagging a deadline, a problem or a decision needed | `email-alert` |
| confirming a call or session | `email-meeting` |
| delivering a proposal, quote or scope | `email-proposal` |
| welcoming a client who has just signed | `email-welcome` |
| reporting progress during an engagement | `email-update` |

If none of the six fits, use `email-general` and edit the body. Do not create a
seventh template without adding it to `build-eml.sh` and re-running the contrast
check, or it will sit outside the gate.

---

## 2. Fill it in

Work on the `.html` and the `.txt` together. They are a pair, and a recipient
whose client blocks HTML sees only the text one.

1. Copy both files out of `nabl-emails/` before editing. The originals are the
   masters.
2. Search each copy for `[` and replace every placeholder. The full list is in
   `template-inventory.md`, section 1.
3. Leave `[if mso]` and `[endif]` alone. Those are Outlook conditional comments
   and deleting them removes the button fallback.
4. In the update template, leave `[COMPLETE]`, `[IN PROGRESS]` and `[UPCOMING]`
   alone unless you are changing the status labels themselves.
5. In the meeting template, `[Name]` is the n.abl attendee, not the recipient.
   `[First Name]` is the recipient. It is the one place the naming is
   ambiguous.
6. Check that no `[` remains in either file. A bracket that reaches a client is
   the most visible mistake available.

Do not change the colours while editing. If you do, re-run `npm run test:emails`
before sending, and read the contrast rule in `template-inventory.md` first.
Plain amber on a light card is 1.97:1 and fails.

---

## 3. Send it

**Always send both parts.** HTML alone is a deliverability signal against you
and leaves text-only readers with nothing.

Two ways to do it.

### Using the `.eml` file

`nabl-emails/build-eml.sh` produces a `multipart/alternative` file per template
with the text part first, the HTML part second, the subject already set, and
`X-Unsent: 1`. Opening one in Outlook, Apple Mail or Thunderbird gives you a
draft with the branding intact, ready to address and edit.

The subject lines live in `build-eml.sh`, not in the HTML. Change one there and
rebuild:

```
bash nabl-emails/build-eml.sh
```

The `.eml` files are output. Editing one directly works until the next build
silently discards it.

### Pasting into a client

Paste the HTML into a client that accepts an HTML source, and attach or paste
the text version as the plain-text alternative. Most clients bury this; if
yours cannot do it, use the `.eml` route instead.

---

## 4. Before it goes

A short pre-send check. Each item is something that has actually been got wrong
somewhere.

- [ ] No `[` left in either file, other than the Outlook conditionals.
- [ ] The subject matches the template you edited.
- [ ] Both parts are attached to the same message.
- [ ] Images-off preview: the wordmark falls back to the alt text "n.abl" and
      the message still reads. Check this by disabling images in your own client
      and sending yourself a copy.
- [ ] The links resolve. `https://nabl.agency/privacy`,
      `https://nabl.agency/terms` and
      `https://nabl.agency/brand/wordmark-email.png` all return 200 as of
      2026-08-16. Any link you added yourself is your responsibility.
- [ ] `[Unsubscribe Link]` has been dealt with. See section 5 — for a one-to-one
      client email you remove it; for anything list-shaped you cannot yet fill
      it in, because there is no list provider.
- [ ] The message is going to one person you can name.

---

## 5. The compliance position

This is where the pack can do real damage, so it is stated plainly.

### What exists

Every footer identifies n.abl by name, with an address to reply to, and links to
the privacy policy and the terms. That covers the identification requirement.

### What does not exist

- **No list provider and no suppression list.** `[Unsubscribe Link]` is a
  placeholder in thirteen places. There is nothing to point it at.
- **No compliance fields in the CRM.** `07-crm` carries none of
  `subscriber_type`, `lawful_basis`, `source`, `source_date`,
  `privacy_notice_status`, `marketing_status`, `opt_out`, `suppression_list` or
  `contact_history`.
- **No hard block on opted-out records**, because there is nothing to block on
  and nothing sending.

### What that means today

These templates are safe for **one-to-one correspondence with a client or a
person who has asked to hear from you**. That is what they were built for:
follow-ups, confirmations, proposals, onboarding, progress reports.

For that use, delete the unsubscribe line rather than shipping a dead
placeholder. A client update is not marketing and does not need one; a link that
goes nowhere is worse than no link.

**They are not cleared for marketing outreach.** Not to a list, not to a
shortlist, not to "just a few" prospects at once.

### The rules that apply when they are

ICO guidance distinguishes corporate subscribers from sole traders and
individual subscribers, and the rules for electronic marketing differ materially
between them. Corporate subscribers can generally receive unsolicited B2B
electronic marketing without PECR consent, but the identity and opt-out
requirements still apply, and personal data used for B2B marketing remains
subject to UK data protection law.

So the decision of whether a given record may be emailed is a database question,
not a judgement call made at send time. It belongs in the schema, described in
section 5 of the master plan.

---

## 6. Before any of this is automated

The master plan puts the outreach engine at v4 and puts it there deliberately. A
machine that can send 10,000 bad emails is a liability, not an asset.

Four things must be true before a line of sending code is written:

1. `07-crm` carries the compliance fields, populated at the point a record is
   added rather than reconstructed later.
2. The send path **hard-blocks** opted-out records in the database. Not a filter
   in a query someone might forget to apply. A block that the interface cannot
   bypass.
3. `[Unsubscribe Link]` resolves to a real endpoint that writes to a suppression
   list, and that list survives deletion of the lead record.
4. The research pipeline in v3 is producing shortlists worth reading, and the
   two human approval gates in the master plan's sequence are in place: a human
   inspects and approves the shortlist, and a human approves the personalised
   copy before anything leaves the building.

Until all four hold, the correct number of automated sends is zero.

One further point that will come up. When a sender does get built, personalising
copy is Class 3 work and worth spending Claude on. Classifying replies is Class
2 and runs on a local model. The follow-up timer is Class 1 and is a plain
scheduler with no model anywhere near it.

---

## 7. Before production use, test in real clients

Browser rendering confirms the design and the contrast. It says nothing about
how any actual mail client behaves.

No template in this pack has been through a client-rendering test. Before these
go to anyone who matters, run all six through Litmus or Email on Acid across
Outlook desktop, Outlook.com, Gmail, Apple Mail, iOS Mail and mobile.

The specific thing under test is the VML button fallback in the five templates
that have a button. Outlook on Windows uses the Word rendering engine and is the
most likely thing to break.

Cost: [PLACEHOLDER — both are paid services; check whether a free trial covers a
single run of six templates].
