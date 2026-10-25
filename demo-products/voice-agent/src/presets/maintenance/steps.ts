// The property maintenance builder's steps, in order
// (presets/property-maintenance.md §3); the shared Review and start step
// comes after them. Every validation issue points at one of these keys. The
// web's builder lists these very steps, so this file is bundled for the
// browser and must import nothing. Office hours sit with the visit windows,
// so the shared hours checks point at `visits`.

export const STEPS = [
  { key: 'basics', label: 'Basics' },
  { key: 'area', label: 'Where you work' },
  { key: 'customers', label: 'Who you work for' },
  { key: 'trades', label: 'Trades' },
  { key: 'engineers', label: 'Engineers and on call' },
  { key: 'priorities', label: 'Urgency and response' },
  { key: 'safety', label: 'Safety' },
  { key: 'visits', label: 'Office hours and visits' },
  { key: 'prices', label: 'Prices and payment' },
  { key: 'planned', label: 'Safety checks and servicing' },
  { key: 'policies', label: 'Policies and questions' },
] as const;

/** The builder steps an issue can point at. */
export type MaintenanceStep = (typeof STEPS)[number]['key'];
