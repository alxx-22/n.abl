import { useEffect } from 'react'

/* Not yet ported to React. In production, netlify.toml rewrites /team to
   the previous working page so the team's tools keep running; this
   component only renders during local dev, where it forwards to the same
   file. Delete this once the React port lands. */
export default function Team() {
  useEffect(() => { window.location.replace('/legacy/team.html') }, [])
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <span className="eyebrow">Team space</span>
        <p className="auth-card__sub" style={{ marginTop: 'var(--s-4)' }}>
          Opening the current team space…
        </p>
        <a className="btn btn--ghost btn--block" href="/legacy/team.html">Continue →</a>
      </div>
    </div>
  )
}
