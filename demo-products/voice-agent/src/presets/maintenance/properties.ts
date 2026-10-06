// The sample properties a new property maintenance demo starts with
// (presets/property-maintenance.md §2.1): seed data, not answers. The
// postcode districts are real (Nottingham, Derby and Loughborough) but every
// street is invented, so an address is always said with "(example)", and
// no prospect ever types one in M1.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normaliseUkPhone } from '../../domain/phone.ts';
import type { MtProperty } from '../../domain/types.ts';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'fixtures');

let sample: MtProperty[] | null = null;

/** The sample homes and sites, with numbers as a caller's arrives (E.164). A fresh copy every call. */
export function sampleProperties(): MtProperty[] {
  sample ??= (JSON.parse(readFileSync(join(FIXTURES, 'presets', 'maintenance-properties.json'), 'utf8')).properties as any[]).map((p) => ({
    key: p.key,
    number: p.number,
    street: p.street,
    district: p.district,
    town: p.town,
    kind: p.kind,
    block: p.block ?? null,
    site_name: p.site_name ?? null,
    client: p.client ?? null,
    occupant: { name: p.occupant.name, phone: normaliseUkPhone(p.occupant.phone), texts_ok: Boolean(p.occupant.texts_ok) },
    notes: p.notes,
    access: p.access,
    vulnerable: p.vulnerable,
    vulnerable_consent_at: null,
    markers: p.markers,
    gas: Boolean(p.gas),
    gas_appliances: p.gas_appliances,
    example: true,
  }));
  return structuredClone(sample);
}

/** "14 Elm Road (example), NG5", or a business "The Copper Kettle, 9 Hosiery Row (example), NG1": how a property is said and shown. */
export const shortAddress = (p: Pick<MtProperty, 'number' | 'street' | 'district' | 'example'> & { site_name?: string | null }) =>
  `${p.site_name ? `${p.site_name}, ` : ''}${p.number} ${p.street}${p.example ? ' (example)' : ''}, ${p.district}`;

/** "14 Elm Road (example), Nottingham NG5". */
export const fullAddress = (p: Pick<MtProperty, 'number' | 'street' | 'district' | 'town' | 'example'> & { site_name?: string | null }) =>
  `${p.site_name ? `${p.site_name}, ` : ''}${p.number} ${p.street}${p.example ? ' (example)' : ''}, ${p.town} ${p.district}`;
