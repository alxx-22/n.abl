// The demo under nabl.agency/demo wears the site's design: its tokens are a
// copy of the site's (web/src/tokens.css), and this fails when they drift.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const here = import.meta.dirname;
const SITE = join(here, '..', '..', '..', 'src', 'styles', 'tokens.css');
const DEMO = join(here, '..', 'web', 'src', 'tokens.css');

/** Every custom property declared in the first :root block, by name. */
function tokens(css: string): Map<string, string> {
  const root = /:root\s*{([\s\S]*?)\n}/.exec(css)?.[1] ?? '';
  const out = new Map<string, string>();
  for (const m of root.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) out.set(m[1], m[2].trim().replace(/\s+/g, ' '));
  return out;
}

test('design: the demo uses the site\'s design tokens, unchanged', { skip: !existsSync(SITE) && 'the site is not checked out beside the demo' }, () => {
  const site = tokens(readFileSync(SITE, 'utf8'));
  const demo = tokens(readFileSync(DEMO, 'utf8'));
  assert.ok(site.size > 40, `only ${site.size} tokens read from the site`);
  for (const [k, v] of site) assert.equal(demo.get(k), v, `${k} is ${v} on the site but ${demo.get(k) ?? 'missing'} in the demo: copy src/styles/tokens.css into web/src/tokens.css`);
  for (const k of demo.keys()) assert.ok(site.has(k), `${k} is in the demo's tokens but not the site's`);
});

test('design: the fonts are the site\'s own, served from the demo', () => {
  const css = readFileSync(join(here, '..', 'web', 'src', 'fonts.css'), 'utf8');
  for (const m of css.matchAll(/url\(([^)]+)\)/g)) {
    assert.match(m[1], /^\.\/fonts\/[A-Za-z-]+\.woff2$/, `${m[1]}: fonts load from the demo itself, never a font service`);
    assert.ok(existsSync(join(here, '..', 'web', 'src', m[1])), `${m[1]} is missing`);
  }
});
