// The preset framework itself: the parts kinds of business share, and the
// registry the server dispatches through (PRESETS.md §2).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleMenu } from '../src/presets/food/menu.ts';
import { defaultAnswers } from '../src/presets/restaurant/answers.ts';

test('presets: the sample menu is read once, and every caller gets its own copy', () => {
  const first = defaultAnswers();
  const pristine = JSON.stringify(defaultAnswers().menu);
  // A builder edits its answers in place; that must never reach the next workspace.
  first.menu.categories[0].items[0].name = 'Changed';
  first.menu.categories.pop();
  first.menu.modifier_groups = {};
  assert.equal(JSON.stringify(defaultAnswers().menu), pristine);
  const a = sampleMenu('tenants/lucas-trattoria.json');
  const b = sampleMenu('tenants/lucas-trattoria.json');
  assert.notEqual(a.categories, b.categories);
  assert.deepEqual(a, b);
  assert.equal(a.source, 'sample');
  assert.equal(a.allergens_are_examples, true);
});
