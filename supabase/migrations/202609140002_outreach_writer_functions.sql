-- ============================================================
-- WHAT THE WRITER ASKS THE DATABASE FOR
--
-- STATUS: applied to the live project on 14 September 2026.
--
-- The edge function holds the prompts and the HTTP. Everything about
-- WHICH leads and WHETHER there is budget lives here, where it can be
-- read, queried and argued with in SQL rather than buried in TypeScript.
-- ============================================================

-- ---------- which leads need writing ----------
--
-- The first version of this refused any lead whose marketing_status was
-- 'do_not_contact'. That excluded all 149, and on looking at why, the
-- exclusion was wrong. 'do_not_contact' is promote.mjs's default when
-- --permit is not passed: our own caution, not an objection from the
-- business. opt_out is the objection, and that one is absolute.
--
-- More to the point, writing the observation SERVES gate 1 rather than
-- bypassing it. A person cannot judge whether a lead is worth
-- contacting against a blank field - you cannot decide whether to write
-- to a business until you can see what you would say to it. Withholding
-- the observation until after the gate makes the gate a coin toss.
--
-- Nothing here sends. marketing_send_allowed is a separate gate and is
-- untouched.
--
-- The suppression check matches source_lead_id only, which is NOT the
-- full suppression test: marketing_suppression also suppresses by
-- identifier and scope, so a domain can be suppressed with no lead id
-- attached. That fuller check belongs to marketing_send_allowed. This
-- is a cheap early exit so an obviously suppressed lead does not have
-- money spent on it, not a substitute for the gate.

create or replace function public.outreach_next_batch(p_limit integer default 5)
returns table (
  lead_id        uuid,
  company        text,
  website        text,
  industry       text,
  signals        text,
  source         text,
  trading_years  integer,
  sector         text
)
language sql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $function$
  select
    l.id,
    l.company,
    nullif(btrim(coalesce(l.website, '')), ''),
    l.industry,
    l.signals,
    l.source,
    -- signals reads like "address the business gave for itself; sector
    -- hint: property; trading 4 years". Both facts are in there and
    -- neither has a column of its own, so they are parsed rather than
    -- left unused - which is the mistake observe.mjs made for a month.
    nullif(substring(l.signals from 'trading ([0-9]+) years'), '')::integer,
    nullif(substring(l.signals from 'sector hint: ([a-z]+)'), '')
  from public.sales_leads l
  where l.observation is null
    -- Three strikes. A page that has failed three times will not succeed
    -- on the fourth, and retrying forever spends the day's allowance on
    -- the same broken site.
    and l.observation_attempts < 3
    -- The one absolute exclusion. An objection is an objection, and
    -- Article 21(2) has no research carve-out.
    and coalesce(l.opt_out, false) = false
    and not exists (
      select 1 from public.marketing_suppression s where s.source_lead_id = l.id
    )
  order by l.lead_score desc nulls last, l.created_at
  limit greatest(p_limit, 0)
$function$;

comment on function public.outreach_next_batch(integer) is
  'Leads still needing an observation, best-scoring first. Excludes opted-out and lead-id-suppressed records, and anything that has failed three times. Does NOT filter on marketing_status: writing the observation serves the human approval gate rather than bypassing it, and nothing in this pipeline sends.';

-- ---------- is there budget ----------

create or replace function public.outreach_model_budget(p_model text, p_default_rpd integer)
returns integer
language sql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $function$
  -- An observed ceiling always beats the caller's published figure: if
  -- the API said 429 at 180, 180 is the number whatever a documentation
  -- page claims.
  select greatest(
    coalesce(
      (select case when u.exhausted then 0
                   else coalesce(u.observed_rpd, p_default_rpd) - u.used end
         from public.outreach_model_usage u
        where u.usage_day = public.outreach_quota_day() and u.model = p_model),
      p_default_rpd),
    0)
$function$;

create or replace function public.outreach_record_call(
  p_model text,
  p_rate_limited boolean default false
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  insert into public.outreach_model_usage as u
    (usage_day, model, used, first_call_at, last_call_at)
  values (public.outreach_quota_day(), p_model, 1, now(), now())
  on conflict (usage_day, model) do update
    set used = u.used + 1, last_call_at = now();

  if p_rate_limited then
    -- The API is the authority. Record what we actually reached as the
    -- ceiling and stop using this model until tomorrow.
    update public.outreach_model_usage
       set exhausted = true, observed_rpd = used
     where usage_day = public.outreach_quota_day() and model = p_model;
  end if;
end
$function$;

-- ---------- storing the result ----------

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

  -- The page has done its job. What we would have to produce if
  -- challenged is the evidence quote, and that is now on the lead.
  delete from public.outreach_page_cache where lead_id = p_lead_id;
end
$function$;

create or replace function public.outreach_record_failure(p_lead_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  update public.sales_leads
     set observation_attempts = observation_attempts + 1,
         observation_error    = left(coalesce(p_error, 'unknown'), 500)
   where id = p_lead_id;
end
$function$;

-- ---------- housekeeping and the run log ----------

create or replace function public.outreach_sweep_page_cache()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare n integer;
begin
  -- A run that dies between fetching and writing leaves a page behind.
  -- Nothing needs a cached page a day later.
  delete from public.outreach_page_cache where fetched_at < now() - interval '1 day';
  get diagnostics n = row_count;
  return n;
end
$function$;

create or replace function public.outreach_log_run(
  p_attempted integer,
  p_written   integer,
  p_rejected  integer,
  p_detail    jsonb default null,
  p_error     text  default null
)
returns public.outreach_runs
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare r public.outreach_runs;
begin
  insert into public.outreach_runs (finished_at, attempted, written, rejected, detail, error)
  values (now(), coalesce(p_attempted,0), coalesce(p_written,0), coalesce(p_rejected,0), p_detail, p_error)
  returning * into r;
  return r;
end
$function$;

-- ---------- one place to look ----------

create or replace view public.outreach_status as
select
  (select count(*) from public.sales_leads
    where observation is null and observation_attempts < 3
      and coalesce(opt_out,false) = false)                    as waiting,
  (select count(*) from public.sales_leads
    where observation is not null)                            as written,
  (select count(*) from public.sales_leads
    where observation is null and observation_attempts >= 3)  as given_up,
  (select count(distinct observation) from public.sales_leads
    where observation is not null)                            as distinct_sentences,
  (select max(observation_at) from public.sales_leads)        as last_written_at,
  (select jsonb_object_agg(model, jsonb_build_object(
            'used', used, 'exhausted', exhausted, 'observed_rpd', observed_rpd))
     from public.outreach_model_usage
    where usage_day = public.outreach_quota_day())            as today_by_model,
  (select count(*) from public.outreach_page_cache)           as pages_cached,
  (select jsonb_build_object('at', started_at, 'attempted', attempted,
            'written', written, 'rejected', rejected, 'error', error)
     from public.outreach_runs order by started_at desc limit 1) as last_run;

comment on view public.outreach_status is
  'distinct_sentences against written is the number this whole design exists to move: in August it was 9 across 77 drafts.';

-- ---------- these belong to the service role alone ----------
--
-- `revoke from public` is not enough on Supabase: ALTER DEFAULT
-- PRIVILEGES grants EXECUTE to anon and authenticated directly, so
-- revoking from PUBLIC leaves both holding their own grant. The same
-- gap was found and fixed in 202608200001; this applies that lesson on
-- the way in rather than afterwards. Verified with get_advisors: none
-- of these appear in the anon or authenticated SECURITY DEFINER lints.
do $$
declare f text;
begin
  foreach f in array array[
    'public.outreach_next_batch(integer)',
    'public.outreach_model_budget(text, integer)',
    'public.outreach_record_call(text, boolean)',
    'public.outreach_record_observation(uuid, text, text, text, text)',
    'public.outreach_record_failure(uuid, text)',
    'public.outreach_sweep_page_cache()',
    'public.outreach_log_run(integer, integer, integer, jsonb, text)',
    'public.outreach_quota_day()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

revoke all on public.outreach_status from anon, authenticated;
grant select on public.outreach_status to service_role;
