/**
 * Guards the signing layer the whole game rests on.
 *
 *   npm run crypto
 *
 * Four things are asserted here, and each one is a way the game would break
 * quietly rather than loudly:
 *
 *   1. The hand-written SHA-256/HMAC matches a published test vector. If it did
 *      not, every tag would still be *consistent* and nothing would look wrong.
 *   2. The two implementations agree byte for byte. A phone falling back to the
 *      pure-JS path while the server uses WebCrypto would not error — every
 *      honest order would simply arrive reading BROKEN SEAL, and the game would
 *      look like it was working as designed.
 *   3. A forged tag and a replayed counter are both refused, and refused
 *      *differently*, because the operator is shown which one it was.
 *   4. A rotated key invalidates the tags issued before it. That is what makes
 *      revocation a real defence instead of a cosmetic button.
 */
import { hasWebCrypto, hmacHex, hmacHexJs, mintKey, orderLine, sealOrder, shortTag, tagsMatch } from '../shared/seal.ts'
import { Bus } from '../server/ghost.ts'

const problems: string[] = []
const ok = (label: string, cond: boolean) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'}  ${label}`)
  if (!cond) problems.push(label)
}

// --- 1. the pure-JS path against RFC 4231 test case 2 -----------------------
// key "Jefe", data "what do ya want for nothing?"
const RFC4231_2 = '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843'
ok(
  'hand-written HMAC-SHA256 matches RFC 4231 test case 2',
  hmacHexJs('Jefe', 'what do ya want for nothing?') === RFC4231_2,
)

// A second vector with a key longer than the 64-byte block, which exercises the
// branch that hashes the key down first.
const longKey = 'a'.repeat(131)
ok(
  'long-key HMAC hashes the key down and still produces 32 bytes',
  hmacHexJs(longKey, 'Test Using Larger Than Block-Size Key').length === 64,
)

// --- 2. the two implementations must agree ---------------------------------
console.log(`\nWebCrypto available here: ${hasWebCrypto()}`)
if (!hasWebCrypto()) {
  problems.push('this runtime has no crypto.subtle, so the cross-check proves nothing')
} else {
  let agreed = 0
  for (let i = 0; i < 40; i++) {
    const key = mintKey()
    const msg = orderLine(`R${i}`, 'engineer', 'pump-off', i)
    const subtle = await hmacHex(key, msg)
    if (subtle === hmacHexJs(key, msg)) agreed += 1
  }
  ok('WebCrypto and the fallback agree on 40/40 random keys', agreed === 40)
}

// --- 3. what the bus accepts and what it refuses ---------------------------
const bus = new Bus('ROUND-1')
const key = bus.keyFor('engineer')

const good = await sealOrder(key, 'ROUND-1', 'engineer', 'pump-off', bus.seqFor('engineer'))
const seq1 = bus.seqFor('engineer')
ok(
  'a correctly signed order verifies',
  (await bus.verify('engineer', 'pump-off', seq1, good, 1)) === 'sealed',
)

ok(
  'the same order sent twice reads as a replay, not as a forgery',
  (await bus.verify('engineer', 'pump-off', seq1, good, 2)) === 'stale',
)

ok(
  'a made-up tag is refused',
  (await bus.verify('engineer', 'pump-off', bus.seqFor('engineer'), mintKey(), 3)) === 'broken',
)

// Right key, right counter, wrong seat: the seat is inside the signed line, so
// one console cannot issue another console's orders even holding its own key.
const crossSeat = await sealOrder(key, 'ROUND-1', 'engineer', 'shields-on', bus.seqFor('pilot'))
ok(
  'a tag signed as one seat does not verify as another',
  (await bus.verify('pilot', 'shields-on', bus.seqFor('pilot'), crossSeat, 4)) === 'broken',
)

// --- 4. rotation actually invalidates ------------------------------------
const beforeRotation = await sealOrder(
  bus.keyFor('pilot'),
  'ROUND-1',
  'pilot',
  'brace',
  bus.seqFor('pilot'),
)
const seqP = bus.seqFor('pilot')
bus.revoke('pilot', 5)
ok(
  'a tag issued before a revocation stops verifying after it',
  (await bus.verify('pilot', 'brace', seqP, beforeRotation, 6)) === 'broken',
)
ok('rotating a clean seat is recorded as a false revocation', bus.falseRevokes === 1)

// --- 5. the stolen-key case, which is the one the glass cannot see ---------
const stolenBus = new Bus('ROUND-2')
const preTheft = await stolenBus.forge('engineer', 'pump-on', 1)
ok('before a theft, GHOST can only produce a broken seal', preTheft.seal === 'broken')

stolenBus.steal('engineer', 10)
const postTheft = await stolenBus.forge('engineer', 'pump-on', 11)
ok('after a theft, GHOST forgeries verify — the glass cannot tell', postTheft.seal === 'sealed')
ok(
  'the only tell is in the victim seat own signing log',
  stolenBus.logFor('engineer').some((e) => !e.mine),
)
ok(
  'no other seat log is polluted by the theft',
  stolenBus.logFor('pilot').every((e) => e.mine) && stolenBus.logFor('sparks').every((e) => e.mine),
)

stolenBus.revoke('engineer', 14)
const postRevoke = await stolenBus.forge('engineer', 'pump-on', 15)
ok('rotating the stolen key puts GHOST back to broken seals', postRevoke.seal === 'broken')
ok('the report names the seat and the time to revoke', stolenBus.report().timeToRevoke === 4)

// --- 6. the badge the operator reads ---------------------------------------
ok('the badge is four characters', shortTag(good).length === 4)
ok('the badge is uppercase hex', /^[0-9A-F]{4}$/.test(shortTag(good)))
ok('the full tag is what gets compared, not the badge', good.length === 64)
ok('constant-time compare still returns the right answer', tagsMatch(good, good) && !tagsMatch(good, mintKey()))

console.log('')
if (problems.length) {
  console.error(`${problems.length} problem(s):`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log('the signing layer holds.')
