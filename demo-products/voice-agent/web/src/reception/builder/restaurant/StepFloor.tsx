// The restaurant's floor plan, one area at a time. Drag tables into place
// (they line up with their neighbours as they go, or use the arrow keys),
// then click one to rename it, change its seats, mark it step-free or kept
// for walk-ins, and link the tables that push together. A bar, doors,
// windows and walls can be added for looks.

import { useState } from 'react';
import { FIXTURE_LABEL, FloorPlan, ZoomControls, unbookableTag } from '../../FloorPlan.tsx';
import { toast } from '../../../components/Toaster.tsx';
import { FIXTURE_LENGTH, autoLayout, fixtureRect, fixtureSize, freeSpot, tableRect } from '../../../../../src/presets/restaurant/layout.ts';
import type { FixtureAnswer, RestaurantAnswers } from '../../types.ts';
import type { StepProps } from '../registry.ts';
import { FEATURES, KINDS, addArea, addTable, nextAreaKey, nextTableKey, removeTable } from './seating.ts';

const nextFixtureKey = (fixtures: FixtureAnswer[]) => `F${Math.max(0, ...fixtures.map((f) => Number(/^F(\d+)$/.exec(f.key)?.[1] ?? 0))) + 1}`;

function addFixture(d: RestaurantAnswers, area: string, kind: FixtureAnswer['kind']): void {
  const f: FixtureAnswer = { key: nextFixtureKey(d.seating.fixtures), area, kind, x: 0, y: 0, length: FIXTURE_LENGTH[kind].start, rotation: 0 };
  // Somewhere clear of the tables, near the top left, so it is easy to find.
  const taken = [...d.seating.tables.filter((t) => t.area === area).map(tableRect), ...d.seating.fixtures.filter((x) => x.area === area).map(fixtureRect)];
  Object.assign(f, freeSpot(fixtureSize(f), { x: 40, y: 40 }, taken, 20));
  d.seating.fixtures.push(f);
}

export function StepFloor({ a, set }: StepProps<RestaurantAnswers>) {
  const [tab, setTab] = useState(a.seating.areas[0]?.key ?? '');
  const area = a.seating.areas.find((x) => x.key === tab) ?? a.seating.areas[0];
  const [sel, setSel] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offer, setOffer] = useState<{ a: string; b: string } | null>(null);
  const t = a.seating.tables.find((x) => x.key === sel) ?? null;
  const f = a.seating.fixtures.find((x) => x.key === sel) ?? null;
  const idx = t ? a.seating.tables.indexOf(t) : -1;
  const sameArea = t ? a.seating.tables.filter((u) => u.area === t.area && u.key !== t.key) : [];
  const label = (k: string) => a.seating.tables.find((x) => x.key === k)?.label ?? k;
  const choose = (key: string) => {
    setTab(key);
    setSel(null);
    setOffer(null);
  };

  if (!area) return <p className="lead">Add a seating area in the Seating step first.</p>;
  const mine = a.seating.tables.filter((x) => x.area === area.key);

  return (
    <div className="floor-step">
      <p className="lead">
        One tab per area. Drag the tables to match your room: they line up with their neighbours as you go, and a table dropped on another moves to the nearest clear space.
        Tables that push together are joined with a dashed line; the receptionist uses the pair for groups too big for either table.
      </p>
      <div className="area-tabs" role="tablist" aria-label="Seating areas">
        {a.seating.areas.map((ar) => {
          const n = a.seating.tables.filter((x) => x.area === ar.key).length;
          return (
            <button type="button" role="tab" key={ar.key} aria-selected={ar.key === area.key} onClick={() => choose(ar.key)}>
              {ar.label} <span className="count">{n} {n === 1 ? 'table' : 'tables'}</span>
            </button>
          );
        })}
        <select
          className="add-area" aria-label="Add an area" value=""
          onChange={(e) => {
            const kind = e.target.value as (typeof KINDS)[number]['value'];
            if (!kind) return;
            // Worked out first: set() may apply the change after this handler returns.
            const key = nextAreaKey(a.seating.areas, kind);
            set((d) => void addArea(d, kind));
            choose(key);
          }}
        >
          <option value="">+ Add area</option>
          {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </div>
      <div className="floor-edit">
        <div className="floor-wrap">
          <div className="row-tools plan-tools">
            <button type="button" className="small" onClick={() => {
              const key = `T${nextTableKey(a.seating.tables)}`;
              set((d) => addTable(d, area.key, 4));
              setSel(key);
            }}>+ Table</button>
            <span className="tool-group" role="group" aria-label="Add to the room, for looks">
              {(['bar', 'door', 'window', 'wall'] as const).map((k) => (
                <button type="button" className="small ghost" key={k} onClick={() => {
                  const key = nextFixtureKey(a.seating.fixtures);
                  set((d) => addFixture(d, area.key, k));
                  setSel(key);
                }}>+ {FIXTURE_LABEL[k].replace(' counter', '')}</button>
              ))}
            </span>
            <span className="spacer" />
            <ZoomControls zoom={zoom} setZoom={setZoom} />
          </div>
          {offer ? (
            <div className="join-offer" role="status">
              <span>{label(offer.a)} is next to {label(offer.b)}. Do they push together for bigger groups?</span>
              <button type="button" className="small primary" onClick={() => {
                set((d) => addJoin(d.seating.tables, offer.a, offer.b));
                setOffer(null);
              }}>Join them</button>
              <button type="button" className="small ghost" onClick={() => setOffer(null)}>Not now</button>
            </div>
          ) : null}
          <div className="plan-scroll">
            <FloorPlan
              mode="edit"
              area={area.key}
              zoom={zoom}
              label={`${area.label}: drag tables to arrange them`}
              tables={a.seating.tables.map((x) => {
                const ar = a.seating.areas.find((z) => z.key === x.area);
                const bookable = a.serve.reservations && !x.walk_in && Boolean(ar?.reservable) && !ar?.enquiry_only && ar?.weather_rule !== 'walk_in_only';
                return { ...x, bookable, tag: unbookableTag({ walk_in: x.walk_in, bookable }, ar) };
              })}
              fixtures={a.seating.fixtures}
              areas={a.seating.areas}
              selected={sel}
              onSelect={setSel}
              onNote={toast}
              onTouch={(x, y) => setOffer({ a: x, b: y })}
              onMove={(key, x, y) => set((d) => {
                const tb = d.seating.tables.find((z) => z.key === key);
                if (tb) Object.assign(tb, { x: Math.max(1, x), y: Math.max(1, y) });
              })}
              onMoveFixture={(key, x, y) => set((d) => {
                const fx = d.seating.fixtures.find((z) => z.key === key);
                if (fx) Object.assign(fx, { x: Math.max(0, x), y: Math.max(0, y) });
              })}
            />
          </div>
          <div className="row-tools">
            <span className="muted small">{mine.length} tables · {mine.reduce((n, x) => n + x.seats, 0)} seats in {area.label}</span>
            <span className="spacer" />
            <button type="button" className="small" onClick={() => confirm(`Put every table in ${area.label} back in tidy rows?`) && set((d) => {
              for (const tb of d.seating.tables.filter((x) => x.area === area.key)) Object.assign(tb, { x: 0, y: 0 });
              d.seating.tables = autoLayout(d.seating.areas, d.seating.tables);
            })}>Tidy into rows</button>
          </div>
        </div>

        <aside className="table-panel">
          {f ? (
            <div className="fields">
              <h3 className="sub">{FIXTURE_LABEL[f.kind]}</h3>
              <p className="muted small">For looks only: tables can sit anywhere.</p>
              <div className="field">
                <label htmlFor="fx-length">{f.kind === 'door' ? 'Width' : 'Length'}</label>
                <input
                  id="fx-length" type="range" min={FIXTURE_LENGTH[f.kind].min} max={FIXTURE_LENGTH[f.kind].max} step={10} value={f.length}
                  onChange={(e) => set((d) => void (d.seating.fixtures.find((z) => z.key === f.key)!.length = Number(e.target.value)))}
                />
              </div>
              <div className="row">
                <button type="button" className="small" onClick={() => set((d) => {
                  const fx = d.seating.fixtures.find((z) => z.key === f.key)!;
                  fx.rotation = (fx.rotation + 90) % 360;
                })}>Turn</button>
                <button type="button" className="ghost small danger" onClick={() => {
                  set((d) => void (d.seating.fixtures = d.seating.fixtures.filter((z) => z.key !== f.key)));
                  setSel(null);
                }}>Remove</button>
              </div>
            </div>
          ) : !t ? (
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
                <select id="tb-area" value={t.area} onChange={(e) => {
                  const to = e.target.value;
                  set((d) => {
                    const tb = d.seating.tables[idx];
                    for (const j of tb.joins) removeJoin(d.seating.tables, tb.key, j);
                    tb.area = to;
                    Object.assign(tb, { x: 0, y: 0 });
                    d.seating.tables = autoLayout(d.seating.areas, d.seating.tables);
                  });
                  // Follow the table to its new area.
                  setTab(to);
                }}>
                  {a.seating.areas.map((ar) => <option key={ar.key} value={ar.key}>{ar.label}</option>)}
                </select>
              </div>
              <div className="checks">
                <label><input type="checkbox" checked={t.accessible} onChange={(e) => set((d) => void (d.seating.tables[idx].accessible = e.target.checked))} /> Step-free, room for a wheelchair</label>
                <label><input type="checkbox" checked={t.walk_in} onChange={(e) => set((d) => void (d.seating.tables[idx].walk_in = e.target.checked))} /> Kept for walk-ins: never booked by phone, so it stays free in the diary</label>
                <label><input type="checkbox" checked={t.rotation % 180 === 90} onChange={(e) => set((d) => void (d.seating.tables[idx].rotation = e.target.checked ? 90 : 0))} /> Turned sideways</label>
              </div>
              <fieldset className="chips">
                <legend>Features</legend>
                {FEATURES.map((ft) => (
                  <label key={ft.key} className={t.features.includes(ft.key) ? 'on' : ''}>
                    <input type="checkbox" checked={t.features.includes(ft.key)} onChange={(e) => set((d) => {
                      const tb = d.seating.tables[idx];
                      tb.features = e.target.checked ? [...tb.features, ft.key] : tb.features.filter((x) => x !== ft.key);
                    })} />
                    {ft.label}
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
