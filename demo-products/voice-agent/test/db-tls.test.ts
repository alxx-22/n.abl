import { test } from 'node:test';
import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rootCertificates } from 'node:tls';
import { otherPoolers, sslFor } from '../src/db/db.ts';

const POOLER = 'postgresql://postgres.auivrancfnrdwyiqoakt:secret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';
const DIRECT = 'postgresql://postgres:secret@db.auivrancfnrdwyiqoakt.supabase.co:5432/postgres';

test('database TLS: a database on this machine has none, every other is verified', () => {
  assert.equal(sslFor('postgresql://postgres:pw@127.0.0.1:5432/postgres'), false);
  assert.equal(sslFor('postgresql://postgres:pw@localhost/postgres'), false);
  for (const url of [POOLER, DIRECT]) {
    const ssl = sslFor(url);
    assert.ok(ssl, url);
    assert.equal(ssl.rejectUnauthorized, true, 'never unverified');
  }
});

test('database TLS: the public roots (the pooler is Amazon-signed) and Supabase’s own root are trusted', () => {
  const ssl = sslFor(POOLER);
  assert.ok(ssl);
  const subjects = ssl.ca.map((pem) => new X509Certificate(pem).subject);
  assert.ok(subjects.some((s) => /CN=Amazon Root CA 1/.test(s)), 'Amazon Root CA 1 is among the roots');
  assert.ok(subjects.some((s) => /CN=Supabase Root 2021 CA/.test(s)), 'Supabase’s root is added');
  assert.equal(ssl.ca.length, rootCertificates.length + 1);
});

test('database TLS: the bundled Supabase root is the one the dashboard gives, and still valid', () => {
  const cert = new X509Certificate(readFileSync(new URL('../src/db/supabase-root-2021.crt', import.meta.url)));
  assert.equal(cert.fingerprint256, '80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA');
  assert.ok(cert.ca, 'a certificate authority');
  assert.ok(new Date(cert.validTo) > new Date(), `expired ${cert.validTo}`);
});

test('database: a pooler address on the wrong cluster has the region\'s others to try, and nothing else does', () => {
  assert.deepEqual(otherPoolers(POOLER), [
    'postgresql://postgres.auivrancfnrdwyiqoakt:secret@aws-1-eu-central-1.pooler.supabase.com:5432/postgres',
    'postgresql://postgres.auivrancfnrdwyiqoakt:secret@aws-2-eu-central-1.pooler.supabase.com:5432/postgres',
  ]);
  assert.deepEqual(otherPoolers(DIRECT), []);
  assert.deepEqual(otherPoolers('postgresql://postgres:pw@127.0.0.1:5432/postgres'), []);
});
