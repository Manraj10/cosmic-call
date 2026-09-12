import {
  MODULE_HOLDS,
  MODULE_LABEL,
  MODULE_SHORT,
  MODULES,
  neighbours,
  type ModuleId,
} from '@shared/habitat'
import { CREW_META } from '@shared/content'
import type { ClientView, CrewId } from '@shared/types'
import { sendAction } from '../net'

/**
 * HAB-7 as a place Vega has to run through. Crew never see this — only her
 * body is on the map. A forged order that sends her the wrong way costs seconds
 * of air, not just a bad press.
 */
export function HabDeck({ view }: { view: ClientView }) {
  const hab = view.hab
  if (!hab) return null
  const moving = hab.walkingTo != null
  const links = neighbours(hab.at)

  return (
    <div className={`habdeck${moving ? ' moving' : ''}`}>
      <div className="hab-head">
        <span className="tag">you are in</span>
        <span className="hab-here">{MODULE_SHORT[hab.at]}</span>
        <span className="hab-holds">{MODULE_HOLDS[hab.at]}</span>
      </div>

      {moving ? (
        <div className="hab-transit">
          running to {MODULE_SHORT[hab.walkingTo!]} · {(hab.arriveInMs / 1000).toFixed(1)}s
        </div>
      ) : (
        <div className="hab-grid">
          {MODULES.map((m) => {
            const here = m === hab.at
            const can = links.includes(m)
            const tokenHere = hab.tokenAt === m
            return (
              <button
                key={m}
                className={`hab-mod${here ? ' here' : ''}${can ? ' go' : ''}${tokenHere ? ' token' : ''}`}
                disabled={here || !can || moving}
                onClick={() => void sendAction({ type: 'walk', to: m })}
              >
                <span className="hm-name">{MODULE_SHORT[m]}</span>
                <span className="hm-sub">{MODULE_LABEL[m]}</span>
                {tokenHere ? <span className="hm-tok">KEY</span> : null}
                {here ? <span className="hm-tok you">YOU</span> : null}
              </button>
            )
          })}
        </div>
      )}

      <div className="hab-token">
        {hab.holdingToken ? (
          <button className="tok-btn held" onClick={() => void sendAction({ type: 'token', take: false })}>
            drop hardware key here
          </button>
        ) : hab.tokenAt === hab.at ? (
          <button className="tok-btn" onClick={() => void sendAction({ type: 'token', take: true })}>
            pick up hardware key
          </button>
        ) : (
          <div className="tag">
            key is in {hab.tokenAt ? MODULE_SHORT[hab.tokenAt] : 'your hand'}
          </div>
        )}
      </div>

      {hab.at === 'comms' ? <Registry view={view} ready={hab.holdingToken && !moving} /> : null}
    </div>
  )
}

function Registry({ ready }: { view: ClientView; ready: boolean }) {
  const seats: CrewId[] = ['engineer', 'pilot']
  return (
    <div className="registry">
      <div className="tag" style={{ textAlign: 'center' }}>
        {ready
          ? 'key registry — rotate the seat they shouted about'
          : 'registry locked — bring the hardware key from the Spine'}
      </div>
      <div className="revoke-row">
        {seats.map((s) => (
          <button
            key={s}
            className="rev"
            disabled={!ready}
            onClick={() => void sendAction({ type: 'revoke', seat: s })}
            style={{ '--accent': CREW_META[s].accent } as React.CSSProperties}
          >
            <span className="rname">{CREW_META[s].callsign}</span>
            <span className="rwhat">rotate key</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function moduleHint(id: ModuleId): string {
  return MODULE_SHORT[id]
}
