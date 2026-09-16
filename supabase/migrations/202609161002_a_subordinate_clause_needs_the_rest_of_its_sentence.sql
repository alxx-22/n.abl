-- A subordinate clause needs the rest of its sentence.
--
-- The letter prompt already permits building a sentence around the
-- observation. It does not require it, and Harry's Home Improvements got
-- a letter whose first line was
--
--   "When someone walks into 8 Market Place asking about a specific
--    composite door style that ends up not fitting their aperture, which
--    means going back out to measure before anything else can happen."
--
-- - a subordinate clause, a relative clause, and no main clause anywhere.
-- Capitalised and given a full stop, which is what makes it look like a
-- mistake rather than a style.
--
-- The writer should not hand over a fragment and now has a rule saying
-- so. This is the second line of defence, because the letter writer is
-- the one holding a whole sentence and can see what is missing.

update public.outreach_prompt
   set body = replace(body,
'   THE OBSERVATION GOES IN WORD FOR WORD. Copy it exactly as you were given it. You may capitalise its first letter and you may build a sentence around it - before it, after it, both. You may NOT reword it, shorten it, tidy it, split it in half or swap a synonym into it.',
'   THE OBSERVATION GOES IN WORD FOR WORD. Copy it exactly as you were given it. You may capitalise its first letter and you may build a sentence around it - before it, after it, both. You may NOT reword it, shorten it, tidy it, split it in half or swap a synonym into it.

   IF IT DOES NOT STAND AS A SENTENCE, YOU MUST BUILD THE REST OF ONE. Read it with a capital letter on the front and a full stop on the end. If it opens with "when", "after", "while", "because", "although" or "since" and never reaches a main clause, it is a fragment, and putting a full stop after a fragment is the first thing a reader notices. Add the words it needs around it - before it, after it, or both. Every word you were given still appears, in order, untouched. You are completing the sentence, not editing the observation.')
 where key = 'letter';
