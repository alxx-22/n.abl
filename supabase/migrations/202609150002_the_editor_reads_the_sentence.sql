-- ============================================================
-- A REVISION ROUND: THE EDITOR READS THE SENTENCE, NOT THE ANGLE
--
-- STATUS: applied to the live project on 15 September 2026.
--
-- Until now no agent ever improved another's work. The editor chose an
-- angle and the writer took it or handed it back; nobody ever looked at
-- the sentence that came out and said what was wrong with it.
--
--   editor  promotes an angle + a brief
--   writer  writes it
--   editor  reads THE SENTENCE, accepts it or names one change   <- new
--   writer  makes that change and nothing else                   <- new
--
-- WHY THE REVIEWER CANNOT REJECT
--
-- By the time a clause reaches review it has passed every guard: its
-- quote is genuinely on the page, every digit came from the material,
-- it names nobody, it is the right shape. A reviewer with a veto would
-- be re-running checks that already ran - and this project already has
-- the worked example of what that costs. The editor, first thing this
-- morning, refused the first four leads outright on taste. Two moves,
-- no veto, and a floor.
--
-- WHY NOT A FOURTH AGENT
--
-- The obvious move is a supervisor over the other three. It was
-- rejected: "oversee the rest" is not a task with an output, and an
-- agent with nothing concrete to decide either rubber-stamps or vetoes.
-- The reviewer is the editor again - same model chain, same budget -
-- with exactly one artefact in front of it.
--
-- THE SAFETY PROPERTY, TESTED IN scripts/check-outreach-guards.mjs
--
-- A revision that fails validation NEVER loses the draft we already
-- had. A loop meant to improve output must not be able to reduce it.
-- The editor's objection is still written to outreach_round, so it
-- reaches a person at the gate even when the sentence did not change.
-- ============================================================

insert into public.outreach_setting (key, value, note) values
  ('max_revisions', '1',
   'How many times the editor may send the sentence back for one specific change. One is enough to fix a real fault and cheap enough not to matter; more turns a loop into a committee.')
on conflict (key) do update set value = excluded.value, note = excluded.note;

-- The prompt body is data rather than schema and is long; it was
-- inserted alongside this migration. A row a person has edited is left
-- alone on replay: the seed only updates rows whose updated_by still
-- starts with "built".
--
--   select body from public.outreach_prompt where key = 'review';
--
-- If this migration is replayed against a project with no review row,
-- the writer keeps working exactly as it did before - callReview is
-- null when the prompt is absent, and negotiate() skips the loop. That
-- is deliberate: a missing prompt should cost refinement, not output.

comment on table public.outreach_prompt is
  'One system prompt per agent job - scout, editor, review, writer - editable without a deploy. The guards that keep generated prose honest are in code, not here, so a bad edit costs rejected verdicts rather than a false claim.';
