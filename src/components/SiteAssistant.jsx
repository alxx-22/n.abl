import { useState, useRef, useEffect } from 'react'

/* The assistant on the public site.

   It answers from one file — business/03-website/assistant-knowledge.md,
   bundled into the Worker at build time — and it can reach nothing else. No
   database, no client data, no write path.

   When someone wants a call or wants a question passed on, it does not submit
   anything. It hands them to the discovery form with what they said already
   filled in, and they press send. The assistant proposes; the visitor
   confirms; the form that already existed does the work.

   Absent unless VITE_ASSISTANT_URL is set, the same way the summariser and the
   CRM research action are: the site has to work without it. */

const ASSISTANT_URL = import.meta.env.VITE_ASSISTANT_URL || ''

const OPENER = {
  role: 'assistant',
  content: "Ask me anything about n.abl — what we do, how we price, whether we'd be a fit. If I can't answer I'll pass it to the team.",
}

export default function SiteAssistant({ onHandoff }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([OPENER])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [handoff, setHandoff] = useState(null)
  const endRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 120) }, [open])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages, busy])

  if (!ASSISTANT_URL) return null

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
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Close' : 'Ask a question'}
      </button>

      {open && (
        <div className="assistant" id="site-assistant" role="dialog" aria-label="Ask n.abl a question">
          <div className="assistant__log">
            {messages.map((m, i) => (
              <p key={i} className={`assistant__msg assistant__msg--${m.role}`}>{m.content}</p>
            ))}
            {busy && <p className="assistant__msg assistant__msg--assistant assistant__msg--busy">Thinking…</p>}

            {handoff && (
              <div className="assistant__handoff">
                <p>{handoff.intent === 'book_call'
                  ? 'Shall I open the form so you can book a call?'
                  : 'Shall I pass this to the team?'}</p>
                <button type="button" className="btn btn--accent btn--sm"
                  onClick={() => { onHandoff?.(handoff.enquiry); setOpen(false); setHandoff(null) }}>
                  {handoff.intent === 'book_call' ? 'Book a call' : 'Ask the team'}
                </button>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form className="assistant__form" onSubmit={send}>
            <input
              ref={inputRef}
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What do you do?"
              aria-label="Your question"
              maxLength={1000}
            />
            <button type="submit" className="btn btn--accent btn--sm" disabled={busy || !input.trim()}>
              Send
            </button>
          </form>

          <p className="assistant__note">
            Answers come from a written summary of what n.abl does. It will say so
            when it does not know.
          </p>
        </div>
      )}
    </>
  )
}
