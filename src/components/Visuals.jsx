import { useId } from 'react'

/* ============================================================
   VISUALS — brand-native imagery, drawn not photographed.
   Everything here is SVG/canvas built from the design tokens, so
   it themes automatically, weighs almost nothing, needs no CDN
   and never blocks on an external request.
   ============================================================ */

/* ---------- Category glyphs — one per problem the client arrives with.
   These used to be three glyphs for three disciplines (Innovation,
   Automation, Optimisation), which described our tools rather than the
   client's problem. Six now, matching the six things people actually
   turn up asking for. Same geometric language throughout: true circles,
   a single stroke weight, one solid accent dot as the focal point.

   The funnel that stood for "get more customers" is gone with the
   category; a bar reading stands for "understand your data" in its
   place. Same 64×64 frame, same 1.4 stroke, same single accent dot —
   the drawing grammar is unchanged. */
/* 2026-11: the glyphs for AI work are drawn in the calm gradient, amber
   through cream to ice, rising from the bottom left; their accent dot is
   ice, the AI at work. The glyphs for the other services (automation, data,
   web, and the rest) are not AI, so they stay one colour, in cream. */
const AI_KINDS = new Set(['voice', 'chat', 'document', 'agent', 'copilot', 'answer', 'bespoke'])

export function CategoryGlyph({ kind }) {
  const gid = `glyph-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const lit = AI_KINDS.has(kind)
  const common = {
    viewBox: '0 0 64 64', width: 46, height: 46, fill: 'none',
    stroke: lit ? `url(#${gid})` : 'currentColor', strokeWidth: 1.4,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true', className: lit ? 'glyph' : 'glyph glyph--plain',
  }
  const defs = lit ? (
    <defs>
      <linearGradient id={gid} x1="6" y1="58" x2="58" y2="6" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#E9AC57" />
        <stop offset="0.5" stopColor="#EFE2C6" />
        <stop offset="1" stopColor="#7CCBFF" />
      </linearGradient>
    </defs>
  ) : null

  // Save time — a clock with the wasted wedge lifted out of it.
  if (kind === 'time') {
    return (
      <svg {...common}>
        {defs}
        <path d="M32 12a20 20 0 1 0 20 20" />
        <path d="M32 12v20h20" strokeOpacity=".45" strokeDasharray="3 5" />
        <path d="M32 32l-11 7" />
        <circle cx="32" cy="32" r="2.6" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  // Reduce mistakes — a run of steps, one of which was wrong and is now right.
  if (kind === 'accuracy') {
    return (
      <svg {...common}>
        {defs}
        <rect x="10" y="16" width="44" height="32" rx="3" strokeOpacity=".45" />
        <path d="M18 26h14" strokeOpacity=".55" />
        <path d="M18 34h10" strokeOpacity=".55" />
        <path d="M18 42h18" strokeOpacity=".55" />
        <path d="M36 33l5 5 10-12" />
      </svg>
    )
  }

  // Understand your data — bars you already have, and the one reading
  // that turns out to be the answer.
  if (kind === 'data') {
    return (
      <svg {...common}>
        {defs}
        <path d="M12 12v40h40" strokeOpacity=".45" />
        <path d="M20 44v-8" strokeOpacity=".55" />
        <path d="M29 44V28" strokeOpacity=".55" />
        <path d="M38 44V34" strokeOpacity=".55" />
        <path d="M47 44V20" />
        <circle cx="47" cy="20" r="2.6" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  // Build something new — parts assembling into one thing.
  if (kind === 'build') {
    return (
      <svg {...common}>
        {defs}
        <rect x="10" y="10" width="20" height="20" rx="2" />
        <rect x="34" y="10" width="20" height="20" rx="2" strokeOpacity=".45" strokeDasharray="3 5" />
        <rect x="10" y="34" width="20" height="20" rx="2" strokeOpacity=".45" strokeDasharray="3 5" />
        <path d="M38 44h12M44 38v12" />
      </svg>
    )
  }

  // Train your team — one point of understanding spreading to several people.
  if (kind === 'train') {
    return (
      <svg {...common}>
        {defs}
        <circle cx="32" cy="20" r="7" />
        <path d="M20 50a12 12 0 0 1 24 0" />
        <path d="M10 44a9 9 0 0 1 8-8" strokeOpacity=".45" />
        <path d="M54 44a9 9 0 0 0-8-8" strokeOpacity=".45" />
        <circle cx="32" cy="20" r="2.2" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  // Find the answer — the material you already have, with the one thing
  // that answers the question picked out of it. The mark is the same
  // four-pointed spark the assistant uses everywhere else on the site.
  if (kind === 'answer') {
    return (
      <svg {...common}>
        {defs}
        <path d="M14 8h18l8 8v28a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" strokeOpacity=".45" />
        <path d="M32 8v8h8" strokeOpacity=".45" />
        <path d="M17 24h14" strokeOpacity=".55" />
        <path d="M17 31h10" strokeOpacity=".55" />
        <path d="M17 38h12" strokeOpacity=".55" />
        <path d="M48 35c.5 4 2.7 6.2 6.7 6.7-4 .5-6.2 2.7-6.7 6.7-.5-4-2.7-6.2-6.7-6.7 4-.5 6.2-2.7 6.7-6.7z"
          fill="currentColor" stroke="none" />
      </svg>
    )
  }

  /* The AI solutions. Same frame, same stroke, same single accent. */

  // Voice receptionist — a handset, and the call it is answering.
  if (kind === 'voice') {
    return (
      <svg {...common}>
        {defs}
        <path d="M20 12h8l3 10-5 3c2 5 6 9 11 11l3-5 10 3v8c0 2-2 4-4 4C28 46 14 32 14 16c0-2 2-4 4-4z" />
        <path d="M40 12a12 12 0 0 1 12 12" strokeOpacity=".45" />
        <path d="M40 19a5 5 0 0 1 5 5" strokeOpacity=".55" />
        <circle cx="52" cy="12" r="2.6" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  // Chat agent — two messages, the answer the one that glows.
  if (kind === 'chat') {
    return (
      <svg {...common}>
        {defs}
        <path d="M10 14h26a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H20l-8 6v-6h-2" strokeOpacity=".45" />
        <path d="M54 30H30a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h14l8 6v-6h2" />
        <circle cx="40" cy="39" r="2.6" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  // Document AI — a page with a line of light passing down it.
  if (kind === 'document') {
    return (
      <svg {...common}>
        {defs}
        <path d="M16 8h20l10 10v34a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" strokeOpacity=".45" />
        <path d="M36 8v10h10" strokeOpacity=".45" />
        <path d="M18 24h12M18 44h16" strokeOpacity=".55" />
        <path d="M6 34h52" />
        <circle cx="52" cy="34" r="2.6" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  // Back-office agent — a list worked through, one tick waiting on you.
  if (kind === 'agent') {
    return (
      <svg {...common}>
        {defs}
        <path d="M12 16l3 3 6-6M12 32l3 3 6-6" />
        <path d="M28 16h24M28 32h24M28 48h16" strokeOpacity=".55" />
        <circle cx="16" cy="48" r="5" strokeOpacity=".45" />
        <circle cx="16" cy="48" r="2.4" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  // Sales co-pilot — two voices, and the prompt between them.
  if (kind === 'copilot') {
    return (
      <svg {...common}>
        {defs}
        <circle cx="18" cy="22" r="7" strokeOpacity=".55" />
        <circle cx="46" cy="22" r="7" strokeOpacity=".55" />
        <path d="M8 44a10 10 0 0 1 20 0M36 44a10 10 0 0 1 20 0" strokeOpacity=".45" />
        <path d="M32 30c.5 4 2.7 6.2 6.7 6.7-4 .5-6.2 2.7-6.7 6.7-.5-4-2.7-6.2-6.7-6.7 4-.5 6.2-2.7 6.7-6.7z"
          fill="currentColor" stroke="none" />
      </svg>
    )
  }

  // Built for you — parts joined into one process, one of them ours.
  if (kind === 'bespoke') {
    return (
      <svg {...common}>
        {defs}
        <rect x="8" y="26" width="12" height="12" rx="3" strokeOpacity=".55" />
        <rect x="44" y="12" width="12" height="12" rx="3" strokeOpacity=".55" />
        <rect x="44" y="40" width="12" height="12" rx="3" strokeOpacity=".55" />
        <path d="M20 32h8M36 32c4 0 4-14 8-14M36 32c4 0 4 14 8 14" strokeOpacity=".45" />
        <circle cx="32" cy="32" r="4" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  // Fix something — a spanner, reduced to a ring and a shaft. No card uses
  // this now, but it is the fallback for an unrecognised kind, and the one
  // to come back to if the repair card ever returns.
  return (
    <svg {...common}>
        {defs}
      <path d="M40 12a12 12 0 0 0-9.5 19.3L14 47.8a4 4 0 0 0 5.7 5.7l16.5-16.5A12 12 0 1 0 40 12z" strokeOpacity=".45" />
      <circle cx="40" cy="24" r="6.5" />
      <path d="M30.5 31.3L14 47.8a4 4 0 0 0 5.7 5.7l16.5-16.5" />
    </svg>
  )
}

/* ---------- Section divider — a horizon line with a travelling light ---------- */
export function Horizon() {
  return (
    <div className="horizon" aria-hidden="true">
      <span className="horizon__line" />
      <span className="horizon__spark" />
    </div>
  )
}
