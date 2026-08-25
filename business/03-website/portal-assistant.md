# The portal assistant

The assistant inside the client portal. It answers a client's questions about
their own account, and turns anything it cannot answer into a request the team
picks up.

It is **not** the assistant on the marketing site. They share a look and almost
nothing else — different data, different model, different provider, different
host. Confusing the two is how client data ends up somewhere it should not be,
so the differences are written down here.

|  | Public assistant | Portal assistant |
|---|---|---|
| Where | Cloudflare Worker, `/api/chat/public` | Supabase edge function, `portal-assistant` |
| Model | Groq free tier | Cloudflare Workers AI |
| Knows | One hand-written marketing file | One client's own record |
| Can write | Nothing | One `portal_requests` row, after a human presses a button |
| Who can use it | Anyone | Someone holding a valid access key |

## Why the providers differ

This request carries a client's name, their quotes and their meetings.
Cloudflare already processes that data because it serves the portal, so Workers
AI adds no sub-processor. Groq would add one, and the privacy notice would have
to name it. The public assistant carries no personal data at all, which is why
it can use whichever free tier has the most headroom.

## Why an edge function and not the Worker

The two functions it calls are `SECURITY DEFINER` and executable only by
`service_role`. Supabase injects that key into an edge function automatically.
Putting this in the Cloudflare Worker instead would mean storing a credential
that bypasses RLS across the whole database — the CRM, the lead register, every
client — in order to reach two functions. Here there is no new Supabase secret
at all.

## The two rules

**It sees one client and cannot fetch another.** The access key is the only
input that selects whose record loads, and it resolves inside
`portal_assistant_context()` in Postgres. There is no client id parameter
anywhere in the path, so there is nothing to pass the wrong value to.

Proved rather than asserted: with one client in the database the isolation test
passes vacuously, so it runs against two, in a transaction that rolls back.

**It never acts.** A reply carries a *proposed* request. The portal renders it
in full — kind, subject, body, quote reference — and the client presses a
button. Only then does a row exist. A confirm button over a summary the client
cannot read is not consent, which is why the proposal card shows the text
verbatim rather than a paraphrase.

## Rate limits

Two, doing different jobs:

- **Twenty requests an hour per client**, enforced in `portal_raise_request` in
  Postgres. This is the one that holds — a new isolate cannot reset it.
- **Ten messages a minute per IP**, in the edge function. Edge isolates are
  short-lived, so this only stops a naive loop. It protects the inference
  budget, not the database.

## Setup

Two Supabase secrets, both Cloudflare:

    supabase secrets set CF_ACCOUNT_ID=<your Cloudflare account id>
    supabase secrets set CF_AI_TOKEN=<an API token scoped to Workers AI>

Scope the token to **Workers AI** and nothing else. If it leaks, the damage is
someone running inference on the account — not access to the site, the DNS or
the Worker.

Without them the assistant answers with a sentence saying it is not set up and
pointing at `hello@nabl.agency`. It does not error, and the rest of the portal
is unaffected.

## What is not built yet

- **Clients cannot see the requests they raised.** The row exists and the team
  can read it, but `portal_requests` is revoked from `anon`, so the portal has
  no read path. A client raises something and never sees it again. This needs a
  third function, keyed the same way.
- **The team has nowhere to work them.** Nothing in the team space or the CRM
  lists open requests. Until that exists, someone has to look in the table.

Both are real gaps rather than nice-to-haves: a request nobody sees is worse
than no request at all, because the client believes it was received.

## The outage of 25 August

The assistant answered nothing between going live and 25 August. Every normal
message came back as `Internal Server Error`, `text/plain`, in about a second.
Auth worked, the context loaded, validation worked, and the write path wrote a
real row — only the inference path failed.

The cause, from the function logs:

```
TypeError: raw.trim is not a function
    at Object.handler (.../index.ts:262:23)
```

`think()` had this:

```ts
const text = data?.result?.response ?? ''
if (text) return text as string
```

Workers AI did not put a string in `result.response`, and `as string` is a
compile-time assertion that generates no runtime check whatever. So the file
type-checked clean with `deno check`, and then handed a non-string to
`raw.trim()` on the first real message. The throw was outside any try, so the
Supabase runtime answered with its own 500 page — `text/plain`, which the
portal parses as JSON and cannot read, and which it reported to the client as
a network failure that had not happened.

Two things were wrong and both are fixed:

1. **A cast was standing in for a check.** `textFrom()` now tests every
   candidate with `typeof` before trusting it, handles the OpenAI-compatible
   shape as well as the native one, and treats "no text" as a reason to try the
   next model rather than as a crash. `think()` is declared `Promise<string>`
   so the signature obliges what the callers already assumed. When something
   unexpected does arrive, its *shape* is logged — never its content, which is
   derived from a client's record.

2. **The deployed copy was not the repo file.** It had been hand-condensed at
   first deploy and was missing the outer handler wrapper and the upstream
   timeouts that the repo file already had. Redeploying from source was half
   the fix; without it a crash is invisible, and with it the same crash returns
   JSON and a stack in the logs. Deploy from `supabase/functions/portal-assistant/index.ts`
   and nothing else.

The lesson worth keeping: this file type-checked, passed 18 component tests
against a stubbed endpoint, and was still completely broken in production. The
stub returned a string because the person writing the stub assumed one. Nothing
tested the one thing that was untrue.

## Tests

`npm run test:portal-assistant` — 18 checks against a stubbed endpoint. The one
the design exists for is that no request is raised until the button is pressed;
it is mutation-tested by making the component raise automatically and watching
four assertions fail.
