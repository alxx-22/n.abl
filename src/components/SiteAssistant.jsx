import { useState, useRef, useEffect } from 'react'

/* The mark on the launcher. Four points rather than a robot or a speech
   bubble: it reads as "something considered happens here" without promising a
   person, and it sits in the same family as the dot in the wordmark. */
function Spark({ size = 20 }) {
  return (
    <svg className="spark" width={size} height={size} viewBox="0 0 24 24"
      fill="none" aria-hidden="true" focusable="false">
      <path d="M12 2.5c.5 4.2 2.8 6.5 7 7-4.2.5-6.5 2.8-7 7-.5-4.2-2.8-6.5-7-7 4.2-.5 6.5-2.8 7-7Z"
        fill="currentColor" />
      <path d="M19 14.5c.25 2 1.3 3.05 3.3 3.3-2 .25-3.05 1.3-3.3 3.3-.25-2-1.3-3.05-3.3-3.3 2-.25 3.05-1.3 3.3-3.3Z"
        fill="currentColor" opacity=".55" />
    </svg>
  )
}

/* The assistant on the public site.

   It answers from one file — business/03-website/assistant-knowledge.md,
   bundled into the Worker at build time — and it can reach nothing else. No
   database, no client data, no write path.

   When someone wants a call or wants a question passed on, it does not submit
   anything. It hands them to the discovery form with what they said already
   filled in, and they press send. The assistant proposes; the visitor
   confirms; the form that already existed does the work.

   The endpoint is a fixed path on this same origin, served by the same Worker
   that serves this page, so it is a constant rather than a configured value.
   An earlier version required VITE_ASSISTANT_URL to be set, copying the
   pattern from the welcome-pack summariser — but that one points at a Supabase
   function on a different host, and this one cannot point anywhere else. The
   variable added a build setting to find and get wrong for no gain.

   If the key behind it is missing the Worker says so in a sentence a visitor
   can act on, which is the failure that actually needed handling. */

const ASSISTANT_URL = import.meta.env.VITE_ASSISTANT_URL || '/api/chat/public'

const OPENER = {
  role: 'assistant',
  content: "Ask me anything about n.abl — what we do, how we price, whether we'd be a fit. If I can't answer I'll pass it to the team.",
}

export default function SiteAssistant({ onHandoff }) {
  const [open, setOpen] = useState(false)
  /* The panel has to outlive the click that closes it, or there is nothing
     left on screen to animate. `closing` keeps it mounted for the length of
     the exit and then it goes. */
  const [closing, setClosing] = useState(false)
  const [messages, setMessages] = useState([OPENER])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [handoff, setHandoff] = useState(null)
  const endRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 120) }, [open])

  /* A timer rather than onAnimationEnd: under prefers-reduced-motion the
     animation is removed entirely and the event would never fire, leaving the
     panel stuck open. CLOSE_MS matches the animation in components.css. */
  const CLOSE_MS = 340
  function toggle() {
    if (!open) { setOpen(true); return }
    setClosing(true)
    setTimeout(() => { setOpen(false); setClosing(false) }, CLOSE_MS)
  }
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [messages, busy])

  /* Grow the box to fit what has been typed, up to a point. Height is reset to
     auto first — without that it can only ever get taller, because scrollHeight
     of an already-tall element includes the space it is already occupying. */
  function grow(el) {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }
  useEffect(() => { grow(inputRef.current) }, [input])

  async function send(e) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setHandoff(null)
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setBusy(true)

    try {
      const res = await fetch(ASSISTANT_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: text,
          /* The opener is ours, not the model's, so it is not sent back —
             otherwise every request carries a message nobody wrote. */
          history: next.slice(1, -1).slice(-6),
        }),
      })
      const data = await res.json()
      if (data.error && !data.reply) {
        setMessages([...next, { role: 'assistant', content: data.error }])
      } else {
        setMessages([...next, { role: 'assistant', content: data.reply }])
        if (data.intent === 'book_call' || data.intent === 'ask_team') {
          setHandoff({ intent: data.intent, enquiry: data.enquiry || text })
        }
      }
    } catch {
      setMessages([...next, {
        role: 'assistant',
        content: "I can't reach the team right now. Email hello@nabl.agency and someone will come back to you.",
      }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className={`assistant-fab ${open ? 'assistant-fab--open' : ''}`}
        aria-expanded={open}
        aria-controls="site-assistant"
        onClick={toggle}
      >
        <Spark />
        {/* Keyed so React swaps the node rather than the text: the label then
            replays its entrance and the two words cross-fade instead of
            snapping. */}
        <span key={open ? 'close' : 'ask'} className="assistant-fab__label">
          {open ? 'Close' : 'Ask a question'}
        </span>
      </button>

      {open && (
        <div
          className={`assistant ${closing ? 'assistant--closing' : ''}`}
          id="site-assistant"
          role="dialog"
          aria-label="Ask n.abl a question"
        >
          <div className="assistant__log">
            {messages.map((m, i) => (
              <p
                key={i}
                className={`assistant__msg assistant__msg--${m.role}`}
                /* Only the first few need staggering — that is the panel
                   opening. After that there is one new message at a time and
                   the delay would just be a lag. */
                style={i < 3 ? { animationDelay: `${0.06 + i * 0.07}s` } : undefined}
              >
                {m.content}
              </p>
            ))}
            {busy && (
              <p className="assistant__msg assistant__msg--assistant assistant__msg--busy">
                <i /><i /><i />
              </p>
            )}

            {handoff && (
              <div className="assistant__handoff">
                <p>{handoff.intent === 'book_call'
                  ? 'Shall I open the form so you can book a call?'
                  : 'Shall I pass this to the team?'}</p>
                <button type="button" className="btn btn--accent btn--sm"
                  onClick={() => { onHandoff?.(handoff.enquiry); toggle(); setHandoff(null) }}>
                  {handoff.intent === 'book_call' ? 'Book a call' : 'Ask the team'}
                </button>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form className="assistant__form" onSubmit={send}>
            <textarea
              ref={inputRef}
              className="input assistant__input"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              /* Enter sends, shift+Enter breaks the line — what a chat box is
                 expected to do, and the reason this is a textarea at all. */
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
              }}
              placeholder="What do you do?"
              aria-label="Your question"
              maxLength={1000}
            />
            <button type="submit" className="btn btn--accent btn--sm" disabled={busy || !input.trim()}>
              Send
            </button>
          </form>

        </div>
      )}
    </>
  )
}
