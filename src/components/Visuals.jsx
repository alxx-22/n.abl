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

/* ---------- Pillar glyphs — geometric, one per discipline ---------- */
export function PillarGlyph({ kind }) {
  const common = {
    viewBox: '0 0 64 64', width: 46, height: 46, fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.4,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true', className: 'glyph',
  }
  if (kind === 'innovation') {
    // radiating discovery
    return (
      <svg {...common}>
        <circle cx="32" cy="32" r="9" />
        <circle cx="32" cy="32" r="19" strokeOpacity=".55" strokeDasharray="3 6" />
        <circle cx="32" cy="32" r="28" strokeOpacity=".28" strokeDasharray="2 8" />
        <circle cx="32" cy="32" r="3" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  if (kind === 'automation') {
    // a loop that closes on itself
    return (
      <svg {...common}>
        <path d="M18 24h20a10 10 0 0 1 0 20H20" />
        <path d="M26 16l-8 8 8 8" />
        <rect x="10" y="38" width="12" height="12" rx="2" strokeOpacity=".5" />
        <rect x="44" y="14" width="12" height="12" rx="2" strokeOpacity=".5" />
      </svg>
    )
  }
  // optimisation — a rising, tightening signal
  return (
    <svg {...common}>
      <path d="M10 46l11-11 8 7 11-15 8 6" />
      <path d="M10 54h44" strokeOpacity=".35" />
      <circle cx="48" cy="33" r="3" fill="currentColor" stroke="none" />
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
