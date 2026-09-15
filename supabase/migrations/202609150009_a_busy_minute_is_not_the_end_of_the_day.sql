-- ============================================================
-- A BUSY MINUTE IS NOT THE END OF THE DAY
--
-- STATUS: applied to the live project on 15 September 2026.
--
-- Gemini answers 429 for two entirely different things: you have used
-- this minute's requests, and you have used today's. The pipeline read
-- every one of them as the second and wrote the model off until
-- midnight.
--
-- That cost nothing while three leads went out every ten minutes,
-- because the per-minute limit was never in reach. Speeding the
-- schedule up to re-run the list found it immediately: one busy minute
-- recorded gemini-3.5-flash-lite as exhausted at 322 calls against a
-- published ceiling of 1000, the fallbacks took the load and 503'd, and
-- the run stalled with most of the day's budget unspent.
--
-- So the caller now says which kind it was - it reads Google's own
-- QuotaFailure details rather than guessing - and only a daily one
-- closes the model. A per-minute 429 is recorded, because knowing how
-- often the pacing is wrong is worth having, and then the chain simply
-- moves on.
--
-- observed_rpd is the number this is really about: it is what the API
-- taught us, and it beats the published figure permanently for the
-- rest of the day. Teaching it a per-minute number was the whole
-- damage.
-- ============================================================

alter table public.outreach_model_usage
  add column if not exists minute_limited integer not null default 0;

comment on column public.outreach_model_usage.minute_limited is
  'How many times today this model said "too many requests this minute". Not a ceiling - a sign the gap between calls is too short for the rate we are asking of it.';

create or replace function public.outreach_record_call(
  p_model text,
  p_rate_limited boolean default false,
  p_minute_limited boolean default false)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
begin
  insert into public.outreach_model_usage as u
    (usage_day, model, used, first_call_at, last_call_at)
  values (public.outreach_quota_day(), p_model, 1, now(), now())
  on conflict (usage_day, model) do update
    set used = u.used + 1,
        last_call_at = now();

  if p_minute_limited then
    update public.outreach_model_usage
       set minute_limited = minute_limited + 1
     where usage_day = public.outreach_quota_day() and model = p_model;
  end if;

  -- Only a DAILY refusal closes the model. The API is still the
  -- authority on the ceiling - but only when it is talking about the
  -- ceiling.
  if p_rate_limited then
    update public.outreach_model_usage
       set exhausted = true,
           observed_rpd = used
     where usage_day = public.outreach_quota_day() and model = p_model;
  end if;
end
$function$;

revoke all on function public.outreach_record_call(text, boolean, boolean)
  from anon, authenticated, public;

-- Today's ceilings were learned from per-minute refusals and are wrong.
-- Clearing an observed_rpd is not something to do casually - it is the
-- one number the API taught us - but a number taught by the wrong
-- question is worse than no number.
update public.outreach_model_usage
   set exhausted = false, observed_rpd = null
 where usage_day = public.outreach_quota_day()
   and exhausted
   and observed_rpd < (select max(m.rpd) from public.outreach_model m
                        where m.model = public.outreach_model_usage.model);
