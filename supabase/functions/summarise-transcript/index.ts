/* ============================================================
   summarise-transcript — optional.

   The welcome pack works without this. The team can paste goals
   straight in, or use "Copy prompt" to get a prompt for any chat
   window and paste the answer back. Deploy this only if you want
   the "Summarise" button to do it in one step.

   Why a function rather than calling the model from the browser:
   an API key in the bundle is a key the whole internet has. The
   key lives here, in a Supabase secret, and never reaches a client.

   Deploy:
     supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
     supabase functions deploy summarise-transcript
   Then set VITE_SUMMARISE_URL in the site's build environment to
   this function's URL and redeploy the site.

   Cost note: this runs once per new client, on a transcript of a
   few thousand words. At an agency's onboarding volume that is
   pennies a month — but it is not zero, and it is the only part of
   the welcome pack that costs anything at all.
   ============================================================ */

const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-5'
const API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

// Only the team space calls this, and only from the site.
const ALLOWED_ORIGINS = [
  'https://nabl.agency',
  'https://www.nabl.agency',
  'http://localhost:4173',
  'http://localhost:5173',
]

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
})

// A transcript is long; a novel is not. Cap it so one paste cannot
// run up a bill or blow the context window.
const MAX_CHARS = 60_000

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), {
      status: 405, headers: { ...cors(origin), 'Content-Type': 'application/json' },
    })
  }
  if (!API_KEY) {
    return new Response(JSON.stringify({ error: 'Summariser is not configured.' }), {
      status: 503, headers: { ...cors(origin), 'Content-Type': 'application/json' },
    })
  }

  let transcript = ''
  let business = ''
  try {
    const body = await req.json()
    transcript = String(body.transcript ?? '')
    business = String(body.business ?? '')
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON.' }), {
      status: 400, headers: { ...cors(origin), 'Content-Type': 'application/json' },
    })
  }

  if (!transcript.trim()) {
    return new Response(JSON.stringify({ error: 'No transcript supplied.' }), {
      status: 400, headers: { ...cors(origin), 'Content-Type': 'application/json' },
    })
  }
  if (transcript.length > MAX_CHARS) transcript = transcript.slice(0, MAX_CHARS)

  const prompt = `You are writing the project-goals section of a welcome document for a new client of n.abl, a UK automation consultancy.

Client: ${business || '[business]'}

Read the transcript below and return JSON only, in exactly this shape:

{
  "summary": "Two or three sentences, addressed to the client as 'you', describing what we are setting out to achieve together. Plain English, no jargon, no bullet points.",
  "goals": ["A concrete outcome", "Another concrete outcome"]
}

Rules:
- Use only what is actually in the transcript. Do not invent goals, numbers, deadlines or system names that were not mentioned.
- Between two and five goals. Each an outcome the client would recognise, not a task list.
- If the transcript does not contain enough to state a goal, return fewer goals rather than padding.
- No markdown, no commentary, JSON only.

TRANSCRIPT
----------
${transcript}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 900,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      // Never relay the upstream body: it can echo request details.
      return new Response(JSON.stringify({ error: 'The summariser is unavailable right now.' }), {
        status: 502, headers: { ...cors(origin), 'Content-Type': 'application/json' },
      })
    }

    const data = await res.json()
    const text = data?.content?.[0]?.text ?? ''
    // Models sometimes fence the JSON despite instructions.
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      return new Response(JSON.stringify({ error: 'Could not read the summary.' }), {
        status: 502, headers: { ...cors(origin), 'Content-Type': 'application/json' },
      })
    }
    const parsed = JSON.parse(match[0])

    return new Response(JSON.stringify({
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      goals: Array.isArray(parsed.goals) ? parsed.goals.filter((g: unknown) => typeof g === 'string') : [],
    }), { headers: { ...cors(origin), 'Content-Type': 'application/json' } })
  } catch {
    return new Response(JSON.stringify({ error: 'The summariser is unavailable right now.' }), {
      status: 502, headers: { ...cors(origin), 'Content-Type': 'application/json' },
    })
  }
})
