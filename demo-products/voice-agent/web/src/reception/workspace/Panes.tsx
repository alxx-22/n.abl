// The call and the phone either side of the back office can slide away to a
// bookmark on the window's edge, so the back office gets their room. On a
// desktop or laptop they start docked, and the call's width can be dragged;
// on a tablet or phone they start slid away and open over the back office as
// drawers. A call keeps running while its panel is away, and its bookmark
// says so, so it is never lost. Each browser remembers its own choice.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { narrowBand, useBand, type Band } from '../bands.ts';

export type Pane = 'call' | 'phone';

interface Saved {
  call: boolean;
  phone: boolean;
  /** The call panel's width in pixels; null keeps the layout's own. */
  callW: number | null;
}

const KEY = 'rx-workspace-panes';
const MIN_W = 300;

function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null;
    if (s && typeof s === 'object') return { call: s.call !== false, phone: s.phone !== false, callW: typeof s.callW === 'number' ? s.callW : null };
  } catch {
    // Storage blocked or spoilt: the panels start docked, as on a first visit.
  }
  return { call: true, phone: true, callW: null };
}

function store(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Not remembered this time; the page works the same.
  }
}

export interface Panes {
  band: Band;
  narrow: boolean;
  /** Which drawer is open over the back office, on a tablet or phone. */
  drawer: Pane | null;
  isOpen(p: Pane): boolean;
  show(p: Pane): void;
  hide(p: Pane): void;
  /** For the workspace: which panels are away, and the call's width. */
  className: string;
  style: CSSProperties | undefined;
  callW: number | null;
  setCallW(w: number | null): void;
  mark(p: Pane): React.RefObject<HTMLButtonElement | null>;
  caret(p: Pane): React.RefObject<HTMLButtonElement | null>;
  /** When the call began, while there is one. */
  callSince: number | null;
  /** Texts that reached the phone while it was away. */
  unseen: number;
}

/**
 * `texts`: how many texts the phone holds (-1 until it has looked), so the
 * ones that arrive while it is away can be counted on its bookmark; the ones
 * already there when the page opened are not news.
 */
export function usePanes(onCall: boolean, texts: number): Panes {
  const band = useBand();
  const narrow = narrowBand(band);
  const [saved, setSaved] = useState(load);
  const [drawer, setDrawer] = useState<Pane | null>(null);
  const marks = { call: useRef<HTMLButtonElement>(null), phone: useRef<HTMLButtonElement>(null) };
  const carets = { call: useRef<HTMLButtonElement>(null), phone: useRef<HTMLButtonElement>(null) };
  /** Where focus goes once the panel has moved: into an opened one, or back to the bookmark of one put away. */
  const focusNext = useRef<React.RefObject<HTMLButtonElement | null> | null>(null);
  const [callSince, setCallSince] = useState<number | null>(null);

  const update = useCallback((next: Saved) => {
    setSaved(next);
    store(next);
  }, []);
  const isOpen = (p: Pane) => (narrow ? drawer === p : saved[p]);
  const show = (p: Pane) => {
    focusNext.current = carets[p];
    if (narrow) setDrawer(p);
    else update({ ...saved, [p]: true });
  };
  const hide = (p: Pane) => {
    focusNext.current = marks[p];
    if (narrow) setDrawer(null);
    else update({ ...saved, [p]: false });
  };

  useEffect(() => {
    const target = focusNext.current?.current;
    if (target) {
      focusNext.current = null;
      target.focus();
    }
  });
  // A drawer left open while the window widens would cover nothing; the docked panels take over.
  useEffect(() => {
    if (!narrow) setDrawer(null);
  }, [narrow]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      focusNext.current = marks[drawer];
      setDrawer(null);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [drawer]);
  useEffect(() => {
    setCallSince((s) => (onCall ? s ?? Date.now() : null));
  }, [onCall]);
  const seen = useRef(texts);
  const callAway = !isOpen('call');
  const phoneAway = !isOpen('phone');
  useEffect(() => {
    if (!phoneAway || seen.current < 0) seen.current = texts;
  });

  return {
    band, narrow, drawer, isOpen, show, hide, callSince,
    unseen: phoneAway && seen.current >= 0 ? Math.max(0, texts - seen.current) : 0,
    className: `${callAway ? 'call-away' : ''} ${phoneAway ? 'phone-away' : ''}`.trim(),
    style: saved.callW ? ({ '--call-col': `clamp(${MIN_W}px, ${saved.callW}px, 45vw)` } as CSSProperties) : undefined,
    callW: saved.callW,
    setCallW: (w) => update({ ...saved, callW: w }),
    mark: (p) => marks[p],
    caret: (p) => carets[p],
  };
}

const NAMES: Record<Pane, string> = { call: 'the call', phone: "the customer's phone" };

/** The slim tab a panel leaves on the window's edge when it slides away. */
export function Bookmark({ panes, pane, icon, label, badge }: { panes: Panes; pane: Pane; icon: ReactNode; label: string; badge?: number }) {
  if (panes.isOpen(pane)) return null;
  const live = pane === 'call' ? panes.callSince : null;
  return (
    <button
      type="button" ref={panes.mark(pane)} className={`ws-bookmark ${live ? 'live' : ''}`} data-pane={pane}
      aria-expanded={false} aria-controls={`ws-${pane}`} onClick={() => panes.show(pane)}
      aria-label={`${label}: show ${NAMES[pane]}${live ? ', a call is on' : ''}${badge ? `, ${badge} new ${badge === 1 ? 'text' : 'texts'}` : ''}`}
    >
      <span className="bm-icon" aria-hidden="true">{icon}</span>
      <span className="bm-label" aria-hidden="true">{label}</span>
      {live ? <span className="bm-live" aria-hidden="true"><span className="dot live" /><CallTime since={live} /></span> : null}
      {badge ? <span className="bm-count" aria-hidden="true">{badge}</span> : null}
      <span className="bm-caret" aria-hidden="true" />
    </button>
  );
}

/** The minutes and seconds of the call so far; it ticks on its own, so the workspace doesn't redraw every second. */
function CallTime({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return <time className="mono">{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</time>;
}

/** The button in a docked panel (or an open drawer) that slides it away. */
export function PaneCaret({ panes, pane }: { panes: Panes; pane: Pane }) {
  return (
    <button
      type="button" ref={panes.caret(pane)} className="pane-caret" aria-expanded={true} aria-controls={`ws-${pane}`}
      aria-label={panes.narrow ? `Close ${NAMES[pane]}` : `Slide ${NAMES[pane]} away`} title={panes.narrow ? 'Close' : 'Slide away'}
      onClick={() => panes.hide(pane)}
    >
      <span className="caret" aria-hidden="true" />
    </button>
  );
}

/** The call panel's inner edge: drag it, or use the arrow keys, to make the call wider or narrower. */
export function CallResize({ panes }: { panes: Panes }) {
  const drag = useRef<{ x: number; w: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  if (panes.narrow || (!panes.isOpen('call') && (panes.band === 'desktop' || !panes.isOpen('phone')))) return null;
  // On a laptop the call and the phone share the column, so the column is what is sized.
  const column = () => document.querySelector(panes.band === 'desktop' ? '.ws-call' : '.ws-side')?.getBoundingClientRect().width ?? 360;
  const max = () => Math.max(MIN_W, Math.min(640, innerWidth - (panes.band === 'desktop' && panes.isOpen('phone') ? 300 : 0) - 560));
  const set = (w: number) => panes.setCallW(Math.round(Math.min(max(), Math.max(MIN_W, w))));
  const now = Math.round(panes.callW ?? column());
  return (
    <div
      className={`ws-resize ${dragging ? 'dragging' : ''}`} role="separator" aria-orientation="vertical" tabIndex={0}
      aria-label="Width of the call panel" aria-controls="ws-call" aria-valuemin={MIN_W} aria-valuemax={max()} aria-valuenow={now}
      title="Drag to resize the call panel; double-click for its usual width"
      onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, w: column() };
        setDragging(true);
      }}
      onPointerMove={(e: PointerEvent<HTMLDivElement>) => {
        if (drag.current) set(drag.current.w + e.clientX - drag.current.x);
      }}
      onPointerUp={() => {
        drag.current = null;
        setDragging(false);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
      }}
      onDoubleClick={() => panes.setCallW(null)}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        const step = e.shiftKey ? 80 : 24;
        if (e.key === 'ArrowLeft') set(now - step);
        else if (e.key === 'ArrowRight') set(now + step);
        else if (e.key === 'Home') set(MIN_W);
        else if (e.key === 'End') set(max());
        else return;
        e.preventDefault();
      }}
    />
  );
}
