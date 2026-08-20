/* ============================================================
   Mock Supabase for UI end-to-end tests.

   Intercepts the REST, Auth and Storage endpoints at the network
   layer so the real supabase-js client runs unmodified — it signs
   in, stores its own session and issues real queries. That is far
   more faithful than hand-forging a session into localStorage,
   which silently breaks whenever the client's storage format moves.
   ============================================================ */

export function makeDb() {
  return {
    clients: [
      { id: 'c1', business_name: 'Acme Corp', contact_name: 'Wile E. Coyote',
        contact_email: 'wile@acme.example', access_key: 'ACME-DEMO-2026',
        created_at: '2026-05-30T22:16:12Z' },
    ],
    quotes: [
      { id: 'q1', client_id: 'c1', reference: 'Q-2026-001', title: 'Reporting automation build',
        amount: 8400, status: 'sent', valid_until: '2026-12-12', pdf_url: 'c1/1700-quote.pdf',
        created_at: '2026-06-01T09:00:00Z' },
    ],
    projects: [
      { id: 'p1', client_id: 'c1', title: 'Weekly reporting pack',
        description: 'Replacing the Monday morning manual pack with a scheduled flow.',
        status: 'active', progress_percent: 65, next_milestone: 'UAT with ops team',
        next_milestone_date: '2026-09-02' },
    ],
    meetings: [
      { id: 'm1', client_id: 'c1', title: 'Kickoff call', datetime: '2026-12-01T10:00:00Z',
        location: 'Microsoft Teams', join_url: 'https://teams.example/x', status: 'scheduled' },
      { id: 'm2', client_id: 'c1', title: 'Discovery session', datetime: '2026-02-10T14:30:00Z',
        location: 'In person — Leeds', join_url: 'https://teams.example/y', status: 'completed' },
    ],
    documents: [
      { id: 'd1', client_id: 'c1', title: 'Signed service agreement', document_type: 'contract',
        uploaded_at: '2026-05-31T10:00:00Z', file_url: 'c1/1700-agreement.pdf' },
    ],
    sales_leads: [], sales_contacts: [], sales_activities: [],
    sales_pipeline_events: [], sales_email_drafts: [],
  }
}

const TEAM_USER = {
  id: 'u1', aud: 'authenticated', role: 'authenticated',
  email: 'alex@nabl.agency', user_metadata: { display_name: 'Alex' }, app_metadata: {},
}

const session = () => ({
  access_token: 'mock-access-token', refresh_token: 'mock-refresh-token',
  token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, user: TEAM_USER,
})

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': 'content-range',
}

/** Table name out of a PostgREST URL. */
function tableOf(url) {
  const m = url.match(/\/rest\/v1\/([A-Za-z0-9_]+)/)
  return m ? m[1] : null
}

/** Apply the ?col=eq.value filters PostgREST uses. */
function applyFilters(rows, url) {
  const qs = new URL(url).searchParams
  let out = [...rows]
  for (const [k, v] of qs.entries()) {
    if (['select', 'order', 'limit', 'offset', 'apikey'].includes(k)) continue
    const m = String(v).match(/^eq\.(.*)$/)
    if (m) out = out.filter((r) => String(r[k]) === m[1])
  }
  const ord = qs.get('order')
  if (ord) {
    const [col, dir] = ord.split('.')
    out.sort((a, b) => {
      const x = a[col], y = b[col]
      if (x === y) return 0
      return (x > y ? 1 : -1) * (dir === 'desc' ? -1 : 1)
    })
  }
  return out
}

/**
 * Install the mock onto a Playwright page.
 * @param {import('playwright').Page} page
 * @param {object} opts
 *   db            - the fixture database (mutated by writes)
 *   validKey      - access key the portal RLS accepts
 *   password      - password the team auth accepts
 *   log           - array to push a request trace into
 */
export async function installMock(page, opts = {}) {
  const db = opts.db || makeDb()
  const validKey = opts.validKey ?? 'ACME-DEMO-2026'
  const password = opts.password ?? 'correct-horse'
  const log = opts.log || []
  let idSeq = 100

  // ---------- Auth ----------
  await page.route('**/auth/v1/**', async (route) => {
    const req = route.request()
    const url = req.url()
    log.push(`AUTH ${req.method()} ${url.split('/auth/v1/')[1]}`)

    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' })

    if (url.includes('/token')) {
      let body = {}
      try { body = JSON.parse(req.postData() || '{}') } catch {}
      if (url.includes('grant_type=refresh_token')) {
        return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json',
          body: JSON.stringify(session()) })
      }
      const ok = body.password === password
      if (!ok) {
        return route.fulfill({ status: 400, headers: CORS, contentType: 'application/json',
          body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials',
            code: 400, msg: 'Invalid login credentials' }) })
      }
      return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json',
        body: JSON.stringify(session()) })
    }

    if (url.includes('/user')) {
      return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json',
        body: JSON.stringify(TEAM_USER) })
    }
    if (url.includes('/logout')) {
      return route.fulfill({ status: 204, headers: CORS, body: '' })
    }
    return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: '{}' })
  })

  // ---------- REST ----------
  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' })

    // The portal signs in through the rate-limited portal_login RPC.
    if (/\/rest\/v1\/rpc\/portal_login/.test(url)) {
      let body = {}
      try { body = JSON.parse(req.postData() || '{}') } catch {}
      const key = body.p_key
      log.push(`RPC portal_login key=${key}`)
      const hit = db.clients.filter((c) => c.access_key === key)
      return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json',
        body: JSON.stringify(hit.map((c) => ({
          id: c.id, business_name: c.business_name, contact_name: c.contact_name,
          contact_email: c.contact_email, created_at: c.created_at,
        }))) })
    }

    const table = tableOf(url)
    const headers = req.headers()
    const accessKey = headers['x-access-key']
    const bearer = headers['authorization'] || ''
    const isTeam = bearer.includes('mock-access-token')
    log.push(`REST ${method} ${table}${accessKey ? ` key=${accessKey}` : ''}${isTeam ? ' team' : ''}`)

    // PostgREST returns a single object rather than an array when the client
    // asks for one — which is what supabase-js .single() does. The mock used
    // to always return an array, so every .single() call errored and any code
    // path behind one was silently never exercised by these tests.
    const wantsObject = /vnd\.pgrst\.object\+json/.test(headers['accept'] || '')
    const shape = (rows) => (wantsObject ? (rows[0] ?? null) : rows)

    if (!table || !db[table]) {
      return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json',
        body: JSON.stringify(wantsObject ? null : []) })
    }

    // Portal RLS: without a valid access key the client sees nothing.
    const portalScoped = accessKey !== undefined
    if (portalScoped && accessKey !== validKey) {
      return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json',
        body: JSON.stringify(wantsObject ? null : []) })
    }

    if (method === 'GET') {
      const rows = applyFilters(db[table], url)
      return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json',
        body: JSON.stringify(shape(rows)) })
    }

    if (method === 'POST') {
      let payload = []
      try { payload = JSON.parse(req.postData() || '[]') } catch {}
      const list = Array.isArray(payload) ? payload : [payload]
      const created = list.map((r) => ({ id: `gen${idSeq++}`, created_at: new Date().toISOString(), ...r }))
      db[table].push(...created)
      return route.fulfill({ status: 201, headers: CORS, contentType: 'application/json',
        body: JSON.stringify(shape(created)) })
    }

    if (method === 'PATCH') {
      let patch = {}
      try { patch = JSON.parse(req.postData() || '{}') } catch {}
      const targets = applyFilters(db[table], url)
      targets.forEach((t) => Object.assign(t, patch))
      return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json',
        body: JSON.stringify(shape(targets)) })
    }

    if (method === 'DELETE') {
      const targets = applyFilters(db[table], url)
      db[table] = db[table].filter((r) => !targets.includes(r))
      return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json',
        body: JSON.stringify(targets) })
    }

    return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: '[]' })
  })

  // ---------- Storage ----------
  await page.route('**/storage/v1/**', async (route) => {
    const req = route.request()
    const url = req.url()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' })
    log.push(`STORAGE ${req.method()} ${url.split('/storage/v1/')[1]?.slice(0, 60)}`)

    if (url.includes('/sign/')) {
      const path = url.split('/sign/')[1] || 'file'
      return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json',
        body: JSON.stringify({ signedURL: `/storage/v1/object/signed/${path}?token=mock` }) })
    }
    if (req.method() === 'POST') {
      return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json',
        body: JSON.stringify({ Key: 'uploaded' }) })
    }
    if (req.method() === 'DELETE') {
      return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: '[]' })
    }
    return route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: '{}' })
  })

  return { db, log }
}
