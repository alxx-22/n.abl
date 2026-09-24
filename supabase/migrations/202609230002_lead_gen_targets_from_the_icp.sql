-- ============================================================
-- LEAD GEN TARGETS FROM THE ICP
--
-- Seven saved targets, from business/10-lead-sourcing/targets.md, which
-- takes them from the ideal customer profile (01-positioning), the
-- territories in its section 2, and the sectors it rates strong in
-- section 4. Every SIC code was checked against the vendored SIC 2007
-- table. All seven want three or more years' trading.
--
-- Saved, never running: pressing Run in the Lead gen tab is still the
-- only thing that starts one. Weak-fit sectors (retail, salons,
-- restaurants, pubs, takeaways) are deliberately absent - the first live
-- test's best-scored business was a takeaway, on no evidence.
-- ============================================================

insert into public.prospect_target (name, towns, sic_codes, incorporated_to, note) values
  ('Notts trades',
   array['Nottingham', 'Ilkeston'],
   array['43210', '43220', '43290', '43330', '43910', '43991', '80200'],
   date '2023-09-30',
   'Electricians, plumbers and heating, installers, roofers, security. The strongest sector, and the first pass the lead-sourcing plan names: job sheets, quotes from one spreadsheet, certificate expiries.'),
  ('Redditch-Alcester engineering',
   array['Redditch', 'Alcester', 'Studley', 'Stratford-upon-Avon', 'Henley-in-Arden'],
   array['25110', '25500', '25610', '25620', '25730', '25930', '25990', '29320', '30300'],
   date '2023-09-30',
   'Fabrication, machining, tooling, auto and aerospace supply. Whiteboard scheduling, stock counts, delivery notes matched to invoices by hand.'),
  ('Property, lettings and FM',
   array['Nottingham', 'Stratford-upon-Avon', 'Redditch', 'Alcester'],
   array['68310', '68320', '81100', '81210'],
   date '2023-09-30',
   'Letting agents, property managers, facilities and cleaning firms. Inspections, certificate expiries, landlord statements, customer-facing sites.'),
  ('Alcester-side trades',
   array['Alcester', 'Redditch', 'Studley', 'Stratford-upon-Avon', 'Henley-in-Arden'],
   array['43210', '43220', '43290', '43330', '43910', '43991', '80200'],
   date '2023-09-30',
   'The trades target, in the second territory.'),
  ('Professional practices',
   array['Nottingham', 'Stratford-upon-Avon', 'Redditch', 'Alcester'],
   array['69102', '69201', '69202', '71111', '74902', '66220', '78109'],
   date '2023-09-30',
   'Solicitors, accountants, architects, surveyors, brokers, recruiters. Document-heavy and nearly always with a site; mind the advice boundary.'),
  ('Notts wholesale',
   array['Nottingham', 'Ilkeston'],
   array['46690', '46730', '46740', '46900'],
   date '2023-09-30',
   'Trade and builders merchants, machinery and general wholesale. Price lists reissued by hand, purchase orders retyped.'),
  ('Stratford venues',
   array['Stratford-upon-Avon', 'Alcester', 'Henley-in-Arden'],
   array['55100', '55209', '56210', '82301', '82302'],
   date '2023-09-30',
   'Hotels, holiday lets, event caterers, exhibition and conference organisers. Manual bookings you can see from outside. Not pubs or restaurants.')
on conflict (name) do nothing;
