import type { ReactNode } from 'react'

export function Frame({
  who,
  tag,
  timeLeft,
  children,
  strobe,
}: {
  who: string
  tag: string
  timeLeft: number | null
  children: ReactNode
  strobe?: boolean
}) {
  const secs = timeLeft == null ? null : Math.ceil(timeLeft)
  return (
    <div className={`app${strobe ? ' strobe' : ''}`}>
      <div className="topbar">
        <div>
          <div className="who">{who}</div>
          <div className="tag">{tag}</div>
        </div>
        {secs != null ? (
          <div className={`clock${secs <= 15 ? ' urgent' : ''}`}>
            {String(Math.floor(secs / 60))}:{String(secs % 60).padStart(2, '0')}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  )
}
