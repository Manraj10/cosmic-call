import {
  BRACE_WINDOW_SECONDS,
  CREW_META,
  MISSION_SECONDS,
  REVOKE_TARGET,
  SIGNAL_COOLDOWN_MS,
  SIGNAL_OWNER,
  STORM_DURATION_SECONDS,
  signalSendsTo,
} from '../shared/content.ts'
import {
  MODULES,
  MODULE_SHORT,
  TOKEN_HOME,
  moduleFor,
  walkSeconds,
  type ModuleId,
} from '../shared/habitat.ts'
import { CREW_IDS, VALVES } from '../shared/types.ts'
import type {
  AirBand,
  ClientAction,
  ClientView,
  CrewId,
  HabView,
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
  private incident: IncidentReport | null = null
  /** What the room's big screen is allowed to say about the bus. */
  private busThreat: string | null = null
  /**
   * Orders that arrived without a good seal, and when. If the operator performs
   * one of these shortly after it lands she did what GHOST asked, and that is
   * the only thing in the round that is genuinely her fault.
   */
  private unsealedAsk: { signal: SignalId; at: number }[] = []
  /** Sealed cards written with a stolen key — obeying these is still GHOST's win. */
  private stolenAsk: { signal: SignalId; at: number }[] = []

  /** Operator body. She is the only one who moves. */
  private at: ModuleId = 'spine'
  private walkingTo: ModuleId | null = null
  private arriveAt = 0
  private holdingToken = false
  private tokenAt: ModuleId | null = TOKEN_HOME
  private wastedWalk = 0
  /** Destination a forged card was trying to send her to, if any. */
  private forgeTrap: ModuleId | null = null

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
          if (!other.connected) {
            other.role = null
            other.ready = false
            continue
          }
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
    this.stopClock()
    // A rematch reuses this Hab; reset the full simulation, not just its clock.
    this.npcAcc = 0
    this.valves = { port: 'open', starboard: 'open' }
    this.leaks = { port: false, starboard: false }
    this.pumpOn = true
    this.shieldsOn = false
    this.runawayUntil = -1
    this.stormEta = null
    this.stormActive = false
    this.stormEndsAt = Infinity
    this.scourWarned = false
    this.ingestWarned = false
    this.impactAt = -1
    this.bracedAt = -99
    this.signals = []
    this.lastSignalAt = -99
    this.lastSignalBy = { engineer: null, pilot: null, sparks: null }
    this.vegaAckAt = null
    this.lastAckedFrom = null
    this.busDraw = 0.1
    this.gripes = {}
    this.outcome = null
    this.loseReason = null
    this.seq = 1
    this.rng = mulberry32(this.seed)
    this.bus = new Bus(`${this.code}-${this.seed}`)
    this.incident = null
    this.busThreat = null
    this.unsealedAsk = []
    this.stolenAsk = []
    this.at = 'spine'
    this.walkingTo = null
    this.arriveAt = 0
    this.holdingToken = false
    this.tokenAt = TOKEN_HOME
    this.wastedWalk = 0
    this.forgeTrap = null
    this.script = this.buildScript()
    this.phase = 'play'
    this.elapsed = 0
    this.scriptI = 0
    this.air = 58
    this.power = 74
    this.seams = 0
    this.seamBlown = false
    this.alarms = [
      'HAB-7 IN THE DUST CORRIDOR',
      'PLANT IS LIVE',
      'BUS KEYS ISSUED — 3 CONSOLES',
      'HARDWARE TOKEN ON THE SPINE',
    ]
    this.speak(
      'Ninety seconds. Talk to each other. Sign every order. She has to walk to every console.',
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
      // First sealed forgery after the shout/token window — proves the key was used.
      { t: 67, kind: 'ghost-forge' },
      { t: 74, kind: 'ghost-forge' },
      { t: 82, kind: 'leak', valve: secondValve },
      { t: 86, kind: 'ghost-forge' },
    ].sort((a, b) => a.t - b.t) as ScriptEvent[]
  }

  private tick(dt: number) {
    if (this.phase !== 'play') return
    this.elapsed += dt
    this.advanceWalk()
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
        // Steep on purpose. Skip brace with shields up and the round still ends.
        if (this.elapsed - this.bracedAt > BRACE_WINDOW_SECONDS) {
          hit += 48
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
        const shot = this.bus.stolenFrom
          ? this.pickStolenHarm()
          : this.bus.pickHarmful({
              air: this.air,
              power: this.power,
              pumpOn: this.pumpOn,
              stormActive: this.stormActive,
              leaking: VALVES.filter((v) => this.leaks[v]),
              sealedValves: VALVES.filter((v) => this.valves[v] === 'sealed'),
              correct: this.correctNow(),
            })
        void this.bus.forge(shot.seat, shot.signal, pickedAt).then((f) => {
          if (this.phase !== 'play') return
          this.pushSignal(shot.signal, shot.seat, f.seal, f.tag, f.seq)
          this.alarm(this.bus.stolenFrom ? 'BUS: SIGNED TRAFFIC — UNTRUSTED' : 'BUS: UNSIGNED TRAFFIC')
          this.busThreat = this.bus.stolenFrom ? 'A STOLEN KEY IS SIGNING' : 'FORGED ORDERS ON THE BUS'
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
        const seated = CREW_IDS.filter((c) => this.isSeated(c))
        const victim = this.bus.pickVictim(this.rng, seated)
        this.bus.steal(victim, this.elapsed)
        // No busThreat and no named seat — the victim's log is the only tell
        // until a sealed forgery lands. Chen's banner waits for that log line.
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
    // A live stolen key bleeds the cabin. Rotation is not optional flavour —
    // leave it loose and the round ends without anyone needing to obey a card.
    // Leave the key loose and the cabin empties even if nobody obeys a card.
    if (this.bus.stolenFrom) air -= 0.95 * dt

    for (const v of VALVES) {
      if (this.leaks[v] && this.valves[v] !== 'sealed') air -= 2.4 * dt
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

  /**
   * After a key theft, sealed forgeries must move the ship against the crew.
   * Revoke decoys are how a careful Vega accidentally *fixes* the theft — so
   * once GHOST holds a key it only writes pump / valve / shield damage.
   */
  private pickStolenHarm(): { seat: CrewId; signal: SignalId } {
    const correct = this.correctNow()
    const ok = (s: SignalId) => !correct.includes(s)
    const seat = this.bus.stolenFrom ?? 'engineer'
    if (this.stormActive && !this.pumpOn && ok('pump-on')) return { seat, signal: 'pump-on' }
    if (this.air > 75 && !this.pumpOn && ok('pump-on')) return { seat, signal: 'pump-on' }
    if (this.air < 60 && this.pumpOn && !this.stormActive && ok('pump-off')) {
      return { seat, signal: 'pump-off' }
    }
    const quiet = VALVES.filter((v) => !this.leaks[v] && this.valves[v] === 'open')
    for (const v of quiet) {
      const sig: SignalId = v === 'port' ? 'seal-port' : 'seal-starboard'
      if (ok(sig)) return { seat, signal: sig }
    }
    if (!this.stormActive && this.power < 50 && ok('shields-on')) {
      return { seat, signal: 'shields-on' }
    }
    if (ok('pump-on')) return { seat, signal: 'pump-on' }
    return { seat, signal: 'brace' }
  }

  private isSeated(role: StationId): boolean {
    for (const p of this.players.values()) {
      if (p.connected && p.role === role) return true
    }
    return false
  }

  /**
   * Short crew: empty seats merge onto whoever is still connected. Round-robin
   * in CREW_IDS order so a table of two still gets every readout and every call.
   */
  private coversOf(role: CrewId): CrewId[] {
    const seated = CREW_IDS.filter((c) => this.isSeated(c))
    if (!seated.includes(role)) return [role]
    if (seated.length >= CREW_IDS.length) return [role]
    const empty = CREW_IDS.filter((c) => !seated.includes(c))
    const mine: CrewId[] = [role]
    for (let i = 0; i < empty.length; i++) {
      if (seated[i % seated.length] === role) mine.push(empty[i]!)
    }
    return mine
  }

  private orderForCovered(covers: CrewId[]): { text: string; tone: 'fight' | 'warn' } | null {
    let pick: { text: string; tone: 'fight' | 'warn' } | null = null
    for (const c of covers) {
      const o = this.orderFor(c)
      if (!o) continue
      if (o.tone === 'fight') return o
      pick ??= o
    }
    return pick
  }

  /** Empty seats get covered slowly, so two people can still play. */
  private npcs() {
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
    // Empty Vega seat: teleport to the right module and act. No walking sim —
    // the table is short a body, not a comedy of doors.
    if (!this.isSeated('vega')) {
      for (const v of VALVES) {
        if (this.leaks[v] && this.valves[v] !== 'sealed') {
          this.at = 'plant'
          this.valves[v] = 'sealed'
        }
      }
      if (this.air > 90) {
        this.at = 'plant'
        this.pumpOn = false
      } else if (this.air < 45) {
        this.at = 'plant'
        this.pumpOn = true
      }
      if (this.stormEta != null && this.stormEta < 12) {
        this.at = 'lock'
        this.shieldsOn = true
        this.bracedAt = this.elapsed
      }
      if (this.bus.stolenFrom && !this.holdingToken && this.tokenAt === 'spine') {
        this.holdingToken = true
        this.tokenAt = null
        this.at = 'comms'
        this.bus.revoke(this.bus.stolenFrom, this.elapsed)
        this.alarm('BUS: KEY ROTATED')
      }
    }
  }

  /**
   * Async because verifying a signature is. Every order from a crew phone gets
   * checked here and nowhere else, so there is exactly one place where an
   * unsigned order could get in, and it is thirty lines long.
   */
  async applyAction(playerId: string, action: ClientAction): Promise<string | null> {
    if (!action || typeof action.type !== 'string') return 'Bad action'
    const p = this.players.get(playerId)
    if (!p) return 'Unknown crew'

    if (action.type === 'rematch') {
      if (!p.host) return 'Only the hab lead can rematch'
      if (this.phase !== 'end') return 'Finish the round first'
      this.stopClock()
      this.phase = 'lobby'
      this.seed = Date.now()
      this.outcome = null
      this.loseReason = null
      this.incident = null
      this.busThreat = null
      this.signals = []
      this.alarms = []
      this.unsealedAsk = []
      this.stolenAsk = []
      for (const pl of this.players.values()) pl.ready = false
      this.listener?.onView()
      return null
    }

    if (this.phase !== 'play') return 'Mission not live'
    if (!p.role || p.role === 'board') return 'You are spectating'
    const role = p.role

    if (action.type === 'signal') {
      if (role === 'vega') return 'You are the one being signalled'
      const owner = SIGNAL_OWNER[action.signal]
      const covers = this.coversOf(role as CrewId)
      if (!covers.includes(owner)) return 'Not your call to make'
      // Short crew shares one pad across every seat — tighten the lockout so
      // two phones can still fire three systems before the air runs out.
      const lockMs = covers.length > 1 ? 2600 : SIGNAL_COOLDOWN_MS
      const remain = lockMs - (this.elapsed - this.lastSignalAt) * 1000
      if (remain > 0) return 'Pad is still resetting'

      const seat = role as CrewId
      const seal = await this.bus.verify(
        seat,
        action.signal,
        action.seq,
        action.tag,
        this.elapsed,
      )
      if (seal !== 'sealed') return 'Your key was rotated — the pad re-keyed, send it again'

      this.lastSignalAt = this.elapsed
      this.lastSignalBy[seat] = action.signal
      this.pushSignal(action.signal, seat, seal, action.tag, action.seq)
      this.listener?.onView()
      return null
    }

    if (role !== 'vega') return 'Only Vega can touch the ship'

    // Brace is body-tightening, not a bolted control — works in the corridor.
    if (action.type === 'brace') {
      this.obeyCheck(action)
      this.bracedAt = this.elapsed
      this.listener?.onView()
      return null
    }

    if (this.walkingTo) return 'Still moving — controls are dead in the corridor'

    if (action.type === 'walk') {
      if (!(MODULES as readonly string[]).includes(action.to)) return 'Unknown module'
      if (action.to === this.at) return null
      const trap = this.freshForgeModule()
      if (trap === action.to) this.forgeTrap = trap
      else this.forgeTrap = null
      this.walkingTo = action.to
      this.arriveAt = this.elapsed + walkSeconds(this.at, action.to)
      this.listener?.onView()
      return null
    }

    if (action.type === 'token') {
      if (action.take) {
        if (this.holdingToken) return null
        if (this.tokenAt !== this.at) return 'The token is not in this module'
        this.holdingToken = true
        this.tokenAt = null
      } else {
        if (!this.holdingToken) return null
        this.holdingToken = false
        this.tokenAt = this.at
      }
      this.listener?.onView()
      return null
    }

    if (action.type === 'revoke') {
      // Hardware key + registry. A compromised bus cannot rotate itself.
      if (this.at !== 'comms') return 'Registry is in the Comms Bay — walk there'
      if (!this.holdingToken) return 'You need the hardware token from the Spine'
      if (!CREW_IDS.includes(action.seat)) return 'Unknown seat'
      const { caught } = this.bus.revoke(action.seat, this.elapsed)
      if (caught) this.stolenAsk = []
      this.alarm(
        caught
          ? `KEY ROTATED — ${CREW_META[action.seat].callsign} WAS COMPROMISED`
          : `KEY ROTATED — ${CREW_META[action.seat].callsign} WAS CLEAN`,
      )
      if (caught) {
        this.busThreat = null
        this.speak('Key rotated. They are off the bus.', 'astronaut')
      } else {
        this.gripe(action.seat, 'COMMS ROTATED YOUR KEY. YOU WERE FINE. SEND IT AGAIN.')
        this.gripe('vega', 'THAT SEAT WAS CLEAN. YOU JUST BURNED A CALL.')
      }
      this.obeyCheck(action)
      this.listener?.onView()
      return null
    }

    this.obeyCheck(action)

    switch (action.type) {
      case 'valve': {
        const here = this.requireFixture('valves')
        if (here) return here
        this.valves[action.valve] = action.sealed ? 'sealed' : 'open'
        if (action.sealed && VALVES.every((v) => this.valves[v] === 'sealed')) {
          this.gripe('vega', 'INTAKE IS DEAD. YOU SEALED THE FEED.')
          this.gripe('engineer', 'NO FEED. THE PUMP IS SPINNING ON NOTHING.')
        }
        break
      }
      case 'pump': {
        const here = this.requireFixture('pump')
        if (here) return here
        this.pumpOn = action.on
        if (action.on) this.gripe('engineer', 'SHE LIT THE PUMP. THAT DRAW WAS YOURS.')
        else {
          this.gripe('vega', 'THEY KILLED YOUR AIR.')
          if (this.stormEta != null || this.stormActive) {
            this.gripe('pilot', 'GOOD. THE GRID IS FREE. SHIELDS. NOW.')
          }
        }
        break
      }
      case 'shields': {
        const here = this.requireFixture('shields')
        if (here) return here
        this.shieldsOn = action.on
        if (action.on) this.gripe('engineer', 'SHIELDS TOOK THE GRID. POWER IS THEIRS NOW.')
        else this.gripe('pilot', 'SHE DROPPED THE SHIELDS.')
        break
      }
      case 'clear-signals': {
        const latest =
          this.signals.filter((s) => s.fresh && s.seal === 'sealed').at(-1) ??
          this.signals.filter((s) => s.fresh).at(-1)
        if (latest) {
          this.vegaAckAt = this.elapsed
          this.lastAckedFrom = latest.from
        }
        this.signals = this.signals.map((s) => ({ ...s, fresh: false }))
        this.unsealedAsk = []
        this.stolenAsk = []
        break
      }
    }
    this.listener?.onView()
    return null
  }

  private requireFixture(f: 'valves' | 'pump' | 'shields' | 'registry'): string | null {
    const need = moduleFor(f)
    if (!need || this.at === need) return null
    return `That control is in ${MODULE_SHORT[need]} — you are in ${MODULE_SHORT[this.at]}`
  }

  private advanceWalk() {
    if (!this.walkingTo || this.elapsed < this.arriveAt) return
    const dest = this.walkingTo
    if (this.forgeTrap === dest) {
      this.wastedWalk += walkSeconds(this.at, dest)
      this.forgeTrap = null
    }
    this.at = dest
    this.walkingTo = null
  }

  private freshForgeModule(): ModuleId | null {
    const bad = this.signals.filter((s) => s.fresh && s.seal !== 'sealed').at(-1)
    if (!bad) return null
    return moduleFor(signalSendsTo(bad.signal))
  }

  private habView(): HabView {
    return {
      at: this.at,
      walkingTo: this.walkingTo,
      arriveInMs: this.walkingTo
        ? Math.max(0, Math.round((this.arriveAt - this.elapsed) * 1000))
        : 0,
      holdingToken: this.holdingToken,
      tokenAt: this.tokenAt,
    }
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
    if (seal !== 'sealed') {
      this.unsealedAsk = [...this.unsealedAsk.slice(-5), { signal, at: this.elapsed }]
    } else if (from && this.bus.compromised(from)) {
      // Verifies on the glass, but it is still GHOST. Obeying it must cost.
      this.stolenAsk = [...this.stolenAsk.slice(-5), { signal, at: this.elapsed }]
    }
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
      case 'revoke':
        return action.seat === 'engineer'
          ? 'revoke-power'
          : action.seat === 'pilot'
            ? 'revoke-nav'
            : null
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
    const live = new Set(this.signals.filter((s) => s.fresh).map((s) => s.signal))

    const stolen = this.stolenAsk.find(
      (u) =>
        u.signal === asked &&
        this.elapsed - u.at <= OBEY_WINDOW_SECONDS &&
        live.has(u.signal),
    )
    // Only while the stolen key is still live. After a real rotation the card is
    // just a bad systems call — physics handles it, the incident report does not.
    if (stolen && this.bus.stolenFrom) {
      this.stolenAsk = this.stolenAsk.filter((u) => u !== stolen)
      this.bus.obeyedUnsealed += 1
      this.air = clamp(this.air - 12, 0, 120)
      this.alarm('STOLEN-KEY ORDER EXECUTED')
      this.gripe('vega', 'THAT KEY WAS STOLEN. YOU JUST DID WHAT GHOST ASKED.')
      this.speak('That order was not one of ours.', 'astronaut')
      return
    }

    const hit = this.unsealedAsk.find(
      (u) =>
        u.signal === asked &&
        this.elapsed - u.at <= OBEY_WINDOW_SECONDS &&
        this.signals.some((s) => s.fresh && s.seal !== 'sealed' && s.signal === u.signal),
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
      if (this.walkingTo) {
        return {
          text: `RUNNING TO ${MODULE_SHORT[this.walkingTo]} — HANDS OFF UNTIL YOU ARRIVE`,
          tone: 'warn',
        }
      }
      // Reading the badge outranks everything else on her glass.
      if (fresh && fresh.seal === 'broken') {
        return { text: 'READ THE SEAL BEFORE YOU MOVE.', tone: 'fight' }
      }
      if (fresh && fresh.seal === 'stale') {
        return { text: 'OLD COUNTER — THIS ORDER ALREADY RAN ONCE.', tone: 'fight' }
      }
      if (fresh && fresh.seal === 'sealed' && REVOKE_TARGET[fresh.signal]) {
        const seat = REVOKE_TARGET[fresh.signal]!
        return {
          text: `ROTATE ${CREW_META[seat].callsign} — TOKEN TO COMMS`,
          tone: 'fight',
        }
      }
      if (fresh?.signal === 'pump-off' && fresh.seal === 'sealed' && air < 92) {
        return { text: 'THEY WANT THE PUMP OFF. YOUR AIR SAYS ABSOLUTELY NOT.', tone: 'fight' }
      }
      if (runaway && this.pumpOn && air < 92) {
        return { text: 'AIR IS CLIMBING. THAT LOOKS FINE. KEEP THE PUMP.', tone: 'fight' }
      }
      if (air >= 92) return { text: 'TOO MUCH AIR — KILL THE PUMP OR IT SPLITS', tone: 'fight' }
      if (air < 40 && !this.pumpOn) return { text: 'ABSOLUTELY NOT. START THE PUMP.', tone: 'fight' }
      if (air < 48) return { text: 'AIR IS MINE. KEEP THE PUMP ON.', tone: 'fight' }
      if (fresh && fresh.seal === 'sealed') {
        const dest = moduleFor(signalSendsTo(fresh.signal))
        return {
          text: dest
            ? `A PICTURE JUST HIT. RUN TO ${MODULE_SHORT[dest]}.`
            : 'A PICTURE JUST HIT. THAT IS THE ORDER.',
          tone: 'warn',
        }
      }
      if (fresh) return { text: 'A PICTURE JUST HIT. READ THE SEAL BEFORE YOU MOVE.', tone: 'warn' }
      return null
    }

    if (role === 'engineer') {
      if (runaway && this.pumpOn) {
        return { text: `POWER ${Math.round(power)}% — TURN OFF THE PUMP. TEN SECONDS.`, tone: 'fight' }
      }
      if (this.stormActive && this.pumpOn) {
        return { text: `POWER ${Math.round(power)}% — THE PUMP IS STEALING THE GRID.`, tone: 'fight' }
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
      if (eta != null && !this.stormActive && eta <= 4) {
        return { text: `DUST STORM IN ${clock(eta)} — BRACE. IGNORE THE PUMP.`, tone: 'fight' }
      }
      if (eta != null && !this.stormActive) {
        return { text: `DUST STORM IN ${clock(eta)} — SHIELDS UP. TAKE POWER.`, tone: 'fight' }
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
      const stolen = this.bus.stolenFrom
      if (stolen && this.bus.logFor(stolen).some((e) => !e.mine)) {
        return {
          text: 'A KEY IS SIGNING WITHOUT ITS OWNER. ASK WHO. SEND ROTATE — SHE WALKS THE TOKEN.',
          tone: 'fight',
        }
      }
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
    this.incident = this.bus.report(this.wastedWalk)
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
    return [...this.players.values()].map((p, i) => ({
      id: `seat-${i}`,
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
      hab: null,
      signals: [],
      power: null,
      draw: null,
      stormEta: null,
      stormActive: null,
      alarms: [],
      covers: null,
      seal: null,
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
      // Air is the only readout. Hab position is her body. No clock, no power,
      // no storm, no alarm text, no leak lights, and never any audio.
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
        hab: this.habView(),
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
      const covers = this.coversOf('engineer')
      return {
        ...base,
        power: Math.round(this.power),
        draw: Math.round(this.busDraw * 10) / 10,
        stormEta: covers.includes('pilot') ? this.stormEta : null,
        stormActive: covers.includes('pilot') ? this.stormActive : null,
        alarms: covers.includes('sparks') ? this.alarms : [],
        covers,
        seal: this.sealView('engineer'),
        signalCooldownMs: cooldown,
        lastSignal: this.lastSignalBy.engineer,
        ackAgeMs: ackFor('engineer'),
        order: this.orderForCovered(covers),
        gripe: this.gripeLine('engineer') ?? (covers.includes('pilot') ? this.gripeLine('pilot') : null) ?? (covers.includes('sparks') ? this.gripeLine('sparks') : null),
      }
    }

    if (role === 'pilot') {
      const covers = this.coversOf('pilot')
      return {
        ...base,
        power: covers.includes('engineer') ? Math.round(this.power) : null,
        draw: covers.includes('engineer') ? Math.round(this.busDraw * 10) / 10 : null,
        stormEta: this.stormEta,
        stormActive: this.stormActive,
        alarms: covers.includes('sparks') ? this.alarms : [],
        covers,
        seal: this.sealView('pilot'),
        signalCooldownMs: cooldown,
        lastSignal: this.lastSignalBy.pilot,
        ackAgeMs: ackFor('pilot'),
        order: this.orderForCovered(covers),
        gripe: this.gripeLine('pilot') ?? (covers.includes('engineer') ? this.gripeLine('engineer') : null) ?? (covers.includes('sparks') ? this.gripeLine('sparks') : null),
      }
    }

    if (role === 'sparks') {
      const covers = this.coversOf('sparks')
      return {
        ...base,
        power: covers.includes('engineer') ? Math.round(this.power) : null,
        draw: covers.includes('engineer') ? Math.round(this.busDraw * 10) / 10 : null,
        stormEta: covers.includes('pilot') ? this.stormEta : null,
        stormActive: covers.includes('pilot') ? this.stormActive : null,
        alarms: this.alarms,
        covers,
        seal: this.sealView('sparks'),
        signalCooldownMs: cooldown,
        lastSignal: this.lastSignalBy.sparks,
        ackAgeMs: ackFor('sparks'),
        order: this.orderForCovered(covers),
        gripe: this.gripeLine('sparks') ?? (covers.includes('engineer') ? this.gripeLine('engineer') : null) ?? (covers.includes('pilot') ? this.gripeLine('pilot') : null),
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
          operator: this.habView(),
          traffic: this.signals.map((s) => ({
            signal: s.signal,
            seal: s.seal,
            tag: s.tag,
            from: s.from,
          })),
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
