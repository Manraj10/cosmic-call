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
    }
    socket = override ? io(override, opts) : io(opts)
  }
  return socket
}

export function playerKey(): string {
  const existing = sessionStorage.getItem('cosmic-call.pid') ?? sessionStorage.getItem('cosmiccall.pid')
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
  sessionStorage.setItem('cosmic-call.pid', id)
  return id
}

export function createHab(name: string) {
  return ack<{ playerId: string; view: ClientView }>('create', { name, playerId: playerKey() })
}

export function joinHab(code: string, name: string) {
  return ack<{ playerId: string; view: ClientView }>('join', {
    code,
    name,
    playerId: playerKey(),
  })
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

export function revokeKey(seat: CrewId) {
  return sendAction({ type: 'revoke', seat })
}

function ack<T = { ok: boolean }>(event: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    getSocket().emit(event, ...args, (res: T & { ok?: boolean; error?: string }) => {
      if (res && res.ok === false) reject(new Error(res.error || 'failed'))
      else resolve(res)
    })
  })
}
