-- =====================================================================
-- Rotate every client access key to the strong format.
--
-- STATUS: NOT YET APPLIED. Read the whole header before running.
--
-- WHY
-- Keys issued before 2026-08-15 are the old format: four characters over a
-- 36-glyph alphabet behind a guessable company prefix and a hardcoded year.
-- That is 20.7 bits, and it came from Math.random(), whose state is
-- recoverable from a few outputs. Every key issued under that scheme should
-- be considered weak, and the only fix is to reissue.
--
-- New keys match src/lib/teamConfig.js: PREFIX-XXXX-XXXX-XXXX drawn from
-- ABCDEFGHJKMNPQRSTUVWXYZ23456789 (31 glyphs, no O/0/I/1/L), giving ~59.5
-- bits from gen_random_bytes — the database's CSPRNG, not random().
--
-- !! OPERATIONAL IMPACT — THIS LOCKS CLIENTS OUT !!
-- The moment this runs, every existing key stops working. Any client who has
-- bookmarked or saved their old key will be unable to sign in until you send
-- them the new one. The final SELECT prints the new keys precisely so you can
-- distribute them. Run it when you are able to follow up, not last thing on
-- a Friday.
--
-- Safe to re-run, but note that re-running issues *another* new key for
-- everybody, invalidating the set you just sent out. Run it once.
-- =====================================================================

begin;

-- Keep a copy of what the keys were, so a client who calls confused about a
-- key that "stopped working" can be matched against the old one. Fingerprints
-- only — the previous secret is not worth preserving in plaintext.
create table if not exists public.access_key_rotations (
  id           bigserial primary key,
  client_id    uuid not null references public.clients(id) on delete cascade,
  old_key_fp   text not null,
  rotated_at   timestamptz not null default now()
);
alter table public.access_key_rotations enable row level security;
drop policy if exists access_key_rotations_team_select on public.access_key_rotations;
create policy access_key_rotations_team_select
  on public.access_key_rotations for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- Unbiased draw from a 31-glyph alphabet.
--
-- 256 is not a multiple of 31, so plain (byte % 31) would make the first
-- eight glyphs very slightly likelier than the rest. Bytes at or above the
-- largest usable multiple are rejected and redrawn instead, which keeps every
-- glyph equally likely and every key at its full entropy.
-- ---------------------------------------------------------------------
create or replace function public.gen_access_key_suffix(p_len int default 12)
returns text
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  n        constant int  := length(alphabet);          -- 31
  cutoff   constant int  := (256 / n) * n;             -- 248
  out      text := '';
  b        int;
begin
  while length(out) < p_len loop
    b := get_byte(gen_random_bytes(1), 0);
    if b < cutoff then
      out := out || substr(alphabet, (b % n) + 1, 1);
    end if;
  end loop;
  return out;
end;
$$;
revoke all on function public.gen_access_key_suffix(int) from public;

-- ---------------------------------------------------------------------
-- Rotate. The prefix keeps its human-recognisable shape; it is not secret,
-- which is exactly why it is safe to keep.
-- ---------------------------------------------------------------------
insert into public.access_key_rotations (client_id, old_key_fp)
select id, substr(encode(digest(access_key, 'sha256'), 'hex'), 1, 16)
from public.clients
where access_key is not null;

update public.clients c
set access_key =
      coalesce(
        nullif(regexp_replace(upper(split_part(c.business_name, ' ', 1)), '[^A-Z0-9]', '', 'g'), ''),
        'NABL'
      )
      || '-' || substr(s.suffix, 1, 4)
      || '-' || substr(s.suffix, 5, 4)
      || '-' || substr(s.suffix, 9, 4)
from (
  select id, public.gen_access_key_suffix(12) as suffix
  from public.clients
) s
where c.id = s.id;

-- Prefixes are truncated to six characters by the app; match that so a key
-- generated here and one generated in the UI look the same.
update public.clients
set access_key = substr(split_part(access_key, '-', 1), 1, 6)
                 || '-' || split_part(access_key, '-', 2)
                 || '-' || split_part(access_key, '-', 3)
                 || '-' || split_part(access_key, '-', 4)
where length(split_part(access_key, '-', 1)) > 6;

commit;

-- =====================================================================
-- The new keys. Send each client theirs, over a channel you trust.
-- =====================================================================
select business_name, contact_name, contact_email, access_key
from public.clients
order by business_name;
