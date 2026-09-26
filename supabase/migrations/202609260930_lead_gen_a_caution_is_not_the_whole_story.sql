-- ============================================================
-- A CAUTION IS NOT THE WHOLE STORY, AND THE SIGNALS AGENT STEADIES
--
-- Scored twice on the same pages, Alect Electrical Services came back
-- once with AI at 45 and once with nothing: the second time the signals
-- agent put forward only "controlled by holding companies, so the decision
-- may sit elsewhere" and read none of its work - 25 staff, a quote request
-- form, emergency call-outs. Faraday Chapman did the same on its first
-- scoring. A caution sits beside the signals; it never replaces them.
--
-- The signals agent also ran warmer (0.4) than the reviewer (0.2), and
-- the same facts gave different signals from one run to the next. It now
-- runs at 0.2.
-- ============================================================

do $$
declare
  v_old text := '- A signal about the business''s health rather than its work - behind on filings, dormant, very new with no trading shown, tiny and quiet - is a caution: set "caution": true and "points_to": []. Cautions are for every agent to see; nothing can be sold on one.';
  v_new text := v_old || E'\n- A caution never stands in for the signals. Being part of a group, or any other caution, is put forward beside what the facts show about the work - how enquiries arrive, what they quote, test, report or book, how many people do it - never instead of it.';
begin
  update public.prospect_prompt
     set body = replace(body, v_old, v_new), temperature = 0.2, updated_at = now()
   where key = 'signals' and position(v_old in body) > 0 and position('never stands in for the signals' in body) = 0;
  if not exists (select 1 from public.prospect_prompt where key = 'signals' and position('never stands in for the signals' in body) > 0) then
    raise exception 'the signals prompt did not take the caution rule';
  end if;
end
$$;
