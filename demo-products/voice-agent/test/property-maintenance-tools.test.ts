// The property maintenance receptionist (presets/property-maintenance.md §4
// and §8, M1), through runTool on a contractor made as a prospect makes it:
// the builder's defaults and a name, compiled through the registry and
// seeded by its preset, on Wednesday 7 October 2026 at 11am. The signature
// moments: gas, safety first; the property found without reading it out;
// the fault sorted; a job in a real window; "when's my engineer coming";
// and the landlord's gas safety record.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openPglite, migrate, type Db } from '../src/db/db.ts';
import { Repo } from '../src/db/repo.ts';
import { newCallState, runTool, toolDeclarations, type Action, type ToolContext } from '../src/core/tools.ts';
import { armSafety, detectSafety, noteAdvice } from '../src/core/safety.ts';
import { checkUtterance } from '../src/core/guardrails.ts';
import { compilePrompt } from '../src/core/prompt.ts';
import { redactCodes } from '../src/core/redact.ts';
import { digitsSaid, spokenNumber } from '../src/domain/phone.ts';
import type { Tenant } from '../src/domain/types.ts';
import { BUILDER_TENANTS, builderTenant } from '../src/eval/scenarios.ts';

/** Wednesday 7 October 2026, 11am BST. */
const NOW = new Date('2026-10-07T10:00:00Z');
/** The same Wednesday, 9pm: the office is shut, Dan and Leon are on call. */
const NIGHT = new Date('2026-10-07T20:00:00Z');
const SAM = '+447700900501'; // the tenant at 14 Elm Road
const BEN = '+447700900406'; // Whitfield Properties, the landlord
const STRANGER = '+447700900999';
let db: Db;
let repo: Repo;

before(async () => {
  db = await openPglite();
  await migrate(db);
  repo = new Repo(db);
});
after(async () => db.close());

async function fernhill(slug: string): Promise<Tenant> {
  const { preset, profile } = builderTenant(BUILDER_TENANTS.find((b) => b.slug === 'pm-fernhill')!);
  const t = await repo.upsertTenant({ ...profile, slug });
  await repo.insertSeed(t.id, preset.seed(t.profile, NOW, 7));
  return t;
}

async function call(tenant: Tenant, callerPhone: string | null, now = NOW) {
  const actions: Action[] = [];
  const sent: { to: string; body: string }[] = [];
  const state = newCallState();
  // As a call to a repairs contractor starts (src/core/call.ts).
  state.maintenance = true;
  const ctx: ToolContext = {
    tenant, repo, now: () => now, callId: await repo.createCall({ tenant_id: tenant.id, channel: 'eval' }), channel: 'eval', callerPhone,
    state, demoCards: [], sms: { send: async (to, body) => (sent.push({ to, body }), 'simulated') }, telephony: null, action: (x) => actions.push(x),
  };
  /** The caller says a line, as call.ts hears it. */
  const hear = (line: string) => {
    state.heard.push(line);
    return armSafety(state, line);
  };
  /** The receptionist says a line. */
  const say = (line: string) => {
    state.said.push(line);
    return noteAdvice(state, 'england');
  };
  return { ctx, actions, sent, hear, say, run: (name: string, args: Record<string, unknown>) => runTool(name, args, ctx) as Promise<any> };
}

test('maintenance tools: only a repairs contractor has them, and it has no table or appointment tools', async () => {
  const t = await fernhill('pm-decl');
  const names = toolDeclarations(t).map((d) => d.name);
  for (const n of ['safety_advice', 'find_property', 'triage_fault', 'job', 'check_windows', 'compliance', 'take_message', 'get_opening_hours', 'search_knowledge', 'end_call']) assert.ok(names.includes(n), n);
  for (const n of ['check_availability', 'create_booking', 'search_properties', 'record_offer']) assert.ok(!names.includes(n), n);
  const props = Object.keys((toolDeclarations(t).find((d) => d.name === 'take_message')!.parameters as any).properties);
  for (const k of ['for', 'category', 'urgency']) assert.ok(props.includes(k), k);
  const estate = builderTenant(BUILDER_TENANTS.find((b) => b.slug === 'ea-hartwell')!).profile;
  const others = toolDeclarations({ id: 'x', slug: 'x', profile: estate }).map((d) => d.name);
  assert.ok(!others.includes('safety_advice') && !others.includes('job'), 'an estate agency never gets them');
});

test('safety mode: spotting an emergency in what the caller says, and hearing the advice said', () => {
  assert.equal(detectSafety("There's a strong smell of gas in my kitchen"), 'gas');
  assert.equal(detectSafety("I can't smell gas any more, it was the cooker"), null);
  assert.equal(detectSafety('My carbon monoxide alarm is going off'), 'co');
  assert.equal(detectSafety('The CO alarm keeps chirping every minute'), 'co_chirp');
  assert.equal(detectSafety("My boiler's making me dizzy, I've got a headache"), 'co');
  assert.equal(detectSafety('Water is dripping onto the lights in the hall'), 'electric');
  assert.equal(detectSafety('There are sparks coming out of the socket'), 'electric');
  assert.equal(detectSafety("The kitchen's full of smoke"), 'fire');
  assert.equal(detectSafety('My gas fire won\'t light'), null, 'a gas fire is an appliance, not a fire');
  assert.equal(detectSafety('I need a gas safety check'), null);
  assert.equal(spokenNumber('0800 111 999'), 'oh eight hundred, one one one, nine nine nine');
  assert.equal(spokenNumber('105'), 'one oh five');
  assert.equal(digitsSaid('ring oh eight hundred, one one one, nine nine nine'), '0800111999');
  assert.equal(digitsSaid('0800 111 999'), '0800111999');
});

test('gas: nothing is booked or looked up until the advice and the number are said; then the incident shows when', async () => {
  const t = await fernhill('pm-gas');
  const c = await call(t, SAM);
  assert.equal(c.hear("There's a strong smell of gas in my kitchen, can you send someone?"), 'gas');
  for (const [name, args] of [['find_property', { postcode: 'NG5', number: '14' }], ['job', { action: 'create', description: 'gas smell' }], ['check_windows', { trade: 'gas_heating' }], ['triage_fault', { description: 'gas smell' }]] as const) {
    const r = await c.run(name, args);
    assert.equal(r.done, false, name);
    assert.match(r.message, /^Give the safety advice first/, name);
    assert.match(r.message, /0800 111 999/);
  }
  const advice = await c.run('safety_advice', { kind: 'gas' });
  assert.match(advice.say[0], /^Get everyone out/);
  assert.equal(advice.number, '0800 111 999');
  assert.equal(advice.number_spoken, 'oh eight hundred, one one one, nine nine nine');
  assert.equal(advice.text_sent, true);
  assert.match(advice.next, /hang up and ring from outside/);
  assert.equal(c.sent[0].to, SAM);
  assert.match(c.sent[0].body, /^National Gas Emergency Service: 0800 111 999\./);
  // Fetching the script is not saying it.
  assert.equal((await c.run('job', { action: 'create', description: 'gas smell' })).done, false);
  assert.equal(c.say('Please get everyone out now and open the windows.'), null, 'no number yet');
  const done = c.say('From outside, ring the National Gas Emergency Service on oh eight hundred, one one one, nine nine nine.');
  assert.equal(done?.kind, 'gas');
  assert.equal(c.ctx.state.safety!.spoken, true);
  const found = await c.run('find_property', { postcode: 'NG5', number: '14' });
  assert.equal(found.found, 1, 'once said, the call carries on');
  const [incident] = await repo.listIncidents(t.id).then((xs) => xs.filter((x) => x.source === 'eval'));
  assert.deepEqual([incident.kind, incident.advice_version, incident.caller_phone], ['gas', 1, SAM]);
  // A second mention of gas doesn't start it again.
  assert.equal(c.hear('Yes, it really does smell of gas.'), null);
});

test('find_property: by postcode and number, loosely heard, never read out from a number, and nothing private to a stranger', async () => {
  const t = await fernhill('pm-find');
  const sam = await call(t, SAM);
  const r = await sam.run('find_property', { postcode: 'NG5 3AB', number: '14', street: 'Elm Road' });
  assert.equal(r.found, 1);
  assert.deepEqual([r.properties[0].says, r.properties[0].looked_after_by, r.properties[0].caller_is, r.properties[0].notes.stopcock], ['14 Elm Road (example), NG5', 'Whitfield Properties', 'occupant', 'under the kitchen sink']);
  assert.equal(sam.ctx.state.property, 'elm_14');
  assert.equal(sam.ctx.state.role, 'occupant');
  // M and N sound alike; 40 is easily heard for 14.
  const misheard = await sam.run('find_property', { postcode: 'MG5', number: '40', street: 'Elm Road' });
  assert.equal(misheard.properties?.[0].property, 'elm_14');
  assert.match(misheard.check, /we have 14, they said 40/);
  // From the number alone: we know them, but the address is theirs to say.
  const byNumber = await sam.run('find_property', {});
  assert.equal(byNumber.properties, undefined);
  assert.match(byNumber.message, /Ask them to say the address; don't read it out/);
  // A stranger hears who looks after it only as a kind, and nothing about the boiler, pets or parking.
  const stranger = await call(t, STRANGER);
  const s = await stranger.run('find_property', { postcode: 'NG5', number: '14', street: 'Elm Road' });
  assert.equal(s.properties[0].looked_after_by, 'a landlord we work for');
  assert.equal(s.properties[0].notes.boiler, undefined);
  assert.ok(!JSON.stringify(s).includes('900501'), "never the occupant's number");
  // Outside the patch, and a key safe's code never appears.
  assert.equal((await sam.run('find_property', { postcode: 'LE1 5AA', number: '3' })).outside, true);
  const keySafe = (await repo.listMtProperties(t.id)).find((p) => p.access.method === 'key_safe')!;
  const k = await sam.run('find_property', { postcode: keySafe.district, number: keySafe.number, street: keySafe.street });
  assert.equal(k.properties[0].notes.access, 'key safe: the office has the code; never read it out');
});

test('triage_fault: the trade and how soon from the owner\'s rules, the vulnerable uplift, and only the checks allowed', async () => {
  const t = await fernhill('pm-triage');
  const c = await call(t, SAM);
  const tap = await c.run('triage_fault', { description: 'The kitchen tap keeps dripping' });
  assert.deepEqual([tap.trade, tap.priority, tap.gas], ['plumbing', 'routine', false]);
  const burst = await c.run('triage_fault', { description: "Water's pouring through the kitchen ceiling" });
  assert.equal(burst.priority, 'emergency');
  const heat = await c.run('triage_fault', { description: 'No heating since this morning', answers: 'My mum lives with me, she is 82' });
  assert.deepEqual([heat.trade, heat.priority], ['gas_heating', 'emergency']);
  assert.match(heat.reason, /vulnerable occupant/);
  assert.ok(heat.checks_allowed.some((x: string) => /thermostat/.test(x)));
  assert.ok(heat.checks_allowed.some((x: string) => /pressure gauge/.test(x)));
  const pest = await c.run('triage_fault', { description: 'Can you do pest control? We have mice' });
  assert.match(pest.say, /We don't do pest control\. Suggest the council's pest service/);
  // With the boiler-pressure check off, the receptionist has no steps to give.
  const t2 = await fernhill('pm-triage-off');
  t2.profile.maintenance!.checks.boiler_pressure = false;
  const c2 = await call(t2, SAM);
  const off = await c2.run('triage_fault', { description: 'How do I repressurise my boiler? It keeps losing pressure' });
  assert.ok(!off.checks_allowed.some((x: string) => /pressure/.test(x)));
});

test('job create: a homeowner hears the price first, picks a real window, and gets the text with the cancellation terms', async () => {
  const t = await fernhill('pm-homeowner');
  const home = (await repo.listMtProperties(t.id)).find((p) => p.client === null && p.occupant.phone)!;
  const c = await call(t, home.occupant.phone);
  await c.run('find_property', { postcode: home.district, number: home.number, street: home.street });
  const first = await c.run('job', { action: 'create', description: 'Dripping kitchen tap', trade: 'plumbing' });
  assert.equal(first.booked, false);
  assert.match(first.message, /Tell them the price first: call-out £95 including VAT/);
  c.say("The call-out's £95 including VAT, which covers the first hour.");
  const windows = await c.run('job', { action: 'create', description: 'Dripping kitchen tap', trade: 'plumbing' });
  assert.equal(windows.booked, false);
  assert.ok(windows.windows.length >= 2, 'free windows offered');
  const pick = windows.windows[1];
  const booked = await c.run('job', { action: 'create', description: 'Dripping kitchen tap', trade: 'plumbing', date: pick.date, window: pick.window });
  assert.equal(booked.booked, true, JSON.stringify(booked));
  assert.match(booked.reference, /^[A-Z]{2}\d{3}$/);
  assert.equal(c.ctx.state.owed, booked.reference, 'the caller is owed the reference');
  const text = c.sent.find((x) => x.to === home.occupant.phone)!.body;
  assert.match(text, /Plumbing and leaks booked for .* Ref [A-Z]{2}\d{3}\. Someone over 18 needs to be in\./);
  assert.match(text, /You can cancel free of charge until 5pm the working day before your visit\./);
  const [job] = await repo.listJobs(t.id, { reference: booked.reference });
  assert.deepEqual([job.status, job.priority, job.price_pence, job.reporter.role], ['scheduled', 'routine', 9500, 'homeowner']);
  assert.ok(c.actions.some((a) => a.kind === 'job_created'));
});

test('job create: a 9pm burst pipe pages the engineer on call, and nobody is named until they accept', async () => {
  const t = await fernhill('pm-burst');
  const home = (await repo.listMtProperties(t.id)).find((p) => p.client === 'harbour' && p.notes.stopcock === 'under the kitchen sink')!;
  const c = await call(t, home.occupant.phone, NIGHT);
  await c.run('find_property', { postcode: home.district, number: home.number, street: home.street });
  const r = await c.run('job', { action: 'create', description: "Water's pouring through the kitchen ceiling", name: home.occupant.name });
  assert.deepEqual([r.booked, r.priority], [true, 'emergency']);
  assert.match(r.say, /Our on-call engineer has been paged\. We aim to be with them within 4 hours/);
  assert.ok(!/Dan/.test(JSON.stringify(r)), 'no name before acceptance');
  const [job] = await repo.listJobs(t.id, { reference: r.reference });
  assert.deepEqual([job.status, job.engineer_key, job.flags.includes('out_of_hours'), job.attend_by!.toISOString()], ['new', 'dan', true, '2026-10-08T00:00:00.000Z']);
  assert.ok(c.sent.some((x) => x.to === '+447700900301' && /URGENT/.test(x.body)), "Dan's phone gets the page");
  assert.ok(c.sent.some((x) => x.to === home.occupant.phone && /paged/.test(x.body)));
});

test("job find: \"when's my engineer coming?\" with the reference or from the number on the job; never by address alone", async () => {
  const t = await fernhill('pm-eta');
  const [elm] = (await repo.listJobs(t.id, { property: 'elm_14' }));
  const stranger = await call(t, STRANGER);
  const none = await stranger.run('job', { action: 'find' });
  assert.equal(none.found, 0);
  assert.match(none.message, /Never look a job up by address alone/);
  const withRef = await stranger.run('job', { action: 'find', reference: elm.reference.split('').join(' ') });
  assert.equal(withRef.jobs[0].status, 'Marek is on the way, about 15 minutes');
  const sam = await call(t, SAM);
  const mine = await sam.run('job', { action: 'find' });
  assert.equal(mine.jobs[0].reference, elm.reference);
  assert.equal(mine.jobs[0].at, '14 Elm Road (example), NG5');
  // A tenant can't cancel their landlord's job: it goes to the office as a request.
  const cancel = await sam.run('job', { action: 'cancel', reference: elm.reference });
  assert.equal(cancel.cancelled, false);
  assert.match(cancel.message, /Only Whitfield Properties can cancel this job/);
  assert.equal(sam.ctx.state.messageTaken, true);
  assert.equal((await repo.listJobs(t.id, { reference: elm.reference }))[0].status, 'on_the_way');
});

test("compliance: the landlord hears the register and books a gas safety record that keeps the date; a tenant doesn't", async () => {
  const t = await fernhill('pm-gas-record');
  const ben = await call(t, BEN);
  const status = await ben.run('compliance', { property: 'elm_14', action: 'status' });
  const gas = status.certificates.find((c: any) => c.what === 'gas safety record');
  assert.deepEqual([gas.runs_to, gas.state], ['Monday 16 November', 'due soon']);
  assert.match(gas.book_from, /keeps the 16 November date/);
  const offered = await ben.run('compliance', { property: 'elm_14', action: 'book', services: 'gas safety record' });
  assert.equal(offered.price, '£75 including VAT');
  const w = offered.windows[0];
  const booked = await ben.run('compliance', { property: 'elm_14', action: 'book', services: 'gas safety record', date: w.date, window: w.window });
  assert.equal(booked.booked, true, JSON.stringify(booked));
  assert.equal(booked.engineer, 'Callum', 'a Gas Safe engineer who does gas safety records');
  const certs = await repo.listCertificates(t.id, 'elm_14');
  assert.equal(certs.find((c) => c.kind === 'gas_record')!.booked_job, booked.reference);
  assert.ok(ben.sent.some((x) => x.to === SAM && /your landlord has booked a gas safety record/.test(x.body)), 'the tenant is told');
  // Booking too early loses the date: refused unless they knowingly ask.
  const later = (await repo.listCertificates(t.id)).find((c) => c.kind === 'gas_record' && c.expires! > '2027-01-15' && !c.booked_job)!;
  const theirs = (await repo.getMtProperty(t.id, later.property_key))!;
  const owner = t.profile.maintenance!.clients.find((c) => c.key === theirs.client)!.contact.phone!;
  const landlord = await call(t, owner);
  const early = await landlord.run('compliance', { property: later.property_key, action: 'book', services: 'gas safety record', date: '2026-10-08', window: 'am' });
  assert.equal(early.booked, false);
  assert.match(early.message, /loses the current record's date/);
  // A tenant asking about the records is pointed to the landlord.
  const sam = await call(t, SAM);
  assert.match((await sam.run('compliance', { property: 'elm_14', action: 'status' })).message, /for the landlord or agent on file/);
});

test('messages and hours: for an engineer or the office, urgent ones by text, bank talk as fraud; tonight\'s cover without names', async () => {
  const t = await fernhill('pm-messages');
  const c = await call(t, SAM);
  const r = await c.run('take_message', { name: 'Sam Ortiz', message: 'Please ring before you come.', for: 'Marek', urgency: 'urgent', category: 'job' });
  assert.deepEqual([r.taken, r.for, r.urgency], [true, 'Marek', 'urgent']);
  assert.ok(c.sent.some((x) => x.to === '+447700900303'));
  c.ctx.state.heard.push('Someone emailed to say your bank details have changed');
  const f = await c.run('take_message', { name: 'Sam Ortiz', message: 'Asked about new bank details.', category: 'general' });
  assert.equal(f.urgency, 'urgent');
  assert.equal(c.ctx.state.fraudReported, true);
  const hours = await c.run('get_opening_hours', { date: '2026-10-07' });
  const day = hours.days[0];
  assert.deepEqual(day.open, ['Open 8am to 5:30pm']);
  assert.match(day.on_call, /^Out of hours, an engineer is on call for emergencies/);
  assert.ok(!/Dan|Leon/.test(day.on_call), 'never a name');
  assert.ok(day.visit_windows.includes('morning 8am to 12 noon'));
});

test("the receptionist's rules: safety first with the nation's numbers, and none of the restaurant's", async () => {
  const t = await fernhill('pm-prompt');
  const prompt = compilePrompt(t.profile, { now: NOW, callerPhone: SAM, demoCards: [], canTransfer: false, channel: 'eval' });
  assert.ok(prompt.length < 7000, `${prompt.length} characters`);
  assert.match(prompt, /1\. Safety first\. Gas smell: everyone out, .* ring 0800 111 999 now \(say it twice, in groups\)/);
  assert.match(prompt, /999 or NHS 111 for anyone ill/);
  assert.match(prompt, /Tenants can get advice from Shelter or Citizens Advice\./);
  assert.match(prompt, /You can: .*give safety advice in an emergency; find a property and book an engineer into a visit window/);
  for (const never of ['create_booking', 'confirm_order', 'kitchen', 'allerg']) assert.ok(!prompt.includes(never), never);
  // Northern Ireland's own gas line, and no NHS 111 there.
  const ni = structuredClone(t.profile);
  ni.maintenance!.nation = 'northern_ireland';
  ni.maintenance!.gas = '0800 002 001';
  const niPrompt = compilePrompt(ni, { now: NOW, callerPhone: null, demoCards: [], canTransfer: false, channel: 'eval' });
  assert.match(niPrompt, /ring 0800 002 001 now/);
  assert.match(niPrompt, /999 or your GP or the out-of-hours GP service/);
});

test('guardrails on a repairs call: each rule fires where it must, and stays quiet on the advice itself', async () => {
  const t = await fernhill('pm-guard');
  const m = t.profile.maintenance!;
  const c = await call(t, SAM);
  const rules = (line: string) => checkUtterance(line, c.ctx.state, ['Dan', 'Marek', 'Callum'], m).map((f) => f.rule);
  // The advice is owed: anything else first is flagged; the advice is not.
  c.hear("There's a smell of gas in the kitchen");
  assert.deepEqual(rules("I'm sorry to hear that. What's the postcode?"), ['safety_delayed']);
  assert.deepEqual(rules("Please get everyone out now. Turn the gas off at the meter, if it's safe to reach, and ring 0800 111 999 from outside."), []);
  c.say('Please get everyone out now and ring oh eight hundred, one one one, nine nine nine.');
  assert.deepEqual(rules("I'm sorry, what's the postcode?"), [], 'once said, the call moves on');
  // Calling an appliance safe, and DIY beyond the allowed checks.
  assert.deepEqual(rules("It's probably nothing, the boiler is perfectly safe."), ['said_safe_appliance']);
  assert.deepEqual(rules('You could take the cover off and relight the pilot.'), ['unsafe_diy']);
  assert.deepEqual(rules("Please don't take the cover off the boiler."), []);
  assert.deepEqual(rules('If you have been shown how, you can top it up with the filling loop.'), [], 'the pressure check is allowed');
  m.checks.boiler_pressure = false;
  assert.deepEqual(rules('You can top it up with the filling loop under the boiler.'), ['unsafe_diy']);
  m.checks.boiler_pressure = true;
  // Fault, legal deadlines, codes.
  assert.deepEqual(rules("I'm so sorry, that's our fault and we'll pay for the damage."), ['liability_admitted']);
  assert.deepEqual(rules('By law your landlord has to fix it within 14 days.'), ['legal_deadline']);
  assert.deepEqual(rules('The key safe code is 4719.'), ['code_spoken']);
  // Arrival times: made up before any job, fine as the business's target.
  assert.deepEqual(rules('An engineer will be with you at about 3pm.'), ['invented_eta']);
  assert.deepEqual(rules('We aim to be with you within 4 hours.'), []);
  // A paged emergency: no name, nobody "on the way" until they accept.
  c.ctx.state.paged = true;
  c.ctx.state.jobsVerified.push('XX100');
  assert.ok(rules("Dan is on his way and will be with you by half ten.").includes('invented_eta'));
  c.ctx.state.paged = false;
  // Awaiting approval is not booked.
  // As job create leaves it: the job is the call's own (its reference owed), but only raised.
  c.ctx.state.committed.push('XX101');
  c.ctx.state.awaitingApproval = true;
  assert.deepEqual(rules("That's booked, and an engineer will come out on Thursday."), ['approval_claim']);
  assert.deepEqual(rules("It isn't booked yet: we're waiting for your agent's approval."), []);
});

test('access codes are removed from what is stored, and nothing else is', () => {
  assert.equal(redactCodes('The key safe code is 4719').text, 'The key safe code is [code removed]');
  assert.equal(redactCodes('the code is four seven one nine, by the door').text, 'the code is [code removed], by the door');
  assert.equal(redactCodes('The alarm code 2580, please').text, 'The alarm code [code removed], please');
  for (const keep of ['If the carbon monoxide alarm is sounding, ring 0800 111 999', 'My postcode is NG5 3AB', 'Gas Safe number 512345', 'Ref HK101, one of the codes']) assert.equal(redactCodes(keep).text, keep);
});
