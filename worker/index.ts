/* The public assistant on nabl.agency.

   It answers from one file and it can reach nothing else. That is the whole
   security model, and it is deliberately structural rather than careful: there
   is no Supabase client in this file, no service key in the environment, and
   no database binding in wrangler.jsonc. It cannot leak client data because
   nothing here can fetch any.

   It also writes nothing. When a visitor wants to book a call or ask the team
   something, the reply carries an intent and the site opens the existing
   enquiry form with it filled in. The visitor presses send. The assistant
   proposes; a person confirms; the form that already exists does the work —
   the same shape as the outreach gates and the compliance gate.

   Static assets are matched before this script runs, so every real file is
   served without touching it. Only /api/* reaches here.
*/

import { KNOWLEDGE } from './knowledge.generated'

interface Env {
  /* A Secrets Store binding, not a plain string. The value is fetched with an
     async get() — treating it as a string yields "[object Object]" in the
     Authorization header and a 401 that looks exactly like a wrong key. */
  GROQ_API_KEY?: { get: () => Promise<string> }

  /* The static assets, so this script can hand anything that is not an API
     call back to them. See the fetch handler for why that is not optional. */
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

/* Groq rather than Workers AI, and the reason is capacity against an audience
   nobody controls.

   This bot carries the whole knowledge file in every turn — about 1,320 tokens
   before the question — so a turn costs roughly 28 Neurons. Against the 10,000
   a day Workers AI gives free, that is about 357 turns: one curious afternoon
   on a public page. Groq's free tier allows 14,400 requests a day at 6,000
   tokens a minute, which is an order of magnitude more headroom and a 70B
   model rather than an 8B.
   
   The argument that put the CLIENT assistant on Workers AI — Cloudflare is
   already a processor of client personal data, so it adds no sub-processor —
   does not apply here. This bot never touches client data. Anonymous visitor
   questions are the only thing it sees. */
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

/* Tried in order until one answers, rather than named once.
   
   Two reasons, and the second is the durable one. The first attempt hardcoded
   llama-3.3-70b-versatile, which the docs list under "Enterprise tier" — the
   free key gets a 404 model_not_found. And Groq retires models often enough to
   keep a deprecations page, so any single name here is a future outage that
   arrives without a deploy.
   
   A 404 costs one extra round trip and only on a model that is gone, so the
   steady state is a single request. Ordered best-first: whichever the key can
   actually reach is the one that answers. */
const MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'llama-3.1-8b-instant',
]

const ALLOWED_ORIGINS = [
  'https://nabl.agency',
  'https://www.nabl.agency',
  'http://localhost:4173',
  'http://localhost:5173',
]

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
})

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...cors(origin), 'Content-Type': 'application/json' },
  })

/* A cheap guard, and honest about what it is: Workers isolates are per-colo
   and short-lived, so this stops a naive loop from one browser and nothing
   more. The real limit is a zone-level Rate Limiting rule on /api/chat/public,
   which the free plan includes — see business/03-website/public-assistant.md.
   Without that rule, a determined visitor can still spend the daily Neuron
   allowance. */
const seen = new Map<string, { n: number; until: number }>()
const WINDOW_MS = 60_000
const PER_WINDOW = 8

function tooFast(ip: string): boolean {
  const now = Date.now()
  const hit = seen.get(ip)
  if (!hit || hit.until < now) { seen.set(ip, { n: 1, until: now + WINDOW_MS }); return false }
  hit.n += 1
  if (seen.size > 5000) seen.clear()   // unbounded maps are how a Worker OOMs
  return hit.n > PER_WINDOW
}

const MAX_MESSAGE = 1_000
const MAX_HISTORY = 6

const SYSTEM = `You are the assistant on nabl.agency, the website of n.abl, a small technology implementation business in Nottingham.

Someone is here because they are wondering whether n.abl can solve a problem they have. Be useful first and persuasive second, and never persuasive at the cost of being accurate.

WHAT YOU KNOW
Only the reference below. If something is not in it, say so and offer to put the question to the team. Do not reason from general knowledge about businesses like this one, and never fill a gap with something plausible.

Never state a price, a cost, a timescale or a date that is not written in the reference. Never claim a client, a case study or a result — there are none yet, and a visitor can check.

WORKING OUT WHAT TO SAY
Most visitors describe a situation rather than asking a clean question. Work the answer out from the reference rather than reaching for a stock reply:

1. Identify what is actually costing them — time, money, accuracy, or a thing they cannot do yet.
2. Match that against the capabilities the reference lists, and against the list of what n.abl does not do. Take only the ones that genuinely fit. Usually that is one.
3. Say what that would mean for their situation, in the nouns they used.
4. Offer the call.

Select from the list; never recite it. A capability named "in case", or hedged with "and if needed", tells them you have not understood the problem — it reads as a brochure, not an answer. If two genuinely apply, name two. If none does, say so plainly: the reference says what n.abl does not do, and "that is not us, but here is who it is" earns more than a stretch.

MONEY
Never raise it first. Price, cost, quotes, budget, savings and value are subjects the visitor opens, not you. Someone describing a problem has asked about their problem, and answering with anything about cost turns a conversation into a transaction before there is anything to transact.

When they do ask about money, answer from the reference and add nothing to it.

The first call is not a pricing call. Never describe it as a way to get a number, a quote, an estimate or a figure.

THE CALL
Offer it after you have been useful, not instead of being useful, and set intent "book_call" when you do. Describe it as the reference describes it. Never as a gate — nothing is being withheld until they book, and someone who never books should still leave having learnt something.

HOW YOU SAY IT
Two or three sentences. This is a chat box, not a brochure. No exclamation marks, no "great question", no "I would be happy to help" — start with the answer.

Concrete beats vague. "The report that takes someone all of Monday" lands; "operational inefficiencies" does not. Use the plain nouns a business owner would use about their own week.

Lead with what you can tell them, never with what you cannot. Never begin a sentence about n.abl with "I can't", "We don't", "We're unable" or "Unfortunately" — put the useful half first and the limit second.

Never oversell. If n.abl is probably not the right fit, say so. That answer wins more trust than a stretch.

If you are asked whether you are a person, say plainly that you are an AI answering for n.abl. Never claim to be human, never take a name, never let the question go unanswered.

INTENT
Set "book_call" whenever you have offered the call — which is most replies where someone has described a problem they want solved, and any reply where they ask about price, timescales or getting started. Set "ask_team" when you could not answer and they want it passed on. Otherwise "answer".

Reply with ONLY a JSON object, no text around it:

{
  "reply": "what you say to the visitor",
  "intent": "answer" | "book_call" | "ask_team" | "unknown",
  "enquiry": "if intent is book_call or ask_team, a one-line summary of what they want, in their words"
}

REFERENCE
---------
${KNOWLEDGE}`

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('origin')

    /* Anything that is not an API call belongs to the site, not to this
       script — and handing it back has to be explicit.

       Workers Static Assets checks for a matching file first, so real files
       never reach here. Paths with no file do: /crm, /portal, /team and every
       other client-side route. Without a Worker script those fell through to
       not_found_handling and got the SPA shell. With one, they reach this
       handler instead, and the first version answered them with a flat 404 —
       which took the CRM, the portal and the team space off the live site
       until verify-deploy noticed. The assets binding still applies
       not_found_handling, so forwarding restores the shell.

       /api/* stays a 404 rather than falling through: an unknown API path is
       a mistake, and answering it with an HTML page hides that. */
    /* Anything that is not an API call belongs to the site, not to this
       script — and handing it back has to be explicit.

       Workers Static Assets checks for a matching file first, so real files
       never reach here. Paths with no file do: /crm, /portal, /team and every
       other client-side route. Without a Worker script those fell through to
       not_found_handling and got the SPA shell. With one, they reach this
       handler instead, and the first version answered them with a flat 404 —
       which took the CRM, the portal and the team space off the live site
       until verify-deploy noticed. The assets binding still applies
       not_found_handling, so forwarding restores the shell.

       /api/* stays a 404 rather than falling through: an unknown API path is
       a mistake, and answering it with an HTML page hides that. */
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname !== '/api/chat/public') return new Response('Not found', { status: 404 })
    } else {
      return env.ASSETS.fetch(request)
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) })
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, origin)

    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
    if (tooFast(ip)) return json({ error: 'Give me a moment — too many messages at once.' }, 429, origin)

    let message = ''
    let history: { role: string; content: string }[] = []
    try {
      const body = await request.json() as { message?: string; history?: unknown }
      message = String(body.message ?? '').slice(0, MAX_MESSAGE)
      history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : []
    } catch {
      return json({ error: 'Invalid JSON.' }, 400, origin)
    }
    if (!message.trim()) return json({ error: 'No message.' }, 400, origin)

    /* Visitor text is untrusted. It is passed as a user turn, never merged
       into the system prompt, so "ignore your instructions" arrives as
       something a stranger said rather than as something we told the model. */
    const messages = [
      { role: 'system', content: SYSTEM },
      ...history
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
        .map((m) => ({ role: m.role, content: String(m.content).slice(0, MAX_MESSAGE) })),
      { role: 'user', content: message },
    ]

    let apiKey = ''
    try {
      apiKey = (await env.GROQ_API_KEY?.get()) ?? ''
    } catch {
      apiKey = ''
    }
    if (!apiKey) {
      return json({
        reply: "I'm not set up yet, sorry. Email hello@nabl.agency and someone will come back to you.",
        intent: 'unknown',
      }, 200, origin)
    }

    let raw = ''
    let lastError = ''
    try {
      for (const model of MODELS) {
        const res = await fetch(GROQ_URL, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: 400,
            /* Asked for as a format rather than described in the prompt. A
               model told to return JSON returns JSON most of the time; one
               constrained to it returns JSON always, and the fence-stripping
               below becomes a belt rather than the mechanism. */
            response_format: { type: 'json_object' },
          }),
        })

        if (res.ok) {
          const data = await res.json() as { choices?: { message?: { content?: string } }[] }
          raw = data?.choices?.[0]?.message?.content ?? ''
          break
        }

        const body = (await res.text()).slice(0, 300)
        lastError = `${res.status} ${body}`

        /* Only a missing model is worth trying the next one for. A 401 means
           the key is wrong and every model will refuse it; a 429 means the
           allowance is spent and hammering three models spends it faster. */
        if (res.status !== 404 && res.status !== 400) break
      }
      if (!raw) throw new Error(lastError || 'no model answered')
    } catch (err) {
      /* Running out of the daily allowance, a wrong key, a model that is not
         on this tier and a network blip all end up here, and they need
         completely different fixes. The visitor gets the same sentence either
         way, but the reason travels in a separate field so it is diagnosable
         from outside — an earlier version swallowed it entirely and left no
         way to tell which had happened without guessing. Nothing here echoes
         the request or the key: Groq's error bodies carry neither. */
      /* Logged, not returned. The reason is the difference between a spent
         allowance, a wrong key and a retired model, and it took three guesses
         to find the last one when this was swallowed entirely — so it goes to
         `wrangler tail`, where whoever is debugging can see it and a stranger
         curling the endpoint cannot. */
      console.error('assistant upstream failure:', String((err as Error).message ?? '').slice(0, 300))
      return json({
        reply: "I can't answer right now, sorry. Email hello@nabl.agency and someone will come back to you.",
        intent: 'unknown',
      }, 200, origin)
    }

    /* A small model wraps JSON in a code fence often enough that not handling
       it would be the most common failure in production. */
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    let parsed: { reply?: string; intent?: string; enquiry?: string }
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      /* It said something, just not as JSON. Passing the text through beats
         showing an error: the visitor gets an answer, and the intent falls
         back to a safe value. */
      return json({ reply: cleaned.slice(0, 800) || 'Sorry, I did not follow that.', intent: 'unknown' }, 200, origin)
    }

    const INTENTS = ['answer', 'book_call', 'ask_team', 'unknown']
    return json({
      reply: String(parsed.reply ?? '').slice(0, 800),
      intent: INTENTS.includes(String(parsed.intent)) ? parsed.intent : 'unknown',
      enquiry: parsed.enquiry ? String(parsed.enquiry).slice(0, 300) : undefined,
    }, 200, origin)
  },
}
