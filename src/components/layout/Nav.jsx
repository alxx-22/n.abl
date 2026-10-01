import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../ui/index.jsx'

const LINKS = [
  { id: 'see-it-work', label: 'See It Work' },
  { id: 'what-we-do', label: 'What We Do' },
  { id: 'how-we-work', label: 'How We Work' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'contact', label: "Let's Talk" },
]

/* On the home page the links scroll to their section. Anywhere else they
   go back to the home page first, through the router rather than a full
   reload; ScrollToTop in App.jsx then finds the section. */
export function SectionLink({ id, home, children, ...rest }) {
  return home
    ? <a href={`#${id}`} {...rest}>{children}</a>
    : <Link to={{ pathname: '/', hash: `#${id}` }} {...rest}>{children}</Link>
}

export default function Nav({ home = true }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Lock body scroll while the mobile sheet is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <header className={`nav ${scrolled ? 'nav--scrolled' : ''}`}>
      <SectionLink id="hero" home={home} className="brand" aria-label="n.abl home" onClick={() => setOpen(false)}>
        <Logo size={24} />
      </SectionLink>

      <nav className={`nav__links ${open ? 'nav__links--open' : ''}`}>
        {LINKS.map((l) => (
          <SectionLink key={l.id} id={l.id} home={home} className="nav__link" onClick={() => setOpen(false)}>
            {l.label}
          </SectionLink>
        ))}
        <Link to="/services" className="nav__link" onClick={() => setOpen(false)}>Other Services</Link>
        <Link to="/portal" className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>
          Client Portal
        </Link>
      </nav>

      <button
        className="nav__toggle"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span />
      </button>
    </header>
  )
}
