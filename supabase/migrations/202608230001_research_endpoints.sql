-- Per-user research endpoints, and a ledger of what each one was asked to do.
--
-- Every team member has their own Claude Pro subscription, so every team
-- member has their own proxy. There is no shared endpoint and there must not
-- be one: routing Alex's runs through someone else's subscription would spend
-- their allowance and put their session behind Alex's work.
--
-- So the edge function does not hold a URL. It looks up the endpoint belonging
-- to the caller, and if that person has not registered one, the answer is no.

-- ---------------------------------------------------------------------------
-- 1. One endpoint per person
-- ---------------------------------------------------------------------------

create table if not exists public.research_endpoints (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- The Cloudflare Tunnel hostname in front of that person's proxy. Stored
  -- with a shape check rather than as free text: a plain-http endpoint would
  -- put the request, and anything in it, on the wire in clear.
  url text not null check (url ~ '^https://[a-z0-9.-]+(:[0-9]+)?(/.*)?$'),

  -- The Cloudflare Access service token for that hostname. This is a secret
  -- and the column grant below makes it unreadable to `authenticated` —
  -- including by the person who owns the row. Only the service role, which is
  -- what the edge function runs as, can read it back.
  service_token text not null check (btrim(service_token) <> ''),

  -- Turning someone off should not require deleting their setup.
  enabled boolean not null default true,

  -- How many runs this person may start in a rolling hour. Per user because
  -- the limit that matters is their subscription's, not ours.
  runs_per_hour integer not null default 20 check (runs_per_hour between 1 and 200),

  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

comment on table public.research_endpoints is
  'One proxy endpoint per team member, each backed by that person''s own '
  'Claude subscription. See business/07-crm/research-endpoint.md.';

-- ---------------------------------------------------------------------------
-- 2. The ledger
-- ---------------------------------------------------------------------------
-- Every run is recorded before it starts, not after it succeeds. A run that
-- crashes still spent someone's allowance, and a rate limit that only counts
-- successes is a rate limit an error loop walks straight through.

create table if not exists public.research_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.sales_leads(id) on delete set null,

  -- Kept even when the lead is deleted, so the record of what was asked
  -- survives the record it was asked about.
  lead_company text,

  kind text not null default 'research'
    check (kind in ('research', 'draft')),

  status text not null default 'started'
    check (status in ('started', 'succeeded', 'failed', 'refused')),

  -- Verbatim from the proxy when something goes wrong. Worth keeping: "you
  -- have hit your usage limit" and "the tunnel is down" need different fixes
  -- and look identical from the CRM.
  error text,

  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists research_runs_user_started_idx
  on public.research_runs (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- 3. The rate limit, in the database
-- ---------------------------------------------------------------------------
-- In a trigger rather than in the edge function, for the same reason the
-- marketing ceiling is: a limit enforced only by the thing that calls it is a
-- limit that a second caller does not have.

create or replace function public.research_run_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_endpoint public.research_endpoints%rowtype;
  v_recent integer;
begin
  select * into v_endpoint from public.research_endpoints where user_id = new.user_id;

  if not found then
    raise exception 'no research endpoint registered for this user'
      using errcode = 'check_violation';
  end if;

  if not v_endpoint.enabled then
    raise exception 'this research endpoint is disabled'
      using errcode = 'check_violation';
  end if;

  select count(*) into v_recent
  from public.research_runs r
  where r.user_id = new.user_id
    and r.started_at > now() - interval '1 hour';

  if v_recent >= v_endpoint.runs_per_hour then
    raise exception
      'rate limit: % runs in the last hour, which is this endpoint''s limit',
      v_recent
      using errcode = 'check_violation';
  end if;

  update public.research_endpoints set last_used_at = now() where user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists research_runs_rate_limit on public.research_runs;
create trigger research_runs_rate_limit
before insert on public.research_runs
for each row execute function public.research_run_guard();

-- ---------------------------------------------------------------------------
-- 4. Row level security
-- ---------------------------------------------------------------------------

alter table public.research_endpoints enable row level security;
alter table public.research_runs enable row level security;

drop policy if exists "a person manages only their own endpoint" on public.research_endpoints;
create policy "a person manages only their own endpoint"
on public.research_endpoints for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "a person sees only their own runs" on public.research_runs;
create policy "a person sees only their own runs"
on public.research_runs for select
to authenticated
using (user_id = auth.uid());

-- Runs are written by the edge function under the service role, never by the
-- browser. Without this the rate limit is advisory: anything holding an anon
-- key and a session could insert rows, or not insert them.
drop policy if exists "runs are recorded by the server, not the browser" on public.research_runs;

-- ---------------------------------------------------------------------------
-- 5. The token column is not readable by its owner
-- ---------------------------------------------------------------------------
-- RLS is row-level; keeping a secret out of a row the user is allowed to read
-- needs a column grant. Without this, anyone signed in could select their own
-- service token out of the browser and it would be in the network tab.

revoke all on public.research_endpoints from anon, authenticated;
grant select (user_id, url, enabled, runs_per_hour, label, created_at, last_used_at)
  on public.research_endpoints to authenticated;
grant insert (user_id, url, service_token, enabled, runs_per_hour, label)
  on public.research_endpoints to authenticated;
grant update (url, service_token, enabled, runs_per_hour, label)
  on public.research_endpoints to authenticated;
grant delete on public.research_endpoints to authenticated;

revoke all on public.research_runs from anon, authenticated;
grant select on public.research_runs to authenticated;

revoke all on function public.research_run_guard() from public, anon, authenticated;
