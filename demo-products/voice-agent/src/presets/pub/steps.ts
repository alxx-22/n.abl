// The pub builder's steps, in order (presets/pub.md §3); the shared Review
// and start step comes after them. Every validation issue points at one of
// these keys. The web's builder lists these very steps, so this file is
// bundled for the browser and must import nothing.

export const STEPS = [
  { key: 'basics', label: 'Basics' },
  { key: 'hours', label: 'Opening and food times' },
  { key: 'seating', label: 'Seating' },
  { key: 'floor', label: 'Floor plan' },
  { key: 'booking', label: 'Bookings and children' },
  { key: 'menu', label: 'Menu and drinks' },
  { key: 'policies', label: 'Policies and questions' },
] as const;

/** The builder steps an issue can point at. */
export type PubStep = (typeof STEPS)[number]['key'];
