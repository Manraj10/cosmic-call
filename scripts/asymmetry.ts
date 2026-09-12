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
import { CREW_IDS, ROLE_IDS, hearsSpeech } from '../shared/types.ts'
import { Hab } from '../server/game.ts'
import type { ClientView, StationId } from '../shared/types.ts'

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
  ['power', v.power],
  ['signalCooldownMs', v.signalCooldownMs],
  ['lastSignal', v.lastSignal],
  ['ackAgeMs', v.ackAgeMs],
]
for (const [field, value] of hiddenFromVega) {
  if (value !== null) problems.push(`Vega can see ${field} (${JSON.stringify(value)})`)
}
if (v.alarms.length) problems.push('Vega can read the alarm log')
if (v.air == null) problems.push('Vega cannot see the air, which is the one thing she needs')

// --- and what each crew member is allowed to know ---
const rook = view('engineer')
if (rook.power == null) problems.push('Rook cannot see the reactor')
if (rook.air !== null) problems.push('Rook can see the air, so Vega is not the only one')
if (rook.stormEta !== null) problems.push('Rook can see the storm, which is Idris only')
if (rook.alarms.length) problems.push('Rook can read the log, which is Chen only')

const idris = view('pilot')
if (idris.stormEta == null) problems.push('Idris cannot see the storm')
if (idris.power !== null) problems.push('Idris can see the reactor, which is Rook only')
if (idris.air !== null) problems.push('Idris can see the air')

const chen = view('sparks')
if (!chen.alarms.length) problems.push('Chen cannot read the alarm log')
if (chen.air !== null) problems.push('Chen can see the air')
if (chen.power !== null) problems.push('Chen can see the reactor')

// --- signals are welded to one console ---
for (const owner of CREW_IDS) {
  for (const other of CREW_IDS) {
    if (owner === other) continue
    const stolen = hab.applyAction(other, { type: 'signal', signal: 'pump-off' })
    if (owner === 'engineer' && other !== 'engineer' && !stolen) {
      problems.push(`${other} was allowed to send a call that belongs to ${owner}`)
    }
  }
}
if (!hab.applyAction('vega', { type: 'signal', signal: 'brace' })) {
  problems.push('Vega was allowed to signal herself')
}

if (problems.length) {
  console.log('ASYMMETRY BROKEN:')
  for (const p of problems) console.log('  -', p)
  process.exit(1)
}
console.log(`ship spoke ${spoken.length} times, none of it to Vega`)
console.log('asymmetry OK: she has the air and the controls, and nothing else')
