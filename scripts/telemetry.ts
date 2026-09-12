/** npx tsx --tsconfig tsconfig.app.json scripts/telemetry.ts */
import assert from 'node:assert/strict'
import { operatorPosition } from '../src/components/MissionHabitat.tsx'
import type { HabView } from '../shared/types.ts'

const hab: HabView = { at: 'plant', walkingTo: 'comms', arriveInMs: 2800, holdingToken: false, tokenAt: 'spine' }
assert.deepEqual(operatorPosition(hab), [440, 150])
assert.deepEqual(operatorPosition({ ...hab, arriveInMs: 1400 }), [440, 340], 'Two-hop travel must pass through the spine')
assert.deepEqual(operatorPosition({ ...hab, arriveInMs: 0 }), [700, 340])
assert.deepEqual(operatorPosition({ ...hab, arriveInMs: -100 }), [700, 340], 'Late packet must not overshoot')
assert.deepEqual(operatorPosition({ ...hab, arriveInMs: 3000 }), [440, 150], 'Early packet must not walk backwards')
assert.deepEqual(operatorPosition({ ...hab, walkingTo: null }), [440, 150])
assert.deepEqual(operatorPosition({ ...hab, walkingTo: 'plant' }), [440, 150])
console.log('PASS: spectator position follows the habitat route and clamps network timing edges')
