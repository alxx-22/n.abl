// Opening hours, for any kind of business: a week of days, each open or shut,
// with up to three named periods (the restaurant's lunch and dinner
// services), and the days it is closed outside the pattern. What a new period
// is called and when it runs come from the preset; its own hours fields (the
// restaurant's last booking) go in as children, after the week.

import type { ReactNode } from 'react';
import type { ServicePeriod } from '../../../../../src/presets/common/types.ts';
import { Source, Toggle } from '../fields.tsx';
import type { StepProps } from '../registry.ts';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK = [1, 2, 3, 4, 5, 6, 0];

export interface HoursOptions {
  /** What a day gets when it is switched on. */
  day: ServicePeriod;
  /** Added to a day with no periods, then `next` for each one after. */
  first: ServicePeriod;
  next: ServicePeriod;
  /** One button that copies a day to others, 0 = Sunday. */
  copy: { from: number; to: number[]; label: string };
}

export function Hours({ a, set, options, children }: StepProps & { options: HoursOptions; children?: ReactNode }) {
  const { copy } = options;
  return (
    <div className="fields">
      <p className="lead">When you are open, and the services within each day. The receptionist only offers times inside these, and answers “are you open?” from them. <Source of="hours.days" sources={a.sources} /></p>
      <div className="hours">
        {WEEK.map((i) => {
          const day = a.hours.days[i];
          return (
            <div className="day-row" key={i}>
              <Toggle label={DAY_NAMES[i]} checked={day.open} onChange={(v) => set((d) => {
                d.hours.days[i].open = v;
                if (v && !d.hours.days[i].services.length) d.hours.days[i].services = [{ ...options.day }];
              })} />
              {day.open ? (
                <div className="services">
                  {day.services.map((sv, j) => (
                    <div className="service" key={j}>
                      <input aria-label={`${DAY_NAMES[i]} service name`} value={sv.label} maxLength={30} onChange={(e) => set((d) => void (d.hours.days[i].services[j].label = e.target.value))} />
                      <input aria-label={`${DAY_NAMES[i]} ${sv.label} opens`} type="time" step={900} value={sv.open} onChange={(e) => set((d) => void (d.hours.days[i].services[j].open = e.target.value))} />
                      <span className="muted">to</span>
                      <input aria-label={`${DAY_NAMES[i]} ${sv.label} closes`} type="time" step={900} value={sv.close} onChange={(e) => set((d) => void (d.hours.days[i].services[j].close = e.target.value))} />
                      <button type="button" className="ghost" aria-label={`Remove ${sv.label}`} onClick={() => set((d) => {
                        d.hours.days[i].services.splice(j, 1);
                        if (!d.hours.days[i].services.length) d.hours.days[i].open = false;
                      })}>✕</button>
                    </div>
                  ))}
                  {day.services.length < 3 ? (
                    <button type="button" className="ghost small" onClick={() => set((d) => void d.hours.days[i].services.push({ ...(d.hours.days[i].services.length ? options.next : options.first) }))}>
                      + Add a service
                    </button>
                  ) : null}
                </div>
              ) : (
                <span className="muted small">Closed</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="row-tools">
        <button type="button" className="small" onClick={() => set((d) => { const t = d.hours.days[copy.from]; for (const k of copy.to) d.hours.days[k] = structuredClone(t); })}>{copy.label}</button>
      </div>
      {children}
      <div className="field">
        <label>Closures</label>
        {a.hours.closures.map((c, j) => (
          <div className="field-row" key={j}>
            <input type="date" aria-label="Closed on" value={c.date} onChange={(e) => set((d) => void (d.hours.closures[j].date = e.target.value))} />
            <input aria-label="Reason" placeholder="Private event" maxLength={60} value={c.note} onChange={(e) => set((d) => void (d.hours.closures[j].note = e.target.value))} />
            <button type="button" className="ghost" aria-label="Remove closure" onClick={() => set((d) => void d.hours.closures.splice(j, 1))}>✕</button>
          </div>
        ))}
        <button type="button" className="ghost small" onClick={() => set((d) => void d.hours.closures.push({ date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), note: '' }))}>+ Add a closure</button>
        <p className="hint">Days you are shut outside the usual pattern: a holiday, a private hire.</p>
      </div>
    </div>
  );
}
