// The menu, for any business that sells food: drafted by the AI from a
// description, then edited section by section, dish by dish, with prices,
// the 14 allergens and whether it can be ordered for takeaway. It edits the
// menu section wherever the preset keeps it.

import { useState } from 'react';
import { demoApi } from '../../../api.ts';
import { toast } from '../../../components/Toaster.tsx';
import type { MenuAnswer } from '../../../../../src/presets/food/menu.ts';
import type { Sources } from '../../../../../src/presets/common/types.ts';
import { Folds, Source, Text, Toggle } from '../fields.tsx';
import type { Section } from '../section.ts';
import './menu.css';

export const ALLERGENS = ['celery', 'gluten', 'crustaceans', 'eggs', 'fish', 'lupin', 'milk', 'molluscs', 'mustard', 'nuts', 'peanuts', 'sesame', 'soya', 'sulphites'] as const;

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'item';
}

export interface MenuEditorProps {
  menu: Section<MenuAnswer>;
  /** Where the menu is in the answers ("menu"), for the marks the website scout leaves. */
  path: string;
  sources: Sources;
  workspace: string;
  draftsLeft: number;
  /** The business's style, which the draft uses when the description is empty. */
  style: string;
  /** Whether it takes phone orders, so the draft marks what can be ordered. */
  takeaway: boolean;
}

export function MenuEditor({ menu, path, sources, workspace, draftsLeft, style, takeaway }: MenuEditorProps) {
  const [brief, setBrief] = useState({ description: '', price_level: 'mid', dishes: 18 });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const m = menu.value;
  const edit = menu.edit;
  const items = m.categories.reduce((n, c) => n + c.items.length, 0);

  const draft = async () => {
    if (items && m.source !== 'sample' && !confirm('Replace your current menu with a new draft?')) return;
    setBusy(true);
    try {
      const { menu: drafted } = await demoApi<{ menu: MenuAnswer }>(`/workspaces/${workspace}/menu-draft`, {
        method: 'POST', json: { ...brief, style, takeaway },
      });
      menu.replace(drafted);
      toast(`Drafted ${drafted.categories.reduce((n, c) => n + c.items.length, 0)} dishes. Edit anything below.`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fields">
      <div className="group on draft-box">
        <h3>Describe your food <Source of={`${path}.categories`} sources={sources} /></h3>
        <textarea
          className="prose" rows={3} maxLength={1200} aria-label="Describe your food"
          placeholder="Wood-fired Neapolitan pizza, about ten, fresh pasta, a few starters, tiramisu, Italian wines; good vegan options"
          value={brief.description} onChange={(e) => setBrief({ ...brief, description: e.target.value })}
        />
        <div className="field-row">
          <select aria-label="Price level" value={brief.price_level} onChange={(e) => setBrief({ ...brief, price_level: e.target.value })}>
            <option value="budget">Budget</option>
            <option value="mid">Mid-priced</option>
            <option value="high">Upmarket</option>
          </select>
          <select aria-label="How many dishes" value={brief.dishes} onChange={(e) => setBrief({ ...brief, dishes: Number(e.target.value) })}>
            {[10, 14, 18, 24, 30].map((n) => <option key={n} value={n}>About {n} dishes</option>)}
          </select>
          <button type="button" className="primary" disabled={busy || (!brief.description.trim() && !style)} onClick={draft}>
            {busy ? 'Drafting… (about 20 s)' : 'Draft my menu'}
          </button>
        </div>
        <p className="hint">
          The AI writes a menu from this, with prices and example allergens, and you edit it below. {draftsLeft} drafts left today.
          {m.source === 'sample' ? ' The menu below is our sample until you draft or edit it.' : ''}
        </p>
      </div>

      <Folds
        label="Menu sections" items={m.categories} keyOf={(c) => c.key} initial={m.categories[0]?.key}
        summary={(c) => (
          <>
            <b>{c.label || 'New section'}</b>
            <span className="muted">{c.items.length === 1 ? '1 dish' : `${c.items.length} dishes`}</span>
            <span className="muted menu-sum-names">{c.items.map((it) => it.name).join(', ')}</span>
          </>
        )}
        issue={(c) => {
          const unpriced = c.items.filter((it) => !it.price_pence).length;
          const unknown = c.items.some((it) => it.allergens_unknown);
          if (unpriced && unknown) return `${unpriced} without a price, allergens not set`;
          return unpriced ? `${unpriced} without a price` : unknown ? 'Allergens not set' : null;
        }}
      >
        {(c, ci) => (
          <>
            <div className="cat-head">
              <input aria-label="Section name" className="cat-name" value={c.label} maxLength={40} onChange={(e) => edit((d) => { d.categories[ci].label = e.target.value; d.source = d.source === 'sample' ? 'manual' : d.source; })} />
              <button type="button" className="ghost small" onClick={() => confirm(`Remove ${c.label} and its dishes?`) && edit((d) => void d.categories.splice(ci, 1))}>Remove section</button>
            </div>
            <div className="dishes menu-dishes">
              {c.items.map((it, ii) => {
                const id = `${c.key}/${it.key}`;
                return (
                  <div className={`dish ${it.available === false ? 'off' : ''}`} key={it.key}>
                    <input aria-label="Dish" className="dish-name" value={it.name} maxLength={60} onChange={(e) => edit((d) => void (d.categories[ci].items[ii].name = e.target.value))} />
                    <span className="num-field money price">
                      <span className="muted">£</span>
                      <input aria-label={`${it.name} price`} inputMode="decimal" defaultValue={(it.price_pence / 100).toFixed(2)} key={it.price_pence}
                        onBlur={(e) => { const n = Number(e.target.value.replace(/[£,\s]/g, '')); if (Number.isFinite(n) && n >= 0) edit((d) => void (d.categories[ci].items[ii].price_pence = Math.round(n * 100))); }} />
                    </span>
                    <button type="button" className={`ghost small allergen-btn ${it.allergens.length ? 'has' : ''}`} aria-expanded={open === id} onClick={() => setOpen(open === id ? null : id)}>
                      {it.allergens.length ? it.allergens.join(', ') : 'No allergens set'}
                    </button>
                    <label className="tiny-toggle" title="Available for takeaway">
                      <input type="checkbox" checked={it.available !== false} onChange={(e) => edit((d) => void (d.categories[ci].items[ii].available = e.target.checked ? undefined : false))} />
                      <span>Takeaway</span>
                    </label>
                    <button type="button" className="ghost" aria-label={`Remove ${it.name}`} onClick={() => edit((d) => void d.categories[ci].items.splice(ii, 1))}>✕</button>
                    <input aria-label={`${it.name} description`} className="dish-desc" placeholder="Short description" value={it.description ?? ''} maxLength={200} onChange={(e) => edit((d) => void (d.categories[ci].items[ii].description = e.target.value || undefined))} />
                    {open === id ? (
                      <div className="allergen-grid" role="group" aria-label={`${it.name} allergens`}>
                        {ALLERGENS.map((al) => (
                          <label key={al}>
                            <input type="checkbox" checked={it.allergens.includes(al)} onChange={(e) => edit((d) => {
                              const x = d.categories[ci].items[ii];
                              x.allergens = e.target.checked ? [...x.allergens, al] : x.allergens.filter((y) => y !== al);
                              x.allergens_unknown = undefined;
                            })} />
                            <span>{al}</span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <button type="button" className="ghost small" onClick={() => edit((d) => {
                const cat = d.categories[ci];
                let k = slug(`new dish ${cat.items.length + 1}`);
                while (d.categories.some((x) => x.items.some((y) => y.key === k))) k += '_2';
                cat.items.push({ key: k, name: 'New dish', price_pence: 0, allergens: [] });
                if (d.source === 'sample') d.source = 'manual';
              })}>+ Add a dish</button>
            </div>
          </>
        )}
      </Folds>
      <div className="row-tools">
        <button type="button" className="small" onClick={() => edit((d) => {
          let k = 'new_section';
          while (d.categories.some((x) => x.key === k)) k += '_2';
          d.categories.push({ key: k, label: 'New section', items: [] });
        })}>+ Add a section</button>
      </div>
      <Text label="Allergen statement" area rows={3} max={600} value={m.allergen_statement} onChange={(v) => edit((d) => void (d.allergen_statement = v))} hint="Read to callers who ask about allergies, with the dish’s own allergens." />
      <Toggle
        label="I have checked the allergens" checked={!m.allergens_are_examples}
        onChange={(v) => edit((d) => void (d.allergens_are_examples = !v))}
        hint="Until then the receptionist treats them as examples. For a demo, examples are fine."
      />
    </div>
  );
}
