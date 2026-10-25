// The n.abl wordmark, drawn exactly as the site draws it (src/components/ui
// at the repo root): strokes in the text colour, the square dot in amber.

export function Logo({ size = 22 }: { size?: number }) {
  const height = size * 1.28;
  return (
    <svg className="nabl-logo" viewBox="0 0 273 100" height={height} width={(height * 273) / 100} role="img" aria-label="n.abl">
      <g fill="none" stroke="currentColor" strokeWidth="13" strokeLinecap="butt">
        <path d="M24.5 82 L24.5 48 A20 20 0 0 1 64.5 48 L64.5 82" />
        <circle cx="128.25" cy="51.75" r="23.75" />
        <path d="M152 21.5 L152 82" />
        <path d="M178 6 L178 82" />
        <circle cx="201.75" cy="51.75" r="23.75" />
        <path d="M248.5 6 L248.5 82" />
      </g>
      <rect className="nabl-logo__dot" x="78" y="69" width="13" height="13" />
    </svg>
  );
}
