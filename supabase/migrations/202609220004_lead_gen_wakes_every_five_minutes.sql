-- ---------- the recurrence ----------
--
-- The same shape as the outreach job: every five minutes, a POST carrying
-- the vault secret, verified by outreach_verify_cron_secret. The function
-- returns at once when no target is running, so this costs nothing until
-- somebody presses Run.

select cron.unschedule(jobid) from cron.job where jobname in ('lead-prospector', 'prospect-prune');

select cron.schedule('lead-prospector', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://rrkcoqopcqtowbyismcq.supabase.co/functions/v1/lead-prospector',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-outreach-secret', public.outreach_cron_secret()),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
$cron$);

select cron.schedule('prospect-prune', '43 4 * * *', $cron$ select public.prospect_prune() $cron$);
