-- Their address is not ours, and neither belongs in the body.
--
-- The letter prompt says "no postal address", meaning do not repeat OUR
-- address because the footer already carries it. It says nothing about
-- THEIRS, and the two are opposite rules that happen to share a word: the
-- first is about printing a thing twice, the second is about what a first
-- line proves.
--
-- Harry's Home Improvements got a letter opening "When someone walks into
-- 8 Market Place...". It came off their own page, so every guard passed.
-- It still reads like a mail merge, because reading somebody's address
-- back to them proves only that we can read.

update public.outreach_prompt
   set body = replace(body,
'THE OPENING LINE, SPECIFICALLY',
'NEVER THEIR ADDRESS. Not the street, not the number, not the postcode - even though it is on their page, which is the only place you could have got it. That is a different rule from the one above about the postal address in the footer: that one is about printing ours twice, this one is about what an opening line proves. A first line containing a stranger''s own street number reads as a database merge no matter how it got there.

THE OPENING LINE, SPECIFICALLY')
 where key = 'letter';
