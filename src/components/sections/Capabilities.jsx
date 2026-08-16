import { Reveal } from '../ui/index.jsx'
import { Chapter } from '../Journey.jsx'

/* ============================================================
   06 — WHAT WE BUILD

   Grouped by what it is for, not by vendor. The old list was a
   Microsoft-and-SAP CV, which described where we came from rather
   than what a small business needs.
   ============================================================ */
export const TOOLKIT = [
  { cat: 'Automation & integration', items: ['Make', 'Zapier', 'n8n', 'Power Automate', 'Custom scripts'] },
  { cat: 'Custom software', items: ['Python', 'JavaScript', 'React', 'APIs', 'SQL databases'] },
  { cat: 'Web & customer-facing', items: ['Websites', 'Booking flows', 'Payments', 'Client portals'] },
  { cat: 'Data & reporting', items: ['Spreadsheets done properly', 'Power BI', 'Dashboards', 'Data cleaning'] },
  { cat: 'AI, where it earns its place', items: ['Document handling', 'Drafting', 'Classification', 'Assistants'] },
  { cat: 'What you already pay for', items: ['Microsoft 365', 'Google Workspace', 'Your CRM', 'Your booking system'] },
]

export default function Capabilities() {
  return (
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
  )
}
