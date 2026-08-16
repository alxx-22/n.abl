-- =====================================================================
-- Revoke public EXECUTE on prune_portal_login_attempts().
--
-- STATUS: APPLIED 2026-08-16.
--
-- WHY
-- The function is maintenance: it deletes login attempts older than 30
-- days. Nothing client-side calls it, but it shipped with the default
-- EXECUTE grant, so any anonymous caller could invoke it through
-- /rest/v1/rpc/prune_portal_login_attempts and make the database run a
-- delete scan on demand.
--
-- WHAT THIS IS NOT
-- It is not a rate-limit bypass, though it looks like one at first
-- glance. The limiter counts failures inside a 15-minute window
-- (202608150002) and this only removes rows older than 30 days, so
-- calling it cannot clear anyone's recent failures. The reason to revoke
-- is narrower: an unauthenticated caller has no business running table
-- maintenance, and an endpoint nobody uses is an endpoint worth closing.
--
-- WHAT IS DELIBERATELY LEFT ALONE
-- portal_login() and current_client_id() keep their anon grant. The first
-- is how a client signs in; the second is referenced by the RLS policies
-- that scope every portal row, and in Postgres the *querying* role needs
-- EXECUTE on a function a policy calls. Revoking either would break the
-- portal for precisely the role it exists to serve.
--
-- rls_auto_enable() is also flagged by the linter and is also left alone:
-- it is a Supabase platform event trigger, not ours, and a function
-- returning `event_trigger` cannot be invoked over RPC anyway.
-- =====================================================================

revoke execute on function public.prune_portal_login_attempts() from public;
revoke execute on function public.prune_portal_login_attempts() from anon;
revoke execute on function public.prune_portal_login_attempts() from authenticated;
