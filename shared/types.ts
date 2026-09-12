export const ROLE_IDS = ['vega', 'engineer', 'pilot', 'sparks'] as const
export type RoleId = (typeof ROLE_IDS)[number]
export type StationId = RoleId | 'board'

/** The three crew who can hear, talk, and see one readout each. */
export const CREW_IDS = ['engineer', 'pilot', 'sparks'] as const
export type CrewId = (typeof CREW_IDS)[number]

export const VALVES = ['port', 'starboard'] as const
export type ValveId = (typeof VALVES)[number]

/**
 * Vega never receives audio. That is the whole game, so it is one predicate that
 * the server routes every spoken line through rather than a condition inlined at
 * the send site. Unseated players and the spectator board stay silent too: the
 * board is meant to sit on the table, and hearing the ship from an empty seat
 * would leak the crew's job to the room.
 */
export function hearsSpeech(role: StationId | null): boolean {
  return role !== null && role !== 'vega' && role !== 'board'
}

export type SignalId =
  | 'pump-off'
  | 'pump-on'
  | 'seal-port'
  | 'seal-starboard'
  | 'shields-on'
  | 'brace'

export type Phase = 'lobby' | 'play' | 'end'
export type Outcome = 'won' | 'lost'
export type AirBand = 'ok' | 'low' | 'critical' | 'over'

export interface LobbyPlayer {
  id: string
  name: string
  role: StationId | null
  ready: boolean
  connected: boolean
  host: boolean
}

export interface SignalEvent {
  id: string
  signal: SignalId
  from: CrewId | null
  at: number
  /** Vega has not cleared it yet. */
  fresh: boolean
}

export interface ClientView {
  code: string
  phase: Phase
  you: {
    id: string
    name: string
    role: StationId | null
    host: boolean
    ready: boolean
  }
  players: LobbyPlayer[]
  timeLeft: number | null

  /** Vega only: the one number that matters. */
  air: number | null
  airBand: AirBand | null
  /** Vega only: her own panel. */
  valves: Record<ValveId, 'open' | 'sealed'> | null
  leakLights: Record<ValveId, boolean> | null
  pumpOn: boolean | null
  shieldsOn: boolean | null
  braced: boolean | null
  /** Vega only: signals pushed to her glass. */
  signals: SignalEvent[]

  /** Engineer only. */
  power: number | null
  /** Engineer only: how hard the reactor is working, not why. */
  draw: number | null
  /** Pilot only. */
  stormEta: number | null
  stormActive: boolean | null
  /** Sparks only. */
  alarms: string[]

  /** Shared by the three crew: one signal pad, one cooldown. */
  signalCooldownMs: number | null
  /** The call this player sent last — not anyone else's. */
  lastSignal: SignalId | null
  /** Only the sender sees her ack. Everyone else has to ask. */
  ackAgeMs: number | null

  /**
   * What THIS seat is being told to do right now. Computed per role so two
   * phones can scream opposite orders at the same second — that is the fight.
   */
  order: { text: string; tone: 'fight' | 'warn' } | null
  /** Someone just spent a resource this seat owns. Lasts a few seconds. */
  gripe: string | null

  outcome: Outcome | null
  loseReason: string | null
  /** Spectator board only. */
  spectator: {
    air: number
    power: number
    stormEta: number | null
    pumpOn: boolean
    shieldsOn: boolean
    valves: Record<ValveId, 'open' | 'sealed'>
    alarms: string[]
  } | null
}

export type ClientAction =
  | { type: 'valve'; valve: ValveId; sealed: boolean }
  | { type: 'pump'; on: boolean }
  | { type: 'shields'; on: boolean }
  | { type: 'brace' }
  | { type: 'clear-signals' }
  | { type: 'signal'; signal: SignalId }
