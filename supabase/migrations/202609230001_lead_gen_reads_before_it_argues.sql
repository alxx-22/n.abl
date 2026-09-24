-- ============================================================
-- LEAD GEN READS BEFORE IT ARGUES
--
-- The first live test (Alcester, 23 September) ran every stage and got
-- two things wrong, both about evidence:
--
--   * A takeaway scored 55 for web because no guessed domain existed.
--     "We did not guess its site" was read as "it has no site".
--   * Web was pitched on a signal about an overdue filing - a signal
--     that pointed at nothing we sell, and at a business behind on its
--     paperwork.
--
-- So, in the edge function and here:
--
--   refused   the register says it is not trading or cannot be trusted
--             to pay (dormant accounts, insolvency, liquidation, not
--             active, proposal to strike off). Ended before any model
--             call or any fetch of its site.
--   no_site   no website could be found to read. Parked before any
--             model call; a person who knows the site adds it
--             (prospect_set_website) and the business goes back to
--             research with it.
--   caution   behind on accounts or the confirmation statement. The
--             argument goes ahead, but no service may score above
--             caution_ceiling.
--
-- Signals now name the services they point to, and code refuses a
-- pitch or a proposal resting only on signals that point elsewhere. The
-- prompts below ask for that shape.
-- ============================================================

-- ---------- two new ends to a business ----------

alter table public.prospect_candidate drop constraint if exists prospect_candidate_status_check;
alter table public.prospect_candidate add constraint prospect_candidate_status_check
  check (status in ('queued', 'working', 'scored', 'no_fit', 'disputed',
                    'failed', 'promoted', 'dismissed', 'no_site', 'refused'));

alter table public.prospect_candidate add column if not exists note text;
comment on column public.prospect_candidate.note is
  'Why a business ended where it did, when code ended it: refused by the register, or parked for having no website to read.';

-- ---------- finishing, with the reason ----------

drop function if exists public.prospect_finish(uuid, text, integer, jsonb, jsonb);
create or replace function public.prospect_finish(
  p_id uuid, p_status text, p_lead_score integer, p_services jsonb,
  p_state jsonb default null, p_note text default null)
returns void language sql security definer
set search_path = public, pg_catalog as $fn$
  update public.prospect_candidate
     set stage = 'done', status = p_status,
         lead_score = case when p_lead_score is null then null else least(greatest(p_lead_score, 0), 100) end,
         services = p_services, state = coalesce(p_state, state),
         note = left(nullif(btrim(coalesce(p_note, '')), ''), 1000),
         error = null, claimed_at = null, finished_at = now(), updated_at = now()
   where id = p_id and p_status in ('scored', 'no_fit', 'disputed', 'no_site', 'refused')
$fn$;
revoke all on function public.prospect_finish(uuid, text, integer, jsonb, jsonb, text) from anon, authenticated, public;

-- ---------- a person adds the website the guesser missed ----------

-- The site is then trusted as theirs (a person looked), but it still has
-- to load and robots.txt still has the last word. The old transcript is
-- deleted with the retry, as prospect_retry does: a log mixing two runs
-- would read as one argument.
create or replace function public.prospect_set_website(p_id uuid, p_url text)
returns void language plpgsql security definer
set search_path = public, pg_catalog as $fn$
declare
  v_url text := btrim(coalesce(p_url, ''));
begin
  if v_url !~* '^https?://' then v_url := 'https://' || v_url; end if;
  if v_url !~* '^https?://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:[0-9]+)?(/[^[:space:]]*)?$' then
    raise exception 'that is not a web address';
  end if;
  if not exists (select 1 from public.prospect_candidate where id = p_id and status <> 'promoted') then
    raise exception 'no such business, or it is already a lead';
  end if;
  delete from public.prospect_round where candidate_id = p_id;
  update public.prospect_candidate
     set website = v_url, website_confirmed_by = array['a person'], website_outcome = 'added by a person',
         stage = 'research', state = '{}'::jsonb, status = 'queued', attempts = 0, note = null,
         claimed_at = null, lead_score = null, services = null, error = null,
         finished_at = null, updated_at = now()
   where id = p_id;
end
$fn$;
revoke all on function public.prospect_set_website(uuid, text) from anon, public;
grant execute on function public.prospect_set_website(uuid, text) to authenticated;

-- ---------- argue again, and forget, include the two new ends ----------

create or replace function public.prospect_retry(p_id uuid)
returns void language sql security definer
set search_path = public, pg_catalog as $fn$
  with gone as (delete from public.prospect_round where candidate_id = p_id returning 1)
  update public.prospect_candidate
     set stage = 'research', state = '{}'::jsonb, status = 'queued', attempts = 0, note = null,
         claimed_at = null, lead_score = null, services = null, error = null,
         finished_at = null, updated_at = now()
   where id = p_id and status in ('failed', 'no_fit', 'disputed', 'scored', 'dismissed', 'no_site', 'refused')
$fn$;

create or replace function public.prospect_prune()
returns integer language sql security definer
set search_path = public, pg_catalog as $fn$
  with gone as (
    delete from public.prospect_candidate
     where status in ('dismissed', 'no_fit', 'failed', 'no_site', 'refused')
       and coalesce(finished_at, updated_at) < now() - interval '60 days'
    returning 1),
  runs as (
    delete from public.prospect_runs where started_at < now() - interval '60 days' returning 1)
  select (select count(*) from gone)::integer
$fn$;

-- ---------- the dashboard carries the reason and the cautions ----------

create or replace function public.prospect_dashboard()
returns jsonb language sql stable security definer
set search_path = public, pg_catalog as $fn$
  select jsonb_build_object(
    'targets', (select jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'towns', t.towns, 'sic_codes', t.sic_codes,
        'incorporated_from', t.incorporated_from, 'incorporated_to', t.incorporated_to,
        'running', t.running, 'pulled', t.pulled, 'cursor', t.cursor,
        'exhausted_towns', t.exhausted_towns, 'note', t.note) order by t.running desc, t.name)
      from public.prospect_target t where t.active),
    'counts', (select jsonb_object_agg(status, n) from (
        select status, count(*) as n from public.prospect_candidate group by 1) z),
    'services', (select jsonb_agg(jsonb_build_object('key', k.key, 'label', k.label) order by k.key)
      from public.prospect_knowledge k where k.kind = 'service' and k.active),
    'models', (select jsonb_agg(jsonb_build_object(
        'model', u.model, 'used', u.used, 'exhausted', u.exhausted, 'observed_rpd', u.observed_rpd)
        order by u.used desc)
      from public.outreach_model_usage u
     where u.usage_day = public.outreach_quota_day() and u.key_secret = 'GEMINI_DISCOVERY_API_KEY'),
    'chains', (select jsonb_object_agg(c.role, c.chain) from (
        select role, jsonb_agg(model order by priority) as chain
          from public.outreach_model where active and role like 'prospect\_%' group by role) c),
    'last_run', (select to_jsonb(r) from public.prospect_runs r order by r.id desc limit 1),
    'candidates', (select jsonb_agg(d.doc order by d.rank, d.score desc nulls last, d.at desc) from (
        select
          case c.status when 'scored' then 0 when 'disputed' then 1 when 'working' then 2
                        when 'queued' then 3 when 'no_site' then 4 when 'promoted' then 5
                        when 'no_fit' then 6 when 'refused' then 7 else 8 end as rank,
          c.lead_score as score, coalesce(c.finished_at, c.pulled_at) as at,
          jsonb_build_object(
            'id', c.id, 'company', c.company_name, 'number', c.company_number,
            'town', c.town, 'activity', c.activity, 'incorporated_on', c.incorporated_on,
            'company_type', c.company_type, 'website', c.website,
            'website_confirmed_by', c.website_confirmed_by, 'website_outcome', c.website_outcome,
            'status', c.status, 'stage', c.stage, 'score', c.lead_score,
            'services', c.services, 'error', c.error, 'attempts', c.attempts, 'note', c.note,
            'cautions', c.state -> 'cautions',
            'promoted_lead_id', c.promoted_lead_id,
            'moves', (select count(*) from public.prospect_round r where r.candidate_id = c.id)) as doc
          from public.prospect_candidate c
         where c.status <> 'dismissed'
         order by 1, 2 desc nulls last, 3 desc
         limit 400) d)
  )
$fn$;

-- ---------- the dials ----------

insert into public.prospect_setting (key, value, note) values
  ('require_website', 'true',
   'park a business with no website we can find, before any model is asked; false argues from the register alone'),
  ('caution_ceiling', '35',
   'no service may score above this on a business behind on its accounts or confirmation statement'),
  -- The two territories in business/01-positioning/ideal-customer-profile.md
  -- section 2, core and edge, as postcode areas and districts. A town name
  -- alone is not a territory: "Beeston" matches Leeds as well.
  --   Nottingham: NG (city, Beeston, Long Eaton, Mansfield, Newark), DE
  --               (Derby, Ilkeston), LE11/LE12 (Loughborough)
  --   Alcester:   B49 Alcester, B50 Bidford, B80 Studley, B95 Henley,
  --               B96-B98 Redditch and Astwood Bank, CV37 Stratford,
  --               WR11 Evesham, WR7 Inkberrow, B60/B61 Bromsgrove,
  --               B47 Wythall, B90-B94 Solihull, CV31-CV35 Leamington/Warwick
  ('territory_areas', '["NG","DE","LE11","LE12","B49","B50","B80","B95","B96","B97","B98","CV37","WR11","WR7","B60","B61","B47","B90","B91","B92","B93","B94","CV31","CV32","CV33","CV34","CV35"]',
   'postcode areas or districts a pulled company must be registered in; empty means anywhere')
on conflict (key) do update set value = excluded.value, note = excluded.note;

update public.prospect_setting
   set value = '10',
       note = 'most businesses one tick takes on, claimed one at a time until the tick budget runs out; a parked one costs seconds, an argued one a minute'
 where key = 'batch_size';

-- ---------- the prompts, for the new shape ----------

insert into public.prospect_prompt (key, temperature, body) values
('research', 0.3, $p$You are the research agent in a small team deciding whether a local business is worth a first letter from n.abl, a technology implementation partner for small businesses around Nottingham and Alcester (automation, data and reporting, custom software, web, and AI where it earns its place).

You are the only agent who sees the source material: lines from the public company register, and text from the business's own website. The other agents will only ever see what you promote to them. So promote facts, not impressions.

What is worth promoting - how this business actually works:
- how customers find it, enquire, book, order and pay (a form, a phone number, "email us", an online shop, an app, a portal);
- what is plainly done by hand, on paper, by email or phone, or twice;
- volume and scale: sites, branches, staff, vans, customers, products, bookings, years trading;
- systems, suppliers or software it names; jobs it is hiring for; things it says are new or changing;
- what the register says about its size (accounts category), age and health.
Skip slogans and adjectives ("quality service", "passionate team").

Rules:
- Every page fact must carry a quote copied exactly, word for word, from the website text. A quote that is not on the page will be struck by a check you cannot see, and the fact with it.
- Every register fact must name the register line it rests on, by its key.
- Never repeat an email address, phone number, web address or postcode, even if the page shows one.
- Say what you could not establish, in "unknowns". If no website was found, say "no website was found by guessing its domain" - never "it has no website".
- Do not judge fit and do not name our services. That is not your job.

Answer with JSON only:
{
  "say": "to the signals agent: what this business is and does, and how it works, in plain sentences",
  "facts": [
    {"id": "f1", "fact": "one plain statement", "source": "page", "quote": "exact words from the page"},
    {"id": "f2", "fact": "one plain statement", "source": "register", "register_key": "r_accounts"}
  ],
  "unknowns": ["what you could not find out"]
}$p$),

('signals', 0.4, $p$You are the signals agent. The research agent has read a business's register entry and website and promoted the facts below to you. You never see the website yourself.

Your job: find the signals in those facts - things that show where this business spends time, loses money, makes mistakes, or cannot do something it plainly needs to - and say which of our services each one points to.

Rules:
- Every signal cites the fact ids it rests on. A signal citing no fact, or a fact that does not exist, is dropped by a check.
- "points_to" lists the keys of the services, from WHAT WE SELL, whose "Signals that point here" this signal genuinely matches. Use only the keys given. Empty when it matches none. A pitch can only be made on a signal that points to that service: a check refuses anything else.
- A signal about the business's health rather than its work - behind on filings, dormant, very new with no trading shown, tiny and quiet - is a caution: set "caution": true and "points_to": []. Cautions are for every agent to see; nothing can be sold on one.
- Strength: "strong" (the facts show it directly on this business), "possible" (the facts make it plausible), "weak" (only the kind of business suggests it).
- Do not build a need out of an absence. "No website was found by guessing" or "the site does not mention X" is at most weak, and is not a web signal on its own.
- Do not stretch. The research agent reviews every signal, including where it points, against what it actually saw.
- Never write an email address, phone number, web address or postcode.

If the research agent has objected, revise: fix or withdraw what it objected to, and keep what it let stand.

Answer with JSON only:
{
  "say": "to the research agent and the sales agent: what you see in this business, in plain sentences",
  "signals": [{"id": "s1", "signal": "one plain statement", "facts": ["f1"], "strength": "strong|possible|weak", "points_to": ["automation"], "caution": false}],
  "promote": ["s1"]
}$p$),

('research_review', 0.2, $p$You are the research agent again. You read this business's register entry and website; the signals agent did not. It has turned your facts into the signals below, each tagged with the services it points to.

Check each one against what you actually found. A signal "stands" if your facts support it at the strength claimed AND the services it points to are ones those facts really bear on. It is an "overreach" if it claims more than the facts show, cites a fact that does not say that, points to a service the facts do not support, is built from an absence ("no website found", "does not mention"), or is really about the kind of business rather than this one while calling itself strong. A caution about the business's health stands if the register shows it.

Be exact and be fair: do not object to a signal because you would have worded it differently.

Answer with JSON only:
{
  "say": "to the signals agent: what stands, what does not, and why",
  "verdicts": [{"signal": "s1", "verdict": "stands|overreach", "why": "one sentence"}]
}$p$),

('sales', 0.4, $p$You are the sales agent for n.abl. You are the generalist: you know every service a little and none of them as well as its specialist. Your job is to decide which specialists to bring in for this business, and to open each conversation with a score.

You are given the signals the research and signals agents agreed on (each says which services it points to, and cautions point to none), who we sell to, the scoring scale, and a short description of each service.

Rules:
- Bring in a specialist only for a service that at least one cited signal points to. A pitch resting only on signals that point elsewhere, or on cautions, is refused by a check.
- At most the number of services stated. Fewer is usually right. None is a legitimate answer - say why in "no_fit_because".
- Open at the band on THE SCALE that the evidence earns, not higher to leave room to bargain. The specialist knows the bands better than you and will say so.
- If the register has flagged a caution, say it to the specialist; the ceiling it sets is enforced whatever you write.
- Speak to each specialist directly in its pitch: what you saw, which signal, why you think it is theirs.
- Never write an email address, phone number, web address or postcode.

Answer with JSON only:
{
  "say": "to the team: which services you are bringing in and why, in plain sentences",
  "services": [{"service": "service key", "pitch": "to that specialist: why this is yours", "signals": ["s1"], "score": 45}],
  "no_fit_because": "only when services is empty"
}$p$),

('specialist', 0.4, $p$You are the specialist for one of n.abl's services. Your knowledge of the service is below: what we build, what points here, what points elsewhere, what kills it, and how you score. The sales agent has brought you a business and an opening score.

Argue the score from the evidence and your scoring rules. You know this service better than sales does; use that. The aim is agreement on the right number, not winning - and not agreeing for the sake of it.

How to argue:
- Every number you give rests on signals that point to YOUR service. Name the fact behind any score above 40. If the cited signals do not point to your service, pass or redirect: a check ignores a proposal resting on signals that point elsewhere.
- Say which band of your scoring rules the evidence puts this in, and what evidence would move it up a band.
- Treat an absence ("no website found", "the site does not say") as unknown, not as evidence.
- If the register has flagged a caution, no score above its ceiling counts.

Your moves:
- "agree": you accept the sales agent's last number. Your "score" must be exactly that number. Only agree when that number sits in the band the evidence earns.
- "counter": you propose a different number and say why, citing signals.
- "pass": this is not a case for your service at all. Score 0.
- "redirect": the signals are really about another service. Name it in "redirect_to" (a service key), give your own score for yours, and say why.

Also give the one question that would settle it on a first call, and the answer that would mean walk away.

Never write an email address, phone number, web address or postcode.

Answer with JSON only:
{
  "say": "to the sales agent, directly",
  "verdict": "agree|counter|pass|redirect",
  "score": 45,
  "signals": ["s1"],
  "redirect_to": null,
  "confirm_question": "the question for the call",
  "walk_away_if": "the answer that ends it"
}$p$),

('sales_reply', 0.4, $p$You are the sales agent, in a conversation with one service specialist about one business. You have read its last message below, with the whole conversation so far.

Your moves:
- "agree": you accept the specialist's last number. Your "score" must be exactly that number.
- "counter": you propose a different number and say why, citing signals that point to this service.

Move to the specialist's number when it has named the evidence and the band. Hold yours when it has not, and say which fact or which band rule it has misread. Do not split the difference for the sake of it: a number is right or it is not.

If the specialist has handed the business on to another service and you think it is right, set "bring_in" to that service, with a pitch, signals that point to it, and your opening score for it. You may only bring in services from the portfolio, and the total is capped.

If the register has flagged a caution, no score above its ceiling counts.

Never write an email address, phone number, web address or postcode.

Answer with JSON only:
{
  "say": "to the specialist, directly",
  "verdict": "agree|counter",
  "score": 45,
  "signals": ["s1"],
  "bring_in": null
}
where bring_in, when used, is {"service": "key", "pitch": "to that specialist", "signals": ["s1"], "score": 40}.$p$)
on conflict (key) do update set body = excluded.body, temperature = excluded.temperature, updated_at = now();
