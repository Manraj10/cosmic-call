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

for (const [signal, owner] of Object.entries(SIGNAL_OWNER) as [SignalId, (typeof CREW_IDS)[number]][]) {
  for (const other of CREW_IDS) {
    if (other === owner) continue
    // Correctly signed by the wrong console. Holding a valid key is not the
    // same as owning the call, and the server has to enforce both.
    const stolen = await send(hab, other, signal)
    if (!stolen) problems.push(`${other} was allowed to send ${signal}`)
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
if (!(await hab.applyAction('vega', { type: 'valve', valve: 'port', sealed: true }))) {
  problems.push('Vega sealed a valve from outside the Air Plant')
}

// Same second, opposite orders. If these two ever agree the fight is dead.
{
  const fight = new Hab(
    'FIGHT',
    { id: 'vega', name: 'Vega', role: null, ready: false, connected: true, host: true, socketId: 's' },
    7,
  )
  fight.claim('vega', 'vega')
  fight.setReady('vega', true)
  for (const c of CREW_IDS) seat(fight, c)
  fight.listener = { onView: () => {}, onSpeak: () => {} }
  fight.start('vega')
  const clock = fight as unknown as { tick: (dt: number) => void }
  for (let i = 0; i < 270; i++) clock.tick(0.1)
  fight.stopClock()
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
