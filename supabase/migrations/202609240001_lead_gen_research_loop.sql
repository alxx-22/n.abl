-- ============================================================
-- LEAD GEN: THE RESEARCH LOOP
--
-- 118 of the first 194 Notts businesses were parked because no guessed
-- domain turned out to be theirs. Many have a site: under a previous
-- name, a sister company's, or one that turns automated readers away.
--
-- A business with no site found is now 'researching' instead of
-- 'no_site': cached in a queue that a second loop works through on its
-- own Gemini project, GEMINI_RESEARCH_API_KEY, on its own cron. Until
-- that key is set the queue simply waits. The loop (lookup.mjs) is an
-- investigator with tools - the register's history, domain guesses from
-- names it chooses, the live site, the Internet Archive's copy - and a
-- checker who has to agree when a page names the business but code
-- cannot prove it. What it finds goes back to research as a known site;
-- what it cannot find ends as no_site with the reason.
--
-- It does not search the web. Grounding with Google Search may not be
-- used to collect links or stored results (Gemini API terms, read 24
-- September 2026), and crt.sh disallows automated readers. See the head
-- of lookup.mjs.
--
-- Also here: a business a person sends back (retry, add a website) or the
-- loop sends back is worked even when its own target is not the one
-- running, so a stopped target's leads are not stranded.
-- ============================================================

alter table public.prospect_candidate drop constraint if exists prospect_candidate_status_check;
alter table public.prospect_candidate add constraint prospect_candidate_status_check
  check (status in ('queued', 'working', 'scored', 'no_fit', 'disputed',
                    'failed', 'promoted', 'dismissed', 'no_site', 'refused', 'researching'));

alter table public.prospect_candidate add column if not exists lookup_attempts integer not null default 0;
alter table public.prospect_candidate add column if not exists lookup_claimed_at timestamptz;
alter table public.prospect_candidate add column if not exists requeued boolean not null default false;
comment on column public.prospect_candidate.requeued is
  'Sent back by a person or by the research loop: worked even when its target is not the one running.';
create index if not exists prospect_candidate_lookup
  on public.prospect_candidate (status, lookup_claimed_at) where status = 'researching';

-- ---------- finishing: the research queue is an end, for this loop ----------

create or replace function public.prospect_finish(
  p_id uuid, p_status text, p_lead_score integer, p_services jsonb,
  p_state jsonb default null, p_note text default null)
returns void language sql security definer
set search_path = public, pg_catalog as $fn$
  update public.prospect_candidate
     set stage = 'done', status = p_status,
         lead_score = case when p_lead_score is null then null else least(greatest(p_lead_score, 0), 100) end,
         services = p_services, state = coalesce(p_state, state),
         note = left(nullif(btrim(coalesce(p_note, '')), ''), 1000),
         error = null, claimed_at = null, requeued = false, finished_at = now(), updated_at = now()
   where id = p_id and p_status in ('scored', 'no_fit', 'disputed', 'no_site', 'refused', 'researching')
$fn$;
revoke all on function public.prospect_finish(uuid, text, integer, jsonb, jsonb, text) from anon, authenticated, public;

-- ---------- claiming: the running target, and anything sent back ----------

create or replace function public.prospect_next_batch(p_limit integer default 1)
returns setof jsonb language plpgsql security definer
set search_path = public, pg_catalog as $fn$
declare
  v_ttl interval := make_interval(secs => coalesce(
    (select (value)::text::integer from public.prospect_setting where key = 'claim_ttl_seconds'), 600));
  v_max integer := coalesce((select (value)::text::integer from public.prospect_setting where key = 'max_attempts'), 3);
  v_target uuid := (select id from public.prospect_target where running and active limit 1);
begin
  return query
  with claimed as (
    update public.prospect_candidate c
       set claimed_at = now(), status = 'working', updated_at = now()
     where c.id in (
       select x.id from public.prospect_candidate x
        where (x.target_id = v_target or x.requeued)
          and x.status in ('queued', 'working')
          and x.stage <> 'done'
          and x.attempts < v_max
          and (x.claimed_at is null or x.claimed_at < now() - v_ttl)
        order by x.requeued desc, (x.status = 'working') desc, x.pulled_at, x.id
        limit greatest(p_limit, 0)
        for update skip locked)
    returning c.*)
  -- postcode and address come back for website confirmation in code only;
  -- nothing in the function sends them to a model.
  select to_jsonb(c) || jsonb_build_object(
           'next_seq', coalesce((select max(r.seq) from public.prospect_round r where r.candidate_id = c.id), 0))
    from claimed c;
end
$fn$;
revoke all on function public.prospect_next_batch(integer) from anon, authenticated, public;

create or replace function public.prospect_config()
returns jsonb language sql stable security definer
set search_path = public, pg_catalog as $fn$
  select jsonb_build_object(
    'models', coalesce((
      select jsonb_object_agg(role, chain) from (
        select role, jsonb_agg(jsonb_build_object(
                 'model', model, 'rpd', rpd, 'gap_ms', gap_ms,
                 'temperature', temperature, 'key_secret', key_secret) order by priority) as chain
          from public.outreach_model
         where active and role like 'prospect\_%'
         group by role) m), '{}'::jsonb),
    'prompts', coalesce((
      select jsonb_object_agg(key, jsonb_build_object('body', body, 'temperature', temperature))
        from public.prospect_prompt), '{}'::jsonb),
    'settings', coalesce((
      select jsonb_object_agg(key, value) from public.prospect_setting), '{}'::jsonb),
    'running', exists (select 1 from public.prospect_target where running and active)
            or exists (select 1 from public.prospect_candidate
                        where requeued and status in ('queued', 'working') and stage <> 'done'),
    'knowledge', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', k.key, 'kind', k.kind, 'label', k.label, 'body', k.body,
               'summary', k.summary, 'signals', k.signals) order by k.kind, k.key)
        from public.prospect_knowledge k
       where k.active
         and (k.kind = 'shared' or exists (
               select 1 from public.outreach_vocabulary v
                where v.dimension = 'capability' and v.term = k.key and v.active))), '[]'::jsonb)
  )
$fn$;

-- ---------- a person sends a business back ----------

create or replace function public.prospect_set_website(p_id uuid, p_url text)
returns void language plpgsql security definer
set search_path = public, pg_catalog as $fn$
declare
  v_url text := btrim(coalesce(p_url, ''));
begin
  if v_url !~* '^https?://' then v_url := 'https://' || v_url; end if;
  if v_url !~* '^https?://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:[0-9]+)?(/[^[:space:]]*)?$' then
    raise exception 'that is not a web address';
  end if;
  if not exists (select 1 from public.prospect_candidate where id = p_id and status <> 'promoted') then
    raise exception 'no such business, or it is already a lead';
  end if;
  delete from public.prospect_round where candidate_id = p_id;
  update public.prospect_candidate
     set website = v_url, website_confirmed_by = array['a person'], website_outcome = 'added by a person',
         stage = 'research', state = '{}'::jsonb, status = 'queued', attempts = 0, note = null,
         claimed_at = null, lookup_claimed_at = null, requeued = true, lead_score = null, services = null, error = null,
         finished_at = null, updated_at = now()
   where id = p_id;
end
$fn$;
revoke all on function public.prospect_set_website(uuid, text) from anon, public;
grant execute on function public.prospect_set_website(uuid, text) to authenticated;

create or replace function public.prospect_retry(p_id uuid)
returns void language sql security definer
set search_path = public, pg_catalog as $fn$
  with gone as (delete from public.prospect_round where candidate_id = p_id returning 1)
  update public.prospect_candidate
     set stage = 'research', state = '{}'::jsonb, status = 'queued', attempts = 0, note = null,
         claimed_at = null, lookup_claimed_at = null, lookup_attempts = 0, requeued = true,
         lead_score = null, services = null, error = null, finished_at = null, updated_at = now()
   where id = p_id and status in ('failed', 'no_fit', 'disputed', 'scored', 'dismissed', 'no_site', 'refused', 'researching')
$fn$;
revoke all on function public.prospect_retry(uuid) from anon, public;
grant execute on function public.prospect_retry(uuid) to authenticated;

-- ---------- the research loop's queue ----------

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
       set lookup_claimed_at = now(), lookup_attempts = c.lookup_attempts + 1, updated_at = now()
     where c.id in (
       select x.id from public.prospect_candidate x
        where x.status = 'researching'
          and x.lookup_attempts < 3
          and (x.lookup_claimed_at is null or x.lookup_claimed_at < now() - v_ttl)
        order by x.lookup_attempts, x.finished_at nulls first, x.id
        limit 1
        for update skip locked)
    returning c.*)
  select to_jsonb(c) || jsonb_build_object(
           'next_seq', coalesce((select max(r.seq) from public.prospect_round r where r.candidate_id = c.id), 0))
    from claimed c;
end
$fn$;

-- Found: back to research with the site, as a known one. Not found: no_site,
-- with what the loop tried. The transcript is kept either way - the lookup
-- rounds are the first chapter of the business's log.
create or replace function public.prospect_lookup_finish(
  p_id uuid, p_url text, p_confirmed_by text[], p_outcome text, p_note text default null)
returns void language sql security definer
set search_path = public, pg_catalog as $fn$
  update public.prospect_candidate
     set website = case when p_url is null then website else p_url end,
         website_confirmed_by = case when p_url is null then website_confirmed_by else p_confirmed_by end,
         website_outcome = left(case when p_url is null
                                     then concat_ws(' — ', nullif(website_outcome, ''), p_outcome)
                                     else p_outcome end, 2000),
         status = case when p_url is null then 'no_site' else 'queued' end,
         stage = case when p_url is null then 'done' else 'research' end,
         state = case when p_url is null then state else '{}'::jsonb end,
         requeued = p_url is not null, attempts = 0, claimed_at = null, lookup_claimed_at = null,
         note = case when p_url is null then left(p_note, 1000) else null end,
         finished_at = case when p_url is null then now() else null end, updated_at = now()
   where id = p_id and status = 'researching'
$fn$;

-- A failure gives the business back to the queue; the third ends it.
create or replace function public.prospect_lookup_fail(p_id uuid, p_error text)
returns void language sql security definer
set search_path = public, pg_catalog as $fn$
  update public.prospect_candidate
     set lookup_claimed_at = null,
         status = case when lookup_attempts >= 3 then 'no_site' else status end,
         note = case when lookup_attempts >= 3
                     then left('The research loop failed three times: ' || coalesce(p_error, 'unknown error') || '. Add the website if you know it.', 1000)
                     else note end,
         error = left(p_error, 1000), updated_at = now()
   where id = p_id and status = 'researching'
$fn$;

revoke all on function public.prospect_lookup_next() from anon, authenticated, public;
revoke all on function public.prospect_lookup_finish(uuid, text, text[], text, text) from anon, authenticated, public;
revoke all on function public.prospect_lookup_fail(uuid, text) from anon, authenticated, public;

-- ---------- the research loop's own project ----------

-- Two projects doing two jobs on two schedules, which is what the second
-- key was argued for (ai-discovery.md section 3). The research key is
-- never a spare for discovery, and discovery's never for research.
alter table public.outreach_model drop constraint if exists outreach_model_lookup_uses_research_project;
alter table public.outreach_model add constraint outreach_model_lookup_uses_research_project
  check ((role like 'prospect\_lookup%') = (key_secret = 'GEMINI_RESEARCH_API_KEY'));

insert into public.outreach_model (role, model, priority, rpd, gap_ms, temperature, active, note, key_secret)
values
  ('prospect_lookup',       'gemini-3.5-flash-lite',    10, 480, 4500, null, true, 'research loop: the investigator, with tools', 'GEMINI_RESEARCH_API_KEY'),
  ('prospect_lookup',       'gemini-flash-lite-latest', 20, 480, 4500, null, true, 'research loop: second in the chain', 'GEMINI_RESEARCH_API_KEY'),
  ('prospect_lookup',       'gemini-3.1-flash-lite',    30, 480, 4500, null, true, 'research loop: last in the chain', 'GEMINI_RESEARCH_API_KEY'),
  ('prospect_lookup_check', 'gemini-3.5-flash-lite',    10, 480, 4500, null, true, 'research loop: the checker', 'GEMINI_RESEARCH_API_KEY'),
  ('prospect_lookup_check', 'gemini-flash-lite-latest', 20, 480, 4500, null, true, 'research loop: checker, second', 'GEMINI_RESEARCH_API_KEY')
on conflict do nothing;

-- ---------- the dials ----------

insert into public.prospect_setting (key, value, note) values
  ('lookup_enabled', 'true', 'send a business with no website found to the research loop (GEMINI_RESEARCH_API_KEY); false parks it as no_site'),
  ('lookup_max_steps', '8', 'turns the research loop''s investigator gets per business'),
  ('lookup_seconds', '150', 'seconds the research loop may spend on one business')
on conflict (key) do update set value = excluded.value, note = excluded.note;

-- ---------- the two agents ----------

insert into public.prospect_prompt (key, temperature, body) values
('lookup', 0.3, $p$You are the research agent for n.abl's lead finder. A small UK business on the company register had no website that our domain guesser could prove was theirs. Your job is to find its own website, if it has one, and to prove it. You do not judge whether it is a good lead, and you never look for a way to contact anyone.

You have tools, and nothing else. You cannot search the web.
- register_history: names it was registered under before, other companies its directors run, and any company that controls it. A previous name, a sister company or a parent often has the site. Start here.
- guess_domains: domains for a name you have a reason to try. Try the trading name, the previous name, the sister company's name; with "and", without generic words like Services or Solutions.
- check_domain: reads a live site and says whether it names the business.
- archived_copy: reads the Internet Archive's copy of a site that turned us away, is down, or has gone.
- conclude: your answer.

How to judge a page:
- The registered postcode or company number on the page is proof: conclude.
- The name alone is not proof. It is theirs only if the trade matches the register, nothing puts it in another town or country, and nothing suggests a different company with the same name. A checker will read the page and has to agree.
- A directory, a social page, a franchise head office or a namesake is never their own site.

Work efficiently: you have a fixed number of turns. Do not check the same domain twice. You may only check domains a tool has offered you. When you have proof, call conclude with the domain and how you read it ("live" or "archived"). When good ideas run out, call conclude with domain null and say in one sentence what you tried.

Never write an email address, phone number or postcode.$p$),
('lookup_check', 0.2, $p$You are the checker for n.abl's lead finder. The research agent believes the web page below is this business's own website, but code found only the name on it - not the registered postcode or company number. Decide whether it is theirs.

It is theirs only if all of these hold:
- what the page says the business does matches what the register says it does;
- nothing on the page puts it in another town, region or country;
- nothing suggests a different company that happens to share the name (another trade, a national chain, a franchise head office, a directory listing).

If you cannot tell, the answer is unsure, and unsure counts as no: a wrong website is worse than none. Be exact: do not refuse a page because it is short, and do not accept one because the name is right.

Answer with JSON only:
{"verdict": "theirs|not_theirs|unsure", "why": "one or two sentences"}$p$)
on conflict (key) do update set body = excluded.body, temperature = excluded.temperature, updated_at = now();

-- ---------- the dashboard knows the queue ----------

create or replace function public.prospect_dashboard()
returns jsonb language sql stable security definer
set search_path = public, pg_catalog as $fn$
  select jsonb_build_object(
    'targets', (select jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'towns', t.towns, 'sic_codes', t.sic_codes,
        'incorporated_from', t.incorporated_from, 'incorporated_to', t.incorporated_to,
        'running', t.running, 'pulled', t.pulled, 'cursor', t.cursor,
        'exhausted_towns', t.exhausted_towns, 'note', t.note) order by t.running desc, t.name)
      from public.prospect_target t where t.active),
    'counts', (select jsonb_object_agg(status, n) from (
        select status, count(*) as n from public.prospect_candidate group by 1) z),
    'services', (select jsonb_agg(jsonb_build_object('key', k.key, 'label', k.label) order by k.key)
      from public.prospect_knowledge k where k.kind = 'service' and k.active),
    'models', (select jsonb_agg(jsonb_build_object(
        'model', u.model, 'used', u.used, 'exhausted', u.exhausted, 'observed_rpd', u.observed_rpd,
        'project', case u.key_secret when 'GEMINI_RESEARCH_API_KEY' then 'research' else 'discovery' end)
        order by u.key_secret, u.used desc)
      from public.outreach_model_usage u
     where u.usage_day = public.outreach_quota_day()
       and u.key_secret in ('GEMINI_DISCOVERY_API_KEY', 'GEMINI_RESEARCH_API_KEY')),
    'chains', (select jsonb_object_agg(c.role, c.chain) from (
        select role, jsonb_agg(model order by priority) as chain
          from public.outreach_model where active and role like 'prospect\_%' group by role) c),
    'last_run', (select to_jsonb(r) from public.prospect_runs r
                  where coalesce(r.detail ->> 'mode', '') <> 'lookup' order by r.id desc limit 1),
    'last_lookup', (select to_jsonb(r) from public.prospect_runs r
                     where r.detail ->> 'mode' = 'lookup' order by r.id desc limit 1),
    'candidates', (select jsonb_agg(d.doc order by d.rank, d.score desc nulls last, d.at desc) from (
        select
          case c.status when 'scored' then 0 when 'disputed' then 1 when 'working' then 2
                        when 'queued' then 3 when 'researching' then 4 when 'no_site' then 5
                        when 'promoted' then 6 when 'no_fit' then 7 when 'refused' then 8 else 9 end as rank,
          c.lead_score as score, coalesce(c.finished_at, c.pulled_at) as at,
          jsonb_build_object(
            'id', c.id, 'company', c.company_name, 'number', c.company_number,
            'town', c.town, 'activity', c.activity, 'incorporated_on', c.incorporated_on,
            'company_type', c.company_type, 'website', c.website,
            'website_confirmed_by', c.website_confirmed_by, 'website_outcome', c.website_outcome,
            'status', c.status, 'stage', c.stage, 'score', c.lead_score,
            'services', c.services, 'error', c.error, 'attempts', c.attempts, 'note', c.note,
            'cautions', c.state -> 'cautions', 'lookup_attempts', c.lookup_attempts,
            'promoted_lead_id', c.promoted_lead_id,
            'moves', (select count(*) from public.prospect_round r where r.candidate_id = c.id)) as doc
          from public.prospect_candidate c
         where c.status <> 'dismissed'
         order by 1, 2 desc nulls last, 3 desc
         limit 400) d)
  )
$fn$;

-- ---------- the businesses already parked go to the queue ----------

update public.prospect_candidate
   set status = 'researching', lookup_attempts = 0, lookup_claimed_at = null,
       note = 'No website found by guessing. With the research loop; you can still add it.', updated_at = now()
 where status = 'no_site'
   and not (coalesce(website_confirmed_by, '{}') && array['a person', 'found by the research loop']);

-- ---------- its own recurrence, offset from the prospector's ----------

select cron.unschedule(jobid) from cron.job where jobname = 'lead-lookup';
select cron.schedule('lead-lookup', '2-59/5 * * * *', $cron$
  select net.http_post(
    url := 'https://rrkcoqopcqtowbyismcq.supabase.co/functions/v1/lead-prospector',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-outreach-secret', public.outreach_cron_secret()),
    body := '{"mode": "lookup"}'::jsonb,
    timeout_milliseconds := 150000
  );
$cron$);
