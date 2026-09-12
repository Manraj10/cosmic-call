import {
  BRACE_WINDOW_SECONDS,
  MISSION_SECONDS,
  SIGNAL_COOLDOWN_MS,
  SIGNAL_OWNER,
  STORM_DURATION_SECONDS,
} from '../shared/content.ts'
import { CREW_IDS, VALVES } from '../shared/types.ts'
import type {
  AirBand,
  ClientAction,
  ClientView,
  CrewId,
  IncidentReport,
  LobbyPlayer,
  Outcome,
  SealState,
  SignalEvent,
  SignalId,
  StationId,
  ValveId,
} from '../shared/types.ts'
import { shortTag } from '../shared/seal.ts'
import { Bus } from './ghost.ts'

type Rng = () => number

function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!
}

function clock(seconds: number): string {
  const t = Math.max(0, Math.ceil(seconds))
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function airBand(air: number): AirBand {
  if (air > 92) return 'over'
  if (air < 18) return 'critical'
  if (air < 40) return 'low'
  return 'ok'
}

type ScriptEvent = {
  t: number
  kind:
    | 'leak'
    | 'runaway'
    | 'storm'
    | 'impact'
    | 'drain'
    | 'voice'
    | 'ghost-forge'
    | 'ghost-replay'
    | 'ghost-steal'
  valve?: ValveId
  eta?: number
  line?: string
}

/**
   * How long after a card lands that acting on it still counts as obeying it.
   * Only applies while the card is still un-acknowledged on her glass: the
   * moment she bins it the entry is dropped, so doing the same thing later for
   * a reason of her own is never charged to GHOST. Punishing a coincidence
   * would make the honest operator the one who loses.
   */
const OBEY_WINDOW_SECONDS = 3
/** A revocation costs the table a call, so it runs on its own short lockout. */
const REVOKE_COOLDOWN_MS = 5000

export interface SpeakPacket {
  text: string
  voice: 'astronaut' | 'system'
}

export interface HabListener {
  onView: () => void
  /** Never routed to Vega. She hears nothing, by design. */
  onSpeak: (packet: SpeakPacket) => void
}

interface PlayerRec {
  id: string
  name: string
  role: StationId | null
  ready: boolean
  connected: boolean
  host: boolean
  socketId: string | null
}

export class Hab {
  code: string
  seed: number
  phase: 'lobby' | 'play' | 'end' = 'lobby'
  players = new Map<string, PlayerRec>()
  listener: HabListener | null = null

  private rng: Rng
  private elapsed = 0
  private script: ScriptEvent[] = []
  private scriptI = 0
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private npcAcc = 0

  private air = 70
  private power = 80
  private valves: Record<ValveId, 'open' | 'sealed'> = { port: 'open', starboard: 'open' }
  private leaks: Record<ValveId, boolean> = { port: false, starboard: false }
  private pumpOn = true
  private shieldsOn = false
  private runawayUntil = -1
  private seamBlown = false
  private seams = 0
  private stormEta: number | null = null
  private stormActive = false
  private stormEndsAt = Infinity
  private scourWarned = false
  private ingestWarned = false
  private impactAt = -1
  private bracedAt = -99
  private alarms: string[] = []
  private signals: SignalEvent[] = []
  private lastSignalAt = -99
  /** Each crew member only sees the call they themselves sent. */
  private lastSignalBy: Record<CrewId, SignalId | null> = {
    engineer: null,
    pilot: null,
    sparks: null,
  }
  private vegaAckAt: number | null = null
  /** Ack is one-to-one: only the person who sent the call sees it land. */
  private lastAckedFrom: CrewId | null = null
  /** Rook's unique tell — the number, not the reason. */
  private busDraw = 0.1
  private gripes: Partial<Record<StationId, { text: string; until: number }>> = {}
  private outcome: Outcome | null = null
  private loseReason: string | null = null
  private seq = 1

  /** Key registry, replay window and GHOST itself. Rebuilt every round. */
  private bus = new Bus('lobby')
  private lastRevokeAt = -99
  private incident: IncidentReport | null = null
  /** What the room's big screen is allowed to say about the bus. */
  private busThreat: string | null = null
  /**
   * Orders that arrived without a good seal, and when. If the operator performs
   * one of these shortly after it lands she did what GHOST asked, and that is
   * the only thing in the round that is genuinely her fault.
   */
  private unsealedAsk: { signal: SignalId; at: number }[] = []

  constructor(code: string, host: PlayerRec, seed = Date.now()) {
    this.code = code
    this.seed = seed
    this.rng = mulberry32(seed)
    this.players.set(host.id, host)
  }

  setSocket(playerId: string, socketId: string | null, connected: boolean) {
    const p = this.players.get(playerId)
    if (!p) return
    p.socketId = socketId
    p.connected = connected
    this.listener?.onView()
  }

  addPlayer(rec: PlayerRec) {
    this.players.set(rec.id, rec)
    this.listener?.onView()
  }

  removePlayer(playerId: string): boolean {
    const gone = this.players.delete(playerId)
    if (gone) {
      // Whoever is left should not be stuck waiting on a host who walked out.
      if (![...this.players.values()].some((p) => p.host)) {
        const next = [...this.players.values()].find((p) => p.connected)
        if (next) next.host = true
      }
      this.listener?.onView()
    }
    return gone
  }

  get playerCount(): number {
    return this.players.size
  }

  removeIfEmpty(): boolean {
    return [...this.players.values()].every((p) => !p.connected)
  }

  claim(playerId: string, role: StationId | null): string | null {
    const p = this.players.get(playerId)
    if (!p || this.phase !== 'lobby') return 'Not in lobby'
    if (role && role !== 'board') {
      for (const other of this.players.values()) {
        if (other.id !== playerId && other.role === role) {
          return 'Somebody already took that seat'
        }
      }
    }
    p.role = role
    p.ready = false
    this.listener?.onView()
    return null
  }

  setReady(playerId: string, ready: boolean): string | null {
    const p = this.players.get(playerId)
    if (!p) return 'Unknown crew'
    if (!p.role) return 'Take a seat first'
    p.ready = ready
    this.listener?.onView()
    return null
  }

  start(playerId: string): string | null {
    const p = this.players.get(playerId)
    if (!p?.host) return 'Only the hab lead can launch'
    if (this.phase !== 'lobby') return 'Already underway'
    const seated = [...this.players.values()].filter(
      (c) => c.connected && c.role && c.role !== 'board',
    )
    if (!seated.length) return 'Somebody has to take a seat'
    if (seated.some((c) => !c.ready)) return 'Crew is not ready'
    this.begin()
    return null
  }

  private begin() {
    this.rng = mulberry32(this.seed)
    this.bus = new Bus(`${this.code}-${this.seed}`)
    this.lastRevokeAt = -99
    this.incident = null
    this.busThreat = null
    this.unsealedAsk = []
    this.script = this.buildScript()
    this.phase = 'play'
    this.elapsed = 0
    this.scriptI = 0
    this.air = 48
    this.power = 70
    this.seams = 0
    this.seamBlown = false
    this.alarms = ['HAB-7 IN THE DUST CORRIDOR', 'PLANT IS LIVE', 'BUS KEYS ISSUED — 3 CONSOLES']
    this.speak(
      'Ninety seconds. Talk to each other. Sign every order before you send it.',
      'astronaut',
    )
    this.listener?.onView()
    this.tickTimer = setInterval(() => this.tick(0.1), 100)
  }

  stopClock() {
    if (this.tickTimer) clearInterval(this.tickTimer)
    this.tickTimer = null
  }

  /** Three emergencies. Each one needs a fact only one player can see. */
  private buildScript(): ScriptEvent[] {
    const firstValve = pick(this.rng, VALVES)
    const secondValve: ValveId = firstValve === 'port' ? 'starboard' : 'port'
    const stormWarnAt = 38 + Math.floor(this.rng() * 5)
    const stormLead = 15 + Math.floor(this.rng() * 5)
    // GHOST wakes after the crew has learned to trust the glass. Forgery first,
    // because a broken seal is the cheap lesson; the stolen key lands last,
    // once they have stopped reading the badge.
    const wake = 26 + Math.floor(this.rng() * 4)
    return [
      { t: 8, kind: 'leak', valve: firstValve },
      { t: 24, kind: 'runaway' },
      { t: wake, kind: 'ghost-forge' },
      { t: wake + 9, kind: 'ghost-forge' },
      { t: stormWarnAt, kind: 'storm', eta: stormLead },
      { t: stormWarnAt + 6, kind: 'ghost-replay' },
      { t: stormWarnAt + stormLead, kind: 'impact' },
      { t: 58, kind: 'ghost-steal' },
      { t: 64, kind: 'ghost-forge' },
      { t: 73, kind: 'ghost-forge' },
      { t: 82, kind: 'leak', valve: secondValve },
    ].sort((a, b) => a.t - b.t) as ScriptEvent[]
  }

  private tick(dt: number) {
    if (this.phase !== 'play') return
    this.elapsed += dt
    while (this.scriptI < this.script.length && this.elapsed >= this.script[this.scriptI]!.t) {
      this.fire(this.script[this.scriptI]!)
      this.scriptI += 1
    }
    this.physics(dt)

    this.npcAcc += dt
    if (this.npcAcc >= 1.2) {
      this.npcAcc = 0
      this.npcs()
    }

    if (this.air <= 0) {
      this.end('lost', 'The air ran out.')
      return
    }
    if (this.elapsed >= MISSION_SECONDS) {
      this.end('won', null)
      return
    }
    this.listener?.onView()
  }

  private fire(ev: ScriptEvent) {
    switch (ev.kind) {
      case 'leak':
        if (ev.valve) {
          this.leaks[ev.valve] = true
          this.valves[ev.valve] = 'open'
          this.alarm(`${ev.valve === 'port' ? 'PORT' : 'STARBOARD'} VALVE LEAKING`)
          // Name nothing. Chen has the valve; Vega has the air. They have to talk.
          this.speak('Something in the plant just opened.', 'astronaut')
        }
        break
      case 'runaway':
        this.pumpOn = true
        this.runawayUntil = this.elapsed + 14
        this.seamBlown = false
        // No alarm and no diagnosis. Rook sees the draw spike. Vega sees the
        // air climb. If the ship named the pump, they would not need each other.
        this.speak('The plant is getting loud.', 'astronaut')
        break
      case 'storm': {
        const eta = ev.eta ?? 20
        this.stormEta = eta
        this.impactAt = this.elapsed + eta
        // Idris is the only person who gets the number. Saying it out loud
        // would make his console decoration.
        this.speak('The corridor is changing colour.', 'astronaut')
        break
      }
      case 'impact': {
        this.stormActive = true
        this.stormEta = 0
        this.stormEndsAt = this.elapsed + STORM_DURATION_SECONDS
        this.scourWarned = false
        this.ingestWarned = false
        let hit = 0
        if (!this.shieldsOn || this.power <= 2) {
          hit += 30
          this.alarm('HULL SCOURED')
        }
        // Steep on purpose. At 14 a crew could skip the brace entirely and still
        // survive, which made Idris's second call decoration.
        if (this.elapsed - this.bracedAt > BRACE_WINDOW_SECONDS) {
          hit += 26
        }
        if (hit) {
          this.air = clamp(this.air - hit, 0, 120)
          this.speak('That hit.', 'astronaut')
        } else {
          this.speak('Still in one piece.', 'astronaut')
        }
        break
      }
      case 'ghost-forge': {
        const pickedAt = this.elapsed
        const shot = this.bus.pickHarmful({
          air: this.air,
          power: this.power,
          pumpOn: this.pumpOn,
          stormActive: this.stormActive,
          leaking: VALVES.filter((v) => this.leaks[v]),
          sealedValves: VALVES.filter((v) => this.valves[v] === 'sealed'),
          correct: this.correctNow(),
        })
        // Signing is async and the tick is not. The card lands a frame later,
        // which is indistinguishable from network jitter and costs nothing.
        void this.bus.forge(shot.seat, shot.signal, pickedAt).then((f) => {
          if (this.phase !== 'play') return
          this.pushSignal(shot.signal, shot.seat, f.seal, f.tag, f.seq)
          this.alarm('BUS: UNSIGNED TRAFFIC')
          this.busThreat = 'FORGED ORDERS ON THE BUS'
          this.speak('Somebody else is on our frequency.', 'astronaut')
          this.listener?.onView()
        })
        break
      }
      case 'ghost-replay': {
        const shot = this.bus.replay()
        if (!shot) break
        // A real order, real signature, wrong moment. The counter is the tell.
        this.pushSignal(shot.signal, shot.seat, 'stale', shot.tag, shot.seq)
        this.alarm('BUS: REPEATED COUNTER')
        this.busThreat = 'AN OLD ORDER CAME BACK'
        break
      }
      case 'ghost-steal': {
        const victim = this.bus.pickVictim(this.rng)
        this.bus.steal(victim, this.elapsed)
        // Nothing is announced. The victim's own signing log is the only tell,
        // and the operator's glass will now call these orders genuine.
        this.busThreat = 'A KEY IS LOOSE'
        this.speak('That did not come from any of you.', 'astronaut')
        break
      }
      case 'voice':
        this.speak(ev.line ?? '', 'astronaut')
        break
      case 'drain':
        break
    }
  }

  private physics(dt: number) {
    // Breathing.
    let air = this.air - 0.5 * dt

    for (const v of VALVES) {
      if (this.leaks[v] && this.valves[v] !== 'sealed') air -= 2.9 * dt
    }

    // Valves are the intake as well as the leak, so sealing both starves the pump.
    const feed = VALVES.filter((v) => this.valves[v] === 'open').length / VALVES.length
    const pumpLive = this.pumpOn && this.power > 4 && feed > 0
    // Intake barely outruns breathing, so nobody banks a surplus to coast on.
    if (pumpLive) {
      air += 1.2 * feed * dt
      // Strong enough to drive straight through the overpressure ceiling, so
      // leaving it running is never quietly free air.
      if (this.elapsed < this.runawayUntil) air += 8 * feed * dt
    }

    if (this.stormActive) {
      if (this.elapsed >= this.stormEndsAt) {
        this.stormActive = false
        this.stormEta = null
        this.speak('It is quieter out there.', 'astronaut')
      } else {
        // An intake pump running inside a dust front feeds the cabin dust.
        // Only Rook can call this off, and it is the whole reason he exists.
        if (pumpLive) {
          air -= 3.2 * dt
          if (!this.ingestWarned) {
            this.ingestWarned = true
            this.speak('The air tastes like grit.', 'astronaut')
          }
        }
        if (!this.shieldsOn || this.power <= 12) {
          air -= 1.35 * dt
          if (!this.scourWarned) {
            this.scourWarned = true
            this.alarm('HULL SCOURED')
          }
        }
      }
    }

    // A blown seam does not heal. Otherwise the runaway hands out more air than
    // the burst costs, and ignoring Rook becomes profitable.
    air -= this.seams * 0.9 * dt

    if (air >= 100 && !this.seamBlown) {
      this.seamBlown = true
      this.seams += 1
      air -= 40
      this.alarm(`SEAM ${this.seams} BLEW`)
      this.speak('The hull just complained.', 'astronaut')
    }
    if (this.seamBlown && air < 88) this.seamBlown = false
    this.air = clamp(air, 0, 120)

    // Power is Rook's whole world. Kept so the pump never starves itself into
    // silence — if it browned out on its own it would quietly cancel both of
    // the punishments it is supposed to cause.
    let draw = 0.1
    if (this.pumpOn) draw += this.elapsed < this.runawayUntil || this.stormActive ? 0.9 : 0.3
    if (this.shieldsOn) draw += this.stormActive ? 2.2 : 0.3
    this.busDraw = draw
    this.power = clamp(this.power + 0.5 * dt - draw * dt, 0, 100)

    if (this.stormEta != null && !this.stormActive) {
      this.stormEta = Math.max(0, this.impactAt - this.elapsed)
    }
  }

  private isSeated(role: StationId): boolean {
    for (const p of this.players.values()) {
      if (p.connected && p.role === role) return true
    }
    return false
  }

  /** Empty seats get covered slowly, so two people can still play. */
  private npcs() {
    if (!this.isSeated('vega')) {
      for (const v of VALVES) {
        if (this.leaks[v] && this.valves[v] !== 'sealed') this.valves[v] = 'sealed'
      }
      if (this.air > 90) this.pumpOn = false
      else if (this.air < 45) this.pumpOn = true
      if (this.stormEta != null && this.stormEta < 12) {
        this.shieldsOn = true
        this.bracedAt = this.elapsed
      }
    }
    const anyCrewSeated = CREW_IDS.some((c) => this.isSeated(c))
    if (!anyCrewSeated && this.elapsed - this.lastSignalAt > 6) {
      // The sim is inside the trust boundary — it is the hab covering its own
      // empty seats, not traffic arriving over the bus, so it is not signed.
      if (this.elapsed < this.runawayUntil) {
        this.lastSignalAt = this.elapsed
        this.pushSignal('pump-off', 'engineer', 'sealed', 'SIM0', 0)
      } else if (this.stormEta != null && this.stormEta < 8) {
        this.lastSignalAt = this.elapsed
        this.pushSignal('brace', 'pilot', 'sealed', 'SIM0', 0)
      }
    }
    // Nobody at comms to catch a stolen key, so the hab eventually catches it
    // itself. Slowly, and only when the seat is genuinely empty.
    if (!this.isSeated('sparks') && this.bus.stolenFrom && this.elapsed - (this.bus.stolenAt ?? 0) > 14) {
      this.bus.revoke(this.bus.stolenFrom, this.elapsed)
      this.alarm('BUS: KEY ROTATED')
    }
  }

  /**
   * Async because verifying a signature is. Every order from a crew phone gets
   * checked here and nowhere else, so there is exactly one place where an
   * unsigned order could get in, and it is thirty lines long.
   */
  async applyAction(playerId: string, action: ClientAction): Promise<string | null> {
    if (this.phase !== 'play') return 'Mission not live'
    const p = this.players.get(playerId)
    if (!p?.role || p.role === 'board') return 'You are spectating'
    const role = p.role

    if (action.type === 'signal') {
      if (role === 'vega') return 'You are the one being signalled'
      // Welded to one console, so all three of them are load-bearing.
      const owner = SIGNAL_OWNER[action.signal]
      if (owner !== role) return 'Not your call to make'
      const remain = SIGNAL_COOLDOWN_MS - (this.elapsed - this.lastSignalAt) * 1000
      if (remain > 0) return 'Pad is still resetting'

      const seat = role as CrewId
      const seal = await this.bus.verify(
        seat,
        action.signal,
        action.seq,
        action.tag,
        this.elapsed,
      )
      // A crew phone whose own tag will not verify is holding a rotated key.
      // Refusing it here rather than forwarding it keeps the glass honest.
      if (seal !== 'sealed') return 'Your key was rotated — the pad re-keyed, send it again'

      this.lastSignalAt = this.elapsed
      this.lastSignalBy[seat] = action.signal
      this.pushSignal(action.signal, seat, seal, action.tag, action.seq)
      this.listener?.onView()
      return null
    }

    if (action.type === 'revoke') {
      // Comms holds the key registry. That is the whole reason GHOST never
      // steals their key: somebody has to be able to fix this.
      if (role !== 'sparks') return 'Comms owns the key registry'
      const wait = REVOKE_COOLDOWN_MS - (this.elapsed - this.lastRevokeAt) * 1000
      if (wait > 0) return 'Registry is still writing'
      this.lastRevokeAt = this.elapsed
      const { caught } = this.bus.revoke(action.seat, this.elapsed)
      this.alarm(
        caught
          ? `KEY ROTATED — ${action.seat.toUpperCase()} WAS COMPROMISED`
          : `KEY ROTATED — ${action.seat.toUpperCase()} WAS CLEAN`,
      )
      if (caught) {
        this.busThreat = null
        this.speak('Key rotated. They are off the bus.', 'astronaut')
      } else {
        this.gripe(action.seat, 'COMMS ROTATED YOUR KEY. YOU WERE FINE. SEND IT AGAIN.')
      }
      this.listener?.onView()
      return null
    }

    if (role !== 'vega') return 'Only Vega can touch the ship'
    this.obeyCheck(action)

    switch (action.type) {
      case 'valve':
        this.valves[action.valve] = action.sealed ? 'sealed' : 'open'
        if (action.sealed && VALVES.every((v) => this.valves[v] === 'sealed')) {
          this.gripe('vega', 'INTAKE IS DEAD. YOU SEALED THE FEED.')
          this.gripe('engineer', 'NO FEED. THE PUMP IS SPINNING ON NOTHING.')
        }
        break
      case 'pump':
        this.pumpOn = action.on
        if (action.on) this.gripe('engineer', 'SHE LIT THE PUMP. THAT DRAW WAS YOURS.')
        else {
          this.gripe('vega', 'THEY KILLED YOUR AIR.')
          if (this.stormEta != null || this.stormActive) {
            this.gripe('pilot', 'GOOD. THE BUS IS FREE. SHIELDS. NOW.')
          }
        }
        break
      case 'shields':
        this.shieldsOn = action.on
        if (action.on) this.gripe('engineer', 'SHIELDS TOOK THE BUS. POWER IS THEIRS NOW.')
        else this.gripe('pilot', 'SHE DROPPED THE SHIELDS.')
        break
      case 'brace':
        this.bracedAt = this.elapsed
        break
      case 'clear-signals':
        // Vega's only outbound channel inside the game: one bit, "I saw it".
        // Everything else she has to say out loud, which works fine — the
        // block on her is one-directional.
        const latest = this.signals.filter((s) => s.fresh).at(-1)
        if (latest) {
          this.vegaAckAt = this.elapsed
          this.lastAckedFrom = latest.from
        }
        this.signals = this.signals.map((s) => ({ ...s, fresh: false }))
        // Binning the card ends any chance of being charged with obeying it.
        this.unsealedAsk = []
        break
    }
    this.listener?.onView()
    return null
  }

  /**
   * Put a card on the glass. Does not touch the crew's shared cooldown — GHOST
   * does not queue behind the pad, which is exactly why a forgery flood is
   * dangerous rather than merely annoying.
   */
  private pushSignal(
    signal: SignalId,
    from: CrewId | null,
    seal: SealState,
    tag: string,
    seq: number,
  ) {
    this.lastAckedFrom = null
    this.bus.delivered += 1
    if (seal !== 'sealed') this.unsealedAsk = [...this.unsealedAsk.slice(-5), { signal, at: this.elapsed }]
    this.signals = [
      ...this.signals.slice(-5),
      {
        id: String(this.seq++),
        signal,
        from,
        at: Date.now(),
        fresh: true,
        seal,
        tag: shortTag(tag),
        seq,
      },
    ]
    // Do not announce the call. The other two find out by asking.
  }

  /**
   * The orders that are genuinely the right call this instant. Only GHOST reads
   * this, and only so it can avoid sending one of them by accident.
   */
  private correctNow(): SignalId[] {
    const want: SignalId[] = []
    const runaway = this.elapsed < this.runawayUntil
    const leaking = VALVES.filter((v) => this.leaks[v] && this.valves[v] !== 'sealed')
    if ((runaway || this.stormActive) && this.pumpOn) want.push('pump-off')
    if (this.stormEta != null && !this.stormActive) want.push('brace', 'shields-on')
    if (this.stormActive && !this.shieldsOn) want.push('shields-on')
    for (const v of leaking) want.push(v === 'port' ? 'seal-port' : 'seal-starboard')
    if (!this.stormActive && !runaway && !this.pumpOn && this.air < 72) want.push('pump-on')
    return want
  }

  /** Which order a control maps to, so obeying a bad card is detectable. */
  private askedBy(action: ClientAction): SignalId | null {
    switch (action.type) {
      case 'pump':
        return action.on ? 'pump-on' : 'pump-off'
      case 'valve':
        return action.sealed ? (action.valve === 'port' ? 'seal-port' : 'seal-starboard') : null
      case 'shields':
        return action.on ? 'shields-on' : null
      case 'brace':
        return 'brace'
      default:
        return null
    }
  }

  /**
   * The teeth. Doing what an unsealed card asked, while it is still on the
   * glass, costs air and goes in the report. Nothing else in the round blames
   * the operator for anything.
   */
  private obeyCheck(action: ClientAction) {
    const asked = this.askedBy(action)
    if (!asked) return
    const live = new Set(
      this.signals.filter((s) => s.fresh && s.seal !== 'sealed').map((s) => s.signal),
    )
    const hit = this.unsealedAsk.find(
      (u) =>
        u.signal === asked &&
        this.elapsed - u.at <= OBEY_WINDOW_SECONDS &&
        // Still on the glass. Binned cards cannot be obeyed.
        live.has(u.signal),
    )
    if (!hit) return
    this.unsealedAsk = this.unsealedAsk.filter((u) => u !== hit)
    this.bus.obeyedUnsealed += 1
    this.air = clamp(this.air - 11, 0, 120)
    this.alarm('GHOST ORDER EXECUTED')
    this.gripe('vega', 'THAT SEAL WAS BROKEN. YOU JUST DID WHAT GHOST ASKED.')
    this.speak('That order was not one of ours.', 'astronaut')
  }

  private alarm(line: string) {
    this.alarms = [...this.alarms.slice(-9), line]
  }

  private gripe(who: StationId, text: string) {
    this.gripes[who] = { text, until: this.elapsed + 5.5 }
  }

  private gripeLine(who: StationId): string | null {
    const g = this.gripes[who]
    if (!g || this.elapsed > g.until) return null
    return g.text
  }

  /**
   * Per-seat orders, written to contradict each other on purpose. Rook will be
   * told to kill the pump in the same second Vega is told absolutely not.
   * Naming the other person's number here would let them skip the argument.
   */
  private orderFor(role: StationId): { text: string; tone: 'fight' | 'warn' } | null {
    if (this.phase !== 'play') return null
    const runaway = this.elapsed < this.runawayUntil
    const leaking = VALVES.filter((v) => this.leaks[v] && this.valves[v] !== 'sealed')
    const air = this.air
    const power = this.power
    const eta = this.stormEta
    const fresh = this.signals.filter((s) => s.fresh).at(-1)

    if (role === 'vega') {
      // Reading the badge outranks everything else on her glass.
      if (fresh && fresh.seal === 'broken') {
        return { text: 'BROKEN SEAL. NOBODY SIGNED THAT. DO NOT DO IT.', tone: 'fight' }
      }
      if (fresh && fresh.seal === 'stale') {
        return { text: 'OLD COUNTER — THIS ORDER ALREADY RAN ONCE.', tone: 'fight' }
      }
      if (fresh?.signal === 'pump-off' && air < 92) {
        return { text: 'THEY WANT THE PUMP OFF. YOUR AIR SAYS ABSOLUTELY NOT.', tone: 'fight' }
      }
      // During the runaway the needle climbs and looks like good news. Rook is
      // being told to kill the same pump. That is the fight.
      if (runaway && this.pumpOn && air < 92) {
        return { text: 'AIR IS CLIMBING. THAT LOOKS FINE. KEEP THE PUMP.', tone: 'fight' }
      }
      if (air >= 92) return { text: 'TOO MUCH AIR — KILL THE PUMP OR IT SPLITS', tone: 'fight' }
      if (air < 40 && !this.pumpOn) return { text: 'ABSOLUTELY NOT. START THE PUMP.', tone: 'fight' }
      if (air < 48) return { text: 'AIR IS MINE. KEEP THE PUMP ON.', tone: 'fight' }
      if (fresh) return { text: 'A PICTURE JUST HIT. THAT IS THE ORDER.', tone: 'warn' }
      return null
    }

    if (role === 'engineer') {
      if (runaway && this.pumpOn) {
        return { text: `POWER ${Math.round(power)}% — TURN OFF THE PUMP. TEN SECONDS.`, tone: 'fight' }
      }
      if (this.stormActive && this.pumpOn) {
        return { text: `POWER ${Math.round(power)}% — THE PUMP IS STEALING THE BUS.`, tone: 'fight' }
      }
      if (eta != null && !this.stormActive && this.pumpOn && power < 62) {
        return { text: `POWER ${Math.round(power)}% — KILL THE PUMP. SOMETHING ELSE NEEDS THIS DRAW.`, tone: 'fight' }
      }
      if (this.shieldsOn && power < 28) {
        return { text: `POWER ${Math.round(power)}% — SHIELDS ARE EATING YOU ALIVE.`, tone: 'fight' }
      }
      if (power < 22) return { text: `POWER ${Math.round(power)}% — DUMP SOMETHING.`, tone: 'warn' }
      return null
    }

    if (role === 'pilot') {
      if (eta != null && !this.stormActive && eta <= 6) {
        return { text: `DUST STORM IN ${clock(eta)} — BRACE. IGNORE THE PUMP.`, tone: 'fight' }
      }
      if (eta != null && !this.stormActive) {
        return { text: `DUST STORM IN ${clock(eta)} — SHIELDS UP. TAKE THE BUS.`, tone: 'fight' }
      }
      if (this.stormActive && this.pumpOn) {
        return { text: 'THE PUMP IS FEEDING THE STORM. I NEED IT OFF.', tone: 'fight' }
      }
      if (this.stormActive && !this.shieldsOn) {
        return { text: 'SHIELDS ARE DOWN. WE ARE OPEN.', tone: 'fight' }
      }
      return null
    }

    if (role === 'sparks') {
      if (leaking.length) {
        const which = leaking[0] === 'port' ? 'PORT' : 'STARBOARD'
        return { text: `${which} IS BLEEDING. SEAL IT. DO NOT WAIT.`, tone: 'fight' }
      }
      if (this.seams > 0) return { text: 'A SEAM ALREADY BLEW. STOP OVERFILLING.', tone: 'warn' }
      return null
    }

    return null
  }

  private speak(text: string, voice: 'astronaut' | 'system') {
    if (!text) return
    this.listener?.onSpeak({ text, voice })
  }

  private end(outcome: Outcome, reason: string | null) {
    this.phase = 'end'
    this.outcome = outcome
    this.loseReason = reason
    this.incident = this.bus.report()
    this.stopClock()
    this.speak(
      outcome === 'won'
        ? 'Far side of the corridor. Hab seven still has air in it.'
        : `Hab seven is quiet. ${reason ?? ''}`,
      'astronaut',
    )
    this.listener?.onView()
  }

  /**
   * A console's own key material and its outgoing log. Never assembled for
   * Vega or the board — the operator holding a crew key would let her verify
   * for herself, and the whole game is that she cannot.
   */
  private sealView(seat: CrewId) {
    return {
      roundId: this.bus.roundId,
      key: this.bus.keyFor(seat),
      epoch: this.bus.epochFor(seat),
      nextSeq: this.bus.seqFor(seat),
      log: this.bus
        .logFor(seat)
        .map((e) => ({ signal: e.signal, seq: e.seq, mine: e.mine })),
    }
  }

  lobbyPlayers(): LobbyPlayer[] {
    return [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      ready: p.ready,
      connected: p.connected,
      host: p.host,
    }))
  }

  viewFor(playerId: string): ClientView | null {
    const you = this.players.get(playerId)
    if (!you) return null
    const role = you.role
    const timeLeft = this.phase === 'lobby' ? null : Math.max(0, MISSION_SECONDS - this.elapsed)
    const cooldown =
      this.phase === 'play'
        ? Math.max(0, SIGNAL_COOLDOWN_MS - (this.elapsed - this.lastSignalAt) * 1000)
        : 0

    const base: ClientView = {
      code: this.code,
      phase: this.phase,
      you: {
        id: you.id,
        name: you.name,
        role: you.role,
        host: you.host,
        ready: you.ready,
      },
      players: this.lobbyPlayers(),
      timeLeft,
      air: null,
      airBand: null,
      valves: null,
      leakLights: null,
      pumpOn: null,
      shieldsOn: null,
      braced: null,
      signals: [],
      power: null,
      draw: null,
      stormEta: null,
      stormActive: null,
      alarms: [],
      seal: null,
      canRevoke: null,
      revokeCooldownMs: null,
      signalCooldownMs: null,
      lastSignal: null,
      ackAgeMs: null,
      order: null,
      gripe: null,
      outcome: this.outcome,
      loseReason: this.loseReason,
      incident: this.incident,
      spectator: null,
    }

    if (role === 'vega') {
      // Air is the only thing she knows. No clock, no power, no storm, no alarm
      // text, no leak lights, and never any audio. Which valve is bleeding is
      // Chen's to know and Chen's to send.
      return {
        ...base,
        timeLeft: null,
        air: Math.round(this.air),
        airBand: airBand(this.air),
        valves: { ...this.valves },
        leakLights: null,
        pumpOn: this.pumpOn,
        shieldsOn: this.shieldsOn,
        braced: this.elapsed - this.bracedAt <= BRACE_WINDOW_SECONDS,
        signals: this.signals,
        order: this.orderFor('vega'),
        gripe: this.gripeLine('vega'),
      }
    }

    const ackFor = (crew: CrewId) =>
      this.lastAckedFrom === crew && this.vegaAckAt != null
        ? Math.round((this.elapsed - this.vegaAckAt) * 1000)
        : null

    if (role === 'engineer') {
      return {
        ...base,
        power: Math.round(this.power),
        draw: Math.round(this.busDraw * 10) / 10,
        seal: this.sealView('engineer'),
        signalCooldownMs: cooldown,
        lastSignal: this.lastSignalBy.engineer,
        ackAgeMs: ackFor('engineer'),
        order: this.orderFor('engineer'),
        gripe: this.gripeLine('engineer'),
      }
    }

    if (role === 'pilot') {
      return {
        ...base,
        stormEta: this.stormEta,
        stormActive: this.stormActive,
        seal: this.sealView('pilot'),
        signalCooldownMs: cooldown,
        lastSignal: this.lastSignalBy.pilot,
        ackAgeMs: ackFor('pilot'),
        order: this.orderFor('pilot'),
        gripe: this.gripeLine('pilot'),
      }
    }

    if (role === 'sparks') {
      return {
        ...base,
        alarms: this.alarms,
        seal: this.sealView('sparks'),
        canRevoke: [...CREW_IDS],
        revokeCooldownMs:
          this.phase === 'play'
            ? Math.max(0, REVOKE_COOLDOWN_MS - (this.elapsed - this.lastRevokeAt) * 1000)
            : 0,
        signalCooldownMs: cooldown,
        lastSignal: this.lastSignalBy.sparks,
        ackAgeMs: ackFor('sparks'),
        order: this.orderFor('sparks'),
        gripe: this.gripeLine('sparks'),
      }
    }

    if (role === 'board') {
      return {
        ...base,
        stormActive: this.stormActive,
        spectator: {
          air: Math.round(this.air),
          power: Math.round(this.power),
          stormEta: this.stormEta,
          pumpOn: this.pumpOn,
          shieldsOn: this.shieldsOn,
          valves: { ...this.valves },
          alarms: this.alarms,
          busThreat: this.busThreat,
        },
      }
    }

    return base
  }
}

export function makeCode(): string {
  const alphabet = 'ABDEFGHJKMNPQRSTUVWXYZ'
  let s = ''
  for (let i = 0; i < 4; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return s
}
