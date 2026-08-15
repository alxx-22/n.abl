import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from './ui/index.jsx'

/* ============================================================
   VISUALS — brand-native imagery, drawn not photographed.
   Everything here is SVG/canvas built from the design tokens, so
   it themes automatically, weighs almost nothing, needs no CDN
   and never blocks on an external request.
   ============================================================ */

/* ---------- Hero: a constellation of systems wiring together ----------
   Nodes drift gently; links brighten as they shorten. Reads as
   "disconnected tools becoming one system" without being literal. */
export function NodeField({ className = '' }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const reduce = prefersReducedMotion()

    let w = 0, h = 0, raf = 0
    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    const COUNT = 34
    const nodes = []

    const seed = () => {
      nodes.length = 0
      for (let i = 0; i < COUNT; i++) {
        nodes.push({
          x: Math.random(), y: Math.random(),
          vx: (Math.random() - 0.5) * 0.00035,
          vy: (Math.random() - 0.5) * 0.00035,
          r: Math.random() * 1.6 + 0.8,
        })
      }
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      w = rect.width; h = rect.height
      canvas.width = w * DPR; canvas.height = h * DPR
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)

      // links
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j]
          const dx = (a.x - b.x) * w, dy = (a.y - b.y) * h
          const dist = Math.hypot(dx, dy)
          if (dist > 170) continue
          const t = 1 - dist / 170
          ctx.strokeStyle = `rgba(240, 231, 216, ${t * 0.13})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(a.x * w, a.y * h)
          ctx.lineTo(b.x * w, b.y * h)
          ctx.stroke()
        }
      }
      // nodes
      nodes.forEach((n, i) => {
        const accent = i % 7 === 0
        ctx.fillStyle = accent ? 'rgba(233, 172, 87, 0.85)' : 'rgba(240, 231, 216, 0.45)'
        if (accent) { ctx.shadowColor = 'rgba(233, 172, 87, 0.8)'; ctx.shadowBlur = 12 }
        ctx.beginPath()
        ctx.arc(n.x * w, n.y * h, n.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      })
    }

    const step = () => {
      nodes.forEach((n) => {
        n.x += n.vx; n.y += n.vy
        if (n.x < 0 || n.x > 1) n.vx *= -1
        if (n.y < 0 || n.y > 1) n.vy *= -1
      })
      draw()
      raf = requestAnimationFrame(step)
    }

    seed(); resize(); draw()
    if (!reduce) raf = requestAnimationFrame(step)

    const ro = new ResizeObserver(() => { resize(); draw() })
    ro.observe(canvas)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return <canvas ref={canvasRef} className={`nodefield ${className}`} aria-hidden="true" />
}

/* ---------- Category glyphs — one per problem the client arrives with.
   These used to be three glyphs for three disciplines (Innovation,
   Automation, Optimisation), which described our tools rather than the
   client's problem. Six now, matching the six things people actually
   turn up asking for. Same geometric language throughout: true circles,
   a single stroke weight, one solid accent dot as the focal point. */
export function CategoryGlyph({ kind }) {
  const common = {
    viewBox: '0 0 64 64', width: 46, height: 46, fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.4,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true', className: 'glyph',
  }

  // Save time — a clock with the wasted wedge lifted out of it.
  if (kind === 'time') {
    return (
      <svg {...common}>
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
        <rect x="10" y="16" width="44" height="32" rx="3" strokeOpacity=".45" />
        <path d="M18 26h14" strokeOpacity=".55" />
        <path d="M18 34h10" strokeOpacity=".55" />
        <path d="M18 42h18" strokeOpacity=".55" />
        <path d="M36 33l5 5 10-12" />
      </svg>
    )
  }

  // Get more customers — a funnel that keeps hold of what enters it.
  if (kind === 'customers') {
    return (
      <svg {...common}>
        <path d="M12 16h40L37 34v14l-10 6V34z" />
        <path d="M12 16h40" strokeOpacity=".45" />
        <circle cx="32" cy="10" r="2.6" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  // Build something new — parts assembling into one thing.
  if (kind === 'build') {
    return (
      <svg {...common}>
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
        <circle cx="32" cy="20" r="7" />
        <path d="M20 50a12 12 0 0 1 24 0" />
        <path d="M10 44a9 9 0 0 1 8-8" strokeOpacity=".45" />
        <path d="M54 44a9 9 0 0 0-8-8" strokeOpacity=".45" />
        <circle cx="32" cy="20" r="2.2" fill="currentColor" stroke="none" />
      </svg>
    )
  }

  // Fix something — a spanner, reduced to a ring and a shaft.
  return (
    <svg {...common}>
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
