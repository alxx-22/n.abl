# 09 — Welcome pack

```
Status:       done
Owner:        Alex
Next review:  after the first real client has received one
Evidence:     src/lib/welcomeDoc.js, and the first generated document
```

The generator exists in the application, is reachable from the
team space, and produces a branded, self-contained welcome document for a client
in about a minute. Most of the document needs no model and costs nothing to
produce.

"Done" means the thing is built and works. It does not mean it has ever been
given to a client — there are no clients yet — and it does not mean it is
covered by a test. Both are stated plainly below and neither is counted as
finished.

Last substantive revision: 2026-08-16.

---

## What this step is for

The welcome pack is the first document a new client receives from n.abl. It
carries their portal access key, tells them what happens next, says who to talk
to, and — when the discovery call gave us something worth stating — sets out
what we are setting out to achieve together.

It is generated from the client record in the team space, not written by hand.
The design principle behind it is the important part:

> The document is split into a deterministic scaffold and one section that needs
> judgement. The scaffold comes from the client record and never needs a model.
> The goals section is the only part that reads a meeting transcript, and if no
> goals are supplied that section is left out of the document rather than padded.

There is deliberately **no keyword-matching fallback**. An earlier version of
this codebase generated plausible "research" prose from keyword matching and
presented it as analysis. Nothing here invents anything about a client.

**This step is not:**

- the team space itself, which is `06-team-space` and is the application this
  runs inside
- the runbook for creating a client, which is
  `business/06-team-space/adding-a-client.md` — that covers stages 1 to 8 of
  onboarding and points here for the detail
- the six email templates, which are `08-email-pack`. Nothing in the team space
  emails anybody; sending is a person's job
- the brand specification, which is `02-brand` and which this document consumes

---

## What "done" looks like

Ten statements. All ten are true today.

- [x] A **Welcome pack** button sits on every row of the Clients tab in the team
      space, and opens a composer with a live preview.
- [x] The scaffold is deterministic: greeting, portal key and how to use it,
      three next steps, contacts, footer. It is built from the client record,
      needs no API key, no network call and no model, and costs nothing.
- [x] The goals section is **omitted entirely** when nothing is supplied. The
      preview says so explicitly while it is empty.
- [x] Two routes exist for filling it, both of which work today with no key:
      paste the goals in directly, or press **Copy prompt** and use any chat
      window, then paste the answer back.
- [x] Every value interpolated into the document is HTML-escaped through one
      `esc()` helper, including the client name, the access key and each goal.
- [x] The output is a single self-contained HTML file: no external stylesheet,
      font, script or image. It opens correctly from a disk with no network.
- [x] The wordmark is the drawn artwork, inlined as SVG — a 13-unit monoline
      stroke with butt caps, and the square full stop in amber `#E9AC57`. It is
      not type and is not reconstructed in CSS.
- [x] Three ways out: **Save to portal**, **Print / PDF**, **Download HTML**.
      The portal save uploads to the private `documents` bucket and inserts the
      row, and removes the uploaded file again if the insert fails.
- [x] The optional summarisation Edge Function is written, and is written safely:
      the API key lives in a Supabase secret and never reaches a browser,
      transcripts are capped at 60,000 characters, four origins are allowlisted,
      a model refusal is turned into a plain instruction to write the goals by
      hand, and the upstream error body is never relayed to the client.
- [x] The **Summarise** toggle is disabled unless `VITE_SUMMARISE_URL` is set,
      so the button never appears promising something that is not wired up.

What is **not** claimed:

- **The pack has never been issued to a real client.** There are no clients yet.
  Everything here has been exercised against test records only.
- **The Edge Function is not deployed.** The Summarise button has therefore never
  been available in the live team space, and the function has never run against
  the live API. Its request shape was reviewed against the current Anthropic API
  reference on 2026-08-16 and is current — `output_config.format` with a
  `json_schema`, model `claude-sonnet-5` — but reviewing a request is not the
  same as sending one.
- **No test covers any of this.** `npm run test:ui`, `test:live`, `test:security`
  and `test:emails` exist; none of them touches the welcome document.
- **Contrast has been computed, not measured.** The ratios below were calculated
  from the hex values declared in the stylesheet. Nothing renders the document
  and measures the composited colours, which is exactly what the email pack
  learned to do the hard way.
- **The print path has two known defects.** They are measured and listed in the
  next actions.

---

## The contrast position, as it stands

On screen, computed from the declared values. All pass WCAG AA comfortably.

| Foreground | Ground | Ratio |
|---|---|---|
| Body cream `#F0E7D8` | Ground `#0E0C0A` | 15.92:1 |
| Heading cream `#FBF6EC` | Ground `#0E0C0A` | 18.12:1 |
| Muted cream `#9A8F80` | Ground `#0E0C0A` | 6.15:1 |
| Amber `#E9AC57` | Ground `#0E0C0A` | 9.76:1 |
| Heading cream `#FBF6EC` | Key box `#1A1613` | 16.69:1 |
| Muted cream `#9A8F80` | Key box `#1A1613` | 5.66:1 |

In print, the stylesheet flips to a light ground and overrides most colours —
but not all of them:

| Element | Colour | Ground | Ratio | Verdict |
|---|---|---|---|---|
| Body ink | `#14110E` | `#fff` | 18.81:1 | passes |
| Secondary text | `#5F574F` | `#fff` | 7.09:1 | passes |
| Links | `#8F5A0E` | `#fff` | 5.77:1 | passes, but off-palette |
| "ACCESS KEY" label | `#E9AC57` | `#F7F2E8` | **1.79:1** | **fails** |
| Step numerals `01`–`03` | `#E9AC57` | `#fff` | **2.00:1** | **fails** |
| Goal bullets, dots, logo dot | `#E9AC57` | `#fff` | 2.00:1 | markers, not text |

The two failures are real text. The fix belongs to `02-brand`, which already
carries it as an open action — see the next actions below.

---

## Next actions — do these in order

Each is a small closed job. The first four are defects; the last three are
decisions or additions.

- [ ] **Send the business name to the summariser.** `summarise()` in
      `src/lib/welcomeDoc.js` posts `{ transcript }` only, but
      `supabase/functions/summarise-transcript/index.ts` reads `body.business`
      and falls back to the literal string `[business]` in its prompt. In
      endpoint mode the model is therefore never told whose business it is
      writing about. Pass the client through to `summarise()` and include
      `business: client?.business_name` in the POST body. The manual **Copy
      prompt** route is unaffected — `transcriptPrompt(client, transcript)`
      already puts the name in.
- [ ] **Correct `supabase/README.md`.** Its "Edge functions" section says
      "None. The `sales-research` function was the only one, and it has been
      removed." A second function now exists at
      `supabase/functions/summarise-transcript/`. While that file is open, its
      migration table also lists only three migrations; six are on disk — the
      three `202608150001/2/3` rate-limiting and key-rotation migrations are
      missing from the table.
- [ ] **Tighten the manual-mode parser.** Two small faults in `summarise()`:
      (a) the summary is `lines.find(...)`, so only the **first** non-bullet line
      survives — paste two paragraphs of summary and the second one vanishes with
      no warning; (b) the bullet test `/^[-•*•]|^\d+[.)]\s/` lists `•` twice,
      does not include an en or em dash, and does not require a space after the
      marker. Join all non-bullet lines into the summary, or reject the paste
      with a message rather than dropping text silently.
- [ ] **Add a render-and-measure check.** Model it on
      `scripts/check-email-contrast.mjs`, which renders in Chromium and measures
      the composited colours rather than reading the source. It should cover both
      the screen and the print stylesheets, and it should fail on the print
      defects listed above until they are fixed. Wire it to
      `npm run test:welcome` and make it exit non-zero on any failure.
- [ ] **Let `02-brand` close the print path.** That folder's own next actions
      already include "Tidy the welcome-pack print path": promote or replace the
      fourth amber `#8F5A0E`, and apply the deep-amber `#B87718` light-ground
      rule to the key label, the step numerals, the goal bullets and the logo
      dot. Do not fix it twice — the figures above are here so that job can be
      done from measurements rather than guesses.
- [ ] **Settle the four-hour promise.** The document says "We typically respond
      within 4 hours during the working day." The welcome email template and the
      site say the same thing, and nothing measures it. This is the same open
      decision recorded in `03-website` and in
      `business/06-team-space/adding-a-client.md`. Either meet it or soften it,
      once, in all three places.
- [ ] **Decide whether the pack should link to the legal pages.** The email
      templates carry privacy and terms links in the footer; this document does
      not, and it is the document that hands over an access key. This is a
      judgement call, not a defect — make it and record the answer here.

---

## What each file in this folder is for

| File | What it is for | Read it when |
|---|---|---|
| `README.md` | This file. What the generator is, what done means, the measured contrast position, what to do next. | You are opening the folder cold. |
| `how-to-run-it.md` | Operating the generator: the two routes in detail, exactly what the parser does with what you paste, what each output button does and where the file goes, how to deploy the optional Edge Function, and every error message it can show you. | You are about to produce a pack, or you are deciding whether to deploy the summariser. |
| `transcript-guidance.md` | Getting the goals honestly: consent for recording a call, what to say and what to do when someone says no, what must not be pasted into a chat window, retention, and what a good set of goals looks like. | Before a discovery call, and before you paste anything from one. |

---

## Where the real files live

This folder describes. It does not store. The generator is in the application.

| Path | What it holds |
|---|---|
| `src/lib/welcomeDoc.js` | The document itself: `buildWelcomeDoc()`, `summarise()`, `transcriptPrompt()`, `DEFAULT_NEXT_STEPS`, the inline wordmark and the whole stylesheet. |
| `src/components/WelcomeDocModal.jsx` | The composer: the two-way toggle, the transcript field, the live preview, and the four action buttons. |
| `src/pages/Team.jsx` | The **Welcome pack** button on the client row, and `saveWelcomePack()` — the upload, the document row, and the rollback. |
| `supabase/functions/summarise-transcript/index.ts` | The optional Edge Function. Written, not deployed. |

Constants worth knowing without opening the file: the portal address in the
document is `https://nabl.agency/portal`, the contact address is
`hello@nabl.agency`, the stored file is named `welcome-pack.html` and lands at
`[client_id]/[timestamp]-welcome-pack.html` in the private `documents` bucket,
and the downloaded file is named `nabl-welcome-[business-name].html`.

---

## The rules that must not be broken

1. **No fallback for the goals section.** If nothing is supplied, the section is
   omitted. Never fill it from keywords, templates or "typical" client goals. A
   welcome pack with no goals section is honest; one with invented goals is a
   document that lies to a client on day one.
2. **Nothing here sends anything.** There is no send button in the team space and
   there should not be one. The pack reaches the client because a person emails
   it or points them at their portal.
3. **The access key is a password.** It appears in full in this document. Treat
   every copy of the file, printed or saved, the way you would treat a written-
   down password, and reissue the key if a copy goes somewhere it should not.
4. **Do not deploy the Edge Function without a reason.** The Copy prompt route
   produces the same result through the Claude Pro subscription and adds nothing
   to the £36 monthly cost base. The function exists so the option is ready, not
   because the option is needed.
