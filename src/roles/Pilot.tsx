import type { CSSProperties } from 'react'
import { CREW_META } from '@shared/content'
import type { ClientView } from '@shared/types'
import { Demand } from '../components/Demand'
import { Frame } from '../components/Frame'
import { KeyLog } from '../components/Seal'
import { SignalPad } from '../components/SignalPad'
import { StormScope } from '../components/StormScope'
import { CrewReadouts } from './Engineer'

export function Pilot({ view }: { view: ClientView }) {
  return (
    <Frame who={CREW_META.pilot.callsign} tag="navigation — only you see the storm" timeLeft={view.timeLeft}>
      <Demand view={view} />
      <CrewReadouts view={view} crew="pilot" />
      <div className="grow" />
      <KeyLog view={view} crew="pilot" />
      <SignalPad view={view} crew="pilot" />
    </Frame>
  )
}

export function PilotReadout({ view }: { view: ClientView }) {
  const eta = view.stormEta
  // BRACE only counts in the last 3 seconds; T-4 leaves her one second to react.
  const imminent = eta != null && eta <= 4

  return (
    <div className="readout seat-readout" style={{ '--accent': CREW_META.pilot.accent } as CSSProperties}>
      <div className="readout-seat">{CREW_META.pilot.callsign}</div>
      <div className="label">dust front</div>
      <div className={`value ${view.stormActive ? 'v-danger' : imminent ? 'v-danger' : 'v-storm'}`}>
        {view.stormActive ? 'HIT' : eta == null ? '—' : `${Math.ceil(eta)}`}
        {eta != null && !view.stormActive ? <span className="unit">s</span> : null}
      </div>
      <StormScope eta={eta} active={!!view.stormActive} lead={24} />
      <div className="sub">
        {view.stormActive
          ? 'it is on us'
          : eta == null
            ? 'nothing on the scope yet'
            : imminent
              ? 'send BRACE now — she has to hold on in the last 3 seconds'
              : 'she needs shields up before it lands'}
      </div>
    </div>
  )
}
