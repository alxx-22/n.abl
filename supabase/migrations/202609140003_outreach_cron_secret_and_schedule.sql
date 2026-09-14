-- ============================================================
-- AUTHENTICATING THE CRON JOB, AND THE SCHEDULE ITSELF
--
-- STATUS: applied to the live project on 14 September 2026.
-- ============================================================

-- ---------- how the open endpoint knows it is us ----------
--
-- outreach-writer runs with verify_jwt off, because pg_cron has no user
-- token to present. That leaves the URL open to the internet, so the
-- function has to check something itself.
--
-- The obvious answer is a Supabase secret compared against a header.
-- That works and it also means a person typing a second secret into a
-- dashboard for no reason. This secret is machine to machine: generated
-- in the database with gen_random_bytes, held in Vault, never read by
-- anyone. Keeping it here means the only thing a human ever has to set
-- is the API key.
--
-- The secret itself is created once, out of band:
--
--   select vault.create_secret(
--     encode(gen_random_bytes(32), 'hex'),
--     'outreach_cron_secret',
--     'Shared between the pg_cron job and the outreach-writer edge function.');
--
-- Rotate with vault.update_secret. Nothing else reads it, so rotation
-- needs no coordination.
--
-- NOTE on search_path: digest() is pgcrypto, and Supabase installs
-- pgcrypto into `extensions` rather than public. The first version of
-- this pinned 'vault', 'pg_catalog', 'public' and failed at runtime with
-- "function digest(text, unknown) does not exist" - which is why it was
-- tested against the live project rather than assumed to work.

create or replace function public.outreach_verify_cron_secret(p_secret text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'vault', 'extensions', 'pg_catalog', 'public'
as $function$
declare
  v_expected text;
begin
  select decrypted_secret into v_expected
  from vault.decrypted_secrets
  where name = 'outreach_cron_secret'
  limit 1;

  if v_expected is null or p_secret is null then
    return false;
  end if;

  -- Compare digests rather than the values: equal length, no early
  -- exit, nothing to time. Overkill for an endpoint that only spends a
  -- free allowance, and it costs one line.
  return extensions.digest(v_expected, 'sha256') = extensions.digest(p_secret, 'sha256');
end
$function$;

comment on function public.outreach_verify_cron_secret(text) is
  'True when the caller presented the shared secret held in Vault. Service role only -- anon holding this would be a free oracle for guessing it.';

create or replace function public.outreach_cron_secret()
returns text
language sql
stable
security definer
set search_path to 'vault', 'pg_catalog', 'public'
as $function$
  select decrypted_secret from vault.decrypted_secrets
  where name = 'outreach_cron_secret' limit 1
$function$;

revoke all on function public.outreach_verify_cron_secret(text) from public, anon, authenticated;
grant execute on function public.outreach_verify_cron_secret(text) to service_role;
revoke all on function public.outreach_cron_secret() from public, anon, authenticated;
grant execute on function public.outreach_cron_secret() to service_role;

-- ---------- the schedule ----------
--
-- Every ten minutes, three leads. 149 leads therefore take about eight
-- hours, which is one night with the laptop shut - the entire reason
-- this moved off a laptop.
--
-- Three per tick rather than the lot, for three reasons that agree: an
-- edge function has a wall clock and 149 leads paced against somebody
-- else's rate limit would blow it; a free-tier allowance is spent more
-- safely in bites; and a tick that fails costs three leads rather than
-- a batch.
--
-- Once the queue is drained the job keeps firing and does nothing -
-- outreach_next_batch returns no rows, the function makes no model
-- calls and returns in milliseconds. Cheaper than teaching it to stop
-- and remembering to start it again.

select cron.unschedule('outreach-writer')
where exists (select 1 from cron.job where jobname = 'outreach-writer');

select cron.schedule(
  'outreach-writer',
  '*/10 * * * *',
  $job$
  select net.http_post(
    url := 'https://rrkcoqopcqtowbyismcq.supabase.co/functions/v1/outreach-writer',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-outreach-secret', public.outreach_cron_secret()),
    body := jsonb_build_object('limit', 3),
    timeout_milliseconds := 60000
  );
  $job$
);

-- A page left behind by a tick that died between fetching and writing
-- is somebody else's website content held for no reason. Swept daily
-- regardless of what the writer did.
select cron.unschedule('outreach-sweep-pages')
where exists (select 1 from cron.job where jobname = 'outreach-sweep-pages');

select cron.schedule(
  'outreach-sweep-pages',
  '17 4 * * *',
  $job$ select public.outreach_sweep_page_cache(); $job$
);
