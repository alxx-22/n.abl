// What every route handler needs.

import type { Config } from '../config.ts';
import type { Repo } from '../db/repo.ts';
import type { DemoRepo } from '../db/demo-repo.ts';
import type { Bus } from './bus.ts';
import type { SmsSender } from '../core/tools.ts';
import type { KeyStatus } from '../core/gemini.ts';
import type { ScanDeps } from '../scout/scan.ts';

export interface Ctx {
  config: Config;
  repo: Repo;
  demo: DemoRepo;
  bus: Bus;
  sms: SmsSender;
  maxCalls: number;
  keyStatus: () => KeyStatus;
  /** Tests only (never from config): let the scout read a local site, with a stand-in model. */
  scoutTest?: Pick<ScanDeps, 'allowPrivate' | 'model' | 'paceMs'>;
}
