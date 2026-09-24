-- ============================================================
-- A PROJECT OUT OF QUOTA IS NOBODY'S FAULT
--
-- Overnight on 23-24 September the discovery project ran out of its daily
-- quota at about one in the morning. Every tick after that claimed a
-- business, got "no budget left" on its first model call and counted it
-- as a failed attempt; three such ticks and the business was marked
-- failed. Twenty good businesses ended that way, none for anything about
-- them.
--
-- The edge function now checks for budget before it claims anyone, and a
-- quota error mid-business hands it back uncounted (prospect_release for
-- the prospector, prospect_lookup_release below for the research loop).
-- The twenty go back in the queue.
-- ============================================================

create or replace function public.prospect_lookup_release(p_id uuid)
returns void language sql security definer
set search_path = public, pg_catalog as $fn$
  update public.prospect_candidate
     set lookup_claimed_at = null, lookup_attempts = greatest(lookup_attempts - 1, 0), updated_at = now()
   where id = p_id and status = 'researching'
$fn$;
revoke all on function public.prospect_lookup_release(uuid) from anon, authenticated, public;

update public.prospect_candidate
   set status = 'queued', attempts = 0, error = null, claimed_at = null, updated_at = now()
 where status = 'failed'
   and error ~ '(no budget left|daily quota reached|too many requests this minute)';
