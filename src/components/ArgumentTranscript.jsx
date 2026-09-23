import { Fragment, useState } from 'react'

/* ============================================================
   WHAT THE AGENTS SAID TO EACH OTHER

   One component for both argument logs - the outreach writer's and
   lead gen's - so they cannot drift into two ideas of what a log is.

   The rule it keeps: the words shown are the agent's own. Each reply is
   stored exactly as the model returned it (`said`), and it is shown
   exactly as stored. Every reply is JSON with a "say" field - what the
   agent is telling the next one - so that field is shown first, as the
   message, and the whole reply sits under it, untouched, one click away.
   Nothing here summarises, shortens or rephrases.

   What is NOT an agent is labelled as not an agent: `guard` (or
   `reason`, on the outreach side) is code overruling or correcting a
   reply - a quote that was not on the page, an "agree" that named the
   wrong number - and it reads as such, in its own line.

   Moves recorded before replies were kept verbatim have no `said`; they
   show the note they were stored with, marked as the older kind.
   ============================================================ */

const nice = (s) => String(s || '').replace(/_/g, ' ')

/* The agent's own message, if the reply has one. Taken from the reply,
   not reconstructed: the exact string the model put in "say". */
function sayOf(raw) {
  if (typeof raw !== 'string') return null
  try {
    const cleaned = raw.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '')
    const v = JSON.parse(cleaned)
    return v && typeof v.say === 'string' && v.say.trim() ? v.say : null
  } catch {
    return null
  }
}

function Move({ m }) {
  const [open, setOpen] = useState(false)
  const said = typeof m.said === 'string' ? m.said : null
  const say = sayOf(said)
  const code = m.guard ?? (said ? m.reason : null)
  const legacy = !said && m.reason ? m.reason : null

  return (
    <li className="at-move">
      <div className="at-move__head">
        <span className="at-move__from">{nice(m.from ?? m.agent)}</span>
        {m.to && <span className="at-move__to">to {nice(m.to)}</span>}
        <b className="at-move__what">{nice(m.decision)}</b>
        {m.angle && <span className="at-move__angle">{m.angle}</span>}
        {m.model && m.model !== 'none' && <span className="at-move__model">{m.model}</span>}
      </div>

      {say && <p className="at-move__say">{say}</p>}

      {said && !say && <pre className="at-move__raw">{said}</pre>}

      {said && say && (
        <>
          <button
            type="button"
            className="at-move__toggle"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Hide the full reply' : 'The full reply, exactly as sent'}
          </button>
          {open && <pre className="at-move__raw">{said}</pre>}
        </>
      )}

      {code && <p className="at-move__code"><em>code, not an agent:</em> {code}</p>}
      {legacy && <p className="at-move__legacy"><em>recorded before replies were kept word for word:</em> {legacy}</p>}
    </li>
  )
}

export default function ArgumentTranscript({ moves, empty = 'Nothing has been said yet.' }) {
  if (!Array.isArray(moves) || moves.length === 0) return <p className="at-empty">{empty}</p>
  return (
    <ol className="at">
      {moves.map((m, i) => (
        <Fragment key={m.seq ?? i}>
          {/* Lead gen's argument has stages; a heading marks where one
              ends and the next begins. The outreach log has none. */}
          {m.stage && m.stage !== (moves[i - 1] || {}).stage && (
            <li className="at-stage" aria-hidden="true">{nice(m.stage)}</li>
          )}
          <Move m={m} />
        </Fragment>
      ))}
    </ol>
  )
}
