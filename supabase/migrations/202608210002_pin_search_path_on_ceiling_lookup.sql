-- Pin the search_path on marketing_monthly_ceiling.
--
-- Supabase's security linter flagged it immediately after 202608210001 went
-- live, and it was right: the other three functions in that migration all set
-- `search_path = public, pg_catalog` and this one did not. The practical risk
-- is close to nil — it is IMMUTABLE and its whole body is a CASE over a text
-- literal, calling nothing that could be shadowed — but that is an argument
-- about this function today, not about the next person who copies it as a
-- template. An inconsistency inside a security migration is worth more than
-- the two lines it costs to remove.
--
-- Kept as its own file rather than edited into 202608210001, because that one
-- has already run against the live project and a migration that has run is a
-- record of what happened.

create or replace function public.marketing_monthly_ceiling(p_tier text)
returns integer
language sql
immutable
set search_path = pg_catalog
as $$
  select case p_tier
    when 'A' then 2000   -- LIA-2026-08-v2 s.6. Not a data protection limit:
                         -- UK GDPR is not engaged. Set by reg 23, honesty and
                         -- the cost of a systematic misclassification.
    when 'B' then 400    -- LIA-2026-08-v2 s.6, doubled from v1's 200 on the
                         -- strength of the sourcing, not on a softer balance.
    else 0               -- Tier C, and anything unrecognised.
  end;
$$;

revoke all on function public.marketing_monthly_ceiling(text) from public, anon, authenticated;
grant execute on function public.marketing_monthly_ceiling(text) to authenticated;
