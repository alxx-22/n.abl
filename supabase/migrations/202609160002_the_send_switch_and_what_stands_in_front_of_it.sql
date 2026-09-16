-- ============================================================
-- THE SEND SWITCH, AND WHAT STANDS IN FRONT OF IT
--
-- STATUS: applied to the live project on 16 September 2026.
--
-- approval-gates.md: both gates are human and both are before sending.
-- This adds the switch and, more importantly, the things it cannot get
-- past.
--
-- NOTHING HERE SENDS. There is no mail transport wired to this project
-- at all, so the switch is currently a declaration of intent that the
-- blocker list refuses. That is the point: the control should exist and
-- be visibly blocked, with the reasons written down, rather than not
-- exist and be added in a hurry on the day somebody wants to send.
--
-- The four blockers as of today, all of them true:
--   1. No postal address. PECR reg. 23 requires a real one and the
--      letter renders [trading address].
--   2. No mail transport. Nothing in this project can send an email.
--   3. 149 leads are marked do_not_contact - promote.mjs's default,
--      and lifting it is a decision per business, not a switch.
--   4. No letter has been approved. Gate 2 has never been used.
--
-- Arming is deliberately awkward: the caller types the target's name
-- back, exactly. That is the difference between a click and a decision,
-- and the database checks it again regardless of what the CRM did.
-- Disarming asks for nothing, because stopping should always be easier
-- than starting.
-- ============================================================

alter table public.lead_letter
  add column if not exists approved_at  timestamptz,
  add column if not exists approved_by  text;

comment on column public.lead_letter.approved_at is
  'Gate 2. A person read this letter and said yes. Nothing may be sent without it, and it is set by a person rather than by any pipeline.';

create or replace function public.outreach_send_blockers()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $function$
  select coalesce(jsonb_agg(b order by b->>'severity', b->>'what'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'what', 'No postal address',
      'why', 'PECR reg. 23 requires a real one in every message. The letter renders [trading address] until outreach_setting.postal_address is set.',
      'severity', '1_legal') as b
    where not exists (
      select 1 from public.outreach_setting
       where key = 'postal_address'
         and nullif(btrim(value #>> '{}'), '') is not null
         and value #>> '{}' not ilike '%[%')

    union all
    select jsonb_build_object(
      'what', 'No mail transport',
      'why', 'Nothing in this project can send an email. outreach_setting.mail_transport names the sender once one exists.',
      'severity', '2_missing')
    where not exists (
      select 1 from public.outreach_setting
       where key = 'mail_transport' and nullif(btrim(value #>> '{}'), '') is not null)

    union all
    select jsonb_build_object(
      'what', (count(*))::text || ' leads are marked do_not_contact',
      'why', 'The sourcing default. Each one is a decision about that business, not something a send switch may override.',
      'severity', '3_data')
    from public.sales_leads
    where coalesce(marketing_status, 'do_not_contact') = 'do_not_contact'
    having count(*) > 0

    union all
    select jsonb_build_object(
      'what', 'No letter has been approved',
      'why', 'Gate 2 in approval-gates.md. A person reads the letter and sets lead_letter.approved_at. Nothing is approved yet.',
      'severity', '3_data')
    where not exists (select 1 from public.lead_letter where approved_at is not null)
  ) x
$function$;

create or replace function public.outreach_arm_sending(
  p_target uuid, p_confirm_name text, p_who text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
declare t public.outreach_target%rowtype; v_blockers jsonb;
begin
  select * into t from public.outreach_target where id = p_target;
  if not found then return jsonb_build_object('armed', false, 'why', 'no such target'); end if;

  if btrim(coalesce(p_confirm_name, '')) is distinct from btrim(t.name) then
    return jsonb_build_object('armed', false,
      'why', 'the target name was not typed back exactly, so nothing was changed');
  end if;

  v_blockers := public.outreach_send_blockers();
  if jsonb_array_length(v_blockers) > 0 then
    return jsonb_build_object('armed', false, 'why', 'there are blockers', 'blockers', v_blockers);
  end if;

  update public.outreach_target
     set sending_enabled = true, sending_armed_at = now(),
         sending_armed_by = nullif(btrim(p_who), ''), updated_at = now()
   where id = p_target;
  return jsonb_build_object('armed', true, 'target', t.name);
end
$fn$;

create or replace function public.outreach_disarm_sending(p_target uuid default null)
returns integer
language sql
security definer
set search_path = public, pg_catalog
as $fn$
  with x as (
    update public.outreach_target
       set sending_enabled = false, sending_armed_at = null,
           sending_armed_by = null, updated_at = now()
     where sending_enabled and (p_target is null or id = p_target)
    returning 1)
  select count(*)::integer from x
$fn$;

revoke all on function public.outreach_send_blockers() from anon, authenticated, public;
revoke all on function public.outreach_arm_sending(uuid, text, text) from anon, authenticated, public;
revoke all on function public.outreach_disarm_sending(uuid) from anon, authenticated, public;
