import { Link } from 'react-router-dom'
import { Logo } from '../components/ui/index.jsx'

export default function NotFound() {
  return (
    <div className="auth-wrap grain">
      <div className="auth-card">
        <Link to="/" aria-label="n.abl home"><Logo size={26} /></Link>
        <h1>Nothing here<span className="dot" /></h1>
        <p className="auth-card__sub">
          That page doesn&rsquo;t exist — or it moved. Let&rsquo;s get you back.
        </p>
        <Link to="/" className="btn btn--primary btn--block">Back to the site</Link>
      </div>
    </div>
  )
}
