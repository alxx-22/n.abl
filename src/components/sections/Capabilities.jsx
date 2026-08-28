import { useState } from 'react'
import { Reveal } from '../ui/index.jsx'
import { Chapter } from '../Journey.jsx'
import Scene from '../scenes/Scene.jsx'
import { automation, data, software, web, training, ai } from '../scenes/index.js'

/* ============================================================
   06 — WHAT WE BUILD

   Grouped by capability, with vendors as supporting detail and never
   as headlines. Python, React, Power BI, n8n and Make are not buying
   reasons — they are evidence that the capability named in section 04
   is real, and they belong here, after the visitor has been told they
   do not need to know any of it.

   The old sixth row, "What you already pay for", moved to About,
   where "no reseller agreements, no migration upsell" already says
   the same thing in the right register.
   ============================================================ */
/* Each row carries the scene for its own capability. AI carries two,
   because the two things it is asked for — answering a question and
   doing a job — are different enough that one animation showing both
   would show neither. */
export const TOOLKIT = [
  { cat: 'Automation',
    what: 'Workflow automation, system integration, custom scripts',
    items: ['n8n', 'Make', 'Zapier', 'Power Automate', 'APIs'],
    scenes: [automation] },
  { cat: 'Data & Analytics',
    what: 'Data cleaning, dashboards, reporting, decision support',
    items: ['Power BI', 'SQL', 'Spreadsheets done properly'],
    scenes: [data] },
  { cat: 'Software',
    what: 'Internal tools, applications, databases',
    items: ['Python', 'JavaScript', 'React'],
    scenes: [software] },
  { cat: 'Web',
    what: 'Websites, booking flows, customer portals, payments',
    items: ['React', 'Payments', 'Calendar sync'],
    scenes: [web] },
  { cat: 'AI',
    what: 'Document handling, classification, assistants, drafting, analysis',
    items: ['Where it earns its place'],
    scenes: ai, labels: ['Assistant', 'Operating agent'] },
  { cat: 'Training & Support',
    what: 'Staff training, documentation, troubleshooting, improvements',
    items: ['Assistance credits'],
    scenes: [training] },
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
        <Chapter index={4}>What we build</Chapter>
        <Reveal delay={0.06}>
          <h2 className="section__title">Whatever the job actually needs<span className="dot" /></h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="section__sub prose">
            We are not tied to one platform, and we do not force AI into a problem that
            does not have one. Most of what we build is ordinary, well-made software.
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
