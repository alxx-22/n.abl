-- ============================================================
-- PROMPTS IN THE DATABASE, AND THE PAGE CACHE REMOVED
--
-- STATUS: applied to the live project on 14 September 2026.
-- ============================================================

-- ---------- the page cache is gone, and its absence is an improvement ----------
--
-- The first design fetched a page in one step and read it in another,
-- so the text had to be parked in between. The assess stage now fetches
-- and reads within a single invocation, so page text never touches disk
-- at all. Nothing to hold, nothing to sweep, nothing to explain to
-- anyone asking what we keep about their website.
--
-- What survives is what we would actually have to produce if
-- challenged: the evidence quote on the lead, and the quote on each
-- service verdict. That was always the only part worth keeping.

select cron.unschedule('outreach-sweep-pages')
where exists (select 1 from cron.job where jobname = 'outreach-sweep-pages');

drop view if exists public.outreach_status;
drop function if exists public.outreach_sweep_page_cache();
drop table if exists public.outreach_page_cache;

-- ---------- the prompts ----------
--
-- Two reasons, and the second is the real one.
--
-- 1. The edge function shrinks, which makes it easier to review.
--
-- 2. THE VOICE IS ALEX'S JOB AND SHOULD NOT NEED A DEPLOY. The worked
--    examples in the write prompt are what every sentence a stranger
--    reads is modelled on. They are not in his voice yet, and rewriting
--    them is the highest-value edit anyone can make to this system.
--    Behind `supabase functions deploy` that never happens. As an
--    UPDATE it takes effect on the next tick.
--
-- The trade is that a bad edit reaches production without review. That
-- is acceptable BECAUSE THE GUARDS ARE IN CODE, NOT IN THE PROMPT. A
-- mangled prompt produces rejected verdicts and no observation, visible
-- in outreach_status within the hour. It cannot produce a confident
-- falsehood, because every claim is still checked against the page or
-- the fact sheet.

create table if not exists public.outreach_prompt (
  key         text primary key check (key in ('assess', 'write')),
  body        text not null,
  temperature numeric not null check (temperature >= 0 and temperature <= 2),
  note        text not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

comment on table public.outreach_prompt is
  'System prompts for the outreach writer, editable without a deploy. The guards that keep generated prose honest are in code, not here, so a bad edit costs rejected verdicts rather than a false claim.';
comment on column public.outreach_prompt.temperature is
  'assess runs cold because it is analysis. write runs hot because a batch of letters at temperature 0 converges on one sentence, which is the bulk-sender fingerprint this system exists to avoid.';

alter table public.outreach_prompt enable row level security;
revoke all on public.outreach_prompt from anon, authenticated;

create or replace function public.outreach_prompts()
returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_catalog'
as $function$
  select coalesce(jsonb_object_agg(key, jsonb_build_object(
    'body', body, 'temperature', temperature)), '{}'::jsonb)
  from public.outreach_prompt
$function$;

revoke all on function public.outreach_prompts() from public, anon, authenticated;
grant execute on function public.outreach_prompts() to service_role;

-- The prompt bodies themselves are data, not schema, and are long. They
-- were inserted separately; see business/11-outreach/supabase-writer.md
-- for how to read and edit them. If this migration is ever replayed
-- against an empty project, the writer will refuse to run with
-- "public.outreach_prompt is missing the assess or write row", which is
-- the correct failure: it is better to stop than to invent a prompt.

-- ---------- status, rebuilt ----------

create view public.outreach_status as
select
  (select count(*) from public.sales_leads
    where observation is null and observation_attempts < 3
      and coalesce(opt_out,false) = false)                    as waiting,
  (select count(*) from public.sales_leads where observation is not null)     as written,
  (select count(*) from public.sales_leads where fit_assessed_at is not null) as assessed,
  (select count(*) from public.sales_leads
    where observation is null and observation_attempts >= 3)  as given_up,
  (select count(distinct observation) from public.sales_leads
    where observation is not null)                            as distinct_sentences,
  (select max(observation_at) from public.sales_leads)        as last_written_at,
  (select jsonb_object_agg(web_presence, n) from (
     select web_presence, count(*) n from public.sales_leads
      where web_presence is not null group by web_presence) x) as by_web_presence,
  (select jsonb_object_agg(credit_fit, n) from (
     select credit_fit, count(*) n from public.sales_leads
      where credit_fit is not null group by credit_fit) x)     as by_credit_fit,
  (select jsonb_object_agg(category, n) from (
     select category, count(*) n from public.lead_service_fit
      where fit = 'strong' group by category) x)               as strong_fits_by_category,
  (select jsonb_object_agg(model, jsonb_build_object(
            'used', used, 'exhausted', exhausted, 'observed_rpd', observed_rpd))
     from public.outreach_model_usage
    where usage_day = public.outreach_quota_day())            as today_by_model,
  (select jsonb_build_object('at', started_at, 'attempted', attempted,
            'written', written, 'rejected', rejected, 'error', error)
     from public.outreach_runs order by started_at desc limit 1) as last_run;

comment on view public.outreach_status is
  'distinct_sentences against written is the number this design exists to move: in August it was 9 across 77 drafts. strong_fits_by_category is the one to watch for over-claiming - if every lead is a strong fit for everything, the assessment has stopped discriminating.';

revoke all on public.outreach_status from anon, authenticated;
grant select on public.outreach_status to service_role;
