-- The portal assistant: one client's own record, and the requests it raises.
--
-- The assistant answers questions about a client's own account and turns what
-- it cannot answer into a tracked request. Two things carry the whole design:
--
--   1. It never sees anyone else's data. Not filtered out — never fetched.
--      The function below takes an access key and returns exactly one client's
--      rows, resolved server-side. Nothing the browser sends chooses whose.
--
--   2. It never acts on its own. Every action becomes a row a human confirmed,
--      the same shape as the outreach gates: the model proposes, the person
--      clicks, the code writes.

-- ---------------------------------------------------------------------------
-- 1. One client's context, keyed on the access key alone
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER because the portal is not a Supabase session — a client has
-- an access key, not a JWT, so there is no auth.uid() to scope against. The
-- key IS the identity, which is exactly why it must be the only input: accept
-- a client_id alongside it and the first bug makes it a lookup for any client.

create or replace function public.portal_assistant_context(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_client public.clients%rowtype;
begin
  select * into v_client
  from public.clients
  where access_key = btrim(p_key)
  limit 1;

  -- No key, no context. Returning an empty object rather than raising: the
  -- caller should not be able to tell a wrong key from a key with no data.
  if not found then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'client', jsonb_build_object(
      'business_name', v_client.business_name,
      'contact_name',  v_client.contact_name,
      'contact_email', v_client.contact_email,
      'client_since',  v_client.created_at
    ),
    -- Every sub-query is scoped by v_client.id, which came from the key. There
    -- is no path here that takes an id from outside this function.
    'quotes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'reference', q.reference, 'title', q.title, 'amount', q.amount,
        'status', q.status, 'valid_until', q.valid_until)
        order by q.created_at desc)
      from public.quotes q where q.client_id = v_client.id
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', p.title, 'status', p.status,
        'progress_percent', p.progress_percent,
        'next_milestone', p.next_milestone,
        'next_milestone_date', p.next_milestone_date))
      from public.projects p where p.client_id = v_client.id
    ), '[]'::jsonb),
    'meetings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', m.title, 'datetime', m.datetime,
        'location', m.location, 'status', m.status)
        order by m.datetime)
      from public.meetings m where m.client_id = v_client.id
    ), '[]'::jsonb),
    -- Titles only. A signed URL in a model prompt is a signed URL in whatever
    -- the model says next, and these documents are private storage.
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', d.title, 'document_type', d.document_type,
        'uploaded_at', d.uploaded_at)
        order by d.uploaded_at desc)
      from public.documents d where d.client_id = v_client.id
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.portal_assistant_context(text) is
  'Exactly one client''s own record, resolved from their access key. The key is '
  'the only input by design: accepting a client id alongside it would make this '
  'a lookup for any client the moment something passed the wrong one.';

-- ---------------------------------------------------------------------------
-- 2. What the assistant can raise
-- ---------------------------------------------------------------------------

create table if not exists public.portal_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,

  kind text not null check (kind in (
    'question',      -- something the assistant could not answer
    'ticket',        -- something is wrong, or needs changing
    'call',          -- they want to speak to someone
    'quote_query',   -- a question about a specific quote
    'detail_change'  -- contact, address, someone to add
  )),

  subject text not null check (btrim(subject) <> ''),
  body text not null check (btrim(body) <> ''),

  -- Which quote, where the request is about one.
  quote_reference text,

  status text not null default 'open'
    check (status in ('open', 'in_progress', 'answered', 'closed')),

  -- Recorded because it changes how the team reads it. A request the client
  -- typed is their words; one the assistant drafted is a summary they
  -- approved, and those are not the same thing.
  raised_via text not null default 'assistant'
    check (raised_via in ('assistant', 'client_typed')),

  created_at timestamptz not null default now(),
  answered_at timestamptz
);

create index if not exists portal_requests_client_idx
  on public.portal_requests (client_id, created_at desc);
create index if not exists portal_requests_open_idx
  on public.portal_requests (status, created_at desc) where status = 'open';

-- ---------------------------------------------------------------------------
-- 3. Raising one, again keyed only on the access key
-- ---------------------------------------------------------------------------

create or replace function public.portal_raise_request(
  p_key text,
  p_kind text,
  p_subject text,
  p_body text,
  p_quote_reference text default null,
  p_raised_via text default 'assistant'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $$
declare
  v_client_id uuid;
  v_recent integer;
begin
  select id into v_client_id from public.clients where access_key = btrim(p_key) limit 1;
  if v_client_id is null then
    raise exception 'not signed in' using errcode = 'check_violation';
  end if;

  -- A chat box that writes a row is a chat box that can write ten thousand
  -- rows. Twenty an hour is far more than any real client needs and far less
  -- than a loop produces.
  select count(*) into v_recent
  from public.portal_requests
  where client_id = v_client_id and created_at > now() - interval '1 hour';

  if v_recent >= 20 then
    raise exception 'too many requests raised in the last hour'
      using errcode = 'check_violation';
  end if;

  insert into public.portal_requests
    (client_id, kind, subject, body, quote_reference, raised_via)
  values
    (v_client_id, p_kind, left(btrim(p_subject), 200), left(btrim(p_body), 4000),
     p_quote_reference, p_raised_via)
  returning id into v_client_id;

  return v_client_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Grants and RLS
-- ---------------------------------------------------------------------------

alter table public.portal_requests enable row level security;

-- The team reads and works them; clients reach them only through the two
-- functions above, which is what keeps the access key the only key.
drop policy if exists "team manages portal requests" on public.portal_requests;
create policy "team manages portal requests"
on public.portal_requests for all
to authenticated
using (true) with check (true);

revoke all on public.portal_requests from anon;

revoke all on function public.portal_assistant_context(text) from public, anon, authenticated;
revoke all on function public.portal_raise_request(text, text, text, text, text, text) from public, anon, authenticated;

-- Only the service role calls these — the edge function, never the browser.
-- Granting to anon would put a whole client's record one guessed key away
-- from anyone, with no rate limiting in front of it.
