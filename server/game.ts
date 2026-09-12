import {
  BREAKER_LAYOUT,
  GLITCH_COOLDOWN_MS,
  MISSION_SECONDS,
  PHRASE_COOLDOWN_MS,
  PING_COOLDOWN_MS,
  phraseLabel,
  pingLabel,
} from '../shared/content.ts'
import { BREAKERS } from '../shared/types.ts'
import type {
  BreakerId,
  ClientAction,
  ClientView,
  HullBand,
  LobbyPlayer,
  Outcome,
  PhraseId,
  PingEvent,
  PingId,
  PowerHint,
  RadioEvent,
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

function hullBand(hull: number): HullBand {
  if (hull < 32) return 'crit'
  if (hull < 62) return 'warn'
  return 'ok'
}

function powerHint(power: number): PowerHint {
  if (power < 8) return 'dead'
  if (power < 28) return 'strain'
  if (power > 88) return 'surge'
  return 'hum'
}

interface ScriptEvent {
  t: number
  kind:
    | 'voice'
    | 'leak'
    | 'trip'
    | 'storm'
    | 'co2'
    | 'jam'
    | 'turnoff'
    | 'impact'
    | 'glitch'
    | 'brownout'
    | 'double'
}

export interface SpeakPacket {
  to: 'power' | 'hearing'
  text: string
  voice: 'astronaut' | 'system'
}

export interface HabListener {
  onView: () => void
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
  private pingAcc = 0
  private lastPowerSpoken = -99
  private lastTimeCue = 999
  private lastDamage: string | null = null
  private pumpJamUntil = -1
  private glitchUntil = -1
  private stormEta = -1
  private stormActive = false
  private stormWarned = false
  private braced = false
  private impactAt = -1
  private oxygen = 62
  private power = 78
  private co2 = 0.42
  private temp = 21
  private hull = 100
  private mix = 0.45
  private pumpOn = true
  private heading = 12
  private targetHeading = 90
  private valves: Record<ValveId, 'open' | 'sealed'> = {
    port: 'open',
    starboard: 'open',
  }
  private leaks: Record<ValveId, boolean> = { port: false, starboard: false }
  private breakers: Record<BreakerId, boolean> = {
    main: true,
    o2: true,
    scrubber: true,
    shields: true,
    nav: true,
    comms: true,
    fans: true,
  }
  private pings: PingEvent[] = []
  private radio: RadioEvent[] = []
  private printer: string[] = []
  private lastPingAt = -9
  private lastPhraseAt = -9
  private disabledPhrases: PhraseId[] = []
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
          return 'That station is already crewed'
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
    if (!p.role) return 'Claim a station first'
    p.ready = ready
    this.listener?.onView()
    return null
  }

  start(playerId: string): string | null {
    const p = this.players.get(playerId)
    if (!p?.host) return 'Only the hab lead can start'
    if (this.phase !== 'lobby') return 'Already underway'
    const crewed = [...this.players.values()].filter(
      (c) => c.connected && c.role && c.role !== 'board',
    )
    if (crewed.length < 1) return 'Need at least one station'
    if (crewed.some((c) => !c.ready)) return 'Crew is not ready'
    this.begin()
    return null
  }

  private begin() {
    this.rng = mulberry32(this.seed)
    this.targetHeading = 40 + Math.floor(this.rng() * 100)
    this.heading = this.targetHeading + (this.rng() > 0.5 ? -28 : 32)
    this.script = this.buildScript()
    this.phase = 'play'
    this.elapsed = 0
    this.scriptI = 0
    this.printer = ['HAB-7 BUS LIVE', 'DUST CORRIDOR ENTRY']
    this.speakHearing(
      'Crew, we are in the dust corridor. Two minutes. Stay sharp.',
      'astronaut',
    )
    this.speakPower(BREAKER_LAYOUT_INTRO())
    this.listener?.onView()
    this.tickTimer = setInterval(() => this.tick(0.1), 100)
  }

  stopClock() {
    if (this.tickTimer) clearInterval(this.tickTimer)
    this.tickTimer = null
  }

  private buildScript(): ScriptEvent[] {
    const valve = pick(this.rng, ['port', 'starboard'] as const)
    const firstTrip = pick(this.rng, ['o2', 'scrubber', 'comms', 'fans'] as const)
    const stormLead = 22 + Math.floor(this.rng() * 10)
    const warnAt = 20 + Math.floor(this.rng() * 8)
    const secondValve: ValveId = valve === 'port' ? 'starboard' : 'port'
    const doubleTrip = pick(this.rng, ['nav', 'fans', 'comms'] as const)
    return [
      { t: 6, kind: 'leak', valve } as ScriptEvent,
      { t: 15, kind: 'trip', breaker: firstTrip } as ScriptEvent,
      { t: warnAt, kind: 'storm', eta: stormLead } as ScriptEvent,
      { t: 34, kind: 'co2' },
      { t: 42, kind: 'jam' },
      { t: 48, kind: 'turnoff' },
      { t: warnAt + stormLead, kind: 'impact' },
      { t: 72, kind: 'glitch' },
      { t: 82, kind: 'brownout' },
      {
        t: 94,
        kind: 'double',
        valve: secondValve,
        breaker: doubleTrip,
      } as ScriptEvent,
      {
        t: 108,
        kind: 'voice',
        line: 'Hold the hab. The mast is shearing.',
      } as ScriptEvent,
    ]
  }

  private tick(dt: number) {
    if (this.phase !== 'play') return
    this.elapsed += dt
    this.pingAcc = Math.max(0, this.pingAcc - dt)
    while (
      this.scriptI < this.script.length &&
      this.elapsed >= this.script[this.scriptI]!.t
    ) {
      this.fire(this.script[this.scriptI]!)
      this.scriptI += 1
    }
    this.physics(dt)
    this.npcAcc += dt
    if (this.npcAcc >= 1) {
      this.npcAcc = 0
      this.npcs()
    }
    this.maybeSpeakPower()
    this.maybeSpeakTime()
    if (this.hull <= 0) {
      this.end('lost', this.lastDamage ?? 'Hull gone')
      return
    }
    if (this.elapsed >= MISSION_SECONDS) {
      if (this.oxygen < 12) this.end('lost', 'Hypoxia at all-clear')
      else if (this.power < 4) this.end('lost', 'Blackout at all-clear')
      else this.end('won', null)
    } else {
      this.listener?.onView()
    }
  }

  private fire(ev: ScriptEvent) {
    const rec = ev as ScriptEvent & {
      valve?: ValveId
      breaker?: BreakerId
      eta?: number
      line?: string
    }
    switch (ev.kind) {
      case 'voice':
        this.speakHearing(rec.line ?? '', 'astronaut')
        break
      case 'leak':
        if (rec.valve) {
          this.leaks[rec.valve] = true
          this.valves[rec.valve] = 'open'
          this.print(
            `ALRM O2 ${rec.valve === 'port' ? 'PORT' : 'STBD'} VALVE LEAK`,
          )
          this.speakHearing(
            `Guys... oxygen pressure is dropping. ${rec.valve} valve.`,
            'astronaut',
          )
        }
        break
      case 'trip':
        if (rec.breaker) {
          this.breakers[rec.breaker] = false
          this.print(`TRIP ${rec.breaker.toUpperCase()} BREAKER`)
          this.speakPower(
            `${breakerSpoken(rec.breaker)} tripped. Power at ${Math.round(this.power)} percent.`,
          )
        }
        break
      case 'storm': {
        const eta = rec.eta ?? 24
        this.stormEta = eta
        this.stormWarned = true
        this.braced = false
        this.impactAt = this.elapsed + eta
        this.print(`WX DUST FRONT T-${Math.round(eta)}`)
        this.speakHearing(
          `Storm in ${Math.round(eta)} seconds. Get the shields up.`,
          'astronaut',
        )
        break
      }
      case 'co2':
        this.co2 = Math.max(this.co2, 4.1)
        this.print(`LIFE CO2 ${this.co2.toFixed(1)}`)
        this.speakHearing('CO2 is climbing. Scrubber, please.', 'astronaut')
        break
      case 'jam':
        this.pumpOn = true
        this.pumpJamUntil = this.elapsed + 10
        this.print('O2 PUMP JAM — OUTPUT HIGH')
        break
      case 'turnoff':
        this.speakHearing('Turn off oxygen! Turn it off now!', 'astronaut')
        this.print('VOICE: TURN OFF OXYGEN')
        break
      case 'impact':
        this.stormActive = true
        this.stormEta = 0
        this.print('IMPACT — DUST LOAD ON HAB')
        if (!this.braced) {
          this.hurt(10, 'Unbraced storm strike')
          this.speakHearing('Nobody braced. We felt that.', 'astronaut')
        } else {
          this.speakHearing('Impact. Crew is strapped. Hold heading.', 'astronaut')
        }
        break
      case 'glitch':
        this.glitchUntil = this.elapsed + 16
        this.disabledPhrases = pickN(this.rng, [
          'o2-off',
          'seal-port',
          'shields',
          'storm',
          'need-power',
        ] as PhraseId[], 2)
        this.breakers.comms = false
        this.print('COMMS ARRAY STATIC — RESET GRID')
        this.speakHearing('Radio is hashing out. Reset the array.', 'astronaut')
        break
      case 'brownout':
        this.power = Math.max(8, this.power - 36)
        this.breakers.o2 = false
        this.breakers.scrubber = false
        this.print('BROWNOUT — O2 AND SCRUB OFF BUS')
        this.speakPower(`Brownout. Power at ${Math.round(this.power)} percent.`)
        this.speakHearing('Power is falling apart. I need the bus.', 'astronaut')
        break
      case 'double':
        if (rec.valve) {
          this.leaks[rec.valve] = true
          this.valves[rec.valve] = 'open'
          this.print(
            `SECOND LEAK ${rec.valve === 'port' ? 'PORT' : 'STBD'}`,
          )
        }
        if (rec.breaker) this.breakers[rec.breaker] = false
        this.speakHearing(
          'Two systems at once. Talk to each other.',
          'astronaut',
        )
        break
    }
  }

  private physics(dt: number) {
    const main = this.breakers.main && this.power > 3
    let o2 = this.oxygen
    if (this.leaks.port && this.valves.port !== 'sealed') o2 -= 2.15 * dt
    if (this.leaks.starboard && this.valves.starboard !== 'sealed') o2 -= 2.15 * dt
    const pumpLive = this.pumpOn && this.breakers.o2 && main
    if (pumpLive) o2 += (1.45 + this.mix * 0.7) * dt
    if (this.elapsed < this.pumpJamUntil && pumpLive) o2 += 3.4 * dt
    if (!this.breakers.o2 || !main) o2 -= 0.4 * dt
    this.oxygen = clamp(o2, 0, 100)

    let draw = 0.12
    if (this.breakers.o2) draw += 0.22
    if (this.breakers.scrubber) draw += 0.2
    if (this.breakers.shields) draw += this.stormActive ? 0.85 : 0.32
    if (this.breakers.nav) draw += 0.14
    if (this.breakers.comms) draw += 0.12
    if (this.breakers.fans) draw += 0.1
    if (main) this.power += 0.62 * dt - draw * dt
    else this.power -= 1.15 * dt
    this.power = clamp(this.power, 0, 100)

    if (this.breakers.scrubber && main) this.co2 -= 0.09 * dt
    else this.co2 += 0.11 * dt
    if (this.leaks.port || this.leaks.starboard) this.co2 += 0.04 * dt
    this.co2 = clamp(this.co2, 0.04, 8)

    if (this.breakers.fans && main) this.temp += (22 - this.temp) * 0.03
    else this.temp += 0.18 * dt * (this.stormActive ? 1.8 : 1)

    if (this.stormWarned && !this.stormActive) {
      this.stormEta = Math.max(0, this.impactAt - this.elapsed)
    }

    const headingErr = Math.abs(wrapDeg(this.heading - this.targetHeading))
    if (this.oxygen < 8) this.hurt(0.85 * dt, 'Hypoxia')
    if (this.oxygen > 95) this.hurt(1.15 * dt, 'Overpressure rupture')
    if (this.co2 > 5.4) this.hurt(0.55 * dt, 'CO2 poisoning')
    if (this.power < 1) this.hurt(0.7 * dt, 'Blackout cascade')
    if (this.stormActive) {
      const shielded = this.breakers.shields && main && this.power > 10
      if (!shielded) this.hurt(1.45 * dt, 'Unshielded storm')
      if (headingErr > 22) this.hurt(0.35 * dt, 'Heading shear')
    }
  }

  private hurt(amount: number, reason: string) {
    this.hull = clamp(this.hull - amount, 0, 100)
    this.lastDamage = reason
  }

  private npcs() {
    const claimed = new Set(
      [...this.players.values()]
        .filter((p) => p.connected && p.role && p.role !== 'board')
        .map((p) => p.role),
    )
    if (!claimed.has('oxygen')) this.npcOxygen()
    if (!claimed.has('power')) this.npcPower()
    if (!claimed.has('nav')) this.npcNav()
    if (!claimed.has('comms')) this.npcComms()
  }

  private npcOxygen() {
    for (const v of ['port', 'starboard'] as const) {
      if (this.leaks[v] && this.valves[v] !== 'sealed') this.valves[v] = 'sealed'
    }
    if (this.oxygen > 88) this.pumpOn = false
    else if (this.oxygen < 28) this.pumpOn = true
  }

  private npcPower() {
    this.breakers.main = true
    if (this.stormWarned) this.breakers.shields = true
    if (this.oxygen < 40 || this.leaks.port || this.leaks.starboard) {
      this.breakers.o2 = true
    }
    if (this.co2 > 2.5) this.breakers.scrubber = true
    if (this.elapsed < this.glitchUntil || !this.breakers.comms) {
      this.breakers.comms = true
    }
    this.breakers.fans = true
    this.breakers.nav = true
  }

  private npcNav() {
    const err = wrapDeg(this.targetHeading - this.heading)
    this.heading = wrapDeg(this.heading + clamp(err, -8, 8))
    if (this.stormWarned && !this.stormActive && this.pingAcc <= 0) {
      if (this.stormEta > 8) this.applyPing('storm')
      else this.applyPing('brace')
    }
  }

  private npcComms() {
    if (this.elapsed - this.lastPhraseAt < PHRASE_COOLDOWN_MS / 1000) return
    if (this.oxygen > 90) this.applyPhrase('o2-off')
    else if (this.leaks.port && this.valves.port !== 'sealed') {
      this.applyPhrase('seal-port')
    } else if (this.leaks.starboard && this.valves.starboard !== 'sealed') {
      this.applyPhrase('seal-star')
    } else if (this.stormWarned && !this.stormActive) this.applyPhrase('storm')
    else if (this.power < 25) this.applyPhrase('need-power')
  }

  applyAction(playerId: string, action: ClientAction): string | null {
    if (this.phase !== 'play') return 'Mission not live'
    const p = this.players.get(playerId)
    if (!p?.role || p.role === 'board') return 'No station'
    switch (action.type) {
      case 'valve':
        if (p.role !== 'oxygen') return 'Wrong station'
        this.valves[action.valve] = action.sealed ? 'sealed' : 'open'
        break
      case 'pump':
        if (p.role !== 'oxygen') return 'Wrong station'
        this.pumpOn = action.on
        break
      case 'mix':
        if (p.role !== 'oxygen') return 'Wrong station'
        this.mix = clamp(action.value, 0, 1)
        break
      case 'breaker':
        if (p.role !== 'power') return 'Wrong station'
        this.breakers[action.breaker] = action.on
        this.speakPower(
          `${breakerSpoken(action.breaker)} ${action.on ? 'on' : 'off'}. Power at ${Math.round(this.power)} percent.`,
        )
        break
      case 'heading':
        if (p.role !== 'nav') return 'Wrong station'
        this.heading = wrapDeg(action.deg)
        break
      case 'ping':
        if (p.role !== 'nav') return 'Wrong station'
        if (this.elapsed - this.lastPingAt < PING_COOLDOWN_MS / 1000) {
          return 'Ping buffer'
        }
        this.applyPing(action.ping)
        break
      case 'phrase':
        if (p.role !== 'comms') return 'Wrong station'
        if (this.disabledPhrases.includes(action.phrase)) return 'Phrase hashed'
        {
          const cd =
            this.elapsed < this.glitchUntil
              ? GLITCH_COOLDOWN_MS
              : PHRASE_COOLDOWN_MS
          if (this.elapsed - this.lastPhraseAt < cd / 1000) return 'Cooldown'
          if (!this.breakers.comms || !this.breakers.main) {
            this.print('TX FAIL — ARRAY UNPOWERED')
            return 'Array unpowered'
          }
          this.applyPhrase(action.phrase)
        }
        break
    }
    this.listener?.onView()
    return null
  }

  private applyPing(ping: PingId) {
    this.lastPingAt = this.elapsed
    this.pingAcc = PING_COOLDOWN_MS / 1000
    const ev: PingEvent = { id: String(this.seq++), ping, at: Date.now() }
    this.pings = [...this.pings.slice(-6), ev]
    if (ping === 'brace' && this.stormWarned && !this.stormActive) {
      this.braced = true
    }
    this.speakHearing(`Navigation ping: ${pingLabel(ping)}`, 'system')
    this.speakPower(`Ping: ${pingLabel(ping)}`)
  }

  private applyPhrase(phrase: PhraseId) {
    this.lastPhraseAt = this.elapsed
    const ev: RadioEvent = { id: String(this.seq++), phrase, at: Date.now() }
    this.radio = [...this.radio.slice(-6), ev]
    this.print(`TX ${phraseLabel(phrase)}`)
    this.speakHearing(`Radio: ${phraseLabel(phrase)}`, 'system')
    this.speakPower(`Radio: ${phraseLabel(phrase)}`)
  }

  scanPower() {
    const on = BREAKERS.filter((id) => this.breakers[id])
      .map(breakerSpoken)
      .join('. ')
    this.speakPower(
      `Scan. Power at ${Math.round(this.power)} percent. On: ${on || 'nothing'}.`,
    )
  }

  private maybeSpeakPower() {
    const rounded = Math.round(this.power)
    if (Math.abs(rounded - this.lastPowerSpoken) >= 6) {
      this.lastPowerSpoken = rounded
      this.speakPower(`Power at ${rounded} percent.`)
    }
  }

  private maybeSpeakTime() {
    const left = Math.ceil(MISSION_SECONDS - this.elapsed)
    for (const mark of [90, 60, 30, 10]) {
      if (left <= mark && this.lastTimeCue > mark) {
        this.lastTimeCue = mark
        this.speakPower(`${mark} seconds remaining.`)
      }
    }
  }

  private print(line: string) {
    this.printer = [...this.printer.slice(-9), line]
  }

  private speakHearing(text: string, voice: 'astronaut' | 'system') {
    this.listener?.onSpeak({ to: 'hearing', text, voice })
  }

  private speakPower(text: string) {
    this.listener?.onSpeak({ to: 'power', text, voice: 'system' })
  }

  private end(outcome: Outcome, reason: string | null) {
    this.phase = 'end'
    this.outcome = outcome
    this.loseReason = reason
    this.stopClock()
    if (outcome === 'won') {
      this.speakHearing('All clear. The storm passed. HAB-7 still has air.', 'astronaut')
    } else {
      this.speakHearing(`We lost it. ${reason ?? ''}`, 'astronaut')
    }
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
    const glitch = this.elapsed < this.glitchUntil
    const cdMs = (() => {
      if (this.phase !== 'play') return 0
      const window = glitch ? GLITCH_COOLDOWN_MS : PHRASE_COOLDOWN_MS
      const remain = window - (this.elapsed - this.lastPhraseAt) * 1000
      return Math.max(0, remain)
    })()
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
      hullBand: hullBand(this.hull),
      hull: role === 'board' ? Math.round(this.hull) : null,
      pings: this.pings,
      radio: this.radio,
      oxygen: null,
      valves: null,
      pumpOn: null,
      mix: null,
      alarm: false,
      breakers: null,
      powerHint: null,
      stormEta: null,
      stormActive: this.stormActive,
      heading: null,
      targetHeading: null,
      shieldsUp: null,
      cooldownMs: null,
      glitch: false,
      disabledPhrases: [],
      printer: [],
      outcome: this.outcome,
      loseReason: this.loseReason,
      braced: this.braced,
    }
    if (role === 'oxygen') {
      const leak =
        (this.leaks.port && this.valves.port !== 'sealed') ||
        (this.leaks.starboard && this.valves.starboard !== 'sealed')
      return {
        ...base,
        oxygen: this.oxygen,
        valves: { ...this.valves },
        pumpOn: this.pumpOn,
        mix: this.mix,
        alarm:
          this.oxygen < 22 ||
          this.oxygen > 88 ||
          leak ||
          this.hull < 40,
      }
    }
    if (role === 'power') {
      return {
        ...base,
        timeLeft: null,
        breakers: { ...this.breakers },
        powerHint: powerHint(this.power),
        radio: [],
        pings: [],
      }
    }
    if (role === 'nav') {
      return {
        ...base,
        stormEta: this.stormWarned && !this.stormActive ? this.stormEta : this.stormActive ? 0 : null,
        heading: this.heading,
        targetHeading: this.targetHeading,
        shieldsUp: this.breakers.shields && this.breakers.main && this.power > 10,
        printer: this.leaks.port || this.leaks.starboard
          ? [
              this.leaks.port && this.valves.port !== 'sealed' ? 'PORT LEAK' : '',
              this.leaks.starboard && this.valves.starboard !== 'sealed'
                ? 'STARBOARD LEAK'
                : '',
            ].filter(Boolean)
          : [],
      }
    }
    if (role === 'comms') {
      return {
        ...base,
        cooldownMs: cdMs,
        glitch,
        disabledPhrases: this.disabledPhrases,
        printer: this.printer,
      }
    }
    if (role === 'board') {
      return {
        ...base,
        hull: Math.round(this.hull),
        stormEta: this.stormWarned && !this.stormActive ? this.stormEta : null,
        printer: this.printer,
        shieldsUp: this.breakers.shields && this.breakers.main,
      }
    }
    return base
  }
}

function wrapDeg(d: number): number {
  return ((d % 360) + 360) % 360
}

function breakerSpoken(id: BreakerId): string {
  return BREAKER_LAYOUT.find((b) => b.id === id)?.spoken ?? id
}

function BREAKER_LAYOUT_INTRO(): string {
  return 'Breaker layout. Top row, left to right: Main bus, Oxygen pumps, Scrubber, Shields. Bottom row: Navigation, Communications, Fans.'
}

function pickN<T>(rng: Rng, items: T[], n: number): T[] {
  const copy = [...items]
  const out: T[] = []
  while (out.length < n && copy.length) {
    const i = Math.floor(rng() * copy.length)
    out.push(copy.splice(i, 1)[0]!)
  }
  return out
}

export function makeCode(): string {
  const alphabet = 'ABDEFGHJKMNPQRSTUVWXYZ'
  let s = ''
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return s
}
