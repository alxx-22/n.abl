# 08 — Email pack

**Status: done.** Six branded templates exist, in HTML and plain text, with
`.eml` files built from those sources. All six pass a measured WCAG AA contrast
check. The check was re-run today and reports 6/6.

"Done" means the pack is built, rebranded and verified by measurement. It does
not mean it has been tested in real mail clients, and it does not mean there is
anything to send it with. Both of those are stated plainly below and neither is
being counted as finished.

Last substantive revision: 2026-08-15.

---

## What this step is for

The email pack is how n.abl looks in someone's inbox. Six templates covering the
points in a client relationship where an email is doing real work: a general
follow-up, an urgent notice, a meeting confirmation, a proposal delivery, an
onboarding welcome, and a project update.

Each template is a hand-filled starting point, not a mail merge. You copy it,
replace the values in square brackets, pair the HTML with its text partner, and
send it to one person.

The pack lives in the repository at `nabl-emails/`. This folder describes it,
records the rules that came out of testing, and says what still needs doing.

**This step is not:**

- the brand specification itself, which is `02-brand` and which this pack
  consumes
- the outreach engine, which is `11-outreach` and does not exist
- the CRM's compliance schema, which is `07-crm` and is incomplete
- the client welcome-pack document, which is `09-welcome-pack` and is generated
  from the team space, not emailed from here

---

## What "done" looks like

Eight statements. All eight are true today.

- [x] Six templates exist, each as `.html` and `.txt`, covering general, alert,
      meeting, proposal, welcome and update.
- [x] Every template is on the current brand: warm espresso ground, cream text,
      amber accent, amber signature bar. No old-brand hex value survives
      anywhere in the pack.
- [x] The wordmark in the header and footer is the drawn artwork, served as a
      PNG from the live site. It is not type, and it is not reconstructed in CSS.
- [x] Contrast is verified by rendering each template in a browser and measuring
      the composited colours. `npm run test:emails` reports 6/6 and exits
      non-zero on any failure.
- [x] The deep-amber rule for light grounds is applied, and the two defects that
      the measured check found have been fixed.
- [x] Every footer carries an unsubscribe token plus links to the privacy policy
      and the terms, in both the HTML and the text version.
- [x] The `.eml` files are generated from the `.html` and `.txt` sources by
      `nabl-emails/build-eml.sh`, and all six currently match their sources
      byte for byte.
- [x] The copy no longer sells "our three pillars". The proposal template
      describes a proposal built around the problem the client described.

What is **not** claimed:

- **No template has ever been through a real client-rendering test.** No Litmus
  or Email on Acid run has happened. Browser rendering confirms the design and
  the contrast; it says nothing about Outlook on Windows, which uses the Word
  engine and is the most likely thing to break.
- **There is no sending system.** These are files you open and fill in by hand.
  The unsubscribe link is a `[PLACEHOLDER]` because there is no list provider
  and no suppression list to point it at.
- The pack is not cleared for outreach. Marketing sends require the compliance
  fields in `07-crm`, which do not exist yet, and a sender that hard-blocks
  opt-outs, which does not exist yet either.
- Old-brand *wording* survives in comments and in `nabl-emails/README.txt`. The
  rendered colours are correct; the descriptions around them are stale.

---

## Next actions — do these in order

Each is a small closed job. None of them is a design decision.

- [ ] **Rewrite `nabl-emails/README.txt`.** Section 1 describes "a black alert
      banner, a lime action box". Section 3 tells the reader to expect "the lime
      top bar" and "lime/black accents". Section 4 names Impact as a heading
      font, which no template uses. The final header note says the wordmark URL
      "only resolves once the site is deployed" — the site is deployed, and
      `https://nabl.agency/brand/wordmark-email.png` returns 200 with the same
      10,538 bytes as the local file.
- [ ] **Strip the stale colour comments.** Six `<!-- LIME TOP BORDER -->` and
      `<!-- CTA BUTTON (lime) -->` comments across four HTML sources (meeting,
      proposal, update, welcome), mirrored into their four `.eml` outputs:
      eight files, twelve lines. Fix the sources, then re-run
      `nabl-emails/build-eml.sh`.
- [ ] **Settle the light card ground.** Three near-whites are in use across six
      templates: `#FFFDF9`, `#FBF6EC` and `#F7F2E8`. Body ink on light is
      `#14110E` in two templates and `#0E0C0A` in the other four. Everything
      passes, so this is consistency rather than a defect. Pick one of each and
      apply it, or record the variation in `02-brand` as intentional.
- [ ] **Decide on the five off-palette colours.** `#8E3128` alert red, `#24170A`
      button ink, `#6B625A` warm grey for secondary text on light, and `#E8E8E8`
      / `#E2E2E2` for rules and the progress bar in the update template. Each is
      doing a real job and each passes contrast. Promote them to named tokens in
      `02-brand`, or replace them with tokens that already exist.
- [ ] **Run one real client-rendering test.** Litmus or Email on Acid, across
      Outlook desktop, Outlook.com, Gmail, Apple Mail, iOS Mail and mobile. The
      VML button fallbacks in five of the six templates are the specific thing
      being tested. Cost: [PLACEHOLDER — both are paid services; check whether a
      free trial covers a single run of six templates].
- [ ] **Reword two bullets in the proposal template.** The "what's included"
      list still says "Automation opportunity mapping" and "Recommended
      optimisation roadmap". Those name our tools. The rest of the pack now
      names the client's problem.
- [ ] **Do not automate sending from this pack** until `07-crm` carries the
      compliance fields and the send path blocks `opted_out` in the database.
      That is v4 work in the master plan and it is deliberately later.

---

## What each file in this folder is for

| File | What it is for | Read it when |
|---|---|---|
| `README.md` | This file. Status, what done means, what to do next. | You are opening the folder cold. |
| `template-inventory.md` | What is actually in `nabl-emails/`, template by template: files, sizes, subject lines, preheaders, sections, buttons and the exact colours each one uses. Plus the contrast rule, the measured figures behind it and how it was verified. | You need to pick a template, change one, or check a colour before you use it. |
| `sending-notes.md` | How to send one without getting it wrong: placeholders, pairing HTML with text, using the `.eml` files, the compliance position, and what has to be true before any of this is automated. | You are about to send one, or you are wiring a sender. |

---

## Where the real files live

This folder describes. It does not store. The pack is in the application.

| Path | What it holds |
|---|---|
| `nabl-emails/email-*.html` | Six HTML sources. Table layout, inline styles. |
| `nabl-emails/email-*.txt` | Six plain-text partners. |
| `nabl-emails/email-*.eml` | Six built multipart files. Generated, not edited. |
| `nabl-emails/build-eml.sh` | Builds the `.eml` files, and holds the subject lines. |
| `nabl-emails/README.txt` | The pack's own readme, shipped with the files. Partly stale, see above. |
| `scripts/check-email-contrast.mjs` | The contrast gate. Renders in Chromium, measures the DOM. |
| `public/brand/wordmark-email.png` | The header and footer logo, 632 × 244, 10,538 bytes. |

The build and check commands, both run from the repository root:

```
bash nabl-emails/build-eml.sh     # regenerate the six .eml files
npm run test:emails               # render and measure all six HTML templates
```

---

## The three rules that must not be broken

1. **The HTML and text files are the source. The `.eml` files are output.** Edit
   an `.eml` and the next build silently discards the change.
2. **On light grounds the accent is deep amber `#B87718`.** Plain amber
   `#E9AC57` measures 1.97:1 on the near-white card and fails at any size.
3. **Contrast is measured, never inferred.** Two static passes over this markup
   produced false results. Run the renderer.
