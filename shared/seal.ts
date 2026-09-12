/**
 * Every order that reaches the operator's glass is signed by the console that
 * sent it.
 *
 * HMAC-SHA256 over a canonical order line, using a per-seat key issued at
 * launch. This is a symmetric, server-issued secret — the same shape as an
 * HS256 token, not end-to-end secrecy. The property it buys is the one the
 * game is about: the hab can tell an order a crew member actually pressed from
 * one GHOST wrote on the bus.
 *
 * The badge the operator reads is the first four hex characters. Verification
 * always uses the full 256-bit tag — truncation is for her eyes, never for the
 * check.
 *
 * ## Why there are two implementations
 *
 * `crypto.subtle` only exists in a secure context. Phones join this game by
 * pointing a camera at `http://192.168.x.x:43127` on venue Wi-Fi, which is not
 * one, so on every actual player device `crypto.subtle` is `undefined`. Serving
 * HTTPS would mean a certificate warning between a judge and the game.
 *
 * So: use the platform primitive when it is there (the server always has it),
 * and fall back to the SHA-256 below when it is not. `npm run crypto` asserts
 * the two produce byte-identical tags, because a phone signing differently from
 * the server would not fail loudly — it would look like GHOST.
 */

export type SealState =
  /** Signature verified and the counter moved forward. Safe to obey. */
  | 'sealed'
  /** Signature did not verify. Somebody wrote this who does not hold the key. */
  | 'broken'
  /** Signature verified but the counter has already been used. A replay. */
  | 'stale'

/** How much of the tag the operator actually sees. Display only. */
export const TAG_CHARS = 4

const enc = new TextEncoder()

/**
 * The bytes that get signed. Round id pins a tag to one mission, seat pins it
 * to one console, and seq is the monotonic counter that makes a replay
 * detectable. Change this and every tag in flight stops verifying, which is
 * exactly what a key rotation is supposed to do.
 */
export function orderLine(
  roundId: string,
  seat: string,
  signal: string,
  seq: number,
): string {
  return `${roundId}|${seat}|${signal}|${seq}`
}

function hex(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += b.toString(16).padStart(2, '0')
  return s
}

// --- SHA-256, because half our clients are not a secure context -------------

const K = /* @__PURE__ */ new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))

/** Textbook FIPS 180-4. Kept deliberately boring; `npm run crypto` checks it. */
function sha256(msg: Uint8Array): Uint8Array {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])
  const bitLen = msg.length * 8
  // One 0x80 byte, zero padding to 56 mod 64, then a 64-bit big-endian length.
  const padded = new Uint8Array(((msg.length + 9 + 63) >> 6) << 6)
  padded.set(msg)
  padded[msg.length] = 0x80
  const dv = new DataView(padded.buffer)
  dv.setUint32(padded.length - 4, bitLen >>> 0, false)
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false)

  const w = new Uint32Array(64)
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3)
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10)
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, hh] = [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!]
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (hh + S1 + ch + K[i]! + w[i]!) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      hh = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    h[0] = (h[0]! + a) >>> 0
    h[1] = (h[1]! + b) >>> 0
    h[2] = (h[2]! + c) >>> 0
    h[3] = (h[3]! + d) >>> 0
    h[4] = (h[4]! + e) >>> 0
    h[5] = (h[5]! + f) >>> 0
    h[6] = (h[6]! + g) >>> 0
    h[7] = (h[7]! + hh) >>> 0
  }
  const out = new Uint8Array(32)
  const odv = new DataView(out.buffer)
  for (let i = 0; i < 8; i++) odv.setUint32(i * 4, h[i]!, false)
  return out
}

const BLOCK = 64

/** HMAC as in RFC 2104: opad/ipad around the block-sized key. */
function hmacSha256Js(key: Uint8Array, msg: Uint8Array): Uint8Array {
  let k = key.length > BLOCK ? sha256(key) : key
  const block = new Uint8Array(BLOCK)
  block.set(k)
  const ipad = new Uint8Array(BLOCK)
  const opad = new Uint8Array(BLOCK)
  for (let i = 0; i < BLOCK; i++) {
    ipad[i] = block[i]! ^ 0x36
    opad[i] = block[i]! ^ 0x5c
  }
  const inner = sha256(concat(ipad, msg))
  return sha256(concat(opad, inner))
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}

// --- the one function everything else calls ---------------------------------

/** True when the platform gives us the real thing. False on a phone over http. */
export function hasWebCrypto(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle?.importKey === 'function'
}

/**
 * This module is compiled twice — once for the browser (lib DOM) and once for
 * the server (lib ES2023, no DOM) — and the two libs disagree about the exact
 * buffer type WebCrypto accepts. Pinning the array to its own ArrayBuffer
 * satisfies both without pulling the DOM lib into a Node build.
 */
function pinned(u: Uint8Array): Uint8Array<ArrayBuffer> {
  return u as Uint8Array<ArrayBuffer>
}

async function hmacSubtle(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    'raw',
    pinned(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, pinned(msg)))
}

/** Exposed so the crypto harness can pin the two paths against each other. */
export async function hmacHex(keyRaw: string, message: string): Promise<string> {
  const key = enc.encode(keyRaw)
  const msg = enc.encode(message)
  const mac = hasWebCrypto() ? await hmacSubtle(key, msg) : hmacSha256Js(key, msg)
  return hex(mac)
}

/** The pure-JS path on its own, for the harness. Never branch on this in game code. */
export function hmacHexJs(keyRaw: string, message: string): string {
  return hex(hmacSha256Js(enc.encode(keyRaw), enc.encode(message)))
}

/** Sign an order. Runs on the crew phone; the key never leaves that console. */
export async function sealOrder(
  keyRaw: string,
  roundId: string,
  seat: string,
  signal: string,
  seq: number,
): Promise<string> {
  return hmacHex(keyRaw, orderLine(roundId, seat, signal, seq))
}

/**
 * Compare without leaking where the mismatch was. Overkill for a party game on
 * a LAN, and still the right way to write it — a timing-variable compare is
 * the bug this whole mechanic is about.
 */
export function tagsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** The four characters the operator reads off the card. */
export function shortTag(tag: string): string {
  return tag.slice(0, TAG_CHARS).toUpperCase()
}

/**
 * A fresh per-seat secret. Issued at launch and again on every revocation.
 * `getRandomValues` is on Crypto rather than SubtleCrypto, so unlike signing it
 * is available on a phone over plain http.
 */
export function mintKey(): string {
  const b = new Uint8Array(32)
  crypto.getRandomValues(b)
  return hex(b)
}
