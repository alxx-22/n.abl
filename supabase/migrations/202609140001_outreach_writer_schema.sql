-- ============================================================
-- THE OUTREACH WRITER, MOVED INTO THE DATABASE
--
-- STATUS: applied to the live project on 14 September 2026.
--
-- The observation pipeline used to run as Node scripts on one laptop,
-- which meant it only ran when that laptop was open. This is the same
-- work as a queue the database drives: pg_cron wakes an edge function
-- every ten minutes, it takes three leads, writes their observation and
-- goes back to sleep.
--
-- A handful at a time rather than all 149, for three reasons that
-- happen to agree. An edge function has a wall-clock limit and 149
-- leads paced against somebody else's rate limit would blow it. A
-- free-tier daily allowance is spent more safely in small bites. And
-- 11-outreach/README.md already says one person can properly read 20 to
-- 40 messages in a sitting, so a trickle is what the human gate can
-- absorb anyway.
--
-- WHAT THIS DOES NOT DO: send anything. approval-gates.md says both
-- gates are human and both are before sending, and that "anyone
-- proposing to move a gate downstream to increase throughput has
-- misunderstood what the gate is for". This fills the queue up to the
-- gate and stops.
-- ============================================================

-- pg_cron drives the schedule, pg_net makes the HTTP call. Both live
-- outside public on purpose: putting job control or arbitrary HTTP
-- behind PostgREST is the last place either belongs.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- ---------- where the observation lands ----------

alter table public.sales_leads
  add column if not exists observation            text,
  add column if not exists observation_basis      text,
  add column if not exists observation_evidence   text,
  add column if not exists observation_model      text,
  add column if not exists observation_at         timestamptz,
  add column if not exists observation_attempts   integer not null default 0,
  add column if not exists observation_error      text;

comment on column public.sales_leads.observation is
  'The one true thing a first contact says about this business. Written by the outreach-writer edge function; never invented, always traceable to observation_evidence.';
comment on column public.sales_leads.observation_evidence is
  'Where the claim came from: a register citation, or a verbatim quote from the business''s own page. This is what we produce if someone asks "how do you know that?".';
comment on column public.sales_leads.observation_attempts is
  'Incremented on failure. A lead that keeps failing stops being retried rather than burning the daily allowance on the same broken page.';

-- An observation without its evidence is an unsourced claim about a
-- stranger's business, which is the thing this whole design exists to
-- prevent. The database refuses the combination rather than trusting
-- every future caller to remember.
alter table public.sales_leads
  drop constraint if exists sales_leads_observation_has_evidence;
alter table public.sales_leads
  add constraint sales_leads_observation_has_evidence check (
    observation is null
    or (observation_evidence is not null and observation_basis is not null)
  );

alter table public.sales_leads
  drop constraint if exists sales_leads_observation_basis_known;
alter table public.sales_leads
  add constraint sales_leads_observation_basis_known check (
    observation_basis is null
    or observation_basis in ('register', 'page', 'template')
  );

-- ---------- per-model daily budget ----------

-- Keyed by model, not by account. Flash-Lite's thousand requests a day
-- and Flash's two hundred and fifty are separate budgets, and treating
-- them as one wastes the first or blows through the second.
create table if not exists public.outreach_model_usage (
  usage_day     date    not null,
  model         text    not null,
  used          integer not null default 0,
  observed_rpd  integer,
  exhausted     boolean not null default false,
  first_call_at timestamptz,
  last_call_at  timestamptz,
  primary key (usage_day, model)
);

comment on table public.outreach_model_usage is
  'One row per model per Pacific day. observed_rpd is set when the API answers 429: whatever a published table claims, the ceiling is what we actually hit, and that is believed from then on.';

create or replace function public.outreach_quota_day()
returns date
language sql
stable
set search_path to 'pg_catalog'
as $$ select (now() at time zone 'America/Los_Angeles')::date $$;

comment on function public.outreach_quota_day() is
  'Google resets requests-per-day at midnight Pacific. Not UTC, not Europe/London.';

-- ---------- the page cache ----------

-- Other people's website content, held only between the fetch and the
-- write, then deleted. Minimisation is the reason: the evidence quote
-- is what we would have to produce if challenged, and that is kept on
-- the lead. The page itself is scaffolding.
create table if not exists public.outreach_page_cache (
  lead_id    uuid primary key references public.sales_leads(id) on delete cascade,
  page_text  text not null,
  fetched_at timestamptz not null default now()
);

comment on table public.outreach_page_cache is
  'Transient. Deleted as soon as the observation is written, and anything older than a day is swept regardless.';

-- ---------- the run log ----------

create table if not exists public.outreach_runs (
  id          bigserial primary key,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  attempted   integer not null default 0,
  written     integer not null default 0,
  rejected    integer not null default 0,
  detail      jsonb,
  error       text
);

comment on table public.outreach_runs is
  'One row per tick. Exists so "why has nothing been written for three days" has an answer without reading edge function logs.';

create index if not exists outreach_runs_started_idx on public.outreach_runs (started_at desc);

-- ---------- nothing here is public ----------

alter table public.outreach_model_usage enable row level security;
alter table public.outreach_page_cache  enable row level security;
alter table public.outreach_runs        enable row level security;

-- No policies, deliberately. RLS with no policy denies everyone; the
-- service role bypasses RLS and is the only thing that touches these.
-- The linter reports this as rls_enabled_no_policy at INFO. That is the
-- intended state, not an oversight.
revoke all on public.outreach_model_usage from anon, authenticated;
revoke all on public.outreach_page_cache  from anon, authenticated;
revoke all on public.outreach_runs        from anon, authenticated;
