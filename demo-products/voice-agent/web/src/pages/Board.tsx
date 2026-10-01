import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties } from 'react';
import { ADMIN_API, BASE, api } from '../api.ts';
import { Calls, Diary, Messages, Orders } from '../components/BoardPanels.tsx';
import { ResetIcon, SlidersIcon } from '../components/Icons.tsx';
import { LivePanel } from '../components/LivePanel.tsx';
import { SettingsDialog } from '../components/SettingsDialog.tsx';
import { toast } from '../components/Toaster.tsx';
import { initialStream, streamReducer } from '../live/stream.ts';
import { useLiveCall } from '../live/useLiveCall.ts';
import type { AppConfig, BoardEvent, TenantState } from '../types.ts';
import { Link } from '../router.tsx';
import { Logo } from '../components/Logo.tsx';

const REFRESH_ON = new Set(['booking_created', 'booking_changed', 'booking_cancelled', 'order_placed', 'order_updated', 'payment', 'message_taken', 'sms']);

export function Board({ slug }: { slug: string }) {
  const [state, setState] = useState<TenantState | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stream, dispatch] = useReducer(streamReducer, initialStream);
  const live = useLiveCall({ tenant: slug }, toast);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refresh = useCallback(async () => {
    const s = await api<TenantState>(`${ADMIN_API}/tenants/${slug}/state`);
    setState(s);
    setDay((d) => d ?? s.today);
  }, [slug]);

  const refreshSoon = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => refresh().catch((e: Error) => toast(e.message)), 300);
  }, [refresh]);

  useEffect(() => {
    api<AppConfig>(`${ADMIN_API}/config`).then(setConfig).catch((e: Error) => toast(e.message));
    refresh().catch((e: Error) => toast(e.message));
    const es = new EventSource(`${ADMIN_API}/tenants/${slug}/events`);
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as BoardEvent;
      dispatch({ type: 'event', event: e });
      if ((e.type === 'action' && REFRESH_ON.has(e.action.kind)) || e.type === 'call_ended' || e.type === 'refresh' || e.type === 'call_started') refreshSoon();
    };
    es.onerror = () => setTimeout(refreshSoon, 2000);
    return () => {
      es.close();
      clearTimeout(timer.current);
    };
  }, [slug, refresh, refreshSoon]);

  // A booking just made on the call: show its day, so it visibly lands.
  useEffect(() => {
    if (!stream.focusRef || !state) return;
    const b = state.bookings.find((x) => x.reference === stream.focusRef);
    if (b) {
      setDay(b.date);
      dispatch({ type: 'focused' });
    }
  }, [stream.focusRef, state]);

  useEffect(() => {
    if (state) document.title = `${state.tenant.name} · n.abl Reception`;
  }, [state]);

  const reset = async () => {
    if (!confirm('Clear every booking, order, call and message for this demo, and refill the diary with sample bookings?')) return;
    try {
      const r = await api<{ bookings: number }>(`${ADMIN_API}/tenants/${slug}/reset`, { method: 'POST' });
      dispatch({ type: 'note', text: 'Demo reset.' });
      await refresh();
      toast(`Reset. ${r.bookings} sample bookings in the diary.`);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  if (!state) {
    return (
      <main>
        <p className="empty">Loading the board…</p>
      </main>
    );
  }

  const t = state.tenant;
  const card = config?.demo_cards.find((c) => c.result === 'approve') ?? null;
  const style = t.accent ? ({ '--accent': t.accent } as CSSProperties) : undefined;

  return (
    <div className="board-page" style={style}>
      <div className="accent-bar" />
      <div className="top">
        <Link to={`${BASE}/admin`} className="brand" aria-label="Back to all demo businesses">
          <Logo /> <span className="product">Reception</span>
        </Link>
        <h1>{t.name}</h1>
        <span className="badge warn">Demo</span>
        {t.demo_pin ? <span className="badge info">PIN {t.demo_pin}</span> : null}
        <span className="spacer" />
        <button type="button" id="settings-open" onClick={() => setSettingsOpen(true)}>
          <SlidersIcon /> Settings
        </button>
        <button type="button" id="reset" onClick={reset} disabled={live.phase !== 'idle'}>
          <ResetIcon /> Reset demo
        </button>
      </div>

      <main>
        <div className="board">
          <LivePanel
            tenant={t}
            phase={live.phase}
            model={live.model}
            latencies={live.latencies}
            turn={live.turn}
            call={live.call}
            stream={stream}
            card={card}
            onStart={live.start}
            onStop={live.stop}
          />
          {t.has_booking ? <Diary state={state} day={day ?? state.today} setDay={setDay} /> : null}
          <section className="panel" aria-labelledby="orders-title">
            <header>
              <h2 id="orders-title">Orders</h2>
            </header>
            <Orders state={state} />
            <header className="sub-head">
              <h2>Messages and texts</h2>
            </header>
            <Messages state={state} />
          </section>
        </div>
        <Calls state={state} />
      </main>

      <SettingsDialog target={{ tenant: slug }} open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={() => refreshSoon()} />
    </div>
  );
}
