-- A barber's shop floor (presets/barber.md §5.2, M2): who is off today and
-- the shop's notice for callers, the walk-in queue, the waiting list for a
-- cancellation, and when a customer last had a skin test before colour.
-- The hair salon uses the same (presets/salon.md).
--
-- Shared project: every object here is voice_ prefixed (test/db.test.ts
-- enforces it). Additive, and every statement can run again without harm.

-- Today, set from the back office and read on every call: { date, off:
-- [resource keys], notice }. Another day's reads as everyone in.
alter table public.voice_tenants add column if not exists today jsonb not null default '{}'::jsonb;

-- Walk-ins waiting in the shop, first in first. Served: a booking in the
-- chair from then. A phone call never joins it: only a booking holds a chair.
create table if not exists public.voice_walkins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.voice_tenants (id) on delete cascade,
  name text not null,
  phone text,
  service_key text not null,
  resource_key text,
  joined_at timestamptz not null default now(),
  served_at timestamptz,
  booking_id uuid references public.voice_bookings (id) on delete set null,
  left_at timestamptz,
  source text not null default 'console' check (source in ('phone', 'browser', 'eval', 'console', 'seed'))
);
create index if not exists voice_walkins_tenant_joined_idx on public.voice_walkins (tenant_id, joined_at);

-- A day's waiting list for a cancellation: the first that fits is texted
-- when a booking that day is cancelled.
create table if not exists public.voice_waitlist (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.voice_tenants (id) on delete cascade,
  date date not null,
  service_key text not null,
  resource_key text,
  name text not null,
  phone text,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  removed_at timestamptz,
  source text not null default 'phone' check (source in ('phone', 'browser', 'eval', 'console', 'seed')),
  call_id uuid references public.voice_calls (id) on delete set null
);
create index if not exists voice_waitlist_tenant_date_idx on public.voice_waitlist (tenant_id, date);

-- The last skin test, for colour 48 hours or more after it. One taken
-- elsewhere doesn't count.
alter table public.voice_customers add column if not exists skin_test_at timestamptz;

alter table public.voice_walkins enable row level security;
alter table public.voice_waitlist enable row level security;
