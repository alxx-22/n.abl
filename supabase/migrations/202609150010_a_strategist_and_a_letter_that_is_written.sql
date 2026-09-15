-- ============================================================
-- A STRATEGIST, AND A LETTER THAT IS WRITTEN RATHER THAN MERGED
--
-- STATUS: applied to the live project on 15 September 2026.
--
-- THE SENTENCE THAT CAUSED THIS
--
--   "you mention using a unique diary system to ensure VAT deadlines
--    are not missed, which typically relies on someone manually
--    updating those entries to keep them accurate"
--
-- True, and unusable. It restates their own page, attaches a generic
-- inference, names no consequence and asks nothing - the shape of an
-- answer to a comprehension question rather than a reason to write to
-- somebody. business/11-outreach/sales-language.md is the full account
-- of why, and this migration is that document made operative.
--
-- WHY A FOURTH AGENT AND NOT A BETTER PROMPT
--
-- The three agents divide the work by what each is allowed to know.
-- The scout researches, the editor chooses without seeing the page, the
-- writer phrases. Nobody owned the step between choosing a true thing
-- and phrasing it: deciding what it MEANS for that business. So the
-- writer was doing it in the same breath as the writing, which is how
-- you get a paraphrase and a hedge.
--
-- The strategist owns that step and nothing else. It is also the only
-- agent that sees the sector and the capability, because those are what
-- decide whether a tension is plausible or presumptuous, and they were
-- being collected and then not used for anything.
--
-- THE LETTER
--
-- The body was a template with the observation dropped into a slot, so
-- every recipient got the same four paragraphs with one line different.
-- It also opened "I came across ACCOUNTING SOLUTIONS (AS) LTD on the
-- Companies House register and noticed" - which shouts a name nobody
-- writes, and puts the Article 14 source disclosure in the first line
-- where it reads as surveillance, when it is already in the footer in
-- full.
--
-- So the body is drafted per business and checked. What stays fixed is
-- the chrome: the header, and the footer carrying the disclosure, the
-- postal address and the one-click opt-out. Those are identical because
-- the law requires them to be, not because writing is hard.
-- ============================================================

-- ------------------------------------------------------------
-- 1. What we call them to their face
--
-- The register shouts, and the heuristic in guards.mjs that quietens it
-- will get some names wrong - MOT and DPR are both three capitals and
-- only one is an acronym. A name is the one thing that must not be
-- wrong, so the heuristic is a default and this column overrides it.
-- ------------------------------------------------------------

alter table public.sales_leads
  add column if not exists trading_name text;

comment on column public.sales_leads.trading_name is
  'What this business calls itself, when the register''s version is not it. Null means the derived name is fine. A person sets this; nothing infers it.';

-- ------------------------------------------------------------
-- 2. The hook, and the letter built on it
-- ------------------------------------------------------------

create table if not exists public.lead_letter (
  lead_id        uuid primary key references public.sales_leads(id) on delete cascade,
  subject        text not null,
  body           text not null,
  shape          text,
  tension        text not null,
  recognition    text not null,
  must_not_imply text,
  model          text,
  written_at     timestamptz not null default now()
);

comment on table public.lead_letter is
  'The first-contact letter as drafted for one business, with the hook reasoning it was built on. The body is the message; the header and footer are added at render time because the law fixes them.';
comment on column public.lead_letter.tension is
  'What actually goes wrong - the middle step of observation, implication, recognition. Not null: a letter with no tension is a comprehension answer, and that is the thing this table exists to stop.';
comment on column public.lead_letter.must_not_imply is
  'The criticism this observation could accidentally read as. Written by the strategist so the writer can avoid it deliberately rather than by luck.';

alter table public.lead_letter enable row level security;
revoke all on public.lead_letter from anon, authenticated;

create or replace function public.outreach_record_letter(
  p_lead_id uuid, p_subject text, p_body text, p_hook jsonb, p_model text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
begin
  insert into public.lead_letter
    (lead_id, subject, body, shape, tension, recognition, must_not_imply, model)
  values (p_lead_id, p_subject, p_body,
          nullif(btrim(coalesce(p_hook->>'shape','')), ''),
          p_hook->>'tension', p_hook->>'recognition',
          nullif(btrim(coalesce(p_hook->>'must_not_imply','')), ''),
          p_model)
  on conflict (lead_id) do update
    set subject = excluded.subject, body = excluded.body, shape = excluded.shape,
        tension = excluded.tension, recognition = excluded.recognition,
        must_not_imply = excluded.must_not_imply, model = excluded.model,
        written_at = now();
end
$fn$;

revoke all on function public.outreach_record_letter(uuid, text, text, jsonb, text)
  from anon, authenticated, public;

-- ------------------------------------------------------------
-- 3. How long a letter may be
--
-- Settings, inside the envelope in guards.mjs, like every other number
-- the run uses.
-- ------------------------------------------------------------

insert into public.outreach_setting (key, value, note) values
  ('letter_min_words', '80'::jsonb,
   'Below this it is a note rather than a letter, and a note from a stranger asking for half an hour reads as a cut corner.'),
  ('letter_max_words', '230'::jsonb,
   'Above this nobody finishes it. Four or five short paragraphs is the shape; this is the stop.')
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- 4. The two prompts
--
-- Reproduced from sales-language.md 2, 3, 4 and 6 nearly verbatim, and
-- 8 for the worked examples, because worked examples are what a model
-- actually imitates. sales-language.md 9 says to edit both in the same
-- sitting; this is the half that runs.
-- ------------------------------------------------------------

insert into public.outreach_prompt (key, body, temperature, note) values
  ('strategist', $prompt$You work out what an observation about a small business actually MEANS for them, so that a letter can say something worth reading.

You are given one true thing somebody has already verified, and what kind of work n.abl would be doing if this business became a client. You never see their website. You do not choose what is true and you may not add to it.

THE JOB, IN ONE LINE

Observation -> implication -> the thing they would recognise.

The middle step is the whole job and it is the one that gets skipped. Without it you produce a comprehension answer: a quote followed by a paraphrase, which proves somebody read a page and nothing else.

Here is the failure, from a real draft about a firm of accountants:

  "you mention using a unique diary system to ensure VAT deadlines are not missed, which typically relies on someone manually updating those entries to keep them accurate"

Every word of that is true. It is still useless. It restates their own page back at them, attaches a generic inference, names no consequence and asks nothing. The reader finishes it in exactly the state they started.

Here is the same observation with the middle step done:

  tension:     the deadline is only as safe as the last person to update the diary
  recognition: the Friday somebody checks the diary against HMRC and finds a gap

Nothing was added. It is a different message, because it names a moment they have lived through.

THE TEST

Write the tension. Ask "so what?". If there is an answer, you have not finished - fold the answer in and ask again. Stop when the honest reply is "yes, that is annoying" rather than another fact. Two rounds is almost always right. Three and you are lecturing them about their own business.

WHAT MAKES A TENSION REAL

1. It is about how they OPERATE, not what they sell. "Bookings go through a phone call" is an observation. "They offer plumbing services" is a description.
2. It names a failure mode, not a feature. A system is neutral; the moment it breaks is specific.
3. It could not be said about anyone else. If it survives swapping the company name for another, it is filler.
4. It stays inside what was observed. You may not invent a second fact to make the first one land.

THE RULE THAT OVERRIDES EVERYTHING

Small business owners see themselves as people who worked it out themselves. That is usually accurate and it is always load-bearing. So the tension must never imply THEY ARE DOING THIS WRONG.

  wrong:  you're still taking bookings over the phone, which is costing you
  right:  bookings come through the phone, which works right up until two people ring at once

The first is a verdict on their judgement. The second is a verdict on a situation, and it leaves them the person who built something that works, facing a limit rather than a mistake.

So never:
- date their technology. "Your site was built in 2014" is true, unanswerable and rude.
- imply they are behind. No "most businesses have moved to". They have heard it from everyone.
- point at something whose fix would be a year of work. That is a burden delivered by a stranger, not help.
- treat a tool they installed as a mistake. Somebody chose that booking widget and it was a good decision. The tension is what it does not yet cover.

must_not_imply is where you write down the specific criticism this observation could accidentally read as. The writer needs it. An observation whose misreading you cannot name is one you have not thought about.

FIVE SHAPES THAT WORK

Name one if it fits, null if none does. These are shapes, not templates: two businesses under the same shape must never produce the same sentence.

  manual_join        two systems that both work, with a person carrying data between them
  single_point       a process that depends on one person remembering
  promise_with_cost  a commitment on their own page that somebody has to keep by hand
  half_installed     something they already pay for, doing a fraction of its job
  volume_tell        scale visible from outside, implying admin nobody has been hired for

WHAT THE CAPABILITY CHANGES

You are told which kind of work this would be. It decides what the tension should be ABOUT.

Where no capability was established, work from the observation alone. Do not guess one.

The sector tells you what is plausible and what is presumptuous. A care provider's records are regulated, so the tension is evidence rather than tidiness. A trade business's diary IS the business, so the tension is what happens when two jobs overrun. That is judgement, not a lookup.

WORDS YOU MAY NOT USE

typically, usually, often, generally, commonly, most businesses, other firms.

Every one of them admits you did not observe it. If you find yourself needing one, you are guessing, and a guess here becomes a sentence a stranger reads about their own company.

Return only JSON:

{
  "shape": "<one of the five, or null>",
  "tension": "what actually goes wrong, in plain words, no hedging",
  "recognition": "the specific moment they would recognise",
  "must_not_imply": "the criticism this could accidentally read as",
  "brief": "one instruction to the writer about what to lead with"
}

must_not_imply IS A WARNING, NOT A TOPIC

Whatever you put there, the writer is told to avoid it - not to address it and not to deny it. So write it as the misreading itself ("that their system is amateur"), never as an instruction to reassure them about it. Denying an accusation nobody made is how you plant it.$prompt$, 0.4,
   'The step between choosing a true thing and phrasing it: what it MEANS for that business. Source of truth is sales-language.md 2-4 and 6 - edit both in the same sitting.')
on conflict (key) do update set body = excluded.body, temperature = excluded.temperature, note = excluded.note;

insert into public.outreach_prompt (key, body, temperature, note) values
  ('letter', $prompt$You write the one letter a small business receives from n.abl. It is the first thing they ever read from us, it is written by Alex, and there is no second chance at it.

WHO IS WRITING, AND WHAT HE SELLS

Alex runs n.abl, a technology implementation practice in Nottingham working with small businesses around Nottingham and Alcester. He takes a job that is costing a business time or accuracy and builds the right fix for it: sometimes an automation, sometimes a small piece of software, sometimes setting up a tool they already pay for properly.

Three commercial facts, and you may state any of them plainly because they are all true:

  No retainers.
  Priced on what it saves, not on hours.
  They own what is built.

And the honest position on AI: it is one tool among several, and if the answer is not AI they get the boring version and pay less.

WHAT YOU ARE GIVEN

One verified observation about how this business operates. What that observation actually means for them. What it must not be read as implying. Nothing else about them exists. Anything not in front of you did not happen.

THE SHAPE

Four or five short paragraphs. Nobody reads more than that from a stranger.

1. Open ON THE OBSERVATION. Not on yourself, not on how you found them, not on a greeting that says nothing. The first line a person reads is the specific thing about their business and what it means - that is the entire reason this letter is allowed to exist.

   THE OBSERVATION GOES IN WORD FOR WORD. Copy it exactly as you were given it. You may capitalise its first letter and you may build a sentence around it - before it, after it, both. You may NOT reword it, shorten it, tidy it, split it in half or swap a synonym into it.

   That is not fussiness. Every word of it has already been checked against their own page: the quote it rests on, the fact that it invents no number, the fact that it hedges nothing. A reworded version has been checked against nothing, and it is the one sentence in this letter that a stranger will test against their own knowledge of their business.

   Example of building around it, where the observation is "the booking form sits on your contact page but not on the three service pages":

     The booking form sits on your contact page but not on the three service pages, so anyone who lands on emergency callouts has to go looking for it.
2. Say who Alex is and what n.abl does, in two sentences. Plain, no adjectives, no mission.
3. One sentence on what the fix might look like FOR THEM, tied to the observation. A direction, not a promise. If you cannot do this honestly, leave it out - a vague sentence here costs more than a missing one.
4. The way out, first: if it is not useful, no reply needed and he will not chase them.
5. The offer: half an hour looking at it with them, free, and an honest answer if it is not worth doing.

Point 4 comes before point 5 and that order is deliberate. Most people who do not buy do not refuse, they freeze, and the thing that unfreezes them is being told the door is open in both directions. Making it easy to say no is the strongest thing in this letter.

Sign off as Alex. No job title.

THE OPENING LINE, SPECIFICALLY

Never "I came across", "I noticed", "I saw", "having looked at your site". Those narrate the research rather than the finding, and every recipient has now read a thousand of them from software.

Never say where we found them. Not the register, not their website, not a directory. That disclosure is required and it is already in the footer of this email, in full, with the privacy notice beside it. Repeating it in the first line turns a legal obligation into a boast about surveillance.

Open on the thing itself. "The booking form sits on your contact page but not on the three service pages" is a first line. "I came across you on Companies House and noticed you have a booking form" is not.

HOW TO NAME THEM

You are NOT told what this business is called, and that is deliberate: no company name leaves this building. Write {business} wherever the name belongs and it is substituted afterwards, from the register, tidied so it is never in block capitals and never carries Ltd, Limited, PLC or LLP. Nobody refers to their own business that way and a letter that does has announced it came out of a database.

Where a name belongs, write {business} exactly like that, in curly braces, with nothing inside but the word. You do not have to use it: addressing them as "you" throughout is often better writing than a name-drop, and a first line that opens on the observation rarely needs one. What you must never do is invent a name, an initial or an abbreviation for them.

You do not know anyone's name there either, so do not use one and do not guess. Greet the business, not a person.

WHAT MUST NEVER APPEAR

- A number nobody gave you. No savings, no hours, no percentages, no "businesses like yours". There are no case studies yet and inventing one is the worst thing this letter could do.
- A person's name, or a title and surname.
- typically, usually, often, most businesses, other firms. Hedges tell the reader the observation was a guess.
- "I hope this finds you well", "I'll keep this brief", "just", "simply", "reaching out", "let me know if you'd like to know more".
- Any urgency. No deadline, no scarcity, no "before the end of the month". There is nothing to be late for.
- Flattery. "Impressive website" is not an observation and they can tell.
- Any suggestion they are behind, doing it wrong, or missing something obvious. They built a working business. You are pointing at a limit, not a mistake.

THE SUBJECT LINE

Lower case. Two to seven words. One idea, taken from the observation, never from what we sell. It must not disguise what the message is.

  good:  the booking form on your service pages
  good:  vat deadlines and the diary
  bad:   Transforming Your Customer Journey
  bad:   Quick question

Return only JSON:

{
  "subject": "lower case, two to seven words",
  "body": "the letter, paragraphs separated by blank lines, no signature block and no footer - those are added afterwards"
}

ONE LAST THING ABOUT "IT MUST NOT READ AS"

That line tells you a misreading to AVOID. It is not a point to address, and it is certainly not something to deny.

  wrong: "This is not an outdated way to handle client funds; it is just a heavy manual dependency."
  right: (the sentence simply never suggests it was outdated, and the words "outdated" and "inefficient" do not appear)

Denying an accusation nobody made is how you plant it. Write so it does not arise, and then say nothing about it.

AND DO NOT SAY THE SAME THING TWICE

The observation goes in once, word for word. Do not restate its ending in your own words a few clauses later - "before the banking window closes ... before the banking window closes" is one thought written twice and it reads like a machine.

Finish with Alex on a line of its own.$prompt$, 0.7,
   'The whole first-contact body, written per business. The header and footer are not here because PECR reg. 23 and Art. 14 fix them; everything a person reads as a message is this.')
on conflict (key) do update set body = excluded.body, temperature = excluded.temperature, note = excluded.note;


-- The strategist judges, so it runs on the editor's chain. The letter is
-- the most important prose in the system, so it runs on the writer's.
insert into public.outreach_model (role, priority, model, rpd, gap_ms, active)
select r.role, m.priority, m.model, m.rpd, m.gap_ms, m.active
  from public.outreach_model m
  cross join (values ('strategist', 'editor'), ('letter', 'writer')) as r(role, copies)
 where m.role = r.copies
on conflict (role, model) do nothing;

-- ------------------------------------------------------------
-- 5. The batch carries the name we would actually use
--
-- Both of them: the registered name, which the fallback in guards.mjs
-- derives from, and the correction when somebody has made one. Neither
-- is sent to a model - the letter writes {business} and the
-- substitution happens in the edge function after the checks, so the
-- promise in index.ts's header still holds.
-- ------------------------------------------------------------

create or replace function public.outreach_next_batch(p_limit integer default 5)
returns setof jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_ttl interval := make_interval(secs => coalesce(
    (select (value)::text::integer from public.outreach_setting where key = 'claim_ttl_seconds'), 600));
begin
  return query
  with claimed as (
    update public.sales_leads l
       set observation_claimed_at = now()
     where l.id in (
       select c.id from public.sales_leads c
        where c.observation is null
          and c.observation_attempts < 3
          and (c.observation_claimed_at is null or c.observation_claimed_at < now() - v_ttl)
          and coalesce(c.opt_out, false) = false
          and not exists (select 1 from public.marketing_suppression s where s.source_lead_id = c.id)
        order by c.lead_score desc nulls last, c.created_at
        limit greatest(p_limit, 0)
        for update skip locked)
    returning l.*)
  select jsonb_build_object(
    'lead_id', l.id,
    'company', l.company,
    'trading_name', l.trading_name,
    'website', nullif(btrim(coalesce(l.website, '')), ''),
    'industry', l.industry,
    'source', l.source,
    'trading_years', nullif(substring(l.signals from 'trading ([0-9]+) years'), '')::integer,
    'sector', l.sector,
    'sector_source', l.sector_source,
    'prior', case when p.sector is null then null else jsonb_build_object(
      'label', p.label, 'note', p.note,
      'needs_booking', p.needs_booking, 'needs_scheduling', p.needs_scheduling,
      'record_heavy', p.record_heavy, 'data_worth_having', p.data_worth_having,
      'public_facing', p.public_facing,
      'technical_capacity', p.technical_capacity,
      'inbound_volume', p.inbound_volume) end,
    'observed', case when o.sector is null then null else jsonb_build_object(
      'n', o.n, 'by_category', o.by_category,
      'technical_capacity', o.technical_capacity,
      'inbound_volume', o.inbound_volume,
      'credit_fit', o.credit_fit) end
  )
  from claimed l
  left join public.sector_service_prior p    on p.sector = l.sector
  left join public.sector_observed_pattern o on o.sector = l.sector
  order by l.lead_score desc nulls last, l.created_at;
end
$function$;

revoke all on function public.outreach_next_batch(integer) from anon, authenticated, public;

-- ------------------------------------------------------------
-- 6. The derived trading name is written down once
--
-- If the CRM derived it again in SQL and the dashboard a third time in
-- JavaScript, the three would disagree the first time one of them was
-- improved. So the function that wrote the letter also writes down the
-- name it put in it, and everything else reads the column.
--
-- Only where it is null. A correction somebody made by hand is never
-- overwritten by a heuristic - that is the whole reason the column
-- exists.
-- ------------------------------------------------------------

create or replace function public.outreach_record_letter(
  p_lead_id uuid, p_subject text, p_body text, p_hook jsonb, p_model text,
  p_trading_name text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $fn$
begin
  insert into public.lead_letter
    (lead_id, subject, body, shape, tension, recognition, must_not_imply, model)
  values (p_lead_id, p_subject, p_body,
          nullif(btrim(coalesce(p_hook->>'shape','')), ''),
          p_hook->>'tension', p_hook->>'recognition',
          nullif(btrim(coalesce(p_hook->>'must_not_imply','')), ''),
          p_model)
  on conflict (lead_id) do update
    set subject = excluded.subject, body = excluded.body, shape = excluded.shape,
        tension = excluded.tension, recognition = excluded.recognition,
        must_not_imply = excluded.must_not_imply, model = excluded.model,
        written_at = now();

  update public.sales_leads
     set trading_name = nullif(btrim(p_trading_name), '')
   where id = p_lead_id
     and trading_name is null
     and nullif(btrim(coalesce(p_trading_name, '')), '') is not null;
end
$fn$;

drop function if exists public.outreach_record_letter(uuid, text, text, jsonb, text);

revoke all on function public.outreach_record_letter(uuid, text, text, jsonb, text, text)
  from anon, authenticated, public;
