// A pub on a call (presets/pub.md §4.2): children are welcome with an adult
// until the pub's hour, so a table with children finishes by then; a dog is
// welcome everywhere, and noted for the team. Only a profile with `pub` gets
// any of this.

import type { FunctionDeclaration } from './live.ts';
import type { Repo } from '../db/repo.ts';
import { durationFor, findService } from '../domain/availability.ts';
import { addDays, isIsoDate, minutesOf, normaliseTime, spokenDate, spokenTime, timeOf, toLocal, weekdayOf, zonedToUtc } from '../domain/time.ts';
import type { BookableService, Tenant } from '../domain/types.ts';
import { B, I, S, int, str } from './tool-kit.ts';
import type { Args, ToolContext } from './tools.ts';

/** check_availability's, create_booking's and modify_booking's `children` and `dog`, for a pub. */
export function pubParams(decl: FunctionDeclaration, t: Tenant): FunctionDeclaration {
  const pub = t.profile.pub;
  if (!pub) return decl;
  const p = { ...(decl.parameters as { properties: Record<string, unknown> }).properties };
  p.children = I(pub.children_until ? `How many of the party are under 16: children are welcome until ${spokenTime(pub.children_until)}` : 'How many of the party are under 16');
  p.dog = B('A dog is coming: welcome everywhere, noted for the team');
  if (findService(t.profile, 'quiz')) p.team = S('The quiz: the team’s name');
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
    notes: [str(args.team) ? `Team: ${str(args.team)}` : null, kids ? `${kids} ${kids === 1 ? 'child' : 'children'}` : null, dog ? 'A dog' : null].filter((x): x is string => Boolean(x)),
    tags: [kids ? 'children' : null, dog ? 'dog' : null].filter((x): x is string => Boolean(x)),
  };
}

/** Children on a booking already made, from its notes ("2 children"): 0 when none. */
export function childrenOn(notes: string | null | undefined, tags: string[] | null | undefined): number {
  const n = /\b(\d+)\s+child(?:ren)?\b/i.exec(notes ?? '');
  return n ? Number(n[1]) : tags?.includes('children') ? 1 : 0;
}

/**
 * A table running past the children's hour, booked without saying whether
 * any are under 16: asked once, before it's booked. A live call (13
 * October) booked four at 8:30pm, two of them children, because nobody
 * asked. Null when it ends in time, children was given, or it was asked.
 */
export function childrenAsk(ctx: ToolContext, service: BookableService, time: string | undefined, args: Args): Record<string, unknown> | null {
  const until = ctx.tenant.profile.pub?.children_until;
  const t = time ? normaliseTime(time) : null;
  if (!until || !t || args.children !== undefined || ctx.state.gateAsked.includes('children')) return null;
  if (minutesOf(t) + durationFor(service, int(args.party_size) ?? 2) <= minutesOf(until)) return null;
  ctx.state.gateAsked.push('children');
  return {
    booked: false, done: false,
    message: `Not done yet: this table runs past ${spokenTime(until)}, when it's adults only. Ask once whether any of the party are under 16, then call create_booking again with children (0 if none). Do not mention this check.`,
  };
}

// ── What's on (presets/pub.md §4.2, M2) ───────────────────────────────────

/** One event in a pub's week, as the back office and whats_on see it. Weekly ones have no id: they can't be removed, only changed in the builder. */
export interface WeekEvent {
  id: string | null;
  date: string;
  time: string;
  title: string;
  kind: 'sport' | 'music' | 'quiz' | 'other';
  place: string;
  source: string;
}

/** The week from `from` (or `days` days): the manager's fixtures, each weekly event on its day, and the quiz. Soonest first. */
export async function pubWeek(repo: Repo, t: Tenant, from: string, days = 7): Promise<WeekEvent[]> {
  const p = t.profile;
  const tz = p.timezone;
  const rows = await repo.listPubEvents(t.id, zonedToUtc(from, '00:00', tz), zonedToUtc(addDays(from, days), '00:00', tz));
  const out: WeekEvent[] = rows.map((r) => {
    const l = toLocal(r.starts_at, tz);
    return { id: r.id, date: l.date, time: l.time, title: r.title, kind: r.kind, place: r.place ?? '', source: r.source };
  });
  const quiz = findService(p, 'quiz');
  for (let d = 0; d < days; d++) {
    const date = addDays(from, d);
    const wd = weekdayOf(date);
    if (p.closures?.some((c) => c.date === date)) continue;
    for (const e of p.pub?.events ?? []) {
      if (e.day === wd) out.push({ id: null, date, time: e.time, title: e.title, kind: /music|band|gig|acoustic|open mic|singer|dj/i.test(e.title) ? 'music' : 'other', place: e.place, source: 'weekly' });
    }
    for (const w of quiz?.windows ?? []) {
      if (w.days.includes(wd)) out.push({ id: null, date, time: w.first, title: 'The quiz', kind: 'quiz', place: 'the bar', source: 'weekly' });
    }
  }
  return out.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`) || a.title.localeCompare(b.title));
}

/** Said aloud: a sample fixture's "(example)" is for the back office, not the caller. */
const spoken = (title: string) => title.replace(/\s*\(example\)\s*$/i, '');

/** Words that say nothing about which event: "is the game on this Saturday?" */
const NOT_A_NAME = /^(?:the|game|games|match|matches|on|showing|show|shown|tonight|today|tomorrow|this|that|next|week|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|any|anything|are|you|football|footy|sport|sports|live|of|vs|versus|and|at|in|big|screen|screens|telly|tv|kick|off|kick-off|will|be|it|what|whats|what's|time)$/;
const SPORT = /football|footy|match|game|sport|rugby|cricket|boxing|fight|grand prix|\bf1\b|darts|snooker|tennis|golf|kick[- ]?off/i;

/** whats_on: the week's events, or the one asked about; anything not listed is said so, never "probably". */
export async function whatsOn(ctx: ToolContext, args: Args): Promise<Record<string, unknown>> {
  ctx.state.whatsOnChecked = true;
  const p = ctx.tenant.profile;
  const tz = p.timezone;
  const now = toLocal(ctx.now(), tz);
  const asked = str(args.date);
  const date = asked && isIsoDate(asked) ? asked : null;
  const week = (await pubWeek(ctx.repo, ctx.tenant, date ?? now.date, date ? 1 : 7))
    // What finished hours ago today is over.
    .filter((e) => e.date !== now.date || minutesOf(e.time) + 150 >= minutesOf(now.time));
  const what = str(args.what)?.toLowerCase().trim() ?? '';
  const words = what.split(/[^a-z0-9']+/).filter((w) => w.length > 2 && !NOT_A_NAME.test(w));
  const kindAsked = /quiz/.test(what) ? 'quiz' : /music|band|gig|acoustic|singer/.test(what) ? 'music' : SPORT.test(what) ? 'sport' : null;
  const hits = !what ? week : words.length ? week.filter((e) => words.some((w) => e.title.toLowerCase().includes(w))) : kindAsked ? week.filter((e) => e.kind === kindAsked) : week;
  const say = (e: WeekEvent) => ({ day: e.date === now.date ? 'today' : spokenDate(e.date), time: spokenTime(e.time), what: spoken(e.title), where: e.place || undefined });
  const when = date ? (date === now.date ? 'today' : `on ${spokenDate(date)}`) : 'this week';
  if (what && !hits.length) {
    return {
      listed: false,
      message: `"${str(args.what)}" isn't on our list ${when}. Say so plainly: never that we'll probably show it, or might have it on. Offer to take a message for the manager if they'd like it shown.`,
      on: week.slice(0, 4).map(say),
    };
  }
  const quiz = findService(p, 'quiz');
  return {
    listed: true,
    events: hits.slice(0, 8).map(say),
    ...(p.pub?.no_bar_bookings_for_matches && hits.some((e) => e.kind === 'sport') ? { bar: "During a match the bar's tables aren't booked: it's first come. The dining room can be booked, but it has no screen." } : {}),
    ...(quiz && hits.some((e) => e.kind === 'quiz') ? { quiz: quiz.description, book_quiz: 'A team can be booked: check_availability and create_booking with service "Quiz team" and the team name.' } : {}),
    ...(hits.length ? {} : { message: `Nothing is listed ${when}.` }),
  };
}

/**
 * A table during a listed match, where the bar isn't booked then: in the
 * bar, refused (first come); with no room named, the room that can be booked
 * instead, and a note that it has no screen. Null when no match is on then.
 */
export async function matchFirst(ctx: ToolContext, service: BookableService, date: string | undefined, time: string | undefined, args: Args, key: 'available' | 'booked'): Promise<{ refuse?: Record<string, unknown>; area?: string; note?: string } | null> {
  const p = ctx.tenant.profile;
  const t = time ? normaliseTime(time) : null;
  if (!p.pub?.no_bar_bookings_for_matches || !date || !isIsoDate(date) || !t || service.key !== 'table') return null;
  const areas = p.booking?.areas ?? [];
  const bar = areas.find((a) => a.kind === 'bar');
  if (!bar) return null;
  const tz = p.timezone;
  const starts = zonedToUtc(date, t, tz).getTime();
  const ends = starts + durationFor(service, int(args.party_size) ?? 2) * 60000;
  const day = await ctx.repo.listPubEvents(ctx.tenant.id, zonedToUtc(date, '00:00', tz), zonedToUtc(addDays(date, 1), '00:00', tz));
  // From half an hour before kick-off until two hours after.
  const match = day.find((e) => e.kind === 'sport' && starts < e.starts_at.getTime() + 120 * 60000 && e.starts_at.getTime() - 30 * 60000 < ends);
  if (!match) return null;
  const other = areas.find((a) => a.key !== bar.key && a.reservable && !a.enquiry_only);
  const said = (str(args.area) ?? '').toLowerCase();
  const why = `${spoken(match.title)} is on at ${spokenTime(toLocal(match.starts_at, tz).time)}, and the bar's tables aren't booked during a match: it's first come then.`;
  if (said && (said.includes('bar') || said === bar.key || said === bar.label.toLowerCase())) {
    return { refuse: { [key]: false, reason: 'match_on', message: `${why}${other ? ` Offer the ${other.label.toLowerCase()}, which can be booked but has no screen.` : ''}` } };
  }
  if (!said && other) return { area: other.label, note: `${why} This is in the ${other.label.toLowerCase()}, which has no screen: say so.` };
  return null;
}

/** Today's ales: what the manager set on "Today", or the usual list; "(example)" left off. */
export async function alesToday(ctx: ToolContext, onTap: string[] | undefined): Promise<string[]> {
  return (onTap ?? ctx.tenant.profile.pub?.on_tap ?? []).map(spoken);
}
