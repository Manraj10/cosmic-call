/** Rook's reactor. Segmented so a glance reads as "how many bars left". */
export function PowerCells({ power }: { power: number }) {
  const cells = 12
  const lit = Math.round((Math.max(0, Math.min(100, power)) / 100) * cells)
  return (
    <svg viewBox="0 0 220 74" role="img" aria-label={`Power ${Math.round(power)} percent`}>
      <defs>
        <filter id="cellglow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {Array.from({ length: cells }, (_, i) => {
        const on = i < lit
        const x = 8 + i * 17.5
        const danger = lit <= 3
        const warn = lit <= 6
        const color = danger ? '#ff3b1f' : warn ? '#ffb020' : '#ffd479'
        return (
          <g key={i}>
            <rect x={x} y="10" width="13" height="42" rx="1.5" fill="#130d09" stroke="#3a2a1c" />
            {on ? (
              <rect
                x={x + 2}
                y="12"
                width="9"
                height="38"
                rx="1"
                fill={color}
                filter="url(#cellglow)"
                opacity={0.92}
              />
            ) : null}
          </g>
        )
      })}
      <line x1="8" y1="60" x2="212" y2="60" stroke="#3a2a1c" />
      <text x="8" y="71" fill="#7d6a52" fontSize="9" letterSpacing="2">
        EMPTY
      </text>
      <text x="212" y="71" textAnchor="end" fill="#7d6a52" fontSize="9" letterSpacing="2">
        FULL
      </text>
    </svg>
  )
}
