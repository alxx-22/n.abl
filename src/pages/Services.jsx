import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../components/layout/Nav.jsx'
import Footer from '../components/layout/Footer.jsx'
import DiscoveryModal from '../components/DiscoveryModal.jsx'
import { Reveal, EdgeCard } from '../components/ui/index.jsx'
import { Chapter } from '../components/Journey.jsx'
import { WipeGrid } from '../components/WipeCard.jsx'
import Capabilities from '../components/sections/Capabilities.jsx'
import { automation, data, web } from '../components/scenes/index.js'
import { track } from '../lib/analytics.js'

import '../styles/home.css'

/* ============================================================
   /services — OTHER SERVICES

   Everything n.abl does that is not AI: automation, data and analytics,
   and web. It was the whole offer before the move to AI implementation;
   it stays because not every problem needs AI, and a business that says
   so is easier to trust with the ones that do.

   Same parts as the home page: the owner's sentence on a card that
   wipes to what we would build, the capability rows with their scenes,
   and illustrative examples labelled as such.
   ============================================================ */
export const OTHER_CARDS = [
  { n: '01', title: 'Save time', glyph: 'time', scene: automation, label: 'Automation',
    quote: 'We lose a morning a week to work that repeats itself.',
    body: 'The steps that repeat between your systems, set up once and then left to run.' },
  { n: '02', title: 'Understand your data', glyph: 'data', scene: data, label: 'Data & Analytics',
    quote: 'We have the data, but not the answers.',
    body: 'The data cleaned up first, then reporting you can actually make a decision from.' },
  { n: '03', title: 'Build something new', glyph: 'build', scene: web, label: 'Web',
    quote: "Whatever we've got online, it doesn't do anything.",
    body: 'Your first site, or the one that finally does the work: booking, ordering, payments, accounts.' },
]

const OTHER_CASES = [
  { capability: 'Automation', problem: '12 hours of manual reporting every month.',
    fix: 'An automated reporting pipeline.', result: '10 hours returned to the business every month.',
    tools: ['Power Automate', 'Excel', 'Power BI'] },
  { capability: 'Data & Analytics', problem: 'Sales, stock and hours sit in three systems that never agree.',
    fix: 'One cleaned dataset, and a dashboard built on top of it.', result: 'One set of numbers, current every morning.',
    tools: ['Power BI', 'SQL'] },
  { capability: 'Web', problem: 'Every booking needs a phone call, always at the worst moment.',
    fix: 'A booking flow with payment, on the website.', result: 'The straightforward bookings take themselves.',
    tools: ['Web', 'Payments', 'Calendar sync'] },
]

export default function Services() {
  const [modalOpen, setModalOpen] = useState(false)
  useEffect(() => { document.title = 'Other services — n.abl' }, [])
  const book = () => { track('cta_services'); track('form_open'); setModalOpen(true) }

  return (
    <div className="grain">
      <Nav home={false} />
      <main>
        <section className="section services-hero">
          <div className="shell">
            <Reveal>
              <span className="eyebrow">Other services</span>
            </Reveal>
            <Reveal delay={0.06}>
              <h1 className="services-hero__title">Not everything needs AI<span className="dot" /></h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="section__sub prose">
                n.abl builds AI into small and mid-sized businesses. We also still do the work
                underneath it: automation, data and analytics, and websites that do the job.
                Sometimes that is the right answer on its own, and we will say so.
              </p>
            </Reveal>
            <Reveal delay={0.16}>
              <div className="hero__cta services-hero__cta">
                <button className="btn btn--primary" onClick={book}>Book a free discovery call</button>
                <Link className="btn btn--ghost" to="/#what-we-do">See what AI can do</Link>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="problems" className="section">
          <div className="shell">
            <Chapter index={1}>Your problem</Chapter>
            <Reveal delay={0.06}>
              <h2 className="section__title">Which of these sounds familiar<span className="dot" /></h2>
            </Reveal>
            <WipeGrid items={OTHER_CARDS} />
          </div>
        </section>

        <Capabilities />

        <section id="cases" className="section">
          <div className="shell">
            <Chapter index={3}>In practice</Chapter>
            <Reveal delay={0.06}>
              <h2 className="section__title">From problem to solution<span className="dot" /></h2>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="section__sub prose">
                The kind of problem we take on, and what gets built to solve it. These are
                illustrative examples rather than client work.
              </p>
            </Reveal>
            <div className="grid grid--3 section__body">
              {OTHER_CASES.map((c, i) => (
                <Reveal key={c.problem} delay={0.08 + i * 0.08}>
                  <EdgeCard className="card-pad case">
                    <div className="case__head">
                      <span className="case__label">{c.capability}</span>
                      <span className="case__prov">Illustrative example</span>
                    </div>
                    <dl className="case__facts">
                      <dt className="case__term">The problem</dt>
                      <dd className="case__def">{c.problem}</dd>
                      <dt className="case__term">The fix</dt>
                      <dd className="case__def">{c.fix}</dd>
                      <dt className="case__term">The result</dt>
                      <dd className="case__def case__def--result">{c.result}</dd>
                    </dl>
                    <div className="case__tools">
                      {c.tools.map((t) => <span key={t} className="chip chip--sm">{t}</span>)}
                    </div>
                  </EdgeCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--impact">
          <div className="shell">
            <Chapter index={4}>What it costs</Chapter>
            <Reveal delay={0.06}>
              <h2 className="section__title">A fixed price, or part of your retainer<span className="dot" /></h2>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="section__sub prose">
                On its own, this work is priced as a fixed project, scoped in writing and agreed
                before anything starts. Alongside AI we already look after for you, it can sit
                inside your monthly retainer instead.
              </p>
            </Reveal>
          </div>
        </section>

        <section id="contact" className="section contact">
          <div className="contact__glow" aria-hidden="true" />
          <div className="shell contact__inner">
            <Reveal>
              <h2 className="contact__title">Tell us where the time goes<span className="dot" /></h2>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="contact__sub">
                A free 30-minute conversation about what&rsquo;s getting in the way, and what
                would fix it: AI or not.
              </p>
            </Reveal>
            <Reveal delay={0.16}>
              <button className="btn btn--accent contact__btn" onClick={book}>Book a discovery call</button>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer home={false} />
      <DiscoveryModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
