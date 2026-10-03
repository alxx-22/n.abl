// The estate agent's golden corpus (PRESETS.md §4): every value
// scripts/estate-goldens.ts recorded when the preset went live, recomputed
// now and compared in stored form. A difference means the estate agent
// changed. If that was meant, rerun the script and commit the changed
// goldens on their own, naming the change.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { CORPUS, GOLDEN_DIR, computeGoldens, goldenFiles, readCorpus } from '../scripts/estate-goldens.ts';
import { readJson } from '../scripts/goldens.ts';

let computed: Map<string, unknown> | null = null;
const goldens = () => (computed ??= computeGoldens());

const show = (v: unknown) => (v === undefined ? 'nothing' : JSON.stringify(v).slice(0, 200));

/** Where two stored values first part, as a path. */
function firstDifference(got: unknown, want: unknown, at = '$'): string {
  if (Array.isArray(got) && Array.isArray(want)) {
    for (let i = 0; i < Math.min(got.length, want.length); i++) {
      if (!isDeepStrictEqual(got[i], want[i])) return firstDifference(got[i], want[i], `${at}[${i}]`);
    }
    return `${at} has ${got.length} entries, recorded ${want.length}`;
  }
  if (got && want && typeof got === 'object' && typeof want === 'object') {
    const g = got as Record<string, unknown>;
    const w = want as Record<string, unknown>;
    for (const k of [...new Set([...Object.keys(w), ...Object.keys(g)])]) {
      if (!isDeepStrictEqual(g[k], w[k])) return firstDifference(g[k], w[k], `${at}.${k}`);
    }
  }
  return `${at} is ${show(got)}, recorded ${show(want)}`;
}

function check(prefix: string) {
  const paths = [...goldens().keys()].filter((p) => p === prefix || p.startsWith(`${prefix}/`));
  assert.ok(paths.length, `nothing recorded for ${prefix}`);
  for (const path of paths) {
    const want = readJson(join(GOLDEN_DIR, path));
    if (!isDeepStrictEqual(goldens().get(path), want)) assert.fail(`${path} no longer matches the recorded estate agent: ${firstDifference(goldens().get(path), want)}`);
  }
}

test('estate golden: the files on disk are exactly the ones the script makes', () => {
  assert.deepStrictEqual(goldenFiles(), [...goldens().keys()].sort());
});

test('estate golden: the corpus inputs are all there', () => {
  assert.deepStrictEqual(Object.keys(readCorpus()), [...CORPUS]);
});

test('estate golden: the defaults a new workspace starts from', () => check('defaults.json'));

for (const name of CORPUS) {
  test(`estate golden: ${name}: sanitise, validate, compile, preview, fact sheet, prompt, tools and back office${name === 'full' || name === 'as-created' ? ', seeded fortnights' : ''}`, () => check(name));
}

test('estate golden: what the FAQ draft asks the model', () => check('drafts'));
test('estate golden: the eval\'s Hartwell & Green: profile, prompt and tools', () => check('tenants/ea-hartwell'));

test('estate golden: the prompt at its very largest stays under 7,000 characters', () => {
  // The corpus's max has every list at its cap with distinct entries (twenty towns, thirty districts), which presets.test.ts's repeated defaults do not reach.
  const prompt = goldens().get('max/prompt.json') as Record<string, string[]>;
  for (const [channel, lines] of Object.entries(prompt)) assert.ok(lines.join('\n').length < 7000, `${channel}: ${lines.join('\n').length} characters`);
});
