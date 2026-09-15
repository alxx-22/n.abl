-- ============================================================
-- THE ASSESSMENT RE-SCORES THE LEAD
--
-- STATUS: applied to the live project on 15 September 2026.
--
-- A lead is scored the moment it lands, from register data alone. Of
-- the five dimensions in scoring-model.md, OBSERVABLE SIGNALS is worth
-- 30 of the 100 points and scored zero on almost every lead we hold,
-- because the triage emitted things like "placeholder_site" that map to
-- no code in the catalogue.
--
-- The scout reads the business's actual homepage. That is exactly the
-- evidence the signals dimension was specified to carry.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--
-- It does not invent a sixth dimension and it does not touch a weight.
-- scoring-model.md 5 is explicit: "These weights are not to be changed
-- here. If they need to change, change the ICP first." So this fills an
-- existing dimension using the existing catalogue, and nothing else.
--
-- It also does not award points for an inference. Every code requires a
-- pattern that actually matched the business's own page, and which
-- pattern matched is kept in lead_page_signal. A score is a claim, and
-- the same rule applies to it as to a sentence: if we cannot show where
-- it came from, we do not get the points.
--
-- THE THING THIS SURFACED, WHICH IS NOT A BUG
--
-- The bands are unreachable. 35 of the 100 points sit in `size` and
-- `decision_access`, and this programme deliberately collects neither -
-- employee counts are never estimated, and no named individual is held
-- because the lawful basis covers corporate subscribers only. So the
-- denominator tops out at 65, the shortlist threshold is 70, and no
-- lead can ever band. That is a question for the ICP, not something to
-- fix by quietly lowering a threshold here.
-- ============================================================

alter table public.outreach_page_signal
  add column if not exists signal_code text,
  add column if not exists tier        integer check (tier between 1 and 3);

comment on column public.outreach_page_signal.signal_code is
  'The scoring-model.md 5.4 catalogue code this pattern establishes, when it establishes one. Null means the pattern is useful context for the scout and earns no points - most of them.';
comment on column public.outreach_page_signal.tier is
  'Catalogue tier: 1 is 10 points, 2 is 3, 3 is 5. Summed then capped at 30.';

-- Only codes a homepage read can honestly establish. The rest of the
-- catalogue needs a job advert, a review, a filing history or a person,
-- and none of those are in front of the scout.
update public.outreach_page_signal set signal_code = 'third_party_portal', tier = 2 where key = 'booking';
update public.outreach_page_signal set signal_code = 'third_party_portal', tier = 2 where key = 'livechat';

insert into public.outreach_page_signal (key, pattern, flags, description, signal_code, tier) values
  ('generic_email',   '[A-Za-z0-9._%+-]+@(gmail|outlook|hotmail|yahoo|btconnect|btinternet|aol)\.',
   'i', 'the business uses a free or ISP email address rather than its own domain',
   'generic_email_domain', 2),
  ('stale_copyright', '(?:©|&copy;|copyright)\s*(?:20(?:0[0-9]|1[0-9]|2[0-3]))(?!\s*[-–—]\s*20)',
   'i', 'the footer copyright year is well out of date while the business is clearly still trading',
   'stale_copyright', 2),
  ('quote_by_phone',  '(?:call|phone|ring|telephone)\s+(?:us|the office|our team|now)?[^.]{0,40}?(?:for a (?:quote|price|estimate)|to book|to arrange|to discuss)',
   'i', 'the site asks people to telephone for a quote or to book rather than doing it online',
   'quote_by_phone', 1)
on conflict (key) do update set
  pattern = excluded.pattern, flags = excluded.flags, description = excluded.description,
  signal_code = excluded.signal_code, tier = excluded.tier, active = true;

create table if not exists public.lead_page_signal (
  lead_id     uuid not null references public.sales_leads(id) on delete cascade,
  key         text not null,
  matched_at  timestamptz not null default now(),
  primary key (lead_id, key)
);

comment on table public.lead_page_signal is
  'Which page patterns matched this business''s own homepage. The provenance behind every signal point: a score that cannot show what matched is a claim we cannot stand behind, same as a sentence that cannot show its quote.';

alter table public.lead_page_signal enable row level security;
revoke all on public.lead_page_signal from anon, authenticated;

alter table public.sales_leads
  add column if not exists lead_score_initial integer,
  add column if not exists lead_score_rescored_at timestamptz;

comment on column public.sales_leads.lead_score_initial is
  'What the lead scored on register data alone, before anybody looked at its website. Kept so the movement is visible rather than overwritten.';

-- The function bodies are long and were applied alongside this file;
-- outreach_rescore(uuid) and the five-argument outreach_record_fit are
-- the current definitions in the database. The rule that matters, and
-- the one to preserve in any edit:
--
--   p_page_signals NULL means the caller never looked. An empty array
--   means it looked and found nothing. Only the second is a
--   measurement, and only a measurement may move the score.
