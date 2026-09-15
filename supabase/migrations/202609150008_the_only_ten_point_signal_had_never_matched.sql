-- ============================================================
-- THE ONLY TEN-POINT SIGNAL HAD NEVER MATCHED
--
-- STATUS: applied to the live project on 15 September 2026.
--
-- Every re-scored lead landed between 35 and 44, and the reason turned
-- out not to be the leads. Of the codes in scoring-model.md 5.4 that a
-- homepage can honestly establish, exactly one is tier 1 and worth ten
-- points - quote_by_phone - and across twenty-four page reads it had
-- matched zero times. Everything else on the page is a three-point
-- tier 2 code, so the dimension could only ever contribute nine or so,
-- and the ceiling sat where it sat.
--
-- The pattern was the problem:
--
--   (?:call|phone|ring|telephone)\s+(?:us|the office|our team|now)?
--   [^.]{0,40}?(?:for a (?:quote|price|estimate)|to book|...)
--
-- It demanded the exact words "for a quote". Businesses write "for a
-- FREE quote", "for a no-obligation quotation", "for your price", or
-- they put the intent first - "For a free quotation call 0115...". None
-- of those match. The catalogue entry reads '"Call us for a quote", or
-- a stated quote turnaround, on obviously standardised work'; the
-- regex implemented the quotation marks rather than the sentence.
--
-- This is a bug fix, not a weight change. No tier moves, no threshold
-- moves, nothing is added to the catalogue that section 5.4 does not
-- already list. Two keys now map to quote_by_phone, which the scorer
-- already handles - it counts a code once however many patterns hit it,
-- the same way booking and livechat both mean third_party_portal.
--
-- printed_form is the other tier 1 code a homepage can establish, and
-- it had no pattern at all.
--
-- STILL UNIMPLEMENTED, and worth knowing: role_addresses and
-- fleet_visible (tier 2) are visible on a homepage and have no pattern;
-- new_director and late_filings (tier 3, five points each) are register
-- facts we do not currently pull. That is roughly sixteen more points
-- of headroom, none of it invented.
-- ============================================================

-- Verified against the shapes businesses actually use before it was
-- written here: see the false-positive list in the same exercise -
-- "Call 999 in an emergency", "Book online in under a minute" and
-- "Contact us using the form below" must not match, and do not.
update public.outreach_page_signal
   set pattern = '(?:call|phone|ring|telephone|give us a (?:call|ring))\b[^.!?]{0,70}?\b(?:quot|price|estimate|book|appointment|arrange a|order)',
       description = 'the site asks people to telephone for a quote, a price or a booking rather than doing it online'
 where key = 'quote_by_phone';

insert into public.outreach_page_signal (key, pattern, flags, description, signal_code, tier) values
  ('quote_by_phone_first',
   '\b(?:for (?:a |an |your )?(?:free |no[- ]obligation |instant |fast |quick )*(?:quot(?:e|ation)|price|estimate)|to book|to arrange|to order)\b[^.!?]{0,50}?(?:call|phone|ring|telephone|contact us on)',
   'i',
   'the site puts the ask first and the telephone number after it - "for a free quotation call ..."',
   'quote_by_phone', 1),
  ('printed_form',
   '(?:print(?:\s+(?:off|out))?|download|complete)\b[^.!?]{0,60}?\bform\b[^.!?]{0,80}?(?:return|post it|email it|bring it|hand it|sign)',
   'i',
   'a form has to be downloaded or printed, filled in by hand and sent back',
   'printed_form', 1)
on conflict (key) do update
  set pattern = excluded.pattern, flags = excluded.flags,
      description = excluded.description, signal_code = excluded.signal_code,
      tier = excluded.tier, active = true;
