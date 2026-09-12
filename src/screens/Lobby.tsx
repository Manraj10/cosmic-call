import { BRIEFING, CREW_META, STATION_META, VEGA_META } from '@shared/content'
import type { Briefing } from '@shared/content'
import { CREW_IDS } from '@shared/types'
import type { ClientView, StationId } from '@shared/types'
import { JoinQr } from '../components/JoinQr'
import { claim, setReady, startGame } from '../net'

const ART: Record<string, string> = {
  vega: '/art/crew-vega.webp',
  engineer: '/art/crew-rook.webp',
  pilot: '/art/crew-idris.webp',
  sparks: '/art/crew-chen.webp',
}

export function Lobby(props: {
  view: ClientView
  error: string | null
  onError: (msg: string) => void
}) {
  const { view } = props
  const taken = new Set(view.players.filter((p) => p.connected).map((p) => p.role))
  const mine = view.you.role
  const crewSeated = CREW_IDS.filter((id) => taken.has(id)).length

  async function pick(role: StationId | null) {
    try {
      await claim(role)
    } catch (err) {
      props.onError(err instanceof Error ? err.message : 'seat taken')
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <div className="tag">hab code — read it out loud</div>
          <div className="who">COSMIC CALL</div>
        </div>
      </div>
      <div className="code">{view.code}</div>
      <JoinQr code={view.code} />

      <div className="roster">
        {view.players.map((p) => (
          <div className="row" key={p.id}>
            <span>
              <b>{p.name}</b>
              {p.host ? ' · lead' : ''}
              {!p.connected ? ' · dropped' : ''}
            </span>
            <span>
              {p.role ? STATION_META[p.role].title : 'no seat'}
              {p.ready ? ' ✓' : ''}
            </span>
          </div>
        ))}
      </div>

      <div className="seats">
        <button
          className={`seat vega${mine === 'vega' ? ' mine' : ''}${taken.has('vega') && mine !== 'vega' ? ' taken' : ''}`}
          disabled={taken.has('vega') && mine !== 'vega'}
          onClick={() => void pick(mine === 'vega' ? null : 'vega')}
        >
          <img className="badge" src={ART.vega} alt="" style={{ objectFit: 'cover' }} />
          <span className="name">{VEGA_META.callsign} — every control, no hearing</span>
          <span className="desc">{BRIEFING.vega.see}</span>
        </button>

        {CREW_IDS.map((id) => {
          const meta = CREW_META[id]
          const isMine = mine === id
          const blocked = taken.has(id) && !isMine
          return (
            <button
              key={id}
              className={`seat ${id}${isMine ? ' mine' : ''}${blocked ? ' taken' : ''}`}
              disabled={blocked}
              onClick={() => void pick(isMine ? null : id)}
            >
              <img className="badge" src={ART[id]} alt="" style={{ objectFit: 'cover' }} />
              <span className="name">
                {meta.callsign} — {meta.sees.toLowerCase()}
              </span>
              <span className="desc">{BRIEFING[id].see}</span>
            </button>
          )
        })}

        <button
          className={`seat board${mine === 'board' ? ' mine' : ''}`}
          onClick={() => void pick(mine === 'board' ? null : 'board')}
        >
          <span className="badge">▦</span>
          <span className="name">hab monitor</span>
          <span className="desc">
            Spectator screen for filming. Players: do not look at this. It has every number.
          </span>
        </button>
      </div>

      {crewSeated < CREW_IDS.length ? (
        <div className="tag" style={{ textAlign: 'center', lineHeight: 1.7 }}>
          {crewSeated} of {CREW_IDS.length} crew seats taken · an empty console's instruments merge
          onto the seated ones, so nothing goes dark · one seated player is enough to launch
        </div>
      ) : null}

      {mine && mine !== 'board' ? <BriefCard b={BRIEFING[mine]} /> : null}
      <a className="tag howlink" href="/how.html" target="_blank" rel="noreferrer">
        how to play, on one page
      </a>

      {mine ? (
        <button
          className={`btn ${view.you.ready ? 'ghost' : 'primary'}`}
          onClick={() =>
            void setReady(!view.you.ready).catch((e: unknown) =>
              props.onError(e instanceof Error ? e.message : 'could not reach the hab'),
            )
          }
        >
          {view.you.ready ? 'ready — tap to undo' : 'i am ready'}
        </button>
      ) : (
        <div className="tag" style={{ textAlign: 'center' }}>take a seat</div>
      )}

      {view.you.host ? (
        <button
          className="btn primary"
          onClick={() =>
            void startGame().catch((e: unknown) =>
              props.onError(e instanceof Error ? e.message : 'could not launch'),
            )
          }
        >
          launch the round
        </button>
      ) : (
        <div className="tag" style={{ textAlign: 'center' }}>waiting on the hab lead</div>
      )}

      {props.error ? <div className="notice">{props.error}</div> : null}
    </div>
  )
}

function BriefCard({ b }: { b: Briefing }) {
  return (
    <div className="brief briefing">
      <p className="brief-rule">{b.rule}</p>
      <p>
        <b>you see</b>
        {b.see}
      </p>
      <p>
        <b>your buttons</b>
        {b.buttons}
      </p>
      <p>
        <b>your job</b>
        {b.job}
      </p>
    </div>
  )
}
