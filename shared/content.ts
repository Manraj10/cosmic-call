import type { Fixture } from './habitat.ts'
import type { CrewId, RoleId, SignalId, StationId } from './types.ts'

export const CREW_JOB: Record<CrewId, string> = {
  engineer: 'Power is yours. Kill the pump when the draw spikes. Vega will hate you for it.',
  pilot: 'Navigation is yours. Shields eat Rook\'s power. Take it anyway before the front lands.',
  sparks:
    'Communications is yours. You see what broke, and you hold the key registry. When somebody says their key is signing without them, you are the only one who can send her to fix it.',
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
  seat: 'The only hands aboard',
  constraint: 'Cannot hear anything',
  honor:
    'You are the only body on this ship. Watch the glass, read the seal, and run. When they need something they will send a picture — and some of those pictures are lies.',
  blurb:
    'You cannot hear the crew. You have every control and the only air gauge, and the controls are bolted to different ends of the hab. The crew reach you only through pictures on your glass, and some are forged, so read the seal before you run. You can still talk: say the air out loud. They just cannot talk back.',
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
      'You are power. When the draw spikes, the pump has to go off, and your only way to tell Vega is a card. Idris wants that same power for shields. Argue it out loud; she cannot hear any of it.',
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
    sees: 'Alarm log + key registry',
    blurb:
      'You are communications. You see what broke, and you are the only one who can send her to rotate a stolen key.',
    accent: '#5cff9d',
  },
}

/**
 * What each seat is told in the lobby. Same three lines for everyone, plain
 * instructions only: a teammate who had played it could not explain it, so
 * anything that is not an instruction was cut.
 */
export interface Briefing {
  /** The one rule, shown first. Worded the same as the top of public/how.html. */
  rule: string
  see: string
  buttons: string
  job: string
}

const CREW_RULE =
  "Say what you see out loud, then press your button when it's your problem. If your log says NOT YOU, yell it."

const CREW_JOB_LINE =
  'Shout what you see. Send your card when it is yours.'

export const BRIEFING: Record<RoleId, Briefing> = {
  vega: {
    rule: 'Only obey an order if it says SEALED. Walk to the room it names.',
    see: 'Cabin air only. You cannot hear the crew.',
    buttons:
      'Valves and pump in the Air Plant. Shields in the Airlock. Key rotation in Comms, only while holding the token. BRACE anywhere. Tap a room on the map to walk there.',
    job: 'When a card slams your screen, check the stamp. SEALED = do it. BROKEN SEAL = a hacker wrote it, ignore it. OLD COUNTER = a replay, ignore it. Walk to the room the card needs. Say your air out loud.',
  },
  engineer: {
    rule: CREW_RULE,
    see: 'Reactor power, and how hard the reactor is working.',
    buttons: 'PUMP OFF, PUMP ON. The whole crew shares one cooldown.',
    job: `When the draw spikes, the pump has to go off. ${CREW_JOB_LINE}`,
  },
  pilot: {
    rule: CREW_RULE,
    see: 'The dust storm clock.',
    buttons: 'SHIELDS, BRACE. The whole crew shares one cooldown.',
    job: `Send SHIELDS before the storm lands. Send BRACE when the clock reads 4. ${CREW_JOB_LINE}`,
  },
  sparks: {
    rule: CREW_RULE,
    see: 'The alarm log: what broke.',
    buttons:
      'SEAL PORT, SEAL STBD, ROTATE ROOK, ROTATE IDRIS, ROTATE CHEN. The whole crew shares one cooldown.',
    job: `Seal the valve the log names. ${CREW_JOB_LINE} If someone yells NOT YOU, send ROTATE for them.`,
  },
}

export const ROLE_TITLE: Record<RoleId, string> = {
  vega: VEGA_META.title,
  engineer: CREW_META.engineer.title,
  pilot: CREW_META.pilot.title,
  sparks: CREW_META.sparks.title,
}

export const STATION_META: Record<StationId, { title: string; constraint: string }> = {
  vega: { title: 'Vega — the hands', constraint: 'Every control, and she has to walk to it.' },
  engineer: { title: 'Rook — power', constraint: 'Sees the reactor' },
  pilot: { title: 'Idris — navigation', constraint: 'Sees the storm clock' },
  sparks: { title: 'Chen — comms', constraint: 'Sees what broke, holds the registry' },
  board: { title: 'Mission control', constraint: 'Spectator / big screen' },
}

/**
 * The only way anything reaches Vega — and each card is welded to one crew
 * member's console. Chen is the only person alive who can tell her which valve
 * to seal, or send her to the registry to rotate a key.
 *
 * `sendsTo` is where the card makes her go. It is the reason a forged order now
 * costs her body and not just her attention.
 */
export const SIGNALS: {
  id: SignalId
  label: string
  mark: string
  hint: string
  owner: CrewId
  sendsTo: Fixture
  /** Revocations have no plate art; they render as type. */
  plate: 'art' | 'type'
}[] = [
  {
    id: 'seal-port',
    label: 'SEAL PORT',
    mark: '◀',
    // Port and starboard are jargon, and the log uses them. Spell it out.
    hint: 'Port = left · sends her to the plant',
    owner: 'sparks',
    sendsTo: 'valves',
    plate: 'art',
  },
  {
    id: 'seal-starboard',
    label: 'SEAL STBD',
    mark: '▶',
    hint: 'Starboard = right · sends her to the plant',
    owner: 'sparks',
    sendsTo: 'valves',
    plate: 'art',
  },
  {
    id: 'pump-off',
    label: 'PUMP OFF',
    mark: '⏻',
    hint: 'Frees power for shields · she has to be in the plant',
    owner: 'engineer',
    sendsTo: 'pump',
    plate: 'art',
  },
  {
    id: 'pump-on',
    label: 'PUMP ON',
    mark: '⏼',
    hint: 'Without this the air just decays',
    owner: 'engineer',
    sendsTo: 'pump',
    plate: 'art',
  },
  {
    id: 'shields-on',
    label: 'SHIELDS',
    mark: '⛨',
    hint: 'Up before the front lands · she has to reach the airlock',
    owner: 'pilot',
    sendsTo: 'shields',
    plate: 'art',
  },
  {
    id: 'brace',
    label: 'BRACE',
    mark: '▣',
    hint: 'Send at T-4 · she has to hold on in the last 3 seconds, anywhere',
    owner: 'pilot',
    sendsTo: 'anywhere',
    plate: 'art',
  },
  {
    id: 'revoke-power',
    label: 'ROTATE ROOK',
    mark: '⟳',
    hint: 'Only if Rook says his key is signing without him',
    owner: 'sparks',
    sendsTo: 'registry',
    plate: 'type',
  },
  {
    id: 'revoke-nav',
    label: 'ROTATE IDRIS',
    mark: '⟳',
    hint: 'Only if Idris says his key is signing without him',
    owner: 'sparks',
    sendsTo: 'registry',
    plate: 'type',
  },
  {
    id: 'revoke-comms',
    label: 'ROTATE CHEN',
    mark: '⟳',
    // On a short crew comms may be the only console left, and GHOST will take
    // the key it can reach. Rotating it is Vega's job either way, so a seat
    // asking for its own rotation is not the contradiction it looks like.
    hint: 'Your own key. Send it if your log fills with orders you did not press',
    owner: 'sparks',
    sendsTo: 'registry',
    plate: 'type',
  },
]

export const SIGNAL_OWNER: Record<SignalId, CrewId> = SIGNALS.reduce(
  (acc, s) => {
    acc[s.id] = s.owner
    return acc
  },
  {} as Record<SignalId, CrewId>,
)

/** Which seat a rotation card is asking her to rotate. */
export const REVOKE_TARGET: Partial<Record<SignalId, CrewId>> = {
  'revoke-power': 'engineer',
  'revoke-nav': 'pilot',
  'revoke-comms': 'sparks',
}

export const REVOKE_CARD: Record<CrewId, SignalId> = {
  engineer: 'revoke-power',
  pilot: 'revoke-nav',
  sparks: 'revoke-comms',
}

export function signalsFor(crew: CrewId) {
  return SIGNALS.filter((s) => s.owner === crew)
}

/** Cards for a console that is covering more than one seat on a short crew. */
export function signalsForAll(crews: CrewId[]) {
  return SIGNALS.filter((s) => crews.includes(s.owner))
}

export function signalMeta(id: SignalId) {
  return SIGNALS.find((s) => s.id === id)
}

export function signalLabel(id: SignalId): string {
  return signalMeta(id)?.label ?? id
}

export function signalMark(id: SignalId): string {
  return signalMeta(id)?.mark ?? '?'
}

export function signalSendsTo(id: SignalId): Fixture {
  return signalMeta(id)?.sendsTo ?? 'anywhere'
}

/** The picture that slams Vega's glass. Same plate the crew press. */
export function signalArt(id: SignalId): string | null {
  return signalMeta(id)?.plate === 'art' ? `/art/sig-${id}.webp` : null
}
