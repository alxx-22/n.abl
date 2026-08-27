-- Give the portal assistant dates it can read, and tell it which ones have
-- already happened.
--
-- WHAT WENT WRONG
-- Asked "when is my next meeting", the assistant answered:
--
--   "Your next meeting is scheduled for 2026-06-02T22:16:12.333029+00:00 for
--    the Kickoff call at Google Meet."
--
-- Two separate faults in one sentence.
--
-- 1. It read a raw ISO timestamp out loud, microseconds and offset included.
--    No person writes a date that way. The portal itself renders the same
--    meeting as "02 Jun 2026 · 23:16", so a client reading both saw one
--    meeting written two ways, one of them machine-shaped.
--
-- 2. Far worse: that meeting is in the PAST. It was 2 June; the question was
--    asked on 27 August. Both meetings on the record are historic and there is
--    no next meeting at all. The assistant said there was one because nothing
--    in its context distinguished a meeting that has happened from one that has
--    not, and "next" was the word in the question.
--
-- The second fault is the reason this is a migration rather than a prompt
-- change. Asking a model to compare an ISO string against today's date and
-- infer tense is asking it to do arithmetic it is bad at, on a value it should
-- never have been handed. Postgres knows what now() is, and it does not guess.
--
-- WHAT CHANGES
-- The context now carries, for every date:
--   * a formatted string in the portal's own house style, Europe/London
--   * never the underlying timestamp
-- and for every meeting:
--   * timing, 'upcoming' or 'past', decided here against now()
-- plus two new top-level fields:
--   * today, so the model has a reference point it did not have to derive
--   * next_meeting, the first upcoming one or null — so "is there a next
--     meeting" is a lookup rather than an inference, and null is an answer
--
-- Meetings are ordered upcoming-soonest-first, then past-most-recent-first,
-- so the first element of the array is the one a client is usually asking
-- about.
--
-- FORMAT
-- 'DD Mon YYYY' and 'HH24:MI' in Europe/London, matching dateLong() and
-- timeStr() in src/pages/Portal.jsx, which render en-GB with a 2-digit day,
-- short month and 24-hour clock. The assistant and the page it lives in should
-- not disagree about what a date looks like.
--
-- The portal page reads the meetings table directly rather than through this
-- function, so nothing on screen changes.

create or replace function public.portal_assistant_context(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_client public.clients%rowtype;
  v_tz     constant text := 'Europe/London';
begin
  select * into v_client
  from public.clients
  where access_key = btrim(p_key)
  limit 1;

  if not found then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    -- Without this the model has no idea what day it is, and every question
    -- with "next", "still" or "yet" in it becomes a guess.
    'today', to_char(now() at time zone v_tz, 'DD Mon YYYY'),

    'client', jsonb_build_object(
      'business_name', v_client.business_name,
      'contact_name',  v_client.contact_name,
      'contact_email', v_client.contact_email,
      'client_since',  to_char(v_client.created_at at time zone v_tz, 'DD Mon YYYY')
    ),

    'quotes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'reference', q.reference, 'title', q.title, 'amount', q.amount,
        'status', q.status,
        'valid_until', case when q.valid_until is null then null
                            else to_char(q.valid_until, 'DD Mon YYYY') end,
        -- A quote whose date has passed is not a quote the client can accept,
        -- and that is a fact about today, not about the quote.
        'expired', case when q.valid_until is null then null
                        else q.valid_until < (now() at time zone v_tz)::date end)
        order by q.created_at desc)
      from public.quotes q where q.client_id = v_client.id
    ), '[]'::jsonb),

    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', p.title, 'status', p.status,
        'progress_percent', p.progress_percent,
        'next_milestone', p.next_milestone,
        'next_milestone_date', case when p.next_milestone_date is null then null
                                    else to_char(p.next_milestone_date, 'DD Mon YYYY') end))
      from public.projects p where p.client_id = v_client.id
    ), '[]'::jsonb),

    'meetings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', m.title,
        'when', to_char(m.datetime at time zone v_tz, 'DD Mon YYYY')
                || ' at ' || to_char(m.datetime at time zone v_tz, 'HH24:MI'),
        'timing', case when m.datetime > now() then 'upcoming' else 'past' end,
        'location', m.location,
        'status', m.status)
        -- Upcoming first and soonest first; then the past, most recent first.
        order by (m.datetime > now()) desc,
                 case when m.datetime > now() then m.datetime end asc,
                 m.datetime desc)
      from public.meetings m where m.client_id = v_client.id
    ), '[]'::jsonb),

    -- Null is a real answer here and the most likely one: it means there is
    -- no next meeting, which is exactly what the assistant got wrong.
    'next_meeting', coalesce((
      select jsonb_build_object(
        'title', m.title,
        'when', to_char(m.datetime at time zone v_tz, 'DD Mon YYYY')
                || ' at ' || to_char(m.datetime at time zone v_tz, 'HH24:MI'),
        'location', m.location,
        'status', m.status)
      from public.meetings m
      where m.client_id = v_client.id and m.datetime > now()
      order by m.datetime
      limit 1
    ), 'null'::jsonb),

    -- Titles only. A signed URL in a model prompt is a signed URL in whatever
    -- the model says next, and these documents are private storage.
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', d.title, 'document_type', d.document_type,
        'uploaded_at', to_char(d.uploaded_at at time zone v_tz, 'DD Mon YYYY'))
        order by d.uploaded_at desc)
      from public.documents d where d.client_id = v_client.id
    ), '[]'::jsonb)
  );
end;
$function$;

-- Unchanged from 202608230002 and restated because a redefinition drops them:
-- the service role is the only caller, because the edge function is the only
-- thing holding a key to call it with.
revoke all on function public.portal_assistant_context(text) from public, anon, authenticated;
grant execute on function public.portal_assistant_context(text) to service_role;
