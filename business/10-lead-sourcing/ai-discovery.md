# Pulling leads from scratch, with a model

**Status: design, with one route ruled out on Google's own terms and a second
built in its place. Nothing here has been run.**

Written 16 September 2026, alongside
`supabase/migrations/202609160007_a_second_project_is_a_second_pool.sql`.

---

## 1. The obvious route is not available

The obvious implementation is: give a model Google Search grounding, ask it for
accountants in Newark, write down what comes back. It would work, and it is a
breach of the Gemini API terms — not a grey area, a named example.

> "it is a violation of these terms to use Grounding with Google Search to
> extract or collect one or more of these components for another purpose (for
> example, using programmatic or automated means to collect Links, using Links
> to build an index…)"

> "you will not, and will not allow your end user or any third party to, store
> (except as provided below), cache, copy, frame, … syndicate, resell, analyze,
> train on, or otherwise learn from Grounded Results."

Grounded results also have to be shown to the end user who submitted the prompt,
with their Search Suggestions attached, unmodified. A cron job writing rows into
`sales_leads` has no end user, shows nothing, and stores everything.

This is the same shape as the correction at the top of `sources.md`: Google Maps
was ruled out for building prospect lists for the same reason, in nearly the same
words, a month earlier. Ruling the approach out again from the other end of the
pipeline is not a coincidence — it is Google saying the same thing twice.

**So: no Google Search grounding in the discovery path.** Not at a lower request
rate, not with a delay, not "just for the first pass".

Source: <https://ai.google.dev/gemini-api/terms>, read 16 September 2026.

## 2. What is left, and it is more than it sounds

Discovery has two halves, and only one of them was ever the search engine's job.

| | |
|---|---|
| **Finding that a business exists** | A register. Companies House, ICO, FSA, CQC, the charity register — all lawfully obtained, all already in `sources.md`, all already fetched by `scripts/sourcing/fetch-*.mjs` |
| **Deciding it is worth writing to** | Judgement. This is the half a model is actually good at, and the half currently done by a keyword triage |

Today `promote.mjs` turns register rows into leads and `triage.mjs` classifies
them by keyword match on the SIC description. That is why the sector column has
the shape it has: it is not a decision, it is whatever the keywords hit.

**The prospector works over the registers, not over the web.** Given a town and a
brief, it reads register rows we already hold a lawful basis for, and argues for
the ones worth promoting — the same shape as the scout arguing angles, one level
earlier. Nothing it produces is a Grounded Result, because nothing was grounded.

Where a candidate has a website, the existing pipeline already fetches that
business's own page, which is lawful and is where every real signal comes from
anyway. The prospector does not need to invent a domain, and **must not**: see §4.

## 3. Why the second project, and why it is not negotiable

Gemini's free-tier quota is per project and per model within it. As of 10:14 on
16 September, on the single project:

| model | used | state |
|---|---|---|
| gemini-3.5-flash-lite | 496 | exhausted |
| gemini-3.5-flash | 21 | exhausted |
| gemini-flash-latest | 19 | exhausted |
| gemini-flash-lite-latest | 1 | exhausted |
| gemini-3.1-flash-lite | 2 | running |

Four of five pools spent before eleven in the morning, with 97 leads still
queued. A discovery stage sharing that key would not be slow, it would be dead on
arrival — and worse, it would take the writer down with it, because they would be
spending the same pool.

A second project is a second pool. That is the argument, and it is a capacity
argument rather than a clever one.

**The caveat, recorded when it was found and not since withdrawn.** Google's
enforcement notice describes "attempts to circumvent quota restrictions by
operating multiple projects as a single project". Two projects doing two
different jobs on two different schedules is not that, and the honest test is
whether we would describe the setup to Google in those words. Here we would:
discovery and drafting are separate pipelines, with separate prompts and separate
cadences. If that stops being true — if the second key is ever used to keep the
writer going after the first key's pool runs out — it becomes exactly the thing
the notice names, and the right answer then is to pay.

## 4. The guards, which matter more here than anywhere else

The writer pipeline's failure mode is an embarrassing sentence. Discovery's
failure mode is **writing to an address that does not exist, or to the wrong
business entirely**, and that is not recoverable by editing a prompt.

1. **No contact route from a model. Ever.** Not an email, not a phone number, not
   a domain. A model may say a business is worth looking at; it may not say how
   to reach them. Contact routes come from the extraction stage reading the
   business's own page, or they stay null. An invented email address is the
   single worst thing this system could produce, and it is exactly the kind of
   thing a model produces confidently.
2. **A company must resolve to a register row** before it becomes a lead. The
   prospector selects from candidates, it does not conjure them.
3. **A website must be fetched and must mention the business** before it is
   stored, and directory and aggregator domains are rejected outright — a Yell or
   Facebook page is not the business's own site, and the scout would read the
   wrong thing off it.
4. **Deduplicate on normalised domain and normalised name** against
   `sales_leads`. Writing twice to one business breaks the promise in
   `first-contact-letter.md`.
5. **`marketing_status = 'do_not_contact'`**, as `promote.mjs` already does.
   Discovery is not approval.

## 5. What Article 14 needs, and it is not the current footer

Every lead today carries `source = 'companies_house'` and the letter footer says
so. That sentence is the Article 14 source disclosure and it has to be **true for
that lead**.

A lead the prospector found through a different register gets that register's
name in `source`, `source_detail` and `source_date`, and the footer follows the
lead rather than the programme. The CRM's footer already branches on `l.source`
and falls through to "in public business information", so the mechanism exists;
what does not exist yet is a branch per register.

`LIA-2026-08-v1` assessed the register-sourced list. A discovery pipeline that
promotes on a model's judgement rather than a keyword rule is a different
processing operation on the same lawful basis, and the balancing test should be
re-read before the first letter goes out — not because the answer is likely to
change, but because "we did not re-read it" is the finding, not the outcome.

## 6. What is built and what is not

**Built, 16 September:**

- `outreach_model.key_secret` — which project a model row is called with,
  constrained to `^GEMINI_[A-Z0-9_]*$` so a registry row can never name
  `SUPABASE_SERVICE_ROLE_KEY`.
- `outreach_model_usage` keyed by `(usage_day, model, key_secret)`, so the second
  project's pool is counted separately instead of spending the first's.
- `outreach_config()` hands the edge function the **name** of the secret. The
  value is never in the database and never travels over that call.
- The edge function reads the named secret through one allowlisted accessor, and
  skips a model whose secret is not set rather than failing the run.

**Not built:** the prospector itself — the role rows, the prompt, the candidate
store and the edge function. It needs the second key to exist first, because a
discovery stage registered against a secret nobody has set would sit in the chain
being skipped, which is tidy but useless.

**What is needed from a person**, once, and never through a chat transcript:

1. A new project in Google AI Studio, and an API key in it.
2. Supabase Dashboard → Edge Functions → Secrets → add `GEMINI_DISCOVERY_API_KEY`.
3. Say it is done. The key itself is never pasted anywhere but that box.
