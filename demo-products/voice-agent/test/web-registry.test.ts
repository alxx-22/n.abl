// The web's two registries, the builders and the back office's views,
// against the server's presets: a kind of business a prospect can pick must
// have a builder with the server's very steps, and a view for every tab its
// workspace spec lists. The web's files are TSX, which Node cannot run, so
// they are loaded through Vite, as the browser gets them.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import { PRESETS, builtPreset } from '../src/presets/index.ts';

let vite: ViteDevServer;
let builderFor: (key: string) => { steps: readonly { key: string; label: string }[] } | null;
let VIEWS: Record<string, unknown>;

before(async () => {
  vite = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('../web', import.meta.url)),
    base: '/demo/',
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  ({ builderFor } = await vite.ssrLoadModule('/src/reception/builder/registry.ts'));
  ({ VIEWS } = await vite.ssrLoadModule('/src/reception/workspace/views.tsx'));
});

after(async () => {
  await vite?.close();
});

test('web registries: every kind of business a prospect can pick has its builder and its views', () => {
  let checked = 0;
  for (const info of PRESETS) {
    const preset = builtPreset(info.key);
    if (!preset) continue;
    const builder = builderFor(info.key);
    // A preset is built on the server before its web parts exist, and only
    // turns live once they do, so a coming-soon one may still lack them.
    const live = info.status === 'live';
    if (live) assert.ok(builder, `${info.key} is live but has no builder`);
    if (builder) assert.deepEqual(builder.steps, preset.steps, `${info.key}: the builder's steps are the server's`);
    const a = preset.defaults();
    a.basics.name = 'Registry check';
    const views = preset.workspace(preset.compile(preset.sanitise(a), { slug: 'registry-check' })).views;
    if (live) for (const v of views) assert.ok(Object.hasOwn(VIEWS, v.id), `${info.key}: no view for the tab "${v.id}"`);
    checked++;
  }
  assert.ok(checked > 0);
  assert.equal(builderFor('nonsense'), null);
});
