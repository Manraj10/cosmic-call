import { io, type Socket } from 'socket.io-client'
import { sealOrder } from '@shared/seal'
import type { ClientAction, ClientView, CrewId, SealView, SignalId, StationId } from '@shared/types'

const override = import.meta.env.VITE_SOCKET_URL

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const opts = {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      // Venue networks that break websockets should fall back to polling, not hang.
      tryAllTransports: true,
    }
    socket = override ? io(override, opts) : io(opts)
  }
  return socket
}

/**
 * sessionStorage throws outright in some private-browsing modes rather than
 * returning null. Every path into the game touches it, so an unguarded call
 * would stop those phones joining at all. Losing persistence is fine; losing
 * the player is not.
 */
const store = {
  get(k: string): string | null {
    try {
      return sessionStorage.getItem(k)
    } catch {
      return null
    }
  },
  set(k: string, v: string) {
    try {
      sessionStorage.setItem(k, v)
    } catch {
      // Private mode: this phone simply won't survive a refresh.
    }
  },
  remove(k: string) {
    try {
      sessionStorage.removeItem(k)
    } catch {
      // Nothing was stored.
    }
  },
}

/** Id kept for the whole session when storage fails, so one tab stays one player. */
let volatileId: string | null = null

export function playerKey(): string {
  const existing = store.get('cosmic-call.pid') ?? store.get('cosmiccall.pid') ?? volatileId
  if (existing) return existing
  // `randomUUID` is secure-context-only, exactly like `crypto.subtle`. Phones
  // join at http://192.168.x.x, which is not one, so on every real player
  // device this is undefined and the unguarded call throws on the only two
  // paths into the game. `getRandomValues` is not gated — shared/seal.ts
  // already depends on that.
  const id =
    crypto.randomUUID?.() ??
    [...crypto.getRandomValues(new Uint8Array(16))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  volatileId = id
  store.set('cosmic-call.pid', id)
  return id
}

export async function createHab(name: string) {
  const result = await ack<{ playerId: string; view: ClientView }>('create', { name, playerId: playerKey() })
  rememberHab(result.view)
  return result
}

export async function joinHab(code: string, name: string) {
  const result = await ack<{ playerId: string; view: ClientView }>('join', {
    code,
    name,
    playerId: playerKey(),
  })
  rememberHab(result.view)
  return result
}

function rememberHab(view: ClientView) {
  store.set('cosmic-call.hab', JSON.stringify({ code: view.code, name: view.you.name }))
}

export function forgetHab() {
  store.remove('cosmic-call.hab')
}

/**
 * The hab this phone was in no longer exists. Only this should send a player
 * back to the home screen; a timeout or a dropped socket is weather, not an
 * answer, and the next reconnect should try again with the same room.
 */
export class HabGone extends Error {}

/** Rejoin with the existing player ID after a refresh or a dropped radio link. */
export async function restoreHab(): Promise<ClientView | null> {
  let saved: { code?: unknown; name?: unknown }
  try {
    saved = JSON.parse(store.get('cosmic-call.hab') ?? 'null')
  } catch {
    store.remove('cosmic-call.hab')
    return null
  }
  if (!saved || typeof saved.code !== 'string' || !/^[A-Z]{4}$/.test(saved.code) || typeof saved.name !== 'string') return null
  const invitation = new URLSearchParams(location.search).get('hab')?.toUpperCase()
  if (invitation && invitation !== saved.code) return null
  try {
    return (await joinHab(saved.code, saved.name)).view
  } catch (error) {
    // The server answers these only when the room itself is unusable to us.
    // Anything else — the 8s timeout, "Radio offline" — keeps the room saved.
    if (error instanceof Error && /no hab with that code|already started/i.test(error.message)) {
      store.remove('cosmic-call.hab')
      throw new HabGone(error.message)
    }
    throw error
  }
}

export function claim(role: StationId | null) {
  return ack('claim', role)
}

export function setReady(ready: boolean) {
  return ack('ready', ready)
}

export function startGame() {
  return ack('start')
}

export function sendAction(action: ClientAction) {
  return ack('action', action)
}

/**
 * Sign an order on this phone, then send it.
 *
 * The tag is computed here rather than on the server because that is the whole
 * premise: the hab believes an order because it carries this console's key, not
 * because a socket claimed a seat. GHOST is on the same socket transport and
 * cannot produce one of these.
 */
export async function sendSignal(seal: SealView, seat: CrewId, signal: SignalId) {
  const tag = await sealOrder(seal.key, seal.roundId, seat, signal, seal.nextSeq)
  return sendAction({ type: 'signal', signal, seq: seal.nextSeq, tag })
}

function ack<T = { ok: boolean }>(event: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const connection = getSocket()
    // Never replay a stale control press when Wi-Fi comes back.
    if (!connection.connected) return reject(new Error('Radio offline. Wait for reconnection, then try again.'))
    connection.timeout(8000).emit(event, ...args, (error: Error | null, res: T & { ok?: boolean; error?: string }) => {
      if (error) reject(new Error('The hab did not respond. Check the connection and try again.'))
      else if (!res || res.ok === false) reject(new Error(res?.error || 'The hab could not complete that action.'))
      else resolve(res)
    })
  })
}
