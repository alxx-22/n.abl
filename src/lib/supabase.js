import { createClient } from '@supabase/supabase-js'

/* The anon key is a public, RLS-guarded key — it is safe in the bundle.
   Env vars are supported so the project can be repointed without a code
   change, but the literals keep behaviour identical to the previous site. */
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://rrkcoqopcqtowbyismcq.supabase.co'

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJya2NvcW9wY3F0b3dieWlzbWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNjE1NTksImV4cCI6MjA5NTczNzU1OX0.p8Hj0sULNLos0_nZhJ_OyYyfiqfmAspwFxtLBdoK4R0'

/* ============================================================
   TWO INDEPENDENT CLIENTS — these must never share state.

   1. Team client   — standard Supabase Auth (email/password),
                      session persisted for trusted team devices.
   2. Portal client — built per access key, sends it as the
                      x-access-key header for RLS. Never persisted.
   ============================================================ */

let _teamClient = null

/** Standard-auth client for the internal team space. Singleton. */
export function teamClient() {
  if (!_teamClient) {
    _teamClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'nabl-team-auth',
      },
    })
  }
  return _teamClient
}

/** Access-key client for the client portal. The key lives only in memory. */
export function portalClient(accessKey) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { 'x-access-key': accessKey } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/* ============================================================
   Shared helpers
   ============================================================ */

/** Fresh signed URL for a private storage object. Never cached in the DB. */
export async function signedUrl(client, bucket, path, expiresIn = 3600) {
  if (!client || !bucket || !path) return null
  // Legacy rows may hold a full pasted URL rather than a storage path.
  if (/^https?:\/\//i.test(path)) return path
  try {
    const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresIn)
    if (error || !data) return null
    return data.signedUrl
  } catch {
    return null
  }
}

/** Turn a Supabase error into something a human should read. */
export function friendlyError(err, fallback = 'Something went wrong — please try again.') {
  const msg = (err && (err.message || err.error_description)) || ''
  if (/jwt|token|expired|session|not authenticated|unauthor/i.test(msg)) return 'SESSION_EXPIRED'
  if (/fetch|network|failed to fetch|load failed/i.test(msg)) {
    return 'Unable to reach the server. A browser extension or network may be blocking it.'
  }
  return fallback
}
