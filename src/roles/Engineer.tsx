import type { CSSProperties } from 'react'
import { CREW_META } from '@shared/content'
import type { ClientView, CrewId } from '@shared/types'
import { Demand } from '../components/Demand'
import { Frame } from '../components/Frame'
import { PowerCells } from '../components/PowerCells'
import { KeyLog } from '../components/Seal'
import { SignalPad } from '../components/SignalPad'
import { PilotReadout } from './Pilot'
import { SparksReadout } from './Sparks'

export function Engineer({ view }: { view: ClientView }) {
  return (
    <Frame who={CREW_META.engineer.callsign} tag="power — only you see the reactor" timeLeft={view.timeLeft}>
      <Demand view={view} />
      <CrewReadouts view={view} crew="engineer" />
      <div className="grow" />
      <KeyLog view={view} crew="engineer" />
      <SignalPad view={view} crew="engineer" />
    </Frame>
  )
}

export function EngineerReadout({ view }: { view: ClientView }) {
  const power = view.power ?? 0
  const draw = view.draw ?? 0
  const tone = power < 25 ? 'v-danger' : power < 50 ? 'v-power' : 'v-ok'
  const load = draw >= 1.2 ? 'spiking' : draw >= 0.6 ? 'heavy' : 'quiet'

  return (
    <div className="readout seat-readout" style={{ '--accent': CREW_META.engineer.accent } as CSSProperties}>
      <div className="readout-seat">{CREW_META.engineer.callsign}</div>
      <div className="label">reactor power</div>
      <div className={`value ${tone}`}>
        {power}
        <span className="unit">%</span>
      </div>
      <PowerCells power={power} />
      <div className={`sub${load === 'spiking' ? ' v-danger' : ''}`}>
        {load === 'spiking'
          ? 'draw is spiking — something is dumping power'
          : load === 'heavy'
            ? 'draw is heavy'
            : 'draw is quiet'}
      </div>
      <div className="sub">
        {power < 15
          ? 'not enough to run the pump and the shields'
          : power < 40
            ? 'she has to choose: pump or shields'
            : 'enough for both, for now'}
      </div>
    </div>
  )
}

/**
 * Every instrument this console holds, its own first. On a short crew one
 * player reads out power and the storm in the same breath, and "twenty-two" is
 * useless unless the table knows which dial said it — so each keeps its callsign.
 *
 * The three role files import each other's readouts. That cycle is safe: they
 * are hoisted function declarations, and nothing calls one until render.
 */
export function CrewReadouts({ view, crew }: { view: ClientView; crew: CrewId }) {
  const seats = [crew, ...(view.covers ?? []).filter((c) => c !== crew)]
  return seats.map((seat) =>
    seat === 'engineer' ? (
      <EngineerReadout key={seat} view={view} />
    ) : seat === 'pilot' ? (
      <PilotReadout key={seat} view={view} />
    ) : (
      <SparksReadout key={seat} view={view} />
    ),
  )
}
