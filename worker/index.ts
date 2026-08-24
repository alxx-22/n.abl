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
  AI: { run: (model: string, input: unknown) => Promise<{ response?: string }> }
}

/* An 8B is reliable at short grounded answers and at picking from a fixed
   list. It is not reliable at freeform generation, which is why the prompt
   below asks for one of five intents and a short reply, and nothing else. */
const MODEL = '@cf/meta/llama-3.1-8b-instruct-awq'

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

Answer ONLY from the reference below. It is everything you know.

If the answer is not in the reference, say so plainly and offer to pass the question to the team. Do not guess, do not reason from general knowledge about similar businesses, and never fill a gap with something plausible.

Never state a price, a cost, a timescale or a delivery date that is not written in the reference. There is no price list. If pressed, explain how pricing works and offer the call.

Never claim a client, a case study or a result. There are none yet, and saying otherwise is a lie a visitor can check.

Keep replies to two or three sentences. This is a chat box on a website, not an essay.

Reply with ONLY a JSON object, no text around it:

{
  "reply": "what you say to the visitor",
  "intent": "answer" | "book_call" | "ask_team" | "unknown",
  "enquiry": "if intent is book_call or ask_team, a one-line summary of what they want, in their words"
}

- "answer"    — you answered from the reference
- "book_call" — they want to speak to someone
- "ask_team"  — you could not answer and they want it passed on
- "unknown"   — you could not answer and have offered to ask the team

REFERENCE
---------
${KNOWLEDGE}`

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('origin')

    if (url.pathname !== '/api/chat/public') return new Response('Not found', { status: 404 })
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

    let raw = ''
    try {
      const out = await env.AI.run(MODEL, { messages, max_tokens: 400 })
      raw = out.response ?? ''
    } catch {
      /* The daily Neuron allowance running out looks like this. Say something
         a visitor can act on rather than an error code. */
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
