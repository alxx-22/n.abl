// Rebuilding answers from whatever JSON arrived, field by field, with bounds
// and defaults, so a hand-crafted request cannot put anything odd into a
// profile. The primitives, and the sections every kind of business has. Each
// takes its sub-object and its defaults, never a path, so a preset can keep
// them wherever its answers do.

import { MIDNIGHT } from '../../domain/time.ts';
import { VOICE_NAMES } from '../../domain/voices.ts';
import type { BasicsAnswer, ClosureAnswer, DayHours, FaqAnswer, Sources, ThemeAnswer } from './types.ts';

export const str = (v: unknown, max: number, fallback = ''): string => (typeof v === 'string' ? v.trim().slice(0, max) : fallback);
export const int = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
export const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
export const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);
export const time = (v: unknown, fallback: string): string => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback);
/** A closing time: any time, or midnight as '24:00'. */
export const closeTime = (v: unknown, fallback: string): string => (v === MIDNIGHT ? MIDNIGHT : time(v, fallback));
export const colour = (v: unknown, fallback: string): string => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback);
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const key = (v: unknown, fallback: string): string => {
  const s = typeof v === 'string' ? v.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) : '';
  return s || fallback;
};

export function sanitiseBasics(v: unknown, d: BasicsAnswer): BasicsAnswer {
  const b = (v ?? {}) as any;
  return {
    name: str(b.name, 60, d.name),
    style: str(b.style, 160, d.style),
    town: str(b.town, 60, d.town),
    address: str(b.address, 160, d.address),
    phone_display: str(b.phone_display, 20, d.phone_display),
    website: str(b.website, 200, d.website),
    voice: typeof b.voice === 'string' && VOICE_NAMES.has(b.voice) ? b.voice : d.voice,
    greeting: str(b.greeting, 300, d.greeting),
  };
}

/**
 * Seven days of up to three services. Answers that arrive with no week at
 * all (a new or junk config) get the defaults' week: reading each day from a
 * list that is not there used to close every day, so Start was refused and
 * the profile said closed all week. A day that did arrive keeps today's
 * reading: its open flag follows the services list it came with, so saved
 * and edited weeks load exactly as before.
 */
export function sanitiseDays(v: unknown, d: DayHours[]): DayHours[] {
  if (!Array.isArray(v)) return structuredClone(d);
  const input = v;
  return d.map((def, i) => {
    const x = (input[i] ?? {}) as any;
    const services = arr(x.services).slice(0, 3).map((s: any, j) => ({
      label: str(s?.label, 30, j === 0 ? 'Lunch' : 'Dinner') || 'Open',
      open: time(s?.open, '12:00'),
      close: closeTime(s?.close, '22:00'),
    }));
    return { open: bool(x.open, def.open) && services.length > 0, services: x.services === undefined ? def.services : services };
  });
}

export function sanitiseClosures(v: unknown): ClosureAnswer[] {
  return arr(v).slice(0, 30)
    .map((c: any) => ({ date: typeof c?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.date) ? c.date : '', note: str(c?.note, 60) }))
    .filter((c) => c.date);
}

export function sanitiseFaqs(v: unknown): FaqAnswer[] {
  return arr(v).slice(0, 20).map((f: any) => ({ q: str(f?.q, 150), a: str(f?.a, 500) })).filter((f) => f.q && f.a);
}

export function sanitiseTheme(v: unknown, d: ThemeAnswer): ThemeAnswer {
  const th = (v ?? {}) as any;
  return {
    accent: colour(th.accent, d.accent),
    primary: colour(th.primary, d.primary),
    background: colour(th.background, d.background),
    font_heading: str(th.font_heading, 60, d.font_heading).replace(/[^A-Za-z0-9 \-]/g, '') || d.font_heading,
    font_body: str(th.font_body, 60, d.font_body).replace(/[^A-Za-z0-9 \-]/g, '') || d.font_body,
    // Logos are only ever data: URLs the scout made or our own paths.
    logo: typeof th.logo === 'string' && (/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(th.logo) && th.logo.length < 400_000) ? th.logo : null,
  };
}

export function sanitiseSources(v: unknown): Sources {
  return Object.fromEntries(
    Object.entries((v ?? {}) as Record<string, unknown>)
      .filter(([k, x]) => /^[a-z_.0-9]{1,60}$/.test(k) && (x === 'website' || x === 'guess'))
      .slice(0, 100),
  ) as Sources;
}
