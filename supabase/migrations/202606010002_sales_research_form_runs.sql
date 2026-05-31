alter table public.sales_research_runs
add column if not exists input_lead jsonb not null default '{}'::jsonb;

alter table public.sales_research_runs
add column if not exists completed_at timestamptz;

create or replace function public.create_sales_discovery_run(
  p_industry text default null,
  p_location text default null,
  p_company_size text default null,
  p_business_type text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_run_id uuid;
begin
  insert into public.sales_research_runs (
    requested_by,
    mode,
    filters,
    status
  )
  values (
    auth.uid(),
    'discover',
    jsonb_build_object(
      'industry', nullif(trim(coalesce(p_industry, '')), ''),
      'location', nullif(trim(coalesce(p_location, '')), ''),
      'company_size', nullif(trim(coalesce(p_company_size, '')), ''),
      'business_type', nullif(trim(coalesce(p_business_type, '')), '')
    ),
    'queued'
  )
  returning id into v_run_id;

  return v_run_id;
end;
$$;

create or replace function public.create_sales_company_research_run(
  p_lead_id uuid default null,
  p_company text default null,
  p_website text default null,
  p_industry text default null,
  p_location text default null,
  p_company_size text default null,
  p_business_type text default null,
  p_public_signals text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_run_id uuid;
begin
  if p_lead_id is null and nullif(trim(coalesce(p_company, '')), '') is null then
    raise exception 'Either p_lead_id or p_company is required';
  end if;

  insert into public.sales_research_runs (
    lead_id,
    requested_by,
    mode,
    input_lead,
    prompt,
    status
  )
  values (
    p_lead_id,
    auth.uid(),
    'research',
    jsonb_build_object(
      'company', nullif(trim(coalesce(p_company, '')), ''),
      'website', nullif(trim(coalesce(p_website, '')), ''),
      'industry', nullif(trim(coalesce(p_industry, '')), ''),
      'location', nullif(trim(coalesce(p_location, '')), ''),
      'company_size', nullif(trim(coalesce(p_company_size, '')), ''),
      'business_type', nullif(trim(coalesce(p_business_type, '')), ''),
      'public_signals', nullif(trim(coalesce(p_public_signals, '')), '')
    ),
    nullif(trim(coalesce(p_public_signals, '')), ''),
    'queued'
  )
  returning id into v_run_id;

  return v_run_id;
end;
$$;

create or replace function public.complete_sales_research_run(
  p_run_id uuid,
  p_result jsonb default '{}'::jsonb,
  p_source_urls jsonb default '[]'::jsonb,
  p_error text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.sales_research_runs
  set
    result = coalesce(p_result, '{}'::jsonb),
    source_urls = coalesce(p_source_urls, '[]'::jsonb),
    error = nullif(trim(coalesce(p_error, '')), ''),
    status = case
      when nullif(trim(coalesce(p_error, '')), '') is null then 'completed'
      else 'failed'
    end,
    completed_at = now()
  where id = p_run_id;

  if not found then
    raise exception 'Sales research run % was not found', p_run_id;
  end if;
end;
$$;

grant execute on function public.create_sales_discovery_run(text, text, text, text) to authenticated;
grant execute on function public.create_sales_company_research_run(uuid, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.complete_sales_research_run(uuid, jsonb, jsonb, text) to authenticated;
