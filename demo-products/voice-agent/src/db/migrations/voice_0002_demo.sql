-- The demo service: private keys for prospects, their workspaces, usage, and
-- the website scout's cache. See demo-products/DEMO-SERVICE-PLAN.md.
--
-- Shared project: every object here is voice_ prefixed (test/db.test.ts
-- enforces it). RLS is on with no policies: only the server, connecting as
-- the owner, reads or writes these tables.

-- ── Access keys ─────────────────────────────────────────────────────────────
-- The key itself is never stored: a SHA-256 hash to match, and its first four
-- characters to show and to throttle on.
create table if not exists public.voice_demo_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,
  key_prefix text not null check (key_prefix ~ '^[A-Z0-9]{4}$'),
  person_name text not null,
  company text,
  email text,
  products text[] not null default '{reception}',
  crm_lead_id text,
  issued_by text,
  limits jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz
);
create index if not exists voice_demo_keys_prefix_idx on public.voice_demo_keys (key_prefix);

-- What prospects do with a key: opened, preset chosen, started, calls...
create table if not exists public.voice_demo_usage (
  id bigint generated always as identity primary key,
  key_id uuid not null references public.voice_demo_keys (id) on delete cascade,
  tenant_id uuid references public.voice_tenants (id) on delete set null,
  at timestamptz not null default now(),
  kind text not null check (kind in ('opened', 'workspace_created', 'config_saved', 'scouted', 'started', 'reset', 'call', 'booking', 'order', 'menu_draft', 'faq_draft', 'staff_action')),
  data jsonb not null default '{}'::jsonb
);
create index if not exists voice_demo_usage_key_idx on public.voice_demo_usage (key_id, at);

-- The throttle on key entry (the portal's pattern): misses per IP and per prefix.
create table if not exists public.voice_demo_attempts (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  ip_hash text not null,
  key_prefix text not null,
  ok boolean not null
);
create index if not exists voice_demo_attempts_at_idx on public.voice_demo_attempts (at);

-- ── Workspaces ──────────────────────────────────────────────────────────────
-- A workspace is a tenant owned by a key. Our own demo businesses have no owner.
alter table public.voice_tenants add column if not exists owner_key_id uuid references public.voice_demo_keys (id) on delete cascade;
alter table public.voice_tenants add column if not exists preset text;
alter table public.voice_tenants add column if not exists config jsonb;
alter table public.voice_tenants add column if not exists started_at timestamptz;
create index if not exists voice_tenants_owner_idx on public.voice_tenants (owner_key_id);

-- ── Bookings: what the back office needs ────────────────────────────────────
-- Visit state is separate from the booking status, so the receptionist's
-- logic (confirmed or cancelled) is untouched.
alter table public.voice_bookings add column if not exists visit_status text not null default 'expected';
alter table public.voice_bookings add column if not exists allergies text;
alter table public.voice_bookings add column if not exists tags text[] not null default '{}';
alter table public.voice_bookings add column if not exists area_key text;
alter table public.voice_bookings add column if not exists history jsonb not null default '[]'::jsonb;
alter table public.voice_bookings drop constraint if exists voice_bookings_visit_status_check;
alter table public.voice_bookings add constraint voice_bookings_visit_status_check
  check (visit_status in ('expected', 'arrived', 'seated', 'finished', 'no_show'));

-- ── The website scout's cache ───────────────────────────────────────────────
-- Text and extracted signals only, never raw HTML; kept 14 days.
create table if not exists public.voice_site_pages (
  id bigint generated always as identity primary key,
  site text not null,
  url text not null,
  fetched_at timestamptz not null default now(),
  status integer not null,
  kind text not null check (kind in ('html', 'pdf', 'rendered', 'css')),
  text text,
  signals jsonb not null default '{}'::jsonb,
  content_hash text,
  unique (url, kind)
);
create index if not exists voice_site_pages_site_idx on public.voice_site_pages (site, fetched_at);

create table if not exists public.voice_site_scans (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  key_id uuid references public.voice_demo_keys (id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  result jsonb not null default '{}'::jsonb,
  requests integer not null default 0,
  tokens integer not null default 0,
  error text
);
create index if not exists voice_site_scans_site_idx on public.voice_site_scans (site, started_at);

alter table public.voice_demo_keys enable row level security;
alter table public.voice_demo_usage enable row level security;
alter table public.voice_demo_attempts enable row level security;
alter table public.voice_site_pages enable row level security;
alter table public.voice_site_scans enable row level security;
