import { io, type Socket } from 'socket.io-client'
import type { ClientAction, ClientView, StationId } from '@shared/types'

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
  const existing = sessionStorage.getItem('crosstalk.pid')
  if (existing) return existing
  const id = crypto.randomUUID()
  sessionStorage.setItem('crosstalk.pid', id)
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

function ack<T = { ok: boolean }>(event: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    getSocket().emit(event, ...args, (res: T & { ok?: boolean; error?: string }) => {
      if (res && res.ok === false) reject(new Error(res.error || 'failed'))
      else resolve(res)
    })
  })
}
