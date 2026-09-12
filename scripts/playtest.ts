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
import { sealOrder } from '../shared/seal.ts'
import { CREW_IDS, VALVES } from '../shared/types.ts'
import { Hab } from '../server/game.ts'
import type { ClientAction, ClientView, CrewId, SignalId, StationId } from '../shared/types.ts'

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

/**
 * What the crew collectively want Vega to do, most urgent first. A list rather
 * than one answer so that when a call is skipped the table falls through to the
 * next thing worth saying, the way real players would.
 */
function desired(inner: Internals, braceLead: number): SignalId[] {
  const leaking = VALVES.filter((v) => inner.leaks[v] && inner.valves[v] !== 'sealed')
  const runaway = inner.elapsed < inner.runawayUntil
  const eta = inner.stormEta
  const want: SignalId[] = []

  if (runaway && inner.pumpOn) want.push('pump-off')
  // Idris leads the target by his own reaction plus hers, aiming for her thumb to
  // land about a second and a half before impact. Too early misses the window
  // just as badly as too late.
  if (eta != null && !inner.stormActive && eta <= braceLead) want.push('brace')
  if (eta != null && !inner.stormActive && eta <= 13 && !inner.shieldsOn) want.push('shields-on')
  // Shields have to be held through the front, and that means no pump.
  if (inner.stormActive && inner.pumpOn) want.push('pump-off')
  if (leaking.length) want.push(leaking[0] === 'port' ? 'seal-port' : 'seal-starboard')
  // Restarting the pump mid-runaway just re-floods the cabin.
  if (!inner.stormActive && !runaway && !inner.pumpOn && inner.air < 72) want.push('pump-on')
  return want
}

interface Sim {
  label: string
  lag: number
  vegaLag: number
  /** Crew members who are absent or silent this run. */
  missing: CrewId[]
  /** Individual calls nobody makes, for testing whether one call is load-bearing. */
  skip?: SignalId[]
  /**
   * An operator who does whatever the card says without reading the badge. If
   * this does as well as a careful one, the seal is decoration and GHOST is
   * scenery.
   */
  obeysAnything?: boolean
  /** Comms never rotates a stolen key, so GHOST keeps signing as that seat. */
  neverRevoke?: boolean
  /**
   * Vega playing her own gauge instead of only obeying signals. She can see the
   * air number and the overpressure hatching, so a sharp player really would do
   * this. If she can carry the round alone the whole premise is dead.
   */
  vegaSolo?: boolean
}

/**
 * What Vega can work out with no help at all: the air number, and nothing else.
 * `obeyedPumpAt` keeps her from undoing an order she just followed — a real
 * player trusts a signal for a few seconds before overriding it.
 */
async function vegaSelfDrive(hab: Hab, inner: Internals, obeyedPumpAt: number | null) {
  const air = inner.air
  const trusting = obeyedPumpAt != null && inner.elapsed - obeyedPumpAt < 10
  if (air > 96 && inner.pumpOn) await hab.applyAction('vega', { type: 'pump', on: false })
  else if (air < 58 && !inner.pumpOn && !trusting)
    await hab.applyAction('vega', { type: 'pump', on: true })
  // Air bleeding with the pump already running means a leak, but not which one.
  // Guessing is all she has, so let her guess — and pay for a wrong guess.
  if (air < 40) {
    const open = VALVES.filter((v) => inner.valves[v] === 'open')
    if (open.length > 1) await hab.applyAction('vega', { type: 'valve', valve: open[0], sealed: true })
  }
}

async function run(sim: Sim, seed: number) {
  const { hab, inner } = makeHab(seed)
  const act = (who: string, a: ClientAction) => hab.applyAction(who, a)

  /** A crew phone signs with its own key before the order leaves it. */
  const sign = async (seat: CrewId, signal: SignalId) => {
    const seal = (hab.viewFor(seat) as ClientView).seal
    if (!seal) return 'no key'
    const tag = await sealOrder(seal.key, seal.roundId, seat, signal, seal.nextSeq)
    return act(seat, { type: 'signal', signal, seq: seal.nextSeq, tag })
  }

  /**
   * The victim of a key theft can see orders in their own log they never
   * pressed. They cannot tell the operator — she cannot receive it — so they
   * say it out loud and comms rotates. That shout is what this models.
   */
  const watchTheBus = async () => {
    if (sim.neverRevoke) return
    for (const seat of CREW_IDS) {
      if (sim.missing.includes(seat)) continue
      const seal = (hab.viewFor(seat) as ClientView).seal
      if (seal?.log.some((e) => !e.mine)) {
        await act('sparks', { type: 'revoke', seat })
        return
      }
    }
  }

  let intent: SignalId | null = null
  let noticedAt: number | null = null
  let vegaTodo: SignalId | null = null
  let vegaSawAt: number | null = null
  let obeyedPumpAt: number | null = null
  let minAir = 999
  const steps = Math.ceil((MISSION_SECONDS + 1) / 0.1)

  for (let i = 0; i < steps; i++) {
    inner.tick(0.1)
    if (hab.phase !== 'play') break
    const t = inner.elapsed

    const want =
      desired(inner, 1.5 + sim.lag + sim.vegaLag).find(
        (s) => !sim.missing.includes(SIGNAL_OWNER[s]) && !sim.skip?.includes(s),
      ) ?? null
    if (want && want !== intent) {
      intent = want
      noticedAt = t
    }
    if (intent && noticedAt != null && t - noticedAt >= sim.lag) {
      const err = await sign(SIGNAL_OWNER[intent], intent)
      if (!err) intent = null
    }

    if (!sim.missing.includes('sparks')) await watchTheBus()

    const view = hab.viewFor('vega')!
    // She reads the badge before she reads the order. A careful operator acts on
    // the newest card that carries a good seal and ignores the rest; she does
    // not bin the whole glass, because a real order can be sitting under a
    // forgery. Binning everything was costing her real orders and quietly
    // changing what this harness was measuring.
    const onGlass = view.signals.filter((s) => s.fresh)
    const fresh = sim.obeysAnything
      ? onGlass.at(-1)
      : (onGlass.filter((s) => s.seal === 'sealed').at(-1) ?? null)
    if (!fresh && onGlass.length && !sim.obeysAnything) {
      // Nothing on the glass is signed. Clear it and wait for a real one.
      await act('vega', { type: 'clear-signals' })
    }
    if (fresh && fresh.signal !== vegaTodo) {
      vegaTodo = fresh.signal
      vegaSawAt = t
    }
    if (vegaTodo && vegaSawAt != null && t - vegaSawAt >= sim.vegaLag) {
      switch (vegaTodo) {
        case 'pump-off':
          await act('vega', { type: 'pump', on: false })
          obeyedPumpAt = t
          break
        case 'pump-on':
          await act('vega', { type: 'pump', on: true })
          obeyedPumpAt = t
          break
        case 'seal-port':
          await act('vega', { type: 'valve', valve: 'port', sealed: true })
          break
        case 'seal-starboard':
          await act('vega', { type: 'valve', valve: 'starboard', sealed: true })
          break
        case 'shields-on':
          await act('vega', { type: 'shields', on: true })
          break
        case 'brace':
          await act('vega', { type: 'brace' })
          break
      }
      await act('vega', { type: 'clear-signals' })
      vegaTodo = null
    }

    if (sim.vegaSolo) await vegaSelfDrive(hab, inner, obeyedPumpAt)

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

async function report(sim: Sim) {
  const results = await Promise.all(SEEDS.map((s) => run(sim, s)))
  const won = results.filter((r) => r.outcome === 'won').length
  const floor = Math.min(...results.map((r) => r.minAir))
  console.log(
    `${sim.label.padEnd(30)} won ${won}/${SEEDS.length}   air floor ${String(floor).padStart(3)}`,
  )
  return won
}

console.log('=== the one path ===')
const sharp = await report({ label: 'all three, sharp (1.2s)', lag: 1.2, vegaLag: 0.7, missing: [] })
const normal = await report({ label: 'all three, normal (2.2s)', lag: 2.2, vegaLag: 1.3, missing: [] })
const slow = await report({ label: 'all three, slow (3.6s)', lag: 3.6, vegaLag: 2.2, missing: [] })
const sloppy = await report({ label: 'all three, sloppy (5.0s)', lag: 5, vegaLag: 3, missing: [] })

// The realistic good-table case: she obeys the pad AND works her own gauge.
const helped = await report({
  label: 'all three + Vega on her gauge',
  lag: 2.2,
  vegaLag: 1.3,
  missing: [],
  vegaSolo: true,
})

console.log('\n=== every seat is load-bearing ===')
const noRook = await report({
  label: 'Rook silent (no pump calls)',
  lag: 1.2,
  vegaLag: 0.7,
  missing: ['engineer'],
})
const noIdris = await report({
  label: 'Idris silent (no storm calls)',
  lag: 1.2,
  vegaLag: 0.7,
  missing: ['pilot'],
})
const noChen = await report({
  label: 'Chen silent (no valve calls)',
  lag: 1.2,
  vegaLag: 0.7,
  missing: ['sparks'],
})
const nobody = await report({
  label: 'nobody signals at all',
  lag: 1.2,
  vegaLag: 0.7,
  missing: ['engineer', 'pilot', 'sparks'],
})
const solo = await report({
  label: 'Vega alone, playing her gauge',
  lag: 1.2,
  vegaLag: 0.7,
  missing: ['engineer', 'pilot', 'sparks'],
  vegaSolo: true,
})
console.log('\n=== and so is every single call ===')
const noBrace = await report({
  label: 'brace never called',
  lag: 2.2,
  vegaLag: 1.3,
  missing: [],
  skip: ['brace'],
})
const noShields = await report({
  label: 'shields never called',
  lag: 2.2,
  vegaLag: 1.3,
  missing: [],
  skip: ['shields-on'],
})
const noPumpOff = await report({
  label: 'pump-off never called',
  lag: 2.2,
  vegaLag: 1.3,
  missing: [],
  skip: ['pump-off'],
})

const problems: string[] = []
if (sharp < SEEDS.length) problems.push('a sharp crew running the correct sequence must always win')
if (normal < SEEDS.length - 1) problems.push('a normal crew should usually win')
if (slow < SEEDS.length - 2) problems.push('a slow crew should still usually win')
if (sloppy >= SEEDS.length) problems.push('a sloppy crew must sometimes lose — there has to be a ceiling')
// Initiative must never be punished. If she does worse by thinking for herself,
// the most engaged player at the table is the one breaking the round.
if (helped < normal) problems.push('a Vega who works her own gauge must not do worse than one who only obeys')
if (noRook > 0) problems.push('Rook is not load-bearing')
if (noIdris > 0) problems.push('Idris is not load-bearing')
if (noChen > 0) problems.push('Chen is not load-bearing')
if (nobody > 0) problems.push('silence must never win')
if (solo > 0) problems.push('a clever Vega must not be able to carry the round alone')
if (noBrace > 0) problems.push('the brace call is decoration')
if (noShields > 0) problems.push('the shields call is decoration')
if (noPumpOff > 0) problems.push('the pump-off call is decoration')

if (problems.length) {
  console.log('\nBALANCE NOT READY:')
  for (const p of problems) console.log(`  - ${p}`)
  process.exit(1)
}
console.log('\nbalance OK: one path, four seats on it, and not one spare call')
