/**
 * Drives the sim without sockets or a browser, so balance can be checked fast.
 *   npx tsx scripts/playtest.ts
 *
 * What this has to prove:
 *   1. A crew that runs the correct sequence survives, with an operator who has
 *      to walk to every control.
 *   2. Drop ANY ONE seat, or ANY ONE call, and the round is unwinnable, because
 *      each card is welded to one console.
 *   3. The seal is not decoration: an operator who ignores the badge, or who
 *      runs wherever a forged card points, pays for it.
 *   4. The stolen key is not scenery: leaving it unrotated costs the round, and
 *      rotating it needs the token carried to the registry by hand.
 *   5. A short table still plays, because seats merge onto the consoles left.
 *
 * Vega only ever acts on her own view: the air, her position, and whatever hit
 * her glass. She never reads which valve is leaking, because she cannot. The
 * crew's calls come from the sim's state, which stands in for what the table
 * works out by talking.
 *
 * Only the simulated players' reaction times are tuned here. The game is not.
 */
import { MISSION_SECONDS, REVOKE_CARD, REVOKE_TARGET, SIGNAL_OWNER, signalSendsTo } from '../shared/content.ts'
import { moduleFor, neighbours } from '../shared/habitat.ts'
import type { ModuleId } from '../shared/habitat.ts'
import { sealOrder } from '../shared/seal.ts'
import { CREW_IDS, VALVES } from '../shared/types.ts'
import { Hab } from '../server/game.ts'
import type { ClientAction, CrewId, IncidentReport, SealState, SignalId } from '../shared/types.ts'

/**
 * The crew side reads these straight off the sim. The operator side never does.
 * `server/game.ts` is not a contract, so a renamed field fails loudly below
 * instead of quietly reading undefined and turning every call off.
 */
type Internals = {
  tick: (dt: number) => void
  air: number
  leaks: Record<'port' | 'starboard', boolean>
  valves: Record<'port' | 'starboard', 'open' | 'sealed'>
  pumpOn: boolean
  shieldsOn: boolean
  stormEta: number | null
  stormActive: boolean
  runawayUntil: number
  elapsed: number
}
const INTERNALS = ['tick', 'air', 'leaks', 'valves', 'pumpOn', 'shieldsOn', 'stormEta', 'stormActive', 'runawayUntil', 'elapsed']

/** Sim seconds a crew member waits before repeating a call she has not acted on yet. */
const REPEAT_AFTER = 6

function makeHab(seed: number, seated: readonly CrewId[]) {
  const hab = new Hab(
    'TEST',
    { id: 'vega', name: 'Vega', role: null, ready: false, connected: true, host: true, socketId: 'sock-vega' },
    seed,
  )
  hab.claim('vega', 'vega')
  hab.setReady('vega', true)
  for (const role of seated) {
    hab.addPlayer({ id: role, name: role, role: null, ready: false, connected: true, host: false, socketId: `sock-${role}` })
    hab.claim(role, role)
    hab.setReady(role, true)
  }
  hab.listener = { onView: () => {}, onSpeak: () => {} }
  const err = hab.start('vega')
  if (err) throw new Error(`start failed: ${err}`)
  hab.stopClock()
  const gone = INTERNALS.filter((k) => !(k in hab))
  if (gone.length) throw new Error(`server/game.ts no longer has ${gone.join(', ')}; the crew sim cannot see the ship`)
  return { hab, inner: hab as unknown as Internals }
}

/**
 * What the crew collectively want Vega to do, most urgent first. A list rather
 * than one answer so that when a call is skipped the table falls through to the
 * next thing worth saying, the way real players would.
 */
function desired(inner: Internals, braceLead: number, rotate: SignalId | null): SignalId[] {
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
  // Shields have to be held through the front, and that means no pump. With
  // shields already up Rook calls it before impact, as his own console tells him
  // to: from the airlock she is two hops from the pump, and the dust does not wait.
  if (eta != null && inner.shieldsOn && inner.pumpOn) want.push('pump-off')
  if (inner.stormActive && inner.pumpOn) want.push('pump-off')
  // Behind the timed calls: a loose key costs one bad order at a time, a missed
  // front costs half the air at once.
  if (rotate) want.push(rotate)
  if (leaking.length) want.push(leaking[0] === 'port' ? 'seal-port' : 'seal-starboard')
  // Restarting the pump mid-runaway just re-floods the cabin.
  if (!inner.stormActive && !runaway && !inner.pumpOn && inner.air < 72) want.push('pump-on')
  return want
}

/** The control a card asks for. Rotation cards are handled separately: they need the token. */
const CONTROL: Partial<Record<SignalId, ClientAction>> = {
  'pump-off': { type: 'pump', on: false },
  'pump-on': { type: 'pump', on: true },
  'seal-port': { type: 'valve', valve: 'port', sealed: true },
  'seal-starboard': { type: 'valve', valve: 'starboard', sealed: true },
  'shields-on': { type: 'shields', on: true },
  brace: { type: 'brace' },
}

/** Entries that appeared at the end of a capped log since the last look. */
function appended(prev: string[], next: string[]): string[] {
  for (let k = Math.min(prev.length, next.length); k > 0; k--) {
    if (prev.slice(-k).join('|') === next.slice(0, k).join('|')) return next.slice(k)
  }
  return next
}

interface Sim {
  label: string
  lag: number
  vegaLag: number
  /** Crew seats somebody actually sat down in. Defaults to all three. */
  seated?: CrewId[]
  /** Seats whose calls nobody makes this run. */
  missing?: CrewId[]
  /** Individual calls nobody makes, for testing whether one call is load-bearing. */
  skip?: SignalId[]
  /**
   * An operator who does whatever the card says without reading the badge. If
   * this does as well as a careful one, the seal is decoration and GHOST is
   * scenery.
   */
  obeysAnything?: boolean
  /**
   * Runs wherever an unsealed card points before reading the badge, then
   * refuses to touch the control. Isolates what a forgery costs her legs from
   * what it costs when she obeys.
   */
  walksOnForged?: boolean
  /** The victim never says it out loud, so no rotation card is ever sent. */
  neverRevoke?: boolean
  /** Walks rotation cards to the registry but never picks up the token. */
  noToken?: boolean
  /**
   * Vega playing her own gauge when nobody is asking her for anything. She can
   * see the air, so a sharp player really would do this. If she can carry the
   * round alone the whole premise is dead.
   */
  vegaSolo?: boolean
}

interface RunResult {
  won: boolean
  minAir: number
  incident: IncidentReport | null
  /** GHOST actually signed something with the key it stole. */
  keyUsed: boolean
  /**
   * Controls she worked while an unsealed card asking for the same thing was
   * still on her glass. Counted from her own view, because the game's report
   * also charges her for sealed orders written with a stolen key.
   */
  touchedForged: number
}

async function run(sim: Sim, seed: number): Promise<RunResult> {
  const seated = sim.seated ?? [...CREW_IDS]
  const { hab, inner } = makeHab(seed, seated)
  const act = (who: string, a: ClientAction) => hab.applyAction(who, a)
  const vega = () => hab.viewFor('vega')!

  const coverOf = new Map(seated.map((c) => [c, hab.viewFor(c)?.covers ?? [c]]))
  const consoleFor = (seat: CrewId) => seated.find((c) => coverOf.get(c)!.includes(seat)) ?? null

  /** Every order a crew phone in this sim really sent. Anything else sealed was GHOST. */
  const pressed = new Set<string>()
  /** A crew phone signs with its own console's key before the order leaves it. */
  const sign = async (signal: SignalId) => {
    const from = consoleFor(SIGNAL_OWNER[signal])
    const seal = from ? hab.viewFor(from)?.seal : null
    if (!from || !seal) return 'nobody holds that card'
    const tag = await sealOrder(seal.key, seal.roundId, from, signal, seal.nextSeq)
    const refused = await act(from, { type: 'signal', signal, seq: seal.nextSeq, tag })
    if (!refused) pressed.add(`${from}|${signal}|${seal.nextSeq}`)
    return refused
  }

  /**
   * The victim of a key theft sees orders in their own log they never pressed.
   * They cannot tell the operator — she cannot hear — so they say it out loud and
   * whoever holds comms sends her the rotation card. That shout is what this
   * models, and it is the only way the theft is ever noticed.
   */
  const logs = new Map<CrewId, string[]>()
  let rotate: SignalId | null = null
  const watchTheBus = () => {
    for (const c of seated) {
      const log = (hab.viewFor(c)?.seal?.log ?? []).map((e) => `${e.signal}#${e.seq}#${e.mine}`)
      const fresh = appended(logs.get(c) ?? [], log)
      logs.set(c, log)
      if (fresh.some((e) => e.endsWith('#false')) && !sim.neverRevoke && !sim.missing?.includes(c)) {
        rotate = REVOKE_CARD[c]
      }
    }
  }

  let intent: SignalId | null = null
  let noticedAt = 0
  const sentAt = new Map<SignalId, number>()

  // Her side. Everything below reads only her own view.
  const seen = new Set<string>()
  let unread: { signal: SignalId; seal: SealState; from: CrewId | null; at: number }[] = []
  let orders: { signal: SignalId; from: CrewId | null }[] = []
  /**
   * Seats she has a signed rotation card for and has not rotated yet. Once the
   * table has told her a key is loose, a card carrying that key proves nothing.
   */
  const distrust = new Set<CrewId>()
  let touchedForged = 0
  let detour: ModuleId | null = null
  /** Clearing is refused in the corridor, so a bin she decided on waits for her to stop. */
  let binning = false
  let obeyedPumpAt: number | null = null

  let keyUsed = false
  const glance = (t: number) => {
    for (const s of vega().signals) {
      if (!s.fresh || seen.has(s.id)) continue
      seen.add(s.id)
      if (s.seal === 'sealed' && s.from && seated.includes(s.from) && !pressed.has(`${s.from}|${s.signal}|${s.seq}`)) {
        keyUsed = true
      }
      unread.push({ signal: s.signal, seal: s.seal, from: s.from, at: t })
    }
  }
  /**
   * Clearing is all-or-nothing on her glass, so she glances first: whatever is
   * already there she keeps in her head. No await between the two, so nothing
   * can land unseen in the gap.
   */
  const wipe = async (t: number) => {
    glance(t)
    binning = (await act('vega', { type: 'clear-signals' })) !== null
  }
  const take = (signal: SignalId, from: CrewId | null) => {
    const undo = signal === 'pump-on' ? 'pump-off' : signal === 'pump-off' ? 'pump-on' : null
    orders = [...orders.filter((o) => o.signal !== signal && o.signal !== undo), { signal, from }]
  }
  const stepToward = async (dest: ModuleId) => {
    const at = vega().hab
    if (!at || at.walkingTo) return false
    if (at.at === dest) return true
    await act('vega', { type: 'walk', to: neighbours(at.at).includes(dest) ? dest : 'spine' })
    return false
  }
  /** True once the order is done with, or given up on. */
  const carryOut = async (signal: SignalId, t: number) => {
    const target = REVOKE_TARGET[signal]
    if (target) {
      const at = vega().hab!
      if (!at.holdingToken && !sim.noToken && at.tokenAt) {
        if (await stepToward(at.tokenAt)) await act('vega', { type: 'token', take: true })
        return false
      }
      if (!(await stepToward('comms'))) return false
      // Without the token the registry has to refuse her. She tries once and
      // gives the card up, which is what makes "impossible" the game's doing.
      // A refusal leaves the key loose, so she keeps distrusting it.
      if (!(await act('vega', { type: 'revoke', seat: target }))) distrust.delete(target)
      return true
    }
    const dest = moduleFor(signalSendsTo(signal))
    if (dest && !(await stepToward(dest))) return false
    if (vega().signals.some((s) => s.fresh && s.seal !== 'sealed' && s.signal === signal)) touchedForged += 1
    await act('vega', CONTROL[signal]!)
    if (signal === 'pump-on' || signal === 'pump-off') obeyedPumpAt = t
    return true
  }
  /** What she can work out alone: the air number, and nothing else. */
  const selfDrive = async (t: number) => {
    if (!(await stepToward('plant'))) return
    const v = vega()
    const air = v.air ?? 0
    // A real player trusts a signal for a few seconds before overriding it.
    const trusting = obeyedPumpAt != null && t - obeyedPumpAt < 10
    if (air > 96 && v.pumpOn) await act('vega', { type: 'pump', on: false })
    else if (air < 58 && !v.pumpOn && !trusting) await act('vega', { type: 'pump', on: true })
    // Air bleeding with the pump running means a leak, but not which one. She
    // guesses, and pays for a wrong guess.
    const open = VALVES.filter((x) => v.valves?.[x] === 'open')
    if (air < 40 && open.length > 1) await act('vega', { type: 'valve', valve: open[0]!, sealed: true })
  }

  let minAir = 999
  const steps = Math.ceil((MISSION_SECONDS + 1) / 0.1)

  for (let i = 0; i < steps; i++) {
    inner.tick(0.1)
    // GHOST signs asynchronously. A loop that never yields holds every forgery
    // back until the crew next presses something, then lands them in a burst on
    // top of a real order — a harder attack than the one the server runs.
    await new Promise((r) => setImmediate(r))
    if (hab.phase !== 'play') break
    const t = inner.elapsed

    // --- the crew ---
    watchTheBus()
    const want: SignalId | null =
      desired(inner, 1.5 + sim.lag + sim.vegaLag, rotate).find(
        (s) =>
          consoleFor(SIGNAL_OWNER[s]) &&
          !sim.missing?.includes(SIGNAL_OWNER[s]) &&
          !sim.skip?.includes(s) &&
          t - (sentAt.get(s) ?? -99) >= REPEAT_AFTER,
      ) ?? null
    if (want !== intent) {
      intent = want
      noticedAt = t
    }
    if (intent && t - noticedAt >= sim.lag && !(await sign(intent))) {
      sentAt.set(intent, t)
      if (intent === rotate) rotate = null
      intent = null
    }

    // --- the operator ---
    glance(t)
    const read = unread.filter((c) => t - c.at >= sim.vegaLag)
    unread = unread.filter((c) => t - c.at < sim.vegaLag)
    for (const card of read) {
      const loose = REVOKE_TARGET[card.signal]
      if (sim.obeysAnything) take(card.signal, card.from)
      else if (card.seal === 'sealed' && card.from && distrust.has(card.from)) binning = true
      else if (card.seal === 'sealed') {
        if (loose) {
          distrust.add(loose)
          orders = orders.filter((o) => o.from !== loose)
        }
        take(card.signal, card.from)
      } else if (sim.walksOnForged) detour = moduleFor(signalSendsTo(card.signal)) ?? detour
      else binning = true
    }
    // She bins the forgery, not the orders under it: anything signed is already
    // in her head before the glass is wiped.
    if (binning) await wipe(t)

    const at = vega().hab
    if (at && !at.walkingTo) {
      if (detour) {
        if (await stepToward(detour)) {
          // Standing at the control, she finally reads the badge she ran past.
          detour = null
          await wipe(t)
        }
      } else if (orders.length) {
        const next =
          orders.find((o) => o.signal === 'brace') ??
          orders.find((o) => moduleFor(signalSendsTo(o.signal)) === at.at) ??
          orders[0]!
        if (await carryOut(next.signal, t)) {
          orders = orders.filter((o) => o !== next)
          // The ack goes out when the glass is empty, so the sender sees it land.
          if (!orders.length) await wipe(t)
        }
      } else if (sim.vegaSolo && !unread.length) {
        // A card she has not read yet outranks her own hunch.
        await selfDrive(t)
      }
    }

    minAir = Math.min(minAir, inner.air)
  }

  const end = vega()
  return { won: end.outcome === 'won', minAir: Math.round(minAir), incident: end.incident, keyUsed, touchedForged }
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]

interface Row {
  won: number
  floor: number
  /** Mean GHOST orders the game charged her for per round, signed or not. */
  obeyed: number
  /** Rounds where she worked a control an unsealed card was asking for. */
  touched: number
  /** Mean seconds per round spent walking where a forgery pointed. */
  wasted: number
  /** Rounds where a stolen key was rotated. */
  rotated: number
  stolen: number
  keyUsed: number
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

async function report(sim: Sim): Promise<Row> {
  const results = await Promise.all(SEEDS.map((s) => run(sim, s)))
  const incidents = results.map((r) => r.incident)
  const row: Row = {
    won: results.filter((r) => r.won).length,
    floor: Math.min(...results.map((r) => r.minAir)),
    obeyed: mean(incidents.map((x) => x?.obeyedUnsealed ?? 0)),
    touched: results.filter((r) => r.touchedForged > 0).length,
    wasted: mean(incidents.map((x) => x?.wastedWalkSeconds ?? 0)),
    rotated: incidents.filter((x) => x?.timeToRevoke != null).length,
    stolen: incidents.filter((x) => x?.stolenFrom != null).length,
    keyUsed: results.filter((r) => r.keyUsed).length,
  }
  console.log(
    [
      sim.label.padEnd(38),
      `${row.won}/${SEEDS.length}`.padStart(4),
      String(row.floor).padStart(6),
      row.obeyed.toFixed(1).padStart(7),
      `${row.wasted.toFixed(1)}s`.padStart(7),
      `${row.rotated}/${row.stolen}`.padStart(8),
      `${row.keyUsed}/${SEEDS.length}`.padStart(8),
    ].join('  '),
  )
  return row
}

function heading(title: string) {
  console.log(`\n=== ${title} ===`)
}

const columns = (cells: string[][]) => {
  for (const line of [0, 1]) {
    console.log(cells.map(([w, ...text]) => text[line]![w === 'l' ? 'padEnd' : 'padStart'](Number(w === 'l' ? 38 : w))).join('  '))
  }
}
columns([
  ['l', 'scenario', ''],
  ['4', 'won', ''],
  ['6', 'air', 'floor'],
  ['7', 'GHOST', 'charged'],
  ['7', 'walked', 'forged'],
  ['8', 'rotated', '/stolen'],
  ['8', 'GHOST', 'signed'],
])

const SHARP = { lag: 1.2, vegaLag: 0.7 }
const NORMAL = { lag: 2.2, vegaLag: 1.3 }
const SLOW = { lag: 3.6, vegaLag: 2.2 }
const SLOPPY = { lag: 5, vegaLag: 3 }

heading('the one path')
const sharp = await report({ label: 'all three, sharp (1.2s)', ...SHARP })
const normal = await report({ label: 'all three, normal (2.2s)', ...NORMAL })
const slow = await report({ label: 'all three, slow (3.6s)', ...SLOW })
const sloppy = await report({ label: 'all three, sloppy (5.0s)', ...SLOPPY })
// The realistic good-table case: she obeys the pad AND works her own gauge.
const helped = await report({ label: 'all three + Vega on her gauge', ...NORMAL, vegaSolo: true })

heading('every seat is load-bearing')
const noRook = await report({ label: 'Rook silent (no pump calls)', ...SHARP, missing: ['engineer'] })
const noIdris = await report({ label: 'Idris silent (no storm calls)', ...SHARP, missing: ['pilot'] })
const noChen = await report({ label: 'Chen silent (no valve calls)', ...SHARP, missing: ['sparks'] })
const nobody = await report({ label: 'nobody signals at all', ...SHARP, missing: [...CREW_IDS] })
const solo = await report({
  label: 'Vega alone, playing her gauge',
  ...SHARP,
  missing: [...CREW_IDS],
  vegaSolo: true,
})

heading('and so is every single call')
const noBrace = await report({ label: 'brace never called', ...NORMAL, skip: ['brace'] })
const noShields = await report({ label: 'shields never called', ...NORMAL, skip: ['shields-on'] })
const noPumpOff = await report({ label: 'pump-off never called', ...NORMAL, skip: ['pump-off'] })

heading('the seal and the key')
// Every row here is a normal crew, so each one differs from "all three, normal"
// in exactly one habit.
const obeysAnything = await report({ label: 'operator obeys anything', ...NORMAL, obeysAnything: true })
// "careful" below means the "all three, normal" row: reads the badge, bins what
// is not sealed, and stops trusting a seat once told to rotate it.
const walksOnForged = await report({ label: 'operator walks on forged orders', ...NORMAL, walksOnForged: true })
const neverRevoke = await report({ label: 'nobody ever rotates a stolen key', ...NORMAL, neverRevoke: true })
const noToken = await report({ label: 'operator never picks up the token', ...NORMAL, noToken: true })

heading('a short table')
const onlyRook = await report({ label: 'Rook + Vega (Rook covers all three)', ...SHARP, seated: ['engineer'] })
const onlyIdris = await report({ label: 'Idris + Vega (Idris covers all three)', ...SHARP, seated: ['pilot'] })
const onlyChen = await report({ label: 'Chen + Vega (Chen covers all three)', ...SHARP, seated: ['sparks'] })
const empty = await report({ label: 'Vega and an empty ship', ...SHARP, seated: [], vegaSolo: true })

const problems: string[] = []
const n = SEEDS.length
if (sharp.won < n) problems.push('a sharp crew running the correct sequence must always win')
if (normal.won < n - 1) problems.push('a normal crew should usually win')
if (slow.won < n - 2) problems.push('a slow crew should still usually win')
if (sloppy.won >= n) problems.push('a sloppy crew must sometimes lose — there has to be a ceiling')
// Initiative must never be punished. If she does worse by thinking for herself,
// the most engaged player at the table is the one breaking the round.
if (helped.won < normal.won) problems.push('a Vega who works her own gauge must not do worse than one who only obeys')
if (noRook.won > 0) problems.push('Rook is not load-bearing')
if (noIdris.won > 0) problems.push('Idris is not load-bearing')
if (noChen.won > 0) problems.push('Chen is not load-bearing')
if (nobody.won > 0) problems.push('silence must never win')
if (solo.won > 0) problems.push('a clever Vega must not be able to carry the round alone')
if (noBrace.won > 0) problems.push('the brace call is decoration')
if (noShields.won > 0) problems.push('the shields call is decoration')
if (noPumpOff.won > 0) problems.push('the pump-off call is decoration')

// The model has to be the careful operator it claims to be, or the comparisons
// below are between two careless ones.
for (const [name, row] of [['sharp', sharp], ['normal', normal], ['slow', slow]] as const) {
  if (row.touched > 0) problems.push(`the careful ${name} operator worked a control a forged card asked for, so the sim does not read the badge`)
}

// The key rows only mean something if GHOST gets to sign with what it stole
// when nobody stops it. A careful crew rotating before its first signature is
// the good outcome, so the check is on the table that never rotates.
if (normal.stolen < n) problems.push(`GHOST only stole a key in ${normal.stolen}/${n} normal rounds`)
if (neverRevoke.keyUsed === 0) {
  problems.push('GHOST held a stolen key all round and never signed an order with it, so the rotation rows prove nothing')
}

// Two rounds in eight is the line for "materially". One could be a seed.
if (obeysAnything.won > normal.won - 2) {
  problems.push(
    `ignoring the seal won ${obeysAnything.won}/${n} against ${normal.won}/${n} for a careful operator — the seal is decoration`,
  )
}
if (obeysAnything.touched === 0) problems.push('an operator who obeys anything never executed a forged order — GHOST is scenery')

if (walksOnForged.wasted <= 0 || walksOnForged.wasted <= normal.wasted) {
  problems.push(
    `running where forged cards point cost ${walksOnForged.wasted.toFixed(1)}s a round against ${normal.wasted.toFixed(1)}s — no measurable walk cost`,
  )
}

if (neverRevoke.won >= normal.won) {
  problems.push(
    `never rotating a stolen key won ${neverRevoke.won}/${n}, same as or better than rotating it (${normal.won}/${n})`,
  )
}
if (normal.rotated === 0) problems.push('a crew that rotates on the victim\'s word never managed a rotation')

if (noToken.rotated > 0) problems.push(`the registry rotated a key for an operator without the token (${noToken.rotated} rounds)`)
if (noToken.won > 0) {
  problems.push(`an operator who never carries the token still won ${noToken.won}/${n} with a key stolen`)
}

// A table of two has to run every system, or half the people who pick this up
// at a hackathon cannot play it.
const halfOrBetter = Math.ceil(n / 2)
for (const [who, row] of [['Rook', onlyRook], ['Idris', onlyIdris], ['Chen', onlyChen]] as const) {
  if (row.won < halfOrBetter) problems.push(`${who} alone with Vega won ${row.won}/${n} — a table of two is not playable`)
}
if (empty.won > 0) problems.push('Vega with no crew at all won — the crew is optional')

if (problems.length) {
  console.log('\nBALANCE NOT READY:')
  for (const p of problems) console.log(`  - ${p}`)
  process.exit(1)
}
console.log('\nbalance OK: one path, four seats on it, not one spare call, and GHOST has teeth')
