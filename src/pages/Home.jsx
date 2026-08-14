import { useEffect, useRef, useState } from 'react'
import Nav from '../components/layout/Nav.jsx'
import Footer from '../components/layout/Footer.jsx'
import { EdgeCard, Reveal, prefersReducedMotion } from '../components/ui/index.jsx'
import DiscoveryModal from '../components/DiscoveryModal.jsx'
import { JourneyRail, Chapter, useParallax } from '../components/Journey.jsx'
import { NodeField, PillarGlyph, Horizon } from '../components/Visuals.jsx'
import '../styles/home.css'

/* ============================================================
   CONTENT
   ============================================================ */
const PILLARS = [
  { n: '01', title: 'Innovation', tag: "Discover What's Possible", glyph: 'innovation',
    body: "Most businesses are sitting on capability they've already paid for. We find it, and we prove what it can do." },
  { n: '02', title: 'Automation', tag: 'Save Time, Reduce Error', glyph: 'automation',
    body: 'The repetitive work that eats your week gets handed to a system that never forgets a step.' },
  { n: '03', title: 'Optimisation', tag: 'Get More From What You Have', glyph: 'optimisation',
    body: 'Faster, cleaner, more accurate — without asking anyone to learn a new tool.' },
]

const SYSTEMS = [
  { cat: 'Intelligent Automation & Apps', items: ['Power BI', 'Power Automate', 'Power Apps', 'Copilot Studio'] },
  { cat: 'Productivity & Collaboration', items: ['Microsoft 365 Suite'] },
  { cat: 'Data & Analytics', items: ['Microsoft Fabric', 'Azure Data Services', 'Snowflake', 'DAX Studio', 'SAP BusinessObjects', 'SAP S/4HANA'] },
  { cat: 'CRM & Revenue Tools', items: ['Salesforce', 'Clari', 'EPOS Systems'] },
  { cat: 'Back Office & AI Agents', items: ['Polaris', 'AI Data Agents', 'Copilot-Powered Assistants'] },
]

const STEPS = [
  { n: '01', title: 'Audit', body: 'We map what you actually run, and where the time leaks out.' },
  { n: '02', title: 'Build', body: 'We build inside your stack — no new servers, no migration project.' },
  { n: '03', title: 'Optimise', body: 'We tune it against real usage until the numbers move.' },
]

const STATS = [
  { target: 47, suffix: '+', label: 'Businesses transformed' },
  { target: 2.1, prefix: '£', suffix: 'M+', decimals: 1, label: 'Estimated client savings unlocked' },
  { target: 3, suffix: 'x', label: 'Average efficiency improvement' },
  { target: 100, suffix: '%', label: 'Delivered inside your existing stack' },
]

const CASES = [
  { label: 'Automation', title: '14 hours of weekly reporting. Gone.', industry: 'Retail Operations — UK SME',
    body: 'A reporting pack that took two people most of a day now builds itself overnight and lands before the morning stand-up.',
    tools: ['Power Automate', 'Power BI', 'Microsoft 365'] },
  { label: 'Optimisation', title: '60% more accurate. Zero new software.', industry: 'Sales Team — B2B Technology',
    body: 'We rebuilt the forecast on the CRM they already owned. No new licences, no retraining, materially better calls.',
    tools: ['Salesforce', 'Clari', 'DAX Studio'] },
  { label: 'Innovation', title: 'An AI assistant that actually knows your business.', industry: 'Professional Services — Back Office',
    body: 'A Copilot Studio agent grounded in their own documents, answering the questions that used to interrupt three people a day.',
    tools: ['Copilot Studio', 'Azure Data Services'] },
]

/* ============================================================
   INTRO — the blind lifts to reveal the page
   ============================================================ */
function Intro() {
  const [lift, setLift] = useState(false)
  const [gone, setGone] = useState(prefersReducedMotion())
  useEffect(() => {
    if (prefersReducedMotion()) return
    const t1 = setTimeout(() => setLift(true), 620)
    const t2 = setTimeout(() => setGone(true), 1050)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])
  if (gone) return null
  return (
    <div className={`intro ${lift ? 'intro--lift' : ''}`} aria-hidden="true">
      <span className="intro__mark">
        <span className="intro__n">n</span>
        <i className="intro__sq" />
      </span>
    </div>
  )
}

/* ============================================================
   STAT COUNTER
   ============================================================ */
function Stat({ target, prefix = '', suffix = '', decimals = 0, label }) {
  const [val, setVal] = useState(prefersReducedMotion() ? target : 0)
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        obs.unobserve(e.target)
        const start = performance.now()
        const dur = 1500
        const tick = (now) => {
          const t = Math.min(1, (now - start) / dur)
          const eased = 1 - Math.pow(1 - t, 3)
          setVal(target * eased)
          if (t < 1) requestAnimationFrame(tick)
          else setVal(target)
        }
        requestAnimationFrame(tick)
      })
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [target])
  return (
    <div className="stat" ref={ref}>
      <div className="stat__num">{prefix}{val.toFixed(decimals)}{suffix}</div>
      <div className="stat__label">{label}</div>
    </div>
  )
}

/* ============================================================
   PAGE
   ============================================================ */
export default function Home() {
  const [modalOpen, setModalOpen] = useState(false)
  const heroRef = useRef(null)
  const statsRef = useParallax(0.06)

  // Gentle parallax on the hero while it is still on screen.
  useEffect(() => {
    if (prefersReducedMotion()) return
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        if (heroRef.current && y < window.innerHeight) {
          heroRef.current.style.transform = `translateY(${y * 0.25}px)`
        }
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="grain">
      <Intro />
      <Nav />

      <JourneyRail />

      <main>
        {/* ---------------- HERO ---------------- */}
        <section id="hero" className="hero">
          <div className="hero__glow" aria-hidden="true" />
          <NodeField />
          <div className="shell hero__inner" ref={heroRef}>
            <span className="eyebrow hero__eyebrow">Automation studio</span>
            <h1 className="hero__title">
              We make your business work smarter<span className="dot" />
            </h1>
            <p className="hero__sub">
              Innovation. Automation. Optimisation. Built entirely around the tools you already use.
            </p>
            <div className="hero__cta">
              <button className="btn btn--primary" onClick={() => setModalOpen(true)}>
                Book a discovery call
              </button>
              <a className="btn btn--ghost" href="#what-we-do">See what we do</a>
            </div>
          </div>
          <a href="#what-we-do" className="hero__scroll" aria-label="Scroll to content">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </a>
        </section>

        {/* ---------------- WHAT WE DO ---------------- */}
        <section id="what-we-do" className="section">
          <div className="shell">
            <Chapter index={1}>What we do</Chapter>
            <Reveal delay={0.06}>
              <h2 className="section__title">
                We don&rsquo;t ask you to change your tools.<br />We master them<span className="dot" />
              </h2>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="section__sub prose">
                Every engagement is rooted in one of three disciplines — and most businesses need all three.
              </p>
            </Reveal>

            <div className="grid grid--3 section__body">
              {PILLARS.map((p, i) => (
                <Reveal key={p.n} delay={0.1 + i * 0.08}>
                  <EdgeCard className="card-pad pillar">
                    <div className="pillar__head">
                      <span className="pillar__num">{p.n}</span>
                      <PillarGlyph kind={p.glyph} />
                    </div>
                    <h3 className="pillar__title">{p.title}</h3>
                    <p className="pillar__body">{p.body}</p>
                    <span className="pillar__tag">{p.tag}</span>
                  </EdgeCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- YOUR SYSTEMS ---------------- */}
        <section id="your-systems" className="section section--alt">
          <div className="shell">
            <Chapter index={2}>Your systems</Chapter>
            <Reveal delay={0.06}>
              <h2 className="section__title">Your systems. Fully unlocked<span className="dot" /></h2>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="section__sub prose">
                We work natively across the platforms you already pay for.
              </p>
            </Reveal>

            <div className="sys section__body">
              {SYSTEMS.map((s, i) => (
                <Reveal key={s.cat} delay={i * 0.06}>
                  <div className="sys__row">
                    <div className="sys__cat">{s.cat}</div>
                    <div className="sys__badges">
                      {s.items.map((it) => <span key={it} className="chip">{it}</span>)}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- HOW WE WORK ---------------- */}
        <section id="how-we-work" className="section">
          <div className="shell">
            <Chapter index={3}>How we work</Chapter>
            <Reveal delay={0.06}>
              <h2 className="section__title">No servers. No bloat. Just results<span className="dot" /></h2>
            </Reveal>

            <div className="grid grid--3 section__body">
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={0.08 + i * 0.1}>
                  <EdgeCard className="card-pad step">
                    <span className="step__num">{s.n}</span>
                    <h3 className="step__title">{s.title}</h3>
                    <p className="step__body">{s.body}</p>
                  </EdgeCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- IMPACT ---------------- */}
        <section id="impact" className="section section--impact">
          <div className="shell">
            <Chapter index={4}>Impact</Chapter>
            <div className="stats" ref={statsRef}>
              {STATS.map((s) => <Stat key={s.label} {...s} />)}
            </div>
            <Horizon />
          </div>
        </section>

        {/* ---------------- CASES ---------------- */}
        <section id="cases" className="section">
          <div className="shell">
            <Chapter index={5}>In practice</Chapter>
            <Reveal delay={0.06}>
              <h2 className="section__title">What this actually looks like<span className="dot" /></h2>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="section__sub prose">Real problems. Real tools. Real outcomes.</p>
            </Reveal>

            <div className="grid grid--3 section__body">
              {CASES.map((c, i) => (
                <Reveal key={c.title} delay={0.08 + i * 0.08}>
                  <EdgeCard className="card-pad case">
                    <span className="case__label">{c.label}</span>
                    <h3 className="case__title">{c.title}</h3>
                    <div className="case__industry">{c.industry}</div>
                    <p className="case__body">{c.body}</p>
                    <div className="case__tools">
                      {c.tools.map((t) => <span key={t} className="chip chip--sm">{t}</span>)}
                    </div>
                  </EdgeCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- ABOUT ---------------- */}
        <section id="about" className="section section--alt">
          <div className="shell about">
            <Reveal>
              <blockquote className="about__quote">
                We don&rsquo;t sell you new software. We make the software you have finally work<span className="dot" />
              </blockquote>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="about__body prose">
                <p>
                  n.abl is a small, deliberately senior team. We spend our time inside the platforms
                  most businesses already own — and rarely use to a fraction of their capability.
                </p>
                <p>
                  No reseller agreements, no migration upsell. If the answer is a licence you already
                  hold, that&rsquo;s the answer we give you.
                </p>
                <p className="about__based">Based in the UK. Working with businesses everywhere.</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------------- CONTACT ---------------- */}
        <section id="contact" className="section contact">
          <div className="contact__glow" aria-hidden="true" />
          <div className="shell contact__inner">
            <Reveal>
              <h2 className="contact__title">
                Ready to unlock what&rsquo;s already there<span className="dot" />
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="contact__sub">
                A free 30-minute discovery call. We&rsquo;ll tell you what&rsquo;s possible with what you already own.
              </p>
            </Reveal>
            <Reveal delay={0.16}>
              <button className="btn btn--accent contact__btn" onClick={() => setModalOpen(true)}>
                Book your free discovery call
              </button>
            </Reveal>
            <Reveal delay={0.22}>
              <a className="contact__email" href="mailto:hello@nabl.agency">hello@nabl.agency</a>
              <p className="contact__note">We typically respond within 4 hours.</p>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
      <DiscoveryModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
