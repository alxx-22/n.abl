-- Somewhere to put a lead score that can be read back and argued with.
--
-- scoring-model.md s.3 step 5 says a scored lead records "score, breakdown,
-- ruleset version, timestamp". lead_score already existed and held 50 for
-- every row -- the CRM's neutral default, which promote.mjs sets deliberately
-- and labels "not a judgement". The columns below are what turn that 50 into
-- something a person can check.
--
-- WHY points_available EXISTS
-- The model is worth 100 points. Two of its five dimensions cannot currently
-- be measured at all:
--
--   size (20)            no employee_count is held anywhere, and s.5.2
--                        forbids estimating one from van counts or turnover.
--   decision access (15) s.5.5 awards 15 points for a named, contactable
--                        director. 202608210003 only lets lawful_basis stay
--                        'not_personal_data' while has_named_individual() is
--                        false, and the sourcing run discarded officer names
--                        for that reason on 42 leads. The ICP and the
--                        compliance schema want opposite things here.
--
-- Without points_available a lead scoring 35 of an available 65 is
-- indistinguishable from a lead scoring 35 of 100, and s.6 would band the
-- whole batch 'discard' on evidence we never gathered. Storing the
-- denominator is the difference between "we looked and it is weak" and "we
-- have not looked". Only the first is a judgement.
--
-- lead_score_band is deliberately not the s.6 banding. The 70/50 thresholds
-- were calibrated against a full 100 and mean nothing against 65, so the
-- scorer writes 'unbanded_incomplete_coverage' until coverage is complete.

alter table public.sales_leads
  add column if not exists lead_score_breakdown jsonb,
  add column if not exists lead_score_points_available integer
    check (lead_score_points_available is null
           or (lead_score_points_available between 0 and 100)),
  add column if not exists lead_score_band text
    check (lead_score_band is null or lead_score_band in (
      'shortlist',
      'hold',
      'discard',
      'disqualified',
      -- Not a band. An admission that fewer than 100 points were on offer.
      'unbanded_incomplete_coverage'
    )),
  add column if not exists lead_score_ruleset text,
  add column if not exists lead_score_at timestamptz;

-- A score is meaningless without the denominator it was earned against, so
-- neither is allowed to exist without the other.
alter table public.sales_leads
  drop constraint if exists sales_leads_score_has_denominator;
alter table public.sales_leads
  add constraint sales_leads_score_has_denominator check (
    lead_score_at is null
    or (lead_score_points_available is not null and lead_score_ruleset is not null)
  );

create index if not exists sales_leads_score_idx
  on public.sales_leads (lead_score_band, lead_score desc);
