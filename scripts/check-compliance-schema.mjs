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
    bad(name, String(e.stderr || e.message).replace(/\s+/g, ' ').trim().slice(0, 110))
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
`)
  chmodSync(BOOTSTRAP, 0o644)
  psql(BOOTSTRAP, { file: true })

  for (const f of ['202606010001_sales_intelligence.sql', '202608160003_crm_compliance.sql']) {
    const p = join(DIR, f)
    writeFileSync(p, sh('cat', [join(ROOT, 'supabase/migrations', f)]))
    chmodSync(p, 0o644)
    psql(p, { file: true })
  }

  line('\nMIGRATION')
  ok('applies to a clean database')
  // Re-running must be harmless; every object uses if-not-exists / or-replace.
  allows('is idempotent on a second run', '\\i ' + join(DIR, '202608160003_crm_compliance.sql'))

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
    : bad('safe defaults', d)

  line('\nCONSTRAINTS — the illegal states')
  // Two constraints both refuse this and Postgres picks one; assert that it
  // is refused, not which of them spoke first.
  refuses('cannot be permitted with no paperwork',
    `update public.sales_leads set marketing_status='permitted' where id='${L_DEFAULT}';`,
    /permitted_is_documented|pecr_individual_needs_consent/)

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
    /pecr_individual_needs_consent/)

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

  line('\nGRANTS — the default EXECUTE to PUBLIC must be gone')
  for (const [fn, sig] of [
    ['apply_opt_out', 'uuid, text, text, text, text'],
    ['marketing_send_allowed', 'uuid, text, text'],
    ['marketing_suppression_append_only', ''],
    ['marketing_sends_guard', ''],
  ]) {
    const anon = val(`select has_function_privilege('anon','public.${fn}(${sig})','execute')::text;`)
    anon === 'false' ? ok(`anon cannot execute ${fn}`) : bad(`anon cannot execute ${fn}`, 'anon has EXECUTE')
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
