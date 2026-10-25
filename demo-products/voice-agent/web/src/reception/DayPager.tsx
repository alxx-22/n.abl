// One day at a time, with ‹ › either side, for phones. Alex's ask: on a phone
// the row of dates wrapped to three rows above the floor plan, the timeline
// and the diaries; a pager takes one row, a swipe moves a day, and a tap on
// the day lists them all to jump to. The same pager steps through a floor's
// areas, a repairs day's visit windows and the days of the opening hours.
//
// Wide screens keep their strip of buttons: `StripOrPager` picks the strip on
// a desktop or laptop, the pager on a phone, and on a tablet the pager only
// where the strip would not fit on one row.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useBand } from './bands.ts';
import { useSwipe } from './useSwipe.ts';
import './pager.css';

export { farDay, withShown } from './dayList.ts';

export interface PagerItem {
  key: string;
  /** What the middle shows: "Today", "Inside", "Morning". */
  label: string;
  /** Beside it, quieter: "Thu 10", "08:00–12:00". */
  detail?: string;
  /** A small number beside it, as the strip shows: a day's bookings, an area's free tables. */
  count?: number | string | null;
  /** The count as said aloud: "38 bookings". */
  spoken?: string;
}

const withArticle = (noun: string) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
const said = (it: PagerItem) => [it.label, it.detail, it.spoken ?? (it.count != null ? String(it.count) : '')].filter(Boolean).join(', ');

export function Pager({ items, value, onChange, noun, label, swipeParent = false, list = true, className = '' }: {
  items: PagerItem[];
  value: string;
  onChange: (key: string) => void;
  /** What one item is: the buttons say "Previous day" and "Next day". */
  noun: string;
  /** The group's name for a screen reader; the noun, capitalised, if not given. */
  label?: string;
  /** Swipes across the whole element the pager sits in (the day's screen), not only its own row. */
  swipeParent?: boolean;
  /** A tap on the middle lists every item to jump to; false where the screen has its own way to jump. */
  list?: boolean;
  className?: string;
}) {
  // Screens add the item they show when it is not among their own (withShown), so this finds it.
  const i = Math.max(0, items.findIndex((it) => it.key === value));
  const item: PagerItem | undefined = items[i];
  const [open, setOpen] = useState(false);
  const row = useRef<HTMLDivElement>(null);
  const middle = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  // Said when the item changes (a swipe, an arrow, a jump), not each time its count refreshes during a call;
  // left unsaid after a pick from the list, where the focus lands on the middle and it says the same.
  const [heard, setHeard] = useState('');
  const lastKey = useRef(item?.key);
  const quiet = useRef(false);
  useEffect(() => {
    if (item && item.key !== lastKey.current) setHeard(quiet.current ? '' : said(item));
    quiet.current = false;
    lastKey.current = item?.key;
  }, [item?.key]);

  // At the ends an arrow stays where it is and does nothing (aria-disabled, not disabled, which would drop
  // its focus): one more press of the key that reached the last day must not land on another button.
  const go = (n: -1 | 1) => {
    const to = items[i + n];
    if (to) onChange(to.key);
  };
  const swipe = useSwipe(go);
  // The day's screen is the element the pager heads (past the box StripOrPager measures it in, on a tablet).
  const attach = useCallback((el: HTMLDivElement | null) => {
    let host = swipeParent ? el?.parentElement ?? null : el;
    if (swipeParent && host?.classList.contains('pager-fit')) host = host.parentElement;
    return swipe(host);
  }, [swipe, swipeParent]);
  const setRow = useCallback((el: HTMLDivElement | null) => {
    row.current = el;
    return attach(el);
  }, [attach]);

  // A tap anywhere else closes the list.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!row.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  // Opened: the chosen one has the focus, so arrows and Enter work at once.
  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.focus();
  }, [open]);

  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    // Not while the list is open: the day would change under it, away from the item with the focus.
    if (!open && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      go(e.key === 'ArrowLeft' ? -1 : 1);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
      middle.current?.focus();
    } else if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const all = [...(listRef.current?.querySelectorAll<HTMLElement>('button') ?? [])];
      const at = all.indexOf(document.activeElement as HTMLElement);
      const to = all[Math.min(all.length - 1, Math.max(0, at + (e.key === 'ArrowDown' ? 1 : -1)))];
      if (to) {
        e.preventDefault();
        to.focus();
      }
    }
  };

  if (!item) return null;
  const now = said(item);
  const face = (it: PagerItem) => (
    <>
      <span className="pager-text">
        <span className="pager-label">{it.label}</span>
        {it.detail ? <span className="pager-detail">{it.detail}</span> : null}
      </span>
      {it.count != null ? <span className="count">{it.count}</span> : null}
    </>
  );
  return (
    <div
      className={`pager ${className}`} role="group" aria-label={label ?? noun[0].toUpperCase() + noun.slice(1)} ref={setRow} onKeyDown={keys}
      // Tabbing on out of the open list closes it, as a tap elsewhere does.
      onBlur={(e) => {
        if (open && e.relatedTarget instanceof Node && !e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button type="button" className="pager-step" aria-label={`Previous ${noun}`} aria-disabled={i === 0 || undefined} onClick={() => go(-1)}>
        <Chevron turn={180} />
      </button>
      {list ? (
        <button
          type="button" ref={middle} className="pager-now" aria-expanded={open} aria-controls={open ? listId : undefined}
          aria-label={`${now}. Choose another ${noun}`} onClick={() => setOpen(!open)}
        >
          {face(item)}
          <Chevron turn={90} small />
        </button>
      ) : (
        <span className="pager-now still">{face(item)}</span>
      )}
      <button type="button" className="pager-step" aria-label={`Next ${noun}`} aria-disabled={i === items.length - 1 || undefined} onClick={() => go(1)}>
        <Chevron turn={0} />
      </button>
      {/* So a screen reader hears where a swipe or an arrow has moved it. */}
      <span className="visually-hidden" aria-live="polite" aria-atomic="true">{heard}</span>
      {open ? (
        // A swipe across the list scrolls it, not the day under it.
        <ul className="pager-list" id={listId} ref={listRef} aria-label={`Choose ${withArticle(noun)}`} data-no-swipe>
          {items.map((it) => (
            <li key={it.key}>
              <button
                type="button" aria-current={it.key === item.key ? 'true' : undefined} aria-label={said(it)}
                onClick={() => {
                  setOpen(false);
                  middle.current?.focus();
                  quiet.current = it.key !== item.key;
                  onChange(it.key);
                }}
              >
                {face(it)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * A day for the pager. `label` is the screen's own name for it ("Today",
 * "Mon 12"); today and tomorrow also show their date, so "Today · Thu 10".
 * `count` is the day's bookings, where the screen counts them.
 */
export function dayItem(date: string, label: string, count?: number): PagerItem {
  const short = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
  return {
    key: date, label,
    detail: /^(Today|Tomorrow)$/.test(label) ? short : undefined,
    count: count || null,
    spoken: count === undefined ? undefined : `${count || 'no'} ${count === 1 ? 'booking' : 'bookings'}`,
  };
}

/** The day pager: a list of days, each a key like 2026-10-10. */
export function DayPager(props: { days: PagerItem[]; value: string; onChange: (day: string) => void; swipeParent?: boolean }) {
  return <Pager items={props.days} value={props.value} onChange={props.onChange} noun="day" swipeParent={props.swipeParent} />;
}

/**
 * `strip` on a desktop or laptop, `pager` on a phone; on a tablet, the strip
 * while it fits on one row and the pager once it would wrap (a narrow tablet,
 * a long week of counts).
 */
export function StripOrPager({ strip, pager }: { strip: ReactNode; pager: ReactNode }) {
  const band = useBand();
  const tablet = band === 'tablet';
  const box = useRef<HTMLDivElement>(null);
  const [tooWide, setTooWide] = useState(false);
  // The strip's own width, measured while it shows, kept to compare against once the pager has taken its place.
  const need = useRef(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !tablet) return;
    const check = () => {
      const strip = el.firstElementChild;
      if (strip && !strip.classList.contains('pager')) {
        const kids = [...strip.children];
        const gap = parseFloat(getComputedStyle(strip).columnGap) || 0;
        need.current = kids.reduce((n, k) => n + k.getBoundingClientRect().width, 0) + gap * Math.max(0, kids.length - 1);
      }
      setTooWide(need.current > el.clientWidth + 1);
    };
    check();
    const watch = new ResizeObserver(check);
    watch.observe(el);
    // The strip too, while it shows: a day's count arriving during a call can wrap it with no change of width.
    if (!tooWide && el.firstElementChild) watch.observe(el.firstElementChild);
    return () => watch.disconnect();
  }, [tablet, tooWide]);
  if (band === 'phone') return <>{pager}</>;
  if (!tablet) return <>{strip}</>;
  return <div className="pager-fit" ref={box}>{tooWide ? pager : strip}</div>;
}

function Chevron({ turn, small = false }: { turn: number; small?: boolean }) {
  const s = small ? 12 : 18;
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={small ? 2 : 2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: `rotate(${turn}deg)` }}>
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}
