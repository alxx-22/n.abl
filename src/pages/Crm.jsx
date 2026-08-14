import { useEffect } from 'react'

/* Not yet ported to React (this is the surface the AI features are being
   stripped from). netlify.toml rewrites /sales-intelligence to the
   previous working page in production; this only renders in local dev.
   Delete once the AI-free React port lands. */
export default function Crm() {
  useEffect(() => { window.location.replace('/legacy/sales-intelligence.html') }, [])
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <span className="eyebrow">Sales CRM</span>
        <p className="auth-card__sub" style={{ marginTop: 'var(--s-4)' }}>
          Opening the current CRM…
        </p>
        <a className="btn btn--ghost btn--block" href="/legacy/sales-intelligence.html">Continue →</a>
      </div>
    </div>
  )
}
