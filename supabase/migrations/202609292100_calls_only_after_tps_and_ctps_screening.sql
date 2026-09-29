-- ============================================================
-- CALLS ONLY AFTER TPS AND CTPS SCREENING
--
-- The owner, 29 September: call sole traders, by a person, having checked
-- that the number is not on the Telephone Preference Service. Until now the
-- gate refused every call outright (compliance-schema.md section 2.4), which
-- was right while there was nothing to check against.
--
-- PECR regulation 21: no unsolicited live sales call to a number registered
-- on the TPS (individuals, sole traders, most partnerships) or the CTPS
-- (companies) for 28 days or more, and none to anyone who has told us not
-- to call. The legal form of a business found on the food register or a map
-- is unknown, so both registers are checked every time, whatever the lead
-- says it is.
--
-- What this adds:
--
--   phone_e164          one normaliser for UK numbers, the same rules as
--                       lead-prospector/local.mjs normalisePhone
--   phone_screening     every check, append-only: the number, both answers,
--                       when, by which service, and who recorded it
--   phone_screening_record_by_hand
--                       a person who checked a number on a TPS checker's own
--                       site records what it said, under their own name
--   phone_screening_record_api
--                       the tps-check edge function records a provider's
--                       answer (service role only)
--   phone_screen_clear  the newest check of the number, if under 28 days old,
--                       found it on neither register
--   marketing_send_allowed, phone branch
--                       permitted only with such a check, a lawful basis that
--                       is not "no personal data" unless the lead is a
--                       company, and every rule every channel already has
--   a monthly ceiling on calls, hard-coded like the others
--
-- A number found on either register is also written to the suppression
-- list (reason tps_ctps), which is permanent; only a recorded consent after
-- it lets that number be called.
--
-- Nothing here calls anyone. A person records the call in the CRM, which
-- inserts a marketing_sends row, and the insert is the check.
-- ============================================================

-- ---------- a UK number, one way ----------

create or replace function public.phone_e164(p text)
returns text language plpgsql immutable
set search_path = pg_catalog as $fn$
declare
  d text := regexp_replace(coalesce(p, ''), '\s*(;|,|/|\sor\s).*$', '', 'i');
begin
  d := regexp_replace(replace(d, '(0)', ''), '[^0-9+]', '', 'g');
  if d = '' then return null; end if;
  if d like '+44%' then d := '0' || substr(d, 4);
  elsif d like '0044%' then d := '0' || substr(d, 5);
  elsif d like '44%' and length(d) = 12 then d := '0' || substr(d, 3);
  end if;
  if d !~ '^0[1-35-8][0-9]{8,9}$' then return null; end if;
  return '+44' || substr(d, 2);
end
$fn$;

-- ---------- every check, kept ----------

create table if not exists public.phone_screening (
  id uuid primary key default gen_random_uuid(),
  phone text not null check (phone ~ '^\+44[1-35-8][0-9]{8,9}$'),
  -- Both registers, every time: a business's legal form is not always known.
  tps boolean not null,
  ctps boolean not null,
  checked_at timestamptz not null,
  provider text not null check (btrim(provider) <> ''),
  method text not null check (method in ('api', 'by_hand')),
  evidence text,
  -- Plain uuid, like the suppression list: a deleted lead leaves its checks.
  lead_id uuid,
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  constraint phone_screening_not_in_future check (checked_at <= recorded_at + interval '5 minutes')
);

create index if not exists phone_screening_phone_idx on public.phone_screening (phone, checked_at desc);

comment on table public.phone_screening is
  'Every TPS/CTPS check of a number: the evidence that a call was screened. Append-only. Read through phone_screening_status.';

alter table public.phone_screening enable row level security;
revoke all on table public.phone_screening from anon, authenticated;

create or replace function public.phone_screening_append_only()
returns trigger language plpgsql
set search_path = public, pg_catalog as $fn$
begin
  raise exception 'phone_screening is append-only: a check that happened stays recorded';
end
$fn$;

drop trigger if exists phone_screening_no_change on public.phone_screening;
create trigger phone_screening_no_change
before update or delete on public.phone_screening
for each row execute function public.phone_screening_append_only();

-- ---------- is this number clear to call today ----------
-- The newest check decides, and only while it is under 28 days old: that is
-- how long a new TPS registration takes to bind, so a check older than that
-- may have missed one.

create or replace function public.phone_screen_clear(p_phone text)
returns boolean language sql stable security definer
set search_path = public, pg_catalog as $fn$
  select coalesce((
    select not s.tps and not s.ctps
      from public.phone_screening s
     where s.phone = public.phone_e164(p_phone)
       and s.checked_at > now() - interval '28 days'
     order by s.checked_at desc, s.recorded_at desc
     limit 1), false)
$fn$;

-- ---------- recording a check ----------

create or replace function public.phone_screening_write(
  p_phone text, p_tps boolean, p_ctps boolean, p_provider text, p_method text,
  p_checked_at timestamptz, p_evidence text, p_lead_id uuid, p_by uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_catalog as $fn$
declare
  v_phone text := public.phone_e164(p_phone);
  v_id uuid;
  v_hit boolean;
begin
  if v_phone is null then raise exception 'that is not a UK phone number we can screen'; end if;
  if p_tps is null or p_ctps is null then
    raise exception 'both registers must be checked: the TPS and the CTPS';
  end if;
  if nullif(btrim(coalesce(p_provider, '')), '') is null then raise exception 'say which service checked it'; end if;
  if p_checked_at is null or p_checked_at > now() + interval '5 minutes' then
    raise exception 'a check cannot be dated in the future';
  end if;
  if p_checked_at < now() - interval '28 days' then
    raise exception 'a check more than 28 days old does not count: check it again';
  end if;

  insert into public.phone_screening (phone, tps, ctps, checked_at, provider, method, evidence, lead_id, recorded_by)
  values (v_phone, p_tps, p_ctps, p_checked_at, btrim(p_provider), p_method,
          nullif(btrim(coalesce(p_evidence, '')), ''), p_lead_id, p_by)
  returning id into v_id;

  v_hit := p_tps or p_ctps;
  if v_hit then
    insert into public.marketing_suppression
      (channel, identifier, scope, reason, source_lead_id, source_company, evidence, suppressed_by)
    values ('phone', v_phone, 'address', 'tps_ctps', p_lead_id,
            (select l.company from public.sales_leads l where l.id = p_lead_id),
            format('On the %s, checked %s by %s',
                   case when p_tps and p_ctps then 'TPS and the CTPS' when p_tps then 'TPS' else 'CTPS' end,
                   to_char(p_checked_at at time zone 'Europe/London', 'YYYY-MM-DD'), btrim(p_provider)),
            p_by)
    on conflict (channel, scope, identifier) do nothing;
  end if;

  return jsonb_build_object(
    'id', v_id, 'phone', v_phone, 'tps', p_tps, 'ctps', p_ctps, 'checked_at', p_checked_at,
    'clear', not v_hit,
    'clear_until', case when not v_hit then p_checked_at + interval '28 days' end);
end
$fn$;
revoke all on function public.phone_screening_write(text, boolean, boolean, text, text, timestamptz, text, uuid, uuid)
  from public, anon, authenticated;

-- A person who looked the number up on a checker's own site, by hand. What
-- they record is theirs: their name goes on it.
create or replace function public.phone_screening_record_by_hand(
  p_phone text, p_tps boolean, p_ctps boolean, p_provider text,
  p_checked_at timestamptz default now(), p_evidence text default null, p_lead_id uuid default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_catalog as $fn$
begin
  if auth.uid() is null then raise exception 'a check made by hand is recorded by the person who made it'; end if;
  return public.phone_screening_write(p_phone, p_tps, p_ctps, p_provider, 'by_hand',
                                      p_checked_at, p_evidence, p_lead_id, auth.uid());
end
$fn$;
revoke all on function public.phone_screening_record_by_hand(text, boolean, boolean, text, timestamptz, text, uuid) from public, anon;
grant execute on function public.phone_screening_record_by_hand(text, boolean, boolean, text, timestamptz, text, uuid) to authenticated;

-- The tps-check edge function, having asked a screening service and checked
-- who is signing in. Service role only.
create or replace function public.phone_screening_record_api(
  p_phone text, p_tps boolean, p_ctps boolean, p_provider text,
  p_evidence text, p_lead_id uuid, p_by uuid)
returns jsonb language sql security definer
set search_path = public, pg_catalog as $fn$
  select public.phone_screening_write(p_phone, p_tps, p_ctps, p_provider, 'api', now(), p_evidence, p_lead_id, p_by)
$fn$;
revoke all on function public.phone_screening_record_api(text, boolean, boolean, text, text, uuid, uuid) from public, anon, authenticated;

-- How many checks a provider has been asked for this calendar month, so the
-- edge function stays inside a free allowance.
create or replace function public.phone_screening_api_used(p_provider text)
returns integer language sql stable security definer
set search_path = public, pg_catalog as $fn$
  select count(*)::integer from public.phone_screening
   where method = 'api' and provider = p_provider
     and recorded_at >= date_trunc('month', now() at time zone 'Europe/London') at time zone 'Europe/London'
$fn$;
revoke all on function public.phone_screening_api_used(text) from public, anon, authenticated;

-- ---------- what the CRM shows ----------

-- "clear" here means clear to call as far as the number goes: screened clear
-- within 28 days and not on our suppression list. The lead's own permissions
-- are the gate's to judge when the call is recorded.
create or replace function public.phone_screening_status(p_phones text[])
returns jsonb language sql stable security definer
set search_path = public, pg_catalog as $fn$
  select coalesce(jsonb_agg(jsonb_build_object(
      'input', q.input, 'phone', q.phone,
      'checked_at', s.checked_at, 'provider', s.provider, 'method', s.method,
      'tps', s.tps, 'ctps', s.ctps,
      'screened_clear', q.screened,
      'suppressed', q.suppressed,
      'clear', q.screened and not q.suppressed,
      'clear_until', case when q.screened and not q.suppressed then s.checked_at + interval '28 days' end
    ) order by q.ord), '[]'::jsonb)
  from (select x as input, public.phone_e164(x) as phone, o as ord,
               coalesce(public.phone_screen_clear(x), false) as screened,
               exists (select 1 from public.marketing_suppression m
                        where m.channel = 'phone' and m.scope = 'address'
                          and public.phone_e164(m.identifier) = public.phone_e164(x)) as suppressed
          from unnest(coalesce(p_phones, '{}')) with ordinality as u(x, o)
         limit 100) q
  left join lateral (
    select * from public.phone_screening s
     where s.phone = q.phone
     order by s.checked_at desc, s.recorded_at desc limit 1) s on true
$fn$;
revoke all on function public.phone_screening_status(text[]) from public, anon;
grant execute on function public.phone_screening_status(text[]) to authenticated;

-- ---------- a sole trader may be permitted on legitimate interests ----------
-- This constraint said a non-company could be "permitted" only on consent or
-- with no personal data at all. That is PECR regulation 22, which is about
-- email, and it sat on the lead rather than the channel: a sole trader could
-- never be called on legitimate interests, which is exactly the basis a
-- screened live call rests on (regulation 21). The email rule is not lost:
-- the email branch of marketing_send_allowed refuses anyone who is not a
-- company without consent, whatever this constraint allows, and a lead on
-- legitimate interests still needs its assessment on file
-- (sales_leads_li_needs_assessment).

alter table public.sales_leads drop constraint if exists sales_leads_permitted_needs_a_basis;
alter table public.sales_leads add constraint sales_leads_permitted_needs_a_basis check (
  marketing_status <> 'permitted'
  or subscriber_type = 'corporate'
  or lawful_basis in ('consent', 'not_personal_data', 'legitimate_interests'));

-- ---------- the gate: phone opens, on these terms ----------

create or replace function public.marketing_send_allowed(p_lead_id uuid, p_channel text, p_recipient text)
returns boolean language sql stable security definer
set search_path = public, pg_catalog as $fn$
  -- A number is compared as E.164 whatever way it was typed, so "0115 496
  -- 0999" and "+441154960999" are one number to the suppression list too.
  with target as (
    select case when p_channel = 'phone' then coalesce(public.phone_e164(p_recipient), lower(btrim(p_recipient)))
                else lower(btrim(p_recipient)) end as addr),
  blocked as (
    select max(s.suppressed_at) as at
    from public.marketing_suppression s, target t
    where s.channel = p_channel
      and ((s.scope = 'address'         and (lower(btrim(s.identifier)) = t.addr
                                             or (p_channel = 'phone' and public.phone_e164(s.identifier) = t.addr)))
        or (s.scope = 'domain'       and t.addr like '%@' || lower(btrim(s.identifier)))
        or (s.scope = 'organisation' and s.source_lead_id = p_lead_id))
  ),
  reconsent as (
    select max(c.given_at) as at
    from public.marketing_consent c, target t
    where c.channel = p_channel
      and (lower(btrim(c.identifier)) = t.addr
           or (p_channel = 'phone' and public.phone_e164(c.identifier) = t.addr))
  )
  select
    exists (
      select 1 from public.sales_leads l
      where l.id = p_lead_id
        -- True of every channel. An objection is absolute in any medium.
        and l.opt_out = false
        and l.marketing_status = 'permitted'
        and l.privacy_notice_status <> 'not_given'
        and l.lawful_basis <> 'unassessed'
        -- not_personal_data is only honest while no person is in the record.
        and not (l.lawful_basis = 'not_personal_data' and public.has_named_individual(l.id))
        and (
          case p_channel
            -- PECR reg 22: corporate subscribers may be emailed without
            -- consent, individual subscribers may not, unknown counts as
            -- individual.
            when 'email' then
              l.subscriber_type <> 'unknown'
              and (l.subscriber_type = 'corporate' or l.lawful_basis = 'consent')
            -- Post is outside PECR, so subscriber type is not the question.
            when 'post' then
              l.lawful_basis in ('not_personal_data', 'legitimate_interests', 'consent', 'contract')
            -- PECR reg 21: a live call only to a number checked against both
            -- the TPS and the CTPS within 28 days and found on neither. A sole
            -- trader's number is their personal data, so "no personal data"
            -- is a basis only for a company.
            when 'phone' then
              public.phone_e164(p_recipient) is not null
              and public.phone_screen_clear(p_recipient)
              and (l.lawful_basis in ('legitimate_interests', 'consent', 'contract')
                   or (l.lawful_basis = 'not_personal_data' and l.subscriber_type = 'corporate'))
            -- A form is someone contacting us, not an outbound channel.
            else false
          end
        )
    )
    and (
      (select at from blocked) is null
      -- coalesce: a NULL answer from a gate is read as permission by anything
      -- that does not expect it.
      or coalesce((select at from reconsent) > (select at from blocked), false)
    );
$fn$;
revoke all on function public.marketing_send_allowed(uuid, text, text) from public, anon;
grant execute on function public.marketing_send_allowed(uuid, text, text) to authenticated;

-- ---------- how many calls a month ----------
-- Hard-coded, like email and post: going past it should take a new
-- assessment and a migration, not an UPDATE. 50 first calls a month, one
-- allowance across every tier, is what a person makes alongside everything
-- else and what one free screening allowance covers
-- (business/07-crm/phone-marketing-assessment-2026-09.md section 6).

create or replace function public.marketing_monthly_ceiling(p_channel text, p_tier text)
returns integer
language sql
immutable
set search_path = pg_catalog
as $fn$
  select case
    when p_channel = 'post' then 1000        -- PMA-2026-08-v1 s.6, ours not the law's
    when p_channel = 'phone' then 50         -- PHA-2026-09 s.6, shared by every tier
    when p_channel <> 'email' then 0         -- a form is inbound, not marketing
    when p_tier = 'A' then 2000              -- LIA-2026-08-v2 s.6
    when p_tier = 'B' then 400               -- LIA-2026-08-v2 s.6
    else 0
  end;
$fn$;

create or replace function public.marketing_ceiling_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
declare
  v_tier text; v_first boolean; v_spent integer; v_ceiling integer; v_basis text;
begin
  v_tier := public.marketing_tier(new.lead_id);
  v_first := not exists (
    select 1 from public.marketing_sends s
    where s.lead_id = new.lead_id and s.channel = new.channel
  );
  if v_tier is null then
    raise exception 'no such lead: %', new.lead_id using errcode = 'check_violation';
  end if;
  new.tier := v_tier;
  new.is_first_contact := v_first;

  select l.lawful_basis into v_basis from public.sales_leads l where l.id = new.lead_id;

  -- Someone who consented asked to hear from us; no ceiling applies and their
  -- send spends none of one.
  if v_basis = 'consent' then
    new.counts_toward_ceiling := false;
    return new;
  end if;

  -- Tier C on email without consent is a lawfulness question, not a ceiling
  -- one; the compliance gate refuses it with the reason that fits.
  if new.channel = 'email' and v_tier = 'C' then
    new.counts_toward_ceiling := false;
    return new;
  end if;

  -- Calls: one allowance of first calls a month, whatever the tier. A second
  -- call to the same business is a follow-up, not an introduction.
  if new.channel = 'phone' then
    new.counts_toward_ceiling := v_first;
    if v_first then
      v_ceiling := public.marketing_monthly_ceiling('phone', v_tier);
      select count(distinct s.lead_id)::integer into v_spent
        from public.marketing_sends s
       where s.channel = 'phone' and s.counts_toward_ceiling
         and s.sent_at >= date_trunc('month', now())
         and s.sent_at < date_trunc('month', now()) + interval '1 month';
      if v_spent >= v_ceiling then
        raise exception
          'monthly ceiling reached: phone allows % first calls per month, % already made (lead %)',
          v_ceiling, v_spent, new.lead_id
          using errcode = 'check_violation';
      end if;
    end if;
    return new;
  end if;

  -- A form is inbound: there is nothing to cap.
  if new.channel not in ('email', 'post') then
    new.counts_toward_ceiling := false;
    return new;
  end if;

  new.counts_toward_ceiling := v_first;

  if v_first then
    v_ceiling := public.marketing_monthly_ceiling(new.channel, v_tier);
    v_spent   := public.marketing_first_contacts_this_month(new.channel, v_tier);
    if coalesce(v_spent, 0) >= coalesce(v_ceiling, 0) then
      raise exception
        'monthly ceiling reached: % tier % allows % first contacts per month, % already sent (lead %)',
        new.channel, v_tier, v_ceiling, v_spent, new.lead_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$fn$;

revoke all on function public.marketing_monthly_ceiling(text, text) from public, anon;
grant execute on function public.marketing_monthly_ceiling(text, text) to authenticated;
revoke all on function public.marketing_ceiling_guard() from public, anon, authenticated;
revoke all on function public.phone_screening_append_only() from public, anon, authenticated;

revoke all on function public.phone_e164(text) from public, anon;
grant execute on function public.phone_e164(text) to authenticated;
revoke all on function public.phone_screen_clear(text) from public, anon;
grant execute on function public.phone_screen_clear(text) to authenticated;
