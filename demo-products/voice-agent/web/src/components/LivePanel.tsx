import { useEffect, useRef, useState } from 'react';
import type { LiveCall } from '../live/engine.ts';
import type { Phase, Reply, Turn } from '../live/useLiveCall.ts';
import type { StreamState } from '../live/stream.ts';
import type { TenantSummary } from '../types.ts';
import { MicIcon, StopIcon } from './Icons.tsx';
import { Meter } from './Meter.tsx';

const MODEL_LABELS: Record<string, string> = {
  'gemini-3.1-flash-live-preview': '3 Flash Live',
  'gemini-3.8-live': '3.8 Live',
};

const TRY: Record<string, string[]> = {
  'lucas-trattoria': ['Are you open on Sunday evening?', 'Can I book a table for four on Saturday at seven?', "I'd like a Diavola and garlic bread to collect."],
  'copper-kettle': ['What time do you close today?', 'Can I order a bacon cob and a latte for eleven?', 'Is the soup vegetarian?'],
  'fade-and-co': ['Have you got a skin fade tomorrow afternoon?', 'How much is a beard trim?', 'Can I move my booking to Friday?'],
  'linden-house': ['Can I book a 60-minute massage on Saturday?', 'What treatments do you do?', 'Can I leave a message for the spa manager?'],
};

function suggestions(t: TenantSummary): string[] {
  if (TRY[t.slug]) return TRY[t.slug];
  const out = ['What are your opening hours?'];
  if (t.has_booking) out.push('Can I book something for Saturday afternoon?');
  if (t.has_ordering) out.push('Can I place an order for collection?');
  return out;
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

const EXPECTING: Record<string, string> = {
  yes_no: 'a yes or no',
  list: 'a list, so pauses are fine',
  digits: 'a number, read in chunks',
  name: 'a name',
  open: 'anything',
};

// What contextual turn-taking is doing, in words a caller would use.
function turnText(t: Turn | null): string | null {
  if (!t) return null;
  if (t.state === 'hold') return 'On hold while you talk to someone else. Say "sorry about that" or just carry on when you\'re back.';
  if (t.state === 'waiting') {
    if (t.reason === 'thinking') return 'Waiting: sounds like you\'re still deciding.';
    if (t.reason === 'number') return 'Waiting for the rest of the number.';
    return 'Giving you a moment to add more…';
  }
  if (t.state === 'hearing') return 'Listening…';
  if (t.state === 'replying') return 'Thinking…';
  if (t.state === 'interrupted') return 'You cut in, so it stopped. Listening.';
  return null;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// "Listening" or "Speaking", checked a few times a second from the audio clock.
function useSpeaking(call: React.RefObject<LiveCall | null>, active: boolean): boolean {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (!active) return setSpeaking(false);
    const t = setInterval(() => setSpeaking(Boolean(call.current?.agentSpeaking())), 120);
    return () => clearInterval(t);
  }, [active, call]);
  return speaking;
}

export function LivePanel(props: {
  tenant: TenantSummary;
  phase: Phase;
  model: string | null;
  latencies: Reply[];
  turn: Turn | null;
  call: React.RefObject<LiveCall | null>;
  stream: StreamState;
  card: { spoken: string; expiry: string; cvc: string } | null;
  onStart: () => void;
  onStop: () => void;
}) {
  const { tenant, phase, latencies, stream, call } = props;
  const speaking = useSpeaking(call, phase === 'live');
  const scroller = useRef<HTMLDivElement>(null);
  const phoneCall = phase === 'idle' && stream.call?.live && stream.call.channel === 'phone';
  const model = props.model ?? stream.call?.model ?? null;

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [stream.items]);

  let status: string;
  let dot = '';
  if (phase === 'connecting') {
    status = 'Connecting to the receptionist…';
    dot = 'connecting';
  } else if (phase === 'live') {
    const t = turnText(props.turn);
    status = speaking
      ? 'Receptionist speaking. Talk over it to interrupt; a quick "mm-hm" won\'t.'
      : t ?? 'Listening. Go ahead and speak.';
    dot = speaking ? 'speaking' : props.turn?.state === 'hold' ? 'hold' : props.turn?.state === 'waiting' ? 'waiting' : 'live';
  } else if (phase === 'ending') {
    status = 'Ending the call…';
    dot = 'connecting';
  } else if (phoneCall) {
    status = `On a phone call${stream.call?.caller ? ` from ${stream.call.caller}` : ''}.`;
    dot = 'live';
  } else if (stream.call && !stream.call.live) {
    status = `Call ended${stream.call.outcome ? `: ${stream.call.outcome.replace(/_/g, ' ')}` : ''}. Start another whenever you like.`;
  } else {
    status = 'Press the button and speak. The receptionist answers out loud, in real time.';
  }

  const busy = phase === 'connecting' || phase === 'ending';
  const onCall = phase === 'live' || phase === 'connecting';

  return (
    <section className="panel live" aria-labelledby="live-title">
      <header>
        <h2 id="live-title">Live call</h2>
        {model ? <span className="chip">{MODEL_LABELS[model] ?? model}</span> : null}
      </header>

      <div className={`console ${phase}`}>
        <button
          type="button"
          id="talk"
          className={`talk ${onCall ? 'on' : ''}`}
          onClick={onCall ? props.onStop : props.onStart}
          disabled={busy && phase !== 'connecting'}
          aria-label={onCall ? 'End the call' : 'Start a live call'}
        >
          {onCall ? <StopIcon size={30} /> : <MicIcon size={30} />}
          <span>{onCall ? 'End call' : 'Start a live call'}</span>
        </button>

        <div className="console-side">
          <div className="call-status">
            <span className={`dot ${dot}`} />
            <span id="call-text">{status}</span>
          </div>
          <Meter label="You" tone="caller" read={() => (phase === 'live' ? (call.current?.levels().mic ?? 0) : 0)} />
          <Meter label="Receptionist" tone="agent" read={() => (phase === 'live' ? (call.current?.levels().agent ?? 0) : 0)} />
          {phase === 'live' && props.turn ? (
            <div className="expecting muted">Expecting {EXPECTING[props.turn.expect] ?? 'anything'}</div>
          ) : null}
          <div className="replies" aria-label="Reply times">
            {latencies.length ? (
              <>
                <span className="muted">Replied in</span>
                {latencies.slice(-6).map((r, i) =>
                  r.waited > 300 ? (
                    <span className="chip waited" key={latencies.length - 6 + i} title={`Waited ${seconds(r.waited)} longer on purpose, because you seemed to be thinking or on hold`}>
                      {seconds(r.ms)} · waited
                    </span>
                  ) : (
                    <span className={`chip ${r.ms < 1500 ? 'good' : r.ms < 2500 ? '' : 'slow'}`} key={latencies.length - 6 + i}>{seconds(r.ms)}</span>
                  ),
                )}
                <span className="muted">median {seconds(median(latencies.filter((r) => r.waited <= 300).map((r) => r.ms)) || 0)}</span>
              </>
            ) : (
              <span className="muted">Reply times appear here: how long after you stop talking the receptionist starts.</span>
            )}
          </div>
        </div>
      </div>

      {phase === 'idle' && !stream.items.some((i) => i.kind === 'caller') ? (
        <div className="try">
          <span className="muted">Try saying</span>
          <ul>
            {suggestions(tenant).map((s) => (
              <li key={s}>“{s}”</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="stream" id="stream" ref={scroller} aria-live="polite">
        {stream.items.length === 0 ? <p className="empty">The conversation appears here word by word, with each booking, order and payment as it happens.</p> : null}
        {stream.items.map((it) => {
          if (it.kind === 'caller' || it.kind === 'agent') {
            return (
              <div key={it.id} className={`bubble ${it.kind} ${it.final ? '' : 'partial'}`}>
                <span className="who">{it.kind === 'agent' ? 'Receptionist' : 'Caller'}</span>
                <span className="text">{it.text}</span>
              </div>
            );
          }
          if (it.kind === 'action') {
            return (
              <div key={it.id} className={`card ${it.tone}`}>
                <b>{it.title}</b>
                {it.detail ? <span className="detail">{it.detail}</span> : null}
              </div>
            );
          }
          if (it.kind === 'flag') {
            return (
              <div key={it.id} className="card flag">
                <b>Guardrail</b>
                <span className="detail">{it.text}</span>
              </div>
            );
          }
          return <p key={it.id} className="empty">{it.text}</p>;
        })}
      </div>

      {props.card ? (
        <div className="demo-card">
          <div className="sub">Demo card. Read this out when asked to pay. Any other number is declined, so never use a real card.</div>
          <div className="num">{props.card.spoken}</div>
          <div className="sub">Expiry {props.card.expiry} · Security code {props.card.cvc}</div>
        </div>
      ) : null}
    </section>
  );
}
