/**
 * HAB-7 as a place.
 *
 * The operator holds every control on the ship, and the controls are bolted to
 * different parts of it. She has to walk. That single rule is what welds the
 * two halves of this game together: an order is no longer just something to
 * read and obey, it is somewhere to *go*, and a forged order costs her body
 * rather than only her attention.
 *
 * The crew do not move. They are eyes on instruments; she is the only pair of
 * hands aboard. Letting them walk would hand them each other's readouts and
 * quietly dissolve the asymmetry the whole game rests on.
 */

export const MODULES = ['spine', 'plant', 'lock', 'comms'] as const
export type ModuleId = (typeof MODULES)[number]

export const MODULE_LABEL: Record<ModuleId, string> = {
  spine: 'Spine',
  plant: 'Air Plant',
  lock: 'Airlock',
  comms: 'Comms Bay',
}

export const MODULE_SHORT: Record<ModuleId, string> = {
  spine: 'SPINE',
  plant: 'PLANT',
  lock: 'LOCK',
  comms: 'COMMS',
}

export const MODULE_HOLDS: Record<ModuleId, string> = {
  spine: 'the corridor — and the key token sits here',
  plant: 'both valves and the air pump',
  lock: 'the dust shields',
  comms: 'the key registry',
}

/**
 * A spine with three arms. Everything is one hop from the middle and two hops
 * from anything else, so a wrong guess about which module to run to is a real
 * and symmetrical cost rather than a lottery.
 */
const NEIGHBOURS: Record<ModuleId, ModuleId[]> = {
  spine: ['plant', 'lock', 'comms'],
  plant: ['spine'],
  lock: ['spine'],
  comms: ['spine'],
}

/** Seconds per hop. Long enough to hurt, short enough to risk. */
export const HOP_SECONDS = 1.4

export function neighbours(m: ModuleId): ModuleId[] {
  return NEIGHBOURS[m]
}

/** Hops between two modules on the spine layout. */
export function hops(from: ModuleId, to: ModuleId): number {
  if (from === to) return 0
  if (from === 'spine' || to === 'spine') return 1
  return 2
}

export function walkSeconds(from: ModuleId, to: ModuleId): number {
  return hops(from, to) * HOP_SECONDS
}

/** Where a control physically lives. Null means she can do it anywhere. */
export type Fixture = 'valves' | 'pump' | 'shields' | 'registry' | 'anywhere'

export const FIXTURE_MODULE: Record<Exclude<Fixture, 'anywhere'>, ModuleId> = {
  valves: 'plant',
  pump: 'plant',
  shields: 'lock',
  registry: 'comms',
}

export function moduleFor(f: Fixture): ModuleId | null {
  return f === 'anywhere' ? null : FIXTURE_MODULE[f]
}

/**
 * The key token.
 *
 * A signing key cannot be rotated over the same bus that is compromised, so
 * the registry only accepts a rotation from someone physically holding the
 * token. It is a hardware key in the most literal sense: to revoke, somebody
 * has to pick it up, carry it to the comms bay, and be standing there.
 *
 * This is the reason a forged revocation is the cruellest card GHOST can send.
 * It does not just waste a press — it walks the only pair of hands on the ship
 * to the wrong end of it, holding the one object anyone needs.
 */
export const TOKEN_HOME: ModuleId = 'spine'
