// Alcohol at the takeaway, when the owner sells it (presets/takeaway-use-cases.md,
// "Alcohol and age-restricted items"), and the nation's rules: off by default;
// on, adults only, the ID check said and on the ticket, the last sale held, and
// Scotland's 10am to 10pm; Wales's hygiene rating answer.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPglite, migrate, type Db } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { newCallState, runTool, type ToolContext } from '../src/core/tools.ts';
import type { Tenant } from '../src/domain/types.ts';
import { defaultAnswers, type TakeawayAnswers } from '../src/presets/takeaway/answers.ts';
import { compileTakeaway } from '../src/presets/takeaway/compile.ts';
import { sanitiseTakeaway } from '../src/presets/takeaway/sanitise.ts';

const at = (hhmm: string, day = '2026-10-09') => new Date(`${day}T${hhmm}:00+01:00`);
let db: Db;
let repo: Repo;
before(async () => {
  db = await openPglite();
  await migrate(db);
  repo = new Repo(db);
});
after(async () => db.close());

async function firebird(slug: string, edit?: (a: TakeawayAnswers) => void): Promise<Tenant> {
  const a = defaultAnswers();
  a.basics.name = 'Firebird Chicken & Burgers';
  edit?.(a);
  return repo.upsertTenant(compileTakeaway(sanitiseTakeaway(a), { slug }));
}

async function call(t: Tenant, now: Date, heard: string[] = []) {
  const state = newCallState();
  state.heard.push(...heard);
  const ctx: ToolContext = {
    tenant: t, repo, now: () => now, callId: await repo.createCall({ tenant_id: t.id, channel: 'eval' }), channel: 'eval', callerPhone: '+447700900321',
    state, demoCards: [], sms: { send: async () => 'simulated' }, telephony: null, action: () => {},
  };
  return { ctx, run: (name: string, args: Record<string, unknown>) => runTool(name, args, ctx) as Promise<any> };
}

const knowledge = (t: Tenant, q: string) => t.profile.knowledge!.find((k) => k.q === q)?.a;
const licensed = (a: TakeawayAnswers) => void (a.alcohol.on = true);

test('alcohol: off by default, with nothing on the menu; on, the owner\'s drinks for adults in their own section', async () => {
  const off = await firebird('tk-dry');
  assert.ok(!off.profile.menu!.categories.some((c) => c.key === 'alcohol'));
  assert.equal(knowledge(off, 'Do you sell alcohol?'), "We don't sell alcohol.");
  const on = await firebird('tk-licensed', licensed);
  const section = on.profile.menu!.categories.at(-1)!;
  assert.deepEqual([section.label, section.items.map((i) => [i.name, i.price_pence, i.age, i.allergens_unknown])], [
    'Beer and wine', [['Lager four-pack', 749, 18, true], ['Cider four-pack', 749, 18, true], ['Bottle of rosé', 999, 18, true]],
  ]);
  assert.deepEqual([on.profile.ordering!.kitchen!.alcohol_until, on.profile.ordering!.kitchen!.nation], ['23:00', 'england']);
  assert.equal(on.profile.ordering!.kitchen!.mains!.alcohol_1, undefined, 'a four-pack is not a main');
  assert.match(knowledge(on, 'Do you sell alcohol?')!, /^We sell lager four-pack, cider four-pack, bottle of rosé with food orders until 11pm, to over-18s only\. The driver asks for photo ID if you look under 25/);
});

test('alcohol: the ID check said and on the ticket; not to under-18s, and not after the last sale', async () => {
  const t = await firebird('tk-id', licensed);
  const c = await call(t, at('19:00'));
  await c.run('add_to_order', { item: 'Pizza night', options: ['margherita', 'pepperoni', 'coke', 'fanta'] });
  const beer = await c.run('add_to_order', { item: 'lager four-pack' });
  assert.match(beer.added, /^1 × Lager four-pack — £7\.49$/);
  assert.equal(beer.id_check, "Say: we'll ask for photo ID if they look under 25, and won't hand alcohol to anyone under 18 or who seems drunk.");
  await c.run('set_fulfilment', { type: 'collection' });
  await c.run('review_order', {});
  const done = await c.run('confirm_order', { name: 'Kit', allergy_notes: 'none' });
  assert.deepEqual((await repo.getOrder(t.id, done.order_number))!.flags, ['check_id']);
  // A caller who has said they're 16.
  const young = await call(t, at('19:00'), ["I'm 16, can I get a cider four-pack?"]);
  const refused = await young.run('add_to_order', { item: 'cider four-pack' });
  assert.deepEqual([refused.added, refused.message], [false, 'They may be under 18, so no alcohol can be sold to them. Say so kindly, and carry on with the food and soft drinks.']);
  assert.match((await young.run('add_to_order', { item: 'Classic beef burger' })).added, /Classic beef burger/, 'the food is fine');
  // Past the owner's last sale: 11pm.
  const late = await call(t, at('23:10', '2026-10-10'));
  assert.match((await late.run('add_to_order', { item: 'bottle of rosé' })).message, /^We stop selling alcohol at 11pm\./);
});

test("the nation: Scotland's 10am to 10pm for alcohol sold by phone; Wales's hygiene rating answer", async () => {
  const t = await firebird('tk-scot', (a) => { licensed(a); a.nation = 'scotland'; a.alcohol.until = null; });
  assert.match(knowledge(t, 'Do you sell alcohol?')!, /In Scotland we can take payment for alcohol only between 10am and 10pm, and never deliver it between midnight and 6am\.$/);
  assert.match((await (await call(t, at('21:30'))).run('add_to_order', { item: 'lager four-pack' })).added, /Lager four-pack/);
  assert.equal((await (await call(t, at('22:05'))).run('add_to_order', { item: 'lager four-pack' })).message, 'In Scotland alcohol can be sold by phone only between 10am and 10pm. Say so, and carry on with the rest of the order.');
  const wales = await firebird('tk-cymru', (a) => void (a.nation = 'wales'));
  assert.equal(knowledge(wales, 'What is your food hygiene rating?'), "Our food hygiene rating is 5. By law we tell anyone who asks, and our menus and leaflets show it. You can check it on the Food Standards Agency's ratings website.");
  assert.equal(knowledge(await firebird('tk-eng'), 'What is your food hygiene rating?'), "Our food hygiene rating is 5. You can check it on the Food Standards Agency's ratings website.");
});
