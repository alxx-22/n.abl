-- The estate agent: homes for sale, offers on them and sales in progress,
-- plus what viewings, buyers and messages need to carry
-- (demo-products/presets/estate-agent.md §5.2).
--
-- Shared project: every object here is voice_ prefixed (test/db.test.ts
-- enforces it). Additive only, and every statement can run again without
-- harm. No other kind of business writes these tables or columns, so the
-- restaurant's rows are as they were.

-- ── Homes for sale, as they are during the demo ─────────────────────────────
-- The facts about a home are the owner's setup, in the profile. What staff
-- change while the demo runs (accepting an offer makes a home sale agreed, a
-- price comes down, dates are blocked) lives here, so Reset can put it back.
-- sellers is never returned to a caller; it is what a seller is checked
-- against.
create table if not exists public.voice_listings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.voice_tenants (id) on delete cascade,
  listing_key text not null,
  status text not null check (status in ('coming_soon', 'available', 'under_offer', 'sale_agreed', 'exchanged', 'completed', 'withdrawn')),
  price_pence integer not null check (price_pence >= 0),
  qualifier text not null check (qualifier in ('guide', 'offers_over', 'oiro', 'fixed', 'share')),
  marketing_continues boolean not null default true,
  best_final_at timestamptz,
  checking text[] not null default '{}',
  blocked jsonb not null default '[]'::jsonb,
  sellers jsonb not null default '[]'::jsonb,
  marketed_at timestamptz not null,
  back_on_market_at timestamptz,
  set_from jsonb not null default '{}'::jsonb,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (tenant_id, listing_key)
);

-- ── Offers: the record the law asks for ─────────────────────────────────────
-- Every offer is passed on, in writing, until exchange, so each one is a row
-- with when it came in, when it went to the seller and what was decided.
create table if not exists public.voice_offers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.voice_tenants (id) on delete cascade,
  reference text not null,
  listing_key text not null,
  revises text,
  amount_pence integer not null check (amount_pence > 0),
  buyer_names text[] not null default '{}',
  phone text,
  email text,
  position jsonb not null default '{}'::jsonb,
  conditions text,
  solicitor text,
  flags text[] not null default '{}',
  status text not null default 'received' check (status in ('received', 'sent', 'accepted', 'declined', 'countered', 'withdrawn')),
  received_at timestamptz not null default now(),
  sent_at timestamptz,
  decided_at timestamptz,
  note text,
  source text not null default 'phone' check (source in ('phone', 'browser', 'eval', 'console', 'seed')),
  call_id uuid references public.voice_calls (id) on delete set null,
  history jsonb not null default '[]'::jsonb,
  unique (tenant_id, reference)
);
create index if not exists voice_offers_tenant_listing_idx on public.voice_offers (tenant_id, listing_key);

-- ── Sales in progress ───────────────────────────────────────────────────────
-- From an accepted offer to the keys: milestones staff tick, the people on
-- the file, the chain.
create table if not exists public.voice_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.voice_tenants (id) on delete cascade,
  listing_key text not null,
  offer_ref text,
  buyer_name text not null,
  buyer_phone text,
  agreed_pence integer not null check (agreed_pence > 0),
  milestones jsonb not null default '[]'::jsonb,
  exchange_target date,
  completion_date date,
  parties jsonb not null default '[]'::jsonb,
  chain text,
  status text not null default 'progressing' check (status in ('progressing', 'exchanged', 'completed', 'fell_through')),
  keys_released_at timestamptz,
  updates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists voice_sales_tenant_idx on public.voice_sales (tenant_id, listing_key);

-- ── What viewings, buyers and messages carry ────────────────────────────────
-- A viewing is a booking at a home: listing_key says which, so two viewings
-- of one home never overlap. details holds the buyer's position, feedback
-- and a valuation's lead; a buyer's details their requirements and consent.
alter table public.voice_bookings add column if not exists listing_key text;
alter table public.voice_bookings add column if not exists details jsonb not null default '{}'::jsonb;
create index if not exists voice_bookings_tenant_listing_idx on public.voice_bookings (tenant_id, listing_key) where listing_key is not null;
alter table public.voice_customers add column if not exists details jsonb not null default '{}'::jsonb;
-- A message is for someone, about something, and some cannot wait.
alter table public.voice_messages add column if not exists for_staff text;
alter table public.voice_messages add column if not exists category text;
alter table public.voice_messages add column if not exists urgency text;
alter table public.voice_messages add column if not exists reference text;
alter table public.voice_messages add column if not exists details jsonb not null default '{}'::jsonb;
alter table public.voice_messages drop constraint if exists voice_messages_urgency_check;
alter table public.voice_messages add constraint voice_messages_urgency_check
  check (urgency is null or urgency in ('urgent', 'today', 'this_week'));

alter table public.voice_listings enable row level security;
alter table public.voice_offers enable row level security;
alter table public.voice_sales enable row level security;
