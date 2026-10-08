-- A demo workspace's own clock (presets/property-maintenance-use-cases.md:
-- "a per-workspace simulated clock"), so a prospect can try a Friday night
-- or a Sunday at 2am whatever the time really is. The workspace runs this
-- many milliseconds ahead of real time (behind, if negative); 0 is real time.
--
-- Shared project: every object here is voice_ prefixed (test/db.test.ts
-- enforces it). Additive, and every statement can run again without harm.

alter table public.voice_tenants add column if not exists clock_offset_ms bigint not null default 0;
