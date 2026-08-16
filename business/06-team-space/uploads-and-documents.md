# Uploads, storage and signed URLs

Everything the team space stores as a file, where it goes, who can read it, and
what happens when a step fails.

---

## The model in one paragraph

Two Supabase storage buckets, `quotes` and `documents`, both private. Nothing in
either bucket is reachable by URL. When a team member or a client presses a View
button, the application asks Supabase for a signed URL there and then, opens it,
and forgets it. The signature expires after an hour. No signed URL is ever
written to the database, into a document, or into the page's markup.

---

## The two buckets

| Bucket | Written from | Accepts | Ceiling | Read by |
|---|---|---|---|---|
| `quotes` | The Quote PDF field on the quotes tab | PDF only | 10MB | Team space, and the client in their portal |
| `documents` | The File field on the documents tab, and "Save to portal" in the welcome-pack composer | Any file type | 25MB | Team space, and the client in their portal |

Both are private. Both are served exclusively through signed URLs.

**The limits are enforced in the browser only.** The PDF check and both size
ceilings live in the upload component in `src/pages/Team.jsx`. There is no bucket
policy behind them, so anyone signed in with a developer console can bypass
both. Fixing that is on the README's next-actions list: set a file size limit and
an allowed MIME type list on each bucket in the Supabase dashboard, matching the
browser rules.

The PDF check accepts a file whose MIME type is `application/pdf` **or** whose
name ends in `.pdf`. A file renamed to `.pdf` passes.

---

## Where files land

Every object goes to the same shape of path:

```
[client_id]/[unix-timestamp-in-ms]-[sanitised original filename]
```

For example: `3f2a…-8c1/1755300000000-quote_acme_march.pdf`

Three properties fall out of that, and all three are the reason it is shaped
this way:

- **Grouped by client.** Everything belonging to one business sits under one
  prefix, which makes both auditing and eventual deletion tractable.
- **Never collides.** The millisecond timestamp means two uploads of
  `invoice.pdf` are two different objects. Uploads run with `upsert: false`, so
  an accidental overwrite is refused rather than performed silently.
- **Sanitised.** Every character outside `A-Z a-z 0-9 . _ -` is replaced with an
  underscore, so spaces, quotes, slashes and anything else awkward cannot alter
  the path.

The interface hides the timestamp when it shows you a filename, so
`1755300000000-quote_acme_march.pdf` displays as `quote_acme_march.pdf`.

One edge to know about: if a file is somehow uploaded without a client id, the
path falls back to `unknown/`. Every form with a file field makes the client a
required field, so this should not happen. If you ever see an `unknown/` prefix
in the bucket, something wrote around the form.

---

## Signed URLs

A signed URL is minted on demand, expires in one hour, and is never stored.

Pressing View calls Supabase for a fresh signature and opens the result in a new
tab. Nothing is prepared in advance, so there is no signed URL sitting in the
page source waiting to be scraped. The end-to-end suite asserts this directly:
`scripts/e2e-ui.mjs:69` fails if any anchor in the rendered page carries a
`token=` parameter.

Consequences worth holding on to:

- **Do not paste a signed URL anywhere.** Not into an email, a document, a
  message or a database field. It works for an hour for whoever holds it, and
  then it stops working and looks broken. Send people to the portal instead.
- **A link that worked this morning will not work this afternoon.** That is
  correct behaviour, not a fault.
- **"Unable to load" on a View button** means the signature could not be minted.
  Either the object is not at the path the row records, or the bucket name is
  wrong, or the session has gone. Check the row's stored path first.

There is one piece of legacy tolerance in the code: if a stored path is already a
full `http` or `https` URL, it is handed back unchanged rather than being signed.
That exists for old rows that hold a pasted link instead of a storage path. Do
not create new rows that way.

---

## What happens on save

The order matters, and it is deliberate.

**Creating a row with a file:**

1. The file uploads to the bucket.
2. The row is written, with the storage path in the file column.
3. If the row write fails, the file that was just uploaded is deleted.

So a failed save leaves nothing behind. There is no orphaned object and no row
pointing at a file that is not there.

**Replacing a file on an existing row:**

1. The new file uploads under a new path.
2. The row is updated to point at the new path.
3. Only after that succeeds is the old object deleted.

So a failed replace leaves the old file in place and the row still pointing at
it. The client never sees a broken link mid-operation.

**Deleting a row:**

1. The row is deleted.
2. The file it pointed at is removed, best effort.

"Best effort" is literal. If the storage removal fails, the failure is swallowed
and the object stays in the bucket. The row is gone either way, so the file is
now unreachable through the application and still occupying space.

**What is not handled:** the team space only removes the file belonging to the
row you deleted. If deleting a client cascades in the database to their quotes
and documents, every file those rows pointed at is orphaned, because no
JavaScript ran for them. Whether that cascade exists cannot be answered from this
repository, because the schema is not in version control. Answering it, and
recording the answer here, is on the README's next-actions list.

---

## The welcome pack, as a stored document

"Save to portal" in the welcome-pack composer follows exactly the same rules as
any other upload, and it is worth spelling out because it is the one upload the
application performs on your behalf rather than from a file you picked.

1. The generated document is turned into a file named `welcome-pack.html` with
   the type `text/html`.
2. It uploads to the `documents` bucket at the standard path,
   `[client_id]/[timestamp]-welcome-pack.html`.
3. A row is inserted into `documents` with the title **"Welcome pack"**, the type
   `other`, and `uploaded_at` set to now.
4. If the row insert fails, the uploaded file is deleted and you get an error.

The client sees it under Documents in their portal the next time they sign in.

**It is saved as HTML, not PDF.** The document is entirely self-contained, with
no external stylesheet, font or image, so it renders correctly from a disk or an
email attachment years later. It also carries its own print styles, so printing
it produces dark text on cream rather than a page of the dark theme. If a client
needs a PDF, use the Print / PDF button in the composer and send it yourself. The
one saved to the portal stays HTML.

---

## Things that are true and easy to forget

1. **There is no draft state.** Anything on the documents tab is visible to the
   client from the moment it saves. If it is not ready for them, do not upload it.
2. **There is no version history.** Replacing a file destroys the previous one
   after the save succeeds. If you need the old version, download it first.
3. **There is no backup.** Supabase is on the free tier, so there is no
   point-in-time recovery for either the rows or the objects. Master plan section
   8 puts paid Supabase second in the queue for the first earnings, and it
   becomes urgent at the second paying client.
4. **`uploaded_at` is set once.** Editing a document row afterwards does not move
   it, so an edited document keeps its place in the list.
5. **Nothing is scanned.** Files are not checked for malware on the way in or the
   way out. Anything uploaded here is trusted because a signed-in team member
   uploaded it.
6. **Every authenticated team account can read every file.** RLS grants
   `authenticated` full access, and there is no per-user scoping and no record of
   who uploaded what.
