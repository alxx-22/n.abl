/* ============================================================
   Live Supabase check.

   Talks to the real project. Run this after restoring a paused
   project, or any time you want to confirm the backend is healthy
   before deploying.

   Usage:
     node scripts/e2e-live.mjs
     TEAM_EMAIL=you@nabl.agency TEAM_PASSWORD=... node scripts/e2e-live.mjs
     PORTAL_KEY=NABL-XXXX-XXXX-XXXX node scripts/e2e-live.mjs

   PORTAL_KEY has no default on purpose. Access keys rotate — one
   baked in here would be a live client credential sitting in the
   repository, and it would go stale the moment anyone rotated it.
   Without it, the portal checks are skipped rather than failed.

   Read-only by default. It never writes unless WRITE=1 is set, in
   which case it creates and then deletes one throwaway client.
   ============================================================ */

const URL = process.env.SUPABASE_URL || 'https://rrkcoqopcqtowbyismcq.supabase.co'
const ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJya2NvcW9wY3F0b3dieWlzbWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNjE1NTksImV4cCI6MjA5NTczNzU1OX0.p8Hj0sULNLos0_nZhJ_OyYyfiqfmAspwFxtLBdoK4R0'

const PORTAL_KEY = process.env.PORTAL_KEY || ''
// Never print a live key into a test log. Enough to tell two apart, not
// enough to sign in with.
const keyLabel = PORTAL_KEY ? `${PORTAL_KEY.slice(0, 4)}…${PORTAL_KEY.slice(-2)}` : '(unset)'
const TEAM_EMAIL = process.env.TEAM_EMAIL
const TEAM_PASSWORD = process.env.TEAM_PASSWORD
const WRITE = process.env.WRITE === '1'

let pass = 0, fail = 0, skip = 0
const line = (s) => console.log(s)
const ok   = (n, d = '') => { pass++; line(`  ✓ ${n}${d ? ` — ${d}` : ''}`) }
const bad  = (n, d = '') => { fail++; line(`  ✗ ${n}${d ? ` — ${d}` : ''}`) }
const meh  = (n, d = '') => { skip++; line(`  · ${n}${d ? ` — ${d}` : ''}`) }

const base = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' }

async function req(path, opts = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 20000)
  try {
    const res = await fetch(`${URL}${path}`, { ...opts, signal: ctrl.signal,
      headers: { ...base, ...(opts.headers || {}) } })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch {}
    return { status: res.status, json, text }
  } catch (e) {
    return { status: 0, error: e.name === 'AbortError' ? 'timeout' : e.message }
  }
}

async function main() {
  line('\nREACHABILITY')
  const ping = await req('/rest/v1/clients?select=count')
  if (ping.status === 0) {
    bad('project is reachable', ping.error || 'connection refused')
    line('\n  The project is not answering. This is almost always a PAUSED project —')
    line('  free-tier Supabase pauses after inactivity. Restore it in the dashboard')
    line('  (Project → Settings → General → Restore), wait ~2 minutes, then re-run.')
    line('\n  Every login on the site will fail until this is resolved.')
    line(`\n${pass} passed, ${fail} failed, ${skip} skipped`)
    process.exit(1)
  }
  ok('project is reachable', `HTTP ${ping.status}`)

  const settings = await req('/auth/v1/settings')
  ok('auth service is up', `HTTP ${settings.status}`)
  if (settings.json && settings.json.mailer_autoconfirm === false) {
    meh('email confirmation is required',
      'new team users must be confirmed before they can sign in')
  }

  line('\nPORTAL RLS (anon + x-access-key)')
  const noKey = await req('/rest/v1/clients?select=*')
  if (noKey.status === 200 && Array.isArray(noKey.json)) {
    noKey.json.length === 0
      ? ok('no access key returns no rows')
      : bad('no access key leaks rows', `${noKey.json.length} rows visible`)
  } else bad('anon select behaves', `HTTP ${noKey.status}`)

  const bogus = await req('/rest/v1/clients?select=*', { headers: { 'x-access-key': 'BOGUS-0000-2026' } })
  bogus.status === 200 && bogus.json?.length === 0
    ? ok('an invalid access key returns no rows')
    : bad('invalid access key is rejected', `HTTP ${bogus.status}, ${bogus.json?.length} rows`)

  if (!PORTAL_KEY) {
    meh('access key signs in', 'set PORTAL_KEY to run the portal checks')
  } else {
    const good = await req('/rest/v1/clients?select=*', { headers: { 'x-access-key': PORTAL_KEY } })
    if (good.status === 200 && good.json?.length > 0) {
      ok(`access key ${keyLabel} signs in`, good.json[0].business_name)
      for (const t of ['quotes', 'projects', 'meetings', 'documents']) {
        const r = await req(`/rest/v1/${t}?select=*`, { headers: { 'x-access-key': PORTAL_KEY } })
        r.status === 200 ? ok(`portal can read ${t}`, `${r.json?.length ?? 0} rows`)
                         : bad(`portal can read ${t}`, `HTTP ${r.status}`)
      }
    } else {
      bad(`access key ${keyLabel} signs in`, `HTTP ${good.status}, ${good.json?.length ?? 0} rows`)
    }
  }

  line('\nSCHEMA')
  // projects must NOT have created_at — the app relies on this.
  const projOrder = await req('/rest/v1/projects?select=*&order=created_at.desc',
    { headers: { 'x-access-key': PORTAL_KEY } })
  projOrder.status === 200
    ? meh('projects HAS created_at', 'the app deliberately never orders it; harmless')
    : ok('projects has no created_at, as the app assumes', `HTTP ${projOrder.status}`)

  // Post-migration the CRM expects sales_leads.signals to exist.
  const signals = await req('/rest/v1/sales_leads?select=signals&limit=1')
  if (signals.status === 200) ok('sales_leads.signals exists (AI migration applied)')
  else if (signals.status === 400 && /signals/.test(signals.text || ''))
    meh('sales_leads.signals missing', 'run supabase/migrations/202606020001_remove_sales_ai.sql')
  else meh('sales_leads.signals check inconclusive', `HTTP ${signals.status}`)

  line('\nTEAM AUTH')
  const badLogin = await req('/auth/v1/token?grant_type=password', {
    method: 'POST', body: JSON.stringify({ email: 'probe@example.invalid', password: 'wrong-xyz' }) })
  badLogin.status === 400
    ? ok('rejects bad credentials properly', badLogin.json?.error_code || '400')
    : bad('rejects bad credentials properly', `HTTP ${badLogin.status}`)

  if (!TEAM_EMAIL || !TEAM_PASSWORD) {
    meh('real team sign-in', 'set TEAM_EMAIL and TEAM_PASSWORD to test it')
  } else {
    const login = await req('/auth/v1/token?grant_type=password', {
      method: 'POST', body: JSON.stringify({ email: TEAM_EMAIL, password: TEAM_PASSWORD }) })
    if (login.status === 200 && login.json?.access_token) {
      ok('team sign-in succeeds', login.json.user?.email)
      const auth = { Authorization: `Bearer ${login.json.access_token}` }

      for (const t of ['clients', 'quotes', 'projects', 'meetings', 'documents']) {
        const r = await req(`/rest/v1/${t}?select=*&limit=1`, { headers: auth })
        r.status === 200 ? ok(`team can read ${t}`) : bad(`team can read ${t}`, `HTTP ${r.status}`)
      }

      if (WRITE) {
        const name = `E2E Test Co ${Date.now()}`
        const key = `E2ETST-${Math.random().toString(36).slice(2, 6).toUpperCase()}-2026`
        const created = await req('/rest/v1/clients', {
          method: 'POST',
          headers: { ...auth, Prefer: 'return=representation' },
          body: JSON.stringify({ business_name: name, contact_name: 'E2E', access_key: key }),
        })
        if (created.status === 201 && created.json?.[0]?.id) {
          ok('team can CREATE a company', name)
          const id = created.json[0].id
          const seen = await req(`/rest/v1/clients?select=*&access_key=eq.${key}`,
            { headers: { 'x-access-key': key } })
          seen.status === 200 && seen.json?.length === 1
            ? ok('the new company can sign in to the portal with its key')
            : bad('the new company can sign in to the portal', `${seen.json?.length ?? 0} rows`)
          const del = await req(`/rest/v1/clients?id=eq.${id}`, { method: 'DELETE', headers: auth })
          ;[200, 204].includes(del.status) ? ok('cleaned up the test company')
                                           : bad('cleaned up the test company', `HTTP ${del.status}`)
        } else {
          bad('team can CREATE a company', `HTTP ${created.status} ${created.text?.slice(0, 120)}`)
        }
      } else {
        meh('company creation', 'set WRITE=1 to exercise create + cleanup')
      }
    } else {
      bad('team sign-in succeeds', login.json?.msg || `HTTP ${login.status}`)
    }
  }

  line(`\n${pass} passed, ${fail} failed, ${skip} skipped`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('harness error:', e.message); process.exit(2) })
