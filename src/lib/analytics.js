import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig.js'

/* ============================================================
   FIRST-PARTY, COOKIELESS CONVERSION EVENTS

   The site promises, on two public legal pages, that it runs no
   analytics tracking, sets no analytics cookie and needs no consent
   banner. Those promises are load-bearing — they are a genuine
   differentiator for a business selling judgement about technology —
   so measurement had to fit inside them rather than around them.

   What this does: posts a named event to our own Supabase project,
   which the CSP already allows. What it deliberately does not do:

     * no cookie, no localStorage, no sessionStorage
     * no device or browser fingerprint, no user agent, no IP recorded
     * no identity that survives the tab closing
     * no free text, no form contents, no query strings

   The session id is a random UUID held in a module variable. It groups
   events within one page load so a funnel is legible, and it is gone
   the moment the tab is. It cannot be joined to a person, to another
   visit, or to anything else.

   Failure is silent by design. A visitor's experience must never
   depend on a measurement call, so every failure path resolves rather
   than rejects. See supabase/migrations/202608160002_site_events.sql
   for the schema, the closed event list and the insert-only policy.
   ============================================================ */

const ENDPOINT = `${SUPABASE_URL}/rest/v1/site_events`

/* Per page load. crypto.randomUUID is available in every browser that
   runs this bundle; the fallback keeps a very old one from throwing on
   what is only a grouping key. */
const SESSION_ID = (() => {
  try {
    return crypto.randomUUID()
  } catch {
    return '00000000-0000-4000-8000-' + String(Date.now()).slice(-12).padStart(12, '0')
  }
})()

/* Three buckets, matching the widths the layout is checked at. Coarse
   on purpose: enough to tell a phone from a desktop, not enough to
   contribute to a fingerprint. */
function viewportBucket() {
  if (typeof window === 'undefined') return null
  const w = window.innerWidth
  if (w < 640) return 'narrow'
  if (w < 1180) return 'medium'
  return 'wide'
}

/** Honour Do Not Track. Cheap to respect, and inconsistent not to. */
function optedOut() {
  if (typeof navigator === 'undefined') return false
  return navigator.doNotTrack === '1' || window.doNotTrack === '1'
}

export function track(name, section = null) {
  if (typeof window === 'undefined' || optedOut()) return

  const body = JSON.stringify({
    name,
    section,
    session_id: SESSION_ID,
    viewport: viewportBucket(),
  })

  /* keepalive is what makes this survive the page being navigated away
     from, which is exactly when a CTA click fires. navigator.sendBeacon
     would also survive unload but cannot set the apikey and
     Authorization headers PostgREST requires, so it is not an option
     here. */
  try {
    fetch(ENDPOINT, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'return=minimal',
      },
      body,
    }).catch(() => {})
  } catch {
    /* Never let measurement break the page. */
  }
}

/* ---------- Section reach depth ----------
   One event per session, recording the deepest section reached, sent
   when the visitor leaves. Sending on every section boundary would be
   a dozen writes for one visit and would answer the same question.

   Depth is by document order rather than by scroll position, so it
   stays correct if the section order changes again. */
const ORDER = [
  'hero', 'pillars', 'what-we-do', 'why-nabl', 'how-we-work',
  'toolkit', 'cases', 'pricing', 'credits', 'about', 'contact',
]

export function observeDepth() {
  if (typeof window === 'undefined' || optedOut()) return () => {}

  let deepest = 0
  let sent = false

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        const i = ORDER.indexOf(e.target.id)
        if (i > deepest) deepest = i
      })
    },
    { threshold: 0.4 }
  )

  ORDER.forEach((id) => {
    const el = document.getElementById(id)
    if (el) io.observe(el)
  })

  const flush = () => {
    if (sent) return
    sent = true
    track('section_reach', ORDER[deepest])
  }

  /* visibilitychange is the reliable one — pagehide and beforeunload are
     not fired consistently on mobile when a tab is backgrounded and then
     discarded. */
  const onHide = () => { if (document.visibilityState === 'hidden') flush() }
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', flush)

  return () => {
    io.disconnect()
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', flush)
  }
}
