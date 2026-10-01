/* ============================================================
   tps-check — screen one UK number against the TPS and the CTPS.

   Called from the CRM by a signed-in person, before a sales call. In order:

     1. Who is calling      — a real Supabase session, or nothing
     2. Already known?      — a check under 28 days old, or a number already
                              on the suppression list, is answered from the
                              database and spends nothing
     3. Within allowance?   — never more checks a month than
                              TPS_CHECK_MONTHLY (default: the provider's
                              free allowance), so a free plan stays free
     4. Ask the provider    — with TPS_CHECK_API_KEY; an answer that does not
                              say yes or no for both registers is refused
     5. Record it           — phone_screening_record_api writes the check and,
                              for a number on either register, a permanent
                              suppression row

   Without TPS_CHECK_API_KEY it refuses and says so; a person can still
   check a number by hand on a checker's own site and record that in the
   CRM. Nothing here lets anyone call: the call itself is recorded through
   marketing_sends, whose gate reads the check this function wrote.

   The number goes to the screening service and nowhere else. It is never
   given to a model.

   Secrets: TPS_CHECK_API_KEY (required to screen), TPS_CHECK_PROVIDER
   (default tpscheck), TPS_CHECK_MONTHLY (optional ceiling).
   ============================================================ */

import { providerFor, readAnswer, normalisePhone } from './screen.mjs'

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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
})

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'content-type': 'application/json' } })

async function rpc(fn: string, args: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify(args),
  })
  const text = await res.text()
  if (!res.ok) {
    let msg = text
    try { msg = JSON.parse(text).message ?? text } catch { /* as sent */ }
    throw new Error(msg.slice(0, 300))
  }
  return text ? JSON.parse(text) : null
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, origin)

  /* ---- 1. who is calling ---- */
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'Not signed in.' }, 401, origin)
  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, authorization: auth } })
  const user = who.ok ? await who.json().catch(() => null) : null
  if (!user?.id) return json({ error: 'Not signed in.' }, 401, origin)

  let body: any = null
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON.' }, 400, origin) }
  const phone = normalisePhone(body?.phone)
  if (!phone) return json({ error: 'That is not a UK phone number we can screen.' }, 400, origin)
  const leadId = typeof body?.lead_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.lead_id) ? body.lead_id : null

  try {
    /* ---- 2. already known ---- */
    const [known] = (await rpc('phone_screening_status', { p_phones: [phone] })) ?? []
    if (known?.suppressed || known?.clear) return json({ ...known, spent: false }, 200, origin)

    /* ---- 3. within allowance ---- */
    const provider = providerFor(Deno.env.get('TPS_CHECK_PROVIDER'))
    if (!provider) return json({ error: 'TPS_CHECK_PROVIDER names a service this function does not know.' }, 500, origin)
    const key = (Deno.env.get('TPS_CHECK_API_KEY') ?? '').trim()
    if (!key) {
      return json({ error: 'Automatic screening is not set up (TPS_CHECK_API_KEY is not set). Check the number by hand on a TPS checker and record what it says.' }, 503, origin)
    }
    const ceiling = Number(Deno.env.get('TPS_CHECK_MONTHLY') ?? provider.free_per_month)
    const used = Number(await rpc('phone_screening_api_used', { p_provider: provider.label })) || 0
    if (!(used < ceiling)) {
      return json({ error: `This month's ${ceiling} automatic checks are used. Check the number by hand and record what it says.` }, 429, origin)
    }

    /* ---- 4. ask ---- */
    let answer: any = null
    try {
      const res = await fetch(provider.url, { ...provider.request(phone, key), signal: AbortSignal.timeout(15_000) })
      if (res.status === 401 || res.status === 403) {
        return json({ error: 'The screening service refused TPS_CHECK_API_KEY.' }, 502, origin)
      }
      if (!res.ok) return json({ error: `The screening service answered ${res.status}; nothing was recorded.` }, 502, origin)
      answer = await res.json().catch(() => null)
    } catch (e) {
      return json({ error: `The screening service did not answer (${(e as Error).name === 'TimeoutError' ? 'timed out' : 'unreachable'}); nothing was recorded.` }, 502, origin)
    }
    const read = readAnswer(answer, phone)
    if (!read.ok) return json({ error: `${read.why}; nothing was recorded.` }, 502, origin)

    /* ---- 5. record ---- */
    const saved = await rpc('phone_screening_record_api', {
      p_phone: phone, p_tps: read.tps, p_ctps: read.ctps, p_provider: provider.label,
      p_evidence: read.evidence, p_lead_id: leadId, p_by: user.id,
    })
    return json({ ...saved, provider: provider.label, method: 'api', suppressed: !saved.clear, spent: true }, 200, origin)
  } catch (e) {
    return json({ error: (e as Error).message }, 500, origin)
  }
})
