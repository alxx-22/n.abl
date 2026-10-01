import { EdgeCard, Reveal } from '../ui/index.jsx'
import { Chapter } from '../Journey.jsx'

/* ============================================================
   07 — WHAT IT COSTS

   A build, then a monthly retainer. This replaced "no retainers, buy
   credits when you need us", deliberately: a retainer is steadier for a
   small business to run on than a stream of new clients, and AI is not
   something you install and leave. Models change, the business changes,
   and the work should keep getting better, so looking after it is part
   of what is sold.

   Training, support and small changes are inside the retainer. There are
   no credits and no invoice for a question.

   NO PRICES ON THE PAGE, ON PURPOSE. No retainer price has been set, and
   the old credit packs were placeholders; a number invented for the
   website would be the first thing to fall apart in front of a client.
   The tiers say what each includes and how much time with us comes with
   it, and the price is set on the discovery call. When real prices exist,
   they go in TIERS and nowhere else.

   The face-to-face lines are the owner's to confirm: "limited time with
   us, more of it the more you spend" is the rule, and these are its first
   wording. See business/12-pricing.
   ============================================================ */
export const TIERS = [
  {
    name: 'Essentials',
    for: 'One AI solution, looked after.',
    f2f: 'A review with us every quarter',
    items: [
      'Hosting, monitoring and fixes',
      'Updates as the underlying models change',
      'Tuning from real conversations',
      'A monthly report on what it did',
      'Support by email',
    ],
  },
  {
    name: 'Growth',
    for: 'Several solutions, improved every month.',
    f2f: 'A session with us every month',
    featured: true,
    items: [
      'Everything in Essentials',
      'Improvements and new automations each month',
      'Onboarding and training for your team',
      'Support by phone and email',
    ],
  },
  {
    name: 'Partner',
    for: 'AI across the business, with us as your AI team.',
    f2f: 'Regular sessions, planned around you',
    items: [
      'Everything in Growth',
      'A roadmap we plan together',
      'New builds within an agreed allowance',
      'Training whenever your team changes',
    ],
  },
]

export default function Pricing() {
  return (
    <section id="pricing" className="section section--impact">
      <div className="shell">
        <Chapter index={5}>What it costs</Chapter>
        <Reveal delay={0.06}>
          <h2 className="section__title">One build, then a monthly partnership<span className="dot" /></h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="section__sub prose">
            AI isn&rsquo;t set-and-forget. So every build comes with a retainer: we run it, look
            after it and keep improving it, and you get time with us. The more we do together,
            the more of that time you get.
          </p>
        </Reveal>

        <Reveal delay={0.16}>
          <EdgeCard className="card-pad setup section__body">
            <span className="price__kind">To start</span>
            <div className="setup__row">
              <h3 className="price__title">A fixed price to design, build and launch it</h3>
              <p className="price__body">
                Scoped in writing and agreed before any work starts. It covers mapping the job,
                building the AI around it, testing it on your real cases and going live.
              </p>
            </div>
          </EdgeCard>
        </Reveal>

        <div className="tiers">
          {TIERS.map((t, i) => (
            <Reveal key={t.name} delay={0.1 + i * 0.08}>
              <EdgeCard className={`card-pad tier ${t.featured ? 'tier--featured' : ''}`}>
                <span className="price__kind">Monthly</span>
                <h3 className="tier__name">{t.name}</h3>
                <p className="tier__for">{t.for}</p>
                <p className="tier__f2f">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    <circle cx="8" cy="8" r="3.2" /><circle cx="16.5" cy="9" r="2.6" />
                    <path d="M2.5 19c.6-3.4 2.8-5.4 5.5-5.4s4.9 2 5.5 5.4M14 14.2c3 0 5.2 1.6 5.8 4.6" />
                  </svg>
                  <span><b>Face to face:</b> {t.f2f}</span>
                </p>
                <ul className="tier__list">
                  {t.items.map((it) => <li key={it}>{it}</li>)}
                </ul>
              </EdgeCard>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <p className="tiers__note">
            Support, training and small changes are all part of the retainer. No credits, and no
            invoice for a question. Prices are set on the discovery call, once we know what you need.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
