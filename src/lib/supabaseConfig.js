/* ============================================================
   PROJECT CONSTANTS ONLY — no SDK import.

   This file exists so that code needing the project URL and the anon
   key does not have to import `supabase.js`, which pulls in
   @supabase/supabase-js and everything it depends on.

   That matters: `analytics.js` runs on the marketing page and talks to
   PostgREST with a plain fetch. Importing the SDK for two string
   constants put 215 KB of client library into the bundle every visitor
   downloads, which defeats the code splitting in App.jsx and the rule
   in business/03-website that a marketing visitor never downloads the
   portal, team or CRM code.

   The anon key is a public, RLS-guarded key — it is safe in the bundle.
   Env vars are supported so the project can be repointed without a code
   change, but the literals keep behaviour identical to the previous
   site.
   ============================================================ */

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://rrkcoqopcqtowbyismcq.supabase.co'

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJya2NvcW9wY3F0b3dieWlzbWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNjE1NTksImV4cCI6MjA5NTczNzU1OX0.p8Hj0sULNLos0_nZhJ_OyYyfiqfmAspwFxtLBdoK4R0'
