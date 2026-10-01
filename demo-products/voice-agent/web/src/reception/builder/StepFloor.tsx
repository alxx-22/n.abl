// Step 5: the floor plan. Drag tables into place (or use the arrow keys),
// then click one to rename it, change its seats, mark it step-free or kept
// for walk-ins, and link the tables that push together.

import { useState } from 'react';
import { FloorPlan, unbookableTag } from '../FloorPlan.tsx';
import { toast } from '../../components/Toaster.tsx';
import { autoLayout } from '../../../../src/presets/restaurant/layout.ts';
import type { StepProps } from './Builder.tsx';
import { FEATURES, addTable, removeTable } from './steps.tsx';

export function StepFloor({ a, set }: StepProps) {
  const [sel, setSel] = useState<string | null>(null);
  const t = a.seating.tables.find((x) => x.key === sel) ?? null;
  const idx = t ? a.seating.tables.indexOf(t) : -1;
  const sameArea = t ? a.seating.tables.filter((u) => u.area === t.area && u.key !== t.key) : [];

  return (
    <div className="floor-step">
      <p className="lead">
        Drag the tables to match your room. Click one to edit it. Tables that push together are joined with a dashed line; the receptionist uses the pair for groups too big
        for either table. Tables tagged <b>Walk-in</b> are kept free for people who turn up: the receptionist never books them.
      </p>
      <div className="floor-edit">
        <div className="floor-wrap">
          <FloorPlan
            mode="edit"
            label="Your floor plan: drag tables to arrange them"
            tables={a.seating.tables.map((x) => {
              const ar = a.seating.areas.find((z) => z.key === x.area);
              const bookable = a.serve.reservations && !x.walk_in && Boolean(ar?.reservable) && !ar?.enquiry_only && ar?.weather_rule !== 'walk_in_only';
              return { ...x, bookable, tag: unbookableTag({ walk_in: x.walk_in, bookable }, ar) };
            })}
            areas={a.seating.areas}
            selected={sel}
            onSelect={setSel}
            onRefuse={toast}
            onMove={(key, x, y) => set((d) => {
              const tb = d.seating.tables.find((z) => z.key === key);
              if (tb) Object.assign(tb, { x: Math.max(1, x), y: Math.max(1, y) });
            })}
          />
          <div className="row-tools">
            {a.seating.areas.map((ar) => (
              <button type="button" className="small" key={ar.key} onClick={() => set((d) => addTable(d, ar.key, 4))}>+ Table in {ar.label}</button>
            ))}
            <span className="spacer" />
            <button type="button" className="small" onClick={() => confirm('Put every table back in tidy rows?') && set((d) => {
              for (const tb of d.seating.tables) Object.assign(tb, { x: 0, y: 0 });
              d.seating.tables = autoLayout(d.seating.areas, d.seating.tables);
            })}>Tidy into rows</button>
          </div>
        </div>

        <aside className="table-panel">
          {!t ? (
            <p className="muted small">Select a table to edit it. Arrow keys nudge the selected table; hold Shift for bigger steps.</p>
          ) : (
            <div className="fields">
              <div className="field">
                <label htmlFor="tb-label">Name</label>
                <input id="tb-label" value={t.label} maxLength={30} onChange={(e) => set((d) => void (d.seating.tables[idx].label = e.target.value))} />
              </div>
              <div className="two">
                <div className="field">
                  <label htmlFor="tb-seats">Seats</label>
                  <select id="tb-seats" value={t.seats} onChange={(e) => set((d) => {
                    const s = Number(e.target.value);
                    d.seating.tables[idx].seats = s;
                    d.seating.tables[idx].shape = s <= 2 ? 'round' : s <= 4 ? d.seating.tables[idx].shape === 'rect' ? 'square' : d.seating.tables[idx].shape : 'rect';
                  })}>
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="tb-shape">Shape</label>
                  <select id="tb-shape" value={t.shape} onChange={(e) => set((d) => void (d.seating.tables[idx].shape = e.target.value as 'round'))}>
                    <option value="round">Round</option>
                    <option value="square">Square</option>
                    <option value="rect">Long</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="tb-area">Area</label>
                <select id="tb-area" value={t.area} onChange={(e) => set((d) => {
                  const tb = d.seating.tables[idx];
                  for (const j of tb.joins) removeJoin(d.seating.tables, tb.key, j);
                  tb.area = e.target.value;
                  Object.assign(tb, { x: 0, y: 0 });
                  d.seating.tables = autoLayout(d.seating.areas, d.seating.tables);
                })}>
                  {a.seating.areas.map((ar) => <option key={ar.key} value={ar.key}>{ar.label}</option>)}
                </select>
              </div>
              <div className="checks">
                <label><input type="checkbox" checked={t.accessible} onChange={(e) => set((d) => void (d.seating.tables[idx].accessible = e.target.checked))} /> Step-free, room for a wheelchair</label>
                <label><input type="checkbox" checked={t.walk_in} onChange={(e) => set((d) => void (d.seating.tables[idx].walk_in = e.target.checked))} /> Kept for walk-ins: never booked by phone, so it stays free in the diary</label>
                <label><input type="checkbox" checked={t.rotation === 90} onChange={(e) => set((d) => void (d.seating.tables[idx].rotation = e.target.checked ? 90 : 0))} /> Turned sideways</label>
              </div>
              <fieldset className="chips">
                <legend>Features</legend>
                {FEATURES.map((f) => (
                  <label key={f.key} className={t.features.includes(f.key) ? 'on' : ''}>
                    <input type="checkbox" checked={t.features.includes(f.key)} onChange={(e) => set((d) => {
                      const tb = d.seating.tables[idx];
                      tb.features = e.target.checked ? [...tb.features, f.key] : tb.features.filter((x) => x !== f.key);
                    })} />
                    {f.label}
                  </label>
                ))}
              </fieldset>
              <fieldset className="chips">
                <legend>Pushes together with</legend>
                {sameArea.length ? sameArea.map((u) => (
                  <label key={u.key} className={t.joins.includes(u.key) ? 'on' : ''}>
                    <input type="checkbox" checked={t.joins.includes(u.key)} onChange={(e) => set((d) => {
                      if (e.target.checked) addJoin(d.seating.tables, t.key, u.key);
                      else removeJoin(d.seating.tables, t.key, u.key);
                    })} />
                    {u.label.replace(/^Table /, 'T')}
                  </label>
                )) : <span className="muted small">No other tables in this area.</span>}
              </fieldset>
              <button type="button" className="ghost small danger" onClick={() => {
                set((d) => removeTable(d, t.key));
                setSel(null);
              }}>Remove this table</button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function addJoin(tables: { key: string; joins: string[] }[], a: string, b: string) {
  const x = tables.find((t) => t.key === a);
  const y = tables.find((t) => t.key === b);
  if (x && !x.joins.includes(b)) x.joins.push(b);
  if (y && !y.joins.includes(a)) y.joins.push(a);
}

function removeJoin(tables: { key: string; joins: string[] }[], a: string, b: string) {
  const x = tables.find((t) => t.key === a);
  const y = tables.find((t) => t.key === b);
  if (x) x.joins = x.joins.filter((j) => j !== b);
  if (y) y.joins = y.joins.filter((j) => j !== a);
}
