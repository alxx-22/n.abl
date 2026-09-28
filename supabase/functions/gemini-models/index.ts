/* ============================================================
   WHAT DOES THIS KEY SEE, AND WHAT DOES IT SAY BACK?

   Diagnostics for the model chains. Two lessons are baked into it.

   First: the writer reported a 403 as "not available", which is a
   guess dressed as a diagnosis, and it cost an hour. So this returns
   the RAW body of whatever came back, every time.

   Second: a model that works for one agent can fail for another, and
   the only difference is the request. So the probe sweeps the pieces
   of the request one at a time rather than reasoning about them.

     {}                                   list reachable models
     {"probe":"<id>"}                     sweep request shapes
     {"probe":"<id>","temperature":0.95}  ... at a given temperature
     {"key":"GEMINI_DISCOVERY_API_KEY"}   ... on another project's key
     {"probe":"<id>","shape":"thinking"}  ... whether its thinking can be turned down
     {"probe":"<id>","shape":"agent"}     ... one request, the agents' shape only

   Listing spends no quota. A probe spends one request per shape (six),
   so probe only a model with a daily allowance to spare. A 20-a-day
   Flash model gets shape "agent": one request.

   The key never leaves the function, and only a GEMINI_*_API_KEY
   secret can be named.
   ============================================================ */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_BASE = Deno.env.get('GEMINI_BASE_URL') ??
  'https://generativelanguage.googleapis.com'
const KEY_NAME = /^GEMINI_[A-Z0-9_]*API_KEY$/

async function rpc(fn: string, args: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(args),
  })
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), { status, headers: { 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  const presented = req.headers.get('x-outreach-secret') ?? ''
  let allowed = false
  try {
    allowed = await rpc('outreach_verify_cron_secret', { p_secret: presented }) === true
  } catch { allowed = false }
  if (!allowed) return json({ error: 'forbidden' }, 403)

  const body = await req.json().catch(() => ({}))
  const keyName = typeof body?.key === 'string' ? body.key : 'GEMINI_API_KEY'
  if (!KEY_NAME.test(keyName)) return json({ error: `${keyName} is not a key this function may read` }, 400)
  const GEMINI_KEY = (Deno.env.get(keyName) ?? '').trim()
  if (!GEMINI_KEY) return json({ error: `${keyName} is not set` }, 503)

  const probe = typeof body?.probe === 'string' ? body.probe : ''
  const temperature = Number.isFinite(Number(body?.temperature)) ? Number(body.temperature) : 0.2

  if (probe) {
    const attempts: unknown[] = []
    const sys = 'You write one clause, lower case, no full stop. Return only JSON.'
    const usr = 'THE BRIEF: acknowledge the gap between an online form and the phone call.\n\nReturn { "observation": "the clause" } or { "refuse": "why" }.'
    const tool = {
      functionDeclarations: [{
        name: 'conclude',
        description: 'Finish with a one-sentence answer.',
        parameters: { type: 'object', properties: { why: { type: 'string' } }, required: ['why'] },
      }],
    }

    const variants: { label: string; payload: Record<string, unknown> }[] = [
      {
        label: `agent shape: system instruction + JSON mode, temperature ${temperature}`,
        payload: {
          systemInstruction: { parts: [{ text: sys }] },
          contents: [{ role: 'user', parts: [{ text: usr }] }],
          generationConfig: { temperature, topP: 0.95, responseMimeType: 'application/json' },
        },
      },
      {
        label: 'system instruction, no JSON mode',
        payload: {
          systemInstruction: { parts: [{ text: sys }] },
          contents: [{ role: 'user', parts: [{ text: usr }] }],
          generationConfig: { temperature, topP: 0.95 },
        },
      },
      {
        label: 'system folded into the user turn, JSON mode',
        payload: {
          contents: [{ role: 'user', parts: [{ text: `${sys}\n\n${usr}` }] }],
          generationConfig: { temperature, topP: 0.95, responseMimeType: 'application/json' },
        },
      },
      {
        label: 'system folded into the user turn, no JSON mode',
        payload: {
          contents: [{ role: 'user', parts: [{ text: `${sys}\n\n${usr}` }] }],
          generationConfig: { temperature, topP: 0.95 },
        },
      },
      {
        label: 'function calling, mode ANY (the investigator shape)',
        payload: {
          systemInstruction: { parts: [{ text: 'Call conclude.' }] },
          contents: [{ role: 'user', parts: [{ text: 'Is the sky blue? Answer by calling conclude.' }] }],
          tools: [tool],
          toolConfig: { functionCallingConfig: { mode: 'ANY' } },
          generationConfig: { temperature },
        },
      },
      {
        label: 'bare minimum',
        payload: { contents: [{ parts: [{ text: 'hello' }] }] },
      },
    ]

    /* A model that thinks before it answers (Gemma 4 does) is slow and
       puts its thoughts in the reply as parts marked thought: true. These
       shapes ask it not to, in each of the ways the API offers. */
    const agent = (extra: Record<string, unknown>) => ({
      systemInstruction: { parts: [{ text: sys }] },
      contents: [{ role: 'user', parts: [{ text: usr }] }],
      generationConfig: { temperature, topP: 0.95, responseMimeType: 'application/json', ...extra },
    })
    const thinking: typeof variants = [
      { label: 'thinkingBudget 0', payload: agent({ thinkingConfig: { thinkingBudget: 0 } }) },
      { label: 'thinkingLevel minimal', payload: agent({ thinkingConfig: { thinkingLevel: 'minimal' } }) },
      { label: 'thinkingLevel low', payload: agent({ thinkingConfig: { thinkingLevel: 'low' } }) },
      { label: 'includeThoughts false', payload: agent({ thinkingConfig: { includeThoughts: false } }) },
    ]

    /* One request in the agents' own shape, for a model with 20 a day. */
    const shapes = body?.shape === 'thinking' ? thinking : body?.shape === 'agent' ? variants.slice(0, 1) : variants
    for (const v of shapes) {
      const url = `${GEMINI_BASE}/v1beta/models/${probe}:generateContent`
      const started = Date.now()
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
          body: JSON.stringify(v.payload),
          signal: AbortSignal.timeout(30_000),
        })
        const text = await res.text()
        /* A 200 is summarised part by part: a thinking model's thoughts
           come first and would fill the raw slice before the answer. */
        let parsed: any = null
        try { parsed = JSON.parse(text) } catch { parsed = null }
        const parts = parsed?.candidates?.[0]?.content?.parts
        attempts.push(Array.isArray(parts)
          ? {
            variant: v.label, status: res.status, ms: Date.now() - started,
            parts: parts.map((p: any) => ({ thought: p?.thought === true, text: String(p?.text ?? JSON.stringify(p?.functionCall ?? '')).slice(0, 240) })),
            usage: parsed?.usageMetadata ?? null,
          }
          : { variant: v.label, status: res.status, ms: Date.now() - started, body: text.slice(0, 700) })
      } catch (err) {
        attempts.push({ variant: v.label, error: (err as Error).message, ms: Date.now() - started })
      }
    }

    return json({ key: keyName, probe, attempts })
  }

  const out: Record<string, unknown> = { key: keyName }
  for (const version of ['v1beta', 'v1']) {
    try {
      const res = await fetch(`${GEMINI_BASE}/${version}/models?pageSize=200`, {
        headers: { 'x-goog-api-key': GEMINI_KEY },
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) {
        out[version] = { error: `HTTP ${res.status}`, body: (await res.text()).slice(0, 400) }
        continue
      }
      const data = await res.json()
      out[version] = (data?.models ?? [])
        .filter((m: { supportedGenerationMethods?: string[] }) =>
          (m.supportedGenerationMethods ?? []).includes('generateContent'))
        .map((m: { name: string; inputTokenLimit?: number }) =>
          `${String(m.name).replace(/^models\//, '')}${m.inputTokenLimit ? ` (${m.inputTokenLimit} in)` : ''}`)
    } catch (err) {
      out[version] = { error: (err as Error).message }
    }
  }

  return json(out)
})
