// Collection and delivery, for any business that sells food: collection
// slots, delivery by its own drivers, and the delivery apps it is on. It
// edits the ordering section wherever the preset keeps it (the restaurant's
// `serve`), and shows a preset's optional fields only when its answers have
// them (the restaurant's evenings only).

import type { OrderingAnswer } from '../../../../../src/presets/food/ordering.ts';
import type { Sources } from '../../../../../src/presets/common/types.ts';
import { Num, Pounds, Select, Source, Text, Toggle } from '../fields.tsx';
import type { Section } from '../section.ts';

const APPS = ['Deliveroo', 'Uber Eats', 'Just Eat'];

/** `path`: where the section is in the answers ("serve"), for the marks the website scout leaves. */
export function CollectionDelivery({ ordering, path, sources }: { ordering: Section<OrderingAnswer>; path: string; sources: Sources }) {
  const o = ordering.value;
  const c = o.collection;
  const dl = o.delivery;
  const edit = ordering.edit;
  return (
    <>
      <div className={`group ${c.enabled ? 'on' : ''}`}>
        <Toggle label="Click and collect" checked={c.enabled} onChange={(v) => edit((d) => void (d.collection.enabled = v))} hint="Phone orders for collection, into collection slots the kitchen can handle." />
        {c.enabled ? (
          <div className="three">
            <Num label="Prep time" suffix="min" min={5} max={120} value={c.prep_minutes} onChange={(v) => edit((d) => void (d.collection.prep_minutes = v))} hint="Earliest collection is now plus this." />
            <Select label="A slot every" value={c.slot_minutes} options={[5, 10, 15, 20, 30].map((m) => ({ value: m, label: `${m} minutes` }))} onChange={(v) => edit((d) => void (d.collection.slot_minutes = v))} />
            <Num label="Orders per slot" min={0} max={50} value={c.per_slot} onChange={(v) => edit((d) => void (d.collection.per_slot = v))} hint="0 means no limit." />
            {c.evenings_only !== undefined ? (
              <Toggle label="Evenings only" checked={c.evenings_only} onChange={(v) => edit((d) => void (d.collection.evenings_only = v))} />
            ) : null}
          </div>
        ) : null}
      </div>
      <div className={`group ${dl.enabled ? 'on' : ''}`}>
        <Toggle label="Delivery by your own drivers" checked={dl.enabled} onChange={(v) => edit((d) => void (d.delivery.enabled = v))} hint="The receptionist checks the postcode, the minimum order and adds the fee." />
        {dl.enabled ? (
          <>
            <Text label="Postcode districts" value={dl.districts.join(', ')} placeholder="NG1, NG2, NG3, NG7" onChange={(v) => edit((d) => void (d.delivery.districts = v.split(/[,\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean)))} hint="The first half of the postcode, like NG1." />
            <div className="three">
              <Pounds label="Delivery fee" pence={dl.fee_pence} max={2000} onChange={(v) => edit((d) => void (d.delivery.fee_pence = v))} />
              <Pounds label="Minimum order" pence={dl.min_order_pence} max={10000} onChange={(v) => edit((d) => void (d.delivery.min_order_pence = v))} />
              <Num label="Extra time" suffix="min" min={0} max={120} value={dl.extra_minutes} onChange={(v) => edit((d) => void (d.delivery.extra_minutes = v))} />
            </div>
          </>
        ) : null}
      </div>
      <fieldset className="choice inline">
        <legend>Also on delivery apps <Source of={`${path}.delivery_apps`} sources={sources} /></legend>
        {APPS.map((app) => (
          <label key={app}>
            <input type="checkbox" checked={o.delivery_apps.includes(app)} onChange={(e) => edit((d) => {
              d.delivery_apps = e.target.checked ? [...d.delivery_apps, app] : d.delivery_apps.filter((x) => x !== app);
            })} />
            <span>{app}</span>
          </label>
        ))}
        <p className="hint">For answers only: “you’ll find us on Deliveroo”. The receptionist does not take app orders.</p>
      </fieldset>
    </>
  );
}
