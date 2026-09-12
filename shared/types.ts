export const ROLE_IDS = ['oxygen', 'power', 'nav', 'comms'] as const
export type RoleId = (typeof ROLE_IDS)[number]
export type StationId = RoleId | 'board'

export const BREAKERS = [
  'main',
  'o2',
  'scrubber',
  'shields',
  'nav',
  'comms',
  'fans',
] as const
export type BreakerId = (typeof BREAKERS)[number]

export const VALVES = ['port', 'starboard'] as const
export type ValveId = (typeof VALVES)[number]

export type Phase = 'lobby' | 'play' | 'end'
export type HullBand = 'ok' | 'warn' | 'crit'
export type PowerHint = 'dead' | 'strain' | 'hum' | 'surge'
export type Outcome = 'won' | 'lost'

export type PingId =
  | 'storm'
  | 'brace'
  | 'stop'
  | 'now'
  | 'wait'
  | 'o2'
  | 'pwr'
  | 'left'
  | 'right'
  | 'query'
  | 'yes'
  | 'no'

export type PhraseId =
  | 'status'
  | 'copy'
  | 'negative'
  | 'say-again'
  | 'o2-low'
  | 'o2-off'
  | 'seal-port'
  | 'seal-star'
  | 'pump-on'
  | 'need-power'
  | 'shields'
  | 'breaker'
  | 'reset-grid'
  | 'storm'
  | 'brace'
  | 'co2'

export interface LobbyPlayer {
  id: string
  name: string
  role: StationId | null
  ready: boolean
  connected: boolean
  host: boolean
}

export interface PingEvent {
  id: string
  ping: PingId
  at: number
}

export interface RadioEvent {
  id: string
  phrase: PhraseId
  at: number
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
  hullBand: HullBand
  hull: number | null
  pings: PingEvent[]
  radio: RadioEvent[]
  oxygen: number | null
  valves: Record<ValveId, 'open' | 'sealed'> | null
  pumpOn: boolean | null
  mix: number | null
  alarm: boolean
  breakers: Record<BreakerId, boolean> | null
  powerHint: PowerHint | null
  stormEta: number | null
  stormActive: boolean
  heading: number | null
  targetHeading: number | null
  shieldsUp: boolean | null
  cooldownMs: number | null
  glitch: boolean
  disabledPhrases: PhraseId[]
  printer: string[]
  outcome: Outcome | null
  loseReason: string | null
  braced: boolean
}

export type ClientAction =
  | { type: 'valve'; valve: ValveId; sealed: boolean }
  | { type: 'pump'; on: boolean }
  | { type: 'mix'; value: number }
  | { type: 'breaker'; breaker: BreakerId; on: boolean }
  | { type: 'heading'; deg: number }
  | { type: 'ping'; ping: PingId }
  | { type: 'phrase'; phrase: PhraseId }
