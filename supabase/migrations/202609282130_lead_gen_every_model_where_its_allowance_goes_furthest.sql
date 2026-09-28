-- ============================================================
-- EVERY MODEL WHERE ITS ALLOWANCE GOES FURTHEST
--
-- AI Studio's free-tier limits for these projects, 28 September 2026:
--
--   gemini-3.5-flash-lite, gemini-3.1-flash-lite   500 a day, 15 a minute
--   gemini-3.5 / 3.6 / 3.7 / 3.8 / 3 flash           20 a day,  5 a minute
--   gemini-2.5-flash, gemini-2.5-flash-lite          20 a day
--   gemma-4-26b-a4b-it                           14,400 a day, 30 a minute,
--                                                 but 16,000 tokens a minute
--   gemma-4-31b-it                                 listed, answered 500 to
--                                                  every request: not used
--
-- The registry had Flash at 250 a day and the Lites at 1,000. The logs
-- agree with AI Studio: 3.5 Flash and flash-latest each stopped at 20 to
-- 23 every morning by 08:30, spent on the first handful of businesses -
-- including the sales agent's replies in each argument, which need no
-- better model than the specialist it is arguing with.
--
-- Every Flash model is its own allowance, so five of them are 100 a day
-- where one was 20. They go only to single calls where judgement is the
-- whole job and a Lite would answer differently:
--   - the sales agent's first pick (one per business)
--   - the research loop's checker (is this page this business?), whose
--     project had 20 a day of Flash sitting unused
--   - the outreach writer's sentence and letter (a stranger reads them)
-- The sales agent's replies get a role of their own on the Lites
-- (index.ts falls back to prospect_sales if this row set is absent).
--
-- gemini-flash-lite-latest is an alias of 3.5 Flash Lite: on 24 and 25
-- September it was "exhausted" the moment 3.5 Flash Lite was. As second
-- in a chain it could only answer 429. It goes last, where it still
-- covers 3.5 Flash Lite being retired, and 3.1 Flash Lite - a real
-- second 500 - moves up.
--
-- Gemma 4 26B goes after both Lites in the discovery chains: when the
-- 1,000 Lite calls are spent it keeps scoring instead of the queue
-- waiting for 07:00. It thinks by default; the code asks it for minimal
-- thinking (1.3 s, clean JSON when probed) and drops thought parts. Its
-- limit is tokens: our prompts are 4,000 to 6,000 tokens, so 3 a minute,
-- hence a 20-second gap. Not in the investigator's chain: it did not
-- answer a function call within 30 seconds.
--
-- Gaps: the lead prospector now paces each model on its own clock, so a
-- Flash model's 12 seconds (5 a minute) holds up nothing else. The
-- outreach writer still paces on one clock; its Flash rows keep 6.5 s,
-- and a minute's 429 moves on to the next Flash model, a separate
-- allowance.
-- ============================================================

-- The published allowances, on every row that names these models.
update public.outreach_model set rpd = 500
 where model in ('gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest');
update public.outreach_model set rpd = 20
 where model in ('gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.7-flash',
                 'gemini-3.6-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite');

-- The chains. Temperature is left to each prompt.
insert into public.outreach_model as m (role, model, priority, rpd, gap_ms, active, key_secret, note) values
  -- discovery: the sales agent's pick, the one judgement call per business
  ('prospect_sales', 'gemini-3.5-flash',         10,    20, 12000, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: the pick - which services, at what opening number; one call a business, so Flash'),
  ('prospect_sales', 'gemini-3.8-flash',         12,    20, 12000, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: a second Flash allowance'),
  ('prospect_sales', 'gemini-3.7-flash',         14,    20, 12000, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: a third Flash allowance'),
  ('prospect_sales', 'gemini-3.6-flash',         16,    20, 12000, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: a fourth Flash allowance'),
  ('prospect_sales', 'gemini-3-flash-preview',   18,    20, 12000, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: a fifth Flash allowance'),
  ('prospect_sales', 'gemini-flash-latest',      20,    20, 12000, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: Google''s alias; its own 20 a day as of 26 September'),
  ('prospect_sales', 'gemini-3.5-flash-lite',    30,   500,  4500, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: when the Flash models are spent'),
  ('prospect_sales', 'gemini-3.1-flash-lite',    40,   500,  4500, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: a second 500'),
  ('prospect_sales', 'gemma-4-26b-a4b-it',       50, 14400, 20000, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: after the Lites; 16,000 tokens a minute, so one call in 20 s'),
  ('prospect_sales', 'gemini-flash-lite-latest', 60,   500,  4500, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: alias of 3.5 Flash Lite, its quota too; last, for a retirement'),
  -- discovery: the sales agent's replies in an argument
  ('prospect_sales_reply', 'gemini-3.5-flash-lite',    10,   500,  4500, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: sales replying to a specialist, who is on a Lite too'),
  ('prospect_sales_reply', 'gemini-3.1-flash-lite',    20,   500,  4500, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: a second 500'),
  ('prospect_sales_reply', 'gemma-4-26b-a4b-it',       30, 14400, 20000, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: after the Lites'),
  ('prospect_sales_reply', 'gemini-flash-lite-latest', 40,   500,  4500, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: alias of 3.5 Flash Lite; last, for a retirement'),
  -- discovery: the volume - research, the review, signals, specialists
  ('prospect_research',   'gemini-3.5-flash-lite',    10,   500,  4500, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: reads register + site, and reviews the signals'),
  ('prospect_research',   'gemini-3.1-flash-lite',    20,   500,  4500, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: a second 500'),
  ('prospect_research',   'gemma-4-26b-a4b-it',       30, 14400, 20000, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: after the Lites'),
  ('prospect_research',   'gemini-flash-lite-latest', 40,   500,  4500, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: alias of 3.5 Flash Lite; last, for a retirement'),
  ('prospect_signals',    'gemini-3.5-flash-lite',    10,   500,  4500, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: facts to signals'),
  ('prospect_signals',    'gemini-3.1-flash-lite',    20,   500,  4500, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: a second 500'),
  ('prospect_signals',    'gemma-4-26b-a4b-it',       30, 14400, 20000, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: after the Lites'),
  ('prospect_signals',    'gemini-flash-lite-latest', 40,   500,  4500, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: alias of 3.5 Flash Lite; last, for a retirement'),
  ('prospect_specialist', 'gemini-3.5-flash-lite',    10,   500,  4500, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: one per service'),
  ('prospect_specialist', 'gemini-3.1-flash-lite',    20,   500,  4500, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: a second 500'),
  ('prospect_specialist', 'gemma-4-26b-a4b-it',       30, 14400, 20000, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: after the Lites'),
  ('prospect_specialist', 'gemini-flash-lite-latest', 40,   500,  4500, true, 'GEMINI_DISCOVERY_API_KEY', 'lead gen: alias of 3.5 Flash Lite; last, for a retirement'),
  -- research: the checker, where a wrong yes puts the wrong site on a lead
  ('prospect_lookup_check', 'gemini-3.5-flash',         10,  20, 12000, true, 'GEMINI_RESEARCH_API_KEY', 'research loop: is this page this business? rare, and a wrong yes costs a lead'),
  ('prospect_lookup_check', 'gemini-3.8-flash',         12,  20, 12000, true, 'GEMINI_RESEARCH_API_KEY', 'research loop: a second Flash allowance'),
  ('prospect_lookup_check', 'gemini-3.7-flash',         14,  20, 12000, true, 'GEMINI_RESEARCH_API_KEY', 'research loop: a third Flash allowance'),
  ('prospect_lookup_check', 'gemini-3.6-flash',         16,  20, 12000, true, 'GEMINI_RESEARCH_API_KEY', 'research loop: a fourth Flash allowance'),
  ('prospect_lookup_check', 'gemini-3-flash-preview',   18,  20, 12000, true, 'GEMINI_RESEARCH_API_KEY', 'research loop: a fifth Flash allowance'),
  ('prospect_lookup_check', 'gemini-3.5-flash-lite',    30, 500,  4500, true, 'GEMINI_RESEARCH_API_KEY', 'research loop: when the Flash models are spent'),
  ('prospect_lookup_check', 'gemini-3.1-flash-lite',    40, 500,  4500, true, 'GEMINI_RESEARCH_API_KEY', 'research loop: a second 500'),
  ('prospect_lookup_check', 'gemini-flash-lite-latest', 50, 500,  4500, true, 'GEMINI_RESEARCH_API_KEY', 'research loop: alias of 3.5 Flash Lite; last, for a retirement'),
  -- research: the investigator, many turns with tools
  ('prospect_lookup', 'gemini-3.5-flash-lite',    10, 500, 4500, true, 'GEMINI_RESEARCH_API_KEY', 'research loop: the investigator, with tools'),
  ('prospect_lookup', 'gemini-3.1-flash-lite',    20, 500, 4500, true, 'GEMINI_RESEARCH_API_KEY', 'research loop: a second 500'),
  ('prospect_lookup', 'gemini-flash-lite-latest', 30, 500, 4500, true, 'GEMINI_RESEARCH_API_KEY', 'research loop: alias of 3.5 Flash Lite; last, for a retirement'),
  -- outreach writer: the sentence and the letter a stranger reads
  ('writer', 'gemini-3.5-flash',      10,  20, 6500, true, 'GEMINI_API_KEY', 'Prose. The only stage a stranger reads.'),
  ('writer', 'gemini-3.8-flash',      12,  20, 6500, true, 'GEMINI_API_KEY', 'A second Flash allowance before the sentence degrades.'),
  ('writer', 'gemini-3.7-flash',      14,  20, 6500, true, 'GEMINI_API_KEY', 'A third Flash allowance.'),
  ('writer', 'gemini-3.6-flash',      16,  20, 6500, true, 'GEMINI_API_KEY', 'A fourth Flash allowance.'),
  ('writer', 'gemini-flash-latest',   20,  20, 6500, true, 'GEMINI_API_KEY', 'Google''s alias.'),
  ('writer', 'gemini-3.5-flash-lite', 30, 500, 4500, true, 'GEMINI_API_KEY', 'Degrades the sentence rather than losing the lead.'),
  ('letter', 'gemini-3.5-flash',      10,  20, 6500, true, 'GEMINI_API_KEY', 'The letter a stranger reads.'),
  ('letter', 'gemini-3.8-flash',      12,  20, 6500, true, 'GEMINI_API_KEY', 'A second Flash allowance.'),
  ('letter', 'gemini-3.7-flash',      14,  20, 6500, true, 'GEMINI_API_KEY', 'A third Flash allowance.'),
  ('letter', 'gemini-3.6-flash',      16,  20, 6500, true, 'GEMINI_API_KEY', 'A fourth Flash allowance.'),
  ('letter', 'gemini-flash-latest',   20,  20, 6500, true, 'GEMINI_API_KEY', 'Google''s alias.'),
  ('letter', 'gemini-3.5-flash-lite', 30, 500, 4500, true, 'GEMINI_API_KEY', 'Degrades the letter rather than losing the lead.'),
  -- outreach writer: extraction and checking, on the Lites
  ('scout',      'gemini-3.5-flash-lite',    10, 500, 4500, true, 'GEMINI_API_KEY', 'Proven on this key.'),
  ('scout',      'gemini-3.1-flash-lite',    20, 500, 4500, true, 'GEMINI_API_KEY', 'A second 500.'),
  ('scout',      'gemini-flash-lite-latest', 30, 500, 4500, true, 'GEMINI_API_KEY', 'Alias of 3.5 Flash Lite, its quota too; last, for a retirement.'),
  ('strategist', 'gemini-3.5-flash-lite',    10, 500, 4500, true, 'GEMINI_API_KEY', ''),
  ('strategist', 'gemini-3.1-flash-lite',    20, 500, 4500, true, 'GEMINI_API_KEY', 'A second 500.'),
  ('strategist', 'gemini-flash-lite-latest', 30, 500, 4500, true, 'GEMINI_API_KEY', 'Alias of 3.5 Flash Lite; last, for a retirement.'),
  ('editor',     'gemini-3.5-flash-lite',    10, 500, 4500, true, 'GEMINI_API_KEY', 'Proven on this key.'),
  ('editor',     'gemini-3.1-flash-lite',    20, 500, 4500, true, 'GEMINI_API_KEY', 'A second 500.'),
  ('editor',     'gemini-flash-lite-latest', 30, 500, 4500, true, 'GEMINI_API_KEY', 'Alias of 3.5 Flash Lite; last, for a retirement.')
on conflict (role, model) do update
   set priority = excluded.priority, rpd = excluded.rpd, gap_ms = excluded.gap_ms,
       active = excluded.active, key_secret = excluded.key_secret, note = excluded.note;
