-- ============================================================
-- A SLOW SWEEP GETS A WHOLE TICK
--
-- A tick is two minutes, and the research loop takes businesses one
-- after another inside it. A business whose sweep is slow - on 25
-- September, Portman Air Conditioning, with fourteen live sites to read -
-- could be started with forty seconds left, run out of time, and have it
-- counted as a failed turn; three of those and it was written off as
-- "failed three times" without ever having had a full tick.
--
-- Now a business that runs out of time after others in the same tick is
-- handed back uncounted and marked, and the next tick starts with it. Only
-- running out of a whole tick counts.
-- ============================================================

create or replace function public.prospect_lookup_defer(p_id uuid)
returns void language sql security definer
set search_path = public, pg_catalog as $fn$
  update public.prospect_candidate
     set lookup_claimed_at = null, lookup_attempts = greatest(lookup_attempts - 1, 0),
         error = 'out of time: the next tick starts with it', updated_at = now()
   where id = p_id and status = 'researching'
$fn$;
revoke all on function public.prospect_lookup_defer(uuid) from anon, authenticated, public;

create or replace function public.prospect_lookup_next()
returns setof jsonb language plpgsql security definer
set search_path = public, pg_catalog as $fn$
declare
  v_ttl interval := make_interval(secs => coalesce(
    (select (value)::text::integer from public.prospect_setting where key = 'claim_ttl_seconds'), 600));
begin
  return query
  with claimed as (
    update public.prospect_candidate c
       set lookup_claimed_at = now(), lookup_attempts = c.lookup_attempts + 1, updated_at = now(),
           error = case when c.error = 'out of time: the next tick starts with it' then null else c.error end
     where c.id in (
       select x.id from public.prospect_candidate x
        where x.status = 'researching'
          and x.lookup_attempts < 3
          and (x.lookup_claimed_at is null or x.lookup_claimed_at < now() - v_ttl)
        order by (x.error = 'out of time: the next tick starts with it') desc nulls last,
                 x.lookup_attempts, x.finished_at nulls first, x.id
        limit 1
        for update skip locked)
    returning c.*)
  select to_jsonb(c) || jsonb_build_object(
           'next_seq', coalesce((select max(r.seq) from public.prospect_round r where r.candidate_id = c.id), 0))
    from claimed c;
end
$fn$;
revoke all on function public.prospect_lookup_next() from anon, authenticated, public;
