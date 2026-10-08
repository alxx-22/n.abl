// The preset registry: what the server needs from each kind of business, and
// the one way it reads a workspace's saved answers. A preset is served to
// prospects once it is built here and its catalogue entry says live
// (PRESETS.md §2.2). The restaurant, the estate agent, property
// maintenance and the takeaway are built and live.

import type { Config } from '../config.ts';
import type { TenantProfile } from '../domain/types.ts';
import type { ScanPart } from '../scout/map.ts';
import type { ScanResult } from '../scout/scan.ts';
import { PRESETS, presetInfo, type PresetInfo } from './catalogue.ts';
import type { BaseAnswers, Issue, SeedPlan, VisitStatus } from './common/types.ts';
import { estateAgent } from './estate/preset.ts';
import { propertyMaintenance } from './maintenance/preset.ts';
import { restaurant } from './restaurant/preset.ts';
import { takeaway } from './takeaway/preset.ts';

/**
 * properties, offers, applicants, valuations and sales are the estate
 * agent's (presets/estate-agent.md §6); jobs, dispatch, compliance, safety,
 * clients and money the property maintenance contractor's (presets/property-maintenance.md §6).
 */
export type ViewId =
  | 'floor' | 'timeline' | 'orders' | 'drivers' | 'messages' | 'calls' | 'properties' | 'offers' | 'applicants' | 'valuations' | 'sales'
  | 'jobs' | 'dispatch' | 'compliance' | 'safety' | 'clients' | 'money' | 'tonight';

/** The back office a workspace shows, in the preset's own words (PRESETS.md §2.5). */
export interface WorkspaceSpec {
  /** Tab order; the first is the default. */
  views: { id: ViewId; label: string; of?: string }[];
  bookings?: {
    resource: string;
    resources: string;
    party: string | null;
    visit: Partial<Record<VisitStatus, string>>;
    allergies: boolean;
    /** Staff can push two tables together for a booking: the preset has combineTables. */
    combine?: boolean;
    /** A booking is at one of the business's homes (a viewing): the drawer shows which. */
    property?: boolean;
  };
  orders?: {
    board: string;
    done: { collection: string; delivery: string };
    drivers: boolean;
    /** Seeded orders move on with the clock. */
    advance: boolean;
  };
  /** The team's phones, to watch their urgent texts on the demo's phone. */
  teamPhones?: { name: string; phone: string }[];
  /** People the prospect can ring as (the caller's number the call sends). */
  callAs?: { label: string; phone: string }[];
  /** What to try saying on the call; {ref} is filled from state. */
  suggestions: string[];
  /** What Reset makes again: "bookings and orders". */
  resetLine: string;
}

/**
 * What the builder's preview pane shows. The restaurant sends the fields it
 * always has (greeting, core facts, hours, covers, tables, pairs, dishes) and
 * no lines; every later preset sends `lines`, which the pane lists as they
 * are, so a new kind of business needs no new pane (PRESETS.md §1, rule 7).
 */
export type PreviewPayload = { lines?: string[] } & Record<string, unknown>;

/** A catalogue the builder drafts from a description: the restaurant's menu, later a price list. S is that section's type. */
export interface CatalogueDraft<A extends BaseAnswers, S = unknown> {
  /** The answers section a draft fills, and the key the route sends it back under: { menu }. */
  label: string;
  /**
   * The request's brief and the saved answers: the drafted section, and
   * nothing else. The browser puts back only that section, and its answers
   * may be ahead of the saved ones, so a draft cannot change another section
   * here. Whatever must follow a new section (the takeaway's deals re-linked
   * to the new menu) happens in sanitise, on the next save. Throws
   * PresetError (400) when the brief gives nothing to go on.
   */
  run(brief: unknown, a: A, config: Config): Promise<S>;
  /** Recorded with the usage row: { dishes: 18 }. */
  counts(section: S): Record<string, number>;
}

export interface Preset<A extends BaseAnswers = BaseAnswers> {
  info: PresetInfo;
  /** The shape of the answers today; saved answers with an older version go through migrate first. */
  VERSION: number;
  migrate?(raw: unknown, from: number): unknown;
  /** A fresh object every call. */
  defaults(): A;
  /** Rebuild answers from untrusted JSON. Writes VERSION. */
  sanitise(input: unknown): A;
  /** The builder's steps in order, the shared Review aside; every issue points at one of their keys. */
  steps: readonly { key: string; label: string }[];
  validate(a: A): Issue[];
  compile(a: A, meta: { slug: string }): TenantProfile;
  /** A believable week of data for the compiled profile, deterministic for a seed. */
  seed(profile: TenantProfile, now: Date, seed: number): SeedPlan;
  /** What the builder's preview pane shows: the restaurant's own fields, or lines. */
  preview(a: A, profile: TenantProfile): PreviewPayload;
  /** What the FAQ draft is told about the business. */
  factSheet(a: A): string;
  /** What the receptionist does itself, which the FAQ draft leaves out: "booking a table or ordering food". */
  handles: string;
  draft?: CatalogueDraft<A>;
  /** Which parts of a website scan the builder offers, and how they land in the answers. Takes scans saved by earlier code. */
  scan: { parts: ScanPart[]; apply(a: A, result: ScanResult, use: Partial<Record<ScanPart, boolean>>): A };
  workspace(profile: TenantProfile): WorkspaceSpec;
  /** Staff push two tables together for a booking; throws PresetError when they cannot be. */
  combineTables?(a: A, x: string, y: string): A;
}

const BUILT: Record<string, Omit<Preset, 'info'>> = { restaurant, estate_agent: estateAgent, property_maintenance: propertyMaintenance, takeaway };

/** A preset prospects can use: built, and live in the catalogue. */
export function getPreset(key: string): Preset | null {
  const info = presetInfo(key);
  const built = BUILT[key];
  return info && built && info.status === 'live' ? { info, ...built } : null;
}

/** Any built preset, live or not: for tests, and for previewing one before it goes live. */
export function builtPreset(key: string): Preset | null {
  const info = presetInfo(key);
  const built = BUILT[key];
  return info && built ? { info, ...built } : null;
}

/**
 * The only way stored or sent answers are read: brought up to the preset's
 * version, then cleaned. Answers with no version are the first.
 */
export function answersOf<A extends BaseAnswers>(preset: Preset<A>, raw: unknown): A {
  const v = (raw as { version?: unknown } | null | undefined)?.version;
  const from = typeof v === 'number' ? v : 1;
  return preset.sanitise(preset.migrate && from < preset.VERSION ? preset.migrate(raw, from) : raw);
}

export { PRESETS, type BaseAnswers, type Issue, type PresetInfo, type SeedPlan };
