# 06 — Team space

```
Status:       done
Owner:        Alex
Next review:  after one month of daily use with a real client in it
Evidence:     scripts/e2e-ui.mjs — the portal, team and CRM assertions
```

The internal team space is built, deployed and in use. Supabase
Auth guards it, five CRUD tabs run the client side of the business, and file
uploads go to private storage buckets served through short-lived signed URLs.

"Done" means the software works and we run the business through it. It does not
mean it is finished being made safe. Three things are true at the same time and
all three belong in the same paragraph: the team space works, the access keys it
issued before 2026-08-15 are weak and have not been rotated, and the schema it
depends on is not in version control. See "Next actions".

Last substantive revision: 2026-08-15.

---

## What this step is for

The team space is the internal side of the business. It is where a client record
is created, where their portal access key is generated, and where the quotes,
projects, meetings and documents that the client later sees in their portal are
written.

It is the only place with write access to client data. The client portal
(`05-portal`) reads the same tables and is SELECT-only. The team space is the
pen; the portal is the window.

It lives at `nabl.agency/team`. It is not in the site navigation. Two
deliberately unlabelled links in the footer are the only routes in from the
public site: the full stop after the footer text and a small square at the end
of it (`src/components/layout/Footer.jsx:47` and `:54`). That is obscurity, not
security. The access control is the sign-in.

**This step is not** the client portal (`05-portal`), the sales CRM
(`07-crm`), the email templates (`08-email-pack`) or the welcome-pack document
design (`09-welcome-pack`). It is the application those things are operated
from. The team space handles businesses that have already signed. Prospects and
leads live in the CRM and never appear here.

### Where the code lives

None of the code is in this folder. It is in the application:

| Path | What it holds |
|---|---|
| `src/pages/Team.jsx` | The whole team space: sign-in, dashboard, five tabs, the create/edit form, the upload zone |
| `src/lib/teamConfig.js` | Tabs, per-tab fields, per-tab ordering, access-key generation, storage path convention |
| `src/lib/supabase.js` | The `teamClient()` singleton, `signedUrl()`, `friendlyError()` |
| `src/components/WelcomeDocModal.jsx` | The welcome-pack composer |
| `src/lib/welcomeDoc.js` | The welcome-pack document itself |
| `src/App.jsx:36` | The `/team` route, lazily loaded so a marketing visitor never downloads this bundle |
| `supabase/functions/summarise-transcript/index.ts` | Optional transcript summariser. Written, **not deployed** |
| `scripts/e2e-ui.mjs` | The mocked end-to-end suite, including the team-space CRUD path |
| `scripts/security-check.mjs` | Credential-strength and bundle-secret regression checks |

---

## What "done" looks like

Twelve statements. All twelve are true today.

- [x] Sign-in is standard Supabase Auth, email and password, through a dedicated
      client (`teamClient()`) whose session is persisted under the storage key
      `nabl-team-auth`. It shares no state with the portal client, which never
      persists anything.
- [x] A failed sign-in always says "Incorrect email or password.", whether the
      email exists or not. Nothing on the page tells an attacker which half was
      wrong.
- [x] Five tabs exist and all five do full create, read, update and delete:
      clients, quotes, projects, meetings, documents.
- [x] Access keys are generated with `crypto.getRandomValues` over a 31-glyph
      alphabet with `O`, `0`, `I`, `1` and `L` removed, 12 characters, which is
      59.5 bits. Rejection sampling keeps every glyph equally likely, so no
      entropy is quietly lost to modulo bias.
- [x] The `projects` query carries no `.order()` at all, because the table has no
      `created_at` column. `ORDER.projects` is `null` in
      `src/lib/teamConfig.js:38`, and `scripts/e2e-ui.mjs:168` fails the build if
      an ordering clause ever appears on that request.
- [x] Both storage buckets (`quotes`, `documents`) are private. Files are opened
      through a signed URL minted at click time with a one-hour expiry, and the
      URL is never written to the database or into the markup.
      `scripts/e2e-ui.mjs:69` asserts that no signed URL appears in the page.
- [x] Uploads are transactional in the way that matters: the file goes up first,
      the row is written second, and a failed row write deletes the file it just
      uploaded. Replacing a file deletes the old object only after the save
      succeeds.
- [x] Deleting a row deletes the file that row pointed at, on a best-effort
      basis, and asks for confirmation first.
- [x] A client record can be created, given a key, and given a branded welcome
      pack without leaving the page. The pack can be downloaded, printed to PDF,
      or saved straight into the client's own portal documents.
- [x] An expired session is caught and shown as an expiry, not as a generic
      failure. `friendlyError()` maps token and session errors to a dedicated
      "Session expired" screen with a route back to sign-in.
- [x] The bundle contains no service-role key and no private key.
      `npm run test:security` checks the built output on every run.
- [x] The team space is code split. `/team` is a lazy route, so a visitor to the
      marketing page never downloads it.

What is **not** claimed:

- **The access-key rotation has not been run.** Every key issued before
  2026-08-15 is the old `PREFIX-XXXX-2026` format: 20.7 bits from
  `Math.random()`, whose internal state is recoverable from a handful of
  outputs. The fix is written and sitting in
  `supabase/migrations/202608150003_rotate_access_keys.sql`, and it was applied
  on 2026-08-16. Both paths now produce the same 19-character format: keys
  minted in the team space and keys already in the database are equally strong.
- **The schema is not in version control.** The `clients`, `quotes`, `projects`,
  `meetings` and `documents` tables, both storage buckets, and the RLS policies
  behind them exist only in the hosted Supabase project. If that project is
  lost, the backend cannot be rebuilt from this repository.
- **There is no per-user permission model and no audit trail.** RLS grants any
  authenticated user full access. Nothing records who created, edited or deleted
  a row. Two people share one level of access, and the database cannot tell them
  apart afterwards.
- **Upload limits are enforced in the browser only.** The 10MB PDF-only rule on
  quotes and the 25MB rule on documents live in the React upload component.
  Anyone signed in with a developer console can bypass both. There is no bucket
  policy behind them.
- **There is no backup.** Supabase is on the free tier, so there is no
  point-in-time recovery. Master plan section 8 puts this second in the queue for
  the first earnings, and it becomes urgent at the second paying client.
- **There is no MFA on team accounts, and no password reset in the interface.**
  The sign-in page says "Forgot your password? Contact the admin", and what that
  means in practice is somebody opening the Supabase dashboard.
- **The "Connected" pill is decorative.** It is a hardcoded label in
  `src/pages/Team.jsx:245`. It does not check anything and will read "Connected"
  while the backend is down.
- **Verification is against a mock.** `npm run test:ui` drives the real built app
  in a browser but against `scripts/mock-supabase.mjs`, not the live project.
  `npm run test:live` probes the live backend separately and is read-only unless
  `WRITE=1` is set.

---

## Next actions — do these in order

Ordered by risk removed per unit of effort, not by appeal.

- [ ] **Pick a date for the access-key rotation and run it.** The migration is
      `supabase/migrations/202608150003_rotate_access_keys.sql`. Read its header
      first: the moment it runs, every existing client key stops working and
      stays broken until you send the replacement. The final `SELECT` prints the
      new keys so you can distribute them. Run it once, on a morning, not last
      thing on a Friday. Do not re-run it, because a second run issues a second
      set and invalidates the ones you just sent.
- [ ] **Pull the schema into a committed migration.** `supabase db pull`, then
      commit it. Shared with `05-portal`. Until this is done, no statement about
      which columns exist can be verified from source, which is exactly why the
      `projects` ordering rule below has to be enforced as a rule rather than
      checked as a fact.
- [ ] **Move the upload limits server-side.** Set a file size limit and an
      allowed MIME type list on the `quotes` and `documents` buckets in the
      Supabase dashboard, matching the browser rules: 10MB and `application/pdf`
      for quotes, 25MB for documents. Then the browser check becomes a courtesy
      rather than the only defence.
- [ ] **Turn on MFA for the team accounts, and write down who has one.** There is
      no account list anywhere in this repository and no sign-up route in the
      interface. Both facts are fine; neither is recorded.
- [ ] **Decide what happens to a client's files when the client is deleted.**
      Today the team space removes the file belonging to the row you deleted and
      nothing else. If the database cascades a client delete to their quotes and
      documents, every one of those files is orphaned in the bucket, still
      billable and still there. Answer it and record the answer in
      `uploads-and-documents.md` either way.
- [ ] **Make the "Connected" pill honest or delete it.** A status indicator that
      cannot report a failure is worse than no indicator, because it is consulted
      during exactly the incident it lies about.
- [ ] **Decide on the summariser.** `supabase/functions/summarise-transcript` is
      written and not deployed, and the "Summarise" button is disabled until
      `VITE_SUMMARISE_URL` is set. Deploying it adds a metered API bill on top of
      the £36 fixed cost base. The "Copy prompt" route already does the same job
      through the Claude Pro subscription at no extra cost. Master plan section 8
      says do not raise the fixed cost base to solve a problem a one-off action
      would solve, so the default answer is: leave it undeployed.

After those seven, this folder is closed until the CRM compliance work
(`07-crm`) or the credit ledger (`13-credits`) needs a sixth tab.

---

## What each file in this folder is for

| File | What it is for | Read it when |
|---|---|---|
| `README.md` | This file. What the step is, what done means, what is honestly missing, what to do next. | You are opening the folder cold. |
| `daily-use.md` | Operating the team space day to day: signing in, what each of the five tabs does, what every field means, the quirks you will hit, and what the error messages actually mean. | You are using it, or somebody new is. |
| `adding-a-client.md` | The runbook from "we won the work" to "the client has their key and their welcome pack". Ordered steps, exact fields, verification, and what to do when a step fails. | You have won a piece of work. |
| `uploads-and-documents.md` | The storage model: two private buckets, the path convention, where the limits are enforced, how signed URLs work, and the rollback rules on upload, replace and delete. | You are uploading, replacing or deleting a file, or you are wondering where a file went. |

---

## The rules that hold in this space

1. **Never order the `projects` query.** The table has no `created_at` column.
   PostgREST rejects an order clause naming a column that does not exist, and
   the failure is not loud: the request errors, the rows array comes back empty,
   and the Projects tab renders as "No projects yet" for every client at once. It
   looks like data loss and it is not. `ORDER.projects` is `null` and must stay
   `null`. If sorting is ever genuinely needed, sort in JavaScript after the rows
   arrive, the way the Meetings tab already does. Anyone who wants to add the
   column instead must add it in a committed migration first, and this rule
   stands until that migration exists in `supabase/migrations/`.
2. **Never hand-type an access key.** The field accepts free text, so a typed key
   is possible and would be a weak credential guarding everything a client can
   see. Always press Generate. Fill in the business name first, because the
   prefix is taken from whatever is in that box at the moment you press it.
3. **Never regenerate a key casually.** Pressing Generate while editing an
   existing client replaces their credential. They are locked out from the moment
   you save until the new key reaches them.
4. **Signed URLs are minted on demand and never stored.** Do not paste a signed
   URL into a database field, an email or a document. It expires in an hour and
   it grants access to anyone holding it in the meantime.
5. **Delete is permanent.** There is no undo, no soft delete and no backup on the
   free tier. The confirmation dialogue is the only safety net.
6. **The team space does not send anything.** No email leaves this application.
   Keys, welcome packs and updates are sent by a person, using the templates in
   `08-email-pack`.
7. **Clients here have signed.** A prospect belongs in the CRM. Creating a client
   record mints a live credential, so it is not the right place to park a maybe.
