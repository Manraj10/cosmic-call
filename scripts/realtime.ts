/** Run against a local QA server: npx tsx scripts/realtime.ts [http://127.0.0.1:43128] */
import assert from 'node:assert/strict'
import { io, type Socket } from 'socket.io-client'
import { sealOrder } from '../shared/seal.ts'
import { ROLE_IDS, type ClientView, type StationId } from '../shared/types.ts'

const url = process.argv[2] ?? 'http://127.0.0.1:43128'
const clients: Socket[] = []
const views = new Map<Socket, ClientView>()
const speech = new Map<Socket, number>()

function request(socket: Socket, event: string, ...args: unknown[]) {
  return new Promise<{ ok: boolean; error?: string; view: ClientView }>((resolve, reject) => {
    socket.timeout(5000).emit(event, ...args, (error: Error | null, result: { ok: boolean; error?: string; view: ClientView }) => error ? reject(error) : resolve(result))
  })
}

function waitView(socket: Socket, predicate: (view: ClientView) => boolean): Promise<ClientView> {
  const current = views.get(socket)
  if (current && predicate(current)) return Promise.resolve(current)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('view', check); reject(new Error('Timed out waiting for expected room state')) }, 5000)
    function check(view: ClientView) {
      if (predicate(view)) { clearTimeout(timer); socket.off('view', check); resolve(view) }
    }
    socket.on('view', check)
  })
}

async function connect() {
  const socket = io(url, { autoConnect: false, reconnection: false, transports: ['websocket'] })
  clients.push(socket)
  socket.on('view', (view: ClientView) => views.set(socket, view))
  socket.on('speak', () => speech.set(socket, (speech.get(socket) ?? 0) + 1))
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve)
    socket.once('connect_error', reject)
    socket.connect()
  })
  return socket
}

try {
  const board = await connect()
  const created = await request(board, 'create', { name: 'QA Monitor', playerId: crypto.randomUUID() })
  assert.equal(created.ok, true)
  const code = created.view.code
  assert.equal((await request(board, 'claim', 'board')).ok, true)
  const crew = new Map<StationId, Socket>()
  const ids = new Map<StationId, string>()
  for (const role of ROLE_IDS) {
    const socket = await connect()
    const playerId = crypto.randomUUID()
    ids.set(role, playerId)
    crew.set(role, socket)
    assert.equal((await request(socket, 'join', { code, name: `QA ${role}`, playerId })).ok, true)
    assert.equal((await request(socket, 'claim', role)).ok, true)
    assert.equal((await request(socket, 'ready', true)).ok, true)
  }
  const vega = crew.get('vega')!
  const rook = crew.get('engineer')!
  assert.equal((await request(rook, 'start')).ok, false, 'Non-host must not launch')
  assert.equal((await request(board, 'start')).ok, true)
  const vegaView = await waitView(vega, (v) => v.phase === 'play')
  assert.equal(vegaView.timeLeft, null)
  assert.equal(vegaView.power, null)
  assert.equal(vegaView.seal, null)
  assert.equal(vegaView.spectator, null)
  assert.deepEqual(vegaView.alarms, [])
  assert.equal(vegaView.hab?.at, 'spine')
  assert.equal((await request(rook, 'action', { type: 'walk', to: 'plant' })).ok, false)
  assert.equal((await request(vega, 'action', { type: 'pump', on: false })).ok, false)
  assert.equal((await request(vega, 'action', { type: 'revoke', seat: 'engineer' })).ok, false)

  const key = (await waitView(rook, (v) => v.seal !== null)).seal!
  assert.equal((await request(rook, 'action', { type: 'signal', signal: 'pump-off', seq: key.nextSeq, tag: 'bad' })).ok, false)
  const tag = await sealOrder(key.key, key.roundId, 'engineer', 'pump-off', key.nextSeq)
  assert.equal((await request(rook, 'action', { type: 'signal', signal: 'pump-off', seq: key.nextSeq, tag })).ok, true)
  const received = await waitView(vega, (v) => v.signals.some((s) => s.signal === 'pump-off'))
  assert.equal(received.signals.at(-1)?.seal, 'sealed')
  const publicView = await waitView(board, (v) => !!v.spectator?.traffic.length)
  assert.equal(publicView.spectator?.traffic.at(-1)?.signal, 'pump-off')
  assert.equal(publicView.seal, null, 'Spectators must never receive signing secrets')

  assert.equal((await request(vega, 'action', { type: 'token', take: true })).ok, true)
  assert.equal((await request(vega, 'action', { type: 'walk', to: 'plant' })).ok, true)
  assert.equal((await request(vega, 'action', { type: 'pump', on: false })).ok, false, 'Controls must be locked during transit')
  await waitView(vega, (v) => v.hab?.at === 'plant' && v.hab.walkingTo === null)
  assert.equal((await request(vega, 'action', { type: 'pump', on: false })).ok, true)
  await waitView(board, (v) => v.spectator?.operator.at === 'plant' && v.spectator.pumpOn === false)
  assert.equal((await request(vega, 'action', { type: 'pump', on: true })).ok, true)
  console.log('PASS: five clients, host permissions, signed orders, private views, physical travel and spectator synchronization')

  vega.disconnect()
  await waitView(board, (v) => v.players.some((p) => p.role === 'vega' && !p.connected))
  const resumed = await connect()
  const rejoined = await request(resumed, 'join', { code, name: 'QA vega', playerId: ids.get('vega') })
  assert.equal(rejoined.ok, true)
  assert.equal(rejoined.view.you.role, 'vega')
  assert.equal(rejoined.view.hab?.at, 'plant')
  assert.equal(rejoined.view.hab?.holdingToken, true)
  assert.equal(rejoined.view.players.filter((p) => p.role === 'vega').length, 1)
  assert.equal(speech.get(vega) ?? 0, 0)
  assert.equal(speech.get(resumed) ?? 0, 0)
  assert.ok((speech.get(rook) ?? 0) > 0, 'Crew must receive Mission Control audio events')
  console.log('PASS: reconnect retains seat, location and token without duplicate players or Vega audio')
} finally {
  for (const socket of clients) socket.disconnect()
}
