-- Lead gen: four kinds of agent, arguing until the two that matter agree.
--
--   research    reads the public register and the business's own website,
--               and promotes the facts it can quote to the signals agent.
--   signals     turns those facts into signals and promotes the ones worth
--               selling on. The research agent reviews them - it is the only
--               agent that saw the page - and a signal it calls an overreach
--               is revised or dropped.
--   sales       compares the agreed signals with the portfolio and brings in
--               the specialist for each service it thinks fits, with an
--               opening score.
--   specialist  one per service, each reading its own knowledge pack from
--               business/knowledge/services. Argues the score with sales
--               until one of them accepts the other's number exactly. It may
--               hand the lead on to another service; sales decides whether
--               to bring that specialist in.
--
-- No agreement, no score: the service is recorded as disputed and a person
-- reads the argument.
--
-- THE SAME FRAMEWORK AS OUTREACH
--
-- The model chain, the daily budgets, the per-minute pacing and the switch
-- to the next model on a 429 are the outreach registry, not a copy of it:
-- the prospect_* roles are rows in public.outreach_model, spent through
-- outreach_model_budget / outreach_record_call like every other role. Their
-- key_secret is GEMINI_DISCOVERY_API_KEY, so they spend the second project's
-- pool and are counted separately from the writer's. A constraint below
-- makes it impossible to point a prospect role at the writer's key.
--
-- Woken the same way too: pg_cron every five minutes, authenticated with
-- the vault secret the outreach job already uses. So the whole thing needs
-- exactly two new Edge Function secrets, and no new vault entry:
--
--   COMPANIES_HOUSE_API_KEY     the register
--   GEMINI_DISCOVERY_API_KEY    the fresh Google AI Studio project
--
-- And nothing runs until somebody presses Run: a target has to be marked
-- running, and none is.
--
-- WHAT IS STORED, AND WHAT IS NOT
--
-- Every agent's reply is stored exactly as it came back (prospect_round.said).
-- The business's page text is not: it is fetched, read, and dropped. The
-- register address and postcode are stored, for the CRM and for dedupe, and
-- never sent to a model; nor is the company number or any officer's name.

-- ---------- what the agents know ----------

create table if not exists public.prospect_knowledge (
  key        text primary key,
  kind       text not null check (kind in ('service', 'shared')),
  label      text not null,
  body       text not null,
  summary    text,
  signals    text,
  sha256     text not null,
  active     boolean not null default true,
  updated_at timestamptz not null default now()
);
comment on table public.prospect_knowledge is
  'Loaded from business/knowledge/services by scripts/build-service-knowledge.mjs. Edit the markdown, not the rows.';

-- ---------- how they are asked ----------

create table if not exists public.prospect_prompt (
  key         text primary key,
  body        text not null,
  temperature numeric not null default 0.4 check (temperature between 0 and 2),
  note        text,
  updated_at  timestamptz not null default now()
);

create table if not exists public.prospect_setting (
  key   text primary key,
  value jsonb not null,
  note  text
);

-- ---------- what to pull ----------

create table if not exists public.prospect_target (
  id               uuid primary key default gen_random_uuid(),
  name             text not null unique,
  towns            text[] not null default '{}',
  sic_codes        text[] not null default '{}',
  incorporated_from date,
  incorporated_to   date,
  company_types    text[] not null default '{ltd,llp}',
  running          boolean not null default false,
  active           boolean not null default true,
  -- Where each town's search got to, so a pull resumes rather than
  -- re-reading page one: {"Nottingham": 150, ...}
  cursor           jsonb not null default '{}'::jsonb,
  exhausted_towns  text[] not null default '{}',
  pulled           integer not null default 0,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Two to five digits each: a prefix ("432") is expanded to its codes by
  -- the edge function. array_to_string keeps this a plain row check.
  constraint prospect_target_sic_shape check (
    array_to_string(sic_codes, ',') ~ '^([0-9]{2,5}(,[0-9]{2,5})*)?$')
);
-- One Run button, one running target.
create unique index if not exists prospect_target_one_running
  on public.prospect_target (running) where running;

-- ---------- who was pulled ----------

create table if not exists public.prospect_candidate (
  id                uuid primary key default gen_random_uuid(),
  target_id         uuid references public.prospect_target(id) on delete set null,
  company_number    text not null unique,
  company_name      text not null,
  company_type      text,
  company_status    text,
  incorporated_on   date,
  sic_codes         text[] not null default '{}',
  activity          text,
  town              text,
  postcode          text,
  address           text,
  register          jsonb,
  website           text,
  website_confirmed_by text[],
  website_outcome   text,
  stage             text not null default 'research'
                      check (stage in ('research', 'signals', 'sales', 'specialists', 'done')),
  state             jsonb not null default '{}'::jsonb,
  status            text not null default 'queued'
                      check (status in ('queued', 'working', 'scored', 'no_fit', 'disputed',
                                        'failed', 'promoted', 'dismissed')),
  attempts          integer not null default 0,
  claimed_at        timestamptz,
  lead_score        integer check (lead_score between 0 and 100),
  services          jsonb,
  error             text,
  promoted_lead_id  uuid references public.sales_leads(id) on delete set null,
  pulled_at         timestamptz not null default now(),
  finished_at       timestamptz,
  updated_at        timestamptz not null default now()
);
create index if not exists prospect_candidate_queue
  on public.prospect_candidate (target_id, status, pulled_at);

-- ---------- what they said ----------

create table if not exists public.prospect_round (
  id           bigint generated always as identity primary key,
  candidate_id uuid not null references public.prospect_candidate(id) on delete cascade,
  seq          integer not null,
  stage        text not null,
  from_agent   text not null,
  to_agent     text,
  model        text,
  decision     text not null,
  said         text,
  guard        text,
  created_at   timestamptz not null default now()
);
create index if not exists prospect_round_candidate on public.prospect_round (candidate_id, id);
comment on column public.prospect_round.said is
  'The agent''s reply exactly as the model returned it. Never a summary.';
comment on column public.prospect_round.guard is
  'What code did about the reply - a fact struck, a proposal refused. Null when nothing was overruled.';

create table if not exists public.prospect_runs (
  id          bigint generated always as identity primary key,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  pulled      integer not null default 0,
  stages      integer not null default 0,
  finished    integer not null default 0,
  detail      jsonb,
  error       text
);

alter table public.prospect_knowledge enable row level security;
alter table public.prospect_prompt    enable row level security;
alter table public.prospect_setting   enable row level security;
alter table public.prospect_target    enable row level security;
alter table public.prospect_candidate enable row level security;
alter table public.prospect_round     enable row level security;
alter table public.prospect_runs      enable row level security;

-- ---------- the model registry: shared, with one extra rule ----------

-- Discovery must never spend the writer's pool. A rule in the edge function
-- would be a request; this is the rule.
alter table public.outreach_model drop constraint if exists outreach_model_prospect_uses_its_own_project;
alter table public.outreach_model add constraint outreach_model_prospect_uses_its_own_project
  check (role not like 'prospect\_%' or key_secret <> 'GEMINI_API_KEY');

insert into public.outreach_model (role, model, priority, rpd, gap_ms, temperature, active, note, key_secret)
values
  ('prospect_research',   'gemini-3.5-flash-lite',    10, 1000, 4500, null, true, 'lead gen: reads register + site', 'GEMINI_DISCOVERY_API_KEY'),
  ('prospect_research',   'gemini-flash-lite-latest', 20, 1000, 4500, null, true, null, 'GEMINI_DISCOVERY_API_KEY'),
  ('prospect_research',   'gemini-3.1-flash-lite',    30, 1000, 4500, null, true, null, 'GEMINI_DISCOVERY_API_KEY'),
  ('prospect_signals',    'gemini-3.5-flash-lite',    10, 1000, 4500, null, true, 'lead gen: facts to signals', 'GEMINI_DISCOVERY_API_KEY'),
  ('prospect_signals',    'gemini-flash-lite-latest', 20, 1000, 4500, null, true, null, 'GEMINI_DISCOVERY_API_KEY'),
  ('prospect_signals',    'gemini-3.1-flash-lite',    30, 1000, 4500, null, true, null, 'GEMINI_DISCOVERY_API_KEY'),
  ('prospect_sales',      'gemini-3.5-flash',         10,  250, 6500, null, true, 'lead gen: the generalist; the fewest calls, so the best model', 'GEMINI_DISCOVERY_API_KEY'),
  ('prospect_sales',      'gemini-flash-latest',      20,  250, 6500, null, true, null, 'GEMINI_DISCOVERY_API_KEY'),
  ('prospect_sales',      'gemini-3.5-flash-lite',    30, 1000, 4500, null, true, null, 'GEMINI_DISCOVERY_API_KEY'),
  ('prospect_specialist', 'gemini-3.5-flash-lite',    10, 1000, 4500, null, true, 'lead gen: one per service', 'GEMINI_DISCOVERY_API_KEY'),
  ('prospect_specialist', 'gemini-flash-lite-latest', 20, 1000, 4500, null, true, null, 'GEMINI_DISCOVERY_API_KEY'),
  ('prospect_specialist', 'gemini-3.1-flash-lite',    30, 1000, 4500, null, true, null, 'GEMINI_DISCOVERY_API_KEY')
on conflict (role, model) do nothing;

-- ---------- the dials ----------

insert into public.prospect_setting (key, value, note) values
  ('batch_size',            '1',      'candidates claimed per tick; each is worked stage by stage until the tick budget runs out'),
  ('tick_budget_ms',        '120000', 'stop starting stages after this long; the edge function has 150s'),
  ('stage_reserve_ms',      '{"research": 45000, "signals": 50000, "sales": 20000, "specialists": 65000}',
                                      'do not start a stage with less than this left in the tick'),
  ('queue_low_water',       '4',      'pull another page from Companies House when fewer than this are waiting'),
  ('pull_page_size',        '50',     'companies per Companies House request'),
  ('claim_ttl_seconds',     '600',    'a candidate claimed by a tick that died is free again after this'),
  ('max_attempts',          '3',      'a candidate that fails this many times is marked failed'),
  ('max_facts',             '12',     'facts the research agent may promote'),
  ('max_signals',           '8',      'signals the signals agent may put forward'),
  ('signal_reviews',        '2',      'research reviews of the signals; one revision between each'),
  ('max_services',          '3',      'specialists sales may bring in for one business, including hand-ons'),
  ('agreement_turns',       '6',      'messages between sales and one specialist before it is called disputed'),
  ('max_page_chars',        '9000',   'website text the research agent reads, across all pages'),
  ('pages_per_site',        '3',      'homepage plus this many minus one about/services pages'),
  ('fetch_timeout_ms',      '12000',  null),
  ('model_timeout_ms',      '30000',  null),
  ('user_agent',            '"n.abl-research/1.0 (+https://nabl.agency; hello@nabl.agency)"', null)
on conflict (key) do nothing;

-- ---------- the prompts ----------
--
-- Every agent answers in JSON with a "say" field: what it is telling the
-- next agent, in its own words. That is what the argument log shows first,
-- and the rest of the reply is shown beneath it, untouched.

insert into public.prospect_prompt (key, temperature, body) values
('research', 0.3, $p$You are the research agent in a small team deciding whether a local business is worth a first letter from n.abl, a two-person technology consultancy (automation, data and reporting, custom software, web, AI where it earns its place).

You are the only agent who sees the source material: lines from the public company register, and text from the business's own website if one was found. The other agents will only ever see what you promote to them. So promote facts, not impressions.

Rules:
- Every page fact must carry a quote copied exactly, word for word, from the website text. A quote that is not on the page will be struck by a check you cannot see, and the fact with it.
- Every register fact must name the register line it rests on, by its key.
- Never repeat an email address, phone number, web address or postcode, even if the page shows one.
- Say what you could not establish. "No website was found" and "the site says nothing about how they take bookings" are findings.
- Do not judge fit and do not name our services. That is not your job.

Answer with JSON only:
{
  "say": "to the signals agent: what this business is and does, and what you found, in plain sentences",
  "facts": [
    {"id": "f1", "fact": "one plain statement", "source": "page", "quote": "exact words from the page"},
    {"id": "f2", "fact": "one plain statement", "source": "register", "register_key": "r_accounts"}
  ],
  "unknowns": ["what you could not find out"]
}$p$),

('signals', 0.4, $p$You are the signals agent. The research agent has read a business's register entry and website and promoted the facts below to you. You never see the website yourself.

Your job: find the signals in those facts - things that suggest where this business spends time, loses money, makes mistakes, or cannot do something it plainly needs to. Promote the ones worth a sales conversation.

Rules:
- Every signal must cite the fact ids it rests on. A signal citing no fact, or a fact that does not exist, is dropped by a check.
- Say how strong each is: "strong" (the facts show it directly), "possible" (the facts make it plausible), "weak" (only the kind of business suggests it).
- Do not stretch. The research agent will review every signal against what it actually saw, and will call an overreach an overreach.
- Do not name our services; the sales agent decides that.
- Never write an email address, phone number, web address or postcode.

If the research agent has objected, revise: fix or withdraw what it objected to, and keep what it let stand.

Answer with JSON only:
{
  "say": "to the research agent and the sales agent: what you see in this business, in plain sentences",
  "signals": [{"id": "s1", "signal": "one plain statement", "facts": ["f1"], "strength": "strong|possible|weak"}],
  "promote": ["s1"]
}$p$),

('research_review', 0.2, $p$You are the research agent again. You read this business's register entry and website; the signals agent did not. It has turned your facts into the signals below.

Check each one against what you actually found. A signal "stands" if your facts support it at the strength claimed. It is an "overreach" if it claims more than the facts show, cites a fact that does not say that, or is really about the kind of business rather than this one while calling itself strong.

Be exact and be fair: do not object to a signal because you would have worded it differently.

Answer with JSON only:
{
  "say": "to the signals agent: what stands, what does not, and why",
  "verdicts": [{"signal": "s1", "verdict": "stands|overreach", "why": "one sentence"}]
}$p$),

('sales', 0.4, $p$You are the sales agent for n.abl. You are the generalist: you know every service a little and none of them as well as its specialist. Your job is to decide which specialists to bring in for this business, and to open each conversation with a score.

You are given the signals the research and signals agents agreed on, who we sell to, the scoring scale, and a short description of each service with the signals that point to it.

Rules:
- Bring in a specialist only for a service the signals actually point at. Citing the signals is required: a service with no cited signal is refused.
- At most the number of services stated. Fewer is usually right. None is a legitimate answer - say why in "no_fit_because".
- Your opening score is your honest view on the scale given. The specialist will argue with it; a score is only final when one of you accepts the other's number exactly.
- Speak to each specialist directly in its pitch.
- Never write an email address, phone number, web address or postcode.

Answer with JSON only:
{
  "say": "to the team: which services you are bringing in and why, in plain sentences",
  "services": [{"service": "service key", "pitch": "to that specialist: why this is yours", "signals": ["s1"], "score": 55}],
  "no_fit_because": "only when services is empty"
}$p$),

('specialist', 0.4, $p$You are the specialist for one of n.abl's services. Your knowledge of the service is below: what we build, what points here, what points elsewhere, what kills it, and how you score. The sales agent has brought you a business and an opening score.

Argue the score honestly from the signals and your scoring rules. You know this service better than sales does; use that. But the aim is agreement on the right number, not winning.

Your moves:
- "agree": you accept the sales agent's last number. Your "score" must be exactly that number.
- "counter": you propose a different number and say why, citing signals.
- "pass": this is not a case for your service at all. Score 0.
- "redirect": the signals are really about another service. Name it in "redirect_to" (a service key), give your own score for yours, and say why.

Also give the one question that would settle it on a call, and what answer would mean walk away.

Never write an email address, phone number, web address or postcode.

Answer with JSON only:
{
  "say": "to the sales agent, directly",
  "verdict": "agree|counter|pass|redirect",
  "score": 60,
  "signals": ["s1"],
  "redirect_to": null,
  "confirm_question": "the question for the call",
  "walk_away_if": "the answer that ends it"
}$p$),

('sales_reply', 0.4, $p$You are the sales agent, in a conversation with one service specialist about one business. You have read its last message below, with the whole conversation so far.

Your moves:
- "agree": you accept the specialist's last number. Your "score" must be exactly that number.
- "counter": you propose a different number and say why, citing signals.

If the specialist has handed the business on to another service and you think it is right, set "bring_in" to that service, with a pitch, the signals and your opening score for it. You may only bring in services from the portfolio, and the total is capped.

Move towards agreement when the argument is good. Hold your number when it is not, and say which signal the specialist has misread.

Never write an email address, phone number, web address or postcode.

Answer with JSON only:
{
  "say": "to the specialist, directly",
  "verdict": "agree|counter",
  "score": 60,
  "signals": ["s1"],
  "bring_in": null
}
where bring_in, when used, is {"service": "key", "pitch": "to that specialist", "signals": ["s1"], "score": 50}.$p$)
on conflict (key) do nothing;

-- ---------- the edge function's calls (service role only) ----------

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

-- What to pull next, or nothing. Nothing when no target is running, when
-- enough is already waiting, or when every town has run out.
create or replace function public.prospect_pull_plan()
returns jsonb language plpgsql stable security definer
set search_path = public, pg_catalog as $fn$
declare
  t public.prospect_target%rowtype;
  v_low integer := coalesce((select (value)::text::integer from public.prospect_setting where key = 'queue_low_water'), 4);
  v_waiting integer;
  v_town text;
begin
  select * into t from public.prospect_target where running and active;
  if not found then return null; end if;

  select count(*) into v_waiting from public.prospect_candidate
   where target_id = t.id and status in ('queued', 'working');
  if v_waiting >= v_low then return null; end if;

  select town into v_town from unnest(t.towns) town
   where not (town = any (t.exhausted_towns))
   order by coalesce((t.cursor ->> town)::integer, 0), town
   limit 1;
  if v_town is null then return null; end if;

  return jsonb_build_object(
    'target_id', t.id, 'town', v_town,
    'start_index', coalesce((t.cursor ->> v_town)::integer, 0),
    'sic_codes', to_jsonb(t.sic_codes), 'company_types', to_jsonb(t.company_types),
    'incorporated_from', t.incorporated_from, 'incorporated_to', t.incorporated_to,
    'waiting', v_waiting);
end
$fn$;

-- Insert a page of pulled companies, skipping anyone already pulled or
-- already a lead. The CRM stores a lead's company number inside
-- subscriber_type_evidence ("Companies House 01234567"), so that is where
-- it is matched; a lead with no number is matched on its normalised name.
create or replace function public.prospect_insert_candidates(
  p_target_id uuid, p_town text, p_next_index integer, p_exhausted boolean, p_rows jsonb)
returns integer language plpgsql security definer
set search_path = public, pg_catalog as $fn$
declare v_n integer;
begin
  with incoming as (
    select * from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(
      company_number text, company_name text, company_type text, company_status text,
      incorporated_on date, sic_codes text[], activity text, town text, postcode text, address text)
    where company_number ~ '^[A-Z0-9]{8}$' and nullif(btrim(company_name), '') is not null
  ), fresh as (
    select i.* from incoming i
     where not exists (select 1 from public.sales_leads l
                        where l.subscriber_type_evidence = 'Companies House ' || i.company_number)
       and not exists (select 1 from public.sales_leads l
                        where upper(regexp_replace(regexp_replace(l.company, '\m(LIMITED|LTD|LLP)\M\.?', '', 'gi'), '[^A-Za-z0-9]', '', 'g'))
                            = upper(regexp_replace(regexp_replace(i.company_name, '\m(LIMITED|LTD|LLP)\M\.?', '', 'gi'), '[^A-Za-z0-9]', '', 'g')))
  ), ins as (
    insert into public.prospect_candidate
      (target_id, company_number, company_name, company_type, company_status,
       incorporated_on, sic_codes, activity, town, postcode, address)
    select p_target_id, company_number, company_name, company_type, company_status,
           incorporated_on, coalesce(sic_codes, '{}'), activity, coalesce(nullif(town, ''), p_town), postcode, address
      from fresh
    on conflict (company_number) do nothing
    returning 1)
  select count(*) into v_n from ins;

  update public.prospect_target
     set cursor = cursor || jsonb_build_object(p_town, greatest(coalesce(p_next_index, 0), 0)),
         exhausted_towns = case when p_exhausted and not (p_town = any (exhausted_towns))
                                then exhausted_towns || p_town else exhausted_towns end,
         pulled = pulled + v_n,
         updated_at = now()
   where id = p_target_id;
  return v_n;
end
$fn$;

create or replace function public.prospect_next_batch(p_limit integer default 1)
returns setof jsonb language plpgsql security definer
set search_path = public, pg_catalog as $fn$
declare
  v_ttl interval := make_interval(secs => coalesce(
    (select (value)::text::integer from public.prospect_setting where key = 'claim_ttl_seconds'), 600));
  v_max integer := coalesce((select (value)::text::integer from public.prospect_setting where key = 'max_attempts'), 3);
  t public.prospect_target%rowtype;
begin
  select * into t from public.prospect_target where running and active;
  if not found then return; end if;

  return query
  with claimed as (
    update public.prospect_candidate c
       set claimed_at = now(), status = 'working', updated_at = now()
     where c.id in (
       select x.id from public.prospect_candidate x
        where x.target_id = t.id
          and x.status in ('queued', 'working')
          and x.stage <> 'done'
          and x.attempts < v_max
          and (x.claimed_at is null or x.claimed_at < now() - v_ttl)
        order by (x.status = 'working') desc, x.pulled_at, x.id
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

create or replace function public.prospect_record_round(
  p_candidate_id uuid, p_seq integer, p_stage text, p_from text, p_to text,
  p_model text, p_decision text, p_said text default null, p_guard text default null)
returns void language sql security definer
set search_path = public, pg_catalog as $fn$
  insert into public.prospect_round (candidate_id, seq, stage, from_agent, to_agent, model, decision, said, guard)
  values (p_candidate_id, p_seq, p_stage, p_from, nullif(p_to, ''), nullif(p_model, ''), p_decision,
          left(nullif(p_said, ''), 100000), left(nullif(btrim(coalesce(p_guard, '')), ''), 2000))
$fn$;

-- After every stage, so a tick that ends mid-lead loses nothing but the
-- stage it was in.
create or replace function public.prospect_save_state(
  p_id uuid, p_stage text, p_state jsonb,
  p_register jsonb default null, p_website text default null,
  p_confirmed_by text[] default null, p_website_outcome text default null)
returns void language sql security definer
set search_path = public, pg_catalog as $fn$
  update public.prospect_candidate
     set stage = p_stage, state = coalesce(p_state, state),
         register = coalesce(p_register, register),
         website = coalesce(p_website, website),
         website_confirmed_by = coalesce(p_confirmed_by, website_confirmed_by),
         website_outcome = coalesce(p_website_outcome, website_outcome),
         claimed_at = now(), updated_at = now()
   where id = p_id
$fn$;

create or replace function public.prospect_finish(
  p_id uuid, p_status text, p_lead_score integer, p_services jsonb, p_state jsonb default null)
returns void language sql security definer
set search_path = public, pg_catalog as $fn$
  update public.prospect_candidate
     set stage = 'done', status = p_status,
         lead_score = case when p_lead_score is null then null else least(greatest(p_lead_score, 0), 100) end,
         services = p_services, state = coalesce(p_state, state),
         error = null, claimed_at = null, finished_at = now(), updated_at = now()
   where id = p_id and p_status in ('scored', 'no_fit', 'disputed')
$fn$;

create or replace function public.prospect_fail(p_id uuid, p_error text)
returns void language sql security definer
set search_path = public, pg_catalog as $fn$
  update public.prospect_candidate
     set attempts = attempts + 1,
         error = left(p_error, 1000),
         claimed_at = null,
         status = case when attempts + 1 >= coalesce(
                    (select (value)::text::integer from public.prospect_setting where key = 'max_attempts'), 3)
                  then 'failed' else 'working' end,
         updated_at = now()
   where id = p_id
$fn$;

-- The tick ran out of time between stages. Not a failure: free it for the
-- next tick, which starts at the stage it reached.
create or replace function public.prospect_release(p_id uuid)
returns void language sql security definer
set search_path = public, pg_catalog as $fn$
  update public.prospect_candidate set claimed_at = null, updated_at = now() where id = p_id
$fn$;

create or replace function public.prospect_log_run(
  p_pulled integer, p_stages integer, p_finished integer, p_detail jsonb default null, p_error text default null)
returns void language sql security definer
set search_path = public, pg_catalog as $fn$
  insert into public.prospect_runs (finished_at, pulled, stages, finished, detail, error)
  values (now(), coalesce(p_pulled, 0), coalesce(p_stages, 0), coalesce(p_finished, 0), p_detail, p_error)
$fn$;

create or replace function public.prospect_prune()
returns integer language sql security definer
set search_path = public, pg_catalog as $fn$
  with gone as (
    delete from public.prospect_candidate
     where status in ('dismissed', 'no_fit', 'failed')
       and coalesce(finished_at, updated_at) < now() - interval '60 days'
    returning 1),
  runs as (
    delete from public.prospect_runs where started_at < now() - interval '60 days' returning 1)
  select (select count(*) from gone)::integer
$fn$;

revoke all on function public.prospect_config() from anon, authenticated, public;
revoke all on function public.prospect_pull_plan() from anon, authenticated, public;
revoke all on function public.prospect_insert_candidates(uuid, text, integer, boolean, jsonb) from anon, authenticated, public;
revoke all on function public.prospect_next_batch(integer) from anon, authenticated, public;
revoke all on function public.prospect_record_round(uuid, integer, text, text, text, text, text, text, text) from anon, authenticated, public;
revoke all on function public.prospect_save_state(uuid, text, jsonb, jsonb, text, text[], text) from anon, authenticated, public;
revoke all on function public.prospect_finish(uuid, text, integer, jsonb, jsonb) from anon, authenticated, public;
revoke all on function public.prospect_fail(uuid, text) from anon, authenticated, public;
revoke all on function public.prospect_release(uuid) from anon, authenticated, public;
revoke all on function public.prospect_log_run(integer, integer, integer, jsonb, text) from anon, authenticated, public;
revoke all on function public.prospect_prune() from anon, authenticated, public;

-- ---------- the CRM's calls (the team) ----------

create or replace function public.prospect_dashboard()
returns jsonb language sql stable security definer
set search_path = public, pg_catalog as $fn$
  select jsonb_build_object(
    'targets', (select jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'towns', t.towns, 'sic_codes', t.sic_codes,
        'incorporated_from', t.incorporated_from, 'incorporated_to', t.incorporated_to,
        'running', t.running, 'pulled', t.pulled, 'cursor', t.cursor,
        'exhausted_towns', t.exhausted_towns) order by t.name)
      from public.prospect_target t where t.active),
    'counts', (select jsonb_object_agg(status, n) from (
        select status, count(*) as n from public.prospect_candidate group by 1) z),
    'services', (select jsonb_agg(jsonb_build_object('key', k.key, 'label', k.label) order by k.key)
      from public.prospect_knowledge k where k.kind = 'service' and k.active),
    'models', (select jsonb_agg(jsonb_build_object(
        'model', u.model, 'used', u.used, 'exhausted', u.exhausted, 'observed_rpd', u.observed_rpd)
        order by u.used desc)
      from public.outreach_model_usage u
     where u.usage_day = public.outreach_quota_day() and u.key_secret = 'GEMINI_DISCOVERY_API_KEY'),
    'chains', (select jsonb_object_agg(c.role, c.chain) from (
        select role, jsonb_agg(model order by priority) as chain
          from public.outreach_model where active and role like 'prospect\_%' group by role) c),
    'last_run', (select to_jsonb(r) from public.prospect_runs r order by r.id desc limit 1),
    'candidates', (select jsonb_agg(d.doc order by d.rank, d.score desc nulls last, d.at desc) from (
        select
          case c.status when 'scored' then 0 when 'disputed' then 1 when 'working' then 2
                        when 'queued' then 3 when 'promoted' then 4 when 'no_fit' then 5 else 6 end as rank,
          c.lead_score as score, coalesce(c.finished_at, c.pulled_at) as at,
          jsonb_build_object(
            'id', c.id, 'company', c.company_name, 'number', c.company_number,
            'town', c.town, 'activity', c.activity, 'incorporated_on', c.incorporated_on,
            'company_type', c.company_type, 'website', c.website,
            'website_confirmed_by', c.website_confirmed_by, 'website_outcome', c.website_outcome,
            'status', c.status, 'stage', c.stage, 'score', c.lead_score,
            'services', c.services, 'error', c.error, 'attempts', c.attempts,
            'promoted_lead_id', c.promoted_lead_id,
            'moves', (select count(*) from public.prospect_round r where r.candidate_id = c.id)) as doc
          from public.prospect_candidate c
         where c.status <> 'dismissed'
         order by 1, 2 desc nulls last, 3 desc
         limit 400) d)
  )
$fn$;

create or replace function public.prospect_transcript(p_id uuid)
returns jsonb language sql stable security definer
set search_path = public, pg_catalog as $fn$
  select coalesce(jsonb_agg(jsonb_build_object(
           'seq', r.seq, 'stage', r.stage, 'from', r.from_agent, 'to', r.to_agent,
           'model', r.model, 'decision', r.decision, 'said', r.said, 'guard', r.guard,
           'at', r.created_at) order by r.id), '[]'::jsonb)
    from public.prospect_round r where r.candidate_id = p_id
$fn$;

create or replace function public.prospect_save_target(
  p_id uuid, p_name text, p_towns text[], p_sic_codes text[],
  p_incorporated_from date default null, p_incorporated_to date default null)
returns uuid language plpgsql security definer
set search_path = public, pg_catalog as $fn$
declare
  v_id uuid;
  v_towns text[] := array(select distinct initcap(btrim(t)) from unnest(coalesce(p_towns, '{}')) t
                           where btrim(t) <> '' and btrim(t) !~ '[0-9]');
  v_sic text[] := array(select distinct btrim(s) from unnest(coalesce(p_sic_codes, '{}')) s where btrim(s) <> '');
begin
  if nullif(btrim(coalesce(p_name, '')), '') is null then raise exception 'a target needs a name'; end if;
  if cardinality(v_towns) = 0 then raise exception 'a target needs at least one town (a town, not a postcode)'; end if;
  if exists (select 1 from unnest(v_sic) s where s !~ '^[0-9]{2,5}$') then
    raise exception 'SIC codes are two to five digits';
  end if;
  if p_incorporated_from is not null and p_incorporated_to is not null and p_incorporated_from > p_incorporated_to then
    raise exception 'incorporated from is after incorporated to';
  end if;

  if p_id is null then
    insert into public.prospect_target (name, towns, sic_codes, incorporated_from, incorporated_to)
    values (btrim(p_name), v_towns, v_sic, p_incorporated_from, p_incorporated_to)
    returning id into v_id;
  else
    -- A changed search starts from page one; an unchanged one keeps its place.
    update public.prospect_target t
       set name = btrim(p_name), towns = v_towns, sic_codes = v_sic,
           incorporated_from = p_incorporated_from, incorporated_to = p_incorporated_to,
           cursor = case when t.sic_codes = v_sic and t.incorporated_from is not distinct from p_incorporated_from
                              and t.incorporated_to is not distinct from p_incorporated_to
                         then t.cursor else '{}'::jsonb end,
           exhausted_towns = case when t.sic_codes = v_sic and t.incorporated_from is not distinct from p_incorporated_from
                                       and t.incorporated_to is not distinct from p_incorporated_to
                                  then array(select x from unnest(t.exhausted_towns) x where x = any (v_towns))
                                  else '{}' end,
           updated_at = now()
     where t.id = p_id
     returning t.id into v_id;
    if v_id is null then raise exception 'no such target'; end if;
  end if;
  return v_id;
end
$fn$;

create or replace function public.prospect_start(p_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_catalog as $fn$
begin
  if not exists (select 1 from public.prospect_target where id = p_id and active and cardinality(towns) > 0) then
    raise exception 'save a target with at least one town first';
  end if;
  update public.prospect_target set running = false, updated_at = now() where running and id <> p_id;
  update public.prospect_target set running = true, updated_at = now() where id = p_id;
end
$fn$;

create or replace function public.prospect_stop()
returns void language sql security definer
set search_path = public, pg_catalog as $fn$
  update public.prospect_target set running = false, updated_at = now() where running
$fn$;

-- A person decides. The lead arrives do_not_contact, exactly as promote.mjs
-- has always made them: finding a business is not permission to write to it.
create or replace function public.prospect_promote(p_id uuid)
returns uuid language plpgsql security definer
set search_path = public, pg_catalog as $fn$
declare
  c public.prospect_candidate%rowtype;
  v_lead uuid;
  v_fits text;
begin
  select * into c from public.prospect_candidate where id = p_id for update;
  if not found then raise exception 'no such candidate'; end if;
  if c.status = 'promoted' then return c.promoted_lead_id; end if;
  if c.status not in ('scored', 'disputed', 'no_fit') then
    raise exception 'only a candidate the agents have finished with can be promoted';
  end if;
  if exists (select 1 from public.sales_leads where subscriber_type_evidence = 'Companies House ' || c.company_number) then
    raise exception 'already a lead';
  end if;

  select string_agg(format('%s %s (%s)', s ->> 'service',
                           coalesce(s ->> 'score', '-'), s ->> 'status'), ', '
                    order by (s ->> 'score')::integer desc nulls last)
    into v_fits
    from jsonb_array_elements(coalesce(c.services, '[]'::jsonb)) s;

  insert into public.sales_leads (
    company, website, industry, location, lead_score, status, notes,
    subscriber_type, subscriber_type_evidence, subscriber_type_checked_at,
    lawful_basis, source, source_detail, source_date,
    privacy_notice_status, marketing_status)
  values (
    c.company_name, c.website, c.activity,
    nullif(concat_ws(', ', nullif(c.address, ''), nullif(c.postcode, '')), ''),
    greatest(coalesce(c.lead_score, 50), 1), 'New Lead',
    concat_ws(' ', 'Found by the lead-gen agents.',
              case when v_fits is not null then 'Agreed scores: ' || v_fits || '.' end,
              'The full argument is on the candidate in Lead gen.'),
    'corporate', 'Companies House ' || c.company_number, now(),
    'not_personal_data', 'companies_house',
    concat_ws('; ', 'Companies House REST API',
              case when c.website is not null then 'site confirmed by ' || array_to_string(c.website_confirmed_by, ' + ') end),
    c.pulled_at::date, 'not_required', 'do_not_contact')
  returning id into v_lead;

  update public.prospect_candidate
     set status = 'promoted', promoted_lead_id = v_lead, updated_at = now()
   where id = p_id;
  return v_lead;
end
$fn$;

create or replace function public.prospect_dismiss(p_id uuid)
returns void language sql security definer
set search_path = public, pg_catalog as $fn$
  update public.prospect_candidate set status = 'dismissed', claimed_at = null, updated_at = now()
   where id = p_id and status <> 'promoted'
$fn$;

-- Start a candidate's argument again from the beginning. The old transcript
-- is deleted with it: a log that mixed two runs would read as one argument.
create or replace function public.prospect_retry(p_id uuid)
returns void language sql security definer
set search_path = public, pg_catalog as $fn$
  with gone as (delete from public.prospect_round where candidate_id = p_id returning 1)
  update public.prospect_candidate
     set stage = 'research', state = '{}'::jsonb, status = 'queued', attempts = 0,
         claimed_at = null, lead_score = null, services = null, error = null,
         finished_at = null, updated_at = now()
   where id = p_id and status in ('failed', 'no_fit', 'disputed', 'scored', 'dismissed')
$fn$;

revoke all on function public.prospect_dashboard() from anon, public;
revoke all on function public.prospect_transcript(uuid) from anon, public;
revoke all on function public.prospect_save_target(uuid, text, text[], text[], date, date) from anon, public;
revoke all on function public.prospect_start(uuid) from anon, public;
revoke all on function public.prospect_stop() from anon, public;
revoke all on function public.prospect_promote(uuid) from anon, public;
revoke all on function public.prospect_dismiss(uuid) from anon, public;
revoke all on function public.prospect_retry(uuid) from anon, public;
grant execute on function public.prospect_dashboard() to authenticated;
grant execute on function public.prospect_transcript(uuid) to authenticated;
grant execute on function public.prospect_save_target(uuid, text, text[], text[], date, date) to authenticated;
grant execute on function public.prospect_start(uuid) to authenticated;
grant execute on function public.prospect_stop() to authenticated;
grant execute on function public.prospect_promote(uuid) to authenticated;
grant execute on function public.prospect_dismiss(uuid) to authenticated;
grant execute on function public.prospect_retry(uuid) to authenticated;

-- The cron job is in 202609220004, applied after the function is deployed,
-- so it never spends a tick calling a function that does not exist yet.
