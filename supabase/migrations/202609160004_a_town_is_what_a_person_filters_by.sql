-- A town is what a person filters by.
--
-- The target filtered on postcode districts, because that is what fell out of
-- the address string most cleanly. Nobody thinks in districts. Asked to run
-- outreach on Nottingham, a person types Nottingham, not NG1, NG2, NG5, NG7.
--
-- So the town is derived once, written down, and then editable. lead_town()
-- is a best guess over a free-text address: it is right for the great
-- majority and wrong for a few ("Unit 8 Blenheim Park Road" is not a town).
-- A generated column would re-derive the same mistake on every write and
-- refuse to be corrected, so town is a plain column filled by a trigger on
-- insert. Derive, then let a person fix it.

create or replace function public.lead_town(p_location text)
returns text language sql immutable as $fn$
  with s as (
    select
      btrim(substring(x from '([^,]+)$'))        as last_part,
      btrim(substring(x from '([^,]+),[^,]*$'))  as second_last
    from (
      -- Strip the postcode, then the county. What is left ends in the town.
      select regexp_replace(
               regexp_replace(coalesce(p_location, ''),
                 ',\s*[A-Z]{1,2}[0-9][A-Z0-9]?\s+[0-9][A-Z]{2}\s*$', '', 'i'),
               ',\s*(Notts|Nottinghamshire|Nottinghamsgire|Lincs|Lincolnshire|Warwickshire|Warks|Derbyshire|Derbys|Leicestershire|Leics|Staffordshire|Staffs|West Midlands|Worcestershire|Worcs|England|UK|United Kingdom)\.?\s*$',
               '', 'i') as x
    ) y
  )
  select case
    when last_part is null or last_part = '' then null
    -- A street, a unit or a building is not a town. Fall back one comma.
    when last_part ~* '\m(road|street|lane|unit|park|place|avenue|way|drive|close|court|estate|industrial|house|mews|square|hill|walk|gardens?)\M'
         and nullif(second_last, '') is not null then initcap(second_last)
    else initcap(last_part) end
  from s
$fn$;

alter table public.sales_leads add column if not exists town text;

update public.sales_leads
   set town = public.lead_town(location)
 where town is null and location is not null;

create index if not exists sales_leads_town_idx on public.sales_leads (town);

create or replace function public.sales_leads_fill_town()
returns trigger language plpgsql
set search_path = public, pg_catalog as $fn$
begin
  -- Only when it was not supplied. A corrected town survives every later write.
  if new.town is null then new.town := public.lead_town(new.location); end if;
  return new;
end
$fn$;

drop trigger if exists sales_leads_fill_town on public.sales_leads;
create trigger sales_leads_fill_town
  before insert on public.sales_leads
  for each row execute function public.sales_leads_fill_town();

alter table public.outreach_target add column if not exists towns text[] not null default '{}';
alter table public.outreach_target drop column if exists districts;
