-- The argument log is what the agents said, not what we made of it.
--
-- Until now each move in public.outreach_round carried a `reason` that was
-- partly the model's words and partly this system's summary of them: the
-- scout's move read "5 verdicts, 3 angles: a, b, c", the strategist's was
-- two of its fields glued together. A person reading the log was reading
-- our précis of an argument they could not see.
--
-- Now every move carries `said` - the model's reply exactly as it came
-- back - and `to_agent`, who hears it next. `reason` stays, narrowed to
-- one job: a guard's own verdict when code overruled or corrected an
-- agent. Old rows keep their reasons and have no `said`; the CRM shows
-- whichever exists.
--
-- Nothing extra is asked of any model. The reply was already in hand; it
-- was being thrown away after parsing.
--
-- The dashboard does not ship the replies themselves. Verbatim, for every
-- lead, that would be megabytes on every CRM load; it keeps the outline of
-- each move (so the CRM already deployed keeps working unchanged) and
-- outreach_argument(lead) returns one lead's full transcript when somebody
-- opens it.

alter table public.outreach_round
  add column if not exists said text,
  add column if not exists to_agent text;

comment on column public.outreach_round.said is
  'The model''s reply exactly as it came back. Never a summary.';
comment on column public.outreach_round.reason is
  'A guard''s verdict when code overruled or corrected the agent. Null when the move is simply the agent speaking (see said).';

-- Dropped rather than replaced: a new argument list makes a second overload,
-- and PostgREST refuses to choose between two. The deployed function calls
-- with the first seven named arguments until it is redeployed, which the new
-- signature still accepts.
drop function if exists public.outreach_record_round(uuid, integer, text, text, text, text, text);

create or replace function public.outreach_record_round(
  p_lead_id uuid, p_round integer, p_agent text, p_model text, p_decision text,
  p_angle_key text default null, p_reason text default null,
  p_said text default null, p_to text default null)
returns void language sql security definer
set search_path = public, pg_catalog as $fn$
  insert into public.outreach_round (lead_id, round, agent, model, decision, angle_key, reason, said, to_agent)
  values (p_lead_id, p_round, p_agent, p_model, p_decision,
          nullif(btrim(coalesce(p_angle_key, '')), ''),
          left(nullif(btrim(coalesce(p_reason, '')), ''), 1000),
          -- A ceiling only a runaway reply would reach. Anything a model
          -- actually says to another agent fits many times over.
          left(nullif(p_said, ''), 100000),
          nullif(btrim(coalesce(p_to, '')), ''))
$fn$;

revoke all on function public.outreach_record_round(uuid, integer, text, text, text, text, text, text, text) from anon, authenticated, public;

create or replace function public.outreach_argument(p_lead_id uuid)
returns jsonb language sql stable security definer
set search_path = public, pg_catalog as $fn$
  select coalesce(jsonb_agg(jsonb_build_object(
           'round', r.round, 'agent', r.agent, 'to', r.to_agent,
           'decision', r.decision, 'angle', r.angle_key, 'model', r.model,
           'said', r.said, 'reason', r.reason, 'at', r.created_at)
         order by r.id), '[]'::jsonb)
    from public.outreach_round r
   where r.lead_id = p_lead_id
$fn$;

revoke all on function public.outreach_argument(uuid) from anon, public;
grant execute on function public.outreach_argument(uuid) to authenticated;

create or replace function public.outreach_dashboard()
returns jsonb language sql stable security definer
set search_path = public, pg_catalog as $fn$
  select jsonb_build_object(
    'status', (select to_jsonb(s) from public.outreach_status s),
    'models', (select jsonb_agg(jsonb_build_object(
                 'model', u.model, 'used', u.used, 'exhausted', u.exhausted,
                 'observed_rpd', u.observed_rpd, 'key_secret', u.key_secret)
                 order by u.used desc)
               from public.outreach_model_usage u
               where u.usage_day = public.outreach_quota_day()),
    'targets', (select jsonb_agg(jsonb_build_object(
                  'id', t.id, 'name', t.name, 'towns', t.towns,
                  'sectors', t.sectors, 'capabilities', t.capabilities,
                  'min_score', t.min_score, 'is_default', t.is_default,
                  'sending_enabled', t.sending_enabled,
                  'reach', public.outreach_target_reach(t.id)) order by t.name)
                from public.outreach_target t where t.active),
    'send_blockers', public.outreach_send_blockers(),
    'towns', (select jsonb_agg(jsonb_build_object('key', d, 'n', n) order by d)
              from (select town as d, count(*) as n
                      from public.sales_leads where town is not null
                       and coalesce(opt_out, false) = false
                     group by 1) z),
    'sectors', (select jsonb_agg(jsonb_build_object('key', sc, 'n', n) order by sc)
                from (select sector as sc, count(*) as n from public.sales_leads
                       where sector is not null group by 1) z),
    'capability_terms', (select jsonb_agg(jsonb_build_object(
                  'term', v.term, 'label', coalesce(v.label, replace(v.term, '_', ' ')),
                  'meaning', v.meaning) order by v.term)
                from public.outreach_vocabulary v
               where v.dimension = 'capability' and v.active),
    'chains', (select jsonb_object_agg(c.role, c.chain) from (
                 select role, jsonb_agg(model order by priority) as chain
                 from public.outreach_model where active group by role) c),
    'leads', (select jsonb_agg(q.doc order by q.rank, q.ord desc nulls last) from (
       select
         case when l.observation is not null then 0
              when l.observation_attempts >= 3 then 2
              when l.fit_assessed_at is not null then 1
              else 3 end as rank,
         coalesce(l.observation_at, l.fit_assessed_at, l.created_at) as ord,
         jsonb_build_object(
           'id', l.id,
           'company', coalesce(nullif(btrim(l.trading_name), ''), l.company),
           'registered', l.company,
           'state', case when l.observation is not null then 'drafted'
                         when l.observation_attempts >= 3 then 'given_up'
                         when l.fit_assessed_at is not null then 'no_clause'
                         else 'waiting' end,
           'website', l.website,
           'location', l.location,
           'town', l.town,
           'assessed', (l.fit_assessed_at is not null),
           'suppressed', exists (select 1 from public.marketing_suppression s
                                  where s.source_lead_id = l.id),
           'caps_any', (select jsonb_agg(distinct f.capability)
              from public.lead_service_fit f
             where f.lead_id = l.id and f.capability is not null),
           'industry', l.industry,
           'score', l.lead_score,
           'score_was', l.lead_score_initial,
           'band', l.lead_score_band,
           'breakdown', l.lead_score_breakdown,
           'available', l.lead_score_points_available,
           'rescored_at', l.lead_score_rescored_at,
           'sector', l.sector,
           'sector_source', l.sector_source,
           'presence', l.web_presence,
           'technical', l.technical_capacity,
           'inbound', l.inbound_volume,
           'credit', l.credit_fit,
           'credit_why', l.credit_fit_reason,
           'summary', l.fit_summary,
           'clause', l.observation,
           'evidence', l.observation_evidence,
           'basis', l.observation_basis,
           'model', l.observation_model,
           'error', l.observation_error,
           'attempts', l.observation_attempts,
           'source', l.source,
           'top', (select f.category from public.lead_service_fit f
                    left join public.outreach_vocabulary vf
                           on vf.dimension = 'fit' and vf.term = f.fit
                    where f.lead_id = l.id
                    order by vf.rank desc nulls last limit 1),
           'categories', (select jsonb_agg(distinct f.category)
              from public.lead_service_fit f
             where f.lead_id = l.id and f.fit <> 'ruled_out'),
           'capabilities', (select jsonb_agg(distinct f.capability)
              from public.lead_service_fit f
             where f.lead_id = l.id and f.fit <> 'ruled_out'
               and f.capability is not null),
           'signals', (select jsonb_agg(jsonb_build_object(
                  'key', ps.key, 'says', ps.description,
                  'code', ps.signal_code, 'tier', ps.tier) order by ps.tier nulls last, ps.key)
              from public.lead_page_signal lps
              join public.outreach_page_signal ps on ps.key = lps.key
             where lps.lead_id = l.id),
           'services', (select jsonb_agg(jsonb_build_object(
                  'category', f.category, 'capability', f.capability,
                  'fit', f.fit, 'confidence', f.confidence,
                  'rationale', f.rationale, 'evidence', f.evidence,
                  'ask', f.confirm_question, 'walk_away_if', f.disqualifier)
                order by vf.rank desc nulls last)
              from public.lead_service_fit f
              left join public.outreach_vocabulary vf
                     on vf.dimension = 'fit' and vf.term = f.fit
             where f.lead_id = l.id),
           'letter', (select jsonb_build_object(
                  'subject', x.subject, 'body', x.body, 'shape', x.shape,
                  'tension', x.tension, 'recognition', x.recognition,
                  'must_not_imply', x.must_not_imply, 'model', x.model,
                  'approved_at', x.approved_at)
              from public.lead_letter x where x.lead_id = l.id),
           'moves', (select jsonb_agg(jsonb_build_object(
                  'round', r.round, 'agent', r.agent, 'to', r.to_agent, 'decision', r.decision,
                  'angle', r.angle_key, 'reason', r.reason, 'model', r.model,
                  'has_said', r.said is not null)
                order by r.id)
              from public.outreach_round r where r.lead_id = l.id)
         ) as doc
         from public.sales_leads l
        where coalesce(l.opt_out, false) = false) q)
  )
$fn$;

revoke all on function public.outreach_dashboard() from anon, public;
grant execute on function public.outreach_dashboard() to authenticated;
