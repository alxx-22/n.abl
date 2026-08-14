-- =====================================================================
-- n.abl — remove the AI layer from the sales CRM
-- ---------------------------------------------------------------------
-- The CRM stays. Everything that depended on an LLM goes:
--   * sales_research_runs        (only ever written by AI runs)
--   * the three research RPCs    (dead code — never called by the app)
--   * the AI-authored columns on sales_leads
--
-- DATA-SAFETY NOTE — READ BEFORE RUNNING
-- Each lead's free-text "public signals" was never given its own column;
-- the old front end smuggled it inside research_json->>'signals', and read
-- it back with a fallback to recommendation_reason. Dropping the AI columns
-- without rescuing that text first would silently destroy it on every lead.
-- Steps 1-2 below promote it to a real column BEFORE anything is dropped.
--
-- This migration is DESTRUCTIVE and irreversible. Take a backup first
-- (Supabase Dashboard -> Database -> Backups) and run it in one transaction.
-- Idempotent: safe to re-run.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Give "signals" a real home.
-- ---------------------------------------------------------------------
alter table public.sales_leads
  add column if not exists signals text;

-- ---------------------------------------------------------------------
-- 2. Rescue the text, mirroring the old read order exactly:
--    research_json.signals first, then recommendation_reason.
--    Only fills rows that are still empty, so re-running is harmless.
-- ---------------------------------------------------------------------
update public.sales_leads
set signals = coalesce(
      nullif(btrim(research_json ->> 'signals'), ''),
      nullif(btrim(recommendation_reason), '')
    )
where coalesce(btrim(signals), '') = ''
  and coalesce(
        nullif(btrim(research_json ->> 'signals'), ''),
        nullif(btrim(recommendation_reason), '')
      ) is not null;

-- ---------------------------------------------------------------------
-- 3. Drop the AI research-run table (and its RLS policy with it).
-- ---------------------------------------------------------------------
drop policy if exists "team can manage sales research runs" on public.sales_research_runs;
drop table if exists public.sales_research_runs cascade;

-- ---------------------------------------------------------------------
-- 4. Drop the three research RPCs. They were never called by the front
--    end, and their only purpose was to record LLM runs.
-- ---------------------------------------------------------------------
drop function if exists public.create_sales_discovery_run(jsonb, text);
drop function if exists public.create_sales_discovery_run(jsonb, text, uuid);
drop function if exists public.create_sales_company_research_run(uuid, jsonb, text);
drop function if exists public.create_sales_company_research_run(uuid, jsonb, text, uuid);
drop function if exists public.complete_sales_research_run(uuid, jsonb, jsonb, text, text);
drop function if exists public.complete_sales_research_run(uuid, jsonb, jsonb, text);

-- ---------------------------------------------------------------------
-- 5. Drop the AI-authored columns on sales_leads.
--    lead_score is deliberately KEPT — it now serves as a hand-set
--    priority score, and the 1..100 CHECK still guards it.
-- ---------------------------------------------------------------------
alter table public.sales_leads
  drop column if exists research_summary,
  drop column if exists research_json,
  drop column if exists source_urls,
  drop column if exists recommendation_reason;

commit;

-- =====================================================================
-- AFTER RUNNING THIS
--  1. Delete the edge function:  supabase functions delete sales-research
--     (its source has already been removed from this repo)
--  2. Unset the now-unused secrets:
--       supabase secrets unset openai_api_key openai_model
--  3. Redeploy the site so the AI-free CRM is live.
-- =====================================================================
