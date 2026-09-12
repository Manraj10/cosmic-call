/** Regression: a second mission must start as clean as the first. npx tsx scripts/rematch.ts */
import assert from 'node:assert/strict'
import { Hab } from '../server/game.ts'
import { sealOrder } from '../shared/seal.ts'
import { ROLE_IDS, type ClientView } from '../shared/types.ts'

const hab = new Hab('TEST', { id: 'board', name: 'Monitor', role: 'board', ready: true, connected: true, host: true, socketId: 'board' }, 7)
for (const role of ROLE_IDS) {
  hab.addPlayer({ id: role, name: role, role, ready: true, connected: true, host: false, socketId: role })
}
const clock = hab as unknown as { tick: (dt: number) => void }
const view = (id: string) => hab.viewFor(id) as ClientView
const fields = ['timeLeft', 'air', 'airBand', 'valves', 'leakLights', 'pumpOn', 'shieldsOn', 'braced', 'hab', 'signals', 'power', 'draw', 'stormEta', 'stormActive', 'signalCooldownMs', 'lastSignal', 'ackAgeMs', 'order', 'gripe', 'outcome', 'loseReason', 'spectator'] as const
const snapshot = () => Object.fromEntries(['board', ...ROLE_IDS].map((id) => [id, Object.fromEntries(fields.map((field) => [field, view(id)[field]]))]))

try {
  assert.equal(hab.start('board'), null)
  hab.stopClock()
  clock.tick(0.1)
  const clean = structuredClone(snapshot())
  const seal = view('engineer').seal!
  assert.equal(await hab.applyAction('engineer', { type: 'signal', signal: 'pump-off', seq: seal.nextSeq, tag: await sealOrder(seal.key, seal.roundId, 'engineer', 'pump-off', seal.nextSeq) }), null)
  assert.equal(await hab.applyAction('vega', { type: 'token', take: true }), null)
  assert.equal(await hab.applyAction('vega', { type: 'walk', to: 'plant' }), null)
  for (let i = 0; i < 16; i++) clock.tick(0.1)
  assert.equal(await hab.applyAction('vega', { type: 'pump', on: false }), null)
  assert.equal(await hab.applyAction('vega', { type: 'valve', valve: 'port', sealed: true }), null)
  for (let i = 0; i < 1000 && hab.phase === 'play'; i++) clock.tick(0.1)
  assert.equal(hab.phase, 'end')
  assert.notEqual(await hab.applyAction('vega', { type: 'rematch' }), null)
  assert.equal(await hab.applyAction('board', { type: 'rematch' }), null)
  assert.equal(hab.phase, 'lobby')
  for (const role of ROLE_IDS) {
    assert.equal(view(role).you.role, role)
    assert.equal(view(role).you.ready, false)
    hab.setReady(role, true)
  }
  assert.equal(hab.start('board'), null)
  hab.stopClock()
  clock.tick(0.1)
  assert.deepEqual(snapshot(), clean, 'Old hazards, valves, cooldowns or ACKs survived rematch')
  console.log('PASS: rematch keeps the crew and fully resets the habitat, controls, radio and hazards')
} finally {
  hab.stopClock()
}
