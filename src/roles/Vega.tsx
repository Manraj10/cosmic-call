import type { CSSProperties } from 'react'
import { CREW_META, VEGA_META, signalSendsTo } from '@shared/content'
import { MODULE_LABEL, MODULE_SHORT, moduleFor } from '@shared/habitat'
import { CREW_IDS, type ClientView, type HabView, type ValveId } from '@shared/types'
import { AirGauge } from '../components/AirGauge'
import { Demand } from '../components/Demand'
import { Frame } from '../components/Frame'
import { HabitatMap } from '../components/HabitatMap'
import { IncomingSlam } from '../components/IncomingSlam'
import { buzz } from '../haptics'
import { sendAction } from '../net'

export function Vega({ view }: { view: ClientView }) {
  const air = view.air ?? 0
  const band = view.airBand ?? 'ok'
  const waiting = view.signals.some((s) => s.fresh)
  const danger = band === 'critical' || band === 'over'
  const hab = view.hab
  const card = view.signals.filter((s) => s.fresh).at(-1)
  // Every card points at where it wants her, whatever its seal. A map that only
  // lit up for good seals would read the badge for her.
  const target = card ? moduleFor(signalSendsTo(card.signal)) : null

  return (
    <Frame who={VEGA_META.callsign} tag="oxygen — pictures slam the glass · you have to run" timeLeft={null} strobe={danger}>
      <IncomingSlam view={view} />
      <Demand view={view} />
      {waiting ? null : <div className="silent-note">no picture yet — you are on your own</div>}

      {hab ? (
        <HabitatMap
          hab={hab}
          panel={view}
          target={target}
          onWalk={(to) => void sendAction({ type: 'walk', to }).catch(() => {})}
        />
      ) : null}

      <div className="readout">
        <div className="label">cabin air</div>
        <AirGauge air={air} band={band} />
        <div className={`value air-value ${danger ? 'v-danger' : 'v-air'}`}>
          {Math.round(air)}
          <span className="unit">%</span>
        </div>
        <div className="sub">
          {band === 'over'
            ? 'too much — something will split'
            : band === 'critical'
              ? 'almost gone'
              : band === 'low'
                ? 'falling'
                : 'holding'}
        </div>
      </div>

      {hab ? <Controls view={view} hab={hab} /> : null}
    </Frame>
  )
}

/** Only what is bolted to the floor she is standing on. Everything else is a walk away. */
function Controls({ view, hab }: { view: ClientView; hab: HabView }) {
  const band = view.airBand ?? 'ok'
  const walking = hab.walkingTo
  const at = hab.at

  return (
    <div className={`controls${walking ? ' in-transit' : ''}`}>
      {walking ? (
        <div className="controls-transit">
          running to {MODULE_LABEL[walking]} — hands off until you arrive
        </div>
      ) : (
        <div className="controls-where">{MODULE_LABEL[at]}</div>
      )}

      {!walking && at === 'plant' ? (
        <>
          <div className="pair">
            {(['port', 'starboard'] as ValveId[]).map((valve) => {
              const sealed = view.valves?.[valve] === 'sealed'
              return (
                <button
                  key={valve}
                  className={`ctl ${sealed ? 'off' : 'on'}`}
                  onClick={() => void sendAction({ type: 'valve', valve, sealed: !sealed })}
                >
                  <span className="name">{valve === 'port' ? 'port valve' : 'stbd valve'}</span>
                  <span className="state">{sealed ? 'SEALED' : 'OPEN'}</span>
                </button>
              )
            })}
          </div>
          <button
            className={`ctl ${view.pumpOn ? (band === 'over' ? 'hot' : 'on') : 'off'}`}
            onClick={() => void sendAction({ type: 'pump', on: !view.pumpOn })}
          >
            <span className="name">air pump</span>
            <span className="state">{view.pumpOn ? 'RUNNING' : 'OFF'}</span>
          </button>
        </>
      ) : null}

      {!walking && at === 'lock' ? (
        <button
          className={`ctl ${view.shieldsOn ? 'on' : 'off'}`}
          onClick={() => void sendAction({ type: 'shields', on: !view.shieldsOn })}
        >
          <span className="name">dust shields</span>
          <span className="state">{view.shieldsOn ? 'UP' : 'DOWN'}</span>
        </button>
      ) : null}

      {!walking && at === 'comms' ? <RotateBank hab={hab} /> : null}

      {!walking && at === 'spine' && hab.tokenAt !== 'spine' && !hab.holdingToken ? (
        <div className="controls-empty">nothing bolted here — it is a corridor</div>
      ) : null}

      {!walking && (hab.holdingToken || hab.tokenAt === at) ? (
        <button
          className={`ctl token-ctl${hab.holdingToken ? ' held' : ''}`}
          onClick={() => void sendAction({ type: 'token', take: !hab.holdingToken })}
        >
          <span className="name">key token</span>
          <span className="state">{hab.holdingToken ? `LEAVE IT IN ${MODULE_SHORT[at]}` : 'TAKE IT'}</span>
        </button>
      ) : null}

      <button
        className={`ctl brace${view.braced ? ' held' : ''}`}
        onClick={() => {
          buzz(40)
          void sendAction({ type: 'brace' })
        }}
      >
        <span className="name">hold on</span>
        <span className="state">{view.braced ? 'BRACED' : 'BRACE ANYWHERE'}</span>
      </button>
    </div>
  )
}

/**
 * The registry. A key cannot be rotated over the bus that lost it, so these
 * stay dead until the key token is in her hand — and rotating a seat that
 * was clean costs the table, so each wears the colour of the console it kills.
 */
function RotateBank({ hab }: { hab: HabView }) {
  return (
    <div className="registry">
      <div className="registry-note">
        {hab.holdingToken
          ? 'key registry — rotate the seat they shouted about'
          : `locked — you need the key token${hab.tokenAt ? `. it is in ${MODULE_SHORT[hab.tokenAt]}` : ''}`}
      </div>
      <div className="revoke-row">
        {CREW_IDS.map((seat) => (
          <button
            key={seat}
            className="rev"
            disabled={!hab.holdingToken}
            onClick={() => void sendAction({ type: 'revoke', seat })}
            style={{ '--accent': CREW_META[seat].accent } as CSSProperties}
          >
            <span className="rname">{CREW_META[seat].callsign}</span>
            <span className="rwhat">rotate key</span>
          </button>
        ))}
      </div>
    </div>
  )
}
