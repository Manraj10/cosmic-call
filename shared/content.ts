import type { CrewId, RoleId, SignalId, StationId } from './types.ts'

export const CREW_JOB: Record<CrewId, string> = {
  engineer: 'Power is yours. Kill the pump when the draw spikes. Vega will hate you for it.',
  pilot: 'Navigation is yours. Shields eat Rook\'s bus. Take it anyway before the front lands.',
  sparks: 'Communications is yours. Seal the leak. That also starves the pump. They will shout.',
}

export const MISSION_SECONDS = 90
export const SIGNAL_COOLDOWN_MS = 4000
/** How close to impact Vega has to be holding on. Tight on purpose. */
export const BRACE_WINDOW_SECONDS = 3
/** How long the front sits on top of the hab once it lands. */
export const STORM_DURATION_SECONDS = 18

export const VEGA_META = {
  callsign: 'VEGA',
  title: 'Vega',
  seat: 'In the air plant',
  constraint: 'Cannot hear anything',
  honor: 'You are oxygen. Watch the glass. When they need something they will send a picture — and it will often be the opposite of what your air says.',
  blurb:
    'You have every control and the only air gauge. Rook will tell you to kill the pump. Your number will say absolutely not. Both of you are right. Say the air out loud.',
  accent: '#3ee0ff',
} as const

export const CREW_META: Record<
  CrewId,
  { callsign: string; title: string; sees: string; blurb: string; accent: string }
> = {
  engineer: {
    callsign: 'ROOK',
    title: 'Rook',
    sees: 'Reactor power',
    blurb:
      'You are power. When the draw spikes, scream to kill the pump. Vega will refuse. Idris will want that same bus for shields.',
    accent: '#ffb020',
  },
  pilot: {
    callsign: 'IDRIS',
    title: 'Idris',
    sees: 'Dust storm clock',
    blurb:
      'You are navigation. The storm is only on your scope. Taking shields will make Rook lose his mind. Take them anyway.',
    accent: '#ff6a22',
  },
  sparks: {
    callsign: 'CHEN',
    title: 'Chen',
    sees: 'Alarm log',
    blurb:
      'You are communications. You see what broke. Sealing a leak starves the pump. They will blame you for the air.',
    accent: '#5cff9d',
  },
}

export const ROLE_TITLE: Record<RoleId, string> = {
  vega: VEGA_META.title,
  engineer: CREW_META.engineer.title,
  pilot: CREW_META.pilot.title,
  sparks: CREW_META.sparks.title,
}

export const STATION_META: Record<StationId, { title: string; constraint: string }> = {
  vega: { title: 'Vega — oxygen', constraint: 'Every control. Pictures slam the glass.' },
  engineer: { title: 'Rook — power', constraint: 'Sees the reactor' },
  pilot: { title: 'Idris — navigation', constraint: 'Sees the storm clock' },
  sparks: { title: 'Chen — communications', constraint: 'Sees what broke' },
  board: { title: 'Hab monitor', constraint: 'Spectator / camera view' },
}

/**
 * The only way anything reaches Vega — and each signal is welded to one crew
 * member's console. Chen is the only person alive who can tell her which valve
 * to seal; Rook is the only one who can touch the pump; Idris is the only one
 * who can call the storm. Lose any one of them and there is no way to win.
 */
export const SIGNALS: {
  id: SignalId
  label: string
  mark: string
  hint: string
  owner: CrewId
}[] = [
  {
    id: 'seal-port',
    label: 'SEAL PORT',
    mark: '◀',
    // Port and starboard are jargon, and the log uses them. Spell it out.
    hint: 'Port = left',
    owner: 'sparks',
  },
  {
    id: 'seal-starboard',
    label: 'SEAL STBD',
    mark: '▶',
    hint: 'Starboard = right',
    owner: 'sparks',
  },
  {
    id: 'pump-off',
    label: 'PUMP OFF',
    mark: '⏻',
    hint: 'Frees the power her shields need',
    owner: 'engineer',
  },
  {
    id: 'pump-on',
    label: 'PUMP ON',
    mark: '⏼',
    hint: 'Without this the air just decays',
    owner: 'engineer',
  },
  {
    id: 'shields-on',
    label: 'SHIELDS',
    mark: '⛨',
    hint: 'Up before the front lands',
    owner: 'pilot',
  },
  {
    id: 'brace',
    label: 'BRACE',
    mark: '▣',
    hint: 'Send at T-4 — she needs a beat to react',
    owner: 'pilot',
  },
]

export const SIGNAL_OWNER: Record<SignalId, CrewId> = SIGNALS.reduce(
  (acc, s) => {
    acc[s.id] = s.owner
    return acc
  },
  {} as Record<SignalId, CrewId>,
)

export function signalsFor(crew: CrewId) {
  return SIGNALS.filter((s) => s.owner === crew)
}

export function signalLabel(id: SignalId): string {
  return SIGNALS.find((s) => s.id === id)?.label ?? id
}

export function signalMark(id: SignalId): string {
  return SIGNALS.find((s) => s.id === id)?.mark ?? '?'
}

/** The picture that slams Vega's glass. Same plate the crew press. */
export function signalArt(id: SignalId): string {
  return `/art/sig-${id}.webp`
}
