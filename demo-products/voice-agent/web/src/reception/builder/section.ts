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

/**
 * The saved answers as the builder shows them: a name the person has just
 * emptied stays empty. The server saves a placeholder ("Area 2") for an
 * empty name, and putting it back in the box mid-edit made the next word
 * read "Area 2Patio" (review, 8 October). A list the server changed is
 * shown as saved.
 */
export function keepCleared<T>(typed: T, saved: T): T {
  if (typed === '' && typeof saved === 'string') return typed;
  if (Array.isArray(typed) && Array.isArray(saved)) {
    const same = typed.length === saved.length && saved.every((x, i) => !(x && typeof x === 'object' && 'key' in x) || (typed[i] as { key?: unknown })?.key === x.key);
    return (same ? saved.map((x, i) => keepCleared(typed[i], x)) : saved) as T;
  }
  if (typed && saved && typeof typed === 'object' && typeof saved === 'object') {
    return Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, keepCleared((typed as Record<string, unknown>)[k], v)])) as T;
  }
  return saved;
}

/** The section of the answers under `key`. */
export function sectionOf<A extends BaseAnswers, K extends keyof A>(a: A, set: Update<A>, key: K): Section<A[K]> {
  return {
    value: a[key],
    edit: (fn) => set((d) => fn(d[key])),
    replace: (next) => set((d) => void (d[key] = next)),
  };
}
