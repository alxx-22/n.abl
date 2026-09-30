// The live workspace: ring the receptionist on the left, watch the back
// office in the middle, and the customer's phone on the right. Everything a
// call does arrives over the event stream and lands on all three at once.

import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties } from 'react';
import { DEMO_API, demoApi } from '../../api.ts';
import { Calls } from '../../components/BoardPanels.tsx';
import { ResetIcon, SlidersIcon } from '../../components/Icons.tsx';
import { LivePanel } from '../../components/LivePanel.tsx';
import { SettingsDialog } from '../../components/SettingsDialog.tsx';
import { toast } from '../../components/Toaster.tsx';
import { initialStream, streamReducer } from '../../live/stream.ts';
import { useLiveCall } from '../../live/useLiveCall.ts';
import { Link } from '../../router.tsx';
import type { BoardEvent, TenantState } from '../../types.ts';
import { R, RxTop } from '../Reception.tsx';
import type { LiveBooking, LiveState, Me } from '../types.ts';
import { BookingDrawer } from './BookingDrawer.tsx';
import { FloorBoard, type View } from './FloorBoard.tsx';
import { Kitchen } from './Kitchen.tsx';
import { bookingOn, hhmm, localNow, servicesOn } from './model.ts';
import { Phone, usePhoneNumber } from './Phone.tsx';
import { Timeline } from './Timeline.tsx';

type Tab = 'floor' | 'timeline' | 'kitchen' | 'messages' | 'calls';
const REFRESH_ON = new Set(['booking_created', 'booking_changed', 'booking_cancelled', 'order_placed', 'order_updated', 'payment', 'message_taken', 'sms']);

function suggestions(state: LiveState): string[] {
  const out: string[] = [];
  const areas = state.plan?.areas.filter((a) => a.reservable && !a.enquiry_only) ?? [];
  if (state.tenant.has_booking) {
    out.push(areas.some((a) => a.kind === 'outdoor') ? 'Can I book a table for four on Friday at half seven, outside if possible?' : 'Can I book a table for four on Friday at half seven?');
    out.push("I've got a booking. Can we make it five people instead?");
  }
  if (state.tenant.has_ordering) out.push('Can I order some food to collect at seven?');
  out.push('Do you have gluten-free options?');
  return out;
}

export function Workspace({ id, me, onUsage }: { id: string; me: Me; onUsage: () => void }) {
  const [state, setState] = useState<LiveState | null>(null);
  const [card, setCard] = useState<{ spoken: string; expiry: string; cvc: string } | null>(null);
  const [tab, setTab] = useState<Tab>('floor');
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
    timer.current = setTimeout(() => refresh().catch((e: Error) => toast(e.message)), 250);
  }, [refresh]);

  useEffect(() => {
    demoApi<{ demo_cards: { spoken: string; expiry: string; cvc: string; result: string }[] }>('/config')
      .then((c) => setCard(c.demo_cards.find((d) => d.result === 'approve') ?? null))
      .catch(() => {});
    refresh().catch((e: Error) => toast(e.message));
    const es = new EventSource(`${DEMO_API}/workspaces/${id}/events`);
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as BoardEvent;
      dispatch({ type: 'event', event: e });
      if ((e.type === 'action' && REFRESH_ON.has(e.action.kind)) || e.type === 'call_ended' || e.type === 'refresh' || e.type === 'call_started') refreshSoon();
      if (e.type === 'call_ended') onUsage();
    };
    es.onerror = () => setTimeout(refreshSoon, 2000);
    const clockTimer = setInterval(() => setClock(Date.now()), 30000);
    return () => {
      es.close();
      clearTimeout(timer.current);
      clearInterval(clockTimer);
    };
  }, [id, refresh, refreshSoon, onUsage]);

  // A booking made or changed on the call: jump to its day and time, and flash its table.
  useEffect(() => {
    if (!stream.focusRef || !state) return;
    const b = state.bookings.find((x) => x.reference === stream.focusRef);
    if (!b) return;
    setView({ date: b.date, minute: Number(b.time.slice(0, 2)) * 60 + Number(b.time.slice(3, 5)) });
    setFlash(new Set(b.tables));
    setTab((t) => (t === 'kitchen' || t === 'messages' || t === 'calls' ? 'floor' : t));
    dispatch({ type: 'focused' });
    const t = setTimeout(() => setFlash(new Set()), 3500);
    return () => clearTimeout(t);
  }, [stream.focusRef, state]);

  useEffect(() => {
    if (state) document.title = `${state.tenant.name} · your demo · n.abl`;
  }, [state?.tenant.name]);

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

  const now = localNow(state.tenant.timezone, new Date(clock));
  const t = state.tenant;
  const brand = t.brand ?? {};
  const style = { '--accent': brand.accent ?? t.accent ?? undefined } as CSSProperties;
  const booking: LiveBooking | null = selected ? state.bookings.find((b) => b.reference === selected.ref) ?? null : null;
  const minutesLeft = Math.max(0, me.limits.call_minutes_per_day - me.used.call_minutes);
  const newMessages = state.messages.filter((m) => m.kind === 'message' && m.status === 'new').length;

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
    if (!confirm('Clear every booking, order, call and text, and fill the diary with a fresh sample week from your setup?')) return;
    try {
      const r = await demoApi<{ bookings: number; orders: number }>(`/workspaces/${id}/reset`, { method: 'POST' });
      dispatch({ type: 'note', text: 'Demo reset.' });
      setSelected(null);
      await refresh();
      toast(`Reset: ${r.bookings} bookings and ${r.orders} orders.`);
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
        <span className="badge warn">Demo</span>
        <span className={`badge ${minutesLeft > 5 ? 'info' : 'bad'}`}>{minutesLeft} call min left today</span>
        <button type="button" onClick={() => setSettingsOpen(true)}><SlidersIcon /> Voice</button>
        <Link to={`${R}/build/${id}`} className="button">Edit setup</Link>
        <button type="button" onClick={reset} disabled={live.phase !== 'idle'}><ResetIcon /> Reset</button>
      </RxTop>

      <main className="workspace">
        <div className="ws-call">
          <LivePanel
            tenant={t} phase={live.phase} model={live.model} latencies={live.latencies} turn={live.turn} call={live.call}
            stream={stream} card={card} onStart={live.start} onStop={live.stop} suggestions={suggestions(state)}
          />
          <p className="hint privacy">Calls go through Google’s Gemini free tier, which may use them to improve its models. Use made-up names and details, never a real customer’s.</p>
        </div>

        <section className="ws-office panel" aria-label="Back office">
          <div className="tabs" role="tablist">
            {([
              ['floor', 'Floor plan'], ['timeline', 'Timeline'], ['kitchen', `Kitchen${state.orders.filter((o) => o.status === 'confirmed').length ? ` (${state.orders.filter((o) => o.status === 'confirmed').length})` : ''}`],
              ['messages', `Messages${newMessages ? ` (${newMessages})` : ''}`], ['calls', 'Calls'],
            ] as [Tab, string][]).filter(([k]) => (k !== 'floor' && k !== 'timeline') || state.plan).map(([k, label]) => (
              <button type="button" role="tab" key={k} aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>
          <div className="office-body">
            <div className="office-main">
              {tab === 'floor' ? (
                <FloorBoard state={state} today={now.date} nowMinute={now.minutes} view={view} setView={setView} selected={booking?.tables[0] ?? null} onSelectTable={selectTable} onDrop={dropOnTable} flash={flash} />
              ) : null}
              {tab === 'timeline' ? (
                <Timeline state={state} today={now.date} nowMinute={now.minutes} view={view} setView={setView} onOpen={(b) => setSelected({ ref: b.reference })} onMove={moveBooking} />
              ) : null}
              {tab === 'kitchen' ? <Kitchen id={id} state={state} nowMs={clock} onDone={refreshSoon} /> : null}
              {tab === 'messages' ? <Messages id={id} state={state} onDone={refreshSoon} /> : null}
              {tab === 'calls' ? <Calls state={state as unknown as TenantState} /> : null}
            </div>
            {booking && (tab === 'floor' || tab === 'timeline') ? (
              <BookingDrawer id={id} state={state} booking={booking} onClose={() => setSelected(null)} onDone={refreshSoon} />
            ) : null}
          </div>
        </section>

        <Phone id={id} number={number} setNumber={setNumber} sender={t.name} tick={tick} nowLabel={hhmm(now.minutes)} />
      </main>

      <SettingsDialog target={{ workspace: id }} open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={() => refreshSoon()} />
    </div>
  );
}

function Messages({ id, state, onDone }: { id: string; state: LiveState; onDone: () => void }) {
  const callbacks = state.messages.filter((m) => m.kind === 'message');
  const texts = state.messages.filter((m) => m.kind === 'sms');
  const mark = async (mid: string, status: 'read' | 'new') => {
    try {
      await demoApi(`/workspaces/${id}/messages/${mid}`, { method: 'PATCH', json: { status } });
      onDone();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <div className="ws-messages">
      <h3>Callbacks and messages</h3>
      {callbacks.length ? callbacks.map((m) => (
        <div className={`message ${m.status === 'read' ? 'done' : ''}`} key={m.id}>
          <span className="from">{m.from_name ?? 'A caller'}</span>
          {m.from_phone ? <span className="muted"> · {m.from_phone}</span> : null}
          <div>{m.body}</div>
          <button type="button" className="small" onClick={() => mark(m.id, m.status === 'read' ? 'new' : 'read')}>{m.status === 'read' ? 'Mark not done' : 'Mark done'}</button>
        </div>
      )) : <p className="empty">No messages. The receptionist takes one when a caller needs a person.</p>}
      <h3>Texts sent</h3>
      {texts.length ? texts.map((m) => (
        <div className="message" key={m.id}>
          <span className="muted">To {m.to_number}</span>
          <div>{m.body}</div>
        </div>
      )) : <p className="empty">No texts yet.</p>}
    </div>
  );
}
