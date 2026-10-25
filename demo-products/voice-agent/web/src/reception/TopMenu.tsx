// The top bar's "More" button. On a phone the bar keeps to one row: the logo,
// the business's name and a short chip or two, with everything else in a
// small sheet under this button. On anything wider the same buttons sit in
// the bar as before: the sheet's box is display: contents there and the
// button hidden (phone.css), so each button keeps the one set of handlers
// and the one place in the page, whatever the size of the window.

import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';

const PHONE = '(max-width: 640px)';

export function TopMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const id = useId();
  /** When it last closed: a tap on plain page right after should not leave focus nowhere. */
  const closedAt = useRef(0);

  /**
   * Focus goes back to the button without moving the page, unless the sheet was put away from the keyboard: a
   * tap further down a scrolled page would otherwise jump it back to the top and land on whatever then sat under
   * the finger. From the keyboard the page may scroll, so that the focus can be seen.
   */
  const close = (byKey = false) => {
    setOpen(false);
    closedAt.current = Date.now();
    button.current?.focus({ preventScroll: !byKey });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
    };
    // A tap anywhere else closes it; whatever was tapped still gets the tap. Heard on the way down, before the
    // page's own handlers: a floor-plan table stops its pointerdown going further, and the sheet would stay open.
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!sheet.current?.contains(t) && !button.current?.contains(t)) close();
    };
    // Turned into a wide window, the sheet is the bar again: nothing is left open behind it.
    const wide = matchMedia(PHONE);
    const onWide = () => setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown, true);
    wide.addEventListener('change', onWide);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown, true);
      wide.removeEventListener('change', onWide);
    };
  }, [open]);

  // A phone turned from landscape to upright folds the bar's buttons into the closed sheet. Focus on one of
  // them would drop to the page with nothing to say so; it goes to More, where those buttons now are.
  useEffect(() => {
    const phone = matchMedia(PHONE);
    const onPhone = () => {
      if (phone.matches && sheet.current?.contains(document.activeElement)) button.current?.focus({ preventScroll: true });
    };
    phone.addEventListener('change', onPhone);
    return () => phone.removeEventListener('change', onPhone);
  }, []);

  // Picking an item closes the sheet and puts focus back on the button first,
  // so a dialog the item opens (the voice) hands focus back there when it
  // shuts. An item that opens something inside the sheet (the clock's form)
  // keeps it open; that form closes it when it is sent.
  const picked = (e: MouseEvent) => {
    if (!open) return;
    const item = (e.target as Element).closest('button, a');
    if (!item || !sheet.current?.contains(item) || item.matches('[aria-expanded], [type=submit]')) return;
    close();
  };

  return (
    <>
      <button
        type="button" ref={button} className="rx-more-button" aria-label="More" aria-expanded={open} aria-controls={id}
        onClick={() => setOpen(!open)}
        onBlur={(e) => {
          // The tap that closed the sheet lands on plain page a moment later (on a touch screen, after the
          // finger lifts) and the browser drops focus to the page; it comes back here. A tap on a box or a
          // button still focuses that, and so does a drawer the tap opened: it comes back only if nothing has.
          if (!e.relatedTarget && Date.now() - closedAt.current < 1000) {
            setTimeout(() => {
              if (!document.activeElement || document.activeElement === document.body) button.current?.focus({ preventScroll: true });
            });
          }
        }}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      <div
        id={id} ref={sheet} className="rx-more" data-open={open || undefined}
        onClickCapture={picked} onSubmit={() => { if (open) close(); }}
        onBlur={(e) => {
          // Tabbed out past the last item: closed, focus left where it went.
          const to = e.relatedTarget as Node | null;
          if (open && to && !sheet.current?.contains(to) && to !== button.current) setOpen(false);
        }}
      >
        {children}
      </div>
    </>
  );
}
