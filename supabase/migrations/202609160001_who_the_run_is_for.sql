-- ============================================================
-- WHO THE RUN IS FOR
--
-- STATUS: applied to the live project on 16 September 2026.
--
-- The cron took the whole list, best-scoring first. That is the right
-- default for one list of 149 and the wrong one for everything after:
-- a week on Nottingham trades, a week on Alcester manufacturing, a run
-- held back until a specialist has capacity.
--
-- So a run has a target, and the target is a row.
--
-- THE OFF SWITCH
--
-- No target marked default means outreach_next_batch returns nothing
-- and the cron does nothing. That is deliberately NOT cron.alter_job:
-- starving the batch is safer than stopping the schedule, because an
-- empty batch cannot leave a lead half-processed, and because the
-- schedule staying put means nobody has to remember to restart it.
--
-- THE ONE FILTER THAT CANNOT WORK THE OBVIOUS WAY
--
-- Capability is what the run DISCOVERS. Filtering unassessed leads on
-- it would guarantee they never got one, so a lead nobody has assessed
-- passes the capability filter regardless. Location, sector and score
-- are all known when the lead lands, so those filter properly.
-- ============================================================

alter table public.sales_leads
  add column if not exists postcode_district text
  generated always as (
    substring(upper(location) from '([A-Z]{1,2}[0-9][A-Z0-9]?)\s*[0-9][A-Z]{2}\s*$')
  ) stored;

comment on column public.sales_leads.postcode_district is
  'The outward code pulled off the end of the address - NG7, B49. Derived, never typed. scoring-model.md 5.1 already decides territory by district rather than by town name, and this is the same handle.';

create index if not exists sales_leads_district_idx on public.sales_leads (postcode_district);

create table if not exists public.outreach_target (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  districts         text[] not null default '{}',
  sectors           text[] not null default '{}',
  capabilities      text[] not null default '{}',
  min_score         integer,
  is_default        boolean not null default false,
  active            boolean not null default true,
  sending_enabled   boolean not null default false,
  sending_armed_at  timestamptz,
  sending_armed_by  text,
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.outreach_target is
  'Which businesses a run is for. Empty array means "no filter on this", not "match nothing" - a target with every array empty is the whole list, which is what the pipeline did before targets existed.';
comment on column public.outreach_target.capabilities is
  'Filters on a capability the assessment has ALREADY established. A lead nobody has assessed passes regardless, because the run is what discovers its capability - filtering it out first would mean it never got one.';
comment on column public.outreach_target.is_default is
  'The one target the cron uses. None marked, and the batch comes back empty and the cron does nothing.';

create unique index if not exists outreach_target_one_default
  on public.outreach_target ((is_default)) where is_default;

alter table public.outreach_target enable row level security;
revoke all on public.outreach_target from anon, authenticated;

insert into public.outreach_target (name, note, is_default)
select 'Everything', 'The whole list, best-scoring first - what the pipeline did before targets existed. Kept as the default so nothing changed the moment this migration ran.', true
where not exists (select 1 from public.outreach_target);
