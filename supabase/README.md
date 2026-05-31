# Sales Intelligence backend

This folder contains the first backend pass for the Sales Intelligence CRM.

## What exists

- `migrations/202606010001_sales_intelligence.sql`
  - Creates lead, contact, research run, email draft, activity and pipeline event tables.
  - Enables RLS for authenticated team users.

- `functions/sales-research/index.ts`
  - Supabase Edge Function.
  - Requires a logged-in Supabase user.
  - Calls OpenAI Responses API with the `web_search` tool.
  - Forces CRM-ready JSON output for discovery and company research.

- `migrations/202606010002_sales_research_form_runs.sql`
  - Adds database support for the two front-end form actions.
  - `create_sales_discovery_run(...)` records a discovery filter request.
  - `create_sales_company_research_run(...)` records a company research request.
  - `complete_sales_research_run(...)` stores the AI result, source URLs and failure state.

## Deploy

```bash
supabase db push
supabase secrets set OPENAI_API_KEY=...
supabase secrets set OPENAI_MODEL=gpt-5-mini
supabase functions deploy sales-research
```

If you are using the Supabase SQL editor instead of the CLI, run both migration files in order:

1. `202606010001_sales_intelligence.sql`
2. `202606010002_sales_research_form_runs.sql`

The front end calls `sales-research` from `nabl website/sales-intelligence.html`.
If the function is not deployed or the user is not signed in, the page falls back to local demo data and shows why.

## Next build step

Replace the front-end `localStorage` writes with Supabase inserts/updates against:

- `sales_leads`
- `sales_contacts`
- `sales_activities`
- `sales_research_runs`
- `sales_email_drafts`
- `sales_pipeline_events`
