// The property maintenance preset, M1 (presets/property-maintenance.md):
// its answers and defaults, the sanitiser, validation, and the nation pack
// with its fixed safety scripts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MT_NATIONS, defaultAnswers, type MaintenanceAnswers } from '../src/presets/maintenance/answers.ts';
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
  assert.deepEqual(issues((a) => (a.visits.windows[3].days = [])), ['warning visits: The saturday morning window has no days ticked, so it is never offered.']);
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
