-- ============================================================
-- SECTOR PRIORS, AND THE FUNCTIONS THE ASSESSOR CALLS
--
-- STATUS: applied to the live project on 14 September 2026.
--
-- The model is not asked "does this business need a booking system?"
-- from a blank sheet. It is given the prior for the sector and asked
-- whether the page confirms or contradicts it. That is the difference
-- between an assessment and a vibe.
--
-- Priors live here, in SQL, rather than in the prompt, because a prior
-- is a claim about the world and someone should be able to disagree
-- with it in a code review. Buried in a prompt string it is
-- unreviewable and it drifts.
--
-- Every prior is a HYPOTHESIS. needs_booking true for a nursery means
-- "a nursery usually has waiting lists and visit bookings", not "this
-- nursery lacks a booking system". The page decides that, and the call
-- decides whether it matters.
-- ============================================================

create table if not exists public.sector_service_prior (
  sector            text primary key,
  label             text not null,
  needs_booking     boolean not null default false,
  needs_scheduling  boolean not null default false,
  record_heavy      boolean not null default false,
  data_worth_having boolean not null default false,
  public_facing     boolean not null default false,
  technical_capacity text not null check (technical_capacity in ('likely','mixed','unlikely')),
  inbound_volume    text not null check (inbound_volume in ('high','moderate','low')),
  note              text not null
);

comment on table public.sector_service_prior is
  'Sector-level hypotheses that steer the per-lead assessment. Deliberately in SQL rather than in a prompt: a claim about the world should be reviewable in a diff.';

insert into public.sector_service_prior
  (sector, label, needs_booking, needs_scheduling, record_heavy, data_worth_having, public_facing,
   technical_capacity, inbound_volume, note)
values
  ('care', 'Care and supported living', false, true, true, true, false, 'unlikely', 'low',
   'Rotas, visit logs, medication records and inspection evidence. fetch-cqc.mjs calls these "exactly the manual processes this business exists to fix". Staff turnover is high and IT confidence low, so Assist beats Educate: teaching a team that changes every six months does not stick.'),
  ('hospitality', 'Hospitality, food and drink', true, true, true, false, true, 'unlikely', 'high',
   'Bookings, covers, shift rotas, supplier and temperature records. Very public facing, so an enquiry auto-responder genuinely earns its keep. Almost never anyone technical on staff - Assist, and never sell a dashboard.'),
  ('trades', 'Trades, installers and field work', false, true, true, false, false, 'mixed', 'low',
   'Job sheets, certificates with renewal dates, quotes, timesheets from vans. The owner is often more capable than they let on and will happily maintain something simple. Low inbound volume: a chatbot on a plumber''s site answers nobody.'),
  ('property', 'Property, lettings and estate agency', true, true, true, true, true, 'mixed', 'moderate',
   'Viewings, maintenance reporting, tenancy and compliance paperwork with statutory dates. Portfolio data is genuinely worth analysing. A maintenance-reporting flow is usually a better opening than a dashboard.'),
  ('professional', 'Professional practices', true, false, true, true, false, 'likely', 'moderate',
   'Accountants, surveyors, brokers, consultants. Deadline-driven, document-heavy, and the people are comfortable with software - Educate credits land here where they bounce elsewhere. Also the sector most likely to already own the tool and underuse it.'),
  ('manufacturing', 'Manufacturing and engineering', false, true, true, true, false, 'likely', 'low',
   'Production scheduling, stock, quality records, traceability. Usually somebody who writes Excel formulas nobody else understands - that person is who a training day is for.'),
  ('retail', 'Retail and wholesale', false, false, true, true, true, 'mixed', 'moderate',
   'Stock, pricing, multi-channel listings, reconciliation. Data is genuinely worth having because margin lives in it. If they sell online already, the gap is usually the join between the shop and the accounts.'),
  ('training', 'Education, nurseries and training', true, true, true, false, true, 'mixed', 'moderate',
   'Enrolment, registers, waiting lists, parent communication, ratios and statutory records. Parents ask the same six questions, so an auto-responder is a real win.'),
  ('transport', 'Transport, logistics and hire', true, true, true, true, false, 'mixed', 'moderate',
   'Bookings, vehicle records, MOT and service dates, driver hours. Dates that must not be missed are the recurring theme and the obvious first build.'),
  ('charity', 'Charities and community organisations', false, false, true, true, false, 'unlikely', 'low',
   'Annual return and accounts on an immovable deadline, funder reporting, volunteer records. Budget is the constraint, not need. Assist credits, small scope, and be honest about cost early.')
on conflict (sector) do update set
  label = excluded.label, needs_booking = excluded.needs_booking,
  needs_scheduling = excluded.needs_scheduling, record_heavy = excluded.record_heavy,
  data_worth_having = excluded.data_worth_having, public_facing = excluded.public_facing,
  technical_capacity = excluded.technical_capacity, inbound_volume = excluded.inbound_volume,
  note = excluded.note;

alter table public.sector_service_prior enable row level security;
revoke all on public.sector_service_prior from anon, authenticated;

-- ---------- the batch picker now carries the prior ----------
-- Its return type changed, so the previous version is dropped first.
-- The only caller is the outreach-writer edge function.
drop function if exists public.outreach_next_batch(integer);

create or replace function public.outreach_next_batch(p_limit integer default 5)
returns table (
  lead_id uuid, company text, website text, industry text, signals text, source text,
  trading_years integer, sector text, sector_label text, sector_note text,
  needs_booking boolean, needs_scheduling boolean, record_heavy boolean,
  data_worth_having boolean, public_facing boolean,
  prior_technical text, prior_inbound text
)
language sql stable security definer
set search_path to 'public', 'pg_catalog'
as $function$
  with l as (
    select sl.*,
      nullif(substring(sl.signals from 'trading ([0-9]+) years'), '')::integer as yrs,
      nullif(substring(sl.signals from 'sector hint: ([a-z]+)'), '')           as sec
    from public.sales_leads sl
    where sl.observation is null
      and sl.observation_attempts < 3
      -- The one absolute exclusion. Article 21(2) has no research carve-out.
      and coalesce(sl.opt_out, false) = false
      and not exists (select 1 from public.marketing_suppression s where s.source_lead_id = sl.id)
  )
  select l.id, l.company, nullif(btrim(coalesce(l.website, '')), ''),
         l.industry, l.signals, l.source, l.yrs, l.sec,
         p.label, p.note, p.needs_booking, p.needs_scheduling, p.record_heavy,
         p.data_worth_having, p.public_facing, p.technical_capacity, p.inbound_volume
  from l left join public.sector_service_prior p on p.sector = l.sec
  order by l.lead_score desc nulls last, l.created_at
  limit greatest(p_limit, 0)
$function$;

comment on function public.outreach_next_batch(integer) is
  'Leads needing assessment, best-scoring first, each carrying its sector prior. Does NOT filter on marketing_status: assessing serves the human gate rather than bypassing it, and nothing here sends.';

-- ---------- storing an assessment ----------

create or replace function public.outreach_record_fit(
  p_lead_id uuid, p_web_presence text, p_technical text, p_inbound text,
  p_credit_fit text, p_credit_reason text, p_summary text, p_services jsonb, p_model text
)
returns integer
language plpgsql security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare v_row jsonb; v_count integer := 0;
begin
  update public.sales_leads
     set web_presence = p_web_presence, technical_capacity = p_technical,
         inbound_volume = p_inbound, credit_fit = p_credit_fit,
         credit_fit_reason = p_credit_reason, fit_summary = p_summary,
         fit_assessed_at = now(), updated_at = now()
   where id = p_lead_id;

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

-- ---------- what a person reads before a call ----------

create or replace view public.lead_fit_briefing as
select
  l.id as lead_id, l.company, l.industry, l.location, l.website,
  l.web_presence, l.technical_capacity, l.inbound_volume,
  l.credit_fit, l.credit_fit_reason, l.fit_summary,
  l.observation, l.observation_evidence, l.fit_assessed_at,
  (select jsonb_agg(jsonb_build_object(
            'category', f.category, 'fit', f.fit, 'confidence', f.confidence,
            'rationale', f.rationale, 'evidence', f.evidence,
            'ask', f.confirm_question, 'walk_away_if', f.disqualifier)
          order by case f.fit when 'strong' then 1 when 'possible' then 2
                              when 'unlikely' then 3 else 4 end,
                   case f.confidence when 'observed' then 1 when 'inferred' then 2 else 3 end)
     from public.lead_service_fit f where f.lead_id = l.id) as services
from public.sales_leads l;

comment on view public.lead_fit_briefing is
  'One row per lead, ready to read before a discovery call. `ask` and `walk_away_if` are the point: the fit is a hypothesis and these are how it gets tested.';

do $$
declare f text;
begin
  foreach f in array array[
    'public.outreach_next_batch(integer)',
    'public.outreach_record_fit(uuid, text, text, text, text, text, text, jsonb, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

revoke all on public.lead_fit_briefing from anon, authenticated;
grant select on public.lead_fit_briefing to service_role;
