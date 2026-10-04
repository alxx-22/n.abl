// Opening hours, for any kind of business: a week of days, each open or shut,
// with up to three named periods (the restaurant's lunch and dinner
// services), and the days it is closed outside the pattern. What a new period
// is called and when it runs come from the preset; its own hours fields (the
// restaurant's last booking) go in as children, after the week.

import type { ReactNode } from 'react';
import type { DayHours, ServicePeriod } from '../../../../../src/presets/common/types.ts';
import { Source, Toggle } from '../fields.tsx';
import type { StepProps } from '../registry.ts';
import { MIDNIGHT, savedClose, shownClose } from './closing.ts';

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

const LEAD = 'When you are open, and the services within each day. The receptionist only offers times inside these, and answers “are you open?” from them.';

export function Hours({ a, set, options, lead = LEAD, add, children }: StepProps & { options: HoursOptions; lead?: string; add?: string; children?: ReactNode }) {
  return (
    <div className="fields">
      <p className="lead">{lead} <Source of="hours.days" sources={a.sources} /></p>
      <Week days={a.hours.days} edit={(fn) => set((d) => fn(d.hours.days))} options={options} add={add} />
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

/**
 * One week of days, each open or shut with up to three periods. `name` tells
 * the boxes apart when a step has more than one week (an estate agency's
 * office, viewings and valuations); `add` is what adding a period says.
 */
export function Week({ days, edit, options, name, add = '+ Add a service' }: { days: DayHours[]; edit: (fn: (days: DayHours[]) => void) => void; options: HoursOptions; name?: string; add?: string }) {
  const { copy } = options;
  const at = (i: number) => (name ? `${name} ${DAY_NAMES[i]}` : DAY_NAMES[i]);
  return (
    <>
      <div className="hours">
        {WEEK.map((i) => {
          const day = days[i];
          return (
            <div className="day-row" key={i}>
              <Toggle label={at(i)} checked={day.open} onChange={(v) => edit((w) => {
                w[i].open = v;
                if (v && !w[i].services.length) w[i].services = [{ ...options.day }];
              })} />
              {day.open ? (
                <div className="services">
                  {day.services.map((sv, j) => (
                    <div className="service" key={j}>
                      <input aria-label={`${at(i)} service name`} value={sv.label} maxLength={30} onChange={(e) => edit((w) => void (w[i].services[j].label = e.target.value))} />
                      <input aria-label={`${at(i)} ${sv.label} opens`} type="time" step={900} value={sv.open} onChange={(e) => edit((w) => void (w[i].services[j].open = e.target.value))} />
                      <span className="muted">to</span>
                      <input
                        aria-label={`${at(i)} ${sv.label} closes`} type="time" step={900} value={shownClose(sv.close)}
                        aria-describedby={sv.close === MIDNIGHT ? `midnight-${name ?? ''}${i}-${j}` : undefined}
                        onChange={(e) => edit((w) => void (w[i].services[j].close = savedClose(e.target.value)))}
                      />
                      <button type="button" className="ghost" aria-label={`Remove ${sv.label}`} onClick={() => edit((w) => {
                        w[i].services.splice(j, 1);
                        if (!w[i].services.length) w[i].open = false;
                      })}>✕</button>
                      {/* Last, so the boxes before it keep their place (and focus) when it appears. */}
                      {sv.close === MIDNIGHT ? <span className="hint midnight" id={`midnight-${name ?? ''}${i}-${j}`}>midnight</span> : null}
                    </div>
                  ))}
                  {day.services.length < 3 ? (
                    <button type="button" className="ghost small" onClick={() => edit((w) => void w[i].services.push({ ...(w[i].services.length ? options.next : options.first) }))}>
                      {add}
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
        <button type="button" className="small" onClick={() => edit((w) => { const t = w[copy.from]; for (const k of copy.to) w[k] = structuredClone(t); })}>{copy.label}</button>
        <span className="hint">The latest close is midnight: enter it as 00:00.</span>
      </div>
    </>
  );
}
