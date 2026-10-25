// The web names a demo by its kind of business's noun from the catalogue,
// never its label lowercased (PRESETS.md §2.3).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS } from '../src/presets/catalogue.ts';
import { unnamed, untitled } from '../web/src/reception/nouns.ts';

test('web copy: an unnamed demo is called by its noun', () => {
  assert.equal(untitled('restaurant'), 'Untitled restaurant');
  assert.equal(unnamed('restaurant'), 'New restaurant');
  assert.equal(untitled('barber'), 'Untitled barber shop');
  assert.equal(unnamed('takeaway'), 'New takeaway', 'not "takeaway and fast food"');
  assert.equal(untitled('no-such-kind'), 'Untitled demo');
  for (const p of PRESETS) {
    assert.match(p.noun, /^[a-zé ]+$/, `${p.key}: a lowercase noun`);
    assert.match(p.example, /^https:\/\/www\.your-[a-z-]+\.co\.uk$/, `${p.key}: a placeholder website`);
  }
});
