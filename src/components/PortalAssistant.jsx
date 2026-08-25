import { useState, useRef, useEffect } from 'react'
import { SUPABASE_URL } from '../lib/supabaseConfig.js'

/* The assistant inside the client portal.

   It answers about one client's own account and it cannot reach another's:
   the access key is the only thing that selects whose record is loaded, and
   that happens in Postgres, inside portal_assistant_context(). There is no
   client id parameter anywhere in the path, so there is nothing to pass the
   wrong value to.

   It also never acts. When the client wants something done, the reply comes
   back with a proposed request and this component renders it as a card with a
   button. Pressing the button is what creates the row. The model proposes,
   the person confirms, the code writes — the same shape as the outreach gates
   and the public assistant's handoff to the enquiry form.

   The endpoint is derived from SUPABASE_URL rather than configured, for the
   same reason the public assistant's is a fixed path: a build variable that
   can only ever hold one value is a setting to forget, not a setting.

   The access key is held in memory by Portal.jsx and passed in. It is never
   written to storage, never logged, and never put into the model prompt. */

const ENDPOINT = `${SUPABASE_URL}/functions/v1/portal-assistant`

const KIND_LABEL = {
  question: 'Question for the team',
  ticket: 'Support request',
  call: 'Call request',
  quote_query: 'Quote query',
  detail_change: 'Change of details',
}

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

export default function PortalAssistant({ accessKey, clientName }) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: `Ask me about your account — quotes, projects, meetings, what we hold. If I can't answer, or you need something done, I'll raise it with the team for you.`,
  }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [proposal, setProposal] = useState(null)
  const [raising, setRaising] = useState(false)
  const endRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 120) }, [open])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [messages, busy, proposal])

  function grow(el) {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }
  useEffect(() => { grow(inputRef.current) }, [input])

  /* Matches the exit animation in components.css. A timer rather than
     onAnimationEnd, because reduced motion removes the animation and the
     event would never fire. */
  const CLOSE_MS = 340
  function toggle() {
    if (!open) { setOpen(true); return }
    setClosing(true)
    setTimeout(() => { setOpen(false); setClosing(false) }, CLOSE_MS)
  }

  async function post(payload) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: accessKey, ...payload }),
    })
    return res.json()
  }

  async function send(e) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setProposal(null)
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setBusy(true)
    try {
      const data = await post({
        message: text,
        /* The opener is ours, not the model's, so it is not sent back. */
        history: next.slice(1, -1).slice(-6),
      })
      if (data.error && !data.reply) {
        setMessages([...next, { role: 'assistant', content: data.error }])
      } else {
        setMessages([...next, { role: 'assistant', content: data.reply }])
        if (data.intent === 'raise' && data.request) setProposal(data.request)
      }
    } catch {
      setMessages([...next, {
        role: 'assistant',
        content: 'I can’t reach the team right now. Email hello@nabl.agency and someone will come back to you.',
      }])
    } finally {
      setBusy(false)
    }
  }

  async function confirmRaise() {
    if (!proposal || raising) return
    setRaising(true)
    try {
      const data = await post({ action: 'raise', request: proposal, raised_via: 'assistant' })
      setMessages((m) => [...m, {
        role: 'assistant',
        content: data.raised
          ? 'Raised. Someone will pick it up and come back to you by email.'
          : (data.error || 'I could not raise that. Email hello@nabl.agency and we will pick it up.'),
      }])
      if (data.raised) setProposal(null)
    } catch {
      setMessages((m) => [...m, {
        role: 'assistant',
        content: 'I could not raise that. Email hello@nabl.agency and we will pick it up.',
      }])
    } finally {
      setRaising(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className={`assistant-fab ${open ? 'assistant-fab--open' : ''}`}
        aria-expanded={open}
        aria-controls="portal-assistant"
        onClick={toggle}
      >
        <Spark />
        <span key={open ? 'close' : 'ask'} className="assistant-fab__label">
          {open ? 'Close' : 'Ask about your account'}
        </span>
      </button>

      {open && (
        <div
          className={`assistant assistant--portal ${closing ? 'assistant--closing' : ''}`}
          id="portal-assistant"
          role="dialog"
          aria-label={`Ask about ${clientName || 'your account'}`}
        >
          <div className="assistant__log">
            {messages.map((m, i) => (
              <p
                key={i}
                className={`assistant__msg assistant__msg--${m.role}`}
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

            {proposal && (
              <div className="assistant__handoff assistant__proposal">
                {/* Shown in full before anything is written. A client should
                    never press a button and find out afterwards what it
                    said on their behalf. */}
                <span className="assistant__kind">{KIND_LABEL[proposal.kind] || 'Request'}</span>
                <p className="assistant__proposal-subject">{proposal.subject}</p>
                <p className="assistant__proposal-body">{proposal.body}</p>
                {proposal.quote_reference && (
                  <p className="assistant__proposal-ref">Quote {proposal.quote_reference}</p>
                )}
                <div className="assistant__proposal-actions">
                  <button type="button" className="btn btn--accent btn--sm"
                    onClick={confirmRaise} disabled={raising}>
                    {raising ? 'Raising…' : 'Send this to the team'}
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm"
                    onClick={() => setProposal(null)} disabled={raising}>
                    Not now
                  </button>
                </div>
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
              }}
              placeholder="When is my next meeting?"
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
