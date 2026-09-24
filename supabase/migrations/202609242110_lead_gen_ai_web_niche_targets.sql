-- ============================================================
-- TARGETS FOR THE AI + WEB NICHE
--
-- The owner, 24 September 2026: AI and web above all else. The niche
-- research that followed (business/10-lead-sourcing/niche-ai-web.md)
-- ranked eleven candidate sectors on how concrete the AI job and the web
-- job are, how visible the need is from outside, how much room vendors
-- leave, and how many there are in the two territories. Two came top:
--
--   Report practices - building surveyors, structural engineers who
--   inspect, fire risk and health-and-safety assessors. The report is the
--   product and the write-up is the bottleneck (AI); the quote is a phone
--   call while national firms quote online (web).
--
--   Independent venues - every enquiry waits on an email reply (AI), and
--   availability and prices live in a PDF (web).
--
-- Trades stay a target, for automation and software. Every SIC code below
-- was checked against the vendored SIC 2007 table. Saved, never running:
-- pressing Run is still the only thing that starts one.
-- ============================================================

insert into public.prospect_target (name, towns, sic_codes, incorporated_to, note) values
  ('Report practices',
   array['Nottingham', 'Ilkeston', 'Stratford-upon-Avon', 'Alcester', 'Redditch', 'Studley', 'Henley-in-Arden', 'Evesham'],
   array['71129', '71122', '74909', '74902'],
   date '2023-09-30',
   'The AI + web niche: surveyors, structural engineers, fire risk and H&S assessors, whose product is a written report. AI drafts the report from site notes for the professional to check and sign; web puts the quote, booking and deposit on their site. 74909 is broad: their own site decides.')
on conflict (name) do nothing;

update public.prospect_target
   set towns = array['Stratford-upon-Avon', 'Alcester', 'Henley-in-Arden', 'Studley', 'Redditch', 'Evesham', 'Nottingham', 'Newark', 'Southwell'],
       sic_codes = array['55100', '55209', '56210', '93290'],
       note = 'The second AI + web niche: independent wedding and event venues. Availability, prices and show-rounds by email and PDF (web); the same enquiry answered by hand, slowly (AI). Not pubs, restaurants, hotel groups or trusts.',
       updated_at = now()
 where name = 'Stratford venues' and not running;
