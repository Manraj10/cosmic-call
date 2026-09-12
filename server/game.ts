import {
  BRACE_WINDOW_SECONDS,
  MISSION_SECONDS,
  SIGNAL_COOLDOWN_MS,
  SIGNAL_OWNER,
  STORM_DURATION_SECONDS,
  signalLabel,
} from '../shared/content.ts'
import { CREW_IDS, VALVES } from '../shared/types.ts'
import type {
  AirBand,
  ClientAction,
  ClientView,
  CrewId,
  LobbyPlayer,
  Outcome,
  SignalEvent,
  SignalId,
  StationId,
  ValveId,
} from '../shared/types.ts'

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
  kind: 'leak' | 'runaway' | 'storm' | 'impact' | 'drain' | 'voice'
  valve?: ValveId
  eta?: number
  line?: string
}

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
  private lastSignal: SignalId | null = null
  private vegaAckAt: number | null = null
  private outcome: Outcome | null = null
  private loseReason: string | null = null
  private seq = 1

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
    this.script = this.buildScript()
    this.phase = 'play'
    this.elapsed = 0
    this.scriptI = 0
    this.air = 48
    this.power = 70
    this.seams = 0
    this.seamBlown = false
    this.alarms = ['HAB-7 IN THE DUST CORRIDOR', '90 SECONDS TO THE FAR SIDE']
    this.speak('Hab seven, ninety seconds of corridor. Vega is the only one who can touch anything.', 'astronaut')
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
    return [
      { t: 8, kind: 'leak', valve: firstValve },
      { t: 24, kind: 'runaway' },
      { t: stormWarnAt, kind: 'storm', eta: stormLead },
      { t: stormWarnAt + stormLead, kind: 'impact' },
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
          this.speak(
            `Air is running out the ${ev.valve} valve. Vega cannot hear me say it.`,
            'astronaut',
          )
        }
        break
      case 'runaway':
        this.pumpOn = true
        this.runawayUntil = this.elapsed + 14
        this.seamBlown = false
        this.alarm('PUMP RUNAWAY — OVERPRESSURE RISK')
        this.speak('The pump is running away. Somebody get Vega to shut it off!', 'astronaut')
        break
      case 'storm': {
        const eta = ev.eta ?? 20
        this.stormEta = eta
        this.impactAt = this.elapsed + eta
        this.alarm(`DUST FRONT INBOUND T-${Math.round(eta)}`)
        this.speak(
          `Dust front. ${Math.round(eta)} seconds. She needs shields up and she needs to brace.`,
          'astronaut',
        )
        break
      }
      case 'impact': {
        this.stormActive = true
        this.stormEta = 0
        this.stormEndsAt = this.elapsed + STORM_DURATION_SECONDS
        this.scourWarned = false
        this.ingestWarned = false
        this.alarm('IMPACT')
        let hit = 0
        if (!this.shieldsOn || this.power <= 2) {
          hit += 30
          this.alarm('SHIELDS WERE DOWN — HULL SCOURED')
        }
        // Steep on purpose. At 14 a crew could skip the brace entirely and still
        // survive, which made Idris's second call decoration.
        if (this.elapsed - this.bracedAt > BRACE_WINDOW_SECONDS) {
          hit += 26
          this.alarm('NOBODY BRACED')
        }
        if (hit) {
          this.air = clamp(this.air - hit, 0, 120)
          this.speak('That went straight through us.', 'astronaut')
        } else {
          this.speak('Shields held. She braced. Textbook.', 'astronaut')
        }
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
        this.alarm('FRONT HAS PASSED')
        this.speak('Front has passed. She needs the pump back on.', 'astronaut')
      } else {
        // An intake pump running inside a dust front feeds the cabin dust.
        // Only Rook can call this off, and it is the whole reason he exists.
        if (pumpLive) {
          air -= 3.2 * dt
          if (!this.ingestWarned) {
            this.ingestWarned = true
            this.alarm('PUMP IS INGESTING DUST')
            this.speak('The pump is eating the storm. Get it shut down.', 'astronaut')
          }
        }
        if (!this.shieldsOn || this.power <= 12) {
          air -= 1.35 * dt
          if (!this.scourWarned) {
            this.scourWarned = true
            this.alarm('SHIELDS FAILING — HULL SCOURED')
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
      this.alarm(`OVERPRESSURE — SEAM ${this.seams} BLEW`)
      this.speak('She blew a seam. That hull will never hold like it did.', 'astronaut')
    }
    if (this.seamBlown && air < 88) this.seamBlown = false
    this.air = clamp(air, 0, 120)

    // Power is Rook's whole world. Kept so the pump never starves itself into
    // silence — if it browned out on its own it would quietly cancel both of
    // the punishments it is supposed to cause.
    let draw = 0.1
    if (this.pumpOn) draw += this.elapsed < this.runawayUntil || this.stormActive ? 0.9 : 0.3
    if (this.shieldsOn) draw += this.stormActive ? 2.2 : 0.3
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
      if (this.elapsed < this.runawayUntil) this.pushSignal('pump-off', null)
      else if (this.stormEta != null && this.stormEta < 8) this.pushSignal('brace', null)
    }
  }

  applyAction(playerId: string, action: ClientAction): string | null {
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
      this.pushSignal(action.signal, role as CrewId)
      this.listener?.onView()
      return null
    }

    if (role !== 'vega') return 'Only Vega can touch the ship'

    switch (action.type) {
      case 'valve':
        this.valves[action.valve] = action.sealed ? 'sealed' : 'open'
        break
      case 'pump':
        this.pumpOn = action.on
        break
      case 'shields':
        this.shieldsOn = action.on
        break
      case 'brace':
        this.bracedAt = this.elapsed
        break
      case 'clear-signals':
        // Vega's only outbound channel inside the game: one bit, "I saw it".
        // Everything else she has to say out loud, which works fine — the
        // block on her is one-directional.
        if (this.signals.some((s) => s.fresh)) {
          this.vegaAckAt = this.elapsed
          this.alarm('VEGA ACKNOWLEDGED')
          this.speak('Vega read it.', 'system')
        }
        this.signals = this.signals.map((s) => ({ ...s, fresh: false }))
        break
    }
    this.listener?.onView()
    return null
  }

  private pushSignal(signal: SignalId, from: CrewId | null) {
    this.lastSignalAt = this.elapsed
    this.lastSignal = signal
    this.signals = [
      ...this.signals.slice(-5),
      { id: String(this.seq++), signal, from, at: Date.now(), fresh: true },
    ]
    this.alarm(`SIGNAL SENT — ${signalLabel(signal)}`)
    this.speak(`Signal to Vega. ${signalLabel(signal)}.`, 'system')
  }

  private alarm(line: string) {
    this.alarms = [...this.alarms.slice(-9), line]
  }

  private speak(text: string, voice: 'astronaut' | 'system') {
    if (!text) return
    this.listener?.onSpeak({ text, voice })
  }

  private end(outcome: Outcome, reason: string | null) {
    this.phase = 'end'
    this.outcome = outcome
    this.loseReason = reason
    this.stopClock()
    this.speak(
      outcome === 'won'
        ? 'Far side of the corridor. Hab seven still has air in it.'
        : `Hab seven is quiet. ${reason ?? ''}`,
      'astronaut',
    )
    this.listener?.onView()
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
      braced: this.elapsed - this.bracedAt <= BRACE_WINDOW_SECONDS,
      signals: [],
      power: null,
      stormEta: null,
      stormActive: this.stormActive,
      alarms: [],
      signalCooldownMs: null,
      lastSignal: null,
      ackAgeMs: null,
      outcome: this.outcome,
      loseReason: this.loseReason,
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
        signals: this.signals,
      }
    }

    const ackAgeMs =
      this.vegaAckAt == null ? null : Math.round((this.elapsed - this.vegaAckAt) * 1000)

    if (role === 'engineer') {
      return {
        ...base,
        power: Math.round(this.power),
        signalCooldownMs: cooldown,
        lastSignal: this.lastSignal,
        ackAgeMs,
      }
    }

    if (role === 'pilot') {
      return {
        ...base,
        stormEta: this.stormEta,
        signalCooldownMs: cooldown,
        lastSignal: this.lastSignal,
        ackAgeMs,
      }
    }

    if (role === 'sparks') {
      return {
        ...base,
        alarms: this.alarms,
        signalCooldownMs: cooldown,
        lastSignal: this.lastSignal,
        ackAgeMs,
      }
    }

    if (role === 'board') {
      return {
        ...base,
        spectator: {
          air: Math.round(this.air),
          power: Math.round(this.power),
          stormEta: this.stormEta,
          pumpOn: this.pumpOn,
          shieldsOn: this.shieldsOn,
          valves: { ...this.valves },
          alarms: this.alarms,
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
