# The portal access model

How a client's request is authorised, from the browser to the row.

This describes what is running today. Where something is a known weakness it is
labelled as one, with the fix that would close it.

Last substantive revision: 2026-08-15.

---

## 1. The shape of it

One Supabase project serves two completely separate ways of getting in.

| Path | Who | Credential | Session | Rights |
|---|---|---|---|---|
| **Team** | n.abl staff | Supabase Auth, email and password | Persisted, auto-refreshed | Full CRUD on the portal tables and the CRM |
| **Client portal** | A client | An access key | None. Memory only. | SELECT, scoped to their own rows |

The two must never share state, and in the code they do not.
`src/lib/supabase.js` builds them as separate clients:

```js
// Team: a singleton with a persisted session.
createClient(URL, ANON, { auth: { persistSession: true, storageKey: 'nabl-team-auth' } })

// Portal: a fresh client per key, nothing persisted.
createClient(URL, ANON, {
  global: { headers: { 'x-access-key': accessKey } },
  auth:   { persistSession: false, autoRefreshToken: false },
})
```

**There is no Supabase user per client.** No `auth.users` row, no email
confirmation, no password reset, no invitation. This is the central design
decision and everything else follows from it.

### Why no user per client

Three reasons, in order of weight.

1. **It removes the whole password surface.** No reset flow to phish, no
   password reuse from another breach, no confirmation email that lands in
   spam, no "I never got the invite" on day one of an engagement.
2. **A client should not have to make an account to read their own quote.** The
   portal is worth using because it is less friction than an email thread. A
   sign-up form is more friction than an email thread.
3. **It matches the actual trust boundary.** The unit that owns the data is the
   business, not a named individual. One business, one credential.

The cost is stated honestly in the README and again in section 7 below: no
per-person access, no per-person revocation, and the key is as strong as the
care taken with it.

---

## 2. A request, end to end

```
  Browser
    │  every request carries:
    │    apikey:        the public anon key   (identifies the project, not the caller)
    │    Authorization: Bearer <anon key>     (role = anon)
    │    x-access-key:  NABL-7K3M-QP24-XW9B   (identifies the client)
    ▼
  PostgREST
    │  request.headers is exposed to SQL as a setting
    ▼
  RLS policy on quotes / projects / meetings / documents / clients
    │    using ( client_id = current_client_id() )
    ▼
  current_client_id()
    │    reads x-access-key out of request.headers
    │    looks it up in clients.access_key
    │    returns that client's id, or NULL
    ▼
  Rows for exactly one client, or none at all
```

The important property is that **the scoping is not in the query**. The portal
sends `select('*')` with no `where` clause on `client_id`; the database adds the
restriction. A bug in the front end cannot widen the result set, because the
front end was never the thing narrowing it.

`current_client_id()` returns `NULL` when the header is absent, malformed or
unrecognised. `client_id = NULL` is never true in SQL, so the policy simply
matches nothing. There is no error, no distinguishing response and no oracle: a
wrong key and no key produce the same empty array, which is confirmed by
`scripts/e2e-live.mjs` on every run against the live project.

> **Not in version control.** `current_client_id()` and the five policies exist
> only in the hosted project. They are described here from the behaviour the
> tests assert and the code that calls them. Committing them with
> `supabase db pull` is the second action in the README, and until it happens
> this section is documentation rather than source.

---

## 3. `anon` is SELECT-only

The role the portal uses is `anon` — the same public, RLS-guarded role the
marketing site uses. It is safe in the bundle, and it is checked into this
repository on purpose.

On the five portal tables, `anon` has read and nothing else. The portal issues
exactly four table reads and one RPC, and never an insert, update or delete:

| What the portal reads | How |
|---|---|
| `clients` | Through the `portal_login` RPC on sign-in. Also readable directly with the header. |
| `quotes` | `select('*').order('created_at', { ascending: false })` |
| `projects` | `select('*')` with **no** ordering — `projects` has no `created_at`, and asking for one errors the whole request and renders the tab empty |
| `meetings` | `select('*').order('datetime')` |
| `documents` | `select('*').order('uploaded_at', { ascending: false })` |

Each of the four is wrapped so it degrades to an empty list independently. One
failing table does not blank the dashboard.

The consequence is worth being clear about with clients: **the portal is a
window, not a workspace.** A client cannot accept a quote in it, upload a file,
tick off a milestone or leave a note. Everything they see was written by the
team space. If that ever needs to change, the access model has to be reopened
first — a write path guarded by nothing but a shared key is a different risk
from a read path guarded by the same key.

---

## 4. Sign-in goes through an RPC, not a select

The portal could sign in by selecting from `clients` with the header set. It
deliberately does not. `src/pages/Portal.jsx` calls:

```js
const { data: rows, error } = await sb.rpc('portal_login', { p_key: k })
```

`portal_login` is a `security definer` function, granted to `anon` and
`authenticated`, with `search_path` pinned to `public, extensions`. It returns
the client's `id`, `business_name`, `contact_name`, `contact_email` and
`created_at`, or no rows at all.

Routing sign-in through a function is what makes throttling possible. A plain
`select` through PostgREST has nowhere to count from.

`scripts/security-check.mjs` asserts that the portal still uses the RPC, and
fails if someone replaces it with a direct table select.

### The three throttle axes

`portal_login` v2 counts **misses only**, over a rolling 15 minutes, on three
axes, and blocks on whichever trips first:

| Axis | Limit per 15 min | What it stops |
|---|---|---|
| Source IP | 10 | The casual single-host attempt |
| Key prefix | 25 | A distributed attack on **one** client |
| Global | 300 | A broad sweep across many clients |

The prefix axis is the one that matters, and it exists because v1 failed a live
test. v1 counted per IP alone. Twelve guesses left the test machine over two
egress addresses, six each, and neither reached the limit of ten. Anyone with a
proxy pool gets that for free, so per-IP counting on its own is close to
worthless.

The prefix is not secret — it is the first word of the business name, kept so a
human can recognise whose key it is. Every guess against one client therefore
carries the same prefix, and IP rotation cannot dodge that axis.

Verified after deployment: 30 guesses at one prefix over rotating addresses were
blocked after 9, while the legitimate key for that same prefix still signed in
normally. `scripts/security-check.mjs` re-runs both halves of that test against
the live project when `LIVE=1` is set.

### The correct key is checked first, and never throttled

This ordering is the whole reason the lockout is safe:

```
1. Look the key up.
2. If it matches  → log a success, return the row, return. No limit check at all.
3. If it misses   → log the miss, then count, then block if any axis has tripped.
```

The classic own-goal in lockout schemes is that an attacker spends a victim's
allowance to deny them their own account. Here the allowance is only ever spent
by wrong keys, which is exactly what brute force produces and exactly what a
legitimate client does not. **Any future change to the limiter must preserve
this ordering.**

### What the attempt log records

`portal_login_attempts` holds one row per attempt:

| Column | Value |
|---|---|
| `ip` | First entry of `x-forwarded-for`, falling back to `cf-connecting-ip`, then `'unknown'` |
| `key_fp` | `sha256(key)` truncated to 16 hex characters — **never the raw key** |
| `ok` | Whether it matched |
| `key_prefix` | The non-secret prefix, for the second throttle axis |
| `at` | Timestamp |

RLS is on and there is deliberately no `anon` policy, so the log is invisible to
the public. `authenticated` can read it. `scripts/security-check.mjs` asserts
that `anon` gets zero rows from it.

The fingerprint is enough to answer "is this the same wrong key being tried over
and over?" and to match a confused client against a key that stopped working,
without the log itself becoming a list of live credentials.

`prune_portal_login_attempts()` deletes rows older than 30 days. **Nothing calls
it today**, so the log grows without limit. See the README's next actions.

---

## 5. Files and signed URLs

The `quotes` and `documents` buckets are private. No object is publicly
readable, and no file URL is ever stored in the database — the `pdf_url` and
`file_url` columns hold storage **paths**, in the shape
`[client_id]/[timestamp]-[sanitised original name]`.

A link is minted at the moment the client clicks it:

```js
const url = await signedUrl(client, bucket, path)   // expiresIn = 3600
if (url) window.open(url, '_blank', 'noopener')
```

The signed URL lives for one hour and is never cached or persisted. If a client
sends someone the link they copied out of the address bar, it stops working the
same afternoon.

One legacy allowance: `signedUrl()` passes a value straight through if it
already starts with `http://` or `https://`, because some early rows hold a
pasted URL rather than a path. Those rows are not protected by the bucket.
There is no inventory of how many exist.

---

## 6. The key never touches disk

The access key lives in React state, for as long as the tab is open, and
nowhere else.

- Not `localStorage`, not `sessionStorage`, not a cookie.
- Not in the URL, so it cannot leak through a `Referer` header, a browser
  history sync or a screenshot of the address bar.
- Not in any log the application writes.

Refreshing the page signs the client out. Closing the tab signs them out. The
"Log out" button clears the client, the row, the data and the key from state.
That is a small friction, and it is the intended trade: nothing persisted means
nothing to steal from a shared machine.

`scripts/security-check.mjs` strips comments from `src/pages/Portal.jsx` and
then fails if `localStorage`, `sessionStorage` or `document.cookie` appears
anywhere in it.

---

## 7. What this model does not do

Stated plainly, because each one is a question a client or a reviewer will
eventually ask.

| Gap | Consequence | The fix, if it is ever worth it |
|---|---|---|
| RLS accepts the raw header directly | A caller who skips the app and hits PostgREST is **not** throttled. Only the login RPC is. | Have `portal_login` issue a short-lived session token and change the five policies to check the token instead of the key. Named in the header of `202608150001`. |
| Keys are stored in plaintext | Anyone with database read access sees every client's key. Required, because RLS compares the header against the stored value. | Store a hash and compare the digest. Costs a lookup index and rules out the current "read the key off the client row" workflow in the team space. |
| One key per business | No per-person access and no per-person revocation. Removing one leaver means reissuing for everyone. | Multiple keys per client, in their own table, each with a label and a revoked-at date. |
| Keys never expire | A key issued for a three-week job still works three years later. | An `expires_at` column checked in `current_client_id()`, plus a rotation prompt in the team space. |
| No read audit | Successful sign-ins are logged. Which quote was opened, or which document downloaded, is not. | Log storage signings against the client id. Decide first whether it is worth the retention obligation. |
| No second factor | The key is the whole of the credential. | Out of proportion for four-figure implementation work, and it reintroduces the account overhead the model exists to avoid. Recorded here as a considered no, not an oversight. |
| The schema is not committed | The portal cannot be rebuilt from source. | `supabase db pull`. README action two. |

None of these are secret, and none of them should be softened when a client
asks. The honest summary is: this is a strong shared credential, guarded well,
protecting commercial documents rather than payment details or health records.
It is proportionate to what it holds. If the portal ever holds something else,
this page is where the argument has to be reopened.
