-- Postal marketing: a lawful basis that says there is no personal data, and a
-- send gate that knows which channel it is being asked about.
--
-- PMA-2026-08-v1 concludes that a letter addressed to a role — "The Owner",
-- "The Practice Manager" — identifies a building and a job rather than a
-- living individual, so UK GDPR is not engaged and post is outside PECR
-- entirely. No lawful basis is needed because there is no personal data to
-- have a basis for.
--
-- The schema could not express that. `lawful_basis` offered legitimate
-- interests, consent, contract or unassessed, and `unassessed` blocks the
-- send. Recording `legitimate_interests` instead would have been the easy fix
-- and a false statement: we would be claiming to rely on a balancing test we
-- do not rely on, for data protection law that does not apply. A compliance
-- record that says something untrue to satisfy a constraint is worse than no
-- record, because it looks like diligence.

-- ---------------------------------------------------------------------------
-- 1. The basis that is not a basis
-- ---------------------------------------------------------------------------

alter table public.sales_leads
  drop constraint if exists sales_leads_lawful_basis_check;

alter table public.sales_leads
  add constraint sales_leads_lawful_basis_check check (
    lawful_basis in (
      'legitimate_interests',
      'consent',
      'contract',
      -- No personal data is held, so UK GDPR is not engaged and no basis is
      -- required. Only honest where it is true, which is why the gate below
      -- refuses it the moment a person's name is attached. See PMA-2026-08-v1
      -- section 3.
      'not_personal_data',
      'unassessed'
    )
  );

-- ---------------------------------------------------------------------------
-- 1b. A PECR email rule was being enforced as a table-wide invariant
-- ---------------------------------------------------------------------------
-- `sales_leads_pecr_individual_needs_consent` refused to let a sole trader be
-- marked `permitted` without consent. That was right when email was the only
-- channel: regulation 22 does require consent to email an individual
-- subscriber. But `marketing_status` is not a channel, and post is outside
-- PECR — so the constraint refused a lead that is perfectly lawful to write
-- to, on the strength of a rule about a different medium.
--
-- The channel question moves to the gate, which is where it can actually be
-- asked. The constraint keeps doing the job it is good at: refusing a
-- permitted lead that has no basis recorded at all. Emailing a sole trader is
-- still refused, by marketing_send_allowed, and there is an assertion for it.

alter table public.sales_leads
  drop constraint if exists sales_leads_pecr_individual_needs_consent;

-- Dropped before it is added, like every other constraint here. Without this
-- the migration applies once and aborts on the second run, and because psql
-- stops at the first error everything below — including the new send gate —
-- silently never applies. The file then looks half-applied in a way that is
-- very hard to read back from the failures it causes.
alter table public.sales_leads
  drop constraint if exists sales_leads_permitted_needs_a_basis;

alter table public.sales_leads
  add constraint sales_leads_permitted_needs_a_basis check (
    marketing_status <> 'permitted'
    or subscriber_type = 'corporate'
    or lawful_basis in ('consent', 'not_personal_data')
  );

-- ---------------------------------------------------------------------------
-- 2. Is there a person in this record?
-- ---------------------------------------------------------------------------
-- Pulled out of marketing_tier so the gate and the tier ask the same question
-- of the same code. They had better not drift: one decides which rules apply
-- and the other decides whether to send.

create or replace function public.has_named_individual(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.sales_contacts c
    where c.lead_id = p_lead_id
      and btrim(coalesce(c.name, '')) <> ''
      -- A generic route is not a person. The extraction pipeline only ever
      -- keeps role addresses, but the CRM lets a human type anything, and the
      -- old AI CRM filled this column with the literal string below.
      and lower(btrim(c.name)) not in ('public contact route', 'general enquiries', 'enquiries', 'reception')
  );
$$;

create or replace function public.marketing_tier(p_lead_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select case
    when l.subscriber_type is distinct from 'corporate' then 'C'
    when public.has_named_individual(l.id) then 'B'
    else 'A'
  end
  from public.sales_leads l
  where l.id = p_lead_id;
$$;

-- ---------------------------------------------------------------------------
-- 3. Ceilings are per channel as well as per tier
-- ---------------------------------------------------------------------------
-- Post has no legal ceiling: UK GDPR is not engaged and PECR does not cover
-- it. PMA-2026-08-v1 section 6 sets one anyway, at 1,000 a month, for reasons
-- that are ours rather than the law's — post is the only channel here that
-- costs money, and a ceiling bounds how many envelopes a bad merge could
-- spoil before anyone notices.

create or replace function public.marketing_monthly_ceiling(p_channel text, p_tier text)
returns integer
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_channel = 'post' then 1000        -- PMA-2026-08-v1 s.6
    when p_channel <> 'email' then 0         -- phone needs TPS/CTPS screening
                                             -- we do not have; forms are not
                                             -- outbound marketing at all.
    when p_tier = 'A' then 2000              -- LIA-2026-08-v2 s.6
    when p_tier = 'B' then 400               -- LIA-2026-08-v2 s.6
    else 0
  end;
$$;

-- ---------------------------------------------------------------------------
-- 4. The gate, now channel-aware
-- ---------------------------------------------------------------------------
-- Everything that applied before still applies to email. What changes is that
-- the subscriber-type test is recognised as a PECR test, and PECR does not
-- reach post. A sole trader who cannot lawfully be emailed can lawfully be
-- sent a letter, and the old gate refused that on a rule that was never about
-- post.

create or replace function public.marketing_send_allowed(
  p_lead_id uuid,
  p_channel text,
  p_recipient text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with target as (
    select lower(btrim(p_recipient)) as addr
  ),
  blocked as (
    select max(s.suppressed_at) as at
    from public.marketing_suppression s, target t
    where s.channel = p_channel
      and (
        (s.scope = 'address'         and lower(btrim(s.identifier)) = t.addr)
        or (s.scope = 'domain'       and t.addr like '%@' || lower(btrim(s.identifier)))
        or (s.scope = 'organisation' and s.source_lead_id = p_lead_id)
      )
  ),
  reconsent as (
    select max(c.given_at) as at
    from public.marketing_consent c, target t
    where c.channel = p_channel
      and lower(btrim(c.identifier)) = t.addr
  )
  select
    exists (
      select 1
      from public.sales_leads l
      where l.id = p_lead_id
        -- True of every channel. An objection is absolute in any medium.
        and l.opt_out = false
        and l.marketing_status = 'permitted'
        and l.privacy_notice_status <> 'not_given'
        and l.lawful_basis <> 'unassessed'

        -- 'not_personal_data' is only honest while no person is in the record.
        -- The moment a name is attached, UK GDPR applies and a real basis is
        -- needed. Refusing here rather than trusting whoever set the column.
        and not (l.lawful_basis = 'not_personal_data'
                 and public.has_named_individual(l.id))

        and (
          case p_channel
            -- PECR regulation 22. Corporate subscribers may be emailed
            -- without consent; individual subscribers may not, and an
            -- unresolved subscriber type is treated as individual.
            when 'email' then
              l.subscriber_type <> 'unknown'
              and (l.subscriber_type = 'corporate' or l.lawful_basis = 'consent')

            -- Post is outside PECR, so subscriber type is not the question.
            -- What matters is that no personal data is being processed, or
            -- that a basis exists for the personal data that is.
            -- PMA-2026-08-v1 sections 3 and 5.
            when 'post' then
              l.lawful_basis in ('not_personal_data', 'legitimate_interests', 'consent', 'contract')

            -- Live calls are lawful to businesses under reg 21, but only
            -- after screening against BOTH the CTPS and the TPS. We hold no
            -- screening data, so there is nothing to check and the answer is
            -- no. This is not a placeholder to be relaxed casually: it is the
            -- one channel with an unavoidable cost attached.
            when 'phone' then false

            -- 'form' is someone contacting us. It is not an outbound channel.
            else false
          end
        )
    )
    and (
      (select at from blocked) is null
      -- coalesce, because a suppressed address with no re-consent makes this
      -- comparison NULL rather than false, and a NULL answer from a gate is
      -- read as permission by anything that does not expect it.
      or coalesce((select at from reconsent) > (select at from blocked), false)
    );
$$;

-- ---------------------------------------------------------------------------
-- 5. The ceiling guard follows the channel too
-- ---------------------------------------------------------------------------

create or replace function public.marketing_first_contacts_this_month(p_channel text, p_tier text)
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select count(distinct s.lead_id)::integer
  from public.marketing_sends s
  where s.channel = p_channel
    and s.tier is not distinct from p_tier
    and s.counts_toward_ceiling
    and s.sent_at >= date_trunc('month', now())
    and s.sent_at < date_trunc('month', now()) + interval '1 month';
$$;

create or replace function public.marketing_ceiling_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_tier    text;
  v_first   boolean;
  v_spent   integer;
  v_ceiling integer;
  v_basis   text;
begin
  v_tier := public.marketing_tier(new.lead_id);

  v_first := not exists (
    select 1 from public.marketing_sends s where s.lead_id = new.lead_id
      and s.channel = new.channel
  );

  if v_tier is null then
    raise exception 'no such lead: %', new.lead_id
      using errcode = 'check_violation';
  end if;

  new.tier := v_tier;
  new.is_first_contact := v_first;

  select l.lawful_basis into v_basis from public.sales_leads l where l.id = new.lead_id;

  -- Someone who consented asked to hear from us, so no ceiling applies and
  -- their send spends none of one. Counting them would let a consented
  -- audience crowd out the legitimate interests one.
  if v_basis = 'consent' then
    new.counts_toward_ceiling := false;
    return new;
  end if;

  -- Tier C on email without consent is a lawfulness question, not a ceiling
  -- one, and marketing_send_allowed refuses it with the reason that fits.
  if new.channel = 'email' and v_tier = 'C' then
    new.counts_toward_ceiling := false;
    return new;
  end if;

  -- Same reasoning for any channel that has no ceiling because it has no
  -- permission. Phone needs TPS and CTPS screening we do not have, and a form
  -- is inbound. Raising "monthly ceiling reached: phone tier C allows 0" would
  -- be true and would send whoever reads it looking for a volume problem that
  -- does not exist. Let the compliance gate give the real reason.
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
$$;

-- ---------------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------------
-- The two-argument forms replace one-argument ones, so the old signatures are
-- dropped rather than left executable alongside the new ones.

drop function if exists public.marketing_monthly_ceiling(text);
drop function if exists public.marketing_first_contacts_this_month(text);

revoke all on function public.has_named_individual(uuid) from public, anon, authenticated;
revoke all on function public.marketing_tier(uuid) from public, anon, authenticated;
revoke all on function public.marketing_monthly_ceiling(text, text) from public, anon, authenticated;
revoke all on function public.marketing_first_contacts_this_month(text, text) from public, anon, authenticated;
revoke all on function public.marketing_send_allowed(uuid, text, text) from public, anon, authenticated;
revoke all on function public.marketing_ceiling_guard() from public, anon, authenticated;

grant execute on function public.has_named_individual(uuid) to authenticated;
grant execute on function public.marketing_tier(uuid) to authenticated;
grant execute on function public.marketing_monthly_ceiling(text, text) to authenticated;
grant execute on function public.marketing_first_contacts_this_month(text, text) to authenticated;
grant execute on function public.marketing_send_allowed(uuid, text, text) to authenticated;
