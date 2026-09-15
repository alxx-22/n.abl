-- ============================================================
-- TWO RUNS CAN NO LONGER TAKE THE SAME LEAD
--
-- STATUS: applied to the live project on 15 September 2026.
--
-- outreach_next_batch was STABLE and took no lock. It read the leads
-- with no observation and handed them over, and nothing recorded that
-- they had been handed over. One run every ten minutes hid that: a
-- batch of three finished in under a minute, so two runs never
-- overlapped and the bug was invisible.
--
-- It stops being invisible the moment you want the queue emptied
-- faster than it fills. Two overlapping runs read the same top of the
-- queue, both read the same homepage, both spend four model calls on
-- it, and both write - and the second write silently replaces the
-- first, including its evidence. That is twice the quota for one
-- sentence, and a race over which sentence survives.
--
-- So the batch is now claimed. The function is volatile, it stamps the
-- rows it hands out inside the same statement that selects them, and
-- SKIP LOCKED means a second run takes the next leads rather than
-- waiting for the first or duplicating it.
--
-- A claim expires. A run that dies mid-batch - the function timing out,
-- the container going away - must not strand its leads forever, so the
-- stamp is a lease, not a flag. Its length is a setting, because the
-- right value is "somewhat longer than a batch takes" and a batch takes
-- longer as the prompts grow.
--
-- Attempts are still counted on failure only. A claim is not an
-- attempt: a lead that was handed out and never reached a model has not
-- been tried, and burning one of its three lives for that would
-- silently discard leads the pipeline never actually looked at.
-- ============================================================

alter table public.sales_leads
  add column if not exists observation_claimed_at timestamptz;

comment on column public.sales_leads.observation_claimed_at is
  'When a pipeline run took this lead out of the queue. A lease, not a flag - it expires after outreach_setting.claim_ttl_seconds so a run that died does not strand its batch.';

create index if not exists sales_leads_observation_queue_idx
  on public.sales_leads (lead_score desc nulls last, created_at)
  where observation is null;

insert into public.outreach_setting (key, value, note) values
  ('claim_ttl_seconds', '600'::jsonb,
   'How long a claimed lead stays out of the queue before another run may take it. Somewhat longer than a batch takes, so a run that died releases its leads rather than stranding them.')
on conflict (key) do nothing;

create or replace function public.outreach_next_batch(p_limit integer default 5)
returns setof jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_ttl interval := make_interval(secs => coalesce(
    (select (value)::text::integer from public.outreach_setting where key = 'claim_ttl_seconds'), 600));
begin
  return query
  with claimed as (
    update public.sales_leads l
       set observation_claimed_at = now()
     where l.id in (
       select c.id from public.sales_leads c
        where c.observation is null
          and c.observation_attempts < 3
          and (c.observation_claimed_at is null or c.observation_claimed_at < now() - v_ttl)
          -- The one absolute exclusion. Article 21(2) has no research carve-out.
          and coalesce(c.opt_out, false) = false
          and not exists (select 1 from public.marketing_suppression s where s.source_lead_id = c.id)
        order by c.lead_score desc nulls last, c.created_at
        limit greatest(p_limit, 0)
        for update skip locked)
    returning l.*)
  select jsonb_build_object(
    'lead_id', l.id,
    'company', l.company,
    'website', nullif(btrim(coalesce(l.website, '')), ''),
    'industry', l.industry,
    'source', l.source,
    'trading_years', nullif(substring(l.signals from 'trading ([0-9]+) years'), '')::integer,
    'sector', l.sector,
    'sector_source', l.sector_source,
    'prior', case when p.sector is null then null else jsonb_build_object(
      'label', p.label, 'note', p.note,
      'needs_booking', p.needs_booking, 'needs_scheduling', p.needs_scheduling,
      'record_heavy', p.record_heavy, 'data_worth_having', p.data_worth_having,
      'public_facing', p.public_facing,
      'technical_capacity', p.technical_capacity,
      'inbound_volume', p.inbound_volume) end,
    'observed', case when o.sector is null then null else jsonb_build_object(
      'n', o.n, 'by_category', o.by_category,
      'technical_capacity', o.technical_capacity,
      'inbound_volume', o.inbound_volume,
      'credit_fit', o.credit_fit) end
  )
  from claimed l
  left join public.sector_service_prior p    on p.sector = l.sector
  left join public.sector_observed_pattern o on o.sector = l.sector
  order by l.lead_score desc nulls last, l.created_at;
end
$function$;

revoke all on function public.outreach_next_batch(integer) from anon, authenticated, public;
