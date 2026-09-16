-- A double comma is not an address.
--
-- "Dunnington Heath Farm,, Alcester,, Warwickshire, B49 5PD" derived no
-- town at all: stripping the postcode and the county left a trailing
-- comma, the last segment was empty, and empty is not a town. Collapse
-- repeated commas and drop trailing ones before anything else looks at
-- the string.
--
-- This does not rescue every address. "Market Place, NG17 1AQ" carries no
-- town anywhere in it, and no amount of string work will invent one - that
-- needs a postcode-to-town table, or a person. Which is why town is a
-- plain, editable column: derive what can be derived, correct the rest.

create or replace function public.lead_town(p_location text)
returns text language sql immutable as $fn$
  with s as (
    select
      btrim(substring(x from '([^,]+)$'))        as last_part,
      btrim(substring(x from '([^,]+),[^,]*$'))  as second_last
    from (
      select regexp_replace(
               regexp_replace(
                 regexp_replace(
                   -- Empty segments first, or they become the answer.
                   regexp_replace(regexp_replace(coalesce(p_location, ''),
                     '\s*,(\s*,)+\s*', ', ', 'g'), '\s*,\s*$', ''),
                   ',\s*[A-Z]{1,2}[0-9][A-Z0-9]?\s+[0-9][A-Z]{2}\s*$', '', 'i'),
                 ',\s*(Notts|Nottinghamshire|Nottinghamsgire|Lincs|Lincolnshire|Warwickshire|Warks|Derbyshire|Derbys|Leicestershire|Leics|Staffordshire|Staffs|West Midlands|Worcestershire|Worcs|England|UK|United Kingdom)\.?\s*$',
                 '', 'i'),
               '\s*,\s*$', '') as x
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

update public.sales_leads
   set town = public.lead_town(location)
 where town is null and location is not null;
