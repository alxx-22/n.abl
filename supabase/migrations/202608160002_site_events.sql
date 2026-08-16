-- ============================================================
-- SITE EVENTS — first-party conversion measurement
--
-- The site had no measurement of any kind, so "does this page work"
-- was a question answered by opinion. The obvious fix is an analytics
-- product, and the site cannot have one without breaking four things
-- it currently promises:
--
--   * 03-website's rule 4: no third-party requests, no analytics, no
--     tag manager, no CDN
--   * the CSP in netlify.toml, whose connect-src allows only Supabase
--     and Web3Forms
--   * the privacy policy: "We do not run advertising or analytics
--     tracking, we do not build behavioural profiles"
--   * the cookie policy: "no analytics cookies... there is no consent
--     banner because there is nothing to consent to"
--
-- So this is first-party instead. Events go to a table in the project
-- the site already talks to, inside the existing CSP. No new vendor, no
-- cookie, no device identifier, no consent banner, and the privacy
-- policy narrows by one sentence rather than being reversed.
--
-- WHAT IS DELIBERATELY NOT COLLECTED
--   * no IP address, no user agent, no device or browser fingerprint
--   * no cookie and no persistent identifier of any kind
--   * no cross-session or cross-page identity — the session id is
--     random per page load, lives in memory only, and dies with the tab
--   * no free text, no form contents, no query strings
--
-- What that costs: no unique-visitor count, no returning-visitor
-- analysis, no funnel across sessions. What it buys: nothing here is
-- personal data, so there is nothing to disclose, retain, export or
-- erase. For "which CTA gets used and how far down the page do people
-- get", that is the right trade.
-- ============================================================

create table if not exists public.site_events (
  id          bigint generated always as identity primary key,

  -- A closed set. Anything not on this list is rejected by the database
  -- rather than filtered in a query somebody might forget to apply.
  name        text not null check (name in (
                'cta_primary',      -- hero: book a free discovery call
                'cta_secondary',    -- hero: see how we help
                'cta_final',        -- contact section: book a discovery call
                'cta_email',        -- mailto link
                'form_open',        -- discovery modal opened
                'form_submit',      -- submitted, before the network call
                'form_success',     -- provider accepted it
                'form_error',       -- provider rejected it, or the network failed
                'section_reach'     -- deepest section reached, sent once per session
              )),

  -- Only for section_reach. Constrained to the section ids on the page.
  section     text check (section is null or section in (
                'hero', 'pillars', 'what-we-do', 'why-nabl', 'how-we-work',
                'toolkit', 'cases', 'pricing', 'credits', 'about', 'contact'
              )),

  -- Random per page load, held in memory, never persisted client-side.
  -- Groups events within one visit so a funnel is legible. It is not an
  -- identifier for a person and cannot be joined to anything.
  session_id  uuid not null,

  -- Coarse on purpose: enough to tell a phone from a desktop, not
  -- enough to contribute to a fingerprint.
  viewport    text check (viewport is null or viewport in ('narrow', 'medium', 'wide')),

  created_at  timestamptz not null default now()
);

comment on table public.site_events is
  'First-party, cookieless conversion events from the marketing site. No IP, no user agent, no persistent identifier. See business/03-website.';

create index if not exists site_events_name_created_idx
  on public.site_events (name, created_at desc);

create index if not exists site_events_session_idx
  on public.site_events (session_id);

-- ============================================================
-- RLS: anonymous visitors may INSERT and nothing else.
-- ============================================================
alter table public.site_events enable row level security;

-- The anon key is in the public bundle, so this policy is the only
-- thing standing between a visitor and the table. Insert-only, with no
-- select policy at all: a visitor cannot read back a single row,
-- including their own. Reading is for the service role.
drop policy if exists site_events_anon_insert on public.site_events;
create policy site_events_anon_insert
  on public.site_events
  for insert
  to anon
  with check (true);

-- No select, update or delete policy for anon. RLS denies by default,
-- so their absence is the deny. Stated explicitly because a future
-- reader adding "just a select policy for a dashboard" would be
-- publishing the table to the internet.

revoke all on public.site_events from anon;
grant insert on public.site_events to anon;

-- ============================================================
-- RETENTION
--
-- Nothing here is personal data, so there is no legal retention
-- obligation. There is a housekeeping one: this table grows forever
-- and nobody will remember it exists.
--
-- 180 days is enough to compare a quarter against the one before it.
-- Called by the same scheduled path as the portal's prune function;
-- if no schedule exists yet, run it by hand when you look at the data.
-- ============================================================
create or replace function public.prune_site_events()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.site_events where created_at < now() - interval '180 days';
$$;

-- Same lesson as 202608160001: a security-definer function that anyone
-- can execute is a deletion primitive handed to the internet.
revoke all on function public.prune_site_events() from public;
revoke all on function public.prune_site_events() from anon;
