// The dice for a seeded week: a small seeded generator, so the same seed
// always plans the same week, and believable British names, demo-range
// phone numbers and booking references that never repeat within a plan.

/** xorshift32: a few lines, no dependency, and the same sequence on every machine. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export const seedFrom = (s: string) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);

export const FIRST_NAMES = [
  'Sarah', 'James', 'Priya', 'Tom', 'Aisha', 'Daniel', 'Hannah', 'Mohammed', 'Emily', 'Oliver', 'Grace', 'Liam', 'Chloe', 'Ben',
  'Amara', 'Jack', 'Sophie', 'Ravi', 'Lucy', 'Callum', 'Zara', 'Ethan', 'Megan', 'Kwame', 'Holly', 'Adam', 'Niamh', 'Sam', 'Isla', 'Joe',
];
export const LAST_NAMES = [
  'Collins', 'Patel', 'Walker', 'Okafor', 'Hughes', 'Khan', 'Wright', 'Murphy', 'Nowak', 'Jones', 'Clarke', 'Singh', 'Brown', 'Evans',
  'Taylor', 'Ahmed', 'Green', 'Mensah', 'Kelly', 'Robinson', 'Hall', 'Shah', 'Wood', 'Lewis', 'Begum', 'Price', 'Doyle', 'Chen',
];
/** What a customer mentions when they book or order. */
export const ALLERGIES = ['Coeliac', 'Severe nut allergy', 'Dairy-free', 'Shellfish allergy', 'Vegan', 'Gluten intolerant', 'Sesame allergy'];
const REF_LETTERS = 'AHJKLQRWXY';

export interface Ids {
  pick<T>(xs: T[]): T;
  /** "KX482", never twice in one plan. */
  ref(): string;
  /** In Ofcom's drama range (07700 900xxx), never twice in one plan. */
  phone(): string;
  person(): string;
}

/**
 * Pickers that share one generator and one set of used references and
 * numbers, so bookings, orders and messages in a plan never collide. Each
 * call draws from `random` in a fixed order: a plan that calls them in the
 * same order is the same plan.
 */
export function ids(random: () => number): Ids {
  const usedRefs = new Set<string>();
  const usedPhones = new Set<string>();
  const pick = <T>(xs: T[]): T => xs[Math.floor(random() * xs.length)];
  return {
    pick,
    ref: () => {
      for (;;) {
        const r = `${REF_LETTERS[Math.floor(random() * 10)]}${REF_LETTERS[Math.floor(random() * 10)]}${100 + Math.floor(random() * 900)}`;
        if (!usedRefs.has(r)) return usedRefs.add(r), r;
      }
    },
    phone: () => {
      for (;;) {
        const p = `+447700900${String(Math.floor(random() * 1000)).padStart(3, '0')}`;
        if (!usedPhones.has(p)) return usedPhones.add(p), p;
      }
    },
    person: () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
  };
}
