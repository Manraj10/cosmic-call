import { VEGA_META, signalSendsTo } from '@shared/content'
import { MODULE_SHORT, moduleFor } from '@shared/habitat'
import type { ClientView, ValveId } from '@shared/types'
import { AirGauge } from '../components/AirGauge'
import { Demand } from '../components/Demand'
import { Frame } from '../components/Frame'
import { HabDeck } from '../components/HabDeck'
import { IncomingSlam } from '../components/IncomingSlam'
import { buzz } from '../haptics'
import { sendAction } from '../net'

export function Vega({ view }: { view: ClientView }) {
  const air = view.air ?? 0
  const band = view.airBand ?? 'ok'
  const waiting = view.signals.some((s) => s.fresh)
  const danger = band === 'critical' || band === 'over'
  const hab = view.hab
  const moving = !!hab?.walkingTo
  const at = hab?.at
  const inPlant = at === 'plant' && !moving
  const inLock = at === 'lock' && !moving
  const anywhere = !!at && !moving

  return (
    <Frame who={VEGA_META.callsign} tag="oxygen — pictures slam the glass · you have to run" timeLeft={null} strobe={danger}>
      <IncomingSlam view={view} />
      <Demand view={view} />
      <HabDeck view={view} />
      {waiting ? null : <div className="silent-note">no picture yet — you are on your own</div>}

      <div className="readout">
        <div className="label">cabin air</div>
        <AirGauge air={air} band={band} />
        <div className={`value ${danger ? 'v-danger' : 'v-air'}`} style={{ fontSize: 46 }}>
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

      <div className={`controls${moving ? ' dimmed' : ''}`}>
        <div className="pair">
          {(['port', 'starboard'] as ValveId[]).map((valve) => {
            const sealed = view.valves?.[valve] === 'sealed'
            return (
              <button
                key={valve}
                className={`ctl ${sealed ? 'off' : 'on'}`}
                disabled={!inPlant}
                onClick={() => void sendAction({ type: 'valve', valve, sealed: !sealed })}
              >
                <span className="name">{valve === 'port' ? 'port valve' : 'stbd valve'}</span>
                <span className="state">
                  {!inPlant ? 'IN PLANT' : sealed ? 'SEALED' : 'OPEN'}
                </span>
              </button>
            )
          })}
        </div>
        <div className="pair">
          <button
            className={`ctl ${view.pumpOn ? (band === 'over' ? 'hot' : 'on') : 'off'}`}
            disabled={!inPlant}
            onClick={() => void sendAction({ type: 'pump', on: !view.pumpOn })}
          >
            <span className="name">air pump</span>
            <span className="state">{!inPlant ? 'IN PLANT' : view.pumpOn ? 'RUNNING' : 'OFF'}</span>
          </button>
          <button
            className={`ctl ${view.shieldsOn ? 'on' : 'off'}`}
            disabled={!inLock}
            onClick={() => void sendAction({ type: 'shields', on: !view.shieldsOn })}
          >
            <span className="name">dust shields</span>
            <span className="state">{!inLock ? 'IN LOCK' : view.shieldsOn ? 'UP' : 'DOWN'}</span>
          </button>
        </div>
        <button
          className={`ctl brace${view.braced ? ' held' : ''}`}
          disabled={!anywhere}
          onClick={() => {
            buzz(40)
            void sendAction({ type: 'brace' })
          }}
        >
          <span className="name">hold on</span>
          <span className="state">{view.braced ? 'BRACED' : 'BRACE ANYWHERE'}</span>
        </button>
      </div>
    </Frame>
  )
}

/** Where the latest card wants her body. */
export function slamDestination(view: ClientView): string | null {
  const latest = view.signals.filter((s) => s.fresh).at(-1)
  if (!latest) return null
  const m = moduleFor(signalSendsTo(latest.signal))
  return m ? MODULE_SHORT[m] : null
}
