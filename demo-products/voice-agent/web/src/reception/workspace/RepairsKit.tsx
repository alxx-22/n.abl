// What the repairs contractor's lists share: chips and a search to narrow a
// long list to the few rows that matter now, and a panel that opens over the
// right of the window with a row's detail, so the list keeps its place.

import { useEffect, useId, useRef, type ReactNode } from 'react';

/** Filter chips: one pressed at a time, each with how many rows it would show. */
export function Chips<K extends string>({ label, chips, value, onChange }: {
  label: string;
  chips: { key: K; label: string; n: ReactNode }[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <div className="rp-chips" role="group" aria-label={label}>
      {chips.map((c) => (
        <button key={c.key} type="button" className="rp-chip" aria-pressed={value === c.key} onClick={() => onChange(c.key)}>
          {c.label} <span className="n">{c.n}</span>
        </button>
      ))}
    </div>
  );
}

export function Search({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="rp-search">
      <label htmlFor={id} className="visually-hidden">{label}</label>
      <input id={id} type="search" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/**
 * A row's detail in a panel over the right of the window: a modal dialog, so
 * Escape closes it and focus stays inside until it does, then goes back to
 * the row that opened it. A toast sits behind the panel, so what an action
 * did is said in the panel too (`said`).
 */
export function Sheet({ title, sub, said, onClose, children }: { title: string; sub?: ReactNode; said?: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const back = useRef<HTMLElement | null>(null);
  const titleId = useId();
  useEffect(() => {
    const d = dialog.current;
    // Development runs effects twice: open once, and remember what had focus before it opened.
    if (!d || d.open) return;
    back.current = document.activeElement as HTMLElement | null;
    d.showModal();
  }, []);
  return (
    <dialog ref={dialog} className="rp-sheet" aria-labelledby={titleId} onClose={() => { onClose(); back.current?.focus(); }}>
      <header className="rp-sheet-head">
        <div>
          <h3 id={titleId}>{title}</h3>
          {sub ? <p className="muted small">{sub}</p> : null}
        </div>
        <button type="button" className="ghost" aria-label="Close" onClick={() => dialog.current?.close()}>✕</button>
      </header>
      <p className="rp-said small" role="status">{said}</p>
      {children}
    </dialog>
  );
}
