/* ============================================================
   CRM compliance schema — behavioural check.

   Stands up a throwaway PostgreSQL cluster, applies the base CRM
   schema and 202608160003_crm_compliance.sql, and then tries to do
   the things the schema is supposed to make impossible.

   The point is not that the migration parses. It is that the
   constraints and the send gate actually refuse. Every assertion
   below has been checked to fail when the rule it covers is removed
   — a test that cannot fail is decoration.

   Needs PostgreSQL server binaries locally (initdb, pg_ctl, psql).
   Nothing here touches the live project.

   Usage: node scripts/check-compliance-schema.mjs
   ============================================================ */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, existsSync, readdirSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 55433
let pass = 0, fail = 0
const line = (s) => console.log(s)
const ok = (n) => { pass++; line(`  ✓ ${n}`) }
const bad = (n, d = '') => { fail++; line(`  ✗ ${n}${d ? ` — ${d}` : ''}`) }

// ---- locate the server binaries -------------------------------------
function pgBin() {
  const roots = ['/usr/lib/postgresql', '/usr/local/pgsql', '/usr/pgsql']
  for (const r of roots) {
    if (!existsSync(r)) continue
    const vs = readdirSync(r).sort().reverse()
    for (const v of vs) {
      const b = join(r, v, 'bin')
      if (existsSync(join(b, 'initdb'))) return b
    }
  }
  if (existsSync('/usr/bin/initdb')) return '/usr/bin'
  return null
}
const BIN = pgBin()
if (!BIN) {
  line('\n  · PostgreSQL server binaries not found — skipping.')
  line('    This check needs initdb/pg_ctl locally; it never touches the live project.\n')
  process.exit(0)
}

const AS_POSTGRES = process.getuid && process.getuid() === 0
const DIR = mkdtempSync(join(tmpdir(), 'nabl-compliance-'))
const DATA = join(DIR, 'data')

const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: 'pipe', ...opts })

// Postgres refuses to run as root, so when we are root everything is
// dropped to the postgres user. `su -c` needs one shell string.
const run = (cmdline) =>
  AS_POSTGRES ? sh('su', ['postgres', '-c', cmdline]) : sh('bash', ['-lc', cmdline])

function psql(sql, { file = false } = {}) {
  // Collapsed to one line: the command is handed to `su -c` as a single
  // shell string, and an embedded newline arrives at psql as a literal \n.
  const target = file ? `-f ${sql}` : `-c ${JSON.stringify(String(sql).replace(/\s+/g, ' ').trim())}`
  return run(`${BIN}/psql -h ${DIR} -p ${PORT} -U postgres -X -At -q -v ON_ERROR_STOP=1 ${target}`)
}

/** Run SQL expecting it to be REFUSED. Returns the error text. */
function refuses(name, sql, expect) {
  try {
    psql(sql)
    bad(name, 'it was allowed')
    return ''
  } catch (e) {
    const msg = String(e.stderr || e.message).replace(/\s+/g, ' ').trim()
    if (expect && !expect.test(msg)) { bad(name, msg.slice(0, 110)); return msg }
    ok(name)
    return msg
  }
}

/** Run SQL expecting it to SUCCEED. */
function allows(name, sql) {
  try { psql(sql); ok(name); return true }
  catch (e) {
    bad(name, String(e.stderr || e.message).replace(/\s+/g, ' ').replace(/NOTICE:[^\n]*?(?=(ERROR|NOTICE|$))/g, '').trim().slice(0, 300))
    return false
  }
}

const val = (sql) => psql(sql).trim()

// ---- bring the cluster up -------------------------------------------
try {
  if (AS_POSTGRES) {
    try { sh('id', ['postgres']) } catch { sh('useradd', ['-m', 'postgres']) }
    sh('chown', ['-R', 'postgres:postgres', DIR])
  }
  run(`${BIN}/initdb -D ${DATA} -U postgres --auth=trust`)
  run(`${BIN}/pg_ctl -D ${DATA} -o "-k ${DIR} -p ${PORT} -c listen_addresses=" -l ${join(DIR, 'log')} start`)
  // pg_ctl returns once ready, but give the socket a beat on slow disks.
  for (let i = 0; i < 20; i++) {
    try { psql('select 1'); break } catch { sh('sleep', ['0.3']) }
  }

  const BOOTSTRAP = join(DIR, 'bootstrap.sql')
  writeFileSync(BOOTSTRAP, `
create schema if not exists auth;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, extensions to anon, authenticated, service_role;
-- Supabase grants EXECUTE on every new function directly to anon,
-- authenticated and service_role via default privileges. Without this line
-- the harness differs from production in the one way that matters: a
-- migration revoking only from PUBLIC looks correct here and leaves anon
-- holding EXECUTE on the live project. That is exactly what happened.
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`)
  chmodSync(BOOTSTRAP, 0o644)
  psql(BOOTSTRAP, { file: true })

  const MIGRATIONS = ['202606010001_sales_intelligence.sql', '202608160003_crm_compliance.sql',
                      '202608210001_marketing_tier_ceilings.sql',
                      '202608210002_pin_search_path_on_ceiling_lookup.sql',
                      '202608210003_postal_channel.sql',
                      '202608230001_research_endpoints.sql']
  for (const f of MIGRATIONS) {
    const p = join(DIR, f)
    writeFileSync(p, sh('cat', [join(ROOT, 'supabase/migrations', f)]))
    chmodSync(p, 0o644)
    psql(p, { file: true })
  }

  line('\nMIGRATION')
  ok('applies to a clean database')
  /* Re-running the compliance migrations must be harmless; every object in
     them uses if-not-exists or or-replace.

     Replayed as an ordered set rather than file by file, because a single file
     is not a safe unit to re-run: 202608210001 defines
     marketing_monthly_ceiling and 202608210002 redefines it to pin its
     search_path, so replaying 0001 alone silently reverts 0002. The first
     version of this check did exactly that, and the search_path assertions
     below are what caught it. In production, "re-run the migration" therefore
     always means the ordered set, never one file. */
  /* Written to a file and run with -f, NOT passed with -c. psql() collapses
     whitespace so the command survives `su -c` as one shell string, which
     turns a newline-separated list of \i commands into a single line — and
     psql's \i takes the whole rest of the line as one filename. The first
     version did that: it fed psql one mangled path, failed silently because a
     backslash-command error does not trip ON_ERROR_STOP, and reported the
     migrations as idempotent while replaying none of them. */
  const REPLAYABLE = MIGRATIONS.filter((f) => f !== '202606010001_sales_intelligence.sql')
  const REPLAY = join(DIR, 'replay.sql')
  writeFileSync(REPLAY, REPLAYABLE.map((f) => '\\i ' + join(DIR, f)).join('\n') + '\n')
  chmodSync(REPLAY, 0o644)
  allows('the compliance set is idempotent on a second run', '\\i ' + REPLAY)

  /* The June base migration is NOT re-runnable — its CREATE POLICY statements
     have no DROP POLICY IF EXISTS in front of them. Asserted rather than
     quietly skipped: it has already run against live, so fixing it would mean
     editing a migration that is now a record of what happened, and the useful
     thing is for the next person replaying migrations to know which file will
     stop them. */
  refuses('the June base migration is not re-runnable, and this is known',
    '\\i ' + join(DIR, '202606010001_sales_intelligence.sql'),
    /already exists/)

  // ---- fixtures -----------------------------------------------------
  psql(`insert into auth.users (id, email) values
        ('11111111-1111-1111-1111-111111111111','alex@nabl.agency') on conflict do nothing;`)
  const lead = (company) => val(
    `insert into public.sales_leads (company) values ('${company}') returning id;`)

  const L_DEFAULT = lead('Defaults Ltd')

  line('\nDEFAULTS — a new lead must not be contactable')
  const d = val(`select subscriber_type||'|'||lawful_basis||'|'||marketing_status||'|'||privacy_notice_status
                 from public.sales_leads where id='${L_DEFAULT}';`)
  d === 'unknown|unassessed|do_not_contact|not_given'
    ? ok('lands on unknown / unassessed / do_not_contact / not_given')
    : bad('lands on unknown / unassessed / do_not_contact / not_given', d)

  line('\nCONSTRAINTS — the illegal states')
  // Two constraints both refuse this and Postgres picks one; assert that it
  // is refused, not which of them spoke first.
  refuses('cannot be permitted with no paperwork',
    `update public.sales_leads set marketing_status='permitted' where id='${L_DEFAULT}';`,
    /permitted_is_documented|permitted_needs_a_basis/)

  refuses('opt_out without a timestamp is refused',
    `update public.sales_leads set opt_out=true where id='${L_DEFAULT}';`,
    /optout_consistent/)

  refuses('legitimate interests with no assessment on file is refused',
    `update public.sales_leads set lawful_basis='legitimate_interests' where id='${L_DEFAULT}';`,
    /li_needs_assessment/)

  // PECR: an individual subscriber is not unlocked by legitimate interests.
  const L_SOLE = lead('Sole Trader Joe')
  refuses('a sole trader cannot be permitted on legitimate interests',
    `update public.sales_leads set
       subscriber_type='sole_trader', lawful_basis='legitimate_interests',
       lia_ref='LIA-1', lia_completed_at=now(),
       source='companies_house', source_date=current_date,
       privacy_notice_status='given_at_first_contact',
       marketing_status='permitted'
     where id='${L_SOLE}';`,
    /permitted_needs_a_basis/)

  allows('the same sole trader can be permitted with consent',
    `update public.sales_leads set
       subscriber_type='sole_trader', lawful_basis='consent',
       source='inbound_enquiry', source_date=current_date,
       privacy_notice_status='not_required',
       marketing_status='permitted'
     where id='${L_SOLE}';`)

  line('\nTHE SEND GATE')
  const L_OK = lead('Permitted Ltd')
  psql(`update public.sales_leads set
          subscriber_type='corporate', lawful_basis='legitimate_interests',
          lia_ref='LIA-2', lia_completed_at=now(),
          source='companies_house', source_date=current_date,
          privacy_notice_status='given_at_first_contact',
          marketing_status='permitted'
        where id='${L_OK}';`)

  const send = (leadId, addr, extra = '') =>
    `insert into public.marketing_sends
       (lead_id, channel, recipient, opt_out_included, sender_identity, approved_at ${extra ? ', outcome' : ''})
     values ('${leadId}','email','${addr}',true,'n.abl, Nottingham', now() ${extra});`

  allows('a fully documented corporate lead can be sent to',
    send(L_OK, 'hello@permitted.example'))

  refuses('a lead with no paperwork is blocked at the send path',
    send(L_DEFAULT, 'hello@defaults.example'),
    /compliance gate/)

  refuses('a message with no opt-out route cannot even be recorded',
    `insert into public.marketing_sends
       (lead_id, channel, recipient, opt_out_included, sender_identity, approved_at)
     values ('${L_OK}','email','hello@permitted.example',false,'n.abl', now());`,
    /opt_out_required/)

  line('\nSUPPRESSION')
  psql(`insert into public.marketing_suppression (channel, identifier, scope, reason)
        values ('email','hello@permitted.example','address','reply_asking_to_stop');`)
  refuses('a suppressed address is blocked even on a permitted lead',
    send(L_OK, 'hello@permitted.example'),
    /compliance gate/)

  // The bug this suite was written to find: the gate returned NULL rather
  // than false for a suppressed address with no re-consent, and `if not NULL
  // then` never fired. Assert the verdict is a definite boolean, not just
  // that the send was refused — a later refactor could restore the NULL
  // while some other rule happens to block the send.
  const verdict = val(`select coalesce(public.marketing_send_allowed(
      '${L_OK}','email','hello@permitted.example')::text, 'NULL');`)
  verdict === 'false'
    ? ok('the gate returns false, not NULL, for a suppressed address')
    : bad('the gate returns false, not NULL, for a suppressed address', `got ${verdict}`)

  refuses('suppression rows cannot be updated',
    `update public.marketing_suppression set reason='manual' where channel='email';`,
    /append-only/)
  refuses('suppression rows cannot be deleted',
    `delete from public.marketing_suppression where channel='email';`,
    /append-only/)

  // Domain scope catches an address we have never seen before.
  psql(`insert into public.marketing_suppression (channel, identifier, scope, reason)
        values ('email','permitted.example','domain','complaint') on conflict do nothing;`)
  refuses('domain suppression blocks a different mailbox at that domain',
    send(L_OK, 'someone.else@permitted.example'),
    /compliance gate/)

  line('\nRE-CONSENT')
  // Earlier than the suppression: must NOT unblock.
  psql(`insert into public.marketing_consent (channel, identifier, given_at, evidence)
        values ('email','hello@permitted.example', now() - interval '1 day', 'older than the opt-out');`)
  refuses('consent dated before the opt-out does not unblock',
    send(L_OK, 'hello@permitted.example'),
    /compliance gate/)

  // Later: honoured.
  psql(`insert into public.marketing_consent (channel, identifier, given_at, evidence)
        values ('email','hello@permitted.example', now() + interval '1 minute', 'asked us to resume, in writing');`)
  allows('consent dated after the opt-out re-opens the address',
    send(L_OK, 'hello@permitted.example'))

  line('\nSURVIVAL — deleting a lead must not erase the record')
  const L_GONE = lead('Deleted Ltd')
  psql(`update public.sales_leads set
          subscriber_type='corporate', lawful_basis='consent',
          source='referral', source_date=current_date,
          privacy_notice_status='given_at_first_contact',
          marketing_status='permitted'
        where id='${L_GONE}';`)
  psql(send(L_GONE, 'gone@deleted.example'))
  psql(`insert into public.marketing_suppression (channel, identifier, scope, reason, source_lead_id)
        values ('email','gone@deleted.example','address','opt_out_link','${L_GONE}');`)
  psql(`delete from public.sales_leads where id='${L_GONE}';`)

  val(`select count(*) from public.marketing_suppression where identifier='gone@deleted.example';`) === '1'
    ? ok('suppression survives deletion of the lead') : bad('suppression survives deletion of the lead')
  val(`select count(*) from public.marketing_sends where recipient='gone@deleted.example';`) === '1'
    ? ok('the send record survives deletion of the lead') : bad('the send record survives deletion of the lead')
  val(`select coalesce(lead_id::text,'null') from public.marketing_sends where recipient='gone@deleted.example';`) === 'null'
    ? ok('and its lead_id is nulled, not cascaded') : bad('lead_id should be null after delete')

  line('\napply_opt_out')
  const L_OPT = lead('OptOut Ltd')
  psql(`insert into public.sales_contacts (lead_id, name, email)
        values ('${L_OPT}','Pat',' Pat@OptOut.Example ');`)
  psql(`select public.apply_opt_out('${L_OPT}','email','pat@optout.example','reply_asking_to_stop','said stop, by reply');`)
  val(`select marketing_status||'|'||opt_out::text from public.sales_leads where id='${L_OPT}';`) === 'opted_out|true'
    ? ok('flips the lead to opted_out') : bad('flips the lead to opted_out')
  val(`select contact_marketing_status from public.sales_contacts where lead_id='${L_OPT}';`) === 'opted_out'
    ? ok('flips the contact, matching on the normalised address') : bad('flips the contact')
  val(`select count(*) from public.marketing_suppression where identifier='pat@optout.example';`) === '1'
    ? ok('writes the suppression row') : bad('writes the suppression row')

  /* ---- LIA-2026-08-v2 tier ceilings ---------------------------------

     The assessment splits the audience three ways and sets a monthly
     first-contact ceiling per tier. Section 7 of the assessment says that
     until the ceiling is enforced here it is an intention rather than a
     safeguard, so these assertions are what let it be called one. Each has
     been checked to fail with the guard removed. */

  line('\nTIER — which regime a lead falls under')

  const sendable = (company) => {
    const id = lead(company)
    psql(`update public.sales_leads set subscriber_type='corporate',
          subscriber_type_evidence='companies house', subscriber_type_checked_at=now(),
          lawful_basis='legitimate_interests', lia_ref='LIA-2026-08-v2',
          lia_completed_at='2026-08-21', source='companies_house',
          source_detail='bulk register', source_date='2026-08-21',
          privacy_notice_status='given_at_first_contact', marketing_status='permitted'
          where id='${id}';`)
    return id
  }
  const sendTo = (id, addr) => psql(
    `insert into public.marketing_sends (lead_id, channel, recipient, subject, sender_identity, opt_out_included, approved_at)
     values ('${id}','email','${addr}','hello','n.abl <hello@nabl.agency>', true, now());`)

  const T_UNKNOWN = lead('Unknown Subscriber Ltd')
  val(`select public.marketing_tier('${T_UNKNOWN}');`) === 'C'
    ? ok('an unresolved subscriber type is tier C, not tier A') : bad('an unresolved subscriber type is tier C, not tier A')

  const T_A = sendable('Generic Inbox Ltd')
  val(`select public.marketing_tier('${T_A}');`) === 'A'
    ? ok('a company with no named person is tier A') : bad('a company with no named person is tier A')

  psql(`insert into public.sales_contacts (lead_id, name, email) values ('${T_A}','   ','x@a.example');`)
  val(`select public.marketing_tier('${T_A}');`) === 'A'
    ? ok('a whitespace-only contact name does not make it tier B') : bad('a whitespace-only contact name does not make it tier B')

  const T_B = sendable('Named Director Ltd')
  psql(`insert into public.sales_contacts (lead_id, name, email) values ('${T_B}','Sam Reed','sam@b.example');`)
  val(`select public.marketing_tier('${T_B}');`) === 'B'
    ? ok('holding a name moves the same company to tier B') : bad('holding a name moves the same company to tier B')

  const ceilings = val(`select public.marketing_monthly_ceiling('email','A')||'|'||
                        public.marketing_monthly_ceiling('email','B')||'|'||
                        public.marketing_monthly_ceiling('email','C');`)
  ceilings === '2000|400|0'
    ? ok('ceilings are 2000 / 400 / 0, as LIA-2026-08-v2 section 6') : bad('ceilings are 2000 / 400 / 0, as LIA-2026-08-v2 section 6', ceilings)

  line('\nCEILINGS — a monthly cap that actually stops a send')

  allows('a first contact is accepted', `insert into public.marketing_sends
    (lead_id, channel, recipient, subject, sender_identity, opt_out_included, approved_at)
    values ('${T_B}','email','sam@b.example','hello','n.abl <hello@nabl.agency>', true, now());`)

  val(`select tier||'|'||is_first_contact::text||'|'||counts_toward_ceiling::text
       from public.marketing_sends where lead_id='${T_B}';`) === 'B|true|true'
    ? ok('and is stamped with its tier, marked a first contact, and counted')
    : bad('and is stamped with its tier, marked a first contact, and counted')

  sendTo(T_B, 'sam@b.example')
  val(`select count(*) from public.marketing_sends where lead_id='${T_B}' and is_first_contact;`) === '1'
    ? ok('a follow-up to the same lead is not a second first contact')
    : bad('a follow-up to the same lead is not a second first contact')

  /* Fill tier B to its ceiling with real rows rather than a test-only
     override, so what is proved is the shipped number. */
  /* Written to a file rather than passed with -c: the command reaches psql
     through `su -c`, and bash expands $$ in a double-quoted string to its own
     pid before psql ever sees the dollar-quoted block. */
  const FILLER = join(DIR, 'filler.sql')
  writeFileSync(FILLER, `do $$
    declare v_id uuid;
    begin
      for i in 1..399 loop
        insert into public.sales_leads (company, subscriber_type, subscriber_type_evidence,
          subscriber_type_checked_at, lawful_basis, lia_ref, lia_completed_at, source,
          source_detail, source_date, privacy_notice_status, marketing_status)
        values ('Filler '||i, 'corporate', 'companies house', now(), 'legitimate_interests',
          'LIA-2026-08-v2', '2026-08-21', 'companies_house', 'bulk register', '2026-08-21',
          'given_at_first_contact', 'permitted') returning id into v_id;
        insert into public.sales_contacts (lead_id, name, email)
        values (v_id, 'Person '||i, 'p'||i||'@filler.example');
        insert into public.marketing_sends (lead_id, channel, recipient, subject,
          sender_identity, opt_out_included, approved_at)
        values (v_id, 'email', 'p'||i||'@filler.example', 'hello',
          'n.abl <hello@nabl.agency>', true, now());
      end loop;
    end $$;`)
  chmodSync(FILLER, 0o644)
  psql(FILLER, { file: true })
  val(`select public.marketing_first_contacts_this_month('email','B');`) === '400'
    ? ok('400 first contacts this month counts as 400') : bad('400 first contacts this month counts as 400',
        val(`select public.marketing_first_contacts_this_month('email','B');`))

  const T_OVER = sendable('One Too Many Ltd')
  psql(`insert into public.sales_contacts (lead_id, name, email) values ('${T_OVER}','Jo Vale','jo@over.example');`)
  refuses('the 401st tier B first contact is refused',
    `insert into public.marketing_sends (lead_id, channel, recipient, subject, sender_identity, opt_out_included, approved_at)
     values ('${T_OVER}','email','jo@over.example','hello','n.abl <hello@nabl.agency>', true, now());`,
    /monthly ceiling reached/)

  /* Tier B is full at this point. A corporate lead we hold consent for is
     still tier B, and without the consent branch the legitimate interests
     ceiling would refuse a send that the person asked for. The sole trader
     below does not test this: the tier C branch exempts them anyway. */
  const T_CORP_CONSENT = lead('Consented Company Ltd')
  psql(`update public.sales_leads set subscriber_type='corporate',
        subscriber_type_evidence='companies house', subscriber_type_checked_at=now(),
        lawful_basis='consent', source='own_website', source_detail='newsletter signup',
        source_date='2026-08-21', privacy_notice_status='not_required',
        marketing_status='permitted' where id='${T_CORP_CONSENT}';`)
  psql(`insert into public.sales_contacts (lead_id, name, email)
        values ('${T_CORP_CONSENT}','Wren Ash','wren@corp.example');`)
  val(`select public.marketing_tier('${T_CORP_CONSENT}');`) === 'B'
    ? ok('a company we hold consent for is still tier B')
    : bad('a company we hold consent for is still tier B')
  allows('but consent is exempt from the ceiling, so it sends with tier B full',
    `insert into public.marketing_sends (lead_id, channel, recipient, subject, sender_identity, opt_out_included, approved_at)
     values ('${T_CORP_CONSENT}','email','wren@corp.example','hello','n.abl <hello@nabl.agency>', true, now());`)

  /* And it must not be counted either. A send exempt from the ceiling that
     still spends allowance would let a consented audience crowd out the
     legitimate interests one. */
  val(`select is_first_contact::text||'|'||counts_toward_ceiling::text
       from public.marketing_sends where lead_id='${T_CORP_CONSENT}';`) === 'true|false'
    ? ok('and it spends none of the tier B allowance')
    : bad('and it spends none of the tier B allowance')
  val(`select public.marketing_first_contacts_this_month('email','B');`) === '400'
    ? ok('so the month total is unmoved by it')
    : bad('so the month total is unmoved by it',
        val(`select public.marketing_first_contacts_this_month('email','B');`))

  allows('but a follow-up to a lead already contacted still goes',
    `insert into public.marketing_sends (lead_id, channel, recipient, subject, sender_identity, opt_out_included, approved_at)
     values ('${T_B}','email','sam@b.example','following up','n.abl <hello@nabl.agency>', true, now());`)

  allows('and tier A is unaffected by tier B being full',
    `insert into public.marketing_sends (lead_id, channel, recipient, subject, sender_identity, opt_out_included, approved_at)
     values ('${T_A}','email','info@a.example','hello','n.abl <hello@nabl.agency>', true, now());`)

  /* The window is a calendar month, so last month's sends must not count
     against this one. UPDATE does not fire a BEFORE INSERT trigger, which is
     what makes backdating possible here at all. */
  psql(`update public.marketing_sends set sent_at = date_trunc('month', now()) - interval '1 day'
        where lead_id in (select lead_id from public.marketing_sends where tier='B'
                          and counts_toward_ceiling limit 50);`)
  const afterBackdate = val(`select public.marketing_first_contacts_this_month('email','B');`)
  afterBackdate === '350'
    ? ok('last month\'s first contacts do not count against this month')
    : bad('last month\'s first contacts do not count against this month', afterBackdate)

  allows('so a first contact is possible again once the month rolls over',
    `insert into public.marketing_sends (lead_id, channel, recipient, subject, sender_identity, opt_out_included, approved_at)
     values ('${T_OVER}','email','jo@over.example','hello','n.abl <hello@nabl.agency>', true, now());`)

  /* A multi-row INSERT is the case a per-row guard could plausibly miss, if a
     query inside the trigger could not see rows inserted by the same command.
     It can, so the row that crosses the ceiling is refused like any other.
     This assertion is what establishes that, and it is why there is one guard
     here and not two. */
  const BULK = join(DIR, 'bulk.sql')
  writeFileSync(BULK, `
insert into public.sales_leads (company, subscriber_type, subscriber_type_evidence,
  subscriber_type_checked_at, lawful_basis, lia_ref, lia_completed_at, source,
  source_detail, source_date, privacy_notice_status, marketing_status)
select 'Bulk '||i, 'corporate', 'companies house', now(), 'legitimate_interests',
  'LIA-2026-08-v2', '2026-08-21', 'companies_house', 'bulk register', '2026-08-21',
  'given_at_first_contact', 'permitted'
from generate_series(1, 50) i;

insert into public.sales_contacts (lead_id, name, email)
select id, 'Bulk Person', 'bulk@x.example'
from public.sales_leads where company like 'Bulk %';

insert into public.marketing_sends (lead_id, channel, recipient, subject,
  sender_identity, opt_out_included, approved_at)
select id, 'email', 'bulk@x.example', 'hello', 'n.abl <hello@nabl.agency>', true, now()
from public.sales_leads where company like 'Bulk %';
`)
  chmodSync(BULK, 0o644)
  refuses('a multi-row INSERT is stopped on the row that crosses the ceiling',
    '\\i ' + BULK, /ceiling/)

  refuses('a send against a lead that does not exist is refused, not defaulted',
    `insert into public.marketing_sends (lead_id, channel, recipient, subject, sender_identity, opt_out_included, approved_at)
     values ('99999999-9999-9999-9999-999999999999','email','x@x.example','hello','n.abl <hello@nabl.agency>', true, now());`,
    /no such lead|violates foreign key/)

  /* A consented sole trader is tier C, and tier C's ceiling is zero. The first
     draft capped them there, which would have refused a send both assessments
     allow: a ceiling limits how far we push ourselves onto people who did not
     ask, and this one asked. */
  const T_CONSENT = lead('Consented Sole Trader')
  psql(`update public.sales_leads set subscriber_type='sole_trader',
        subscriber_type_evidence='their website', subscriber_type_checked_at=now(),
        lawful_basis='consent', source='own_website', source_detail='signup form',
        source_date='2026-08-21', privacy_notice_status='not_required',
        marketing_status='permitted' where id='${T_CONSENT}';`)
  val(`select public.marketing_tier('${T_CONSENT}');`) === 'C'
    ? ok('a sole trader is tier C even with consent') : bad('a sole trader is tier C even with consent')
  allows('a consented sole trader sends too',
    `insert into public.marketing_sends (lead_id, channel, recipient, subject, sender_identity, opt_out_included, approved_at)
     values ('${T_CONSENT}','email','sole@trader.example','hello','n.abl <hello@nabl.agency>', true, now());`)

  /* ---- PMA-2026-08-v1: the postal channel ---------------------------

     Post is outside PECR and, addressed to a role, engages no personal data
     at all. The gate has to know that, and has to keep refusing the moment a
     person's name appears. */

  line('\nPOST — outside PECR, and the gate has to know it')

  const T_POST = lead('Post Only Sole Trader')
  psql(`update public.sales_leads set subscriber_type='sole_trader',
        subscriber_type_evidence='not on the Companies House register',
        subscriber_type_checked_at=now(), lawful_basis='not_personal_data',
        source='public_company_information', source_detail='ICO register',
        source_date='2026-08-21', privacy_notice_status='not_required',
        marketing_status='permitted' where id='${T_POST}';`)

  refuses('a sole trader still cannot be emailed',
    `insert into public.marketing_sends (lead_id, channel, recipient, subject, sender_identity, opt_out_included, approved_at)
     values ('${T_POST}','email','info@sole.example','hello','n.abl <hello@nabl.agency>', true, now());`,
    /compliance gate/)

  allows('but the same sole trader can be sent a letter',
    `insert into public.marketing_sends (lead_id, channel, recipient, subject, sender_identity, opt_out_included, approved_at)
     values ('${T_POST}','post','The Owner, 1 High Street, Nottingham NG1 1AA','hello','n.abl, Nottingham', true, now());`)

  /* The whole postal assessment rests on there being no person in the record.
     If one appears, 'not_personal_data' stops being true and the gate must
     stop believing it — rather than trusting whoever set the column. */
  psql(`insert into public.sales_contacts (lead_id, name, email)
        values ('${T_POST}','Dana Fields','dana@sole.example');`)
  refuses('once a person is named, not_personal_data no longer opens the door',
    `insert into public.marketing_sends (lead_id, channel, recipient, subject, sender_identity, opt_out_included, approved_at)
     values ('${T_POST}','post','Dana Fields, 1 High Street','hello','n.abl, Nottingham', true, now());`,
    /compliance gate/)

  /* The extraction pipeline only keeps role addresses, but a human can type
     anything into the CRM and the old AI CRM filled this column with the
     literal string "Public contact route". That is not a person. */
  const T_ROUTE = lead('Generic Route Only Ltd')
  psql(`update public.sales_leads set subscriber_type='sole_trader',
        subscriber_type_evidence='not on the register', subscriber_type_checked_at=now(),
        lawful_basis='not_personal_data', source='public_company_information',
        source_detail='ICO register', source_date='2026-08-21',
        privacy_notice_status='not_required', marketing_status='permitted'
        where id='${T_ROUTE}';`)
  psql(`insert into public.sales_contacts (lead_id, name, email)
        values ('${T_ROUTE}','Public contact route','info@route.example');`)
  val(`select public.has_named_individual('${T_ROUTE}')::text;`) === 'false'
    ? ok('"Public contact route" is not treated as a person')
    : bad('"Public contact route" is not treated as a person')
  allows('so a letter to it is still allowed',
    `insert into public.marketing_sends (lead_id, channel, recipient, subject, sender_identity, opt_out_included, approved_at)
     values ('${T_ROUTE}','post','The Owner, 2 High Street','hello','n.abl, Nottingham', true, now());`)

  /* Phone is lawful to businesses under reg 21 but only after screening
     against both the CTPS and the TPS, and we hold no screening data. The
     honest answer with nothing to check is no. */
  refuses('phone is refused outright while there is no TPS screening',
    `insert into public.marketing_sends (lead_id, channel, recipient, subject, sender_identity, opt_out_included, approved_at)
     values ('${T_ROUTE}','phone','01159000000','hello','n.abl, Nottingham', true, now());`,
    /compliance gate/)

  /* An objection is absolute in any medium, so a postal suppression must stop
     a letter exactly as an email suppression stops an email.

     Suppressed against a DIFFERENT lead, deliberately. apply_out_out on the
     lead itself also sets opt_out and marketing_status, and the gate refuses
     on those before it ever consults the suppression list — so opting the
     lead out proves the lead flags work and says nothing about suppression.
     A mutation that broke postal suppression entirely left that version of
     this test green. */
  const T_SUPP = lead('Postally Suppressed Ltd')
  psql(`update public.sales_leads set subscriber_type='sole_trader',
        subscriber_type_evidence='not on the register', subscriber_type_checked_at=now(),
        lawful_basis='not_personal_data', source='public_company_information',
        source_detail='ICO register', source_date='2026-08-21',
        privacy_notice_status='not_required', marketing_status='permitted'
        where id='${T_SUPP}';`)
  psql(`insert into public.marketing_suppression (channel, identifier, scope, reason, evidence)
        values ('post','the owner, 9 quiet lane','address','do_not_contact_request','returned marked no thanks');`)
  refuses('a postal suppression stops a letter to a still-permitted lead',
    `insert into public.marketing_sends (lead_id, channel, recipient, subject, sender_identity, opt_out_included, approved_at)
     values ('${T_SUPP}','post','The Owner, 9 Quiet Lane','hello','n.abl, Nottingham', true, now());`,
    /compliance gate/)

  allows('and a different address at that lead is untouched',
    `insert into public.marketing_sends (lead_id, channel, recipient, subject, sender_identity, opt_out_included, approved_at)
     values ('${T_SUPP}','post','The Owner, 10 Quiet Lane','hello','n.abl, Nottingham', true, now());`)

  /* And an objection recorded through apply_opt_out still stops the lead. */
  psql(`select public.apply_opt_out('${T_ROUTE}','post','The Owner, 2 High Street','do_not_contact_request','returned the letter marked no thanks');`)
  refuses('a postal objection stops the next letter',
    `insert into public.marketing_sends (lead_id, channel, recipient, subject, sender_identity, opt_out_included, approved_at)
     values ('${T_ROUTE}','post','The Owner, 2 High Street','hello again','n.abl, Nottingham', true, now());`,
    /compliance gate/)

  const postCeiling = val(`select public.marketing_monthly_ceiling('post','A')||'|'||
                           public.marketing_monthly_ceiling('post','C')||'|'||
                           public.marketing_monthly_ceiling('phone','A');`)
  postCeiling === '1000|1000|0'
    ? ok('post is capped at 1000 whatever the tier, and phone at 0')
    : bad('post is capped at 1000 whatever the tier, and phone at 0', postCeiling)

  /* Channels do not share an allowance: a letter must not spend email's
     ceiling, and the two are counted separately. */
  const emailSpent = val(`select public.marketing_first_contacts_this_month('email','C');`)
  emailSpent === '0'
    ? ok('letters spend none of the email allowance')
    : bad('letters spend none of the email allowance', emailSpent)

  /* ---- research endpoints ------------------------------------------

     Each team member's runs go through their own Claude subscription, so the
     edge function routes by caller rather than to a shared endpoint. Two
     things have to hold: nobody can read anybody's service token, and the
     rate limit is the database's rather than the edge function's. */

  line('\nRESEARCH ENDPOINTS — one per person, token not readable by anyone')

  psql(`insert into auth.users (id, email) values
        ('22222222-2222-2222-2222-222222222222','sam@nabl.agency') on conflict do nothing;`)

  allows('an endpoint can be registered', `insert into public.research_endpoints
    (user_id, url, service_token, label) values
    ('11111111-1111-1111-1111-111111111111','https://research.nabl.agency','tok-secret','Alex laptop');`)

  refuses('a plain-http endpoint is refused, so the token never crosses the wire in clear',
    `insert into public.research_endpoints (user_id, url, service_token) values
     ('22222222-2222-2222-2222-222222222222','http://research.nabl.agency','tok-2');`,
    /url_check|violates check/)

  /* The whole design rests on this: the token sits in a row its owner is
     allowed to read, so RLS alone does not hide it. It takes a column grant,
     and a column grant is easy to write and easy to get wrong. */
  const canReadToken = val(`select has_column_privilege('authenticated','public.research_endpoints','service_token','select')::text;`)
  canReadToken === 'false'
    ? ok('a signed-in user cannot read a service token, not even their own')
    : bad('a signed-in user cannot read a service token', 'authenticated has SELECT on it')
  const canReadUrl = val(`select has_column_privilege('authenticated','public.research_endpoints','url','select')::text;`)
  canReadUrl === 'true'
    ? ok('but can read the rest of their own row') : bad('can read the rest of their own row')
  const anonSees = val(`select has_table_privilege('anon','public.research_endpoints','select')::text;`)
  anonSees === 'false' ? ok('and anon sees nothing at all') : bad('anon sees nothing at all')

  line('\nRESEARCH RUNS — the rate limit belongs to the database')

  allows('a run can be started against a registered endpoint',
    `insert into public.research_runs (user_id, lead_company) values
     ('11111111-1111-1111-1111-111111111111','Test Ltd');`)

  refuses('a user with no endpoint cannot start one',
    `insert into public.research_runs (user_id, lead_company) values
     ('22222222-2222-2222-2222-222222222222','Test Ltd');`,
    /no research endpoint registered/)

  psql(`update public.research_endpoints set runs_per_hour = 3
        where user_id = '11111111-1111-1111-1111-111111111111';`)
  psql(`insert into public.research_runs (user_id, lead_company) values
        ('11111111-1111-1111-1111-111111111111','Two'),
        ('11111111-1111-1111-1111-111111111111','Three');`)
  refuses('the fourth run in an hour is refused when the limit is three',
    `insert into public.research_runs (user_id, lead_company) values
     ('11111111-1111-1111-1111-111111111111','Four');`,
    /rate limit/)

  /* A run that failed still spent the allowance. Counting only successes is a
     rate limit an error loop walks straight through. */
  psql(`update public.research_runs set status = 'failed', error = 'tunnel down'
        where user_id = '11111111-1111-1111-1111-111111111111';`)
  refuses('a failed run still counts against the limit',
    `insert into public.research_runs (user_id, lead_company) values
     ('11111111-1111-1111-1111-111111111111','Five');`,
    /rate limit/)

  psql(`update public.research_runs set started_at = now() - interval '2 hours'
        where user_id = '11111111-1111-1111-1111-111111111111';`)
  allows('but the window is rolling, so an hour later it opens again',
    `insert into public.research_runs (user_id, lead_company) values
     ('11111111-1111-1111-1111-111111111111','Six');`)

  psql(`update public.research_endpoints set enabled = false
        where user_id = '11111111-1111-1111-1111-111111111111';`)
  refuses('a disabled endpoint refuses without being deleted',
    `insert into public.research_runs (user_id, lead_company) values
     ('11111111-1111-1111-1111-111111111111','Seven');`,
    /disabled/)
  psql(`update public.research_endpoints set enabled = true, runs_per_hour = 20
        where user_id = '11111111-1111-1111-1111-111111111111';`)

  /* Deleting a lead must not erase the record of what was asked about it. */
  const L_RES = lead('Researched Then Deleted Ltd')
  psql(`insert into public.research_runs (user_id, lead_id, lead_company) values
        ('11111111-1111-1111-1111-111111111111','${L_RES}','Researched Then Deleted Ltd');`)
  psql(`delete from public.sales_leads where id = '${L_RES}';`)
  val(`select count(*) from public.research_runs where lead_company = 'Researched Then Deleted Ltd';`) === '1'
    ? ok('a run survives the lead it was about being deleted')
    : bad('a run survives the lead being deleted')
  val(`select lead_id is null from public.research_runs where lead_company = 'Researched Then Deleted Ltd';`) === 't'
    ? ok('and its lead_id is nulled rather than cascading the row away')
    : bad('its lead_id is nulled, not cascaded')

  line('\nGRANTS — the default EXECUTE to PUBLIC must be gone')
  for (const [fn, sig] of [
    ['apply_opt_out', 'uuid, text, text, text, text'],
    ['marketing_send_allowed', 'uuid, text, text'],
    ['marketing_suppression_append_only', ''],
    ['marketing_sends_guard', ''],
    ['marketing_tier', 'uuid'],
    ['marketing_first_contacts_this_month', 'text, text'],
    ['has_named_individual', 'uuid'],
    ['marketing_ceiling_guard', ''],
    ['research_run_guard', ''],
  ]) {
    const anon = val(`select has_function_privilege('anon','public.${fn}(${sig})','execute')::text;`)
    anon === 'false' ? ok(`anon cannot execute ${fn}`) : bad(`anon cannot execute ${fn}`, 'anon has EXECUTE')
  }
  line('\nSEARCH PATH — every compliance function must pin it')
  for (const fn of ['marketing_tier', 'marketing_monthly_ceiling',
                    'marketing_first_contacts_this_month', 'marketing_ceiling_guard',
                    'has_named_individual',
                    'marketing_send_allowed', 'apply_opt_out']) {
    const cfg = val(`select coalesce(array_to_string(p.proconfig, ','), '')
                     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'public' and p.proname = '${fn}';`)
    cfg.startsWith('search_path=')
      ? ok(`${fn} pins its search_path`)
      : bad(`${fn} pins its search_path`, cfg || 'not set')
  }

  const authOk = val(`select has_function_privilege('authenticated','public.apply_opt_out(uuid, text, text, text, text)','execute')::text;`)
  authOk === 'true' ? ok('authenticated can execute apply_opt_out') : bad('authenticated can execute apply_opt_out')

} catch (e) {
  bad('harness', String(e.stderr || e.message).replace(/\s+/g, ' ').trim().slice(0, 200))
} finally {
  try { run(`${BIN}/pg_ctl -D ${DATA} -m immediate stop`) } catch {}
  try { rmSync(DIR, { recursive: true, force: true }) } catch {}
}

line(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
