import { MODULE_LABEL, MODULES, walkSeconds } from '@shared/habitat'
import type { HabView, ModuleId } from '@shared/types'

const POSITION: Record<ModuleId, [number, number]> = {
  plant: [210, 270], lock: [440, 130], spine: [440, 355], comms: [670, 270],
}
const COLOR: Record<ModuleId, string> = {
  plant: '#8ce8df', lock: '#ffb16c', spine: '#d9dce9', comms: '#c7afff',
}

/** Follow the server's two-hop route through the spine, never across empty terrain. */
export function operatorPosition(hab: HabView): [number, number] {
  if (!hab.walkingTo) return POSITION[hab.at]
  const path = hab.at === 'spine' || hab.walkingTo === 'spine'
    ? [hab.at, hab.walkingTo] : [hab.at, 'spine' as const, hab.walkingTo]
  const progress = Math.max(0, Math.min(1, 1 - hab.arriveInMs / (walkSeconds(hab.at, hab.walkingTo) * 1000)))
  const step = progress * (path.length - 1)
  const index = Math.min(path.length - 2, Math.floor(step))
  const a = POSITION[path[index]]
  const b = POSITION[path[index + 1]]
  return [a[0] + (b[0] - a[0]) * (step - index), a[1] + (b[1] - a[1]) * (step - index)]
}

export function MissionHabitat({ operator, storm, pumpOn, shieldsOn }: {
  operator: HabView; storm: boolean; pumpOn: boolean; shieldsOn: boolean
}) {
  const [x, y] = operatorPosition(operator)
  return (
    <svg className="mc-habitat" viewBox="0 0 880 520" role="img"
      aria-label={`Habitat map. Vega ${operator.walkingTo ? `walking to ${MODULE_LABEL[operator.walkingTo]}` : `at ${MODULE_LABEL[operator.at]}`}. Key token ${operator.holdingToken ? 'carried by Vega' : operator.tokenAt ? `at ${MODULE_LABEL[operator.tokenAt]}` : 'unavailable'}.`}>
      <defs>
        <pattern id="mc-grid" width="44" height="24" patternUnits="userSpaceOnUse" patternTransform="skewX(-30)"><path d="M44 0H0V24" fill="none" stroke="#b68c85" strokeOpacity=".12" /></pattern>
        <radialGradient id="mc-terrain"><stop stopColor="#604040" /><stop offset="1" stopColor="#1b202d" /></radialGradient>
        <linearGradient id="mc-hull" x2="0" y2="1"><stop stopColor="#d7d8df" /><stop offset="1" stopColor="#9499ae" /></linearGradient>
      </defs>
      <rect width="880" height="520" fill="url(#mc-terrain)" /><rect width="880" height="520" fill="url(#mc-grid)" />
      <g fill="none" stroke="#e2b39a" opacity=".12"><ellipse cx="440" cy="280" rx="390" ry="207" /><ellipse cx="440" cy="280" rx="340" ry="174" /><path d="M0 434Q90 390 155 453T350 486M624 40Q698 104 880 65M35 110l25-8 35 12-21 9zM777 435l28-12 40 13-30 11z" /></g>
      {(['plant', 'lock', 'comms'] as const).map((id) => <g key={id}>
        <path d={`M440 355L${POSITION[id].join(' ')}`} stroke="#101520" strokeWidth="38" />
        <path d={`M440 355L${POSITION[id].join(' ')}`} stroke="#667081" strokeWidth="24" />
        <path d={`M440 355L${POSITION[id].join(' ')}`} stroke="#a4b1c0" strokeWidth="2" strokeDasharray="5 9" />
      </g>)}
      {operator.walkingTo ? <path className="mc-route" d={`M${POSITION[operator.at].join(' ')}${operator.at !== 'spine' && operator.walkingTo !== 'spine' ? 'L440 355' : ''}L${POSITION[operator.walkingTo].join(' ')}`} /> : null}
      {MODULES.map((id) => {
        const [mx, my] = POSITION[id]
        const active = operator.at === id && !operator.walkingTo
        const status = id === 'plant' ? `PUMP ${pumpOn ? 'ON' : 'OFF'}` : id === 'lock' ? `SHIELDS ${shieldsOn ? 'UP' : 'DOWN'}` : id === 'comms' ? 'KEY REGISTRY' : 'TRANSIT HUB'
        return <g key={id} transform={`translate(${mx} ${my})`}>
          <ellipse cy="34" rx="106" ry="46" fill="#0e121b" opacity=".4" />
          <path d="M-104 0L0 46L104 0V26L0 72L-104 26Z" fill="#454e63" stroke="#1b2333" /><path d="M0 46V72L104 26V0Z" fill="#333e53" />
          <path d="M-104 0L0-46L104 0L0 46Z" fill="url(#mc-hull)" stroke={active ? COLOR[id] : '#a4acbe'} strokeWidth={active ? 3 : 1} />
          <path d="M-78 0L0-34L78 0L0 34Z" fill="#28364b" stroke={COLOR[id]} strokeOpacity=".5" /><path d="M-55 0L0-24L55 0L0 24Z" fill={COLOR[id]} opacity=".12" />
          {[-1, 0, 1].map((n) => <path key={n} d={`M${n * 17 - 18} 18l35-16`} stroke={COLOR[id]} opacity=".35" strokeWidth="3" />)}
          <path d="M-87 23l52 23M35 46l52-23" stroke={COLOR[id]} strokeWidth="4" />
          <text y="-71" textAnchor="middle" fill="#f1eef5" fontSize="16" fontWeight="700" letterSpacing="2">{MODULE_LABEL[id].toUpperCase()}</text>
          <text y="-54" textAnchor="middle" fill={COLOR[id]} fontSize="10" letterSpacing="1.5">{status}</text>
          {operator.tokenAt === id ? <g transform="translate(56 -4)" fill="#ffdb86"><circle r="6" fill="none" stroke="#ffdb86" strokeWidth="3" /><path d="M5 0h16v6h-4v-3h-5v3H9V0Z" /></g> : null}
        </g>
      })}
      <g className="mc-astronaut" transform={`translate(${x} ${y - 18})`}>
        <ellipse cy="25" rx="18" ry="7" fill="#000" opacity=".4" /><circle cy="3" r="27" fill="none" stroke="#8ce8df" strokeOpacity=".45" strokeDasharray="3 5" />
        <rect x="-16" y="-4" width="32" height="23" rx="6" fill="#8c94ac" /><rect x="-11" y="2" width="22" height="24" rx="7" fill="#eeeef5" />
        <path d="M-6 18v10M6 18v10" stroke="#eeeef5" strokeWidth="7" /><circle cy="-8" r="14" fill="#f2f1f7" /><rect x="-10" y="-14" width="20" height="11" rx="5" fill="#203649" /><path d="M-6-11h8" stroke="#8ce8df" strokeWidth="2" />
        {operator.holdingToken ? <circle cx="20" cy="11" r="6" fill="#ffdb86" stroke="#342b32" strokeWidth="2" /> : null}
        <rect x="-30" y="-51" width="60" height="21" rx="4" fill="#8ce8df" /><text y="-37" textAnchor="middle" fill="#14202d" fontSize="11" fontWeight="800" letterSpacing="2">VEGA</text>
      </g>
      {storm ? <g className="mc-storm-lines" stroke="#ffc48c" strokeOpacity=".2" strokeWidth="2">{Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${-180 + i * 100} 0l-190 520`} />)}</g> : null}
      <text x="25" y="488" fill="#b2afbe" fontSize="10" letterSpacing="2">HAB-7 / SURFACE TELEMETRY</text><text x="855" y="488" textAnchor="end" fill="#b2afbe" fontSize="10" letterSpacing="2">MARS · SECTOR 07</text>
    </svg>
  )
}
