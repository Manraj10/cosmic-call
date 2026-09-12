import { useEffect, useRef, type CSSProperties } from 'react'
import { CREW_META } from '@shared/content'
import type { ClientView } from '@shared/types'
import { Demand } from '../components/Demand'
import { Frame } from '../components/Frame'
import { KeyLog } from '../components/Seal'
import { SignalPad } from '../components/SignalPad'
import { CrewReadouts } from './Engineer'

export function Sparks({ view }: { view: ClientView }) {
  return (
    <Frame who={CREW_META.sparks.callsign} tag="communications — the alarm log and the rotate cards" timeLeft={view.timeLeft}>
      <Demand view={view} />
      <CrewReadouts view={view} crew="sparks" />
      <KeyLog view={view} crew="sparks" />
      <SignalPad view={view} crew="sparks" />
    </Frame>
  )
}

export function SparksReadout({ view }: { view: ClientView }) {
  const end = useRef<HTMLDivElement>(null)
  const lines = view.alarms

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [lines.length])

  return (
    <div className="readout fill seat-readout" style={{ '--accent': CREW_META.sparks.accent } as CSSProperties}>
      <div className="readout-seat">{CREW_META.sparks.callsign}</div>
      <div className="label">alarm log</div>
      <div className="log alarm-log">
        {lines.map((line, i) => (
          <div key={`${line}-${i}`} className={i === lines.length - 1 ? 'fresh' : i < lines.length - 4 ? 'old' : ''}>
            {line}
          </div>
        ))}
        <div ref={end} />
      </div>
    </div>
  )
}
