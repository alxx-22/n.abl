// The live workspace: ring the receptionist on the left, watch the back
// office in the middle, and the customer's phone on the right. Everything a
// call does arrives over the event stream and lands on all three at once.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { CALL_AS } from '../../../../src/presets/estate/personas.ts';
import { MT_CALL_AS } from '../../../../src/presets/maintenance/personas.ts';
import { ApiError, DEMO_API, demoApi } from '../../api.ts';
import { ResetIcon, SlidersIcon } from '../../components/Icons.tsx';
import { LivePanel } from '../../components/LivePanel.tsx';
import { SettingsDialog } from '../../components/SettingsDialog.tsx';
import { toast } from '../../components/Toaster.tsx';
import { initialStream, streamReducer } from '../../live/stream.ts';
import { useLiveCall } from '../../live/useLiveCall.ts';
import { Link } from '../../router.tsx';
import type { BoardEvent } from '../../types.ts';
import { R, RxTop, minutesUntil } from '../Reception.tsx';
import { brandStyle } from '../brand.ts';
import type { LiveBooking, LiveState, Me } from '../types.ts';
import { BookingDrawer } from './BookingDrawer.tsx';
import type { View } from './FloorBoard.tsx';
import { bookingOn, hhmm, localNow, servicesOn } from './model.ts';
import { Phone, usePhoneNumber } from './Phone.tsx';
import { fallbackSpec, focusTab, resetConfirm, resetToast, suggestionsFor } from './spec.ts';
import { viewsOf, type ViewId } from './views.tsx';

export function Workspace({ id, me, onUsage }: { id: string; me: Me; onUsage: () => void }) {
  const [state, setState] = useState<LiveState | null>(null);
  const [card, setCard] = useState<{ spoken: string; expiry: string; cvc: string } | null>(null);
  /** null: the spec's first view. */
  const [tab, setTab] = useState<ViewId | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [selected, setSelected] = useState<{ ref: string } | null>(null);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stream, dispatch] = useReducer(streamReducer, initialStream);
  const [number, setNumber] = usePhoneNumber(id);
  const numberRef = useRef(number);
  numberRef.current = number;
  const live = useLiveCall({ workspace: id }, toast, () => numberRef.current);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Set when the demo has been deleted (a shared demo's hour is up, or it was replaced). */
  const [gone, setGone] = useState<string | null>(null);
  const failed = useCallback((e: Error) => {
    if (e instanceof ApiError && (e.status === 410 || e.status === 404)) setGone(e.message);
    else toast(e.message);
  }, []);

  const refresh = useCallback(async () => {
    const s = await demoApi<LiveState>(`/workspaces/${id}/state`);
    setState(s);
    setTick((t) => t + 1);
    setView((v) => {
      if (v) return v;
      const now = localNow(s.tenant.timezone);
      const services = servicesOn(s, now.date);
      const inService = services.some((x) => now.minutes >= x.open - 30 && now.minutes <= x.close);
      return { date: now.date, minute: inService || !services.length ? now.minutes : (services.find((x) => x.open > now.minutes) ?? services[services.length - 1]).open + 60 };
    });
  }, [id]);

  const refreshSoon = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => refresh().catch(failed), 250);
  }, [refresh, failed]);

  useEffect(() => {
    demoApi<{ demo_cards: { spoken: string; expiry: string; cvc: string; result: string }[] }>('/config')
      .then((c) => setCard(c.demo_cards.find((d) => d.result === 'approve') ?? null))
      .catch(() => {});
    refresh().catch(failed);
    const es = new EventSource(`${DEMO_API}/workspaces/${id}/events`);
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as BoardEvent;
      if (e.type === 'refresh' && (e as { reason?: string }).reason === 'deleted') {
        setGone('This demo has been deleted, with everything in it.');
        es.close();
        return;
      }
      dispatch({ type: 'event', event: e });
      // Whatever a tool did may show in the back office; only the goodbye changes nothing.
      if ((e.type === 'action' && e.action.kind !== 'call_ending') || e.type === 'call_ended' || e.type === 'refresh' || e.type === 'call_started') refreshSoon();
      if (e.type === 'call_ended') onUsage();
    };
    es.onerror = () => setTimeout(refreshSoon, 2000);
    const clockTimer = setInterval(() => setClock(Date.now()), 30000);
    return () => {
      es.close();
      clearTimeout(timer.current);
      clearInterval(clockTimer);
    };
  }, [id, refresh, refreshSoon, onUsage, failed]);

  // A booking made or changed on the call: jump to its day and time, flash
  // its table, and bring forward the first view that shows bookings, unless
  // one already is.
  useEffect(() => {
    if (!stream.focusRef || !state) return;
    const b = state.bookings.find((x) => x.reference === stream.focusRef);
    // A repairs job raised or changed on the call: flash its card and bring the jobs board forward.
    const job = b ? undefined : state.jobs?.find((x) => x.reference === stream.focusRef);
    if (job) {
      setFlash(new Set([job.reference]));
      setTab((t) => focusTab(viewsOf(state.workspace ?? fallbackSpec(state), state), t, 'jobs'));
      dispatch({ type: 'focused' });
      const t = setTimeout(() => setFlash(new Set()), 3500);
      return () => clearTimeout(t);
    }
    if (!b) return;
    setView({ date: b.date, minute: Number(b.time.slice(0, 2)) * 60 + Number(b.time.slice(3, 5)) });
    setFlash(new Set(b.tables));
    const views = viewsOf(state.workspace ?? fallbackSpec(state), state);
    setTab((t) => focusTab(views, t, 'bookings'));
    dispatch({ type: 'focused' });
    const t = setTimeout(() => setFlash(new Set()), 3500);
    return () => clearTimeout(t);
  }, [stream.focusRef, state]);

  useEffect(() => {
    if (state) document.title = `${state.tenant.name} · your demo · n.abl`;
  }, [state?.tenant.name]);

  if (gone) {
    return (
      <>
        <RxTop me={me} />
        <main className="rx-main">
          <section className="panel ended">
            <h1>This demo has ended</h1>
            <p className="muted">{gone}</p>
            <Link to={`${R}/new`} className="button primary">Build another</Link>
          </section>
        </main>
      </>
    );
  }
  if (!state || !view) {
    return (
      <>
        <RxTop me={me} />
        <main className="rx-main"><p className="empty">Opening your demo…</p></main>
      </>
    );
  }
  if (!state.started_at) {
    return (
      <>
        <RxTop me={me} />
        <main className="rx-main">
          <p>This demo has not been started yet. <Link to={`${R}/build/${id}`}>Finish the setup</Link> and press Start.</p>
        </main>
      </>
    );
  }

  const spec = state.workspace ?? fallbackSpec(state);
  const views = viewsOf(spec, state);
  const current = views.find((v) => v.id === tab) ?? views[0];
  const now = localNow(state.tenant.timezone, new Date(clock));
  const t = state.tenant;
  const brand = t.brand ?? {};
  const style = brandStyle({ accent: brand.accent ?? t.accent, font_heading: brand.font_heading, font_body: brand.font_body });
  const booking: LiveBooking | null = selected ? state.bookings.find((b) => b.reference === selected.ref) ?? null : null;
  const minutesLeft = Math.max(0, me.limits.call_minutes_per_day - me.used.call_minutes);

  const selectTable = (key: string | null) => {
    if (!key) return setSelected(null);
    const b = bookingOn(state, key, view.date, view.minute);
    setSelected(b ? { ref: b.reference } : null);
    if (!b) {
      const tb = state.plan?.tables.find((x) => x.key === key);
      if (tb) toast(`${tb.label} (${tb.seats}) is free at ${hhmm(view.minute)}.${tb.bookable ? '' : ' It is kept for walk-ins.'}`);
    }
  };
  const moveBooking = async (b: LiveBooking, table: string) => {
    try {
      const r = await demoApi<{ message: string }>(`/workspaces/${id}/bookings/${b.reference}`, { method: 'PATCH', json: { action: 'move', table } });
      toast(`${b.name}: ${r.message}`);
      setSelected({ ref: b.reference });
      refreshSoon();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const dropOnTable = (from: string, to: string) => {
    const b = bookingOn(state, from, view.date, view.minute);
    if (b) void moveBooking(b, to);
  };
  const reset = async () => {
    if (!confirm(resetConfirm(spec))) return;
    try {
      const r = await demoApi<{ bookings: number; orders: number; jobs?: number }>(`/workspaces/${id}/reset`, { method: 'POST' });
      dispatch({ type: 'note', text: 'Demo reset.' });
      setSelected(null);
      await refresh();
      toast(resetToast(spec, r));
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <div className="workspace-page" style={style}>
      <div className="accent-bar" />
      <RxTop me={me}>
        <span className="crumb">
          {brand.logo ? <img src={brand.logo} alt="" className="logo-mini" /> : null}
          <b>{t.name}</b>
        </span>
        <span className={`badge ${minutesLeft > 5 ? 'info' : 'bad'}`}>{minutesLeft} call min left today</span>
        {state.expires_at ? (
          <span className={`badge ${new Date(state.expires_at).getTime() - clock < 10 * 60000 ? 'bad' : 'warn'}`} title="Shared demos are deleted an hour after Start, with everything in them.">
            Deleted {minutesUntil(state.expires_at, clock)}
          </span>
        ) : null}
        <button type="button" onClick={() => setSettingsOpen(true)}><SlidersIcon /> Voice</button>
        <Link to={`${R}/build/${id}`} className="button">Edit setup</Link>
        <button type="button" onClick={reset} disabled={live.phase !== 'idle'}><ResetIcon /> Reset</button>
      </RxTop>

      <main className="workspace">
        <div className="ws-call">
          <LivePanel
            tenant={t} phase={live.phase} model={live.model} latencies={live.latencies} turn={live.turn} call={live.call}
            stream={stream} card={card} onStart={live.start} onStop={live.stop} suggestions={suggestionsFor(spec, state)}
          />
          <p className="hint privacy">Calls go through Google’s Gemini. Use made-up names and details, never a real customer’s.</p>
        </div>

        <section className="ws-office panel" aria-label="Back office">
          <div className="tabs" role="tablist">
            {views.map((v) => (
              <button type="button" role="tab" key={v.id} aria-selected={current?.id === v.id} onClick={() => setTab(v.id)}>{v.label}</button>
            ))}
          </div>
          <div className="office-body">
            <div className="office-main">
              {current?.def.render({
                id, state, spec, today: now.date, nowMinute: now.minutes, clock, view, setView,
                selected: booking?.tables[0] ?? null, onSelectTable: selectTable, onDrop: dropOnTable, flash,
                onOpen: (b) => setSelected({ ref: b.reference }), onMove: moveBooking, refresh: refreshSoon,
              })}
            </div>
            {booking && spec.bookings && current?.shows === 'bookings' ? (
              <BookingDrawer
                id={id} state={state} booking={booking} words={spec.bookings} onPlan={views.some((v) => v.id === 'floor')}
                onClose={() => setSelected(null)} onDone={refreshSoon}
              />
            ) : null}
          </div>
        </section>

        <Phone
          id={id} number={number} setNumber={setNumber} sender={t.name} tick={tick} nowLabel={hhmm(now.minutes)}
          callAs={t.business_type === 'estate_agent' ? CALL_AS : t.business_type === 'property_maintenance' ? MT_CALL_AS : []}
          crew={state.engineers ? { engineers: state.engineers, clients: state.clients ?? [], jobs: state.jobs ?? [], quotes: state.quotes ?? [], today: now.date, onDone: refreshSoon } : undefined}
        />
      </main>

      <SettingsDialog target={{ workspace: id }} open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={() => refreshSoon()} />
    </div>
  );
}
