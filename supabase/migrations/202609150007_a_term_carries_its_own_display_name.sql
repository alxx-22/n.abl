-- ============================================================
-- A TERM CARRIES ITS OWN DISPLAY NAME
--
-- STATUS: applied to the live project on 15 September 2026.
--
-- The CRM rendered every registry term by replacing underscores with
-- spaces. That is a rule rather than a list, which is why it survived
-- this long - but it is a rule that assumes the term and the name are
-- the same string with different punctuation, and for the capabilities
-- they are not. "ai" is AI. "data_analytics" is Data & Analytics.
-- "software" is Custom Software on every page of the positioning work.
--
-- The alternative was a lookup table in the dashboard's JavaScript,
-- which is the static variable this whole phase has been taking out:
-- a seventh capability would then be two edits in two languages, one
-- of which is a deploy. So the name lives next to the term, and the
-- fallback stays - a term with no label is still rendered by rule.
-- ============================================================

alter table public.outreach_vocabulary
  add column if not exists label text;

comment on column public.outreach_vocabulary.label is
  'What to show a person instead of the term. Null means the term reads well enough on its own after underscores become spaces - most of them.';

-- Wording taken from 01-positioning/README.md 154, unchanged. The CRM
-- and the website should not be describing the same six things
-- differently.
update public.outreach_vocabulary set label = v.label
  from (values
    ('automation',       'Automation'),
    ('data_analytics',   'Data & Analytics'),
    ('software',         'Custom Software'),
    ('web',              'Web'),
    ('ai',               'AI'),
    ('training_support', 'Training & Support')
  ) as v(term, label)
 where public.outreach_vocabulary.dimension = 'capability'
   and public.outreach_vocabulary.term = v.term;

-- Deliberately not added to outreach_config(). The models are given a
-- term and its meaning; a display name is for the person reading the
-- CRM, and putting it in the prompt would only invite a model to answer
-- with "Data & Analytics" where the registry expects "data_analytics".
