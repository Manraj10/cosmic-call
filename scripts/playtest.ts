/**
 * Drives the sim without sockets or a browser, so balance can be checked fast.
 *   npx tsx scripts/playtest.ts
 *
 * Two things this has to prove:
 *   1. A crew that runs the correct sequence survives.
 *   2. Drop ANY ONE of the three and the round is unwinnable, because each
 *      signal is welded to one console.
 *
 * Vega only ever acts on what her glass shows: the air number, and whatever
 * signal arrived. She never reads which valve is leaking, because she cannot.
 */
import { MISSION_SECONDS, SIGNAL_OWNER } from '../shared/content.ts'
import { VALVES } from '../shared/types.ts'
import { Hab } from '../server/game.ts'
import type { ClientAction, CrewId, SignalId, StationId } from '../shared/types.ts'

type Internals = {
  tick: (dt: number) => void
  air: number
  power: number
  leaks: Record<'port' | 'starboard', boolean>
  valves: Record<'port' | 'starboard', 'open' | 'sealed'>
  pumpOn: boolean
  shieldsOn: boolean
  stormEta: number | null
  stormActive: boolean
  runawayUntil: number
  elapsed: number
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
  hab.claim('vega', 'vega')
  hab.setReady('vega', true)
  for (const role of ['engineer', 'pilot', 'sparks'] as StationId[]) {
    hab.addPlayer({
      id: role,
      name: role,
      role: null,
      ready: false,
      connected: true,
      host: false,
      socketId: `sock-${role}`,
    })
    hab.claim(role, role)
    hab.setReady(role, true)
  }
  hab.listener = { onView: () => {}, onSpeak: () => {} }
  const err = hab.start('vega')
  if (err) throw new Error(`start failed: ${err}`)
  hab.stopClock()
  return { hab, inner: hab as unknown as Internals }
}

/** What the crew collectively want Vega to do, in priority order. */
function desired(inner: Internals): SignalId | null {
  const leaking = VALVES.filter((v) => inner.leaks[v] && inner.valves[v] !== 'sealed')
  const runaway = inner.elapsed < inner.runawayUntil
  const eta = inner.stormEta

  if (runaway && inner.pumpOn) return 'pump-off'
  if (eta != null && !inner.stormActive && eta <= 2.5) return 'brace'
  if (eta != null && !inner.stormActive && eta <= 13 && !inner.shieldsOn) return 'shields-on'
  // Shields have to be held through the front, and that means no pump.
  if (inner.stormActive && inner.pumpOn) return 'pump-off'
  if (leaking.length) return leaking[0] === 'port' ? 'seal-port' : 'seal-starboard'
  // Restarting the pump mid-runaway just re-floods the cabin.
  if (!inner.stormActive && !runaway && !inner.pumpOn && inner.air < 72) return 'pump-on'
  return null
}

interface Sim {
  label: string
  lag: number
  vegaLag: number
  /** Crew members who are absent or silent this run. */
  missing: CrewId[]
}

function run(sim: Sim, seed: number) {
  const { hab, inner } = makeHab(seed)
  const act = (who: string, a: ClientAction) => hab.applyAction(who, a)

  let intent: SignalId | null = null
  let noticedAt: number | null = null
  let vegaTodo: SignalId | null = null
  let vegaSawAt: number | null = null
  let minAir = 999
  const steps = Math.ceil((MISSION_SECONDS + 1) / 0.1)

  for (let i = 0; i < steps; i++) {
    inner.tick(0.1)
    if (hab.phase !== 'play') break
    const t = inner.elapsed

    const want = desired(inner)
    if (want && want !== intent) {
      intent = want
      noticedAt = t
    }
    if (intent && noticedAt != null && t - noticedAt >= sim.lag) {
      const owner = SIGNAL_OWNER[intent]
      if (!sim.missing.includes(owner)) {
        const err = act(owner, { type: 'signal', signal: intent })
        if (!err) intent = null
      }
    }

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
  }

  const view = hab.viewFor('vega')!
  return {
    outcome: view.outcome,
    air: Math.round(inner.air),
    minAir: Math.round(minAir),
    reason: view.loseReason,
  }
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]

function report(sim: Sim) {
  const results = SEEDS.map((s) => run(sim, s))
  const won = results.filter((r) => r.outcome === 'won').length
  const floor = Math.min(...results.map((r) => r.minAir))
  console.log(
    `${sim.label.padEnd(30)} won ${won}/${SEEDS.length}   air floor ${String(floor).padStart(3)}`,
  )
  return won
}

console.log('=== the one path ===')
const sharp = report({ label: 'all three, sharp (1.2s)', lag: 1.2, vegaLag: 0.7, missing: [] })
const normal = report({ label: 'all three, normal (2.2s)', lag: 2.2, vegaLag: 1.3, missing: [] })
const slow = report({ label: 'all three, slow (3.6s)', lag: 3.6, vegaLag: 2.2, missing: [] })

console.log('\n=== every one of them is load-bearing ===')
const noRook = report({
  label: 'Rook silent (no pump calls)',
  lag: 1.2,
  vegaLag: 0.7,
  missing: ['engineer'],
})
const noIdris = report({
  label: 'Idris silent (no storm calls)',
  lag: 1.2,
  vegaLag: 0.7,
  missing: ['pilot'],
})
const noChen = report({
  label: 'Chen silent (no valve calls)',
  lag: 1.2,
  vegaLag: 0.7,
  missing: ['sparks'],
})
const nobody = report({
  label: 'nobody signals at all',
  lag: 1.2,
  vegaLag: 0.7,
  missing: ['engineer', 'pilot', 'sparks'],
})

const problems: string[] = []
if (sharp < SEEDS.length) problems.push('a sharp crew running the correct sequence must always win')
if (normal < SEEDS.length - 1) problems.push('a normal crew should usually win')
if (slow >= SEEDS.length) problems.push('a slow crew should sometimes lose — no slack allowed')
if (noRook > 0) problems.push('Rook is not load-bearing')
if (noIdris > 0) problems.push('Idris is not load-bearing')
if (noChen > 0) problems.push('Chen is not load-bearing')
if (nobody > 0) problems.push('silence must never win')

if (problems.length) {
  console.log('\nBALANCE NOT READY:')
  for (const p of problems) console.log(`  - ${p}`)
  process.exit(1)
}
console.log('\nbalance OK: one path, and all three of them are on it')
