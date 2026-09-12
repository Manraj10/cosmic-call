/** Idris's scope. The dust front closes on the hab as the clock runs down. */
export function StormScope({
  eta,
  active,
  lead,
}: {
  eta: number | null
  active: boolean
  lead: number
}) {
  const progress = eta == null ? 0 : active ? 1 : 1 - Math.min(1, eta / Math.max(lead, 1))
  const frontY = 18 + progress * 96

  return (
    <svg viewBox="0 0 220 160" role="img" aria-label="Dust storm scope">
      <defs>
        <linearGradient id="dust" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff6a22" stopOpacity="0.05" />
          <stop offset="70%" stopColor="#ff6a22" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ff3b1f" stopOpacity="0.85" />
        </linearGradient>
        <clipPath id="scope">
          <rect x="8" y="8" width="204" height="144" rx="3" />
        </clipPath>
      </defs>

      <rect x="8" y="8" width="204" height="144" rx="3" fill="#0a0705" stroke="#3a2a1c" />

      <g clipPath="url(#scope)">
        {[40, 80, 120].map((y) => (
          <line key={y} x1="8" y1={y} x2="212" y2={y} stroke="#1e150e" />
        ))}
        {[60, 110, 160].map((x) => (
          <line key={x} x1={x} y1="8" x2={x} y2="152" stroke="#1e150e" />
        ))}

        {eta != null ? (
          <>
            <rect x="8" y={frontY - 46} width="204" height="46" fill="url(#dust)" />
            <path
              d={`M 8 ${frontY} Q 58 ${frontY - 12} 110 ${frontY} T 212 ${frontY}`}
              fill="none"
              stroke={active ? '#ff3b1f' : '#ff6a22'}
              strokeWidth="3"
            />
            {Array.from({ length: 9 }, (_, i) => (
              <circle
                key={i}
                cx={20 + i * 24}
                cy={frontY - 12 - (i % 3) * 9}
                r={1.6 + (i % 3) * 0.7}
                fill="#ffb98d"
                opacity="0.75"
              />
            ))}
          </>
        ) : (
          <text x="110" y="80" textAnchor="middle" fill="#5e4b38" fontSize="11" letterSpacing="3">
            SKY CLEAR
          </text>
        )}

        {/* The hab */}
        <g transform="translate(110 132)">
          <circle r="11" fill="#12211f" stroke="#3ee0ff" strokeWidth="2" />
          <circle r="3" fill="#3ee0ff" />
          <line x1="-18" y1="0" x2="-13" y2="0" stroke="#3ee0ff" strokeWidth="2" />
          <line x1="13" y1="0" x2="18" y2="0" stroke="#3ee0ff" strokeWidth="2" />
        </g>
      </g>
    </svg>
  )
}
