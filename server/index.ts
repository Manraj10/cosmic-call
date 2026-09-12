import cors from 'cors'
import express from 'express'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import { hearsSpeech } from '../shared/types.ts'
import type { ClientAction, StationId } from '../shared/types.ts'
import { debriefLine } from './director.ts'
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
        if (!p.socketId || !hearsSpeech(p.role)) continue
        io.to(p.socketId).emit('speak', packet)
      }
    },
  }
}

/**
 * Server-side voice proxy: ElevenLabs, then xAI, then nothing.
 *
 * Every key stays on the host machine and is never shipped to a phone. With no
 * key at all this route answers 501 and each client speaks with the browser's
 * own engine, so the game has no setup step and no hard dependency on either
 * vendor being reachable from a conference hall.
 *
 * Vega is never sent a speech event in the first place, so this route is not
 * what protects her — `hearsSpeech` is. This only decides how good the radio
 * sounds for everyone else.
 */
async function elevenLabs(text: string): Promise<Response | null> {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) return null
  const voice = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': key },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5',
        voice_settings: { stability: 0.35, similarity_boost: 0.8 },
      }),
    })
    return r.ok ? r : null
  } catch {
    return null
  }
}

async function grokVoice(text: string): Promise<Response | null> {
  const key = process.env.XAI_API_KEY
  if (!key) return null
  try {
    const r = await fetch(process.env.XAI_TTS_URL || 'https://api.x.ai/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.XAI_TTS_MODEL || 'grok-voice',
        voice: process.env.XAI_TTS_VOICE || 'ember',
        input: text,
      }),
    })
    return r.ok ? r : null
  } catch {
    return null
  }
}

app.post('/api/voice', async (req, res) => {
  const text = String((req.body as { text?: string })?.text ?? '').slice(0, 400)
  if (!text) {
    res.status(400).json({ error: 'no-text' })
    return
  }
  const upstream = (await elevenLabs(text)) ?? (await grokVoice(text))
  if (!upstream) {
    res.status(501).json({ error: 'no-voice' })
    return
  }
  const buf = Buffer.from(await upstream.arrayBuffer())
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg')
  res.send(buf)
})

/**
  * The after-action line. Called once, after the round is already graded, so a
  * slow or missing model costs a sentence and never a result.
  */
app.post('/api/debrief', async (req, res) => {
  const f = req.body as Parameters<typeof debriefLine>[0]
  if (!f || typeof f.delivered !== 'number') {
    res.status(400).json({ error: 'no-report' })
    return
  }
  res.json(await debriefLine(f))
})

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    habs: habs.size,
    voice: process.env.ELEVENLABS_API_KEY
      ? 'elevenlabs'
      : process.env.XAI_API_KEY
        ? 'grok'
        : 'browser',
    director: process.env.IFM_API_KEY
      ? 'ifm-k2'
      : process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
        ? 'gemini'
        : process.env.XAI_API_KEY || process.env.GROK_API_KEY
          ? 'grok'
          : 'hab',
  })
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

  socket.on('action', async (action: ClientAction, cb?: (res: unknown) => void) => {
    const hab = habForSocket(socket)
    if (!hab) return cb?.({ ok: false, error: 'No hab' })
    // Verifying a signature is async, so an order is acknowledged only once the
    // seal has actually been checked. A phone that gets `ok` was believed.
    const err = await hab.applyAction(socket.data.playerId, action)
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

/**
 * The UI dev server owns 43127. Some launchers inject `PORT` meaning "the port
 * the web thing should be on", which would quietly point the ship at the socket
 * Vite is already holding and leave every socket connection refused. Take
 * SHIP_PORT first, and refuse to honour a PORT that collides in dev.
 */
const CLIENT_PORT = 43127
const requested = Number(process.env.SHIP_PORT || process.env.PORT || 43128)
const port =
  requested === CLIENT_PORT && process.env.NODE_ENV !== 'production' ? 43128 : requested
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`HAB bus on :${port}`)
})
