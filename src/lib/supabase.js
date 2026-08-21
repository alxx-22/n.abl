import { createClient } from '@supabase/supabase-js'

/* The project constants live in supabaseConfig.js, which imports nothing.
   Code that only needs the URL and the key — analytics.js on the marketing
   page — can take them from there without pulling this module's SDK
   dependency into the bundle. Re-exported here so existing imports of
   SUPABASE_URL / SUPABASE_ANON_KEY from this file keep working. */
export { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig.js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig.js'

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
  /* The compliance gate raises a sentence that explains itself — "blocked by
     compliance gate: x@y on channel email is not permitted (marketing_status
     is do_not_contact)". Replacing that with a generic fallback throws away
     the only part an operator can act on, so it is passed through verbatim.
     Deliberately narrow: it matches the gate's own wording rather than
     surfacing arbitrary database errors, which are not written for people. */
  if (/blocked by compliance gate|monthly ceiling reached|no such lead/i.test(msg)) return msg
  return fallback
}
