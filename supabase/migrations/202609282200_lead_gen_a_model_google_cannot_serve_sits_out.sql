-- ============================================================
-- LEAD GEN: A MODEL GOOGLE CANNOT SERVE SITS OUT TEN MINUTES
--
-- On the evening of 28 September a sales pick walked all six Flash
-- models. None was out of quota: each answered 503 "high demand" or
-- nothing at all, and the pick fell to 3.5 Flash Lite 40 seconds later.
-- The next business then walked the same six and waited the same 40 s.
-- Each 503 was also counted as one of that model's 20 a day, though
-- nothing was served.
--
-- Now a model that answers 5xx, or stays silent for the whole wait,
-- rests: the prospector skips it until resting_until, and the call is
-- not counted. If Google does count a failed call, the day's 429 still
-- stops the model, as it always has.
--
-- The rest is per model and per project, like the budget. Only the lead
-- prospector sets it; the outreach writer keeps outreach_model_budget,
-- which does not look at it.
-- ============================================================

alter table public.outreach_model_usage
  add column if not exists resting_until timestamptz;

comment on column public.outreach_model_usage.resting_until is
  'Skipped by the lead prospector until then: Google answered 5xx or nothing. Set by outreach_model_rest.';

create or replace function public.outreach_model_rest(
  p_model text, p_key_secret text, p_seconds integer default 600)
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$
  -- A rest is not a use: the row is made with used 0 if there is none.
  insert into public.outreach_model_usage as u (usage_day, model, key_secret, used, resting_until)
  values (public.outreach_quota_day(), p_model, p_key_secret, 0,
          now() + make_interval(secs => least(greatest(coalesce(p_seconds, 600), 30), 3600)))
  on conflict (usage_day, model, key_secret) do update
    set resting_until = excluded.resting_until
$$;

create or replace function public.prospect_model_budget(p_model text, p_key_secret text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  -- The day's budget, as outreach_model_budget gives it, and when the
  -- model may be tried again if it is resting. One call, as before.
  select jsonb_build_object(
    'left', public.outreach_model_budget(p_model, p_key_secret),
    'resting_until', (
      select u.resting_until from public.outreach_model_usage u
       where u.usage_day = public.outreach_quota_day()
         and u.model = p_model and u.key_secret = p_key_secret
         and u.resting_until > now()))
$$;

revoke all on function public.outreach_model_rest(text, text, integer) from anon, authenticated, public;
revoke all on function public.prospect_model_budget(text, text) from anon, authenticated, public;
