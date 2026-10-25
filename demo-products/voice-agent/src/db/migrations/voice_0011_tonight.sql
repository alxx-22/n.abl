-- A takeaway's "Menu tonight" (presets/takeaway.md §6): what is sold out
-- tonight, and one notice for callers (delivery paused, or long waits), set
-- from the back office and read by the receptionist on every order tool, so
-- a switch takes effect on a call at once. It carries the date it is for;
-- another day's is ignored, so it starts each day empty.
--
-- Shared project: every object here is voice_ prefixed (test/db.test.ts
-- enforces it). Additive, and every statement can run again without harm.

alter table public.voice_tenants add column if not exists tonight jsonb not null default '{}'::jsonb;
