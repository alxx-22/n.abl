-- ============================================================
-- CAPABILITY IS A DIMENSION, AND DIMENSIONS ARE ROWS
--
-- STATUS: applied to the live project on 15 September 2026
-- (version 20260915112640).
--
-- TWO AXES, NOT ONE
--
-- 01-positioning/README.md 154 and 169-175 are explicit that n.abl
-- describes itself along two axes that deliberately do not line up:
--
--   service categories - how a customer arrives at us
--   capabilities       - what we actually deliver
--
-- The assessment already recorded the first. The team is organised
-- along the second: people specialise in data & analytics, AI, web,
-- software, automation. So a CRM filtered by category cannot answer
-- the only question a specialist asks, which is "which of these is
-- mine". This adds the second axis as its own vocabulary dimension and
-- stores one capability per category verdict.
--
-- It is the one vocabulary term that is never defaulted. Every other
-- dimension has an is_default row, because a missing verdict there is
-- better read as the weakest verdict. Not this one: a defaulted
-- capability sends the lead to the wrong specialist, who opens it once,
-- sees it is not theirs, and never opens it again. Null is honest and
-- shows up as "unassigned" in the CRM, which is a queue somebody can
-- work. A wrong name is a lead nobody works.
--
-- WHY outreach_dimension EXISTS
--
-- The edge function had a hardcoded list of which dimensions get a
-- heading in the scout's prompt, and what that heading says. Adding
-- capability meant editing that list - which is exactly the static
-- variable this whole phase has been removing. The headings are now
-- rows, ordered by prompt_order, and guards.mjs renders whatever it is
-- handed. A seventh dimension is an insert, not a deploy.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The dimensions the scout is asked about, and in what order
-- ------------------------------------------------------------

create table if not exists public.outreach_dimension (
  dimension    text primary key,
  heading      text not null,
  prompt_order integer not null default 100,
  active       boolean not null default true
);

comment on table public.outreach_dimension is
  'Which vocabulary dimensions appear in the scout prompt, under what heading, in what order. The edge function renders these rows and names none of them.';
comment on column public.outreach_dimension.heading is
  'The line printed above the dimension''s terms. It is instruction, not a label - it tells the model what the dimension is for.';

alter table public.outreach_dimension enable row level security;
revoke all on public.outreach_dimension from anon, authenticated;

insert into public.outreach_dimension (dimension, heading, prompt_order) values
  ('category',           'SERVICE CATEGORIES — how a business arrives. Assess each one you have something to say about', 10),
  ('capability',         'CAPABILITY — if we did the work, what would it actually be. One per category verdict',        20),
  ('fit',                'FIT',                                                                                         30),
  ('confidence',         'CONFIDENCE',                                                                                  40),
  ('web_presence',       'WEB PRESENCE — what they look like from outside',                                             50),
  ('technical_capacity', 'TECHNICAL CAPACITY — whether anyone inside would maintain what we build',                     60),
  ('inbound_volume',     'INBOUND VOLUME — whether answering enquiries is a visible cost',                              70),
  ('credit',             'CREDIT FIT — which of the three to lead with after delivery',                                 80)
on conflict (dimension) do update
  set heading = excluded.heading, prompt_order = excluded.prompt_order, active = true;

-- ------------------------------------------------------------
-- 2. The capabilities themselves
--
-- Taken verbatim from 01-positioning/README.md 154. Not one of them
-- carries is_default, and rank is 0 throughout: these are six kinds of
-- work, not six steps on a ladder, so there is no "strongest" to fall
-- back to and nothing for a rank comparison to mean.
-- ------------------------------------------------------------

insert into public.outreach_vocabulary (dimension, term, rank, meaning, needs_evidence, is_default) values
  ('capability', 'data_analytics', 0,
   'They hold information they cannot answer questions with. Getting it into one place, making it trustworthy, and making it answer the question somebody actually asks.',
   false, false),
  ('capability', 'ai', 0,
   'A model doing a job a person was doing: reading, drafting, classifying, answering. Only where the work is genuinely language or judgement, never as decoration.',
   false, false),
  ('capability', 'web', 0,
   'The public-facing thing: a site, a booking flow, a portal, a form that reaches the right person. What a customer touches.',
   false, false),
  ('capability', 'software', 0,
   'Custom software. A tool that does not exist and has to be built, because nothing off the shelf fits the way this business works.',
   false, false),
  ('capability', 'automation', 0,
   'Take repetitive work off people''s hands. Something happens on its own that a person was doing by hand - a form that files itself, a report that arrives, two systems that start talking.',
   false, false),
  ('capability', 'training_support', 0,
   'The tool already exists and already works. What is missing is somebody knowing how to use it, or somebody keeping it running.',
   false, false)
on conflict (dimension, term) do update
  set meaning = excluded.meaning, rank = excluded.rank,
      needs_evidence = excluded.needs_evidence, is_default = excluded.is_default,
      active = true;

-- ------------------------------------------------------------
-- 3. One capability per category verdict
--
-- Same pattern as category/fit/confidence: a generated column holding
-- the dimension name, and a composite foreign key into the registry.
-- A capability the registry has never heard of cannot be written at
-- all - the database refuses it, rather than the CRM growing a filter
-- option nobody can explain.
-- ------------------------------------------------------------

alter table public.lead_service_fit
  add column if not exists capability text,
  add column if not exists capability_dim text generated always as ('capability') stored;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lead_service_fit_capability_known') then
    alter table public.lead_service_fit
      add constraint lead_service_fit_capability_known
      foreign key (capability_dim, capability)
      references public.outreach_vocabulary (dimension, term);
  end if;
end $$;

comment on column public.lead_service_fit.capability is
  'Which of n.abl''s capabilities the work would be - the axis the team is organised along. Null is a real answer and means the page did not say; it is never defaulted.';

-- ------------------------------------------------------------
-- 4. Hand the dimensions to the function
-- ------------------------------------------------------------

create or replace function public.outreach_config()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $function$
  select jsonb_build_object(
    'dimensions', coalesce((
      select jsonb_agg(jsonb_build_object('dimension', dimension, 'heading', heading)
             order by prompt_order, dimension)
      from public.outreach_dimension where active
    ), '[]'::jsonb),
    'vocabulary', coalesce((
      select jsonb_object_agg(dimension, terms) from (
        select dimension, jsonb_agg(jsonb_build_object(
                 'term', term, 'rank', rank, 'meaning', meaning,
                 'needs_evidence', needs_evidence, 'is_default', is_default,
                 'requires_dimension', requires_dimension,
                 'requires_min_rank', requires_min_rank) order by rank, term) as terms
        from public.outreach_vocabulary where active group by dimension) v
    ), '{}'::jsonb),
    'models', coalesce((
      select jsonb_object_agg(role, chain) from (
        select role, jsonb_agg(jsonb_build_object(
                 'model', model, 'rpd', rpd, 'gap_ms', gap_ms,
                 'temperature', temperature) order by priority) as chain
        from public.outreach_model where active group by role) m
    ), '{}'::jsonb),
    'fact_rules', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.priority, f.key)
      from public.outreach_fact_rule f where f.active
    ), '[]'::jsonb),
    'page_signals', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', key, 'pattern', pattern, 'flags', flags,
               'description', description) order by key)
      from public.outreach_page_signal where active
    ), '[]'::jsonb),
    'settings', coalesce((
      select jsonb_object_agg(key, value) from public.outreach_setting
    ), '{}'::jsonb),
    'prompts', coalesce((
      select jsonb_object_agg(key, jsonb_build_object(
               'body', body, 'temperature', temperature))
      from public.outreach_prompt
    ), '{}'::jsonb),
    'sectors', coalesce((
      select jsonb_agg(jsonb_build_object('sector', sector, 'label', label) order by sector)
      from public.sector_service_prior
    ), '[]'::jsonb)
  )
$function$;

-- ------------------------------------------------------------
-- 5. Store it
-- ------------------------------------------------------------

create or replace function public.outreach_record_fit(
  p_lead_id uuid, p_assessment jsonb, p_services jsonb, p_model text,
  p_page_signals text[] default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
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

  delete from public.lead_service_fit where lead_id = p_lead_id;

  for v_row in select * from jsonb_array_elements(coalesce(p_services, '[]'::jsonb))
  loop
    insert into public.lead_service_fit
      (lead_id, category, capability, fit, confidence, rationale, evidence,
       confirm_question, disqualifier, assessed_by)
    values (p_lead_id, v_row->>'category',
            nullif(btrim(coalesce(v_row->>'capability','')), ''),
            v_row->>'fit', v_row->>'confidence',
            v_row->>'rationale', nullif(btrim(coalesce(v_row->>'evidence','')), ''),
            v_row->>'confirm_question', v_row->>'disqualifier', p_model);
    v_count := v_count + 1;
  end loop;

  -- NULL means the caller never looked; an empty array means it looked
  -- and found nothing. Only the second is a measurement, and only a
  -- measurement may move the score.
  if p_page_signals is not null then
    delete from public.lead_page_signal where lead_id = p_lead_id;
    insert into public.lead_page_signal (lead_id, key)
    select p_lead_id, unnest(p_page_signals)
    on conflict do nothing;

    perform public.outreach_rescore(p_lead_id);
  end if;

  return v_count;
end
$function$;

-- The four-argument version predates page signals and cannot write a
-- capability. Nothing calls it, and leaving a second overload sitting
-- next to this one is how a future caller silently gets the old
-- behaviour back.
drop function if exists public.outreach_record_fit(uuid, jsonb, jsonb, text);

revoke all on function public.outreach_config() from anon, authenticated, public;
revoke all on function public.outreach_record_fit(uuid, jsonb, jsonb, text, text[])
  from anon, authenticated, public;

-- ------------------------------------------------------------
-- 6. Ask for it
--
-- The scout's JSON shape gains one field, and a section explaining that
-- the two axes are different questions. The rest of the prompt is
-- unchanged; this replaces the whole body because a prompt is a single
-- document and patching it in fragments is how the two halves of an
-- instruction end up contradicting each other.
-- ------------------------------------------------------------

update public.outreach_prompt set body = replace(body,
'    {
      "category": "<term>",
      "fit": "<term>",',
'    {
      "category": "<term>",
      "capability": "<capability term, or null if you genuinely cannot tell>",
      "fit": "<term>",')
where key = 'scout' and body not like '%"capability":%';

update public.outreach_prompt set body = body || E'\n\nWHAT THE WORK WOULD BE\n\nEvery category verdict also names a CAPABILITY: not what problem they have, but what the job would actually be if we did it. The team specialises, and this is the field that decides whose desk a lead lands on.\n\nThey are different questions and they do not line up one to one. "Someone is rekeying bookings by hand" is a save_time problem, and the work could be automation (make the two systems talk), or web (replace the form), or software (there is nothing to buy that fits). Decide from what the page shows about how they actually operate, not from the category name.\n\nIf you genuinely cannot tell which it would be, return null. A guess here sends a lead to the wrong person, and they will not look at it twice.\n\nCover only the categories you have something to say about. Silence on a category is a finding.'
where key = 'scout' and body not like '%WHAT THE WORK WOULD BE%';
