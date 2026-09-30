// The preset registry: what the server needs from each kind of business.
// Only the restaurant is built; the catalogue lists the rest as coming soon.

import type { TenantProfile } from '../domain/types.ts';
import { PRESETS, presetInfo, type PresetInfo } from './catalogue.ts';
import { defaultAnswers as restaurantDefaults } from './restaurant/answers.ts';
import { compileRestaurant } from './restaurant/compile.ts';
import { sanitiseRestaurant, validateRestaurant, type Issue } from './restaurant/validate.ts';

export interface Preset {
  info: PresetInfo;
  defaults(): unknown;
  /** Rebuild answers from untrusted JSON. */
  sanitise(input: unknown): unknown;
  validate(answers: unknown): Issue[];
  compile(answers: unknown, meta: { slug: string }): TenantProfile;
}

const BUILT: Record<string, Omit<Preset, 'info'>> = {
  restaurant: {
    defaults: restaurantDefaults,
    sanitise: sanitiseRestaurant,
    validate: (a) => validateRestaurant(a as ReturnType<typeof restaurantDefaults>),
    compile: (a, meta) => compileRestaurant(a as ReturnType<typeof restaurantDefaults>, meta),
  },
};

export function getPreset(key: string): Preset | null {
  const info = presetInfo(key);
  const built = BUILT[key];
  return info && built && info.status === 'live' ? { info, ...built } : null;
}

export { PRESETS, type Issue };
