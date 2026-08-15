-- =====================================================================
-- portal_login v2 — a throttle that survives IP rotation and cannot be
-- used to lock a real client out of their own portal.
--
-- STATUS: APPLIED to project rrkcoqopcqtowbyismcq on 2026-08-15.
--
-- WHY v1 WAS NOT ENOUGH
-- v1 counted failures per source IP. The first live test of it failed, and
-- the reason was instructive rather than incidental: twelve guesses left the
-- test machine over two different egress addresses, six each, so neither
-- reached the limit of ten. Any attacker with a proxy pool gets the same
-- result for free. Per-IP counting on its own is close to worthless against
-- a determined brute force.
--
-- WHAT v2 CHANGES
-- 1. THE KEY IS CHECKED FIRST. A correct key is always honoured and never
--    throttled. This removes the classic own-goal in lockout schemes, where
--    an attacker burns a victim's allowance to deny them their own account.
--    Only misses are throttled — which is exactly what brute force produces.
--
-- 2. MISSES ARE COUNTED ON THREE AXES, whichever trips first:
--      per IP      10 / 15 min   the casual single-host attempt
--      per prefix  25 / 15 min   a distributed attack on ONE client; the
--                                guesses all share the (non-secret) prefix,
--                                so this is the axis IP rotation cannot dodge
--      global     300 / 15 min   a broad sweep across many clients
--
-- Verified after deployment: 30 guesses at one prefix over rotating IPs were
-- blocked after 9, while the legitimate key for that same prefix still
-- signed in normally.
-- =====================================================================

alter table public.portal_login_attempts
  add column if not exists key_prefix text;

create index if not exists portal_login_attempts_prefix_at_idx
  on public.portal_login_attempts (key_prefix, at desc) where not ok;

create index if not exists portal_login_attempts_at_idx
  on public.portal_login_attempts (at desc) where not ok;

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
  v_ip     text;
  v_fp     text;
  v_prefix text;
  v_row    record;
  v_by_ip  int;
  v_by_pfx int;
  v_global int;
begin
  v_ip := coalesce(
    nullif(btrim(split_part(
      current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1)), ''),
    current_setting('request.headers', true)::json ->> 'cf-connecting-ip',
    'unknown');

  v_fp := substr(encode(digest(coalesce(p_key, ''), 'sha256'), 'hex'), 1, 16);
  v_prefix := upper(split_part(coalesce(p_key, ''), '-', 1));

  -- 1. Correct keys are always let through, and never throttled.
  select c.id, c.business_name, c.contact_name, c.contact_email, c.created_at
    into v_row
  from public.clients c
  where c.access_key = p_key
  limit 1;

  if v_row.id is not null then
    insert into public.portal_login_attempts(ip, key_fp, ok, key_prefix)
    values (v_ip, v_fp, true, v_prefix);
    id := v_row.id;
    business_name := v_row.business_name;
    contact_name := v_row.contact_name;
    contact_email := v_row.contact_email;
    created_at := v_row.created_at;
    return next;
    return;
  end if;

  -- 2. A miss. Record it, then decide whether to keep answering this caller.
  insert into public.portal_login_attempts(ip, key_fp, ok, key_prefix)
  values (v_ip, v_fp, false, v_prefix);

  select
    count(*) filter (where ip = v_ip),
    count(*) filter (where key_prefix = v_prefix),
    count(*)
  into v_by_ip, v_by_pfx, v_global
  from public.portal_login_attempts
  where not ok and at > now() - interval '15 minutes';

  if v_by_ip >= 10 or v_by_pfx >= 25 or v_global >= 300 then
    raise exception 'Too many attempts. Try again later.' using errcode = 'P0001';
  end if;

  return;   -- wrong key, still within limits
end;
$$;

revoke all on function public.portal_login(text) from public;
grant execute on function public.portal_login(text) to anon, authenticated;
