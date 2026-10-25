// Deletes what the demo service should no longer keep, once a minute:
//
//   - shared keys' demos an hour after Start (or a draft two hours after it
//     was begun), with every booking, order, call, transcript and text they
//     generated;
//   - private keys' demos 30 days after the key expired or was switched off.
//
// A demo with a call still on is left until the call ends: the call's own
// time limit is set to end it by the demo's deletion time.

import type { DemoRepo } from '../db/demo-repo.ts';
import type { Bus } from '../server/bus.ts';
import { PRIVATE_RETENTION_DAYS } from './access.ts';

export async function sweep(deps: { demo: DemoRepo; bus: Bus }): Promise<string[]> {
  const deleted: string[] = [];
  for (const w of await deps.demo.workspacesDue(PRIVATE_RETENTION_DAYS)) {
    if (deps.bus.activeFor(w.id).length) continue;
    await deps.demo.deleteWorkspace(w.id);
    // Any page still open on it learns at once that it has gone.
    deps.bus.publish({ type: 'refresh', tenant_id: w.id, call_id: '', at: new Date().toISOString(), reason: 'deleted' });
    deleted.push(w.id);
  }
  return deleted;
}

export function startSweeper(deps: { demo: DemoRepo; bus: Bus }, everyMs = 60_000): () => void {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const gone = await sweep(deps);
      if (gone.length) console.log(`demo sweeper: deleted ${gone.length} demo${gone.length > 1 ? 's' : ''}`);
    } catch (err) {
      console.error(`demo sweeper: ${(err as Error).message}`);
    } finally {
      running = false;
    }
  };
  void run();
  const t = setInterval(() => void run(), everyMs);
  return () => clearInterval(t);
}
