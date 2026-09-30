// Small form pieces the builder's steps share.

import { useEffect, useId, useState, type ReactNode } from 'react';

export function Field({ label, hint, children, id }: { label: ReactNode; hint?: ReactNode; children: (id: string) => ReactNode; id?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="field">
      <label htmlFor={fid}>{label}</label>
      {children(fid)}
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function Text(props: { label: ReactNode; value: string; onChange: (v: string) => void; hint?: ReactNode; placeholder?: string; max?: number; area?: boolean; rows?: number }) {
  return (
    <Field label={props.label} hint={props.hint}>
      {(id) =>
        props.area ? (
          <textarea id={id} className="prose" rows={props.rows ?? 3} maxLength={props.max} placeholder={props.placeholder} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
        ) : (
          <input id={id} maxLength={props.max} placeholder={props.placeholder} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
        )
      }
    </Field>
  );
}

/** A number field that lets the box be empty while typing. */
export function Num(props: { label: ReactNode; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; hint?: ReactNode; suffix?: string }) {
  const [text, setText] = useState(String(props.value));
  useEffect(() => setText(String(props.value)), [props.value]);
  return (
    <Field label={props.label} hint={props.hint}>
      {(id) => (
        <span className="num-field">
          <input
            id={id} type="number" inputMode="numeric" min={props.min} max={props.max} step={props.step ?? 1} value={text}
            onChange={(e) => {
              setText(e.target.value);
              const n = Number(e.target.value);
              if (e.target.value !== '' && Number.isFinite(n)) props.onChange(Math.min(props.max, Math.max(props.min, n)));
            }}
            onBlur={() => setText(String(props.value))}
          />
          {props.suffix ? <span className="muted">{props.suffix}</span> : null}
        </span>
      )}
    </Field>
  );
}

/** Pence in, pounds on screen. */
export function Pounds(props: { label: ReactNode; pence: number; onChange: (pence: number) => void; hint?: ReactNode; max?: number }) {
  const [text, setText] = useState((props.pence / 100).toFixed(2));
  useEffect(() => setText((props.pence / 100).toFixed(2)), [props.pence]);
  return (
    <Field label={props.label} hint={props.hint}>
      {(id) => (
        <span className="num-field money">
          <span className="muted">£</span>
          <input
            id={id} inputMode="decimal" value={text}
            onChange={(e) => {
              setText(e.target.value);
              const n = Number(e.target.value.replace(/[£,\s]/g, ''));
              if (Number.isFinite(n) && n >= 0) props.onChange(Math.min(props.max ?? 1_000_000, Math.round(n * 100)));
            }}
            onBlur={() => setText((props.pence / 100).toFixed(2))}
          />
        </span>
      )}
    </Field>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className="toggle">
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>
        <span>{label}</span>
        {hint ? <span className="hint">{hint}</span> : null}
      </label>
    </div>
  );
}

export function Choice<T extends string>({ legend, value, options, onChange }: { legend: ReactNode; value: T; options: { value: T; label: ReactNode; hint?: ReactNode }[]; onChange: (v: T) => void }) {
  const name = useId();
  return (
    <fieldset className="choice">
      <legend>{legend}</legend>
      {options.map((o) => (
        <label key={o.value}>
          <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>
            {o.label}
            {o.hint ? <span className="hint"> {o.hint}</span> : null}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export function Select<T extends string | number>({ label, value, options, onChange, hint }: { label: ReactNode; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; hint?: ReactNode }) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <select id={id} value={String(value)} onChange={(e) => onChange(options.find((o) => String(o.value) === e.target.value)!.value)}>
          {options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
          ))}
        </select>
      )}
    </Field>
  );
}

/** A mark beside anything the website scout filled in. */
export function Source({ of, sources }: { of: string; sources: Record<string, 'website' | 'guess'> }) {
  const s = sources[of];
  if (!s) return null;
  return <span className={`source ${s}`}>{s === 'website' ? 'from your website' : 'our guess: check it'}</span>;
}
