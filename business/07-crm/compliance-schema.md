# CRM compliance schema

**Status: specified, not built.** Everything below is a design. No part of this
DDL has been written to a migration file and no part of it has been applied to
any database. A search of the repository for `subscriber_type`, `lawful_basis`,
`opt_out` or `suppression` returns nothing in the application or the migrations.

This document is not legal advice and has not been reviewed by a solicitor. It is
a reading of published ICO guidance on direct marketing and PECR, written by the
people building the system, and it will need checking against the current
guidance before the migration is applied. Where a point is genuinely uncertain it
is marked, rather than smoothed over.

---

## 1. Why this is schema and not policy

The master plan puts it in one line: a policy is something a person has to
remember, a database constraint is something the system cannot get wrong.

The practical version. At some point somebody will be tired, behind, and looking
at a list of two hundred businesses that all look like good prospects. The only
control that survives that moment is one that lives below the interface. So every
rule in this document that can be expressed as a `CHECK`, a trigger or a
`NOT NULL` default is expressed that way, and the interface is treated as a
convenience rather than a safeguard.

Three design rules follow from that.

**Fail closed.** The safe value is the column default. A new lead is
`do_not_contact` with `lawful_basis = 'unassessed'` until somebody does the work.
Nobody has to remember to lock a record; they have to do work to unlock it.

**Illegal states are unrepresentable.** A lead cannot be `permitted` with no
source recorded. An individual subscriber cannot be `permitted` for email
marketing on legitimate interests. These are constraints, so the database rejects
the row rather than the interface hiding a button.

**The send path is one function.** Everything that sends calls
`marketing_send_allowed()`, and a trigger on the send record calls it again. A
query someone forgets to filter is not a control.

---

## 2. The ICO position, as it applies to n.abl

Two separate bodies of law apply at once and they are commonly confused.

**PECR** governs the act of sending electronic marketing. It asks who the
*subscriber* is: the person or organisation that holds the line or the mailbox.

**UK GDPR** governs the personal data used to do it. It asks whether there is a
lawful basis for processing, whether the person was told, and whether they can
object.

A B2B email to a named person at a limited company can be entirely fine under
PECR and still unlawful under UK GDPR if there is no basis and no notice. Both
have to be satisfied. The schema therefore carries a field for each: one for the
PECR question (`subscriber_type`) and one for the UK GDPR question
(`lawful_basis`).

### 2.1 Corporate subscribers against sole traders and partnerships

This distinction decides which PECR rules apply, and it is the reason
`subscriber_type` exists as its own column rather than being inferred from the
company name.

The ICO's position, as published in its direct marketing guidance:

| Treated as a **corporate subscriber** | Treated as an **individual subscriber** |
|---|---|
| Limited companies | Sole traders |
| Limited liability partnerships (LLPs) | Non-LLP partnerships in England, Wales and Northern Ireland |
| Public limited companies | Private individuals |
| Scottish partnerships, which are legal persons in Scots law | |
| Other corporate bodies, government departments and public bodies | |

For **corporate subscribers**, unsolicited B2B electronic marketing can generally
be sent without PECR consent. That is the whole basis of the outreach model in
the master plan, and it is a real and usable position.

It is not, however, a free pass. Three things still apply:

1. **Identity.** The sender must not conceal or disguise its identity, and must
   provide a valid address to which the recipient can send an opt-out request.
2. **The right to stop.** A corporate subscriber that asks not to be contacted
   again must not be contacted again.
3. **UK GDPR.** `firstname.lastname@company.co.uk` identifies a living
   individual. It is personal data, and the corporate-subscriber rule under PECR
   does nothing about that.

For **individual subscribers**, unsolicited electronic mail marketing needs
consent, or the narrow "soft opt-in" that applies where the address was obtained
in the course of a sale or negotiations for a sale of a similar product, an
opt-out was offered at that point, and an opt-out is offered in every message.

Cold outreach to a sole trader found through a directory meets neither. So the
practical rule for n.abl is blunt and is enforced in the schema:

> A sole trader, a non-LLP partnership outside Scotland, or a private individual
> is not emailed unless they have given consent. There is no third option and no
> judgement call to make at the keyboard.

**The uncertain part, marked as such.** A business's legal form is not always
obvious from a website. "Smith Joinery" may be a limited company, a sole trader
or a partnership. `subscriber_type` therefore defaults to `unknown`, `unknown`
cannot be marked permitted, and the resolution route is Companies House, which is
already the first source in the master plan's list. Where it cannot be resolved,
the honest value is `unknown` and the lead does not get emailed.

### 2.2 Legitimate interests, and the balancing test

For B2B direct marketing to corporate subscribers, legitimate interests is the
lawful basis that normally does the work. It is available, it is not a
formality, and it requires an assessment on file before it is relied on.

The three-part test, which is what the assessment has to answer:

1. **Purpose.** Is there a legitimate interest? Yes: direct marketing of a
   business service to other businesses that plausibly need it. The ICO
   recognises direct marketing as a legitimate interest.
2. **Necessity.** Is the processing necessary for that purpose? The honest
   answer has to address volume and targeting. Contacting 40 researched
   businesses that match a documented ideal client profile is a very different
   necessity argument from contacting 10,000 scraped addresses. The master plan's
   research-before-sending sequence is not only a quality decision, it is what
   makes this limb answerable.
3. **Balance.** Do the individual's interests, rights and freedoms override it?
   The factors that matter here: the data is business contact data used in a
   business context, it was obtained from sources the business itself published
   or filed publicly, the volume is low, the content is relevant to what the
   business does, the person is told at first contact, and opting out is one
   click.

The assessment has to be written down before any record is marked
`legitimate_interests`. The schema records `lia_ref` and `lia_completed_at` per
lead so that a record can point at the assessment it was added under, and so a
later change to the assessment does not silently rewrite history.

**Transparency.** Where personal data is obtained from somewhere other than the
individual, UK GDPR Article 14 requires a privacy notice within a reasonable
period and at the latest when the person is first communicated with. For n.abl
that means the notice goes in the first email, not later. `privacy_notice_status`
records it. `04-legal` has to publish a research and marketing section for the
first email to link to; today the privacy policy describes enquirers, clients and
staff, and does not describe leads at all.

**The right to object.** Under Article 21(2) the right to object to processing
for direct marketing is absolute. There is no balancing at that point, no
retention of the marketing permission, and no "we will pause you for six months".
It is a full stop, and in the schema it is a suppression row.

### 2.3 Opt-out on every message

Every marketing message, to every subscriber type, on every channel, carries:

- who it is from, plainly, with no disguised or concealed sender identity
- a valid address for opting out that does not cost anything to use
- a working opt-out route in the message itself

There is no volume below which this stops applying. A single hand-typed email
sent through the mail-client handoff needs it exactly as much as a batch of two
hundred would.

The schema makes this recordable and then makes it required: `marketing_sends`
has `opt_out_included` and `sender_identity`, both `NOT NULL`, with a table
constraint that refuses to record a send where `opt_out_included` is false. A
send with no opt-out route cannot be written to the log, which means it cannot be
sent through any path that logs, which is every path.

### 2.4 Telephone, briefly

The schema carries a `channel` because the CRM already stores phone numbers and
contact-form URLs, and the rules differ.

Live marketing calls must be screened against the TPS for individual subscribers
and the CTPS for corporate subscribers, as well as against our own suppression
list, and must not be made to anyone who has told us not to call. The schema
supports this by making `channel` part of the suppression key and by allowing a
`tps_ctps` suppression reason. It does not implement screening. If phone outreach
is ever actually done, screening is a separate piece of work and this document
does not cover it.

### 2.5 The suppression list, and why it is never deleted from

This looks like a contradiction and is not, so it is worth stating clearly.

Somebody objects to marketing. Honouring that objection permanently requires
remembering who they are. If the record is deleted, the next time the same
business appears in a directory it gets added again and contacted again, and the
objection has been broken by tidiness.

The ICO's position is that keeping a suppression record is the correct way to
honour an objection, and that it is compatible with the right to erasure, because
the data retained is the minimum needed to ensure the person is not contacted
again. What is kept is the address and the fact of suppression, not the research,
the notes, the score or the correspondence.

Three consequences, all enforced below:

- The suppression table is **append-only**. A trigger raises on `UPDATE` and
  `DELETE`, so it holds even against the service role and against somebody with
  the SQL editor open at midnight.
- Suppression is keyed on the **normalised address**, not on the lead ID, and it
  carries no foreign key to `sales_leads`. Deleting the lead cannot cascade the
  suppression away. This matters today: every child table of `sales_leads`
  currently has `ON DELETE CASCADE`, and the CRM's delete button relies on it.
- It is checked **before every send**, by the same function the send trigger
  calls.

---

## 3. What exists today

For contrast, because the gap is the point.

`sales_leads` after the AI removal migration: `id`, `company`, `website`,
`industry`, `location`, `estimated_size`, `business_type`, `lead_score`,
`status`, `owner_id`, `owner_name`, `notes`, `signals`, `last_activity_at`,
`created_at`, `updated_at`.

`sales_contacts`: `id`, `lead_id`, `name`, `role`, `email`, `phone`,
`contact_form_url`, `source`, `confidence`, `created_at`.

`sales_contacts.source` already exists and is a useful start, but it is free text
describing where the contact route was found, and there is no date beside it and
no equivalent on the lead.

Not present anywhere: subscriber type, lawful basis, source date, privacy notice
status, marketing status, opt-out, suppression, send history. RLS on all five
tables grants `authenticated` full access with `using (true)`, so every team
member can delete anything.

---

## 4. The schema, as a DDL sketch

**Read this before running it.** It is a sketch, in the sense that it has been
written carefully but has not been executed, and there is one unresolved question
marked in the body about where `pgcrypto` lives on Supabase. Test it on a branch
or a scratch project first. `migration-plan.md` covers the order of work.

Proposed file: `supabase/migrations/202608160001_crm_compliance.sql`.

It follows the conventions of the existing migrations: `text` columns with
`CHECK ... in (...)` rather than enums, `if not exists` everywhere so a re-run is
harmless, and one transaction.

```sql
-- =====================================================================
-- n.abl — CRM compliance schema
-- ---------------------------------------------------------------------
-- Adds the fields, tables and constraints that decide who may lawfully
-- be contacted, and the gate that enforces it at the send path.
--
-- Additive: nothing is dropped and no existing column changes type.
-- Idempotent: safe to re-run.
--
-- The defaults are deliberately restrictive. Every existing lead lands
-- on do_not_contact / unassessed / unknown and has to be assessed by
-- hand before it can be marketed to. That is the intended outcome, not
-- an inconvenience to be backfilled away.
--
-- STATUS: NOT WRITTEN, NOT APPLIED. This block is a specification.
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
  add column if not exists lia_ref text,               -- the assessment on file
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
  add column if not exists source_detail text,          -- URL or dataset name
  add column if not exists source_date date,

  -- Article 14 transparency. Recorded, not assumed.
  add column if not exists privacy_notice_status text not null default 'not_given'
    check (privacy_notice_status in (
      'not_given',
      'given_at_first_contact',
      'given_on_request',
      'not_required'                                    -- inbound enquiry only
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

  -- Set once. An import must never clear this; see the trigger at 6.
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
-- sales_contacts.source already exists as free text and is kept as is.

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

  -- Normalised at write time: lower-cased trimmed email, E.164 phone.
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
  evidence text,                       -- what was said, where, by whom

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
--    The default answer to "can we email them again?" is still no.
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
-- 6. contact_history: what was sent, when, to whom, by whom.
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
  recipient text not null,             -- as addressed, kept if the lead goes
  subject text,
  body_hash text,                      -- sha256 of the exact body sent

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
        (s.scope = 'address'      and lower(btrim(s.identifier)) = t.addr)
        or (s.scope = 'domain'    and t.addr like '%@' || lower(btrim(s.identifier)))
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
      or (select at from reconsent) > (select at from blocked)
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
  if not public.marketing_send_allowed(new.lead_id, new.channel, new.recipient) then
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

create policy "team can read suppression"
  on public.marketing_suppression for select to authenticated using (true);
create policy "team can add suppression"
  on public.marketing_suppression for insert to authenticated with check (true);
-- No update policy and no delete policy. Absence is denial, and the
-- trigger at 4 catches anything that gets past RLS.

create policy "team can read consent"
  on public.marketing_consent for select to authenticated using (true);
create policy "team can add consent"
  on public.marketing_consent for insert to authenticated with check (true);

create policy "team can read sends"
  on public.marketing_sends for select to authenticated using (true);
create policy "team can add sends"
  on public.marketing_sends for insert to authenticated with check (true);

commit;
```

### The unresolved question in that block

`gen_random_uuid()` is fine: it is core PostgreSQL from version 13 and the
existing migrations already rely on it. There is **no** call to `digest()` in the
DDL above, which is deliberate. On Supabase, `pgcrypto` is installed into the
`extensions` schema rather than `public`, so an unqualified `digest()` inside a
`security definer` function with a pinned `search_path` would fail. If a hashed
identifier column is wanted later, it has to be written as
`extensions.digest(...)` and verified against the live project first. Do not add
one casually.

---

## 9. Field reference

The master plan's table, mapped onto where each thing actually lives.

| Master plan field | Where it lives here | Notes |
|---|---|---|
| `subscriber_type` | `sales_leads.subscriber_type` | Five values. Defaults to `unknown`, which cannot be marketed to |
| `lawful_basis` | `sales_leads.lawful_basis` | Defaults to `unassessed`. `legitimate_interests` requires `lia_ref` |
| `source` | `sales_leads.source` + `source_detail` | Category constrained, detail free text |
| `source_date` | `sales_leads.source_date` | Date, not timestamp. Nobody knows the minute |
| `privacy_notice_status` | `sales_leads.privacy_notice_status` | Article 14. Blocks the gate while `not_given` |
| `marketing_status` | `sales_leads.marketing_status`, mirrored per contact | Four values, default `do_not_contact` |
| `opt_out` | `sales_leads.opt_out`, `sales_contacts.opt_out` | Boolean plus timestamp plus channel |
| `suppression_list` | `public.marketing_suppression` | Own table, no FK, append-only trigger |
| `contact_history` | `public.marketing_sends` | Own table, `ON DELETE SET NULL`, opt-out required |

---

## 10. What this schema does not do

Stated plainly so nobody assumes coverage that is not there.

- **It does not send anything.** There is no sender in this design. The gate
  guards the record of a send, and the sender is v4 work in `11-outreach`.
- **It does not do TPS or CTPS screening.** It records that a suppression came
  from one. Screening is a separate integration and is not in scope.
- **It does not handle data subject access requests.** There is no export path
  and no deletion workflow for a person who asks. That is a gap and it belongs in
  `04-legal` alongside the privacy policy work.
- **It does not enforce retention.** `retention_review_due` is a date somebody
  has to look at. No job deletes stale leads.
- **It does not fix the localStorage mirror.** Every lead is copied to the
  operator's device by the current front end, outside all of this. See
  `migration-plan.md`, step 8.
- **It has not been reviewed by a solicitor, and no part of it has been run.**
