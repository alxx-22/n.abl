-- ============================================================
-- THE NUMBER ON THEIR OWN SITE
--
-- The owner wants sole traders called by a person, once each number has
-- been screened against the TPS. The food hygiene register publishes no
-- phone numbers and OpenStreetMap has one for about one business in
-- twenty-five, so without this there is almost nothing to screen.
--
-- A business's own site nearly always gives its number. The research
-- stage already fetches the site and confirms it is theirs; code now reads
-- the number from those pages (local.mjs sitePhone: a tel: link, or the
-- only number in the text) and keeps it on the candidate. No agent sees it
-- (readable() strips contact routes before any model reads a page) and no
-- model can supply one. A number from the listing is kept over the site's.
--
-- Where each number came from is recorded, and carried to the "Public
-- contact route" contact on promotion, which now happens for a company
-- from Companies House as well: a limited company's number needs CTPS
-- screening before a call just as a sole trader's needs TPS.
--
-- Nothing here lets anyone call: marketing_send_allowed still refuses
-- every phone call.
-- ============================================================

alter table public.prospect_candidate add column if not exists phone_source text;

alter table public.prospect_candidate drop constraint if exists prospect_candidate_phone_source_known;
alter table public.prospect_candidate add constraint prospect_candidate_phone_source_known check (
  phone_source is null or phone_source in ('food hygiene register', 'OpenStreetMap listing', 'their own website'));

update public.prospect_candidate
   set phone_source = case source when 'fsa' then 'food hygiene register' when 'osm' then 'OpenStreetMap listing' end
 where phone is not null and phone_source is null;

comment on column public.prospect_candidate.phone_source is
  'Where phone came from: the source listing, or their own confirmed website (read by code, never a model).';

-- A listing's number arrives with the row; say where it came from.
create or replace function public.prospect_candidate_fill_source_ref()
returns trigger language plpgsql
set search_path = public, pg_catalog as $fn$
begin
  if new.source_ref is null and new.source = 'companies_house' and new.company_number is not null then
    new.source_ref := 'ch:' || new.company_number;
  end if;
  if new.phone is not null and new.phone_source is null then
    new.phone_source := case new.source when 'fsa' then 'food hygiene register' when 'osm' then 'OpenStreetMap listing' end;
  end if;
  return new;
end
$fn$;
revoke all on function public.prospect_candidate_fill_source_ref() from anon, authenticated, public;

-- ---------- the research stage saves the site's number ----------
-- Taken when there is none yet, or when the one there came from a site too.
-- A different website than before takes a site's number away with it.

drop function if exists public.prospect_save_state(uuid, text, jsonb, jsonb, text, text[], text);

create or replace function public.prospect_save_state(
  p_id uuid, p_stage text, p_state jsonb,
  p_register jsonb default null, p_website text default null,
  p_confirmed_by text[] default null, p_website_outcome text default null,
  p_phone text default null)
returns void language sql security definer
set search_path = public, pg_catalog as $fn$
  update public.prospect_candidate
     set stage = p_stage, state = coalesce(p_state, state),
         register = coalesce(p_register, register),
         website = coalesce(p_website, website),
         website_confirmed_by = coalesce(p_confirmed_by, website_confirmed_by),
         website_outcome = coalesce(p_website_outcome, website_outcome),
         phone = case
           when p_phone ~ '^\+44[1-35-8][0-9]{8,9}$' and (phone is null or phone_source = 'their own website') then p_phone
           when phone_source = 'their own website' and p_website is not null and p_website is distinct from website then null
           else phone end,
         phone_source = case
           when p_phone ~ '^\+44[1-35-8][0-9]{8,9}$' and (phone is null or phone_source = 'their own website') then 'their own website'
           when phone_source = 'their own website' and p_website is not null and p_website is distinct from website then null
           else phone_source end,
         claimed_at = now(), updated_at = now()
   where id = p_id
$fn$;
revoke all on function public.prospect_save_state(uuid, text, jsonb, jsonb, text, text[], text, text) from anon, authenticated, public;

-- A person giving the right website: a number read from the wrong one goes.
create or replace function public.prospect_set_website(p_id uuid, p_url text)
returns void language plpgsql security definer
set search_path = public, pg_catalog as $fn$
declare
  v_url text := btrim(coalesce(p_url, ''));
begin
  if v_url !~* '^https?://' then v_url := 'https://' || v_url; end if;
  if v_url !~* '^https?://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:[0-9]+)?(/[^[:space:]]*)?$' then
    raise exception 'that is not a web address';
  end if;
  if not exists (select 1 from public.prospect_candidate where id = p_id and status <> 'promoted') then
    raise exception 'no such business, or it is already a lead';
  end if;
  delete from public.prospect_round where candidate_id = p_id;
  update public.prospect_candidate
     set website = v_url, website_confirmed_by = array['a person'], website_outcome = 'added by a person',
         stage = 'research', state = '{}'::jsonb, status = 'queued', attempts = 0, note = null,
         claimed_at = null, lookup_claimed_at = null, requeued = true, lead_score = null, services = null, error = null,
         finished_at = null, updated_at = now(),
         phone = case when phone_source = 'their own website' then null else phone end,
         phone_source = case when phone_source = 'their own website' then null else phone_source end
   where id = p_id;
end
$fn$;
revoke all on function public.prospect_set_website(uuid, text) from anon, public;
grant execute on function public.prospect_set_website(uuid, text) to authenticated;

-- ---------- promotion carries the number, and where it came from ----------

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
  end if;

  -- The business's own published number, as a route, not a person. Its
  -- contact_marketing_status defaults to do_not_contact.
  if c.phone is not null then
    insert into public.sales_contacts (lead_id, name, role, phone, source, source_date, confidence)
    values (v_lead, 'Public contact route', 'Published business number', c.phone,
            coalesce(c.phone_source, case c.source when 'fsa' then 'food hygiene register'
                                                   when 'osm' then 'OpenStreetMap listing' end),
            coalesce(c.finished_at, c.pulled_at)::date, 60);
  end if;

  update public.prospect_candidate
     set status = 'promoted', promoted_lead_id = v_lead, updated_at = now()
   where id = p_id;
  return v_lead;
end
$fn$;
revoke all on function public.prospect_promote(uuid) from anon, public;
grant execute on function public.prospect_promote(uuid) to authenticated;

-- ---------- the Lead gen tab says whether there is a number, and whence ----------

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
            'has_phone', c.phone is not null, 'phone_source', c.phone_source,
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
revoke all on function public.prospect_dashboard() from anon, public;
grant execute on function public.prospect_dashboard() to authenticated;
