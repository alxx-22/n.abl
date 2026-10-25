-- A pub's fixtures and one-off events (presets/pub.md §5.2, M2): the match
-- on the big screens, a band, a quiz night out of the usual. The weekly
-- ones (the quiz, live music on Saturdays) come from the pub's answers; these
-- are what the manager adds in the back office, and what the seed adds. The
-- receptionist's whats_on reads both, and says nothing that isn't listed.
--
-- Shared project: every object here is voice_ prefixed (test/db.test.ts
-- enforces it). Additive, and every statement can run again without harm.

create table if not exists public.voice_pub_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.voice_tenants (id) on delete cascade,
  starts_at timestamptz not null,
  title text not null,
  kind text not null default 'sport' check (kind in ('sport', 'music', 'quiz', 'other')),
  place text,
  notes text,
  source text not null default 'console' check (source in ('console', 'seed', 'eval')),
  created_at timestamptz not null default now()
);
create index if not exists voice_pub_events_tenant_time_idx on public.voice_pub_events (tenant_id, starts_at);
alter table public.voice_pub_events enable row level security;
