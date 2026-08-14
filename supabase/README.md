# n.abl — Supabase

Backend for the client portal, the internal team space and the sales CRM.

## Migrations

| File | What it does |
|---|---|
| `202606010001_sales_intelligence.sql` | Original CRM schema. **Already applied — do not edit.** |
| `202606010002_sales_research_form_runs.sql` | Research RPCs. **Already applied — superseded below.** |
| `202606020001_remove_sales_ai.sql` | Removes the AI layer from the CRM. **Destructive — read the header before running.** |

Apply a migration by pasting it into **Dashboard → SQL Editor**, or with the CLI:

```bash
supabase db push
```

### Removing the AI layer

`202606020001_remove_sales_ai.sql` drops `sales_research_runs`, the three
research RPCs, and the AI-authored columns on `sales_leads`.

It first promotes each lead's free-text **signals** into its own column.
That text used to live inside `research_json`, so running the drops without
this migration would destroy it. Take a backup before running.

Afterwards:

```bash
supabase functions delete sales-research      # source already removed from this repo
supabase secrets unset openai_api_key openai_model
```

## Edge functions

None. The `sales-research` function was the only one, and it has been removed
along with the AI features it served.

## Not yet version-controlled

The **client-portal schema is not in this directory**. The `clients`, `quotes`,
`projects`, `meetings` and `documents` tables, the `quotes` and `documents`
storage buckets, and the `x-access-key` RLS policies that scope a client to
their own rows all exist only in the hosted project.

They should be introspected and committed as a migration so the backend can be
rebuilt from source:

```bash
supabase db pull
```

## Access model

Two independent auth paths share one project:

- **Team** — standard Supabase Auth (email/password). Sessions persist.
  RLS policies grant `authenticated` full access to the CRM tables.
- **Client portal** — no Supabase user. The browser sends the client's access
  key as an `x-access-key` header and RLS scopes every row to that client.
  The key is held in memory only and never persisted.

Storage buckets `quotes` and `documents` are private. Files are always served
through short-lived signed URLs minted on demand — never stored in the database.
