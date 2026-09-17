-- A navigation bar is on the page and says nothing.
--
-- The quote guard asks one question - is this span of characters
-- literally in the page text - and that question is worth asking,
-- because it is what makes the editor's blindness safe. It is also
-- satisfied by the menu.
--
-- Approach Personnel's angle rests on this, and it passed every check:
--
--   "Candidate Registration Links Home Hiring talent Who we are Live
--    jobs Work for us News Client Enquiry Candidate Registration"
--
-- From which the pipeline concluded that "registrations land in a
-- general queue where someone has to read the details before deciding
-- which sector desk needs to work them". Nobody said that. It was
-- inferred from the existence of two menu items, and inferring from
-- navigation is indistinguishable from guessing - which is the one
-- thing the quote rule was built to stop.
--
-- One of forty-four, so a rule rather than a purge. The scout is the
-- only stage that can catch it: the editor never sees the page, and by
-- the writer's turn the quote has already been certified true.

update public.outreach_prompt
   set body = replace(body,
'A quote must be a span of characters copied exactly from the page text you were given. Not a paraphrase, not a tidied version, not a sentence assembled from two places. It is checked literally, and a quote that does not match is thrown away along with the claim resting on it.',
'A quote must be a span of characters copied exactly from the page text you were given. Not a paraphrase, not a tidied version, not a sentence assembled from two places. It is checked literally, and a quote that does not match is thrown away along with the claim resting on it.

IT MUST ALSO BE SOMETHING THEY WROTE ABOUT THEMSELVES. The page text you are given includes the navigation, the footer links, the cookie banner and the button labels. All of that is literally on the page, so all of it passes the check above, and none of it is a thing the business said. "Home Hiring talent Who we are Live jobs News Client Enquiry" is a menu. A menu tells you which pages exist and nothing whatever about how the work is done, so an angle built on one is not an observation, it is a guess wearing a quote.

The test: could this span have been written by somebody who has never seen the business, working from a list of standard website sections? If yes, it is furniture. Quote the sentences where they explain, promise, describe or offer something - those are the ones with a person behind them.')
 where key = 'scout';
