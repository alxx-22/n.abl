// A pub on a call (presets/pub.md §4.2): children are welcome with an adult
// until the pub's hour, so a table with children finishes by then; a dog is
// welcome everywhere, and noted for the team. Only a profile with `pub` gets
// any of this.

import type { FunctionDeclaration } from './live.ts';
import { durationFor } from '../domain/availability.ts';
import { minutesOf, normaliseTime, spokenTime, timeOf } from '../domain/time.ts';
import type { BookableService, Tenant } from '../domain/types.ts';
import { B, I, int } from './tool-kit.ts';
import type { Args, ToolContext } from './tools.ts';

/** check_availability's, create_booking's and modify_booking's `children` and `dog`, for a pub. */
export function pubParams(decl: FunctionDeclaration, t: Tenant): FunctionDeclaration {
  const pub = t.profile.pub;
  if (!pub) return decl;
  const p = { ...(decl.parameters as { properties: Record<string, unknown> }).properties };
  p.children = I(pub.children_until ? `How many of the party are under 16: children are welcome until ${spokenTime(pub.children_until)}` : 'How many of the party are under 16');
  p.dog = B('A dog is coming: welcome everywhere, noted for the team');
  return { ...decl, parameters: { ...(decl.parameters as object), properties: p } } as FunctionDeclaration;
}

/**
 * A table with children that would run past their hour: refused, with the
 * latest start that fits, and a later table for adults only offered. Null
 * when it fits, there are no children, or no time yet.
 */
export function childrenFirst(ctx: ToolContext, service: BookableService, time: string | undefined, args: Args, key: 'available' | 'booked' | 'changed', children = int(args.children) ?? 0): Record<string, unknown> | null {
  const until = ctx.tenant.profile.pub?.children_until;
  const t = time ? normaliseTime(time) : null;
  if (!until || children <= 0 || !t) return null;
  const party = int(args.party_size) ?? Math.max(children + 1, 2);
  const minutes = durationFor(service, party);
  if (minutesOf(t) + minutes <= minutesOf(until)) return null;
  const step = service.slot_minutes || 15;
  const latest = timeOf(Math.floor((minutesOf(until) - minutes) / step) * step);
  return {
    [key]: false, reason: 'children_hours', latest_with_children: latest,
    message: `Children are welcome until ${spokenTime(until)}, so a table with children has to finish by then: the latest start for ${party} is ${spokenTime(latest)}. Say that plainly, as the pub's rule, and offer it; after ${spokenTime(until)} it's adults only.`,
  };
}

/** The booking's notes and tags for a pub: how many children, and a dog. */
export function pubNotes(t: Tenant, args: Args): { notes: string[]; tags: string[] } {
  if (!t.profile.pub) return { notes: [], tags: [] };
  const kids = int(args.children) ?? 0;
  const dog = args.dog === true || args.dog === 'true';
  return {
    notes: [kids ? `${kids} ${kids === 1 ? 'child' : 'children'}` : null, dog ? 'A dog' : null].filter((x): x is string => Boolean(x)),
    tags: [kids ? 'children' : null, dog ? 'dog' : null].filter((x): x is string => Boolean(x)),
  };
}

/** Children on a booking already made, from its notes ("2 children"): 0 when none. */
export function childrenOn(notes: string | null | undefined, tags: string[] | null | undefined): number {
  const n = /\b(\d+)\s+child(?:ren)?\b/i.exec(notes ?? '');
  return n ? Number(n[1]) : tags?.includes('children') ? 1 : 0;
}
