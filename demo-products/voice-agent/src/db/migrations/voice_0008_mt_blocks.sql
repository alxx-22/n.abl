-- Property maintenance, milestone 3: blocks of flats with their common
-- parts, business sites, and insurance claims
-- (demo-products/presets/property-maintenance.md §12, M3).
--
-- Shared project: every object here is voice_ prefixed (test/db.test.ts
-- enforces it). Additive, and every statement can run again without harm.
-- No other kind of business writes these tables.

-- A flat says which block it is in, and a block's common parts (the
-- entrance, stairs, lift, roof) are a property of their own, so a
-- communal fault has one job however many residents ring. A business
-- site carries its trading name.
alter table public.voice_mt_properties add column if not exists block text;
alter table public.voice_mt_properties add column if not exists site_name text;
alter table public.voice_mt_properties drop constraint if exists voice_mt_properties_kind_check;
alter table public.voice_mt_properties add constraint voice_mt_properties_kind_check
  check (kind in ('house', 'flat', 'bungalow', 'commercial', 'communal'));

-- An insurer's claim number on the job, and everyone who reported it (a
-- communal fault rung in by several residents is still one job).
alter table public.voice_mt_jobs add column if not exists claim_ref text;
alter table public.voice_mt_jobs add column if not exists reporters jsonb not null default '[]'::jsonb;
