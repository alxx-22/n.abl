// Demo keys from the terminal, for when the team console is not to hand.
//
//   npm run demo:key -- issue "Sam Price" --company "Sam's Kitchen" --email sam@example.com --days 14
//   npm run demo:key -- issue "Hospitality expo" --shared --days 30
//                       (shared: one key for many people; each gets their own demo, deleted an hour after Start)
//   npm run demo:key -- list
//   npm run demo:key -- revoke K7QX          (the key's first four characters, or its id)
//   npm run demo:key -- extend K7QX 7
//
// Uses DATABASE_URL (Supabase) or the local PGlite folder. PGlite allows one
// process at a time: stop `npm run dev` first, or issue keys from the console.

import { loadConfig } from '../config.ts';
import { migrate, openDb } from '../db/db.ts';
import { DemoRepo, type DemoKey } from '../db/demo-repo.ts';
import { generateKey, hashKey, normaliseKey, prefixOf } from './access.ts';

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const positional = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--')));

const config = loadConfig();
const db = await openDb({ databaseUrl: config.databaseUrl, pgliteDir: config.pgliteDir });
const demo = new DemoRepo(db);

async function find(ref: string | undefined): Promise<DemoKey> {
  const keys = await demo.listKeys();
  const m = keys.filter((k) => k.id === ref || k.key_prefix === (ref ?? '').toUpperCase());
  if (m.length !== 1) throw new Error(m.length ? `${m.length} keys start ${ref}; use the id.` : `No key ${ref}.`);
  return m[0];
}

try {
  await migrate(db);
  const origin = config.publicBaseUrl ?? `http://localhost:${config.port}`;
  if (cmd === 'issue') {
    const person = positional[0];
    if (!person) throw new Error('Who is it for?  npm run demo:key -- issue "Sam Price" --company "Sam\'s Kitchen"');
    const raw = generateKey();
    const n = normaliseKey(raw)!;
    const kind = rest.includes('--shared') ? 'shared' : 'private';
    const days = Math.min(90, Math.max(1, Number(flag('days') ?? (kind === 'shared' ? 30 : 14))));
    const k = await demo.createKey({
      hash: hashKey(n), prefix: prefixOf(n), person_name: person, kind, company: flag('company') ?? null, email: flag('email') ?? null,
      issued_by: 'cli', notes: flag('notes') ?? null, expires_at: new Date(Date.now() + days * 86400000),
    });
    console.log(`\n${k.kind === 'shared' ? 'Shared key (each person gets their own demo, deleted an hour after Start)' : 'Private key'} for ${k.person_name}${k.company ? `, ${k.company}` : ''}, until ${k.expires_at.toDateString()}:\n`);
    console.log(`  ${raw}\n`);
    console.log(`  ${origin}/demo/reception`);
    console.log(`  one-click: ${origin}/demo/reception#key=${raw}\n`);
    console.log('Shown once: only a hash is stored.');
  } else if (cmd === 'list') {
    for (const k of await demo.listKeys()) {
      const state = k.revoked_at ? 'revoked' : k.expires_at < new Date() ? 'expired' : `until ${k.expires_at.toDateString()}`;
      console.log(`${k.key_prefix}…  ${k.kind.padEnd(7)}  ${k.person_name}${k.company ? ` (${k.company})` : ''}  ${state}  ${k.workspaces} demo(s)${k.kind === 'shared' ? `, ${k.people} people` : ''}  ${Math.round(k.call_seconds_24h / 60)} call min today  ${k.id}`);
    }
  } else if (cmd === 'revoke') {
    const k = await find(positional[0]);
    await demo.revokeKey(k.id);
    console.log(`Revoked ${k.key_prefix}… (${k.person_name}).`);
  } else if (cmd === 'extend') {
    const k = await find(positional[0]);
    await demo.extendKey(k.id, Math.min(90, Math.max(1, Number(positional[1] ?? 7))));
    console.log(`Extended ${k.key_prefix}… (${k.person_name}) to ${(await demo.keyById(k.id))!.expires_at.toDateString()}.`);
  } else {
    console.log('npm run demo:key -- issue "Name" [--shared] [--company X] [--email X] [--days 14] | list | revoke <prefix|id> | extend <prefix|id> <days>');
  }
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await db.close();
}
