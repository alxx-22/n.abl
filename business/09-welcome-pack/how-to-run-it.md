# How to run the welcome-pack generator

Operating detail for the generator itself. The wider onboarding runbook — create
the client, check the key, verify from their side — is
`business/06-team-space/adding-a-client.md`. This file is the part that document
points at.

---

## 1. Open it

Team space → **Clients** tab → find the row → **Welcome pack**.

The composer opens with the input on the left and a live preview on the right.
Everything except the goals section is already there, built from the client
record:

| Section | Where it comes from |
|---|---|
| Greeting | `contact_name` — the first word only — and `business_name` |
| "What we're setting out to do" | Only appears once you supply goals |
| Your portal access | `access_key`, plus the fixed portal address |
| What happens next | Three fixed steps, the same for every client |
| Who to talk to | Your own display name, `hello@nabl.agency`, and `contact_email` |
| Date | Today, formatted in British English |

If a client record has no contact name, the greeting falls back to "Thanks for
choosing to work with us". If there is no access key yet, the key box reads
"— to be issued —". Neither breaks the document, but both mean you have opened
the composer too early.

---

## 2. Fill the goals section

The toggle at the top left chooses how. There are two routes and both work today
with no API key.

### Route A — Write it (the default)

Paste a sentence of summary, then the goals as a bulleted or numbered list.

```
We are replacing the Monday reporting pack with a scheduled flow.

- Cut the weekly reporting effort to near zero
- One version of the numbers everyone trusts
```

Exactly what the parser does with that:

- Blank lines are discarded.
- A line starting with `-`, `•`, `*`, or a number followed by `.` or `)` becomes
  a goal. The marker is stripped.
- **The first** line that is not a bullet becomes the summary.
- Everything else is discarded, silently. If you paste two paragraphs of prose
  and then your bullets, the second paragraph does not appear in the document
  and you are not told. Write one paragraph, or check the preview.

Press **Build document**. The button becomes **Regenerate** afterwards; press it
again after any edit to the box.

### Route B — Copy prompt, then any chat window

This is the route to use when you have a raw transcript rather than distilled
goals.

1. Paste the transcript into the box.
2. Press **Copy prompt**. You now have a prompt on the clipboard that names the
   client, includes the transcript, and asks for JSON with a `summary` and
   between two and five `goals` — with an explicit instruction to invent nothing
   and to return fewer goals rather than padding.
3. Paste it into a chat window. Reading a transcript and distilling it is Class 3
   work under section 4 of the master plan, and going through the Claude Pro
   subscription costs nothing on top of the £36.
4. Take the answer back and paste it into the box in the Route A shape: the
   summary as one paragraph, the goals as a bulleted list. Press
   **Build document**.

### Route C — Summarise (only if the endpoint is deployed)

Greyed out unless `VITE_SUMMARISE_URL` was set at build time. See section 5.

---

## 3. Read the preview before you do anything else

Three checks, every time:

- [ ] The access key in the box matches the key on the client row.
- [ ] The greeting uses the right first name, spelled the way they spell it.
- [ ] Every goal is something the client actually said, in words they would
      recognise. If one of them is something *you* concluded, take it out.

If the goals section is missing and you expected it, the preview bar says
"goals section omitted until supplied" — the parser found nothing usable.

---

## 4. Get it out

Four buttons at the bottom. They do different jobs.

**Save to portal.** Uploads the document into the client's own documents and
creates a row titled "Welcome pack", type `other`. They see it the first time
they sign in. The file is named `welcome-pack.html` and stored at
`[client_id]/[timestamp]-welcome-pack.html` in the private `documents` bucket,
served only through short-lived signed URLs. If the database insert fails after
the upload succeeds, the uploaded file is removed again, so a failed save leaves
nothing dangling. Do this one.

**Print / PDF.** Opens the document in a clean detached window and prints it, so
none of the app's own styles bleed in. The document carries its own print styles
and comes out on a light ground with dark text rather than dumping the dark theme
into a printer. Note the two known print defects in the folder README: the
"ACCESS KEY" label and the step numerals stay amber on near-white and fail
contrast. They are legible on screen and weak on paper.

**Download HTML.** Saves it as `nabl-welcome-[business-name].html`. The file is
entirely self-contained — no external stylesheet, font, script or image — so it
opens correctly from a disk, offline, years later.

**Close.** Discards everything. The transcript is held in the browser only and is
never written to the database, so closing the composer is the end of it.

There is no send button, here or anywhere else in the team space. Sending is a
person's job, using `nabl-emails/email-welcome.html` from `08-email-pack`.

---

## 5. The optional summarisation endpoint

**It is not deployed, and it does not need to be.** Deploying it adds a metered
API bill to a fixed cost base we are deliberately protecting, and the Copy prompt
route produces the same result for nothing. Deploy it only if the one-step
version is worth a small monthly bill to you.

### Why it is a function and not a browser call

An API key in the front-end bundle is a key the whole internet has. The key lives
in a Supabase secret, the browser only ever talks to the function, and the
function talks to the model.

### Deploying it

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy summarise-transcript
```

Then set the function's URL as `VITE_SUMMARISE_URL` in the site's **build**
environment and redeploy the site. It is a Vite variable, so it is baked in at
build time — setting it after a build does nothing. The **Summarise** toggle
becomes selectable on the next deploy.

Optional: `ANTHROPIC_MODEL` overrides the default, which is `claude-sonnet-5`.

### What the function does and does not do

| Behaviour | Detail |
|---|---|
| Method | `POST` only. `OPTIONS` returns 204 with CORS headers. Anything else, 405. |
| Origins | Allowlisted: `https://nabl.agency`, `https://www.nabl.agency`, `http://localhost:4173`, `http://localhost:5173`. Anything else is served the first entry, so a stray origin gets blocked by the browser. |
| Input cap | 60,000 characters. Longer transcripts are truncated, not rejected — one paste cannot run up a bill or blow the context window. |
| Output shape | Enforced by the API through a JSON schema rather than asked for in the prompt and dug out with a regex. |
| Refusal | A safety classifier can decline and still return HTTP 200. That case is detected and turned into a 422 with "The summariser declined this transcript. Write the goals in by hand." |
| Errors | The upstream error body is never relayed, because it can echo request details. You get a generic message and the detail stays in the function logs. |

### Turning it off again

Unset `VITE_SUMMARISE_URL` and rebuild the site. The toggle goes back to being
disabled and nothing else changes. Then, if you want the bill gone entirely:

```bash
supabase functions delete summarise-transcript
supabase secrets unset ANTHROPIC_API_KEY
```

### Known gap

In endpoint mode the client's business name is not sent. The browser posts
`{ transcript }`; the function reads `body.business` and falls back to the
literal `[business]` in its prompt. Fix it before relying on this route — it is
the first item in the folder README's next actions. The Copy prompt route does
include the name.

---

## 6. Every message it can show you

### From the composer

| Message | What happened | What to do |
|---|---|---|
| "Paste the transcript or the goals first." | The box was empty when you pressed Build document | Paste something |
| "Nothing usable found. Write a sentence of summary, then the goals as a bulleted or numbered list." | Manual mode found no summary line and no bullets | Reformat as one paragraph plus a bulleted list |
| "The summariser returned nothing usable." | Endpoint mode: the call succeeded but came back empty | Switch to Write it and do it by hand |
| "No summarisation endpoint configured." | Endpoint mode selected with no `VITE_SUMMARISE_URL` | Should be unreachable through the interface; if you see it, the build environment is inconsistent |
| "Summariser returned 404" (or any status) | The endpoint URL is wrong or the function is not deployed | Check `VITE_SUMMARISE_URL` against the deployed function |
| "Your browser blocked the print window." | Pop-up blocker | Allow pop-ups for the site, or use Download HTML and print from the file |
| "Could not upload the pack — please try again." | The storage upload failed | Retry. No document row was created, so nothing is dangling |
| "Could not save to the portal — please try again." | The upload worked, the database insert did not | Retry. The uploaded file has already been removed |

### From the endpoint

| Status | Message | Cause |
|---|---|---|
| 405 | "POST only" | Wrong method |
| 503 | "Summariser is not configured." | `ANTHROPIC_API_KEY` secret is not set |
| 400 | "Invalid JSON." | Malformed request body |
| 400 | "No transcript supplied." | Empty or whitespace-only transcript |
| 422 | "The summariser declined this transcript. Write the goals in by hand." | Safety classifier refusal |
| 502 | "Could not read the summary." | The reply was not valid JSON — usually a truncated response |
| 502 | "The summariser is unavailable right now." | Upstream error or network failure |

---

## 7. Two things worth remembering

**The scaffold costs nothing and never fails.** If the goals route is broken,
misconfigured or simply not worth the trouble on the day, build the document
without goals and send it. A pack with no goals section is a good first
impression. A late one is not.

**The transcript is not stored anywhere by this application.** It lives in the
browser tab until you close the composer. Where else it goes is entirely down to
which route you chose — see `transcript-guidance.md`, which is the file to read
before you paste a recording of somebody's meeting into anything.
