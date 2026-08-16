import { Link } from 'react-router-dom'
import { Logo } from '../ui/index.jsx'

/* Two deliberately unlabelled routes into /team survive from the old site:
   1. the full stop inside "© 2026 n.abl." — styled to read as punctuation
   2. a 6px accent square pinned to the footer's bottom-right corner
   Both are intentional. Do not label, and keep the square out of the
   tab order so it never surfaces to a keyboard visitor. */
export default function Footer() {
  return (
    <footer className="footer">
      <div className="shell">
        <div className="footer__grid">
          <div>
            <a href="#hero" aria-label="n.abl home"><Logo size={22} /></a>
            <p className="footer__tag">
              We make your business work smarter. Technology implementation for
              small businesses.
            </p>
            {/* The mnemonic, restored as a strapline. It is brand framing —
                what people remember us by — and never the service structure,
                which is the problem set on the page above. */}
            <p className="footer__pillars">Innovation · Automation · Optimisation</p>
          </div>

          <div>
            <h4 className="footer__head">Company</h4>
            <div className="footer__list">
              <a href="#what-we-do">What We Do</a>
              <a href="#how-we-work">How We Work</a>
              <a href="#pricing">Pricing</a>
              <a href="#about">About</a>
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
          <span>Built for small business. No retainers.</span>
        </div>
      </div>

      <Link to="/team" className="footer__square" aria-label="Team" tabIndex={-1} />
    </footer>
  )
}
