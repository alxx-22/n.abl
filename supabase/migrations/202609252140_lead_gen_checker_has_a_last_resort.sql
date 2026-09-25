-- ============================================================
-- THE CHECKER HAS A LAST RESORT
--
-- On the evening of 25 September the research project's first model ran
-- out of its day, then its second, and the checker had no third: every
-- business with a page that named it waited for the morning, and the
-- tick stopped at the first. The investigator's chain already ends on
-- gemini-3.1-flash-lite; the checker's now does too.
-- ============================================================

insert into public.outreach_model (role, model, priority, rpd, gap_ms, temperature, active, note, key_secret)
values ('prospect_lookup_check', 'gemini-3.1-flash-lite', 30, 480, 4500, null, true,
        'research loop: the checker, last in the chain', 'GEMINI_RESEARCH_API_KEY')
on conflict do nothing;
