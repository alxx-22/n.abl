-- ============================================================
-- THE REGISTRIES: everything the agents know, as rows
--
-- STATUS: applied to the live project on 14 September 2026.
--
-- WHAT THIS REPLACES
--
-- The edge function held, as TypeScript constants: the five service
-- categories, the fit and confidence vocabularies, the three scales for
-- web presence, technical capacity and inbound volume, the credit
-- types, the model list with its rate limits, the two model chains, the
-- trading-year thresholds that decide which register facts are worth
-- mentioning, and the regexes that spot a booking widget in a page's
-- source. Thirty-odd decisions about the world, each of which needed a
-- deploy to change and none of which could be queried.
--
-- They are all rows now. One outreach_config() call at the start of a
-- tick and the function knows what it is allowed to think.
--
-- THE LINE, AND WHY IT IS WHERE IT IS
--
--   The VOCABULARY is data.   What terms exist, what they mean, how
--                             they rank, which ones demand evidence.
--   The GUARD is code.        That a term demanding evidence without
--                             evidence gets demoted.
--
-- A guard that can be edited by the thing it guards is not a guard. So
-- the rule lives in TypeScript and names no term: it asks the registry
-- which terms need evidence and which is the strongest that does not.
-- Add a sixth category or a fourth confidence level by INSERT and the
-- guard covers it on the next tick without being told.
-- ============================================================

-- ---------- terms ----------
--
-- One table for seven vocabularies because they are the same shape and
-- obey the same two rules, and seven near-identical tables would mean
-- seven places to forget one.
--
-- rank orders a dimension from weakest claim to strongest. It is what
-- lets the guard demote without knowing that the word for the top of
-- the fit scale happens to be "strong".
--
-- needs_evidence marks a term you may not use without a quote that is
-- literally on the business's own page. It is true for exactly two
-- terms today - the strongest fit, and the confidence level that
-- asserts the page says so - and those two are the whole reason this
-- column exists.

create table if not exists public.outreach_vocabulary (
  dimension          text    not null,
  term               text    not null,
  rank               integer not null,
  meaning            text    not null,
  needs_evidence     boolean not null default false,
  is_default         boolean not null default false,
  requires_dimension text,
  requires_min_rank  integer,
  active             boolean not null default true,
  primary key (dimension, term),
  constraint outreach_vocabulary_requirement_is_whole
    check ((requires_dimension is null) = (requires_min_rank is null)),
  -- A term that demands evidence can never be the fallback for a model
  -- that produced junk, or the guard would hand out the strongest claim
  -- in the vocabulary to the least reliable answers.
  constraint outreach_vocabulary_default_is_ungated
    check (not (is_default and needs_evidence))
);

create unique index if not exists outreach_vocabulary_one_default
  on public.outreach_vocabulary (dimension) where is_default;

comment on table public.outreach_vocabulary is
  'Every term the assessment may use, what it means, and how strong a claim it is. The prompt is built from this rather than repeating it, so adding a service category is an INSERT and not a deploy.';
comment on column public.outreach_vocabulary.rank is
  'Weakest claim to strongest, within a dimension. The guards demote by rank so that no guard has to name a term.';
comment on column public.outreach_vocabulary.needs_evidence is
  'This term may not be used without a verbatim quote from the business''s own page. Enforced in the edge function, which is deliberately not editable from here.';
comment on column public.outreach_vocabulary.is_default is
  'The honest answer when the model said nothing usable. Marked rather than derived: the weakest fit is "ruled out", which is a claim about the business and not a shrug, while the weakest confidence genuinely is one.';
comment on column public.outreach_vocabulary.requires_dimension is
  'This term is only available when another dimension reaches requires_min_rank. Today: training credits need at least mixed technical capacity, because a training day booked for people who will not attend is money burned.';

insert into public.outreach_vocabulary
  (dimension, term, rank, meaning, needs_evidence, is_default, requires_dimension, requires_min_rank)
values
  -- The service categories, quoted from 01-positioning/service-categories.md.
  -- "Train your team" is absent on purpose: nothing on a homepage tells
  -- you whether staff can use software they already pay for.
  ('category', 'save_time', 0,
   'A repeated manual task eating hours: rekeying between systems, chasing the same information, assembling the same document. Killed by: they will not let you watch the task being done.',
   false, false, null, null),
  ('category', 'reduce_mistakes', 0,
   'Errors that cost money or reputation and recur: missed dates, wrong figures, things that fall between people. Killed by: they can name the person who makes the mistakes, but not the process that allows them.',
   false, false, null, null),
  ('category', 'understand_data', 0,
   'They hold information they cannot answer questions with. Killed by: the underlying data does not exist, or nobody will own its accuracy.',
   false, false, null, null),
  ('category', 'build_new', 0,
   'A tool that does not exist and should: a booking flow, a portal, a reporting job. Killed by: they will not answer what happens on the day it does not exist.',
   false, false, null, null),
  ('category', 'fix_something', 0,
   'Something they already have is broken, abandoned or half-finished. Killed by: nobody can produce the source, the accounts or the credentials.',
   false, false, null, null),

  -- Fit. The top of this scale is the one term that demands a quote,
  -- and "possible" is where anything unsupported lands.
  ('fit', 'ruled_out', 0, 'The page actively says this is not a problem for them.',   false, false, null, null),
  ('fit', 'unlikely',  1, 'Nothing suggests it and something argues against it.',     false, false, null, null),
  ('fit', 'possible',  2, 'Plausible and worth asking about. The honest default.',    false, true,  null, null),
  ('fit', 'strong',    3, 'The page itself shows the problem. Requires a quote.',     true,  false, null, null),

  -- Confidence. Same rule one level up: the term that asserts the page
  -- said something must be able to show where.
  ('confidence', 'guessed',  0, 'Neither the page nor the sector supports this. Should almost never appear.', false, true,  null, null),
  ('confidence', 'inferred', 1, 'Follows from the sector or the register, not from this page.',               false, false, null, null),
  ('confidence', 'observed', 2, 'This page or a public register says so. Requires a quote.',                  true,  false, null, null),

  -- What they look like from outside. Four conversations that
  -- `website is not null` collapsed into one.
  ('web_presence', 'none',          0, 'No website at all was found.',                                        false, false, null, null),
  ('web_presence', 'social_only',   1, 'A Facebook or Instagram page doing the job of a website.',            false, false, null, null),
  ('web_presence', 'placeholder',   2, 'A domain that resolves to nothing useful: parked, holding, or it does not load.', false, false, null, null),
  ('web_presence', 'brochure',      3, 'A real site that describes the business. You can read about them; you cannot transact.', false, true,  null, null),
  ('web_presence', 'transactional', 4, 'You can book, buy, apply or submit something. Something happens when you press the button.', false, false, null, null),

  ('technical_capacity', 'unlikely', 0, 'Nobody inside will maintain anything. Whatever we build, we keep running.', false, false, null, null),
  ('technical_capacity', 'mixed',    1, 'One capable person, probably the owner, probably not their job.',           false, true,  null, null),
  ('technical_capacity', 'likely',   2, 'Software-comfortable people on staff who would take something over.',       false, false, null, null),

  ('inbound_volume', 'low',      0, 'A handful of enquiries a week. An auto-responder answers nobody.', false, true,  null, null),
  ('inbound_volume', 'moderate', 1, 'Enough repeat questions that answering them is a visible cost.',    false, false, null, null),
  ('inbound_volume', 'high',     2, 'Public-facing and constantly asked the same six things.',           false, false, null, null),

  -- Credits, from 13-credits/README.md, in ascending order of what the
  -- business has to be able to do for them to be worth selling.
  ('credit', 'assist',  0, 'We keep it running. Right where nobody inside will own it.',                   false, true,  null, null),
  ('credit', 'build',   1, 'More of it gets made. Right where there is appetite and something to extend.', false, false, null, null),
  ('credit', 'educate', 2, 'We teach them to run it themselves. Only where there is somebody to teach.',   false, false, 'technical_capacity', 1)
on conflict (dimension, term) do update set
  rank = excluded.rank, meaning = excluded.meaning,
  needs_evidence = excluded.needs_evidence, is_default = excluded.is_default,
  requires_dimension = excluded.requires_dimension,
  requires_min_rank = excluded.requires_min_rank,
  active = true;

alter table public.outreach_vocabulary enable row level security;
revoke all on public.outreach_vocabulary from anon, authenticated;

-- ---------- models ----------
--
-- Which model does which job, in what order to fall back, and what we
-- believe its free-tier ceiling is. Previously two TypeScript maps.
--
-- rpd here is what we TRY. A 429 is what we BELIEVE: outreach_record_call
-- stores the count actually reached and outreach_model_budget honours
-- that over this column from then on. A stale published figure costs
-- one wasted request rather than a wrong answer, and swapping a
-- deprecated model for its successor is an UPDATE.

create table if not exists public.outreach_model (
  role        text    not null,
  model       text    not null,
  priority    integer not null,
  rpd         integer not null check (rpd > 0),
  gap_ms      integer not null default 4000 check (gap_ms >= 0),
  temperature numeric check (temperature >= 0 and temperature <= 2),
  active      boolean not null default true,
  note        text    not null default '',
  primary key (role, model)
);

comment on table public.outreach_model is
  'The fallback chain per agent. rpd is the published free-tier figure we try; the observed ceiling from a 429 always wins over it.';
comment on column public.outreach_model.temperature is
  'Overrides the prompt row''s temperature for this model only. Normally null - the temperature belongs to the job, not the model.';

insert into public.outreach_model (role, model, priority, rpd, gap_ms, note) values
  ('scout',  'gemini-3.5-flash-lite', 10, 1000, 4000, 'Extraction and judgement at volume. Three calls per lead land here.'),
  ('scout',  'gemini-2.5-flash-lite', 20, 1000, 4000, 'Same allowance, separate bucket.'),
  ('scout',  'gemini-2.5-flash',      30,  250, 6000, 'Last resort; competes with the writer for a smaller allowance.'),
  ('editor', 'gemini-3.5-flash-lite', 10, 1000, 4000, 'Judgement over a short argument. Cheap on purpose - it may run twice a lead.'),
  ('editor', 'gemini-2.5-flash-lite', 20, 1000, 4000, ''),
  ('editor', 'gemini-2.5-flash',      30,  250, 6000, ''),
  ('writer', 'gemini-3.8-flash',      10,  250, 6000, 'Prose. The only stage whose output a stranger reads, and the only one worth the smaller allowance.'),
  ('writer', 'gemini-2.5-flash',      20,  250, 6000, ''),
  ('writer', 'gemini-2.5-flash-lite', 30, 1000, 4000, 'Degrades the sentence rather than losing the lead.')
on conflict (role, model) do update set
  priority = excluded.priority, rpd = excluded.rpd, gap_ms = excluded.gap_ms,
  note = excluded.note, active = true;

alter table public.outreach_model enable row level security;
revoke all on public.outreach_model from anon, authenticated;

-- ---------- register facts ----------
--
-- "Trading 15 years" was a hardcoded 15. Whether fifteen years is the
-- point at which a business is worth calling long-established is a
-- claim about Nottingham trades, not a property of the software.
--
-- The angle matters more than the fact. "Trading 22 years with no
-- website" must not read as criticism - it usually means the work comes
-- from people who already know them, which is a strength. Getting that
-- wrong in a first sentence is unrecoverable, and it is exactly the
-- kind of judgement that should be editable by the person whose
-- reputation is on the letter.

create table if not exists public.outreach_fact_rule (
  key               text primary key,
  priority          integer not null default 100,
  min_trading_years integer,
  max_trading_years integer,
  requires_website  boolean,
  requires_industry boolean,
  fact_template     text not null,
  angle             text not null,
  evidence_template text not null,
  active            boolean not null default true
);

comment on table public.outreach_fact_rule is
  'Which verified register facts are worth putting in front of the agents, and how each should be read. {years} and {industry} are substituted from the lead.';
comment on column public.outreach_fact_rule.angle is
  'How to read the fact. This is the judgement, not the fact, and it is the field worth arguing about.';

insert into public.outreach_fact_rule
  (key, priority, min_trading_years, requires_website, requires_industry,
   fact_template, angle, evidence_template)
values
  ('long_established_no_website', 10, 10, false, null,
   'Trading {years} years. No website could be found for them.',
   'A long track record with no website usually means the work comes from people who already know them - a strength, not a gap. Must not read as criticism, and must not assume they want one.',
   'Companies House incorporation date'),
  ('long_established', 20, 15, null, null,
   'Trading {years} years.',
   'A long-established business usually has processes done the same way since before anyone thought to write them down. Say the thing about the process, never about the age.',
   'Companies House incorporation date'),
  ('registered_activity', 30, null, null, true,
   'Companies House records their activity as: {industry}.',
   'Their own filing, in their own words. Useful only where it says something about how the work runs - otherwise it is just a SIC code and reads like one.',
   'Companies House SIC description: {industry}')
on conflict (key) do update set
  priority = excluded.priority, min_trading_years = excluded.min_trading_years,
  requires_website = excluded.requires_website, requires_industry = excluded.requires_industry,
  fact_template = excluded.fact_template, angle = excluded.angle,
  evidence_template = excluded.evidence_template, active = true;

alter table public.outreach_fact_rule enable row level security;
revoke all on public.outreach_fact_rule from anon, authenticated;

-- ---------- what the page source gives away ----------
--
-- A script tag is a fact and a model's opinion about one is not, so
-- these are matched in code and handed over as findings rather than
-- asked for. Which is precisely why the list should not be in code: it
-- goes stale every time a booking tool gets popular in the Midlands.

create table if not exists public.outreach_page_signal (
  key         text primary key,
  pattern     text not null,
  flags       text not null default 'i',
  description text not null,
  active      boolean not null default true
);

comment on table public.outreach_page_signal is
  'Regexes run against the raw HTML. Matched in code because a script tag is a fact; listed here because the list goes stale and a deploy is too much ceremony for adding a booking vendor.';

insert into public.outreach_page_signal (key, pattern, description) values
  ('booking',    'calendly|acuityscheduling|simplybook|bookwhen|resdiary|opentable|setmore|10to8|squarespace-scheduling', 'a third-party booking tool is embedded'),
  ('ecommerce',  'shopify|woocommerce|bigcommerce|ecwid|squarespace-commerce|opencart|magento',                          'an e-commerce platform is in use'),
  ('payments',   'stripe\.com|paypal|worldpay|sumup|gocardless|square(up)?\.com',                                        'a payment provider is referenced'),
  ('form',       '<form[^>]*>',                                                                                          'the site has at least one form'),
  ('mailto',     'mailto:',                                                                                              'the site publishes a mailto link'),
  ('wordpress',  'wp-content|wordpress',                                                                                 'built on WordPress'),
  ('wix',        'wix\.com|_wixCssImports',                                                                               'built on Wix'),
  ('squarespace','static1\.squarespace\.com|squarespace\.com/universal',                                                  'built on Squarespace'),
  ('facebook',   'facebook\.com/(?!sharer|plugins)',                                                                      'links to a Facebook page'),
  ('livechat',   'intercom|tawk\.to|crisp\.chat|livechat|zendesk|drift\.com',                                             'a live chat or chatbot widget is already installed'),
  ('pdf',        '\.(pdf)"',                                                                                              'a PDF is offered for download'),
  ('analytics',  'googletagmanager|google-analytics|gtag\(|plausible\.io|fathom',                                         'the site is measured with an analytics tool')
on conflict (key) do update set
  pattern = excluded.pattern, flags = excluded.flags,
  description = excluded.description, active = true;

alter table public.outreach_page_signal enable row level security;
revoke all on public.outreach_page_signal from anon, authenticated;

-- ---------- the dials ----------
--
-- Batch size, page budget, timeouts, how many rounds the agents get to
-- argue, and the length a first sentence is allowed to be.
--
-- The edge function clamps each of these into a range it will not
-- exceed whatever this table says. That envelope is the one set of
-- numbers deliberately left in code: a setting should tune the system,
-- not be able to disable a check by setting it to zero.

create table if not exists public.outreach_setting (
  key   text primary key,
  value jsonb not null,
  note  text not null
);

comment on table public.outreach_setting is
  'Operational dials. The edge function clamps every one of these into a fixed envelope, so a bad value here degrades throughput and cannot switch off a check.';

insert into public.outreach_setting (key, value, note) values
  ('batch_size',        '3',    'Leads per tick. Ten-minute cron, so 3 clears 149 leads in about eight hours.'),
  ('max_page_chars',    '9000', 'How much page text the scout reads. Beyond this the tail is navigation and footer.'),
  ('fetch_timeout_ms',  '12000','Giving up on a slow site. A business whose homepage takes twelve seconds has told us something too.'),
  ('model_timeout_ms',  '30000','Per model call.'),
  ('max_rounds',        '2',    'How many times the editor may promote a different angle after the writer refuses one. Two is enough to recover from a bad first pick and cheap enough not to matter.'),
  ('min_words',         '6',    'Below this a clause cannot be specific enough to be worth a stranger reading.'),
  ('max_words',         '45',   'Above this it is more than one thing, and more than one thing is a pitch.'),
  ('max_angles',        '4',    'How many cases the scout may argue. More than this and the editor is just picking.'),
  ('user_agent',        '"n.abl-research/1.0 (+https://nabl.agency; hello@nabl.agency)"', 'Identifies us to anyone reading their logs. Non-negotiable in spirit, editable in wording.'),
  ('prior_min_sample',  '8',    'How many assessed leads in a sector before the observed pattern is shown to the scout alongside the hand-written prior.')
on conflict (key) do update set value = excluded.value, note = excluded.note;

alter table public.outreach_setting enable row level security;
revoke all on public.outreach_setting from anon, authenticated;

-- ---------- prompts: one per agent ----------
--
-- The key constraint listed the two stages by name. There are three
-- agents now and there may be four, so the constraint goes and the
-- edge function refuses to run without the rows it needs instead.

alter table public.outreach_prompt drop constraint if exists outreach_prompt_key_check;

comment on table public.outreach_prompt is
  'One system prompt per agent, editable without a deploy. The vocabulary is no longer repeated here - it is assembled from outreach_vocabulary at run time - so these say how to think, not what the words are.';

-- ---------- the whole lot, in one call ----------

create or replace function public.outreach_config()
returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_catalog'
as $function$
  select jsonb_build_object(
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

comment on function public.outreach_config() is
  'Everything the agents are allowed to know, in one round trip at the start of a tick. Adding a service category, swapping a deprecated model or retuning a threshold happens here and takes effect within ten minutes, without a deploy.';

-- ---------- budget, now that rpd has a home ----------

drop function if exists public.outreach_model_budget(text, integer);

create or replace function public.outreach_model_budget(p_model text)
returns integer
language sql stable security definer
set search_path to 'public', 'pg_catalog'
as $function$
  -- The published figure is the starting point. An observed ceiling
  -- always beats it: if the API said 429 at 180, 180 is the number
  -- whatever a documentation page claims. A model with no registry row
  -- gets no budget rather than an assumed one - refusing to guess an
  -- allowance is cheaper than discovering it was wrong.
  with spec as (
    select max(rpd) as rpd from public.outreach_model
     where model = p_model and active
  )
  select greatest(coalesce(
    (select case when u.exhausted then 0
                 else coalesce(u.observed_rpd, (select rpd from spec)) - u.used end
       from public.outreach_model_usage u
      where u.usage_day = public.outreach_quota_day() and u.model = p_model),
    (select rpd from spec), 0), 0)
$function$;

-- ---------- what the agents said to each other ----------
--
-- The argument is the thing worth keeping. Six weeks from now the
-- question will not be "what did it write" - that is on the lead - but
-- "why did it write that and not the other thing", and without this
-- there is no answer.

create table if not exists public.outreach_round (
  id         bigserial primary key,
  lead_id    uuid not null references public.sales_leads(id) on delete cascade,
  round      integer not null,
  agent      text not null,
  model      text not null,
  decision   text not null,
  angle_key  text,
  reason     text,
  created_at timestamptz not null default now()
);

create index if not exists outreach_round_lead_idx on public.outreach_round (lead_id, round, id);
create index if not exists outreach_round_created_idx on public.outreach_round (created_at);

comment on table public.outreach_round is
  'The negotiation, one row per move: what the scout argued, what the editor promoted and why it passed over the rest, whether the writer took it or handed it back.';

alter table public.outreach_round enable row level security;
revoke all on public.outreach_round from anon, authenticated;

create or replace function public.outreach_record_round(
  p_lead_id uuid, p_round integer, p_agent text, p_model text,
  p_decision text, p_angle_key text default null, p_reason text default null
)
returns void
language sql security definer
set search_path to 'public', 'pg_catalog'
as $function$
  insert into public.outreach_round (lead_id, round, agent, model, decision, angle_key, reason)
  values (p_lead_id, p_round, p_agent, p_model, p_decision,
          nullif(btrim(coalesce(p_angle_key, '')), ''),
          left(nullif(btrim(coalesce(p_reason, '')), ''), 1000))
$function$;

create or replace function public.outreach_prune_rounds()
returns integer
language sql security definer
set search_path to 'public', 'pg_catalog'
as $function$
  with gone as (
    delete from public.outreach_round where created_at < now() - interval '60 days'
    returning 1)
  select count(*)::integer from gone
$function$;

-- ---------- reading an argument back ----------

create or replace view public.lead_argument as
select r.lead_id, l.company, r.round, r.agent, r.model, r.decision,
       r.angle_key, r.reason, r.created_at
from public.outreach_round r
join public.sales_leads l on l.id = r.lead_id
order by r.lead_id, r.id;

comment on view public.lead_argument is
  'Why this lead got the sentence it got. Read it when a draft looks wrong - the mistake is usually in what the editor promoted, not in how the writer phrased it.';

-- ---------- service role only ----------
--
-- `revoke from public` is not enough on Supabase: ALTER DEFAULT
-- PRIVILEGES grants EXECUTE to anon and authenticated directly, so
-- revoking from PUBLIC leaves both holding their own grant.

do $$
declare f text;
begin
  foreach f in array array[
    'public.outreach_config()',
    'public.outreach_model_budget(text)',
    'public.outreach_record_round(uuid, integer, text, text, text, text, text)',
    'public.outreach_prune_rounds()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

revoke all on public.lead_argument from anon, authenticated;
grant select on public.lead_argument to service_role;
