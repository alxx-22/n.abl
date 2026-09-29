-- ============================================================
-- TARGETS FOR BOOKING-LED BUSINESSES
--
-- The owner, 28 September 2026: look at fast food, coffee shops,
-- hairdressers, anything that runs on bookings or needs a website, to
-- sell an AI call agent that books appointments. The service knowledge
-- (service_knowledge_f24c0287) now carries the call agent under AI and
-- says when the phone, not the software, is the gap.
--
-- Three targets, both territories, trading three years or more. Every
-- SIC code below is in the vendored SIC 2007 table. The agents still
-- need a page that sends customers to the phone: a walk-in-only café or
-- a salon fully booked online scores low for the call agent on its own
-- evidence, whatever the SIC code says.
--
-- Most of these sectors are sole traders as often as companies, and the
-- register only has companies. A limited company is a corporate
-- subscriber, which is what the outreach rules are written for.
--
-- Saved, never running: pressing Run is still the only thing that
-- starts one.
-- ============================================================

insert into public.prospect_target (name, towns, sic_codes, incorporated_to, note) values
  ('Salons and barbers',
   array['Nottingham', 'Ilkeston', 'Stratford-upon-Avon', 'Alcester', 'Redditch', 'Studley', 'Henley-in-Arden', 'Evesham'],
   array['96020', '96040'],
   date '2023-09-30',
   'Hair, beauty, barbers, nails, spas and massage. Appointments all day, and the phone rings while every pair of hands is on a client: the AI call agent. Many are on Fresha, Booksy, Treatwell or Phorest already; the measured line names it, and the question is who still phones.'),
  ('Takeaways, cafés and restaurants',
   array['Nottingham', 'Ilkeston', 'Stratford-upon-Avon', 'Alcester', 'Redditch', 'Studley', 'Henley-in-Arden', 'Evesham'],
   array['56101', '56102', '56103'],
   date '2023-09-30',
   'Phone orders and table bookings taken by whoever is free in the kitchen or on the floor: the AI call agent; web where nothing can be ordered or booked online. Walk-in-only cafés and franchisees fall out on their own pages.'),
  ('Booked by phone',
   array['Nottingham', 'Ilkeston', 'Stratford-upon-Avon', 'Alcester', 'Redditch', 'Studley', 'Henley-in-Arden', 'Evesham'],
   array['45200', '75000', '85530', '93130', '96090'],
   date '2023-09-30',
   'Garages (MOTs and services), vets, driving schools, gyms and studios, groomers and other appointment trades. Bookings by phone while the people who take them are under a car, in a consult or on a lesson: the AI call agent. 96090 is broad: their own site decides.')
on conflict (name) do nothing;
