// The restaurant's baseline (PRESETS.md §0, step 1): every value
// scripts/restaurant-goldens.ts recorded from the code as it was before the
// preset refactor, recomputed now and compared in stored form. A difference
// means the restaurant changed. If that was meant, rerun the script and
// commit the changed goldens on their own, naming the change.
//
// Every recorded function is whole: none reads the clock or Math.random
// itself (Start and the call do, and pass the result in), so the script
// passes fixed times (October 2026, Europe/London) and fixed seeds, and runs
// everything with the clock and Math.random refused. This test calls the
// same code, so it pins them the same way.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { CORPUS, GOLDEN_DIR, computeGoldens, goldenFiles, readCorpus, readJson } from '../scripts/restaurant-goldens.ts';

let computed: Map<string, unknown> | null = null;
const goldens = () => (computed ??= computeGoldens());

const show = (v: unknown) => (v === undefined ? 'nothing' : JSON.stringify(v).slice(0, 200));

/** Where two stored values first part, as a path: a whole-file diff of the max corpus is megabytes. */
function firstDifference(got: unknown, want: unknown, at = '$'): string {
  if (Array.isArray(got) && Array.isArray(want)) {
    for (let i = 0; i < Math.min(got.length, want.length); i++) {
      if (!isDeepStrictEqual(got[i], want[i])) return firstDifference(got[i], want[i], `${at}[${i}]`);
    }
    return `${at} has ${got.length} entries, recorded ${want.length}`;
  }
  if (got && want && typeof got === 'object' && typeof want === 'object' && !Array.isArray(got) && !Array.isArray(want)) {
    const g = got as Record<string, unknown>;
    const w = want as Record<string, unknown>;
    for (const k of [...new Set([...Object.keys(w), ...Object.keys(g)])]) {
      if (!isDeepStrictEqual(g[k], w[k])) return firstDifference(g[k], w[k], `${at}.${k}`);
    }
  }
  return `${at} is ${show(got)}, recorded ${show(want)}`;
}

/** Compares every golden under one folder (or one file) with what the code gives now. */
function check(prefix: string) {
  const paths = [...goldens().keys()].filter((p) => p === prefix || p.startsWith(`${prefix}/`));
  assert.ok(paths.length, `nothing recorded for ${prefix}`);
  for (const path of paths) {
    const got = goldens().get(path);
    const want = readJson(join(GOLDEN_DIR, path));
    // Both sides are JSON.parse output, so key order is free and array order counts.
    if (!isDeepStrictEqual(got, want)) assert.fail(`${path} no longer matches the recorded restaurant: ${firstDifference(got, want)}`);
  }
}

test('restaurant golden: the files on disk are exactly the ones the script makes', () => {
  assert.deepStrictEqual(goldenFiles(), [...goldens().keys()].sort());
});

test('restaurant golden: the corpus inputs are all there', () => {
  // The inputs are frozen files, not rebuilt here: a change to the defaults
  // must show as a changed golden (defaults.json, as-created), never as a
  // quietly changed input.
  assert.deepStrictEqual(Object.keys(readCorpus()), [...CORPUS]);
});

test('restaurant golden: the defaults a new workspace starts from', () => check('defaults.json'));

for (const name of CORPUS) {
  test(`restaurant golden: ${name}: sanitise, validate, compile, preview, fact sheet, prompt and tools${name === 'full' || name === 'as-created' ? ', seeded weeks' : ''}`, () => check(name));
}

test('restaurant golden: a frozen website scan applied to a new workspace, and the scout card', () => check('scan'));
test('restaurant golden: a canned menu draft into builder answers', () => check('menu-draft'));
test('restaurant golden: what the menu and FAQ drafts ask the model', () => check('drafts'));

for (const slug of ['lucas-trattoria', 'copper-kettle', 'olive-ember', 'olive-collect']) {
  test(`restaurant golden: ${slug}: prompt and tools`, () => check(`tenants/${slug}`));
}
