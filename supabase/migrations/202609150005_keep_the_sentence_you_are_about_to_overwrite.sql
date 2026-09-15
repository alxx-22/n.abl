-- ============================================================
-- KEEP THE SENTENCE YOU ARE ABOUT TO OVERWRITE
--
-- STATUS: applied to the live project on 15 September 2026.
--
-- Re-assessing a lead rewrites its observation. Until now the previous
-- sentence simply vanished, which makes two things impossible:
--
--   1. Re-running the pipeline safely. A lead that had a good sentence
--      and comes back three times refused ends with nothing, and there
--      is no way back to what it had.
--   2. Telling whether a prompt change made the writing better. The
--      only honest test is the same lead before and after, and that
--      needs both.
--
-- So every observation is copied out the moment before it is replaced
-- or cleared. The trigger fires on the column, not on the caller, which
-- means a hand-run UPDATE in the SQL editor is archived exactly like a
-- pipeline write - the case where losing it would hurt most.
-- ============================================================

create table if not exists public.lead_observation_history (
  id          bigint generated always as identity primary key,
  lead_id     uuid not null references public.sales_leads(id) on delete cascade,
  observation text not null,
  basis       text,
  evidence    text,
  model       text,
  written_at  timestamptz,
  replaced_at timestamptz not null default now()
);

create index if not exists lead_observation_history_lead_idx
  on public.lead_observation_history (lead_id, replaced_at desc);

comment on table public.lead_observation_history is
  'Every observation that was overwritten or cleared, with the evidence it rested on. Written by trigger, never by the application.';

alter table public.lead_observation_history enable row level security;
revoke all on public.lead_observation_history from anon, authenticated;

create or replace function public.lead_archive_observation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
begin
  -- Only an actual change. An UPDATE that rewrites the row without
  -- touching the sentence is not a replacement, and archiving it would
  -- fill the table with copies of the same text.
  if old.observation is not null
     and (new.observation is distinct from old.observation) then
    insert into public.lead_observation_history
      (lead_id, observation, basis, evidence, model, written_at)
    values (old.id, old.observation, old.observation_basis,
            old.observation_evidence, old.observation_model, old.observation_at);
  end if;
  return new;
end
$function$;

drop trigger if exists lead_archive_observation on public.sales_leads;
create trigger lead_archive_observation
  before update of observation on public.sales_leads
  for each row execute function public.lead_archive_observation();

revoke all on function public.lead_archive_observation() from anon, authenticated, public;
