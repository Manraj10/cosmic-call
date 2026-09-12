import { useEffect, useRef } from 'react'
import { CREW_META } from '@shared/content'
import type { ClientView } from '@shared/types'
import { Demand } from '../components/Demand'
import { Frame } from '../components/Frame'
import { SignalPad } from '../components/SignalPad'

export function Sparks({ view }: { view: ClientView }) {
  const end = useRef<HTMLDivElement>(null)
  const lines = view.alarms

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [lines.length])

  return (
    <Frame who={CREW_META.sparks.callsign} tag="communications — only you see what broke" timeLeft={view.timeLeft}>
      <Demand view={view} />
      <div className="readout fill" style={{ paddingBottom: 12 }}>
        <div className="label">alarm log</div>
        <div className="log" style={{ marginTop: 10, textAlign: 'left' }}>
          {lines.map((line, i) => (
            <div key={`${line}-${i}`} className={i === lines.length - 1 ? 'fresh' : i < lines.length - 4 ? 'old' : ''}>
              {line}
            </div>
          ))}
          <div ref={end} />
        </div>
      </div>
      <SignalPad view={view} crew="sparks" />
    </Frame>
  )
}
