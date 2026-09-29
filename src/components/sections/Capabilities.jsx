import { useState } from 'react'
import { Reveal } from '../ui/index.jsx'
import { Chapter } from '../Journey.jsx'
import Scene from '../scenes/Scene.jsx'
import { automation, data, web } from '../scenes/index.js'

/* ============================================================
   OTHER SERVICES — WHAT WE BUILD

   Once the whole offer; now the detail on /services, for the work that
   is not AI. Grouped by capability, with vendors as supporting detail
   and never as headlines: Power BI, n8n and Make are not buying reasons,
   they are evidence the capability is real.

   Custom software and training came off the list when n.abl moved to AI
   implementation (training is part of the AI retainer now), and AI moved
   to the home page as the offer itself.
   ============================================================ */
export const TOOLKIT = [
  { cat: 'Automation',
    what: 'Workflow automation, system integration, custom scripts',
    items: ['n8n', 'Make', 'Zapier', 'Power Automate', 'APIs'],
    scenes: [automation] },
  { cat: 'Data & Analytics',
    what: 'Data cleaning, dashboards, reporting, decision support',
    items: ['Power BI', 'SQL', 'Spreadsheets done properly'],
    scenes: [data] },
  { cat: 'Web',
    what: 'Websites, booking flows, customer portals, payments',
    items: ['React', 'Payments', 'Calendar sync'],
    scenes: [web] },
]

/* A row's scene, plus the tabs when it has more than one. Remounting on a
   tab change is the point: Scene keys off the scene it is given, so the
   new one is built and started from zero rather than picked up wherever
   the previous timeline had got to. */
function CapabilityScene({ row }) {
  const [idx, setIdx] = useState(0)
  const scene = row.scenes[idx]
  return (
    <>
      {row.labels && (
        <div className="scene__tabs" role="tablist" aria-label={`${row.cat} examples`}>
          {row.labels.map((l, k) => (
            <button key={l} type="button" role="tab" className="scene__tab"
              aria-selected={k === idx} onClick={() => setIdx(k)}>{l}</button>
          ))}
        </div>
      )}
      <Scene key={idx} scene={scene} label={`${row.cat} — an example of what we build`} />
    </>
  )
}

export default function Capabilities() {
  return (
    <section id="toolkit" className="section section--alt">
      <div className="shell">
        <Chapter index={2}>What we build</Chapter>
        <Reveal delay={0.06}>
          <h2 className="section__title">Whatever the job actually needs<span className="dot" /></h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="section__sub prose">
            We are not tied to one platform. Most of this is ordinary, well-made work, and it
            often sits underneath the AI we build as well.
          </p>
        </Reveal>

        <div className="sys section__body">
          {TOOLKIT.map((s, i) => (
            <Reveal key={s.cat} delay={i * 0.06}>
              <div className="sys__row">
                <div className="sys__cat">{s.cat}</div>
                <div>
                  <p className="sys__what">{s.what}</p>
                  <div className="sys__badges">
                    {s.items.map((it) => <span key={it} className="chip">{it}</span>)}
                  </div>
                  <CapabilityScene row={s} />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
