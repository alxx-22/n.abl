# Runbook — adding a client

From "we won the work" to "the client has their key and their welcome pack".

This is the actual sequence, in order, with the exact fields and the checks that
catch the mistakes people really make. Everything happens in the team space at
`nabl.agency/team` except the two steps that leave the building, which are
marked as such.

**Time:** about 15 minutes if the discovery notes are in front of you. Longer if
you are writing the goals from scratch.

**Do it in one sitting.** The half-finished state, where a client record exists
with a live credential but nobody has been told anything, is the one state worth
avoiding.

---

## Stage 0 — before you open the team space

Four things must be true. If any is not, stop here.

- [ ] **The work is actually won.** Creating a client record mints a live
      credential to real data. A maybe belongs in the CRM, not here.
- [ ] **You have the business name exactly as they write it.** It becomes the
      heading in their portal, the greeting in their welcome pack and the prefix
      on their access key. Changing it later is easy; changing the key prefix
      means reissuing the key.
- [ ] **You have a contact name and a contact email.** Both are optional in the
      form and neither is optional in practice. The first word of the contact
      name becomes the greeting in the welcome pack, and the email is where the
      key is going.
- [ ] **You have your discovery notes to hand.** The welcome pack has a goals
      section that is filled from them. If nothing is supplied, the section is
      left out of the document entirely rather than padded with filler, and a
      welcome pack with no goals in it is a worse first impression than a
      slightly late one.

Also worth knowing before you start: there is no draft state anywhere in the
team space. Everything you save on the quotes, projects, meetings and documents
tabs is visible in the client's portal from the moment they first sign in.

---

## Stage 1 — create the client record

Clients tab, "+ Add client".

1. **Business name.** Exactly as they write it. This is required.
2. **Contact name.** The person who will sign in.
3. **Contact email.** Validated on save, so a malformed address is caught here.
4. **Access key.** Press **Generate**. Do not type one.

**Fill the business name before you press Generate.** The prefix is taken from
whatever is in the business name box at the moment you press the button: the
first word, uppercased, letters and digits only, cut to six characters. Press
Generate on an empty form and you get the prefix `NABL`, which is valid but
tells you nothing when you are looking at a list of keys later.

So "Globex Industries" gives you a key shaped like `GLOBEX-K7X2-M4PQ-R9WD`, and
"Acme & Sons" gives you `ACME-…`, because the ampersand and the space are
stripped.

What the Generate button actually does: 12 characters drawn with
`crypto.getRandomValues` from a 31-glyph alphabet with `O`, `0`, `I`, `1` and `L`
removed, using rejection sampling so no glyph is likelier than another. That is
59.5 bits, roughly 7.9 × 10¹⁷ candidates. The ambiguous glyphs are gone so the
key survives being read down a phone or copied off a screen. The prefix is not
secret and is not counted; it exists only so a human can tell whose key it is.

5. Press **Create client**. You should see a "Saved" toast and the new row at the
   top of the list.

**Do not press Generate again on an existing client** unless you intend to lock
them out. It replaces the credential, and from the moment you save they cannot
sign in until the new key reaches them.

---

## Stage 2 — check the key before you send it

Two minutes, and it catches the whole class of "they emailed saying it doesn't
work" problems.

1. Press **Copy** on the client row. Paste it somewhere you can see it.
2. Open `nabl.agency/portal` in a private window.
3. Paste the key and sign in.
4. You should land on their dashboard with their business name on it and four
   empty sections. Empty is correct at this point. There is nothing there yet.

If the key is rejected, do not reissue it yet. Check you copied the whole thing
including the prefix, and check for a leading or trailing space. The portal is
rate limited on three axes: 10 misses per IP, 25 per key prefix and 300 globally,
all per 15 minutes. A correct key is never throttled, so if you are being
blocked, the key you are typing is wrong.

---

## Stage 3 — the quote, if there is one

Skip this if the quote was agreed by email and there is nothing to publish.

Quotes tab, "+ New quote".

| Field | What to put |
|---|---|
| Client | The record you just made |
| Reference | House convention `Q-2026-001`. Nothing enforces uniqueness, so keep the sequence yourself |
| Title | What the quote is for, in the client's words |
| Amount | The figure. Rendered as GBP in both the team space and the portal |
| Status | `sent` once it has gone to them. `accepted` when they say yes |
| Quote PDF | The PDF. Nothing else is accepted, 10MB ceiling |
| Valid until | The expiry date, if the quote has one |

Under the commercial model in the master plan, the amount here is priced on
economic value or as a fixed price, never on hours. An efficiency solution is
priced as a fraction of first-year value; a capability solution is fixed price.
The workings belong in `12-pricing` when that folder exists, not in this field.

---

## Stage 4 — the project

This is the one the client will look at most often, because it is the only place
that answers "where are we up to" without them having to ask.

Projects tab, "+ New project".

| Field | What to put |
|---|---|
| Client | |
| Title | The outcome, not the technology. "Weekly reporting pack", not "Python ETL" |
| Description | Two or three sentences the client would recognise as their own problem |
| Status | `active` |
| Progress | `0` at kickoff. Be honest with this number afterwards |
| Next milestone | The next thing that will visibly happen |
| Next milestone date | When |

The progress bar is the promise the portal makes on your behalf. A bar stuck at
65% for three weeks does more damage than no bar at all, so update it whenever
the answer changes.

---

## Stage 5 — the kickoff meeting

Meetings tab, "+ Schedule meeting".

| Field | What to put |
|---|---|
| Client | |
| Title | "Kickoff call" |
| Date & time | Local time. Stored as UTC, shown back to you in local |
| Location | "Microsoft Teams", or wherever |
| Join URL | The link. It appears as a Join button in their portal until the meeting is past |
| Status | `scheduled` |

Once the meeting is in the past it dims automatically and the Join button
disappears. Set the status to `completed` or `cancelled` afterwards so the record
is honest, but nothing breaks if you forget.

---

## Stage 6 — build the welcome pack

Clients tab, find the row, press **Welcome pack**.

The composer opens with a live preview on the right. The document is built from
the client record: their name, their key, the portal address, the contacts and
the next steps. All of that is deterministic and needs nothing from you.

The **goals section is the only part that needs writing**, and it is left out of
the document entirely if you supply nothing. That is deliberate. An earlier
version of this codebase generated plausible "research" prose from keyword
matching and presented it as analysis. Nothing here invents anything about a
client.

Two ways to fill it. The toggle at the top left chooses.

**Write it** (the default, and the one that works today). Paste a sentence of
summary, then the goals as a bulleted or numbered list. The first non-bullet line
becomes the summary, and each bullet or numbered line becomes a goal. For
example:

```
We are replacing the Monday reporting pack with a scheduled flow.

- Cut the weekly reporting effort to near zero
- One version of the numbers everyone trusts
```

**Copy prompt.** Paste the raw transcript into the box, press **Copy prompt**,
and you get a prompt ready for any chat window. Take the answer back and paste
it into the same box in the "Write it" shape. This is the route to use. Reading
a transcript and distilling it is Class 3 work under master plan section 4, and
going through the Claude Pro subscription costs nothing on top of the £36.

**Summarise** is disabled unless `VITE_SUMMARISE_URL` is set. The function that
would serve it is written at `supabase/functions/summarise-transcript/` and is
not deployed, because deploying it adds a metered API bill to a fixed cost base
we are deliberately protecting.

Then press **Build document** and read the preview. Check three things:

- [ ] The access key in the box matches the one on the client row.
- [ ] The greeting uses the right first name.
- [ ] The goals are things the client actually said, in words they would use.

---

## Stage 7 — get it to them

Three buttons at the bottom of the composer, and they do different jobs.

- **Save to portal** uploads the pack into the client's own documents and creates
  a row titled "Welcome pack", type `other`. They will see it the first time they
  sign in. Do this one.
- **Print / PDF** opens the document in a clean window and prints it. The
  document carries its own print styles, so the PDF comes out on a cream ground
  with dark text rather than dumping the dark theme into a printer.
- **Download HTML** saves it as `nabl-welcome-[business-name].html`. The file is
  entirely self-contained, with no external stylesheet, font or image, so it
  still opens correctly from a disk years later.

There is **no send button, in this or any other part of the team space**. Nothing
here emails anybody. Sending is a person's job, using the templates in
`08-email-pack`:

1. Take `nabl-emails/email-welcome.html` (or the `.eml` build of it).
2. Fill the placeholders: `[First Name]`, `[Your Name]`, `[Client Portal Link]`
   which is `https://nabl.agency/portal`.
3. Attach the PDF, or point them at the pack already sitting in their portal.
4. **Send the access key in the body of that email**, and say plainly that it is
   the only thing protecting their information and should be treated as a
   password.

Note that the welcome email template and the welcome pack both promise a response
"within 4 hours on business days". Nothing measures that. `03-website` has the
same claim open as a decision. Until it is settled, either meet it or soften it,
but do not have two documents making a promise nobody is tracking.

---

## Stage 8 — verify from their side

Private window, `nabl.agency/portal`, their key. You should see:

- [ ] Their business name in the greeting.
- [ ] The quote, with the right reference and the amount in GBP.
- [ ] The project, with its progress bar and next milestone.
- [ ] The kickoff meeting, with a working Join button.
- [ ] The welcome pack under documents, and it opens.

That last one is worth clicking. The View button mints a signed URL at the moment
you press it, so clicking it proves the file exists at the path the row records,
not just that the row exists.

---

## When a step goes wrong

| What happened | What it means | What to do |
|---|---|---|
| "Couldn't save — please try again." on the client form | The insert failed | Retry. Nothing was half-written |
| The client row saved but the key looks wrong | Generate was pressed before the business name was typed | Edit the client, fix the name, press Generate again, save. Only safe because nobody has the key yet |
| The portal rejects a key you just made | Almost always a copy error or a stray space | Use the Copy button rather than selecting the text by hand |
| The portal rejects a key and you are sure it is right | Check whether it is an old-format key, `PREFIX-XXXX-2026`. Those predate 2026-08-15 | See the rotation note below |
| "Upload failed" on the quote PDF | Storage refused it | Check it is a real PDF and under 10MB, then retry |
| "Could not upload the pack — please try again." | The welcome pack upload failed | Retry. No document row was created, so nothing is dangling |
| "Could not save to the portal." after the upload | The row write failed and the uploaded file has already been deleted | Retry the whole Save to portal |
| The Projects tab is suddenly empty for everybody | Somebody added an ordering clause to the projects query | See `daily-use.md` section 5. The data is fine |
| The client says the key stopped working | A key was regenerated, or the rotation migration was run | Copy the current key from their row and send it again |

**About old keys.** Every key issued before 2026-08-15 is the old
`PREFIX-XXXX-2026` format: 20.7 bits, generated with `Math.random()`. The
rotation migration that fixes this is written and has not been run. Keys you
generate in the team space today are the strong format. If you are onboarding a
new client, you are not affected. If you are ever asked to look at an old one,
read the header of `supabase/migrations/202608150003_rotate_access_keys.sql`
before touching anything, because running it locks out every client at once.

---

## The whole thing as a checklist

Copy this into the notes for the job.

```
[ ] Work is won, business name and contact confirmed, discovery notes to hand
[ ] Clients tab -> business name typed -> Generate -> Create client
[ ] Key tested in a private window against nabl.agency/portal
[ ] Quote created, PDF attached, status set
[ ] Project created, description honest, progress 0, next milestone set
[ ] Kickoff meeting scheduled with a join link
[ ] Welcome pack built, goals written from the discovery notes
[ ] Key, greeting and goals checked in the preview
[ ] Saved to portal
[ ] Welcome email sent from the template, with the key in the body
[ ] Verified from the client's side: five things visible, welcome pack opens
```
