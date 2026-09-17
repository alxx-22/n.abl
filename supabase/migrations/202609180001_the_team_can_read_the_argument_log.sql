-- The team can read the argument log without the tables being open.
--
-- Every outreach table is RLS-on with no policies and no grant to
-- authenticated: reachable by the service role and nothing else. That is
-- the right default, and it is why the dashboard has only ever existed
-- as an artifact talking through a connector.
--
-- Putting it in the CRM needs a read path. Granting select on ten tables
-- would be the quick way and the wrong one - it opens the prompts, the
-- quota counters and every round of every argument as separate surfaces,
-- each of which then has to be kept shut against writes by policy.
--
-- Instead: one function, one shape, one grant. It is exactly the query
-- the artifact already runs, so the CRM and the artifact cannot drift,
-- and the tables underneath stay closed.
--
-- Granted to authenticated, which in this project is the team: there is
-- no signUp anywhere in src/, accounts are created out of band, and
-- sales_leads - which holds far more about a real business than this
-- does - has carried "team can manage sales leads" to authenticated
-- since the original schema. This is the same trust boundary, not a
-- wider one.

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
                  'round', r.round, 'agent', r.agent, 'decision', r.decision,
                  'angle', r.angle_key, 'reason', r.reason, 'model', r.model)
                order by r.id)
              from public.outreach_round r where r.lead_id = l.id)
         ) as doc
         from public.sales_leads l
        where coalesce(l.opt_out, false) = false) q)
  )
$fn$;

revoke all on function public.outreach_dashboard() from anon, public;
grant execute on function public.outreach_dashboard() to authenticated;

-- The writes the Run panel makes. Each re-checks its own arguments
-- server-side regardless of what the CRM sent: save_target refuses a town
-- nobody is in, start_run refuses a target with nothing queued, and
-- arming still demands the target's name typed back exactly.
grant execute on function public.outreach_save_target(uuid, text, text[], text[], text[], integer, boolean) to authenticated;
grant execute on function public.outreach_start_run(uuid) to authenticated;
grant execute on function public.outreach_stop_run() to authenticated;

-- The send switch too, so the control in the CRM is the real one rather
-- than a picture of it. Four blockers stand in front of it today and the
-- checkbox is disabled while any of them holds; both approval gates are
-- human and both are before sending; and outreach_arm_sending re-checks
-- the typed name itself, so a CRM that skipped the confirmation dialog
-- would still be refused.
grant execute on function public.outreach_arm_sending(uuid, text, text) to authenticated;
grant execute on function public.outreach_disarm_sending(uuid) to authenticated;
