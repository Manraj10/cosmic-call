import type { ClientView } from '@shared/types'

export function Debrief({ view }: { view: ClientView }) {
  const won = view.outcome === 'won'
  return (
    <div
      className="app"
      style={{
        backgroundImage:
          'linear-gradient(rgba(13,9,6,0.7), rgba(13,9,6,0.96)), url(/art/hero-hab.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="verdict">
        <div className="tag">{won ? 'far side of the corridor' : 'hab-7 went quiet'}</div>
        <div className={`head ${won ? 'v-ok' : 'v-danger'}`}>
          {won ? 'STILL BREATHING' : 'NOBODY MADE IT'}
        </div>
        <div className="why">
          {won
            ? 'You got a message through in time. That is the entire skill of this game.'
            : view.loseReason}
        </div>
      </div>

      {!won ? (
        <div className="brief">
          Ask Vega what she actually saw. Nine times out of ten she was staring at the wrong valve
          while three people screamed the right answer at her.
        </div>
      ) : null}

      <div className="grow" />
      <button className="btn primary" onClick={() => location.reload()}>
        run it again
      </button>
      <div className="tag" style={{ textAlign: 'center' }}>swap seats — everyone should get a turn as Vega</div>
    </div>
  )
}
