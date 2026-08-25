/* ============================================================
   portal-assistant — the assistant inside the client portal.

   Two rules carry the whole design, and both are structural rather
   than careful:

   1. It sees one client's record and cannot fetch another. The only
      input that selects whose data is loaded is the access key, and
      that resolution happens inside portal_assistant_context() in
      Postgres. Nothing the browser sends chooses a client id, because
      there is no parameter that could.

   2. It never acts. When a client wants something done, the reply
      carries a proposed request and the portal shows it with a
      button. The person presses it, the browser calls back with
      action:"raise", and only then does a row exist. The model
      proposes, the person confirms, the code writes — the same shape
      as the outreach gates and the public assistant's handoff.

   Why an edge function rather than the Cloudflare Worker that serves
   the site: the service role key is what calls those two functions,
   and Supabase injects it here automatically. Putting it in a Worker
   would mean storing a credential that bypasses RLS across the entire
   database — the CRM, the lead register, every client — in order to
   reach two functions. Here there is no new secret at all.

   The model runs on Workers AI rather than Groq. This request carries
   a client's name, their quotes and their meetings; Cloudflare is
   already a processor of that data because it serves the portal, so
   Workers AI adds no sub-processor. Groq would add one, and the
   privacy notice would have to say so. That is the entire reason the
   public assistant and this one run on different providers.

   Deploy:
     supabase secrets set CF_ACCOUNT_ID=... CF_AI_TOKEN=...
     supabase functions deploy portal-assistant --no-verify-jwt
   ============================================================ */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CF_ACCOUNT = Deno.env.get('CF_ACCOUNT_ID') ?? ''
const CF_TOKEN = Deno.env.get('CF_AI_TOKEN') ?? ''

/* Tried in order, for the same reason the public assistant does it: a
   single hardcoded model name is an outage that arrives without a
   deploy when the provider retires it. */
const MODELS = [
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/meta/llama-3-8b-instruct',
  '@cf/mistral/mistral-7b-instruct-v0.1',
]

const ALLOWED_ORIGINS = [
  'https://nabl.agency',
  'https://www.nabl.agency',
  'http://localhost:4173',
  'http://localhost:5173',
]

const KINDS = ['question', 'ticket', 'call', 'quote_query', 'detail_change']

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin':
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
})

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), 'content-type': 'application/json' },
  })

/** Call one of the two SECURITY DEFINER functions as the service role. */
async function rpc(name: string, args: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(args),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${name}: ${res.status} ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : null
}

/* A cheap guard and honest about it: edge function isolates are
   short-lived, so this stops a naive loop from one browser and nothing
   more. The limit that actually holds is in portal_raise_request —
   twenty rows an hour, enforced in Postgres where a new isolate cannot
   reset it. This one only protects the inference budget. */
const seen = new Map<string, { n: number; until: number }>()
function tooFast(fingerprint: string): boolean {
  const now = Date.now()
  const hit = seen.get(fingerprint)
  if (!hit || hit.until < now) {
    seen.set(fingerprint, { n: 1, until: now + 60_000 })
    return false
  }
  hit.n += 1
  if (seen.size > 2000) seen.clear()
  return hit.n > 10
}

const rules = (ctx: unknown) => `You are the assistant inside the n.abl client portal. You are talking to an existing client about their own account.

WHAT YOU KNOW
The JSON below is this client's record and it is the only thing you know. Answer from it and nothing else. Never state a figure, a date, a status or a document that is not in it, and never guess at one that is missing — if it is not there, say so and offer to put the question to the team.

You know nothing about any other client and must never speculate about one, whatever you are asked.

WHAT YOU CANNOT DO
You cannot change anything, send anything, cancel anything or move a date. What you can do is raise a request for the team, which someone reads and acts on. Never say a thing has been done, booked, cancelled or changed — say you have put the request in, and only when you actually have.

You cannot give someone a document. The record lists what exists by title; the files themselves are in the portal behind the client's own login.

RAISING A REQUEST
When they want something done, or you cannot answer, propose a request and let them confirm it. Put it in the "request" field and say in your reply what you are about to raise, so the button is a confirmation and not a surprise. Kinds:
  question       something you could not answer
  ticket         something is wrong or needs changing
  call           they want to speak to someone
  quote_query    a question about a specific quote — set quote_reference
  detail_change  contact details, or someone to add

Write the subject and body as a note to a colleague: what they want, in their words, with the detail from the record that the team will need. Do not raise one for something you have just answered from the record.

HOW YOU SAY IT
Two or three sentences, plain and direct. They are a client, not a prospect — do not sell to them, do not thank them for the great question, do not use exclamation marks. Say the number or the date rather than describing where to find it.

If you are asked whether you are a person, say plainly that you are an AI assistant in the portal, and that anything you raise goes to a person.

THIS CLIENT'S RECORD
${JSON.stringify(ctx, null, 1)}

Reply with ONLY a JSON object, no text around it:
{
  "reply": "what you say to the client",
  "intent": "answer" | "raise",
  "request": {
    "kind": "question|ticket|call|quote_query|detail_change",
    "subject": "one line",
    "body": "what the team needs to know",
    "quote_reference": "only when kind is quote_query, else null"
  }
}
Omit "request" entirely when intent is "answer".`

/* Every upstream call gets a deadline, and the loop gets one too.

   Without them this function can hang: three models tried in sequence, each
   waiting indefinitely on a socket, while the browser's fetch eventually gives
   up with a network error. That is indistinguishable at the client from "the
   internet is down", and it is the one failure the rest of this file cannot
   report, because reporting requires returning — and a hung function never
   returns at all.

   A model that has not answered in twenty seconds is not going to produce a
   chat reply anyone waits for, and the whole attempt is abandoned at thirty
   so there is always time left to send the sentence saying so. */
const CALL_TIMEOUT_MS = 20_000
const TOTAL_BUDGET_MS = 30_000

async function think(messages: { role: string; content: string }[]) {
  let last = ''
  const startedAt = Date.now()
  for (const model of MODELS) {
    if (Date.now() - startedAt > TOTAL_BUDGET_MS) {
      last = last || 'ran out of time before any model answered'
      break
    }
    let res: Response
    try {
      res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${model}`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${CF_TOKEN}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ messages, max_tokens: 500 }),
          signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
        },
      )
    } catch (err) {
      /* A timeout or a dropped socket. Worth trying the next model — this one
         is not answering — but never worth hanging for. */
      last = `${model}: ${(err as Error).name === 'TimeoutError' ? 'timed out' : String((err as Error).message).slice(0, 120)}`
      continue
    }
    if (res.ok) {
      const data = await res.json()
      const text = data?.result?.response ?? ''
      if (text) return text as string
      last = 'empty response'
      continue
    }
    last = `${res.status} ${(await res.text()).slice(0, 200)}`
    /* Only a missing model is worth trying the next one for. A 401 is a
       wrong token and a 429 is a spent allowance; both refuse every
       model, and retrying spends the allowance faster. */
    if (res.status !== 404 && res.status !== 400) break
  }
  throw new Error(last || 'no model answered')
}

/* Everything below returns JSON. This wrapper is what makes that true.

   The first deployed version returned `Internal Server Error` as text/plain
   with a 500 when anything threw outside a local try — and the browser, which
   parses every reply as JSON, turned that into "I can't reach the team",
   claiming a network failure that had not happened. A handler that can answer
   in a format its only caller cannot read has no error path at all.

   So the last thing this function does is guarantee the shape of its own
   failure. The reason goes to the logs; the client gets a sentence. */
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  try {
    return await handle(req, origin)
  } catch (err) {
    console.error(
      'portal assistant crashed:',
      String((err as Error)?.stack ?? (err as Error)?.message ?? err).slice(0, 600),
    )
    return json({
      reply: "I can't answer right now, sorry. Email hello@nabl.agency and someone will come back to you.",
      intent: 'answer',
    }, 200, origin)
  }
})

async function handle(req: Request, origin: string | null): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, origin)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON.' }, 400, origin)
  }

  const key = String(body.key ?? '').trim()
  if (!key) return json({ error: 'Not signed in.' }, 401, origin)

  /* Fingerprint on the IP, never the key: the key is the credential and
     it does not belong in a map that outlives the request. */
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (tooFast(ip)) {
    return json({ error: 'Give me a moment — too many messages at once.' }, 429, origin)
  }

  /* The key is checked by resolving it, not by trusting it. An empty
     object means no client matched, which is the only signal a caller
     gets — a wrong key and a key with no data look identical. */
  let ctx: Record<string, unknown>
  try {
    ctx = await rpc('portal_assistant_context', { p_key: key })
  } catch (err) {
    console.error('portal context failed:', String((err as Error).message).slice(0, 200))
    return json({ error: 'Unable to load your account right now.' }, 502, origin)
  }
  if (!ctx || !ctx.client) return json({ error: 'Not signed in.' }, 401, origin)

  /* ---- Confirming a request the client was shown ---- */
  if (body.action === 'raise') {
    const r = (body.request ?? {}) as Record<string, unknown>
    const kind = String(r.kind ?? '')
    const subject = String(r.subject ?? '').trim()
    const text = String(r.body ?? '').trim()
    if (!KINDS.includes(kind) || !subject || !text) {
      return json({ error: 'That request is incomplete.' }, 400, origin)
    }
    /* raised_via is a label, not a permission, but it still comes from
       the browser — so it is constrained to the two values the column
       allows rather than passed through. */
    const via = body.raised_via === 'client_typed' ? 'client_typed' : 'assistant'
    try {
      const id = await rpc('portal_raise_request', {
        p_key: key,
        p_kind: kind,
        p_subject: subject,
        p_body: text,
        p_quote_reference: r.quote_reference ? String(r.quote_reference) : null,
        p_raised_via: via,
      })
      return json({ raised: true, id }, 200, origin)
    } catch (err) {
      const msg = String((err as Error).message)
      if (/too many requests/i.test(msg)) {
        return json({ error: 'You have raised a lot of requests in the last hour. Please give us a chance to work through them.' }, 429, origin)
      }
      console.error('raise failed:', msg.slice(0, 200))
      return json({ error: 'Could not raise that just now. Email hello@nabl.agency and we will pick it up.' }, 502, origin)
    }
  }

  /* ---- Asking ---- */
  const message = String(body.message ?? '').slice(0, 1000).trim()
  if (!message) return json({ error: 'No message.' }, 400, origin)

  const history = Array.isArray(body.history) ? body.history.slice(-6) : []
  const messages = [
    { role: 'system', content: rules(ctx) },
    ...history
      .filter((m: { role?: string }) => m && (m.role === 'user' || m.role === 'assistant'))
      .map((m: { role: string; content: string }) => ({
        role: m.role,
        content: String(m.content).slice(0, 1000),
      })),
    { role: 'user', content: message },
  ]

  if (!CF_ACCOUNT || !CF_TOKEN) {
    return json({
      reply: "I'm not set up yet, sorry. Use the request form or email hello@nabl.agency and someone will pick it up.",
      intent: 'answer',
    }, 200, origin)
  }

  let raw = ''
  try {
    raw = await think(messages)
  } catch (err) {
    /* Logged, not returned: a spent allowance, a wrong token and a
       retired model need completely different fixes and the client
       needs none of them. */
    console.error('portal assistant upstream failure:', String((err as Error).message).slice(0, 300))
    return json({
      reply: "I can't answer right now, sorry. Email hello@nabl.agency and someone will come back to you.",
      intent: 'answer',
    }, 200, origin)
  }

  /* A small model wraps JSON in a code fence often enough that not
     handling it would be the most common failure in production. */
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let out: Record<string, unknown>
  try {
    out = JSON.parse(cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1))
  } catch {
    /* Unparseable is not a failure worth showing as one: the text is
       usually a perfectly good answer that missed the format. */
    return json({ reply: cleaned.slice(0, 800), intent: 'answer' }, 200, origin)
  }

  const reply = String(out.reply ?? '').slice(0, 1200)
  if (!reply) return json({ reply: cleaned.slice(0, 800), intent: 'answer' }, 200, origin)

  /* The proposal is validated here rather than trusted, so the portal
     never renders a confirm button for something the database would
     refuse. */
  const proposed = (out.request ?? null) as Record<string, unknown> | null
  const valid =
    out.intent === 'raise' &&
    proposed &&
    KINDS.includes(String(proposed.kind)) &&
    String(proposed.subject ?? '').trim() &&
    String(proposed.body ?? '').trim()

  return json({
    reply,
    intent: valid ? 'raise' : 'answer',
    request: valid
      ? {
          kind: String(proposed!.kind),
          subject: String(proposed!.subject).slice(0, 200),
          body: String(proposed!.body).slice(0, 4000),
          quote_reference: proposed!.quote_reference ? String(proposed!.quote_reference) : null,
        }
      : undefined,
  }, 200, origin)
}
