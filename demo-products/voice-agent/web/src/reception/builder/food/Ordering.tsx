// Collection and delivery, for any business that sells food: collection
// slots, delivery by its own drivers, and the delivery apps it is on. It
// edits the ordering section wherever the preset keeps it (the restaurant's
// `serve`), and shows a preset's optional fields only when its answers have
// them (the restaurant's evenings only).

import type { OrderingAnswer } from '../../../../../src/presets/food/ordering.ts';
import type { Sources } from '../../../../../src/presets/common/types.ts';
import { ListText, Num, Pounds, Select, Source, Text, Toggle } from '../fields.tsx';
import type { Section } from '../section.ts';

const APPS = ['Deliveroo', 'Uber Eats', 'Just Eat'];

/** Districts further out with their own fee or minimum (the takeaway's zones). */
function Zones({ ordering }: { ordering: Section<OrderingAnswer> }) {
  const dl = ordering.value.delivery;
  const zones = dl.zones ?? [];
  const free = dl.districts.filter((x) => !zones.some((z) => z.code === x));
  const edit = (fn: (z: NonNullable<OrderingAnswer['delivery']['zones']>) => void) => ordering.edit((d) => fn((d.delivery.zones ??= [])));
  return (
    <fieldset className="choice">
      <legend>Districts with their own fee or minimum</legend>
      {zones.map((z, i) => (
        <div className="three" key={z.code}>
          <Select label="District" value={z.code} options={[z.code, ...free].map((x) => ({ value: x, label: x }))} onChange={(v) => edit((zs) => void (zs[i].code = v))} />
          <Pounds label="Fee" pence={z.fee_pence ?? dl.fee_pence} max={2000} onChange={(v) => edit((zs) => void (zs[i].fee_pence = v))} />
          <Pounds label="Minimum order" pence={z.min_order_pence ?? dl.min_order_pence} max={10000} onChange={(v) => edit((zs) => void (zs[i].min_order_pence = v))} />
          <button type="button" className="small" onClick={() => edit((zs) => void zs.splice(i, 1))}>Remove {z.code}</button>
        </div>
      ))}
      {free.length ? <button type="button" className="small" onClick={() => edit((zs) => void zs.push({ code: free[0], fee_pence: dl.fee_pence + 100, min_order_pence: dl.min_order_pence + 300 }))}>Add a district further out</button> : null}
      <p className="hint">The rest pay the delivery fee and minimum above.</p>
    </fieldset>
  );
}

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
            {dl.zones !== undefined ? <Zones ordering={ordering} /> : null}
            {dl.free_over_pence !== undefined ? (
              <div className="two">
                <Toggle label="Free delivery over an amount" checked={dl.free_over_pence !== null} onChange={(v) => edit((d) => void (d.delivery.free_over_pence = v ? 3000 : null))} />
                {dl.free_over_pence !== null ? <Pounds label="Free from" pence={dl.free_over_pence} max={10000} onChange={(v) => edit((d) => void (d.delivery.free_over_pence = v))} hint="Said in the read-back, and in the total." /> : null}
              </div>
            ) : null}
            {dl.drivers !== undefined ? (
              <ListText label="Drivers" value={dl.drivers} placeholder="Kai, Priya, Tom" onChange={(v) => edit((d) => void (d.delivery.drivers = v))} hint="First names, for the back office: send each delivery out with one. Callers hear only a first name, once it's out." />
            ) : null}
          </>
        ) : null}
      </div>
      {o.timed_orders !== undefined ? (
        <Toggle label="Orders for a time later today" checked={o.timed_orders} onChange={(v) => edit((d) => void (d.timed_orders = v))} hint="Off: as soon as possible only." />
      ) : null}
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
