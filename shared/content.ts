import type { BreakerId, PhraseId, PingId, RoleId, StationId } from './types.ts'

export const MISSION_SECONDS = 120

export const ROLE_META: Record<
  RoleId,
  {
    title: string
    station: string
    constraint: string
    honor: string
    blurb: string
    accent: string
  }
> = {
  oxygen: {
    title: 'Oxygen',
    station: 'O2 / Pressure',
    constraint: 'Deaf — zero audio',
    honor: 'Put the phone on silent. You get lights and vibration only.',
    blurb:
      'You can see the needle. You cannot hear the siren, the astronaut, or anyone begging you to shut the pump. If it is not flashing on your glass, it did not happen.',
    accent: '#3ee0ff',
  },
  power: {
    title: 'Power',
    station: 'Main bus',
    constraint: 'Blind — no readouts',
    honor: 'Do not hunt for numbers. There are none. Play by ear and by switch position.',
    blurb:
      'The 14% is never printed. The ship speaks it — or a teammate shouts it. Breakers are a spatial grid. Learn the layout, then stop looking.',
    accent: '#ffb020',
  },
  nav: {
    title: 'Navigation',
    station: 'Storm watch',
    constraint: 'Mute — pings only',
    honor: 'Do not speak. Do not type. The palette is your whole mouth.',
    blurb:
      'You see the dust front and the leak lights. You cannot say "storm incoming, brace." You ping it, or the hab takes the hit cold.',
    accent: '#ff6a22',
  },
  comms: {
    title: 'Communications',
    station: 'Radio / AAC',
    constraint: 'Limited output',
    honor: 'You may only say phrases you actually transmit. The cooldown is the device.',
    blurb:
      'You are the radio. The teleprinter sees every alert. Your board has sixteen phrases and a hard cooldown — same bandwidth as an AAC device.',
    accent: '#5cff9d',
  },
}

export const STATION_META: Record<
  StationId,
  { title: string; constraint: string }
> = {
  ...ROLE_META,
  board: {
    title: 'Table display',
    constraint: 'Public bus — no secrets',
  },
}

export const BREAKER_LAYOUT: {
  id: BreakerId
  spoken: string
  row: number
  col: number
  shape: 'square' | 'round' | 'notch'
}[] = [
  { id: 'main', spoken: 'Main bus', row: 0, col: 0, shape: 'square' },
  { id: 'o2', spoken: 'Oxygen pumps', row: 0, col: 1, shape: 'round' },
  { id: 'scrubber', spoken: 'Scrubber', row: 0, col: 2, shape: 'notch' },
  { id: 'shields', spoken: 'Shields', row: 0, col: 3, shape: 'square' },
  { id: 'nav', spoken: 'Navigation', row: 1, col: 0, shape: 'round' },
  { id: 'comms', spoken: 'Communications', row: 1, col: 1, shape: 'notch' },
  { id: 'fans', spoken: 'Life fans', row: 1, col: 2, shape: 'round' },
]

export const BREAKER_SCRIPT =
  'Breaker layout. Top row, left to right: Main bus, Oxygen pumps, Scrubber, Shields. Bottom row: Navigation, Communications, Fans. The last slot is empty. Say scan to hear which are on.'

export const PINGS: { id: PingId; label: string; mark: string }[] = [
  { id: 'storm', label: 'STORM', mark: '◎' },
  { id: 'brace', label: 'BRACE', mark: '▣' },
  { id: 'stop', label: 'STOP', mark: '⊘' },
  { id: 'now', label: 'NOW', mark: '►' },
  { id: 'wait', label: 'WAIT', mark: '◌' },
  { id: 'o2', label: 'O2', mark: 'O₂' },
  { id: 'pwr', label: 'PWR', mark: '⚡' },
  { id: 'left', label: 'PORT', mark: '◀' },
  { id: 'right', label: 'STBD', mark: '▶' },
  { id: 'query', label: 'QUERY', mark: '?' },
  { id: 'yes', label: 'YES', mark: '✓' },
  { id: 'no', label: 'NO', mark: '×' },
]

export const PHRASES: { id: PhraseId; label: string; cat: string }[] = [
  { id: 'status', label: 'STATUS?', cat: 'radio' },
  { id: 'copy', label: 'COPY', cat: 'radio' },
  { id: 'negative', label: 'NEGATIVE', cat: 'radio' },
  { id: 'say-again', label: 'SAY AGAIN', cat: 'radio' },
  { id: 'o2-low', label: 'OXYGEN LOW', cat: 'o2' },
  { id: 'o2-off', label: 'TURN OFF OXYGEN', cat: 'o2' },
  { id: 'seal-port', label: 'SEAL PORT VALVE', cat: 'o2' },
  { id: 'seal-star', label: 'SEAL STARBOARD VALVE', cat: 'o2' },
  { id: 'pump-on', label: 'PUMP ON', cat: 'o2' },
  { id: 'need-power', label: 'NEED POWER', cat: 'pwr' },
  { id: 'shields', label: 'POWER TO SHIELDS', cat: 'pwr' },
  { id: 'breaker', label: 'BREAKER TRIPPED', cat: 'pwr' },
  { id: 'reset-grid', label: 'RESET THE GRID', cat: 'pwr' },
  { id: 'storm', label: 'STORM INCOMING', cat: 'nav' },
  { id: 'brace', label: 'BRACE', cat: 'nav' },
  { id: 'co2', label: 'CO2 SPIKE', cat: 'life' },
]

export const PHRASE_COOLDOWN_MS = 5200
export const GLITCH_COOLDOWN_MS = 12000
export const PING_COOLDOWN_MS = 1100

export function pingLabel(id: PingId): string {
  return PINGS.find((p) => p.id === id)?.label ?? id
}

export function phraseLabel(id: PhraseId): string {
  return PHRASES.find((p) => p.id === id)?.label ?? id
}
