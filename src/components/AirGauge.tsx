import type { AirBand } from '@shared/types'

const START = -220
const SWEEP = 260

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const a = polar(cx, cy, r, from)
  const b = polar(cx, cy, r, to)
  const large = Math.abs(to - from) > 180 ? 1 : 0
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`
}

const BAND_COLOR: Record<AirBand, string> = {
  ok: '#3ee0ff',
  low: '#ffb020',
  critical: '#ff3b1f',
  over: '#ff3b1f',
}

/**
 * Vega's only instrument. The red hatching at the top of the dial is the whole
 * lesson: more air is not better, and nobody can tell her that out loud.
 */
export function AirGauge({ air, band }: { air: number; band: AirBand }) {
  const cx = 110
  const cy = 108
  const r = 84
  const pct = Math.max(0, Math.min(100, air))
  const needle = START + (SWEEP * pct) / 100
  const tip = polar(cx, cy, r - 12, needle)
  const tail = polar(cx, cy, 14, needle + 180)
  const color = BAND_COLOR[band]

  return (
    <svg viewBox="0 0 220 200" role="img" aria-label={`Air ${Math.round(air)} percent`}>
      <defs>
        <linearGradient id="dial" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#20160f" />
          <stop offset="100%" stopColor="#0c0806" />
        </linearGradient>
        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx={cx} cy={cy} r={r + 14} fill="url(#dial)" stroke="#3a2a1c" strokeWidth="2" />

      <path
        d={arc(cx, cy, r, START, START + SWEEP)}
        fill="none"
        stroke="#2b1f16"
        strokeWidth="14"
        strokeLinecap="round"
      />
      {/* Safe span */}
      <path
        d={arc(cx, cy, r, START + SWEEP * 0.18, START + SWEEP * 0.92)}
        fill="none"
        stroke="#123642"
        strokeWidth="14"
      />
      {/* Suffocation end */}
      <path
        d={arc(cx, cy, r, START, START + SWEEP * 0.18)}
        fill="none"
        stroke="#4a1109"
        strokeWidth="14"
      />
      {/* Overpressure end */}
      <path
        d={arc(cx, cy, r, START + SWEEP * 0.92, START + SWEEP)}
        fill="none"
        stroke="#ff3b1f"
        strokeWidth="14"
      />

      <path
        d={arc(cx, cy, r, START, needle)}
        fill="none"
        stroke={color}
        strokeWidth="14"
        strokeLinecap="round"
        filter="url(#glow)"
        opacity="0.95"
      />

      {Array.from({ length: 11 }, (_, i) => {
        const deg = START + (SWEEP * i) / 10
        const outer = polar(cx, cy, r - 22, deg)
        const inner = polar(cx, cy, r - (i % 5 === 0 ? 34 : 29), deg)
        return (
          <line
            key={i}
            x1={outer.x}
            y1={outer.y}
            x2={inner.x}
            y2={inner.y}
            stroke="#7d6a52"
            strokeWidth={i % 5 === 0 ? 2.5 : 1.5}
          />
        )
      })}

      <line
        x1={tail.x}
        y1={tail.y}
        x2={tip.x}
        y2={tip.y}
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        filter="url(#glow)"
      />
      <circle cx={cx} cy={cy} r="7" fill="#0c0806" stroke={color} strokeWidth="3" />
    </svg>
  )
}
