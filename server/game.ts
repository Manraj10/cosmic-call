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
    this.script = this.buildScript()
    this.phase = 'play'
    this.elapsed = 0
    this.scriptI = 0
    this.air = 48
    this.power = 70
    this.seams = 0
    this.seamBlown = false
    this.alarms = ['HAB-7 IN THE DUST CORRIDOR', 'PLANT IS LIVE']
    this.speak('Ninety seconds. Talk to each other. Send her a picture.', 'astronaut')
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
        break
    }
    this.listener?.onView()
    return null
  }

  private pushSignal(signal: SignalId, from: CrewId | null) {
    this.lastSignalAt = this.elapsed
    if (from) this.lastSignalBy[from] = signal
    this.lastAckedFrom = null
    this.signals = [
      ...this.signals.slice(-5),
      { id: String(this.seq++), signal, from, at: Date.now(), fresh: true },
    ]
    // Do not announce the call. The other two find out by asking.
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
      braced: null,
      signals: [],
      power: null,
      draw: null,
      stormEta: null,
      stormActive: null,
      alarms: [],
      signalCooldownMs: null,
      lastSignal: null,
      ackAgeMs: null,
      order: null,
      gripe: null,
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
