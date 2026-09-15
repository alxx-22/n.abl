-- ============================================================
-- THE STORE STOPS SWEEPING A TABLE THAT NO LONGER EXISTS
--
-- STATUS: applied to the live project on 15 September 2026.
--
-- outreach_record_observation ended with:
--
--     delete from public.outreach_page_cache where lead_id = p_lead_id;
--
-- 202609140006 dropped outreach_page_cache, because the scout now
-- fetches and reads a page within one invocation and the text never
-- touches disk. It did not update this function.
--
-- WHY NOTHING CAUGHT IT
--
-- plpgsql does not resolve table names until the statement runs, so
-- the function was created happily and stayed broken. And it could
-- only ever fail on a SUCCESSFUL write - the one path that had never
-- been exercised, because nothing could write until GEMINI_API_KEY was
-- set. The first clause the writer ever produced was thrown away by
-- this line, the lead was recorded as a failure, and the run reported
-- "0 written" while the argument log showed the writer plainly
-- succeeding. Three leads burned their retries on it.
--
-- The lesson worth keeping: a DROP is not finished until you have
-- searched the function bodies for the name you dropped. The check at
-- the bottom of this file does that, and raises rather than warns.
-- ============================================================

create or replace function public.outreach_record_observation(
  p_lead_id     uuid,
  p_observation text,
  p_basis       text,
  p_evidence    text,
  p_model       text
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  update public.sales_leads
     set observation          = p_observation,
         observation_basis    = p_basis,
         observation_evidence = p_evidence,
         observation_model    = p_model,
         observation_at       = now(),
         observation_error    = null,
         updated_at           = now()
   where id = p_lead_id;

  -- Nothing to sweep. Page text is never persisted: the scout fetches
  -- and reads within one invocation. What survives is the evidence
  -- quote on the lead, which is the only part we would ever have to
  -- produce if somebody asked where a claim came from.
end
$function$;

revoke all on function public.outreach_record_observation(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.outreach_record_observation(uuid, text, text, text, text)
  to service_role;

do $$
declare v_bad text;
begin
  select string_agg(p.proname, ', ') into v_bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosrc like '%outreach_page_cache%';
  if v_bad is not null then
    raise exception 'these functions still reference the dropped outreach_page_cache: %', v_bad;
  end if;
end $$;
