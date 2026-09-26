-- ============================================================
-- BEING PART OF A GROUP IS A QUESTION, NOT A WALK-AWAY
--
-- Scored three times, Heating & Process Engineering - 17 staff, a site on
-- plain HTTP with no mobile layout, the hand search's strongest web lead
-- at 72 - came back at 50, 50, then 0: the web specialist read "controlled
-- by another company, so the decision may sit there" and said "that caps
-- our score at 0". Nothing caps it: only a caution from the register sets
-- a ceiling, and code applies it. The same line crowded out Alect's and
-- Faraday Chapman's work in other runs.
-- ============================================================

do $$
declare
  v_old text := '- If the register has flagged a caution, no score above its ceiling counts.';
  v_new text := v_old || E'\n- Only a CAUTION FROM THE REGISTER sets a ceiling. Being part of a group sets none: who decides is the question for the first call, never a reason to pass or to mark down a score the work has earned.';
begin
  update public.prospect_prompt
     set body = replace(body, v_old, v_new), updated_at = now()
   where key = 'specialist' and position(v_old in body) > 0 and position('Being part of a group sets none' in body) = 0;
  if not exists (select 1 from public.prospect_prompt where key = 'specialist' and position('Being part of a group sets none' in body) > 0) then
    raise exception 'the specialist prompt did not take the group rule';
  end if;
end
$$;
