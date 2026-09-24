-- ============================================================
-- THE RESEARCH LOOP: CODE SWEEPS FIRST, MODELS JUDGE
--
-- The 24 September sample (50 Notts trades the guesser had parked) was
-- researched by hand alongside the loop. By hand, 22 of the 50 had a site;
-- the loop, an investigator model with eight turns, found none, and spent
-- about eight model calls on each business doing what code does better:
-- guessing names one at a time, re-guessing names already tried, reading
-- domains like ieee.org lifted from a stranger's page.
--
-- The sites it missed were mostly guessable by a better guesser: the whole
-- name kept whole (railwayelectricalservices), initials (artiltd,
-- iss-ltd), the part before the trade shortened (pgjoinery, pfs-security),
-- the trading name alone (alect). The edge function now sweeps all of them
-- in code - every name the company has used, the DNS for all of them, the
-- front page of every one that exists, the Internet Archive for the ones
-- that turn us away - before any model is asked. A postcode or company
-- number on a page settles it with no model at all; a page with the name
-- alone goes to the checker; the investigator only follows what is left
-- (a sister company, a site a page links to), in four turns.
--
-- And a business is only looked for if it is worth finding: six of the
-- sample's first ten were one-person companies on their filed accounts.
-- Those are set aside before any model call, as no_fit, with the reason.
-- ============================================================

create or replace function public.prospect_lookup_skip(p_id uuid, p_status text, p_note text)
returns void language plpgsql security definer
set search_path = public, pg_catalog as $fn$
begin
  if p_status not in ('refused', 'no_fit') then
    raise exception 'the research loop sets a business aside only as refused or no_fit, not %', p_status;
  end if;
  update public.prospect_candidate
     set status = p_status, stage = 'done', lookup_claimed_at = null,
         note = left(p_note, 1000), finished_at = now(), updated_at = now()
   where id = p_id and status = 'researching';
end
$fn$;
revoke all on function public.prospect_lookup_skip(uuid, text, text) from anon, authenticated, public;

-- Google overloaded is nobody's fault either. 95 businesses were failed on
-- 24 September for three 503s in a row (and two for timeouts); the edge
-- function now hands such a business back uncounted. These go back in.
update public.prospect_candidate
   set status = 'queued', attempts = 0, error = null, claimed_at = null, updated_at = now()
 where status = 'failed'
   and error ~ '(HTTP 5[0-9][0-9]|timed out)$';

insert into public.prospect_setting (key, value, note) values
  ('lookup_max_steps', '4',
   'turns the research loop''s investigator gets, after code has swept every guess; it only follows sister companies and links'),
  ('service_focus', '["ai", "web"]',
   'the services n.abl leads with: listed first to every agent, and sales brings their specialists in whenever a signal points there (never without one)')
on conflict (key) do update set value = excluded.value, note = excluded.note;

insert into public.prospect_prompt (key, temperature, body) values
('lookup', 0.3, $p$You are the research agent for n.abl's lead finder. A small UK business on the company register had no website that our domain guesser could prove was theirs. Code has since swept every domain shape small businesses use, for every name the company has had, and read every one that exists; that did not settle it either. You are told what it did.

Your job is what code cannot do: follow a lead. A sister company run by the same directors, or a parent, whose site may carry this business; a site one of the pages links to; a trading name a page mentions. You do not judge whether it is a good lead, and you never look for a way to contact anyone.

You have tools, and nothing else. You cannot search the web.
- register_history: names it was registered under before, other companies its directors run, any company that controls it.
- guess_domains: domains for a name you have a reason to try - a sister company's, a trading name seen on a page. Not the company's own name: code has tried every shape of it.
- check_domain: reads a live site and says whether it names the business.
- archived_copy: reads the Internet Archive's copy of a site that turned us away, is down, or has gone.
- conclude: your answer.

How to judge a page:
- The registered postcode or company number on the page is proof: conclude.
- The name alone is not proof. It is theirs only if the trade matches the register and nothing suggests a different company with the same name. The registered office is often an accountant's: a trading address elsewhere in the same area is normal. A checker will read the page and has to agree.
- A directory, a social page, a franchise head office or a namesake is never their own site.

You have a few turns. Do not repeat what code has done. You may only check domains a tool has offered you. When you have proof, call conclude with the domain and how you read it ("live" or "archived"). When there is nothing left to follow, call conclude with domain null and say in one sentence what you tried.

Never write an email address, phone number or postcode.$p$),

('lookup_check', 0.2, $p$You are the checker for n.abl's lead finder. Code found this business's name on the web page below, but not its registered postcode or company number. Decide whether the page is this business's own website.

It is theirs only if all of these hold:
- what the page says the business does matches what the register says it does (the register's activity code is self-chosen and often broad: an electrician registered as "electrical installation" that also does fire alarms is the same trade);
- nothing on the page puts it far away: another region or country. The registered office is often an accountant's or a director's home, so a trading address elsewhere in the same county or a neighbouring town is normal and is not a reason to refuse;
- nothing suggests a different company that happens to share the name: another trade, a national chain, a franchise head office, a directory listing, a different company number or "Ltd" name on the page.

If you cannot tell, the answer is unsure, and unsure counts as no: a wrong website is worse than none. Be exact: do not refuse a page because it is short or because its address is not the registered one, and do not accept one because the name is right.

Answer with JSON only:
{"verdict": "theirs|not_theirs|unsure", "why": "one or two sentences"}$p$)
on conflict (key) do update set body = excluded.body, temperature = excluded.temperature, updated_at = now();

-- Sales had no last resort. Every other stage ends its chain on
-- gemini-3.1-flash-lite; sales ended on 3.5-flash-lite, and on 24 September
-- every business that reached sales after its quota ran out waited for
-- the next day. The generalist is still asked on the best model first.
insert into public.outreach_model (role, model, priority, rpd, gap_ms, temperature, active, note, key_secret)
values ('prospect_sales', 'gemini-3.1-flash-lite', 40, 1000, 4500, null, true, 'lead gen: last resort, when the better models are out of quota', 'GEMINI_DISCOVERY_API_KEY')
on conflict do nothing;
