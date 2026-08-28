import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../ui/index.jsx'
import { EASE_IO } from './engine.js'
import { mountScene, play, stop, still } from './Scene.jsx'

/* A mouse hovers and a finger cannot, and the difference decides how a card
   is opened — not what happens once it is. Read once, re-read if it changes:
   a tablet with a trackpad attached is one device that is both. */
export function useFinePointer() {
  const [fine, setFine] = useState(
    () => typeof window !== 'undefined'
      && window.matchMedia('(hover: hover) and (pointer: fine)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const onChange = () => setFine(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return fine
}

const WIPE_IN = 0.52
const WIPE_OUT = 0.40   // leaving should not be laboured

/* EASE_IO, not EASE. The card curves are arrival curves — they spend most of
   their travel early, which is right for something coming to rest and wrong
   for an edge crossing a card: on EASE the wipe is 74% across in the first
   120ms and then creeps, which reads as a jump followed by a stall rather
   than as one thing moving. */
const WIPE_EASE = EASE_IO

/**
 * Drives one card's wipe. The card's own content is clipped away from the
 * left while the scene is clipped in behind the same edge, both off a single
 * --wipe value, so the two sides always meet: there is never a frame where
 * both are half visible over each other.
 *
 * One loop owns the whole card — the wipe, the scene, and when to build and
 * take it down — and it reads the target from a ref rather than from its own
 * dependencies. Closing over `open` instead would tear the loop down mid-wipe
 * and immediately start a second one going the other way, so the card would
 * snap rather than travel. --wipe is written straight to the node: through
 * React state it would re-render the card sixty times a second to move one
 * number that only CSS ever reads.
 */
export function useWipe(cardRef, hostRef, scene, open) {
  const reduced = useReducedMotion()
  const want = useRef(open)
  want.current = open
  const kick = useRef(null)

  useEffect(() => {
    const card = cardRef.current
    const host = hostRef.current
    if (!card || !host) return undefined

    let w = 0, from = 0, since = 0, target = 0, m = null, raf = 0

    const paint = () => {
      card.style.setProperty('--wipe', w.toFixed(4))
      // the edge is only there while it is travelling; at rest it would be a
      // stray amber rule down one side of the card
      card.style.setProperty('--edge-o', Math.sin(w * Math.PI).toFixed(3))
    }
    const build = () => {
      if (m) return
      m = mountScene(host, scene)
      // reduced motion gets a still of the outcome, not the journey to it
      scene.render(m.els, reduced ? still(scene) : 0)
      if (!reduced) play(m)
    }
    const teardown = () => {
      if (!m) return
      stop(m)
      host.innerHTML = ''
      m = null
    }

    const step = (now) => {
      const t = want.current ? 1 : 0
      if (t !== target) { target = t; from = w; since = now; if (target) build() }
      if (w !== target) {
        const dur = reduced ? 0 : (target > from ? WIPE_IN : WIPE_OUT) * 1000
        const p = dur === 0 ? 1 : Math.min(1, (now - since) / dur)
        w = p >= 1 ? target : from + (target - from) * WIPE_EASE(p)
        paint()
      }
      /* Settled either way: stop. Once the wipe is home there is nothing
         left for this loop to move — the scene is driven by the shared one
         in Scene.jsx — and a loop that only stopped when shut would spin for
         as long as a card stayed open, which under reduced motion means
         spinning for a still. */
      if (w === target) {
        if (target === 0) teardown()
        raf = 0
        return
      }
      raf = requestAnimationFrame(step)
    }

    kick.current = () => { if (!raf) raf = requestAnimationFrame(step) }
    if (want.current) kick.current()

    return () => {
      kick.current = null
      if (raf) cancelAnimationFrame(raf)
      teardown()
      card.style.removeProperty('--wipe')
      card.style.removeProperty('--edge-o')
    }
  }, [scene, reduced, cardRef, hostRef])

  // the loop stops itself whenever the wipe is settled, so either direction
  // has to wake it: it reads the new target on its first frame back
  useEffect(() => { kick.current?.() }, [open])
}
