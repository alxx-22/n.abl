# Ledger design — a schema sketch

Companion to [`README.md`](README.md). **Status: not started.** None of this SQL
has been written to a migration, applied to any database, or run. It is a
sketch to argue with before anything is built, not a record of a schema that
exists.

It follows the conventions already in `supabase/migrations/`: `uuid` primary
keys from `gen_random_uuid()`, `timestamptz` columns defaulting to `now()`,
`check` constraints spelled out rather than left to the application, and RLS on
everything the portal can reach.

---

## 1. The three rules the schema exists to enforce

**Append-only.** Every movement of credit is a new row. Nothing is ever updated
or deleted. A mistake is corrected by a compensating row with a reason, so the
history reads as what happened rather than as what someone last decided it
should look like. These rows are money, and money that can be edited is money
that can be disputed and not reconstructed.

**No stored balance.** There is no `balance` column anywhere. Balances are
derived from the ledger at read time. The moment a stored balance exists it will
drift from the ledger, and the drift will be discovered by a client looking at
their portal.

**Never negative.** A redemption that would take a balance below zero fails
inside the transaction. Not a warning in the interface — a raised exception in
the database, on the same principle as the opt-out block in `07-crm`.

---

## 2. Tables

### `credit_packs` — what was bought

One row per purchase. Immutable after insert.

```sql
create table if not exists public.credit_packs (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete restrict,
  quantity        numeric(10,2) not null check (quantity > 0),
  price_paid      numeric(10,2) not null check (price_paid >= 0),
  currency        text not null default 'GBP' check (currency = 'GBP'),
  bought_alongside boolean not null default false,
  quote_id        uuid references public.quotes(id) on delete set null,
  purchased_on    date not null default current_date,
  expires_on      date,
  note            text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint credit_packs_expiry_after_purchase
    check (expires_on is null or expires_on > purchased_on)
);

create index if not exists credit_packs_client_idx
  on public.credit_packs (client_id, expires_on nulls last, purchased_on);
```

Notes on the choices:

- `on delete restrict` on `client_id`, not `cascade`. Deleting a client must not
  silently delete the record of money they paid. Deletion becomes a deliberate
  act with a decision attached.
- `expires_on` is nullable, because "credits do not expire" is a legitimate
  answer to the open question in section 8 and the schema should not
  pre-judge it.
- `price_paid` is the total for the pack, not per credit. Price per credit is
  derived, never stored, for the same reason balances are not stored.
- `bought_alongside` exists so the discount can be measured later. After twenty
  packs it answers whether the alongside discount actually converts anyone.
- No `credit_type` column, deliberately. One pool, three labels, type recorded
  at redemption. See `credit-types.md` section 1.

### `credit_ledger` — every movement

One row per movement, positive or negative. Never updated, never deleted.

```sql
create table if not exists public.credit_ledger (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete restrict,
  pack_id      uuid references public.credit_packs(id) on delete restrict,
  entry_kind   text not null check (entry_kind in (
                 'purchase', 'redemption', 'expiry', 'adjustment', 'refund')),
  amount       numeric(10,2) not null check (amount <> 0),
  credit_type  text check (credit_type in ('Build', 'Assist', 'Educate')),
  description  text not null,
  work_ref     text,
  project_id   uuid references public.projects(id) on delete set null,
  occurred_on  date not null default current_date,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),

  -- sign follows the kind
  constraint credit_ledger_sign check (
    (entry_kind = 'purchase'   and amount > 0) or
    (entry_kind = 'redemption' and amount < 0) or
    (entry_kind = 'expiry'     and amount < 0) or
    (entry_kind = 'refund'     and amount < 0) or
    (entry_kind = 'adjustment')
  ),
  -- a type is recorded only when work was done, and always when work was done
  constraint credit_ledger_type_on_redemption check (
    (entry_kind = 'redemption' and credit_type is not null) or
    (entry_kind <> 'redemption' and credit_type is null)
  ),
  -- everything except an adjustment is attributable to a pack
  constraint credit_ledger_pack_required check (
    entry_kind = 'adjustment' or pack_id is not null
  )
);

create index if not exists credit_ledger_client_idx
  on public.credit_ledger (client_id, occurred_on desc);
create index if not exists credit_ledger_pack_idx
  on public.credit_ledger (pack_id);
```

`client_id` is denormalised onto the ledger rather than reached through
`pack_id`. It makes the RLS policy a single equality test and keeps the balance
query off a join. The cost is one consistency rule, enforced below.

`description` is `not null` with no default. Every row says what it was for,
including expiry rows. A ledger the client can read is only useful if the rows
are sentences.

### The append-only trigger

```sql
create or replace function public.credit_ledger_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'credit_ledger is append-only: % is not permitted. '
                  'Correct with a new adjustment row.', tg_op;
end $$;

create trigger credit_ledger_no_update
  before update or delete on public.credit_ledger
  for each row execute function public.credit_ledger_immutable();
```

The trigger is the guarantee. The grants below are the convenience. Both,
because a grant can be widened by a future migration written in a hurry and a
trigger raising an exception is harder to lose by accident.

### The consistency trigger

```sql
create or replace function public.credit_ledger_check_pack()
returns trigger language plpgsql as $$
declare pack_client uuid;
begin
  if new.pack_id is not null then
    select client_id into pack_client
      from public.credit_packs where id = new.pack_id;
    if pack_client is distinct from new.client_id then
      raise exception 'ledger row client_id does not match its pack';
    end if;
  end if;
  return new;
end $$;

create trigger credit_ledger_pack_client
  before insert on public.credit_ledger
  for each row execute function public.credit_ledger_check_pack();
```

---

## 3. Derived state

### Remaining on each pack

```sql
create or replace view public.credit_pack_state
with (security_invoker = true) as
select
  p.id            as pack_id,
  p.client_id,
  p.quantity,
  p.purchased_on,
  p.expires_on,
  p.bought_alongside,
  coalesce(sum(l.amount), 0)                        as net_movement,
  greatest(coalesce(sum(l.amount), 0), 0)           as remaining,
  (p.expires_on is not null and p.expires_on <= current_date) as expired
from public.credit_packs p
left join public.credit_ledger l on l.pack_id = p.id
group by p.id;
```

### Balance per client

```sql
create or replace view public.credit_balances
with (security_invoker = true) as
select
  client_id,
  sum(amount)                                              as balance,
  sum(amount) filter (where entry_kind = 'purchase')       as purchased_total,
  min(occurred_on)                                         as first_movement,
  max(occurred_on)                                         as last_movement
from public.credit_ledger
group by client_id;
```

**`security_invoker = true` is not optional.** A view without it runs with the
privileges of its owner and quietly bypasses the RLS on the tables underneath,
which would hand every client every other client's balance. This is the single
easiest way to get this schema catastrophically wrong, and it fails silently and
looks fine in testing with one client.

---

## 4. Redemption

One function. Everything that draws down a balance goes through it, including
the team space. Ordinary code, Class 1, no model anywhere near it.

```sql
create or replace function public.redeem_credits(
  p_client_id   uuid,
  p_amount      numeric,
  p_credit_type text,
  p_description text,
  p_work_ref    text default null,
  p_project_id  uuid  default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_left      numeric := p_amount;
  v_take      numeric;
  v_pack      record;
  v_batch     uuid := gen_random_uuid();
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'redemption amount must be positive';
  end if;
  if p_credit_type not in ('Build', 'Assist', 'Educate') then
    raise exception 'unknown credit type: %', p_credit_type;
  end if;
  if coalesce(btrim(p_description), '') = '' then
    raise exception 'a redemption must say what it was for';
  end if;

  -- serialise concurrent redemptions for this client
  perform pg_advisory_xact_lock(hashtextextended(p_client_id::text, 0));

  for v_pack in
    select pack_id, remaining, expires_on
      from public.credit_pack_state
     where client_id = p_client_id
       and remaining > 0
       and not expired
     order by expires_on nulls last, purchased_on
  loop
    exit when v_left <= 0;
    v_take := least(v_left, v_pack.remaining);

    insert into public.credit_ledger
      (client_id, pack_id, entry_kind, amount, credit_type,
       description, work_ref, project_id, created_by)
    values
      (p_client_id, v_pack.pack_id, 'redemption', -v_take, p_credit_type,
       p_description, p_work_ref, p_project_id, auth.uid());

    v_left := v_left - v_take;
  end loop;

  if v_left > 0 then
    raise exception
      'insufficient credits: % short of %', v_left, p_amount;
  end if;

  return v_batch;
end $$;
```

Four things this function is doing on purpose:

1. **Earliest-expiry-first.** Deterministic, and it is the order that is best
   for the client, because it uses up what would otherwise be lost. Packs with
   no expiry sort last.
2. **One ledger row per pack consumed.** A three-credit redemption spanning two
   packs writes two rows. That is what makes expiry attributable afterwards.
3. **It raises rather than partially succeeds.** The exception rolls back every
   row it wrote in the loop. There is no state in which half a redemption
   happened.
4. **The advisory lock is per client and transaction-scoped.** Two people
   recording redemptions for the same client at the same moment queue rather
   than both reading the same balance and both succeeding.

`security definer` is deliberate and comes with a duty: the function is granted
to `authenticated` only, never to `anon`. The portal must not be able to reach
it. See section 6.

---

## 5. Expiry

Expiry is a written event, not an absence. A pack whose `expires_on` has passed
gets a ledger row for whatever was left on it, with a description saying so.

```sql
create or replace function public.expire_credits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer := 0; v_pack record;
begin
  for v_pack in
    select pack_id, client_id, remaining, expires_on
      from public.credit_pack_state
     where expired and remaining > 0
  loop
    insert into public.credit_ledger
      (client_id, pack_id, entry_kind, amount, description, occurred_on)
    values
      (v_pack.client_id, v_pack.pack_id, 'expiry', -v_pack.remaining,
       format('Credits expired on %s', to_char(v_pack.expires_on, 'DD Mon YYYY')),
       v_pack.expires_on);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
```

Three rules around expiry:

- **It runs on a schedule or it does not exist.** `05-portal` already has one
  function that nothing calls — `prune_portal_login_attempts()` — and its log
  grows without limit as a result. Do not add a second. Schedule it with
  `pg_cron` in the same migration that creates it, or do not create it.
- **The client is warned before it happens, not after.** The portal card in
  section 7 shows what expires and when. A balance that vanishes without notice
  is a complaint, and a fair one.
- **Expiry is not reversible by the job.** If credits should be reinstated,
  that is an `adjustment` row with a person's name on it and a reason.

Whether credits expire at all is open. See section 8.

---

## 6. Access

The grants follow the portal's existing model exactly: `anon` reads its own
rows and can write nothing, anywhere.

```sql
alter table public.credit_packs  enable row level security;
alter table public.credit_ledger enable row level security;

-- the client, through the portal: read own rows only
create policy credit_packs_client_read on public.credit_packs
  for select to anon
  using (client_id = public.current_client_id());

create policy credit_ledger_client_read on public.credit_ledger
  for select to anon
  using (client_id = public.current_client_id());

-- the team space
create policy credit_packs_team on public.credit_packs
  for select to authenticated using (true);
create policy credit_ledger_team on public.credit_ledger
  for select to authenticated using (true);
create policy credit_packs_team_insert on public.credit_packs
  for insert to authenticated with check (true);

revoke insert, update, delete on public.credit_packs, public.credit_ledger from anon;
revoke update, delete on public.credit_packs, public.credit_ledger from authenticated;

grant select on public.credit_balances, public.credit_pack_state to anon, authenticated;
revoke execute on function public.redeem_credits(uuid, numeric, text, text, text, uuid) from anon;
grant  execute on function public.redeem_credits(uuid, numeric, text, text, text, uuid) to authenticated;
```

Note that `authenticated` gets no direct `insert` on `credit_ledger`. Ledger
rows arrive through `redeem_credits()` or through a purchase path that inserts
the pack and its opening `purchase` row together. A hand-written ledger insert
from the interface is how a balance eventually goes negative.

`current_client_id()` is the function the portal already uses. It is described
in `05-portal/access-model.md` and **is not in version control** — see section
9.

---

## 7. What the portal shows

One card, read-only, in `src/pages/Portal.jsx` alongside the four sections that
already exist. It reads `credit_balances`, `credit_pack_state` and the last
several `credit_ledger` rows through the existing `portalClient()` path.

**Balance.** One number, large. `[PLACEHOLDER: 12.5] credits remaining.` If the
denomination decision in `credit-types.md` section 4 lands on Option A, this is
also shown as a money figure using the existing `gbp()` helper in
`src/pages/Portal.jsx:13`.

**Expiring.** Only when something expires within `[PLACEHOLDER: 60]` days:
`[PLACEHOLDER: 4] credits expire on [date]`. Absent otherwise, rather than
present and empty.

**Recent movements.** The last ten ledger rows, most recent first: date,
description, type where there is one, and the signed amount. This is the whole
reason the ledger is readable prose rather than codes.

**An empty state.** The portal has an `Empty` component and every other section
uses it. A client with no credits sees a short explanation and nothing that
looks like an error.

What the card does **not** have: a buy button, a redeem button, a dispute form
or any other control. `05-portal` rule 4 — the portal never writes — holds here
without exception. If a client wants credits they say so, and n.abl records it.

---

## 8. Open questions the schema deliberately does not answer

Each of these is a business decision, not a technical one. The schema supports
either answer in every case, which is why it can be built before they are
settled.

| Question | Where it is blocking | Schema impact |
|---|---|---|
| Do credits expire, and after how long? | `04-legal` service agreement, credits clause | `expires_on` nullable already |
| Are credits refundable, and on what terms? | Same | `refund` entry kind already exists |
| What happens to unused credits when an engagement ends? | Same, and `04-legal` README item 7 | An `adjustment` or `refund` row either way |
| What is a credit denominated in? | `credit-types.md` section 4 | None — the schema stores a quantity |
| Pack sizes, prices, alongside discount | Master plan section 3C: after three real quotes | None |
| Granularity — whole credits, halves, quarters? | The task menu | One `check` constraint, added later |
| Is a pack transferable between related companies? | Nobody has asked yet | `client_id` is on the pack, so today: no |

---

## 9. Dependencies and known hazards

**The portal schema is not in version control.** `clients`, `quotes`,
`projects`, `meetings`, `documents` and `current_client_id()` exist only in the
hosted Supabase project. This sketch references four of them. Until
`supabase db pull` has been run and committed — `05-portal`'s open item, and a
v2 job in the master plan — the credit migration would be building on
foundations that cannot be rebuilt from source. Do that first.

**`security_invoker` on both views.** Repeated here because it is the failure
that leaks data and looks like success.

**`security definer` on both functions.** Both set `search_path = public`
explicitly. A `security definer` function without a pinned `search_path` is a
privilege escalation waiting for someone with a schema of their own.

**Numeric, never float.** `numeric(10,2)` throughout. Floating point money is a
rounding error that arrives as a client complaint eighteen months later.

**Nothing here is scheduled yet.** `expire_credits()` needs a `pg_cron` entry in
the same migration that creates it, for the reason given in section 5.

**No accountant has looked at any of this.** Credits sold are money received for
work not yet done. How that is recognised, and what it means for tax set-aside,
is a real question that `16-finance` has not answered and this folder is not
qualified to. Do not let the ledger design become the de facto accounting
policy by default.
