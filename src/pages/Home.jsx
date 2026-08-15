import { useEffect, useRef, useState } from 'react'
import Nav from '../components/layout/Nav.jsx'
import Footer from '../components/layout/Footer.jsx'
import { EdgeCard, Reveal, prefersReducedMotion } from '../components/ui/index.jsx'
import DiscoveryModal from '../components/DiscoveryModal.jsx'
import { JourneyRail, Chapter, useParallax } from '../components/Journey.jsx'
import { NodeField, CategoryGlyph, Horizon } from '../components/Visuals.jsx'
import '../styles/home.css'

/* ============================================================
   CONTENT

   The offer is organised by the problem the client arrives with,
   not by the disciplines we happen to practise. Nobody wakes up
   needing "optimisation"; they wake up knowing a job takes all
   morning and shouldn't. See business/README.md §1.
   ============================================================ */
const CATEGORIES = [
  { n: '01', title: 'Save time', glyph: 'time', tag: 'The job that eats your week',
    body: 'Something gets done by hand, over and over, and it always takes longer than it should. We find where the hours go and hand that work to something that does not get bored.' },
  { n: '02', title: 'Reduce mistakes', glyph: 'accuracy', tag: 'The thing that keeps going wrong',
    body: 'Retyped numbers, missed steps, the spreadsheet only one person understands. We replace the fragile bit with something that does it the same way every time.' },
  { n: '03', title: 'Get more customers', glyph: 'customers', tag: 'The enquiries you never followed up',
    body: 'Leads that arrive and go cold, follow-ups that depend on someone remembering. We make capture and follow-up happen whether anyone remembers or not.' },
  { n: '04', title: 'Build something new', glyph: 'build', tag: 'The thing you do not have yet',
    body: 'A website, a booking flow, an internal tool, a portal for your customers. Scoped properly and quoted at a fixed price before anyone starts.' },
  { n: '05', title: 'Train your team', glyph: 'train', tag: 'The software you already pay for',
    body: 'Most businesses use a fraction of what they own. Sessions built around your actual work, not a generic course, so people leave able to do the thing.' },
  { n: '06', title: 'Fix something', glyph: 'fix', tag: 'The bit that broke',
    body: 'Something stopped working, or needs changing, or was never quite right. Buy credits and spend them when you need us — no monthly retainer to sit on standby.' },
]

/* Grouped by what it is for, not by vendor. The old list was a
   Microsoft-and-SAP CV, which described where we came from rather
   than what a small business needs. */
const TOOLKIT = [
  { cat: 'Automation & integration', items: ['Make', 'Zapier', 'n8n', 'Power Automate', 'Custom scripts'] },
  { cat: 'Custom software', items: ['Python', 'JavaScript', 'React', 'APIs', 'SQL databases'] },
  { cat: 'Web & customer-facing', items: ['Websites', 'Booking flows', 'Payments', 'Client portals'] },
  { cat: 'Data & reporting', items: ['Spreadsheets done properly', 'Power BI', 'Dashboards', 'Data cleaning'] },
  { cat: 'AI, where it earns its place', items: ['Document handling', 'Drafting', 'Classification', 'Assistants'] },
  { cat: 'What you already pay for', items: ['Microsoft 365', 'Google Workspace', 'Your CRM', 'Your booking system'] },
]

const STEPS = [
  { n: '01', title: 'Understand', body: 'A conversation, and a proper look at how the work happens today. Where it is measurable, we put a number on what it is costing you.' },
  { n: '02', title: 'Build', body: 'Price agreed before we start. Built inside the tools you already run — no new servers, no migration project, no new subscription to carry.' },
  { n: '03', title: 'Hand over', body: 'It is yours, and it keeps working without us. Buy credits if you want us on hand, and spend them only when something actually needs doing.' },
]

/* The worked example from business/README.md §3. Illustrative
   arithmetic, not an average of past work — there is no client
   history to average, and inventing one would be a lie a
   prospect could act on. */
const EXAMPLE = [
  { target: 240, prefix: '£', label: 'A month, doing it by hand' },
  { target: 40, prefix: '£', label: 'A month, once it is built' },
  { target: 200, prefix: '£', label: 'Saved every month' },
  { target: 2400, prefix: '£', label: 'Saved in the first year' },
]

const CREDITS = [
  { title: 'Build', body: 'Small changes, new integrations, another automation.' },
  { title: 'Assist', body: 'Troubleshooting, repairs, configuration, support.' },
  { title: 'Educate', body: 'Training, workshops, documentation for your team.' },
]

/* Illustrative of the kind of problem we take on and what gets built
   to solve it. Deliberately not dressed as a client list. */
const CASES = [
  { label: 'Save time', title: 'A morning of reporting, down to nothing',
    body: 'A pack that two people rebuilt by hand every week assembles itself overnight and is sitting there before the Monday meeting.',
    tools: ['Power Automate', 'Excel', 'Power BI'] },
  { label: 'Reduce mistakes', title: 'Orders that stopped being retyped',
    body: 'Orders arriving by email were copied into the system by hand, and occasionally copied wrong. Now they arrive already in it, and anything unusual is flagged rather than guessed at.',
    tools: ['Python', 'API integration'] },
  { label: 'Build something new', title: 'A booking page that fills the diary',
    body: 'Enquiries came by phone, always at the worst moment. A booking flow on the site takes the ones that never needed a conversation.',
    tools: ['Web', 'Payments', 'Calendar sync'] },
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
      {/* The same drawn paths as the logo and favicon — the opening frame of
          the site must not show a different letterform from the one in the
          nav it reveals. */}
      <svg className="intro__mark" viewBox="0 0 104 100" width="1" height="1">
        <path
          className="intro__n"
          d="M24.5 82 L24.5 48 A20 20 0 0 1 64.5 48 L64.5 82"
          fill="none" stroke="currentColor" strokeWidth="13" strokeLinecap="butt"
        />
        <rect className="intro__sq" x="78" y="69" width="13" height="13" />
      </svg>
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
  // Group thousands, or £2400 reads as a part number rather than money.
  const shown = decimals === 0
    ? Math.round(val).toLocaleString('en-GB')
    : val.toFixed(decimals)
  return (
    <div className="stat" ref={ref}>
      <div className="stat__num">{prefix}{shown}{suffix}</div>
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
            <span className="eyebrow hero__eyebrow">Technology implementation partner</span>
            <h1 className="hero__title">
              Tell us what&rsquo;s costing you. We build the fix<span className="dot" />
            </h1>
            <p className="hero__sub">
              We start with the problem, not the technology. Sometimes the answer is automation,
              sometimes an app, sometimes a spreadsheet finally done properly.
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
                Start with the problem.<br />Not the technology<span className="dot" />
              </h2>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="section__sub prose">
                Nobody arrives knowing which tool they need. They arrive knowing what is
                annoying them. Find the one that sounds like you.
              </p>
            </Reveal>

            <div className="grid grid--3 section__body">
              {CATEGORIES.map((c, i) => (
                <Reveal key={c.n} delay={0.1 + (i % 3) * 0.08}>
                  <EdgeCard className="card-pad pillar">
                    <div className="pillar__head">
                      <span className="pillar__num">{c.n}</span>
                      <CategoryGlyph kind={c.glyph} />
                    </div>
                    <h3 className="pillar__title">{c.title}</h3>
                    <p className="pillar__body">{c.body}</p>
                    <span className="pillar__tag">{c.tag}</span>
                  </EdgeCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- YOUR SYSTEMS ---------------- */}
        <section id="toolkit" className="section section--alt">
          <div className="shell">
            <Chapter index={2}>The toolkit</Chapter>
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
              <h2 className="section__title">Three steps, and then we get out of the way<span className="dot" /></h2>
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

        {/* ---------------- PRICING ----------------
            This slot used to hold four counters: businesses transformed,
            client savings unlocked, average efficiency improvement. Every
            number was invented. A prospect can act on a number, so an
            invented one is not decoration — it is a false claim, and it is
            the first thing that falls apart in a room with a real client.
            The honest version of "impact" for a business at this stage is
            being straight about what it charges. */}
        <section id="pricing" className="section section--impact">
          <div className="shell">
            <Chapter index={4}>What it costs</Chapter>
            <Reveal delay={0.06}>
              <h2 className="section__title">No retainers. A price before we start<span className="dot" /></h2>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="section__sub prose">
                Two ways we price, depending on whether the problem can be counted.
              </p>
            </Reveal>

            <div className="grid grid--2 section__body">
              <Reveal delay={0.1}>
                <EdgeCard className="card-pad price">
                  <span className="price__kind">Making something better</span>
                  <h3 className="price__title">Priced on what it saves you</h3>
                  <p className="price__body">
                    When a process already costs you money, we work out what it costs now,
                    what it will cost afterwards, and price against the difference. You can
                    check the arithmetic yourself before you agree to anything.
                  </p>
                </EdgeCard>
              </Reveal>
              <Reveal delay={0.18}>
                <EdgeCard className="card-pad price">
                  <span className="price__kind">Building something new</span>
                  <h3 className="price__title">Fixed price, agreed up front</h3>
                  <p className="price__body">
                    A portal, an app, a website — there is no before-and-after to measure,
                    and a savings figure would be guesswork. So the scope is written down
                    and the price is stated. Changes go through credits or a new quote.
                  </p>
                </EdgeCard>
              </Reveal>
            </div>

            <Reveal delay={0.1}>
              <div className="worked">
                <div className="worked__head">
                  <span className="eyebrow">A worked example</span>
                  <p className="worked__lead">
                    A job takes 12 hours a month. At £20 an hour, that is what it costs you
                    today. Afterwards it takes two.
                  </p>
                </div>
                <div className="stats worked__stats" ref={statsRef}>
                  {EXAMPLE.map((s) => <Stat key={s.label} {...s} />)}
                </div>
                <p className="worked__note">
                  Priced at roughly £800 to £1,500, that is about £1,200 once to remove
                  about £2,400 a year of labour. Illustrative figures — yours depend on
                  your own job and your own numbers, which is what the first call is for.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.14}>
              <div className="credits">
                <div className="credits__intro">
                  <h3 className="credits__title">Afterwards: credits, not a retainer</h3>
                  <p className="credits__body">
                    You do not pay us monthly to be on standby. Buy a pack of credits and
                    spend them when you actually need something. What we build is yours.
                  </p>
                </div>
                <div className="credits__grid">
                  {CREDITS.map((c) => (
                    <div key={c.title} className="credit">
                      <span className="credit__name">{c.title}</span>
                      <span className="credit__body">{c.body}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

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
              <p className="section__sub prose">
                The kind of problem we take on, and the sort of thing that gets built to
                solve it. Examples, not a client list — we name clients only with
                permission, and not before there is something worth naming.
              </p>
            </Reveal>

            <div className="grid grid--3 section__body">
              {CASES.map((c, i) => (
                <Reveal key={c.title} delay={0.08 + i * 0.08}>
                  <EdgeCard className="card-pad case">
                    <span className="case__label">{c.label}</span>
                    <h3 className="case__title">{c.title}</h3>
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
                We are not an AI company. We are the people who work out what the
                problem actually is, and then build the right thing<span className="dot" />
              </blockquote>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="about__body prose">
                <p>
                  n.abl is a technology implementation partner for small businesses. Some of what
                  we build uses AI. Most of it does not, because most problems do not need it —
                  they need a process understood properly and then built properly.
                </p>
                <p>
                  No reseller agreements, no migration upsell, no monthly retainer. If the answer
                  is a licence you already hold, or an afternoon of training rather than a build,
                  that is the answer we give you.
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
                What is the job you wish you never had to do again<span className="dot" />
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="contact__sub">
                A free 30-minute call. Describe the problem and we&rsquo;ll tell you what it
                would take to fix — including when the honest answer is that it isn&rsquo;t worth it.
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
