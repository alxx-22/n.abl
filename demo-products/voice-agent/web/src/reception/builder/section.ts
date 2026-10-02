// A shared step edits one part of the answers without knowing where it lives:
// the restaurant keeps its ordering under `serve`, the takeaway under
// `ordering` (PRESETS.md §1, rule 3). The preset hands the step this.

import type { BaseAnswers } from '../types.ts';
import type { Update } from './registry.ts';

export interface Section<T> {
  value: T;
  /** The function edits a copy of the section, which is then saved. */
  edit(fn: (draft: T) => void): void;
  /** Put a whole new section in its place: a drafted menu. */
  replace(next: T): void;
}

/** The section of the answers under `key`. */
export function sectionOf<A extends BaseAnswers, K extends keyof A>(a: A, set: Update<A>, key: K): Section<A[K]> {
  return {
    value: a[key],
    edit: (fn) => set((d) => fn(d[key])),
    replace: (next) => set((d) => void (d[key] = next)),
  };
}
