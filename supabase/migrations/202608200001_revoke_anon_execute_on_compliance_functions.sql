-- =====================================================================
-- Revoke anon EXECUTE on the compliance functions.
--
-- STATUS: APPLIED 2026-08-20 to the live project.
--
-- WHY THIS EXISTS
-- 202608160003 revoked EXECUTE only from PUBLIC. That is enough on a
-- stock PostgreSQL and is not enough on Supabase, which sets default
-- privileges granting EXECUTE on every new function directly to anon,
-- authenticated and service_role. An explicit role grant is not removed
-- by revoking from PUBLIC, so all four SECURITY DEFINER functions were
-- left callable by anon over /rest/v1/rpc — including apply_opt_out,
-- which writes suppression rows and flips lead state.
--
-- 202608160003 has since been corrected to name the roles, so a fresh
-- apply no longer needs this file. It is kept because it ran against
-- the live project and the repository should say what the database
-- actually did.
--
-- WHY IT WAS NOT CAUGHT FIRST
-- scripts/check-compliance-schema.mjs did assert that anon could not
-- execute these, and passed — because its throwaway cluster had no
-- Supabase default privileges, so revoking from PUBLIC really was
-- sufficient there. The harness now replicates those default privileges
-- and reproduces the failure, which was confirmed by reverting the fix
-- and watching all four assertions fail.
-- =====================================================================

revoke all on function public.marketing_suppression_append_only() from anon, authenticated;
revoke all on function public.marketing_sends_guard() from anon, authenticated;

revoke all on function public.marketing_send_allowed(uuid, text, text) from anon;
revoke all on function public.apply_opt_out(uuid, text, text, text, text) from anon;

-- The team still needs both of these.
grant execute on function public.marketing_send_allowed(uuid, text, text) to authenticated;
grant execute on function public.apply_opt_out(uuid, text, text, text, text) to authenticated;
