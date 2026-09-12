import { CREW_META } from '@shared/content'
import type { ClientView } from '@shared/types'
import { Frame } from '../components/Frame'
import { PowerCells } from '../components/PowerCells'
import { SignalPad } from '../components/SignalPad'

export function Engineer({ view }: { view: ClientView }) {
  const power = view.power ?? 0
  const tone = power < 25 ? 'v-danger' : power < 50 ? 'v-power' : 'v-ok'

  return (
    <Frame who={CREW_META.engineer.callsign} tag="only you see the reactor" timeLeft={view.timeLeft}>
      <div className="readout">
        <div className="label">reactor power</div>
        <div className={`value ${tone}`}>
          {power}
          <span className="unit">%</span>
        </div>
        <PowerCells power={power} />
        <div className="sub">
          {power < 15
            ? 'not enough to run the pump and the shields'
            : power < 40
              ? 'she has to choose: pump or shields'
              : 'enough for both, for now'}
        </div>
      </div>
      <div className="grow" />
      <SignalPad view={view} />
    </Frame>
  )
}
