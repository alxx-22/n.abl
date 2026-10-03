// The builder's hours grid closes at midnight through a time box, which
// cannot hold '24:00' (web/src/reception/builder/common/closing.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitiseRestaurant, validateRestaurant } from '../src/presets/restaurant/validate.ts';
import { defaultAnswers } from '../src/presets/restaurant/answers.ts';
import { MIDNIGHT, savedClose, shownClose } from '../web/src/reception/builder/common/closing.ts';

test('hours grid: 00:00 as a closing time is saved as midnight, and shown as 00:00', () => {
  assert.equal(savedClose('00:00'), MIDNIGHT);
  assert.equal(savedClose('22:30'), '22:30');
  assert.equal(savedClose(''), '', 'a box being cleared is left to the server');
  assert.equal(shownClose(MIDNIGHT), '00:00');
  assert.equal(shownClose('22:30'), '22:30');
  for (const t of ['00:00', '00:15', '12:00', '23:45']) assert.equal(shownClose(savedClose(t)), t);
});

test('hours grid: a Friday closing at midnight, as the grid saves it, is kept and passes', () => {
  const a = defaultAnswers();
  a.basics.name = 'Casa Ana';
  const friday = a.hours.days[5];
  friday.services[friday.services.length - 1].close = savedClose('00:00');
  const clean = sanitiseRestaurant(JSON.parse(JSON.stringify(a)));
  assert.equal(clean.hours.days[5].services.at(-1)!.close, MIDNIGHT);
  assert.deepEqual(validateRestaurant(clean).filter((x) => x.step === 'hours' && x.level === 'error'), []);
});
