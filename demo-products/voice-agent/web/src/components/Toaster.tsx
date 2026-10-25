import { useEffect, useState } from 'react';

type Toast = { id: number; text: string };
const listeners = new Set<(t: Toast) => void>();
let next = 1;

export function toast(text: string): void {
  const t = { id: next++, text };
  for (const fn of listeners) fn(t);
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const add = (t: Toast) => {
      setItems((list) => [...list.slice(-2), t]);
      setTimeout(() => setItems((list) => list.filter((x) => x.id !== t.id)), 4500);
    };
    listeners.add(add);
    return () => void listeners.delete(add);
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div className="toast" key={t.id}>{t.text}</div>
      ))}
    </div>
  );
}
