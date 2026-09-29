// Two pages, so a few lines of history handling instead of a router library.

import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';

const listeners = new Set<() => void>();

export function navigate(to: string): void {
  history.pushState(null, '', to);
  window.scrollTo(0, 0);
  for (const fn of listeners) fn();
}

export function usePath(): string {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const update = () => setPath(location.pathname);
    listeners.add(update);
    window.addEventListener('popstate', update);
    return () => {
      listeners.delete(update);
      window.removeEventListener('popstate', update);
    };
  }, []);
  return path;
}

export function Link({ to, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const click = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={click} {...rest} />;
}
