-- =====================================================================
-- Rate-limited portal login + header hardening companion.
--
-- STATUS: APPLIED to project rrkcoqopcqtowbyismcq on 2026-08-15.
--
-- WHY
-- The portal access key is the only credential guarding a client's quotes,
-- projects, meetings and documents, and the REST endpoint accepted unlimited
-- guesses — 30 wrong keys in a row were all answered 200 with no throttling.
-- Combined with the old key format (20.7 bits, guessable prefix, fixed year)
-- that was an exhaustible search.
--
-- The key format has since been strengthened to ~59 bits of CSPRNG entropy
-- (src/lib/teamConfig.js), which is the real fix. This adds the second layer:
-- brute force is now both slow and visible.
--
-- SUPERSEDED IN PART by 202608150002_portal_rate_limiting_v2.sql, which
-- replaces portal_login() after testing showed per-IP counting alone is
-- defeated by IP rotation. This file still creates the attempt table, the
-- pruner and the search_path fix; read v2 for the current function.
--
-- NOTE ON SCOPE
-- This throttles the login RPC, which is the path the app uses. The RLS
-- policies still accept the x-access-key header directly, so a caller who
-- skips the app is not throttled. That is acceptable against 59-bit keys, but
-- if you ever want it airtight the fix is to have portal_login issue a
-- short-lived session token and change the five RLS policies to check that
-- token instead of the raw key.
-- =====================================================================

create table if not exists public.portal_login_attempts (
  id         bigserial primary key,
  ip         text        not null,
  key_fp     text        not null,   -- sha256(key) truncated; never the raw key
  ok         boolean     not null,
  at         timestamptz not null default now()
);

create index if not exists portal_login_attempts_ip_at_idx
  on public.portal_login_attempts (ip, at desc);

alter table public.portal_login_attempts enable row level security;

-- Deliberately no anon policy: the attempt log is invisible to the public.
drop policy if exists portal_login_attempts_team_select on public.portal_login_attempts;
create policy portal_login_attempts_team_select
  on public.portal_login_attempts for select to authenticated using (true);

create or replace function public.portal_login(p_key text)
returns table (
  id uuid, business_name text, contact_name text, contact_email text, created_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_ip   text;
  v_fp   text;
  v_fail int;
  v_row  record;
begin
  v_ip := coalesce(
    nullif(btrim(split_part(
      current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1)), ''),
    current_setting('request.headers', true)::json ->> 'cf-connecting-ip',
    'unknown');

  v_fp := substr(encode(digest(coalesce(p_key, ''), 'sha256'), 'hex'), 1, 16);

  select count(*) into v_fail
  from public.portal_login_attempts
  where ip = v_ip and not ok and at > now() - interval '15 minutes';

  if v_fail >= 10 then
    insert into public.portal_login_attempts(ip, key_fp, ok) values (v_ip, v_fp, false);
    raise exception 'Too many attempts. Try again later.' using errcode = 'P0001';
  end if;

  select c.id, c.business_name, c.contact_name, c.contact_email, c.created_at
    into v_row
  from public.clients c
  where c.access_key = p_key
  limit 1;

  insert into public.portal_login_attempts(ip, key_fp, ok)
  values (v_ip, v_fp, v_row.id is not null);

  if v_row.id is null then
    return;                            -- wrong key: no rows
  end if;

  id := v_row.id;
  business_name := v_row.business_name;
  contact_name := v_row.contact_name;
  contact_email := v_row.contact_email;
  created_at := v_row.created_at;
  return next;
end;
$$;

revoke all on function public.portal_login(text) from public;
grant execute on function public.portal_login(text) to anon, authenticated;

create or replace function public.prune_portal_login_attempts()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  delete from public.portal_login_attempts where at < now() - interval '30 days';
$$;
revoke all on function public.prune_portal_login_attempts() from public;

-- Advisor finding fixed while here: mutable search_path on a trigger function.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
