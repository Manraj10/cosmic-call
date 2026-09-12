import type { CrewId, RoleId, SignalId, StationId } from './types.ts'

export const MISSION_SECONDS = 90
export const SIGNAL_COOLDOWN_MS = 4000
export const BRACE_WINDOW_SECONDS = 5

export const VEGA_META = {
  callsign: 'VEGA',
  title: 'Vega',
  seat: 'In the air plant',
  constraint: 'Cannot hear anything',
  honor: 'Silence your phone. Earplugs are better. You get light and vibration only.',
  blurb:
    'You are the only one who can touch the ship. You are also the only one who can see how much air is left. You will not hear the alarm, the ship, or three people screaming your name.',
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
      'You are the only one who knows how much power is left. Vega cannot run the pump and the shields on what you are looking at.',
    accent: '#ffb020',
  },
  pilot: {
    callsign: 'IDRIS',
    title: 'Idris',
    sees: 'Dust storm clock',
    blurb:
      'You are the only one who can see the storm coming. Nobody else knows how long they have.',
    accent: '#ff6a22',
  },
  sparks: {
    callsign: 'CHEN',
    title: 'Chen',
    sees: 'Alarm log',
    blurb:
      'You are the only one who knows what just broke. The log tells you which valve, which system, right now.',
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
  vega: { title: 'Vega — the hands', constraint: 'Deaf. Every control.' },
  engineer: { title: 'Rook — power', constraint: 'Sees the reactor' },
  pilot: { title: 'Idris — storm', constraint: 'Sees the clock' },
  sparks: { title: 'Chen — alarms', constraint: 'Sees what broke' },
  board: { title: 'Hab monitor', constraint: 'Spectator / camera view' },
}

/** The only way anything reaches Vega. One pad, shared by all three crew. */
export const SIGNALS: {
  id: SignalId
  label: string
  mark: string
  hint: string
}[] = [
  { id: 'pump-off', label: 'PUMP OFF', mark: '⏻', hint: 'Kill the air pump' },
  { id: 'pump-on', label: 'PUMP ON', mark: '⏼', hint: 'Start the air pump' },
  { id: 'seal-port', label: 'SEAL PORT', mark: '◀', hint: 'Close the port valve' },
  { id: 'seal-starboard', label: 'SEAL STBD', mark: '▶', hint: 'Close the starboard valve' },
  { id: 'shields-on', label: 'SHIELDS', mark: '⛨', hint: 'Raise the dust shields' },
  { id: 'brace', label: 'BRACE', mark: '▣', hint: 'Hold on, impact' },
]

export function signalLabel(id: SignalId): string {
  return SIGNALS.find((s) => s.id === id)?.label ?? id
}

export function signalMark(id: SignalId): string {
  return SIGNALS.find((s) => s.id === id)?.mark ?? '?'
}
