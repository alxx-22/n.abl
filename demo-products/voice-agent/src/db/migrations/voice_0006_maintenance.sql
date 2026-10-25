-- Property maintenance: the properties a contractor looks after, the jobs
-- on its board, the safety certificates it keeps track of, and every safety
-- call it took (demo-products/presets/property-maintenance.md §5.2).
--
-- Shared project: every object here is voice_ prefixed (test/db.test.ts
-- enforces it), and mt keeps them apart from the estate agent's listings.
-- Additive only, and every statement can run again without harm. No other
-- kind of business writes these tables, so every other business's rows are
-- as they were.

-- ── Properties ──────────────────────────────────────────────────────────────
-- Start writes the sample homes here under the sample clients; staff change
-- them during the demo and Reset puts them back. A key safe's code is never
-- stored: access says only that the office has it. markers are for staff
-- and never returned to a caller.
create table if not exists public.voice_mt_properties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.voice_tenants (id) on delete cascade,
  property_key text not null,
  number text not null,
  street text not null,
  district text not null,
  town text not null,
  kind text not null default 'house' check (kind in ('house', 'flat', 'bungalow', 'commercial')),
  client_key text,
  occupant_name text,
  occupant_phone text,
  occupant_texts_ok boolean not null default false,
  notes jsonb not null default '{}'::jsonb,
  access jsonb not null default '{}'::jsonb,
  vulnerable text[] not null default '{}',
  vulnerable_consent_at timestamptz,
  markers text[] not null default '{}',
  gas boolean not null default false,
  gas_appliances integer not null default 0 check (gas_appliances >= 0),
  example boolean not null default false,
  unique (tenant_id, property_key)
);
create index if not exists voice_mt_properties_phone_idx on public.voice_mt_properties (tenant_id, occupant_phone);
create index if not exists voice_mt_properties_district_idx on public.voice_mt_properties (tenant_id, district);

-- ── Jobs ────────────────────────────────────────────────────────────────────
-- A repair from report to done. Routine and urgent jobs have a date and a
-- visit window; an emergency has an attend-by time instead. clocks hold the
-- targets that count down on a card (an Awaab's Law investigation, an EICR
-- remedial); history says who changed what, and when.
create table if not exists public.voice_mt_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.voice_tenants (id) on delete cascade,
  reference text not null,
  property_key text,
  client_key text,
  reporter_name text,
  reporter_phone text,
  reporter_role text check (reporter_role is null or reporter_role in ('occupant', 'agent', 'landlord', 'homeowner', 'other')),
  trade text not null,
  priority text not null check (priority in ('emergency', 'urgent', 'routine')),
  reason text,
  description text not null default '',
  kind text not null default 'repair' check (kind in ('repair', 'gas_record', 'boiler_service', 'gas_record_and_service', 'eicr', 'quote', 'inspection')),
  status text not null default 'new' check (status in ('new', 'awaiting_approval', 'scheduled', 'on_the_way', 'on_site', 'waiting', 'done', 'invoiced', 'cancelled')),
  visit_date date,
  window_key text,
  attend_by timestamptz,
  engineer_key text,
  eta_minutes integer,
  on_the_way_at timestamptz,
  po text,
  price_pence integer check (price_pence is null or price_pence >= 0),
  clocks jsonb not null default '[]'::jsonb,
  flags text[] not null default '{}',
  access_attempts integer not null default 0,
  waiting_for text,
  notes text,
  history jsonb not null default '[]'::jsonb,
  source text not null default 'phone' check (source in ('phone', 'browser', 'eval', 'console', 'seed')),
  call_id uuid references public.voice_calls (id) on delete set null,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  unique (tenant_id, reference)
);
create index if not exists voice_mt_jobs_date_idx on public.voice_mt_jobs (tenant_id, visit_date);
create index if not exists voice_mt_jobs_phone_idx on public.voice_mt_jobs (tenant_id, reporter_phone);
create index if not exists voice_mt_jobs_property_idx on public.voice_mt_jobs (tenant_id, property_key);

-- ── Safety certificates ─────────────────────────────────────────────────────
-- One row a property and kind: the current certificate, when it runs out,
-- any remedial work it found, and the job booked to renew it. Due soon and
-- overdue are worked out from the dates on the day, never stored.
create table if not exists public.voice_mt_certificates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.voice_tenants (id) on delete cascade,
  property_key text not null,
  kind text not null check (kind in ('gas_record', 'eicr', 'boiler_service', 'alarms', 'pat')),
  issued date,
  expires date,
  remedials jsonb not null default '[]'::jsonb,
  booked_job text,
  unique (tenant_id, property_key, kind)
);

-- ── Safety calls ────────────────────────────────────────────────────────────
-- Every gas, carbon monoxide, fire and electrical call: when the advice was
-- given, which version of the script, and the job that followed.
create table if not exists public.voice_mt_incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.voice_tenants (id) on delete cascade,
  property_key text,
  kind text not null,
  advice_version integer not null,
  advised_at timestamptz,
  caller_phone text,
  follow_up_job text,
  notes text,
  source text not null default 'phone' check (source in ('phone', 'browser', 'eval', 'console', 'seed')),
  call_id uuid references public.voice_calls (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists voice_mt_incidents_tenant_idx on public.voice_mt_incidents (tenant_id, created_at);

alter table public.voice_mt_properties enable row level security;
alter table public.voice_mt_jobs enable row level security;
alter table public.voice_mt_certificates enable row level security;
alter table public.voice_mt_incidents enable row level security;
