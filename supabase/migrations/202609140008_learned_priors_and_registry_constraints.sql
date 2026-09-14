-- ============================================================
-- PRIORS THAT LEARN, AND CONSTRAINTS THAT FOLLOW THE REGISTRY
--
-- STATUS: applied to the live project on 14 September 2026.
--
-- TWO PROBLEMS, ONE CAUSE
--
-- 1. sector_service_prior was ten rows of my opinion about Nottingham
--    businesses, written in an afternoon and never revisited. Whether a
--    care home usually has a rota problem is a claim that ought to get
--    better as we assess care homes, and it could not.
--
-- 2. Six CHECK constraints listed the same terms as the registry, in
--    SQL, by hand. Adding a sixth service category would have passed
--    the edge function's validation and then been rejected by the
--    database with a constraint error, which is the worst possible
--    place to discover a vocabulary is out of step with itself.
--
-- Both are the same mistake: a fact about the world written down twice.
--
-- WHAT REPLACES THEM
--
-- The seed prior stays - a cold start has to come from somewhere, and
-- an opinion you can read is better than no opinion. But it is now
-- shown to the scout ALONGSIDE what we have actually found in that
-- sector, and where the two disagree the scout is told they disagree
-- rather than being handed a blend. A blend hides which one was wrong.
--
-- The constraints become foreign keys into outreach_vocabulary, so the
-- registry is the single definition and the database enforces it.
-- ============================================================

-- ---------- the sector stops being a substring ----------
--
-- The sector was parsed out of the `signals` free-text column on every
-- batch: substring(signals from 'sector hint: ([a-z]+)'). That meant
-- the classification could not be corrected, because there was nowhere
-- to write the correction to - and it needed correcting. The Albert
-- Hall, a concert venue, is filed as a professional practice.

alter table public.sales_leads
  add column if not exists sector              text
    references public.sector_service_prior (sector) on update cascade,
  add column if not exists sector_source       text,
  add column if not exists sector_confidence   text,
  add column if not exists sector_corrected_at timestamptz;

comment on column public.sales_leads.sector is
  'Which sector prior applies. Seeded from the keyword triage, and overwritten by the scout when the business''s own page contradicts it.';
comment on column public.sales_leads.sector_source is
  'triage, assessment, or human. An assessment correction is worth more than a keyword match and less than somebody who picked up the phone.';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sales_leads_sector_source_known') then
    alter table public.sales_leads add constraint sales_leads_sector_source_known
      check (sector_source is null or sector_source in ('triage','assessment','human'));
  end if;
end $$;

-- Backfill from where it used to be read, once.
update public.sales_leads sl
   set sector = hint.sec, sector_source = 'triage'
  from (select id, nullif(substring(signals from 'sector hint: ([a-z]+)'), '') as sec
          from public.sales_leads) hint
 where hint.id = sl.id
   and sl.sector is null
   and hint.sec is not null
   and exists (select 1 from public.sector_service_prior p where p.sector = hint.sec);

create index if not exists sales_leads_sector_idx on public.sales_leads (sector);

create or replace function public.outreach_correct_sector(
  p_lead_id uuid, p_sector text, p_confidence text default null
)
returns boolean
language plpgsql security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare v_known boolean;
begin
  -- An unknown sector is refused rather than stored. The scout is given
  -- the list it may choose from; inventing one outside it is a bug, and
  -- silently accepting it would put a lead in a bucket with no prior
  -- and no way to notice.
  select exists (select 1 from public.sector_service_prior where sector = p_sector) into v_known;
  if not v_known then return false; end if;

  update public.sales_leads
     set sector = p_sector, sector_source = 'assessment',
         sector_confidence = p_confidence, sector_corrected_at = now(),
         updated_at = now()
   where id = p_lead_id
     -- A human who has spoken to the business outranks a model that
     -- read their homepage. Corrections do not overwrite people.
     and coalesce(sector_source, 'triage') <> 'human';
  return found;
end
$function$;

-- ---------- the constraints now point at the registry ----------
--
-- A generated column carries the dimension so a composite foreign key
-- can reach the registry's primary key. MATCH SIMPLE means a NULL value
-- column satisfies the constraint, which preserves "not assessed yet"
-- without a second rule.
--
-- Note this makes DELETE from the registry impossible while a term is
-- in use, which is correct: retiring a term is `active = false`, and
-- the rows that used it stay readable. Deleting the definition of a
-- word that appears in a hundred assessments would make them
-- unreadable, and that is worth being stopped from doing.

alter table public.lead_service_fit
  drop constraint if exists lead_service_fit_category_check,
  drop constraint if exists lead_service_fit_fit_check,
  drop constraint if exists lead_service_fit_confidence_check,
  drop constraint if exists lead_service_fit_observed_needs_evidence;

alter table public.lead_service_fit
  add column if not exists category_dim   text generated always as ('category')   stored,
  add column if not exists fit_dim        text generated always as ('fit')        stored,
  add column if not exists confidence_dim text generated always as ('confidence') stored;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lead_service_fit_category_known') then
    alter table public.lead_service_fit add constraint lead_service_fit_category_known
      foreign key (category_dim, category) references public.outreach_vocabulary (dimension, term);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lead_service_fit_fit_known') then
    alter table public.lead_service_fit add constraint lead_service_fit_fit_known
      foreign key (fit_dim, fit) references public.outreach_vocabulary (dimension, term);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lead_service_fit_confidence_known') then
    alter table public.lead_service_fit add constraint lead_service_fit_confidence_known
      foreign key (confidence_dim, confidence) references public.outreach_vocabulary (dimension, term);
  end if;
end $$;

alter table public.sales_leads
  drop constraint if exists sales_leads_web_presence_known,
  drop constraint if exists sales_leads_technical_capacity_known,
  drop constraint if exists sales_leads_inbound_volume_known,
  drop constraint if exists sales_leads_credit_fit_known;

alter table public.sales_leads
  add column if not exists web_presence_dim       text generated always as ('web_presence')       stored,
  add column if not exists technical_capacity_dim text generated always as ('technical_capacity') stored,
  add column if not exists inbound_volume_dim     text generated always as ('inbound_volume')     stored,
  add column if not exists credit_fit_dim         text generated always as ('credit')             stored;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sales_leads_web_presence_in_registry') then
    alter table public.sales_leads add constraint sales_leads_web_presence_in_registry
      foreign key (web_presence_dim, web_presence) references public.outreach_vocabulary (dimension, term);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sales_leads_technical_capacity_in_registry') then
    alter table public.sales_leads add constraint sales_leads_technical_capacity_in_registry
      foreign key (technical_capacity_dim, technical_capacity) references public.outreach_vocabulary (dimension, term);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sales_leads_inbound_volume_in_registry') then
    alter table public.sales_leads add constraint sales_leads_inbound_volume_in_registry
      foreign key (inbound_volume_dim, inbound_volume) references public.outreach_vocabulary (dimension, term);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sales_leads_credit_fit_in_registry') then
    alter table public.sales_leads add constraint sales_leads_credit_fit_in_registry
      foreign key (credit_fit_dim, credit_fit) references public.outreach_vocabulary (dimension, term);
  end if;
end $$;

-- ---------- the evidence rule, still enforced, no longer hardcoded ----------
--
-- This was CHECK (confidence <> 'observed' OR evidence is not null):
-- correct, and wrong to write that way, because it names the term. A
-- CHECK cannot ask another table, so it becomes a trigger that asks the
-- registry which terms demand evidence.
--
-- This is the LAST line of the same defence the edge function runs
-- first. Belt and braces on purpose: an unsourced claim about a
-- stranger's business is the thing this design exists to prevent, and
-- it should be impossible to store one by any route, including a
-- careless UPDATE at the SQL prompt.

create or replace function public.outreach_evidence_required()
returns trigger
language plpgsql
set search_path to 'public', 'pg_catalog'
as $function$
declare v_needs boolean;
begin
  select needs_evidence into v_needs
    from public.outreach_vocabulary
   where dimension = 'confidence' and term = new.confidence;

  if coalesce(v_needs, false)
     and (new.evidence is null or length(btrim(new.evidence)) = 0) then
    raise exception
      'confidence "%" requires evidence: outreach_vocabulary marks it needs_evidence', new.confidence
      using errcode = 'check_violation';
  end if;
  return new;
end
$function$;

drop trigger if exists lead_service_fit_evidence_required on public.lead_service_fit;
create trigger lead_service_fit_evidence_required
  before insert or update on public.lead_service_fit
  for each row execute function public.outreach_evidence_required();

-- ---------- what we have actually found ----------

create or replace view public.sector_observed_pattern as
with assessed as (
  select l.id, l.sector, l.technical_capacity, l.inbound_volume, l.credit_fit
    from public.sales_leads l
   where l.sector is not null and l.fit_assessed_at is not null
)
select
  a.sector,
  count(*)::integer as n,
  (select jsonb_object_agg(category, counts) from (
     select f.category, jsonb_object_agg(f.fit, c) as counts from (
       select f.category, f.fit, count(*)::integer c
         from public.lead_service_fit f
         join assessed x on x.id = f.lead_id
        where x.sector = a.sector
        group by f.category, f.fit) f
     group by f.category) y)                                    as by_category,
  (select jsonb_object_agg(technical_capacity, c) from (
     select technical_capacity, count(*)::integer c from assessed
      where sector = a.sector and technical_capacity is not null
      group by technical_capacity) t)                           as technical_capacity,
  (select jsonb_object_agg(inbound_volume, c) from (
     select inbound_volume, count(*)::integer c from assessed
      where sector = a.sector and inbound_volume is not null
      group by inbound_volume) i)                               as inbound_volume,
  (select jsonb_object_agg(credit_fit, c) from (
     select credit_fit, count(*)::integer c from assessed
      where sector = a.sector and credit_fit is not null
      group by credit_fit) c)                                   as credit_fit,
  (select count(*)::integer from public.sales_leads s
    where s.sector = a.sector and s.sector_source = 'assessment') as corrected_into_sector
from assessed a
group by a.sector;

comment on view public.sector_observed_pattern is
  'What the assessments have actually found per sector, which is what a prior should be made of. Shown to the scout beside the hand-written seed once the sample is big enough, with any disagreement called out rather than averaged away.';

-- ---------- where a seed has been overtaken ----------

create or replace view public.sector_prior_drift as
select
  p.sector, p.label, o.n as sample,
  p.technical_capacity as seed_technical,
  (select k from jsonb_each_text(o.technical_capacity) as e(k, v)
    order by v::integer desc, k limit 1) as observed_technical,
  p.inbound_volume as seed_inbound,
  (select k from jsonb_each_text(o.inbound_volume) as e(k, v)
    order by v::integer desc, k limit 1) as observed_inbound,
  o.corrected_into_sector
from public.sector_service_prior p
join public.sector_observed_pattern o on o.sector = p.sector;

comment on view public.sector_prior_drift is
  'Seed prior against observed reality, per sector. Where these disagree on a decent sample, the seed row is wrong and should be edited - that is the maintenance job this system has instead of retraining.';

-- ---------- the batch, as documents ----------
--
-- The return type changed twice in one day, and each change meant a
-- DROP FUNCTION and a matching edit in TypeScript. It returns
-- documents now: a column added to the lead payload never changes the
-- signature again.

drop function if exists public.outreach_next_batch(integer);

create or replace function public.outreach_next_batch(p_limit integer default 5)
returns setof jsonb
language sql stable security definer
set search_path to 'public', 'pg_catalog'
as $function$
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
  from public.sales_leads l
  left join public.sector_service_prior p    on p.sector = l.sector
  left join public.sector_observed_pattern o on o.sector = l.sector
  where l.observation is null
    and l.observation_attempts < 3
    -- The one absolute exclusion. Article 21(2) has no research carve-out.
    and coalesce(l.opt_out, false) = false
    and not exists (select 1 from public.marketing_suppression s where s.source_lead_id = l.id)
  order by l.lead_score desc nulls last, l.created_at
  limit greatest(p_limit, 0)
$function$;

comment on function public.outreach_next_batch(integer) is
  'Leads needing assessment, best-scoring first, each carrying its seed prior and what the assessments have actually found in its sector. Returns documents so the payload can grow without a signature change. Does NOT filter on marketing_status: assessing serves the human gate rather than bypassing it, and nothing here sends.';

-- ---------- storing an assessment, with the correction ----------

drop function if exists public.outreach_record_fit(uuid, text, text, text, text, text, text, jsonb, text);

create or replace function public.outreach_record_fit(
  p_lead_id uuid, p_assessment jsonb, p_services jsonb, p_model text
)
returns integer
language plpgsql security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare v_row jsonb; v_count integer := 0;
begin
  update public.sales_leads
     set web_presence       = p_assessment->>'web_presence',
         technical_capacity = p_assessment->>'technical_capacity',
         inbound_volume     = p_assessment->>'inbound_volume',
         credit_fit         = p_assessment->>'credit_fit',
         credit_fit_reason  = p_assessment->>'credit_reason',
         fit_summary        = p_assessment->>'summary',
         fit_assessed_at    = now(),
         updated_at         = now()
   where id = p_lead_id;

  if nullif(btrim(coalesce(p_assessment->>'sector_correction','')), '') is not null then
    perform public.outreach_correct_sector(
      p_lead_id, p_assessment->>'sector_correction', p_assessment->>'sector_correction_why');
  end if;

  -- Replaced wholesale rather than merged. A partial re-assessment that
  -- leaves last week's verdict on three categories and this week's on
  -- two is a record nobody can reason about.
  delete from public.lead_service_fit where lead_id = p_lead_id;

  for v_row in select * from jsonb_array_elements(coalesce(p_services, '[]'::jsonb))
  loop
    insert into public.lead_service_fit
      (lead_id, category, fit, confidence, rationale, evidence,
       confirm_question, disqualifier, assessed_by)
    values (p_lead_id, v_row->>'category', v_row->>'fit', v_row->>'confidence',
            v_row->>'rationale', nullif(btrim(coalesce(v_row->>'evidence','')), ''),
            v_row->>'confirm_question', v_row->>'disqualifier', p_model);
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$function$;

-- ---------- briefing, ordered by the registry ----------
--
-- The old version hardcoded the ordering: strong then possible then
-- unlikely, observed then inferred then guessed. Two more places a new
-- term would have gone silently to the bottom of the list.

-- Dropped rather than replaced: the column list gains `sector` in the
-- middle, and CREATE OR REPLACE VIEW cannot reorder or insert columns.
drop view if exists public.lead_fit_briefing;

create view public.lead_fit_briefing as
select
  l.id as lead_id, l.company, l.industry, l.location, l.website,
  l.sector, l.sector_source,
  l.web_presence, l.technical_capacity, l.inbound_volume,
  l.credit_fit, l.credit_fit_reason, l.fit_summary,
  l.observation, l.observation_evidence, l.fit_assessed_at,
  (select jsonb_agg(jsonb_build_object(
            'category', f.category, 'fit', f.fit, 'confidence', f.confidence,
            'rationale', f.rationale, 'evidence', f.evidence,
            'ask', f.confirm_question, 'walk_away_if', f.disqualifier)
          order by vf.rank desc nulls last, vc.rank desc nulls last, f.category)
     from public.lead_service_fit f
     left join public.outreach_vocabulary vf
            on vf.dimension = 'fit' and vf.term = f.fit
     left join public.outreach_vocabulary vc
            on vc.dimension = 'confidence' and vc.term = f.confidence
    where f.lead_id = l.id) as services
from public.sales_leads l;

comment on view public.lead_fit_briefing is
  'One row per lead, ready to read before a discovery call, strongest and best-evidenced first by registry rank. `ask` and `walk_away_if` are the point: the fit is a hypothesis and these are how it gets tested.';

-- ---------- service role only ----------

do $$
declare f text;
begin
  foreach f in array array[
    'public.outreach_next_batch(integer)',
    'public.outreach_record_fit(uuid, jsonb, jsonb, text)',
    'public.outreach_correct_sector(uuid, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

revoke all on public.sector_observed_pattern from anon, authenticated;
revoke all on public.sector_prior_drift      from anon, authenticated;
revoke all on public.lead_fit_briefing       from anon, authenticated;
grant select on public.sector_observed_pattern to service_role;
grant select on public.sector_prior_drift      to service_role;
grant select on public.lead_fit_briefing       to service_role;
