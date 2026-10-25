// What every preset's golden script shares (PRESETS.md §4: a golden corpus
// per preset): goldens are kept in stored form (JSON), written so a diff
// stays readable, and computed with the clock and Math.random refused, so a
// function that starts reading either fails loudly instead of drifting.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

export const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'));
export const stored = <T>(x: T): T => JSON.parse(JSON.stringify(x));
/** Prompts and fact sheets are stored as lines, so a diff shows the line that changed. */
export const lines = (s: string) => s.split('\n');

/** JSON with short lists of plain values on one line (allergens, features), so a diff stays readable. */
export function format(v: unknown, indent = ''): string {
  const inner = `${indent} `;
  if (Array.isArray(v)) {
    const flat = JSON.stringify(v);
    if (v.every((x) => x === null || typeof x !== 'object') && flat.length <= 140) return flat;
    return `[\n${v.map((x) => inner + format(x, inner)).join(',\n')}\n${indent}]`;
  }
  if (v && typeof v === 'object') {
    const entries = Object.entries(v);
    if (!entries.length) return '{}';
    return `{\n${entries.map(([k, x]) => `${inner}${JSON.stringify(k)}: ${format(x, inner)}`).join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(v);
}

export const write = (file: string, value: unknown) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${format(stored(value))}\n`);
};

/** Every golden file under a folder, by path relative to it, with forward slashes as the scripts name them (Windows lists them with backslashes). */
export function goldenFilesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => relative(dir, join(e.parentPath, e.name)).split(sep).join('/'))
    .sort();
}

/**
 * Runs fn with the clock and Math.random refused. Every function recorded
 * takes its time and seed as arguments; if one starts reading them itself,
 * its golden would change from run to run, so this fails loudly instead.
 * (crypto.randomBytes cannot be trapped this way: it is used only for
 * workspace slugs in demo.ts, and the goldens use a fixed slug. Start's PIN
 * comes from Math.random after compiling, so no golden holds one.)
 */
export function withoutClock<T>(fn: () => T, who: { name: string; script: string }): T {
  const RealDate = Date;
  const random = Math.random;
  const refuse = (what: string): never => {
    throw new Error(`A ${who.name} golden read ${what}: pass the time or seed in, or pin it in ${who.script}.`);
  };
  class NoClock extends RealDate {
    constructor(...args: unknown[]) {
      if (!args.length) refuse('the clock (new Date())');
      super(...(args as []));
    }
    static now(): number {
      return refuse('the clock (Date.now)');
    }
    static [Symbol.hasInstance](x: unknown): boolean {
      return x instanceof RealDate;
    }
  }
  globalThis.Date = NoClock as DateConstructor;
  Math.random = () => refuse('Math.random');
  try {
    return fn();
  } finally {
    globalThis.Date = RealDate;
    Math.random = random;
  }
}
