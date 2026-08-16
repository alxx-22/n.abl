# 05 — Client portal

```
Status:       done
Owner:        Alex
Next review:  on the second paying client, when point-in-time recovery stops being
              optional
Evidence:     supabase/migrations/, scripts/e2e-ui.mjs, scripts/security-check.mjs
```

The portal is built, deployed and in use at
`nabl.agency/portal`. A client signs in with an access key, and sees their own
quotes, projects, meetings and documents. Nobody else's rows are reachable, and
nothing in the portal can write.

"Done" means the thing exists and works. It does not mean there is nothing left
to do. Two things are open and they are named in full below: the portal's database
schema is not in version control, and demo access keys are committed to this
repository as test fixtures. The strong-key rotation, previously listed here
as written-but-unapplied, was **applied on 2026-08-16** — every key in the
database is now the 19-character CSPRNG format.

Last substantive revision: 2026-08-15.

---

## What this step is for

The client-facing half of the software. One route, `/portal`, served by the same
React 18 + Vite SPA as the marketing site, reading from the same Supabase
project as the team space.

Its job is narrow and worth stating, because it is the reason the portal is
worth its complexity: **a client should never have to ask where something is.**
Quotes, project progress, upcoming meetings and signed documents are all in one
place, on their own terms, without an email thread.

It is deliberately read-only. A client cannot approve a quote, upload a file,
change a milestone or leave a comment. Everything they see was put there by the
team space (`06-team-space`).

**This step is not** the team space that populates it, the CRM (`07-crm`), the
welcome pack that carries the key out to the client (`09-welcome-pack`) or the
legal wording (`04-legal`).

The code lives in the application, not in this folder:

| Path | What it holds |
|---|---|
| `src/pages/Portal.jsx` | The whole portal: sign-in form, dashboard, all four sections |
| `src/lib/supabase.js` | `portalClient()`, which binds an access key to a request; `signedUrl()` |
| `src/lib/teamConfig.js` | `generateKey()`, the key alphabet, the length, the entropy constant |
| `supabase/migrations/202608150001_portal_rate_limiting.sql` | The attempt log, the pruner, `portal_login` v1 |
| `supabase/migrations/202608150002_portal_rate_limiting_v2.sql` | `portal_login` as it runs today: three throttle axes |
| `supabase/migrations/202608150003_rotate_access_keys.sql` | The strong-key rotation. **Written, not yet run.** |
| `scripts/security-check.mjs` | Regression checks on key entropy, persistence and the live throttle |
| `scripts/e2e-live.mjs` | Probes the real backend: no key, bad key, good key |
| `scripts/e2e-ui.mjs` | Drives the portal in a browser against a mocked Supabase |

---

## What "done" looks like

Eleven statements. All eleven are true today.

- [x] A client signs in with an access key alone. There is **no Supabase user
      per client**, no email, no password and no invitation flow.
- [x] The key travels as an `x-access-key` header on every request. RLS resolves
      it through `current_client_id()` and scopes every row to that one client.
- [x] The `anon` role is **SELECT-only** on the five portal tables. The portal
      never issues an insert, update or delete, and the policies do not grant
      one.
- [x] Sign-in goes through the `portal_login` RPC, not a direct select, so the
      login path is throttled server-side.
- [x] The throttle counts misses on three axes — 10 per IP, 25 per key prefix,
      300 globally, each per 15 minutes — and blocks on whichever trips first.
- [x] A correct key is checked **first** and is never throttled, so an attacker
      cannot burn a client's allowance to lock them out of their own portal.
- [x] Keys are 59.5 bits of CSPRNG output: 12 characters from a 31-glyph
      alphabet with no `O`, `0`, `I`, `1` or `L`, drawn with rejection sampling
      so no glyph is likelier than another.
- [x] The key is held in React state only. It is never written to
      `localStorage`, `sessionStorage` or a cookie, and the security check fails
      the build if that changes.
- [x] The raw key is never logged. `portal_login_attempts` records a truncated
      SHA-256 fingerprint and the non-secret prefix, and is invisible to `anon`.
- [x] Files live in private storage buckets and are served only through signed
      URLs minted at click time, with a one-hour expiry. No file URL is stored
      in the database.
- [x] The behaviour is covered by tests: `test:security` asserts entropy and
      non-persistence, `test:live` asserts that no key and a bad key both return
      zero rows, and `test:ui` drives sign-in and rejection in a real browser.

What is **not** claimed:

- **The portal schema is not in version control.** The `clients`, `quotes`,
  `projects`, `meetings` and `documents` tables, the two storage buckets,
  `current_client_id()` and the RLS policies themselves exist only in the hosted
  project. This folder describes them from behaviour and from the code that
  calls them, not from committed SQL. The master plan lists this as a v2 job.
- **The strong-key rotation has not been run.** Any key issued before
  2026-08-15 is the old format: four characters from `Math.random()`, about
  20.7 bits, roughly 1.7 million candidates, behind a guessable prefix.
- **The throttle only guards the RPC.** RLS still accepts the `x-access-key`
  header directly, so a caller who skips the app and hits PostgREST is not rate
  limited. That is a deliberate, documented trade-off against 59.5-bit keys, not
  an oversight, but it is a trade-off.
- **Keys are stored in plaintext** in `clients.access_key`, because RLS has to
  compare the incoming header against them. Anyone with database read access
  sees every client's key.
- **One key per business, not per person.** There is no way to give the finance
  manager a key that the account manager does not have, and no way to revoke one
  person without changing everybody's.
- **Keys never expire.** There is no age, no last-used-by date and no automatic
  retirement.
- **There is no audit trail of what a client read.** Successful sign-ins are
  logged; page views and file downloads are not.

---

## Next actions — do these in order

- [ ] **Apply `202608150003_rotate_access_keys.sql`.** This is the largest open
      item and it is a security fix, not a tidy-up. Read the whole header first.
      It invalidates every existing key the moment it runs, so do it on a
      morning when you can send the replacements the same day, and run it
      **once** — re-running issues another new set and invalidates the ones you
      just distributed. The migration ends with a `SELECT` that prints the new
      keys for distribution. Follow `key-lifecycle.md` for how they go out.
- [ ] **Commit the portal schema.** Run `supabase db pull`, review the generated
      migration, and commit it. Until this is done the portal cannot be rebuilt
      from source, and `current_client_id()` is described in prose in this folder
      rather than defined in a file anyone can read.
- [ ] **Deal with `ACME-DEMO-2026`.** That key is committed to this repository in
      `scripts/e2e-live.mjs:21`, `scripts/mock-supabase.mjs:15` and
      `scripts/security-check.mjs:159`, and the live check expects it to sign in
      against the real project. Either delete the demo client from the live
      database and move the live checks to an environment variable, or accept
      that it is a published credential for a row that must never hold real
      data. Decide, then write the decision down.
- [ ] **Schedule `prune_portal_login_attempts()`.** The function exists and
      deletes attempts older than 30 days. Nothing calls it, so the attempt log
      grows without limit. Add a `pg_cron` job, or call it from the team space
      on load, or delete the function and say the log is kept forever.
- [ ] **Decide on the session-token upgrade, and record the decision either
      way.** The header on `202608150001_portal_rate_limiting.sql` names the
      fix: have `portal_login` issue a short-lived token and change the RLS
      policies to check that instead of the raw key. It closes the unthrottled
      direct-REST path. It is not obviously worth doing against 59.5-bit keys.
      An accepted risk written down is fine; an accepted risk nobody remembers
      accepting is not.
- [ ] **Give the team space a rotate action.** Today, rotating one client's key
      means editing the `access_key` field by hand in the client form and
      pressing Generate. That works, but there is no confirmation step, no
      record of the old fingerprint outside the rotation migration, and nothing
      stops a mistyped key being saved. One button on the client row would fix
      all three.
- [ ] **Handle stale keys in stored welcome packs.** The welcome pack embeds the
      client's key in plain text and is uploaded into their own `documents`
      bucket. After any rotation the stored pack shows a key that no longer
      works. Decide whether to regenerate it, delete it or add a note.
- [ ] **Update the two stale key placeholders.** `src/pages/Portal.jsx:153`
      shows `XXXX-XXXX-XXXX`, which is three groups when a real key has four.
      `src/lib/teamConfig.js:52` and the key field placeholder still show the
      retired `ACME-K7X2-2026` shape. Both are cosmetic and both teach the wrong
      format to whoever reads them next.

After those eight, this folder is closed until either the portal gains a
feature or the access model changes.

---

## What each file in this folder is for

| File | What it is for | Read it when |
|---|---|---|
| `README.md` | This file. Status, what done means, what to do next. | You are opening the folder cold. |
| `access-model.md` | How a request is authorised end to end: the header, `current_client_id()`, the RLS scope, the SELECT-only grant, the login RPC and its three throttle axes, storage and signed URLs. Includes the weaknesses and the fix for each. | You are changing anything that touches portal authorisation, or answering "how do you know a client cannot see another client's data?" |
| `key-lifecycle.md` | Issuing, distributing, rotating and revoking a key. The format and the entropy arithmetic behind it, the two generators, the distribution rules, the rotation runbook and what revocation actually does today. | You are creating a client, sending a key, rotating after an incident, or ending an engagement. |
| `client-instructions.md` | Written for the client, in plain language. What the portal is, how to sign in, what is in it, how to look after the key, and what to do if it goes astray. | You are onboarding a client, or someone has asked what to send them. |

---

## The rules that hold on this portal

1. **The key is the only credential.** There is no second factor and no password
   behind it. Every decision about how it is generated, sent, stored and
   retired follows from that one fact.
2. **The key is never persisted in the browser.** Not in `localStorage`, not in
   a cookie, not in a query string. Closing the tab signs the client out, and
   that is the intended behaviour rather than a rough edge.
3. **The raw key is never logged, anywhere.** Fingerprints and the non-secret
   prefix only.
4. **The portal never writes.** If a feature needs a client to change something,
   it does not belong in the portal as it stands. Reopen the access model first
   and decide deliberately.
5. **A correct key is never throttled.** Any future change to the rate limiter
   has to preserve this, or the limiter becomes a denial-of-service tool
   pointed at our own clients.
6. **Security decisions get written into `scripts/security-check.mjs`.** A
   decision that only exists in someone's memory gets quietly reversed. A
   decision that fails the build does not.
