// The Oracle server's setup script (deploy/oracle/nabl.sh): the settings it
// reads from cloud-init, and the app environment it writes. The parts that
// need a real server (apt, Docker, Caddy, iptables) are not run here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(import.meta.dirname, '..', 'deploy', 'oracle', 'nabl.sh');
const CLOUD_INIT = readFileSync(join(import.meta.dirname, '..', 'deploy', 'oracle', 'cloud-init.yaml'), 'utf8');

function run(secrets: string, steps: string) {
  const dir = mkdtempSync(join(tmpdir(), 'nabl-oracle-'));
  writeFileSync(join(dir, 'secrets.env'), secrets);
  const r = spawnSync('bash', ['-c', `set -euo pipefail; source "${SCRIPT}"; ${steps}`], {
    env: { ...process.env, NABL_TEST: '1', NABL_DIR: dir }, encoding: 'utf8',
  });
  const read = (f: string) => readFileSync(join(dir, f), 'utf8');
  return { ...r, dir, read, done: () => rmSync(dir, { recursive: true, force: true }) };
}

const filled = [
  '# a comment',
  'GEMINI_API_KEY = "AIzaExample123"',
  "DATABASE_URL='postgresql://postgres.auivrancfnrdwyiqoakt:pa$s#word@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'",
  'CONSOLE_PASSWORD=long-console-password',
  'DEMO_PROXY_SECRET=proxy0secret0value',
  'ORIGIN_HOST=demo-origin.example.com',
  '',
].join('\n');

test('oracle: the app environment has every setting, unquoted, and a session secret that lasts', () => {
  const r = run(filled, 'check_settings; write_env; cp "$NABL_DIR/app.env" "$NABL_DIR/first.env"; write_env');
  try {
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const env = Object.fromEntries(r.read('app.env').trim().split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
    assert.equal(env.GEMINI_API_KEY, 'AIzaExample123');
    assert.equal(env.DATABASE_URL, 'postgresql://postgres.auivrancfnrdwyiqoakt:pa$s#word@aws-0-eu-central-1.pooler.supabase.com:5432/postgres');
    assert.equal(env.CONSOLE_PASSWORD, 'long-console-password');
    assert.equal(env.DEMO_PROXY_SECRET, 'proxy0secret0value');
    assert.equal(env.CLIENT_IP_HEADER, 'x-real-ip');
    assert.equal(env.MAX_CONCURRENT_CALLS, '3');
    assert.match(env.SESSION_SECRET, /^[0-9a-f]{64}$/);
    assert.equal(env.ORIGIN_HOST, undefined, 'the deploy\'s own settings stay out of the app');
    assert.equal(r.read('first.env'), r.read('app.env'), 'the session secret survives a redeploy, so sessions do too');
    assert.equal(statSync(join(r.dir, 'app.env')).mode & 0o777, 0o600);
  } finally {
    r.done();
  }
});

test('oracle: a value left as PASTE-HERE stops the install and says which', () => {
  const r = run(filled.replace('CONSOLE_PASSWORD=long-console-password', 'CONSOLE_PASSWORD=PASTE-HERE'), 'check_settings');
  try {
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /Fill in CONSOLE_PASSWORD/);
  } finally {
    r.done();
  }
  const bad = run(filled.replace(/DATABASE_URL=.*\n/, 'DATABASE_URL=https://auivrancfnrdwyiqoakt.supabase.co\n'), 'check_settings');
  try {
    assert.notEqual(bad.status, 0);
    assert.match(bad.stdout, /Session pooler/);
  } finally {
    bad.done();
  }
});

test('oracle: settings the deploy chooses can be overridden, and the host has a default', () => {
  const r = run(filled.replace('ORIGIN_HOST=demo-origin.example.com\n', 'MAX_CONCURRENT_CALLS=5\nSESSION_SECRET=fixed\n'), 'write_env; echo "host=$(setting ORIGIN_HOST demo-origin.nabl.agency)"');
  try {
    assert.equal(r.status, 0, r.stderr);
    const env = r.read('app.env');
    assert.match(env, /^MAX_CONCURRENT_CALLS=5$/m);
    assert.doesNotMatch(env, /MAX_CONCURRENT_CALLS=3/);
    assert.match(env, /^SESSION_SECRET=fixed$/m);
    assert.equal(env.match(/SESSION_SECRET=/g)?.length, 1);
    assert.match(r.stdout, /host=demo-origin\.nabl\.agency/);
  } finally {
    r.done();
  }
});

test('oracle: the cloud-init file asks for what the script checks, and fetches the script from this branch', () => {
  for (const k of ['GEMINI_API_KEY', 'DATABASE_URL', 'CONSOLE_PASSWORD', 'DEMO_PROXY_SECRET']) {
    assert.match(CLOUD_INIT, new RegExp(`^ {6}${k}=PASTE-HERE$`, 'm'), k);
  }
  assert.match(CLOUD_INIT, /^#cloud-config\n/);
  assert.match(CLOUD_INIT, /raw\.githubusercontent\.com\/alxx-22\/n\.abl\/voice-agent-DEV\/demo-products\/voice-agent\/deploy\/oracle\/nabl\.sh/);
  assert.match(readFileSync(SCRIPT, 'utf8'), /setting DEPLOY_BRANCH voice-agent-DEV/);
});
