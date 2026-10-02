// The restaurant builder's steps, in order, with today's titles; the shared
// Review and start step comes after them. Every validation issue points at
// one of these keys, which is what the builder jumps to. The web's builder
// (web/src/reception/builder/restaurant/builder.tsx) lists these very steps,
// so this file is bundled for the browser and must import nothing.

export const STEPS = [
  { key: 'basics', label: 'Basics' },
  { key: 'hours', label: 'Opening hours' },
  { key: 'serve', label: 'How you serve' },
  { key: 'seating', label: 'Seating' },
  { key: 'floor', label: 'Floor plan' },
  { key: 'menu', label: 'Menu' },
  { key: 'money', label: 'Money' },
  { key: 'policies', label: 'Policies and questions' },
] as const;

/** The builder steps an issue can point at. */
export type RestaurantStep = (typeof STEPS)[number]['key'];
