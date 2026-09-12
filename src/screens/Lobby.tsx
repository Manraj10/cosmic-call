/** TRACK B — Friend. Restyle the station picker. Keep claim/ready/start wiring. */

import { ROLE_META, STATION_META } from '@shared/content'
import { ROLE_IDS } from '@shared/types'
import type { ClientView, StationId } from '@shared/types'
import { claim, setReady, startGame } from '../net'

export function Lobby(props: {
  view: ClientView
  error: string | null
  onError: (msg: string) => void
}) {
  const { view } = props
  const taken = new Set(view.players.map((p) => p.role))
  const honor =
    view.you.role && view.you.role !== 'board'
      ? ROLE_META[view.you.role].honor
      : view.you.role === 'board'
        ? 'Watch the public bus. Do not leak numbers to Power.'
        : 'Claim a station.'

  async function pick(role: StationId | null) {
    try {
      await claim(role)
    } catch (err) {
      props.onError(err instanceof Error ? err.message : 'claim failed')
    }
  }

  return (
    <div className="shell">
      <p className="track-tag">Track B · lobby glass</p>
      <p className="kicker">Hab code</p>
      <h1>{view.code}</h1>
      <p>Hand this code to the other laptop / phones.</p>
      <div className="panel">
        {view.players.map((p) => (
          <div key={p.id}>
            {p.name} — {p.role ?? 'unassigned'} {p.ready ? '· READY' : ''}{' '}
            {p.host ? '· LEAD' : ''} {!p.connected ? '· dropped' : ''}
          </div>
        ))}
      </div>
      <div className="grid2">
        {ROLE_IDS.map((id) => {
          const meta = ROLE_META[id]
          const mine = view.you.role === id
          const blocked = taken.has(id) && !mine
          return (
            <button
              key={id}
              className={`btn ${mine ? 'on' : ''}`}
              disabled={blocked}
              onClick={() => void pick(mine ? null : id)}
            >
              <strong>{meta.title}</strong>
              <div className="kicker">{meta.constraint}</div>
            </button>
          )
        })}
      </div>
      <button
        className="btn"
        style={{ marginTop: 10, width: '100%' }}
        onClick={() => void pick(view.you.role === 'board' ? null : 'board')}
      >
        {STATION_META.board.title} ({STATION_META.board.constraint})
      </button>
      <p style={{ marginTop: 12 }}>{honor}</p>
      {view.you.role ? (
        <button className={`btn ${view.you.ready ? 'on' : ''}`} onClick={() => void setReady(!view.you.ready)}>
          {view.you.ready ? 'Ready' : 'Mark ready'}
        </button>
      ) : null}
      {view.you.host ? (
        <button
          className="btn"
          style={{ width: '100%', marginTop: 8 }}
          onClick={() =>
            void startGame().catch((e: unknown) =>
              props.onError(e instanceof Error ? e.message : 'start failed'),
            )
          }
        >
          Start mission
        </button>
      ) : (
        <p className="kicker">Waiting on hab lead to start.</p>
      )}
      {props.error ? <p className="banner">{props.error}</p> : null}
    </div>
  )
}
