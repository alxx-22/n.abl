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
import { armSafety, detectSafety, nextSafety, noteAdvice } from '../src/core/safety.ts';
import { checkUtterance } from '../src/core/guardrails.ts';
import { compilePrompt } from '../src/core/prompt.ts';
import { redactCodes } from '../src/core/redact.ts';
import { applyOffice, escalatePages, jobAction, maintenanceState, officeAction } from '../src/server/maintenance.ts';
import { freeWindows } from '../src/domain/windows.ts';
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
  // In the languages most often heard here besides English (live, 8 October: Polish armed nothing).
  for (const line of ['Dzień dobry, czuję gaz w kuchni, bardzo mocno.', 'Czuć zapach gazu w całym mieszkaniu', 'Miroase a gaz în bucătărie', 'Há um cheiro a gás na cozinha', 'Huele a gas en la cocina', "C'è odore di gas in cucina", 'Il y a une odeur de gaz', 'Jaučiu dujų kvapą virtuvėje']) {
    assert.equal(detectSafety(line), 'gas', line);
  }
  assert.equal(detectSafety('Potrzebuję przeglądu gazowego'), null, 'a gas check, in Polish, is not a smell');
  for (const line of ['I sent you the gas safety certificate last week', 'The gas engineer sent me a text', 'Is the gas fuse box the same as the electric one?']) assert.equal(detectSafety(line), null, line);
  // A chirping alarm named again later is still the chirp (live, 8 October), unless it is now sounding.
  const chirp: Parameters<typeof armSafety>[0] = { safety: null, safetyDone: [], heard: ['Hi, my carbon monoxide alarm has started chirping once a minute.'], said: [] };
  assert.equal(armSafety(chirp, 'Yes, that is my address. This carbon monoxide alarm is a new problem.'), null);
  assert.equal(armSafety(chirp, "Now the carbon monoxide alarm is going off and it won't stop!"), 'co');
  // Advice given in their language: the number in digits shows it was said.
  const s: Parameters<typeof armSafety>[0] = { safety: null, safetyDone: [], heard: [], said: [] };
  assert.equal(armSafety(s, 'Czuję gaz w kuchni'), 'gas');
  assert.equal(s.safety!.foreign, true);
  s.said.push('Proszę natychmiast wyjść z domu. Proszę zadzwonić pod numer 0800 111 999, 0800 111 999.');
  assert.ok(noteAdvice(s, 'england')?.spoken);
  const english: Parameters<typeof armSafety>[0] = { safety: null, safetyDone: [], heard: [], said: [] };
  armSafety(english, "There's a strong smell of gas");
  english.said.push('Call 0800 111 999.');
  assert.equal(noteAdvice(english, 'england'), null, 'in English, getting out must be said too');
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

test('compliance: a record already booked is never booked twice; cancelling frees the register, and the visit done renews the record', async () => {
  const t = await fernhill('pm-gas-twice');
  const ben = await call(t, BEN);
  const offered = await ben.run('compliance', { property: 'elm_14', action: 'book', services: 'gas safety record' });
  const w = offered.windows[0];
  const first = await ben.run('compliance', { property: 'elm_14', action: 'book', services: 'gas safety record', date: w.date, window: w.window });
  assert.equal(first.booked, true, JSON.stringify(first));
  // Asked again (the landlord forgot): the booking there is, never a second job.
  const again = await ben.run('compliance', { property: 'elm_14', action: 'book', services: 'gas safety record', date: offered.windows[1].date, window: offered.windows[1].window });
  assert.equal(again.booked, false, JSON.stringify(again));
  assert.equal(again.already?.reference, first.reference);
  assert.equal((await repo.listJobs(t.id, { property: 'elm_14' })).filter((j) => j.kind === 'gas_record' && j.status !== 'cancelled').length, 1);
  // The office cancels it: the register shows it unbooked again, and it can be booked.
  await jobAction(repo, t, first.reference, { action: 'cancel', notify: false }, async () => {}, NOW);
  const gas = async () => (await repo.listCertificates(t.id, 'elm_14')).find((c) => c.kind === 'gas_record')!;
  assert.equal((await gas()).booked_job, null);
  const second = await ben.run('compliance', { property: 'elm_14', action: 'book', services: 'gas safety record', date: w.date, window: w.window });
  assert.equal(second.booked, true, JSON.stringify(second));
  // Done inside the two months before 16 November: the new record runs a year from that date, not from the visit.
  const visit = new Date(`${w.date}T12:00:00Z`);
  await jobAction(repo, t, second.reference, { action: 'done', notes: 'Gas safety record issued.' }, async () => {}, visit);
  const renewed = await gas();
  assert.deepEqual([renewed.booked_job, renewed.issued, renewed.expires], [null, w.date, '2027-11-16']);
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
  assert.equal(st.properties.length, 90);
  const elmHome = st.properties.find((p) => p.key === 'elm_14')!;
  assert.deepEqual(elmHome.certificates.find((c) => c.kind === 'gas_record')!.state, 'due soon');
  assert.ok(st.properties.some((p) => p.certificates.some((c) => c.state === 'overdue')));
  assert.ok(!JSON.stringify(st.properties).match(/key safe[^"]*\d{4}/i), 'no code anywhere');
  assert.equal(st.incidents.length, 1);
  assert.equal(st.incidents[0].title, 'A smell of gas');
  assert.ok(st.incidents[0].follow_up_job);
  // The owner's Monday view: the week's work against its targets, and what is owed and overdue.
  const k = st.kpis;
  assert.ok(k.jobs_today >= 5, `${k.jobs_today} jobs today`);
  assert.ok(k.targets.of >= 10 && k.targets.met <= k.targets.of, JSON.stringify(k.targets));
  assert.equal(k.certificates_overdue, 1, 'the gas record three days overdue');
  assert.equal(k.damp_clocks, 1, "Meadowbank's open damp case");
  assert.equal(k.unpaid.overdue, 3);
  assert.ok(k.unpaid.pence > 0);
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

test('an emergency in office hours: never paged to an engineer off sick, and a decline goes to whoever is working today, not last night\'s on-call pair', async () => {
  const t = await fernhill('pm-day-page');
  // Dan, the first plumber on a Wednesday, is off sick today.
  const off = await officeAction(repo, t, {}, { action: 'absent', engineer: 'dan', reason: 'sick', days: 1 }, NOW);
  const sick: Tenant = { ...t, profile: applyOffice(t.profile, off.office) };
  const home = (await repo.listMtProperties(t.id)).find((p) => p.client === 'harbour')!;
  const c = await call(sick, home.occupant.phone);
  await c.run('find_property', { postcode: home.district, number: home.number, street: home.street });
  const r = await c.run('job', { action: 'create', description: 'Burst pipe, water pouring through the ceiling', name: home.occupant.name });
  const holder = async () => (await repo.listJobs(t.id, { reference: r.reference }))[0];
  assert.equal((await holder()).engineer_key, 'callum', 'the next plumber in today, not Dan');
  // Callum can't: Marek, also in today and a plumber. Last night's pair (Callum and Priya) don't come into it.
  const sent: { to: string | null; body: string }[] = [];
  const act = (b: Record<string, unknown>) => jobAction(repo, sick, r.reference, b, async (to, body) => void sent.push({ to, body }), NOW);
  assert.match(await act({ action: 'decline' }), /Marek paged instead/);
  assert.equal((await holder()).engineer_key, 'marek');
  assert.ok(sent.some((x) => x.to === '+447700900303' && /URGENT/.test(x.body)), JSON.stringify(sent));
  // Nobody else in today does plumbing (Dan is off): the duty manager.
  assert.match(await act({ action: 'no_answer' }), /Helen Ward has been texted/);
});

test('a job waiting for parts, given a new visit, is booked again: the engineer can go on the way and the caller hears the visit', async () => {
  const t = await fernhill('pm-waiting-rebook');
  const jobs = await repo.listJobs(t.id);
  const j = jobs.find((x) => x.status === 'scheduled' && x.trade === 'plumbing' && !x.flags.includes('gas') && x.visit_date! > '2026-10-07' && x.reporter.phone)!;
  const act = (b: Record<string, unknown>, now = NOW) => jobAction(repo, t, j.reference, b, async () => {}, now);
  await act({ action: 'waiting', reason: 'parts', note: 'a new valve' });
  assert.match(await act({ action: 'assign', engineer: 'marek', date: '2026-10-12', window: 'pm' }), /Marek, Monday 12 October afternoon/);
  const [now] = await repo.listJobs(t.id, { reference: j.reference });
  assert.deepEqual([now.status, now.waiting_for], ['scheduled', null]);
  assert.match(await act({ action: 'on_the_way', eta_minutes: 20 }, new Date('2026-10-12T12:30:00Z')), /on the way/);
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

test('a call-out paid when booking: the finished job bills only what is left, and a cancelled job\'s unpaid call-out is voided', async () => {
  const { preset, profile } = builderTenant(BUILDER_TENANTS.find((b) => b.slug === 'pm-fernhill')!);
  profile.maintenance!.prices.card_on_booking = true;
  const t = await repo.upsertTenant({ ...profile, slug: 'pm-callout-once' });
  await repo.insertSeed(t.id, preset.seed(t.profile, NOW, 7));
  const home = (await repo.listMtProperties(t.id)).find((p) => p.client === null && p.occupant.phone && p.occupant.name)!;
  const h = await call(t, home.occupant.phone);
  h.ctx.demoCards = [{ number: '1234567890123456', expiry: '12/34', cvc: '123', result: 'approve' as const }];
  await h.run('find_property', { postcode: home.district, number: home.number, street: home.street });
  h.say('The call-out is ninety five pounds including VAT, with the first hour.');
  const book = async (description: string, i: number) => {
    const offer = await h.run('job', { action: 'create', description, trade: 'plumbing', name: home.occupant.name });
    const w = offer.windows[i];
    const r = await h.run('job', { action: 'create', description, trade: 'plumbing', name: home.occupant.name, date: w.date, window: w.window });
    assert.equal(r.booked, true, JSON.stringify(r));
    return { ref: r.reference as string, date: w.date as string };
  };
  const tap = await book('Dripping kitchen tap', 0);
  await h.run('take_demo_payment', { for: 'callout', card_number: '1234567890123456' });
  const act = (ref: string, b: Record<string, unknown>, at = NOW) => jobAction(repo, t, ref, b, async () => {}, at);
  const visit = new Date(`${tap.date}T15:00:00Z`);
  await act(tap.ref, { action: 'done', notes: 'New cartridge fitted; an extra half hour.' }, visit);
  // £160 for the job in all: the call-out paid when booking comes off, so the invoice is for the rest.
  const paid = (await repo.listInvoices(t.id, { job: tap.ref }))[0].amount_pence;
  assert.match(await act(tap.ref, { action: 'invoice', amount_pence: 16000 }, visit), /invoice INV-\d+ sent/);
  const bills = await repo.listInvoices(t.id, { job: tap.ref });
  assert.deepEqual(bills.map((i) => [i.kind, i.amount_pence, i.status]).sort(), [['callout', paid, 'paid'], ['job', 16000 - paid, 'due']]);
  // A second job, its call-out not yet paid, cancelled by the office: the call-out is voided, not left owing.
  const leak = await book('Leak under the bath', 1);
  assert.equal((await repo.listInvoices(t.id, { job: leak.ref }))[0].status, 'due');
  await act(leak.ref, { action: 'cancel', notify: false });
  assert.equal((await repo.listInvoices(t.id, { job: leak.ref }))[0].status, 'void');
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
  // From a live call on 6 October: half an answer is still blame.
  assert.deepEqual(rules('While drying washing indoors can contribute to moisture, I can\'t say what caused it.'), ['damp_blame']);
  assert.deepEqual(rules('Keep him out of that room for now.'), ['medical_advice']);
  assert.deepEqual(rules('Make sure he uses his inhaler.'), ['medical_advice']);
  assert.deepEqual(rules('Give him his inhaler if he needs it.'), ['medical_advice']);
  // Kind, and pointed the right way: no flag.
  assert.deepEqual(rules("I'm sorry you're dealing with this. It's not something you've done. If he feels unwell, your GP or NHS 111 can help."), []);
  assert.deepEqual(rules("I've passed it to Meadowbank Housing today, and flagged it for them to look at urgently."), []);
});

test('the job tool steers the call: a quote is answered not raised again, damp asks who lives there, consent is asked, and "the morning one" needs no date', async () => {
  const t = await fernhill('pm-steer');
  // Mrs Ellis finds her flat: what waits on her is listed, and "go ahead with Q-2291" as a new job sends the approval instead.
  const jean = await call(t, '+447700900404');
  const found = await jean.run('find_property', { postcode: 'NG2', number: 'Flat 3, 22', street: 'Tansy Lane' });
  assert.equal(found.waiting_for_their_approval[0].reference, 'Q-2291');
  jean.hear("I'd like to go ahead with quote Q-2291 for the boiler.");
  const raised = await jean.run('job', { action: 'create', description: 'New boiler as per the quote', trade: 'gas_heating', name: 'Jean Ellis' });
  assert.deepEqual([raised.request_sent, raised.quote, raised.raised_already], [true, 'Q-2291', 'Quote Q-2291 was already raised: nothing new is booked.']);
  assert.equal((await repo.listJobs(t.id)).filter((j) => j.description.includes('as per the quote')).length, 0);
  // A Meadowbank damp report: asked once who lives there, then once for consent when a condition is given without it.
  const nadia = await call(t, '+447700900571');
  await nadia.run('find_property', { postcode: 'DE23', number: 'Flat 2, 7', street: 'Larkspur Walk' });
  const base = { action: 'create', description: 'Black mould on the bedroom wall', trade: 'damp_mould', name: 'Nadia Hussain' };
  assert.match((await nadia.run('job', base)).message, /asthma or another breathing problem/);
  assert.match((await nadia.run('job', { ...base, vulnerable: 'a son with asthma' })).message, /call again with consent true/);
  // "The morning one", with no date: the first free morning.
  const booked = await nadia.run('job', { ...base, vulnerable: 'a son with asthma', consent: true, window: 'am' });
  assert.equal(booked.booked, true, JSON.stringify(booked));
  assert.match(booked.when, /morning window/);
  // A price already in the description is the estimate: over Harbour's limit, it waits for approval at once.
  const jess = await call(t, '+447700900411');
  await jess.run('find_property', { postcode: 'NG3', number: '120', street: 'Larchfield Close' });
  const priced = await jess.run('job', { action: 'create', description: 'Replace the back door and frame as per the quote (£600)', trade: 'carpentry', name: 'Jess Morgan' });
  assert.equal(priced.awaiting_approval, true, JSON.stringify(priced));
  // Live, 6 October: quoted last week at "six hundred pounds", and the door "doesn't lock properly". That is planned work
  // through Harbour's limit, not an emergency page.
  const jess2 = await call(t, '+447700900411');
  jess2.hear('Your joiner priced the rotten back door and frame at six hundred pounds last week; please book it in.');
  jess2.hear("The back door is rotten and doesn't lock properly at the bottom.");
  await jess2.run('find_property', { postcode: 'NG3', number: '120', street: 'Larchfield Close' });
  const planned = await jess2.run('job', { action: 'create', description: "Rotten back door and frame; doesn't lock properly", trade: 'carpentry', name: 'Jess Morgan' });
  assert.equal(planned.awaiting_approval, true, JSON.stringify(planned));
  assert.equal((await repo.listJobs(t.id, { reference: planned.reference }))[0].priority, 'urgent');
  // "Both" books the record and the service together, at the combined price.
  const ben = await call(t, '+447700900406');
  await ben.run('find_property', { postcode: 'NG5', number: '14', street: 'Elm Road' });
  const both = await ben.run('compliance', { property: 'elm_14', action: 'book', services: 'both' });
  assert.equal(both.price, '£130 including VAT');
  // Nothing on the board for a caller: "nobody from us is due today".
  const aisha = (await repo.listMtProperties(t.id)).find((p) => p.key === 'larchfield_120')!;
  for (const j of await repo.listJobs(t.id, { property: aisha.key })) if (!['done', 'invoiced'].includes(j.status)) await repo.updateJob(t.id, j.reference, { status: 'cancelled' }, 'test');
  const caller = await call(t, aisha.occupant.phone);
  caller.hear("A man at my door says he's from Fernhill, but I wasn't expecting anyone.");
  const door = await caller.run('job', { action: 'find' });
  assert.ok(door.found === 0 ? /nobody from us is due today/.test(door.message) : /we haven't sent anyone, not to let them in/.test(door.at_the_door), JSON.stringify(door));
});

test("the caller's own words count: a leak they said was pouring is an emergency, a guessed trade loses to the fault, and \"someone at my door\" is answered from the board", async () => {
  const t = await fernhill('pm-own-words');
  const home = (await repo.listMtProperties(t.id)).find((p) => p.key === 'larchfield_120')!;
  for (const j of await repo.listJobs(t.id, { property: home.key })) if (!['done', 'invoiced'].includes(j.status)) await repo.updateJob(t.id, j.reference, { status: 'cancelled' }, 'test');
  // Live, 6 October: the summary said "water leak from kitchen ceiling"; the caller said pouring.
  const c = await call(t, home.occupant.phone, NIGHT);
  c.hear("Water is pouring through my kitchen ceiling from the bathroom above!");
  await c.run('find_property', { postcode: 'NG3', number: '120', street: 'Larchfield Close' });
  assert.equal((await c.run('triage_fault', { description: 'water leak from kitchen ceiling' })).priority, 'emergency');
  // An emergency has no window to offer.
  assert.match((await c.run('check_windows', { trade: 'plumbing', property: home.key })).message, /This is an emergency: no window/);
  const r = await c.run('job', { action: 'create', description: 'water leak from kitchen ceiling', trade: 'plumbing', name: home.occupant.name });
  assert.equal(r.priority, 'emergency');
  // A postcode alone asks for the rest, rather than "not on our books".
  assert.match((await c.run('find_property', { postcode: 'NG5' })).message, /Ask for the house number or name and the street/);
  // "A door that won't lock" is the owner's example; "I'd like to book that in" about a door is not it.
  const jess = await call(t, '+447700900411');
  jess.hear("The rotten back door and frame need replacing, and I'd like to book that in.");
  assert.equal((await jess.run('triage_fault', { description: 'Replace the rotten back door and frame' })).priority, 'routine');
  // Raised, so "I've booked that in" is true; an arrival time before anyone accepts is not.
  const said = (line: string) => checkUtterance(line, c.ctx.state, ['Dan', 'Leon'], t.profile.maintenance).map((f) => f.rule);
  assert.deepEqual(said("I've booked that in, and our on-call engineer has been paged."), []);
  assert.ok(said("Dan will be with you by ten o'clock.").includes('invented_eta'));
  // A chirping carbon monoxide alarm is the electrician's, whatever trade the model passes; "nobody vulnerable" raises nothing (live, 6 October).
  const sam = await call(t, '+447700900501');
  sam.hear("I'm calling about my carbon monoxide alarm. It's chirping once a minute.");
  sam.hear("There's no one particularly vulnerable here.");
  assert.equal((await sam.run('triage_fault', { description: 'CO alarm chirping', answers: 'no one vulnerable' })).priority, 'urgent');
  await sam.run('find_property', { postcode: 'NG5', number: '14', street: 'Elm Road' });
  const w = (await sam.run('job', { action: 'create', description: 'CO alarm chirping once a minute', trade: 'gas_heating', name: 'Sam Ortiz' })).windows[0];
  const chirp = await sam.run('job', { action: 'create', description: 'CO alarm chirping once a minute', trade: 'gas_heating', name: 'Sam Ortiz', date: w.date, window: w.window });
  assert.equal((await repo.listJobs(t.id, { reference: chirp.reference }))[0].trade, 'electrical');
  // Someone at the door, and nothing on the board for them today.
  const aisha = await call(t, home.occupant.phone);
  aisha.hear("There's a man at my door saying he's from Fernhill to check my boiler, but I wasn't expecting anyone.");
  const msg = await aisha.run('take_message', { name: 'Aisha Patel', message: 'Man at the door says he is from us; not expecting anyone.', category: 'safety', urgency: 'urgent' });
  assert.match(msg.at_the_door, /we haven't sent anyone, not to let them in/);
  // A stranger to a home hears that anyone may report a repair there.
  const found = await jess.run('find_property', { postcode: 'NG3', number: '120', street: 'Larchfield Close' });
  assert.match(found.properties[0].reporting, /Raise their repair with job create, not a message/);
});

test('prices as people say them', async () => {
  const { poundsIn } = await import('../src/core/maintenance-tools.ts');
  assert.equal(poundsIn('priced at six hundred pounds last week'), 600);
  assert.equal(poundsIn('two thousand four hundred and fifty pounds'), 2450);
  assert.equal(poundsIn('about a hundred and twenty quid'), 120);
  assert.equal(poundsIn('the quote was £2,450'), 2450);
  assert.equal(poundsIn('it came to 380 pounds'), 380);
  assert.equal(poundsIn('no price here'), undefined);
});

test('the tools finish what the model starts: a yes found is sent, a safety check goes on the register, and damp at Meadowbank is a job', async () => {
  const t = await fernhill('pm-finish');
  // Mrs Ellis says go ahead, and the receptionist only looks Q-2291 up: the request goes to her phone all the same.
  const jean = await call(t, '+447700900404');
  jean.hear("I've decided to go ahead with quote Q-2291 for a new boiler.");
  const found = await jean.run('job', { action: 'find', reference: 'Q-2291' });
  assert.equal(found.approval.request_sent, true);
  assert.ok(jean.sent.some((x) => x.to === '+447700900404' && /waiting for your approval/.test(x.body)));
  // An agent going ahead with a quote that isn't on file: raise it, priced, rather than hunt for it.
  const jess = await call(t, '+447700900411');
  jess.hear("We'd like to go ahead with the six hundred pound quote for the back door at 120 Larchfield Close.");
  assert.match((await jess.run('job', { action: 'find' })).message, /No quote is on file for them. Raise the work now with job create/);
  // A landlord's gas safety check raised as a repair goes on the register instead, booked there by the job tool itself
  // (live, 8 October: told to use compliance, the receptionist said "booked" and never did).
  const ben = await call(t, '+447700900406');
  await ben.run('find_property', { postcode: 'NG5', number: '14', street: 'Elm Road' });
  const asRepair = await ben.run('job', { action: 'create', description: 'Annual gas safety check', trade: 'boiler_servicing', name: 'Ben Whitfield' });
  assert.match(asRepair.booked_as, /safety check \(gas safety record\), on the register/);
  assert.match(asRepair.price, /£75/);
  const am = asRepair.windows.find((x: { window: string }) => x.window === 'am');
  const onRegister = await ben.run('job', { action: 'create', description: 'Gas safety check.', trade: 'gas_heating', name: 'Ben Whitfield', date: am.date, window: 'am' });
  assert.equal(onRegister.booked, true, JSON.stringify(onRegister));
  const cert = (await repo.listCertificates(t.id, 'elm_14')).find((c) => c.kind === 'gas_record')!;
  assert.equal(cert.booked_job, onRegister.reference);
  // Damp at Meadowbank taken as a message: the receptionist is told to raise the job too.
  const nadia = await call(t, '+447700900571');
  await nadia.run('find_property', { postcode: 'DE23', number: 'Flat 2, 7', street: 'Larkspur Walk' });
  nadia.hear("There's black mould spreading on my son's bedroom wall.");
  const home = await nadia.run('find_property', { postcode: 'DE23', number: 'Flat 2, 7', street: 'Larkspur Walk' });
  assert.match(home.properties[0].damp, /Damp or mould here is a job: raise it with job create/);
  const msg = await nadia.run('take_message', { name: 'Nadia Hussain', message: 'Black mould in the bedroom', category: 'damp' });
  assert.match(msg.also, /Raise the repair too, with job create: that is what tells Meadowbank Housing today/);
  // Live, 8 October: "vulnerabilities" for vulnerable, with consent, is taken as it is meant.
  const nadia2 = await call(t, '+447700900571');
  await nadia2.run('find_property', { postcode: 'DE23', number: 'Flat 2, 7', street: 'Larkspur Walk' });
  nadia2.hear("There's black mould spreading on my son's bedroom wall. He's six and has asthma.");
  const named = await nadia2.run('job', { action: 'create', description: "Black mould in son's bedroom", name: 'Nadia Hussain', vulnerabilities: 'child with asthma (6)', consent: true, trade: 'damp_mould' });
  assert.ok(named.windows?.length || named.booked, JSON.stringify(named));
  assert.doesNotMatch(String(named.message ?? ''), /Ask whether anyone at home has asthma/);
  // Consent said aloud is consent (live, 8 October: "you can note his asthma too", and it was never noted).
  const nadia3 = await call(t, '+447700900571');
  await nadia3.run('find_property', { postcode: 'DE23', number: 'Flat 2, 7', street: 'Larkspur Walk' });
  nadia3.hear('Yes, please, book the visit for tomorrow morning. You can note his asthma too.');
  const noted = await nadia3.run('job', { action: 'create', description: "Black mould in son's bedroom", name: 'Nadia Hussain', vulnerable: 'Son aged 6 has asthma', trade: 'damp_mould' });
  assert.doesNotMatch(String(noted.message ?? ''), /consent/, JSON.stringify(noted));
  // Live, 8 October: hanging up with no job raised is stopped once.
  const end = await nadia.run('end_call', { outcome: 'message' });
  assert.equal(end.ok, false);
  assert.match(end.message, /No job has been raised for the damp, so Meadowbank Housing haven't been told/);
  assert.equal((await nadia.run('end_call', { outcome: 'message' })).ok, true, 'never twice');
  // Someone at the door who gave a reference: no match, and nothing booked for this number today, so we haven't sent anyone.
  const aisha = await call(t, '+447700900502');
  await repo.db.query(`update public.voice_mt_jobs set status = 'cancelled' where tenant_id = $1 and property_key = 'larchfield_120' and status not in ('done', 'invoiced')`, [t.id]);
  aisha.hear("There's a man at my door saying he's from Fernhill. He's given me the reference F P nine eight seven six.");
  const door = await aisha.run('job', { action: 'find', reference: 'FP9876' });
  assert.match(door.at_the_door, /we haven't sent anyone/);
  // And as said on the next run: "is he one of yours?", "he just said he's from Fernhill", no reference.
  const aisha2 = await call(t, '+447700900502');
  aisha2.hear('Is he one of yours? Should I let him in?');
  aisha2.hear("No, he just said he's from Fernhill. He's here to check the boiler.");
  const none = await aisha2.run('job', { action: 'find', property: 'larchfield_120' });
  assert.match(none.at_the_door, /we haven't sent anyone, not to let them in/);
  // Found from her own number, the home comes with the board's answer (live, 8 October: "I've checked", unchecked).
  const home2 = await aisha2.run('find_property', { postcode: 'NG3', number: '120' });
  assert.match(home2.at_the_door, /we haven't sent anyone/);
  // The health question passed on is not health advice.
  const s2 = newCallState();
  s2.maintenance = true;
  assert.deepEqual(checkUtterance('For whether to keep him out of the room, please speak to your GP or NHS 111.', s2).map((f) => f.rule), []);
  assert.deepEqual(checkUtterance('Please speak to your GP about whether to keep him out of the room.', s2).map((f) => f.rule), []);
  assert.deepEqual(checkUtterance('You should keep him out of the room for now.', s2).map((f) => f.rule), ['medical_advice']);
  // Live, 8 October.
  assert.deepEqual(checkUtterance("Damp and mould can sometimes make it worse, so it's best to limit his time in that room if you can.", s2).map((f) => f.rule), ['medical_advice']);
});

test('invented_price: a sum no setting, tool or caller gave is caught; the real ones are not', async () => {
  const t = await fernhill('pm-prices');
  const c = await call(t, '+447700900501');
  const rules = (line: string) => checkUtterance(line, c.ctx.state, ['Dan'], t.profile.maintenance).map((f) => f.rule);
  // Live, 6 October, "forty pounds" for an alarm: that happens to be the half-hour rate, so only a sum matching nothing is caught.
  assert.deepEqual(rules('Replacing the alarm comes to sixty five pounds, including VAT.'), ['invented_price']);
  assert.deepEqual(rules('The call-out is ninety five pounds including VAT, then £40 a half hour.'), []);
  assert.deepEqual(rules('The evening window is £30 extra, so £125 for the call-out.'), []);
  assert.deepEqual(rules('We carry £5 million public liability insurance.'), []);
  // The caller's own figure may be repeated; a tool's may be said once it has given it.
  c.hear('The joiner priced it at six hundred pounds.');
  assert.deepEqual(rules('So that was six hundred pounds?'), []);
  assert.deepEqual(rules('Quote Q-2291 is for £2,450.'), ['invented_price']);
  await c.run('job', { action: 'find', reference: 'Q-2291' });
  assert.deepEqual(rules('Quote Q-2291 is for £2,450.'), []);
});

test('sums as people say them', async () => {
  const { amountsIn } = await import('../src/domain/amounts.ts');
  assert.deepEqual(amountsIn('£95.50, then eleven pounds fifty, then £2,450'), [9550, 1150, 245000]);
  assert.deepEqual(amountsIn('a hundred and twenty quid'), [12000]);
  assert.deepEqual(amountsIn('£10 million cover and £5m more'), []);
  assert.deepEqual(amountsIn('ring 0800 111 999 at 8 to 12'), []);
  assert.deepEqual(amountsIn('£95.'), [9500]);
  // Live, 6 October: "a half hour" is not a penny.
  assert.deepEqual(amountsIn('ninety five pounds, then forty pounds a half hour'), [9500, 4000]);
  assert.deepEqual(amountsIn('eleven pounds fifty five'), [1155]);
});

test('triage reads what is wrong, not what the caller says is fine; and the job action is read from a list sent whole', async () => {
  const t = await fernhill('pm-denials');
  const m = t.profile.maintenance!;
  const { triage } = await import('../src/core/maintenance-tools.ts');
  // Live, 6 October: a dripping tap became an electrical emergency from "no water near electrics".
  const tap = triage(m, 'dripping kitchen tap. no water near electrics, no vulnerable people, stopcock known', { date: '2026-10-07' });
  assert.deepEqual([tap.trade, tap.priority], ['plumbing', 'routine']);
  // A lack that is the fault still counts.
  assert.equal(triage(m, 'There is no heating and no hot water', { date: '2026-12-07' }).priority, 'urgent');
  assert.equal(triage(m, 'no power at all in the house', { date: '2026-10-07' }).priority, 'emergency');
  // Live, 8 October: answers written as a form, and the roof ahead of the water and the lights it is near.
  assert.equal(triage(m, 'slipped roof slates. water near electrics: no,vulnerable people: no', { date: '2026-10-07' }).trade, 'roofing');
  assert.equal(triage(m, 'leak in bedroom ceiling from roof', { date: '2026-10-07' }).trade, 'roofing');
  assert.equal(triage(m, 'a steady drip into a bucket, nowhere near any lights', { date: '2026-10-07' }).trade, 'plumbing');
  assert.equal(triage(m, 'water dripping through bedroom ceiling since rain last night', { date: '2026-10-07' }).trade, 'roofing');
  assert.equal(triage(m, 'the bathroom tiles are cracked', { date: '2026-10-07' }).trade, null, "a bathroom's tiles aren't a roofer's");
  assert.equal(triage(m, 'a few tiles have blown off in the wind', { date: '2026-10-07' }).trade, 'roofing');
  assert.equal(triage(m, 'water leaking behind the bathroom tiles', { date: '2026-10-07' }).trade, 'plumbing');
  // "create, find, move, cancel, approve or decline" sent as the action: the first one counts.
  const home = (await repo.listMtProperties(t.id)).find((p) => p.client === null && p.occupant.phone && p.occupant.name)!;
  const c = await call(t, home.occupant.phone);
  await c.run('find_property', { postcode: home.district, number: home.number, street: home.street });
  const r = await c.run('job', { action: 'create, find, move, cancel, approve or decline', description: 'Dripping kitchen tap', name: home.occupant.name });
  assert.equal(r.error, undefined, JSON.stringify(r));
});

test('safety mode hears a denial inside the words too', async () => {
  const { detectSafety } = await import('../src/core/safety.ts');
  // Live, 6 October: the burst-pipe caller said the water was nowhere near the lights.
  assert.equal(detectSafety("The water isn't anywhere near the lights, though."), null);
  assert.equal(detectSafety('Water is coming through the light fitting in the hall.'), 'electric');
});

test('a leaseholder found from "Flat 4, NG7" and their own number, or from the full address: never added again as a new home', async () => {
  const t = await fernhill('pm-block-found');
  const MARCUS = '+447700900578';
  const door = (await repo.listJobs(t.id, { property: 'riverside_court' })).find((j) => /door entry/i.test(j.description) && j.status !== 'cancelled')!;
  const homes = (await repo.listMtProperties(t.id)).length;
  // Live, 8 October: "Flat 4" and "NG7" found nothing, the door entry went to a joiner, priced, and his flat was added again.
  const marcus = await call(t, MARCUS);
  const found = await marcus.run('find_property', { number: 'Flat 4', postcode: 'NG7' });
  assert.equal(found.found, 1, JSON.stringify(found));
  assert.equal(found.properties[0].property, 'riverside_court_flat_4');
  // Rain through a top-floor ceiling, said before the flat is found: the roof, in the shared parts, from the start.
  const helen = await call(t, '+447700900579');
  helen.hear("I'm calling about a leak in my bedroom ceiling. Since it rained last night, water's been dripping through.");
  const hers = await helen.run('find_property', { number: 'Flat 9, 2', street: 'Weaver Lane', postcode: 'NG7' });
  assert.match(hers.what_they_said, /the roof, in the block's shared parts: no price/);
  // The street alone from the occupant's own number (live, 8 October: "Elm Road" from Sam's phone found nothing).
  const sam = await (await call(t, SAM)).run('find_property', { street: 'Elm Road' });
  assert.deepEqual([sam.found, sam.properties?.[0]?.property], [1, 'elm_14'], JSON.stringify(sam));
  // "9, Riverside Court": the block named, so 9 is the flat.
  const nine = await (await call(t, STRANGER)).run('find_property', { street: 'Riverside Court', number: '9' });
  assert.deepEqual([nine.found, nine.properties?.[0]?.property], [1, 'riverside_court_flat_9'], JSON.stringify(nine));
  // From someone else's phone, the same words find nothing, and the model is told to ask for the rest first.
  const other = await (await call(t, STRANGER)).run('find_property', { number: 'Flat 4', postcode: 'NG7' });
  assert.equal(other.found, 0);
  assert.match(other.message, /Ask for the rest of the address/);
  // The fault: a door entry system is an electrician's, not a joiner's.
  const tri = await (await call(t, STRANGER)).run('triage_fault', { description: "Door entry system isn't working. Pressing the button doesn't release the main door" });
  assert.equal(tri.trade, 'electrical');
  // The model passing the address for the key, then raising it as a new customer: both land on his flat.
  const late = await call(t, MARCUS);
  const named = await late.run('triage_fault', { property: 'Flat 4, Riverside Court, 2 Weaver Lane, NG7', description: "Door entry system isn't working" });
  assert.equal(named.price, undefined, 'the shared parts are never priced to a leaseholder');
  const fresh = await call(t, MARCUS);
  const job = await fresh.run('job', { action: 'create', address: 'Flat 4, Riverside Court, 2 Weaver Lane', postcode: 'NG7 1AA', description: "Door entry system isn't working", name: 'Marcus Okoro', window: 'am', trade: 'carpentry' });
  assert.deepEqual([job.already_reported, job.reference], [true, door.reference], JSON.stringify(job));
  assert.equal((await repo.listMtProperties(t.id)).length, homes, 'no new home added');
});

test('a block: shared faults are one job on the block for its managing agent; inside a flat is the leaseholder\'s own', async () => {
  const t = await fernhill('pm-block');
  const MARCUS = '+447700900578';
  const JOANNE = '+447700900577';
  const MARTIN = '+447700900408';
  const blockJobs = async () => (await repo.listJobs(t.id, { property: 'riverside_court' })).filter((j) => j.status !== 'cancelled');
  // The seed's door entry: rung in from Flat 1, then Flat 9.
  const door = (await blockJobs()).find((j) => /door entry/i.test(j.description))!;
  assert.deepEqual([door.status, door.client_key, door.reporters.length], ['scheduled', 'riverside', 1]);

  // Marcus in Flat 4 finds his flat by the block's name: it's his own, and the block's shared parts are Riverside's.
  const marcus = await call(t, MARCUS);
  const found = await marcus.run('find_property', { postcode: 'NG7', number: 'Flat 4', street: 'Riverside Court' });
  assert.equal(found.found, 1, JSON.stringify(found));
  const flat = found.properties[0];
  assert.deepEqual([flat.property, flat.caller_is, flat.looked_after_by, flat.block], ['riverside_court_flat_4', 'homeowner', 'the homeowner', 'Riverside Court']);
  assert.match(flat.shared_parts, /for Riverside Block Management to instruct/);
  assert.match(flat.inside_the_flat, /leaseholder's own/);

  // The door entry again: one job, Marcus added, told its status; never who else rang.
  const tri = await marcus.run('triage_fault', { description: "The door entry buzzer isn't letting anyone in" });
  assert.equal(tri.price, undefined, 'Riverside pays for the shared parts');
  assert.match(tri.shared_parts, /no price and no window/);
  const again = await marcus.run('job', { action: 'create', description: "The door entry buzzer isn't letting anyone in", name: 'Marcus Okoro' });
  assert.equal(again.already_reported, true, JSON.stringify(again));
  assert.equal(again.reference, door.reference);
  assert.match(again.say, /^We already have that one: it's booked for /);
  assert.doesNotMatch(JSON.stringify(again), /Joanne|Helen|Pierce|Duffy|Flat 1|Flat 9/);
  assert.match(marcus.sent.at(-1)!.body, new RegExp(`already have the door entry fault at Riverside Court as job ${door.reference}`));
  await marcus.run('job', { action: 'create', description: 'Door entry still broken', name: 'Marcus Okoro' });
  assert.deepEqual((await repo.listJobs(t.id, { reference: door.reference }))[0].reporters.map((r) => r.phone), ['+447700900579', MARCUS], 'added once');

  // A new shared fault: logged for Riverside to instruct, no date, and Martin Hale's phone asked.
  const lights = await marcus.run('job', { action: 'create', description: 'The stairwell lights are out on the second floor', name: 'Marcus Okoro' });
  assert.equal(lights.for_client_to_instruct, true, JSON.stringify(lights));
  assert.match(lights.say, /shared parts of Riverside Court, so it's for Riverside Block Management to instruct.*It isn't booked yet\./);
  assert.ok(marcus.ctx.state.awaitingApproval, 'the guardrail holds "booked" back');
  const lj = (await repo.listJobs(t.id, { reference: lights.reference }))[0];
  assert.deepEqual([lj.property_key, lj.client_key, lj.status, lj.visit_date, lj.reporter.phone], ['riverside_court', 'riverside', 'awaiting_approval', null, MARCUS]);
  assert.match(marcus.sent.find((x) => x.to === MARTIN)!.body, /stairwell lights|lights fault at Riverside Court/);
  // Joanne rings about the same lights: added to it.
  const joanne = await call(t, JOANNE);
  await joanne.run('find_property', { postcode: 'NG7', number: 'Flat 1', street: 'Weaver Lane' });
  const same = await joanne.run('job', { action: 'create', description: 'No lights on the landing', name: 'Joanne Pierce' });
  assert.deepEqual([same.already_reported, same.reference], [true, lights.reference]);
  assert.match(same.status, /waiting for approval/);

  // Water through the roof into a top-floor flat: made safe now, the repair logged for Riverside.
  const helen = await call(t, '+447700900579');
  await helen.run('find_property', { postcode: 'NG7', number: 'Flat 9', street: 'Riverside Court' });
  const roof = await helen.run('job', { action: 'create', description: 'The roof is leaking into my bedroom', name: 'Helen Duffy' });
  assert.deepEqual([roof.booked, roof.priority], [true, 'emergency'], JSON.stringify(roof));
  assert.match(roof.say, /paged to make it safe.*The repair itself is for Riverside Block Management to instruct/);
  const roofJobs = (await blockJobs()).filter((j) => /roof/i.test(j.description));
  assert.deepEqual(roofJobs.map((j) => j.status).sort(), ['awaiting_approval', 'new']);
  // Live, 8 October: the repair's reference was the one owed, so the caller was asked to hear a second one, and when
  // the receptionist read it out it was called made up. The make-safe's is owed; the repair's, if said, is real.
  assert.equal(helen.ctx.state.owed, roof.reference);
  const repairRef = roofJobs.find((j) => j.status === 'awaiting_approval')!.reference;
  assert.deepEqual(checkUtterance(`Your repair reference is ${repairRef.split('').join(', ')}.`, helen.ctx.state).map((f) => f.rule), []);

  // Inside the flat: the leaseholder's own, priced first like any homeowner's.
  const tap = await marcus.run('job', { action: 'create', description: 'Kitchen tap dripping', name: 'Marcus Okoro' });
  assert.equal(tap.booked, false);
  assert.match(tap.message, /Tell them the price first/);

  // A flat heated by the block's boiler: no heating is the block's.
  const ravi = await call(t, '+447700900580');
  await ravi.run('find_property', { postcode: 'DE1', number: 'Flat 3', street: 'Kingfisher House' });
  const heat = await ravi.run('job', { action: 'create', description: 'No heating in the flat since this morning', name: 'Ravi Sandhu' });
  assert.equal(heat.for_client_to_instruct, true, JSON.stringify(heat));
  assert.equal((await repo.listJobs(t.id, { reference: heat.reference }))[0].property_key, 'kingfisher_house');

  // A lift is the lift contractor's, never ours.
  const lift = await marcus.run('job', { action: 'create', description: 'The lift is out of order', name: 'Marcus Okoro' });
  assert.match(lift.message, /We don't look after lifts.*Apex Lifts/);

  // Approved on Martin's phone: everyone who reported the lights hears when.
  const texts: { to: string | null; body: string }[] = [];
  await jobAction(repo, t, lights.reference, { action: 'authorise', answer: 'yes' }, async (to, body) => void texts.push({ to, body }), NOW);
  const told = texts.filter((x) => /has approved job/.test(x.body)).map((x) => x.to);
  assert.deepEqual(told.sort(), [JOANNE, MARCUS].sort());
});

test('trapped in a lift: 999 if unwell, the lift alarm and company, the managing agent told; nobody sent, nothing booked', async () => {
  const t = await fernhill('pm-lift');
  const before = (await repo.listJobs(t.id)).length;
  // A neighbour, not on file, names the block.
  const c = await call(t, '+447700900999');
  c.hear("My neighbour's stuck in the lift at Riverside Court, she's been in there ten minutes.");
  const r = await c.run('triage_fault', { description: "Neighbour stuck in the lift at Riverside Court" });
  assert.equal(r.trapped_in_lift, true, JSON.stringify(r));
  assert.match(r.say[0], /call 999 now/);
  assert.match(r.say[1], /alarm button in the lift/);
  assert.match(r.say[2], /Apex Lifts \(example\), 0115 496 0711/);
  assert.match(r.say[3], /told Riverside Block Management/);
  assert.match(r.never, /Book nothing/);
  assert.match(c.sent.find((x) => x.to === '+447700900408')!.body, /URGENT: someone reported trapped in the lift at Riverside Court/);
  const [m] = (await repo.listMessages(t.id, 50)).filter((x) => x.category === 'safety');
  assert.deepEqual([m.urgency, m.for_staff], ['urgent', 'duty_manager']);
  assert.equal((await repo.listJobs(t.id)).length, before, 'no job');
  // From a resident's own flat, through the job tool: the same.
  const marcus = await call(t, '+447700900578');
  await marcus.run('find_property', { postcode: 'NG7', number: 'Flat 4', street: 'Riverside Court' });
  const viaJob = await marcus.run('job', { action: 'create', description: 'Someone is trapped in the lift', name: 'Marcus Okoro' });
  assert.equal(viaJob.trapped_in_lift, true);
});

test('a business site: the site contact who rings is the one who approves; found by its name', async () => {
  const t = await fernhill('pm-site');
  const sian = await call(t, '+447700900412');
  const found = await sian.run('find_property', { postcode: 'NG1', number: '9', street: 'Hosiery Row' });
  assert.equal(found.properties[0].caller_is, 'authoriser');
  const byName = await sian.run('find_property', { postcode: 'NG1', number: 'The Copper Kettle' });
  assert.equal(byName.properties?.[0]?.property, 'hosiery_row_9', JSON.stringify(byName));
});

test('an insurer\'s claim: the claim number and the policyholder first; the insurer pays, the policyholder hears; never what is covered', async () => {
  const t = await fernhill('pm-claim');
  const desk = await call(t, '+447700900409');
  desk.hear('Claim 77-23019, escape of water at 4 Holly Close, NG5 2BT, trace and access please.');
  const who = await desk.run('find_property', {});
  assert.match(who.caller_is, /Bramley Mutual Insurance/);
  const none = await desk.run('find_property', { postcode: 'NG5', number: '4', street: 'Holly Close' });
  assert.match(none.message, /that's fine for a claim.*policyholder/);
  const tri = await desk.run('triage_fault', { description: 'Escape of water under the bathroom floor: trace and access' });
  assert.equal(tri.price, undefined, 'the insurer pays');
  const job = { action: 'create', description: 'Escape of water: trace and access under the bathroom', address: '4 Holly Close', postcode: 'NG5 2BT', name: 'Claims desk' };
  const noHolder = await desk.run('job', job);
  assert.match(noHolder.message, /policyholder's name and phone/);
  // Live, 8 October: the model passed the policyholder as name and phone, three times, and the job was never raised.
  const asNamed = await (await call(t, '+447700900409')).run('job', { ...job, claim: '77-23019', name: 'David Shaw', phone: '07700 900590', address: '6 Holly Close' });
  assert.ok(asNamed.windows?.length, JSON.stringify(asNamed));
  // And again, as on the next live call: the handler's own name, the policyholder's name alone in its box.
  const kim = await call(t, '+447700900409');
  const kimArgs = { ...job, claim: '77-23455', name: 'Kim', policyholder: 'David Shaw', phone: '07700 900590', address: '8 Holly Close' };
  const kw = (await kim.run('job', kimArgs)).windows[0];
  const kimJob = await kim.run('job', { ...kimArgs, date: kw.date, window: kw.window });
  assert.equal(kimJob.booked, true, JSON.stringify(kimJob));
  const kimRow = (await repo.listJobs(t.id, { reference: kimJob.reference }))[0];
  assert.equal((await repo.getMtProperty(t.id, kimRow.property_key!))!.occupant.name, 'David Shaw');
  assert.equal(kimRow.reporter.phone, '+447700900409', "the booking's confirmation goes to the desk that rang");
  assert.match(kim.sent.find((x) => x.to === '+447700900590')!.body, /asked us to come about claim 77-23455/);
  // And a repairs call that ends "booked" with nothing booked is stopped once.
  const empty = await call(t, '+447700900409');
  assert.equal((await empty.run('end_call', { outcome: 'booked' })).ok, false);
  assert.equal((await empty.run('end_call', { outcome: 'booked' })).ok, true, 'never twice');
  const windows = await desk.run('job', { ...job, policyholder: 'David Shaw, 07700 900590' });
  assert.ok(windows.windows?.length, JSON.stringify(windows));
  const first = windows.windows[0];
  const booked = await desk.run('job', { ...job, policyholder: 'David Shaw, 07700 900590', date: first.date, window: first.window });
  assert.equal(booked.booked, true, JSON.stringify(booked));
  assert.deepEqual([booked.claim, booked.price, booked.policyholder_told], ['77-23019', undefined, true]);
  assert.match(booked.never, /what the policy covers/);
  const row = (await repo.listJobs(t.id, { reference: booked.reference }))[0];
  assert.deepEqual([row.client_key, row.claim_ref, row.reporter.role], ['bramley', '77-23019', 'other']);
  const home = (await repo.getMtProperty(t.id, row.property_key!))!;
  assert.deepEqual([home.occupant.name, home.occupant.phone, home.client], ['David Shaw', '+447700900590', null]);
  assert.match(desk.sent.find((x) => x.to === '+447700900590')!.body, /Bramley Mutual Insurance has asked us to come about claim 77-23019/);

  // A policyholder with a claim number: sent to the insurer to confirm, nothing booked, no price.
  const ellie = await call(t, '+447700900546');
  await ellie.run('find_property', { postcode: 'NG3', number: 'Flat 2, 20', street: 'Saxonby' });
  ellie.hear("I've got a claim with Bramley, claim number BM-4471, for the leak.");
  const own = await ellie.run('job', { action: 'create', description: 'Leak under the kitchen floor', name: 'Ellie Burke' });
  assert.equal(own.for_insurer_to_confirm, true, JSON.stringify(own));
  assert.match(own.say, /Bramley Mutual Insurance confirm it first.*It isn't booked yet\./);
  assert.match(ellie.sent.find((x) => x.to === '+447700900409')!.body, /claim BM-4471/);

  // What is covered is the insurer's to say.
  const s = newCallState();
  s.maintenance = true;
  for (const line of ["Don't worry, your insurance should cover that.", "You're fully covered for escape of water.", 'The claim will be paid once they see the report.']) {
    assert.deepEqual(checkUtterance(line, s).map((f) => f.rule), ['cover_advice'], line);
  }
  for (const line of ["I can't say whether it's covered: that's for Bramley to confirm.", "We'll send the report to your insurer."]) assert.deepEqual(checkUtterance(line, s), [], line);
});

test('a business: the contract sets the priority; trading, access and the order number asked once; the asbestos register', async () => {
  const t = await fernhill('pm-cafe');
  const sian = await call(t, '+447700900412');
  await sian.run('find_property', { postcode: 'NG1', number: '9', street: 'Hosiery Row' });
  const tri = await sian.run('triage_fault', { description: 'The kitchen sink is draining slowly' });
  assert.equal(tri.priority, 'urgent');
  assert.match(tri.reason, /The Copper Kettle's contract: at least urgent/);
  assert.equal(tri.price, undefined);
  const job = { action: 'create', description: 'Kitchen sink draining slowly', name: 'Sian Morris' };
  // Live, 8 October: access filled from the property's notes skipped all of this, and no order number was taken.
  const ask = await sian.run('job', { ...job, access: 'the occupant lets the engineer in' });
  assert.match(ask.message, /affecting trading.*opening hours.*purchase order number/);
  assert.match(ask.client_notes, /open 8 to 4/);
  const windows = await sian.run('job', { ...job, access: 'Before 8, Sian opens up', po: 'CK-1182' });
  const w = windows.windows[0];
  const booked = await sian.run('job', { ...job, access: 'Before 8, Sian opens up', po: 'CK-1182', date: w.date, window: w.window });
  assert.equal(booked.booked, true, JSON.stringify(booked));
  assert.equal(booked.priority, 'urgent');
  assert.match(booked.asbestos, /before 2000.*asbestos register/);
  const row = (await repo.listJobs(t.id, { reference: booked.reference }))[0];
  assert.deepEqual([row.po, row.client_key, row.priority], ['CK-1182', 'copper_kettle', 'urgent']);
});

test('"what have I got due?": a landlord\'s homes from their own number, overdue first, a summary emailed, and all of it booked in one go', async () => {
  const t = await fernhill('pm-portfolio');
  // Only from the number on file.
  const stranger = await call(t, '+447700900999');
  assert.match((await stranger.run('compliance', { action: 'portfolio' })).message, /only for them, from the number we have on file/);
  const raj = await call(t, '+447700900405');
  const due = await raj.run('compliance', { action: 'portfolio' });
  assert.deepEqual([due.client, due.homes], ['Mr R Kaur', 3]);
  assert.equal(due.overdue.length, 1);
  assert.match(due.overdue[0], /^Gas safety record at Flat 3, 6 Wharfside .*: ran out on /);
  assert.equal(due.due_in_the_next_two_months.length, 2);
  assert.match(due.due_in_the_next_two_months.join(' '), /Gas safety record at .*Charnwood.*Electrical installation condition report at .*Hazelmere/);
  assert.match(due.say, /overdue first/);
  assert.match(due.emailed, /email we have on file/);
  assert.ok(raj.actions.some((a) => a.title === 'Summary emailed (demo)' && a.detail!.startsWith('To raj@kaur-lettings.example')));
  // Booked all at once: each with its own tenant told; the register shows them booked.
  const all = await raj.run('compliance', { action: 'book_all' });
  assert.equal(all.booked, true, JSON.stringify(all));
  assert.equal(all.jobs.length, 3);
  const certs = (await repo.listCertificates(t.id)).filter((c) => ['wharfside_flat_3_6', 'charnwood_19', 'hazelmere_flat_4_120'].includes(c.property_key) && c.expires! <= '2026-12-07');
  assert.ok(certs.length === 3 && certs.every((c) => c.booked_job), JSON.stringify(certs));
  for (const j of all.jobs) assert.ok(raj.sent.some((x) => x.body.includes(`Ref ${j.reference}`) && x.to !== '+447700900405'), `${j.what}: the tenant is texted`);
  assert.match(raj.sent.find((x) => x.to === '+447700900405')!.body, /^Fernhill Property Care: booked gas safety record/);
  // Asked again: nothing left due, all of it booked.
  const after = await raj.run('compliance', { action: 'portfolio' });
  assert.deepEqual([after.overdue, after.due_in_the_next_two_months, after.already_booked.length], [[], [], 3]);
});

test('the office notice: "emergencies only" gives no times and logs the rest for a call back; an emergency is still paged', async () => {
  const t = await fernhill('pm-storm');
  const office = await officeAction(repo, t, {}, { action: 'notice', text: 'Storm Ellen: emergencies only today', emergencies_only: true }, NOW);
  assert.match(office.message, /^Notice on: Storm Ellen/);
  const storm: Tenant = { ...t, profile: applyOffice(t.profile, office.office) };
  const c = await call(storm, '+447700900502');
  await c.run('find_property', { postcode: 'NG6', number: '120', street: 'Larchfield' });
  const tri = await c.run('triage_fault', { description: 'A few slates have slipped off the roof' });
  assert.deepEqual([tri.office_notice, /Only emergencies/.test(tri.today)], ['Storm Ellen: emergencies only today', true]);
  assert.deepEqual((await c.run('check_windows', { trade: 'roofing' })).windows, []);
  const logged = await c.run('job', { action: 'create', description: 'A few slates have slipped', name: 'Aisha Patel' });
  assert.equal(logged.logged_for_call_back, true, JSON.stringify(logged));
  const row = (await repo.listJobs(t.id, { reference: logged.reference }))[0];
  assert.deepEqual([row.status, row.visit_date, row.flags.includes('callback')], ['new', null, true]);
  assert.match(c.sent.at(-1)!.body, /Storm Ellen: emergencies only today\. We'll call you to book a time/);
  const found = await c.run('job', { action: 'find', reference: logged.reference });
  assert.equal(found.jobs[0].status, 'logged; the office will call to book a time');
  // Live, 8 October: taken as a message instead, the repair never reached the board. Now it is logged too.
  const sam = await call(storm, SAM);
  await sam.run('find_property', { postcode: 'NG5', number: '14', street: 'Elm Road' });
  const msg = await sam.run('take_message', { name: 'Sam Ortiz', message: 'Several slates have slipped on the roof after the wind. No water coming in.', category: 'job' });
  assert.equal(msg.taken, true);
  assert.ok(msg.job_logged, JSON.stringify(msg));
  const fromMsg = (await repo.listJobs(t.id, { reference: msg.job_logged }))[0];
  assert.deepEqual([fromMsg.property_key, fromMsg.status, fromMsg.flags.includes('callback')], ['elm_14', 'new', true]);
  // A burst pipe is still an emergency: paged, not logged.
  const burst = await call(storm, '+447700900503');
  await burst.run('find_property', { postcode: 'NG7', number: '89', street: 'Wrenbury' });
  burst.hear("A pipe has burst under the sink and it won't stop.");
  const e = await burst.run('job', { action: 'create', description: "Burst pipe under the sink, won't stop", name: 'Tom Mistry' });
  assert.deepEqual([e.booked, e.priority, e.logged_for_call_back], [true, 'emergency', undefined], JSON.stringify(e));
  // Taken down: back to normal.
  const clear = await officeAction(repo, t, office.office, { action: 'notice', text: '' }, NOW);
  assert.deepEqual([clear.message, clear.office.notice], ['Notice cleared.', null]);
});

test('an engineer off sick: no new visits, their jobs flagged to move, and a caller on one is offered a new time', async () => {
  const t = await fernhill('pm-absent');
  const jobs = await repo.listJobs(t.id);
  // Someone with a visit tomorrow.
  const tomorrow = '2026-10-08';
  const j = jobs.find((x) => x.status === 'scheduled' && x.visit_date === tomorrow && x.engineer_key && x.reporter.phone)!;
  const who = j.engineer_key!;
  const r = await officeAction(repo, t, {}, { action: 'absent', engineer: who, reason: 'sick', days: 2 }, NOW);
  assert.match(r.message, /is off sick until .*of their jobs need/);
  const sick: Tenant = { ...t, profile: applyOffice(t.profile, r.office) };
  const st = await maintenanceState(repo, sick, NOW);
  assert.ok(st.jobs.find((x) => x.reference === j.reference)!.engineer_off);
  assert.equal(st.engineers.find((e) => e.key === who)!.off!.reason, 'sick');
  // No window goes to them while they're off.
  const m = sick.profile.maintenance!;
  const until = r.office.absent![0].to;
  for (const f of freeWindows(m, jobs, { trade: j.trade, from: '2026-10-07', days: 2, limit: 20 }).filter((x) => x.date <= until)) assert.ok(!f.engineers.some((e) => e.key === who), `${f.date} ${f.window.key}`);
  // The caller on that job: sorry, and new times with someone else.
  const c = await call(sick, j.reporter.phone);
  const found = await c.run('job', { action: 'find', reference: j.reference });
  assert.match(found.jobs[0].status, /is off sick then, so it needs a new time/);
  assert.ok(found.jobs[0].new_time.windows.length, JSON.stringify(found.jobs[0]));
  // Our change costs them nothing more: no evening "£30 extra" (live, 8 October).
  assert.ok(found.jobs[0].new_time.windows.every((x: { say: string }) => !/extra/.test(x.say)), JSON.stringify(found.jobs[0].new_time));
  const w = found.jobs[0].new_time.windows[0];
  const moved = await c.run('job', { action: 'move', reference: j.reference, date: w.date, window: w.window });
  assert.equal(moved.moved ?? moved.booked ?? moved.done, true, JSON.stringify(moved));
  assert.doesNotMatch(moved.when, /extra/);
  assert.notEqual((await repo.listJobs(t.id, { reference: j.reference }))[0].engineer_key, who);
  // Back again.
  const back = await officeAction(repo, t, r.office, { action: 'back', engineer: who }, NOW);
  assert.deepEqual(back.office.absent, []);
});

test('how they want to hear from us: a relay call and "texts only" go on the job; the safety advice may be in their language, the number never', async () => {
  const t = await fernhill('pm-contact');
  const c = await call(t, '+447700900501');
  c.ctx.state.relay = true;
  await c.run('find_property', { postcode: 'NG5', number: '14', street: 'Elm Road' });
  c.hear("I'm deaf, so texts only please. The kitchen tap is dripping.");
  const r = await c.run('job', { action: 'create', description: 'Kitchen tap dripping', name: 'Sam Ortiz' });
  const ref = r.reference ?? (await c.run('job', { action: 'create', description: 'Kitchen tap dripping', name: 'Sam Ortiz', date: r.windows?.[0]?.date, window: r.windows?.[0]?.window })).reference;
  const row = (await repo.listJobs(t.id, { reference: ref }))[0];
  assert.ok(row.flags.includes('relay') && row.flags.includes('text_only'), row.flags.join());
  const advice = await (await call(t, '+447700900502')).run('safety_advice', { kind: 'gas' });
  assert.match(advice.other_language, /in their language, but say the number as digits, twice/);
});

test('safety: a "no" answering the last question never cancels the gas smell after it', () => {
  for (const line of ['No, I can smell gas in the kitchen', "No, it's not water, I can smell gas", "I don't know, I can smell gas"]) assert.equal(detectSafety(line), 'gas', line);
  for (const line of ["I can't smell gas", "There's no gas smell", 'Nothing smells of gas']) assert.equal(detectSafety(line), null, line);
});

test('safety: a carbon monoxide alarm is a chirp only when it is chirping, nobody is ill and the caller does not deny it', () => {
  assert.equal(detectSafety('The carbon monoxide alarm keeps beeping every few minutes and I feel dizzy since the boiler came on'), 'co');
  assert.equal(detectSafety("My carbon monoxide alarm is going off, it's not a low battery chirp, it's sounding non-stop"), 'co');
  assert.equal(detectSafety("The carbon monoxide alarm is going off, it's not the low battery"), 'co');
  assert.equal(detectSafety('The CO alarm beeps every minute, I think it is the low battery'), 'co_chirp');
});

test('safety: two emergencies on one call are both advised, the most urgent first', () => {
  const said = (state: { said: string[] }, words: string) => state.said.push(words);
  const gasAdvice = 'Please get everyone out now, leave the door open, and from outside ring the National Gas Emergency Service on 0800 111 999, that is 0800 111 999.';
  {
    // Gas and someone collapsed in one line: gas first, then 999 for the collapse.
    const state = { safety: null, safetyDone: [] as string[], heard: [] as string[], said: [] as string[] } as Parameters<typeof armSafety>[0];
    assert.equal(armSafety(state, "There's a strong smell of gas and my husband has collapsed"), 'gas');
    said(state, gasAdvice);
    assert.equal(noteAdvice(state, 'england')?.kind, 'gas');
    assert.equal(nextSafety(state), 'hurt', 'the collapse is owed next');
    said(state, 'Ring 999 for an ambulance now.');
    assert.equal(noteAdvice(state, 'england')?.kind, 'hurt');
    assert.equal(nextSafety(state), null);
  }
  {
    // Water on the lights, then gas: gas goes first; once everyone is out, the electrics advice is not owed.
    const state = { safety: null, safetyDone: [] as string[], heard: [] as string[], said: [] as string[] } as Parameters<typeof armSafety>[0];
    assert.equal(armSafety(state, 'Water is coming through the light fitting in the kitchen'), 'electric');
    assert.equal(armSafety(state, "And I can smell gas as well, it's really strong"), 'gas');
    said(state, gasAdvice);
    assert.equal(noteAdvice(state, 'england')?.kind, 'gas');
    assert.equal(nextSafety(state), null);
  }
});

test('safety: electrical danger is triaged as an emergency, not routine', async () => {
  const t = await fernhill('pm-electric-triage');
  const m = t.profile.maintenance!;
  const { triage } = await import('../src/core/maintenance-tools.ts');
  for (const line of ['Sparks are coming out of the socket in the kitchen', 'Water is dripping through the light fitting in the hall', "There's a smell of burning from the fuse box"]) {
    assert.equal(triage(m, line, { date: '2026-10-07' }).priority, 'emergency', line);
  }
  assert.equal(triage(m, 'Someone broke in and smashed the back door', { date: '2026-10-07' }).priority, 'emergency');
  assert.notEqual(triage(m, 'The cupboard handle broke in half', { date: '2026-10-07' }).priority, 'emergency');
});
