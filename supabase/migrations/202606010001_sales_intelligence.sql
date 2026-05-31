create extension if not exists pgcrypto;

create table if not exists public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  website text,
  industry text,
  location text,
  estimated_size text,
  business_type text,
  lead_score integer not null default 50 check (lead_score between 1 and 100),
  recommendation_reason text,
  status text not null default 'New Lead' check (status in (
    'New Lead',
    'Researching',
    'Ready To Contact',
    'Contacted',
    'Follow Up Required',
    'Replied',
    'Meeting Scheduled',
    'Proposal Sent',
    'Won',
    'Lost'
  )),
  owner_id uuid references auth.users(id) on delete set null,
  owner_name text,
  notes text,
  last_activity_at timestamptz,
  research_summary text,
  research_json jsonb not null default '{}'::jsonb,
  source_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.sales_leads(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  contact_form_url text,
  source text,
  confidence integer not null default 50 check (confidence between 1 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.sales_research_runs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.sales_leads(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  mode text not null check (mode in ('discover', 'research')),
  filters jsonb not null default '{}'::jsonb,
  prompt text,
  result jsonb not null default '{}'::jsonb,
  source_urls jsonb not null default '[]'::jsonb,
  status text not null default 'completed',
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_email_drafts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.sales_leads(id) on delete cascade,
  subject text not null,
  body text not null,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz,
  send_provider text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.sales_leads(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  activity_type text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_pipeline_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.sales_leads(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  from_status text,
  to_status text not null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sales_leads_set_updated_at on public.sales_leads;
create trigger sales_leads_set_updated_at
before update on public.sales_leads
for each row execute function public.set_updated_at();

drop trigger if exists sales_email_drafts_set_updated_at on public.sales_email_drafts;
create trigger sales_email_drafts_set_updated_at
before update on public.sales_email_drafts
for each row execute function public.set_updated_at();

alter table public.sales_leads enable row level security;
alter table public.sales_contacts enable row level security;
alter table public.sales_research_runs enable row level security;
alter table public.sales_email_drafts enable row level security;
alter table public.sales_activities enable row level security;
alter table public.sales_pipeline_events enable row level security;

create policy "team can manage sales leads"
on public.sales_leads for all
to authenticated
using (true)
with check (true);

create policy "team can manage sales contacts"
on public.sales_contacts for all
to authenticated
using (true)
with check (true);

create policy "team can manage sales research runs"
on public.sales_research_runs for all
to authenticated
using (true)
with check (true);

create policy "team can manage sales email drafts"
on public.sales_email_drafts for all
to authenticated
using (true)
with check (true);

create policy "team can manage sales activities"
on public.sales_activities for all
to authenticated
using (true)
with check (true);

create policy "team can manage sales pipeline events"
on public.sales_pipeline_events for all
to authenticated
using (true)
with check (true);
