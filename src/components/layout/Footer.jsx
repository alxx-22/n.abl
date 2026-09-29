import { Link } from 'react-router-dom'
import { Logo } from '../ui/index.jsx'
import { toSection } from './Nav.jsx'

/* Two deliberately unlabelled routes into /team survive from the old site:
   1. the full stop inside "© 2026 n.abl." — styled to read as punctuation
   2. a 6px accent square pinned to the footer's bottom-right corner
   Both are intentional. Do not label, and keep the square out of the
   tab order so it never surfaces to a keyboard visitor. */
export default function Footer({ home = true }) {
  return (
    <footer className="footer">
      <div className="shell">
        <div className="footer__grid">
          <div>
            <a href={toSection('hero', home)} className="brand" aria-label="n.abl home"><Logo size={22} /></a>
            <p className="footer__tag">
              AI, built into your business. AI implementation for small and
              mid-sized businesses.
            </p>
            {/* The mnemonic, restored as a strapline. It is brand framing —
                what people remember us by — and never the service structure,
                which is the problem set on the page above. */}
            <p className="footer__pillars">Innovation · Automation · Optimisation</p>
          </div>

          <div>
            <h4 className="footer__head">Company</h4>
            <div className="footer__list">
              <a href={toSection('see-it-work', home)}>See It Work</a>
              <a href={toSection('what-we-do', home)}>What We Do</a>
              <a href={toSection('pricing', home)}>Pricing</a>
              <Link to="/services">Other Services</Link>
              <a href={toSection('about', home)}>About</a>
              <a href="mailto:hello@nabl.agency">hello@nabl.agency</a>
            </div>
          </div>

          <div>
            <h4 className="footer__head">Legal</h4>
            <div className="footer__list">
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/terms">Terms of Service</Link>
              <Link to="/cookies">Cookie Policy</Link>
              <Link to="/portal">Client Portal</Link>
            </div>
          </div>
        </div>

        <div className="footer__base">
          <span>
            © {new Date().getFullYear()} n
            <Link to="/team" className="footer__teamdot" aria-label="Team access">.</Link>
            abl. All rights reserved.
          </span>
          <span>Built around your business. Looked after every month.</span>
        </div>
      </div>

      <Link to="/team" className="footer__square" aria-label="Team" tabIndex={-1} />
    </footer>
  )
}
