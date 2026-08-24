/* ============================================================
   research-lead — deep-dive one lead, on demand.

   The caller's own Claude subscription does the work. Every team member runs
   their own proxy behind their own Cloudflare Tunnel, and this function looks
   up the endpoint belonging to whoever is calling. There is no shared
   endpoint: routing one person's runs through another's subscription spends
   their allowance and puts their session behind someone else's work.

   What this function is for, and it is worth being precise about it, is being
   the only thing that knows the tunnel exists. The browser never sees the URL
   or the service token. It sends a lead id and a session, and gets back
   either a result or a reason.

   Four things happen here in order, and the order matters:

     1. Who is calling            — a real Supabase session, or nothing
     2. May they, and how often   — the ledger insert runs a trigger that
                                    refuses past their hourly limit
     3. Ask their proxy           — through the tunnel, with their token
     4. Record what happened      — success or failure, verbatim

   Step 2 is a database insert rather than a check in this file on purpose. A
   rate limit that lives in the caller is not a rate limit the second caller
   has, and there will eventually be a second caller.

   Deploy:
     supabase functions deploy research-lead
   No secrets to set: the per-user endpoint and token live in
   public.research_endpoints, readable only by the service role.
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...cors(origin), 'Content-Type': 'application/json' },
  })

/* A local proxy spawning a CLI is slow — seconds, not milliseconds — and a
   deep read of a website is slower still. Long enough to be useful, short
   enough that a hung tunnel does not hold the function open indefinitely. */
const PROXY_TIMEOUT_MS = 120_000

/* What we want back. Asked for as a schema rather than described in prose,
   because "return JSON" and then digging it out with a regex works right up
   until the model wraps it in a code fence. */
const SHAPE = `Return ONLY a JSON object, no prose around it, with these keys:

{
  "summary":      "two or three sentences on what this business actually does, from their own site",
  "signals":      ["specific, checkable observations — how enquiries arrive, whether they are hiring, accreditations held, a price list that goes out as a PDF, a booking process that runs through the phone"],
  "contacts":     [{"kind": "email|phone|form", "value": "...", "where": "the page you found it on"}],
  "fit":          "one honest paragraph on whether n.abl can help them, including if the answer is no",
  "draft_subject": "...",
  "draft_body":   "the email, ready to edit"
}`

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, origin)

  /* ---- 1. who is calling ---- */
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Not signed in.' }, 401, origin)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const { data: userData, error: userErr } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
  const user = userData?.user
  if (userErr || !user) return json({ error: 'Not signed in.' }, 401, origin)

  let leadId = ''
  try {
    const body = await req.json()
    leadId = String(body.lead_id ?? '')
  } catch {
    return json({ error: 'Invalid JSON.' }, 400, origin)
  }
  if (!leadId) return json({ error: 'No lead specified.' }, 400, origin)

  const { data: lead } = await admin
    .from('sales_leads')
    .select('id, company, website, industry, location, notes, signals')
    .eq('id', leadId)
    .single()
  if (!lead) return json({ error: 'No such lead.' }, 404, origin)

  /* ---- 2. may they, and how often ----
     The insert is the check. research_run_guard refuses when the caller has
     no endpoint, when it is disabled, or when they are over their hourly
     limit, and it says which. */
  const { data: run, error: runErr } = await admin
    .from('research_runs')
    .insert({ user_id: user.id, lead_id: lead.id, lead_company: lead.company, kind: 'research' })
    .select('id')
    .single()

  if (runErr) {
    const message = String(runErr.message ?? '')
    const isLimit = /rate limit|no research endpoint|disabled/i.test(message)
    return json({ error: isLimit ? message : 'Could not start a research run.' }, isLimit ? 429 : 500, origin)
  }

  const finish = async (status: string, error?: string) => {
    await admin.from('research_runs')
      .update({ status, error: error ?? null, finished_at: new Date().toISOString() })
      .eq('id', run.id)
  }

  /* ---- 3. ask their proxy ---- */
  const { data: endpoint } = await admin
    .from('research_endpoints')
    .select('url, service_token')
    .eq('user_id', user.id)
    .single()

  // The guard above already refused if this were missing, so reaching here
  // without one means the row went away between two statements.
  if (!endpoint) { await finish('failed', 'endpoint disappeared mid-run'); return json({ error: 'No endpoint registered.' }, 409, origin) }

  const prompt = `Research this UK business for a first approach from n.abl, a small technology implementation business in Nottingham. We build fixes for the manual jobs that eat a morning a week — rekeying orders, chasing timesheets, rebuilding the same spreadsheet.

Company:  ${lead.company}
Website:  ${lead.website || '(none known)'}
Sector:   ${lead.industry || '(unknown)'}
Address:  ${lead.location || '(unknown)'}
Known:    ${lead.signals || '(nothing yet)'}

Read their website properly — more than the home page. Then:

- Say what they actually do, in their words, not the register's.
- Find things that are TRUE AND CHECKABLE. "Their booking form goes to an inbox"
  is an observation. "They probably struggle with admin" is a guess dressed as
  one, and a recipient can tell the difference immediately.
- Collect published contact routes. Prefer role addresses — info@, hello@.
  Do NOT collect a named person's email address: holding one changes which
  data protection rules apply to this lead, and we do not want it.
- Say honestly whether we can help. "Probably not, they already run good
  software" is a useful answer and a common one.
- Draft the first email around the single strongest observation. No flattery,
  no "I hope this finds you well", nothing we cannot stand behind.

${SHAPE}`

  let text = ''
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)
    const res = await fetch(`${endpoint.url.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        // Cloudflare Access service token — this is what makes the tunnel
        // reachable by this function and by nothing else.
        'CF-Access-Client-Id': endpoint.service_token.split(':')[0] ?? '',
        'CF-Access-Client-Secret': endpoint.service_token.split(':')[1] ?? '',
      },
      body: JSON.stringify({
        model: 'claude-opus-5',
        messages: [{ role: 'user', content: prompt }],
      }),
    }).finally(() => clearTimeout(timer))

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300)
      await finish('failed', `proxy returned ${res.status}: ${detail}`)
      /* Relayed rather than swallowed, deliberately. "You have hit your usage
         limit" and "the tunnel is down" need completely different responses
         and look identical from the CRM otherwise. This endpoint is the
         caller's own machine, so there is nothing here to leak to them. */
      return json({ error: `Your research endpoint returned ${res.status}.`, detail }, 502, origin)
    }

    const data = await res.json()
    text = data?.choices?.[0]?.message?.content ?? ''
  } catch (err) {
    const aborted = (err as Error).name === 'AbortError'
    const message = aborted ? 'timed out after two minutes' : String((err as Error).message).slice(0, 200)
    await finish('failed', message)
    return json({ error: aborted ? 'Your endpoint did not answer in time.' : 'Could not reach your research endpoint.' }, 504, origin)
  }

  /* ---- 4. record what happened ---- */
  let parsed: Record<string, unknown> | null = null
  try {
    // A code fence is the usual way this arrives when it is not clean JSON.
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    parsed = JSON.parse(cleaned)
  } catch {
    await finish('failed', 'the reply was not JSON')
    return json({ error: 'The reply could not be read as JSON.', raw: text.slice(0, 2000) }, 502, origin)
  }

  await finish('succeeded')
  return json({ ok: true, run_id: run.id, result: parsed }, 200, origin)
})
