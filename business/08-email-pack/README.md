# 08 — Email pack

```
Status:       done
Owner:        Alex
Next review:  before the first sequence goes out, and when a list provider exists
              for [Unsubscribe Link] to point at
Evidence:     nabl-emails/, scripts/check-email-contrast.mjs
```

Six branded email templates exist in the repository at `nabl-emails/`, each as
an HTML file and a plain-text partner, with `.eml` files built from those two
sources. All six are on the current brand. All six pass a measured WCAG AA
contrast check, re-run today, which reports 6/6.

"Done" here means the pack is built, rebranded and verified by measurement. It
does **not** mean it has been tested in real mail clients, and it does **not**
mean there is anything to send it with. Neither of those has happened and
neither is being counted as finished. Both are listed under next actions.

Last substantive revision: 2026-08-16.

---

## What this step is

The email pack is how n.abl looks in someone's inbox.

Six templates covering the points in a client relationship where an email is
doing real work: a general follow-up, an urgent notice, a meeting confirmation,
a proposal delivery, an onboarding welcome, and a project update.

Each template is a hand-filled starting point, not a mail merge. You copy it,
replace the values in square brackets, pair the HTML with its text partner, and
send it to one person.

The files live in the application. This folder describes them, records the rules
that came out of testing, and says what is still open.

**This step is not:**

- the brand specification, which is `02-brand` and which this pack consumes
- the outreach engine, which is step 11 in the master plan, is v4 work, and does
  not exist
- the CRM's compliance schema, which is `07-crm` and is incomplete
- the client welcome-pack document, which is step 09 in the master plan and is
  generated from the team space rather than emailed from here

---

## What "done" looks like

Eight statements. All eight are true today, and each was checked against the
files before this was written.

- [x] Six templates exist, each as `.html` and `.txt`, covering general, alert,
      meeting, proposal, welcome and update.
- [x] Every template is on the current brand: warm espresso ground, cream text,
      amber accent, amber signature bar. No old-brand hex value survives
      anywhere in the pack.
- [x] The wordmark in the header and footer is the drawn artwork, served as a
      PNG from the live site. It is not type, and it is not reconstructed in
      CSS. `https://nabl.agency/brand/wordmark-email.png` returns 200 and the
      same 10,538 bytes as the local master.
- [x] Contrast is verified by rendering each template in a browser and measuring
      the composited colours. `npm run test:emails` reports 6/6 and exits
      non-zero on any failure, so it works as a gate.
- [x] The deep-amber rule for light grounds is applied, and the two defects the
      measured check found have been fixed.
- [x] Every footer carries an unsubscribe token plus links to the privacy policy
      and the terms, in all six HTML files and all six text files. Both live
      links resolve: `/privacy` and `/terms` return 200.
- [x] The `.eml` files are generated from the `.html` and `.txt` sources by
      `nabl-emails/build-eml.sh`. All six were parsed today and both parts match
      their sources in all six. Nothing has drifted.
- [x] The copy no longer sells "our three pillars".

What is **not** claimed:

- **No template has been through a real client-rendering test.** No Litmus or
  Email on Acid run has happened. Browser rendering confirms the design and the
  contrast. It says nothing about Outlook on Windows, which uses the Word
  engine and is the most likely thing to break.
- **There is no sending system.** These are files you open and fill in by hand.
  The unsubscribe link is `[Unsubscribe Link]` in all thirteen places it
  appears, because there is no list provider and no suppression list to point it
  at.
- **The pack is not cleared for marketing outreach.** That needs the compliance
  fields in `07-crm`, which do not exist, and a sender that hard-blocks
  opted-out records in the database, which does not exist.
- Old-brand *wording* survives in HTML comments and in `nabl-emails/README.txt`.
  The rendered colours are correct. Some of the descriptions around them are
  stale.

---

## Next actions — do these in order

Each is a small closed job. None is a design decision.

- [ ] **Rewrite `nabl-emails/README.txt`.** Section 1 describes "a black alert
      banner, a lime action box". Section 3 tells the reader to expect "the lime
      top bar" and "lime/black accents". Section 4 names Impact as a heading
      font, which no template uses. The note under the header says the wordmark
      URL "only resolves once the site is deployed" — the site is deployed and
      the URL returns 200.
- [ ] **Strip the stale colour comments from the sources.** Six comments reading
      `<!-- LIME TOP BORDER -->` or `<!-- CTA BUTTON (lime) -->` across four HTML
      files (meeting, proposal, update, welcome), mirrored into their four `.eml`
      outputs. Fix the four sources, then re-run `bash nabl-emails/build-eml.sh`.
- [ ] **Settle the light card ground.** Three near-whites are in use as the
      600px card: `#FFFDF9` in meeting, proposal, update and welcome; `#FBF6EC`
      in alert; `#F7F2E8` in general. Body ink on light is `#0E0C0A` in four
      templates and `#14110E` in the other two. Everything passes, so this is
      consistency rather than a defect. Pick one of each and apply it, or record
      the variation in `02-brand` as intentional.
- [ ] **Decide on the five off-palette colours.** `#8E3128` alert red, `#24170A`
      button ink, `#6B625A` warm grey for secondary text on light, and `#E8E8E8`
      and `#E2E2E2` for rules and the progress track in the update template.
      Each does a real job and each passes contrast. Promote them to named
      tokens in `02-brand`, or replace them with tokens that already exist.
- [ ] **Reword two bullets in the proposal template.** The "what's included"
      list still says "Automation opportunity mapping" and "Recommended
      optimisation roadmap", in both `email-proposal.html` and
      `email-proposal.txt`. Those name our tools. The rest of the pack names the
      client's problem.
- [ ] **Make one placeholder consistent.** The meeting template uses `[Name]`
      for the n.abl attendee while every other template uses `[First Name]` for
      the recipient. Two files, two lines. Rename it to something unambiguous
      such as `[n.abl Attendee]` so nobody fills the wrong one in.
- [ ] **Run one real client-rendering test.** Litmus or Email on Acid, across
      Outlook desktop, Outlook.com, Gmail, Apple Mail, iOS Mail and mobile. The
      VML button fallbacks in five of the six templates are the specific thing
      being tested. Cost: [PLACEHOLDER — both are paid services; check whether a
      free trial covers a single run of six templates].
- [ ] **Do not automate sending from this pack** until `07-crm` carries the
      compliance fields and the send path blocks opted-out records in the
      database. That is v4 in the master plan and it is deliberately later.

---

## What each file in this folder is for

| File | What it is for | Read it when |
|---|---|---|
| `README.md` | This file. What the step is, what done means, the honest status, what to do next. | You are opening the folder cold. |
| `template-inventory.md` | What is actually in `nabl-emails/`, template by template: files, sizes, subject lines, preheaders, sections, buttons and the exact colours each one uses. Plus the contrast rule, the measured figures behind it and how it was verified. | You need to pick a template, change one, or check a colour before you use it. |
| `sending-notes.md` | How to send one without getting it wrong: placeholders, pairing HTML with text, using the `.eml` files, the compliance position, and what has to be true before any of this is automated. | You are about to send one, or you are wiring a sender. |

---

## Where the real files live

This folder describes. It does not store. Paths are from the repository root.

| Path | What it holds |
|---|---|
| `nabl-emails/email-*.html` | Six HTML sources. Table layout, inline styles. |
| `nabl-emails/email-*.txt` | Six plain-text partners. |
| `nabl-emails/email-*.eml` | Six built multipart files. Generated, not edited. |
| `nabl-emails/build-eml.sh` | Builds the `.eml` files, and holds the subject lines. |
| `nabl-emails/README.txt` | The pack's own readme, shipped alongside the files. Partly stale, see above. |
| `scripts/check-email-contrast.mjs` | The contrast gate. Renders in Chromium, measures the DOM. |
| `public/brand/wordmark-email.png` | The header and footer logo. 10,538 bytes. |

The two commands, both run from the repository root:

```
bash nabl-emails/build-eml.sh     # regenerate the six .eml files
npm run test:emails               # render and measure all six HTML templates
```

---

## The three rules that must not be broken

1. **The HTML and text files are the source. The `.eml` files are output.** Edit
   an `.eml` and the next build silently discards the change.
2. **On light grounds the accent is deep amber `#B87718`.** Plain amber
   `#E9AC57` measures 1.97:1 on the near-white card and fails contrast.
3. **Contrast is measured, never inferred.** Two static passes over this markup
   produced false results. Run the renderer.
