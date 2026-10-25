// Meal deals, for any business that sells food (presets/takeaway.md §3): a
// price and a few choices, each from one section of the menu ("any burger",
// "a side", "a can"), with extra for dearer choices, and anything always
// included. Deals point at the menu, so a choice whose section a new menu
// draft took away is shown as such until it is fixed (the validator says
// the same on this step).

import { useState } from 'react';
import type { DealAnswer, DealPartAnswer } from '../../../../../src/presets/food/deals.ts';
import type { MenuAnswer } from '../../../../../src/presets/food/menu.ts';
import { Num, Pounds, Select, Text, Toggle } from '../fields.tsx';
import type { Section } from '../section.ts';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'deal';
const pounds = (p: number) => `£${(p / 100).toFixed(2)}`;

function Part({ part, menu, onChange, onRemove }: { part: DealPartAnswer; menu: MenuAnswer; onChange: (fn: (p: DealPartAnswer) => void) => void; onRemove: () => void }) {
  const section = menu.categories.find((c) => c.key === part.category_key);
  const candidates = section ? (part.item_keys ? section.items.filter((i) => part.item_keys!.includes(i.key)) : section.items) : [];
  return (
    <div className="group on">
      <div className="three">
        <Text label="The caller chooses" value={part.label} max={30} placeholder="Burger" onChange={(v) => onChange((p) => void (p.label = v))} />
        <Select
          label="From" value={part.category_key}
          options={[...(section ? [] : [{ value: part.category_key, label: `${part.category_key} (not on the menu)` }]), ...menu.categories.map((c) => ({ value: c.key, label: c.label }))]}
          onChange={(v) => onChange((p) => { p.category_key = v; delete p.item_keys; delete p.upcharge_pence; })}
        />
        <Num label="How many" min={1} max={4} value={part.choose} onChange={(v) => onChange((p) => void (p.choose = v))} />
      </div>
      {!section ? <p className="hint warn">This section isn't on the menu any more, so the deal is left out until you pick another.</p> : (
        <>
          <Toggle
            label={`Only some of the ${section.label.toLowerCase()}`} checked={part.item_keys !== undefined}
            onChange={(v) => onChange((p) => { if (v) p.item_keys = section.items.map((i) => i.key); else delete p.item_keys; })}
          />
          {part.item_keys !== undefined ? (
            <fieldset className="choice inline">
              <legend>Which ones</legend>
              {section.items.map((i) => (
                <label key={i.key}>
                  <input type="checkbox" checked={part.item_keys!.includes(i.key)} onChange={(e) => onChange((p) => {
                    p.item_keys = e.target.checked ? [...(p.item_keys ?? []), i.key] : (p.item_keys ?? []).filter((x) => x !== i.key);
                  })} />
                  <span>{i.name}</span>
                </label>
              ))}
            </fieldset>
          ) : null}
          <details>
            <summary className="small">Extra for dearer choices</summary>
            <div className="three">
              {candidates.map((i) => (
                <Pounds
                  key={i.key} label={i.name} pence={part.upcharge_pence?.[i.key] ?? 0} max={1000}
                  onChange={(v) => onChange((p) => {
                    const up = { ...(p.upcharge_pence ?? {}) };
                    if (v > 0) up[i.key] = v;
                    else delete up[i.key];
                    if (Object.keys(up).length) p.upcharge_pence = up;
                    else delete p.upcharge_pence;
                  })}
                />
              ))}
            </div>
          </details>
        </>
      )}
      <button type="button" className="small" onClick={onRemove}>Remove this choice</button>
    </div>
  );
}

export function DealsEditor({ deals, menu }: { deals: Section<DealAnswer[]>; menu: MenuAnswer }) {
  const [open, setOpen] = useState<string | null>(null);
  const list = deals.value;
  const items = menu.categories.flatMap((c) => c.items);
  const edit = (i: number, fn: (d: DealAnswer) => void) => deals.edit((ds) => fn(ds[i]));
  const add = () => {
    const name = `New deal ${list.length + 1}`;
    const first = menu.categories[0];
    deals.edit((ds) => void ds.push({ key: slug(name), name, price_pence: 0, description: '', parts: first ? [{ label: first.label.replace(/s$/, ''), category_key: first.key, choose: 1 }] : [] }));
    setOpen(slug(name));
  };
  return (
    <>
      <p className="hint">A deal is a price and a few choices. The receptionist offers one when an order is cheaper as a deal, once a call, and takes a no.</p>
      {list.map((d, i) => (
        <div key={d.key} className={`group ${open === d.key ? 'on' : ''}`}>
          <button type="button" className="ghost" onClick={() => setOpen(open === d.key ? null : d.key)}>
            <b>{d.name || 'Unnamed deal'}</b> <span className="muted small">{d.price_pence ? pounds(d.price_pence) : 'no price yet'} · {d.parts.length} choice{d.parts.length === 1 ? '' : 's'}</span>
          </button>
          {open === d.key ? (
            <>
              <div className="three">
                <Text label="Name" value={d.name} max={40} onChange={(v) => edit(i, (x) => void (x.name = v))} />
                <Pounds label="Price" pence={d.price_pence} max={10000} onChange={(v) => edit(i, (x) => void (x.price_pence = v))} />
              </div>
              <Text label="What's in it" value={d.description} max={160} placeholder="Any burger with regular fries and a can." onChange={(v) => edit(i, (x) => void (x.description = v))} hint="Said when the receptionist offers it." />
              {d.parts.map((p, j) => (
                <Part key={j} part={p} menu={menu} onChange={(fn) => edit(i, (x) => fn(x.parts[j]))} onRemove={() => edit(i, (x) => void x.parts.splice(j, 1))} />
              ))}
              {d.parts.length < 5 && menu.categories.length ? (
                <button type="button" className="small" onClick={() => edit(i, (x) => void x.parts.push({ label: menu.categories[0].label.replace(/s$/, ''), category_key: menu.categories[0].key, choose: 1 }))}>Add a choice</button>
              ) : null}
              <Select
                label="Always comes with" value=""
                options={[{ value: '', label: (d.includes ?? []).length ? `${(d.includes ?? []).map((k) => items.find((x) => x.key === k)?.name ?? k).join(', ')}: add another` : 'Nothing extra: add an item' }, ...items.filter((x) => !(d.includes ?? []).includes(x.key)).map((x) => ({ value: x.key, label: x.name }))]}
                onChange={(v) => v && edit(i, (x) => void (x.includes = [...(x.includes ?? []), v]))}
              />
              {(d.includes ?? []).length ? <button type="button" className="small" onClick={() => edit(i, (x) => void delete x.includes)}>Clear what it always comes with</button> : null}
              <button type="button" className="small danger" onClick={() => deals.edit((ds) => void ds.splice(i, 1))}>Delete {d.name || 'this deal'}</button>
            </>
          ) : null}
        </div>
      ))}
      {list.length < 12 ? <button type="button" onClick={add}>Add a meal deal</button> : null}
    </>
  );
}
