import { useEffect, useRef, useState } from 'react'
import { Reveal, useReducedMotion } from '../ui/index.jsx'
import { Chapter } from '../Journey.jsx'
import { PRODUCTS } from '../products/data.js'
import { createProductStage } from '../products/stage.js'

/* ============================================================
   02 — WHAT IT CAN DO: one chapter per product

   The words of each product on one side; on the other, the product doing
   its job (a scene from film/cards.js), playing as its words are read.
   Between products the animation folds into the amber square, which
   carries the light down to the next product and blooms into it. The
   stage and its timing are in products/stage.js, the copy in
   products/data.js.

   This took the place of two sections: the See it work film, one long
   animation that had to be scrolled through before anything else, and
   the grid of cards that named the same products again below it. Links
   to #see-it-work still land here.
   ============================================================ */
/* Phones get the narrow layout: each animation in the page above its words. */
const NARROW = '(max-width: 980px)'

export default function Products() {
  const track = useRef(null)
  const stage = useRef(null)
  const ctl = useRef(null)
  const reduced = useReducedMotion()
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(NARROW)
    const on = () => setNarrow(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  useEffect(() => {
    // the stage measures the words it sits beside, so the fonts come first
    let alive = true
    document.fonts.ready.then(() => {
      if (!alive || !track.current || !stage.current) return
      ctl.current = createProductStage({ track: track.current, stage: stage.current, items: PRODUCTS, reduced, narrow })
    })
    return () => { alive = false; if (ctl.current) ctl.current.destroy(); ctl.current = null }
    // rebuilt when the layout changes; a change of motion preference is passed in live, below
  }, [narrow])
  useEffect(() => { if (ctl.current) ctl.current.setReduced(reduced) }, [reduced])

  return (
    <section id="what-we-do" className="section products" aria-labelledby="products-title">
      <span id="see-it-work" className="products__anchor" aria-hidden="true" />
      <div className="shell products__head">
        <Chapter index={1}>What it can do</Chapter>
        <Reveal delay={0.06}>
          <h2 id="products-title" className="section__title">What this can look like in your business<span className="dot" /></h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="section__sub prose">
            Which of these sounds familiar? None of them is a product off the shelf. Each is
            built around the way you already work, and each is where a conversation starts.
          </p>
        </Reveal>
      </div>

      <div className="products__track" ref={track}>
        {/* The animations are pictures of what the words beside them say,
            so they are hidden from a screen reader; the words are the content. */}
        <div className="products__stage" ref={stage} aria-hidden="true">
          {PRODUCTS.map((p) => (
            <div key={p.n} className={`pv pv--${p.side}`}>
              <div className="pv__tilt"><div className="pv__host" /></div>
            </div>
          ))}
          <svg className="pv__trail" width="100%" height="100%" preserveAspectRatio="none">
            <defs>
              <linearGradient id="pv-trail" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor="#FF5A36" />
                <stop offset="0.45" stopColor="#E9AC57" />
                <stop offset="0.75" stopColor="#EFE2C6" />
                <stop offset="1" stopColor="#7CCBFF" />
              </linearGradient>
            </defs>
            <path d="" fill="none" stroke="url(#pv-trail)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <i className="pv__seed" />
          <div className="pv__count">{PRODUCTS.map((p) => <i key={p.n} />)}</div>
        </div>

        <div className="products__list">
          {PRODUCTS.map((p) => (
            <article key={p.n} id={`product-${p.id}`} className={`product product--${p.side}`} aria-labelledby={`product-${p.id}-title`}>
              <div className="shell product__shell">
                {/* on a phone the animation sits here, above its words */}
                <div className="product__visual" aria-hidden="true">
                  <div className="pv__tilt"><div className="pv__host" /></div>
                </div>
                <div className="product__text" data-shield=".85">
                  <span className="eyebrow">{p.n} · {p.label}</span>
                  <h3 id={`product-${p.id}-title`} className="product__title">{p.title}<span className="dot" /></h3>
                  <p className="product__quote"><span className="q">&ldquo;</span>{p.quote}<span className="q">&rdquo;</span></p>
                  <p className="product__body">{p.body}</p>
                  <div className="product__lists">
                    <div className="product__list product__list--uses">
                      <h4 className="product__k">Useful for</h4>
                      <ul>{p.uses.map((x) => <li key={x}>{x}</li>)}</ul>
                    </div>
                    <div className="product__list product__list--gets">
                      <h4 className="product__k">What you get</h4>
                      <ul>{p.gets.map((x) => <li key={x}>{x}</li>)}</ul>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
