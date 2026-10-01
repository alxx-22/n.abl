import { useRef, useState } from 'react'
import { EdgeCard, Reveal } from './ui/index.jsx'
import { CategoryGlyph } from './Visuals.jsx'
import { useFinePointer, useWipe } from './scenes/CardWipe.jsx'

/* ============================================================
   WIPE CARD — a customer's sentence on one side of a travelling edge,
   what we would build for them on the other.

   Lifted out of the problem section so the solution cards on the home
   page and the other-services page share one behaviour. Nothing opens
   and nothing overlays: the card says the thing, then shows it, without
   leaving the grid.
   ============================================================ */
export function WipeCard({ c, i, open, onOpen, onClose, fine, className = '' }) {
  const card = useRef(null)
  const host = useRef(null)
  useWipe(card, host, c.scene, open)

  /* Under a mouse the card is not a control: it reveals on hover, and
     announcing it as a button would promise an activation that does
     nothing. Under a finger it genuinely is one. */
  const press = fine ? {} : {
    role: 'button',
    tabIndex: 0,
    'aria-expanded': open,
    onClick: () => (open ? onClose() : onOpen(i)),
    onKeyDown: (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      return open ? onClose() : onOpen(i)
    },
  }
  const hover = fine ? {
    tabIndex: 0,
    onMouseEnter: () => onOpen(i),
    onMouseLeave: onClose,
    onFocus: () => onOpen(i),
    onBlur: onClose,
  } : {}

  return (
    <EdgeCard ref={card} className={`card-pad problem ${className}`} {...hover} {...press}>
      {/* clipping hides the face from the eye, not from a screen reader, so
          the card still reads as the sentence it is */}
      <div className="problem__face">
        {c.face || (
          <>
            <div className="problem__head">
              <span className="problem__num">{c.n}</span>
              <CategoryGlyph kind={c.glyph} />
            </div>
            <span className="problem__label">{c.title}</span>
            <h3 className="problem__quote">&ldquo;{c.quote}&rdquo;</h3>
            <p className="problem__body">{c.body}</p>
          </>
        )}
      </div>
      <div className="problem__scene" aria-hidden="true">
        <div className="problem__stage" ref={host} />
        <div className="problem__tag">
          <span className="problem__cap">{c.label}</span>
          <span className="problem__note">{c.note || 'what we would build'}</span>
        </div>
      </div>
      <span className="problem__edge" aria-hidden="true" />
    </EdgeCard>
  )
}

/* A set of cards, only ever one open. Under a mouse that falls out of
   mouseleave; under a finger it has to be said, or six presses leave six
   cards open. `wide` names cards that span the row; `cardClass` is added to
   every card, and an item's `face` replaces the problem-card front. */
export function WipeGrid({ items, className = 'grid grid--3', wide = [], cardClass = '' }) {
  const [open, setOpen] = useState(-1)
  const fine = useFinePointer()
  return (
    <div className={`${className} section__body`}>
      {items.map((c, i) => (
        <Reveal key={c.n} delay={0.06 + i * 0.07} className={wide.includes(c.n) ? 'grid__wide' : ''}>
          <WipeCard
            c={c} i={i} fine={fine}
            className={`${cardClass} ${wide.includes(c.n) ? 'problem--wide' : ''}`}
            open={open === i}
            onOpen={setOpen}
            onClose={() => setOpen(-1)}
          />
        </Reveal>
      ))}
    </div>
  )
}
