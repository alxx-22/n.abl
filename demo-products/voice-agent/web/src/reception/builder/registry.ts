// Which builder each kind of business gets. A preset's builder lists its
// steps from the server's own STEPS (src/presets/<preset>/steps.ts), so the
// titles and keys the validator points issues at are the ones the builder
// shows, and a render for every step: tsc fails when a step has none, or
// when a render has no step. The shell (Builder.tsx) adds the shared Review
// and start step after them (PRESETS.md §3).

import type { ReactNode } from 'react';
import type { BaseAnswers, Issue, Me, WorkspacePayload } from '../types.ts';
import { estateBuilder } from './estate/builder.tsx';
import { maintenanceBuilder } from './maintenance/builder.tsx';
import { restaurantBuilder } from './restaurant/builder.tsx';
import { takeawayBuilder } from './takeaway/builder.tsx';
import { barberBuilder } from './barber/builder.tsx';

/** Change the answers: the function edits a copy, which is then saved. */
export type Update<A extends BaseAnswers = BaseAnswers> = (fn: (draft: A) => void) => void;

/** The shared last step, which every builder has after its own. */
export const REVIEW = { key: 'review', label: 'Review and start' } as const;

export interface StepProps<A extends BaseAnswers = BaseAnswers> {
  a: A;
  set: Update<A>;
  ws: WorkspacePayload<A>;
  me: Me;
  issues: Issue[];
  go: (step: string) => void;
}

/** What the Review step says for this kind of business. */
export interface ReviewCopy<A extends BaseAnswers> {
  /** The summary at the top, a label and a value each. */
  rows(a: A, ws: WorkspacePayload<A>): [label: string, value: ReactNode][];
  /** Before Start: what Start makes. */
  start: string;
  /** After Start: why Reset is there. */
  restart: string;
  /** Once Start or Reset has filled the demo, from the seed's counts. */
  ready(r: { bookings: number; orders: number }): string;
}

export interface BuilderDef<A extends BaseAnswers, K extends string> {
  /** The preset's STEPS, in order. */
  steps: readonly { key: K; label: string }[];
  render: Record<K, (props: StepProps<A>) => ReactNode>;
  /** Steps shown only for some answers: the restaurant's seating, only when it takes bookings. */
  show?: Partial<Record<K, (a: A) => boolean>>;
  /** Steps that need the room more than the preview: the floor plan. */
  wide?: Partial<Record<K, true>>;
  /** The preview pane's body; without one, the pane lists the preview's lines. */
  preview?(a: A, ws: WorkspacePayload<A>): ReactNode;
  review: ReviewCopy<A>;
}

/** A builder with its answers and step keys forgotten, so the shell can hold any of them. */
export type AnyBuilder = BuilderDef<BaseAnswers, string>;

/** Each builder checks its own answers and steps; the shell only passes them through. */
const entry = <A extends BaseAnswers, K extends string>(def: BuilderDef<A, K>): AnyBuilder => def as unknown as AnyBuilder;

const BUILDERS: Record<string, AnyBuilder> = {
  restaurant: entry(restaurantBuilder),
  estate_agent: entry(estateBuilder),
  property_maintenance: entry(maintenanceBuilder),
  takeaway: entry(takeawayBuilder),
  barber: entry(barberBuilder),
};

/** The builder for a preset, or null when this kind of business has none yet. */
export function builderFor(preset: string): AnyBuilder | null {
  return Object.hasOwn(BUILDERS, preset) ? BUILDERS[preset] : null;
}
