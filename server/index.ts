import cors from 'cors'
import express from 'express'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import type { ClientAction, StationId } from '../shared/types.ts'
import { Hab, makeCode } from './game.ts'
import type { SpeakPacket } from './game.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const app = express()
app.use(cors())
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: true },
  path: '/socket.io',
})

const habs = new Map<string, Hab>()

function habByPlayer(playerId: string): Hab | undefined {
  for (const hab of habs.values()) {
    if (hab.players.has(playerId)) return hab
  }
  return undefined
}

function bind(hab: Hab) {
  hab.listener = {
    onView: () => {
      for (const p of hab.players.values()) {
        if (!p.socketId) continue
        const view = hab.viewFor(p.id)
        if (view) io.to(p.socketId).emit('view', view)
      }
    },
    onSpeak: (packet: SpeakPacket) => {
      for (const p of hab.players.values()) {
        if (!p.socketId) continue
        if (packet.to === 'power' && p.role === 'power') {
          io.to(p.socketId).emit('speak', packet)
        }
        if (packet.to === 'hearing' && p.role && p.role !== 'oxygen') {
          io.to(p.socketId).emit('speak', packet)
        }
      }
    },
  }
}

io.on('connection', (socket) => {
  socket.on(
    'create',
    (payload: { name: string; playerId?: string }, cb?: (res: unknown) => void) => {
      const name = sanitizeName(payload?.name)
      const playerId = payload?.playerId || crypto.randomUUID()
      let code = makeCode()
      while (habs.has(code)) code = makeCode()
      const hab = new Hab(code, {
        id: playerId,
        name,
        role: null,
        ready: false,
        connected: true,
        host: true,
        socketId: socket.id,
      })
      bind(hab)
      habs.set(code, hab)
      socket.data.playerId = playerId
      socket.data.code = code
      socket.join(code)
      cb?.({ ok: true, playerId, view: hab.viewFor(playerId) })
    },
  )

  socket.on(
    'join',
    (
      payload: { code: string; name: string; playerId?: string },
      cb?: (res: unknown) => void,
    ) => {
      const code = (payload?.code || '').toUpperCase().trim()
      const hab = habs.get(code)
      if (!hab) {
        cb?.({ ok: false, error: 'No hab with that code' })
        return
      }
      const name = sanitizeName(payload?.name)
      const playerId = payload?.playerId || crypto.randomUUID()
      const existing = hab.players.get(playerId)
      if (existing) {
        hab.setSocket(playerId, socket.id, true)
      } else {
        if (hab.phase !== 'lobby') {
          cb?.({ ok: false, error: 'Mission already underway' })
          return
        }
        hab.addPlayer({
          id: playerId,
          name,
          role: null,
          ready: false,
          connected: true,
          host: false,
          socketId: socket.id,
        })
      }
      socket.data.playerId = playerId
      socket.data.code = code
      socket.join(code)
      cb?.({ ok: true, playerId, view: hab.viewFor(playerId) })
    },
  )

  socket.on('claim', (role: StationId | null, cb?: (res: unknown) => void) => {
    const hab = habByPlayer(socket.data.playerId)
    if (!hab) return cb?.({ ok: false, error: 'No hab' })
    const err = hab.claim(socket.data.playerId, role)
    cb?.(err ? { ok: false, error: err } : { ok: true })
  })

  socket.on('ready', (ready: boolean, cb?: (res: unknown) => void) => {
    const hab = habByPlayer(socket.data.playerId)
    if (!hab) return cb?.({ ok: false, error: 'No hab' })
    const err = hab.setReady(socket.data.playerId, ready)
    cb?.(err ? { ok: false, error: err } : { ok: true })
  })

  socket.on('start', (cb?: (res: unknown) => void) => {
    const hab = habByPlayer(socket.data.playerId)
    if (!hab) return cb?.({ ok: false, error: 'No hab' })
    const err = hab.start(socket.data.playerId)
    cb?.(err ? { ok: false, error: err } : { ok: true })
  })

  socket.on('action', (action: ClientAction, cb?: (res: unknown) => void) => {
    const hab = habByPlayer(socket.data.playerId)
    if (!hab) return cb?.({ ok: false, error: 'No hab' })
    const err = hab.applyAction(socket.data.playerId, action)
    cb?.(err ? { ok: false, error: err } : { ok: true })
  })

  socket.on('scan', () => {
    const hab = habByPlayer(socket.data.playerId)
    const p = hab?.players.get(socket.data.playerId)
    if (hab && p?.role === 'power') hab.scanPower()
  })

  socket.on('disconnect', () => {
    const hab = habByPlayer(socket.data.playerId)
    if (!hab) return
    hab.setSocket(socket.data.playerId, null, false)
    setTimeout(() => {
      if (hab.removeIfEmpty()) {
        hab.stopClock()
        habs.delete(hab.code)
      }
    }, 30_000)
  })
})

function sanitizeName(name: unknown): string {
  const s = String(name ?? '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .slice(0, 16)
  return s || 'Crew'
}

const dist = path.join(root, 'dist')
app.use(express.static(dist))
app.get('/{*splat}', (_req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.join(dist, 'index.html'))
    return
  }
  next()
})

const port = Number(process.env.PORT || 43128)
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`HAB bus on :${port}`)
})
