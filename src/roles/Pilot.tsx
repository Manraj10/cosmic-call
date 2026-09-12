import { CREW_META } from '@shared/content'
import type { ClientView } from '@shared/types'
import { Frame } from '../components/Frame'
import { SignalPad } from '../components/SignalPad'
import { StormScope } from '../components/StormScope'

export function Pilot({ view }: { view: ClientView }) {
  const eta = view.stormEta
  const imminent = eta != null && eta <= 6

  return (
    <Frame who={CREW_META.pilot.callsign} tag="only you see the storm" timeLeft={view.timeLeft}>
      <div className="readout">
        <div className="label">dust front</div>
        <div className={`value ${view.stormActive ? 'v-danger' : imminent ? 'v-danger' : 'v-storm'}`}>
          {view.stormActive ? 'HIT' : eta == null ? '—' : `${Math.ceil(eta)}`}
          {eta != null && !view.stormActive ? <span className="unit">s</span> : null}
        </div>
        <StormScope eta={eta} active={view.stormActive} lead={24} />
        <div className="sub">
          {view.stormActive
            ? 'it is on us'
            : eta == null
              ? 'nothing on the scope yet'
              : imminent
                ? 'she needs to be braced RIGHT NOW'
                : 'she needs shields up before it lands'}
        </div>
      </div>
      <div className="grow" />
      <SignalPad view={view} />
    </Frame>
  )
}
