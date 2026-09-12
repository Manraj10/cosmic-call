import { REVOKE_CARD } from '../shared/content.ts'
import { mintKey, sealOrder, shortTag, tagsMatch } from '../shared/seal.ts'
import type { SealState } from '../shared/seal.ts'
import { CREW_IDS, VALVES } from '../shared/types.ts'
import type { CrewId, SignalId, ValveId } from '../shared/types.ts'

/**
 * The comms bus, and the thing living on it.
 *
 * Every order the operator receives claims to come from a console. This class
 * is the only thing that can tell the difference. It holds one signing key per
 * seat, the counter that makes a replay detectable, and GHOST — a scripted
 * adversary that writes orders it is not entitled to write.
 *
 * Three attacks, in the order a real incident goes:
 *   1. forgery  — orders whose signature does not verify
 *   2. replay   — a real order, captured and re-sent when it will hurt
 *   3. theft    — a stolen key, after which the forgeries verify
 *
 * Only the third is undetectable from the operator's glass, which is the point:
 * by then the crew has to notice it themselves and say so out loud.
 */

export interface SignEntry {
  signal: SignalId
  seq: number
  at: number
  /** False means something was signed under your key that you did not press. */
  mine: boolean
}

export interface IncidentReport {
  delivered: number
  forged: number
  replays: number
  /** The number that costs you the round. */
  obeyedUnsealed: number
  stolenFrom: CrewId | null
  /** Seconds from key theft to the crew revoking it. Null if never revoked. */
  timeToRevoke: number | null
  /** Seats revoked that were never compromised. Each one costs the table a call. */
  falseRevokes: number
  /**
   * Seconds the operator spent walking somewhere a forged order sent her. The
   * cost of an attack on a body rather than on attention.
   */
  wastedWalkSeconds: number
  grade: string
}

/** How many recent counters stay valid. Anything older reads as a replay. */
const SEQ_WINDOW = 24

export class Bus {
  readonly roundId: string

  private keys = {} as Record<CrewId, string>
  private epoch = {} as Record<CrewId, number>
  /** The counter the console should sign with next. */
  private nextSeq = {} as Record<CrewId, number>
  private used = {} as Record<CrewId, Set<number>>
  private log = {} as Record<CrewId, SignEntry[]>

  /** Real orders GHOST has watched go past, available to replay later. */
  private captured: { seat: CrewId; signal: SignalId; seq: number; tag: string }[] = []

  stolenFrom: CrewId | null = null
  /** Remembered separately so the report still names the seat after a revoke. */
  stolenSeat: CrewId | null = null
  stolenAt: number | null = null
  revokedAt: number | null = null

  delivered = 0
  forged = 0
  replays = 0
  obeyedUnsealed = 0
  falseRevokes = 0

  constructor(roundId: string) {
    this.roundId = roundId
    for (const c of CREW_IDS) this.reissue(c)
  }

  private reissue(seat: CrewId) {
    this.keys[seat] = mintKey()
    this.epoch[seat] = (this.epoch[seat] ?? 0) + 1
    this.nextSeq[seat] = 1
    this.used[seat] = new Set()
    this.log[seat] ??= []
  }

  keyFor(seat: CrewId): string {
    return this.keys[seat]
  }

  epochFor(seat: CrewId): number {
    return this.epoch[seat]
  }

  seqFor(seat: CrewId): number {
    return this.nextSeq[seat]
  }

  logFor(seat: CrewId): SignEntry[] {
    return this.log[seat] ?? []
  }

  /**
   * Check an order that claims to come from `seat`.
   *
   * Verification always uses the full 256-bit tag. A stale counter verifies and
   * is still refused — that is the difference between a replay and a forgery,
   * and the operator's glass shows them differently for exactly that reason.
   */
  async verify(
    seat: CrewId,
    signal: SignalId,
    seq: number,
    tag: string,
    now: number,
  ): Promise<SealState> {
    const expected = await sealOrder(this.keys[seat], this.roundId, seat, signal, seq)
    if (!tagsMatch(expected, tag)) return 'broken'
    if (this.used[seat].has(seq)) return 'stale'
    if (seq < this.nextSeq[seat] - SEQ_WINDOW) return 'stale'

    this.used[seat].add(seq)
    this.nextSeq[seat] = Math.max(this.nextSeq[seat], seq + 1)
    this.log[seat] = [...this.log[seat].slice(-7), { signal, seq, at: now, mine: true }]
    this.captured = [...this.captured.slice(-5), { seat, signal, seq, tag }]
    return 'sealed'
  }

  /**
   * GHOST writes an order it was not asked to write. Before the theft the
   * signature is noise and the seal reads broken. After the theft it holds the
   * seat's key, so the same forgery verifies and the glass cannot tell.
   */
  async forge(
    seat: CrewId,
    signal: SignalId,
    now: number,
  ): Promise<{ seq: number; tag: string; seal: SealState }> {
    const stolen = this.stolenFrom === seat
    const seq = this.nextSeq[seat]
    const tag = stolen
      ? await sealOrder(this.keys[seat], this.roundId, seat, signal, seq)
      : mintKey()

    if (stolen) {
      this.used[seat].add(seq)
      this.nextSeq[seat] = seq + 1
      // The tell. The seat it was signed as did not press this, and only that
      // crew member can see the discrepancy.
      this.log[seat] = [...this.log[seat].slice(-7), { signal, seq, at: now, mine: false }]
    }
    this.forged += 1
    return { seq, tag, seal: stolen ? 'sealed' : 'broken' }
  }

  /** Re-send something real at a moment when it is no longer the right call. */
  replay(): { seat: CrewId; signal: SignalId; seq: number; tag: string } | null {
    const shot = this.captured.at(-1)
    if (!shot) return null
    this.replays += 1
    return shot
  }

  steal(seat: CrewId, now: number) {
    this.stolenFrom = seat
    this.stolenSeat = seat
    this.stolenAt = now
  }

  /**
   * Rotate a seat's key. Kills GHOST's copy if it had one, and voids every tag
   * that seat has in flight either way — which is why guessing wrong costs the
   * table a call instead of being free.
   */
  revoke(seat: CrewId, now: number): { caught: boolean } {
    const caught = this.stolenFrom === seat
    this.reissue(seat)
    if (caught) {
      this.stolenFrom = null
      this.revokedAt = now
    } else {
      this.falseRevokes += 1
    }
    return { caught }
  }

  compromised(seat: CrewId): boolean {
    return this.stolenFrom === seat
  }

  /**
   * GHOST picks the order that hurts most right now rather than a random one.
   * A forgery the operator would have ignored anyway teaches her nothing.
   *
   * `correct` is the set of orders that happen to be the right call at this
   * instant, and GHOST is forbidden from sending any of them. Without that it
   * drifts into helping: during a dust front the pump is ingesting grit, so a
   * forged PUMP OFF is the best move on the board, and a crew that ignored
   * their own engineer could coast on GHOST doing his job. The balance harness
   * caught exactly that.
   *
   * When nothing harmful is available it sends noise instead. A wasted BRACE
   * still costs the operator a glance and a thumb, which is the pressure this
   * attack is for.
   */
  pickHarmful(state: {
    air: number
    power: number
    pumpOn: boolean
    stormActive: boolean
    leaking: ValveId[]
    sealedValves: ValveId[]
    correct: SignalId[]
  }): { seat: CrewId; signal: SignalId } {
    const ok = (s: SignalId) => !state.correct.includes(s)

    // The cruellest card on the board. A forged rotation does not just waste a
    // press — it walks the only pair of hands on the ship to the far end of it
    // carrying the one object anybody needs, and rotates a key that was fine.
    // Aimed at a seat GHOST is NOT sitting on, so the real key stays live.
    const decoy = CREW_IDS.find((c) => c !== this.stolenFrom && ok(REVOKE_CARD[c]))
    if (decoy && this.stolenFrom) return { seat: 'sparks', signal: REVOKE_CARD[decoy] }

    // A pump running inside the front feeds the cabin dust, so keeping it lit
    // is the cruellest thing GHOST can ask for.
    if (state.stormActive && !state.pumpOn && ok('pump-on')) {
      return { seat: 'engineer', signal: 'pump-on' }
    }
    if (state.air > 78 && !state.pumpOn && ok('pump-on')) {
      return { seat: 'engineer', signal: 'pump-on' }
    }
    if (state.air < 55 && state.pumpOn && !state.stormActive && ok('pump-off')) {
      return { seat: 'engineer', signal: 'pump-off' }
    }
    // Sealing a valve that is not bleeding starves the intake instead of the leak.
    const quiet = VALVES.filter(
      (v) => !state.leaking.includes(v) && !state.sealedValves.includes(v),
    )
    for (const v of quiet) {
      const sig: SignalId = v === 'port' ? 'seal-port' : 'seal-starboard'
      if (ok(sig)) return { seat: 'sparks', signal: sig }
    }
    if (state.power < 45 && !state.stormActive && ok('shields-on')) {
      return { seat: 'pilot', signal: 'shields-on' }
    }
    // Nothing harmful left on the board. Waste her attention instead.
    return { seat: 'pilot', signal: 'brace' }
  }

  /**
   * Which seat GHOST goes after.
   *
   * It has to be a seat somebody is actually sitting in: the victim's own
   * signing log is the only evidence the theft ever happened, so stealing from
   * an empty chair would make the attack unwinnable rather than hard. On a
   * short crew that can mean comms, which is fine — the operator performs the
   * rotation, not the crew, so a seat can always ask for its own key back.
   */
  pickVictim(rng: () => number, seated: CrewId[] = ['engineer', 'pilot']): CrewId {
    const manned = seated.filter((c) => CREW_IDS.includes(c))
    const preferred = manned.filter((c) => c !== 'sparks')
    const pool = preferred.length ? preferred : manned.length ? manned : ['engineer' as CrewId]
    return pool[Math.floor(rng() * pool.length)]!
  }

  /**
   * `wastedWalkSeconds` is measured by the simulation, not here — the bus knows
   * what it forged, the hab knows where that sent her.
   */
  report(wastedWalkSeconds = 0): IncidentReport {
    const timeToRevoke =
      this.stolenAt != null && this.revokedAt != null
        ? Math.round((this.revokedAt - this.stolenAt) * 10) / 10
        : null
    return {
      delivered: this.delivered,
      forged: this.forged,
      replays: this.replays,
      obeyedUnsealed: this.obeyedUnsealed,
      stolenFrom: this.stolenSeat,
      timeToRevoke,
      falseRevokes: this.falseRevokes,
      wastedWalkSeconds: Math.round(wastedWalkSeconds * 10) / 10,
      grade: grade(this.obeyedUnsealed, this.falseRevokes, timeToRevoke),
    }
  }

  short(full: string): string {
    return shortTag(full)
  }
}

function grade(obeyed: number, falseRevokes: number, timeToRevoke: number | null): string {
  if (obeyed === 0 && timeToRevoke != null && timeToRevoke < 10 && falseRevokes === 0) {
    return 'CLEAN — nothing GHOST wrote ever moved the ship'
  }
  if (obeyed === 0) return 'HELD — every order you executed was a real one'
  if (obeyed === 1) return 'BREACHED ONCE — one forged order got through'
  return `BREACHED ${obeyed} TIMES — the glass was being driven by GHOST`
}
