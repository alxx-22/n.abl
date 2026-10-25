-- A takeaway delivery for someone else (presets/takeaway-use-cases.md,
-- "Ordering for someone at another address"): their name and number for
-- the driver, apart from the caller's, who placed and may pay for it.
--
-- Shared project: every object here is voice_ prefixed (test/db.test.ts
-- enforces it). Additive, and every statement can run again without harm.

alter table public.voice_orders add column if not exists recipient jsonb;
