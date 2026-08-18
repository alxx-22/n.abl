-- =====================================================================
-- n.abl — CRM compliance schema
-- ---------------------------------------------------------------------
-- Adds the fields, tables and constraints that decide who may lawfully
-- be contacted, and the gate that enforces it at the send path.
--
-- Specified in business/07-crm/compliance-schema.md. Read section 2 of
-- that file before changing anything here: the constraints encode the
-- ICO position on corporate subscribers versus sole traders, and
-- loosening one is a legal decision, not a schema tidy-up.
--
-- Additive: nothing is dropped and no existing column changes type.
-- Idempotent: safe to re-run.
--
-- The defaults are deliberately restrictive. Every existing lead lands
-- on do_not_contact / unassessed / unknown and has to be assessed by
-- hand before it can be marketed to. That is the intended outcome, not
-- an inconvenience to be backfilled away.
--
-- STATUS: WRITTEN, NOT YET APPLIED. Apply it against a branch or a
-- scratch project first and run scripts/check-compliance-schema.mjs.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Compliance fields on the lead
-- ---------------------------------------------------------------------
alter table public.sales_leads
  -- Which PECR rules apply. Resolved against Companies House where the
  -- website does not say. 'unknown' can never be marketed to.
  add column if not exists subscriber_type text not null default 'unknown'
    check (subscriber_type in (
      'corporate',        -- ltd, plc, LLP, Scottish partnership, public body
      'sole_trader',      -- individual subscriber under PECR
      'partnership',      -- non-LLP; individual subscriber outside Scotland
      'individual',       -- a private person
      'unknown'
    )),
  add column if not exists subscriber_type_evidence text,
  add column if not exists subscriber_type_checked_at timestamptz,

  -- The UK GDPR question, recorded at the point of adding the record
  -- rather than reconstructed afterwards.
  add column if not exists lawful_basis text not null default 'unassessed'
    check (lawful_basis in (
      'legitimate_interests',
      'consent',
      'contract',
      'unassessed'
    )),
  add column if not exists lia_ref text,
  add column if not exists lia_completed_at timestamptz,

  -- Provenance. Free text is fine for the detail; the category is not.
  add column if not exists source text
    check (source is null or source in (
      'companies_house',
      'own_website',
      'industry_directory',
      'local_directory',
      'council_directory',
      'public_company_information',
      'licensed_dataset',
      'referral',
      'inbound_enquiry',
      'event',
      'manual_research'
    )),
  add column if not exists source_detail text,
  add column if not exists source_date date,

  -- Article 14 transparency. Recorded, not assumed.
  add column if not exists privacy_notice_status text not null default 'not_given'
    check (privacy_notice_status in (
      'not_given',
      'given_at_first_contact',
      'given_on_request',
      'not_required'                      -- inbound enquiry only
    )),
  add column if not exists privacy_notice_given_at timestamptz,

  -- The current permitted state. Default is the safe one.
  add column if not exists marketing_status text not null default 'do_not_contact'
    check (marketing_status in (
      'do_not_contact',
      'permitted',
      'paused',
      'opted_out'
    )),

  -- Set once. An import must never clear this.
  add column if not exists opt_out boolean not null default false,
  add column if not exists opt_out_at timestamptz,
  add column if not exists opt_out_channel text,
  add column if not exists opt_out_note text,

  add column if not exists retention_review_due date;

-- ---------------------------------------------------------------------
-- 2. Constraints: make the illegal states unrepresentable
-- ---------------------------------------------------------------------

-- An opt-out is a fact with a timestamp, and it forces the status.
alter table public.sales_leads
  drop constraint if exists sales_leads_optout_consistent;
alter table public.sales_leads
  add constraint sales_leads_optout_consistent check (
    (opt_out = false and opt_out_at is null)
    or (opt_out = true and opt_out_at is not null and marketing_status = 'opted_out')
  );

-- 'permitted' is only reachable with the paperwork actually filled in.
alter table public.sales_leads
  drop constraint if exists sales_leads_permitted_is_documented;
alter table public.sales_leads
  add constraint sales_leads_permitted_is_documented check (
    marketing_status <> 'permitted'
    or (
      subscriber_type <> 'unknown'
      and lawful_basis <> 'unassessed'
      and source is not null
      and source_date is not null
      and opt_out = false
    )
  );

-- PECR, in one constraint. An individual subscriber needs consent;
-- legitimate interests does not unlock electronic mail marketing to
-- a sole trader, a non-LLP partnership or a private individual.
alter table public.sales_leads
  drop constraint if exists sales_leads_pecr_individual_needs_consent;
alter table public.sales_leads
  add constraint sales_leads_pecr_individual_needs_consent check (
    marketing_status <> 'permitted'
    or subscriber_type = 'corporate'
    or lawful_basis = 'consent'
  );

-- Relying on legitimate interests requires an assessment on file.
alter table public.sales_leads
  drop constraint if exists sales_leads_li_needs_assessment;
alter table public.sales_leads
  add constraint sales_leads_li_needs_assessment check (
    lawful_basis <> 'legitimate_interests'
    or (lia_ref is not null and lia_completed_at is not null)
  );

-- ---------------------------------------------------------------------
-- 3. Per-contact state. The lead is the organisation; the opt-out is
--    exercised by a person, against one address.
-- ---------------------------------------------------------------------
alter table public.sales_contacts
  add column if not exists email_normalised text
    generated always as (nullif(lower(btrim(email)), '')) stored,
  add column if not exists contact_marketing_status text not null default 'do_not_contact'
    check (contact_marketing_status in ('do_not_contact', 'permitted', 'paused', 'opted_out')),
  add column if not exists opt_out boolean not null default false,
  add column if not exists opt_out_at timestamptz,
  add column if not exists source_date date;

create index if not exists sales_contacts_email_normalised_idx
  on public.sales_contacts (email_normalised);

-- ---------------------------------------------------------------------
-- 4. The suppression list.
--
--    NOT a child of sales_leads. No foreign key, so no cascade can ever
--    remove it when a lead is deleted. Keyed on the normalised address,
--    because the address is what gets contacted again.
-- ---------------------------------------------------------------------
create table if not exists public.marketing_suppression (
  id uuid primary key default gen_random_uuid(),

  channel text not null
    check (channel in ('email', 'phone', 'post', 'form')),

  identifier text not null check (btrim(identifier) <> ''),

  -- 'address'      this mailbox or number
  -- 'domain'       everyone at this domain
  -- 'organisation' this business, by recorded lead id
  scope text not null default 'address'
    check (scope in ('address', 'domain', 'organisation')),

  reason text not null
    check (reason in (
      'opt_out_link',
      'reply_asking_to_stop',
      'phone_request',
      'hard_bounce',
      'complaint',
      'tps_ctps',
      'do_not_contact_request',
      'manual'
    )),

  -- Plain uuid, deliberately not a foreign key. Keeping the link is
  -- useful; letting a lead deletion touch this row is not.
  source_lead_id uuid,
  source_company text,
  evidence text,

  suppressed_at timestamptz not null default now(),
  suppressed_by uuid references auth.users(id) on delete set null,

  unique (channel, scope, identifier)
);

create index if not exists marketing_suppression_lookup_idx
  on public.marketing_suppression (channel, identifier);

-- Append-only, enforced below the interface. This blocks the table
-- owner and the service role too, which is the entire point.
--
-- Correcting a mistaken row therefore needs a deliberate, logged
-- superuser action: disable the trigger, fix it, re-enable it, and
-- write down why. That friction is intentional.
create or replace function public.marketing_suppression_append_only()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  raise exception
    'marketing_suppression is append-only: % is not permitted', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists marketing_suppression_no_change on public.marketing_suppression;
create trigger marketing_suppression_no_change
before update or delete on public.marketing_suppression
for each row execute function public.marketing_suppression_append_only();

-- ---------------------------------------------------------------------
-- 5. Re-consent, for the one case where suppression is not the end of
--    the story: somebody who opted out later asks to hear from us.
--    The suppression row still stands. This sits beside it, dated, with
--    evidence, and the gate at 7 only honours it if it is later.
-- ---------------------------------------------------------------------
create table if not exists public.marketing_consent (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email', 'phone', 'post', 'form')),
  identifier text not null check (btrim(identifier) <> ''),
  given_at timestamptz not null,
  evidence text not null check (btrim(evidence) <> ''),
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists marketing_consent_lookup_idx
  on public.marketing_consent (channel, identifier, given_at desc);

-- ---------------------------------------------------------------------
-- 6. What was sent, when, to whom, by whom.
--
--    Its own table, on purpose. sales_activities is wiped and rewritten
--    wholesale on every lead save by the current front end, so it cannot
--    hold anything that has to survive. ON DELETE SET NULL, not CASCADE:
--    deleting a lead must not delete the record that we contacted them.
-- ---------------------------------------------------------------------
create table if not exists public.marketing_sends (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.sales_leads(id) on delete set null,
  contact_id uuid references public.sales_contacts(id) on delete set null,

  channel text not null check (channel in ('email', 'phone', 'post', 'form')),
  recipient text not null,
  subject text,
  body_hash text,

  -- Both required on every marketing message, every channel, every time.
  opt_out_included boolean not null,
  sender_identity text not null check (btrim(sender_identity) <> ''),

  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz not null,
  sent_at timestamptz not null default now(),
  send_provider text,

  outcome text not null default 'sent'
    check (outcome in ('sent', 'hard_bounce', 'soft_bounce', 'replied',
                       'opted_out', 'complaint')),

  -- A message with no opt-out route cannot be recorded, therefore
  -- cannot be sent through any path that records.
  constraint marketing_sends_opt_out_required check (opt_out_included)
);

create index if not exists marketing_sends_recipient_idx
  on public.marketing_sends (channel, lower(btrim(recipient)), sent_at desc);
create index if not exists marketing_sends_lead_idx
  on public.marketing_sends (lead_id, sent_at desc);

-- ---------------------------------------------------------------------
-- 7. The gate. One function. Everything that sends asks this.
-- ---------------------------------------------------------------------
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
        and l.opt_out = false
        and l.marketing_status = 'permitted'
        and l.privacy_notice_status <> 'not_given'
        and l.subscriber_type <> 'unknown'
        and l.lawful_basis <> 'unassessed'
        and (l.subscriber_type = 'corporate' or l.lawful_basis = 'consent')
    )
    and (
      (select at from blocked) is null
      -- coalesce, because a suppressed address with no re-consent makes this
      -- comparison NULL rather than false: NULL > timestamp is NULL, and
      -- `false or NULL` is NULL. The function would then return NULL, the
      -- guard's `if not NULL then` would not fire, and the send would be
      -- allowed. A gate must fail closed, so the uncertainty is resolved to
      -- "not permitted" here rather than left to the caller.
      or coalesce((select at from reconsent) > (select at from blocked), false)
    );
$$;

-- The block itself. Not a warning, not a filter someone might forget.
create or replace function public.marketing_sends_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- coalesce again, deliberately. The function above is written not to
  -- return NULL, but this is the last thing between a draft and a send:
  -- if it ever does, the answer here is no.
  if not coalesce(public.marketing_send_allowed(new.lead_id, new.channel, new.recipient), false) then
    raise exception
      'blocked by compliance gate: % on channel % is not permitted (lead %)',
      new.recipient, new.channel, new.lead_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists marketing_sends_gate on public.marketing_sends;
create trigger marketing_sends_gate
before insert on public.marketing_sends
for each row execute function public.marketing_sends_guard();

-- An opt-out anywhere writes the lead state too, so the CRM shows it.
create or replace function public.apply_opt_out(
  p_lead_id uuid,
  p_channel text,
  p_identifier text,
  p_reason text,
  p_evidence text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.marketing_suppression
    (channel, identifier, scope, reason, source_lead_id, evidence, suppressed_by)
  values
    (p_channel, lower(btrim(p_identifier)), 'address', p_reason, p_lead_id,
     p_evidence, auth.uid())
  on conflict (channel, scope, identifier) do nothing;

  update public.sales_leads
     set opt_out = true,
         opt_out_at = coalesce(opt_out_at, now()),
         opt_out_channel = p_channel,
         marketing_status = 'opted_out'
   where id = p_lead_id;

  update public.sales_contacts
     set opt_out = true,
         opt_out_at = coalesce(opt_out_at, now()),
         contact_marketing_status = 'opted_out'
   where lead_id = p_lead_id
     and email_normalised = lower(btrim(p_identifier));
end;
$$;

-- ---------------------------------------------------------------------
-- 8. RLS. The team can read and add. Nobody can remove.
-- ---------------------------------------------------------------------
alter table public.marketing_suppression enable row level security;
alter table public.marketing_consent enable row level security;
alter table public.marketing_sends enable row level security;

drop policy if exists "team can read suppression" on public.marketing_suppression;
create policy "team can read suppression"
  on public.marketing_suppression for select to authenticated using (true);
drop policy if exists "team can add suppression" on public.marketing_suppression;
create policy "team can add suppression"
  on public.marketing_suppression for insert to authenticated with check (true);
-- No update policy and no delete policy. Absence is denial, and the
-- trigger at 4 catches anything that gets past RLS.

drop policy if exists "team can read consent" on public.marketing_consent;
create policy "team can read consent"
  on public.marketing_consent for select to authenticated using (true);
drop policy if exists "team can add consent" on public.marketing_consent;
create policy "team can add consent"
  on public.marketing_consent for insert to authenticated with check (true);

drop policy if exists "team can read sends" on public.marketing_sends;
create policy "team can read sends"
  on public.marketing_sends for select to authenticated using (true);
drop policy if exists "team can add sends" on public.marketing_sends;
create policy "team can add sends"
  on public.marketing_sends for insert to authenticated with check (true);

-- ---------------------------------------------------------------------
-- 9. Grants.
--
--    NOT in the specification, and added because we have already been
--    bitten by exactly this: PostgreSQL grants EXECUTE on a new
--    function to PUBLIC by default, which is how
--    prune_portal_login_attempts ended up callable by anon over
--    /rest/v1/rpc (see 202608160001). Every function here is security
--    definer, so the default would hand an anonymous caller the ability
--    to write suppression rows and flip lead state.
--
--    Trigger functions are never invoked directly and get nothing.
-- ---------------------------------------------------------------------
revoke all on function public.marketing_suppression_append_only() from public;
revoke all on function public.marketing_sends_guard() from public;

revoke all on function public.marketing_send_allowed(uuid, text, text) from public;
grant execute on function public.marketing_send_allowed(uuid, text, text) to authenticated;

revoke all on function public.apply_opt_out(uuid, text, text, text, text) from public;
grant execute on function public.apply_opt_out(uuid, text, text, text, text) to authenticated;

-- NOTE on the public unsubscribe link. A recipient clicking "unsubscribe"
-- is not signed in, so they cannot reach apply_opt_out and must not be
-- given it: the argument list would let an anonymous caller flip the
-- state of any lead id they can guess. That path needs a separate,
-- token-scoped route — an Edge Function holding the service role and a
-- signed one-time token in the link. It is deliberately not in this
-- migration. Until it exists, opt-outs are recorded by hand by whoever
-- reads the reply, which is the current volume anyway.

commit;
