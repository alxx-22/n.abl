# Team space — daily use

How to operate the internal team space. Written so somebody who has never opened
it can run a working day from this page.

The team space is at `nabl.agency/team`. It is not linked from the navigation.
The only public routes in are the full stop and the small square at the end of
the footer.

---

## 1. Signing in

Email and password, through Supabase Auth. There is no sign-up. Accounts are
created by an admin in the Supabase dashboard, and there is no self-service
password reset, which is what "Forgot your password? Contact the admin" means.

The session persists on the device under the storage key `nabl-team-auth`, so a
trusted machine stays signed in between visits. Sign out from the button at the
top right when the machine is not yours.

**A failed sign-in always says the same thing:** "Incorrect email or password."
It says that whether the email exists or not. That is deliberate, so the page
cannot be used to work out which addresses are real. It also means a typo in the
email and a wrong password are indistinguishable from the outside. Check both.

If instead you see "Unable to reach the server. A browser extension or network
may be blocking it.", the problem is not your credentials. Most often it is an
ad blocker or privacy extension blocking the Supabase request, or the free-tier
project having paused after inactivity. Run `npm run test:live` to tell the two
apart: it reports a paused project explicitly and tells you how to restore it.

### When your session expires

You get a dedicated "Session expired" screen with a button back to sign in, not
a generic error. Anything unsaved in an open form is lost. Sign in again and
redo it.

The detection is a text match on the error message, so it catches token, JWT,
session and authorisation failures. It is a wide net. An RLS refusal can be
reported as an expiry, so if you are signed in and something you have never done
before claims your session expired, suspect a policy problem before you suspect
the session.

---

## 2. The shape of the page

Once in, you get a greeting using your display name (or the part of your email
before the `@` if no display name is set), then five tabs, then a control row,
then the rows or cards for the current tab.

The control row holds two things:

- **The add button**, which changes label per tab: "+ Add client", "+ New quote",
  "+ New project", "+ Schedule meeting", "+ Add document".
- **A filter.** On the clients tab this is a search box matching on business name
  only, case-insensitively, anywhere in the name. On the other four tabs it is a
  dropdown of clients, so you can pin the view to one business.

Switching tabs clears the search box, resets the client filter to "All clients"
and closes any open form. That is not a bug; it is why a half-finished form
disappears if you go looking at another tab mid-edit.

**The "Connected" pill at the top is decorative.** It is a fixed label. It does
not test the connection and it will read "Connected" while the backend is down.

---

## 3. The five tabs

### Clients

One row per business. Business name, contact name, contact email, the access key
with a Copy button, the date the record was created, and three actions: Welcome
pack, Edit, Delete.

| Field | Required | Notes |
|---|---|---|
| Business name | Yes | Also the search key, and the source of the access-key prefix |
| Contact name | No | First word is used as the greeting in the welcome pack |
| Contact email | No | Validated as an email if filled. Shown in the welcome pack |
| Access key | Yes | Always press Generate. Never type one |

Sorted newest first, by `created_at`.

The access key is the client's only credential. Treat the Copy button as
handling a password, because it is.

### Quotes

Cards, two to a row.

| Field | Required | Notes |
|---|---|---|
| Client | Yes | Dropdown of existing clients |
| Reference | No | House convention `Q-2026-001`. Uniqueness is not enforced anywhere |
| Title | Yes | |
| Amount | No | Rendered as GBP. A quote saved with no amount shows a blank figure |
| Status | No | `draft`, `sent`, `accepted`, `rejected`. Defaults to `draft` |
| Quote PDF | No | PDF only, 10MB ceiling. See `uploads-and-documents.md` |
| Valid until | No | Date only |

Sorted newest first, by `created_at`. The status badge and the client name show
on the card; "View PDF" appears only when a file is attached.

### Projects

Cards, two to a row, with a progress bar.

| Field | Required | Notes |
|---|---|---|
| Client | Yes | |
| Title | Yes | |
| Description | No | Free text, shown to the client in their portal |
| Status | No | `active`, `paused`, `complete`. Defaults to `active` |
| Progress | No | Integer 0 to 100. Anything outside that range is refused with "0–100 only." |
| Next milestone | No | One line, shown under a "Next" heading |
| Next milestone date | No | Date only |

**Not sorted, deliberately.** See section 5.

### Meetings

Rows with a date block on the left.

| Field | Required | Notes |
|---|---|---|
| Client | Yes | |
| Title | Yes | e.g. "Kickoff call" |
| Date & time | Yes | Local time in the picker, stored as UTC |
| Location | No | e.g. "Microsoft Teams", or a place |
| Join URL | No | Opens in a new tab. Hidden once the meeting is in the past |
| Status | No | `scheduled`, `completed`, `cancelled`. Defaults to `scheduled` |

Fetched in date order, then re-sorted in the browser so upcoming meetings sit at
the top soonest-first and past meetings fall to the bottom most-recent-first.
Past meetings are dimmed and lose their Join button.

The picker takes and shows local time. The value is converted to UTC on save and
back to local on edit, so a meeting entered at 14:00 always displays as 14:00 for
you. It will display in their own local time for anyone in another timezone.

### Documents

Rows with a file icon.

| Field | Required | Notes |
|---|---|---|
| Client | Yes | |
| Title | Yes | e.g. "Signed service agreement" |
| Document type | No | `contract`, `quote`, `invoice`, `report`, `proposal`, `other` |
| File | Yes | Any file type, 25MB ceiling |

Sorted newest first, by `uploaded_at`. That timestamp is set once, when the row
is created, and editing the row afterwards leaves it alone. So a document edited
today keeps its original position in the list, which is usually what you want.

Everything on this tab is visible to the client in their portal as soon as it is
saved. There is no draft state. If it is not ready for them to read, do not
upload it yet.

---

## 4. Creating, editing and deleting

**Create.** Press the add button, fill the form, press the save button. The form
appears above the list, not in a modal, so the list stays visible behind it.

**Edit.** Press Edit on a row. The same form opens, pre-filled. Money, dates and
progress values are converted back into the shape their inputs expect.

**Validation** runs on submit, not as you type. Required fields report
"Required.", email fields report "Enter a valid email.", progress reports
"0–100 only.". Empty optional text fields are saved as `null` rather than as an
empty string.

**Delete** asks first: "Delete [name]?" with "This cannot be undone." underneath.
That is accurate. There is no undo, no soft delete, and the database is on a
free tier with no point-in-time recovery. Confirming deletes the row and then
removes the file it pointed at, if it had one.

Deleting a client is the dangerous one. It removes the business record and the
credential. What happens to their quotes, projects, meetings and documents
depends on the database's foreign keys, which are not in version control and
therefore not verifiable from the repository. Do not find out on a live client.

**Toasts** confirm success in the bottom of the screen: "Saved", "Deleted",
"Copied", "Welcome pack saved to the portal". They are the only confirmation.
The list refreshes behind them.

---

## 5. The quirk you must not undo

**The `projects` table has no `created_at` column, and the projects query must
never be ordered by it.**

`ORDER.projects` is `null` in `src/lib/teamConfig.js:38`, and that `null` means
the query is sent with no ordering clause at all. Every other tab sorts on a
column that exists: clients and quotes on `created_at`, meetings on `datetime`,
documents on `uploaded_at`.

Why it matters more than it looks. PostgREST rejects an order clause naming a
column that does not exist, and the rejection is quiet in the interface: the
request errors, the rows array comes back empty, and the Projects tab renders
"No projects yet" for every client at once. It reads as data loss. Nothing has
been lost, but you will not know that while you are looking at it.

It is also the most inviting line in the file to "tidy up", because the other
four entries have a column name and this one has `null`. It has a comment above
it saying why, and `scripts/e2e-ui.mjs:168` fails if an `order=` parameter ever
appears on a projects request. The client portal has the same constraint at
`src/pages/Portal.jsx:113`.

If projects ever need sorting, sort them in JavaScript after the rows arrive,
exactly as the Meetings tab already does. Adding the column is allowed, but only
through a committed migration, and this rule stands until that migration is in
`supabase/migrations/`.

---

## 6. What the error messages mean

| What you see | What it actually is | What to do |
|---|---|---|
| "Incorrect email or password." | Either half was wrong. The page will not say which | Check the email for a typo before assuming the password |
| "Unable to reach the server. A browser extension or network may be blocking it." | The request never arrived. Usually an extension, or a paused free-tier project | Disable extensions for the site, then run `npm run test:live` |
| "Session expired" screen | A token, session or authorisation error. Usually a genuine timeout, occasionally an RLS refusal wearing the same coat | Sign in again. If it repeats on one specific action, suspect a policy |
| "Couldn't load — please try again." | The read failed. On the Projects tab, suspect an ordering clause | See section 5 |
| "Couldn't save — please try again." | The write failed. Any file uploaded during that save has already been rolled back | Try again. Nothing is half-written |
| "Upload failed — please try again" under a file field | Storage refused the object | Check the size and type, then retry |
| "File must be under 10MB" / "under 25MB" | The browser-side limit | Compress it, or split it |
| "Quotes must be PDF files" | A non-PDF on the quotes tab | Export to PDF. Only the quotes upload is restricted |
| "Connection lost. Refresh the page and try again." | The request threw rather than returning an error | Refresh. Uploads from that attempt were rolled back |
| "Unable to load" on a View button | The signed URL could not be minted | The path may be wrong or the object missing. See `uploads-and-documents.md` |

---

## 7. Checks worth running

From the repository root:

```bash
npm run test:security   # key entropy, no secrets in the bundle, delivery headers
npm run build && npm run preview &
npm run test:ui         # drives the built app in a browser against a mocked backend
npm run test:live       # probes the real project, read-only unless WRITE=1
```

`test:security` and `test:ui` are the two that protect the team space. Run both
before a deploy. `test:live` is what to run when something in the interface says
the server is unreachable, because it distinguishes a paused project from a
broken one and prints the fix.
