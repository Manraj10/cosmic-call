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
const io = new Server(httpServer, { cors: { origin: true }, path: '/socket.io' })

const habs = new Map<string, Hab>()

/**
 * A connection is bound to exactly one hab. Resolving by socket rather than by
 * searching every hab for the player id matters because a player id outlives a
 * hab: it is kept in sessionStorage, so refreshing and opening a new hab used to
 * leave the old membership in place, and every later action was silently routed
 * to whichever hab happened to come first in the map.
 */
function habForSocket(socket: { data: { playerId?: string; code?: string } }): Hab | undefined {
  const { code, playerId } = socket.data
  if (code) {
    const hab = habs.get(code)
    if (hab && playerId && hab.players.has(playerId)) return hab
  }
  if (!playerId) return undefined
  for (const hab of habs.values()) {
    if (hab.players.has(playerId)) return hab
  }
  return undefined
}

/** Drop a stale membership so one player id is never live in two habs at once. */
function leaveOtherHabs(playerId: string, keepCode: string) {
  for (const hab of [...habs.values()]) {
    if (hab.code === keepCode) continue
    if (!hab.removePlayer(playerId)) continue
    if (hab.playerCount === 0) {
      hab.stopClock()
      habs.delete(hab.code)
    }
  }
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
        // Vega never receives audio. That is the whole game.
        if (!p.socketId || p.role === 'vega' || !p.role) continue
        io.to(p.socketId).emit('speak', packet)
      }
    },
  }
}

/**
 * Server-side voice proxy. The xAI key stays on the host machine and is never
 * shipped to a phone. Without a key, clients fall back to browser speech.
 */
app.post('/api/voice', async (req, res) => {
  const key = process.env.XAI_API_KEY
  if (!key) {
    res.status(501).json({ error: 'no-key' })
    return
  }
  const text = String((req.body as { text?: string })?.text ?? '').slice(0, 400)
  if (!text) {
    res.status(400).json({ error: 'no-text' })
    return
  }
  try {
    const upstream = await fetch(
      process.env.XAI_TTS_URL || 'https://api.x.ai/v1/audio/speech',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: process.env.XAI_TTS_MODEL || 'grok-voice',
          voice: process.env.XAI_TTS_VOICE || 'ember',
          input: text,
        }),
      },
    )
    if (!upstream.ok) {
      res.status(502).json({ error: 'upstream', status: upstream.status })
      return
    }
    const buf = Buffer.from(await upstream.arrayBuffer())
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg')
    res.send(buf)
  } catch {
    res.status(502).json({ error: 'unreachable' })
  }
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, habs: habs.size, voice: process.env.XAI_API_KEY ? 'grok' : 'browser' })
})

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
      leaveOtherHabs(playerId, code)
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
      const playerId = payload?.playerId || crypto.randomUUID()
      if (hab.players.has(playerId)) {
        hab.setSocket(playerId, socket.id, true)
      } else {
        if (hab.phase !== 'lobby') {
          cb?.({ ok: false, error: 'That round already started' })
          return
        }
        hab.addPlayer({
          id: playerId,
          name: sanitizeName(payload?.name),
          role: null,
          ready: false,
          connected: true,
          host: false,
          socketId: socket.id,
        })
      }
      leaveOtherHabs(playerId, code)
      socket.data.playerId = playerId
      socket.data.code = code
      socket.join(code)
      cb?.({ ok: true, playerId, view: hab.viewFor(playerId) })
    },
  )

  socket.on('claim', (role: StationId | null, cb?: (res: unknown) => void) => {
    const hab = habForSocket(socket)
    if (!hab) return cb?.({ ok: false, error: 'No hab' })
    const err = hab.claim(socket.data.playerId, role)
    cb?.(err ? { ok: false, error: err } : { ok: true })
  })

  socket.on('ready', (ready: boolean, cb?: (res: unknown) => void) => {
    const hab = habForSocket(socket)
    if (!hab) return cb?.({ ok: false, error: 'No hab' })
    const err = hab.setReady(socket.data.playerId, ready)
    cb?.(err ? { ok: false, error: err } : { ok: true })
  })

  socket.on('start', (cb?: (res: unknown) => void) => {
    const hab = habForSocket(socket)
    if (!hab) return cb?.({ ok: false, error: 'No hab' })
    const err = hab.start(socket.data.playerId)
    cb?.(err ? { ok: false, error: err } : { ok: true })
  })

  socket.on('action', (action: ClientAction, cb?: (res: unknown) => void) => {
    const hab = habForSocket(socket)
    if (!hab) return cb?.({ ok: false, error: 'No hab' })
    const err = hab.applyAction(socket.data.playerId, action)
    cb?.(err ? { ok: false, error: err } : { ok: true })
  })

  socket.on('disconnect', () => {
    const hab = habForSocket(socket)
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
