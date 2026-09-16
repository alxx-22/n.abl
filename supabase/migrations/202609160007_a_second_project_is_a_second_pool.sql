-- A second project is a second pool.
--
-- Gemini's free-tier quota is per project, and per model within it. Two
-- projects means two daily pools of the same model - which is the whole
-- point of the second key, and which this schema could not see, because
-- outreach_model_usage was keyed (usage_day, model). Running
-- gemini-3.5-flash on the discovery key would have spent the writer's
-- recorded budget and stopped the writer at noon while the discovery
-- pool sat untouched.
--
-- So usage is keyed by the key as well, and the key is a property of the
-- model row rather than a branch in code: adding a third project is a row
-- and a secret, not a deploy.
--
-- The check constraint is the guard. A registry row names an environment
-- variable, and a row that could name any environment variable could name
-- SUPABASE_SERVICE_ROLE_KEY. It can only ever name a GEMINI_ one.

alter table public.outreach_model
  add column if not exists key_secret text not null default 'GEMINI_API_KEY';

alter table public.outreach_model
  drop constraint if exists outreach_model_key_secret_is_a_gemini_key;
alter table public.outreach_model
  add constraint outreach_model_key_secret_is_a_gemini_key
  check (key_secret ~ '^GEMINI_[A-Z0-9_]*$');

alter table public.outreach_model_usage
  add column if not exists key_secret text not null default 'GEMINI_API_KEY';

alter table public.outreach_model_usage drop constraint if exists outreach_model_usage_pkey;
alter table public.outreach_model_usage
  add constraint outreach_model_usage_pkey primary key (usage_day, model, key_secret);

-- The two-argument overload has been dead since the minute/day split.
drop function if exists public.outreach_record_call(text, boolean);
drop function if exists public.outreach_record_call(text, boolean, boolean);
drop function if exists public.outreach_model_budget(text);

create function public.outreach_model_budget(
  p_model text,
  p_key_secret text default 'GEMINI_API_KEY')
returns integer language sql stable security definer
set search_path = public, pg_catalog as $fn$
  -- The published figure is the starting point. An observed ceiling
  -- always beats it. A model with no registry row gets no budget rather
  -- than an assumed one.
  with spec as (
    select max(rpd) as rpd from public.outreach_model
     where model = p_model and key_secret = p_key_secret and active
  )
  select greatest(coalesce(
    (select case when u.exhausted then 0
                 else coalesce(u.observed_rpd, (select rpd from spec)) - u.used end
       from public.outreach_model_usage u
      where u.usage_day = public.outreach_quota_day()
        and u.model = p_model and u.key_secret = p_key_secret),
    (select rpd from spec), 0), 0)
$fn$;

create function public.outreach_record_call(
  p_model text,
  p_rate_limited boolean default false,
  p_minute_limited boolean default false,
  p_key_secret text default 'GEMINI_API_KEY')
returns void language plpgsql security definer
set search_path = public, pg_catalog as $fn$
begin
  insert into public.outreach_model_usage as u
    (usage_day, model, key_secret, used, first_call_at, last_call_at)
  values (public.outreach_quota_day(), p_model, p_key_secret, 1, now(), now())
  on conflict (usage_day, model, key_secret) do update
    set used = u.used + 1,
        last_call_at = now();

  if p_minute_limited then
    update public.outreach_model_usage
       set minute_limited = minute_limited + 1
     where usage_day = public.outreach_quota_day()
       and model = p_model and key_secret = p_key_secret;
  end if;

  if p_rate_limited then
    -- The API is the authority. Record what we actually reached as the
    -- ceiling and stop using this model on this key until tomorrow.
    update public.outreach_model_usage
       set exhausted = true,
           observed_rpd = used
     where usage_day = public.outreach_quota_day()
       and model = p_model and key_secret = p_key_secret;
  end if;
end
$fn$;

revoke all on function public.outreach_model_budget(text, text) from anon, authenticated, public;
revoke all on function public.outreach_record_call(text, boolean, boolean, text)
  from anon, authenticated, public;
