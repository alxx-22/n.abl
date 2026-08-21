-- Monthly first-contact ceilings, per PECR/UK GDPR tier.
--
-- LIA-2026-08-v2 raises the contact ceiling from 200 a month to 2,400, split
-- across three tiers, on the reasoning that most register-sourced candidates
-- are companies rather than people and so never engage UK GDPR at all. That
-- assessment lists the ceiling as its eighth safeguard and then says plainly
-- that until it is enforced here it is an intention rather than a safeguard,
-- and that sending stays at v1's 200 until it is. This migration is what
-- turns it into a control.
--
-- The tier is stamped on the send row rather than recomputed at read time. A
-- lead's tier can change — the moment we learn a director's name, a Tier A
-- record becomes Tier B — and a count that moved retroactively would make the
-- ceiling meaningless and the audit trail worse.

-- ---------------------------------------------------------------------------
-- 1. Tier, derived from what we actually hold about the recipient
-- ---------------------------------------------------------------------------

create or replace function public.marketing_tier(p_lead_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select case
    -- Not a corporate subscriber, or we cannot show that it is one. PECR
    -- regulation 22 applies in full and we have no consent. Unknown is not
    -- permission, which is why this is the first branch and not the last.
    when l.subscriber_type is distinct from 'corporate' then 'C'

    -- A corporate subscriber, but we hold a natural person's name against it.
    -- That name is personal data in a professional capacity, UK GDPR is
    -- engaged, and the legitimate interests balance in LIA-2026-08-v2 s.6
    -- applies. A blank or whitespace name does not count as holding one.
    when exists (
      select 1 from public.sales_contacts c
      where c.lead_id = l.id and btrim(coalesce(c.name, '')) <> ''
    ) then 'B'

    -- A company, contacted at a company address, with no person in the record.
    -- No personal data, so no lawful basis to establish; regulation 23 and the
    -- ceiling below are what constrain it.
    else 'A'
  end
  from public.sales_leads l
  where l.id = p_lead_id;
$$;

comment on function public.marketing_tier(uuid) is
  'PECR/UK GDPR tier for a lead: C individual subscriber (never contactable), '
  'B corporate with a named individual, A corporate with no personal data. '
  'See business/07-crm/lia-2026-08-v2.md section 2.';

-- ---------------------------------------------------------------------------
-- 2. The ceilings
-- ---------------------------------------------------------------------------
-- Hard-coded rather than held in a settings table, deliberately. LIA-2026-08-v2
-- section 6 says exceeding a ceiling should require someone to write a v3, not
-- to change a value. A migration is a visible decision; an UPDATE is a drift.

create or replace function public.marketing_monthly_ceiling(p_tier text)
returns integer
language sql
immutable
as $$
  select case p_tier
    when 'A' then 2000   -- LIA-2026-08-v2 s.6. Not a data protection limit:
                         -- UK GDPR is not engaged. Set by reg 23, honesty and
                         -- the cost of a systematic misclassification.
    when 'B' then 400    -- LIA-2026-08-v2 s.6, doubled from v1's 200 on the
                         -- strength of the sourcing, not on a softer balance.
    else 0               -- Tier C, and anything unrecognised.
  end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Stamp the tier on the send
-- ---------------------------------------------------------------------------

alter table public.marketing_sends
  add column if not exists tier text
    check (tier is null or tier in ('A', 'B', 'C')),
  -- Whether this send was the lead's first. Also stamped rather than derived:
  -- the ceiling counts first contacts, and "was this the first" is a fact
  -- about the moment of sending that later sends must not be able to change.
  add column if not exists is_first_contact boolean,

  -- Whether this send spent any of the tier's monthly allowance. A consented
  -- recipient is exempt from the ceiling, so their send must not also be
  -- counted against it: otherwise 400 people who asked to hear from us would
  -- consume the whole legitimate interests allowance and the two programmes
  -- would compete for the same budget. Stamped for the same reason as the
  -- others — a lead's lawful basis can change, and a count that moved with it
  -- would rewrite what was already spent.
  add column if not exists counts_toward_ceiling boolean;

create index if not exists marketing_sends_tier_month_idx
  on public.marketing_sends (tier, sent_at)
  where counts_toward_ceiling;

-- ---------------------------------------------------------------------------
-- 4. How many first contacts this tier has spent this calendar month
-- ---------------------------------------------------------------------------

create or replace function public.marketing_first_contacts_this_month(p_tier text)
returns integer
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select count(distinct s.lead_id)::integer
  from public.marketing_sends s
  where s.tier = p_tier
    and s.counts_toward_ceiling
    and s.sent_at >= date_trunc('month', now())
    and s.sent_at < date_trunc('month', now()) + interval '1 month';
$$;

-- ---------------------------------------------------------------------------
-- 5. The gate
-- ---------------------------------------------------------------------------
-- Runs BEFORE INSERT alongside marketing_sends_guard. Order matters only in
-- that both must pass; this one sets NEW.tier and NEW.is_first_contact, so it
-- is named to sort first and the compliance gate keeps its own trigger.

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
begin
  v_tier := public.marketing_tier(new.lead_id);

  -- A first contact is one to a lead we have never sent to. Not "not sent to
  -- this month" — a lead contacted in March and again in April spends no
  -- April allowance, because April is not an introduction. Stamped on every
  -- row, including the ones no ceiling applies to, so the count stays honest
  -- if a lead's basis or tier changes later.
  v_first := not exists (
    select 1 from public.marketing_sends s where s.lead_id = new.lead_id
  );

  -- A lead id that matches no lead returns NULL from marketing_tier, and NULL
  -- is not a tier. Refuse rather than let the coalesce below quietly pick one.
  if v_tier is null then
    raise exception 'no such lead: %', new.lead_id
      using errcode = 'check_violation';
  end if;

  new.tier := v_tier;

  -- A ceiling is a limit on how far we push ourselves onto people who did not
  -- ask. Someone who consented did ask, so no ceiling applies to them, and a
  -- consented sole trader is lawful to email under PECR regulation 22 despite
  -- being tier C. Capping them at tier C's zero would refuse a send that both
  -- assessments allow, which the harness caught. The compliance gate still has
  -- the final word on whether the consent is real.
  if (select l.lawful_basis from public.sales_leads l where l.id = new.lead_id) = 'consent' then
    new.is_first_contact := v_first;
    new.counts_toward_ceiling := false;
    return new;
  end if;

  -- Tier C without consent is not a ceiling question, it is a lawfulness one,
  -- and marketing_send_allowed already refuses it with the reason that fits.
  -- Raising "monthly ceiling reached: tier C allows 0" here would be true and
  -- useless. Stamp the row and let the compliance gate speak.
  if v_tier = 'C' then
    new.is_first_contact := v_first;
    new.counts_toward_ceiling := false;
    return new;
  end if;

  new.is_first_contact := v_first;
  new.counts_toward_ceiling := v_first;

  if v_first then
    v_ceiling := public.marketing_monthly_ceiling(v_tier);
    v_spent   := public.marketing_first_contacts_this_month(v_tier);

    -- >= because the row being inserted is not counted yet: at spent = ceiling
    -- this send would be the one over.
    --
    -- One row trigger is enough, including for a multi-row INSERT. A first
    -- draft added a second, statement-level guard on the belief that a query
    -- inside a row trigger runs on the command's snapshot and so cannot see
    -- rows inserted by the same command — which would have let a single
    -- `insert ... select` walk straight over the ceiling. Measured rather than
    -- assumed: with the statement guard removed, a 50-row bulk insert over the
    -- ceiling is still refused here, on the row that crosses it. The belief was
    -- wrong and the second guard was deleted rather than left in with a comment
    -- that misdescribes why it exists.
    if coalesce(v_spent, 0) >= coalesce(v_ceiling, 0) then
      raise exception
        'monthly ceiling reached: tier % allows % first contacts per month, % already sent (lead %)',
        v_tier, v_ceiling, v_spent, new.lead_id
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists marketing_sends_ceiling on public.marketing_sends;
create trigger marketing_sends_ceiling
before insert on public.marketing_sends
for each row execute function public.marketing_ceiling_guard();

-- ---------------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------------
-- Supabase's default privileges grant EXECUTE on new functions to anon as well
-- as authenticated, so REVOKE FROM PUBLIC is not enough on its own. Each
-- function is revoked from anon by name, the same fix as
-- 202608200001_revoke_anon_execute_on_compliance_functions.sql.

revoke all on function public.marketing_tier(uuid) from public, anon, authenticated;
revoke all on function public.marketing_monthly_ceiling(text) from public, anon, authenticated;
revoke all on function public.marketing_first_contacts_this_month(text) from public, anon, authenticated;
revoke all on function public.marketing_ceiling_guard() from public, anon, authenticated;

grant execute on function public.marketing_tier(uuid) to authenticated;
grant execute on function public.marketing_monthly_ceiling(text) to authenticated;
grant execute on function public.marketing_first_contacts_this_month(text) to authenticated;
