import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../ui/index.jsx'

const LINKS = [
  { id: 'what-we-do', label: 'What We Do' },
  { id: 'how-we-work', label: 'How We Work' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: "Let's Talk" },
]

export default function Nav() {
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
      <a href="#hero" className="brand" aria-label="n.abl home" onClick={() => setOpen(false)}>
        <Logo size={24} />
      </a>

      <nav className={`nav__links ${open ? 'nav__links--open' : ''}`}>
        {LINKS.map((l) => (
          <a key={l.id} href={`#${l.id}`} className="nav__link" onClick={() => setOpen(false)}>
            {l.label}
          </a>
        ))}
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
