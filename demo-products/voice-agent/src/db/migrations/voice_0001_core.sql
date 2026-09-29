-- voice_0001_core: the voice agent's tables.
--
-- This Supabase project is shared with a text-chatbot demo. Every object here
-- is prefixed voice_, nothing unprefixed is created, altered or dropped, and
-- test/migrations.test.ts refuses any migration that breaks that rule.
--
-- Row-level security is on for every table with no policies, so the shared
-- anon and authenticated roles can read and write nothing. The server connects
-- as the database owner. Console policies arrive with console sign-in.
--
-- Written to run unchanged on Supabase (Postgres 17) and on PGlite, which the
-- tests use: no extensions, no references to the auth schema.

create table if not exists public.voice_schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists public.voice_tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  business_type text not null,
  status text not null default 'demo' check (status in ('demo', 'pilot', 'live')),
  profile jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.voice_staff (
  user_id uuid not null,
  tenant_id uuid references public.voice_tenants (id) on delete cascade,
  role text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now()
);
create unique index if not exists voice_staff_user_tenant_idx
  on public.voice_staff (user_id, coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists public.voice_phone_numbers (
  e164 text primary key check (e164 ~ '^\+[1-9][0-9]{6,14}$'),
  tenant_id uuid references public.voice_tenants (id) on delete set null,
  purpose text not null default 'tenant' check (purpose in ('tenant', 'pin_router')),
  pin text,
  assigned_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.voice_customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.voice_tenants (id) on delete cascade,
  phone text not null,
  name text,
  notes text,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, phone)
);

create table if not exists public.voice_calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.voice_tenants (id) on delete cascade,
  channel text not null check (channel in ('phone', 'browser', 'eval')),
  provider_call_id text,
  from_number text,
  to_number text,
  model text,
  fallbacks jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  outcome text,
  summary text,
  usage jsonb not null default '{}'::jsonb,
  latency jsonb not null default '{}'::jsonb,
  guardrail_flags integer not null default 0
);
create index if not exists voice_calls_tenant_started_idx on public.voice_calls (tenant_id, started_at desc);

create table if not exists public.voice_call_events (
  id bigint generated always as identity primary key,
  call_id uuid not null references public.voice_calls (id) on delete cascade,
  tenant_id uuid not null references public.voice_tenants (id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null check (kind in ('caller', 'agent', 'tool_call', 'tool_result', 'action', 'guardrail', 'system', 'error')),
  data jsonb not null default '{}'::jsonb
);
create index if not exists voice_call_events_call_idx on public.voice_call_events (call_id, id);

create table if not exists public.voice_bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.voice_tenants (id) on delete cascade,
  reference text not null,
  service_key text not null,
  resource_key text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  buffer_minutes integer not null default 0,
  party_size integer not null check (party_size between 1 and 100),
  customer_id uuid references public.voice_customers (id) on delete set null,
  name text not null,
  phone text,
  notes text,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  source text not null default 'phone' check (source in ('phone', 'browser', 'eval', 'console', 'seed')),
  deposit_pence integer not null default 0,
  deposit_paid boolean not null default false,
  call_id uuid references public.voice_calls (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, reference)
);
create index if not exists voice_bookings_tenant_starts_idx on public.voice_bookings (tenant_id, starts_at);

create table if not exists public.voice_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.voice_tenants (id) on delete cascade,
  reference text not null,
  customer_id uuid references public.voice_customers (id) on delete set null,
  name text not null,
  phone text,
  fulfilment text not null check (fulfilment in ('collection', 'delivery')),
  due_at timestamptz not null,
  address text,
  postcode text,
  lines jsonb not null,
  subtotal_pence integer not null,
  delivery_fee_pence integer not null default 0,
  total_pence integer not null,
  allergy_notes text,
  status text not null default 'confirmed' check (status in ('confirmed', 'in_kitchen', 'ready', 'completed', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  source text not null default 'phone' check (source in ('phone', 'browser', 'eval', 'console', 'seed')),
  call_id uuid references public.voice_calls (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, reference)
);
create index if not exists voice_orders_tenant_created_idx on public.voice_orders (tenant_id, created_at desc);

-- Demo payments only. No full card number is ever stored.
create table if not exists public.voice_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.voice_tenants (id) on delete cascade,
  order_id uuid references public.voice_orders (id) on delete cascade,
  booking_id uuid references public.voice_bookings (id) on delete cascade,
  amount_pence integer not null check (amount_pence >= 0),
  card_last4 text check (card_last4 ~ '^[0-9]{4}$'),
  auth_code text,
  result text not null check (result in ('approved', 'declined')),
  call_id uuid references public.voice_calls (id) on delete set null,
  created_at timestamptz not null default now(),
  check (order_id is not null or booking_id is not null)
);

create table if not exists public.voice_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.voice_tenants (id) on delete cascade,
  call_id uuid references public.voice_calls (id) on delete set null,
  kind text not null check (kind in ('sms', 'message')),
  to_number text,
  from_name text,
  from_phone text,
  body text not null,
  status text not null check (status in ('sent', 'simulated', 'failed', 'new', 'read')),
  created_at timestamptz not null default now()
);
create index if not exists voice_messages_tenant_created_idx on public.voice_messages (tenant_id, created_at desc);

alter table public.voice_schema_migrations enable row level security;
alter table public.voice_tenants enable row level security;
alter table public.voice_staff enable row level security;
alter table public.voice_phone_numbers enable row level security;
alter table public.voice_customers enable row level security;
alter table public.voice_calls enable row level security;
alter table public.voice_call_events enable row level security;
alter table public.voice_bookings enable row level security;
alter table public.voice_orders enable row level security;
alter table public.voice_payments enable row level security;
alter table public.voice_messages enable row level security;

insert into public.voice_schema_migrations (name) values ('voice_0001_core') on conflict do nothing;
