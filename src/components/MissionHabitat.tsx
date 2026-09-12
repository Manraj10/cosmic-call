import { MODULE_LABEL, MODULES, walkSeconds } from '@shared/habitat'
import type { HabView, ModuleId } from '@shared/types'

/** Centre of each module's deck. Spine in the middle, PLANT above, LOCK left, COMMS right. */
const POSITION: Record<ModuleId, [number, number]> = {
  plant: [440, 150], lock: [180, 340], spine: [440, 340], comms: [700, 340],
}
const COLOR: Record<ModuleId, string> = {
  plant: '#6ff0c8', lock: '#ffb020', spine: '#7ee7ff', comms: '#c2a8ff',
}
/** Deck top and side colours, taken from the habitat prototype's room palette. */
const DECK: Record<ModuleId, [string, string]> = {
  plant: ['#14443a', '#0a2420'], lock: ['#243444', '#121c26'], spine: ['#1e2c3c', '#0e1822'], comms: ['#2a2450', '#161230'],
}
const W = 96, H = 46, D = 22
const TOP = `M0 ${-H}L${W} 0L0 ${H}L${-W} 0Z`
const INNER = `M${-W * 0.62} 0L0 ${-H * 0.62}L${W * 0.62} 0L0 ${H * 0.62}Z`
const STARS = [[70, 34], [130, 80], [205, 26], [290, 62], [380, 22], [520, 70], [590, 30], [640, 88], [820, 110], [860, 40], [35, 140], [470, 44]]
const KEY = <g fill="#ffd27a"><circle r="6" fill="none" stroke="#ffd27a" strokeWidth="3" /><path d="M5-1.5h14v3h-2.5v4.5h-3v-4.5H5Z" /></g>

/** Follow the server's two-hop route through the spine, never across empty terrain. */
// oxlint-disable-next-line react/only-export-components -- also exercised by the telemetry check
export function operatorPosition(hab: HabView): [number, number] {
  if (!hab.walkingTo || hab.walkingTo === hab.at) return POSITION[hab.at]
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
  const { at, walkingTo, holdingToken, tokenAt } = operator
  const status: Record<ModuleId, [string, boolean]> = {
    plant: [`PUMP ${pumpOn ? 'ON' : 'OFF'}`, !pumpOn], lock: [`SHIELDS ${shieldsOn ? 'UP' : 'DOWN'}`, !shieldsOn],
    comms: ['KEY REGISTRY', false], spine: ['TRANSIT HUB', false],
  }
  return (
    <svg className="mc-habitat" viewBox="0 0 880 520" role="img"
      aria-label={`Habitat map. Vega ${walkingTo ? `walking to ${MODULE_LABEL[walkingTo]}` : `at ${MODULE_LABEL[at]}`}. Key token ${holdingToken ? 'carried by Vega' : tokenAt ? `at ${MODULE_LABEL[tokenAt]}` : 'unavailable'}.`}>
      <defs>
        <filter id="mch-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id="mch-soft" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="8" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <radialGradient id="mch-sky" cx=".5" cy="1.2" r="1.1"><stop stopColor="#c44a1a" /><stop offset=".42" stopColor="#1c0a0e" /><stop offset=".75" stopColor="#07040c" /></radialGradient>
        <radialGradient id="mch-sky-storm" cx=".5" cy="1.2" r="1.1"><stop stopColor="#8a3a12" /><stop offset=".45" stopColor="#261006" /><stop offset=".8" stopColor="#0a0402" /></radialGradient>
        <linearGradient id="mch-deck" x2="0" y2="1"><stop stopColor="#7ee7ff" stopOpacity=".22" /><stop offset="1" stopColor="#ff8a3a" stopOpacity=".04" /></linearGradient>
        <pattern id="mch-dust" width="60" height="60" patternUnits="userSpaceOnUse"><g fill="#e0a878"><circle cx="8" cy="12" r="1.6" /><circle cx="38" cy="30" r="1.1" /><circle cx="22" cy="50" r="2" /><circle cx="52" cy="6" r=".9" /></g></pattern>
        <pattern id="mch-grit" width="140" height="140" patternUnits="userSpaceOnUse"><g fill="#f0c090"><circle cx="30" cy="40" r="3" /><circle cx="100" cy="110" r="2.4" /><circle cx="118" cy="22" r="1.8" /></g></pattern>
      </defs>

      <rect width="880" height="520" fill={storm ? 'url(#mch-sky-storm)' : 'url(#mch-sky)'} />
      {storm ? null : <g>
        {STARS.map(([sx, sy], i) => <circle key={i} cx={sx} cy={sy} r={i % 3 ? 1 : 1.6} fill="#fff" opacity={0.45 + (i % 5) * 0.08} />)}
        <circle cx="770" cy="56" r="20" fill="#ffd27a" opacity=".85" filter="url(#mch-soft)" />
      </g>}
      <ellipse cx="440" cy="530" rx="520" ry="80" fill="#4a1c0c" opacity=".55" />
      <ellipse cx="170" cy="505" rx="160" ry="34" fill="#2a1008" opacity=".5" />
      <ellipse cx="720" cy="512" rx="180" ry="30" fill="#3a1408" opacity=".45" />

      {(['plant', 'lock', 'comms'] as const).map((id) => {
        const d = `M${POSITION.spine.join(' ')}L${POSITION[id].join(' ')}`
        return <g key={id} fill="none" strokeLinecap="round">
          <path d={d} stroke="#7ee7ff" strokeWidth="44" opacity=".07" />
          <path d={d} stroke="#0b1c28" strokeWidth="26" />
          <path d={d} stroke="#7ee7ff" strokeWidth="14" opacity=".4" />
          <path d={d} stroke="#d6fbff" strokeWidth="3" opacity=".75" strokeDasharray="6 10" />
        </g>
      })}
      {walkingTo ? <path className="mc-route" d={`M${POSITION[at].join(' ')}${at !== 'spine' && walkingTo !== 'spine' ? `L${POSITION.spine.join(' ')}` : ''}L${POSITION[walkingTo].join(' ')}`} /> : null}

      {MODULES.map((id) => {
        const [fill, side] = DECK[id]
        const lit = (at === id && !walkingTo) || walkingTo === id
        const [text, alarm] = status[id]
        const below = id === 'spine'
        return <g key={id} transform={`translate(${POSITION[id].join(' ')})`}>
          <ellipse cy={D + 10} rx={W + 16} ry={H + 6} fill="#000" opacity=".35" />
          <path d={`M${-W} 0L0 ${H}V${H + D}L${-W} ${D}Z`} fill={side} />
          <path d={`M0 ${H}L${W} 0V${D}L0 ${H + D}Z`} fill={side} opacity=".7" />
          <path d={`M${-W + 8} ${D - 4}L0 ${H + D - 6}L${W - 8} ${D - 4}`} fill="none" stroke={COLOR[id]} strokeOpacity=".55" strokeWidth="2" />
          <path className={id === 'lock' && storm && alarm ? 'mch-flicker' : undefined} d={TOP} fill={fill}
            stroke={lit ? COLOR[id] : '#7ee7ff66'} strokeWidth={lit ? 3.5 : 1.5} filter={lit ? 'url(#mch-glow)' : undefined} />
          <path d={TOP} fill="url(#mch-deck)" />
          <path d={INNER} fill="none" stroke={COLOR[id]} strokeOpacity=".35" strokeDasharray="4 6" />
          <ellipse rx="22" ry="11" fill={COLOR[id]} opacity=".16" />
          {id === 'plant' ? [-54, -32, 32, 54].map((cx) => <circle key={cx} cx={cx} cy={Math.abs(cx) === 54 ? 2 : -8} r="7" fill={side} stroke={COLOR[id]} strokeOpacity=".7" />) : null}
          {id === 'lock' ? [0, 1, 2].map((i) => <path key={i} d={`M${-66 + i * 18} 12l8-8 8 8`} fill="none" stroke={COLOR[id]} strokeWidth="3" opacity=".8" />) : null}
          {id === 'comms' ? <g stroke={COLOR[id]} strokeWidth="2" fill="none"><path d="M58 -4L70 -40" /><ellipse cx="70" cy="-44" rx="11" ry="6" /></g> : null}
          {id === 'spine' ? [[-W, 0], [W, 0], [0, -H]].map(([hx, hy]) => <circle key={hx + hy} cx={hx * 0.8} cy={hy * 0.8} r="5" fill={COLOR[id]} opacity=".5" />) : null}
          <text className="mch-label" y={below ? H + D + 34 : -H - 34}>{MODULE_LABEL[id].toUpperCase()}</text>
          <text className={`mch-status${alarm ? ' alarm' : ''}${alarm && storm ? ' mch-flicker' : ''}`} y={below ? H + D + 54 : -H - 12} fill={alarm ? '#ff7a6a' : COLOR[id]}>{text}</text>
        </g>
      })}

      {tokenAt && !holdingToken ? <g transform={`translate(${POSITION[tokenAt][0] + 40} ${POSITION[tokenAt][1] + 18}) scale(1.3)`} filter="url(#mch-glow)">{KEY}</g> : null}

      <g className="mch-vega" style={{ transform: `translate(${x}px, ${y}px)` }}>
        <ellipse cy="12" rx="16" ry="6" fill="#000" opacity=".45" />
        <circle className="mch-halo" r="24" fill="#7ee7ff" opacity=".2" />
        <circle r="11" fill="#7ee7ff" filter="url(#mch-glow)" />
        <circle r="5" fill="#fff" />
        {holdingToken ? <g filter="url(#mch-glow)"><circle r="18" fill="none" stroke="#ffd27a" strokeWidth="3" /><g transform="translate(16 12) scale(1.1)">{KEY}</g></g> : null}
        <rect x="-32" y="-54" width="64" height="24" rx="5" fill="#7ee7ff" />
        <text className="mch-vega-label" y="-36">VEGA</text>
      </g>

      {storm ? <g pointerEvents="none">
        <rect width="880" height="520" fill="#c8702a" opacity=".06" />
        <rect className="mch-dust" x="-140" y="-140" width="1160" height="800" fill="url(#mch-dust)" opacity=".55" />
        <rect className="mch-grit" x="-420" y="-280" width="1440" height="940" fill="url(#mch-grit)" opacity=".6" />
      </g> : null}
      <text className="mch-foot" x="22" y="506">HAB-7 / SURFACE TELEMETRY</text>
      <text className="mch-foot" x="858" y="506" textAnchor="end">MARS · SECTOR 07</text>
    </svg>
  )
}
