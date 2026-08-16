# Template inventory

What is actually in `nabl-emails/`, file by file, as checked on 2026-08-16.

Twenty files: six templates in three formats, plus the pack's own readme and the
build script.

---

## 1. The six templates

| Template | Purpose | Subject line | Files |
|---|---|---|---|
| `email-general` | Everyday follow-up. Sending something, checking in, keeping a thread moving. | A quick update from n.abl | `.html` 5,551 B · `.txt` 1,109 B · `.eml` 7,271 B |
| `email-alert` | Time-sensitive notice. A deadline, a flagged issue, a decision needed. | Action Required - n.abl | `.html` 8,001 B · `.txt` 1,167 B · `.eml` 9,810 B |
| `email-meeting` | Confirming a discovery call, review or scheduled session. | Your meeting with n.abl is confirmed | `.html` 9,664 B · `.txt` 1,301 B · `.eml` 11,660 B |
| `email-proposal` | Delivering a proposal, quote or scope after a discovery call. | Your proposal from n.abl | `.html` 8,861 B · `.txt` 1,382 B · `.eml` 10,911 B |
| `email-welcome` | The first email after a client signs. Onboarding tone-setter. | Welcome to n.abl | `.html` 9,131 B · `.txt` 1,167 B · `.eml` 10,956 B |
| `email-update` | Progress update during an active engagement. | Project update from n.abl | `.html` 10,901 B · `.txt` 1,098 B · `.eml` 12,709 B |

Subject lines are set in `build-eml.sh`, not in the HTML. If you change one,
change it there and rebuild, or the `.eml` and your sent mail drift apart.

### Preheaders

Every template carries a hidden preheader line, which is what the inbox shows
after the subject. All six are present and each is hidden with
`display:none;max-height:0;overflow:hidden;font-size:1px`.

| Template | Preheader |
|---|---|
| general | A quick follow-up from the team at n.abl. |
| alert | Action required — something needs your attention. |
| meeting | Your session with n.abl is confirmed — here are the details. |
| proposal | Your proposal from n.abl is ready to view. |
| welcome | Welcome to n.abl — let's get to work. |
| update | A quick update on where your project stands. |

### What each one is built from

| Template | Sections | Button |
|---|---|---|
| general | Amber bar, dark header, body, action box with amber left rule, sign-off, dark footer | None. It is the plain workhorse. |
| alert | Amber bar, dark header, red alert banner, body, bullet list, action box, CTA, sign-off, footer | Respond Now → |
| meeting | Amber bar, dark header, confirmed banner, body, meeting details box, prep checklist, CTA, reschedule line, sign-off, footer | Add to Calendar → |
| proposal | Amber bar, dark header, body, proposal summary box, investment box, CTA, sub-button line, sign-off, footer | View Full Proposal → |
| welcome | Amber bar, dark header, welcome banner, body, three numbered steps, dedicated-contact box, CTA, warm sign-off, footer | Visit Your Client Portal → |
| update | Amber bar, dark header, update banner, body, three status rows (COMPLETE / IN PROGRESS / UPCOMING), this-week box, action-needed box, CTA, sign-off, footer | Reply With Any Questions → |

Five templates carry a button; general does not. Each button appears twice in
the source, once inside an `<!--[if mso]>` VML block and once outside it, which
is the bulletproof pattern that makes it render as a solid block in Outlook on
Windows. That fallback has not been tested in Outlook. See `README.md`, next
actions.

### Construction, common to all six

- 600px centred card, table layout, all styles inline. No `<style>` block, no
  flexbox, no grid.
- Two font stacks only: `Arial, Helvetica, sans-serif` for body and
  `'Arial Black', Gadget, sans-serif` for headings. Web-safe by necessity — the
  self-hosted brand faces cannot be used in email.
- The wordmark is an image, `https://nabl.agency/brand/wordmark-email.png`,
  10,538 bytes, the same drawn master the site and favicon use. It is an image
  because SVG does not render in Outlook, and the drawn `n` cannot be reproduced
  in email-safe CSS without border-radius, which Outlook also ignores.
- If images are blocked, the alt text reads "n.abl" in cream Arial Black, so the
  fallback still looks deliberate rather than broken.
- Every footer carries the unsubscribe token, a privacy policy link and a terms
  link. Confirmed present in all six HTML files and all six text files.

### Placeholders in use

Counted across all twelve source files. Anything in square brackets that is not
in this table is Outlook conditional syntax (`[if mso]`, `[endif]`) or a status
label in the update template, and must be left alone.

| Placeholder | Occurrences | What it is |
|---|---|---|
| `[Your Name]` | 15 | Sender's name in the signature |
| `[Unsubscribe Link]` | 13 | List-provider unsubscribe URL |
| `[First Name]` | 13 | Recipient's first name |
| `[Date]` | 7 | Deadline, valid-until or due-by |
| `[Reply Link]` | 4 | Usually `mailto:hello@nabl.agency` |
| `[Proposal Link]` | 4 | Hosted proposal document |
| `[Meeting URL]` | 4 | Video call link |
| `[Client Portal Link]` | 4 | Client portal |
| `[Calendar Link]` | 4 | `.ics` or add-to-calendar link |
| `[Action Link]` | 4 | Destination for "Respond Now" |
| `[Month Year]` | 3 | Reporting period, update template |
| `[Day, Date Month Year]` | 3 | Full meeting date |
| `[Business Name]` | 3 | Client's company name, proposal |
| `[Amount]` | 3 | Indicative investment figure, proposal |
| `[Name]` | 2 | The n.abl attendee, meeting template only |
| `[00:00 AM – 00:00 AM]` | 2 | Meeting start and end time |

`[Name]` is the odd one out. Everywhere else the recipient is `[First Name]`,
and in the meeting template `[Name]` is us, not them. Renaming it is in the
next-actions list.

Values already filled in and not to be changed: `hello@nabl.agency`,
`www.nabl.agency`, `https://nabl.agency/privacy`, `https://nabl.agency/terms`,
`© 2026 n.abl`.

---

## 2. Colours in use

### On dark

| Colour | Role | Measured against | Ratio |
|---|---|---|---|
| `#0E0C0A` | Ground, header, footer | — | — |
| `#1A1613` | Raised panels | — | — |
| `#FBF6EC` | Headings | on `#0E0C0A` | 18.12:1 |
| `#F0E7D8` | Body text | on `#0E0C0A` | 15.92:1 |
| `#9A8F80` | Secondary text, footer legal lines | on `#0E0C0A` | 6.15:1 |
| `#E9AC57` | Accent, signature bar, labels | on `#0E0C0A` | 9.76:1 |

### On light

| Colour | Role | Measured against | Ratio |
|---|---|---|---|
| `#FFFDF9` | Card ground: meeting, proposal, update, welcome | — | — |
| `#FBF6EC` | Card ground: alert | — | — |
| `#F7F2E8` | Card ground: general | — | — |
| `#0E0C0A` | Body ink, four templates | on `#FFFDF9` | 19.22:1 |
| `#14110E` | Body ink, alert and general | on `#F7F2E8` | 16.86:1 |
| `#6B625A` | Secondary text on light | on `#FFFDF9` | 5.87:1 |
| `#B87718` | Deep amber, the only amber allowed on light | on `#FFFDF9` | 3.63:1 |
| `#E9AC57` | **Not permitted as text on light** | on `#FFFDF9` | **1.97:1** |

### Off-palette colours

Five values in the pack are not named tokens in `02-brand`. Each does a real job
and each passes contrast.

| Colour | Where | Note |
|---|---|---|
| `#8E3128` | Alert banner ground | Cream `#FBF6EC` on it is 7.44:1. Light amber `#F2C57E` on it is 4.99:1. |
| `#24170A` | Ink on the amber button | 8.74:1 on `#E9AC57`. |
| `#6B625A` | Secondary text on light cards | Used in meeting, proposal, welcome. |
| `#E8E8E8` | Hairline rules, update template | Neutral grey, not warm. |
| `#E2E2E2` | Progress bar track, update template | Neutral grey, not warm. |

`#E8E8E8` and `#E2E2E2` are the only cold greys anywhere in the identity. They
are small, but they are the two most likely to look wrong beside the warm
palette. Decision pending, see `README.md`.

### Old-brand residue

No old-brand hex value survives. `#B8FF00`, `#0A0A0A` and Archivo Black do not
appear in any template.

What survives is wording. Six comments reading `<!-- LIME TOP BORDER -->` or
`<!-- CTA BUTTON (lime) -->` sit in four HTML sources — meeting, proposal,
update and welcome — and are mirrored into their four `.eml` outputs.
`nabl-emails/README.txt` still tells the reader to expect a lime bar and
lime accents, and names Impact as a heading font that no template uses.

---

## 3. The contrast rule, and how it was arrived at

**On light grounds the amber must be the deep amber `#B87718`. Plain amber
`#E9AC57` is not permitted as text on a light card.**

Two measured failures produced that rule. Both were found on the near-white card
ground, and both are recorded in commit `a6e67c9`.

| What was found | Ratio | Threshold | Result |
|---|---|---|---|
| Muted cream `#9A8F80` used as secondary text on near-white, in two templates | **3.12:1** | 4.5:1 at body size | **failed** |
| Plain amber `#E9AC57` on the welcome template's 24px step numerals | **1.97:1** | 3.0:1 for large text | **failed** |

Both were fixed. The muted cream was replaced with warm grey `#6B625A` at
5.87:1, and the step numerals became deep amber `#B87718` at 3.63:1.

Note the size dependency, because it is easy to get wrong. Deep amber on
near-white is 3.63:1. That clears the 3.0:1 large-text threshold, which is what
the 24px numerals needed. It does **not** clear 4.5:1. So deep amber is for
large text and for furniture such as rules and borders. Body-size text on a
light card uses ink or the warm grey, never any amber.

The general rule, stated once: muted cream `#9A8F80` is a dark-ground colour and
plain amber `#E9AC57` is a dark-ground colour. Neither crosses onto light.

### Contrast was verified by rendering in a browser

This matters enough to record, because the obvious approach fails.

The check is `scripts/check-email-contrast.mjs`, run with `npm run test:emails`.
It opens each HTML file in Chromium, walks every element holding its own visible
text, reads the resolved colour, then walks up the ancestor chain to the first
background that is not transparent. That is what a mail client actually
composites. It applies the WCAG AA thresholds — 4.5:1 for body text, 3.0:1 for
large text, where large means 24px or more, or 18.66px at weight 700.

**Two static regex passes over the markup were tried first, and both gave false
results.** Table-based email HTML nests grounds inside grounds, and a regex walk
cannot tell which ground a run of text is sitting on. The static attempts
reported 12 failures that were all false positives, and buried the two real
defects above.

The rule that follows: do not reason about contrast in this pack by reading the
source. Render it and measure it.

Current result, re-run 2026-08-16:

```
  ✓ email-alert.html
  ✓ email-general.html
  ✓ email-meeting.html
  ✓ email-proposal.html
  ✓ email-update.html
  ✓ email-welcome.html

6/6 templates pass contrast
```

The check exits non-zero when a template fails, so it works as a gate.

---

## 4. Build state

`build-eml.sh` reads `email-<name>.html` and `email-<name>.txt`, converts both to
CRLF, and writes a `multipart/alternative` message with the plain-text part
first and the HTML part second. It sets `From: n.abl <hello@nabl.agency>`, the
subject from its own lookup table, and `X-Unsent: 1` so the file opens as a
draft rather than a received message.

All six `.eml` files were parsed and compared against their sources on
2026-08-16. Both parts match in all six, and all six carry `X-Unsent: 1`.
Nothing has drifted.

If you edit an `.eml` directly, the next build discards the edit without
warning.
