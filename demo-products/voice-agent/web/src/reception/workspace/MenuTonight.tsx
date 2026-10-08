// A takeaway's Menu tonight (presets/takeaway.md §6): switch a dish off when
// it runs out, and put up one notice for callers, delivery paused or long
// waits. The receptionist reads both on every order tool, so a call in
// progress hears the change at once. It all starts again tomorrow.

import { demoApi } from '../../api.ts';
import { toast } from '../../components/Toaster.tsx';
import type { LiveState, Tonight } from '../types.ts';

const WAITS = [45, 60, 75, 90, 120];

export function MenuTonight({ id, state, onDone }: { id: string; state: LiveState; onDone: () => void }) {
  const t = state.tonight;
  if (!t) return null;
  const save = async (next: Pick<Tonight, 'sold_out' | 'notice'>, said: string) => {
    try {
      await demoApi(`/workspaces/${id}/tonight`, { method: 'PATCH', json: next });
      toast(said);
      onDone();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const flip = (key: string, name: string) => {
    const out = t.sold_out.includes(key);
    void save({ sold_out: out ? t.sold_out.filter((k) => k !== key) : [...t.sold_out, key], notice: t.notice }, out ? `${name} is back on.` : `${name}: sold out tonight. Callers are offered something else.`);
  };
  const notice = t.notice?.kind ?? 'none';
  return (
    <div className="tonight">
      <fieldset className="choice">
        <legend>Tell callers</legend>
        <label>
          <input type="radio" name="notice" checked={notice === 'none'} onChange={() => save({ sold_out: t.sold_out, notice: null }, 'No notice tonight.')} /> Nothing: business as usual
        </label>
        {t.delivery ? (
          <label>
            <input type="radio" name="notice" checked={notice === 'delivery_paused'} onChange={() => save({ sold_out: t.sold_out, notice: { kind: 'delivery_paused' } }, 'Delivery paused: callers are offered collection.')} /> Delivery is paused tonight
          </label>
        ) : null}
        <label>
          <input type="radio" name="notice" checked={notice === 'long_waits'} onChange={() => save({ sold_out: t.sold_out, notice: { kind: 'long_waits', minutes: 90 } }, 'Long waits: callers hear about 90 minutes.')} /> Long waits:
          <select
            aria-label="How long" value={t.notice?.kind === 'long_waits' ? t.notice.minutes : 90} disabled={notice !== 'long_waits'}
            onChange={(e) => save({ sold_out: t.sold_out, notice: { kind: 'long_waits', minutes: Number(e.target.value) } }, `Long waits: callers hear about ${e.target.value} minutes.`)}
          >
            {WAITS.map((m) => <option key={m} value={m}>about {m} minutes</option>)}
          </select>
        </label>
      </fieldset>
      <h3 className="sub">Sold out tonight <span className="count">{t.sold_out.length || 'none'}</span></h3>
      <p className="hint">Tap a dish when it runs out. The receptionist says sorry and offers another from the same section, and a meal deal won't take it as a choice.</p>
      {t.menu.map((c) => (
        <section key={c.label} className="tonight-section" aria-label={c.label}>
          <h4>{c.label}</h4>
          <div className="chips">
            {c.items.filter((i) => !i.off).map((i) => {
              const out = t.sold_out.includes(i.key);
              return (
                <button key={i.key} type="button" className={`chip ${out ? 'out' : ''}`} aria-pressed={out} onClick={() => flip(i.key, i.name)}>
                  {i.name}{out ? ' · sold out' : ''}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
