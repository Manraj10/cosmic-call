/**
 * Drives the sim without sockets or a browser, so balance can be checked fast.
 *   npx tsx scripts/playtest.ts
 *
 * The point of these policies is that Vega only ever acts on what her glass
 * shows her: the air number, and whatever signal the crew managed to push.
 * She never reads which valve is leaking, because she cannot.
 */
import { MISSION_SECONDS } from '../shared/content.ts'
import { VALVES } from '../shared/types.ts'
import { Hab } from '../server/game.ts'
import type { ClientAction, SignalId, StationId } from '../shared/types.ts'

type Internals = {
  tick: (dt: number) => void
  air: number
  power: number
  leaks: Record<'port' | 'starboard', boolean>
  valves: Record<'port' | 'starboard', 'open' | 'sealed'>
  pumpOn: boolean
  shieldsOn: boolean
  stormEta: number | null
  runawayUntil: number
  elapsed: number
  alarms: string[]
}

function seat(
  hab: Hab,
  id: string,
  role: StationId,
  host: boolean,
) {
  if (!host) {
    hab.addPlayer({
      id,
      name: role,
      role: null,
      ready: false,
      connected: true,
      host: false,
      socketId: `sock-${id}`,
    })
  }
  hab.claim(id, role)
  hab.setReady(id, true)
}

function makeHab(seed: number) {
  const hab = new Hab(
    'TEST',
    {
      id: 'vega',
      name: 'Vega',
      role: null,
      ready: false,
      connected: true,
      host: true,
      socketId: 'sock-vega',
    },
    seed,
  )
  seat(hab, 'vega', 'vega', true)
  seat(hab, 'engineer', 'engineer', false)
  seat(hab, 'pilot', 'pilot', false)
  seat(hab, 'sparks', 'sparks', false)
  hab.listener = { onView: () => {}, onSpeak: () => {} }
  const err = hab.start('vega')
  if (err) throw new Error(`start failed: ${err}`)
  hab.stopClock()
  return { hab, inner: hab as unknown as Internals }
}

interface Sim {
  label: string
  /** Seconds a crew member takes to notice and press. 0 = instant robot. */
  lag: number
  /** Whether the crew push signals at all. */
  relays: boolean
  /** Seconds Vega takes to obey a fresh signal. */
  vegaLag: number
}

function run(sim: Sim, seed: number) {
  const { hab, inner } = makeHab(seed)
  const act = (who: string, a: ClientAction) => hab.applyAction(who, a)

  let noticedAt: number | null = null
  let intent: SignalId | null = null
  let vegaSawAt: number | null = null
  let vegaTodo: SignalId | null = null
  let minAir = 999
  let maxAir = -999
  const steps = Math.ceil((MISSION_SECONDS + 1) / 0.1)

  for (let i = 0; i < steps; i++) {
    inner.tick(0.1)
    if (hab.phase !== 'play') break
    const t = inner.elapsed

    // What the crew can see, and what they would want to send.
    const leaking = VALVES.filter((v) => inner.leaks[v] && inner.valves[v] !== 'sealed')
    const runaway = t < inner.runawayUntil
    const eta = inner.stormEta
    let want: SignalId | null = null
    if (runaway && inner.pumpOn) want = 'pump-off'
    else if (eta != null && eta > 0 && eta <= 4) want = 'brace'
    else if (eta != null && eta > 4 && eta <= 14 && !inner.shieldsOn) want = 'shields-on'
    else if (leaking.length) want = leaking[0] === 'port' ? 'seal-port' : 'seal-starboard'
    else if (!inner.pumpOn && inner.air < 70) want = 'pump-on'

    if (sim.relays) {
      if (want && want !== intent) {
        intent = want
        noticedAt = t
      }
      if (intent && noticedAt != null && t - noticedAt >= sim.lag) {
        const err = act('sparks', { type: 'signal', signal: intent })
        if (!err) intent = null
      }
    }

    // Vega: acts on the freshest signal, plus the one number she can read.
    const view = hab.viewFor('vega')!
    const fresh = view.signals.filter((s) => s.fresh).at(-1)
    if (fresh && fresh.signal !== vegaTodo) {
      vegaTodo = fresh.signal
      vegaSawAt = t
    }
    if (vegaTodo && vegaSawAt != null && t - vegaSawAt >= sim.vegaLag) {
      switch (vegaTodo) {
        case 'pump-off':
          act('vega', { type: 'pump', on: false })
          break
        case 'pump-on':
          act('vega', { type: 'pump', on: true })
          break
        case 'seal-port':
          act('vega', { type: 'valve', valve: 'port', sealed: true })
          break
        case 'seal-starboard':
          act('vega', { type: 'valve', valve: 'starboard', sealed: true })
          break
        case 'shields-on':
          act('vega', { type: 'shields', on: true })
          break
        case 'brace':
          act('vega', { type: 'brace' })
          break
      }
      act('vega', { type: 'clear-signals' })
      vegaTodo = null
    }

    minAir = Math.min(minAir, inner.air)
    maxAir = Math.max(maxAir, inner.air)
  }

  const view = hab.viewFor('vega')!
  return {
    outcome: view.outcome,
    air: Math.round(inner.air),
    minAir: Math.round(minAir),
    maxAir: Math.round(maxAir),
    reason: view.loseReason,
  }
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]

const sims: Sim[] = [
  { label: 'sharp crew (1.0s lag)', lag: 1.0, relays: true, vegaLag: 0.6 },
  { label: 'normal crew (2.0s lag)', lag: 2.0, relays: true, vegaLag: 1.2 },
  { label: 'slow crew (3.5s lag)', lag: 3.5, relays: true, vegaLag: 2.0 },
  { label: 'nobody signals Vega', lag: 0, relays: false, vegaLag: 0 },
]

let failures = 0
for (const sim of sims) {
  const results = SEEDS.map((s) => run(sim, s))
  const won = results.filter((r) => r.outcome === 'won').length
  const minAir = Math.min(...results.map((r) => r.minAir))
  const maxAir = Math.max(...results.map((r) => r.maxAir))
  console.log(
    `${sim.label.padEnd(24)} won ${won}/${SEEDS.length}` +
      `  air floor ${String(minAir).padStart(3)}  ceiling ${String(maxAir).padStart(3)}`,
  )
  const reasons = new Set(results.filter((r) => r.reason).map((r) => r.reason!))
  if (reasons.size) console.log(`${' '.repeat(26)}${[...reasons].join(' / ')}`)

  if (sim.relays && sim.lag <= 2.0 && won < SEEDS.length) failures++
  if (!sim.relays && won > 0) failures++
}

console.log(
  failures
    ? '\nBALANCE NOT READY: talking should win, silence should lose'
    : '\nbalance OK: relaying wins, silence kills',
)
process.exit(failures ? 1 : 0)
