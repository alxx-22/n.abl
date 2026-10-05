// The property maintenance preset, M1 (presets/property-maintenance.md):
// its answers and defaults, the sanitiser, validation, the nation pack with
// its fixed safety scripts, the compiled profile, the builder's preview and
// the back office.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capabilities } from '../src/core/prompt.ts';
import { builtPreset, getPreset } from '../src/presets/index.ts';
import { MT_NATIONS, defaultAnswers, type MaintenanceAnswers } from '../src/presets/maintenance/answers.ts';
import { DUTY_MANAGER_KEY, areaSentence, compileMaintenance, districtRuns, money } from '../src/presets/maintenance/compile.ts';
import { factSheet, maintenancePreview, maintenanceWorkspace } from '../src/presets/maintenance/preset.ts';
import { fullAddress, sampleProperties, shortAddress } from '../src/presets/maintenance/properties.ts';
import { MT_NATION_PACKS, SAFETY_KINDS, gasFact, nationKnowledge, safetyScript, safetyScripts } from '../src/presets/maintenance/nations.ts';
import { sanitiseMaintenance } from '../src/presets/maintenance/sanitise.ts';
import { STEPS } from '../src/presets/maintenance/steps.ts';
import { validateMaintenance } from '../src/presets/maintenance/validate.ts';

const named = (): MaintenanceAnswers => {
  const a = defaultAnswers();
  a.basics.name = 'Fernhill Property Care';
  return a;
};

test('property maintenance: the defaults are Fernhill, in Nottingham, Derby and Loughborough, ready to start', () => {
  const a = sanitiseMaintenance(named());
  assert.deepEqual(validateMaintenance(a), [], 'the defaults and a name are ready to start, with nothing to warn about');
  assert.deepEqual(sanitiseMaintenance(structuredClone(a)), a, 'stable');
  assert.equal(a.area.nation, 'england');
  assert.ok(['NG5', 'DE22', 'LE11'].every((d) => a.area.districts.includes(d)));
  assert.deepEqual(a.area.towns.slice(0, 3), ['Nottingham', 'Derby', 'Loughborough']);
  assert.equal(a.engineers.length, 8);
  assert.equal(a.engineers.filter((e) => e.gas_safe).length, 2);
  assert.equal(a.trades.length, 11);
  // A Gas Safe engineer every night, paired with an electrician or a locksmith.
  for (const n of a.on_call.nights) {
    const on = n.engineers.map((k) => a.engineers.find((e) => e.key === k)!);
    assert.ok(on.some((e) => e.gas_safe), `night ${n.day}`);
    assert.ok(on.some((e) => e.trades.includes('electrical') || e.trades.includes('locksmith')), `night ${n.day}`);
  }
  // Invented, and said so: sample clients and Gas Safe numbers are examples; numbers are in Ofcom's drama range.
  assert.ok(a.clients.every((c) => c.example));
  assert.ok(a.engineers.filter((e) => e.gas_safe).every((e) => e.gas_safe.endsWith('(example)')));
  assert.ok([...a.engineers.map((e) => e.mobile), ...a.clients.map((c) => c.contact.phone)].every((p) => p.startsWith('07700 900')));
  assert.match(a.basics.address, /\(example\)$/);
});

test('property maintenance: the sanitiser bounds hostile input and is stable', () => {
  const a = sanitiseMaintenance({
    area: { nation: 'mars', districts: ['ng 5', 'NG5', 'nope', 7], towns: ['  Beeston ', ''] },
    trades: [{ key: 'gas_heating', label: 'Boilers', on: true, gas: false }, { label: 'Ponds', gas: true }, null],
    engineers: [{ name: 'Dan Hughes', trades: ['gas_heating', 'magic'], days: [1, 9, 1, 'x', 3], districts: ['NG5', 'DE1'], per_window: 40 }, { name: 'Dan Lee' }],
    clients: [{ name: 'Harbour Lettings', kind: 'bank', works_limit_pence: -5, notice: 'shout' }, { name: 'Harbour Lettings' }],
    on_call: { nights: [{ day: 2, engineers: ['dan', 'ghost'] }], escalate_minutes: 9999 },
    priorities: { emergency: { attend_hours: 0 }, routine: { working_days: 'lots' } },
    visits: { windows: [{ label: 'Morning', from: '25:00', to: '12:00', days: [8, 1] }], notice_hours: -1 },
    prices: { callout_pence: 1e12, vat_registered: 'yes' },
  });
  assert.equal(a.area.nation, 'england');
  assert.deepEqual(a.area.districts, ['NG5']);
  assert.deepEqual(a.area.towns, ['Beeston']);
  assert.deepEqual(a.trades.map((t) => [t.key, t.label, t.gas ?? false]), [['gas_heating', 'Boilers', true], ['ponds', 'Ponds', false]], 'only a standard trade is gas work');
  assert.deepEqual(a.engineers.map((e) => [e.key, e.trades.join(), e.days.join(), e.districts.join(), e.per_window]), [['dan', 'gas_heating', '1,3', 'NG5', 6], ['dan_2', '', '', '', 2]]);
  assert.deepEqual(a.clients.map((c) => [c.key, c.kind, c.works_limit_pence, c.notice, c.example]), [['harbour_lettings', 'landlord', 0, 'over_limit', false], ['harbour_lettings_2', 'landlord', 0, 'over_limit', false]]);
  assert.deepEqual(a.on_call.nights.map((n) => n.engineers.join()), ['', '', 'dan', '', '', '', ''], 'only engineers who exist');
  assert.equal(a.on_call.escalate_minutes, 60);
  assert.equal(a.priorities.emergency.attend_hours, 1);
  assert.equal(a.priorities.routine.working_days, 20);
  assert.deepEqual(a.visits.windows, [{ key: 'morning', label: 'Morning', from: '08:00', to: '12:00', premium_pence: 0, days: [1] }]);
  assert.equal(a.visits.notice_hours, 0);
  assert.equal(a.prices.callout_pence, 1_000_000);
  assert.equal(a.prices.vat_registered, true);
  assert.deepEqual(sanitiseMaintenance(structuredClone(a)), a, 'stable');
  // Nothing at all: the defaults' engineers and trades, as a missing week of hours gets the defaults'.
  const blank = sanitiseMaintenance({});
  assert.equal(blank.engineers.length, 8);
  assert.equal(blank.trades.length, 11);
  assert.deepEqual(sanitiseMaintenance({ clients: [] }).clients, [], 'an emptied client list stays empty');
});

test('property maintenance: validation says what is missing, on the step it belongs to', () => {
  const issues = (edit: (a: MaintenanceAnswers) => void) => {
    const a = named();
    edit(a);
    return validateMaintenance(sanitiseMaintenance(a)).map((i) => `${i.level} ${i.step}: ${i.message}`);
  };
  const engineer = (a: MaintenanceAnswers, key: string) => a.engineers.find((e) => e.key === key)!;
  assert.deepEqual(issues((a) => (a.area.districts = [])), ['error area: Add at least one postcode district you cover.']);
  assert.deepEqual(issues((a) => a.trades.forEach((t) => (t.on = false))), ['error trades: Turn on at least one trade.']);
  assert.deepEqual(issues((a) => (engineer(a, 'tom').days = [])), ['error engineers: No engineer does roofs and gutters: add one, or turn it off.', 'error engineers: Tom Reilly works no days: pick at least one.']);
  assert.deepEqual(issues((a) => (engineer(a, 'tom').trades = [])), ['error engineers: No engineer does roofs and gutters: add one, or turn it off.', 'warning engineers: Tom Reilly has no trades, so is never booked.']);
  // Only a Gas Safe registered engineer may do gas work.
  assert.deepEqual(issues((a) => engineer(a, 'marek').trades.push('gas_heating')), ['error engineers: Marek Nowak is down for gas work: add their Gas Safe number, or take the gas trades off.']);
  assert.deepEqual(issues((a) => (engineer(a, 'callum').gas_safe = '')), [
    'error engineers: Boiler servicing and gas safety records is gas work: it needs an engineer with a Gas Safe number.',
    'error engineers: Callum Price is down for gas work: add their Gas Safe number, or take the gas trades off.',
    'error engineers: Sunday night: put a Gas Safe engineer on call.',
    'error engineers: Tuesday night: put a Gas Safe engineer on call.',
    'error engineers: Thursday night: put a Gas Safe engineer on call.',
    'error engineers: Saturday night: put a Gas Safe engineer on call.',
  ]);
  assert.deepEqual(issues((a) => (a.on_call.nights[3].engineers = ['priya'])), ['error engineers: Wednesday night: put a Gas Safe engineer on call.']);
  assert.deepEqual(issues((a) => {
    a.trades.forEach((t) => (t.on = !t.gas));
    a.on_call.nights[3].engineers = [];
  }), ['warning engineers: Nobody is on call on Wednesday night.'], 'with no gas work, a night off is only a warning');
  assert.deepEqual(issues((a) => (a.on_call.duty_manager.mobile = '')), ["warning engineers: Add the duty manager's name and mobile, for emergencies nobody accepts."]);
  assert.deepEqual(issues((a) => (a.clients[0].contact.phone = '')), ['error customers: Harbour Lettings: add the contact who approves work, with their phone.']);
  assert.deepEqual(issues((a) => (a.clients[1].status = 'on_stop')), ["warning customers: Castle Gate Residential is on stop: the receptionist won't book work for them."]);
  assert.deepEqual(issues((a) => Object.assign(a.customers, { homeowners: false, landlords: false, agents: false })), ['error customers: Choose at least one kind of customer.']);
  assert.deepEqual(issues((a) => (a.customers.social.on = true)), ["warning customers: Social housing is on, but you haven't said you act as the landlord's agent, so damp and mould clocks are the landlord's to start."]);
  assert.deepEqual(issues((a) => (a.priorities.routine.working_days = 3)), ['error priorities: The urgent target must be shorter than the routine one.']);
  assert.deepEqual(issues((a) => Object.assign(a.priorities.emergency, { attend_hours: 24 }) && (a.priorities.urgent.working_days = 1)), ['error priorities: The emergency target must be shorter than the urgent one.']);
  assert.deepEqual(issues((a) => (a.visits.windows[0].to = '13:00')), ['error visits: The morning and afternoon windows overlap on Monday.']);
  assert.deepEqual(issues((a) => (a.visits.windows[2].to = '16:00')), ['error visits: The evening window ends before it starts.']);
  // An all-day window holds the morning and the afternoon: that is not an overlap.
  assert.deepEqual(issues((a) => a.visits.windows.push({ key: 'all_day', label: 'All day', from: '08:00', to: '17:00', premium_pence: 0, days: [1, 2, 3, 4, 5] })), []);
  assert.deepEqual(issues((a) => (a.visits.windows[3].days = [])), ['warning visits: The Saturday morning window has no days ticked, so it is never offered.']);
  assert.deepEqual(issues((a) => (a.visits.windows = [])), ['error visits: Add at least one visit window.']);
  assert.deepEqual(issues((a) => (a.hours.days.forEach((d) => (d.open = false)))), ['error visits: Open on at least one day.'], 'office hours sit on the Visits step');
  assert.deepEqual(issues((a) => (a.prices.vat_registered = false)), ["warning prices: You're not VAT registered, so callers hear your prices as they are, with no VAT."]);
  assert.deepEqual(issues((a) => (a.planned.reminder_weeks = 10)), ["warning planned: Reminders more than 8 weeks ahead invite gas safety checks booked over 2 months early, which lose the record's date."]);
  assert.deepEqual(issues((a) => (a.dont_do[0].suggest = '')), ['warning trades: Say who to suggest for pest control.']);
  assert.deepEqual(issues((a) => a.policies.faqs.push({ q: 'Do you do gutters?', a: '' })), ['warning policies: 1 question needs both the question and its answer before the receptionist can use it.']);
  const steps = new Set<string>(STEPS.map((s) => s.key));
  for (const i of validateMaintenance(sanitiseMaintenance({ engineers: [{}], clients: [{ po_required: true }], area: { districts: [] }, visits: { windows: [] }, hours: { days: [] } }))) assert.ok(steps.has(i.step), i.step);
});

test('property maintenance: the nation pack and the fixed safety scripts', () => {
  for (const n of MT_NATIONS) {
    const p = MT_NATION_PACKS[n];
    const scripts = safetyScripts(n);
    assert.deepEqual(scripts.map((s) => s.kind), [...SAFETY_KINDS], n);
    for (const s of scripts) assert.ok(s.steps.length >= 2 && s.title && s.next, `${n} ${s.kind}`);
    // The gas number is said in the script, kept by text, and is the core fact.
    const gas = safetyScript('gas', n);
    assert.equal(gas.number, p.gas.number);
    assert.ok(gas.steps.at(-1)!.includes(p.gas.number));
    assert.ok(gas.text!.includes(p.gas.number));
    assert.match(gas.steps[0], /^Get everyone out/, 'getting out comes first');
    assert.ok(gasFact(n).includes(p.gas.number));
    assert.ok(nationKnowledge(n).every((k) => k.q && k.a && k.tags.length));
  }
  assert.equal(MT_NATION_PACKS.england.gas.number, '0800 111 999');
  assert.equal(MT_NATION_PACKS.scotland.gas.number, '0800 111 999');
  assert.equal(MT_NATION_PACKS.northern_ireland.gas.number, '0800 002 001');
  assert.equal(safetyScript('gas', 'england').text, "National Gas Emergency Service: 0800 111 999. Leave the property, then ring from outside. Once it's made safe, call us to book a Gas Safe repair.");
  assert.match(safetyScript('co', 'northern_ireland').steps.join(' '), /0800 002 001.*out-of-hours GP/);
  // Great Britain's early renewal keeps the record's date; Northern Ireland's rules don't say so.
  assert.match(MT_NATION_PACKS.wales.gasRecord, /10 months/);
  assert.doesNotMatch(MT_NATION_PACKS.northern_ireland.gasRecord, /10 months/);
  assert.match(nationKnowledge('scotland').find((k) => k.tags.includes('fraud'))!.a, /Police Scotland on 101/);
});

const compile = (a: MaintenanceAnswers) => compileMaintenance(sanitiseMaintenance(structuredClone(a)), { slug: 'fernhill' });
/** Wednesday 7 October 2026, 11am. */
const WEDNESDAY = new Date('2026-10-07T10:00:00Z');

test('property maintenance: the defaults compile to a working contractor, with no table or appointment tools', () => {
  const p = compile(named());
  assert.equal(p.business_type, 'property_maintenance');
  assert.equal(p.booking, undefined, 'jobs are booked into windows by the maintenance tools, never as tables or appointments');
  assert.deepEqual(capabilities(p), { booking: false, ordering: false, payments: false });
  assert.deepEqual(p.core_facts, [
    'Fernhill Property Care: Repairs and maintenance for homes, landlords and letting agents, at Unit 4, Fernhill Trade Park, Nottingham NG7 (example).',
    'Monday to Friday: 8am till 5:30pm. Saturday: 9am till 12 noon. Closed Sundays.',
    'We cover Nottingham, Derby, Loughborough, Beeston and 2 more towns: NG1 to NG11, DE1 to DE3, DE21 to DE24 and LE11.',
    'Emergencies, day and night: we aim to attend within 4 hours and make safe within 24.',
    'Call-out £95 including VAT, with the first hour, then £40 a half hour. Nights and weekends: £150 for the first hour.',
    'Gas emergency: the National Gas Emergency Service, 0800 111 999.',
  ]);
  const m = p.maintenance!;
  assert.equal(m.gas, '0800 111 999');
  assert.equal(m.trades.length, 11);
  assert.deepEqual(m.trades.filter((t) => t.gas).map((t) => t.key), ['gas_heating', 'boiler_servicing']);
  assert.deepEqual(m.engineers.filter((e) => e.gas_safe).map((e) => e.first_name), ['Dan', 'Callum']);
  assert.deepEqual(m.engineers.find((e) => e.key === 'priya')!.accreditations, ['NICEIC']);
  assert.deepEqual(m.engineers.find((e) => e.key === 'dan')!.accreditations, ['Gas Safe 512345 (example)']);
  // The authoriser's number recognises them calling in, in the form a caller's number arrives.
  assert.equal(m.clients.find((c) => c.key === 'harbour')!.contact.phone, '+447700900401');
  assert.deepEqual(p.team!.map((t) => t.key), ['dan', 'callum', 'marek', 'priya', 'tom', 'shaz', 'leon', 'grace', DUTY_MANAGER_KEY]);
  assert.equal(p.team!.at(-1)!.first_name, 'Helen');
  const answer = (q: string) => p.knowledge.find((k) => k.q === q)?.a;
  assert.equal(answer('Do you do pest control?'), "We don't do pest control, sorry. Try the council's pest service, or a member of the British Pest Control Association.");
  assert.match(answer('What work do you do?')!, /^We do gas, boilers and heating; .*electrics, EICRs and PAT; .*; and damp and mould\.$/);
  assert.match(answer('How much is a lockout?')!, /£120 including VAT.*for them to decide/);
  assert.equal(answer('How much is a gas safety certificate?'), "A landlord's gas safety record is £75 including VAT for one appliance, plus £15 for each extra one. A boiler service is £85, or £130 for both on one visit.");
  assert.match(answer('Are you Gas Safe registered?')!, /number 512345 \(example\).*NICEIC/);
  assert.match(answer('Could there be asbestos?')!, /The HSE's asbestos guidance explains more\.$/);
  assert.match(answer('How often does a landlord need a gas safety check?')!, /10 months/);
  // A window with no days is never offered, so it isn't compiled.
  const a = named();
  a.visits.windows[3].days = [];
  assert.deepEqual(compile(a).maintenance!.windows.map((w) => w.key), ['am', 'pm', 'evening']);
  // Not VAT registered: prices are said as they are.
  a.prices.vat_registered = false;
  assert.doesNotMatch(compile(a).core_facts.join(' '), /VAT/);
});

test('property maintenance: districts and towns said the way people say them', () => {
  assert.deepEqual(districtRuns(['NG1', 'NG2', 'NG3', 'NG7', 'NG8', 'DE21', 'LE11', 'LE12', 'LE13']), ['NG1 to NG3', 'NG7', 'NG8', 'DE21', 'LE11 to LE13']);
  const a = named();
  assert.equal(areaSentence(a), 'We cover Nottingham, Derby, Loughborough, Beeston, West Bridgford and Long Eaton: NG1 to NG11, DE1 to DE3, DE21 to DE24 and LE11.');
  a.area.towns = [];
  assert.equal(areaSentence(a, 2), 'We cover NG1 to NG11, DE1 to DE3 and 2 more.');
  assert.equal(money(9500), '£95');
  assert.equal(money(1_234_550), '£12,345.50');
});

test("property maintenance: the builder's preview, the fact sheet and the back office", () => {
  const a = sanitiseMaintenance(named());
  const p = compileMaintenance(a, { slug: 'fernhill' });
  assert.deepEqual(maintenancePreview(a, p, WEDNESDAY).lines, [
    "Hello, you're through to Fernhill Property Care. I'm the AI assistant on this demo line. How can I help?",
    '8 engineers, 2 Gas Safe; on call tonight: Dan and Leon.',
    'Windows: morning 8am to 12 noon, afternoon 12 noon to 5pm, evening 5pm to 8pm (£30 extra) and Saturday morning 9am to 12 noon.',
    'Emergencies, day and night: we aim to attend within 4 hours and make safe within 24.',
    'Call-out £95 including VAT, with the first hour, then £40 a half hour. Nights and weekends: £150 for the first hour.',
    "A smell of gas: Get everyone out of the property now. Open doors and windows on the way out, if it's safe to. Don't use any switches, plugs or anything with a flame, and don't smoke. Turn the gas off at the meter, if it's safe to reach. Ring the National Gas Emergency Service on 0800 111 999 from outside.",
  ]);
  // Thursday: Callum and Priya.
  assert.equal(maintenancePreview(a, p, new Date('2026-10-08T10:00:00Z')).lines[1], '8 engineers, 2 Gas Safe; on call tonight: Callum and Priya.');
  // The FAQ draft hears the business, never its clients, properties or anyone's number.
  const sheet = factSheet(a);
  assert.match(sheet, /NG1 to NG11/);
  for (const never of ['Harbour', 'Ellis', '07700', 'Elm Road', 'Q-2291']) assert.ok(!sheet.includes(never), never);
  const spec = maintenanceWorkspace(p);
  assert.deepEqual(spec.views.map((v) => v.id), ['jobs', 'dispatch', 'compliance', 'safety', 'messages', 'calls']);
  assert.equal(spec.teamPhones!.length, 9, 'every engineer and the duty manager');
  assert.equal(spec.resetLine, 'jobs, safety checks and incidents');
  // Built, but not offered to prospects until its back office and builder are in the web.
  assert.ok(builtPreset('property_maintenance'));
  assert.equal(getPreset('property_maintenance'), null);
});

test('property maintenance: the sample properties are invented, inside the patch, and never hold a code', () => {
  const a = defaultAnswers();
  const props = sampleProperties();
  assert.equal(props.length, 70);
  assert.equal(new Set(props.map((p) => p.key)).size, 70, 'each key once');
  assert.equal(new Set(props.map((p) => `${p.number}|${p.street}`)).size, 70, 'each address once');
  const clients = new Set(a.clients.map((c) => c.key));
  for (const p of props) {
    assert.ok(a.area.districts.includes(p.district), `${p.key}: ${p.district} is in the patch`);
    assert.ok(p.client === null || clients.has(p.client), `${p.key}: ${p.client} is a sample client`);
    assert.match(p.occupant.phone!, /^\+447700900\d{3}$/, `${p.key}: a number in Ofcom's drama range`);
    assert.ok(p.example);
    assert.match(shortAddress(p), /\(example\), [A-Z]{2}\d+$/);
    // A key safe's code is never stored, in any form.
    assert.doesNotMatch(JSON.stringify(p.access), /\d{3,}/, `${p.key}: no code`);
  }
  assert.equal(props.filter((p) => p.access.method === 'key_safe').length, 9);
  assert.equal(props.filter((p) => p.client === null).length, 26, 'homeowners');
  // The homes the signature moments lean on.
  const elm = props.find((p) => p.key === 'elm_14')!;
  assert.equal(fullAddress(elm), '14 Elm Road (example), Nottingham NG5');
  assert.deepEqual([elm.client, elm.occupant.name, elm.notes.stopcock, elm.gas], ['whitfield', 'Sam Ortiz', 'under the kitchen sink', true]);
  assert.equal(shortAddress(props.find((p) => p.client === 'ellis')!), 'Flat 3, 22 Tansy Lane (example), NG2');
  assert.ok(props.some((p) => p.client === 'harbour' && p.notes.stopcock === 'under the kitchen sink'));
  assert.ok(props.filter((p) => p.vulnerable.length).length >= 3);
  // A fresh copy every time: a seed that edits one cannot change the next.
  props[0].street = 'Changed';
  assert.equal(sampleProperties()[0].street, 'Elm Road');
});
