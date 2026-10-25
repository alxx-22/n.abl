-- Orders for a takeaway, and one demo line PIN per workspace
-- (demo-products/PRESETS.md §2.4).
--
-- Shared project: every object here is voice_ prefixed (test/db.test.ts
-- enforces it). Every statement can run again without harm.

-- ── Orders: out with a driver, and the kitchen's own time ───────────────────
-- A delivery leaves the kitchen before it is due at the door, so the kitchen
-- counts its slots by ready_at: the due time for a collection, the due time
-- less the delivery minutes for a delivery. Out for delivery comes between
-- ready and completed; out_at and driver say since when and with whom, and
-- pay_note what the driver needs to know ("change from £20").
alter table public.voice_orders drop constraint if exists voice_orders_status_check;
alter table public.voice_orders add constraint voice_orders_status_check
  check (status in ('confirmed', 'in_kitchen', 'ready', 'out_for_delivery', 'completed', 'cancelled'));
alter table public.voice_orders add column if not exists ready_at timestamptz;
alter table public.voice_orders add column if not exists out_at timestamptz;
alter table public.voice_orders add column if not exists driver text;
alter table public.voice_orders add column if not exists pay_note text;
create index if not exists voice_orders_tenant_ready_idx on public.voice_orders (tenant_id, ready_at);

-- ── One workspace per PIN ───────────────────────────────────────────────────
-- Callers to the shared demo line key a four-digit PIN to reach a business,
-- so two businesses must never share one. Start draws again until the PIN is
-- free; this makes sure, even when two people press Start at once.
create unique index if not exists voice_tenants_demo_pin_idx
  on public.voice_tenants ((profile->>'demo_pin')) where profile ? 'demo_pin';
