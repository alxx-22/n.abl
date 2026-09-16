-- Targets filter by town, and nothing runs by default.
--
-- Two changes that belong together.
--
-- First: every function that reads a target reads t.towns now, not
-- t.districts. outreach_save_target takes p_towns and validates it the same
-- way - a town nobody is in is a typo, and saying so beats saving a target
-- that will never match a lead.
--
-- Second: the default tickbox was doing two jobs. It said "this is the target
-- the cron uses" and, because the cron only looks at the default, it also
-- said "start running now". Saving a target should not start anything. So
-- starting is its own verb: outreach_start_run makes a target the default,
-- outreach_stop_run clears it, and with no default the cron wakes up, finds
-- no target, and returns having done nothing. The last line of this migration
-- unsets whatever was running when it was applied.
--
-- outreach_start_run refuses a target with nothing queued. Starting a run
-- that has no work is not a run, it is a silent no-op, and the person who
-- pressed the button deserves to be told which it was.

create or replace function public.outreach_next_batch(p_limit integer default 5)
returns setof jsonb language plpgsql security definer
set search_path = public, pg_catalog as $fn$
declare
  v_ttl interval := make_interval(secs => coalesce(
    (select (value)::text::integer from public.outreach_setting where key = 'claim_ttl_seconds'), 600));
  t public.outreach_target%rowtype;
begin
  select * into t from public.outreach_target where is_default and active;
  if not found then return; end if;

  return query
  with claimed as (
    update public.sales_leads l
       set observation_claimed_at = now()
     where l.id in (
       select c.id from public.sales_leads c
        where c.observation is null
          and c.observation_attempts < 3
          and (c.observation_claimed_at is null or c.observation_claimed_at < now() - v_ttl)
          and coalesce(c.opt_out, false) = false
          and not exists (select 1 from public.marketing_suppression s where s.source_lead_id = c.id)
          and (cardinality(t.towns)   = 0 or c.town   = any (t.towns))
          and (cardinality(t.sectors) = 0 or c.sector = any (t.sectors))
          and (t.min_score is null or coalesce(c.lead_score, 0) >= t.min_score)
          and (cardinality(t.capabilities) = 0
               or c.fit_assessed_at is null
               or exists (select 1 from public.lead_service_fit f
                           where f.lead_id = c.id and f.capability = any (t.capabilities)))
        order by c.lead_score desc nulls last, c.created_at
        limit greatest(p_limit, 0)
        for update skip locked)
    returning l.*)
  select jsonb_build_object(
    'lead_id', l.id, 'company', l.company, 'trading_name', l.trading_name,
    'website', nullif(btrim(coalesce(l.website, '')), ''),
    'industry', l.industry, 'source', l.source,
    'trading_years', nullif(substring(l.signals from 'trading ([0-9]+) years'), '')::integer,
    'sector', l.sector, 'sector_source', l.sector_source,
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
$fn$;

create or replace function public.outreach_target_reach(p_target uuid)
returns jsonb language sql stable security definer
set search_path = public, pg_catalog as $fn$
  select jsonb_build_object(
    'matched',   count(*),
    'queued',    count(*) filter (where l.observation is null and l.observation_attempts < 3),
    'drafted',   count(*) filter (where l.observation is not null),
    'given_up',  count(*) filter (where l.observation is null and l.observation_attempts >= 3))
  from public.outreach_target t
  join public.sales_leads l
    on coalesce(l.opt_out, false) = false
   and not exists (select 1 from public.marketing_suppression s where s.source_lead_id = l.id)
   and (cardinality(t.towns)   = 0 or l.town   = any (t.towns))
   and (cardinality(t.sectors) = 0 or l.sector = any (t.sectors))
   and (t.min_score is null or coalesce(l.lead_score, 0) >= t.min_score)
   and (cardinality(t.capabilities) = 0
        or l.fit_assessed_at is null
        or exists (select 1 from public.lead_service_fit f
                    where f.lead_id = l.id and f.capability = any (t.capabilities)))
  where t.id = p_target
$fn$;

-- The signature changes, so the old one has to go rather than be replaced.
drop function if exists public.outreach_save_target(uuid, text, text[], text[], text[], integer, boolean);

create function public.outreach_save_target(
  p_id uuid,
  p_name text,
  p_towns text[] default '{}',
  p_sectors text[] default '{}',
  p_capabilities text[] default '{}',
  p_min_score integer default null,
  p_is_default boolean default false)
returns jsonb language plpgsql security definer
set search_path = public, pg_catalog as $fn$
declare v_id uuid; v_name text := nullif(btrim(p_name), ''); v_bad text[];
begin
  if v_name is null then
    return jsonb_build_object('saved', false, 'why', 'a target needs a name');
  end if;

  select array_agg(x) into v_bad from unnest(coalesce(p_towns, '{}')) x
   where not exists (select 1 from public.sales_leads l where l.town = x);
  if v_bad is not null then
    return jsonb_build_object('saved', false,
      'why', 'no lead is in ' || array_to_string(v_bad, ', '));
  end if;

  select array_agg(x) into v_bad from unnest(coalesce(p_sectors, '{}')) x
   where not exists (select 1 from public.sales_leads l where l.sector = x);
  if v_bad is not null then
    return jsonb_build_object('saved', false,
      'why', 'no lead is in sector ' || array_to_string(v_bad, ', '));
  end if;

  select array_agg(x) into v_bad from unnest(coalesce(p_capabilities, '{}')) x
   where not exists (select 1 from public.outreach_vocabulary v
                      where v.dimension = 'capability' and v.term = x and v.active);
  if v_bad is not null then
    return jsonb_build_object('saved', false,
      'why', 'the registry has no capability called ' || array_to_string(v_bad, ', '));
  end if;

  if p_is_default then
    update public.outreach_target set is_default = false, updated_at = now()
     where is_default and (p_id is null or id <> p_id);
  end if;

  if p_id is null then
    insert into public.outreach_target
      (name, towns, sectors, capabilities, min_score, is_default)
    values (v_name, coalesce(p_towns,'{}'), coalesce(p_sectors,'{}'),
            coalesce(p_capabilities,'{}'), p_min_score, coalesce(p_is_default,false))
    returning id into v_id;
  else
    update public.outreach_target
       set name = v_name, towns = coalesce(p_towns,'{}'),
           sectors = coalesce(p_sectors,'{}'), capabilities = coalesce(p_capabilities,'{}'),
           min_score = p_min_score, is_default = coalesce(p_is_default,false),
           updated_at = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then return jsonb_build_object('saved', false, 'why', 'no such target'); end if;
  end if;

  -- Changing who a run is for never carries an armed send switch with it.
  update public.outreach_target
     set sending_enabled = false, sending_armed_at = null, sending_armed_by = null
   where id = v_id and sending_enabled;

  return jsonb_build_object('saved', true, 'id', v_id, 'running', coalesce(p_is_default, false),
                            'reach', public.outreach_target_reach(v_id));
end
$fn$;

create or replace function public.outreach_start_run(p_target uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_catalog as $fn$
declare t public.outreach_target%rowtype; v_reach jsonb;
begin
  select * into t from public.outreach_target where id = p_target and active;
  if not found then return jsonb_build_object('running', false, 'why', 'no such target'); end if;

  v_reach := public.outreach_target_reach(p_target);
  if coalesce((v_reach->>'queued')::integer, 0) = 0 then
    return jsonb_build_object('running', false,
      'why', 'that target has nothing queued, so starting it would do nothing',
      'reach', v_reach);
  end if;

  update public.outreach_target set is_default = false, updated_at = now()
   where is_default and id <> p_target;
  update public.outreach_target set is_default = true, updated_at = now()
   where id = p_target;
  return jsonb_build_object('running', true, 'target', t.name, 'reach', v_reach);
end
$fn$;

create or replace function public.outreach_stop_run()
returns jsonb language sql security definer
set search_path = public, pg_catalog as $fn$
  with x as (
    update public.outreach_target set is_default = false, updated_at = now()
     where is_default returning name)
  select jsonb_build_object('running', false, 'stopped', coalesce((select name from x), 'nothing was running'))
$fn$;

revoke all on function public.outreach_save_target(uuid, text, text[], text[], text[], integer, boolean)
  from anon, authenticated, public;
revoke all on function public.outreach_start_run(uuid) from anon, authenticated, public;
revoke all on function public.outreach_stop_run() from anon, authenticated, public;

-- Nothing runs until somebody presses start.
update public.outreach_target set is_default = false where is_default;
