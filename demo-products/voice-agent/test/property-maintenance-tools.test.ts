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
import { escalatePages, jobAction, maintenanceState } from '../src/server/maintenance.ts';
import { digitsSaid, spokenNumber } from '../src/domain/phone.ts';
import { addWorkingDays } from '../src/domain/listings.ts';
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
  for (const n of ['safety_advice', 'find_property', 'triage_fault', 'job', 'check_windows', 'compliance', 'find_invoice', 'take_demo_payment', 'take_message', 'get_opening_hours', 'search_knowledge', 'end_call']) assert.ok(names.includes(n), n);
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
  assert.deepEqual(rules("I understand you're looking to repressurise it, but I can't give instructions on how to do that."), [], 'refusing is not instructing');
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

test('the back office: jobs, engineers, properties with their certificates, and the safety log, as the views read them', async () => {
  const t = await fernhill('pm-office-state');
  const st = await maintenanceState(repo, t, NOW);
  assert.deepEqual(st.maintenance.on_call_tonight, ['Dan', 'Leon']);
  assert.equal(st.engineers.length, 8);
  assert.equal(st.engineers.find((e) => e.key === 'dan')!.mobile, '07700 900301');
  const elm = st.jobs.find((j) => j.property_key === 'elm_14' && j.status === 'on_the_way')!;
  assert.deepEqual([elm.engineer, elm.address, elm.client, elm.eta_minutes], ['Marek', '14 Elm Road (example), NG5', 'Whitfield Properties', 20]);
  assert.equal(st.properties.length, 76);
  const elmHome = st.properties.find((p) => p.key === 'elm_14')!;
  assert.deepEqual(elmHome.certificates.find((c) => c.kind === 'gas_record')!.state, 'due soon');
  assert.ok(st.properties.some((p) => p.certificates.some((c) => c.state === 'overdue')));
  assert.ok(!JSON.stringify(st.properties).match(/key safe[^"]*\d{4}/i), 'no code anywhere');
  assert.equal(st.incidents.length, 1);
  assert.equal(st.incidents[0].title, 'A smell of gas');
  assert.ok(st.incidents[0].follow_up_job);
});

test('the back office: dispatch keeps to the window rules, an engineer accepts or declines a page, and the occupant is texted', async () => {
  const t = await fernhill('pm-office-actions');
  const sent: { to: string | null; body: string }[] = [];
  const text = async (to: string | null, body: string) => void sent.push({ to, body });
  const act = (ref: string, b: Record<string, unknown>, now = NOW) => jobAction(repo, t, ref, b, text, now);
  const jobs = await repo.listJobs(t.id);
  const gasJob = jobs.find((j) => j.status === 'scheduled' && j.flags.includes('gas') && j.visit_date! > '2026-10-07')!;
  await assert.rejects(act(gasJob.reference, { action: 'assign', engineer: 'marek' }), /Marek doesn't do|isn't Gas Safe/);
  const plumbing = jobs.find((j) => j.status === 'scheduled' && j.trade === 'plumbing' && !j.flags.includes('gas') && j.visit_date! > '2026-10-07')!;
  // Fill Callum's Friday morning, then try to put another job in it.
  const busy = jobs.filter((j) => j.engineer_key === 'callum' && j.visit_date === '2026-10-09' && j.window_key === 'am' && j.status !== 'cancelled').length;
  for (let i = busy; i < 2; i++) {
    await repo.createJob(t, { trade: 'plumbing', priority: 'routine', description: `Filler ${i}`, kind: 'repair', status: 'scheduled', visit_date: '2026-10-09', window_key: 'am', engineer_key: 'callum', source: 'console' });
  }
  await assert.rejects(act(plumbing.reference, { action: 'assign', engineer: 'callum', date: '2026-10-09', window: 'am' }), /Callum's morning is full/);
  const moved = await act(plumbing.reference, { action: 'assign', engineer: 'marek', date: '2026-10-09', window: 'pm' });
  assert.match(moved, /Marek, Friday 9 October afternoon/);
  // On the way texts the occupant; done needs notes.
  assert.match(await act(plumbing.reference, { action: 'on_the_way', eta_minutes: 25 }, new Date('2026-10-09T11:30:00Z')), /on the way/);
  assert.ok(sent.some((x) => /Marek is on the way, about 25 minutes/.test(x.body)));
  await assert.rejects(act(plumbing.reference, { action: 'done' }), /Add what was done/);
  assert.match(await act(plumbing.reference, { action: 'done', notes: 'New washer fitted.' }), /done/);
  // An emergency at 9pm: Dan accepts, and only then the caller hears his name.
  const home = (await repo.listMtProperties(t.id)).find((p) => p.client === 'harbour')!;
  const c = await call(t, home.occupant.phone, NIGHT);
  await c.run('find_property', { postcode: home.district, number: home.number, street: home.street });
  const r = await c.run('job', { action: 'create', description: 'Burst pipe, water pouring through the ceiling', name: home.occupant.name });
  assert.equal((await repo.listJobs(t.id, { reference: r.reference }))[0].engineer_key, 'dan');
  assert.match(await act(r.reference, { action: 'accept' }, NIGHT), /Dan accepted/);
  assert.ok(sent.some((x) => x.to === home.occupant.phone && /Dan is on call tonight and coming to you by about 1am/.test(x.body)));
  await assert.rejects(act(r.reference, { action: 'accept' }, NIGHT), /no page waiting/);
  // Declined: Leon, the other on call, makes it safe though he doesn't plumb; when he declines too, the duty manager is texted.
  const r2 = await c.run('job', { action: 'create', description: 'Another burst pipe, pouring through the ceiling', name: home.occupant.name });
  assert.match(await act(r2.reference, { action: 'decline' }, NIGHT), /Leon paged instead/);
  assert.match(await act(r2.reference, { action: 'decline' }, NIGHT), /Helen Ward has been texted/);
  assert.ok(sent.some((x) => x.to === '+447700900310' && /URGENT/.test(x.body)));
  assert.ok((await repo.listJobs(t.id, { reference: r2.reference }))[0].flags.includes('duty_manager'));
  await assert.rejects(act(r2.reference, { action: 'decline' }, NIGHT), /no page waiting/);
});

test('escalation: a page nobody answers goes to the other engineer on call after 15 minutes, then to the duty manager, and a call waiting on it hears', async () => {
  const t = await fernhill('pm-escalate');
  const home = (await repo.listMtProperties(t.id)).find((p) => p.client === 'harbour')!;
  const c = await call(t, home.occupant.phone, NIGHT);
  await c.run('find_property', { postcode: home.district, number: home.number, street: home.street });
  const r = await c.run('job', { action: 'create', description: 'Burst pipe, water pouring through the ceiling', name: home.occupant.name });
  const texts: { tenant: string; to: string | null; body: string }[] = [];
  const notes: { tenant: string; kind: string; job: string }[] = [];
  const run = (minutes: number) => escalatePages(repo, new Date(NIGHT.getTime() + minutes * 60_000), async (tenant, to, body) => void texts.push({ tenant, to, body }), (tenant, n) => void notes.push({ tenant, ...n }));
  const holder = async () => (await repo.listJobs(t.id, { reference: r.reference }))[0].engineer_key;
  // Ten minutes: still Dan's.
  await run(10);
  assert.equal(await holder(), 'dan');
  // Sixteen: no answer from Dan, so Leon; the call that raised it is told, without a name.
  assert.ok((await run(16)).includes('No answer: Leon paged instead.'));
  const [job] = await repo.listJobs(t.id, { reference: r.reference });
  assert.equal(job.engineer_key, 'leon');
  assert.match(job.history.at(-1)!.what, /no answer from Dan in 15 minutes; paged Leon/);
  assert.ok(texts.some((x) => x.tenant === t.id && x.to === '+447700900307' && /URGENT: job .* Accept on the job sheet/.test(x.body)), JSON.stringify(texts));
  // (Other tests' pages in this database escalate too: only this business's count.)
  assert.deepEqual(notes.filter((n) => n.tenant === t.id).map((n) => [n.kind, n.job]), [['repaged', r.reference]]);
  // Leon's page has its own fifteen minutes: nothing at 20, the duty manager at 32.
  await run(20);
  assert.equal(await holder(), 'leon');
  assert.ok((await run(32)).includes('No answer from anyone on call, so Helen Ward has been texted.'));
  assert.ok(texts.some((x) => x.to === '+447700900310' && /Nobody on call has accepted/.test(x.body)));
  // Then it stops: the duty manager has it.
  const before = texts.length;
  await run(60);
  assert.equal(texts.filter((x) => x.tenant === t.id).length, texts.slice(0, before).filter((x) => x.tenant === t.id).length);
  assert.ok((await repo.listJobs(t.id, { reference: r.reference }))[0].flags.includes('duty_manager'));
});

test('a homeowner told "ninety five pounds" has heard the price, and a job is never booked for "Owner"', async () => {
  const t = await fernhill('pm-price-words');
  const home = (await repo.listMtProperties(t.id)).find((p) => p.client === null && p.occupant.phone && p.occupant.name)!;
  const c = await call(t, home.occupant.phone);
  await c.run('find_property', { postcode: home.district, number: home.number, street: home.street });
  c.say('Our call out would be ninety five pounds, including VAT, which covers the first hour.');
  const windows = await c.run('job', { action: 'create', description: 'Dripping kitchen tap', trade: 'plumbing', name: 'Owner' });
  assert.ok(windows.windows, `the price was heard: ${JSON.stringify(windows)}`);
  const w = windows.windows[0];
  const booked = await c.run('job', { action: 'create', description: 'Dripping kitchen tap', trade: 'plumbing', name: 'Owner', date: w.date, window: w.window });
  assert.equal(booked.booked, true);
  const [job] = await repo.listJobs(t.id, { reference: booked.reference });
  assert.equal(job.reporter.name, home.occupant.name, "the name on file for the number they ring from, not a role");
});

test('approvals: never by voice; the request goes to the client\'s own phone, where a yes books the first free window and a no tells the tenant', async () => {
  const t = await fernhill('pm-approvals');
  const JEAN = '+447700900404'; // Mrs Ellis, who holds quote Q-2291
  const sent: { to: string | null; body: string }[] = [];
  const notes: { kind: string; job: string; text: string }[] = [];
  const act = (ref: string, b: Record<string, unknown>) => jobAction(repo, t, ref, b, async (to, body) => void sent.push({ to, body }), NOW, (n) => void notes.push(n));
  // Mrs Ellis rings to say yes: the yes is never taken by voice, and the request goes to her phone on file.
  const c = await call(t, JEAN);
  const found = await c.run('job', { action: 'find', reference: 'Q 2291' });
  assert.match(found.jobs[0].status, /waiting for approval/);
  const asked = await c.run('job', { action: 'approve', reference: 'Q-2291' });
  assert.deepEqual([asked.approved, asked.request_sent, asked.quote], [false, true, 'Q-2291']);
  assert.match(asked.say, /on your phone now: press Approve or Decline there/);
  assert.ok(c.sent.some((x) => x.to === JEAN && /quote Q-2291 .*waiting for your approval \(£2,450 including VAT\)/.test(x.body)), JSON.stringify(c.sent));
  assert.equal(c.actions.at(-1)!.kind, 'approval_requested');
  // Someone else saying the postcode and "yes" gets the same answer, without a name or a number.
  const stranger = await call(t, STRANGER);
  const other = await stranger.run('job', { action: 'approve', reference: 'Q-2291' });
  assert.match(other.say, /phone we hold for them/);
  assert.ok(!JSON.stringify(other).includes('Ellis') && stranger.sent.every((x) => x.to === JEAN));
  // She presses Approve on her phone: Gas Safe, the first free window, the tenant texted, and the call told.
  const job = (await repo.listJobs(t.id, { reference: found.jobs[0].reference }))[0];
  assert.match(await act(job.reference, { action: 'authorise', answer: 'yes' }), /^Quote Q-2291 approved: booked .* with (Dan|Callum)\.$/);
  const after = (await repo.listJobs(t.id, { reference: job.reference }))[0];
  assert.equal(after.status, 'scheduled');
  assert.ok(t.profile.maintenance!.engineers.find((e) => e.key === after.engineer_key)!.gas_safe);
  const [q] = await repo.listQuotes(t.id, { reference: 'Q-2291' });
  assert.deepEqual([q.status, q.decided_by], ['approved', 'Jean Ellis']);
  const home = (await repo.getMtProperty(t.id, job.property_key!))!;
  assert.ok(sent.some((x) => x.to === home.occupant.phone && /Mrs J Ellis has approved job .* will come/.test(x.body)));
  assert.deepEqual(notes.map((n) => [n.kind, n.job]), [['approved', job.reference]]);
  await assert.rejects(act(job.reference, { action: 'authorise', answer: 'yes' }), /isn't waiting for approval/);
  // A job over Harbour's limit, raised on a call, then declined on Sophie's phone: the tenant is told it isn't going ahead.
  const harbour = (await repo.listMtProperties(t.id)).find((p) => p.client === 'harbour' && p.occupant.phone)!;
  const tenant = await call(t, harbour.occupant.phone);
  await tenant.run('find_property', { postcode: harbour.district, number: harbour.number, street: harbour.street });
  const raised = await tenant.run('job', { action: 'create', description: 'Replace the rotten back door', trade: 'carpentry', name: harbour.occupant.name, estimate_pounds: 600 });
  assert.equal(raised.awaiting_approval, true);
  assert.equal(await act(raised.reference, { action: 'authorise', answer: 'no' }), `Job ${raised.reference} declined.`);
  assert.equal((await repo.listJobs(t.id, { reference: raised.reference }))[0].status, 'cancelled');
  assert.ok(sent.some((x) => x.to === harbour.occupant.phone && /Harbour Lettings hasn't approved job/.test(x.body)));
  assert.equal(notes.at(-1)!.kind, 'declined');
});

test('invoices and demo payments: found by number or from the payer\'s phone, paid only with the demo card, and a call-out by card when the owner asks for it', async () => {
  const t = await fernhill('pm-money');
  const cards = [{ number: '1234567890123456', expiry: '12/34', cvc: '123', result: 'approve' as const }, { number: '4000000000000002', expiry: '12/34', cvc: '123', result: 'decline' as const }];
  const owed = (await repo.listInvoices(t.id)).find((i) => i.status === 'due' && !i.client_key)!;
  assert.ok(owed, 'a homeowner still owes');
  // From the payer's own phone: the bill, with the home, and how to pay; never the bank details.
  const c = await call(t, owed.payer.phone);
  c.ctx.demoCards = cards;
  const found = await c.run('find_invoice', {});
  const mine = found.invoices.find((i: any) => i.reference === owed.reference);
  assert.match(mine.for, /\(example\)/);
  assert.match(mine.status, /^due by /);
  assert.match(found.pay, /never read them out/);
  // A stranger with the number hears the amount, not the home.
  const other = await call(t, STRANGER);
  const theirs = await other.run('find_invoice', { reference: owed.reference.replace('INV-', 'inv ') });
  assert.doesNotMatch(theirs.invoices[0].for, /example/);
  // A real-looking card is refused; the demo decline card declines; the demo card pays, once.
  assert.equal((await c.run('take_demo_payment', { card_number: '4111 1111 1111 1111' })).result, 'refused');
  assert.equal((await c.run('take_demo_payment', { card_number: '4000 0000 0000 0002' })).result, 'declined');
  const paid = await c.run('take_demo_payment', { card_number: '1234 5678 9012 3456', expiry: '12/34', security_code: '123' });
  assert.equal(paid.result, 'approved');
  const after = (await repo.listInvoices(t.id, { reference: owed.reference }))[0];
  assert.deepEqual([after.status, after.paid_how, after.card_last4], ['paid', 'card', '3456']);
  assert.ok(c.sent.some((x) => /received for INV-\d+.*DEMO: no money has been taken/.test(x.body)));
  assert.equal((await c.run('take_demo_payment', { card_number: '1234 5678 9012 3456' })).result, 'already_paid');
  // The overdue ones read as overdue.
  const late = (await repo.listInvoices(t.id)).find((i) => i.status === 'due' && i.due < '2026-10-07')!;
  assert.match((await (await call(t, late.payer.phone)).run('find_invoice', { reference: late.reference })).invoices[0].status, /^overdue/);
  // With card on booking: a homeowner's booked visit raises the call-out, paid on the call.
  const { preset, profile } = builderTenant(BUILDER_TENANTS.find((b) => b.slug === 'pm-fernhill')!);
  profile.maintenance!.prices.card_on_booking = true;
  const t2 = await repo.upsertTenant({ ...profile, slug: 'pm-card-on-booking' });
  await repo.insertSeed(t2.id, preset.seed(t2.profile, NOW, 7));
  const home = (await repo.listMtProperties(t2.id)).find((p) => p.client === null && p.occupant.phone && p.occupant.name)!;
  const h = await call(t2, home.occupant.phone);
  h.ctx.demoCards = cards;
  await h.run('find_property', { postcode: home.district, number: home.number, street: home.street });
  h.say('The call-out is ninety five pounds including VAT, with the first hour.');
  const offer = await h.run('job', { action: 'create', description: 'Dripping kitchen tap', trade: 'plumbing', name: home.occupant.name });
  const w = offer.windows[0];
  const booked = await h.run('job', { action: 'create', description: 'Dripping kitchen tap', trade: 'plumbing', name: home.occupant.name, date: w.date, window: w.window });
  assert.equal(booked.booked, true);
  assert.match(booked.payment, /^The £\d+ call-out is paid by card now/);
  const deposit = await h.run('take_demo_payment', { for: 'callout', card_number: '1234567890123456' });
  assert.deepEqual([deposit.result, deposit.for], ['approved', `the call-out for job ${booked.reference}`]);
  assert.equal((await repo.listInvoices(t2.id, { job: booked.reference }))[0].status, 'paid');
  // The tool speaks of invoices and call-outs here, never orders or deposits.
  assert.match(toolDeclarations(t).find((x) => x.name === 'take_demo_payment')!.description!, /an invoice or a homeowner's call-out/);
});

test("damp and mould at Meadowbank: no blame, no health advice, the vulnerability noted with consent, a possible hazard for Meadowbank to decide, and Awaab's clock started", async () => {
  const t = await fernhill('pm-damp');
  const NADIA = '+447700900571'; // Flat 2, 7 Larkspur Walk, a Meadowbank tenant
  const CARL = '+447700900407'; // Meadowbank's repairs manager
  const c = await call(t, NADIA);
  const found = await c.run('find_property', { postcode: 'DE23', number: 'Flat 2, 7', street: 'Larkspur Walk' });
  assert.equal(found.found, 1, JSON.stringify(found));
  const tri = await c.run('triage_fault', { description: "Black mould all over my son's bedroom wall; he has asthma" });
  assert.equal(tri.trade, 'damp_mould');
  const args = { action: 'create', description: "Black mould on the son's bedroom wall", trade: 'damp_mould', name: 'Nadia Hussain', vulnerable: 'a child with asthma', consent: true };
  const offer = await c.run('job', args);
  const w = offer.windows[0];
  const r = await c.run('job', { ...args, date: w.date, window: w.window });
  assert.equal(r.booked, true, JSON.stringify(r));
  assert.match(r.landlord_told, /Meadowbank Housing has been told today, with the time it was reported\. It is flagged for them to decide whether it is an emergency hazard\./);
  assert.match(r.never, /Never say what caused it.*never give health advice.*never quote a legal deadline/);
  const [job] = await repo.listJobs(t.id, { reference: r.reference });
  assert.equal(job.priority, 'urgent', 'the asthma raises it a step');
  assert.ok(['damp_mould', 'possible_emergency_hazard', 'vulnerable'].every((f) => job.flags.includes(f)), job.flags.join());
  assert.deepEqual(job.clocks.map((k) => [k.kind, k.due]), [['awaab_investigation', addWorkingDays('2026-10-07', 10, 'england')]]);
  assert.equal(job.clocks[0].start, NOW.toISOString(), 'the report time recorded');
  const home = (await repo.getMtProperty(t.id, 'larkspur_flat_2_7'))!;
  assert.deepEqual(home.vulnerable, ['a child with asthma']);
  // Meadowbank told the same day: the time, the investigation date, and the hazard for them to decide.
  const told = c.sent.find((x) => x.to === CARL)!;
  assert.match(told.body, /Reported 11am today\. Investigation due by Wednesday 21 October .*Possible emergency hazard: yours to decide/);
  // Without consent nothing about anyone's health is kept.
  const other = await call(t, '+447700900572');
  await other.run('find_property', { postcode: 'DE23', number: 'Flat 5, 7', street: 'Larkspur Walk' });
  const o = await other.run('job', { action: 'create', description: 'Mould round the bathroom window', trade: 'damp_mould', name: 'Tomasz Nowicki', vulnerable: 'he is pregnant', consent: false });
  const ow = o.windows[0];
  const or = await other.run('job', { action: 'create', description: 'Mould round the bathroom window', trade: 'damp_mould', name: 'Tomasz Nowicki', vulnerable: 'pregnant', consent: false, date: ow.date, window: ow.window });
  assert.deepEqual((await repo.getMtProperty(t.id, 'larkspur_flat_5_7'))!.vulnerable, []);
  assert.ok(!(await repo.listJobs(t.id, { reference: or.reference }))[0].flags.includes('vulnerable'));
  // A private landlord's tenant: no Awaab clock (it is for social housing), and nothing said about one.
  const harbour = (await repo.listMtProperties(t.id)).find((p) => p.client === 'harbour' && p.occupant.phone)!;
  const h = await call(t, harbour.occupant.phone);
  await h.run('find_property', { postcode: harbour.district, number: harbour.number, street: harbour.street });
  const hw = (await h.run('job', { action: 'create', description: 'Mould in the bathroom', trade: 'damp_mould', name: harbour.occupant.name })).windows[0];
  const hr = await h.run('job', { action: 'create', description: 'Mould in the bathroom', trade: 'damp_mould', name: harbour.occupant.name, date: hw.date, window: hw.window });
  assert.deepEqual((await repo.listJobs(t.id, { reference: hr.reference }))[0].clocks, []);
  assert.equal(hr.landlord_told, undefined);
});

test('damp and mould: the receptionist never blames the tenant or gives health advice', async () => {
  const t = await fernhill('pm-damp-words');
  const c = await call(t, '+447700900571');
  const rules = (line: string) => checkUtterance(line, c.ctx.state, ['Grace'], t.profile.maintenance).map((f) => f.rule);
  assert.deepEqual(rules("It's probably caused by drying clothes indoors."), ['damp_blame']);
  assert.deepEqual(rules('You should open your windows more often.'), ['damp_blame']);
  assert.deepEqual(rules('Keep him out of that room for now.'), ['medical_advice']);
  assert.deepEqual(rules('Make sure he uses his inhaler.'), ['medical_advice']);
  assert.deepEqual(rules('Give him his inhaler if he needs it.'), ['medical_advice']);
  // Kind, and pointed the right way: no flag.
  assert.deepEqual(rules("I'm sorry you're dealing with this. It's not something you've done. If he feels unwell, your GP or NHS 111 can help."), []);
  assert.deepEqual(rules("I've passed it to Meadowbank Housing today, and flagged it for them to look at urgently."), []);
});
