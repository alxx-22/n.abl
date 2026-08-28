import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../ui/index.jsx'

/* THE CAMERA.
 *
 * Every scene draws the same browser frame at x 340..1100, y 210..690 of its
 * 1440x900 stage. The first crop kept the composition the scenes were laid
 * out with, but that composition was for a stage wider than its subject: in
 * a 355px problem card it spent a fifth of the width on margin, which left
 * the window marooned in the middle of the card.
 *
 * This is the frame plus a 20-unit halo across and 64 down — the ratio that
 * lands the rendered scene on the card's own proportions. The window fills
 * 95% of the width rather than 79%, and the space above and below it is even
 * rather than pooling at the foot.
 *
 * The halo is not decoration: a cursor arrives from outside the frame in
 * every scene and the frame carries its own glow, so cropping flush to it
 * would cut both. Verified against all six scenes at five points across each
 * timeline — nothing crosses this but a cursor already on its way out of
 * shot. Re-check the same way before tightening it again.
 *
 * Cropped, never rescaled: nothing inside a scene changes size relative to
 * anything else in it. */
export const SCENE_VIEWBOX = '320 146 800 608'

/**
 * Build a scene's SVG into `host` and return the handle a timeline drives.
 *
 * This is the only innerHTML write in src/, and security-check.mjs enforces
 * that. It is safe because scene.make() composes literals from
 * src/components/scenes and nothing else — no user input, no URL, no
 * network. It is necessary because render() moves several hundred nodes per
 * frame by attribute: reconciling that through React would rebuild the tree
 * sixty times a second to change numbers React never needs to know about.
 */
export function mountScene(host, scene) {
  host.innerHTML = scene.make()
  host.querySelector('svg').setAttribute('viewBox', SCENE_VIEWBOX)
  return { scene, els: scene.bind(host), t0: 0 }
}

/* One loop for every scene on the page rather than one loop each, and it
   stops the moment nothing is playing. Nothing here draws for nobody —
   the same rule the hero canvas follows in Visuals.jsx. */
const playing = new Set()
let raf = 0
function frame(now) {
  for (const m of playing) m.scene.render(m.els, ((now - m.t0) / 1000) % m.scene.dur)
  raf = playing.size ? requestAnimationFrame(frame) : 0
}

/* Scenes restart from the top rather than resuming mid-sequence. These
   read as short films; catching one four seconds in tells you nothing. */
export function play(m) {
  m.t0 = performance.now()
  playing.add(m)
  if (!raf) raf = requestAnimationFrame(frame)
}
export function stop(m) {
  playing.delete(m)
  if (!playing.size && raf) { cancelAnimationFrame(raf); raf = 0 }
}

/** The frame reduced motion gets: the outcome, not the journey to it. */
export const still = (scene) => scene.dur * 0.8

/**
 * A scene that plays while its row is on screen.
 * Used for the capability rows, where the animation is the row's content.
 */
export default function Scene({ scene, className = 'scene', label }) {
  const ref = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const host = ref.current
    if (!host) return
    const m = mountScene(host, scene)

    if (reduced) {
      scene.render(m.els, still(scene))
      return () => { host.innerHTML = '' }
    }
    scene.render(m.els, 0)

    let onScreen = false
    const sync = () => (onScreen && !document.hidden ? play(m) : stop(m))
    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync() },
      { rootMargin: '-6% 0px -6% 0px' })
    io.observe(host)
    document.addEventListener('visibilitychange', sync)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
      stop(m)
      host.innerHTML = ''
    }
  }, [scene, reduced])

  return <figure ref={ref} className={className} aria-label={label} />
}
