-- Property maintenance, milestone 2: the quotes a contractor sends and the
-- invoices it raises (demo-products/presets/property-maintenance.md §5.2).
--
-- Shared project: every object here is voice_ prefixed (test/db.test.ts
-- enforces it). Additive only, and every statement can run again without
-- harm. No other kind of business writes these tables.

-- ── Quotes ──────────────────────────────────────────────────────────────────
-- Work over a client's limit, or too big to price unseen, is quoted. A quote
-- waits for the authoriser's yes or no, given on their own phone, never by
-- voice; decided_by says who pressed it.
create table if not exists public.voice_mt_quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.voice_tenants (id) on delete cascade,
  reference text not null,
  job_ref text,
  property_key text,
  client_key text,
  description text not null,
  amount_pence integer not null check (amount_pence >= 0),
  status text not null default 'sent' check (status in ('sent', 'approved', 'declined', 'expired')),
  issued date not null,
  valid_until date,
  decided_at timestamptz,
  decided_by text,
  created_at timestamptz not null default now(),
  unique (tenant_id, reference)
);

-- ── Invoices ────────────────────────────────────────────────────────────────
-- A finished job's bill, or a homeowner's call-out paid when booking. Paid by
-- a demo card only: the last four digits and the demo authorisation code are
-- kept, never a card number. Overdue is worked out from the due date.
create table if not exists public.voice_mt_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.voice_tenants (id) on delete cascade,
  reference text not null,
  job_ref text,
  property_key text,
  client_key text,
  payer_name text,
  payer_phone text,
  kind text not null default 'job' check (kind in ('job', 'callout')),
  description text not null default '',
  amount_pence integer not null check (amount_pence >= 0),
  status text not null default 'due' check (status in ('due', 'paid', 'void')),
  issued date not null,
  due date not null,
  paid_at timestamptz,
  paid_how text check (paid_how is null or paid_how in ('card', 'bank')),
  card_last4 text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  auth_code text,
  call_id uuid references public.voice_calls (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, reference)
);
create index if not exists voice_mt_invoices_phone_idx on public.voice_mt_invoices (tenant_id, payer_phone);

alter table public.voice_mt_quotes enable row level security;
alter table public.voice_mt_invoices enable row level security;
