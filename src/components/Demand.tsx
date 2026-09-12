import type { ClientView } from '@shared/types'

/** The thing that makes people shout at each other. One seat's order fights the next. */
export function Demand({ view }: { view: ClientView }) {
  if (!view.order && !view.gripe) return null
  return (
    <div className={`demand${view.order?.tone === 'fight' ? ' fight' : view.order || view.gripe ? ' warn' : ''}`}>
      {view.gripe ? <div className="gripe">{view.gripe}</div> : null}
      {view.order ? <div className="yell">{view.order.text}</div> : null}
    </div>
  )
}
