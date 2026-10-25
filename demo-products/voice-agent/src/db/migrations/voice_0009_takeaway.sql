-- Takeaway, milestone 2: after the order
-- (demo-products/presets/takeaway.md §5.2).
--
-- Shared project: every object here is voice_ prefixed (test/db.test.ts
-- enforces it). Additive, and every statement can run again without harm.
-- Only the takeaway writes these columns; every other order keeps their
-- defaults.

-- A caller's requests on an order, for staff to accept or refuse: cancel it,
-- or change it. Each is { kind, what, phone, at, answer, answered_at }, and
-- nothing is cancelled or changed until staff accept.
alter table public.voice_orders add column if not exists requests jsonb not null default '[]'::jsonb;

-- Marks on the kitchen's ticket: 'allergy' (one added after the order was
-- placed), 'big'.
alter table public.voice_orders add column if not exists flags text[] not null default '{}';

-- An addition riding with an earlier order: that order's number.
alter table public.voice_orders add column if not exists linked_to text;
