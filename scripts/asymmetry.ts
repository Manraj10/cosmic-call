/**
 * Guards the one rule the whole game rests on: Vega cannot perceive what her
 * crew perceive, and the server is what enforces it rather than the players'
 * good manners.
 *
 *   npm run asymmetry
 *
 * This is separate from the balance harness because balance is a tuning question
 * and this is a correctness one. If a field leaks into her view, the game stops
 * being about relaying and starts being solitaire.
 */
import { SIGNAL_OWNER } from '../shared/content.ts'
import { HOP_SECONDS } from '../shared/habitat.ts'
import { sealOrder } from '../shared/seal.ts'
import { CREW_IDS, ROLE_IDS, hearsSpeech } from '../shared/types.ts'
import { Hab } from '../server/game.ts'
import type { ClientView, CrewId, SignalId, StationId } from '../shared/types.ts'

/**
 * Send an order the way a phone does: sign it with that console's own key
 * first. A harness that could post unsigned orders would be testing a game
 * nobody plays.
 */
async function send(h: Hab, seat: CrewId, signal: SignalId, as: string = seat) {
  const seal = (h.viewFor(as) as ClientView).seal
  if (!seal) return 'that seat holds no key'
  const tag = await sealOrder(seal.key, seal.roundId, seat, signal, seal.nextSeq)
  return h.applyAction(as, { type: 'signal', signal, seq: seal.nextSeq, tag })
}

function seat(hab: Hab, role: StationId, id = role) {
  hab.addPlayer({
    id,
    name: id,
    role: null,
    ready: false,
    connected: true,
    host: false,
    socketId: `sock-${id}`,
  })
  hab.claim(id, role)
  hab.setReady(id, true)
}

const hab = new Hab(
  'TEST',
  { id: 'vega', name: 'Vega', role: null, ready: false, connected: true, host: true, socketId: 's' },
  7,
)
hab.claim('vega', 'vega')
hab.setReady('vega', true)
for (const c of CREW_IDS) seat(hab, c)
seat(hab, 'board')

const spoken: string[] = []
hab.listener = { onView: () => {}, onSpeak: (p) => spoken.push(p.text) }
const err = hab.start('vega')
if (err) throw new Error(err)
const inner = hab as unknown as { tick: (dt: number) => void }
// Far enough in to have tripped a leak, the runaway and the storm warning.
for (let i = 0; i < 500; i++) inner.tick(0.1)
hab.stopClock()

const problems: string[] = []
const view = (id: string) => hab.viewFor(id) as ClientView
// Every refusal below is only evidence while the round is live. A finished round
// refuses everything, and would turn this whole file green for the wrong reason.
if (hab.phase !== 'play') problems.push(`the round ended before the checks ran (${hab.phase}), so every refusal is vacuous`)

// --- who is allowed to hear the ship at all ---
for (const role of ROLE_IDS) {
  const should = role !== 'vega'
  if (hearsSpeech(role) !== should) problems.push(`hearsSpeech(${role}) should be ${should}`)
}
if (hearsSpeech('board')) problems.push('the spectator board must not receive audio')
if (hearsSpeech(null)) problems.push('an unseated player must not receive audio')
if (!spoken.length) problems.push('the ship said nothing, so this run proves nothing')

// --- what Vega is allowed to know ---
const v = view('vega')
const hiddenFromVega: [string, unknown][] = [
  ['timeLeft', v.timeLeft],
  ['leakLights', v.leakLights],
  ['stormEta', v.stormEta],
  ['stormActive', v.stormActive],
  ['power', v.power],
  ['draw', v.draw],
  ['signalCooldownMs', v.signalCooldownMs],
  ['lastSignal', v.lastSignal],
  ['ackAgeMs', v.ackAgeMs],
]
for (const [field, value] of hiddenFromVega) {
  if (value !== null) problems.push(`Vega can see ${field} (${JSON.stringify(value)})`)
}
if (v.alarms.length) problems.push('Vega can read the alarm log')
// She holds every control and no key. If she could sign, she could verify for
// herself, and the crew would stop being the thing that vouches for an order.
if (v.seal !== null) problems.push('Vega was issued a signing key')
// Covers is a list of whose instruments a console reads. She reads none.
if (v.covers !== null) problems.push(`Vega was told which seats she covers (${JSON.stringify(v.covers)})`)
if (v.hab == null) problems.push('Vega has no body on the hab map')
if (v.air == null) problems.push('Vega cannot see the air, which is the one thing she needs')
if (v.order && /port|starboard|storm|t-\d|power \d/i.test(v.order.text)) {
  problems.push(`Vega's order leaked someone else's fact: "${v.order.text}"`)
}

// --- and what each crew member is allowed to know ---
const rook = view('engineer')
if (rook.power == null) problems.push('Rook cannot see the reactor')
if (rook.draw == null) problems.push('Rook cannot see the draw, which is how he spots a runaway')
if (rook.air !== null) problems.push('Rook can see the air, so Vega is not the only one')
if (rook.stormEta !== null) problems.push('Rook can see the storm, which is Idris only')
if (rook.stormActive !== null) problems.push('Rook can see that the front landed')
if (rook.alarms.length) problems.push('Rook can read the log, which is Chen only')
if (rook.braced !== null) problems.push('Rook can see whether she is holding on')
if (rook.seal == null) problems.push('Rook holds no key, so he cannot send anything')
if (!(await hab.applyAction('engineer', { type: 'revoke', seat: 'pilot' }))) {
  problems.push('Rook was allowed to rotate a key from his console')
}

const idris = view('pilot')
if (idris.stormEta == null && idris.stormActive !== true) {
  problems.push('Idris cannot see the storm')
}
if (idris.power !== null) problems.push('Idris can see the reactor, which is Rook only')
if (idris.draw !== null) problems.push('Idris can see the draw, which is Rook only')
if (idris.air !== null) problems.push('Idris can see the air')
if (idris.alarms.length) problems.push('Idris can read the log')
if (idris.braced !== null) problems.push('Idris can see whether she is holding on')
if (idris.seal && rook.seal && idris.seal.key === rook.seal.key) {
  problems.push('two consoles were issued the same key, so neither vouches for anything')
}
if (!(await hab.applyAction('pilot', { type: 'revoke', seat: 'engineer' }))) {
  problems.push('Idris was allowed to rotate a key from his console')
}

const chen = view('sparks')
if (!chen.alarms.length) problems.push('Chen cannot read the alarm log')
if (chen.air !== null) problems.push('Chen can see the air')
if (chen.power !== null) problems.push('Chen can see the reactor')
if (chen.draw !== null) problems.push('Chen can see the draw')
if (chen.stormEta !== null) problems.push('Chen can see the storm clock')
if (chen.stormActive !== null) problems.push('Chen can see that the front landed')
if (chen.braced !== null) problems.push('Chen can see whether she is holding on')
if (!chen.seal) problems.push('Chen holds no key, so she cannot send a rotate card')
if (chen.alarms.some((line) => /FRONT|RUNAWAY|SIGNAL|ACK|INBOUND|IMPACT|BRACE/i.test(line))) {
  problems.push(`Chen's log is saying someone else's job: ${chen.alarms.join(' / ')}`)
}

// Where she is standing is hers. A crew that could see it would stop asking her,
// and the walk would stop being something the table has to talk about.
for (const [name, crewView] of [['Rook', rook], ['Idris', idris], ['Chen', chen]] as const) {
  if (crewView.hab !== null) problems.push(`${name} can see where Vega is standing`)
}

// Not just the seal field: no crew key may appear anywhere in what she or the
// room receives, under any name.
const crewKeys = [rook, idris, chen].flatMap((c) => (c.seal ? [c.seal.key] : []))
const board = view('board')
for (const [who, sent] of [['Vega', v], ['the board', board]] as const) {
  const text = JSON.stringify(sent)
  if (crewKeys.some((k) => text.includes(k))) problems.push(`${who}'s view carries a crew signing key`)
}

// --- the big screen ---
if (!board.spectator) problems.push('the board has no spectator view')
else {
  if (!board.spectator.operator?.at) problems.push('the board cannot show where the operator is')
  if (!Array.isArray(board.spectator.traffic)) problems.push('the board cannot show what hit her glass')
}
if (board.seal !== null) problems.push('the board was issued a signing key, and it sits in the middle of the room')

// The ship talking must never carry the answer. If it names the valve, the
// pump, the shields or the countdown, the table can stop talking.
const spoiled = spoken.filter((line) =>
  /port|starboard|pump|shield|brace|valve|runaway|overpressure|t-\d/i.test(line),
)
for (const line of spoiled) problems.push(`ship said the answer out loud: "${line}"`)

// --- signals are welded to one console ---
if (!(await hab.applyAction('vega', { type: 'signal', signal: 'brace', seq: 1, tag: 'x' }))) {
  problems.push('Vega was allowed to signal herself')
}

// An order nobody signed must never reach the glass, however well-formed it is.
if (!(await hab.applyAction('sparks', { type: 'signal', signal: 'seal-port', seq: 1, tag: 'deadbeef' }))) {
  problems.push('an unsigned order was accepted from a real seat')
}

// A call one person sends must not show up on the other two pads.
const sent = await send(hab, 'sparks', 'seal-port')
if (sent) problems.push(`Chen could not send her own call: ${sent}`)
else {
  if (view('engineer').lastSignal !== null) {
    problems.push('Rook can see the call Chen just sent')
  }
  if (view('pilot').lastSignal !== null) {
    problems.push('Idris can see the call Chen just sent')
  }
  if (view('sparks').lastSignal !== 'seal-port') {
    problems.push('Chen cannot see the call she just sent')
  }
}

// Rotation is physical: only Vega at the registry with the token. Crew send
// rotate cards; they do not press a registry button.
for (const other of CREW_IDS) {
  if (!(await hab.applyAction(other, { type: 'revoke', seat: 'engineer' }))) {
    problems.push(`${other} was allowed to rotate a key from their console`)
  }
}
// Wrong module / no token — refuse.
if (!(await hab.applyAction('vega', { type: 'revoke', seat: 'engineer' }))) {
  problems.push('Vega rotated a key without the token at Comms')
}
// Valves refuse outside the plant.
if (view('vega').hab?.at === 'plant') problems.push('Vega started in the plant, so the valve check below proves nothing')
if (!(await hab.applyAction('vega', { type: 'valve', valve: 'port', sealed: true }))) {
  problems.push('Vega sealed a valve from outside the Air Plant')
}

/** A fresh live round with only these seats taken, so no check inherits a cooldown. */
function launch(code: string, crew: readonly CrewId[], withBoard = false) {
  const h = new Hab(
    code,
    { id: 'vega', name: 'Vega', role: null, ready: false, connected: true, host: true, socketId: 's' },
    7,
  )
  h.claim('vega', 'vega')
  h.setReady('vega', true)
  for (const c of crew) seat(h, c)
  if (withBoard) seat(h, 'board')
  h.listener = { onView: () => {}, onSpeak: () => {} }
  const failed = h.start('vega')
  if (failed) throw new Error(failed)
  h.stopClock()
  const clock = h as unknown as { tick: (dt: number) => void }
  const tick = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds / 0.1); i++) clock.tick(0.1)
  }
  tick(0.1)
  return { h, tick }
}

// --- a console sends only the cards of the seats it covers ---
// The shared pad has a cooldown, so a refusal on a pad that just fired proves
// nothing. Each card gets its own round, and after the refusals the console that
// does cover it has to get the same card through. That is what makes the refusal
// about ownership rather than timing.
const SEATINGS: CrewId[][] = [
  [...CREW_IDS],
  ['engineer', 'pilot'],
  ['engineer', 'sparks'],
  ['pilot', 'sparks'],
  ['engineer'],
  ['pilot'],
  ['sparks'],
]
for (const crew of SEATINGS) {
  const table = crew.length === CREW_IDS.length ? 'full crew' : `${crew.join(' + ')} only`
  const probe = launch('COVER', crew).h
  const coverOf = new Map(crew.map((c) => [c, probe.viewFor(c)?.covers ?? null]))
  if (probe.viewFor('vega')?.covers !== null) problems.push(`${table}: Vega was told which seats she covers`)
  for (const c of crew) {
    const covers = coverOf.get(c)
    if (!covers?.includes(c)) problems.push(`${table}: ${c} does not cover its own seat (${JSON.stringify(covers)})`)
    // On a full table, a console covering a second seat is a second pair of eyes
    // on somebody else's instrument.
    if (crew.length === CREW_IDS.length && covers && covers.length !== 1) {
      problems.push(`full crew: ${c} covers ${covers.join(', ')}`)
    }
  }
  for (const c of CREW_IDS) {
    if (!crew.some((s) => coverOf.get(s)?.includes(c))) {
      problems.push(`${table}: nobody covers ${c}, so its cards can never be sent`)
    }
  }

  for (const [signal, owner] of Object.entries(SIGNAL_OWNER) as [SignalId, CrewId][]) {
    const { h } = launch('COVER', crew)
    for (const other of crew) {
      if (coverOf.get(other)?.includes(owner)) continue
      // Correctly signed with this console's own key, the way its phone would.
      // Holding a valid key is not the same as owning the call.
      if (!(await send(h, other, signal))) {
        problems.push(`${table}: ${other} sent ${signal} without covering ${owner}`)
      }
      // Correctly signed with the owner's real key, relayed from a console that
      // does not cover it.
      const ownerSeal = crew.includes(owner) ? h.viewFor(owner)?.seal : null
      if (ownerSeal) {
        const tag = await sealOrder(ownerSeal.key, ownerSeal.roundId, owner, signal, ownerSeal.nextSeq)
        const relayed = await h.applyAction(other, { type: 'signal', signal, seq: ownerSeal.nextSeq, tag })
        if (!relayed) problems.push(`${table}: ${other} relayed ${owner}'s signed ${signal}`)
      }
    }
    const coverer = crew.find((c) => coverOf.get(c)?.includes(owner))
    if (coverer) {
      const refused = await send(h, coverer, signal)
      if (refused) problems.push(`${table}: ${coverer} covers ${owner} and still could not send ${signal}: ${refused}`)
    }
  }
}

// --- only her body moves, and only her hands hold the token ---
{
  const { h, tick } = launch('HANDS', CREW_IDS, true)
  const outsiders = [...CREW_IDS, 'board']
  const body = () => JSON.stringify(h.viewFor('vega')?.hab)
  const before = body()
  for (const who of outsiders) {
    if (!(await h.applyAction(who, { type: 'walk', to: 'comms' }))) problems.push(`${who} was allowed to walk the operator`)
    if (!(await h.applyAction(who, { type: 'token', take: true }))) problems.push(`${who} was allowed to pick up the token`)
  }
  if (body() !== before) problems.push(`somebody other than Vega moved her or the token: ${before} -> ${body()}`)

  // Her own hands have to work, or every refusal above is a feature that is off.
  // First empty-handed: at the registry without the token, which only the token
  // itself can refuse.
  const epochAtStart = h.viewFor('engineer')?.seal?.epoch
  const set = await h.applyAction('vega', { type: 'walk', to: 'comms' })
  if (set) problems.push(`Vega could not walk to comms: ${set}`)
  tick(HOP_SECONDS + 0.3)
  if (h.viewFor('vega')?.hab?.at !== 'comms') problems.push('Vega never reached comms, so the token check proves nothing')
  if (!(await h.applyAction('vega', { type: 'revoke', seat: 'engineer' }))) {
    problems.push('the registry rotated a key for an operator without the token')
  }

  // Then holding the token, but somewhere other than the registry.
  const back = await h.applyAction('vega', { type: 'walk', to: 'spine' })
  tick(HOP_SECONDS + 0.3)
  const took = back ?? (await h.applyAction('vega', { type: 'token', take: true }))
  if (took) problems.push(`Vega could not pick up the token on the spine: ${took}`)
  if (!(await h.applyAction('vega', { type: 'revoke', seat: 'engineer' }))) {
    problems.push('Vega rotated a key from the spine, away from the registry')
  }
  const walked = await h.applyAction('vega', { type: 'walk', to: 'comms' })
  if (walked) problems.push(`Vega could not carry the token to comms: ${walked}`)
  if (h.viewFor('vega')?.hab?.walkingTo === 'comms') {
    if (!(await h.applyAction('vega', { type: 'revoke', seat: 'engineer' }))) {
      problems.push('Vega rotated a key from the corridor')
    }
  }
  if (h.viewFor('engineer')?.seal?.epoch !== epochAtStart) problems.push('a key rotated before she stood at the registry with the token')
  tick(HOP_SECONDS + 0.3)
  const arrived = h.viewFor('vega')?.hab
  if (arrived?.at !== 'comms' || !arrived.holdingToken) {
    problems.push(`Vega did not reach comms with the token: ${JSON.stringify(arrived)}`)
  }

  // She is at the registry with the token in her hand, so where she stands is
  // not what refuses these.
  const epoch = h.viewFor('engineer')?.seal?.epoch
  for (const who of outsiders) {
    if (!(await h.applyAction(who, { type: 'revoke', seat: 'engineer' }))) {
      problems.push(`${who} rotated a key while she stood at the registry`)
    }
    if (!(await h.applyAction(who, { type: 'token', take: false }))) {
      problems.push(`${who} made her put the token down`)
    }
  }
  if (h.viewFor('engineer')?.seal?.epoch !== epoch) problems.push('a key rotated without Vega touching the registry')
  if (!h.viewFor('vega')?.hab?.holdingToken) problems.push('the token left her hand without her')

  const rotated = await h.applyAction('vega', { type: 'revoke', seat: 'engineer' })
  if (rotated) problems.push(`Vega at the registry holding the token could not rotate: ${rotated}`)
  else if (h.viewFor('engineer')?.seal?.epoch === epoch) problems.push('the registry took her rotation and the key stayed the same')

  // Leaving the plant, she is still recorded as in it until she arrives, so
  // only the corridor rule can refuse the pump she just walked away from.
  await h.applyAction('vega', { type: 'walk', to: 'spine' })
  tick(HOP_SECONDS + 0.3)
  await h.applyAction('vega', { type: 'walk', to: 'plant' })
  tick(HOP_SECONDS + 0.3)
  const pumpBefore = h.viewFor('vega')?.pumpOn
  const leaving = await h.applyAction('vega', { type: 'walk', to: 'spine' })
  if (h.viewFor('vega')?.hab?.at !== 'plant' || leaving) {
    problems.push(`Vega could not set off from the plant, so the corridor check proves nothing: ${leaving}`)
  } else if (!(await h.applyAction('vega', { type: 'pump', on: !pumpBefore }))) {
    problems.push('Vega worked the pump from the corridor')
  }
  if (h.phase !== 'play') problems.push('the hands round ended mid-check, so its refusals are vacuous')
}

// Same second, opposite orders. If these two ever agree the fight is dead.
{
  const { h: fight, tick } = launch('FIGHT', CREW_IDS)
  tick(26.9)
  const vegaYell = fight.viewFor('vega')?.order?.text ?? ''
  const rookYell = fight.viewFor('engineer')?.order?.text ?? ''
  if (!/ABSOLUTELY NOT|KEEP THE PUMP|LOOKS FINE|AIR IS MINE/i.test(vegaYell)) {
    problems.push(`Vega was not told to defend the pump during the runaway: "${vegaYell}"`)
  }
  if (!/TURN OFF THE PUMP|KILL THE PUMP/i.test(rookYell)) {
    problems.push(`Rook was not told to kill the pump during the runaway: "${rookYell}"`)
  }
}

if (problems.length) {
  console.log('ASYMMETRY BROKEN:')
  for (const p of problems) console.log('  -', p)
  process.exit(1)
}
console.log(`ship spoke ${spoken.length} times, none of it to Vega`)
console.log('asymmetry OK: she has the air and the controls, and nothing else')
