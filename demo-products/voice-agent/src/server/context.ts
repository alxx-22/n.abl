// What every route handler needs.

import type { Config } from '../config.ts';
import type { Repo } from '../db/repo.ts';
import type { DemoRepo } from '../db/demo-repo.ts';
import type { Bus } from './bus.ts';
import type { SmsSender } from '../core/tools.ts';
import type { KeyStatus } from '../core/gemini.ts';

export interface Ctx {
  config: Config;
  repo: Repo;
  demo: DemoRepo;
  bus: Bus;
  sms: SmsSender;
  maxCalls: number;
  keyStatus: () => KeyStatus;
}
