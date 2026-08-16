# Access-key lifecycle

Issuing, distributing, rotating and revoking a client access key.

The key is the only credential guarding a client's quotes, projects, meetings
and documents. There is no password behind it and no second factor. Everything
on this page follows from that.

Last substantive revision: 2026-08-15.

---

## 1. The format

```
NABL-7K3M-QP24-XW9B
└─┬─┘ └──────┬──────┘
prefix    12 random characters
```

| Part | Rule |
|---|---|
| Prefix | First word of the business name, uppercased, non-alphanumerics stripped, truncated to 6 characters. `NABL` if that leaves nothing. |
| Random part | 12 characters drawn from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` |
| Separator | A hyphen every four characters |

**The prefix is not secret and is not counted as security.** It exists so a
human can glance at a key and know whose it is. It is also what makes the
per-prefix throttle work, since every guess against one client necessarily
carries it.

### The alphabet

31 glyphs. `O`, `0`, `I`, `1` and `L` are all absent, because a key gets read
aloud on the phone, copied off a screen and retyped from a printout. An
ambiguous glyph turns a support call into a guessing game, and the entropy cost
of dropping five characters is trivial next to that.

### The entropy, with the arithmetic

```
31 possible characters, 12 positions
31 ^ 12  =  about 790,000,000,000,000,000 candidates
log2(31 ^ 12)  =  59.45 bits
```

That is the figure quoted everywhere as 59.5 bits.
`scripts/security-check.mjs` recomputes it from the source constants on every
run and fails below 55 bits, so shortening the key or trimming the alphabet
cannot happen quietly.

Put against the throttle: the per-prefix axis permits 25 wrong guesses every 15
minutes, which is 100 an hour, or about 876,000 a year, against 790 million
billion candidates. The key is out of reach of brute force even with no rate
limiting at all. The limiter is the second layer, not the first.

### What it replaced, and why the old ones are not safe

Keys issued before 2026-08-15 look like `ACME-K7X2-2026`: four characters from a
36-glyph alphabet, behind a guessable prefix and a hardcoded year.

```
36 ^ 4  =  1,679,616 candidates  =  20.7 bits
```

Roughly 1.7 million candidates, which an unthrottled attacker exhausts in hours.
Worse, they came from `Math.random()`. V8's `xorshift128+` state can be
recovered from a handful of outputs, so seeing a few issued keys can be enough
to predict the next ones.

**Every key in the old format should be treated as compromised**, and the only
remedy is reissue. See section 4.

---

## 2. Issuing

There are two generators. They produce identical output and exist for different
moments.

### In the team space — the normal path

`src/lib/teamConfig.js`, `generateKey(businessName)`. Add a client, type the
business name, press **Generate** next to the access-key field. The key appears
in the field and is saved with the row.

Source of randomness: `crypto.getRandomValues`, never `Math.random()`.
`scripts/security-check.mjs` fails the build if that changes.

### In the database — bulk work only

`public.gen_access_key_suffix(p_len int default 12)`, created by
`202608150003_rotate_access_keys.sql`. Uses `gen_random_bytes`, the database's
CSPRNG. Used by the rotation, and available for any future migration that has to
mint keys for rows rather than one at a time in a form.

### Both reject rather than fold

256 is not a multiple of 31, so a plain `byte % 31` would make the first eight
glyphs very slightly likelier than the rest. Both generators discard bytes at or
above 248, the largest usable multiple, and redraw. Every glyph stays equally
likely and every key keeps its full 59.45 bits.

This is the kind of detail that looks like pedantry and is not: modulo bias
quietly shaves entropy off every credential issued, and nothing ever surfaces an
error to tell you.

### Checklist for issuing a key

- [ ] Create the client in the team space with the correct business name. The
      prefix comes from it and is awkward to change afterwards.
- [ ] Press **Generate**. Never type a key by hand and never adapt an old one.
- [ ] Save the row, then confirm the key on the client row matches what you are
      about to send.
- [ ] Send it by the route in section 3.

---

## 3. Distributing

### The welcome pack is the normal route

`09-welcome-pack` generates a self-contained HTML document that carries the key
in a highlighted box, the portal URL, and the wording about treating it like a
password. It is generated from the client row in the team space, so the key in
it is the key on the record. That removes the commonest distribution error,
which is copying a key wrong.

Pressing **Welcome pack** on a client row can also save the pack straight into
that client's `documents` bucket, where it appears in their portal.

Two things follow from that, and both are worth knowing:

1. It is circular. They need the key to open the document that contains the key.
   That is fine as a durable copy, and useless as a delivery mechanism.
2. **It goes stale on rotation.** A stored pack still shows the retired key
   after a rotation, with no warning. Handling that is an open action in the
   README.

### The rules for sending one

- **Send it to a named person at the client**, at an address on the client
  record, not to `info@` or a shared inbox that a whole office reads.
- **Send the key and the portal address together**, so nobody has to search for
  where to use it.
- **Say what it is** in the same message: this is the only thing protecting your
  account, treat it like a password.
- **Never put a key in a public channel**, a shared document, a ticket, a
  screenshot, a calendar invite, or a chat group with people outside the
  business in it.
- **Never post a key into this repository or any other.** One demo key already
  sits in three files here. That is a known problem, listed in the README, and
  not a precedent.
- If a key has to be read over the phone, the alphabet is designed for it. There
  is no `O`, `0`, `I`, `1` or `L` to disambiguate.

Email is not a secure channel. It is used anyway, because it is the channel the
client already has and a portal nobody signs into protects nothing. The
mitigations are that the key is single-purpose, read-only, revocable in
seconds, and points at commercial documents rather than money or identity. If a
particular engagement holds something more sensitive than that, agree a
different route before the pack is generated.

---

## 4. Rotating

Rotation means replacing a key with a fresh one. The old key stops working the
instant the row is updated, because RLS compares the header against the current
stored value on every request. There is no cache and no grace period.

### When to rotate

- **Immediately**, if a key has been posted somewhere public, sent to the wrong
  recipient, seen on a shared screen, or the client says they think it has got
  out.
- **When someone leaves the client's business** who had the key. This is the
  blunt part of one-key-per-business: everyone gets a new key, because there is
  no way to remove one person.
- **Once, for everyone**, to get off the old weak format. That is the pending
  migration below.
- Not on a schedule. There is no expiry today, and inventing a routine rotation
  without a mechanism to enforce it just produces a task nobody does.

### Rotating one client

1. Open the client in the team space and press **Edit**.
2. Press **Generate** next to the access key. Save.
3. Send the new key by the route in section 3.
4. Tell them the old one has stopped working, so a failed sign-in does not turn
   into a support call.
5. If a welcome pack is stored in their documents, regenerate it or remove it.

There is no confirmation step and no undo. Once saved, the previous key is gone
from the record and cannot be recovered. If you save a key you have not
recorded anywhere, the client is locked out until you generate another and send
that instead.

### Rotating everyone — the pending migration

`supabase/migrations/202608150003_rotate_access_keys.sql`.
**Written, reviewed, and not yet applied.** Read its header in full before
running it.

What it does:

- Creates `access_key_rotations` and records a truncated SHA-256 fingerprint of
  each old key against the client id, so a client ringing up about a key that
  "stopped working" can be matched against the one they still have. Fingerprints
  only — the retired secret is not worth keeping in plaintext.
- Creates `gen_access_key_suffix()`, the database-side generator.
- Issues a new key for every client, in the current format, with the prefix
  truncated to six characters so a key minted by the migration and one minted in
  the team space look the same.
- Ends with a `SELECT` of business name, contact name, contact email and the new
  key, for distribution.

The operational reality:

- **It locks every client out the moment it runs.** Anyone who has bookmarked or
  saved a key cannot sign in until they have the new one.
- **Run it once.** It is safe to re-run in the sense that it will not error, and
  destructive in the sense that re-running issues *another* new key for
  everybody and invalidates the set you have just sent out.
- Run it on a morning when you can distribute the same day. Not last thing on a
  Friday.

Runbook:

- [ ] Take a database backup first.
- [ ] Confirm you can send to every client on the list today.
- [ ] Run the migration in the SQL editor, once.
- [ ] Capture the final `SELECT` output somewhere it will not be committed.
- [ ] Send each client their new key with a short note saying the old one has
      been retired for security and no action is needed beyond using the new one.
- [ ] Regenerate or remove any stored welcome packs.
- [ ] Run `node scripts/e2e-live.mjs` with `PORTAL_KEY` set to a new key, and
      confirm sign-in and all four tables.

---

## 5. Revoking

Revocation is not a separate mechanism. There are two ways to end access, and
both are immediate.

| What you want | What you do | What happens |
|---|---|---|
| End this key, keep the client | Rotate it, and do not send the new one | The old key returns zero rows on the next request |
| End all access | Delete the client row in the team space | Every request with that key resolves to `NULL` and matches nothing |

Deleting the client row is destructive and cascades. Do not use it as a way of
suspending access. If an engagement is winding down and access should stop
without the record going with it, rotate and hold the new key.

What revocation does **not** do:

- It does not invalidate signed URLs that have already been minted. Those live
  for an hour from the moment they were created. If a key has leaked and files
  are the concern, an hour is the worst-case window.
- It does not remove the key from anywhere the client already put it — their
  notes, their inbox, a stored welcome pack. Rotation makes the key useless; it
  does not make copies of it disappear.
- It does not tell you whether the key was used before you rotated. Successful
  sign-ins are in `portal_login_attempts`, by fingerprint and prefix, for as
  long as the log is retained. That will tell you *that* someone signed in and
  from which address. It will not tell you what they looked at.

### After a suspected leak

- [ ] Rotate immediately. Do not wait for confirmation that it was used.
- [ ] Query `portal_login_attempts` for that prefix and look at the source
      addresses and timings against what the client can account for.
- [ ] Check whether any document in that client's buckets should not have been
      readable by whoever may have had the key.
- [ ] Tell the client what happened, plainly, and what you did about it. The
      whole leak window is bounded by "how long until we rotated", and that is
      a good number to be able to say out loud.
- [ ] Record it. There is no incident log in this repository yet; write it in
      the client's record until there is one.

---

## 6. Where a key exists, and for how long

Worth having in one list, because "rotate the key" only helps if you know where
copies of it are.

| Location | Form | Removed by |
|---|---|---|
| `clients.access_key` | Plaintext | Rotation or deletion |
| `access_key_rotations.old_key_fp` | Truncated SHA-256, not reversible | Nothing. Kept deliberately. |
| `portal_login_attempts.key_fp` | Truncated SHA-256, not reversible | `prune_portal_login_attempts()` after 30 days — **not currently scheduled** |
| Team space screen | Plaintext, on the client row | Rotation |
| Welcome pack HTML in the `documents` bucket | Plaintext, inside the file | Deleting or regenerating the document. **Rotation does not update it.** |
| The client's inbox, notes, wherever they saved it | Plaintext | Nothing you control |
| The client's browser | React state only, for the life of the tab | Closing the tab |

Nothing on that list is a surprise, and none of it should be softened when a
client asks where their key is kept.
