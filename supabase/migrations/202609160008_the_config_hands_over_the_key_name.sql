-- The config hands over the key's name, never the key.
--
-- outreach_config() is what the edge function reads on every tick. It now
-- carries key_secret with each model, so the function knows which secret
-- to read for that row. The secret's value is never in the database and
-- never travels over this call - only the name of the environment
-- variable holding it.

create or replace function public.outreach_config()
returns jsonb language sql stable security definer
set search_path = public, pg_catalog as $fn$
  select jsonb_build_object(
    'dimensions', coalesce((
      select jsonb_agg(jsonb_build_object('dimension', dimension, 'heading', heading)
             order by prompt_order, dimension)
      from public.outreach_dimension where active
    ), '[]'::jsonb),
    'vocabulary', coalesce((
      select jsonb_object_agg(dimension, terms) from (
        select dimension, jsonb_agg(jsonb_build_object(
                 'term', term, 'rank', rank, 'meaning', meaning,
                 'needs_evidence', needs_evidence, 'is_default', is_default,
                 'requires_dimension', requires_dimension,
                 'requires_min_rank', requires_min_rank) order by rank, term) as terms
        from public.outreach_vocabulary where active group by dimension) v
    ), '{}'::jsonb),
    'models', coalesce((
      select jsonb_object_agg(role, chain) from (
        select role, jsonb_agg(jsonb_build_object(
                 'model', model, 'rpd', rpd, 'gap_ms', gap_ms,
                 'temperature', temperature, 'key_secret', key_secret) order by priority) as chain
        from public.outreach_model where active group by role) m
    ), '{}'::jsonb),
    'fact_rules', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.priority, f.key)
      from public.outreach_fact_rule f where f.active
    ), '[]'::jsonb),
    'page_signals', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', key, 'pattern', pattern, 'flags', flags,
               'description', description) order by key)
      from public.outreach_page_signal where active
    ), '[]'::jsonb),
    'settings', coalesce((
      select jsonb_object_agg(key, value) from public.outreach_setting
    ), '{}'::jsonb),
    'prompts', coalesce((
      select jsonb_object_agg(key, jsonb_build_object(
               'body', body, 'temperature', temperature))
      from public.outreach_prompt
    ), '{}'::jsonb),
    'sectors', coalesce((
      select jsonb_agg(jsonb_build_object('sector', sector, 'label', label) order by sector)
      from public.sector_service_prior
    ), '[]'::jsonb)
  )
$fn$;
