-- Two kinds of demo key (DEMO-SERVICE-PLAN.md §3.2):
--
--   private  one prospect's key. Their demo stays until they reset it or
--            start a different one (which replaces it).
--   shared   one link for many people (an event, a post, a group email).
--            Each person who enters it gets their own demo, private to their
--            browser, and everything it generates is deleted an hour after
--            they press Start.
--
-- Deleting a workspace (a voice_tenants row) cascades to its bookings,
-- orders, payments, calls and call events, texts and customers.

alter table public.voice_demo_keys add column if not exists kind text not null default 'private';
alter table public.voice_demo_keys drop constraint if exists voice_demo_keys_kind_check;
alter table public.voice_demo_keys add constraint voice_demo_keys_kind_check check (kind in ('private', 'shared'));

-- Shared keys: which visitor (a random id in their session cookie) owns the
-- workspace, and when it is deleted. Null for private keys' workspaces.
alter table public.voice_tenants add column if not exists owner_visitor text;
alter table public.voice_tenants add column if not exists expires_at timestamptz;
create index if not exists voice_tenants_expires_idx on public.voice_tenants (expires_at) where expires_at is not null;
create index if not exists voice_tenants_owner_visitor_idx on public.voice_tenants (owner_key_id, owner_visitor);

-- Usage per visitor, so a shared key's limits apply to each person.
alter table public.voice_demo_usage add column if not exists visitor text;
create index if not exists voice_demo_usage_visitor_idx on public.voice_demo_usage (key_id, visitor, at);
