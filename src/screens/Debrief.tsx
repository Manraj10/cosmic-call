import { useEffect, useState } from 'react'
import { CREW_META } from '@shared/content'
import type { ClientView, IncidentReport } from '@shared/types'

/**
 * Mission Control reading the incident report back. The round is already graded
 * by the time this fires, so a slow or absent model costs a sentence and
 * nothing else — and with no key set the written line is what everyone hears.
 */
function useRadioDebrief(r: IncidentReport | null, won: boolean) {
  const [line, setLine] = useState<{ text: string; by: string } | null>(null)
  useEffect(() => {
    if (!r) return
    let live = true
    void fetch('/api/debrief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        won,
        delivered: r.delivered,
        forged: r.forged,
        replays: r.replays,
        obeyedUnsealed: r.obeyedUnsealed,
        stolenFrom: r.stolenFrom ? CREW_META[r.stolenFrom].callsign : null,
        timeToRevoke: r.timeToRevoke,
        falseRevokes: r.falseRevokes,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => {
        if (live && j) setLine(j as { text: string; by: string })
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [r, won])
  return line
}

export function Debrief({ view }: { view: ClientView }) {
  const won = view.outcome === 'won'
  const radio = useRadioDebrief(view.incident, won)
  return (
    <div
      className="app stage"
      style={{ '--plate': 'url(/art/hero-hab.webp)' } as React.CSSProperties}
    >
      <div className="verdict">
        <div className="tag">{won ? 'far side of the corridor' : 'hab-7 went quiet'}</div>
        <div className={`head ${won ? 'v-ok' : 'v-danger'}`}>
          {won ? 'STILL BREATHING' : 'NOBODY MADE IT'}
        </div>
        <div className="why">
          {won
            ? 'You talked to each other, you got a message through, and you did not do what GHOST asked. That is the entire skill of this game.'
            : view.loseReason}
        </div>
      </div>

      {view.incident ? <Incident r={view.incident} radio={radio} /> : null}

      {!won ? (
        <div className="brief">
          Ask Vega what she actually saw. Nine times out of ten she was staring at a broken seal
          while three people screamed the right answer at her.
        </div>
      ) : null}

      <div className="grow" />
      <button className="btn primary" onClick={() => location.reload()}>
        run it again
      </button>
      <div className="tag" style={{ textAlign: 'center' }}>
        swap seats — everyone should get a turn as Vega
      </div>
    </div>
  )
}

/**
 * The after-action report, not a score.
 *
 * The three lines that decide whether the crew actually did the job are: how
 * many unsigned orders the operator executed, how long a stolen key stayed
 * live, and how many clean seats got rotated on a guess. Those are the numbers
 * a security team drills against, and they are the numbers people argue about
 * at the table afterwards, which is the whole reason the round ends here.
 */
function Incident({
  r,
  radio,
}: {
  r: IncidentReport
  radio: { text: string; by: string } | null
}) {
  const clean = r.obeyedUnsealed === 0
  return (
    <div className="incident">
      <div className="incident-head">
        <span>incident report</span>
        <span className="tag">HAB-7 comms bus</span>
      </div>
      <div className={`incident-grade ${clean ? 'v-ok' : 'v-danger'}`}>{r.grade}</div>
      <div className="incident-rows">
        <Row k="orders on the glass" v={r.delivered} />
        <Row k="written by GHOST" v={r.forged} />
        <Row k="replayed at you" v={r.replays} />
        <Row
          k="unsigned orders you executed"
          v={r.obeyedUnsealed}
          tone={r.obeyedUnsealed === 0 ? 'good' : 'bad'}
        />
        <Row
          k="key stolen from"
          v={r.stolenFrom ? CREW_META[r.stolenFrom].callsign : 'nobody'}
        />
        <Row
          k="time to revoke"
          v={r.timeToRevoke == null ? (r.stolenFrom ? 'never caught' : '—') : `${r.timeToRevoke}s`}
          tone={
            r.stolenFrom == null
              ? undefined
              : r.timeToRevoke == null
                ? 'bad'
                : r.timeToRevoke < 10
                  ? 'good'
                  : undefined
          }
        />
        <Row k="clean keys rotated on a guess" v={r.falseRevokes} />
      </div>
      {radio ? (
        <div className="incident-radio">
          <span className="tag">mission control · {radio.by}</span>
          <p>{radio.text}</p>
        </div>
      ) : null}
      <div className="incident-note">
        {r.stolenFrom == null
          ? 'Nobody lost a key this round.'
          : r.timeToRevoke == null
            ? `GHOST held ${CREW_META[r.stolenFrom].callsign}'s key until the end. Every order it signed looked genuine on her glass — the only tell was in ${CREW_META[r.stolenFrom].callsign}'s own signing log.`
            : `${CREW_META[r.stolenFrom].callsign} spotted orders signed under their key and said so, and comms rotated it in ${r.timeToRevoke}s.`}
      </div>
    </div>
  )
}

function Row({ k, v, tone }: { k: string; v: string | number; tone?: 'good' | 'bad' }) {
  return (
    <div className={`irow${tone ? ` ${tone}` : ''}`}>
      <span className="ikey">{k}</span>
      <span className="ival">{v}</span>
    </div>
  )
}
