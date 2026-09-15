-- ============================================================
-- A LEAD DOES NOT LOSE A LIFE FOR GOOGLE HAVING A BAD AFTERNOON
--
-- STATUS: applied to the live project on 15 September 2026.
--
-- observation_attempts exists to stop the pipeline retrying a lead
-- forever when there is genuinely nothing to say about it. Three
-- strikes and it is set aside.
--
-- It was counting the wrong thing. Every failure incremented it,
-- including the ones where no model ever saw the lead: a 503 from an
-- overloaded model, a timeout, a chain that ran out of budget. Within
-- an hour of the cron restarting that had discarded nine leads -
-- twenty of the twenty-three recorded failures were infrastructure,
-- not judgement, and those leads had never been assessed at all.
--
-- So the count distinguishes them now. A refusal, an empty answer, a
-- clause that broke a rule, an editor that promoted nothing: those are
-- attempts, and three of them mean this lead is not worth a fourth. An
-- outage is not an attempt. The error is still recorded, so it stays
-- visible in the CRM, and the lead waits for a tick that can reach a
-- model.
--
-- The classification is a regex over the error text, which is not
-- elegant. It is wrong in the safe direction: an uncounted real failure
-- costs one more tick, and a counted outage costs the lead.
-- ============================================================

create or replace function public.outreach_record_failure(p_lead_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
declare
  v_error text := left(coalesce(p_error, 'unknown'), 500);
  -- Everything here happens BEFORE a model formed an opinion.
  v_infrastructure boolean := v_error ~* '(no budget left|daily quota reached|too many requests|rate limited|timed out|HTTP 5[0-9][0-9]|not available|bad request|was not JSON|did not return JSON|API key)';
begin
  update public.sales_leads
     set observation_attempts = observation_attempts + (case when v_infrastructure then 0 else 1 end),
         observation_error    = v_error
   where id = p_lead_id;
end
$fn$;

revoke all on function public.outreach_record_failure(uuid, text) from anon, authenticated, public;

-- Give back the lives taken by an outage rather than a judgement.
update public.sales_leads
   set observation_attempts = 0, observation_claimed_at = null, updated_at = now()
 where observation is null
   and observation_attempts > 0
   and observation_error ~* '(no budget left|daily quota reached|too many requests|rate limited|timed out|HTTP 5[0-9][0-9]|not available|bad request)';
