// The takeaway builder's steps, in order (presets/takeaway.md §3); the shared
// Review and start step comes after them. Every validation issue points at
// one of these keys. The web's builder lists these very steps, so this file
// is bundled for the browser and must import nothing.

export const STEPS = [
  { key: 'basics', label: 'Basics' },
  { key: 'hours', label: 'Opening hours' },
  { key: 'ordering', label: 'Collection and delivery' },
  { key: 'menu', label: 'Menu' },
  { key: 'deals', label: 'Meal deals' },
  { key: 'money', label: 'Money' },
  { key: 'policies', label: 'Policies and questions' },
] as const;

/** The builder steps an issue can point at. */
export type TakeawayStep = (typeof STEPS)[number]['key'];
