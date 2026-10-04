// The builder's listings editor (web/src/reception/builder/estate/), as far
// as its rules can be driven without a browser.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleListings } from '../src/presets/estate/listings.ts';
import { setTenure } from '../web/src/reception/builder/estate/tenure.ts';

test("listings editor: a home's share, rent and provider survive a slip to another tenure and back", () => {
  const home = structuredClone(sampleListings().find((l) => l.tenure === 'shared_ownership')!);
  const shared = structuredClone(home.lease!.shared);
  assert.ok(shared && shared.provider, 'the sample has a shared-ownership home with a provider');
  setTenure(home, 'leasehold');
  setTenure(home, 'shared_ownership');
  assert.deepEqual(home.lease!.shared, shared);
  // A home that never had one starts from blanks, and its lease appears.
  const plain = structuredClone(sampleListings().find((l) => l.tenure === 'freehold' && !l.lease)!);
  setTenure(plain, 'shared_ownership');
  assert.equal(plain.lease!.shared!.share_percent, 50);
});
