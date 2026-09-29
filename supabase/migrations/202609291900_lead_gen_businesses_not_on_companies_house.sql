-- ============================================================
-- BUSINESSES THAT ARE NOT ON COMPANIES HOUSE
--
-- The owner, 29 September: include sole traders. They file nothing at
-- Companies House, so a target can now pull from two open sources as well:
--
--   fsa  the Food Standards Agency's food hygiene register (every food
--        business a council has inspected, sole traders included)
--   osm  OpenStreetMap (hairdressers, barbers, beauty, garages, vets...)
--
-- Nothing here changes who may be contacted, or how. A business found in
-- either source has no company number and so no proof of its legal form:
-- it is promoted with subscriber_type 'unknown' and lawful_basis
-- 'unassessed', and arrives do_not_contact. The send gate already refuses
-- email to an unknown or individual subscriber (PECR regulation 22) and
-- still refuses every phone call: phone opens only with TPS and CTPS
-- screening, which is a separate change (business/07-crm/compliance-schema.md
-- section 2.4). A published phone number found in a source is kept for that
-- day, on the candidate and then on a "Public contact route" contact; no
-- agent is ever shown it.
-- ============================================================

-- ---------- where a target pulls from ----------

alter table public.prospect_target
  add column if not exists source text not null default 'companies_house',
  add column if not exists source_query jsonb not null default '{}'::jsonb;

alter table public.prospect_target drop constraint if exists prospect_target_source_known;
alter table public.prospect_target add constraint prospect_target_source_known
  check (source in ('companies_house', 'fsa', 'osm'));

comment on column public.prospect_target.source_query is
  'fsa: {"authorities":[FSA LocalAuthorityId...],"business_types":[FSA BusinessTypeId...]}; '
  'osm: {"kinds":[local.mjs OSM_KINDS keys],"areas":[local.mjs OSM_AREAS names]}. '
  'For these sources cursor and exhausted_towns are keyed by unit ("87:7844", "Alcester"), not town.';

-- ---------- a business with no company number ----------

alter table public.prospect_candidate alter column company_number drop not null;

alter table public.prospect_candidate
  add column if not exists source text not null default 'companies_house',
  add column if not exists source_ref text,
  add column if not exists source_detail jsonb,
  add column if not exists website_hint text,
  add column if not exists phone text;

update public.prospect_candidate
   set source_ref = 'ch:' || company_number
 where source_ref is null and company_number is not null;

create unique index if not exists prospect_candidate_source_ref on public.prospect_candidate (source_ref);

-- The Companies House pull (prospect_insert_candidates) predates source_ref
-- and keeps working untouched: its rows get theirs here.
create or replace function public.prospect_candidate_fill_source_ref()
returns trigger language plpgsql
set search_path = public, pg_catalog as $fn$
begin
  if new.source_ref is null and new.source = 'companies_house' and new.company_number is not null then
    new.source_ref := 'ch:' || new.company_number;
  end if;
  return new;
end
$fn$;
revoke all on function public.prospect_candidate_fill_source_ref() from anon, authenticated, public;

drop trigger if exists prospect_candidate_source_ref_fill on public.prospect_candidate;
create trigger prospect_candidate_source_ref_fill
before insert on public.prospect_candidate
for each row execute function public.prospect_candidate_fill_source_ref();

alter table public.prospect_candidate drop constraint if exists prospect_candidate_source_known;
alter table public.prospect_candidate add constraint prospect_candidate_source_known check (
  source in ('companies_house', 'fsa', 'osm')
  and (source <> 'companies_house' or company_number is not null)
  and source_ref is not null);

-- Only ever a UK number in E.164, and only from the source or the
-- business's own site: local.mjs normalisePhone. Never a model's.
alter table public.prospect_candidate drop constraint if exists prospect_candidate_phone_shape;
alter table public.prospect_candidate add constraint prospect_candidate_phone_shape
  check (phone is null or phone ~ '^\+44[1-35-8][0-9]{8,9}$');

comment on column public.prospect_candidate.phone is
  'The business''s own published number (E.164), from the source listing. For a person to call after TPS/CTPS screening; never shown to an agent.';

-- ---------- open data is a source category of its own ----------
-- Neither a directory someone curates nor a licensed dataset: say what it is.

alter table public.sales_leads drop constraint if exists sales_leads_source_check;
alter table public.sales_leads add constraint sales_leads_source_check
  check (source is null or source in (
    'companies_house', 'own_website', 'industry_directory', 'local_directory', 'council_directory',
    'public_company_information', 'licensed_dataset', 'referral', 'inbound_enquiry', 'event',
    'manual_research', 'open_data'));

-- ---------- what to pull next ----------

create or replace function public.prospect_pull_plan()
returns jsonb language plpgsql stable security definer
set search_path = public, pg_catalog as $fn$
declare
  t public.prospect_target%rowtype;
  v_low integer := coalesce((select (value)::text::integer from public.prospect_setting where key = 'queue_low_water'), 4);
  v_waiting integer;
  v_town text;
  v_unit text;
begin
  select * into t from public.prospect_target where running and active;
  if not found then return null; end if;

  select count(*) into v_waiting from public.prospect_candidate
   where target_id = t.id and status in ('queued', 'working');
  if v_waiting >= v_low then return null; end if;

  if t.source = 'companies_house' then
    select town into v_town from unnest(t.towns) town
     where not (town = any (t.exhausted_towns))
     order by coalesce((t.cursor ->> town)::integer, 0), town
     limit 1;
    if v_town is null then return null; end if;

    return jsonb_build_object(
      'source', 'companies_house',
      'target_id', t.id, 'town', v_town,
      'start_index', coalesce((t.cursor ->> v_town)::integer, 0),
      'sic_codes', to_jsonb(t.sic_codes), 'company_types', to_jsonb(t.company_types),
      'incorporated_from', t.incorporated_from, 'incorporated_to', t.incorporated_to,
      'waiting', v_waiting);
  end if;

  -- A local source is pulled a unit at a time: a council and a business
  -- type for the FSA (paged, cursor = next page), a place for OSM.
  select u into v_unit
    from (
      select a::text || ':' || b::text as u
        from jsonb_array_elements_text(coalesce(t.source_query -> 'authorities', '[]')) a,
             jsonb_array_elements_text(coalesce(t.source_query -> 'business_types', '[]')) b
       where t.source = 'fsa'
      union all
      select a from jsonb_array_elements_text(coalesce(t.source_query -> 'areas', '[]')) a
       where t.source = 'osm'
    ) units
   where not (u = any (t.exhausted_towns))
   order by coalesce((t.cursor ->> u)::integer, 0), u
   limit 1;
  if v_unit is null then return null; end if;

  return jsonb_build_object(
    'source', t.source, 'target_id', t.id, 'unit', v_unit,
    'page', greatest(coalesce((t.cursor ->> v_unit)::integer, 1), 1),
    'query', t.source_query, 'waiting', v_waiting);
end
$fn$;

-- ---------- a page of businesses from a local source ----------
-- Skips anyone already pulled (by source reference), anyone already a lead
-- (by the evidence the lead was promoted with), and anyone whose name and
-- postcode match a business already pulled from any source.

create or replace function public.prospect_insert_local(
  p_target_id uuid, p_unit text, p_next_page integer, p_exhausted boolean, p_rows jsonb)
returns integer language plpgsql security definer
set search_path = public, pg_catalog as $fn$
declare v_n integer;
begin
  with incoming as (
    select * from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(
      source text, source_ref text, company_name text, activity text, town text, postcode text,
      address text, phone text, website_hint text, source_detail jsonb)
    where x.source in ('fsa', 'osm')
      and x.source_ref ~ '^(fsa:[0-9]+|osm:(node|way|relation)/[0-9]+)$'
      and nullif(btrim(x.company_name), '') is not null
  ), once as (
    -- The same business twice in one page (FSA lists a café and its
    -- takeaway counter separately) is one business.
    select i.*, row_number() over (
             partition by upper(regexp_replace(i.company_name, '[^A-Za-z0-9]', '', 'g')), coalesce(i.postcode, i.source_ref)
             order by i.source_ref) as nth
      from incoming i
  ), fresh as (
    select i.* from once i
     where i.nth = 1
       and not exists (select 1 from public.sales_leads l
                        where l.subscriber_type_evidence = public.prospect_source_evidence(i.source, i.source_ref))
       and not exists (select 1 from public.prospect_candidate c
                        where i.postcode is not null and c.postcode = i.postcode
                          and upper(regexp_replace(c.company_name, '[^A-Za-z0-9]', '', 'g'))
                            = upper(regexp_replace(i.company_name, '[^A-Za-z0-9]', '', 'g')))
  ), ins as (
    insert into public.prospect_candidate
      (target_id, source, source_ref, company_name, activity, town, postcode, address,
       phone, website_hint, source_detail)
    select p_target_id, source, source_ref, btrim(company_name), activity, town, postcode, address,
           case when phone ~ '^\+44[1-35-8][0-9]{8,9}$' then phone end,
           case when website_hint ~* '^https?://' then website_hint end,
           source_detail
      from fresh
    on conflict (source_ref) do nothing
    returning 1)
  select count(*) into v_n from ins;

  update public.prospect_target
     set cursor = cursor || jsonb_build_object(p_unit, greatest(coalesce(p_next_page, 1), 1)),
         exhausted_towns = case when p_exhausted and not (p_unit = any (exhausted_towns))
                                then exhausted_towns || p_unit else exhausted_towns end,
         pulled = pulled + v_n,
         updated_at = now()
   where id = p_target_id;
  return v_n;
end
$fn$;

-- The evidence string a lead from a local source is promoted with, so a
-- second pull recognises it. Companies House keeps its own form.
create or replace function public.prospect_source_evidence(p_source text, p_ref text)
returns text language sql immutable
set search_path = pg_catalog as $fn$
  select case p_source
    when 'fsa' then 'Food Standards Agency food hygiene register ' || regexp_replace(p_ref, '^fsa:', '')
    when 'osm' then 'OpenStreetMap ' || regexp_replace(p_ref, '^osm:', '')
    else null end
$fn$;

-- ---------- saving and starting a target ----------

drop function if exists public.prospect_save_target(uuid, text, text[], text[], date, date);

create or replace function public.prospect_save_target(
  p_id uuid, p_name text, p_towns text[], p_sic_codes text[], p_incorporated_from date default null, p_incorporated_to date default null,
  p_source text default 'companies_house', p_source_query jsonb default null)
returns uuid language plpgsql security definer
set search_path = public, pg_catalog as $fn$
declare
  v_id uuid;
  v_source text := coalesce(nullif(btrim(p_source), ''), 'companies_house');
  v_towns text[] := array(select distinct initcap(btrim(t)) from unnest(coalesce(p_towns, '{}')) t
                           where btrim(t) <> '' and btrim(t) !~ '[0-9]');
  v_sic text[] := array(select distinct btrim(s) from unnest(coalesce(p_sic_codes, '{}')) s where btrim(s) <> '');
  v_query jsonb := '{}'::jsonb;
  v_same boolean;
begin
  if nullif(btrim(coalesce(p_name, '')), '') is null then raise exception 'a target needs a name'; end if;
  if v_source not in ('companies_house', 'fsa', 'osm') then raise exception 'unknown source %', v_source; end if;

  if v_source = 'companies_house' then
    if cardinality(v_towns) = 0 then raise exception 'a target needs at least one town (a town, not a postcode)'; end if;
    if exists (select 1 from unnest(v_sic) s where s !~ '^[0-9]{2,5}$') then
      raise exception 'SIC codes are two to five digits';
    end if;
    if p_incorporated_from is not null and p_incorporated_to is not null and p_incorporated_from > p_incorporated_to then
      raise exception 'incorporated from is after incorporated to';
    end if;
  elsif v_source = 'fsa' then
    -- Whole numbers only; which councils and types exist is the edge
    -- function's list (local.mjs), and anything else is ignored there.
    v_query := jsonb_build_object(
      'authorities', coalesce((select jsonb_agg(distinct (x)::integer) from jsonb_array_elements_text(p_source_query -> 'authorities') x where x ~ '^[0-9]{1,5}$'), '[]'),
      'business_types', coalesce((select jsonb_agg(distinct (x)::integer) from jsonb_array_elements_text(p_source_query -> 'business_types') x where x ~ '^[0-9]{1,5}$'), '[]'));
    if jsonb_array_length(v_query -> 'authorities') = 0 then raise exception 'pick at least one council'; end if;
    if jsonb_array_length(v_query -> 'business_types') = 0 then raise exception 'pick at least one kind of food business'; end if;
    v_towns := '{}'; v_sic := '{}';
  else
    v_query := jsonb_build_object(
      'kinds', coalesce((select jsonb_agg(distinct x) from jsonb_array_elements_text(p_source_query -> 'kinds') x where x ~ '^[a-z_]{2,20}$'), '[]'),
      'areas', coalesce((select jsonb_agg(distinct x) from jsonb_array_elements_text(p_source_query -> 'areas') x where x ~ '^[A-Za-z][A-Za-z -]{1,39}$'), '[]'));
    if jsonb_array_length(v_query -> 'kinds') = 0 then raise exception 'pick at least one kind of business'; end if;
    if jsonb_array_length(v_query -> 'areas') = 0 then raise exception 'pick at least one place'; end if;
    v_towns := array(select jsonb_array_elements_text(v_query -> 'areas')); v_sic := '{}';
  end if;

  if p_id is null then
    insert into public.prospect_target (name, towns, sic_codes, incorporated_from, incorporated_to, source, source_query)
    values (btrim(p_name), v_towns, v_sic,
            case when v_source = 'companies_house' then p_incorporated_from end,
            case when v_source = 'companies_house' then p_incorporated_to end,
            v_source, v_query)
    returning id into v_id;
  else
    select t.source = v_source and t.sic_codes = v_sic and t.source_query = v_query
           and t.incorporated_from is not distinct from p_incorporated_from
           and t.incorporated_to is not distinct from p_incorporated_to
      into v_same from public.prospect_target t where t.id = p_id;
    if v_same is null then raise exception 'no such target'; end if;
    -- A changed search starts from page one; an unchanged one keeps its place.
    update public.prospect_target t
       set name = btrim(p_name), towns = v_towns, sic_codes = v_sic,
           incorporated_from = case when v_source = 'companies_house' then p_incorporated_from end,
           incorporated_to = case when v_source = 'companies_house' then p_incorporated_to end,
           source = v_source, source_query = v_query,
           cursor = case when v_same then t.cursor else '{}'::jsonb end,
           exhausted_towns = case when v_same and v_source = 'companies_house'
                                  then array(select x from unnest(t.exhausted_towns) x where x = any (v_towns))
                                  when v_same then t.exhausted_towns
                                  else '{}' end,
           updated_at = now()
     where t.id = p_id
     returning t.id into v_id;
  end if;
  return v_id;
end
$fn$;

create or replace function public.prospect_start(p_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_catalog as $fn$
begin
  if not exists (
    select 1 from public.prospect_target
     where id = p_id and active
       and ((source = 'companies_house' and cardinality(towns) > 0)
            or (source = 'fsa' and jsonb_array_length(coalesce(source_query -> 'authorities', '[]')) > 0
                               and jsonb_array_length(coalesce(source_query -> 'business_types', '[]')) > 0)
            or (source = 'osm' and jsonb_array_length(coalesce(source_query -> 'kinds', '[]')) > 0
                               and jsonb_array_length(coalesce(source_query -> 'areas', '[]')) > 0))) then
    raise exception 'save the target with somewhere to look first';
  end if;
  update public.prospect_target set running = false, updated_at = now() where running and id <> p_id;
  update public.prospect_target set running = true, updated_at = now() where id = p_id;
end
$fn$;

-- ---------- promotion ----------
-- A company found at Companies House arrives exactly as before. A business
-- from a local source arrives with what is honestly known: its legal form
-- is unknown, so is whether a person's data is in it, and nothing about it
-- has been assessed. The gate refuses every channel for it until a person
-- resolves that in Leads.

create or replace function public.prospect_promote(p_id uuid)
returns uuid language plpgsql security definer
set search_path = public, pg_catalog as $fn$
declare
  c public.prospect_candidate%rowtype;
  v_lead uuid;
  v_fits text;
  v_evidence text;
begin
  select * into c from public.prospect_candidate where id = p_id for update;
  if not found then raise exception 'no such candidate'; end if;
  if c.status = 'promoted' then return c.promoted_lead_id; end if;
  if c.status not in ('scored', 'disputed', 'no_fit') then
    raise exception 'only a candidate the agents have finished with can be promoted';
  end if;

  v_evidence := case when c.source = 'companies_house' then 'Companies House ' || c.company_number
                     else public.prospect_source_evidence(c.source, c.source_ref) end;
  if exists (select 1 from public.sales_leads where subscriber_type_evidence = v_evidence) then
    raise exception 'already a lead';
  end if;

  select string_agg(format('%s %s (%s)', s ->> 'service',
                           coalesce(s ->> 'score', '-'), s ->> 'status'), ', '
                    order by (s ->> 'score')::integer desc nulls last)
    into v_fits
    from jsonb_array_elements(coalesce(c.services, '[]'::jsonb)) s;

  if c.source = 'companies_house' then
    insert into public.sales_leads (
      company, website, industry, location, lead_score, status, notes,
      subscriber_type, subscriber_type_evidence, subscriber_type_checked_at,
      lawful_basis, source, source_detail, source_date,
      privacy_notice_status, marketing_status)
    values (
      c.company_name, c.website, c.activity,
      nullif(concat_ws(', ', nullif(c.address, ''), nullif(c.postcode, '')), ''),
      greatest(coalesce(c.lead_score, 50), 1), 'New Lead',
      concat_ws(' ', 'Found by the lead-gen agents.',
                case when v_fits is not null then 'Agreed scores: ' || v_fits || '.' end,
                'The full argument is on the candidate in Lead gen.'),
      'corporate', v_evidence, now(),
      'not_personal_data', 'companies_house',
      concat_ws('; ', 'Companies House REST API',
                case when c.website is not null then 'site confirmed by ' || array_to_string(c.website_confirmed_by, ' + ') end),
      c.pulled_at::date, 'not_required', 'do_not_contact')
    returning id into v_lead;
  else
    insert into public.sales_leads (
      company, website, industry, location, lead_score, status, notes,
      subscriber_type, subscriber_type_evidence, subscriber_type_checked_at,
      lawful_basis, source, source_detail, source_date,
      privacy_notice_status, marketing_status)
    values (
      c.company_name, c.website, c.activity,
      nullif(concat_ws(', ', nullif(c.address, ''), nullif(c.postcode, '')), ''),
      greatest(coalesce(c.lead_score, 50), 1), 'New Lead',
      concat_ws(' ', 'Found by the lead-gen agents, from ' ||
                case c.source when 'fsa' then 'the food hygiene register' else 'OpenStreetMap' end || '.',
                'Not on Companies House as far as the pull shows: it may be a sole trader or partnership,',
                'so it must not be emailed without consent, and a call needs TPS and CTPS screening first.',
                case when v_fits is not null then 'Agreed scores: ' || v_fits || '.' end,
                'The full argument is on the candidate in Lead gen.'),
      'unknown', v_evidence, now(),
      'unassessed', 'open_data',
      concat_ws('; ',
                case c.source when 'fsa' then 'Food Standards Agency food hygiene ratings API, Open Government Licence'
                              else 'OpenStreetMap, © OpenStreetMap contributors, ODbL' end,
                case when c.website is not null then 'site confirmed by ' || array_to_string(c.website_confirmed_by, ' + ') end),
      c.pulled_at::date, 'not_given', 'do_not_contact')
    returning id into v_lead;

    -- The business's own published number, as a route, not a person.
    if c.phone is not null then
      insert into public.sales_contacts (lead_id, name, role, phone, source, source_date, confidence)
      values (v_lead, 'Public contact route', 'Published business number', c.phone,
              case c.source when 'fsa' then 'food hygiene register' else 'OpenStreetMap listing' end,
              c.pulled_at::date, 60);
    end if;
  end if;

  update public.prospect_candidate
     set status = 'promoted', promoted_lead_id = v_lead, updated_at = now()
   where id = p_id;
  return v_lead;
end
$fn$;

-- ---------- what the Lead gen tab reads ----------

create or replace function public.prospect_dashboard()
returns jsonb language sql stable security definer
set search_path = public, pg_catalog as $fn$
  select jsonb_build_object(
    'targets', (select jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'towns', t.towns, 'sic_codes', t.sic_codes,
        'incorporated_from', t.incorporated_from, 'incorporated_to', t.incorporated_to,
        'running', t.running, 'pulled', t.pulled, 'cursor', t.cursor,
        'exhausted_towns', t.exhausted_towns, 'note', t.note,
        'source', t.source, 'source_query', t.source_query) order by t.running desc, t.name)
      from public.prospect_target t where t.active),
    'counts', (select jsonb_object_agg(status, n) from (
        select status, count(*) as n from public.prospect_candidate group by 1) z),
    'services', (select jsonb_agg(jsonb_build_object('key', k.key, 'label', k.label) order by k.key)
      from public.prospect_knowledge k where k.kind = 'service' and k.active),
    'models', (select jsonb_agg(jsonb_build_object(
        'model', u.model, 'used', u.used, 'exhausted', u.exhausted, 'observed_rpd', u.observed_rpd,
        'project', case u.key_secret when 'GEMINI_RESEARCH_API_KEY' then 'research' else 'discovery' end)
        order by u.key_secret, u.used desc)
      from public.outreach_model_usage u
     where u.usage_day = public.outreach_quota_day()
       and u.key_secret in ('GEMINI_DISCOVERY_API_KEY', 'GEMINI_RESEARCH_API_KEY')),
    'chains', (select jsonb_object_agg(c.role, c.chain) from (
        select role, jsonb_agg(model order by priority) as chain
          from public.outreach_model where active and role like 'prospect\_%' group by role) c),
    'last_run', (select to_jsonb(r) from public.prospect_runs r
                  where coalesce(r.detail ->> 'mode', '') <> 'lookup' order by r.id desc limit 1),
    'last_lookup', (select to_jsonb(r) from public.prospect_runs r
                     where r.detail ->> 'mode' = 'lookup' order by r.id desc limit 1),
    'candidates', (select jsonb_agg(d.doc order by d.rank, d.score desc nulls last, d.at desc) from (
        select
          case c.status when 'scored' then 0 when 'disputed' then 1 when 'working' then 2
                        when 'queued' then 3 when 'researching' then 4 when 'no_site' then 5
                        when 'promoted' then 6 when 'no_fit' then 7 when 'refused' then 8 else 9 end as rank,
          c.lead_score as score, coalesce(c.finished_at, c.pulled_at) as at,
          jsonb_build_object(
            'id', c.id, 'company', c.company_name, 'number', c.company_number,
            'source', c.source, 'source_ref', c.source_ref, 'source_detail', c.source_detail,
            'has_phone', c.phone is not null,
            'town', c.town, 'activity', c.activity, 'incorporated_on', c.incorporated_on,
            'company_type', c.company_type, 'website', c.website,
            'website_confirmed_by', c.website_confirmed_by, 'website_outcome', c.website_outcome,
            'status', c.status, 'stage', c.stage, 'score', c.lead_score,
            'services', c.services, 'error', c.error, 'attempts', c.attempts, 'note', c.note,
            'cautions', c.state -> 'cautions', 'lookup_attempts', c.lookup_attempts,
            'promoted_lead_id', c.promoted_lead_id,
            'moves', (select count(*) from public.prospect_round r where r.candidate_id = c.id)) as doc
          from public.prospect_candidate c
         where c.status <> 'dismissed'
         order by 1, 2 desc nulls last, 3 desc
         limit 400) d)
  )
$fn$;

-- ---------- grants ----------

revoke all on function public.prospect_pull_plan() from anon, authenticated, public;
revoke all on function public.prospect_insert_local(uuid, text, integer, boolean, jsonb) from anon, authenticated, public;
revoke all on function public.prospect_source_evidence(text, text) from anon, authenticated, public;
revoke all on function public.prospect_save_target(uuid, text, text[], text[], date, date, text, jsonb) from anon, public;
revoke all on function public.prospect_start(uuid) from anon, public;
revoke all on function public.prospect_promote(uuid) from anon, public;
revoke all on function public.prospect_dashboard() from anon, public;
grant execute on function public.prospect_save_target(uuid, text, text[], text[], date, date, text, jsonb) to authenticated;
grant execute on function public.prospect_start(uuid) to authenticated;
grant execute on function public.prospect_promote(uuid) to authenticated;
grant execute on function public.prospect_dashboard() to authenticated;
